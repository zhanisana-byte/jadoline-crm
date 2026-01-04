import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBaseUrl(reqUrl: URL) {
  // ✅ marche sur vercel / prod / localhost
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return `${reqUrl.protocol}//${reqUrl.host}`;
}

function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env (URL or SERVICE_ROLE_KEY)");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseState(state: string | null): { client_id?: string; user_id?: string } {
  if (!state) return {};
  try {
    // state = base64url(JSON)
    const json = Buffer.from(state, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    return { client_id: obj.client_id, user_id: obj.user_id };
  } catch {
    return {};
  }
}

async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
}) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Missing Meta env (NEXT_PUBLIC_META_APP_ID or META_APP_SECRET)");
  }

  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", params.redirectUri);
  tokenUrl.searchParams.set("code", params.code);

  const r = await fetch(tokenUrl.toString(), { method: "GET" });
  const data = await r.json();

  if (!r.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`meta_token_error: ${msg}`);
  }

  // { access_token, token_type, expires_in }
  return data as { access_token: string; token_type?: string; expires_in?: number };
}

async function getMe(accessToken: string) {
  const meUrl = new URL("https://graph.facebook.com/v19.0/me");
  meUrl.searchParams.set("fields", "id,name");
  meUrl.searchParams.set("access_token", accessToken);

  const r = await fetch(meUrl.toString());
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`meta_me_error: ${msg}`);
  }
  return data as { id: string; name: string };
}

async function getPages(accessToken: string) {
  // Liste des pages accessibles par l’utilisateur
  const url = new URL("https://graph.facebook.com/v19.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("access_token", accessToken);

  const r = await fetch(url.toString());
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`meta_pages_error: ${msg}`);
  }
  return (data?.data ?? []) as Array<{
    id: string;
    name: string;
    access_token?: string; // page token (souvent fourni)
    instagram_business_account?: { id: string } | null;
  }>;
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);

  // ✅ Meta peut renvoyer error_code / error_message si l’utilisateur annule ou si permissions invalid
  const errorCode = reqUrl.searchParams.get("error_code");
  const errorMessage = reqUrl.searchParams.get("error_message");
  if (errorCode || errorMessage) {
    // retour vers /clients avec message
    const baseUrl = getBaseUrl(reqUrl);
    const redirect = new URL(`${baseUrl}/clients`);
    redirect.searchParams.set("meta", "error");
    if (errorMessage) redirect.searchParams.set("reason", errorMessage);
    return NextResponse.redirect(redirect.toString());
  }

  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  }

  const { client_id, user_id } = parseState(state);
  if (!client_id) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  const baseUrl = getBaseUrl(reqUrl);
  const redirectUri = `${baseUrl}/api/meta/callback`;

  try {
    // 1) Token user (short-lived)
    const token = await exchangeCodeForToken({ code, redirectUri });
    const accessToken = token.access_token;

    // 2) Infos user Meta
    const me = await getMe(accessToken);

    // 3) Pages + IG business (si dispo)
    const pages = await getPages(accessToken);

    // 4) Save DB via SERVICE ROLE (bypass RLS)
    const admin = createAdminSupabase();

    // ⚠️ IMPORTANT:
    // Adapte ces champs à ta table meta_connections si besoin.
    // (si une colonne n’existe pas -> supabase renverra une erreur)
    const expiresAt =
      token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;

    const payload = {
      client_id,
      // si tu veux lier à l’utilisateur connecté, tu peux stocker user_id dans state au départ.
      user_id: user_id ?? null,

      meta_user_id: me.id,
      meta_user_name: me.name,

      access_token: accessToken,
      token_type: token.token_type ?? null,
      expires_at: expiresAt,

      // on garde une copie “pages” pour debug/usage (si tu as une colonne jsonb)
      pages: pages as any,
    };

    // ✅ upsert (évite doublons par client)
    // Nécessite une contrainte unique sur meta_connections.client_id (ou adapte onConflict)
    const { error: dbErr } = await admin
      .from("meta_connections")
      .upsert(payload as any, { onConflict: "client_id" });

    if (dbErr) {
      throw new Error(`db_save_failed: ${dbErr.message}`);
    }

    // 5) Redirect vers page clients (comme ton screenshot)
    const redirect = new URL(`${baseUrl}/clients`);
    redirect.searchParams.set("meta", "connected");
    redirect.searchParams.set("client_id", client_id);
    return NextResponse.redirect(redirect.toString());
  } catch (e: any) {
    const redirect = new URL(`${baseUrl}/clients`);
    redirect.searchParams.set("meta", "error");
    redirect.searchParams.set("reason", e?.message ?? "unknown");
    return NextResponse.redirect(redirect.toString());
  }
}
