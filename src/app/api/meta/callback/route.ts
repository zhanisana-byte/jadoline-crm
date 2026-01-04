import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // client_id encodé

  if (!code || !state) {
    return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  }

  const clientId = decodeURIComponent(state);

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json(
      {
        error: "missing env",
        META_APP_ID: !!appId,
        META_APP_SECRET: !!appSecret,
        META_REDIRECT_URI: !!redirectUri,
      },
      { status: 500 }
    );
  }

  // 1) échange code -> access_token
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "token_exchange_failed", details: tokenJson }, { status: 400 });
  }

  const accessToken = tokenJson.access_token as string;
  const expiresIn = tokenJson.expires_in as number | undefined;

  // 2) TODO: stocker en DB (par client)
  // Exemple : table meta_connections (client_id, access_token, expires_at, updated_at)
  const sb = sbAdmin();
  const expiresAt =
    expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  const { error } = await sb
    .from("meta_connections")
    .upsert(
      {
        client_id: clientId,
        access_token: accessToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

  if (error) {
    return NextResponse.json({ error: "db_save_failed", details: error }, { status: 500 });
  }

  // 3) retour vers le CRM (page client)
  return NextResponse.redirect(`https://jadoline.com/clients?meta=connected&client_id=${clientId}`);
}
