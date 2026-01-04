import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

function verifyState(state: string, secret: string) {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  if (expected !== sig) return null;

  const payload = safeJson(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  return payload;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;
  const stateSecret = process.env.META_STATE_SECRET!;

  if (!appId || !appSecret || !redirectUri || !stateSecret) {
    return NextResponse.json({ error: "missing env" }, { status: 500 });
  }

  const payload = verifyState(state, stateSecret);
  if (!payload?.client_id) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  // 1) Exchange code -> access_token
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
  const tokenText = await tokenRes.text();
  const tokenJson = safeJson(tokenText);

  if (!tokenRes.ok || !tokenJson?.access_token) {
    return NextResponse.json(
      { error: "token_exchange_failed", details: tokenJson ?? tokenText },
      { status: 400 }
    );
  }

  const accessToken = tokenJson.access_token as string;
  const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : null;

  // 2) (Optionnel mais utile) récupérer infos user + scopes
  const debugUrl = new URL("https://graph.facebook.com/v19.0/debug_token");
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);

  const dbgRes = await fetch(debugUrl.toString());
  const dbgJson = safeJson(await dbgRes.text());

  const fbUserId = dbgJson?.data?.user_id ?? null;
  const scopes = dbgJson?.data?.scopes ?? null;

  // 3) Save to Supabase (service role => pas de RLS block)
  const supabase = createAdminClient();

  const expiresAt =
    expiresIn && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  // IMPORTANT : adapte les noms des colonnes si ton table est différent
  const { error: dbErr } = await supabase
    .from("meta_connections")
    .upsert(
      {
        client_id: payload.client_id,
        provider: "META",
        access_token: accessToken,
        fb_user_id: fbUserId,
        scopes,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,provider" }
    );

  if (dbErr) {
    return NextResponse.json(
      { error: "db_save_failed", details: dbErr },
      { status: 500 }
    );
  }

  // 4) Redirect back UI
  const redirectBack = new URL("https://jadoline.com/clients");
  redirectBack.searchParams.set("meta", "connected");
  redirectBack.searchParams.set("client_id", payload.client_id);

  return NextResponse.redirect(redirectBack.toString());
}
