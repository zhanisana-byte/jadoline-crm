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

  const [tab, setTab] = useState<"infos" | "mon_agence" | "work">("infos");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [myAgency, setMyAgency] = useState<AgencyRow | null>(null);
  const [myKey, setMyKey] = useState<AgencyKeyRow | null>(null);

  const [myMembers, setMyMembers] = useState<MemberViewRow[]>([]);
  const [myAccess, setMyAccess] = useState<MemberClientAccessRow[]>([]);
  const [myClients, setMyClients] = useState<ClientRow[]>([]);

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

      // ✅ auth guard
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!mounted) return;

      if (userErr || !user) {
        router.replace("/login?error=not_authenticated");
        return;
      }

      setEmail(user.email ?? "");
      setEmailConfirmed(!!(user as any).email_confirmed_at);

      // ✅ provisioning (si déjà trigger OK, ça ne casse rien)
      const { error: provErr } = await supabase.rpc("ensure_personal_agency");
      if (provErr) {
        // important pour debug
        setMsg("Provisioning error: " + provErr.message);
      }

      // ✅ profile
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

      // ✅ agence perso
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

      // ✅ clé active (is_active OU active)
      const { data: key } = await supabase
        .from("agency_keys")
        .select("id, key, active, is_active, created_at, agency_id")
        .eq("agency_id", agency.id)
        .or("active.eq.true,is_active.eq.true")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setMyKey((key as any) ?? null);

      // ✅ Work memberships
      const { data: mems } = await supabase
        .from("agency_members")
        .select("id, agency_id, user_id, role, status, agencies(id, name, archived_at)")
        .eq("user_id", user.id)
        .neq("role", "OWNER")
        .eq("status", "active");

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
  // LOAD MON AGENCE
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
      if (mErr) return setMsg("Erreur agency_members: " + humanErr(mErr));
      setMyMembers((members ?? []) as any);

      const { data: access } = await supabase
        .from("member_client_access")
        .select("user_id, client_id")
        .eq("agency_id", myAgency.id);

      const accessRows = (access ?? []) as MemberClientAccessRow[];
      setMyAccess(accessRows);

      const clientIds = Array.from(new Set(accessRows.map((x) => x.client_id))).filter(Boolean);
      if (clientIds.length === 0) {
        setMyClients([]);
        return;
      }

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", clientIds);

      if (!mounted) return;
      setMyClients((clients ?? []) as any);
    }

    loadMyAgencyData();
    return () => {
      mounted = false;
    };
  }, [myAgency?.id, supabase]);

  // =============================
  // LOAD WORK CLIENTS
  // =============================
  useEffect(() => {
    let mounted = true;

    async function loadManagedClients() {
      setManagedClients([]);
      if (!profile || !selectedAgencyId) return;

      const { data: access } = await supabase
        .from("member_client_access")
        .select("client_id")
        .eq("user_id", profile.user_id)
        .eq("agency_id", selectedAgencyId);

      const ids = (access ?? []).map((x: any) => x.client_id).filter(Boolean);
      if (ids.length === 0) return setManagedClients([]);

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", ids);

      if (!mounted) return;
      setManagedClients((clients ?? []) as any);
    }

    loadManagedClients();
    return () => {
      mounted = false;
    };
  }, [profile, selectedAgencyId, supabase]);

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
          Profil manquant. Vérifie users_profile + trigger.
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

      {tab === "infos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProfileInfoCard
              profile={profile}
              email={email}
              emailConfirmed={emailConfirmed}
              busy={busy}
              onSaveName={async () => {}}
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
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 font-mono"
                    value={myKey?.key ?? ""}
                    disabled
                    placeholder="(aucune clé)"
                  />
                  <p className="mt-2 text-xs text-slate-500">Pas de régénération : 1 seule clé unique.</p>
                </div>

                <JoinAgencyCard busy={busy} onJoin={async () => {}} />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}

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
              onDisableMember={async () => {}}
              onEnableMember={async () => {}}
              onRevokeClientAccess={async () => {}}
              setMsg={setMsg}
            />
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}

      {tab === "work" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <WorkspaceCard
              memberships={workMemberships}
              selectedAgencyId={selectedAgencyId}
              onSelectAgency={(id) => setSelectedAgencyId(id)}
              members={[]}
              isOwner={false}
              agencyKey={null}
              onGenerateKey={async () => setMsg("Clé unique (pas de régénération).")}
              onCopy={async (t) => navigator.clipboard.writeText(t)}
              onArchiveAgency={async () => setMsg("Archivage non disponible.")}
              busy={busy}
            />

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold">Mes clients (agence sélectionnée)</h2>
                <p className="text-sm text-slate-500">Les clients auxquels tu as accès.</p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs text-slate-500">Agence</div>
                  <div className="text-lg font-semibold">{selectedAgencyName}</div>
                </div>

                {selectedAgencyId ? (
                  managedClients.length === 0 ? (
                    <div className="text-sm text-slate-500">Aucun client assigné.</div>
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {managedClients.map((c) => (
                        <li key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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
