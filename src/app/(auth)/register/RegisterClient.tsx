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

  // reset agency id when switch
  useEffect(() => {
    setAgencyId("");
  }, [type]);

  const submit = async () => {
    if (!fullName || !email || !password) return;
    if (type === "AGENCY" && !agencyName) return;

    setLoading(true);

    // 1️⃣ SIGN UP (EMAIL CONFIRMATION OFF)
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

    // 2️⃣ CREATE PROFILE
    await supabase.from("users_profile").insert({
      user_id: userId,
      full_name: fullName,
      account_type: type,
    });

    // 3️⃣ AGENCY FLOW
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

    // 4️⃣ SOCIAL MANAGER FLOW
    if (type === "SOCIAL_MANAGER" && agencyId) {
      await supabase.from("agency_members").insert({
        agency_id: agencyId,
        user_id: userId,
        role: "SOCIAL_MANAGER",
      });
    }

    setLoading(false);

    // 5️⃣ REDIRECT DIRECT CRM
    router.replace("/dashboard");
  };

  return (
    <div className="register-bg">
      <div className="register-card">
        <h1 className="register-title">Créer un compte Jadoline</h1>
        <p className="register-subtitle">CRM professionnel multi-agence</p>

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
