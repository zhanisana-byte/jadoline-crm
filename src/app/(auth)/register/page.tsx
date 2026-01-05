import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            Chargement...
          </div>
        </div>
      }
    >
      <RegisterClient />
    </Suspense>
  );
}
