"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

import { Badge } from "@/components/profile/ui";
import type {
  ProfileRow,
  MembershipRow,
  MemberViewRow,
  AgencyKeyRow,
} from "@/components/profile/types";

type TabKey = "INFO" | "MY_AGENCIES" | "WORK";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("INFO");

  const [authUserId, setAuthUserId] = useState<string>("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  // Reload memberships for current user
  const reloadMemberships = async (userId: string) => {
    const { data: ms, error: msErr } = await supabase
      .from("agency_members")
      .select("id, agency_id, user_id, role, status, agencies(id,name)")
      .eq("user_id", userId);

    if (msErr) {
      flash(msErr.message || "Erreur chargement agences");
      setMemberships([]);
      return [];
    }

    const list = (ms || []) as MembershipRow[];
    setMemberships(list);

    // ensure selected agency exists
    if (
      (!selectedAgencyId || !list.some((x) => x.agency_id === selectedAgencyId)) &&
      list.length
    ) {
      setSelectedAgencyId(list[0].agency_id);
    }

    return list;
  };

  // 1) Load auth + profile + memberships
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authRes?.user) {
        flash("Utilisateur non connecté");
        setLoading(false);
        return;
      }

      const user = authRes.user;

      setAuthUserId(user.id);
      setEmail(user.email ?? "");
      setEmailConfirmed(!!(user.email_confirmed_at || (user as any).confirmed_at));

      const { data: p, error: pErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, created_at, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (pErr || !p) {
        flash("Profil introuvable");
        setLoading(false);
        return;
      }

      setProfile(p as ProfileRow);

      await reloadMemberships(user.id);

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Derived
  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const isOwner = selectedMembership?.role === "OWNER";

  // 2) Load members + key for selected agency
  useEffect(() => {
    const loadAgency = async () => {
      if (!selectedAgencyId) {
        setMembers([]);
        setAgencyKey(null);
        return;
      }

      // members list (normalize users_profile: array -> object)
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, users_profile(full_name, avatar_url)")
        .eq("agency_id", selectedAgencyId);

      if (memErr) {
        flash(memErr.message || "Erreur chargement membres");
        setMembers([]);
      } else {
        const normalized = (mems || []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          users_profile: Array.isArray(m.users_profile)
            ? m.users_profile[0] ?? null
            : m.users_profile ?? null,
        }));

        setMembers(normalized as unknown as MemberViewRow[]);
      }

      // agency key (only OWNER)
      if (!isOwner) {
        setAgencyKey(null);
        return;
      }

      const { data: key, error: keyErr } = await supabase
        .from("agency_keys")
        .select("id, active, created_at")
        .eq("agency_id", selectedAgencyId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (keyErr) setAgencyKey(null);
      else setAgencyKey((key as AgencyKeyRow) || null);
    };

    loadAgency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgencyId, isOwner]);

  // Actions
  const onSaveName = async (newName: string) => {
    if (!authUserId) return;
    setBusy(true);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: newName })
      .eq("user_id", authUserId);

    if (error) flash(error.message || "Erreur mise à jour");
    else {
      setProfile((prev) => (prev ? { ...prev, full_name: newName } : prev));
      flash("Nom mis à jour ✅");
    }

    setBusy(false);
  };

  const onCopy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      flash("Copié ✅");
    } catch {
      flash("Copie impossible");
    }
  };

  const onGenerateKey = async () => {
    if (!selectedAgencyId) return;
    setBusy(true);

    // RPC: generate_agency_key(p_agency_id uuid) returns uuid
    const { data, error } = await supabase.rpc("generate_agency_key", {
      p_agency_id: selectedAgencyId,
    });

    if (error || !data) {
      flash(error?.message || "Impossible de générer la clé");
      setBusy(false);
      return;
    }

    flash("Clé générée ✅");

    // reload active key
    const { data: key } = await supabase
      .from("agency_keys")
      .select("id, active, created_at")
      .eq("agency_id", selectedAgencyId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setAgencyKey((key as AgencyKeyRow) || null);
    setBusy(false);
  };

  const onCreateAgency = async (name: string) => {
    if (!authUserId) return;
    setBusy(true);

    // RPC: create_agency(p_name text) returns uuid
    const { data, error } = await supabase.rpc("create_agency", {
      p_name: name,
    });

    if (error || !data) {
      flash(error?.message || "Impossible de créer l’espace");
      setBusy(false);
      return;
    }

    flash("Espace créé ✅");

    await reloadMemberships(authUserId);
    setSelectedAgencyId(String(data));
    setBusy(false);
  };

  const onJoinAgency = async (code: string) => {
    if (!authUserId) return;
    setBusy(true);

    // RPC: join_agency_with_code(p_code text) returns uuid
    const { data, error } = await supabase.rpc("join_agency_with_code", {
      p_code: code,
    });

    if (error || !data) {
      flash(error?.message || "Clé invalide / accès refusé");
      setBusy(false);
      return;
    }

    flash("Agence rejointe ✅");

    await reloadMemberships(authUserId);
    setSelectedAgencyId(String(data));
    setBusy(false);
  };

  if (loading) return <div className="p-6">Chargement…</div>;
  if (!profile) return <div className="p-6">Profil introuvable</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
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

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton active={tab === "INFO"} onClick={() => setTab("INFO")}>
          Infos
        </TabButton>
        <TabButton active={tab === "MY_AGENCIES"} onClick={() => setTab("MY_AGENCIES")}>
          Mes agences
        </TabButton>
        <TabButton active={tab === "WORK"} onClick={() => setTab("WORK")}>
          Work
        </TabButton>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {tab === "INFO" && (
            <ProfileInfoCard
              profile={profile}
              email={email}
              emailConfirmed={emailConfirmed}
              busy={busy}
              onSaveName={onSaveName}
            />
          )}

          {(tab === "MY_AGENCIES" || tab === "WORK") && (
            <WorkspaceCard
              memberships={memberships}
              selectedAgencyId={selectedAgencyId}
              onSelectAgency={setSelectedAgencyId}
              members={members}
              isOwner={!!isOwner}
              agencyKey={agencyKey}
              onGenerateKey={onGenerateKey}
              onCopy={onCopy}
              busy={busy}
            />
          )}

          {tab === "MY_AGENCIES" && (
            <CreateAgencyCard busy={busy} onCreate={onCreateAgency} />
          )}

          {tab === "WORK" && <JoinAgencyCard busy={busy} onJoin={onJoinAgency} />}
        </div>

        <aside className="lg:col-span-4">
          <div className="sticky top-6 space-y-6">
            <QuickRecapCard />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
