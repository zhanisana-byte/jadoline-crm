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
        const { data: u } = await supabase.auth.getUser();
        const user = u.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        // ✅ auto-join si join_agency_id existe dans user_metadata
        const joinAgencyId = (user.user_metadata as any)?.join_agency_id as string | null;

        if (joinAgencyId) {
          setStatus("Rejoindre l’agence...");
          const { error: joinErr } = await supabase.rpc("join_with_agency_id", {
            p_agency_id: joinAgencyId,
          });

          // si erreur : on continue quand même vers profile
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
