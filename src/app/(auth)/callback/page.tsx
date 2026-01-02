"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      router.replace("/login?error=missing_code");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace("/login?error=confirmation");
      } else {
        router.replace("/login?confirmed=1");
      }
    });
  }, [searchParams, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      Confirmation en cours…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Chargement…
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
