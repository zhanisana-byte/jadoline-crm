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

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          router.replace("/login?error=user_missing");
          return;
        }

        const user = userRes.user;
        const joinCode = (user.user_metadata?.join_code || "").toString().trim();

        // ✅ Si joinCode existe → tenter join_with_code (AGENCY ou FITNESS)
        if (joinCode) {
          setStatus("Connexion à votre espace…");

          const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
            p_code: joinCode,
          });

          if (!joinErr && res?.ok) {
            router.replace(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
            return;
          }

          // clé invalide → on continue (l’agence perso existe via trigger)
          setStatus("Clé invalide, ouverture de votre espace…");
        }

        // ✅ Sans clé : l’agence perso + clé perso sont créées par trigger SQL
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

export default function CallbackPage() {
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
