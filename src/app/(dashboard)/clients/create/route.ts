import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type SocialDraft = {
  platform: "META_FACEBOOK_PAGE" | "META_INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  value: string;
};

function adminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    agency_id,
    name,
    email,
    phones,
    logo_url,
    brief_avoid,
    socials,
  }: {
    agency_id: string;
    name: string;
    email?: string | null;
    phones?: string[] | null;
    logo_url?: string | null;
    brief_avoid?: string | null;
    socials?: SocialDraft[] | null;
  } = body;

  if (!agency_id || !name) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const created_by = auth.user.id;
  const sb = adminSupabase();

  // ✅ 1) vérifier que le user est membre de cette agence (CM ou agence partenaire)
  const { data: membership, error: memErr } = await sb
    .from("agency_members")
    .select("id")
    .eq("agency_id", agency_id)
    .eq("user_id", created_by)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }
  if (!membership) {
    return NextResponse.json({ error: "not allowed for this agency" }, { status: 403 });
  }

  // ✅ 2) déterminer rôle client_role (AGENCY => ADMIN, CM => CM)
  const { data: profile } = await sb
    .from("users_profile")
    .select("account_type")
    .eq("user_id", created_by)
    .maybeSingle();

  const client_role = profile?.account_type === "AGENCY" ? "ADMIN" : "CM";

  // ✅ 3) créer client
  const { data: client, error: clientErr } = await sb
    .from("clients")
    .insert({
      agency_id,
      name,
      email: email || null,
      phones: phones || [],
      logo_url: logo_url || null,
      created_by,
      brief_avoid: brief_avoid || null,
    })
    .select("id")
    .single();

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 400 });
  }

  const clientId = client.id;

  // ✅ 4) donner accès au créateur
  const { error: accessErr } = await sb.from("member_client_access").insert({
    user_id: created_by,
    client_id: clientId,
    agency_id,
    client_role,
  });

  if (accessErr) {
    return NextResponse.json({ error: accessErr.message }, { status: 400 });
  }

  // ✅ 5) visibilité profil
  await sb.from("client_profile_visibility").upsert({
    user_id: created_by,
    client_id: clientId,
    show: true,
  });

  // ✅ 6) créer les RS manuels (client_social_accounts)
  if (Array.isArray(socials) && socials.length > 0) {
    const rows = socials
      .filter((s) => s?.value?.trim())
      .map((s) => {
        const v = s.value.trim();

        // mapping simple (MVP)
        const base: any = {
          client_id: clientId,
          agency_id,
          platform: s.platform,
          publish_mode: "MANUAL",
          provider: "MANUAL",
        };

        if (s.platform === "META_FACEBOOK_PAGE") base.page_name = v;
        if (s.platform === "META_INSTAGRAM") base.ig_username = v.replace(/^@/, "");
        if (s.platform === "TIKTOK") base.username = v.replace(/^@/, "");
        if (s.platform === "YOUTUBE") base.display_name = v;

        return base;
      });

    if (rows.length) {
      const { error: socialErr } = await sb.from("client_social_accounts").insert(rows);
      if (socialErr) {
        // on ne casse pas la création client si RS échoue
        await sb.from("client_social_accounts").delete().eq("client_id", clientId);
        return NextResponse.json({ error: socialErr.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true, client_id: clientId });
}
