"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ✅ modules déjà créés
import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import WorkspaceCard from "@/components/profile/WorkspaceCard";
import CreateAgencyCard from "@/components/profile/CreateAgencyCard";
import JoinAgencyCard from "@/components/profile/JoinAgencyCard";
import QuickRecapCard from "@/components/profile/QuickRecapCard";

// ✅ UI atoms
import { Badge } from "@/components/profile/ui";

type TabKey = "INFO" | "MY_AGENCIES" | "WORK";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<TabKey>("INFO");

  /**
   * IMPORTANT:
   * Tes modules actuels doivent déjà faire leur fetch interne OU recevoir des props.
   * On garde ton existant : tu branches selon ton architecture actuelle.
   */

  // 👉 Si tu as déjà "profile.role" (global) dans un state parent, utilise-le ici.
  // Pour l’instant, on met un placeholder (à remplacer par ta vraie variable)
  const globalRole: "OWNER" | "CM" | "FITNESS" = "OWNER";

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Profil</h1>
          <p className="text-slate-600 mt-1">Gestion du compte & espaces de travail.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={globalRole === "OWNER" ? "green" : "blue"}>
            Rôle global : {globalRole}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton active={tab === "INFO"} onClick={() => setTab("INFO")}>
          Infos
        </TabButton>

        <TabButton
          active={tab === "MY_AGENCIES"}
          onClick={() => setTab("MY_AGENCIES")}
        >
          Mes agences
        </TabButton>

        <TabButton active={tab === "WORK"} onClick={() => setTab("WORK")}>
          Work
        </TabButton>
      </div>

      {/* Content */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          {tab === "INFO" && (
            <>
              <ProfileInfoCard supabase={supabase} />
            </>
          )}

          {tab === "MY_AGENCIES" && (
            <>
              {/* WorkspaceCard = liste agences + sélection + membres + clé */}
              <WorkspaceCard supabase={supabase} mode="OWNER" />

              {/* Créer agence séparé */}
              <CreateAgencyCard supabase={supabase} />
            </>
          )}

          {tab === "WORK" && (
            <>
              {/* WorkspaceCard en mode CM (pas clé) */}
              <WorkspaceCard supabase={supabase} mode="CM" />

              {/* Rejoindre agence séparé */}
              <JoinAgencyCard supabase={supabase} />
            </>
          )}
        </div>

        {/* RIGHT */}
        <aside className="lg:col-span-4">
          <div className="sticky top-6 space-y-6">
            <QuickRecapCard />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium border transition
        ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"}
      `}
    >
      {children}
    </button>
  );
}
