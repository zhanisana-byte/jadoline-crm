"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const siteUrl = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_SITE_URL;
    if (env && env.startsWith("http")) return env.replace(/\/$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "https://www.jadoline.com";
  }, []);

  useEffect(() => {
    if (params.get("confirmed") === "1") {
      setMsgType("success");
      setMsg("Votre compte a été confirmé avec succès ✅ Vous pouvez vous connecter.");
    }

    if (params.get("reset") === "1") {
      setMsgType("success");
      setMsg("Votre mot de passe a été modifié ✅ Vous pouvez vous connecter.");
    }

    if (params.get("error")) {
      setMsgType("error");
      setMsg("Une erreur est survenue ❌ Veuillez réessayer.");
    }
  }, [params]);

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
      setMsg("Email ou mot de passe incorrect.");
      return;
    }

    router.push("/dashboard");
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMsgType("error");
      setMsg("Veuillez saisir votre email pour recevoir le lien.");
      setForgotLoading(false);
      return;
    }

    // ⚠️ Redirection vers la page /reset-password (voir code plus bas)
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    setForgotLoading(false);

    if (error) {
      setMsgType("error");
      setMsg("Impossible d’envoyer l’email. Vérifiez l’adresse et réessayez.");
      return;
    }

    setMsgType("success");
    setMsg("Email envoyé ✅ Vérifiez votre boîte mail pour réinitialiser votre mot de passe.");
    setShowForgot(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
            <p className="text-sm text-slate-500 mt-1">Jadoline CRM</p>
          </div>
          <div className="text-xs rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            Accès
          </div>
        </div>

        {msg && (
          <div
            className={cn(
              "mt-4 text-sm border rounded-2xl px-3 py-2",
              msgType === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            )}
          >
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="email@exemple.com"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Mot de passe</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            className={cn(
              "w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
              loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
            )}
            disabled={loading}
          >
            {loading ? "..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-slate-700 underline"
            onClick={() => setShowForgot((v) => !v)}
          >
            Mot de passe oublié ?
          </button>

          <Link className="text-slate-700 underline" href="/register">
            Créer un compte
          </Link>
        </div>

        {showForgot && (
          <form
            onSubmit={onForgot}
            className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-sm font-semibold text-slate-900">
              Réinitialisation du mot de passe
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Nous vous enverrons un lien sécurisé par email.
            </p>

            <div className="mt-3">
              <label className="text-sm font-medium">Email</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className={cn(
                "mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
                forgotLoading
                  ? "bg-slate-200 text-slate-500"
                  : "bg-white border border-slate-200 hover:border-slate-300"
              )}
            >
              {forgotLoading ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Chargement…</div>}>
      <LoginInner />
    </Suspense>
  );
}
