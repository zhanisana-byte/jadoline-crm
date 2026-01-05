"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  agency_id: string | null;
  account_type: "AGENCY" | "SOCIAL_MANAGER" | string | null;
  role: string | null;
};

type AgencyRow = { id: string; name: string };

type InviteRow = {
  id: string;
  agency_id: string;
  email: string;
  token: string;
  status: string;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  status: string | null;
  created_at: string | null;
  profile: { full_name: string | null; avatar_url: string | null; account_type: string | null } | null;
};

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "JD";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => (p?.[0] || "").toUpperCase()).join("");
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return d;
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function Avatar({
  name,
  url,
  size = 56,
  className = "",
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const s = `${size}px`;
  return (
    <div className={cn("crm-avatar overflow-hidden", className)} style={{ width: s, height: s }} aria-label="Avatar">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name ? `Avatar de ${name}` : "Avatar"}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const ran = useRef(false);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [agency, setAgency] = useState<AgencyRow | null>(null);

  // Invitations: on affiche seulement au receveur (SM)
  const [invitesForMe, setInvitesForMe] = useState<InviteRow[]>([]);

  // Members (AGENCY)
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const isAgency = profile?.account_type === "AGENCY";

  // Join code
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);

  // Agency invite SM by email
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAgencyName, setEditAgencyName] = useState("");

  // Upload avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Switch
  const [switchBusy, setSwitchBusy] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function loginUrl() {
    return "/login?next=/profile";
  }

  async function loadMembers(agencyId: string) {
    setMembersLoading(true);
    try {
      // 1) agency_members
      const { data: am, error: amErr } = await supabase
        .from("agency_members")
        .select("user_id, role, status, created_at")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (amErr) {
        setMembers([]);
        setToast({ type: "err", msg: `Members: ${amErr.message}` });
        return;
      }

      const ids = (am || []).map((x: any) => x.user_id);
      if (ids.length === 0) {
        setMembers([]);
        return;
      }

      // 2) users_profile
      const { data: ups, error: upErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, avatar_url, account_type")
        .in("user_id", ids);

      if (upErr) {
        // pas bloquant
      }

      const map = new Map<string, any>();
      (ups || []).forEach((u: any) => map.set(u.user_id, u));

      setMembers(
        (am || []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          status: m.status ?? null,
          created_at: m.created_at ?? null,
          profile: map.get(m.user_id) ?? null,
        }))
      );
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) {
      router.replace(loginUrl());
      return;
    }
    setUserEmail(u.user.email ?? null);

    const { data: p, error: pErr } = await supabase
      .from("users_profile")
      .select("user_id, full_name, avatar_url, agency_id, account_type, role")
      .eq("user_id", u.user.id)
      .single();

    if (pErr) {
      setToast({ type: "err", msg: `Profil introuvable: ${pErr.message}` });
      setProfile(null);
      setLoading(false);
      return;
    }

    const pr = p as ProfileRow;
    setProfile(pr);

    // Agency info
    let ag: AgencyRow | null = null;
    if (pr.agency_id) {
      const { data: a, error: aErr } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("id", pr.agency_id)
        .single();
      ag = !aErr && a ? (a as AgencyRow) : null;
    }
    setAgency(ag);

    // Invitations only for receiver (SM)
    if (!isAgency && u.user.email) {
      const { data: invMe, error: invMeErr } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, token, status, created_at")
        .eq("email", u.user.email.toLowerCase())
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      if (invMeErr) {
        setInvitesForMe([]);
        // Si tu vois ici "row level security", c'est la preuve que la policy SELECT manque
        // (voir SQL section A)
      } else {
        setInvitesForMe((invMe || []) as InviteRow[]);
      }
    } else {
      setInvitesForMe([]);
    }

    // Members only for agency
    if (pr.account_type === "AGENCY" && pr.agency_id) {
      await loadMembers(pr.agency_id);
    } else {
      setMembers([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit() {
    setEditFullName(profile?.full_name ?? "");
    setEditEmail(userEmail ?? "");
    setEditAgencyName(agency?.name ?? "");

    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);

    setEditOpen(true);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: "ok", msg: "Copié ✅" });
    } catch {
      setToast({ type: "err", msg: "Impossible de copier." });
    }
  }

  async function requestJoin() {
    if (!joinCode.trim()) {
      setToast({ type: "err", msg: "Entrez un code agence." });
      return;
    }
    setJoinBusy(true);
    try {
      const { error } = await supabase.rpc("request_join_agency", { p_code: joinCode.trim() });
      if (error) {
        setToast({ type: "err", msg: `Erreur: ${error.message}` });
        return;
      }
      setJoinCode("");
      setToast({ type: "ok", msg: "Demande envoyée ✅ (en attente)" });
      await loadAll();
    } finally {
      setJoinBusy(false);
    }
  }

  async function inviteSocialManagerByEmail() {
    const em = inviteEmail.trim().toLowerCase();
    if (!em || !isValidEmail(em)) {
      setToast({ type: "err", msg: "Email invalide." });
      return;
    }
    if (!isAgency || !profile?.agency_id) {
      setToast({ type: "err", msg: "Action réservée à une agence." });
      return;
    }

    setInviteBusy(true);
    try {
      // IMPORTANT: la function doit être invite_social_manager(p_email text)
      const { error } = await supabase.rpc("invite_social_manager", { p_email: em });
      if (error) {
        setToast({ type: "err", msg: `Invitation: ${error.message}` });
        return;
      }
      setInviteEmail("");
      setToast({ type: "ok", msg: "Invitation envoyée ✅" });
      await loadAll();
    } finally {
      setInviteBusy(false);
    }
  }

  async function acceptInviteForMe(token: string) {
    const { error } = await supabase.rpc("accept_agency_invite", { p_token: token });
    if (error) {
      setToast({ type: "err", msg: `Impossible d’accepter: ${error.message}` });
      return;
    }
    setToast({ type: "ok", msg: "Invitation acceptée ✅" });
    await loadAll();
  }

  async function rejectInvite(inviteId: string) {
    const { error } = await supabase.rpc("reject_agency_invite", { p_invite_id: inviteId });
    if (error) {
      setToast({ type: "err", msg: `Erreur: ${error.message}` });
      return;
    }
    setToast({ type: "ok", msg: "Invitation refusée." });
    await loadAll();
  }

  async function uploadAvatar(file: File) {
    if (!profile) throw new Error("Profile introuvable");

    const bucket = "avatars";
    const maxMB = 3;
    if (file.size > maxMB * 1024 * 1024) throw new Error(`Image trop grande (max ${maxMB}MB).`);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "jpg";
    const path = `users/${profile.user_id}/avatar.${safeExt}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });
    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error("Impossible d’obtenir l’URL publique.");
    return publicUrl;
  }

  async function saveEdit() {
    if (!profile) return;
    setSaveBusy(true);
    try {
      let newAvatarUrl: string | null = profile.avatar_url ?? null;

      if (avatarFile) {
        setAvatarBusy(true);
        try {
          newAvatarUrl = await uploadAvatar(avatarFile);
        } finally {
          setAvatarBusy(false);
        }
      }

      const { error: pErr } = await supabase
        .from("users_profile")
        .update({ full_name: editFullName.trim() || null, avatar_url: newAvatarUrl })
        .eq("user_id", profile.user_id);

      if (pErr) {
        setToast({ type: "err", msg: `Erreur profil: ${pErr.message}` });
        return;
      }

      if (isAgency && profile.agency_id) {
        const newName = editAgencyName.trim();
        if (newName) {
          const { error: aErr } = await supabase.from("agencies").update({ name: newName }).eq("id", profile.agency_id);
          if (aErr) {
            setToast({ type: "err", msg: `Erreur agence: ${aErr.message}` });
            return;
          }
        }
      }

      const newEmail = editEmail.trim();
      if (newEmail && newEmail !== (userEmail ?? "")) {
        const { error: eErr } = await supabase.auth.updateUser({ email: newEmail });
        if (eErr) {
          setToast({ type: "err", msg: `Email: ${eErr.message}` });
          return;
        }
        setToast({ type: "ok", msg: "Email modifié (vérifiez votre boîte mail)." });
      } else {
        setToast({ type: "ok", msg: "Modifications enregistrées ✅" });
      }

      setEditOpen(false);
      await loadAll();
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "Erreur inconnue." });
    } finally {
      setSaveBusy(false);
    }
  }

  async function switchToAgency() {
    setSwitchBusy(true);
    try {
      const { error } = await supabase.rpc("switch_to_agency");
      if (error) {
        setToast({ type: "err", msg: "Switch indisponible: " + error.message });
        return;
      }
      setToast({ type: "ok", msg: "Votre agence a été créée ✅" });
      await loadAll();
    } finally {
      setSwitchBusy(false);
    }
  }

  const heroTitle = isAgency ? agency?.name || "Mon agence" : profile?.full_name || "Mon profil";
  const heroSub = isAgency ? `Compte Agence • ${profile?.full_name || "Owner"}` : "Social Manager";

  const inviteCount = invitesForMe.length;

  return (
    <div className="crm-shell">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={cn("crm-toast", toast.type === "ok" ? "crm-toast-ok" : "crm-toast-err")}>{toast.msg}</div>
        </div>
      )}

      <div className="crm-container">
        <div className="crm-card overflow-hidden">
          {/* HERO */}
          <div className={cn("crm-hero", isAgency ? "crm-hero-agency" : "crm-hero-sm")}>
            <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar name={heroTitle} url={profile?.avatar_url} size={58} />
                <div className="min-w-0">
                  <div className="text-2xl font-semibold truncate">{heroTitle}</div>
                  <div className="text-white/85 text-sm mt-1">{heroSub}</div>
                  {userEmail && <div className="text-white/75 text-xs mt-1 truncate">{userEmail}</div>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={openEdit} className="crm-btn-glass">
                  ✏️ Modifier profil
                </button>
                <button onClick={() => loadAll()} className="crm-btn-glass">
                  ⟳ Actualiser
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-5 sm:p-7">
            {/* ====== SOCIAL MANAGER VIEW ====== */}
            {!isAgency && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Join */}
                <div className="crm-card-soft p-5">
                  <div className="text-sm font-semibold">Rejoindre une agence</div>
                  <div className="text-sm text-slate-600 mt-1">Entrez le code fourni par une agence.</div>

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Code agence"
                      className="crm-input"
                    />
                    <button onClick={requestJoin} disabled={joinBusy} className="crm-btn-primary">
                      {joinBusy ? "..." : "Rejoindre"}
                    </button>
                  </div>

                  {/* Switch séparé (pour éviter confusion) */}
                  <div className="mt-4 crm-divider" />
                  <div className="text-sm font-semibold mt-4">Créer mon agence</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Transformez votre compte en <b>AGENCY</b> (vous gardez vos données).
                  </div>
                  <button onClick={switchToAgency} disabled={switchBusy} className="crm-btn-primary w-full mt-4">
                    {switchBusy ? "..." : "Créer mon agence (Switch)"}
                  </button>
                </div>

                {/* Invitations (receveur seulement) */}
                <div className="crm-card-soft p-5 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Invitations reçues</div>
                      <div className="text-sm text-slate-600 mt-1">Invitations en attente pour rejoindre une agence.</div>
                    </div>
                    <span className="crm-badge">{inviteCount}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {inviteCount === 0 ? (
                      <div className="crm-empty">Aucune invitation en attente.</div>
                    ) : (
                      invitesForMe.map((inv) => (
                        <div key={inv.id} className="crm-invite">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="font-extrabold truncate">{inv.email}</div>
                              <div className="text-sm text-slate-600 mt-1">Reçu le {formatDate(inv.created_at)}</div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => acceptInviteForMe(inv.token)} className="crm-btn-ok">
                                Accepter
                              </button>
                              <button onClick={() => rejectInvite(inv.id)} className="crm-btn-danger">
                                Refuser
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {loading && <div className="mt-4 text-sm text-slate-600">Chargement…</div>}
                </div>
              </div>
            )}

            {/* ====== AGENCY VIEW ====== */}
            {isAgency && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Identifiants */}
                <div className="crm-card-soft p-5">
                  <div className="text-sm font-semibold">Identifiant agence</div>
                  <div className="text-sm text-slate-600 mt-1">Partagez cet ID à vos Social Managers.</div>

                  <div className="mt-4 flex items-center gap-2">
                    <div className="crm-pill flex-1">
                      ID Agence: <span className="font-extrabold">{profile?.agency_id ?? "—"}</span>
                    </div>
                    <button onClick={() => profile?.agency_id && copyText(profile.agency_id)} className="crm-btn-soft">
                      Copier
                    </button>
                  </div>
                </div>

                {/* Invite */}
                <div className="crm-card-soft p-5">
                  <div className="text-sm font-semibold">Inviter Social Manager</div>
                  <div className="text-sm text-slate-600 mt-1">Entrez l’email du Social Manager (doit exister).</div>

                  <div className="mt-4 space-y-2">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      className="crm-input"
                    />
                    <button onClick={inviteSocialManagerByEmail} disabled={inviteBusy} className="crm-btn-primary w-full">
                      {inviteBusy ? "Envoi..." : "Envoyer invitation"}
                    </button>
                  </div>
                </div>

                {/* Team */}
                <div className="crm-card-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Équipe Social Managers</div>
                      <div className="text-sm text-slate-600 mt-1">Membres actuels.</div>
                    </div>
                    <span className="crm-badge">{members.length}</span>
                  </div>

                  <div className="mt-4">
                    {membersLoading ? (
                      <div className="text-sm text-slate-600">Chargement…</div>
                    ) : members.length === 0 ? (
                      <div className="crm-empty">Aucun membre pour le moment.</div>
                    ) : (
                      <div className="space-y-2">
                        {members.map((m) => {
                          const nm = m.profile?.full_name || m.user_id.slice(0, 8);
                          return (
                            <div key={m.user_id} className="crm-invite">
                              <div className="flex items-center gap-3">
                                <Avatar name={nm} url={m.profile?.avatar_url ?? null} size={44} className="text-sm" />
                                <div className="min-w-0">
                                  <div className="font-extrabold truncate">{nm}</div>
                                  <div className="text-sm text-slate-600 mt-1">
                                    {m.role} • {m.status || "ACTIVE"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 flex-wrap">
                    <button onClick={() => router.push("/recap")} className="crm-btn-soft">
                      Ouvrir Récap
                    </button>
                    <button onClick={() => router.push("/dashboard")} className="crm-btn-soft">
                      Dashboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL EDIT */}
        {editOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
            <div className="crm-modal">
              <div className="crm-modal-head">
                <div>
                  <div className="text-lg font-black">Modifier profil</div>
                  <div className="text-sm text-slate-600 mt-1">Nom, email, photo{isAgency ? ", agence" : ""}</div>
                </div>
                <button onClick={() => setEditOpen(false)} className="crm-btn-soft">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar name={editFullName || profile?.full_name} url={avatarPreview || profile?.avatar_url} size={64} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold">Photo de profil</div>
                    <div className="text-xs text-slate-500 mt-1">PNG/JPG/WebP • max 3MB</div>

                    <label className="inline-flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setAvatarFile(f);
                          if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                          setAvatarPreview(f ? URL.createObjectURL(f) : null);
                        }}
                      />
                      <span className="crm-btn-soft">📷 Choisir une image</span>
                      {(avatarFile || avatarPreview) && (
                        <button
                          type="button"
                          className="crm-btn-soft"
                          onClick={() => {
                            setAvatarFile(null);
                            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                            setAvatarPreview(null);
                          }}
                        >
                          Retirer
                        </button>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold">Nom du profil</label>
                  <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="crm-input mt-2" />
                </div>

                <div>
                  <label className="text-sm font-bold">Email</label>
                  <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="crm-input mt-2" />
                  <div className="text-xs text-slate-500 mt-2">Si l’email change, Supabase peut demander une confirmation.</div>
                </div>

                {isAgency && (
                  <div>
                    <label className="text-sm font-bold">Nom de l’agence</label>
                    <input value={editAgencyName} onChange={(e) => setEditAgencyName(e.target.value)} className="crm-input mt-2" />
                  </div>
                )}
              </div>

              <div className="crm-modal-foot">
                <button onClick={() => setEditOpen(false)} className="crm-btn-soft">
                  Annuler
                </button>
                <button onClick={saveEdit} disabled={saveBusy || avatarBusy} className="crm-btn-primary">
                  {saveBusy || avatarBusy ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
