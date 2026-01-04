import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function verifyAndParseState(state: string, secret: string): { client_id: string } {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("invalid_state_format");

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  if (sig !== expected) throw new Error("invalid_state_signature");

  const json = Buffer.from(body, "base64").toString("utf8"); // body est base64url sans padding, OK
  const obj = JSON.parse(json);
  if (!obj.client_id) throw new Error("missing_client_id_in_state");
  return { client_id: obj.client_id };
}

function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env (URL or SERVICE_ROLE_KEY)");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Missing Meta env (META_APP_ID or META_APP_SECRET)");

  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const r = await fetch(tokenUrl.toString());
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "meta_token_error");
  return data as { access_token: string; token_type?: string; expires_in?: number };
}

async function getPages(accessToken: string) {
  const url = new URL("https://graph.facebook.com/v19.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token");
  url.searchParams.set("access_token", accessToken);

  const r = await fetch(url.toString());
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "meta_pages_error");
  return (data?.data ?? []) as Array<{ id: string; name: string; access_token?: string }>;
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);

  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");

  if (!code || !state) return NextResponse.redirect(new URL("/clients?meta=missing_code_state", reqUrl.origin));

  const stateSecret = process.env.META_STATE_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI; // doit être EXACTEMENT le même que dans login

  if (!stateSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/clients?meta=missing_env", reqUrl.origin));
  }

  try {
    const { client_id } = verifyAndParseState(state, stateSecret);

    const token = await exchangeCodeForToken(code, redirectUri);
    const pages = await getPages(token.access_token);

    const admin = createAdminSupabase();
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;

    // ✅ enregistre ce que tu as (MVP)
    const { error } = await admin.from("meta_connections").upsert(
      {
        client_id,
        access_token: token.access_token,
        token_type: token.token_type ?? null,
        expires_at: expiresAt,
        pages: pages as any, // colonne jsonb conseillée
      } as any,
      { onConflict: "client_id" }
    );

    if (error) throw new Error(error.message);

    const ok = new URL("/clients", reqUrl.origin);
    ok.searchParams.set("meta", "connected");
    ok.searchParams.set("client_id", client_id);
    return NextResponse.redirect(ok.toString());
  } catch (e: any) {
    const ko = new URL("/clients", reqUrl.origin);
    ko.searchParams.set("meta", "error");
    ko.searchParams.set("reason", e?.message ?? "unknown");
    return NextResponse.redirect(ko.toString());
  }
}
