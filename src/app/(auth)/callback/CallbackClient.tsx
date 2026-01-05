"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function pickRedirect(searchParams: ReturnType<typeof useSearchParams>) {
  const next = searchParams.get("next");
  if (next && next.startsWith("/")) return next;
  return "/profile";
}

export default function CallbackClient() {
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
        const error = searchParams.get("error");
        const errorDesc = searchParams.get("error_description");

        if (error || errorDesc) {
          router.replace(`/login?error=${encodeURIComponent(error ?? "confirmation")}`);
          return;
        }

        if (!code) {
          router.replace("/login?error=missing_code");
          return;
        }

        // 1️⃣ Échange code → session
        setStatus("Validation de la session...");
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          router.replace("/login?error=confirmation");
          return;
        }

        // 2️⃣ Récupération utilisateur
        setStatus("Préparation du profil...");
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr || !u?.user) {
          router.replace("/login?error=session");
          return;
        }

        const user = u.user;
        const md: any = user.user_metadata ?? {};

        const accountType = md.account_type; // "AGENCY" | "SOCIAL_MANAGER"
        const agencyName = md.agency_name ?? null;
        const joinAgencyId = md.join_agency_id ?? null;

        // ===============================
        // 🏢 CAS AGENCY → créer l’agence
        // ===============================
        if (accountType === "AGENCY" && agencyName) {
          setStatus("Création de votre agence...");

          await supabase.rpc("create_agency_for_owner", {
            p_agency_name: agencyName,
          });

          // nettoyage metadata
          await supabase.auth.updateUser({
            data: { agency_name: null },
          });
        }

        // =====================================
        // 👤 CAS SOCIAL MANAGER → join agence
        // =====================================
        if (accountType === "SOCIAL_MANAGER" && joinAgencyId) {
          setStatus("Rejoindre l’agence...");

          await supabase.rpc("join_with_agency_id", {
            p_agency_id: joinAgencyId,
          });

          // nettoyage metadata
          await supabase.auth.updateUser({
            data: { join_agency_id: null },
          });
        }

        // 3️⃣ Redirection finale
        setStatus("Redirection...");
        router.replace(pickRedirect(searchParams));
      } catch (e) {
        router.replace("/login?error=callback");
      }
    })();
  }, [router, searchParams, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-xl font-semibold">Confirmation</h1>
        <p className="text-sm text-slate-600 mt-2">{status}</p>
      </div>
    </div>
  );
}
