"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ================= TYPES ================= */

type Role = "OWNER" | "CM" | "FITNESS";
type MemberRole = "OWNER" | "MEMBER";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  avatar_url?: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
};

type MembershipRow = {
  agency_id: string;
  user_id: string;
  member_role: MemberRole;
  workspace_role: string;
  joined_at: string;
  agencies?: AgencyRow | AgencyRow[] | null;
};

type MemberViewRow = {
  user_id: string;
  member_role: MemberRole;
  workspace_role: string;
  joined_at: string;
  users_profile?: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
};

type AgencyKeyRow = {
  // certains schémas ont "code", d'autres utilisent "id" comme clé
  code?: string | null;
  id?: string | null;
  is_active?: boolean;
  active?: boolean;
  created_at?: string;
};

/* ================= HELPERS ================= */

const firstAgency = (a?: AgencyRow | AgencyRow[] | null): AgencyRow | null => {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
};

const safeDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const humanErr = (e: any) =>
  e?.message || e?.error_description || e?.hint || "Erreur inconnue";

/* ================= UI ATOMS ================= */

const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
  >
    {children}
  </div>
);

const CardHeader = ({
  title,
  subtitle,
  right,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`p-5 border-b border-slate-100 flex items-start justify-between gap-4 ${className}`}
  >
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const CardBody = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`p-5 ${className}`}>{children}</div>;


const Btn = ({
  children,
  onClick,
  disabled,
  variant = "outline",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
  type?: "button" | "submit";
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "border border-slate-200 text-slate-800 hover:bg-slate-50";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${cls}`}
    >
      {children}
    </button>
  );
};

const Badge = ({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "blue";
}) => {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs border ${cls}`}>
      {children}
    </span>
  );
};

