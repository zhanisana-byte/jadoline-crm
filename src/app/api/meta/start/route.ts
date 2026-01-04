import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // on veut l'id du client pour savoir où stocker le token après
  const clientId = searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "missing client_id" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  // 🔥 Si c’est undefined chez toi, on le verra ici directement
  if (!appId || !redirectUri) {
    return NextResponse.json(
      {
        error: "missing env",
        META_APP_ID: !!appId,
        META_REDIRECT_URI: !!redirectUri,
      },
      { status: 500 }
    );
  }

  // Permissions minimum pour lire pages + IG (tu pourras ajouter après)
  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
  ].join(",");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", encodeURIComponent(clientId));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);

  return NextResponse.redirect(authUrl.toString());
}
