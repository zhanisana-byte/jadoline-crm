"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null; // ex: OWNER / CM / PRO
  active_agency_id: string | null;
};

type AgencyRow = {
  id: string;
  name: string;
  owner_id: string | null;
};

type AgencyMemberRow = {
  agency_id: string;
  user_id: string;
  role: string; // OWNER / CM / MEMBER
  status: string; // ACTIVE / INVITED / DISABLED
};

type AgencyKeyRow = {
  agency_id: string;
  key: string; // code d’invitation
  active: boolean;
  created_by: string | null;
  created_at: string;
};

type MyAgencyView = {
  agency: AgencyRow;
  membership: AgencyMemberRow;
};

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<"infos" | "agences" | "work">("infos");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [agencies, setAgencies] = useState<MyAgencyView[]>([]);
  const [activeAgency, setActiveAgency] = useState<AgencyRow | null>(null);

  const [personalAgency, setPersonalAgency] = useState<AgencyRow | null>(null);
  const [personalActiveKey, setPersonalActiveKey] = useState<AgencyKeyRow | null>(null);

  const globalRole = useMemo(() => {
    if (!profile?.role) return "—";
    return profile.role;
  }, [profile?.role]);

  // ============ LOAD ============
  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      setMsg(null);

      // 1) Auth user
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!mounted) return;

      if (userErr || !user) {
        setLoading(false);
        router.replace("/login?error=not_authenticated");
        return;
      }

      setAuthUserId(user.id);
      setAuthEmail(user.email ?? null);

      // 2) Ensure personal agency + key exists (IMPORTANT)
      // ⚠️ ta fonction SQL doit exister: public.ensure_personal_agency()
      // Elle doit créer:
      // - une agence perso (owner_id = auth.uid())
      // - une clé active dans agency_keys (created_by = auth.uid())
      await supabase.rpc("ensure_personal_agency");

      // 3) Load users_profile
      const { data: prof, error: profErr } = await supabase
        .from("users_profile")
        .select("user_id, full_name, role, active_agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profErr) {
        setLoading(false);
        setMsg("Erreur: impossible de charger le profil (users_profile).");
        return;
      }

      setProfile(prof ?? null);

      // 4) Load memberships + agencies
      const { data: members, error: memErr } = await supabase
        .from("agency_members")
        .select("agency_id, user_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      if (!mounted) return;

      if (memErr) {
        setLoading(false);
        setMsg("Erreur: impossible de charger les agences (agency_members).");
        return;
      }

      const agencyIds = (members ?? []).map((m: AgencyMemberRow) => m.agency_id);
      let agenciesRows: AgencyRow[] = [];

      if (agencyIds.length > 0) {
        const { data: ags, error: agErr } = await supabase
          .from("agencies")
          .select("id, name, owner_id")
          .in("id", agencyIds);

        if (!mounted) return;

        if (agErr) {
          setLoading(false);
          setMsg("Erreur: impossible de charger les agences (agencies).");
          return;
        }
        agenciesRows = ags ?? [];
      }

      const combined: MyAgencyView[] = (members ?? []).map((m: AgencyMemberRow) => {
        const a = agenciesRows.find((x) => x.id === m.agency_id);
        return a
          ? { agency: a, membership: m }
          : {
              agency: { id: m.agency_id, name: "(Agence inconnue)", owner_id: null },
              membership: m,
            };
      });

      // Tri: owner d’abord puis alpha
      combined.sort((x, y) => {
        const rx = x.membership.role === "OWNER" ? 0 : 1;
        const ry = y.membership.role === "OWNER" ? 0 : 1;
        if (rx !== ry) return rx - ry;
        return x.agency.name.localeCompare(y.agency.name);
      });

      setAgencies(combined);

      // 5) Determine active agency
      const activeId = prof?.active_agency_id ?? null;
      const active = activeId
        ? combined.find((x) => x.agency.id === activeId)?.agency ?? null
        : combined[0]?.agency ?? null;

      setActiveAgency(active);

      // If active_agency_id empty, set it to first agency (optional but useful)
      if (!activeId && active?.id) {
        await supabase
          .from("users_profile")
          .update({ active_agency_id: active.id })
          .eq("user_id", user.id);
        if (mounted) {
          setProfile((p) => (p ? { ...p, active_agency_id: active.id } : p));
        }
      }

      // 6) Personal agency = the one where owner_id = user.id (your "espace perso")
      // (Si tu veux une autre logique, dis-moi)
      const perso = agenciesRows.find((a) => a.owner_id === user.id) ?? null;
      setPersonalAgency(perso);

      // 7) Load active key for personal agency
      if (perso?.id) {
        const { data: k, error: kErr } = await supabase
          .from("agency_keys")
          .select("agency_id, key, active, created_by, created_at")
          .eq("agency_id", perso.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        if (!kErr) setPersonalActiveKey(k ?? null);
      }

      setLoading(false);
    }

    loadAll();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // ============ ACTIONS ============
  async function saveInfos() {
    if (!authUserId || !profile) return;
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("users_profile")
      .update({ full_name: profile.full_name })
      .eq("user_id", authUserId);

    setSaving(false);
    setMsg(error ? "Erreur: sauvegarde impossible." : "✅ Sauvegardé.");
  }

  async function setActiveAgencyId(agencyId: string) {
    if (!authUserId) return;
    setMsg(null);

    const { error } = await supabase
      .from("users_profile")
      .update({ active_agency_id: agencyId })
      .eq("user_id", authUserId);

    if (error) {
      setMsg("Erreur: impossible de définir l’espace actif.");
      return;
    }

    const found = agencies.find((x) => x.agency.id === agencyId)?.agency ?? null;
    setActiveAgency(found);
    setProfile((p) => (p ? { ...p, active_agency_id: agencyId } : p));
    setMsg("✅ Espace actif mis à jour.");
  }

  async function regeneratePersonalKey() {
    // optionnel: si tu veux un bouton "Regénérer"
    // sinon tu peux supprimer ce bouton
    if (!authUserId || !personalAgency?.id) return;
    setSaving(true);
    setMsg(null);

    // Désactiver les anciennes clés
    await supabase
      .from("agency_keys")
      .update({ active: false })
      .eq("agency_id", personalAgency.id);

    // Créer une nouvelle clé active
    const { data, error } = await supabase
      .from("agency_keys")
      .insert({
        agency_id: personalAgency.id,
        key: Math.random().toString(36).slice(2, 10), // simple (tu peux faire mieux côté SQL)
        active: true,
        created_by: authUserId,
      })
      .select("agency_id, key, active, created_by, created_at")
      .maybeSingle();

    setSaving(false);

    if (error) {
      setMsg("Erreur: impossible de régénérer la clé.");
      return;
    }
    setPersonalActiveKey(data ?? null);
    setMsg("✅ Nouvelle clé générée.");
  }

  // ============ UI ============
  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          Chargement du profil…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-sm text-slate-500">Gestion du compte & espaces de travail.</p>
        </div>
        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50">
          Rôle global : {globalRole}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("infos")}
          className={classNames(
            "px-4 py-2 rounded-xl border text-sm",
            tab === "infos" && "bg-slate-900 text-white border-slate-900"
          )}
        >
          Infos
        </button>
        <button
          onClick={() => setTab("agences")}
          className={classNames(
            "px-4 py-2 rounded-xl border text-sm",
            tab === "agences" && "bg-slate-900 text-white border-slate-900"
          )}
        >
          Mes agences
        </button>
        <button
          onClick={() => setTab("work")}
          className={classNames(
            "px-4 py-2 rounded-xl border text-sm",
            tab === "work" && "bg-slate-900 text-white border-slate-900"
          )}
        >
          Work
        </button>
      </div>

      {msg && (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-700">
          {msg}
        </div>
      )}

      {/* Content */}
      {tab === "infos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Infos */}
          <div className="lg:col-span-2 rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Infos</h2>
                <p className="text-sm text-slate-500">Identité & compte</p>
              </div>
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50">
                Email confirmé
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nom complet</label>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={profile?.full_name ?? ""}
                  onChange={(e) =>
                    setProfile((p) => (p ? { ...p, full_name: e.target.value } : p))
                  }
                  placeholder="Votre nom"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-slate-50"
                  value={authEmail ?? ""}
                  disabled
                />
                <p className="mt-2 text-xs text-slate-500">Votre compte est actif.</p>
              </div>
            </div>

            <button
              onClick={saveInfos}
              disabled={saving}
              className="mt-5 inline-flex items-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>

            {/* Ma clé (espace perso) */}
            <div className="mt-8 rounded-2xl border bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Ma clé (espace personnel)</h3>
                  <p className="text-sm text-slate-500">
                    Chaque compte a un espace perso + une clé pour inviter des collaborateurs.
                  </p>
                </div>
                <span
                  className={classNames(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                    personalActiveKey?.active
                      ? "text-emerald-700 bg-emerald-50"
                      : "text-slate-600 bg-white"
                  )}
                >
                  {personalActiveKey?.active ? "Clé active" : "Aucune clé active"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Espace</p>
                  <p className="text-sm font-medium">
                    {personalAgency ? personalAgency.name : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Clé</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                      value={personalActiveKey?.key ?? ""}
                      placeholder="(aucune)"
                      disabled
                    />
                    <button
                      onClick={async () => {
                        const k = personalActiveKey?.key;
                        if (k) await navigator.clipboard.writeText(k);
                        setMsg(k ? "✅ Clé copiée." : "Aucune clé à copier.");
                      }}
                      className="rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-100"
                    >
                      Copier
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Si tu veux, tu peux garder 1 seule clé active (recommandé).
                  </p>
                </div>
              </div>

              {/* Optionnel: bouton regénérer (tu peux le supprimer si “ça sert à rien”) */}
              <div className="mt-4">
                <button
                  onClick={regeneratePersonalKey}
                  disabled={saving || !personalAgency}
                  className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-slate-100 disabled:opacity-60"
                >
                  Régénérer la clé (optionnel)
                </button>
              </div>
            </div>
          </div>

          {/* Récap */}
          <div className="rounded-2xl border bg-white p-6">
            <h3 className="font-semibold">Récap rapide</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>✅ Un utilisateur peut être dans plusieurs agences</li>
              <li>🔑 Chaque compte a un espace perso + une clé</li>
              <li>👥 Un CM peut travailler sur plusieurs agences</li>
            </ul>

            <div className="mt-6 rounded-2xl border bg-slate-50 p-5">
              <h4 className="font-semibold">Espace actif</h4>
              <p className="mt-1 text-sm text-slate-500">Utilisé pour Clients / Posts / Gym</p>
              <p className="mt-3 text-sm">
                Agence : <span className="font-medium">{activeAgency?.name ?? "—"}</span>
              </p>
              <p className="text-xs text-slate-500">(ID caché)</p>
            </div>
          </div>
        </div>
      )}

      {tab === "agences" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Mes agences</h2>
            <p className="text-sm text-slate-500">
              Sélectionne un espace. Tu peux archiver les agences inutiles (plus tard).
            </p>

            <div className="mt-5 space-y-3">
              {agencies.length === 0 && (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                  Aucune agence trouvée (agency_members vide).
                </div>
              )}

              {agencies.map((x) => {
                const isActive = profile?.active_agency_id === x.agency.id;
                return (
                  <button
                    key={x.agency.id}
                    onClick={() => setActiveAgencyId(x.agency.id)}
                    className={classNames(
                      "w-full text-left rounded-2xl border p-4 flex items-center justify-between gap-4",
                      isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <div className="font-semibold">{x.agency.name}</div>
                      <div className={classNames("text-sm", isActive ? "text-white/80" : "text-slate-500")}>
                        Statut : {x.membership.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={classNames(
                          "rounded-full px-3 py-1 text-xs font-medium border",
                          isActive ? "border-white/30 bg-white/10" : "bg-slate-50"
                        )}
                      >
                        {x.membership.role}
                      </span>
                      {isActive && (
                        <span className="rounded-full px-3 py-1 text-xs font-medium border border-white/30 bg-white/10">
                          ACTIF
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aside */}
          <div className="rounded-2xl border bg-white p-6">
            <h3 className="font-semibold">Espace actif</h3>
            <p className="mt-1 text-sm text-slate-500">Utilisé pour Clients / Posts / Gym</p>

            <div className="mt-4 rounded-2xl border bg-slate-50 p-5">
              <p className="text-sm">
                Agence : <span className="font-medium">{activeAgency?.name ?? "—"}</span>
              </p>
              <p className="text-xs text-slate-500">(ID caché)</p>
            </div>

            <div className="mt-6 text-sm text-slate-700">
              <p className="font-medium">Note</p>
              <p className="mt-1 text-slate-500">
                La clé affichée dans “Ma clé” correspond à ton espace perso (owner_id = ton user_id).
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "work" && (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">Work</h2>
          <p className="mt-2 text-sm text-slate-500">
            Zone future (ex: permissions, tâches, rôles détaillés, etc.)
          </p>
        </div>
      )}
    </div>
  );
}
