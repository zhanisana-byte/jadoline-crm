import { Suspense } from "react";
import ClientsPageClient from "./page_client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="card p-6">
          <div className="text-lg font-semibold">Chargement…</div>
          <div className="muted mt-1">Préparation du module Clients</div>
        </div>
      }
    >
      <ClientsPageClient />
    </Suspense>
  );
}
