"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(false);

  // 🔔 Lire les paramètres URL (?confirmed=1, ?error=...)
  useEffect(() => {
    if (params.get("confirmed") === "1") {
      setMsgType("success");
      setMsg(
        "Votre compte a été confirmé avec succès ✅ Vous pouvez maintenant vous connecter."
      );
    }

    if (params.get("error") === "confirmation") {
      setMsgType("error");
      setMsg("Le lien de confirmation est invalide ou expiré ❌");
    }

    if (params.get("error") === "missing_code") {
      setMsgType("error");
      setMsg("Lien de confirmation incomplet ❌");
    }
  }, [params]);

  // 🔐 Connexion
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsgType("error");
      setMsg(error.message);
      return;
    }

    router.push("/dashboard");
  }

  // 📧 Renvoyer email de confirmation
  async function resendConfirmation() {
    if (!email.trim()) {
      setMsgType("error");
      setMsg("Veuillez saisir votre email pour renvoyer la confirmation.");
      return;
    }

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: "https://www.jadoline.com/auth/callback",
      },
    });

    setLoading(false);

    if (error) {
      setMsgType("error");
      setMsg(error.message);
      return;
    }

    setMsgType("success");
    setMsg(
      "Un nouvel email de confirmation a été envoyé ✅ Veuillez vérifier votre boîte mail."
    );
  }

  const msgClass =
    msgType === "success"
      ? "text-green-700 bg-green-50 border-green-200"
      : msgType === "error"
      ? "text-red-700 bg-red-50 border-red-200"
      : "text-slate-700 bg-slate-50 border-slate-200";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <p className="text-sm text-slate-500 mt-1">Jadoline CRM</p>

        <div className="mt-4">
          <label className="text-sm">Email</label>
          <input
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            autoComplete="email"
          />
        </div>

        <div className="mt-3">
          <label className="text-sm">Mot de passe</label>
          <input
            type="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {msg && (
          <div
            className={`mt-4 text-sm border rounded-xl px-3 py-2 ${msgClass}`}
          >
            {msg}
          </div>
        )}

        <button className="btn-primary mt-5 w-full" disabled={loading}>
          {loading ? "..." : "Se connecter"}
        </button>

        {/* 🔁 Renvoyer confirmation */}
        <button
          type="button"
          className="btn-ghost mt-3 w-full"
          onClick={resendConfirmation}
          disabled={loading}
        >
          Renvoyer l’email de confirmation
        </button>

        <div className="mt-4 text-sm">
          <Link href="/register">Créer un compte</Link>
        </div>
      </form>
    </div>
  );
}
