"use client";

import React, { useState } from "react";
import { Btn, Card, CardBody, CardHeader } from "./ui";

export default function JoinAgencyCard({
  busy,
  onJoin,
}: {
  busy: boolean;
  onJoin: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");

  return (
    <Card>
      <CardHeader title="Rejoindre une agence" subtitle="Entrer une clé d’invitation reçue." />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="md:col-span-2 w-full border border-slate-200 rounded-xl px-3 py-2"
            placeholder="Clé d’agence"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Btn
            variant="primary"
            disabled={busy || !code.trim()}
            onClick={async () => {
              await onJoin(code.trim());
              setCode("");
            }}
          >
            Rejoindre
          </Btn>
        </div>

        <div className="text-xs text-slate-500">
          Cette action ne crée pas d’agence : elle rejoint un espace existant.
        </div>
      </CardBody>
    </Card>
  );
}
