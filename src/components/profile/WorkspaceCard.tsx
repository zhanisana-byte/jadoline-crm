"use client";

import type {
  MembershipRow,
  MemberViewRow,
  AgencyKeyRow,
  AgencyRow,
} from "@/components/profile/types";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function getAgencyName(agencies?: AgencyRow | AgencyRow[] | null) {
  if (!agencies) return "—";
  if (Array.isArray(agencies)) return agencies[0]?.name ?? "—";
  return agencies.name ?? "—";
}

export default function WorkspaceCard(props: {
  memberships: MembershipRow[];
  selectedAgencyId: string | null;
  onSelectAgency: (agencyId: string) => void;

  members: MemberViewRow[];
  isOwner: boolean;

  agencyKey: AgencyKeyRow | null;
  onGenerateKey: () => Promise<void>;
  onCopy: (txt: string) => Promise<void>;

  busy: boolean;
}) {
  const {
    memberships,
    selectedAgencyId,
    onSelectAgency,
    members,
    isOwner,
    agencyKey,
    onGenerateKey,
    onCopy,
    busy,
  } = props;

  const selected = memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <h2 className="text-lg font-semibold">Espace de travail</h2>
        <p className="text-sm text-slate-500">
          Agences liées + sélection d’un espace.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Liste agences */}
        {memberships.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Aucun espace lié. Crée un espace ou rejoins avec une clé.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {memberships.map((m) => {
              const active = m.agency_id === selectedAgencyId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectAgency(m.agency_id)}
                  className={cn(
                    "text-left rounded-2xl border px-4 py-3 transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-base">
                        {getAgencyName(m.agencies)}
                      </div>
                      <div className={cn("text-xs mt-1", active ? "text-slate-200" : "text-slate-500")}>
                        Statut : {m.status ?? "—"}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-1 rounded-full border",
                        active
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                    >
                      {m.role}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Espace sélectionné + actions */}
        <div className="flex items-start justify-between gap-3 pt-2">
          <div>
            <div className="text-xs text-slate-500">Espace sélectionné</div>
            <div className="text-lg font-semibold">
              {selected ? getAgencyName(selected.agencies) : "—"}
            </div>
          </div>

          {isOwner && selectedAgencyId && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onGenerateKey}
                disabled={busy}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold",
                  busy
                    ? "bg-slate-200 text-slate-500"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                Générer une clé
              </button>

              {agencyKey?.id && (
                <button
                  type="button"
                  onClick={() => onCopy(agencyKey.id)}
                  disabled={busy}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold border",
                    busy
                      ? "border-slate-200 text-slate-400"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Copier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Membres */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold">Membres ({members.length})</div>
            {!isOwner && (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                Clé réservée au OWNER
              </span>
            )}
          </div>

          {selectedAgencyId ? (
            members.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-500">Aucun membre.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map((m) => (
                  <li key={m.user_id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {m.users_profile?.full_name ?? "Sans nom"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Statut : {m.status ?? "—"}
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="px-4 py-4 text-sm text-slate-500">
              Sélectionne une agence.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
