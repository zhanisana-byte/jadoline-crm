"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

import { Badge } from "@/components/profile/ui";
import type { ProfileRow } from "@/components/profile/types";

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

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  // LOAD auth + profile
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
      setLoading(false);
    };

    load();
  }, [supabase]);

  // callback pour ProfileInfoCard
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

      {/* Content */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
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
              <WorkspaceCard />
              <CreateAgencyCard />
            </>
          )}

          {tab === "WORK" && (
            <>
              <WorkspaceCard />
              <JoinAgencyCard />
            </>
          )}
        </div>

        {/* RIGHT */}
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
