import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    agency_id,
    name,
    phones,
    logo_url,
    created_by,
    show_in_profile,
    admin_user_id,
  } = body;

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
      phones: phones || [],
      logo_url: logo_url || null,
      created_by,
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
    client_role: admin_user_id === created_by ? "ADMIN" : "CM",
  });

  // 3) admin du client (si différent)
  if (admin_user_id && admin_user_id !== created_by) {
    await sb.from("member_client_access").insert({
      user_id: admin_user_id,
      client_id: clientId,
      agency_id,
      client_role: "ADMIN",
    });
  }

  // 4) visibilité profil
  await sb.from("client_profile_visibility").insert({
    user_id: created_by,
    client_id: clientId,
    show: show_in_profile !== false,
  });

  return NextResponse.json({ ok: true, client_id: clientId });
}
