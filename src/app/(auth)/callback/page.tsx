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
    if (ran.current) return; // ✅ évite double exécution (React Strict Mode)
    ran.current = true;

    async function run() {
      const code = searchParams.get("code");

      if (!code) {
        router.replace("/login?error=missing_code");
        return;
      }

      setStatus("Validation de votre session…");

      // 1) Exchange auth code → session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace("/login?error=confirmation");
        return;
      }

      // 2) Join via clé (si elle existe)
      const joinCode = localStorage.getItem("join_code")?.trim() || "";

      if (joinCode) {
        setStatus("Connexion à votre espace…");

        const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
          p_code: joinCode,
        });

        // Nettoyer quoi qu'il arrive
        localStorage.removeItem("join_code");

        // Si invalide : on laisse connecté, mais on continue sans rejoindre
        if (joinErr || !res?.ok) {
          router.replace("/dashboard?join=invalid_code");
          return;
        }

        // res.type peut être "FITNESS" ou autre selon ton backend
        router.replace(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
        return;
      }

      // 3) Si pas de clé → créer agence par défaut (après confirmation email)
      setStatus("Création de votre espace…");

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        router.replace("/login?error=user_missing");
        return;
      }

      const fullName =
        (userRes.user.user_metadata as any)?.full_name ||
        (userRes.user.email?.split("@")[0] ?? "Nouveau compte");

      const defaultAgencyName = `Agence de ${fullName}`;

      // Si déjà créé (ex: user revient sur callback), ça ne doit pas bloquer
      await supabase.rpc("create_default_agency", { p_name: defaultAgencyName });

      router.replace("/dashboard");
    }

    run();
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
