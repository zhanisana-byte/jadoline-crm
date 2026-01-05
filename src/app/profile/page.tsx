// src/app/profile/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import MonAgencyCard from "@/components/profile/MonAgencyCard";
import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  agency_id: string | null;
  role: string | null;
  created_at: string | null;
  avatar_url: string | null;
  account_type: "AGENCY" | "SOCIAL_MANAGER" | null;
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function initials(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: uRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const user = uRes.user;
      if (!user) {
        setErr("Vous devez être connecté(e).");
        setProfile(null);
        return;
      }

      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("users_profile")
        .select("user_id, full_name, agency_id, role, created_at, avatar_url, account_type")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setProfile({
        user_id: String(data.user_id),
        full_name: data.full_name ?? null,
        agency_id: data.agency_id ?? null,
        role: data.role ?? null,
        created_at: data.created_at ?? null,
        avatar_url: data.avatar_url ?? null,
        account_type: (data.account_type ?? null) as any,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Une erreur est survenue.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;

  if (err) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          {err}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          Aucun profil.
        </div>
      </div>
    );
  }

  const accountLabel =
    profile.account_type === "AGENCY"
      ? "AGENCE"
      : profile.account_type === "SOCIAL_MANAGER"
      ? "SOCIAL MANAGER"
      : "COMPTE";

  const myAgencyId = profile.agency_id ?? null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* HEADER */}
      <div className="card p-6">
        <div className="profileTop">
          <div className="profileLeft">
            {/* Avatar */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-[72px] h-[72px] rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="avatarCircle">{initials(profile.full_name)}</div>
            )}

            {/* Infos */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="profileName truncate">
                  {profile.full_name ?? "Utilisateur"}
                </div>

                <span
                  className={cn(
                    "badge",
                    profile.account_type === "AGENCY" ? "badge-info" : "badge-success"
                  )}
                >
                  {accountLabel}
                </span>

                {profile.role ? (
                  <span className="badge border-slate-200 bg-white text-slate-700">
                    {String(profile.role)}
                  </span>
                ) : null}
              </div>

              <div className="profileEmail truncate">{email || "—"}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Notifications
            </Link>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          <ProfileInfoCard
            profile={{
              full_name: profile.full_name,
              created_at: profile.created_at,
            }}
            email={email}
            onSaved={load} // ✅ refresh sans reload
          />

          {/* SOCIAL_MANAGER: rejoindre */}
          {profile.account_type === "SOCIAL_MANAGER" && <JoinAgencyCard />}

          <QuickRecapCard />
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* AGENCY: mon agence */}
          {profile.account_type === "AGENCY" && <MonAgencyCard myAgencyId={myAgencyId} />}

          {/* collaborations (work) */}
          <WorkspaceCard myAgencyId={myAgencyId} />
        </div>
      </div>
    </div>
  );
}
