"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "OWNER" | "CM" | "FITNESS";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  agency_id: string | null;
  created_at: string;
};

type AgencyRow = {
  id: string;
  name: string | null;
};

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [agency, setAgency] = useState<AgencyRow | null>(null);

  const [fullName, setFullName] = useState("");
  const [editName, setEditName] = useState(false);

  const [agencyName, setAgencyName] = useState("");
  const [editAgency, setEditAgency] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        setMessage("Utilisateur non authentifié.");
        setLoading(false);
        return;
      }

      const user = authData.user;
      setEmail(user.email ?? "");
      setEmailConfirmed(!!(user.email_confirmed_at || (user as any).confirmed_at));

      const { data: profileData, error } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, agency_id, created_at")
        .eq("user_id", user.id)
        .single();

      if (error || !profileData) {
        setMessage("Profil introuvable.");
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setFullName(profileData.full_name ?? "");

      if (profileData.agency_id) {
        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id, name")
          .eq("id", profileData.agency_id)
          .single();

        if (agencyData) {
          setAgency(agencyData);
          setAgencyName(agencyData.name ?? "");
        }
      }

      setLoading(false);
    };

    loadProfile();
  }, [supabase]);

  const isOwner = profile?.role === "OWNER";

  const saveName = async () => {
    if (!profile) return;
    setBusy(true);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: fullName })
      .eq("user_id", profile.user_id);

    if (error) {
      setMessage("Erreur lors de la mise à jour.");
    } else {
      setMessage("Vos informations ont été mises à jour avec succès.");
      setEditName(false);
    }
    setBusy(false);
  };

  const saveAgencyName = async () => {
    if (!isOwner) return;
    setBusy(true);

    const { error } = await supabase.rpc("rename_my_agency", {
      p_name: agencyName,
    });

    if (error) {
      setMessage("Impossible de modifier le nom de l’agence.");
    } else {
      setMessage("Nom de l’agence mis à jour.");
      setEditAgency(false);
    }
    setBusy(false);
  };

  const changePassword = async () => {
    const newPwd = prompt("Nouveau mot de passe (min. 8 caractères)");
    if (!newPwd || newPwd.length < 8) {
      setMessage("Mot de passe trop court.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) setMessage("Erreur lors du changement du mot de passe.");
    else setMessage("Mot de passe modifié avec succès.");
  };

  const resendEmail = async () => {
    await supabase.auth.resend({
      type: "signup",
      email,
    });
    setMessage("Email de confirmation renvoyé.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return <div className="p-10">Chargement du profil…</div>;
  }

  if (!profile) {
    return <div className="p-10">{message}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Profil</h1>

      {message && <div className="p-3 border rounded">{message}</div>}

      {/* INFOS PERSONNELLES */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Informations personnelles</h2>

        <input
          className="w-full border p-2 rounded"
          value={fullName}
          disabled={!editName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input className="w-full border p-2 rounded bg-gray-100" value={email} disabled />

        <div className="flex gap-2">
          {!editName ? (
            <button onClick={() => setEditName(true)} className="border px-3 py-1 rounded">
              Modifier
            </button>
          ) : (
            <>
              <button onClick={saveName} className="bg-black text-white px-3 py-1 rounded">
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setEditName(false);
                  setFullName(profile.full_name ?? "");
                }}
                className="border px-3 py-1 rounded"
              >
                Annuler
              </button>
            </>
          )}
        </div>
      </section>

      {/* AGENCE */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Agence</h2>

        <input
          className="w-full border p-2 rounded"
          value={agencyName}
          disabled={!isOwner || !editAgency}
          onChange={(e) => setAgencyName(e.target.value)}
        />

        {isOwner && (
          <div className="flex gap-2">
            {!editAgency ? (
              <button onClick={() => setEditAgency(true)} className="border px-3 py-1 rounded">
                Modifier
              </button>
            ) : (
              <>
                <button onClick={saveAgencyName} className="bg-black text-white px-3 py-1 rounded">
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setEditAgency(false);
                    setAgencyName(agency?.name ?? "");
                  }}
                  className="border px-3 py-1 rounded"
                >
                  Annuler
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* SÉCURITÉ */}
      <section className="border rounded p-4 space-y-2">
        <h2 className="font-semibold">Sécurité</h2>

        <button onClick={changePassword} className="border px-3 py-1 rounded">
          Modifier mot de passe
        </button>

        <button onClick={logout} className="border px-3 py-1 rounded">
          Déconnexion
        </button>
      </section>

      {/* STATUT EMAIL */}
      {!emailConfirmed && (
        <section className="border rounded p-4">
          <p>Email non confirmé.</p>
          <button onClick={resendEmail} className="mt-2 border px-3 py-1 rounded">
            Renvoyer l’email de confirmation
          </button>
        </section>
      )}
    </div>
  );
}
