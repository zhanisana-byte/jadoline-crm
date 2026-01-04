import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function verifyState(state: string) {
  const secret = process.env.META_STATE_SECRET!;
  const [clientId, sig] = state.split(".");
  if (!clientId || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(clientId).digest("hex");
  return sig === expected ? clientId : null;
}

async function graphGET(path: string, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/v19.0/${path}`);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "GET" });
  const json = await res.json();
  return { ok: res.ok, json };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  }

  const clientId = verifyState(state);
  if (!clientId) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

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

  // 1) Exchange code -> short-lived user access token
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "token_exchange_failed", details: tokenJson }, { status: 400 });
  }

  let userToken = tokenJson.access_token as string;
  let expiresIn = tokenJson.expires_in as number | undefined;

  // 2) Exchange -> long-lived token (recommended)
  const longUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", userToken);

  const longRes = await fetch(longUrl.toString());
  const longJson = await longRes.json();

  if (longRes.ok && longJson.access_token) {
    userToken = longJson.access_token;
    expiresIn = longJson.expires_in;
  }

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  const sb = sbAdmin();

  // 3) Save raw connection (per client)
  const { error: connErr } = await sb
    .from("meta_connections")
    .upsert(
      {
        client_id: clientId,
        access_token: userToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

  if (connErr) {
    return NextResponse.json({ error: "db_save_meta_connections_failed", details: connErr }, { status: 500 });
  }

  // 4) Fetch Pages accessible by user
  // returns page id, name, page access_token
  const pages = await graphGET("me/accounts?fields=id,name,access_token", userToken);
  if (!pages.ok) {
    return NextResponse.json({ error: "fetch_pages_failed", details: pages.json }, { status: 400 });
  }

  const pageList: Array<{ id: string; name: string; access_token: string }> = pages.json?.data ?? [];

  // 5) For each page: get instagram_business_account (if exists)
  // Then upsert into client_social_accounts
  const now = new Date().toISOString();
  const rowsToUpsert: any[] = [];

  for (const p of pageList) {
    const pageId = p.id;
    const pageName = p.name;
    const pageToken = p.access_token;

    // FB PAGE row
    rowsToUpsert.push({
      client_id: clientId,
      platform: "META_FACEBOOK_PAGE",
      publish_mode: "ASSISTED",
      display_name: pageName,
      page_id: pageId,
      page_name: pageName,
      access_token: pageToken,
      expires_at: expiresAt, // same lifetime as user token (approx)
      provider: "META",
      updated_at: now,
      created_at: now,
    });

    // IG linked?
    const ig = await graphGET(`${pageId}?fields=instagram_business_account`, pageToken);
    const igId = ig.ok ? ig.json?.instagram_business_account?.id : null;

    if (igId) {
      rowsToUpsert.push({
        client_id: clientId,
        platform: "META_INSTAGRAM",
        publish_mode: "ASSISTED",
        display_name: pageName,
        ig_business_id: igId,
        page_id: pageId,
        page_name: pageName,
        access_token: pageToken, // IG publishing uses page token
        expires_at: expiresAt,
        provider: "META",
        linked_to_page: true,
        updated_at: now,
        created_at: now,
      });
    }
  }

  if (rowsToUpsert.length > 0) {
    // NOTE: if you have unique indexes as suggested, Supabase can upsert safely.
    // Otherwise it will insert duplicates. If you cannot add indexes now, we can
    // delete existing rows for this client before insert.
    const { error: upsertErr } = await sb
      .from("client_social_accounts")
      .upsert(rowsToUpsert, { onConflict: "client_id,platform,page_id" });

    // If your table doesn't have this composite constraint, comment this and we will do a safer method.
    if (upsertErr) {
      return NextResponse.json({ error: "db_upsert_client_social_accounts_failed", details: upsertErr }, { status: 500 });
    }
  }

  // 6) Redirect back to CRM
  return NextResponse.redirect(`https://jadoline.com/clients?meta=connected&client_id=${clientId}`);
}
