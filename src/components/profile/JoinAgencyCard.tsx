"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { humanErr } from "./ui";

export default function JoinAgencyCard({
  onDone,
  disabled,
}: {
  onDone: () => Promise<void>;
  disabled?: boolean;
}) {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setMsg(null);

    try {
      const id = agencyId.trim();
      if (!id) {
        setMsg("Veuillez entrer un Agency ID (uuid).");
        return;
      }

      const { error } = await supabase.rpc("join_with_agency_id", {
        p_agency_id: id,
      });

      if (error) throw error;

      setMsg("✅ Rejoint avec succès.");
      setAgencyId("");
      await onDone();
    } catch (e: any) {
      setMsg(humanErr(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Rejoindre une agence</h2>
      <p className="text-sm text-slate-500">Entre l’Agency ID reçu (pas de clé).</p>

      {msg && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {msg}
        </div>
      )}

      <div className="mt-4 flex flex-col md:flex-row gap-3">
        <input
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Agency ID (uuid)"
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value)}
          disabled={disabled || loading}
        />
        <button
          type="button"
          onClick={join}
          disabled={disabled || loading}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold",
            loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800",
          ].join(" ")}
        >
          {loading ? "..." : "Rejoindre"}
        </button>
      </div>
    </div>
  );
}
