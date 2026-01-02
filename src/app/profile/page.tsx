"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "OWNER" | "CM" | "FITNESS";
type MemberRole = "OWNER" | "MEMBER";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  agency_id: string | null; // ancien MVP (optionnel)
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
  member_role: MemberRole; // OWNER / MEMBER
  workspace_role: string; // CM / FITNESS / OWNER (comme tu veux)
  joined_at: string;

  // Supabase peut renvoyer un objet OU un array selon le join
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
  code: string;
  is_active: boolean;
  created_at: string;
};

// ---- Helpers ----
const firstAgency = (a?: AgencyRow | AgencyRow[] | null): AgencyRow | null => {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
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

const Badge = ({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "blue" | "red";
}) => {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : tone === "red"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}
    >
      {children}
    </span>
  );
};

const Btn = ({
  children,
  onClick,
  variant = "outline",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : variant === "ghost"
      ? "text-slate-700 hover:bg-slate-50"
      : "border border-slate-200 text-slate-800 hover:bg-slate-50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls}`}
    >
      {children}
    </button>
  );
};

export default function ProfileV2Page() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [editName, setEditName] = useState(false);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const selectedAgency =
    firstAgency(selectedMembership?.agencies) || null;

  const isOwnerInSelected = selectedMembership?.member_role === "OWNER";

  const [agencyMembers, setAgencyMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  const [newAgencyName, setNewAgencyName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const safeDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // ---- Load base data (auth + profile + memberships) ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setLoading(false);
        flash("Utilisateur non authentifié.");
        return;
      }

      setEmail(user.email ?? "");
      setEmailConfirmed(
        !!(user.email_confirmed_at || (user as any).confirmed_at)
      );

      // Profile
      const { data: p, error: pErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, agency_id, created_at, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (pErr || !p) {
        setLoading(false);
        flash("Profil introuvable.");
        return;
      }

      setProfile(p);
      setFullName(p.full_name ?? "");

      // Memberships + join agencies
      const { data: ms, error: msErr } = await supabase
        .from("agency_members")
        .select(
          "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id, name)"
        )
        .eq("user_id", user.id);

      if (msErr) {
        setMemberships([]);
      } else {
        const list = (ms || []) as unknown as MembershipRow[];
        setMemberships(list);

        // select first agency by default
        if (!selectedAgencyId && list.length > 0) {
          setSelectedAgencyId(list[0].agency_id);
        }
      }

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // ---- Load selected agency details (members + key) ----
  useEffect(() => {
    const loadAgencyDetails = async () => {
      if (!selectedAgencyId) {
        setAgencyMembers([]);
        setAgencyKey(null);
        return;
      }

      // Members of the agency (join users_profile)
      const { data: membersData } = await supabase
        .from("agency_members")
        .select(
          "user_id, member_role, workspace_role, joined_at, users_profile(full_name, avatar_url)"
        )
        .eq("agency_id", selectedAgencyId)
        .order("joined_at", { ascending: true });

      setAgencyMembers((membersData || []) as unknown as MemberViewRow[]);

      // Latest active key (owner only)
      if (isOwnerInSelected) {
        const { data: keyData } = await supabase
          .from("agency_keys")
          .select("code, is_active, created_at")
          .eq("agency_id", selectedAgencyId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setAgencyKey((keyData as AgencyKeyRow) || null);
      } else {
        setAgencyKey(null);
      }
    };

    loadAgencyDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgencyId, isOwnerInSelected]);

  // ---- Actions ----
  const saveName = async () => {
    if (!profile) return;
    setBusy(true);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: fullName })
      .eq("user_id", profile.user_id);

    if (error) flash("Erreur lors de la mise à jour.");
    else {
      flash("Vos informations ont été mises à jour avec succès.");
      setEditName(false);
      setProfile({ ...profile, full_name: fullName });
    }

    setBusy(false);
  };

  const changePassword = async () => {
    const newPwd = prompt("Nouveau mot de passe (min. 8 caractères)");
    if (!newPwd || newPwd.length < 8) return flash("Mot de passe trop court.");

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    flash(
      error
        ? "Erreur lors du changement du mot de passe."
        : "Mot de passe modifié avec succès."
    );
  };

  const resendEmail = async () => {
    await supabase.auth.resend({ type: "signup", email });
    flash("Email de confirmation renvoyé.");
  };

  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      flash("Copié ✅");
    } catch {
      flash("Impossible de copier.");
    }
  };

  const createAgency = async () => {
    if (!newAgencyName.trim()) return;
    setBusy(true);

    // RPC create_agency(p_name text) returns uuid
    const { data, error } = await supabase.rpc("create_agency", {
      p_name: newAgencyName.trim(),
    });

    if (error || !data) {
      flash("Impossible de créer l’espace.");
      setBusy(false);
      return;
    }

    flash("Espace créé ✅");
    setNewAgencyName("");

    // reload memberships quickly
    const { data: ms } = await supabase
      .from("agency_members")
      .select(
        "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id, name)"
      )
      .eq("user_id", profile.user_id);

    const list = (ms || []) as unknown as MembershipRow[];
    setMemberships(list);
    setSelectedAgencyId(String(data)); // select created
    setBusy(false);
  };

  const generateKey = async () => {
    if (!selectedAgencyId) return;
    setBusy(true);

    // RPC generate_agency_key(p_agency_id uuid) returns text
    const { data, error } = await supabase.rpc("generate_agency_key", {
      p_agency_id: selectedAgencyId,
    });

    if (error || !data) {
      flash("Impossible de générer la clé.");
      setBusy(false);
      return;
    }

    flash("Nouvelle clé générée ✅");
    setAgencyKey({
      code: String(data),
      is_active: true,
      created_at: new Date().toISOString(),
    });
    setBusy(false);
  };

  const joinAgency = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);

    // RPC join_agency_with_code(p_code text) returns uuid
    const { data, error } = await supabase.rpc("join_agency_with_code", {
      p_code: joinCode.trim(),
    });

    if (error || !data) {
      flash("Clé invalide ou accès refusé.");
      setBusy(false);
      return;
    }

    flash("Vous avez rejoint l’espace ✅");
    setJoinCode("");

    // reload memberships
    const { data: ms } = await supabase
      .from("agency_members")
      .select(
        "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id, name)"
      )
      .eq("user_id", profile.user_id);

    const list = (ms || []) as unknown as MembershipRow[];
    setMemberships(list);
    setSelectedAgencyId(String(data));
    setBusy(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    setBusy(true);

    // ✅ Bucket "avatars" à créer dans Storage
    // Chemin: {user_id}/avatar.png
    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.user_id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      flash("Upload impossible (bucket/policies).");
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = pub.publicUrl;

    const { error: dbErr } = await supabase
      .from("users_profile")
      .update({ avatar_url })
      .eq("user_id", profile.user_id);

    if (dbErr) flash("Photo uploadée mais impossible de l’enregistrer.");
    else {
      setProfile({ ...profile, avatar_url });
      flash("Photo de profil mise à jour ✅");
    }

    setBusy(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
          <div className="lg:col-span-4">
            <div className="h-60 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader title="Profil" subtitle="Impossible de charger le profil." />
          <CardBody>
            <p className="text-slate-700">
              Vérifie que le compte est connecté et que la table users_profile
              contient une ligne pour cet utilisateur.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Top header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Profil</h1>
          <p className="text-slate-600 mt-1">
            Gérez vos informations et vos espaces de travail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            tone={
              profile.role === "OWNER"
                ? "green"
                : profile.role === "CM"
                ? "blue"
                : "amber"
            }
          >
            Rôle global : {profile.role}
          </Badge>
          {toast && (
            <span className="text-sm px-3 py-2 rounded-xl bg-slate-900 text-white shadow-sm">
              {toast}
            </span>
          )}
        </div>
      </div>

      {/* Layout grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card: Personal info */}
          <Card>
            <CardHeader
              title="Informations personnelles"
              subtitle="Nom, email, photo et sécurité."
              right={
                <div className="flex items-center gap-2">
                  {!editName ? (
                    <Btn onClick={() => setEditName(true)}>Modifier</Btn>
                  ) : (
                    <>
                      <Btn variant="primary" disabled={busy} onClick={saveName}>
                        Enregistrer
                      </Btn>
                      <Btn
                        onClick={() => {
                          setEditName(false);
                          setFullName(profile.full_name ?? "");
                        }}
                      >
                        Annuler
                      </Btn>
                    </>
                  )}
                </div>
              }
            />
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-500 text-xs">Photo</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Nom complet
                      </label>
                      <input
                        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        value={fullName}
                        disabled={!editName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Votre nom"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Email (lecture seule)
                      </label>
                      <input
                        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                        value={email}
                        disabled
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Créé le
                      </label>
                      <input
                        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                        value={safeDate(profile.created_at)}
                        disabled
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Sécurité
                      </label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Btn onClick={changePassword}>
                          Changer mot de passe
                        </Btn>
                        {!emailConfirmed && (
                          <Btn onClick={resendEmail}>
                            Renvoyer confirmation email
                          </Btn>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <span className="text-sm text-slate-700">
                        Changer photo
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAvatar(f);
                        }}
                      />
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                        Upload
                      </span>
                    </label>
                    <span className="text-xs text-slate-500">
                      Pour MVP : bucket <b>avatars</b> (public) recommandé.
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Card: Workspaces */}
          <Card>
            <CardHeader
              title="Espace de travail"
              subtitle="Toutes les agences liées à ce compte (multi-agences)."
              right={
                <Badge tone={memberships.length ? "green" : "amber"}>
                  {memberships.length} espace{memberships.length > 1 ? "s" : ""}
                </Badge>
              }
            />
            <CardBody>
              {memberships.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-amber-800 font-medium">Aucun espace lié.</p>
                  <p className="text-amber-700 text-sm mt-1">
                    Crée un espace ou rejoins-en un avec une clé.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {memberships.map((m) => {
                    const active = m.agency_id === selectedAgencyId;
                    const ag = firstAgency(m.agencies);
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
                        <div className="flex items-center justify-between gap-2">
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
                          Accès : {m.workspace_role || "CM"}
                        </div>

                        <div
                          className={`mt-1 text-xs ${
                            active ? "text-white/70" : "text-slate-500"
                          }`}
                        >
                          Rejoint le {safeDate(m.joined_at)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected agency details */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">
                      Espace sélectionné
                    </div>
                    <div className="text-xl font-semibold text-slate-900">
                      {selectedAgency?.name || "—"}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {selectedMembership ? (
                        <>
                          <Badge
                            tone={
                              selectedMembership.member_role === "OWNER"
                                ? "green"
                                : "blue"
                            }
                          >
                            {selectedMembership.member_role}
                          </Badge>
                          <Badge tone="gray">
                            {selectedMembership.workspace_role}
                          </Badge>
                        </>
                      ) : (
                        <Badge tone="amber">Aucun</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isOwnerInSelected ? (
                      <Btn
                        variant="primary"
                        disabled={busy || !selectedAgencyId}
                        onClick={generateKey}
                      >
                        Générer / Régénérer clé
                      </Btn>
                    ) : (
                      <Badge tone="amber">
                        Accès limité : clé réservée au propriétaire
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Key + stats */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="text-xs font-medium text-slate-600">
                      Clé d’accès (rejoindre)
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-sm px-3 py-2 rounded-xl bg-white border border-slate-200">
                        {isOwnerInSelected ? agencyKey?.code || "—" : "—"}
                      </span>
                      {isOwnerInSelected && agencyKey?.code && (
                        <Btn onClick={() => copy(agencyKey.code)}>Copier</Btn>
                      )}
                    </div>
                    {isOwnerInSelected && agencyKey?.created_at && (
                      <div className="text-xs text-slate-500 mt-2">
                        Dernière génération : {safeDate(agencyKey.created_at)}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200">
                    <div className="text-xs font-medium text-slate-600">
                      Membres
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {agencyMembers.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      CM/FITNESS/OWNER dans cet espace
                    </div>
                  </div>
                </div>

                {/* Members list */}
                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Liste des membres
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    {agencyMembers.length === 0 ? (
                      <div className="p-4 text-slate-600">
                        Aucun membre trouvé.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {agencyMembers.map((m) => (
                          <div
                            key={m.user_id}
                            className="p-4 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                {m.users_profile?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={m.users_profile.avatar_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    👤
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {m.users_profile?.full_name || m.user_id}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Rejoint : {safeDate(m.joined_at)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                tone={
                                  m.member_role === "OWNER" ? "green" : "gray"
                                }
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

                  {/* Invite (MVP = via key) */}
                  <div className="mt-4 p-4 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          Inviter un CM (MVP)
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          Copiez la clé et envoyez-la au freelance (WhatsApp/email). Il rejoindra l’espace avec cette clé.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isOwnerInSelected && agencyKey?.code ? (
                          <Btn
                            variant="primary"
                            onClick={() => copy(agencyKey.code)}
                          >
                            Copier la clé
                          </Btn>
                        ) : (
                          <Btn disabled>Clé indisponible</Btn>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Card: Create workspace */}
          <Card>
            <CardHeader
              title="Créer un espace"
              subtitle="Créer une nouvelle agence (espace de travail)."
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Nom de l’espace (ex: Sana Agency)"
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
              <p className="text-xs text-slate-500 mt-2">
                Après création, tu seras OWNER dans cet espace.
              </p>
            </CardBody>
          </Card>

          {/* Card: Join workspace */}
          <Card>
            <CardHeader
              title="Rejoindre un espace"
              subtitle="Entrez une clé pour rejoindre une agence."
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Clé (ex: A1B2C3D4)"
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
              <p className="text-xs text-slate-500 mt-2">
                Une fois rejoint, l’espace apparaît dans la liste “Espace de travail”.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <aside className="lg:col-span-4">
          <div className="sticky top-6 space-y-6">
            <Card>
              <CardHeader
                title="Récap permissions"
                subtitle="Comprendre l’accès global vs limité."
              />
              <CardBody>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">✅</span>
                    <span>
                      <b>Rôle global</b> : {profile.role} (niveau compte)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">🏢</span>
                    <span>
                      <b>Accès par espace</b> : OWNER/MEMBER + workspace_role
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">🔑</span>
                    <span>
                      La <b>clé</b> appartient à l’espace. Seul OWNER peut
                      régénérer.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">👥</span>
                    <span>
                      Un CM freelance peut être membre de plusieurs espaces.
                    </span>
                  </li>
                </ul>
              </CardBody>
            </Card>

            {!emailConfirmed && (
              <Card>
                <CardHeader
                  title="Activation du compte"
                  subtitle="Email non confirmé."
                  right={<Badge tone="amber">Action</Badge>}
                />
                <CardBody>
                  <p className="text-sm text-slate-700">
                    Veuillez confirmer votre adresse email afin d’activer votre
                    compte.
                  </p>
                  <div className="mt-3">
                    <Btn onClick={resendEmail}>Renvoyer l’email</Btn>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
