"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function InviteInner() {
  const supabase = createClient();
  const router = useRouter();
  const sp = useSearchParams();
  const ran = useRef(false);

  const [status, setStatus] = useState("Vérification de l’invitation...");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const token = sp.get("token");
        if (!token) {
          setStatus("Lien invalide (token manquant).");
          return;
        }

        setStatus("Connexion / validation...");
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) {
          // pas connecté → login puis retour
          router.replace(`/login?next=/invite?token=${encodeURIComponent(token)}`);
          return;
        }

        setStatus("Acceptation de l’invitation...");
        const { error } = await supabase.rpc("accept_agency_invite", { p_token: token });
        if (error) {
          setStatus(`Invitation invalide ou expirée. (${error.message})`);
          return;
        }

        setStatus("✅ Invitation acceptée. Redirection...");
        router.replace("/profile");
      } catch {
        setStatus("Erreur lors de l’acceptation de l’invitation.");
      }
    })();
  }, [router, sp, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-xl font-semibold">Invitation</h1>
        <p className="text-sm text-slate-600 mt-2">{status}</p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Chargement…</div>}>
      <InviteInner />
    </Suspense>
  );
}
