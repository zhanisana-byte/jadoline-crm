"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  agency_id: string | null;
};

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  // auth email (depuis auth.users via getUser)
  const [email, setEmail] = useState<string>("");

  // users_profile
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("OWNER");
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // join agency
  const [joinAgencyInput, setJoinAgencyInput] = useState("");

  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    if (pErr) {
      // si pas encore créé, on initialise léger
      // (à condition que RLS autorise l'insert sur users_profile pour soi)
      const fallback: ProfileRow = {
        user_id: u.id,
        full_name: "",
        role: "OWNER",
        agency_id: null,
      };

      const { error: insErr } = await supabase.from("users_profile").insert(fallback);
      if (insErr) {
        setError(`Profil introuvable et création impossible: ${insErr.message}`);
        setLoading(false);
        return;
      }

      setFullName("");
      setRole("OWNER");
      setAgencyId(null);
      setLoading(false);
      return;
    }

    setFullName(pRow?.full_name ?? "");
    setRole((pRow?.role as string) ?? "OWNER");
    setAgencyId(pRow?.agency_id ?? null);

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

  function isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  async function onSaveProfile() {
    if (!userId) return;

    setSaving(true);
    setOk(null);
    setError(null);

    try {
      // 1) update users_profile (nom + rôle)
      const { error: upErr } = await supabase
        .from("users_profile")
        .update({
          full_name: fullName.trim() || null,
          role: role.trim() || "OWNER",
        })
        .eq("user_id", userId);

      if (upErr) throw upErr;

      // 2) update email (auth)
      // ⚠️ Meta/Supabase peut exiger confirmation email.
      // Dans ce cas, l’email ne changera qu’après confirmation.
      const newEmail = email.trim();
      if (newEmail) {
        const { error: mailErr } = await supabase.auth.updateUser({ email: newEmail });
        if (mailErr) {
          // on ne bloque pas le reste
          setError(
            `Profil enregistré, mais email non mis à jour: ${mailErr.message}`
          );
          setSaving(false);
          return;
        }
      }

      setOk("✅ Profil enregistré.");
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  async function onJoinAgency() {
    if (!userId) return;

    setOk(null);
    setError(null);

    const value = joinAgencyInput.trim();
    if (!value) {
      setError("Veuillez saisir l’ID d’agence.");
      return;
    }
    if (!isUuid(value)) {
      setError("ID d’agence invalide (format UUID attendu).");
      return;
    }

    setSaving(true);
    try {
      // Vérifier que l’agence existe
      const { data: ag, error: agErr } = await supabase
        .from("agencies")
        .select("id")
        .eq("id", value)
        .single();

      if (agErr || !ag?.id) {
        throw new Error("Agence introuvable. Vérifiez l’ID fourni par l’admin.");
      }

      // 1) mettre agency_id dans users_profile
      const { error: pErr } = await supabase
        .from("users_profile")
        .update({ agency_id: value })
        .eq("user_id", userId);

      if (pErr) throw pErr;

      // 2) ajouter membre (si table existe + RLS ok)
      // Si une policy bloque, ce n’est pas bloquant pour l’UI, mais on tente.
      await supabase.from("agency_members").insert({
        agency_id: value,
        user_id: userId,
        role: "CM",
        status: "ACTIVE",
      });

      setAgencyId(value);
      setJoinAgencyInput("");
      setOk("✅ Agence rejointe. Vous pouvez maintenant voir les clients autorisés.");
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
          <p className="mt-2 muted">Gérez vos informations et rejoignez une agence.</p>
        </div>

        <button onClick={load} className="btn btn-ghost">
          ↻ Refresh
        </button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      {/* ===== Top Premium Card ===== */}
      <div className="card p-6 mt-6">
        <div className="profileTop">
          <div className="profileLeft">
            <div className="avatarCircle">{initials}</div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="profileName truncate">{fullName || "Votre nom"}</div>
                <span className="badge badge-gold">{role || "OWNER"}</span>
              </div>

              <div className="profileEmail truncate">{email || "—"}</div>
            </div>
          </div>

          <div className="profileActions">
            <button type="button" className="btn btn-ghost" onClick={() => userId && copy(userId)}>
              📋 Copier Votre ID
            </button>

            <button type="button" className="btn btn-ghost" onClick={() => {
              // focus premier champ
              const el = document.getElementById("full_name_input");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              (el as HTMLInputElement | null)?.focus?.();
            }}>
              ✏️ Modifier
            </button>

            <button type="button" className="btn btn-primary" onClick={() => {
              const el = document.getElementById("join_agency_input");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              (el as HTMLInputElement | null)?.focus?.();
            }}>
              🏢 Rejoindre une agence
            </button>
          </div>
        </div>
      </div>

      {/* ===== Bottom grid ===== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-6">
        {/* Informations */}
        <div className="card p-6">
          <div className="card-title">Informations</div>
          <div className="muted mt-1">Tous les champs sont modifiables.</div>

          <div className="mt-5">
            <label>Nom</label>
            <input
              id="full_name_input"
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
            <label>Rôle</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CM">CM</option>
            </select>
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

        {/* Rejoindre agence */}
        <div className="card p-6">
          <div className="card-title">Rejoindre une agence</div>
          <div className="muted mt-1">
            Utilisez l’ID fourni par l’admin de l’agence.
          </div>

          <div className="mt-5">
            <label>ID d’agence</label>
            <input
              id="join_agency_input"
              className="input"
              value={joinAgencyInput}
              onChange={(e) => setJoinAgencyInput(e.target.value)}
              placeholder="Ex: 9a1683e6-e994-44f5-9688-c51b2198e2a0"
            />
          </div>

          <button className="btn btn-primary mt-4 w-full" disabled={saving} onClick={onJoinAgency}>
            {saving ? "Traitement..." : "Rejoindre"}
          </button>

          <div className="tip-box mt-4">
            <div style={{ fontWeight: 700 }}>Info</div>
            <div className="muted mt-1">
              Une fois dans l’agence, vous verrez uniquement les clients autorisés (selon permissions).
            </div>
          </div>

          <div className="mt-4">
            <div className="muted">
              Agence actuelle : <b>{agencyId ?? "Aucune"}</b>
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
