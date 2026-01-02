"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "./ui";

export default function QuickRecapCard() {
  return (
    <Card>
      <CardHeader title="Récap rapide" />
      <CardBody>
        <ul className="text-sm text-slate-700 space-y-2">
          <li>✅ Un utilisateur peut être dans plusieurs agences</li>
          <li>🔑 La clé appartient à l’agence</li>
          <li>👥 Un CM peut travailler sur plusieurs agences</li>
        </ul>
      </CardBody>
    </Card>
  );
}
