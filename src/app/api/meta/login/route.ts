import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "missing client_id" }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`;

  // IMPORTANT: scopes SANS ESPACES
  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "instagram_basic",
  ].join(",");

  // state: tu peux mettre un JSON simple (client_id) encodé base64url
  const state = Buffer.from(JSON.stringify({ client_id: clientId })).toString("base64url");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
