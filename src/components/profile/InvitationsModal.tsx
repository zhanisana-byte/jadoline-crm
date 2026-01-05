"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ================= TYPES ================= */

type InviteRow = {
  id: string;
  agency_id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  created_at: string;
};

type AgencyRow = {
  id: string;
  name: string | null;
};

/* ================= UTILS ================= */

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

/* ================= COMPONENT ================= */

export default function InvitationsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<
    (InviteRow & { agency?: AgencyRow | null })[]
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ===== LOAD INVITATIONS ===== */
  useEffect(() => {
    (async () => {
      const { data: uRes } = await supabase.auth.getUser();
      if (!uRes.user) return;

      const { data } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, status, created_at")
        .eq("email", uRes.user.email)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as InviteRow[];

      // load agency names
      const ids = Array.from(new Set(rows.map((r) => r.agency_id)));

      let agencies: AgencyRow[] = [];
      if (ids.length) {
        const { data: ags } = await supabase
          .from("agencies")
          .select("id, name")
          .in("id", ids);
        agencies = (ags ?? []) as AgencyRow[];
      }

      const byId = new Map(agencies.map((a) => [a.id, a]));

      setInvites(rows.map((r) => ({ ...r, agency: byId.get(r.agency_id) })));
      setLoading(false);
    })();
  }, [supabase]);

  /* ===== ACTIONS ===== */

  async function accept(inv: InviteRow) {
    setBusyId(inv.id);
    try {
      const { data: uRes } = await supabase.auth.getUser();
      if (!uRes.user) return;

      // 1) accept invitation
      await supabase
        .from("agency_invites")
        .update({
          status: "ACCEPTED",
          accepted_by: uRes.user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", inv.id);

      // 2) add member
      await supabase.from("agency_members").insert({
        agency_id: inv.agency_id,
        user_id: uRes.user.id,
        role: "CM", // ⚠️ adapte si ton enum est différent
        status: "active",
      });

      setInvites((v) => v.filter((i) => i.id !== inv.id));
    } finally {
      setBusyId(null);
    }
  }

  async function refuse(inv: InviteRow) {
    setBusyId(inv.id);
    try {
      await supabase
        .from("agency_invites")
        .update({ status: "REVOKED" })
        .eq("id", inv.id);

      setInvites((v) => v.filter((i) => i.id !== inv.id));
    } finally {
      setBusyId(null);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="absolute left-1/2 top-20 -translate-x-1/2 w-[90vw] max-w-2xl">
        <div className="rounded-[28px] border border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* header */}
          <div className="p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold">
                Invitations en attente
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Rejoignez des agences en un clic
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              ✕
            </button>
          </div>

          {/* content */}
          <div className="px-6 pb-6">
            {loading ? (
              <div className="text-sm text-slate-500">Chargement…</div>
            ) : invites.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Aucune invitation en attente
              </div>
            ) : (
              <div className="space-y-3">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-slate-200 bg-white/70 p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">
                        {inv.agency?.name ?? "Agence"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        ID :{" "}
                        <span className="font-mono">{inv.agency_id}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Invitée le{" "}
                        {new Date(inv.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        disabled={busyId === inv.id}
                        onClick={() => accept(inv)}
                        className={cn(
                          "rounded-lg px-4 py-2 text-sm font-semibold",
                          "bg-emerald-500 text-white hover:bg-emerald-600"
                        )}
                      >
                        Accepter
                      </button>

                      <button
                        disabled={busyId === inv.id}
                        onClick={() => refuse(inv)}
                        className="rounded-lg px-4 py-2 text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
