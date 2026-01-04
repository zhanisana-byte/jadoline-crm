"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Agency = {
  id: string;
  name: string | null;
  created_at: string | null;
};

type Membership = {
  agency_id: string;
  role: string | null;
  status: string | null;
  agencies: Agency | null;
};

export default function WorkspaceCard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Membership[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          setError("Utilisateur non connecté.");
          return;
        }

        const { data, error } = await supabase
          .from("agency_members")
          .select(`
            agency_id,
            role,
            status,
            agencies (
              id,
              name,
              created_at
            )
          `)
          .eq("user_id", u.user.id)
          .eq("status", "active");

        if (error) throw error;

        setItems((data ?? []) as Membership[]);
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-lg font-semibold">Work (collaborations)</h2>
      <p className="text-sm text-slate-500 mt-1">
        Les agences où tu es membre (via Agency ID).
      </p>

      {loading ? (
        <div className="mt-4 text-sm text-slate-600">Chargement…</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Aucune agence trouvée pour le moment.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((m) => (
            <div
              key={m.agency_id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold">
                {m.agencies?.name ?? "Agence sans nom"}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                Agency ID : <code>{m.agency_id}</code>
              </div>

              <span className="inline-block mt-2 rounded-full border px-2 py-1 text-xs">
                {m.role ?? "CM"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
