"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [agencyName, setAgencyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [joinCode, setJoinCode] = useState("");
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
      // 1) signup
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      // 2) session check (si email confirmation ON => pas de session)
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setMsg("Compte créé ✅ Vérifie ton email, puis reconnecte-toi.");
        return;
      }

      // 3) si clé => join_with_code
      if (hasCode) {
        const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
          p_code: joinCode.trim(),
        });
        if (joinErr || !res?.ok) {
          setMsg("Clé invalide ❌");
          return;
        }
        router.push(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
        return;
      }

      // 4) sinon renommer agence (OWNER)
      if (agencyName.trim()) {
        await supabase.rpc("rename_my_agency", { p_name: agencyName.trim() });
      }

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
            Rejoins une agence avec une clé, ou crée ton propre espace.
          </p>

          {msg && (
            <div className="alert alert-info">
              {msg}
            </div>
          )}

          <form className="auth-form" onSubmit={onSubmit}>
            {/* Clé optionnelle */}
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
                Si tu as une clé, tu seras automatiquement rattaché(e) au bon espace.
              </p>
            </div>

            {/* Nom d'agence seulement si pas de clé */}
            {!hasCode && (
              <div className="field">
                <label>Nom de l’agence</label>
                <input
                  className="input"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Ex: Sana Agency"
                />
              </div>
            )}

            <div className="divider">Infos</div>

            <div className="field">
              <label>Nom complet</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Sana Zhani"
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
              <p className="helper">8 caractères minimum recommandé.</p>
            </div>

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          <p className="footer-link">
            Déjà un compte ? <a href="/login">Connexion</a>
          </p>
        </div>
      </div>
    </div>
  );
}
