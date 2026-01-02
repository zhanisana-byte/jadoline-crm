"use client";

import { useEffect, useMemo, useState } from "react";
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
  code: string;
  is_active: boolean;
  created_at: string;
};

/* ================= HELPERS ================= */

const firstAgency = (
  a?: AgencyRow | AgencyRow[] | null
): AgencyRow | null => {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
};

const safeDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

/* ================= UI ATOMS ================= */

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
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && (
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      )}
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
}) => {
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-200 hover:bg-slate-50";
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm ${cls}`}
    >
      {children}
    </button>
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

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [agencyMembers, setAgencyMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  const [newAgencyName, setNewAgencyName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
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

      const { data: p } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, created_at, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (!p) {
        flash("Profil introuvable");
        setLoading(false);
        return;
      }

      setProfile(p);
      setFullName(p.full_name ?? "");

      const { data: ms } = await supabase
        .from("agency_members")
        .select(
          "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id,name)"
        )
        .eq("user_id", user.id);

      const list = (ms || []) as unknown as MembershipRow[];
      setMemberships(list);

      if (list.length && !selectedAgencyId) {
        setSelectedAgencyId(list[0].agency_id);
      }

      setLoading(false);
    };

    load();
  }, [supabase]);

  /* ============ LOAD SELECTED AGENCY DETAILS ============ */

  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const selectedAgency =
    firstAgency(selectedMembership?.agencies) || null;

  const isOwner = selectedMembership?.member_role === "OWNER";

  useEffect(() => {
    if (!selectedAgencyId) return;

    const loadAgency = async () => {
      const { data: members } = await supabase
        .from("agency_members")
        .select(
          "user_id, member_role, workspace_role, joined_at, users_profile(full_name, avatar_url)"
        )
        .eq("agency_id", selectedAgencyId);

      setAgencyMembers(
        (members || []) as unknown as MemberViewRow[]
      );

      if (isOwner) {
        const { data: key } = await supabase
          .from("agency_keys")
          .select("code, is_active, created_at")
          .eq("agency_id", selectedAgencyId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setAgencyKey((key as AgencyKeyRow) || null);
      }
    };

    loadAgency();
  }, [selectedAgencyId, isOwner]);

  /* ============ ACTIONS ============ */

  const saveName = async () => {
    if (!authUserId) return;
    setBusy(true);

    await supabase
      .from("users_profile")
      .update({ full_name: fullName })
      .eq("user_id", authUserId);

    setProfile((p) => (p ? { ...p, full_name: fullName } : p));
    setEditName(false);
    flash("Nom mis à jour");
    setBusy(false);
  };

  const createAgency = async () => {
    if (!newAgencyName || !authUserId) return;
    setBusy(true);

    const { data } = await supabase.rpc("create_agency", {
      p_name: newAgencyName,
    });

    flash("Agence créée");
    setNewAgencyName("");

    const { data: ms } = await supabase
      .from("agency_members")
      .select(
        "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id,name)"
      )
      .eq("user_id", authUserId);

    const list = (ms || []) as unknown as MembershipRow[];
    setMemberships(list);
    setSelectedAgencyId(String(data));

    setBusy(false);
  };

  const joinAgency = async () => {
    if (!joinCode || !authUserId) return;
    setBusy(true);

    const { data, error } = await supabase.rpc(
      "join_agency_with_code",
      { p_code: joinCode }
    );

    if (error) {
      flash("Clé invalide");
      setBusy(false);
      return;
    }

    flash("Agence rejointe");
    setJoinCode("");

    const { data: ms } = await supabase
      .from("agency_members")
      .select(
        "agency_id, user_id, member_role, workspace_role, joined_at, agencies(id,name)"
      )
      .eq("user_id", authUserId);

    const list = (ms || []) as unknown as MembershipRow[];
    setMemberships(list);
    setSelectedAgencyId(String(data));

    setBusy(false);
  };

  /* ============ RENDER ============ */

  if (loading) return <div className="p-6">Chargement…</div>;
  if (!profile) return <div className="p-6">Profil introuvable</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Profil</h1>
      {toast && (
        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl">
          {toast}
        </div>
      )}

      {/* INFO PERSO */}
      <Card>
        <CardHeader title="Informations personnelles" />
        <CardBody>
          <input
            className="border px-3 py-2 rounded-xl w-full"
            value={fullName}
            disabled={!editName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            {!editName ? (
              <Btn onClick={() => setEditName(true)}>Modifier</Btn>
            ) : (
              <>
                <Btn variant="primary" onClick={saveName}>
                  Enregistrer
                </Btn>
                <Btn onClick={() => setEditName(false)}>Annuler</Btn>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ESPACES */}
      <Card>
        <CardHeader title="Espaces de travail" />
        <CardBody>
          {memberships.map((m) => {
            const ag = firstAgency(m.agencies);
            return (
              <div
                key={m.agency_id}
                className={`p-3 rounded-xl border mb-2 cursor-pointer ${
                  selectedAgencyId === m.agency_id
                    ? "border-slate-900"
                    : "border-slate-200"
                }`}
                onClick={() => setSelectedAgencyId(m.agency_id)}
              >
                <b>{ag?.name || "Agence"}</b> — {m.member_role}
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* CREATE / JOIN */}
      <Card>
        <CardHeader title="Créer ou rejoindre une agence" />
        <CardBody className="space-y-4">
          <div className="flex gap-2">
            <input
              className="border px-3 py-2 rounded-xl flex-1"
              placeholder="Nom agence"
              value={newAgencyName}
              onChange={(e) => setNewAgencyName(e.target.value)}
            />
            <Btn variant="primary" onClick={createAgency}>
              Créer
            </Btn>
          </div>

          <div className="flex gap-2">
            <input
              className="border px-3 py-2 rounded-xl flex-1"
              placeholder="Clé agence"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <Btn variant="primary" onClick={joinAgency}>
              Rejoindre
            </Btn>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
