import { NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "meta_oauth_state";

function b64url(s: string) {
  return Buffer.from(s).toString("base64url");
}

function sign(secret: string, base: string) {
  return crypto.createHmac("sha256", secret).update(base).digest("base64url");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");

  if (!clientId) return NextResponse.json({ error: "missing client_id" }, { status: 400 });

  const appId = process.env.META_APP_ID!;
  const redirectUri = process.env.META_REDIRECT_URI!;
  const secret = process.env.META_STATE_SECRET!;

  if (!appId || !redirectUri || !secret) {
    return NextResponse.json({ error: "missing META env" }, { status: 500 });
  }

  const scopes = ["pages_show_list", "pages_read_engagement", "instagram_basic"];

  const payload = { client_id: clientId, nonce: crypto.randomUUID(), ts: Date.now() };
  const base = b64url(JSON.stringify(payload));
  const state = `${base}.${sign(secret, base)}`;

  const oauth = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  oauth.searchParams.set("client_id", appId);
  oauth.searchParams.set("redirect_uri", redirectUri);
  oauth.searchParams.set("state", state);
  oauth.searchParams.set("response_type", "code");
  oauth.searchParams.set("scope", scopes.join(","));

  const res = NextResponse.redirect(oauth.toString());
  res.cookies.set(COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 10 * 60,
  });

  return res;
}
