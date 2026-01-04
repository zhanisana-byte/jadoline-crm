"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type RecapRow = {
  client_id: string;
  client_name: string;
  source_agency_name: string;
};

export default function RecapPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<RecapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // ✅ IMPORTANT:
      // - member_client_access contient (user_id, client_id, agency_id)
      // - clients table contient (id, name)
      // - agencies table contient (id, name)
      const { data, error } = await supabase
        .from("member_client_access")
        .select(
          `
          client_id,
          clients:clients!inner ( id, name ),
          agencies:agencies!inner ( id, name )
        `
        )
        // tri stable côté DB (optionnel)
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        console.error("Recap load error:", error);
        setRows([]);
        setErrorMsg(error.message ?? "Erreur chargement");
        setLoading(false);
        return;
      }

      const mapped: RecapRow[] = (data ?? []).map((r: any) => ({
        client_id: r.clients?.id ?? r.client_id,
        client_name: r.clients?.name ?? "Client",
        source_agency_name: r.agencies?.name ?? "Agence",
      }));

      // tri alphabétique client
      mapped.sort((a, b) => a.client_name.localeCompare(b.client_name));

      setRows(mapped);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.client_name.toLowerCase().includes(s) ||
        r.source_agency_name.toLowerCase().includes(s)
    );
  }, [q, rows]);

  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Récap</h1>
          <p className="text-slate-600 mt-1">
            Liste des clients que vous gérez + agence qui vous a donné l’accès.
          </p>
        </div>

        <div className="w-full sm:w-80">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Rechercher
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="client, agence..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {loading ? "Chargement..." : `${filtered.length} client(s)`}
          </div>

          <div className="text-xs text-slate-500">
            Source: member_client_access
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-600">Chargement des accès...</div>
        ) : errorMsg ? (
          <div className="p-6">
            <div className="text-red-600 font-semibold">Erreur</div>
            <div className="text-slate-700 mt-1 text-sm">{errorMsg}</div>
            <div className="text-slate-500 mt-2 text-sm">
              Si tu vois “permission denied”, c’est une policy RLS SELECT
              manquante sur member_client_access / clients / agencies.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-slate-600">
            Aucun client trouvé.
            <div className="mt-2 text-sm text-slate-500">
              Vérifie que des lignes existent dans <b>member_client_access</b>{" "}
              pour cet utilisateur.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <li key={r.client_id} className="p-4 hover:bg-slate-50 transition">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {r.client_name}
                    </div>
                    <div className="text-sm text-slate-600">
                      Accès via :{" "}
                      <span className="font-medium">{r.source_agency_name}</span>
                    </div>
                  </div>

                  {/* adapte si ton route client est différent */}
                  <Link
                    href={`/clients/${r.client_id}`}
                    className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-100 hover:bg-white transition"
                  >
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
