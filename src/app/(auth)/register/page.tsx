"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ================= TYPES ================= */

type GlobalRole = "OWNER" | "CM" | "FITNESS"; // role global dans users_profile
type AgencyRole = "OWNER" | "CM" | "MEMBER";  // role dans agency_members (enum user_role chez toi)

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: GlobalRole;
  created_at: string;
  avatar_url?: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
};

type MembershipRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  status: string | null;
  agencies?: AgencyRow | AgencyRow[] | null;
};

type MemberViewRow = {
  user_id: string;
  role: AgencyRole;
  status: string | null;
  users_profile?: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
};

type AgencyKeyRow = {
  id: string;            // la clé (uuid)
  active: boolean;
  created_at: string;
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
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader = ({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) => (
  <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const CardBody = ({ children }: { children: React.ReactNode }) => (
  <div className="p-5">{children}</div>
);

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
  variant?: "primary" | "outline";
  type?: "button" | "submit";
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-200 text-slate-800 hover:bg-slate-50";
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${cls}`}>
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
  return <span className={`px-2.5 py-1 rounded-full text-xs border ${cls}`}>{children}</span>;
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

  // CREATE AGENCY (séparé)
  const [newAgencyName, setNewAgencyName] = useState("");

  // JOIN AGENCY (séparé)
  const [joinCode, setJoinCode] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const reloadMemberships = async (userId: string) => {
    const { data, error } = await supabase
      .from("agency_members")
      .select("id, agency_id, user_id, role, status, agencies(id,name)")
      .eq("user_id", userId);

    if (error) {
      console.error("reloadMemberships error:", error);
      return [];
    }

    const list = (data || []) as unknown as MembershipRow[];
    setMemberships(list);

    // auto-select si rien sélectionné
    if (!selectedAgencyId && list.length) setSelectedAgencyId(list[0].agency_id);

    return list;
  };

  /* ============ LOAD USER + PROFILE + MEMBERSHIPS ============ */

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

      await reloadMemberships(user.id);

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  /* ============ SELECTED AGENCY ============ */

  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const selectedAgency = firstAgency(selectedMembership?.agencies) || null;

  const isOwner = selectedMembership?.role === "OWNER";

  /* ============ LOAD MEMBERS + KEY FOR SELECTED AGENCY ============ */

  useEffect(() => {
    if (!selectedAgencyId) {
      setAgencyMembers([]);
      setAgencyKey(null);
      return;
    }

    const loadAgencyData = async () => {
      // members
      const { data: members, error: mErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, users_profile(full_name, avatar_url)")
        .eq("agency_id", selectedAgencyId);

      if (mErr) console.error("load members error:", mErr);
      setAgencyMembers((members || []) as unknown as MemberViewRow[]);

      // key (OWNER seulement)
      if (!isOwner) {
        setAgencyKey(null);
        return;
      }

      const { data: key, error: kErr } = await supabase
        .from("agency_keys")
        .select("id, active, created_at")
        .eq("agency_id", selectedAgencyId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (kErr) console.error("load key error:", kErr);
      setAgencyKey((key as AgencyKeyRow) || null);
    };

    loadAgencyData();
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

    if (error) flash("Erreur: " + humanErr(error));
    else {
      setProfile((p) => (p ? { ...p, full_name: fullName } : p));
      setEditName(false);
      flash("Nom mis à jour ✅");
    }

    setBusy(false);
  };

  // ✅ CREATE AGENCY (séparé)
  const createAgency = async () => {
    if (!newAgencyName.trim()) return;
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
      flash("Aucune donnée retournée (create_agency)");
      setBusy(false);
      return;
    }

    flash("Agence créée ✅");
    setNewAgencyName("");

    await reloadMemberships(authUserId);
    setSelectedAgencyId(String(data));

    setBusy(false);
  };

  // ✅ JOIN AGENCY (séparé)
  const joinAgency = async () => {
    if (!joinCode.trim()) return;
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

  // ✅ GENERATE KEY (OWNER only)
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

    // la clé retournée = uuid (id)
    const newId = String(data);
    setAgencyKey({
      id: newId,
      active: true,
      created_at: new Date().toISOString(),
    });

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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Profil</h1>
          <p className="text-slate-600 mt-1">Gestion du compte & espaces de travail.</p>
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
          {/* INFOS */}
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
                  <label className="text-xs font-medium text-slate-600">Nom complet</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                    value={fullName}
                    disabled={!editName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Email</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                    value={email}
                    disabled
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Créé le</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                    value={safeDate(profile.created_at)}
                    disabled
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Email confirmé</label>
                  <div className="mt-2">
                    <Badge tone={emailConfirmed ? "green" : "amber"}>
                      {emailConfirmed ? "✅ Confirmé" : "❌ Non confirmé"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* WORKSPACE */}
          <Card>
            <CardHeader title="Espace de travail" subtitle="Agences liées + sélection d’un espace." />
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
                        key={m.id}
                        onClick={() => setSelectedAgencyId(m.agency_id)}
                        className={`text-left p-4 rounded-2xl border transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{ag?.name || "Agence sans nom"}</div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              active ? "border-white/20 bg-white/10" : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            {m.role}
                          </span>
                        </div>

                        <div className={`mt-2 text-sm ${active ? "text-white/80" : "text-slate-600"}`}>
                          Statut : {m.status || "—"}
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
                  </div>

                  <div className="flex gap-2 items-center">
                    {isOwner ? (
                      agencyKey?.id ? (
                        <Btn onClick={() => copy(agencyKey.id)}>Copier clé</Btn>
                      ) : (
                        <Btn variant="primary" disabled={busy || !selectedAgencyId} onClick={generateKey}>
                          Générer une clé
                        </Btn>
                      )
                    ) : (
                      <Badge tone="amber">Clé réservée au OWNER</Badge>
                    )}
                  </div>
                </div>

                {isOwner && agencyKey?.id && (
                  <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Clé d’invitation</div>
                    <div className="mt-1 font-mono text-sm break-all">{agencyKey.id}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Créée le {safeDate(agencyKey.created_at)}
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
                        <div key={m.user_id} className="p-4 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {m.users_profile?.full_name || m.user_id}
                            </div>
                            <div className="text-xs text-slate-500">Statut : {m.status || "—"}</div>
                          </div>
                          <div className="flex gap-2">
                            <Badge tone={m.role === "OWNER" ? "green" : "gray"}>{m.role}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* CREATE AGENCY (séparé) */}
          <Card>
            <CardHeader title="Créer une agence" subtitle="Créer ton propre espace de travail." />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="Nom de l’agence (ex: Dealink)"
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                />
                <Btn variant="primary" disabled={busy || !newAgencyName.trim()} onClick={createAgency}>
                  Créer
                </Btn>
              </div>
              <div className="text-xs text-slate-500">
                Cette action est indépendante de “Rejoindre une agence”.
              </div>
            </CardBody>
          </Card>

          {/* JOIN AGENCY (séparé) */}
          <Card>
            <CardHeader title="Rejoindre une agence" subtitle="Entrer une clé d’invitation reçue." />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="Clé d’agence"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <Btn variant="primary" disabled={busy || !joinCode.trim()} onClick={joinAgency}>
                  Rejoindre
                </Btn>
              </div>
              <div className="text-xs text-slate-500">
                Cette action ne crée pas d’agence : elle rejoint un espace existant.
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
