"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MembershipRow = {
  agency_id: string;
  role: string | null;
  status: string | null;
  created_at: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

type WorkItem = MembershipRow & {
  agency?: AgencyRow | null;
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function WorkspaceCard({ myAgencyId }: { myAgencyId: string | null }) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: uRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const user = uRes.user;
      if (!user) {
        setErr("Vous devez être connecté(e) pour afficher vos collaborations.");
        setItems([]);
        return;
      }

      // 1) memberships
      const { data: mems, error: memErr } = await supabase
        .from("agency_members")
        .select("agency_id, role, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (memErr) throw memErr;

      const memberships: MembershipRow[] = (mems ?? []).map((r: any) => ({
        agency_id: String(r.agency_id),
        role: r.role ?? null,
        status: r.status ?? null,
        created_at: r.created_at ?? null,
      }));

      // cacher “mon agence personnelle” dans Work (optionnel)
      const filtered = myAgencyId
        ? memberships.filter((m) => m.agency_id !== myAgencyId)
        : memberships;

      if (filtered.length === 0) {
        setItems([]);
        return;
      }

      // 2) agencies (requête séparée -> évite les soucis de join / array)
      const ids = filtered.map((m) => m.agency_id);

      const { data: ags, error: agErr } = await supabase
        .from("agencies")
        .select("id, name, created_at")
        .in("id", ids);

      if (agErr) throw agErr;

      const agencies: AgencyRow[] = (ags ?? []).map((a: any) => ({
        id: String(a.id),
        name: a.name ?? null,
        created_at: a.created_at ?? null,
      }));

      const byId = new Map(agencies.map((a) => [a.id, a]));

      const merged: WorkItem[] = filtered.map((m) => ({
        ...m,
        agency: byId.get(m.agency_id) ?? null,
      }));

      setItems(merged);
    } catch (e: any) {
      setErr(e?.message ?? "Une erreur est survenue.");
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
            Les agences où vous êtes membre (via Agency ID).
          </p>
        </div>

        <button
          onClick={load}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-600">Chargement…</div>
      ) : err ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Aucune agence trouvée pour le moment.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.agency_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{it.agency?.name ?? "Agence"}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Agency ID : <code>{it.agency_id}</code>
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
