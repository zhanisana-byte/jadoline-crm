"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "AGENCY" | "SOCIAL_MANAGER";

function pickRedirect(searchParams: ReturnType<typeof useSearchParams>) {
  const next = searchParams.get("next");
  if (next && next.startsWith("/")) return next;
  return "/profile";
}

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

        // 1) exchange code -> session
        setStatus("Validation de la session...");
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          router.replace("/login?error=confirmation");
          return;
        }

        // 2) get user
        setStatus("Préparation du profil...");
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr || !u?.user) {
          router.replace("/login?error=session");
          return;
        }

        const user = u.user;
        const md: any = user.user_metadata ?? {};

        const fullName = (md.full_name as string | undefined)?.trim() ?? "";
        const accountType = (md.account_type as AccountType | undefined) ?? "SOCIAL_MANAGER";
        const agencyName = (md.agency_name as string | undefined)?.trim() ?? "";
        const joinAgencyId = (md.join_agency_id as string | null) ?? null;

        // 3) upsert users_profile
        const role = accountType === "AGENCY" ? "OWNER" : "CM";

        const { error: upErr } = await supabase.from("users_profile").upsert(
          {
            user_id: user.id,
            full_name: fullName || null,
            role,
          },
          { onConflict: "user_id" }
        );

        if (upErr) {
          router.replace("/login?error=profile_create");
          return;
        }

        // 4) si AGENCY => créer agence + lier users_profile.agency_id
        if (accountType === "AGENCY") {
          setStatus("Création de votre agence...");

          const { data: ag, error: agErr } = await supabase
            .from("agencies")
            .insert({
              name: agencyName || "Mon agence",
              owner_id: user.id,
              join_code_active: true,
            })
            .select("id")
            .single();

          let agencyId: string | null = null;

          if (!agErr && ag?.id) {
            agencyId = ag.id;
          } else {
            const { data: ag2 } = await supabase
              .from("agencies")
              .select("id")
              .eq("owner_id", user.id)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();

            agencyId = ag2?.id ?? null;
          }

          if (agencyId) {
            await supabase.from("users_profile").update({ agency_id: agencyId }).eq("user_id", user.id);

            await supabase.from("agency_members").upsert(
              { agency_id: agencyId, user_id: user.id, role: "OWNER", status: "active" },
              { onConflict: "agency_id,user_id" as any }
            );
          }
        }

        // 5) join via join_agency_id si fourni
        if (joinAgencyId) {
          setStatus("Connexion à l’agence...");

          const { data: agCheck, error: agCheckErr } = await supabase
            .from("agencies")
            .select("id")
            .eq("id", joinAgencyId)
            .single();

          if (!agCheckErr && agCheck?.id) {
            await supabase.from("users_profile").update({ agency_id: joinAgencyId }).eq("user_id", user.id);

            await supabase.from("agency_members").upsert(
              { agency_id: joinAgencyId, user_id: user.id, role: "CM", status: "active" },
              { onConflict: "agency_id,user_id" as any }
            );

            await supabase.auth.updateUser({ data: { join_agency_id: null } });
          }
        }

        // 6) redirect
        setStatus("Redirection...");
        router.replace(pickRedirect(searchParams));
      } catch {
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

export default function CallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold">Confirmation</h1>
            <p className="text-sm text-slate-600 mt-2">Chargement…</p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
