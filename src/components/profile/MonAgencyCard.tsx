"use client";

import { CopyBtn } from "./ui";
import type { AgencyRow } from "./types";

export default function MonAgencyCard({
  agency,
  agencyId,
  onEnsurePersonalAgency,
}: {
  agency: AgencyRow | null;
  agencyId: string | null;
  onEnsurePersonalAgency: () => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Mon identifiant</h2>
      <p className="text-sm text-slate-500">Agency ID (interne) : à partager pour collaborer.</p>

      <div className="mt-4 space-y-3">
        <div>
          <div className="text-sm text-slate-600">Agence</div>
          <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {agency?.name ?? "—"}
          </div>
        </div>

        <div>
          <div className="text-sm text-slate-600">Agency ID</div>
          <div className="mt-1 flex items-center">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={agencyId ?? "(aucun id)"}
              readOnly
            />
            {agencyId ? <CopyBtn value={agencyId} /> : null}
          </div>

          {!agencyId && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Ton profil n’a pas encore d’Agency ID. Clique pour créer ton “espace” automatiquement.
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onEnsurePersonalAgency}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  Créer mon espace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
