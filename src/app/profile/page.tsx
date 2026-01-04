"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const [joinValue, setJoinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMe() {
    setLoading(true);
    setError(null);
    setOk(null);

    const { data: authData, error: aErr } = await supabase.auth.getUser();
    if (aErr || !authData?.user) {
      setError("Non authentifié. Reconnecte-toi.");
      setLoading(false);
      return;
    }

    const u = authData.user;
    setUserId(u.id);
    setEmail(u.email ?? null);

    const { data: profile, error: pErr } = await supabase
      .from("users_profile")
      .select("full_name, agency_id, role")
      .eq("user_id", u.id)
      .maybeSingle();

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    setFullName(profile?.full_name ?? null);
    setAgencyId(profile?.agency_id ?? null);
    setRole(profile?.role ?? null);

    setLoading(false);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setOk("✅ Copié.");
    setTimeout(() => setOk(null), 900);
  }

  const joinPayload = useMemo(() => {
    const v = joinValue.trim();
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    return uuidLike ? { agency_id: v } : { join_code: v };
  }, [joinValue]);

  async function joinAgency() {
    setError(null);
    setOk(null);

    const v = joinValue.trim();
    if (!v) {
      setError("Colle l’Agency ID ou le Join Code.");
      return;
    }
    if (!userId) {
      setError("User manquant. Reconnecte-toi.");
      return;
    }

    setSaving(true);
    try {
      // 1) Trouver l’agence
      let targetAgencyId: string | null = null;

      if ("agency_id" in joinPayload) {
        // join par agency_id
        const { data, error } = await supabase
          .from("agencies")
          .select("id")
          .eq("id", (joinPayload as any).agency_id)
          .maybeSingle();

        if (error) throw error;
        if (!data?.id) throw new Error("Agence introuvable (ID invalide).");

        targetAgencyId = data.id;
      } else {
        // join par join_code
        const { data, error } = await supabase
          .from("agencies")
          .select("id")
          .eq("join_code", (joinPayload as any).join_code)
          .eq("join_code_active", true)
          .maybeSingle();

        if (error) throw error;
        if (!data?.id) throw new Error("Code invalide ou désactivé.");

        targetAgencyId = data.id;
      }

      // 2) Mettre à jour users_profile (agency_id)
      const { error: upErr } = await supabase
        .from("users_profile")
        .upsert(
          {
            user_id: userId,
            agency_id: targetAgencyId,
          },
          { onConflict: "user_id" }
        );

      if (upErr) throw upErr;

      // 3) S’assurer membre dans agency_members
      // ⚠️ Ton champ role est USER-DEFINED (enum). Ajuste si ton enum n’accepte pas "CM".
      const { error: memErr } = await supabase
        .from("agency_members")
        .upsert(
          {
            user_id: userId,
            agency_id: targetAgencyId,
            role: "CM",
            status: "active",
          } as any,
          { onConflict: "user_id" } // si ça échoue: je te donne alternative
        );

      if (memErr) throw memErr;

      setOk("✅ Agence rejointe avec succès.");
      setJoinValue("");
      await loadMe();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-10">
        <div className="card p-6">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0">Profil</h1>
          <p className="mt-2 muted">
            Infos personnelles + copier IDs + rejoindre une agence.
          </p>
        </div>

        <button onClick={loadMe} disabled={loading} className="btn btn-ghost">
          ↻ Refresh
        </button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-6">
        {/* LEFT: infos */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="card-title">Mes informations</div>
              <div className="muted mt-1">Copie tes identifiants facilement.</div>
            </div>
            <span className="badge badge-info">Profil</span>
          </div>

          <div className="mt-4 grid gap-3">
            <InfoRow label="Nom" value={fullName ?? "—"} onCopy={fullName ? () => copy(fullName) : undefined} />
            <InfoRow label="Email" value={email ?? "—"} onCopy={email ? () => copy(email) : undefined} />
            <InfoRow label="User ID" value={userId ?? "—"} onCopy={userId ? () => copy(userId) : undefined} />
            <InfoRow label="Agency ID" value={agencyId ?? "— (pas encore)"} onCopy={agencyId ? () => copy(agencyId) : undefined} />
            <InfoRow label="Rôle" value={role ?? "—"} />
          </div>

          <div className="tip-box mt-5">
            Tu peux partager ton <b>Agency ID</b> à ton équipe pour qu’ils rejoignent ton agence.
          </div>
        </div>

        {/* RIGHT: join */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="card-title">Rejoindre une agence</div>
              <div className="muted mt-1">Colle l’Agency ID (UUID) ou le Join Code.</div>
            </div>
            <span className="badge badge-success">Join</span>
          </div>

          <div className="mt-5">
            <label>Agency ID / Join Code *</label>
            <input
              className="input"
              value={joinValue}
              onChange={(e) => setJoinValue(e.target.value)}
              placeholder="Ex: 9a1683e6-e994-... OU CODE123"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={joinAgency} disabled={saving} className="btn btn-primary">
              {saving ? "..." : "Rejoindre"}
            </button>
            <button onClick={() => setJoinValue("")} disabled={saving} className="btn btn-ghost">
              Reset
            </button>
          </div>

          <div className="tip-box mt-5">
            Si tu es Owner, partage ton <b>Agency ID</b> à tes CM.
            <br />
            Si tu es CM, colle l’ID donné par l’Owner ici.
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 flex items-center justify-between gap-3"
      style={{ boxShadow: "0 10px 22px rgba(2,6,23,.06)" }}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-sm text-slate-600 break-all">{value}</div>
      </div>

      {onCopy ? (
        <button onClick={onCopy} className="btn btn-ghost">
          Copier
        </button>
      ) : (
        <span className="badge badge-info">—</span>
      )}
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const cls = type === "error" ? "alert alert-error" : "alert alert-success";
  return <div className={cls}>{text}</div>;
}
