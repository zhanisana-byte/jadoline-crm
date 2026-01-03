"use client";

import type { ProfileRow } from "./types";

export default function ProfileInfoCard({ profile }: { profile: ProfileRow | null }) {
  const created =
    profile?.created_at ? new Date(profile.created_at).toLocaleString("fr-FR") : "—";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Informations personnelles</h2>
          <p className="text-sm text-slate-500">Nom modifiable, email en lecture seule.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-600">Nom complet</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={profile?.full_name ?? ""}
            readOnly
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Email</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={"(email via auth.users)"}
            readOnly
          />
          <p className="text-xs text-slate-500 mt-1">
            L’email est géré par Supabase Auth (auth.users).
          </p>
        </div>

        <div>
          <label className="text-sm text-slate-600">Créé le</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={created}
            readOnly
          />
        </div>

        <div>
          <label className="text-sm text-slate-600">Email confirmé</label>
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            ✅ Confirmé (si tu es connecté ici)
          </div>
        </div>
      </div>
    </div>
  );
}
