"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function JoinAgencyCard() {
  const supabase = createClient();

  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setMsg(null);

    try {
      const { data: uRes } = await supabase.auth.getUser();
      if (!uRes.user) {
        setMsg("Vous devez être connecté(e) pour rejoindre une agence.");
        return;
      }

      const { error } = await supabase.rpc("join_with_agency_id", {
        p_agency_id: agencyId.trim(),
      });

      if (error) throw error;

      setMsg("Agence rejointe avec succès ✅");
      setAgencyId("");

      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-lg font-semibold">Rejoindre une agence</h2>
      <p className="text-sm text-slate-500 mt-1">
        Veuillez saisir l’Agency ID reçu (sans clé).
      </p>

      <input
        value={agencyId}
        onChange={(e) => setAgencyId(e.target.value)}
        placeholder="Agency ID (uuid)"
        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />

      <button
        onClick={join}
        disabled={loading || !agencyId.trim()}
        className="mt-3 w-full rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Connexion…" : "Rejoindre"}
      </button>

      {msg && (
        <div className="mt-3 text-sm text-slate-700">
          {msg}
        </div>
      )}
    </div>
  );
}
