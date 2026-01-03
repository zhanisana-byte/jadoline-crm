// src/app/(auth)/callback/CallbackClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      const code = searchParams.get("code");
      const errorDesc = searchParams.get("error_description");
      const error = searchParams.get("error");

      if (error || errorDesc) {
        router.replace(`/login?error=${encodeURIComponent(error ?? "confirmation")}`);
        return;
      }

      if (!code) {
        router.replace("/login?error=missing_code");
        return;
      }

      setStatus("Validation de la session...");
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);

      if (exErr) {
        router.replace("/login?error=confirmation");
        return;
      }

      // ✅ session OK
      setStatus("Redirection...");
      router.replace("/profile"); // ou /dashboard si tu veux
    })();
  }, [searchParams, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-xl font-semibold">Confirmation</h1>
        <p className="text-sm text-slate-600 mt-2">{status}</p>
      </div>
    </div>
  );
}
