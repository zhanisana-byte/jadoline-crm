"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  const [status, setStatus] = useState("Confirmation en cours...");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        // ✅ Supabase peut renvoyer des erreurs dans l'URL
        const oauthError = searchParams.get("error");
        const oauthErrorDesc = searchParams.get("error_description");
        if (oauthError || oauthErrorDesc) {
          router.replace(`/login?error=${encodeURIComponent(oauthError ?? "confirmation")}`);
          return;
        }

        const code = searchParams.get("code");
        if (!code) {
          router.replace("/login?error=missing_code");
          return;
        }

        setStatus("Validation de la session...");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace("/login?error=confirmation");
          return;
        }

        // ✅ maintenant on a une session
        setStatus("Préparation du profil...");
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr || !u?.user) {
          router.replace("/login?error=session");
          return;
        }

        const user = u.user;

        // ✅ auto-join si join_agency_id existe dans user_metadata
        const joinAgencyId =
          ((user.user_metadata as any)?.join_agency_id as string | null) ?? null;

        if (joinAgencyId) {
          setStatus("Rejoindre l’agence...");

          const { error: joinErr } = await supabase.rpc("join_with_agency_id", {
            p_agency_id: joinAgencyId,
          });

          // ✅ même si join échoue, on n'empêche pas l'accès au profil
          if (!joinErr) {
            // ✅ on nettoie le metadata pour éviter rejoin à chaque login
            await supabase.auth.updateUser({
              data: { join_agency_id: null },
            });
          }
        }

        setStatus("Redirection...");
        router.replace("/profile");
      } catch {
        router.replace("/login?error=callback");
      }
    })();
  }, [router, searchParams, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-xl font-semibold">Callback</h1>
        <p className="text-sm text-slate-600 mt-2">{status}</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold">Callback</h1>
            <p className="text-sm text-slate-600 mt-2">Chargement...</p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
