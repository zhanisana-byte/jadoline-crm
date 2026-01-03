"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MonAgencyCard({ myAgencyId }: { myAgencyId: string | null }) {
  const supabase = createClient();

  const [name, setName] = useState<string>("—");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!myAgencyId) {
        setName("—");
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", myAgencyId)
        .maybeSingle();

      setName(data?.name ?? "—");
      setLoading(false);
    })();
  }, [myAgencyId, supabase]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <h2 className="text-lg font-semibold">Mon agence</h2>
        <p className="text-sm text-slate-500">
          C’est ton agence personnelle (liée à <code>users_profile.agency_id</code>).
        </p>

        <div className="mt-4">
          <label className="text-xs text-slate-500">Nom</label>
          <div className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {loading ? "Chargement..." : name}
          </div>
        </div>
      </div>
    </div>
  );
}