/* ================= PAGE ================= */

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [authUserId, setAuthUserId] = useState<string>("");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [editName, setEditName] = useState(false);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [agencyMembers, setAgencyMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  const [newAgencyName, setNewAgencyName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  /* ============ LOAD USER + PROFILE + MEMBERSHIPS ============ */

  const reloadMemberships = async (userId: string) => {
    const { data: ms, error } = await supabase
      .from("agency_members")
      .select(
        "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id,name)"
      )
      .eq("user_id", userId);

    if (error) {
      console.error("reloadMemberships error:", error);
      return [];
    }

    const list = (ms || []) as unknown as MembershipRow[];
    setMemberships(list);
    return list;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        flash("Utilisateur non connecté");
        setLoading(false);
        return;
      }

      setAuthUserId(user.id);
      setEmail(user.email ?? "");
      setEmailConfirmed(!!(user.email_confirmed_at || (user as any).confirmed_at));

      const { data: p, error: pErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, created_at, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (pErr || !p) {
        console.error("profile load error:", pErr);
        flash("Profil introuvable");
        setLoading(false);
        return;
      }

      setProfile(p);
      setFullName(p.full_name ?? "");

      const list = await reloadMemberships(user.id);

      if (list.length && !selectedAgencyId) {
        setSelectedAgencyId(list[0].agency_id);
      }

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  /* ============ SELECTED AGENCY ============ */

  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const selectedAgency = firstAgency(selectedMembership?.agencies) || null;

  const isOwner = selectedMembership?.member_role === "OWNER";

  /* ============ LOAD MEMBERS + KEY FOR SELECTED AGENCY ============ */

  useEffect(() => {
    if (!selectedAgencyId) {
      setAgencyMembers([]);
      setAgencyKey(null);
      return;
    }

    const loadAgency = async () => {
      const { data: members, error: mErr } = await supabase
        .from("agency_members")
        .select(
          "user_id, member_role, workspace_role, joined_at, users_profile(full_name, avatar_url)"
        )
        .eq("agency_id", selectedAgencyId)
        .order("joined_at", { ascending: true });

      if (mErr) console.error("load agency members error:", mErr);

      setAgencyMembers((members || []) as unknown as MemberViewRow[]);

      if (isOwner) {
        // essayer code d'abord
        const { data: key1 } = await supabase
          .from("agency_keys")
          .select("code, is_active, created_at")
          .eq("agency_id", selectedAgencyId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (key1) {
          setAgencyKey(key1 as any);
          return;
        }

        // fallback si la table a "id/active"
        const { data: key2 } = await supabase
          .from("agency_keys")
          .select("id, active, created_at")
          .eq("agency_id", selectedAgencyId)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setAgencyKey((key2 as any) || null);
      } else {
        setAgencyKey(null);
      }
    };

    loadAgency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgencyId, isOwner]);

  /* ============ ACTIONS ============ */

  const saveName = async () => {
    if (!authUserId) return;
    setBusy(true);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: fullName })
      .eq("user_id", authUserId);

    if (error) flash("Erreur mise à jour: " + humanErr(error));
    else {
      setProfile((p) => (p ? { ...p, full_name: fullName } : p));
      setEditName(false);
      flash("Nom mis à jour ✅");
    }

    setBusy(false);
  };

  const createAgency = async () => {
    if (!newAgencyName.trim() || !authUserId) return;
    setBusy(true);

    const { data, error } = await supabase.rpc("create_agency", {
      p_name: newAgencyName.trim(),
    });

    if (error) {
      console.error("create_agency error:", error);
      flash(humanErr(error));
      setBusy(false);
      return;
    }

    if (!data) {
      flash("Aucune donnée retournée (create_agency). Vérifie la fonction SQL.");
      setBusy(false);
      return;
    }

    flash("Espace créé ✅");
    setNewAgencyName("");

    const list = await reloadMemberships(authUserId);
    // set active = agencyId renvoyé
    setSelectedAgencyId(String(data));

    // si pour une raison X, membership pas encore visible, fallback sur premier
    if (!list.length) {
      setSelectedAgencyId(String(data));
    }

    setBusy(false);
  };

  const joinAgency = async () => {
    if (!joinCode.trim() || !authUserId) return;
    setBusy(true);

    const { data, error } = await supabase.rpc("join_agency_with_code", {
      p_code: joinCode.trim(),
    });

    if (error) {
      console.error("join_agency_with_code error:", error);
      flash(humanErr(error));
      setBusy(false);
      return;
    }

    if (!data) {
      flash("Clé invalide / accès refusé");
      setBusy(false);
      return;
    }

    flash("Agence rejointe ✅");
    setJoinCode("");

    await reloadMemberships(authUserId);
    setSelectedAgencyId(String(data));
    setBusy(false);
  };

  const generateKey = async () => {
    if (!selectedAgencyId || !isOwner) return;
    setBusy(true);

    const { data, error } = await supabase.rpc("generate_agency_key", {
      p_agency_id: selectedAgencyId,
    });

    if (error) {
      console.error("generate_agency_key error:", error);
      flash(humanErr(error));
      setBusy(false);
      return;
    }

    if (!data) {
      flash("Clé non générée (RPC n’a rien retourné)");
      setBusy(false);
      return;
    }

    // On rafraîchit l’affichage: soit code=uuid, soit id=uuid
    const newCode = String(data);
    setAgencyKey((prev) => ({
      ...(prev || {}),
      code: newCode,
      id: newCode,
      is_active: true,
      active: true,
      created_at: new Date().toISOString(),
    }));

    flash("Clé générée ✅");
    setBusy(false);
  };

  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      flash("Copié ✅");
    } catch {
      flash("Copie impossible");
    }
  };

  /* ================= RENDER ================= */

  if (loading) return <div className="p-6">Chargement…</div>;
  if (!profile) return <div className="p-6">Profil introuvable</div>;

  const keyValue = (agencyKey?.code || agencyKey?.id || "") as string;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Profil</h1>
          <p className="text-slate-600 mt-1">
            Gestion du compte & espaces de travail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={profile.role === "OWNER" ? "green" : "blue"}>
            Rôle global : {profile.role}
          </Badge>
          {toast && (
            <span className="text-sm px-3 py-2 rounded-xl bg-slate-900 text-white">
              {toast}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader
              title="Informations personnelles"
              subtitle="Nom modifiable, email en lecture seule."
              right={
                !editName ? (
                  <Btn onClick={() => setEditName(true)}>Modifier</Btn>
                ) : (
                  <div className="flex gap-2">
                    <Btn variant="primary" disabled={busy} onClick={saveName}>
                      Enregistrer
                    </Btn>
                    <Btn
                      disabled={busy}
                      onClick={() => {
                        setEditName(false);
                        setFullName(profile.full_name ?? "");
                      }}
                    >
                      Annuler
                    </Btn>
                  </div>
                )
              }
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Nom complet
                  </label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                    value={fullName}
                    disabled={!editName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                    value={email}
                    disabled
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Créé le
                  </label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                    value={safeDate(profile.created_at)}
                    disabled
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Email confirmé
                  </label>
                  <div className="mt-2">
                    <Badge tone={emailConfirmed ? "green" : "amber"}>
                      {emailConfirmed ? "✅ Confirmé" : "❌ Non confirmé"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Espace de travail"
              subtitle="Agences liées + sélection d’un espace."
            />
            <CardBody>
              {memberships.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50 text-amber-800">
                  Aucun espace lié. Crée un espace ou rejoins avec une clé.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {memberships.map((m) => {
                    const ag = firstAgency(m.agencies);
                    const active = selectedAgencyId === m.agency_id;
                    return (
                      <button
                        key={m.agency_id}
                        onClick={() => setSelectedAgencyId(m.agency_id)}
                        className={`text-left p-4 rounded-2xl border transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">
                            {ag?.name || "Agence sans nom"}
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              active
                                ? "border-white/20 bg-white/10"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            {m.member_role}
                          </span>
                        </div>
                        <div
                          className={`mt-2 text-sm ${
                            active ? "text-white/80" : "text-slate-600"
                          }`}
                        >
                          Accès : {m.workspace_role}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 border-t pt-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">Espace sélectionné</div>
                    <div className="text-xl font-semibold text-slate-900">
                      {selectedAgency?.name || "—"}
                    </div>
                    {selectedAgencyId && (
                      <div className="text-xs text-slate-500 mt-1">
                        ID: {selectedAgencyId}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    {isOwner ? (
                      keyValue ? (
                        <>
                          <Btn onClick={() => copy(keyValue)}>Copier clé</Btn>
                        </>
                      ) : (
                        <>
                          <Btn
                            variant="primary"
                            disabled={busy || !selectedAgencyId}
                            onClick={generateKey}
                          >
                            Générer une clé
                          </Btn>
                        </>
                      )
                    ) : (
                      <Badge tone="amber">Clé réservée au OWNER</Badge>
                    )}
                  </div>
                </div>

                {isOwner && keyValue && (
                  <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Clé d’invitation</div>
                    <div className="mt-1 font-mono text-sm break-all">{keyValue}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Créée le {safeDate(agencyKey?.created_at || null)}
                    </div>
                  </div>
                )}

                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 font-semibold">
                    Membres ({agencyMembers.length})
                  </div>
                  {agencyMembers.length === 0 ? (
                    <div className="p-4 text-slate-600">Aucun membre.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {agencyMembers.map((m) => (
                        <div
                          key={m.user_id}
                          className="p-4 flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {m.users_profile?.full_name || m.user_id}
                            </div>
                            <div className="text-xs text-slate-500">
                              {safeDate(m.joined_at)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge
                              tone={m.member_role === "OWNER" ? "green" : "gray"}
                            >
                              {m.member_role}
                            </Badge>
                            <Badge tone="blue">{m.workspace_role}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Créer ou rejoindre une agence" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="Nom de l’agence (ex: Dealink)"
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                />
                <Btn
                  variant="primary"
                  disabled={busy || !newAgencyName.trim()}
                  onClick={createAgency}
                >
                  Créer
                </Btn>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="Clé d’agence"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <Btn
                  variant="primary"
                  disabled={busy || !joinCode.trim()}
                  onClick={joinAgency}
                >
                  Rejoindre
                </Btn>
              </div>

              <div className="text-xs text-slate-500">
                Astuce : si “Impossible de créer espace”, tu verras maintenant le
                vrai message Supabase (permissions/RLS/func).
              </div>
            </CardBody>
          </Card>
        </div>

        {/* RIGHT */}
        <aside className="lg:col-span-4">
          <div className="sticky top-6 space-y-6">
            <Card>
              <CardHeader title="Récap rapide" />
              <CardBody>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li>✅ Un utilisateur peut être dans plusieurs agences</li>
                  <li>🔑 La clé appartient à l’agence</li>
                  <li>👥 Un CM peut travailler sur plusieurs agences</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
