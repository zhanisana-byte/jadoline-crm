"use client";

export default function ProfileInfoCard({
  profile,
  email,
}: {
  profile: {
    full_name: string | null;
    created_at: string | null;
  };
  email: string;
}) {
  const created = profile.created_at
    ? new Date(profile.created_at).toLocaleString()
    : "—";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Informations personnelles</h2>
          <p className="text-sm text-slate-500">Nom modifiable, email en lecture seule.</p>
        </div>
      </div>

      <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500">Nom complet</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={profile.full_name ?? ""}
            readOnly
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">Email</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={email}
            readOnly
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">Créé le</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={created}
            readOnly
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">Email confirmé</label>
          <div className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            ✅ Confirmé
          </div>
        </div>
      </div>
    </div>
  );
}
