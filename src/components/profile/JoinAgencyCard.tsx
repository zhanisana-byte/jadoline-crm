"use client";

import { useState } from "react";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function JoinAgencyCard(props: {
  busy: boolean;
  onJoinByAgencyId: (agencyId: string) => Promise<void>;
}) {
  const { busy, onJoinByAgencyId } = props;

  const [agencyId, setAgencyId] = useState("");

  return (
    <section className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-base font-semibold">Rejoindre une agence</h3>
        <p className="text-sm text-slate-500">
          Entre l’<b>Agency ID</b> reçu (pas de clé).
        </p>
      </div>

      <div className="p-5 space-y-3">
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value)}
          placeholder="Agency ID (uuid)"
          autoComplete="off"
        />

        <button
          type="button"
          disabled={busy || !agencyId.trim()}
          onClick={() => onJoinByAgencyId(agencyId.trim())}
          className={cn(
            "w-full rounded-xl px-4 py-2 text-sm font-semibold",
            busy || !agencyId.trim()
              ? "bg-slate-200 text-slate-500"
              : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          {busy ? "Connexion..." : "Rejoindre"}
        </button>

        <p className="text-xs text-slate-500">
          Exemple: <span className="font-mono">244687c8-fafe-40ff-812d-a5c43e54aa0b</span>
        </p>
      </div>
    </section>
  );
}
