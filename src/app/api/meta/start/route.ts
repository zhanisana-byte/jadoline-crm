import { NextResponse } from "next/server";
import crypto from "crypto";

function signState(clientId: string) {
  const secret = process.env.META_STATE_SECRET!;
  const sig = crypto.createHmac("sha256", secret).update(clientId).digest("hex");
  return `${clientId}.${sig}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "missing client_id" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

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

  // ✅ Scopes SAFE (pas d'instagram_basic ni pages_read_engagement pour éviter Invalid Scopes)
  // On récupèrera IG via Graph (instagram_business_account) après.
  const scope = [
    "pages_show_list",
    "pages_manage_metadata",
  ].join(",");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", signState(clientId));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);

  return NextResponse.redirect(authUrl.toString());
}
