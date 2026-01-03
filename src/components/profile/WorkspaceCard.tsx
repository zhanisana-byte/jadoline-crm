"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type WorkAgency = {
  agency_id: string;
  role: string | null;
  status: string | null;
  agencies: {
    id: string;
    name: string | null;
    created_at?: string | null;
  } | null;
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function WorkspaceCard({ myAgencyId }: { myAgencyId: string | null }) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<WorkAgency[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: u } = await supabase.auth.getUser();
        const user = u.user;
        if (!user) {
          setErr("Vous devez être connecté.");
          setLoading(false);
          return;
        }

        // ✅ Agences rejointes = agency_members pour ce user
        // On récupère aussi agencies (nom)
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
          .eq("status", "active");

        if (error) throw error;

        // ⚠️ On ne montre pas "mon agence perso" dans Work (optionnel)
        const rows = (data ?? []) as WorkAgency[];
        const filtered = myAgencyId
          ? rows.filter((r) => r.agency_id !== myAgencyId)
          : rows;

        setItems(filtered);
      } catch (e: any) {
        setErr(e?.message ?? "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, myAgencyId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Work (collaborations)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Les agences que tu as rejointes (via Agency ID).
          </p>
        </div>
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
            <div
              key={it.agency_id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {it.agencies?.name ?? "Agence"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Agency ID: <code>{it.agency_id}</code>
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
