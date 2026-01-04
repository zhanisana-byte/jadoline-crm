import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const clientId = reqUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "missing client_id" }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  if (!appId) return NextResponse.json({ error: "missing env NEXT_PUBLIC_META_APP_ID" }, { status: 500 });

  // ✅ base URL auto (vercel / prod / localhost)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    `${reqUrl.protocol}//${reqUrl.host}`;

  const redirectUri = `${baseUrl}/api/meta/callback`;

  // ✅ scopes SANS espaces
  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "instagram_basic",
  ].join(",");

  const state = Buffer.from(JSON.stringify({ client_id: clientId })).toString("base64url");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
