"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [agencyName, setAgencyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [joinCode, setJoinCode] = useState(""); // ✅ nouveau
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
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: "60px auto" }}>
        <h1 style={{ marginTop: 0 }}>Créer un compte</h1>

        {msg && <p className="muted">{msg}</p>}

        <form onSubmit={onSubmit}>
          {/* ✅ Clé optionnelle */}
          <label>Clé (optionnelle)</label>
          <input
            className="input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Clé agence ou clé Fitness"
          />

          {/* Nom d'agence seulement si pas de clé */}
          {!hasCode && (
            <>
              <label style={{ marginTop: 12 }}>Nom de l’agence</label>
              <input
                className="input"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex: Sana Agency"
              />
            </>
          )}

          <label style={{ marginTop: 12 }}>Nom complet</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />

          <label style={{ marginTop: 12 }}>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label style={{ marginTop: 12 }}>Mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button className="btn" style={{ marginTop: 16 }} disabled={loading}>
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <p style={{ marginTop: 10 }}>
          Déjà un compte ? <a href="/login">Connexion</a>
        </p>
      </div>
    </div>
  );
}
