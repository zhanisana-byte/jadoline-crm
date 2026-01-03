"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [joinCode, setJoinCode] = useState(""); // optionnel
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasCode = joinCode.trim().length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const code = joinCode.trim();

      // ✅ Backup (optionnel) : utile si metadata échoue (rare)
      if (code) localStorage.setItem("join_code", code);
      else localStorage.removeItem("join_code");

      // ✅ SIGN UP — redirection email vers /callback
      // ✅ On stocke join_code dans user_metadata pour que /callback puisse le lire
      const { error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            join_code: code || null, // ✅ IMPORTANT
          },
          emailRedirectTo: "https://www.jadoline.com/callback",
        },
      });

      if (signErr) {
        if (
          signErr.message.includes("already registered") ||
          signErr.message.includes("User already registered")
        ) {
          setMsg(
            "Un compte existe déjà avec cet email. Veuillez vous connecter ou renvoyer l’email de confirmation."
          );
          return;
        }
        throw signErr;
      }

      // ✅ Si confirmation email activée → pas de session immédiate
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setMsg("Compte créé ✅ Veuillez vérifier votre email pour confirmer votre compte.");
        return;
      }

      // ✅ Si confirmation email OFF (rare), on peut rejoindre direct si code
      if (code) {
        const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
          p_code: code,
        });

        if (joinErr || !res?.ok) {
          setMsg("Clé invalide ❌");
          return;
        }

        // Nettoyage
        localStorage.removeItem("join_code");
        await supabase.auth.updateUser({ data: { join_code: null } });

        router.push(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
        return;
      }

      // ✅ IMPORTANT : on NE crée PAS d’agence ici.
      // Ton trigger SQL sur auth.users le fait automatiquement (agence + clé + membership).
      router.push("/dashboard");
    } catch (err: any) {
      setMsg(err?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="card auth-card-inner">
          <h1 className="auth-title">Créer un compte</h1>
          <p className="auth-subtitle">
            {hasCode
              ? "Vous rejoignez un espace existant à l’aide d’une clé."
              : "Vous créez votre propre espace (agence / freelance)."}
          </p>

          {msg && <div className="alert alert-info">{msg}</div>}

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="field">
              <label>Clé (optionnelle)</label>
              <input
                className="input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Clé agence ou clé Fitness"
                autoComplete="off"
              />
              <p className="helper">
                Si vous avez une clé, collez-la ici. Sinon, laissez vide pour créer votre espace.
              </p>
            </div>

            <div className="divider">Informations</div>

            <div className="field">
              <label>Nom complet</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex : Sana Zhani"
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label>Mot de passe</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <p className="helper">8 caractères minimum recommandés.</p>
            </div>

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Création..." : hasCode ? "Rejoindre avec la clé" : "Créer votre compte"}
            </button>
          </form>

          <p className="footer-link">
            Vous avez déjà un compte ? <a href="/login">Connexion</a>
          </p>
        </div>
      </div>
    </div>
  );
}
