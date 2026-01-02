"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      router.replace("/login?error=missing_code");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (error) {
        router.replace("/login?error=confirmation");
        return;
      }

      // ✅ après confirmation : si une clé existe (stockée au register), on rejoint l'agence
      const joinCode = localStorage.getItem("join_code")?.trim() || "";

      if (joinCode) {
        const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
          p_code: joinCode,
        });

        // on nettoie même si erreur
        localStorage.removeItem("join_code");

        // si la clé est invalide : on connecte quand même, mais sans rejoindre
        if (joinErr || !res?.ok) {
          router.replace("/dashboard?join=invalid_code");
          return;
        }

        router.replace(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
        return;
      }

      // Sinon : simple confirmation → dashboard
      router.replace("/dashboard");
    });
  }, [searchParams, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      Confirmation en cours…
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
