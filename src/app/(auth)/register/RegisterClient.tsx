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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // validations
    if (!fullName.trim()) return setErrorMsg("Veuillez saisir votre nom complet.");
    if (!email.trim()) return setErrorMsg("Veuillez saisir votre email.");
    if (!password.trim()) return setErrorMsg("Veuillez saisir votre mot de passe.");
    if (type === "AGENCY" && !agencyName.trim())
      return setErrorMsg("Veuillez saisir le nom de l’agence.");

    setLoading(true);

    try {
      // 1) SIGN UP
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            account_type: type,
          },
        },
      });

      if (authError || !authData.user) throw authError || new Error("Signup failed");
      const userId = authData.user.id;

      // 2) PROFILE (UPSERT => pas de duplicate key)
      const { error: profileError } = await supabase
        .from("users_profile")
        .upsert(
          {
            user_id: userId,
            full_name: fullName.trim(),
            account_type: type,
            // ✅ ici on ne met PAS agency_id, car le join se fera depuis Profil
          },
          { onConflict: "user_id" }
        );

      if (profileError) console.error("PROFILE UPSERT FAILED", profileError);

      // 3) AGENCY FLOW (seulement si type = AGENCY)
      if (type === "AGENCY") {
        const { data: agency, error: agencyError } = await supabase
          .from("agencies")
          .insert({
            name: agencyName.trim(),
            owner_id: userId,
          })
          .select()
          .single();

        if (agencyError || !agency) {
          console.error("AGENCY CREATE FAILED", agencyError);
        } else {
          const { error: memberError } = await supabase.from("agency_members").insert({
            agency_id: agency.id,
            user_id: userId,
            role: "OWNER",
          });
          if (memberError) console.error("MEMBER INSERT FAILED", memberError);

          const { error: updError } = await supabase
            .from("users_profile")
            .upsert(
              {
                user_id: userId,
                agency_id: agency.id,
                agency_name: agency.name,
              },
              { onConflict: "user_id" }
            );

          if (updError) console.error("PROFILE UPDATE FAILED", updError);
        }
      }

      // ✅ 4) SOCIAL_MANAGER: on NE rejoint PAS l’agence ici
      // Le join par ID sera fait dans la page Profil (plus tard)

      setSuccessMsg("Compte créé. Redirection...");
      router.replace("/dashboard");
      return;
    } catch (err: any) {
      console.error("REGISTER ERROR ❌", err);

      const msg = String(err?.message || "");

      // email déjà utilisé
      if (
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("user already exists") ||
        msg.toLowerCase().includes("already been registered")
      ) {
        setErrorMsg("Cet email a déjà un compte. Veuillez vous connecter.");
        router.replace("/login");
        return;
      }

      // profile duplicate (tests)
      if (msg.toLowerCase().includes("duplicate key") || msg.toLowerCase().includes("pkey")) {
        router.replace("/dashboard");
        return;
      }

      setErrorMsg(msg || "Erreur lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-card-inner">
          <h1 className="auth-title">Créer un compte Jadoline</h1>
          <p className="auth-subtitle">CRM professionnel multi-agence</p>

          <div className="account-switch">
            <button
              type="button"
              className={type === "AGENCY" ? "active" : ""}
              onClick={() => setType("AGENCY")}
              disabled={loading}
            >
              Agence
            </button>
            <button
              type="button"
              className={type === "SOCIAL_MANAGER" ? "active" : ""}
              onClick={() => setType("SOCIAL_MANAGER")}
              disabled={loading}
            >
              Social Manager
            </button>
          </div>

          {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          <form className="auth-form" onSubmit={submit}>
            <div>
              <label>Nom complet</label>
              <input
                className="input"
                placeholder="Ex: Sana Zhani"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            {type === "AGENCY" && (
              <div>
                <label>Nom de l’agence</label>
                <input
                  className="input"
                  placeholder="Ex: Sana Com"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label>Email</label>
              <input
                className="input"
                type="email"
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label>Mot de passe</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          <div className="auth-footer">
            Déjà un compte ? <a href="/login">Connexion</a>
          </div>
        </div>
      </div>
    </div>
  );
}
