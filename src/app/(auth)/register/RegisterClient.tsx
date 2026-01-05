"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

type AccountType = "AGENCY" | "SOCIAL_MANAGER";

export default function RegisterClient() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accountType, setAccountType] = useState<AccountType>("AGENCY");

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");

  // Social Manager: rattachement optionnel, affiché via bouton "Ajouter"
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState("");

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

  const joinKind = useMemo(() => {
    const v = joinInput.trim();
    if (!v) return "NONE";
    return isUuid(v) ? "AGENCY_ID" : "CODE_OR_KEY";
  }, [joinInput]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      const cleanAgencyName = agencyName.trim();
      const cleanJoin = joinInput.trim();

      if (!cleanName) {
        setMsg("Veuillez saisir votre nom complet.");
        return;
      }

      if (accountType === "AGENCY") {
        if (!cleanAgencyName) {
          setMsg("Veuillez saisir le nom de votre agence.");
          return;
        }
      }

      if (accountType === "SOCIAL_MANAGER") {
        // join optionnel, mais si ouvert et rempli: valide
        if (showJoin && cleanJoin && joinKind === "AGENCY_ID" && !isUuid(cleanJoin)) {
          setMsg("Agency ID invalide (format UUID).");
          return;
        }
      }

      const { error: signErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            account_type: accountType,

            // AGENCY: création agence
            agency_name: accountType === "AGENCY" ? cleanAgencyName : null,

            // SOCIAL_MANAGER: join optionnel (uniquement si showJoin et valeur)
            join_agency_id:
              accountType === "SOCIAL_MANAGER" && showJoin && cleanJoin && joinKind === "AGENCY_ID"
                ? cleanJoin
                : null,
            join_code:
              accountType === "SOCIAL_MANAGER" && showJoin && cleanJoin && joinKind === "CODE_OR_KEY"
                ? cleanJoin
                : null,
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                  Créer un compte Jadoline
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Choisissez votre profil, puis complétez vos informations.
                </p>
              </div>

              {/* Petit bouton discret vers login (optionnel). 
                 Si vous ne voulez aucun lien, supprimez ce bloc. */}
              <a
                href="/login"
                className="hidden sm:inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-slate-300"
              >
                Se connecter
              </a>
            </div>

            {/* Choix profil côte à côte */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAccountType("AGENCY");
                  setShowJoin(false);
                  setJoinInput("");
                }}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  accountType === "AGENCY"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="font-semibold text-base">Créer une agence</div>
                <div className={cn("mt-1 text-xs", accountType === "AGENCY" ? "text-slate-200" : "text-slate-500")}>
                  Pour gérer vos clients, membres et abonnements.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType("SOCIAL_MANAGER")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  accountType === "SOCIAL_MANAGER"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="font-semibold text-base">Créer votre Social Manager</div>
                <div
                  className={cn("mt-1 text-xs", accountType === "SOCIAL_MANAGER" ? "text-slate-200" : "text-slate-500")}
                >
                  Pour travailler sur les comptes des agences.
                </div>
              </button>
            </div>

            {msg && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {msg}
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-900">Nom complet</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex : Sana Zhani"
                  required
                />
              </div>

              {accountType === "AGENCY" ? (
                <div>
                  <label className="text-sm font-medium text-slate-900">Nom de l’agence</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Ex : Sana Com"
                    required
                  />
                </div>
              ) : (
                <div className="flex items-end">
                  {/* Bouton Ajouter demandé */}
                  <button
                    type="button"
                    onClick={() => setShowJoin((v) => !v)}
                    className={cn(
                      "w-full rounded-xl px-4 py-2 text-sm font-semibold transition border",
                      showJoin
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {showJoin ? "Retirer le rattachement" : "Ajouter une agence (optionnel)"}
                  </button>
                </div>
              )}
            </div>

            {/* Champ join uniquement si Social Manager + showJoin */}
            {accountType === "SOCIAL_MANAGER" && showJoin && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Rattachement à une agence</p>
                  <span className="text-xs text-slate-500">Agency ID / Code / Clé</span>
                </div>
                <input
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="Collez l’Agency ID (UUID) ou une clé d’invitation"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Vous pourrez aussi rejoindre une agence plus tard depuis votre profil.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-900">Email</label>
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
                <label className="text-sm font-medium text-slate-900">Mot de passe</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">8 caractères minimum recommandés.</p>
              </div>
            </div>

            <button
              disabled={loading}
              className={cn(
                "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
              )}
              type="submit"
            >
              {loading ? "Création..." : "Créer mon compte"}
            </button>

            <div className="text-xs text-slate-500">
              Après confirmation email, votre profil sera finalisé automatiquement.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
