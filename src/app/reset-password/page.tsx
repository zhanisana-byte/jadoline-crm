"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  useEffect(() => {
    // Optionnel: vérifier qu’on a bien une session recovery
    (async () => {
      const { data } = await supabase.auth.getSession();
      // Si pas de session, on laisse la page ouverte quand même,
      // mais généralement le lien email crée une session recovery.
      if (!data.session) {
        setMsgType("error");
        setMsg("Lien invalide ou expiré. Veuillez refaire “Mot de passe oublié”.");
      }
    })();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsgType("error");
      setMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== password2) {
      setMsgType("error");
      setMsg("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMsgType("error");
      setMsg("Impossible de modifier le mot de passe. Veuillez réessayer.");
      return;
    }

    setMsgType("success");
    setMsg("Mot de passe modifié ✅ Redirection…");

    // Redirection vers login avec message
    router.replace("/login?reset=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Nouveau mot de passe</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choisissez un mot de passe sécurisé.
        </p>

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
            <label className="text-sm font-medium">Nouveau mot de passe</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Confirmer le mot de passe</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            disabled={loading}
            className={cn(
              "w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
              loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {loading ? "..." : "Modifier le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
