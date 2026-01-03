"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";
import MonAgencyCard from "@/components/profile/MonAgencyCard";

import type {
  ProfileRow,
  MembershipRow,
  MemberViewRow,
  AgencyKeyRow,
  AgencyRow,
} from "@/components/profile/types";

import { humanErr, firstAgency } from "@/components/profile/ui";

type ClientRow = { id: string; name: string; logo_url?: string | null };
type MemberClientAccessRow = { user_id: string; client_id: string };

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  // ✅ 3 tabs: Mes infos / Mon agence / Work (collaborations)
  const [tab, setTab] = useState<"infos" | "mon_agence" | "work">("infos");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // agence perso + clé unique
  const [myAgency, setMyAgency] = useState<AgencyRow | null>(null);
  const [myKey, setMyKey] = useState<AgencyKeyRow | null>(null);

  // Mon agence -> équipe + access clients
  const [myMembers, setMyMembers] = useState<MemberViewRow[]>([]);
  const [myAccess, setMyAccess] = useState<MemberClientAccessRow[]>([]);
  const [myClients, setMyClients] = useState<ClientRow[]>([]);

  // Work collaborations
  const [workMemberships, setWorkMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [managedClients, setManagedClients] = useState<ClientRow[]>([]);

  const selectedAgencyName = useMemo(() => {
    const m = workMemberships.find((x) => x.agency_id === selectedAgencyId) || null;
    const a = firstAgency(m?.agencies) as AgencyRow | null;
    return a?.name ?? "—";
  }, [workMemberships, selectedAgencyId]);

  // =============================
  // LOAD BASE
  // =============================
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

      // ✅ assure agence perso + clé active (fonction SQL)
      try {
        await supabase.rpc("ensure_personal_agency");
      } catch {}

      // ✅ users_profile (colonnes existantes dans ton schéma)
      const { data: prof, error: profErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, created_at, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profErr || !prof) {
        setLoading(false);
        setMsg("Erreur: profil introuvable (users_profile).");
        return;
      }

      setProfile({
        user_id: prof.user_id,
        full_name: prof.full_name ?? null,
        role: prof.role,
        created_at: prof.created_at,
        avatar_url: prof.avatar_url ?? null,
      });

      // ✅ agence perso = agencies.owner_id = user.id
      const { data: agency, error: aErr } = await supabase
        .from("agencies")
        .select("id, name, archived_at")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (aErr || !agency) {
        setLoading(false);
        setMsg("Erreur: agence personnelle introuvable.");
        return;
      }

      setMyAgency(agency as any);

      // ✅ clé unique active
      const { data: key, error: kErr } = await supabase
        .from("agency_keys")
        .select("id, key, active, created_at, agency_id")
        .eq("agency_id", agency.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!kErr) setMyKey((key as any) ?? null);

      // ✅ Work memberships (collaborations): role != OWNER
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("id, agency_id, user_id, role, status, agencies(id, name, archived_at)")
        .eq("user_id", user.id)
        .neq("role", "OWNER")
        .eq("status", "active");

      if (!mounted) return;

      if (memErr) {
        setLoading(false);
        setMsg("Erreur: impossible de charger Work.");
        return;
      }

      const memRows = (mems ?? []) as MembershipRow[];
      setWorkMemberships(memRows);
      setSelectedAgencyId(memRows[0]?.agency_id ?? null);

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // =============================
  // LOAD MON AGENCE (membres + accès clients + clients)
  // =============================
  useEffect(() => {
    let mounted = true;

    async function loadMyAgencyData() {
      if (!myAgency?.id) return;

      const { data: members, error: mErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, users_profile(full_name, avatar_url)")
        .eq("agency_id", myAgency.id);

      if (!mounted) return;

      if (mErr) {
        setMsg("Erreur agency_members: " + humanErr(mErr));
        return;
      }

      setMyMembers((members ?? []) as any);

      const { data: access, error: aErr } = await supabase
        .from("member_client_access")
        .select("user_id, client_id")
        .eq("agency_id", myAgency.id);

      if (!mounted) return;

      if (aErr) {
        setMyAccess([]);
        setMyClients([]);
        return;
      }

      const accessRows = (access ?? []) as MemberClientAccessRow[];
      setMyAccess(accessRows);

      const clientIds = Array.from(new Set(accessRows.map((x) => x.client_id))).filter(Boolean);
      if (clientIds.length === 0) {
        setMyClients([]);
        return;
      }

      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", clientIds);

      if (!mounted) return;

      if (!cErr) setMyClients((clients ?? []) as any);
    }

    loadMyAgencyData();
    return () => {
      mounted = false;
    };
  }, [myAgency?.id, supabase]);

  // =============================
  // LOAD WORK -> clients que je gère dans l’agence sélectionnée
  // =============================
  useEffect(() => {
    let mounted = true;

    async function loadManagedClients() {
      setManagedClients([]);
      if (!profile || !selectedAgencyId) return;

      const { data: access, error: aErr } = await supabase
        .from("member_client_access")
        .select("client_id")
        .eq("user_id", profile.user_id)
        .eq("agency_id", selectedAgencyId);

      if (!mounted) return;
      if (aErr) return;

      const ids = (access ?? []).map((x: any) => x.client_id).filter(Boolean);
      if (ids.length === 0) {
        setManagedClients([]);
        return;
      }

      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", ids);

      if (!mounted) return;
      if (!cErr) setManagedClients((clients ?? []) as any);
    }

    loadManagedClients();
    return () => {
      mounted = false;
    };
  }, [profile, selectedAgencyId, supabase]);

  // =============================
  // ACTIONS
  // =============================
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

  async function copyMyKey() {
    const k = myKey?.key;
    if (!k) return setMsg("Aucune clé à copier.");
    try {
      await navigator.clipboard.writeText(k);
      setMsg("✅ Clé copiée.");
    } catch {
      setMsg("⚠️ Impossible de copier.");
    }
  }

  async function onJoin(code: string) {
    setBusy(true);
    setMsg(null);

    const { data: res, error } = await supabase.rpc("join_with_code", { p_code: code });

    setBusy(false);

    if (error) return setMsg(humanErr(error));
    if (!res?.ok) return setMsg("Clé invalide ❌");

    setMsg("✅ Rejoint avec succès.");
    location.reload();
  }

  async function onSelectWorkAgency(agencyId: string) {
    setSelectedAgencyId(agencyId);
  }

  async function refreshMyAgency() {
    if (!myAgency?.id) return;

    const { data: members } = await supabase
      .from("agency_members")
      .select("user_id, role, status, users_profile(full_name, avatar_url)")
      .eq("agency_id", myAgency.id);

    setMyMembers((members ?? []) as any);

    const { data: access } = await supabase
      .from("member_client_access")
      .select("user_id, client_id")
      .eq("agency_id", myAgency.id);

    const accessRows = (access ?? []) as MemberClientAccessRow[];
    setMyAccess(accessRows);

    const ids = Array.from(new Set(accessRows.map((x) => x.client_id))).filter(Boolean);
    if (ids.length === 0) {
      setMyClients([]);
      return;
    }

    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, logo_url")
      .in("id", ids);

    setMyClients((clients ?? []) as any);
  }

  async function disableMember(memberUserId: string) {
    if (!myAgency?.id) return;
    setBusy(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("disable_agency_member", {
      p_agency_id: myAgency.id,
      p_user_id: memberUserId,
    });

    setBusy(false);

    if (error || !data?.ok) throw error ?? new Error("disable_failed");
    await refreshMyAgency();
  }

  async function enableMember(memberUserId: string) {
    if (!myAgency?.id) return;
    setBusy(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("enable_agency_member", {
      p_agency_id: myAgency.id,
      p_user_id: memberUserId,
    });

    setBusy(false);

    if (error || !data?.ok) throw error ?? new Error("enable_failed");
    await refreshMyAgency();
  }

  async function revokeClientAccess(memberUserId: string, clientId: string) {
    if (!myAgency?.id) return;
    setBusy(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("revoke_client_access", {
      p_agency_id: myAgency.id,
      p_user_id: memberUserId,
      p_client_id: clientId,
    });

    setBusy(false);

    if (error || !data?.ok) throw error ?? new Error("revoke_failed");
    await refreshMyAgency();
  }

  // WorkspaceCard: no key generation + no archive
  async function onGenerateKeyNoop() {
    setMsg("Clé unique (pas de régénération).");
  }
  async function onArchiveNoop() {
    setMsg("Archivage non disponible.");
  }
  async function onCopy(txt: string) {
    try {
      await navigator.clipboard.writeText(txt);
      setMsg("✅ Copié.");
    } catch {
      setMsg("⚠️ Impossible de copier.");
    }
  }

  // =============================
  // UI
  // =============================
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
          Profil manquant. Vérifie users_profile + triggers.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profil</h1>
        <p className="text-sm text-slate-500">Mes infos, mon équipe, et collaborations.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={cn(
            "px-4 py-2 rounded-xl border text-sm",
            tab === "infos" && "bg-slate-900 text-white border-slate-900"
          )}
          onClick={() => setTab("infos")}
        >
          Mes infos
        </button>

        <button
          className={cn(
            "px-4 py-2 rounded-xl border text-sm",
            tab === "mon_agence" && "bg-slate-900 text-white border-slate-900"
          )}
          onClick={() => setTab("mon_agence")}
        >
          Mon agence
        </button>

        <button
          className={cn(
            "px-4 py-2 rounded-xl border text-sm",
            tab === "work" && "bg-slate-900 text-white border-slate-900"
          )}
          onClick={() => setTab("work")}
        >
          Work (collaborations)
        </button>
      </div>

      {msg && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-sm text-slate-700">
          {msg}
        </div>
      )}

      {/* ================= Mes infos ================= */}
      {tab === "infos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProfileInfoCard
              profile={profile}
              email={email}
              emailConfirmed={emailConfirmed}
              busy={busy}
              onSaveName={onSaveName}
            />

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold">Ma clé (unique)</h2>
                <p className="text-sm text-slate-500">
                  Partage cette clé pour que les collaborateurs rejoignent ton agence.
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-sm">
                  <div className="text-xs text-slate-500">Agence</div>
                  <div className="font-semibold">{myAgency?.name ?? "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Clé active</div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 font-mono"
                      value={myKey?.key ?? ""}
                      disabled
                      placeholder="(aucune clé)"
                    />
                    <button
                      onClick={copyMyKey}
                      disabled={!myKey?.key}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-medium",
                        !myKey?.key ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"
                      )}
                    >
                      Copier
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Pas de régénération : 1 seule clé unique.
                  </p>
                </div>

                <JoinAgencyCard busy={busy} onJoin={onJoin} />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}

      {/* ================= Mon agence ================= */}
      {tab === "mon_agence" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <MonAgencyCard
              myAgency={myAgency}
              members={myMembers}
              access={myAccess}
              clients={myClients}
              busy={busy}
              isOwner={true}
              onDisableMember={disableMember}
              onEnableMember={enableMember}
              onRevokeClientAccess={revokeClientAccess}
              setMsg={(t) => setMsg(t)}
            />
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}

      {/* ================= Work (collaborations) ================= */}
      {tab === "work" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <WorkspaceCard
              memberships={workMemberships}
              selectedAgencyId={selectedAgencyId}
              onSelectAgency={onSelectWorkAgency}
              members={[]}
              isOwner={false}
              agencyKey={null}
              onGenerateKey={onGenerateKeyNoop}
              onCopy={onCopy}
              onArchiveAgency={onArchiveNoop}
              busy={busy}
            />

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold">Mes clients (agence sélectionnée)</h2>
                <p className="text-sm text-slate-500">
                  Les clients auxquels tu as accès dans cette collaboration.
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs text-slate-500">Agence</div>
                  <div className="text-lg font-semibold">{selectedAgencyName}</div>
                </div>

                {selectedAgencyId ? (
                  managedClients.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      Aucun client assigné à toi dans cette agence.
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {managedClients.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-xs text-slate-500">ID: {c.id}</div>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="text-sm text-slate-500">Sélectionne une agence.</div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}
    </div>
  );
}
