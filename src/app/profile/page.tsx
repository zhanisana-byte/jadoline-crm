"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

import type {
  ProfileRow,
  MembershipRow,
  MemberViewRow,
  AgencyKeyRow,
  AgencyRow,
} from "@/components/profile/types";

import { humanErr, firstAgency } from "@/components/profile/ui";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<"infos" | "work">("infos");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // ✅ clé unique (agence perso)
  const [personalAgency, setPersonalAgency] = useState<AgencyRow | null>(null);
  const [personalKey, setPersonalKey] = useState<AgencyKeyRow | null>(null);

  // ✅ Work: agences où je collabore (role != OWNER)
  const [workMemberships, setWorkMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  // WorkspaceCard exige members + agencyKey + generateKey etc.
  // 👉 Ici on NE génère pas de clé (et pas OWNER), donc on passe des fonctions “no-op”
  const [membersDummy, setMembersDummy] = useState<MemberViewRow[]>([]);
  const [agencyKeyDummy, setAgencyKeyDummy] = useState<AgencyKeyRow | null>(null);

  // ✅ Clients que JE gère dans l’agence sélectionnée
  const [managedClients, setManagedClients] = useState<
    { id: string; name: string; logo_url?: string | null }[]
  >([]);

  const selectedAgencyName = useMemo(() => {
    const m = workMemberships.find((x) => x.agency_id === selectedAgencyId) || null;
    const a = firstAgency(m?.agencies) as AgencyRow | null;
    return a?.name ?? "—";
  }, [workMemberships, selectedAgencyId]);

  // ===================== LOAD BASE =====================
  useEffect(() => {
    let mounted = true;

    async function loadBase() {
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

      // (optionnel) repair agence perso si RPC existe
      try {
        await supabase.rpc("ensure_personal_agency");
      } catch {}

      // 1) Profil
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

      const profRow: ProfileRow = {
        user_id: prof.user_id,
        full_name: prof.full_name ?? null,
        role: prof.role,
        created_at: prof.created_at,
        avatar_url: prof.avatar_url ?? null,
      };
      setProfile(profRow);

      const profAgencyId: string | null = (prof as any).agency_id ?? null;

      // 2) Agence perso (owner_id = user.id) + clé active (clé unique)
      const { data: perso, error: persoErr } = await supabase
        .from("agencies")
        .select("id, name, archived_at")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!persoErr) {
        setPersonalAgency(perso as any);

        if (perso?.id) {
          const { data: key, error: keyErr } = await supabase
            .from("agency_keys")
            .select("id, key, active, created_at, agency_id")
            .eq("agency_id", perso.id)
            .eq("active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!keyErr) setPersonalKey((key as any) ?? null);
        }
      }

      // 3) Work memberships = agences où je collabore (role != OWNER)
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("id, agency_id, user_id, role, status, agencies(id, name, archived_at)")
        .eq("user_id", user.id)
        .neq("role", "OWNER")
        .eq("status", "active");

      if (!mounted) return;

      if (memErr) {
        setLoading(false);
        setMsg("Erreur: impossible de charger les collaborations.");
        return;
      }

      const memRows = (mems ?? []) as MembershipRow[];
      setWorkMemberships(memRows);

      // 4) sélection : agency_id du profil si elle fait partie du work, sinon first work
      const workIds = new Set(memRows.map((m) => m.agency_id));
      const initial =
        (profAgencyId && workIds.has(profAgencyId) ? profAgencyId : memRows[0]?.agency_id) ?? null;

      setSelectedAgencyId(initial);

      setLoading(false);
    }

    loadBase();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // ===================== LOAD MANAGED CLIENTS =====================
  useEffect(() => {
    let mounted = true;

    async function loadClients() {
      setManagedClients([]);
      if (!profile || !selectedAgencyId) return;

      const { data: access, error: aErr } = await supabase
        .from("member_client_access")
        .select("client_id")
        .eq("user_id", profile.user_id)
        .eq("agency_id", selectedAgencyId);

      if (!mounted) return;

      if (aErr) {
        // pas bloquant
        return;
      }

      const clientIds = (access ?? []).map((x: any) => x.client_id).filter(Boolean);
      if (clientIds.length === 0) {
        setManagedClients([]);
        return;
      }

      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", clientIds);

      if (!mounted) return;

      if (!cErr) setManagedClients((clients ?? []) as any);
    }

    loadClients();
    return () => {
      mounted = false;
    };
  }, [profile, selectedAgencyId, supabase]);

  // ===================== ACTIONS =====================
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

  async function copyPersonalKey() {
    const k = personalKey?.key;
    if (!k) return setMsg("Aucune clé à copier.");
    try {
      await navigator.clipboard.writeText(k);
      setMsg("✅ Clé copiée.");
    } catch {
      setMsg("⚠️ Impossible de copier.");
    }
  }

  async function onSelectAgency(agencyId: string) {
    if (!profile) return;
    setSelectedAgencyId(agencyId);
    setMsg(null);

    // sauvegarder agency active (optionnel : utile pour dashboard)
    const { error } = await supabase
      .from("users_profile")
      .update({ agency_id: agencyId })
      .eq("user_id", profile.user_id);

    if (error) setMsg("⚠️ Impossible de sauvegarder l’agence active.");
  }

  async function onJoin(code: string) {
    setBusy(true);
    setMsg(null);

    const { data: res, error } = await supabase.rpc("join_with_code", { p_code: code });

    setBusy(false);

    if (error) return setMsg(humanErr(error));
    if (!res?.ok) return setMsg("Clé invalide ❌");

    setMsg("✅ Rejoint avec succès.");

    if (res.type === "FITNESS") {
      router.push("/dashboard/gym");
      return;
    }

    // Recharge la page (simple et fiable)
    location.reload();
  }

  async function onCreate(name: string) {
    if (!profile) return;

    setBusy(true);
    setMsg(null);

    // fallback insert direct
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
    // Tu viens de créer une agence où tu es OWNER => ce n’est PAS “Work”
    // Donc on ne la met pas dans la liste Work.
    // Si tu veux la voir dans Work, dis-moi et je change la règle.
  }

  // no-op car tu ne veux PAS régénérer
  async function onGenerateKeyNoop() {
    setMsg("La clé est unique (pas de régénération).");
  }

  async function onArchiveNoop() {
    setMsg("Archivage désactivé dans Work (collaboration).");
  }

  async function onCopy(txt: string) {
    try {
      await navigator.clipboard.writeText(txt);
      setMsg("✅ Copié.");
    } catch {
      setMsg("⚠️ Impossible de copier.");
    }
  }

  // ===================== UI =====================
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
            Mes informations & collaborations.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
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

      {/* CONTENT */}
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

            {/* Clé unique */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold">Ma clé unique</h2>
                <p className="text-sm text-slate-500">
                  Partage cette clé pour que les CMs rejoignent ton agence.
                </p>
              </div>

              <div className="p-5 space-y-3">
                <div className="text-sm">
                  <div className="text-xs text-slate-500">Agence</div>
                  <div className="font-semibold">{personalAgency?.name ?? "—"}</div>
                </div>

                <div className="text-sm">
                  <div className="text-xs text-slate-500">Clé active</div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 font-mono"
                      value={personalKey?.key ?? ""}
                      disabled
                      placeholder="(aucune clé)"
                    />
                    <button
                      onClick={copyPersonalKey}
                      disabled={!personalKey?.key}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-medium",
                        !personalKey?.key
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-slate-50"
                      )}
                    >
                      Copier
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Pas de régénération : 1 clé unique.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}

      {tab === "work" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Join/Create (utile même dans work) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <JoinAgencyCard busy={busy} onJoin={onJoin} />
              <CreateAgencyCard busy={busy} onCreate={onCreate} />
            </div>

            {/* Work list via WorkspaceCard (sans key/owner) */}
            <WorkspaceCard
              memberships={workMemberships}
              selectedAgencyId={selectedAgencyId}
              onSelectAgency={onSelectAgency}
              members={membersDummy}
              isOwner={false}                 // ✅ pas owner => pas de clé
              agencyKey={agencyKeyDummy}
              onGenerateKey={onGenerateKeyNoop}
              onCopy={onCopy}
              onArchiveAgency={onArchiveNoop}
              busy={busy}
            />

            {/* Détails agence sélectionnée */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold">Détails</h2>
                <p className="text-sm text-slate-500">
                  Agence sélectionnée + clients que tu gères.
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs text-slate-500">Agence</div>
                  <div className="text-lg font-semibold">{selectedAgencyName}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Mes clients dans cette agence</div>

                  {selectedAgencyId ? (
                    managedClients.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-500">
                        Aucun client assigné à toi dans cette agence.
                      </div>
                    ) : (
                      <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <div className="mt-2 text-sm text-slate-500">
                      Sélectionne une agence.
                    </div>
                  )}
                </div>
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
