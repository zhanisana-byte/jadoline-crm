// src/app/(auth)/callback/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function CallbackPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CallbackClient />
    </Suspense>
  );
}

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h1 className="text-xl font-semibold">Confirmation…</h1>
        <p className="text-sm text-slate-500 mt-2">
          Chargement de la session, veuillez patienter.
        </p>
      </div>
    </div>
  );
}
