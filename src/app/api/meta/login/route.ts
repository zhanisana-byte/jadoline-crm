import { NextResponse } from "next/server";
import crypto from "crypto";

function base64url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signState(payload: any, secret: string) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${body}.${sig}`;
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const clientId = reqUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "missing client_id" }, { status: 400 });

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI; // ex: https://jadoline.com/api/meta/callback
  const stateSecret = process.env.META_STATE_SECRET;

  if (!appId || !redirectUri || !stateSecret) {
    return NextResponse.json(
      { error: "missing env", META_APP_ID: !!appId, META_REDIRECT_URI: !!redirectUri, META_STATE_SECRET: !!stateSecret },
      { status: 500 }
    );
  }

  // ✅ MVP: scope minimal
  const scopes = "pages_show_list";

  const payload = { client_id: clientId, nonce: crypto.randomUUID(), ts: Date.now() };
  const state = signState(payload, stateSecret);

  const oauth = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  oauth.searchParams.set("client_id", appId);
  oauth.searchParams.set("redirect_uri", redirectUri);
  oauth.searchParams.set("response_type", "code");
  oauth.searchParams.set("scope", scopes);
  oauth.searchParams.set("state", state);

  return NextResponse.redirect(oauth.toString());
}
