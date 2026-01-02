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

  // Workspace data
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  // ---------- Load auth + profile + memberships ----------
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

      // profile
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

      // memberships
      // ⚠️ IMPORTANT: adapte les colonnes selon ta table agency_members
      // Chez toi on voit: agency_id, user_id, role, status (+ id)
      const { data: ms, error: msErr } = await supabase
        .from("agency_members")
        .select("agency_id, user_id, role, status, agencies(id,name)")
        .eq("user_id", user.id);

      if (msErr) {
        flash(msErr.message || "Erreur chargement agences");
        setMemberships([]);
      } else {
        // On mappe vers ton type MembershipRow attendu par WorkspaceCard
        const mapped = (ms || []).map((m: any) => ({
          agency_id: m.agency_id,
          user_id: m.user_id,
          member_role: m.role,           // <-- mapping: role -> member_role
          workspace_role: "ALL",          // <-- placeholder si pas dans DB
          joined_at: new Date().toISOString(), // <-- placeholder si pas dans DB
          agencies: m.agencies,
        })) as MembershipRow[];

        setMemberships(mapped);

        if (!selectedAgencyId && mapped.length) {
          setSelectedAgencyId(mapped[0].agency_id);
        }
      }

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // ---------- Derived ----------
  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const isOwner = selectedMembership?.member_role === "OWNER";

  const onSelectAgency = (agencyId: string) => {
    setSelectedAgencyId(agencyId);
  };

  // ---------- Load members + key for selected agency ----------
  useEffect(() => {
    const loadAgencyDetails = async () => {
      if (!selectedAgencyId) {
        setMembers([]);
        setAgencyKey(null);
        return;
      }

      // members list
      // ⚠️ adapte les colonnes : tu as role + status
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, users_profile(full_name, avatar_url)")
        .eq("agency_id", selectedAgencyId);

      if (memErr) {
        // souvent: RLS/permission denied
        flash(memErr.message || "Erreur chargement membres");
        setMembers([]);
      } else {
        const mappedMembers = (mems || []).map((m: any) => ({
          user_id: m.user_id,
          member_role: m.role,           // role -> member_role
          workspace_role: m.status || "ACTIVE", // status -> workspace_role (ou l’inverse selon ton choix)
          joined_at: new Date().toISOString(),
          users_profile: m.users_profile,
        })) as MemberViewRow[];

        setMembers(mappedMembers);
      }

      // agency key (only owner)
      if (isOwner) {
        const { data: key, error: keyErr } = await supabase
          .from("agency_keys")
          .select("code, is_active, created_at")
          .eq("agency_id", selectedAgencyId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (keyErr) {
          setAgencyKey(null);
        } else {
          setAgencyKey((key as AgencyKeyRow) || null);
        }
      } else {
        setAgencyKey(null);
      }
    };

    loadAgencyDetails();
  }, [selectedAgencyId, isOwner, supabase]);

  // ---------- Actions ----------
  const onSaveName = async (newName: string) => {
    if (!authUserId) return;
    setBusy(true);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: newName })
      .eq("user_id", authUserId);

    if (error) flash("Erreur mise à jour");
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

  // ⚠️ Ici on appelle un RPC (recommandé) pour générer une clé
  // Si tu n’as pas encore ce RPC, dis-moi et je te donne le SQL exact.
  const onGenerateKey = async () => {
    if (!selectedAgencyId) return;
    setBusy(true);

    const { data, error } = await supabase.rpc("generate_agency_key", {
      p_agency_id: selectedAgencyId,
    });

    if (error || !data) {
      flash("Impossible de générer une clé");
      setBusy(false);
      return;
    }

    flash("Clé générée ✅");
    // recharge clé
    const { data: key } = await supabase
      .from("agency_keys")
      .select("code, is_active, created_at")
      .eq("agency_id", selectedAgencyId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setAgencyKey((key as AgencyKeyRow) || null);
    setBusy(false);
  };

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

          {tab === "MY_AGENCIES" && (
            <>
              <WorkspaceCard
                memberships={memberships}
                selectedAgencyId={selectedAgencyId}
                onSelectAgency={onSelectAgency}
                members={members}
                isOwner={!!isOwner}
                agencyKey={agencyKey}
                onGenerateKey={onGenerateKey}
                onCopy={onCopy}
                busy={busy}
              />
              <CreateAgencyCard />
            </>
          )}

          {tab === "WORK" && (
            <>
              <WorkspaceCard
                memberships={memberships}
                selectedAgencyId={selectedAgencyId}
                onSelectAgency={onSelectAgency}
                members={members}
                isOwner={!!isOwner}
                agencyKey={agencyKey}
                onGenerateKey={onGenerateKey}
                onCopy={onCopy}
                busy={busy}
              />
              <JoinAgencyCard />
            </>
          )}
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
      className={`px-4 py-2 rounded-xl text-sm font-medium border transition
        ${
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white border-slate-200 hover:bg-slate-50"
        }`}
    >
      {children}
    </button>
  );
}
