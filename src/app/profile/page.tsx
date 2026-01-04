"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Données profil
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("");

  // Champs éditables
  const [editName, setEditName] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");

  // Join agency
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
      setError("Vous n’êtes pas authentifié(e). Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    const u = authData.user;
    setUserId(u.id);
    setCurrentEmail(u.email ?? null);
    setEditEmail(u.email ?? "");

    const { data: profile, error: pErr } = await supabase
      .from("users_profile")
      .select("full_name, role, agency_id")
      .eq("user_id", u.id)
      .maybeSingle();

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    setFullName(profile?.full_name ?? "");
    setEditName(profile?.full_name ?? "");
    setRole(profile?.role ?? "");

    setLoading(false);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setOk("✅ Copié.");
    setTimeout(() => setOk(null), 900);
  }

  function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  async function saveProfile() {
    setError(null);
    setOk(null);

    if (!userId) {
      setError("Identifiant utilisateur manquant. Veuillez vous reconnecter.");
      return;
    }

    const nextName = editName.trim();
    const nextEmail = editEmail.trim().toLowerCase();

    if (!nextName) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!isValidEmail(nextEmail)) {
      setError("Email invalide.");
      return;
    }

    setSaving(true);
    try {
      // 1) Update Nom dans users_profile
      const { error: upErr } = await supabase
        .from("users_profile")
        .upsert({ user_id: userId, full_name: nextName }, { onConflict: "user_id" });

      if (upErr) throw upErr;

      // 2) Update Email via Supabase Auth (peut demander confirmation par email)
      if (currentEmail && nextEmail !== currentEmail) {
        const { error: authErr } = await supabase.auth.updateUser({ email: nextEmail });
        if (authErr) {
          // Important : si confirmation requise, Supabase renvoie parfois un message spécifique
          throw authErr;
        }
        setOk("✅ Email mis à jour. Vérifiez votre boîte mail si une confirmation est demandée.");
      } else {
        setOk("✅ Profil mis à jour.");
      }

      await loadMe();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
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
      setError("Veuillez coller l’ID de l’agence (ou un code) puis réessayer.");
      return;
    }
    if (!userId) {
      setError("Identifiant utilisateur manquant. Veuillez vous reconnecter.");
      return;
    }

    setSaving(true);
    try {
      // 1) Trouver l’agence
      let targetAgencyId: string | null = null;

      if ("agency_id" in joinPayload) {
        const { data, error } = await supabase
          .from("agencies")
          .select("id")
          .eq("id", (joinPayload as any).agency_id)
          .maybeSingle();

        if (error) throw error;
        if (!data?.id) throw new Error("Agence introuvable (ID invalide).");
        targetAgencyId = data.id;
      } else {
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

      // 2) Mettre à jour users_profile agency_id
      const { error: profErr } = await supabase
        .from("users_profile")
        .upsert({ user_id: userId, agency_id: targetAgencyId }, { onConflict: "user_id" });

      if (profErr) throw profErr;

      // 3) S’assurer membre dans agency_members
      // ⚠️ role est un enum chez vous -> ajustez si votre enum n’accepte pas "CM".
      const { error: memErr } = await supabase
        .from("agency_members")
        .upsert(
          { user_id: userId, agency_id: targetAgencyId, role: "CM", status: "active" } as any,
          { onConflict: "user_id" }
        );

      if (memErr) throw memErr;

      setOk("✅ Vous avez rejoint l’agence avec succès.");
      setJoinValue("");
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
            Vos informations, votre ID et la possibilité de rejoindre une agence.
          </p>
        </div>

        <button onClick={loadMe} disabled={loading || saving} className="btn btn-ghost">
          ↻ Actualiser
        </button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-6">
        {/* LEFT: Infos + édition */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="card-title">Vos informations</div>
              <div className="muted mt-1">Vous pouvez modifier le nom et l’email.</div>
            </div>
            <span className="badge badge-info">Profil</span>
          </div>

          <div className="mt-4 grid gap-3">
            <InfoRow
              label="Votre ID"
              value={userId ?? "—"}
              onCopy={userId ? () => copy(userId) : undefined}
            />

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3">
              <label>Nom</label>
              <input
                className="input mt-1"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Votre nom"
              />
              <div className="text-xs text-slate-500 mt-1">
                Actuel : {fullName || "—"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3">
              <label>Email</label>
              <input
                className="input mt-1"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="ex: you@email.com"
              />
              <div className="text-xs text-slate-500 mt-1">
                Actuel : {currentEmail || "—"} {currentEmail ? "" : "(non défini)"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Si Supabase exige une confirmation, vous recevrez un email.
              </div>
            </div>

            <InfoRow label="Rôle" value={role || "—"} />
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={saveProfile} disabled={saving} className="btn btn-primary">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* RIGHT: rejoindre agence */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="card-title">Rejoindre une agence</div>
              <div className="muted mt-1">Collez l’ID de l’agence ou un code.</div>
            </div>
            <span className="badge badge-success">Join</span>
          </div>

          <div className="mt-5">
            <label>ID agence / Code</label>
            <input
              className="input"
              value={joinValue}
              onChange={(e) => setJoinValue(e.target.value)}
              placeholder="Ex: 9a1683e6-e994-... ou CODE123"
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
            Pour rejoindre une agence, collez l’ID fourni par l’administrateur.
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
