"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "AGENCY" | "SOCIAL_MANAGER";

export default function RegisterClient() {
  const supabase = createClient();
  const router = useRouter();

  const [type, setType] = useState<AccountType>("AGENCY");
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // reset Agency ID when switching type
  useEffect(() => {
    setAgencyId("");
  }, [type]);

  const submit = async () => {
    if (!fullName || !email || !password) return;
    if (type === "AGENCY" && !agencyName) return;

    setLoading(true);

    // SIGN UP (email confirmation OFF)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          account_type: type,
        },
      },
    });

    if (error || !data.user) {
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    // CREATE PROFILE
    await supabase.from("users_profile").insert({
      user_id: userId,
      full_name: fullName,
      account_type: type,
    });

    // AGENCY
    if (type === "AGENCY") {
      const { data: agency } = await supabase
        .from("agencies")
        .insert({
          name: agencyName,
          owner_id: userId,
        })
        .select()
        .single();

      await supabase.from("agency_members").insert({
        agency_id: agency.id,
        user_id: userId,
        role: "OWNER",
      });

      await supabase
        .from("users_profile")
        .update({
          agency_id: agency.id,
          agency_name: agency.name,
        })
        .eq("user_id", userId);
    }

    // SOCIAL MANAGER
    if (type === "SOCIAL_MANAGER" && agencyId) {
      await supabase.from("agency_members").insert({
        agency_id: agencyId,
        user_id: userId,
        role: "SOCIAL_MANAGER",
      });
    }

    setLoading(false);
    router.replace("/dashboard"); // ✅ DIRECT CRM
  };

  return (
    <div className="register-bg">
      <div className="register-card">

        <h1 className="register-title">Créer un compte Jadoline</h1>
        <p className="register-subtitle">CRM professionnel multi-agence</p>

        {/* SWITCH */}
        <div className="account-switch">
          <button
            type="button"
            className={type === "AGENCY" ? "active" : ""}
            onClick={() => setType("AGENCY")}
          >
            Agence
          </button>
          <button
            type="button"
            className={type === "SOCIAL_MANAGER" ? "active" : ""}
            onClick={() => setType("SOCIAL_MANAGER")}
          >
            Social Manager
          </button>
        </div>

        {/* FORM */}
        <form
          className="register-form"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="input"
            placeholder="Nom complet"
            autoComplete="off"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          {type === "AGENCY" && (
            <input
              className="input"
              placeholder="Nom de l’agence"
              autoComplete="off"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
          )}

          {type === "SOCIAL_MANAGER" && (
            <input
              className="input"
              placeholder="Agency ID (optionnel)"
              autoComplete="off"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
            />
          )}

          <input
            className="input"
            type="email"
            placeholder="Email professionnel"
            autoComplete="new-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="register-btn"
            disabled={loading}
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <div className="register-footer">
          Déjà un compte ? <a href="/login">Connexion</a>
        </div>
      </div>
    </div>
  );
}
