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

    (async () => {
      try {
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

        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) {
          router.replace("/login?error=user_missing");
          return;
        }

        // join_code stocké avant signup (optionnel)
        const joinCode = (localStorage.getItem("join_code") || "").trim();
        localStorage.removeItem("join_code");

        // 1) Si on a un code → tenter de rejoindre une agence existante
        if (joinCode) {
          setStatus("Connexion à votre espace…");

          const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
            p_code: joinCode, // ⚠️ doit matcher le param SQL (p_code)
          });

          if (!joinErr && res?.ok) {
            router.replace(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
            return;
          }

          // code invalide → on continue quand même
          setStatus("Clé invalide, ouverture de votre espace…");
        }

        // 2) IMPORTANT : plus besoin de create_default_agency ici
        // car le TRIGGER SQL (handle_new_user) crée automatiquement:
        // - agence perso
        // - membre OWNER
        // - clé active

        router.replace("/dashboard");
      } catch {
        router.replace("/login?error=callback_failed");
      }
    })();
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
