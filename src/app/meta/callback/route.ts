import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sbAdmin() {
  // Service role pour écrire en DB depuis serveur (bypass RLS)
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // on a mis client_id dedans

  if (!code || !state) {
    return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  }

  const clientId = decodeURIComponent(state);

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  // 1) Exchange code -> user access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`
  );

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.json({ error: "token_exchange_failed", details: tokenJson }, { status: 400 });
  }

  const userAccessToken = tokenJson.access_token as string;

  // 2) Get pages list
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`
  );
  const pagesJson = await pagesRes.json();

  if (!pagesRes.ok) {
    return NextResponse.json({ error: "pages_fetch_failed", details: pagesJson }, { status: 400 });
  }

  const pages = pagesJson.data as Array<{ id: string; name: string; access_token: string }>;
  if (!pages?.length) {
    return NextResponse.json({ error: "no_pages_found" }, { status: 400 });
  }

  // MVP simple: on prend la 1ère page (après tu feras un écran pour choisir)
  const page = pages[0];

  // 3) Try get IG business account linked to that page
  const igRes = await fetch(
    `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account,connected_instagram_account&access_token=${encodeURIComponent(page.access_token)}`
  );
  const igJson = await igRes.json();

  const igBusinessId =
    igJson?.instagram_business_account?.id ||
    igJson?.connected_instagram_account?.id ||
    null;

  // 4) Save in DB (server-side with service role)
  const supabase = sbAdmin();

  // upsert facebook row
  const { error: fbErr } = await supabase
    .from("client_social_accounts")
    .upsert(
      {
        client_id: clientId,
        platform: "facebook",
        meta_connected: true,
        access_token: page.access_token,
        page_id: page.id,
        page_name: page.name,
      },
      { onConflict: "client_id,platform" }
    );

  if (fbErr) {
    return NextResponse.json({ error: "db_save_facebook_failed", details: fbErr }, { status: 400 });
  }

  // upsert instagram row (si trouvé)
  if (igBusinessId) {
    const { error: igErr } = await supabase
      .from("client_social_accounts")
      .upsert(
        {
          client_id: clientId,
          platform: "instagram",
          meta_connected: true,
          access_token: page.access_token, // même token page
          page_id: page.id,
          page_name: page.name,
          ig_business_id: igBusinessId,
        },
        { onConflict: "client_id,platform" }
      );

    if (igErr) {
      return NextResponse.json({ error: "db_save_instagram_failed", details: igErr }, { status: 400 });
    }
  }

  // 5) Redirect back to client page (UX)
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/clients?connected=1`);
}
