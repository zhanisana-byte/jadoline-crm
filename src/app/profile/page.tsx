"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

import type {
  ProfileRow,
  MembershipRow,
  MemberViewRow,
  AgencyKeyRow,
  AgencyRow,
} from "@/components/profile/types";

import { humanErr, firstAgency } from "@/components/profile/ui";

// ---------- Helpers ----------
function makeKey(len = 10) {
  // simple clé lisible
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  const isOwner = useMemo(() => {
    if (!selectedAgencyId) return false;
    const m = memberships.find((x) => x.agency_id === selectedAgencyId);
    return m?.role === "OWNER";
  }, [memberships, selectedAgencyId]);

  const selectedAgencyName = useMemo(() => {
    const m = memberships.find((x) => x.agency_id === selectedAgencyId);
    const a = firstAgency(m?.agencies) as AgencyRow | null;
    return a?.name ?? "—";
  }, [memberships, selectedAgencyId]);

  // ---------- Load ----------
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!mounted) return;

      if (userErr || !user) {
        setLoading(false);
        router.replace("/login?error=not_authenticated");
        return;
      }

      setEmail(user.email ?? "");
      setEmailConfirmed(!!(user as any).email_confirmed_at);

      // Optionnel: si ta RPC existe (réparation agence perso), sinon ignore
      try {
        await supabase.rpc("ensure_personal_agency");
      } catch {}

      // 1) Profile
      const { data: prof, error: profErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, created_at, avatar_url, agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profErr || !prof) {
        setLoading(false);
        setMsg("Erreur: profil introuvable (users_profile).");
        return;
      }

      // Adapter -> ton type ProfileRow n’a pas agency_id dans types.ts
      // donc on ne le stocke pas dans profile, on le garde à part (selectedAgencyId).
      const profRow: ProfileRow = {
        user_id: prof.user_id,
        full_name: prof.full_name ?? null,
        role: prof.role,
        created_at: prof.created_at,
        avatar_url: prof.avatar_url ?? null,
      };
      setProfile(profRow);

      const profAgencyId: string | null = (prof as any).agency_id ?? null;

      // 2) Memberships + relation agencies
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("id, agency_id, user_id, role, status, agencies(id, name, archived_at)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (!mounted) return;

      if (memErr) {
        setLoading(false);
        setMsg("Erreur: impossible de charger les agences.");
        return;
      }

      const memRows = (mems ?? []) as MembershipRow[];
      setMemberships(memRows);

      // 3) Determine selected agency
      const first = memRows[0]?.agency_id ?? null;
      const selected = profAgencyId ?? first;

      setSelectedAgencyId(selected);

      // 4) Si agency_id vide dans users_profile => set
      if (!profAgencyId && selected) {
        await supabase
          .from("users_profile")
          .update({ agency_id: selected })
          .eq("user_id", user.id);
      }

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // ---------- Load members + key when selectedAgencyId changes ----------
  useEffect(() => {
    let mounted = true;

    async function loadAgencyStuff() {
      if (!selectedAgencyId) {
        setMembers([]);
        setAgencyKey(null);
        return;
      }

      // Members list
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, users_profile(full_name, avatar_url)")
        .eq("agency_id", selectedAgencyId);

      if (!mounted) return;

      if (!memErr) setMembers((mems ?? []) as MemberViewRow[]);
      else setMembers([]);

      // Active key for selected agency
      const { data: k, error: kErr } = await supabase
        .from("agency_keys")
        .select("id, key, active, created_at, agency_id")
        .eq("agency_id", selectedAgencyId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (!kErr) setAgencyKey((k as AgencyKeyRow) ?? null);
      else setAgencyKey(null);
    }

    loadAgencyStuff();
    return () => {
      mounted = false;
    };
  }, [selectedAgencyId, supabase]);

  // ---------- Actions ----------
  async function onSaveName(newName: string) {
    if (!profile) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: newName })
      .eq("user_id", profile.user_id);

    setBusy(false);

    if (error) return setMsg(humanErr(error));
    setProfile({ ...profile, full_name: newName });
    setMsg("✅ Nom mis à jour.");
  }

  async function onSelectAgency(agencyId: string) {
    if (!profile) return;
    setMsg(null);
    setSelectedAgencyId(agencyId);

    // Persist selection
    const { error } = await supabase
      .from("users_profile")
      .update({ agency_id: agencyId })
      .eq("user_id", profile.user_id);

    if (error) setMsg("⚠️ Impossible de sauvegarder l’agence active.");
  }

  async function onJoin(code: string) {
    setBusy(true);
    setMsg(null);

    const { data: res, error } = await supabase.rpc("join_with_code", {
      p_code: code,
    });

    setBusy(false);

    if (error) return setMsg(humanErr(error));
    if (!res?.ok) return setMsg("Clé invalide ❌");

    // Recharge memberships
    setMsg("✅ Rejoint avec succès.");

    // Si FITNESS -> redirect direct
    if (res.type === "FITNESS") {
      router.push("/dashboard/gym");
      return;
    }

    // Sinon AGENCY: refresh memberships (simple reload)
    router.refresh?.();
    // fallback si refresh non dispo:
    // location.reload();
  }

  async function onCreate(name: string) {
    if (!profile) return;

    setBusy(true);
    setMsg(null);

    // Option 1: si tu as une RPC create_agency -> utilise-la
    const rpcTry = await supabase.rpc("create_agency", { p_name: name }).catch(() => null);

    if (rpcTry && !rpcTry.error) {
      setBusy(false);
      setMsg("✅ Agence créée.");
      router.refresh?.();
      return;
    }

    // Option 2: fallback insert direct
    const { data: ag, error: agErr } = await supabase
      .from("agencies")
      .insert({ name, owner_id: profile.user_id })
      .select("id")
      .maybeSingle();

    if (agErr || !ag?.id) {
      setBusy(false);
      return setMsg(humanErr(agErr));
    }

    // membership OWNER
    const { error: mErr } = await supabase.from("agency_members").insert({
      agency_id: ag.id,
      user_id: profile.user_id,
      role: "OWNER",
      status: "active",
    });

    setBusy(false);

    if (mErr) return setMsg(humanErr(mErr));

    setMsg("✅ Agence créée.");
    // set active
    await onSelectAgency(ag.id);
    router.refresh?.();
  }

  async function onGenerateKey() {
    if (!profile || !selectedAgencyId) return;

    setBusy(true);
    setMsg(null);

    // Désactiver anciennes clés
    await supabase
      .from("agency_keys")
      .update({ active: false })
      .eq("agency_id", selectedAgencyId);

    // Créer nouvelle clé
    const key = makeKey(10);
    const { data, error } = await supabase
      .from("agency_keys")
      .insert({
        agency_id: selectedAgencyId,
        key,
        active: true,
        created_by: profile.user_id,
      })
      .select("id, key, active, created_at, agency_id")
      .maybeSingle();

    setBusy(false);

    if (error) return setMsg(humanErr(error));

    setAgencyKey((data as AgencyKeyRow) ?? null);
    setMsg("✅ Nouvelle clé générée.");
  }

  async function onCopy(txt: string) {
    try {
      await navigator.clipboard.writeText(txt);
      setMsg("✅ Copié.");
    } catch {
      setMsg("⚠️ Impossible de copier.");
    }
  }

  async function onArchiveAgency(agencyId: string) {
    // archiver seulement si OWNER (UI le limite déjà)
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from("agencies")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", agencyId);

    setBusy(false);

    if (error) return setMsg(humanErr(error));
    setMsg("✅ Agence archivée.");

    router.refresh?.();
  }

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 text-sm text-slate-600">
          Chargement du profil…
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Profil manquant. Vérifie users_profile + trigger handle_new_user.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-sm text-slate-500">
            Gestion du compte & espaces de travail.
          </p>
        </div>

        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-slate-50 text-slate-700">
          Espace actif : {selectedAgencyName}
        </span>
      </div>

      {msg && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-sm text-slate-700">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col gauche */}
        <div className="lg:col-span-2 space-y-6">
          <ProfileInfoCard
            profile={profile}
            email={email}
            emailConfirmed={emailConfirmed}
            busy={busy}
            onSaveName={onSaveName}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <JoinAgencyCard busy={busy} onJoin={onJoin} />
            <CreateAgencyCard busy={busy} onCreate={onCreate} />
          </div>

          <WorkspaceCard
            memberships={memberships}
            selectedAgencyId={selectedAgencyId}
            onSelectAgency={onSelectAgency}
            members={members}
            isOwner={isOwner}
            agencyKey={agencyKey}
            onGenerateKey={onGenerateKey}
            onCopy={onCopy}
            onArchiveAgency={onArchiveAgency}
            busy={busy}
          />
        </div>

        {/* Col droite */}
        <div className="space-y-6">
          <QuickRecapCard />
        </div>
      </div>
    </div>
  );
}
