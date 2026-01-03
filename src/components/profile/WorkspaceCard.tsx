"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

type JoinedRow = {
  agency_id: string;
  role: string | null;
  status: string | null;
  agencies?: { id: string; name: string | null } | null;
};

export default function WorkspaceCard({ myAgencyId }: { myAgencyId: string | null }) {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<JoinedRow[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Non connecté.");

      let q = supabase
        .from("agency_members")
        .select("agency_id, role, status, agencies:agencies(id, name)")
        .eq("user_id", user.id)
        .eq("status", "active");

      // ✅ Exclure mon agence perso du Work
      if (myAgencyId) q = q.neq("agency_id", myAgencyId);

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      setRows((data ?? []) as any);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const hasData = rows.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Agences rejointes {hasData ? `(${rows.length})` : ""}
          </h2>
          <p className="text-sm text-slate-500">
            Ici : uniquement les agences rejointes via <b>Agency ID</b> (pas ton agence perso).
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold border",
            loading
              ? "bg-slate-100 text-slate-500 border-slate-200"
              : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
          )}
        >
          {loading ? "Chargement..." : "Rafraîchir"}
        </button>
      </div>

      {err && (
        <div className="px-5 pb-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {err}
          </div>
        </div>
      )}

      <div className="px-5 pb-5">
        {!hasData ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Aucune collaboration trouvée. Clique “Rafraîchir”.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.agency_id}
                className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.agencies?.name || "Agence"}</div>
                  <div className="text-xs text-slate-500 truncate">Agency ID: {r.agency_id}</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Rôle</div>
                  <div className="text-sm font-semibold">{r.role ?? "MEMBER"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
