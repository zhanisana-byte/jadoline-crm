"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "AGENCY" | "SOCIAL_MANAGER";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

export default function RegisterClient() {
  const supabase = createClient();
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>("AGENCY");

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState(""); // AGENCY uniquement
  const [joinAgencyId, setJoinAgencyId] = useState(""); // optionnel pour tous

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");

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
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const cleanAgencyName = agencyName.trim();
      const cleanJoinAgencyId = joinAgencyId.trim();

      if (!cleanName) throw new Error("Veuillez saisir votre nom complet.");
      if (!cleanEmail) throw new Error("Veuillez saisir votre email.");
      if (!password || password.length < 6)
        throw new Error("Mot de passe trop court (6 caractères minimum).");

      if (accountType === "AGENCY" && !cleanAgencyName) {
        throw new Error("Veuillez saisir le nom de votre agence.");
      }

      if (cleanJoinAgencyId && !isUuid(cleanJoinAgencyId)) {
        throw new Error("Agency ID invalide (format UUID).");
      }

      const { error: signErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            account_type: accountType, // ✅ TRÈS IMPORTANT
            agency_name: accountType === "AGENCY" ? cleanAgencyName : null,
            join_agency_id: cleanJoinAgencyId || null,
          },
          emailRedirectTo: `${siteUrl}/callback`,
        },
      });

      if (signErr) {
        const m = signErr.message.toLowerCase();
        if (m.includes("already registered") || m.includes("user already registered")) {
          setMsgType("error");
          setMsg("Un compte existe déjà avec cet email. Veuillez vous connecter.");
          setLoading(false);
          return;
        }
        throw signErr;
      }

      // Si confirmation email ON => pas de session immédiate
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setMsgType("success");
        setMsg("Compte créé ✅ Veuillez vérifier votre email pour confirmer votre compte.");
        setLoading(false);
        return;
      }

      // Si confirmation OFF
      router.push("/dashboard");
    } catch (err: any) {
      setMsgType("error");
      setMsg(err?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const hint =
    accountType === "AGENCY"
      ? "Créez votre agence. Vous pourrez ensuite inviter des Social Managers."
      : "Créez votre compte Social Manager. Vous pourrez rejoindre une agence maintenant (optionnel) ou plus tard.";

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-card-inner">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="auth-title">Créer un compte Jadoline</h1>
              <p className="auth-subtitle">{hint}</p>
            </div>
            <div className="pill">CRM • Multi-agence</div>
          </div>

          {msg && (
            <div
              className={cn(
                "alert",
                msgType === "success" ? "alert-success" : "alert-error"
              )}
            >
              {msg}
            </div>
          )}

          {/* Choix type */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setAccountType("AGENCY")}
              className={cn("selectCard", accountType === "AGENCY" && "selectCardActive")}
            >
              <div className="selectCardTop">
                <div className="selectTitle">Agence</div>
                <span className="selectTag">Propriétaire</span>
              </div>
              <div className="selectDesc">
                Créez votre agence, invitez votre équipe, gérez vos clients.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAccountType("SOCIAL_MANAGER")}
              className={cn(
                "selectCard",
                accountType === "SOCIAL_MANAGER" && "selectCardActive"
              )}
            >
              <div className="selectCardTop">
                <div className="selectTitle">Social Manager</div>
                <span className="selectTag">Membre</span>
              </div>
              <div className="selectDesc">
                Rejoignez une agence via un Agency ID (optionnel) ou plus tard.
              </div>
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Col gauche */}
            <div className="card p-5">
              <div className="card-title">Votre profil</div>
              <p className="muted mt-1">Vous pourrez modifier ces infos plus tard.</p>

              <div className="mt-4">
                <label>Nom complet</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex : Sana Zhani"
                  required
                />
              </div>

              {accountType === "AGENCY" ? (
                <div className="mt-4">
                  <label>Nom de l’agence</label>
                  <input
                    className="input"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Ex : Sana Com"
                    required
                  />
                </div>
              ) : null}

              <div className="mt-4">
                <label>Rejoindre une agence (optionnel)</label>
                <input
                  className="input"
                  value={joinAgencyId}
                  onChange={(e) => setJoinAgencyId(e.target.value)}
                  placeholder="Agency ID (UUID)"
                />
                <p className="muted mt-2">
                  Si vous le remplissez, votre compte tentera de rejoindre l’agence au moment du callback.
                </p>
              </div>
            </div>

            {/* Col droite */}
            <div className="card p-5">
              <div className="card-title">Informations de connexion</div>
              <p className="muted mt-1">Utilisez un email professionnel si possible.</p>

              <div className="mt-4">
                <label>Email</label>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="mt-4">
                <label>Mot de passe</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <p className="muted mt-2">8 caractères minimum recommandés.</p>
              </div>

              <button disabled={loading} className="btn btn-primary mt-5 w-full">
                {loading ? "Création..." : "Créer mon compte"}
              </button>

              <div className="mt-4 text-sm text-slate-600">
                Déjà un compte ?{" "}
                <a className="underline" href="/login">
                  Connexion
                </a>
              </div>

              <div className="tip-box mt-4">
                <div style={{ fontWeight: 800 }}>Après confirmation email</div>
                <div className="muted mt-1">
                  Votre profil sera finalisé automatiquement et vous serez redirigé(e) vers votre espace.
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Styles locaux uniquement pour les cartes type */}
      <style jsx>{`
        .pill{
          padding:10px 14px;
          border-radius:999px;
          font-weight:700;
          font-size:12px;
          background:rgba(2,6,23,.06);
          color:#0f172a;
          border:1px solid rgba(226,232,240,.9);
        }
        .selectCard{
          text-align:left;
          border-radius:18px;
          padding:16px;
          border:1px solid rgba(226,232,240,.9);
          background:rgba(255,255,255,.7);
          transition:all .18s ease;
        }
        .selectCard:hover{
          transform: translateY(-1px);
          border-color: rgba(99,102,241,.35);
        }
        .selectCardActive{
          background: linear-gradient(90deg, rgba(15,23,42,.92), rgba(15,23,42,.88));
          color:white;
          border-color: rgba(15,23,42,.6);
        }
        .selectCardTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:8px;
        }
        .selectTitle{
          font-size:16px;
          font-weight:800;
        }
        .selectTag{
          font-size:12px;
          font-weight:800;
          padding:6px 10px;
          border-radius:999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: inherit;
        }
        .selectDesc{
          font-size:13px;
          opacity: .9;
          line-height:1.35;
        }
      `}</style>
    </div>
  );
}
