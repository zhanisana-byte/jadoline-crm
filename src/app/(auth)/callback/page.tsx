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

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (userErr || !user) return router.replace("/login?error=user_missing");

        // ✅ lire l'agencyId depuis metadata (priorité)
        const metaAgencyId = (user.user_metadata?.join_agency_id || "").toString().trim();
        const lsAgencyId = (localStorage.getItem("join_agency_id") || "").trim();
        const joinAgencyId = metaAgencyId || lsAgencyId;

        if (joinAgencyId) {
          setStatus("Connexion à votre agence…");

          const { data: res, error: joinErr } = await supabase.rpc("join_with_agency_id", {
            p_agency_id: joinAgencyId,
          });

          if (!joinErr && res?.ok) {
            // nettoyage
            localStorage.removeItem("join_agency_id");
            await supabase.auth.updateUser({ data: { join_agency_id: null } });

            return router.replace("/dashboard");
          }

          // join failed => fallback dashboard
          setStatus("Agency ID invalide, ouverture de votre espace…");
        }

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
