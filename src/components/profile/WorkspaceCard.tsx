"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AgencyRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

type WorkAgencyRow = {
  agency_id: string;
  role: string | null;
  status: string | null;
  agencies: AgencyRow | null; // ✅ objet, pas array
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function WorkspaceCard({ myAgencyId }: { myAgencyId: string | null }) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<WorkAgencyRow[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const user = u.user;
      if (!user) {
        setErr("Vous devez être connecté.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("agency_members")
        .select(
          `
            agency_id,
            role,
            status,
            agencies:agencies (
              id,
              name,
              created_at
            )
          `
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as unknown as WorkAgencyRow[];

      // cacher mon agence perso dans Work (optionnel)
      const filtered = myAgencyId ? rows.filter((r) => r.agency_id !== myAgencyId) : rows;

      setItems(filtered);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAgencyId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Work (collaborations)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Les agences que tu as rejointes (via Agency ID).
          </p>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-600">Chargement...</div>
      ) : err ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Aucune agence rejointe pour le moment.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.agency_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{it.agencies?.name ?? "Agence"}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Agency ID: <code className="break-all">{it.agency_id}</code>
                  </div>
                </div>

                <span
                  className={cn(
                    "text-xs rounded-full px-2 py-1 border",
                    it.role === "OWNER"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200"
                  )}
                >
                  {it.role ?? "CM"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
