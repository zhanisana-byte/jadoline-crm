"use client";

import React from "react";
import { Badge, Btn, Card, CardBody, CardHeader, firstAgency, safeDate } from "./ui";
import type { AgencyKeyRow, MemberViewRow, MembershipRow } from "./types";

export default function WorkspaceCard({
  memberships,
  selectedAgencyId,
  onSelectAgency,
  members,
  isOwner,
  agencyKey,
  onGenerateKey,
  onCopy,
  busy,
}: {
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
  const selectedMembership =
    memberships.find((m) => m.agency_id === selectedAgencyId) || null;

  const selectedAgency = firstAgency(selectedMembership?.agencies);

  return (
    <Card>
      <CardHeader title="Espace de travail" subtitle="Agences liées + sélection d’un espace." />
      <CardBody>
        {memberships.length === 0 ? (
          <div className="p-4 rounded-xl border border-amber-100 bg-amber-50 text-amber-800">
            Aucun espace lié. Crée un espace ou rejoins avec une clé.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {memberships.map((m) => {
              const ag = firstAgency(m.agencies);
              const active = selectedAgencyId === m.agency_id;

              return (
                <button
                  key={m.id}
                  onClick={() => onSelectAgency(m.agency_id)}
                  className={`text-left p-4 rounded-2xl border transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{ag?.name || "Agence sans nom"}</div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "border-white/20 bg-white/10"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>

                  <div className={`mt-2 text-sm ${active ? "text-white/80" : "text-slate-600"}`}>
                    Statut : {m.status || "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 border-t pt-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Espace sélectionné</div>
              <div className="text-xl font-semibold text-slate-900">
                {selectedAgency?.name || "—"}
              </div>
            </div>

            <div className="flex gap-2 items-center">
              {isOwner ? (
                agencyKey?.id ? (
                  <Btn onClick={() => onCopy(agencyKey.id)}>Copier clé</Btn>
                ) : (
                  <Btn
                    variant="primary"
                    disabled={busy || !selectedAgencyId}
                    onClick={onGenerateKey}
                  >
                    Générer une clé
                  </Btn>
                )
              ) : (
                <Badge tone="amber">Clé réservée au OWNER</Badge>
              )}
            </div>
          </div>

          {isOwner && agencyKey?.id && (
            <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-xs text-slate-500">Clé d’invitation</div>
              <div className="mt-1 font-mono text-sm break-all">{agencyKey.id}</div>
              <div className="mt-2 text-xs text-slate-500">
                Créée le {safeDate(agencyKey.created_at)}
              </div>
            </div>
          )}

          <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 font-semibold">
              Membres ({members.length})
            </div>

            {members.length === 0 ? (
              <div className="p-4 text-slate-600">Aucun membre.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map((m) => (
                  <div key={m.user_id} className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {m.users_profile?.full_name || m.user_id}
                      </div>
                      <div className="text-xs text-slate-500">Statut : {m.status || "—"}</div>
                    </div>
                    <div className="flex gap-2">
                      <Badge tone={m.role === "OWNER" ? "green" : "gray"}>{m.role}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
