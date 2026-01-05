// src/components/profile/ProfileInfoCard.tsx
"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function ProfileInfoCard({
  profile,
  email,
  onSaved,
}: {
  profile: {
    full_name: string | null;
    created_at: string | null;
  };
  email: string;
  onSaved?: () => void; // optionnel: pour refresh parent
}) {
  const supabase = useMemo(() => createClient(), []);

  const created = profile.created_at
    ? new Date(profile.created_at).toLocaleString()
    : "—";

  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(profile.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);

    try {
      const { data: uRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const user = uRes.user;
      if (!user) throw new Error("Vous devez être connecté(e).");

      const clean = name.trim();
      if (clean.length < 2) {
        setMsg("Veuillez saisir un nom valide.");
        return;
      }

      const { error } = await supabase
        .from("users_profile")
        .update({ full_name: clean })
        .eq("user_id", user.id);

      if (error) throw error;

      setMsg("Enregistré ✅");
      setEdit(false);
      onSaved?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Une erreur est survenue.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Informations personnelles</h2>
          <p className="text-sm text-slate-500">
            Modifiez votre nom. L’email est en lecture seule.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {edit ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setName(profile.full_name ?? "");
                  setEdit(false);
                  setMsg(null);
                }}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !name.trim()}
                className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEdit(true)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nom */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-500">Nom complet</div>
          <input
            className={cn(
              "mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
              edit
                ? "border-slate-200 bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                : "border-slate-100 bg-slate-50 text-slate-700"
            )}
            value={name}
            readOnly={!edit}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre nom"
          />
        </div>

        {/* Email */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-500">Email</div>
          <input
            className="mt-2 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            value={email}
            readOnly
          />
        </div>

        {/* Créé le */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-500">Créé le</div>
          <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {created}
          </div>
        </div>

        {/* Email confirmé */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-500">Statut email</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            ✅ Confirmé
          </div>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div
          className={cn(
            "mt-4 rounded-xl border px-3 py-2 text-sm",
            msg.includes("✅")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
