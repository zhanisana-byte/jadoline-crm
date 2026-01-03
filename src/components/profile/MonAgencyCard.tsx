"use client";

import React, { useMemo } from "react";
import type { MemberViewRow, AgencyRow } from "@/components/profile/types";
import { humanErr } from "@/components/profile/ui";

type ClientRow = { id: string; name: string; logo_url?: string | null };
type MemberClientAccessRow = { user_id: string; client_id: string };

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function MonAgencyCard(props: {
  myAgency: AgencyRow | null;
  members: MemberViewRow[];
  access: MemberClientAccessRow[];
  clients: ClientRow[];

  busy: boolean;
  isOwner: boolean;

  onDisableMember: (memberUserId: string) => Promise<void>;
  onEnableMember: (memberUserId: string) => Promise<void>;
  onRevokeClientAccess: (memberUserId: string, clientId: string) => Promise<void>;

  setMsg: (txt: string) => void;
}) {
  const {
    myAgency,
    members,
    access,
    clients,
    busy,
    isOwner,
    onDisableMember,
    onEnableMember,
    onRevokeClientAccess,
    setMsg,
  } = props;

  const clientsById = useMemo(() => {
    const m = new Map<string, ClientRow>();
    (clients ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const accessByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    (access ?? []).forEach((a) => {
      if (!m.has(a.user_id)) m.set(a.user_id, []);
      m.get(a.user_id)!.push(a.client_id);
    });
    return m;
  }, [access]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <h2 className="text-lg font-semibold">Mon agence</h2>
        <p className="text-sm text-slate-500">
          Membres + clients gérés. Tu peux révoquer l’accès client.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">Agence</div>
          <div className="text-lg font-semibold">{myAgency?.name ?? "—"}</div>
        </div>

        {members.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Aucun membre trouvé.
          </div>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => {
              const fullName = m.users_profile?.full_name ?? "Sans nom";
              const status = (m.status ?? "").toLowerCase(); // active/disabled
              const isActive = status === "active";

              const memberClientIds = accessByUser.get(m.user_id) ?? [];
              const memberClients = memberClientIds
                .map((id) => clientsById.get(id))
                .filter(Boolean) as ClientRow[];

              return (
                <li key={m.user_id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{fullName}</div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                          {m.role}
                        </span>

                        <span
                          className={cn(
                            "text-[11px] px-2 py-1 rounded-full border",
                            isActive
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {isActive ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <button
                            disabled={busy}
                            onClick={async () => {
                              try {
                                await onDisableMember(m.user_id);
                                setMsg("✅ Membre désactivé.");
                              } catch (e: any) {
                                setMsg(humanErr(e));
                              }
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-xs font-semibold",
                              busy
                                ? "border-slate-200 text-slate-400"
                                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            )}
                          >
                            Désactiver
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={async () => {
                              try {
                                await onEnableMember(m.user_id);
                                setMsg("✅ Membre réactivé.");
                              } catch (e: any) {
                                setMsg(humanErr(e));
                              }
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-xs font-semibold"
                            )}
                          >
                            Réactiver
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-slate-500">Clients gérés</div>

                    {memberClients.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-500">
                        Aucun client assigné.
                      </div>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {memberClients.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <span className="text-sm font-medium">{c.name}</span>

                            {isOwner && (
                              <button
                                disabled={busy}
                                onClick={async () => {
                                  try {
                                    await onRevokeClientAccess(m.user_id, c.id);
                                    setMsg("✅ Accès client révoqué.");
                                  } catch (e: any) {
                                    setMsg(humanErr(e));
                                  }
                                }}
                                className={cn(
                                  "text-xs rounded-full border px-2 py-1",
                                  busy
                                    ? "border-slate-200 text-slate-400"
                                    : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                                )}
                              >
                                Retirer
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
