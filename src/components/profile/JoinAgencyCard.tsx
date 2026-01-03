"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

export default function JoinAgencyCard() {
  const supabase = createClient();

  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function join() {
    setMsg(null);
    const clean = agencyId.trim();

    if (!isUuid(clean)) {
      setMsg("Agency ID invalide (UUID).");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("join_with_agency_id", {
        p_agency_id: clean,
      });

      if (error) throw error;

      setMsg("✅ Rejoint avec succès. Va dans Work (collaborations) puis “Rafraîchir”.");
      setAgencyId("");
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <h2 className="text-lg font-semibold">Rejoindre une agence</h2>
        <p className="text-sm text-slate-500">
          Entre l’<b>Agency ID</b> reçu (pas de clé).
        </p>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs text-slate-500">Agency ID (uuid)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            placeholder="ex: b60314f1-1751-49ec-a863-..."
          />
        </div>

        <button
          onClick={join}
          disabled={loading}
          className={cn(
            "mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold",
            loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          {loading ? "..." : "Rejoindre"}
        </button>
      </div>
    </div>
  );
}
