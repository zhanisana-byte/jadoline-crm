"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallbackClient() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);
  const [status, setStatus] = useState("Finalisation du compte...");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const code = params.get("code");
      if (!code) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session?.user) {
        router.replace("/login");
        return;
      }

      const user = data.session.user;
      const meta = user.user_metadata;

      // 1️⃣ CREATE PROFILE
      const { data: profile } = await supabase
        .from("users_profile")
        .insert({
          user_id: user.id,
          full_name: meta.full_name,
          account_type: meta.account_type,
        })
        .select()
        .single();

      // 2️⃣ AGENCY FLOW
      if (meta.account_type === "AGENCY") {
        const { data: agency } = await supabase
          .from("agencies")
          .insert({
            name: meta.agency_name,
            owner_id: user.id,
          })
          .select()
          .single();

        await supabase
          .from("agency_members")
          .insert({
            agency_id: agency.id,
            user_id: user.id,
            role: "OWNER",
          });

        await supabase
          .from("users_profile")
          .update({
            agency_id: agency.id,
            agency_name: agency.name,
          })
          .eq("user_id", user.id);
      }

      // 3️⃣ SOCIAL MANAGER JOIN
      if (meta.account_type === "SOCIAL_MANAGER" && meta.join_agency_id) {
        await supabase
          .from("agency_members")
          .insert({
            agency_id: meta.join_agency_id,
            user_id: user.id,
            role: "SOCIAL_MANAGER",
          });
      }

      // 4️⃣ CLEAN METADATA
      await supabase.auth.updateUser({
        data: {},
      });

      router.replace("/dashboard");
    })();
  }, []);

  return <p className="p-8">{status}</p>;
}
