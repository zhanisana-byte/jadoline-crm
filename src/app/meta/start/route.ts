import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "missing client_id" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID!;
  const redirectUri = process.env.META_REDIRECT_URI!; // ex: https://jadoline.com/api/meta/callback

  // IMPORTANT: state = clientId (pour savoir quel client connecter)
  const state = encodeURIComponent(clientId);

  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    // optionnel: "pages_manage_posts"
  ].join(",");

  const url =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(url);
}
