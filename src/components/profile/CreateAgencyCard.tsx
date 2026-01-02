"use client";

import React, { useState } from "react";
import { Btn, Card, CardBody, CardHeader } from "./ui";

export default function CreateAgencyCard({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");

  return (
    <Card>
      <CardHeader title="Créer une agence" subtitle="Créer ton propre espace de travail." />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2"
            placeholder="Nom de l’agence (ex: Dealink)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Btn
            variant="primary"
            disabled={busy || !name.trim()}
            onClick={async () => {
              await onCreate(name.trim());
              setName("");
            }}
          >
            Créer
          </Btn>
        </div>

        <div className="text-xs text-slate-500">
          Cette action est indépendante de “Rejoindre une agence”.
        </div>
      </CardBody>
    </Card>
  );
}
