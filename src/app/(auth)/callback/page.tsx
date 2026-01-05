import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8">Chargement...</p>}>
      <CallbackClient />
    </Suspense>
  );
}
