import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const agencyName = String(body?.agencyName || "").trim();
  if (!agencyName) return NextResponse.json({ error: "agencyName required" }, { status: 400 });

  const { data: existing } = await supabase.from("agency_members").select("agency_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (existing?.agency_id) return NextResponse.json({ ok: true, agency_id: existing.agency_id });

  const { data: agency, error: aErr } = await supabase.from("agencies").insert({ name: agencyName }).select("*").single();
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

  const { error: mErr } = await supabase.from("agency_members").insert({ agency_id: agency.id, user_id: userData.user.id, role: "OWNER", status: "active" });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const end = new Date(Date.now() + 14*24*60*60*1000).toISOString().slice(0,10);
  await supabase.from("subscriptions").insert({ agency_id: agency.id, plan_name: "Trial", billing_cycle: "monthly", status: "active", start_date: new Date().toISOString().slice(0,10), end_date: end });

  return NextResponse.json({ ok: true, agency_id: agency.id });
}
