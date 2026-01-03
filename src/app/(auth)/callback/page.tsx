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
        if (!code) return router.replace("/login?error=missing_code");

        setStatus("Validation de la session…");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return router.replace("/login?error=confirmation");

        // ✅ Important: garantir agence + clé après confirmation
        setStatus("Initialisation de votre espace…");
        try {
          await supabase.rpc("ensure_personal_agency");
        } catch {
          // pas bloquant si déjà OK
        }

        setStatus("Redirection…");
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
