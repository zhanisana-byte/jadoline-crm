"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;       // "OWNER" | "ADMIN" | "CM" ...
  agency_id: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
  owner_id: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  created_at: string;
  expires_at: string;
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const [role, setRole] = useState<string>("CM");
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("");

  // CM → rejoindre agence
  const [joinAgencyIdInput, setJoinAgencyIdInput] = useState("");

  // Agence → inviter par email
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setOk("✅ Copié.");
      setTimeout(() => setOk(null), 1200);
    } catch {
      setError("Impossible de copier (droits navigateur).");
    }
  }

  async function load() {
    setLoading(true);
    setOk(null);
    setError(null);
    setInviteLink(null);

    const { data, error: uErr } = await supabase.auth.getUser();
    if (uErr || !data?.user) {
      setError("Non authentifié. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    const user = data.user;
    setEmail(user.email ?? "");

    // Profil
    const { data: pRow, error: pErr } = await supabase
      .from("users_profile")
      .select("user_id, full_name, role, agency_id")
      .eq("user_id", user.id)
      .single();

    if (pErr) {
      // fallback insert minimal
      const fallback: ProfileRow = { user_id: user.id, full_name: "", role: "CM", agency_id: null };
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
      setInvites([]);
      setLoading(false);
      return;
    }

    setFullName(pRow?.full_name ?? "");
    setRole((pRow?.role as string) ?? "CM");
    setAgencyId(pRow?.agency_id ?? null);

    // Nom agence (si existante)
    if (pRow?.agency_id) {
      const { data: ag } = await supabase
        .from("agencies")
        .select("id, name, owner_id")
        .eq("id", pRow.agency_id)
        .single();

      setAgencyName((ag as AgencyRow | null)?.name ?? "");
    } else {
      setAgencyName("");
    }

    // Invites (uniquement pour agence)
    if ((pRow?.role === "OWNER" || pRow?.role === "ADMIN") && pRow?.agency_id) {
      const { data: inv } = await supabase
        .from("agency_invites")
        .select("id,email,token,status,created_at,expires_at")
        .eq("agency_id", pRow.agency_id)
        .order("created_at", { ascending: false })
        .limit(20);

      setInvites((inv as InviteRow[]) ?? []);
    } else {
      setInvites([]);
    }

    setLoading(false);
  }

  async function onSaveProfile() {
    setSaving(true);
    setOk(null);
    setError(null);

    try {
      const { data, error: uErr } = await supabase.auth.getUser();
      if (uErr || !data?.user) throw new Error("Non authentifié.");

      const user = data.user;

      const { error: upErr } = await supabase
        .from("users_profile")
        .update({ full_name: fullName.trim() || null })
        .eq("user_id", user.id);

      if (upErr) throw upErr;

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

  // CM → rejoindre agence par Agency ID (UUID)
  async function onRequestJoinByAgencyId() {
    setSaving(true);
    setOk(null);
    setError(null);

    try {
      const value = joinAgencyIdInput.trim();
      if (!value) throw new Error("Veuillez saisir l’Agency ID.");
      if (!isUuid(value)) throw new Error("Agency ID invalide (format UUID attendu).");

      const { error } = await supabase.rpc("join_with_agency_id", { p_agency_id: value });
      if (error) throw error;

      setJoinAgencyIdInput("");
      setOk("✅ Demande traitée : vous êtes maintenant membre de l’agence.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  // Agence → inviter par email (génère lien /invite?token=...)
  async function onInviteByEmail() {
    setSaving(true);
    setOk(null);
    setError(null);
    setInviteLink(null);

    try {
      const clean = inviteEmail.trim().toLowerCase();
      if (!clean) throw new Error("Veuillez saisir un email.");

      const { data, error } = await supabase.rpc("create_agency_invite", { p_email: clean });
      if (error) throw error;

      const token = data as string;
      const origin =
        (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.startsWith("http"))
          ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
          : (typeof window !== "undefined" ? window.location.origin : "");

      const link = `${origin}/invite?token=${encodeURIComponent(token)}`;
      setInviteLink(link);
      setInviteEmail("");

      setOk("✅ Invitation créée. Copiez le lien et envoyez-le.");
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
          <p className="mt-2 muted">Une interface simple : Agence invite, Social Manager rejoint.</p>
        </div>

        <button onClick={load} className="btn btn-ghost">↻ Refresh</button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      {/* Top card */}
      <div className="card p-6 mt-6">
        <div className="profileTop">
          <div className="profileLeft">
            <div className="avatarCircle">{initials}</div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="profileName truncate">{fullName || "Votre nom"}</div>
                <span className="badge badge-gold">{accountTypeLabel}</span>
                {agencyId ? (
                  <span className="badge badge-success">✅ Agence liée</span>
                ) : (
                  <span className="badge badge-info">ℹ️ Aucune agence</span>
                )}
              </div>

              <div className="profileEmail truncate">{email || "—"}</div>

              {agencyId && isAgencyAccount ? (
                <div className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold">Agence :</span>{" "}
                  {agencyName ? agencyName : agencyId}
                </div>
              ) : null}
            </div>
          </div>

          <div className="profileActions">
            <button className="btn btn-ghost" onClick={() => {
              const el = document.getElementById("full_name_input");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              (el as HTMLInputElement | null)?.focus?.();
            }}>
              ✏️ Modifier
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-6">
        {/* Infos */}
        <div className="card p-6">
          <div className="card-title">Informations</div>
          <div className="muted mt-1">Vous pouvez modifier votre nom et votre email.</div>

          <div className="mt-5">
            <label>Nom</label>
            <input
              id="full_name_input"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : Sana Zhani"
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
            <button className="btn btn-primary" disabled={saving} onClick={onSaveProfile}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Right */}
        <div className="card p-6">
          {isAgencyAccount ? (
            <>
              {/* Agence : afficher clé + inviter */}
              <div className="card-title">Votre clé d’agence</div>
              <div className="muted mt-1">
                Donnez cette clé à un Social Manager pour rejoindre votre agence.
              </div>

              <div className="mt-5">
                <label>Agency ID (à partager)</label>
                <div className="idRow">
                  <input className="input" value={agencyId ?? "—"} readOnly />
                  <button className="btn btn-ghost" onClick={() => agencyId && copy(agencyId)}>Copier</button>
                </div>
              </div>

              <hr className="my-5 border-slate-200/70" />

              <div className="card-title">Inviter un Social Manager par email</div>
              <div className="muted mt-1">
                Nous générons un lien sécurisé (vous l’envoyez par WhatsApp/email).
              </div>

              <div className="mt-5">
                <label>Email</label>
                <input
                  className="input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="cm@email.com"
                />
              </div>

              <button className="btn btn-primary mt-4 w-full" disabled={saving} onClick={onInviteByEmail}>
                {saving ? "Création..." : "Créer l’invitation"}
              </button>

              {inviteLink ? (
                <div className="tip-box mt-4">
                  <div style={{ fontWeight: 800 }}>Lien d’invitation</div>
                  <div className="muted mt-1">Copiez/collez ce lien au Social Manager :</div>
                  <div className="idRow mt-3">
                    <input className="input" value={inviteLink} readOnly />
                    <button className="btn btn-ghost" onClick={() => copy(inviteLink)}>Copier</button>
                  </div>
                </div>
              ) : null}

              {invites.length ? (
                <div className="mt-5">
                  <div className="card-title">Dernières invitations</div>
                  <div className="muted mt-1">Statut et email (20 max).</div>

                  <div className="mt-3 space-y-2">
                    {invites.map((it) => (
                      <div key={it.id} className="inviteRow">
                        <div className="min-w-0">
                          <div className="inviteEmail truncate">{it.email}</div>
                          <div className="inviteMeta muted">
                            {new Date(it.created_at).toLocaleString()}
                          </div>
                        </div>

                        <span className={cn(
                          "badge",
                          it.status === "ACCEPTED" && "badge-success",
                          it.status === "PENDING" && "badge-info"
                        )}>
                          {it.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Social Manager : rejoindre agence */}
              <div className="card-title">Rejoindre une agence</div>
              <div className="muted mt-1">
                Saisissez la clé (Agency ID) fournie par l’agence.
              </div>

              <div className="mt-5">
                <label>Agency ID</label>
                <input
                  className="input"
                  value={joinAgencyIdInput}
                  onChange={(e) => setJoinAgencyIdInput(e.target.value)}
                  placeholder="Ex: 9a1683e6-e994-44f5-9688-c51b2198e2a0"
                />
              </div>

              <button className="btn btn-primary mt-4 w-full" disabled={saving} onClick={onRequestJoinByAgencyId}>
                {saving ? "Traitement..." : "Envoyer la demande / Rejoindre"}
              </button>

              <div className="tip-box mt-4">
                <div style={{ fontWeight: 800 }}>Alternative</div>
                <div className="muted mt-1">
                  Si l’agence vous envoie un lien d’invitation, cliquez dessus et acceptez.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const cls = type === "error" ? "alert alert-error" : "alert alert-success";
  return <div className={cls}>{text}</div>;
}
