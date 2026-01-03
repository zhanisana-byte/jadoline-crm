"use client";

import { useState } from "react";

export default function MonAgencyCard({
  agencyId,
  agencyName,
}: {
  agencyId: string | null;
  agencyName: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    if (!agencyId) return;
    navigator.clipboard.writeText(agencyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-lg font-semibold mb-2">Mon agence</h2>
      <p className="text-sm text-slate-500 mb-4">
        C’est ton agence personnelle (liée à <code>users_profile.agency_id</code>)
      </p>

      <div className="space-y-3">
        <div>
          <div className="text-xs text-slate-500">Nom</div>
          <div className="font-semibold">{agencyName ?? "—"}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Agency ID</div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-slate-100 rounded px-2 py-1 break-all">
              {agencyId ?? "—"}
            </code>
            {agencyId && (
              <button
                onClick={copyId}
                className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
              >
                {copied ? "Copié ✓" : "Copier"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
