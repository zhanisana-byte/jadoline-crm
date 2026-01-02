"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Confirmation en cours…");

  useEffect(() => {
    async function run() {
      const code = params.get("code");

      // Cas 1: pas de code dans l'URL
      if (!code) {
        router.replace("/login?error=missing_code");
        return;
      }

      // Cas 2: échange du code contre une session
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace("/login?error=confirmation");
        return;
      }

      // ✅ Confirmation OK
      router.replace("/login?confirmed=1");
    }

    run();
  }, [params, router, supabase]);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="card auth-card-inner">
          <h1 className="auth-title">{msg}</h1>
          <p className="auth-subtitle">Veuillez patienter.</p>
        </div>
      </div>
    </div>
  );
}
