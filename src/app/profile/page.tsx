"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { Badge, humanErr } from "@/components/profile/ui";
import type { AgencyKeyRow, MemberViewRow, MembershipRow, ProfileRow } from "@/components/profile/types";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [authUserId, setAuthUserId] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

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
      flash(humanErr(error));
      return [];
    }

    const list = (data || []) as unknown as MembershipRow[];
    setMemberships(list);

    if (!selectedAgencyId && list.length) setSelectedAgencyId(list[0].agency_id);

    return list;
  };

  // LOAD USER + PROFILE + MEMBERSHIPS
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

      await reloadMemberships(user.id);

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const selectedMembership = memberships.find((m) => m.agency_id === selectedAgencyId) || null;
  const isOwner = selectedMembership?.role === "OWNER";

  // LOAD MEMBERS + KEY (selected agency)
  useEffect(() => {
    if (!selectedAgencyId) {
      setMembers([]);
      setAgencyKey(null);
      return;
    }

    const loadAgency = async () => {
      const { data: mem, error: mErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, users_profile(full_name, avatar_url)")
        .eq("agency_id", selectedAgencyId);

      if (mErr) console.error("members error:", mErr);
      setMembers((mem || []) as unknown as MemberViewRow[]);

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

      if (kErr) console.error("agency key error:", kErr);
      setAgencyKey((key as AgencyKeyRow) || null);
    };

    loadAgency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgencyId, isOwner]);

  // ACTIONS
  const onSaveName = async (newName: string) => {
    if (!authUserId) return;
    setBusy(true);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: newName })
      .eq("user_id", authUserId);

    if (error) flash(humanErr(error));
    else {
      setProfile((p) => (p ? { ...p, full_name: newName } : p));
      flash("Nom mis à jour ✅");
    }

    setBusy(false);
  };

  const onCreateAgency = async (name: string) => {
    setBusy(true);

    const { data, error } = await supabase.rpc("create_agency", { p_name: name });

    if (error) {
      console.error("create_agency error:", error);
      flash(humanErr(error));
      setBusy(false);
      return;
    }

    flash("Agence créée ✅");

    await reloadMemberships(authUserId);
    setSelectedAgencyId(String(data));

    setBusy(false);
  };

  const onJoinAgency = async (code: string) => {
    setBusy(true);

    const { data, error } = await supabase.rpc("join_agency_with_code", { p_code: code });

    if (error) {
      console.error("join_agency_with_code error:", error);
      flash(humanErr(error));
      setBusy(false);
      return;
    }

    flash("Agence rejointe ✅");

    await reloadMemberships(authUserId);
    setSelectedAgencyId(String(data));

    setBusy(false);
  };

  const onGenerateKey = async () => {
    if (!selectedAgencyId || !isOwner) return;
    setBusy(true);

    const { data, error } = await supabase.rpc("generate_agency_key", { p_agency_id: selectedAgencyId });

    if (error) {
      console.error("generate_agency_key error:", error);
      flash(humanErr(error));
      setBusy(false);
      return;
    }

    setAgencyKey({
      id: String(data),
      active: true,
      created_at: new Date().toISOString(),
    });

    flash("Clé générée ✅");
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
          <Badge tone={profile.role === "OWNER" ? "green" : "blue"}>Rôle global : {profile.role}</Badge>
          {toast && (
            <span className="text-sm px-3 py-2 rounded-xl bg-slate-900 text-white">{toast}</span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <ProfileInfoCard
            profile={profile}
            email={email}
            emailConfirmed={emailConfirmed}
            busy={busy}
            onSaveName={onSaveName}
          />

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

          <CreateAgencyCard busy={busy} onCreate={onCreateAgency} />
          <JoinAgencyCard busy={busy} onJoin={onJoinAgency} />
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
