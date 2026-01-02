"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  const [status, setStatus] = useState("Confirmation en cours…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const code = searchParams.get("code");
      if (!code) {
        router.replace("/login?error=missing_code");
        return;
      }

      setStatus("Validation de la session…");

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace("/login?error=confirmation");
        return;
      }

      // ✅ user must exist now
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (userErr || !user) {
        router.replace("/login?error=user_missing");
        return;
      }

      // ✅ IMPORTANT: crée (si absent) l'agence perso + une clé active par défaut
      setStatus("Initialisation de votre espace personnel…");
      const { error: ensureErr } = await supabase.rpc("ensure_personal_agency");
      if (ensureErr) {
        router.replace("/login?error=init_space");
        return;
      }

      const joinCode = (localStorage.getItem("join_code") || "").trim();
      localStorage.removeItem("join_code");

      // 1) Si code → join une autre agence (sans empêcher l’espace perso)
      if (joinCode) {
        setStatus("Connexion à votre agence…");

        const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
          p_code: joinCode,
        });

        if (!joinErr && res?.ok) {
          router.replace(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
          return;
        }

        // si clé invalide, on continue quand même → il gardera son espace perso + clé
        setStatus("Clé invalide, redirection vers votre espace…");
        router.replace("/dashboard");
        return;
      }

      // 2) Sans code → redirection (l'espace perso + clé existent déjà)
      router.replace("/dashboard");
    }

    run();
  }, [router, searchParams, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      {status}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
          Chargement…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
