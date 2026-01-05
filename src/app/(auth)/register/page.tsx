"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

type AccountType = "AGENCY" | "CM";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accountType, setAccountType] = useState<AccountType>("AGENCY");
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState(""); // فقط للـ AGENCY
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

  const next = useMemo(() => {
    const n = searchParams?.get("next");
    if (n && n.startsWith("/")) return n;
    return "/profile";
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      const cleanAgencyName = agencyName.trim();

      if (!cleanName) {
        setMsg("Veuillez saisir votre nom complet.");
        return;
      }

      if (accountType === "AGENCY" && !cleanAgencyName) {
        setMsg("Veuillez saisir le nom de votre agence.");
        return;
      }

      const { error: signErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            account_type: accountType,
            agency_name: accountType === "AGENCY" ? cleanAgencyName : null,
            // ✅ CM لا يحتاج join هنا
            join_agency_id: null,
            join_code: null,
          },
          emailRedirectTo: `${siteUrl}/callback?next=${encodeURIComponent(next)}`,
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

      router.push(next);
    } catch (err: any) {
      setMsg(err?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-sm text-slate-500 mt-1">
          Agence: crée votre agence. CM: crée un compte puis rejoignez une agence plus tard.
        </p>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm font-medium text-slate-900">Type de compte</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType("AGENCY")}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                accountType === "AGENCY"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <div className="font-semibold">Agence</div>
              <div className={cn("mt-1 text-xs", accountType === "AGENCY" ? "text-slate-200" : "text-slate-500")}>
                Créez et gérez vos clients.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAccountType("CM")}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                accountType === "CM"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <div className="font-semibold">CM</div>
              <div className={cn("mt-1 text-xs", accountType === "CM" ? "text-slate-200" : "text-slate-500")}>
                Créez un compte. Rejoignez une agence بعد.
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Nom complet</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Ex : Sana Zhani"
            />
          </div>

          {accountType === "AGENCY" && (
            <div>
              <label className="text-sm font-medium">Nom de l’agence</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                required
                placeholder="Ex : Sana Com"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="email@exemple.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Mot de passe</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
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
