import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "meta_oauth_state";

function sign(secret: string, base: string) {
  return crypto.createHmac("sha256", secret).update(base).digest("base64url");
}

function parseState(state: string, secret: string) {
  const [base, sig] = state.split(".");
  if (!base || !sig) return null;
  if (sign(secret, base) !== sig) return null;
  return JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as {
    client_id: string;
    nonce: string;
    ts: number;
  };
}

async function graphGet(path: string, accessToken: string) {
  const u = new URL(`https://graph.facebook.com/v19.0/${path}`);
  u.searchParams.set("access_token", accessToken);
  const r = await fetch(u.toString(), { method: "GET" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "Graph error");
  return j;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return NextResponse.json({ error: "missing code/state" }, { status: 400 });

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;
  const stateSecret = process.env.META_STATE_SECRET!;

  if (!appId || !appSecret || !redirectUri || !stateSecret) {
    return NextResponse.json({ error: "missing META env" }, { status: 500 });
  }

  // cookie anti-CSRF
  const cookieHeader = req.headers.get("cookie") || "";
  const cookieState = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect("https://jadoline.com/clients?meta=failed");
  }

  const parsed = parseState(state, stateSecret);
  if (!parsed?.client_id) {
    return NextResponse.redirect("https://jadoline.com/clients?meta=failed");
  }

  try {
    // exchange code -> user access token
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson?.access_token) throw new Error("token_exchange_failed");

    const userAccessToken = tokenJson.access_token as string;
    const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : null;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    // pages
    const pages = await graphGet("me/accounts?fields=id,name,access_token", userAccessToken);
    const page = pages?.data?.[0];

    if (!page?.id || !page?.access_token) {
      throw new Error("no_page_found");
    }

    // ig business account (si existe)
    const pageInfo = await graphGet(`${page.id}?fields=instagram_business_account,name`, page.access_token);
    const igId = pageInfo?.instagram_business_account?.id ?? null;

    // ✅ save in DB via service role
    const sb = createAdminClient();
    const { error: upErr } = await sb
      .from("meta_connections")
      .upsert(
        {
          client_id: parsed.client_id,
          access_token: userAccessToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
          // champs optionnels si tu veux les garder:
          fb_page_id: String(page.id),
          fb_page_name: String(page.name ?? ""),
          ig_business_id: igId ? String(igId) : null,
        },
        { onConflict: "client_id" }
      );

    if (upErr) throw upErr;

    const res = NextResponse.redirect(
      `https://jadoline.com/clients?meta=connected&client_id=${parsed.client_id}`
    );
    res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect("https://jadoline.com/clients?meta=failed");
  }
}
