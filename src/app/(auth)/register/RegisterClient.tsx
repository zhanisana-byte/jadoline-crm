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

  // 🔹 RESET agencyId quand on change de type
  useEffect(() => {
    setAgencyId("");
  }, [type]);

  const submit = async () => {
    if (!fullName || !email || !password) return;

    if (type === "AGENCY" && !agencyName) return;

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          account_type: type,
          agency_name: type === "AGENCY" ? agencyName : null,
          join_agency_id:
            type === "SOCIAL_MANAGER" && agencyId ? agencyId : null,
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (!error) router.push("/check-email");
  };

  return (
    <div className="register-bg">
      <div className="register-card">

        {/* HEADER */}
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
            disabled={loading}
            className="register-btn"
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        {/* FOOTER */}
        <div className="register-footer">
          Déjà un compte ? <a href="/login">Connexion</a>
        </div>

      </div>
    </div>
  );
}
