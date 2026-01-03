"use client";

import type { AgencyRow, MembershipViewRow } from "./types";
import { CopyBtn } from "./ui";

export default function WorkspaceCard(props:
  | {
      mode: "my-agency";
      myAgency: AgencyRow | null;
      myAgencyId: string | null;
      members: MembershipViewRow[];
      onRefresh: () => Promise<void>;
      onEnsurePersonalAgency: () => Promise<void>;
    }
  | {
      mode: "work";
      memberships: MembershipViewRow[];
      onRefresh: () => Promise<void>;
    }
) {
  if (props.mode === "work") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mes collaborations</h2>
          <button
            onClick={props.onRefresh}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Actualiser
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {props.memberships.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Aucune collaboration.
            </div>
          ) : (
            props.memberships.map((m) => (
              <div key={`${m.agency_id}-${m.user_id}`} className="rounded-xl border border-slate-200 p-3">
                <div className="font-medium">{m.agencies?.name ?? m.agency_id}</div>
                <div className="text-sm text-slate-600">
                  Rôle: {m.role ?? "—"} • Statut: {m.status ?? "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // my-agency
  const { myAgency, myAgencyId, members, onRefresh, onEnsurePersonalAgency } = props;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Mon agence</h2>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          Actualiser
        </button>
      </div>

      {!myAgencyId ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Ton profil n’a pas d’agence liée. Clique pour créer ton espace.
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
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm text-slate-600">Agence</div>
            <div className="font-medium">{myAgency?.name ?? "—"}</div>

            <div className="mt-3 text-sm text-slate-600">Agency ID</div>
            <div className="mt-1 flex items-center">
              <div className="text-sm font-mono break-all">{myAgencyId}</div>
              <CopyBtn value={myAgencyId} />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-slate-600 mb-2">Membres</div>
            {members.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Aucun membre trouvé.
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={`${m.agency_id}-${m.user_id}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="font-medium">
                      {m.users_profile?.full_name ?? m.user_id}
                    </div>
                    <div className="text-sm text-slate-600">
                      {m.role ?? "—"} • {m.status ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
