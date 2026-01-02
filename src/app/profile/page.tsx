"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * src/app/profile/page.tsx
 * - Affiche la clé dans l'onglet Infos (plus pratique)
 * - Supprime le module "Générer une clé" dans Mes agences
 * - Clé active = agency_keys.is_active = true
 */

type TabKey = "INFO" | "MY_AGENCIES" | "WORK";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  created_at?: string;
};

type AgencyRow = {
  id: string;
  name: string;
  owner_id: string | null;
  archived_at?: string | null;
};

type MembershipRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: "OWNER" | "CM" | "MEMBER" | string;
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED" | string;
};

type AgencyKeyRow = {
  id: string;
  agency_id: string;
  key: string;
  is_active: boolean;
  created_at?: string;
};

type MemberViewRow = {
  membership: MembershipRow;
  profile: ProfileRow | null;
};

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "info" | "muted";
}) {
  const cls = useMemo(() => {
    const base =
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border";
    if (tone === "success")
      return `${base} bg-emerald-50 border-emerald-200 text-emerald-800`;
    if (tone === "info")
      return `${base} bg-blue-50 border-blue-200 text-blue-800`;
    if (tone === "muted")
      return `${base} bg-slate-50 border-slate-200 text-slate-700`;
    return `${base} bg-white border-slate-200 text-slate-800`;
  }, [tone]);

  return <span className={cls}>{children}</span>;
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Tabs({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (t: TabKey) => void;
}) {
  const btn = (key: TabKey, label: string) => {
    const active = value === key;
    return (
      <button
        type="button"
        onClick={() => onChange(key)}
        className={[
          "px-4 py-2 rounded-xl text-sm font-medium border",
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {btn("INFO", "Infos")}
      {btn("MY_AGENCIES", "Mes agences")}
      {btn("WORK", "Work")}
    </div>
  );
}

/** ---------- INFO CARD ---------- */
function ProfileInfoCard(props: {
  profile: ProfileRow;
  email: string;
  emailConfirmed: boolean;
  busy: boolean;
  onSaveName: (newName: string) => Promise<void>;
  // ✅ clé de l'espace actif
  agencyName: string | null;
  agencyKey: AgencyKeyRow | null;
  canSeeKey: boolean;
  onGenerateKey: () => Promise<void>;
  onCopyKey: (text: string) => void;
}) {
  const {
    profile,
    email,
    emailConfirmed,
    busy,
    onSaveName,
    agencyName,
    agencyKey,
    canSeeKey,
    onGenerateKey,
    onCopyKey,
  } = props;

  const [name, setName] = useState(profile.full_name ?? "");

  useEffect(() => {
    setName(profile.full_name ?? "");
  }, [profile.full_name]);

  return (
    <Card
      title="Infos"
      subtitle="Identité & compte"
      right={
        <div className="flex items-center gap-2">
          <Badge tone="muted">Rôle global : {profile.role ?? "—"}</Badge>
          <Badge tone={emailConfirmed ? "success" : "info"}>
            {emailConfirmed ? "Email confirmé" : "Email non confirmé"}
          </Badge>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nom */}
        <div>
          <label className="text-sm font-medium text-slate-700">Nom complet</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Votre nom"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || name.trim().length < 2}
              onClick={() => onSaveName(name.trim())}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            value={email}
            readOnly
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-600"
          />
          <p className="mt-2 text-xs text-slate-500">
            {emailConfirmed
              ? "Votre compte est actif."
              : "Veuillez confirmer votre email pour activer votre compte."}
          </p>
        </div>
      </div>

      {/* ✅ Clé de l'espace actif */}
      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Espace actif</p>
            <p className="text-base font-semibold text-slate-900">
              {agencyName ?? "Aucun espace sélectionné"}
            </p>
          </div>

          {canSeeKey ? (
            agencyKey?.key ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCopyKey(agencyKey.key)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Copier la clé
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onGenerateKey}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "..." : "Générer une clé"}
              </button>
            )
          ) : (
            <Badge tone="muted">Clé réservée au OWNER</Badge>
          )}
        </div>

        {canSeeKey ? (
          agencyKey?.key ? (
            <div className="mt-3 text-sm text-slate-700">
              <span className="font-medium">Clé :</span>{" "}
              <code className="rounded-lg bg-slate-50 px-2 py-1 border border-slate-200">
                {agencyKey.key}
              </code>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Aucune clé active pour le moment.</p>
          )
        ) : null}

        <p className="mt-2 text-xs text-slate-500">
          Cette clé sert à rejoindre cet espace (agence) depuis la page d’inscription.
        </p>
      </div>
    </Card>
  );
}

/** ---------- PAGE ---------- */
export default function ProfilePage() {
  const supabase = createClient();

  const [tab, setTab] = useState<TabKey>("INFO");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);
  const [members, setMembers] = useState<MemberViewRow[]>([]);

  const selectedAgency = useMemo(
    () => agencies.find((a) => a.id === selectedAgencyId) ?? null,
    [agencies, selectedAgencyId]
  );

  const myAgencies = useMemo(() => {
    const myMemberships = memberships.filter((m) => m.user_id === userId);
    const ownedIds = new Set(
      myMemberships.filter((m) => m.role === "OWNER").map((m) => m.agency_id)
    );
    return agencies.filter((a) => ownedIds.has(a.id));
  }, [agencies, memberships, userId]);

  const workAgencies = useMemo(() => {
    const myMemberships = memberships.filter((m) => m.user_id === userId);
    const workIds = new Set(
      myMemberships
        .filter((m) => m.role !== "OWNER")
        .map((m) => m.agency_id)
    );
    return agencies.filter((a) => workIds.has(a.id));
  }, [agencies, memberships, userId]);

  /** --------- Fetch initial data ---------- */
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData.user;
        if (!user) throw new Error("Not authenticated");
        if (!alive) return;

        setUserId(user.id);
        setEmail(user.email ?? "");
        setEmailConfirmed(!!user.email_confirmed_at);

        // profile
        const { data: p, error: pErr } = await supabase
          .from("users_profile")
          .select("user_id, full_name, role, avatar_url, created_at")
          .eq("user_id", user.id)
          .single();

        if (pErr) throw pErr;

        // memberships
        const { data: mems, error: memErr } = await supabase
          .from("agency_members")
          .select("id, agency_id, user_id, role, status")
          .eq("user_id", user.id);

        if (memErr) throw memErr;

        const agencyIds = (mems ?? []).map((m) => m.agency_id);
        const uniqAgencyIds = Array.from(new Set(agencyIds));

        // agencies (filtrer archived)
        let ags: AgencyRow[] = [];
        if (uniqAgencyIds.length > 0) {
          const { data: agsData, error: agErr } = await supabase
            .from("agencies")
            .select("id, name, owner_id, archived_at")
            .in("id", uniqAgencyIds)
            .is("archived_at", null);

          if (agErr) throw agErr;
          ags = (agsData ?? []) as AgencyRow[];
        }

        if (!alive) return;

        setProfile(p as ProfileRow);
        setMemberships((mems ?? []) as MembershipRow[]);
        setAgencies(ags);

        const defaultAgencyId = ags?.[0]?.id ?? null;
        setSelectedAgencyId((prev) => prev ?? defaultAgencyId);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Erreur");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [supabase]);

  /** --------- Load key + members when selectedAgency changes ---------- */
  useEffect(() => {
    let alive = true;

    async function loadAgencyDetails() {
      if (!selectedAgencyId) return;

      setAgencyKey(null);
      setMembers([]);
      setError(null);

      try {
        // KEY: get active key (is_active)
        const { data: keys, error: kErr } = await supabase
          .from("agency_keys")
          .select("id, agency_id, key, is_active, created_at")
          .eq("agency_id", selectedAgencyId)
          .eq("is_active", true)
          .limit(1);

        if (kErr) throw kErr;
        if (!alive) return;
        setAgencyKey((keys?.[0] as AgencyKeyRow) ?? null);

        // MEMBERS
        const { data: mems, error: memErr } = await supabase
          .from("agency_members")
          .select("id, agency_id, user_id, role, status")
          .eq("agency_id", selectedAgencyId);

        if (memErr) throw memErr;

        const userIds = Array.from(new Set((mems ?? []).map((m) => m.user_id)));
        const profilesMap = new Map<string, ProfileRow>();

        if (userIds.length > 0) {
          const { data: profs, error: profErr } = await supabase
            .from("users_profile")
            .select("user_id, full_name, role, avatar_url")
            .in("user_id", userIds);

          if (profErr) throw profErr;
          (profs ?? []).forEach((pr: any) => profilesMap.set(pr.user_id, pr));
        }

        const view: MemberViewRow[] = (mems ?? []).map((m: any) => ({
          membership: m as MembershipRow,
          profile: profilesMap.get(m.user_id) ?? null,
        }));

        if (!alive) return;
        setMembers(view);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Erreur");
      }
    }

    loadAgencyDetails();
    return () => {
      alive = false;
    };
  }, [supabase, selectedAgencyId]);

  /** --------- Actions ---------- */
  async function onSaveName(newName: string) {
    if (!profile) return;
    setBusy(true);
    setError(null);

    try {
      const { error: uErr } = await supabase
        .from("users_profile")
        .update({ full_name: newName })
        .eq("user_id", profile.user_id);

      if (uErr) throw uErr;
      setProfile({ ...profile, full_name: newName });
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateKey() {
    if (!selectedAgencyId) return;
    setBusy(true);
    setError(null);

    try {
      // RPC existante chez toi (si tu l'as) :
      const { data, error: rpcErr } = await supabase.rpc("generate_agency_key", {
        p_agency_id: selectedAgencyId,
      });

      if (rpcErr) throw rpcErr;

      const code = String(data);

      // UI update
      setAgencyKey({
        id: "temp",
        agency_id: selectedAgencyId,
        key: code,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function archiveAgency(agencyId: string) {
    const ok = confirm(
      "Archiver cette agence ? Elle disparaîtra de la liste (restaurable)."
    );
    if (!ok) return;

    setBusy(true);
    setError(null);

    try {
      const { error: aErr } = await supabase
        .from("agencies")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", agencyId);

      if (aErr) throw aErr;
      window.location.reload();
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  /** --------- Safe rendering ---------- */
  if (loading || !profile) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          Chargement du profil...
        </div>
      </div>
    );
  }

  const isOwnerOfSelected =
    memberships.find((m) => m.user_id === userId && m.agency_id === selectedAgencyId)
      ?.role === "OWNER";

  const canSeeKey = !!isOwnerOfSelected;

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profil</h1>
          <p className="text-sm text-slate-500">Gestion du compte & espaces de travail.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="success">Rôle global : {profile.role ?? "—"}</Badge>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* left / main */}
        <div className="lg:col-span-2 space-y-4">
          {tab === "INFO" && (
            <ProfileInfoCard
              profile={profile}
              email={email}
              emailConfirmed={emailConfirmed}
              busy={busy}
              onSaveName={onSaveName}
              agencyName={selectedAgency?.name ?? null}
              agencyKey={agencyKey}
              canSeeKey={canSeeKey}
              onGenerateKey={onGenerateKey}
              onCopyKey={copyToClipboard}
            />
          )}

          {tab === "MY_AGENCIES" && (
            <Card
              title="Mes agences (OWNER)"
              subtitle="Sélectionne un espace. Tu peux archiver les agences inutiles."
            >
              <div className="flex flex-wrap gap-3">
                {myAgencies.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune agence en OWNER.</p>
                ) : (
                  myAgencies.map((a) => {
                    const active = a.id === selectedAgencyId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAgencyId(a.id)}
                        className={[
                          "w-full sm:w-[260px] rounded-2xl border p-4 text-left transition",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-base font-semibold truncate">{a.name}</div>
                          <Badge tone="muted">OWNER</Badge>
                        </div>
                        <div className="mt-2 text-sm opacity-90">Statut : ACTIVE</div>

                        {!active ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveAgency(a.id);
                              }}
                              disabled={busy}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              🗑️ Archiver
                            </button>
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedAgency ? (
                <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Membres ({members.length})
                  </h4>

                  <div className="mt-3 space-y-2">
                    {members.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Aucun membre.
                      </div>
                    ) : (
                      members.map((m) => (
                        <div
                          key={m.membership.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {m.profile?.full_name ?? "Utilisateur"}
                            </div>
                            <div className="text-xs text-slate-500">{m.membership.user_id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone="muted">{m.membership.role}</Badge>
                            <Badge
                              tone={m.membership.status === "ACTIVE" ? "success" : "info"}
                            >
                              {m.membership.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                      title="À venir : invitations email"
                    >
                      Inviter un membre (bientôt)
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          {tab === "WORK" && (
            <Card title="Work" subtitle="Agences où vous collaborez (CM / MEMBER).">
              <div className="flex flex-wrap gap-3">
                {workAgencies.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune collaboration pour le moment.</p>
                ) : (
                  workAgencies.map((a) => {
                    const active = a.id === selectedAgencyId;
                    const myMem = memberships.find(
                      (m) => m.user_id === userId && m.agency_id === a.id
                    );

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAgencyId(a.id)}
                        className={[
                          "w-full sm:w-[260px] rounded-2xl border p-4 text-left transition",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-base font-semibold truncate">{a.name}</div>
                          <Badge tone="muted">{myMem?.role ?? "MEMBER"}</Badge>
                        </div>
                        <div className="mt-2 text-sm opacity-90">Statut : {myMem?.status ?? "ACTIVE"}</div>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                (La clé d'agence est affichée dans “Infos” pour les OWNER.)
              </p>
            </Card>
          )}
        </div>

        {/* right / recap */}
        <div className="space-y-4">
          <Card title="Récap rapide">
            <ul className="space-y-2 text-sm text-slate-700">
              <li>✅ Un utilisateur peut être dans plusieurs agences</li>
              <li>🔑 La clé appartient à l’agence (OWNER only)</li>
              <li>👥 Un CM peut travailler sur plusieurs agences</li>
            </ul>
          </Card>

          <Card title="Espace actif" subtitle="Utilisé pour Clients / Posts / Gym">
            {selectedAgency ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-slate-500">Agence :</span>{" "}
                  <span className="font-semibold text-slate-900">{selectedAgency.name}</span>
                </div>

                {canSeeKey && agencyKey?.key ? (
                  <div className="text-sm">
                    <span className="text-slate-500">Clé :</span>{" "}
                    <code className="rounded bg-slate-50 border px-2 py-1">{agencyKey.key}</code>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">(ID caché)</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucun espace sélectionné.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
