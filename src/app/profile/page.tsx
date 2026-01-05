"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type AgencyRow = {
  id: string;
  name: string | null;
  join_code?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
};

type ProfileRow = {
  id: string; // same as auth.user.id
  full_name?: string | null;
  email?: string | null;
  agency_id?: string | null;
  account_type?: string | null; // "AGENCY" | "CM" ...
  created_at?: string | null;
};

type InvitationRow = {
  id: string;
  status?: string | null; // "pending"
};

const COLORS = [
  "#0B1222", "#111827", "#1F2937", "#334155",
  "#6D28D9", "#4F46E5", "#2563EB", "#0891B2",
  "#16A34A", "#B45309", "#BE123C", "#7C2D12"
];

function clsx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

function formatDate(ts?: string | null) {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    return d.toLocaleString("fr-FR");
  } catch {
    return ts;
  }
}

export default function ProfileClient() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [agency, setAgency] = useState<AgencyRow | null>(null);

  const [pendingInvites, setPendingInvites] = useState<number>(0);

  const [editAgency, setEditAgency] = useState(false);
  const [agencyName, setAgencyName] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const brandColor = useMemo(() => agency?.brand_color || "#0B1222", [agency?.brand_color]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        if (!authData?.user) {
          router.push("/login");
          return;
        }

        const user = authData.user;

        // ✅ 1) PROFILE
        // CHANGE ICI si ta table = "profiles" ou "users_profile"
        const { data: prof, error: profErr } = await supabase
          .from("users_profile")
          .select("id, full_name, agency_id, account_type, created_at")
          .eq("id", user.id)
          .single();

        // fallback si table vide au début
        const p: ProfileRow = {
          id: user.id,
          full_name: (prof as any)?.full_name ?? user.user_metadata?.full_name ?? "",
          email: user.email ?? "",
          agency_id: (prof as any)?.agency_id ?? null,
          account_type: (prof as any)?.account_type ?? user.user_metadata?.account_type ?? "AGENCY",
          created_at: (prof as any)?.created_at ?? user.created_at ?? null,
        };

        // ✅ 2) AGENCY (si agence_id existe)
        let a: AgencyRow | null = null;
        if (p.agency_id) {
          // CHANGE ICI: table agencies + colonnes
          const { data: ag, error: agErr } = await supabase
            .from("agencies")
            .select("id, name, join_code, logo_url, brand_color")
            .eq("id", p.agency_id)
            .single();
          if (agErr) throw agErr;
          a = ag as any;
        }

        // ✅ 3) INVITATIONS (badge rouge)
        // CHANGE ICI: table invitations + champs
        const { count, error: invErr } = await supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("to_user_id", user.id)
          .eq("status", "pending");
        if (invErr) {
          // si tu n’as pas encore la table → pas bloquant
          // console.log(invErr.message);
        }

        if (!mounted) return;
        setProfile(p);
        setAgency(a);
        setAgencyName(a?.name ?? "");
        setPendingInvites(count ?? 0);
      } catch (e: any) {
        if (!mounted) return;
        setToast({ type: "error", msg: e?.message ?? "Erreur chargement profil" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: "success", msg: "Copié ✅" });
    } catch {
      setToast({ type: "error", msg: "Impossible de copier" });
    }
  }

  async function saveAgencyName() {
    if (!agency?.id) return;
    const name = agencyName.trim();
    if (!name) {
      setToast({ type: "error", msg: "Nom agence invalide" });
      return;
    }
    try {
      setSaving(true);
      setToast(null);

      // CHANGE ICI: sécurité owner_id si tu veux verrouiller
      const { error } = await supabase
        .from("agencies")
        .update({ name })
        .eq("id", agency.id);

      if (error) throw error;

      setAgency((prev) => (prev ? { ...prev, name } : prev));
      setEditAgency(false);
      setToast({ type: "success", msg: "Nom agence mis à jour ✅" });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur update agence" });
    } finally {
      setSaving(false);
    }
  }

  async function setColor(color: string) {
    if (!agency?.id) return;
    try {
      setSaving(true);
      setToast(null);

      const { error } = await supabase
        .from("agencies")
        .update({ brand_color: color })
        .eq("id", agency.id);

      if (error) throw error;

      setAgency((prev) => (prev ? { ...prev, brand_color: color } : prev));
      setToast({ type: "success", msg: "Couleur enregistrée ✅" });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur couleur" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!agency?.id) return;

    try {
      setSaving(true);
      setToast(null);

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `agency/${agency.id}.${ext}`;

      // ✅ bucket conseillé: "public" ou "logos"
      // CHANGE ICI: bucket name
      const bucket = "logos";

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // CHANGE ICI: colonne logo_url
      const { error: dbErr } = await supabase
        .from("agencies")
        .update({ logo_url: publicUrl })
        .eq("id", agency.id);

      if (dbErr) throw dbErr;

      setAgency((prev) => (prev ? { ...prev, logo_url: publicUrl } : prev));
      setToast({ type: "success", msg: "Logo mis à jour ✅" });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur upload logo" });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="profilePage">
        <div className="profileShell">
          <div className="profileCard p-6">
            <div className="skeleton h-6 w-56" />
            <div className="skeleton h-4 w-80 mt-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
              <div className="skeleton h-20" />
              <div className="skeleton h-20" />
              <div className="skeleton h-20" />
              <div className="skeleton h-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const initials =
    (profile?.full_name?.trim()?.[0] || profile?.email?.trim()?.[0] || "U").toUpperCase();

  const hasLogo = !!agency?.logo_url;

  return (
    <div className="profilePage">
      <div className="profileShell">
        {/* Header */}
        <div className="profileHeader">
          <div className="profileIdentity">
            <div className="brandAvatar" style={{ background: brandColor }}>
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agency!.logo_url!} alt="Logo" className="brandAvatarImg" />
              ) : (
                <span className="brandAvatarTxt">{initials}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="profileTitle">
                  {profile?.full_name?.trim() ? profile?.full_name : "Votre profil"}
                </h1>

                <span className="pill">
                  {String(profile?.account_type || "ACCOUNT").toUpperCase()}
                </span>

                {/* Notifications icon + badge rouge */}
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => router.push("/dashboard/notifications")}
                  title="Notifications"
                >
                  <span className="iconBell">🔔</span>
                  {pendingInvites > 0 && <span className="badgeDot" />}
                </button>
              </div>

              <div className="profileMeta">
                <span className="mono">{profile?.email}</span>
                <span className="dotSep">•</span>
                <span>Créé le {formatDate(profile?.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="profileHeaderActions">
            <button className="btnGhost" onClick={() => router.push("/dashboard/notifications")}>
              Ouvrir notifications
              {pendingInvites > 0 && <span className="pillDanger ml-2">{pendingInvites}</span>}
            </button>
            <button className="btnDanger" onClick={signOut}>
              Déconnexion
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="profileGrid">
          {/* LEFT: Agency */}
          <div className="profileCard">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Agence</div>
                <div className="cardDesc">Votre identité “vendable” : nom + logo + couleur.</div>
              </div>

              {!editAgency ? (
                <button className="btn" onClick={() => setEditAgency(true)}>
                  Modifier
                </button>
              ) : (
                <div className="flex gap-2">
                  <button className="btn" disabled={saving} onClick={saveAgencyName}>
                    {saving ? "En cours..." : "Enregistrer"}
                  </button>
                  <button
                    className="btnGhost"
                    onClick={() => {
                      setEditAgency(false);
                      setAgencyName(agency?.name ?? "");
                    }}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            <div className="cardBody">
              <div className="fieldGrid">
                <div className="field">
                  <label>Nom de l’agence</label>
                  {!editAgency ? (
                    <div className="valueBox">{agency?.name || "—"}</div>
                  ) : (
                    <input
                      className="inputLux"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="Ex: Jadoline Agency"
                    />
                  )}
                </div>

                <div className="field">
                  <label>ID agence</label>
                  <div className="valueRow">
                    <div className="valueBox mono">{agency?.id || "—"}</div>
                    {agency?.id && (
                      <button className="miniBtn" onClick={() => copy(agency.id)}>
                        Copier
                      </button>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>Code invitation</label>
                  <div className="valueRow">
                    <div className="valueBox mono">{agency?.join_code || "—"}</div>
                    {agency?.join_code && (
                      <button className="miniBtn" onClick={() => copy(agency.join_code!)}>
                        Copier
                      </button>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>Logo</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo(f);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    />
                    <button className="btn" onClick={() => fileRef.current?.click()} disabled={saving}>
                      {saving ? "Upload..." : "Uploader logo"}
                    </button>

                    {!hasLogo && (
                      <span className="hint">
                        Pas de logo ? Choisissez une couleur (bouton ci-dessous).
                      </span>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>Couleur (si pas de logo)</label>
                  <div className="colorRow">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        className={clsx("colorDot", agency?.brand_color === c && "active")}
                        style={{ background: c }}
                        onClick={() => setColor(c)}
                        title={c}
                        type="button"
                        disabled={saving}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Account */}
          <div className="profileCard">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Compte</div>
                <div className="cardDesc">Infos utilisateur (email en lecture).</div>
              </div>
            </div>

            <div className="cardBody">
              <div className="fieldGrid">
                <div className="field">
                  <label>Nom</label>
                  <div className="valueBox">{profile?.full_name || "—"}</div>
                </div>

                <div className="field">
                  <label>Email</label>
                  <div className="valueBox mono">{profile?.email || "—"}</div>
                </div>

                <div className="field">
                  <label>Type</label>
                  <div className="valueBox">
                    <span className="pill">{String(profile?.account_type || "ACCOUNT").toUpperCase()}</span>
                  </div>
                </div>

                <div className="field">
                  <label>Invitations</label>
                  <div className="valueBox">
                    {pendingInvites > 0 ? (
                      <span className="pillDanger">En attente: {pendingInvites}</span>
                    ) : (
                      <span className="pillOk">Aucune</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="quickActions">
                <button className="btnGhost" onClick={() => router.push("/dashboard/notifications")}>
                  Gérer invitations / notifications
                </button>
                <button className="btn" onClick={() => copy(profile?.id || "")} disabled={!profile?.id}>
                  Copier mon User ID
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={clsx("toast", toast.type === "success" ? "toastOk" : "toastErr")}>
            {toast.msg}
            <button className="toastX" onClick={() => setToast(null)} aria-label="close">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
