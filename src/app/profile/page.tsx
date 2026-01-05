"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import InvitationsModal from "@/components/profile/InvitationsModal";
import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import MonAgencyCard from "@/components/profile/MonAgencyCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  agency_id: string | null;
  account_type: "AGENCY" | "SOCIAL_MANAGER";
  created_at: string | null;
};

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [email, setEmail] = useState("");

  const [openInv, setOpenInv] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  async function loadAll() {
    setLoading(true);

    const { data: uRes } = await supabase.auth.getUser();
    const user = uRes.user;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setEmail(user.email ?? "");

    const { data: prof } = await supabase
      .from("users_profile")
      .select("user_id, full_name, agency_id, account_type, created_at")
      .eq("user_id", user.id)
      .single();

    setProfile(prof ?? null);

    // compteur invitations (PENDING)
    const { count } = await supabase
      .from("agency_invites")
      .select("id", { count: "exact", head: true })
      .eq("email", user.email)
      .eq("status", "PENDING");

    setPendingCount(count ?? 0);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;
  if (!profile) return <div className="p-6">Aucun profil</div>;

  const displayName = profile.full_name ?? "Utilisateur";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* ===== HEADER ===== */}
      <div className="card p-6">
        <div className="profileTop">
          <div className="profileLeft">
            <div className="avatarCircle">{initials(displayName)}</div>

            <div>
              <div className="profileName">{displayName}</div>

              <div className="profileEmail">{email}</div>

              {profile.agency_id && (
                <div className="mt-1 text-sm text-slate-600">
                  ID agence :{" "}
                  <span className="font-mono text-indigo-700">
                    {profile.agency_id}
                  </span>
                </div>
              )}

              <div className="mt-2">
                <span className="badge badge-info">{profile.account_type}</span>
              </div>
            </div>
          </div>

          {/* Bouton notifications */}
          <button
            type="button"
            onClick={() => setOpenInv(true)}
            className="relative rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Notifications
            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===== CONTENU ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col gauche */}
        <div className="lg:col-span-2 space-y-6">
          <ProfileInfoCard
            profile={{ full_name: profile.full_name, created_at: profile.created_at }}
            email={email}
          />

          {/* SOCIAL MANAGER : rejoindre une agence + work */}
          {profile.account_type === "SOCIAL_MANAGER" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <JoinAgencyCard />
              <WorkspaceCard myAgencyId={null} />
            </div>
          )}

          {/* AGENCY : Mon agency + Work */}
          {profile.account_type === "AGENCY" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MonAgencyCard myAgencyId={profile.agency_id} />
              <WorkspaceCard myAgencyId={profile.agency_id} />
            </div>
          )}
        </div>

        {/* Col droite (zone future) */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="text-lg font-semibold">Actions rapides</div>
            <div className="mt-3 text-sm text-slate-600">
              Ici vous pouvez ajouter plus tard :
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Modifier profil</li>
                <li>Paramètres</li>
                <li>Abonnement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODAL INVITATIONS ===== */}
      {openInv && (
        <InvitationsModal
          onClose={() => {
            setOpenInv(false);
            // refresh compteur après fermeture
            loadAll();
          }}
        />
      )}
    </div>
  );
}
