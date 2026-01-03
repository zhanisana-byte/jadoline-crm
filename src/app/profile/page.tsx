"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import MonAgencyCard from "@/components/profile/MonAgencyCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const supabase = createClient();

  const [tab, setTab] = useState<"infos" | "agency" | "work">("infos");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<{
    user_id: string;
    full_name: string | null;
    agency_id: string | null;
    role: string | null;
    created_at: string | null;
    avatar_url: string | null;
  } | null>(null);

  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: u } = await supabase.auth.getUser();
        const user = u.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }

        setEmail(user.email ?? "");

        const { data, error } = await supabase
          .from("users_profile")
          .select("user_id, full_name, agency_id, role, created_at, avatar_url")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setProfile(data as any);
      } catch (e: any) {
        setErr(e?.message ?? "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const myAgencyId = useMemo(() => profile?.agency_id ?? null, [profile]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profil</h1>
        <p className="text-sm text-slate-500">Mes infos, mon agence, et collaborations.</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("infos")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm border",
            tab === "infos"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          Mes infos
        </button>
        <button
          onClick={() => setTab("agency")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm border",
            tab === "agency"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          Mon agence
        </button>
        <button
          onClick={() => setTab("work")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm border",
            tab === "work"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          Work (collaborations)
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Chargement...
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          {err}
        </div>
      ) : !profile ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Profil introuvable.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {tab === "infos" && (
              <>
                <ProfileInfoCard profile={profile} email={email} />
                {/* ✅ ID seulement + join par ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <JoinAgencyCard />
                  <MonAgencyCard myAgencyId={myAgencyId} />
                </div>
              </>
            )}

            {tab === "agency" && <MonAgencyCard myAgencyId={myAgencyId} />}

            {tab === "work" && <WorkspaceCard myAgencyId={myAgencyId} />}
          </div>

          <div className="space-y-6">
            <QuickRecapCard />
          </div>
        </div>
      )}
    </div>
  );
}
