import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function adminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agency_id, name, phones, logo_url, created_by, show_in_profile, rules_text } = body;

    if (!agency_id || !name || !created_by) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const sb = adminSupabase();

    // 1) créer client
    const { data: client, error } = await sb
      .from("clients")
      .insert({
        agency_id,
        name,
        phones: Array.isArray(phones) ? phones : [],
        logo_url: logo_url || null,
        created_by,
        // ✅ On stocke les règles dans brief_avoid (MVP)
        brief_avoid: rules_text || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const clientId = client.id;

    // 2) accès créateur
    await sb.from("member_client_access").insert({
      user_id: created_by,
      client_id: clientId,
      agency_id,
      client_role: "ADMIN",
    });

    // 3) visibilité profil (si table existe)
    await sb.from("client_profile_visibility").insert({
      user_id: created_by,
      client_id: clientId,
      show: show_in_profile !== false,
    });

    return NextResponse.json({ ok: true, client_id: clientId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
