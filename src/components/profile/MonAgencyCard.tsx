"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function MonAgencyCard({ myAgencyId }: { myAgencyId: string | null }) {
  const supabase = createClient();

  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setAgencyName(null);

      if (!myAgencyId) return;

      setLoading(true);
      try {
        // On essaye de récupérer le nom de l'agence (optionnel)
        const { data, error } = await supabase
          .from("agencies")
          .select("name")
          .eq("id", myAgencyId)
          .maybeSingle();

        if (!error) {
          setAgencyName(data?.name ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [myAgencyId, supabase]);

  function copyId() {
    if (!myAgencyId) return;
    navigator.clipboard.writeText(myAgencyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-lg font-semibold">Mon agence</h2>
      <p className="text-sm text-slate-500 mt-1">
        Ton <b>Agency ID</b> personnel à partager pour collaborer.
      </p>

      {!myAgencyId ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Votre profil n’est pas lié à une agence (<code>users_profile.agency_id</code> est NULL).
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-xs text-slate-500">Nom (optionnel)</div>
            <div className="font-semibold">
              {loading ? "Chargement..." : agencyName ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Agency ID</div>

            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-100 rounded-xl px-3 py-2 break-all">
                {myAgencyId}
              </code>
              <button
                onClick={copyId}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs border",
                  copied
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                )}
              >
                {copied ? "Copié ✓" : "Copier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
