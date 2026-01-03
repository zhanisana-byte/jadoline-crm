"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const supabase = createClient();
  const router = useRouter();
  const sp = useSearchParams();

  const ran = useRef(false);
  const [status, setStatus] = useState("Confirmation en cours…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const code = sp.get("code");
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

        // ✅ user
        const { data: u } = await supabase.auth.getUser();
        const user = u?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        // ✅ 1) créer/assurer l’agence perso + users_profile.agency_id
        setStatus("Initialisation de votre espace…");
        await supabase.rpc("ensure_personal_agency_for_user", { p_user: user.id });

        // ✅ 2) auto-join si join_agency_id (enregistré dans metadata)
        const joinId = (user.user_metadata?.join_agency_id as string | null) ?? null;
        if (joinId) {
          setStatus("Connexion à l’agence reçue…");
          await supabase.rpc("join_with_agency_id", { p_agency_id: joinId });
        }

        setStatus("OK ✅ Redirection…");
        router.replace("/profile");
      } catch {
        router.replace("/login?error=callback");
      }
    })();
  }, [router, sp, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Connexion…</h1>
        <p className="mt-2 text-sm text-slate-600">{status}</p>
      </div>
    </div>
  );
}
