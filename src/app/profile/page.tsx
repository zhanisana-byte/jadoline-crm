"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import MonAgencyCard from "@/components/profile/MonAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const supabase = createClient();

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
        setErr(e?.message ?? "Une erreur est survenue.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const myAgencyId = useMemo(() => profile?.agency_id ?? null, [profile]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Profil</h1>
        <p className="text-sm text-slate-500 mt-1">
          Vos informations, votre agence et l’adhésion à une agence.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          Chargement…
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
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            <ProfileInfoCard profile={profile} email={email} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <JoinAgencyCard />
              <MonAgencyCard myAgencyId={myAgencyId} />
            </div>
          </div>

          {/* Side */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-lg font-semibold">Récap</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>✅ Vous pouvez rejoindre une agence via son Agency ID</li>
                <li>✅ Votre Agency ID est copiable</li>
                <li>✅ La partie “Work” sera gérée dans le dashboard</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Conseil : si vous ne voyez pas votre Agency ID, cela signifie que
              <code className="mx-1">users_profile.agency_id</code> est vide.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
