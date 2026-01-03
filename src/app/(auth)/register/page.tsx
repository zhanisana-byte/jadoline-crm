"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [joinAgencyId, setJoinAgencyId] = useState(""); // ✅ nouveau (optionnel)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const siteUrl = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_SITE_URL;
    if (env && env.startsWith("http")) return env.replace(/\/$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "https://www.jadoline.com";
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      const cleanJoin = joinAgencyId.trim();

      const { error: signErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            join_agency_id: cleanJoin || null, // ✅ stocker pour callback
          },
          emailRedirectTo: `${siteUrl}/callback`,
        },
      });

      if (signErr) {
        const m = signErr.message.toLowerCase();
        if (m.includes("already registered") || m.includes("user already registered")) {
          setMsg("Un compte existe déjà avec cet email. Veuillez vous connecter.");
          return;
        }
        throw signErr;
      }

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setMsg("Compte créé ✅ Veuillez vérifier votre email pour confirmer votre compte.");
        return;
      }

      router.push("/profile");
    } catch (err: any) {
      setMsg(err?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-sm text-slate-500 mt-1">
          Un espace (agence perso) sera créé automatiquement après confirmation email.
        </p>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Nom complet</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : Sana Zhani"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Agency ID à rejoindre (optionnel)</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={joinAgencyId}
              onChange={(e) => setJoinAgencyId(e.target.value)}
              placeholder="UUID de l’agence (si tu as reçu un ID)"
            />
            <p className="text-xs text-slate-500 mt-1">
              Si tu le renseignes, tu rejoins automatiquement après confirmation email.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Mot de passe</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-slate-500 mt-1">8 caractères minimum recommandés.</p>
          </div>

          <button
            disabled={loading}
            className={cn(
              "w-full rounded-xl px-4 py-2 text-sm font-semibold",
              loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>

          <p className="text-sm text-slate-600">
            Déjà un compte ?{" "}
            <a className="underline" href="/login">
              Connexion
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
