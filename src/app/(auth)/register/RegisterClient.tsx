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

  // Social Manager: optionnel (UUID ou code/clé)
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
      } else {
        // Social Manager: join optionnel, mais si rempli on valide UUID ou code
        if (cleanJoin && joinKind === "AGENCY_ID" && !isUuid(cleanJoin)) {
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

            // SOCIAL_MANAGER: join optionnel
            join_agency_id:
              accountType === "SOCIAL_MANAGER" && cleanJoin && joinKind === "AGENCY_ID"
                ? cleanJoin
                : null,
            join_code:
              accountType === "SOCIAL_MANAGER" && cleanJoin && joinKind === "CODE_OR_KEY"
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

      // Si confirmation email ON => pas de session immédiate
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
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                  Créer un compte Jadoline
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Agence : créez votre agence. Social Manager : rejoignez une agence (optionnel) ou plus tard.
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="rounded-full bg-slate-900 text-white text-xs px-3 py-2">
                  CRM • Multi-agence
                </div>
              </div>
            </div>

            {msg && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {msg}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Profil */}
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-900">Votre profil</p>
                <p className="text-xs text-slate-500 mt-1">
                  Choisissez le type de compte. Vous pourrez évoluer plus tard.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3">
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
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Agence</div>
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          accountType === "AGENCY" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        Propriétaire
                      </span>
                    </div>
                    <div className={cn("mt-1 text-xs", accountType === "AGENCY" ? "text-slate-200" : "text-slate-500")}>
                      Créez votre agence, invitez vos membres, gérez vos clients.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType("SOCIAL_MANAGER")}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      accountType === "SOCIAL_MANAGER"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Social Manager</div>
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          accountType === "SOCIAL_MANAGER" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        Membre
                      </span>
                    </div>
                    <div
                      className={cn("mt-1 text-xs", accountType === "SOCIAL_MANAGER" ? "text-slate-200" : "text-slate-500")}
                    >
                      Rejoignez une agence avec un ID ou une clé, ou faites-le plus tard.
                    </div>
                  </button>
                </div>

                {/* Nom complet */}
                <div className="mt-5">
                  <label className="text-sm font-medium text-slate-900">Nom complet</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex : Sana Zhani"
                    required
                  />
                </div>

                {/* Nom agence */}
                {accountType === "AGENCY" && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-900">Nom de l’agence</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="Ex : Sana Com"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Votre agence sera créée après confirmation de votre email.
                    </p>
                  </div>
                )}

                {/* Join (Social Manager uniquement) */}
                {accountType === "SOCIAL_MANAGER" && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Rejoindre une agence (optionnel)</p>
                      <span className="text-xs text-slate-500">ID ou Code/Clé</span>
                    </div>
                    <input
                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      placeholder="Collez l’Agency ID (UUID) ou une clé d’invitation"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Si vous ne mettez rien, vous pourrez rejoindre une agence plus tard depuis votre profil.
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Connexion */}
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-900">Informations de connexion</p>
                <p className="text-xs text-slate-500 mt-1">
                  Utilisez un email professionnel si possible.
                </p>

                <div className="mt-5">
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

                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-900">Mot de passe</label>
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

                <form onSubmit={onSubmit} className="mt-6">
                  <button
                    disabled={loading}
                    className={cn(
                      "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                      loading
                        ? "bg-slate-200 text-slate-500"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                    type="submit"
                  >
                    {loading ? "Création..." : "Créer mon compte"}
                  </button>
                </form>

                <div className="mt-4 text-sm text-slate-600">
                  Déjà un compte ?{" "}
                  <a className="underline" href="/login">
                    Connexion
                  </a>
                </div>

                <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs text-slate-600">
                    Après confirmation email, vous serez redirigé(e) vers votre espace et votre profil sera finalisé
                    automatiquement.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-slate-100 bg-white">
            <p className="text-xs text-slate-500">
              En créant un compte, vous acceptez les conditions d’utilisation de Jadoline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
