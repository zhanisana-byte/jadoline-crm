"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InviteRow = {
  id: string;
  agency_id: string;
  email: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  created_at: string;
  expires_at: string;
};

type AgencyRow = { id: string; name: string | null };

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"received" | "sent">("received");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [received, setReceived] = useState<(InviteRow & { agency?: AgencyRow | null })[]>([]);
  const [sent, setSent] = useState<(InviteRow & { agency?: AgencyRow | null })[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: uRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const user = uRes.user;
      if (!user) {
        setErr("Vous devez être connecté(e).");
        setReceived([]);
        setSent([]);
        return;
      }

      // 1) Invitations reçues (email = user.email)
      const { data: invRec, error: e1 } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, token, status, created_at, expires_at")
        .eq("email", user.email)
        .in("status", ["PENDING"])
        .order("created_at", { ascending: false });

      if (e1) throw e1;

      // 2) Invitations envoyées (created_by = user.id)
      const { data: invSent, error: e2 } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, token, status, created_at, expires_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (e2) throw e2;

      const rec = (invRec ?? []) as InviteRow[];
      const sen = (invSent ?? []) as InviteRow[];

      // récupérer noms agences pour affichage
      const agencyIds = Array.from(new Set([...rec.map(x => x.agency_id), ...sen.map(x => x.agency_id)]));

      let agencies: AgencyRow[] = [];
      if (agencyIds.length) {
        const { data: ags, error: agErr } = await supabase
          .from("agencies")
          .select("id, name")
          .in("id", agencyIds);

        if (agErr) throw agErr;
        agencies = (ags ?? []) as AgencyRow[];
      }

      const byId = new Map(agencies.map(a => [a.id, a]));

      setReceived(rec.map(x => ({ ...x, agency: byId.get(x.agency_id) ?? null })));
      setSent(sen.map(x => ({ ...x, agency: byId.get(x.agency_id) ?? null })));
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
      setReceived([]);
      setSent([]);
    } finally {
      setLoading(false);
    }
  }

  async function accept(inv: InviteRow) {
    try {
      // ✅ OPTION A (recommandé): RPC propre (à créer plus tard)
      const r = await supabase.rpc("accept_agency_invite", { p_token: inv.token });
      if (r.error) {
        // ✅ OPTION B (fallback): juste marquer ACCEPTED
        const { error } = await supabase
          .from("agency_invites")
          .update({ status: "ACCEPTED" })
          .eq("id", inv.id);
        if (error) throw error;
      }
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Erreur acceptation");
    }
  }

  async function refuse(inv: InviteRow) {
    try {
      const r = await supabase.rpc("refuse_agency_invite", { p_token: inv.token });
      if (r.error) {
        const { error } = await supabase
          .from("agency_invites")
          .update({ status: "REVOKED" })
          .eq("id", inv.id);
        if (error) throw error;
      }
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Erreur refus");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = tab === "received" ? received : sent;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Invitations & validations centralisées ici.
          </p>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-2 flex gap-2">
        <button
          onClick={() => setTab("received")}
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold",
            tab === "received" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"
          )}
        >
          Reçues ({received.length})
        </button>
        <button
          onClick={() => setTab("sent")}
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold",
            tab === "sent" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"
          )}
        >
          Envoyées ({sent.length})
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-600">Chargement…</div>
      ) : err ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          {err}
        </div>
      ) : current.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          Aucune notification.
        </div>
      ) : (
        <div className="space-y-3">
          {current.map((inv) => (
            <div key={inv.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {inv.agency?.name ?? "Agence"}{" "}
                    <span className="text-xs text-slate-500 font-normal">
                      • {new Date(inv.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Email: <span className="font-mono">{inv.email}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Agency ID: <span className="font-mono">{inv.agency_id}</span>
                  </div>
                </div>

                {tab === "received" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => accept(inv)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => refuse(inv)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      Refuser
                    </button>
                  </div>
                ) : (
                  <span className="text-xs rounded-full border px-2 py-1 bg-slate-50 text-slate-600">
                    {inv.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
