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

    async function run() {
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

      // ✅ user must exist now
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace("/login?error=user_missing");
        return;
      }

      const joinCode = localStorage.getItem("join_code")?.trim() || "";
      localStorage.removeItem("join_code");

      // 1) Si code → join
      if (joinCode) {
        setStatus("Connexion à votre espace…");

        const { data: res, error: joinErr } = await supabase.rpc("join_with_code", {
          p_code: joinCode,
        });

        if (!joinErr && res?.ok) {
          router.replace(res.type === "FITNESS" ? "/dashboard/gym" : "/dashboard");
          return;
        }

        // ✅ si code invalide → on continue quand même (créer espace)
        setStatus("Clé invalide, création de votre espace…");
      }

      // 2) Sinon (ou join failed) → créer agence par défaut
      const fullName =
        (user.user_metadata as any)?.full_name ||
        (user.email?.split("@")[0] ?? "Nouveau compte");

      const defaultAgencyName = `Agence de ${fullName}`;

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
