import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Cas où Meta renvoie une erreur
  const error = url.searchParams.get("error");
  const errorMessage = url.searchParams.get("error_message");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/clients?meta=error`
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  }

  let decoded: any = null;
  try {
    decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  const client_id = decoded?.client_id;
  if (!client_id) return NextResponse.json({ error: "missing client_id in state" }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`;

  // 1) Exchange code -> access_token (user token)
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.json({ error: "token_exchange_failed", details: tokenJson }, { status: 400 });
  }

  const user_access_token = tokenJson.access_token as string;

  // 2) TODO (plus tard): appeler /me/accounts pour récupérer pages, puis ig business
  // Pour MVP: on sauvegarde juste le user token + client_id
  const admin = createAdminClient();

  // On récupère agency_id via le client (si tu l’as dans table clients)
  const { data: clientRow, error: cErr } = await admin
    .from("clients")
    .select("id, agency_id")
    .eq("id", client_id)
    .single();

  if (cErr || !clientRow?.agency_id) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  const agency_id = clientRow.agency_id as string;

  const { error: upErr } = await admin.from("meta_connections").upsert(
    {
      agency_id,
      client_id,
      user_access_token,
      token_type: tokenJson.token_type ?? null,
      expires_in: tokenJson.expires_in ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );

  if (upErr) {
    return NextResponse.json({ error: "db_save_failed", details: upErr }, { status: 500 });
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/clients?meta=connected&client_id=${client_id}`);
}
