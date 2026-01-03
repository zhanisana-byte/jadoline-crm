"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import MonAgencyCard from "@/components/profile/MonAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

import type {
  AgencyRow,
  ProfileRow,
  MembershipRow,
  MembershipViewRow,
} from "@/components/profile/types";
import { humanErr } from "@/components/profile/ui";

type TabKey = "infos" | "agency" | "work";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("infos");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [myAgency, setMyAgency] = useState<AgencyRow | null>(null);

  const [memberships, setMemberships] = useState<MembershipViewRow[]>([]);
  const [members, setMembers] = useState<MembershipViewRow[]>([]);

  const tabs = useMemo(
    () => [
      { key: "infos" as const, label: "Mes infos" },
      { key: "agency" as const, label: "Mon agence" },
      { key: "work" as const, label: "Work (collaborations)" },
    ],
    []
  );

  async function loadAll() {
    setLoading(true);
    setBanner(null);

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      router.replace("/login");
      return;
    }

    const user = auth.user;

    // 1) users_profile
    const { data: prof, error: profErr } = await supabase
      .from("users_profile")
      .select("user_id, full_name, agency_id, role, created_at, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) {
      setBanner(humanErr(profErr));
      setProfile(null);
      setLoading(false);
      return;
    }

    // fallback si row manquante
    if (!prof) {
      setBanner("Profil introuvable. (users_profile manquant)");
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(prof as ProfileRow);

    // 2) Mon agence (agency_id)
    if (prof.agency_id) {
      const { data: ag, error: agErr } = await supabase
        .from("agencies")
        .select("id, name, owner_id, created_at")
        .eq("id", prof.agency_id)
        .maybeSingle();

      if (agErr) setBanner(humanErr(agErr));
      setMyAgency((ag ?? null) as AgencyRow | null);

      // 3) members of my agency
      const { data: m, error: mErr } = await supabase
        .from("agency_members")
        .select("agency_id, user_id, role, status, created_at")
        .eq("agency_id", prof.agency_id);

      if (mErr) setBanner(humanErr(mErr));

      // enrich members with users_profile
      const memberIds = (m ?? []).map((x) => x.user_id);
      if (memberIds.length) {
        const { data: up, error: upErr } = await supabase
          .from("users_profile")
          .select("user_id, full_name, avatar_url")
          .in("user_id", memberIds);

        if (upErr) setBanner(humanErr(upErr));

        const map = new Map((up ?? []).map((u) => [u.user_id, u]));
        const view: MembershipViewRow[] = (m ?? []).map((row) => ({
          ...(row as MembershipRow),
          users_profile: map.get(row.user_id) ?? null,
        }));

        setMembers(view);
      } else {
        setMembers([]);
      }
    } else {
      setMyAgency(null);
      setMembers([]);
      setBanner("Votre profil n’est pas lié à une agence (users_profile.agency_id est NULL).");
    }

    // 4) My memberships (work/collabs)
    // (toutes les agences où je suis membre)
    const { data: mem, error: memErr } = await supabase
      .from("agency_members")
      .select("agency_id, user_id, role, status, created_at")
      .eq("user_id", user.id);

    if (memErr) setBanner(humanErr(memErr));

    // enrich with agencies
    const agencyIds = Array.from(new Set((mem ?? []).map((x) => x.agency_id)));
    if (agencyIds.length) {
      const { data: ags, error: agsErr } = await supabase
        .from("agencies")
        .select("id, name, owner_id, created_at")
        .in("id", agencyIds);

      if (agsErr) setBanner(humanErr(agsErr));

      const aMap = new Map((ags ?? []).map((a) => [a.id, a]));
      const view: MembershipViewRow[] = (mem ?? []).map((row) => ({
        ...(row as MembershipRow),
        agencies: aMap.get(row.agency_id) ?? null,
      }));

      setMemberships(view);
    } else {
      setMemberships([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onEnsurePersonalAgency() {
    setBanner(null);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return router.replace("/login");

    const { error } = await supabase.rpc("ensure_personal_agency_for_user", {
      p_user: uid,
    });

    if (error) setBanner(humanErr(error));
    await loadAll();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-sm text-slate-500">Mes infos, mon équipe, et collaborations.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "px-4 py-2 rounded-xl text-sm border",
                tab === t.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {banner && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
            {banner}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            Chargement…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* INFOS */}
              {tab === "infos" && (
                <>
                  <ProfileInfoCard profile={profile} />

                  {/* Mon identifiant (Agency ID) */}
                  <MonAgencyCard
                    agency={myAgency}
                    agencyId={profile?.agency_id ?? null}
                    onEnsurePersonalAgency={onEnsurePersonalAgency}
                  />

                  {/* Rejoindre via Agency ID */}
                  <JoinAgencyCard
                    onDone={loadAll}
                    disabled={false}
                  />
                </>
              )}

              {/* MON AGENCE */}
              {tab === "agency" && (
                <WorkspaceCard
                  mode="my-agency"
                  myAgency={myAgency}
                  myAgencyId={profile?.agency_id ?? null}
                  members={members}
                  onRefresh={loadAll}
                  onEnsurePersonalAgency={onEnsurePersonalAgency}
                />
              )}

              {/* WORK */}
              {tab === "work" && (
                <WorkspaceCard
                  mode="work"
                  memberships={memberships}
                  onRefresh={loadAll}
                />
              )}
            </div>

            <div className="space-y-4">
              <QuickRecapCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
