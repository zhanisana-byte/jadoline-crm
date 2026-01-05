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

type AgencyRow = {
  id: string;
  name: string;
  join_code: string | null;
};

type InviteRow = {
  id: string;
  agency_id: string;
  email: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" | string;
  created_at: string;
  created_by: string;
  accepted_at: string | null;
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
    return new Date(d).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return d;
  }
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const ran = useRef(false);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [agency, setAgency] = useState<AgencyRow | null>(null);

  const [invitesForMe, setInvitesForMe] = useState<InviteRow[]>([]);
  const [invitesForAgency, setInvitesForAgency] = useState<InviteRow[]>([]);

  const isAgency = profile?.account_type === "AGENCY";

  // Join
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const [editFullName, setEditFullName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAgencyName, setEditAgencyName] = useState("");

  // Toast
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function loginUrl() {
    return "/login?next=/profile";
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

    // Agency if linked
    if (pr.agency_id) {
      const { data: a, error: aErr } = await supabase
        .from("agencies")
        .select("id, name, join_code")
        .eq("id", pr.agency_id)
        .single();
      setAgency(!aErr && a ? (a as AgencyRow) : null);
    } else {
      setAgency(null);
    }

    // Invites for me (by email)
    if (u.user.email) {
      const { data: invMe, error: invMeErr } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, token, status, created_at, created_by, accepted_at")
        .eq("email", u.user.email)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      setInvitesForMe(!invMeErr ? ((invMe || []) as InviteRow[]) : []);
    } else {
      setInvitesForMe([]);
    }

    // Invites for agency (incoming requests)
    if (pr.account_type === "AGENCY" && pr.agency_id) {
      const { data: invAg, error: invAgErr } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, token, status, created_at, created_by, accepted_at")
        .eq("agency_id", pr.agency_id)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      setInvitesForAgency(!invAgErr ? ((invAg || []) as InviteRow[]) : []);
    } else {
      setInvitesForAgency([]);
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
    setEditAvatarUrl(profile?.avatar_url ?? "");
    setEditEmail(userEmail ?? "");
    setEditAgencyName(agency?.name ?? "");
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

  async function approveInviteForAgency(inviteId: string) {
    const { error } = await supabase.rpc("approve_agency_invite", { p_invite_id: inviteId });
    if (error) {
      setToast({ type: "err", msg: `Erreur: ${error.message}` });
      return;
    }
    setToast({ type: "ok", msg: "Membre ajouté ✅" });
    await loadAll();
  }

  async function saveEdit() {
    if (!profile) return;
    setSaveBusy(true);
    try {
      // 1) update profile (name/avatar)
      const { error: pErr } = await supabase
        .from("users_profile")
        .update({
          full_name: editFullName.trim() || null,
          avatar_url: editAvatarUrl.trim() || null,
        })
        .eq("user_id", profile.user_id);

      if (pErr) {
        setToast({ type: "err", msg: `Erreur profil: ${pErr.message}` });
        return;
      }

      // 2) update agency name (if AGENCY)
      if (isAgency && profile.agency_id) {
        const newName = editAgencyName.trim();
        if (newName) {
          const { error: aErr } = await supabase
            .from("agencies")
            .update({ name: newName })
            .eq("id", profile.agency_id);
          if (aErr) {
            setToast({ type: "err", msg: `Erreur agence: ${aErr.message}` });
            return;
          }
        }
      }

      // 3) update auth email (if changed)
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
    } finally {
      setSaveBusy(false);
    }
  }

  const headerTitle = useMemo(() => {
    const full = profile?.full_name || "Mon profil";
    const agencyName = agency?.name;
    if (isAgency && agencyName) return agencyName;
    return full;
  }, [profile?.full_name, agency?.name, isAgency]);

  const headerSubtitle = useMemo(() => {
    const full = profile?.full_name || "";
    const type = isAgency ? "Compte Agence" : "Social Manager";
    if (isAgency) return `${type} • ${full || "Owner"}`;
    return type;
  }, [profile?.full_name, isAgency]);

  const inviteCount = isAgency ? invitesForAgency.length : invitesForMe.length;
  const invites = isAgency ? invitesForAgency : invitesForMe;

  return (
    <div className="crm-shell">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={cn("crm-toast", toast.type === "ok" ? "crm-toast-ok" : "crm-toast-err")}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="crm-container">
        <div className="crm-card overflow-hidden">
          {/* HERO */}
          <div className={cn("crm-hero", isAgency ? "crm-hero-agency" : "crm-hero-sm")}>
            <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="crm-avatar">{initials(isAgency ? agency?.name : profile?.full_name)}</div>
                <div className="min-w-0">
                  <div className="text-2xl font-semibold truncate">{headerTitle}</div>
                  <div className="text-white/85 text-sm mt-1">{headerSubtitle}</div>
                  {userEmail && <div className="text-white/75 text-xs mt-1 truncate">{userEmail}</div>}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={openEdit} className="crm-btn-glass">✏️ Modifier</button>
                <button onClick={() => loadAll()} className="crm-btn-glass">⟳ Actualiser</button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-5 sm:p-7">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* ACCESS AGENCY */}
              <div className="crm-card-soft p-5">
                <div className="text-sm font-semibold">Accès agence</div>
                <div className="text-sm text-slate-600 mt-1">
                  {isAgency ? "Votre ID agence à partager." : "Rejoindre une agence via code (demande en attente)."}
                </div>

                {isAgency ? (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="crm-pill flex-1">
                      ID Agence: <span className="font-extrabold">{profile?.agency_id ?? "—"}</span>
                    </div>
                    <button
                      onClick={() => profile?.agency_id && copyText(profile.agency_id)}
                      className="crm-btn-soft"
                    >
                      Copier
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Code agence (join_code)"
                      className="crm-input"
                    />
                    <button onClick={requestJoin} disabled={joinBusy} className="crm-btn-primary">
                      {joinBusy ? "..." : "Rejoindre"}
                    </button>
                  </div>
                )}

                <div className="mt-4 text-xs text-slate-500">
                  Conseillé: utiliser le <b>join_code</b> (plus simple que UUID).
                </div>
              </div>

              {/* INVITES */}
              <div className="crm-card-soft p-5 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Invitations</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {isAgency
                        ? "Demandes reçues pour rejoindre votre agence."
                        : "Invitations reçues pour rejoindre une agence."}
                    </div>
                  </div>
                  <span className="crm-badge">{inviteCount}</span>
                </div>

                <div className="mt-4 space-y-3">
                  {inviteCount === 0 ? (
                    <div className="crm-empty">Aucune invitation en attente.</div>
                  ) : (
                    invites.map((inv) => (
                      <div key={inv.id} className="crm-invite">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-extrabold truncate">{inv.email}</div>
                            <div className="text-sm text-slate-600 mt-1">
                              Reçu le {formatDate(inv.created_at)}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {isAgency ? (
                              <>
                                <button onClick={() => approveInviteForAgency(inv.id)} className="crm-btn-ok">
                                  Accepter
                                </button>
                                <button onClick={() => rejectInvite(inv.id)} className="crm-btn-danger">
                                  Refuser
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => acceptInviteForMe(inv.token)} className="crm-btn-ok">
                                  Accepter
                                </button>
                                <button onClick={() => rejectInvite(inv.id)} className="crm-btn-danger">
                                  Refuser
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {!isAgency && (
                          <div className="mt-3 text-xs text-slate-500">
                            (Vous pouvez aussi accepter via <b>/invite?token=…</b>)
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* BOTTOM */}
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="crm-card-soft p-5">
                <div className="text-sm font-semibold">Type de compte</div>
                <div className="mt-3 inline-flex items-center gap-2 crm-pill">
                  <span className="font-extrabold">{isAgency ? "🏢 Agence" : "👤 Social Manager"}</span>
                  {profile?.role ? <span className="text-slate-600">• {profile.role}</span> : null}
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  {isAgency
                    ? "Vous gérez les demandes d’accès ici via Invitations."
                    : "Vos collaborations détaillées seront dans la page Récap."}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => router.push("/dashboard")} className="crm-btn-soft">
                    Dashboard
                  </button>
                  <button onClick={() => router.push("/recap")} className="crm-btn-soft">
                    Récap
                  </button>
                </div>
              </div>

              <div className="crm-card-soft p-5 lg:col-span-2">
                <div className="text-sm font-semibold">Résumé</div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="crm-card-soft p-4">
                    <div className="text-xs text-slate-500">Invitations en attente</div>
                    <div className="text-2xl font-black mt-1">{inviteCount}</div>
                  </div>
                  <div className="crm-card-soft p-4">
                    <div className="text-xs text-slate-500">Agence liée</div>
                    <div className="text-sm font-extrabold mt-2 truncate">{agency?.name ?? "—"}</div>
                  </div>
                  <div className="crm-card-soft p-4">
                    <div className="text-xs text-slate-500">User ID</div>
                    <div className="text-sm font-extrabold mt-2 truncate">{profile?.user_id ?? "—"}</div>
                  </div>
                </div>

                {loading && <div className="mt-4 text-sm text-slate-600">Chargement…</div>}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL EDIT */}
        {editOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
            <div className="crm-modal">
              <div className="crm-modal-head">
                <div>
                  <div className="text-lg font-black">Modifier profil</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Nom, email, avatar{isAgency ? ", agence" : ""}
                  </div>
                </div>
                <button onClick={() => setEditOpen(false)} className="crm-btn-soft">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-bold">Nom du profil</label>
                  <input
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="crm-input mt-2"
                    placeholder="Votre nom"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold">Email</label>
                  <input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="crm-input mt-2"
                    placeholder="email@exemple.com"
                  />
                  <div className="text-xs text-slate-500 mt-2">
                    Si l’email change, Supabase peut demander une confirmation.
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold">Avatar URL</label>
                  <input
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    className="crm-input mt-2"
                    placeholder="https://..."
                  />
                </div>

                {isAgency && (
                  <div>
                    <label className="text-sm font-bold">Nom de l’agence</label>
                    <input
                      value={editAgencyName}
                      onChange={(e) => setEditAgencyName(e.target.value)}
                      className="crm-input mt-2"
                      placeholder="Nom agence"
                    />
                  </div>
                )}
              </div>

              <div className="crm-modal-foot">
                <button onClick={() => setEditOpen(false)} className="crm-btn-soft">
                  Annuler
                </button>
                <button onClick={saveEdit} disabled={saveBusy} className="crm-btn-primary">
                  {saveBusy ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
