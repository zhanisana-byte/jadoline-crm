"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("users_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return null;
  if (!profile) return <div>Aucun profil</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Profil</h1>

      {/* COMMUN */}
      <div className="card">
        <p className="text-sm text-gray-500">Nom complet</p>
        <p className="font-medium">{profile.full_name}</p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500">Type de compte</p>
        <p className="font-medium">{profile.account_type}</p>
      </div>

      {/* AGENCY */}
      {profile.account_type === "AGENCY" && (
        <>
          <div className="card">
            <p className="text-sm text-gray-500">Nom de l’agence</p>
            <p className="font-medium">{profile.agency_name}</p>
          </div>

          <div className="card">
            <p className="text-sm text-gray-500">Agency ID</p>
            <p className="font-mono text-indigo-600">
              {profile.agency_id}
            </p>
          </div>
        </>
      )}

      {/* SOCIAL MANAGER */}
      {profile.account_type === "SOCIAL_MANAGER" && (
        <div className="card">
          <p className="text-sm text-gray-500">Agences liées</p>
          <p className="font-medium">Accès selon permissions</p>
        </div>
      )}
    </div>
  );
}
