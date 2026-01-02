"use client";

import React, { useState } from "react";
import { Badge, Btn, Card, CardBody, CardHeader, safeDate } from "./ui";
import type { ProfileRow } from "./types";

export default function ProfileInfoCard({
  profile,
  email,
  emailConfirmed,
  busy,
  onSaveName,
}: {
  profile: ProfileRow;
  email: string;
  emailConfirmed: boolean;
  busy: boolean;
  onSaveName: (newName: string) => Promise<void>;
}) {
  const [editName, setEditName] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");

  return (
    <Card>
      <CardHeader
        title="Informations personnelles"
        subtitle="Nom modifiable, email en lecture seule."
        right={
          !editName ? (
            <Btn onClick={() => setEditName(true)}>Modifier</Btn>
          ) : (
            <div className="flex gap-2">
              <Btn
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  await onSaveName(fullName);
                  setEditName(false);
                }}
              >
                Enregistrer
              </Btn>
              <Btn
                disabled={busy}
                onClick={() => {
                  setEditName(false);
                  setFullName(profile.full_name ?? "");
                }}
              >
                Annuler
              </Btn>
            </div>
          )
        }
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Nom complet</label>
            <input
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
              value={fullName}
              disabled={!editName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
              value={email}
              disabled
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Créé le</label>
            <input
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
              value={safeDate(profile.created_at)}
              disabled
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Email confirmé</label>
            <div className="mt-2">
              <Badge tone={emailConfirmed ? "green" : "amber"}>
                {emailConfirmed ? "✅ Confirmé" : "❌ Non confirmé"}
              </Badge>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
