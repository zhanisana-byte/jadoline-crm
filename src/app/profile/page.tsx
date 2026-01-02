"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MembershipRow, MemberViewRow, AgencyKeyRow } from "@/components/profile/types";

import WorkspaceCard from "@/components/profile/WorkspaceCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

type Tab = "INFO" | "MY_AGENCIES" | "WORK";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("MY_AGENCIES");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberViewRow[]>([]);
  const [agencyKey, setAgencyKey] = useState<AgencyKeyRow | null>(null);

  // ===== helpers
  const onCopy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    setToast("Clé copiée ✅");
    setTimeout(() => setToast(null), 1500);
  };

  const isOwner = useMemo(() => {
    const m = memberships.find((x) => x.agency_id === selectedAgencyId);
    return m?.role === "OWNER";
  }, [memberships, selectedAgencyId]);

  // ===== 1) charger memberships
  useEffect(() => {
    (async () => {
      setBusy(true);
      setToast(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setBusy(false);
        return;
      }

      const { data, error } = await supabase
        .from("agency_members")
        .select("id, agency_id, user_id, role, status, agencies(id, name)")
        .eq("user_id", user.id);

      if (error) {
        setToast(error.message);
        setMemberships([]);
        setSelectedAgencyId(null);
      } else {
        setMemberships((data || []) as MembershipRow[]);
        // auto select premier
        setSelectedAgencyId((data && data[0]?.agency_id) ?? null);
      }

      setBusy(false);
    })();
  }, [supabase]);

  // ===== 2) charger membres de l’agence sélectionnée (FIX FK ICI ✅)
  useEffect(() => {
    (async () => {
      setMembers([]);
      setAgencyKey(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user || !selectedAgencyId) return;

      // Membres
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select(`
          user_id,
          role,
          status,
          users_profile!agency_members_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq("agency_id", selectedAgencyId);

      if (memErr) {
        setToast(memErr.message);
        setMembers([]);
      } else {
        // Normaliser users_profile (au cas où Supabase renvoie un tableau)
        const normalized: MemberViewRow[] = (mems || []).map((m: any) => {
          const up = Array.isArray(m.users_profile) ? m.users_profile[0] : m.users_profile;
          return {
            user_id: m.user_id,
            role: m.role,
            status: m.status ?? null,
            users_profile: up
              ? { full_name: up.full_name ?? null, avatar_url: up.avatar_url ?? null }
              : null,
          };
        });

        setMembers(normalized);
      }

      // Charger clé agence (si tu as une table agency_keys)
      const { data: keyData } = await supabase
        .from("agency_keys")
        .select("id, active, created_at")
        .eq("agency_id", selectedAgencyId)
        .eq("active", true)
        .maybeSingle();

      setAgencyKey((keyData as any) ?? null);
    })();
  }, [supabase, selectedAgencyId]);

  // ===== Générer clé (exemple)
  const onGenerateKey = async () => {
    if (!selectedAgencyId) return;
    setBusy(true);
    setToast(null);

    // si tu as une RPC "generate_agency_key"
    const { data, error } = await supabase.rpc("generate_agency_key", {
      p_agency_id: selectedAgencyId,
    });

    if (error) setToast(error.message);
    else {
      setAgencyKey(data as any);
      setToast("Clé générée ✅");
      setTimeout(() => setToast(null), 1500);
    }

    setBusy(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profil</h1>
          <p className="text-slate-500">Gestion du compte & espaces de travail.</p>
        </div>

        {toast && (
          <div className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm">
            {toast}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("INFO")}
          className={`px-4 py-2 rounded-xl border ${tab === "INFO" ? "bg-slate-900 text-white" : "bg-white"}`}
        >
          Infos
        </button>
        <button
          onClick={() => setTab("MY_AGENCIES")}
          className={`px-4 py-2 rounded-xl border ${tab === "MY_AGENCIES" ? "bg-slate-900 text-white" : "bg-white"}`}
        >
          Mes agences
        </button>
        <button
          onClick={() => setTab("WORK")}
          className={`px-4 py-2 rounded-xl border ${tab === "WORK" ? "bg-slate-900 text-white" : "bg-white"}`}
        >
          Work
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {tab === "INFO" && <ProfileInfoCard />}

          {tab === "MY_AGENCIES" && (
            <>
              <WorkspaceCard
                memberships={memberships}
                selectedAgencyId={selectedAgencyId}
                onSelectAgency={setSelectedAgencyId}
                members={members}
                isOwner={isOwner}
                agencyKey={agencyKey}
                onGenerateKey={onGenerateKey}
                onCopy={onCopy}
                busy={busy}
              />
              <CreateAgencyCard />
            </>
          )}

          {tab === "WORK" && (
            <>
              <JoinAgencyCard />
              {/* ici tu peux afficher “les agences où je travaille” + clients */}
            </>
          )}
        </div>

        <div className="space-y-4">
          <QuickRecapCard />
        </div>
      </div>
    </div>
  );
}
