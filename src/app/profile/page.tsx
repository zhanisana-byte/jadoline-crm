"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  agency_id: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
  owner_id: string | null;
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  // users_profile
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("CM");
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // agence principale
  const [agencyName, setAgencyName] = useState<string>("");

  // rejoindre autre agence (sous-traitance)
  const [joinAgencyInput, setJoinAgencyInput] = useState("");

  // switch to agency
  const [switchAgencyName, setSwitchAgencyName] = useState("");

  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Type de compte (dérivé du role)
  const isAgencyAccount = useMemo(() => role === "OWNER" || role === "ADMIN", [role]);
  const accountTypeLabel = useMemo(() => (isAgencyAccount ? "Agence" : "Social Manager"), [isAgencyAccount]);

  const initials = useMemo(() => {
    const n = (fullName || "").trim();
    if (!n) return "U";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = (parts[0]?.[0] || "U").toUpperCase();
    const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
    return (a + b).slice(0, 2);
  }, [fullName]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setOk(null);
    setError(null);

    const { data, error: aErr } = await supabase.auth.getUser();
    if (aErr || !data?.user) {
      setError("Non authentifié. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    const u = data.user;
    setUserId(u.id);
    setEmail(u.email ?? "");

    const { data: pRow, error: pErr } = await supabase
      .from("users_profile")
      .select("user_id, full_name, role, agency_id")
      .eq("user_id", u.id)
      .single();

    // si profil absent → création minimale
    if (pErr) {
      const fallback: ProfileRow = {
        user_id: u.id,
        full_name: "",
        role: "CM",
        agency_id: null,
      };
      const { error: insErr } = await supabase.from("users_profile").insert(fallback);
      if (insErr) {
        setError(`Profil introuvable et création impossible: ${insErr.message}`);
        setLoading(false);
        return;
      }

      setFullName("");
      setRole("CM");
      setAgencyId(null);
      setAgencyName("");
      setLoading(false);
      return;
    }

    setFullName(pRow?.full_name ?? "");
    setRole((pRow?.role as string) ?? "CM");
    setAgencyId(pRow?.agency_id ?? null);

    // charger le nom d’agence principale si existante
    if (pRow?.agency_id) {
      const { data: a, error: agErr } = await supabase
        .from("agencies")
        .select("id, name, owner_id")
        .eq("id", pRow.agency_id)
        .single();

      if (!agErr && a) {
        const ag = a as AgencyRow;
        setAgencyName(ag.name ?? "");
      } else {
        setAgencyName("");
      }
    } else {
      setAgencyName("");
    }

    setLoading(false);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setOk("✅ Copié.");
      setTimeout(() => setOk(null), 1200);
    } catch {
      setError("Impossible de copier. (droits navigateur)");
    }
  }

  async function onSaveProfile() {
    if (!userId) return;

    setSaving(true);
    setOk(null);
    setError(null);

    try {
      // update users_profile (nom)
      const { error: upErr } = await supabase
        .from("users_profile")
        .update({ full_name: fullName.trim() || null })
        .eq("user_id", userId);
      if (upErr) throw upErr;

      // update email (auth)
      const newEmail = email.trim();
      if (newEmail) {
        const { error: mailErr } = await supabase.auth.updateUser({ email: newEmail });
        if (mailErr) {
          setError(`Profil enregistré, mais email non mis à jour: ${mailErr.message}`);
          setSaving(false);
          return;
        }
      }

      setOk("✅ Profil enregistré.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Rejoindre une autre agence en sous-traitance (même pour agence)
  async function onJoinAgency() {
    if (!userId) return;

    setOk(null);
    setError(null);

    const value = joinAgencyInput.trim();
    if (!value) {
      setError("Veuillez saisir l’Agency ID.");
      return;
    }
    if (!isUuid(value)) {
      setError("Agency ID invalide (format UUID attendu).");
      return;
    }

    setSaving(true);
    try {
      // on utilise votre RPC existante (recommandé)
      const { error: joinErr } = await supabase.rpc("join_with_agency_id", {
        p_agency_id: value,
      });

      if (joinErr) {
        throw joinErr;
      }

      setJoinAgencyInput("");
      setOk("✅ Agence rejointe en sous-traitance.");
      // On ne change PAS agency_id principal ici
      // (votre système multi-agence se gère via agency_members / member_client_access)
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Switch Social Manager → Agence (créer son agence principale)
  async function onSwitchToAgency() {
    setOk(null);
    setError(null);

    const n = switchAgencyName.trim();
    if (!n) {
      setError("Veuillez saisir le nom de votre agence.");
      return;
    }

    setSaving(true);
    try {
      const { error: swErr } = await supabase.rpc("switch_to_agency", {
        p_agency_name: n,
      });
      if (swErr) throw swErr;

      setSwitchAgencyName("");
      setOk("✅ Votre compte est maintenant une Agence.");
      await load();
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
            Gérez vos informations, votre type de compte et la sous-traitance.
          </p>
        </div>

        <button onClick={load} className="btn btn-ghost">
          ↻ Refresh
        </button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      {/* TOP CARD */}
      <div className="card p-6 mt-6">
        <div className="profileTop">
          <div className="profileLeft">
            <div className="avatarCircle">{initials}</div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="profileName truncate">{fullName || "Votre nom"}</div>
                <span className="badge badge-gold">{accountTypeLabel}</span>

                {agencyId ? (
                  <span className="badge badge-success">✅ Agence principale</span>
                ) : (
                  <span className="badge badge-info">ℹ️ Sans agence principale</span>
                )}
              </div>

              <div className="profileEmail truncate">{email || "—"}</div>

              {agencyId ? (
                <div className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold">Agence principale :</span>{" "}
                  {agencyName ? agencyName : agencyId}
                </div>
              ) : null}
            </div>
          </div>

          <div className="profileActions">
            <button type="button" className="btn btn-ghost" onClick={() => userId && copy(userId)}>
              📋 Copier Votre ID
            </button>

            {agencyId ? (
              <button type="button" className="btn btn-ghost" onClick={() => agencyId && copy(agencyId)}>
                🏢 Copier Agency ID
              </button>
            ) : null}

            {!isAgencyAccount ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const el = document.getElementById("switch_agency_name");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  (el as HTMLInputElement | null)?.focus?.();
                }}
              >
                🚀 Passer en Agence
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-6">
        {/* Informations */}
        <div className="card p-6">
          <div className="card-title">Informations</div>
          <div className="muted mt-1">Tous les champs sont modifiables.</div>

          <div className="mt-5">
            <label>Nom</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Sana Zhani"
            />
          </div>

          <div className="mt-4">
            <label>Email</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: vous@email.com"
            />
            <div className="muted mt-2">
              Si Supabase exige confirmation, un email de validation peut être envoyé.
            </div>
          </div>

          <div className="mt-4">
            <label>Type de compte</label>
            <input className="input" value={accountTypeLabel} readOnly />
          </div>

          <div className="mt-5">
            <label>Votre ID</label>
            <div className="idRow">
              <input className="input" value={userId ?? ""} readOnly />
              <button className="btn btn-ghost" onClick={() => userId && copy(userId)}>
                Copier
              </button>
            </div>
          </div>

          <div className="mt-5">
            <button className="btn btn-primary" disabled={saving} onClick={onSaveProfile}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Droite: Switch + Sous-traitance + (si agence: info agence) */}
        <div className="card p-6">
          {/* Switch en agence (uniquement Social Manager) */}
          {!isAgencyAccount ? (
            <>
              <div className="card-title">Créer votre agence</div>
              <div className="muted mt-1">
                Transformez votre compte actuel en agence (sans changer votre ID).
              </div>

              <div className="mt-5">
                <label>Nom de votre agence</label>
                <input
                  id="switch_agency_name"
                  className="input"
                  value={switchAgencyName}
                  onChange={(e) => setSwitchAgencyName(e.target.value)}
                  placeholder="Ex : Sana Com"
                />
              </div>

              <button className="btn btn-primary mt-4 w-full" disabled={saving} onClick={onSwitchToAgency}>
                {saving ? "Traitement..." : "Créer mon agence"}
              </button>

              <div className="tip-box mt-4">
                <div style={{ fontWeight: 700 }}>Info</div>
                <div className="muted mt-1">
                  Après création, vous pourrez ajouter des clients et inviter des Social Managers.
                </div>
              </div>

              <hr className="my-5 border-slate-200/70" />
            </>
          ) : (
            <>
              <div className="card-title">Votre agence principale</div>
              <div className="muted mt-1">Partagez ces infos à votre équipe.</div>

              <div className="mt-5">
                <label>Nom de l’agence</label>
                <input className="input" value={agencyName || "—"} readOnly />
              </div>

              <div className="mt-4">
                <label>Agency ID</label>
                <div className="idRow">
                  <input className="input" value={agencyId ?? ""} readOnly />
                  <button className="btn btn-ghost" onClick={() => agencyId && copy(agencyId)}>
                    Copier
                  </button>
                </div>
              </div>

              <hr className="my-5 border-slate-200/70" />
            </>
          )}

          {/* ✅ Sous-traitance (pour TOUS) */}
          <div className="card-title">Sous-traitance : rejoindre une autre agence</div>
          <div className="muted mt-1">
            Même une agence peut rejoindre une autre agence via Agency ID.
          </div>

          <div className="mt-5">
            <label>Agency ID</label>
            <input
              className="input"
              value={joinAgencyInput}
              onChange={(e) => setJoinAgencyInput(e.target.value)}
              placeholder="Ex: 9a1683e6-e994-44f5-9688-c51b2198e2a0"
            />
          </div>

          <button className="btn btn-ghost mt-4 w-full" disabled={saving} onClick={onJoinAgency}>
            {saving ? "Traitement..." : "Rejoindre en sous-traitance"}
          </button>

          <div className="tip-box mt-4">
            <div style={{ fontWeight: 700 }}>Conseil</div>
            <div className="muted mt-1">
              Cette action ajoute un membership (agency_members) et ne change pas votre agence principale.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const cls = type === "error" ? "alert alert-error" : "alert alert-success";
  return <div className={cls}>{text}</div>;
}
