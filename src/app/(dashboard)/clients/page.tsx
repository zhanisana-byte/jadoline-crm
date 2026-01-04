"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

import { SocialAccountsInline } from "@/components/clients/SocialAccountsInline";

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  phones: string[] | null;
  logo_url: string | null;
  brief_avoid: string | null;
  created_at: string | null;
};

type SocialDraft = {
  platform: "META_FACEBOOK_PAGE" | "META_INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  value: string;
};

export default function ClientsPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const metaStatus = searchParams.get("meta"); // meta=connected (ton redirect)
  const selectedClientId = searchParams.get("client_id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ---- Form states ----
  const [name, setName] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [socialDrafts, setSocialDrafts] = useState<SocialDraft[]>([]);

  const avoidPreview = useMemo(() => {
    const others = clients
      .map((c) => c.name?.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return others.join(", ");
  }, [clients]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function loadContextAndClients() {
    setLoading(true);
    setError(null);

    const { data: authData, error: aErr } = await supabase.auth.getUser();
    if (aErr || !authData?.user) {
      setError("Non authentifié. Reconnecte-toi.");
      setLoading(false);
      return;
    }

    const uid = authData.user.id;
    setUserId(uid);

    const { data: profile, error: pErr } = await supabase
      .from("users_profile")
      .select("agency_id, role")
      .eq("user_id", uid)
      .single();

    if (pErr || !profile?.agency_id) {
      setError("Profil incomplet: agency_id manquant.");
      setLoading(false);
      return;
    }

    const agid = profile.agency_id as string;
    setAgencyId(agid);

    const { data: rows, error: cErr } = await supabase
      .from("clients")
      .select("id, name, phone, phones, logo_url, brief_avoid, created_at")
      .eq("agency_id", agid)
      .order("created_at", { ascending: false });

    if (cErr) {
      setError(cErr.message);
      setClients([]);
    } else {
      setClients((rows ?? []) as ClientRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadContextAndClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // petit feedback UI après retour meta=connected
    if (metaStatus === "connected") {
      setOk("✅ Meta connecté avec succès.");
      setTimeout(() => setOk(null), 4000);
    }
  }, [metaStatus]);

  function resetForm() {
    setName("");
    setPhones([""]);
    setLogoFile(null);
    setSocialDrafts([]);
    setOk(null);
    setError(null);
  }

  function isValidE164(p: string) {
    if (!p) return false;
    if (!p.startsWith("+")) return false;
    const digits = p.replace(/[^\d]/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }

  function addPhone() {
    setPhones((prev) => [...prev, ""]);
  }
  function updatePhone(i: number, val: string) {
    setPhones((prev) => prev.map((p, idx) => (idx === i ? val : p)));
  }
  function removePhone(i: number) {
    setPhones((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function uploadClientLogo(params: {
    agencyId: string;
    clientId: string;
    file: File;
  }) {
    const { agencyId, clientId, file } = params;

    if (!file.type.startsWith("image/")) {
      throw new Error("Le logo doit être une image (png/jpg/webp).");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `agencies/${agencyId}/clients/${clientId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("client-logos")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error("Impossible de récupérer l’URL publique du logo.");

    const { error: dbErr } = await supabase
      .from("clients")
      .update({ logo_url: publicUrl })
      .eq("id", clientId);

    if (dbErr) throw dbErr;

    return publicUrl;
  }

  async function onCreateClient() {
    setOk(null);
    setError(null);

    if (!agencyId || !userId) {
      setError("Contexte manquant (agency/user). Reconnecte-toi.");
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Le nom du client est obligatoire.");
      return;
    }

    const cleanPhones = phones.map((p) => p.trim()).filter(Boolean);
    if (cleanPhones.length === 0) {
      setError("Au moins 1 téléphone est obligatoire.");
      return;
    }

    const bad = cleanPhones.find((p) => !isValidE164(p));
    if (bad) {
      setError(`Téléphone invalide: ${bad} (ex: +21620121521)`);
      return;
    }

    setSaving(true);

    try {
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({
          agency_id: agencyId,
          name: cleanName,
          phone: cleanPhones[0],
          phones: cleanPhones,
          created_by: userId,
        })
        .select("id")
        .single();

      if (cErr) throw cErr;
      if (!client?.id) throw new Error("Client non créé (id manquant).");

      const clientId = client.id as string;

      if (logoFile) {
        await uploadClientLogo({ agencyId, clientId, file: logoFile });
      }

      const rows = socialDrafts
        .map((d) => ({ platform: d.platform, value: d.value.trim() }))
        .filter((d) => d.value.length > 0)
        .map((d) => ({
          client_id: clientId,
          platform: d.platform,
          publish_mode: "ASSISTED",
          display_name: d.value,
          username:
            d.platform === "META_INSTAGRAM" || d.platform === "TIKTOK"
              ? d.value.replace(/^@/, "")
              : null,
        }));

      if (rows.length > 0) {
        const { error: sErr } = await supabase.from("client_social_accounts").insert(rows);
        if (sErr) throw sErr;
      }

      setOk("✅ Client créé.");
      await loadContextAndClients();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container py-6">
      <div className="page-hero p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0">Clients</h1>
            <p className="muted mt-2">
              Création client : Nom + Téléphones (multi) + Logo (optionnel) + Réseaux
            </p>

            {selectedClientId ? (
              <div className="mt-3">
                <span className="badge badge-info">
                  Client cible : <span className="font-mono">{selectedClientId}</span>
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => loadContextAndClients()}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {error ? <Alert type="error" text={error} /> : null}
        {ok ? <Alert type="ok" text={ok} /> : null}

        {/* --------- GRID --------- */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          {/* LEFT: CREATE */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="m-0">Créer un client</h2>
                <p className="muted mt-2">
                  Étape 1 : infos client. Étape 2 : connexion Meta après création.
                </p>
              </div>
              <span className="badge badge-success">MVP</span>
            </div>

            {/* preview avoid */}
            <div className="tip-box mt-4">
              <div className="font-semibold text-slate-900">Texte à éviter (auto)</div>
              <div className="mt-1 text-slate-700">
                {avoidPreview ? avoidPreview : "Aucun autre client pour le moment."}
              </div>
              <div className="mt-2 text-slate-500 text-xs">⚙️ Trigger SQL.</div>
            </div>

            {/* name */}
            <div className="mt-5">
              <label>Nom client *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: BBGym"
              />
            </div>

            {/* phones */}
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <label>Téléphones (multi) *</label>
                <button type="button" className="btn btn-ghost" onClick={addPhone}>
                  + Ajouter numéro
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                {phones.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_44px] gap-3 items-center">
                    <div className="rounded-xl border border-slate-200/80 bg-white/85 px-2 py-1">
                      <PhoneInput
                        defaultCountry="tn"
                        value={p}
                        onChange={(val) => updatePhone(idx, val)}
                        inputStyle={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          padding: "10px 10px",
                          background: "transparent",
                        }}
                        countrySelectorStyleProps={{
                          buttonStyle: {
                            border: "none",
                            background: "transparent",
                          },
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      disabled={phones.length === 1}
                      className={`btn ${
                        phones.length === 1 ? "btn-ghost" : "btn-ghost"
                      }`}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p className="muted mt-2">Format attendu : +216XXXXXXXX</p>
            </div>

            {/* logo */}
            <div className="mt-5">
              <label>Logo (optionnel)</label>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Preview logo"
                    className="h-16 w-16 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    Logo
                  </div>
                )}
              </div>
            </div>

            {/* networks manual */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-base font-semibold text-slate-900">
                  Réseaux sociaux (manuel MVP)
                </h3>
                <span className="muted">Meta OAuth arrive après</span>
              </div>

              <div className="mt-3">
                <SocialAccountsInline onChange={setSocialDrafts} />
              </div>
            </div>

            {/* actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                onClick={onCreateClient}
                disabled={saving || loading}
              >
                {saving ? "Création..." : "Créer le client"}
              </button>
              <button className="btn btn-ghost" onClick={resetForm} disabled={saving}>
                Reset
              </button>
            </div>
          </div>

          {/* RIGHT: LIST + NEXT STEPS */}
          <div className="grid gap-6">
            <div className="card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="card-title">Étapes (recommandé)</div>
                  <p className="muted mt-2">
                    1) Créer client → 2) Connecter Meta → 3) Choisir Page → IG auto → 4) Publier
                  </p>
                </div>
              </div>

              <ol className="mt-4 space-y-2 text-sm text-slate-700">
                <li>✅ Étape 1 : Client (nom, tel, logo)</li>
                <li>✅ Étape 2 : Connexion Meta (OAuth)</li>
                <li>⏳ Étape 3 : Lister Pages + Lier à ce client</li>
                <li>⏳ Étape 4 : Détecter Instagram Business via Page</li>
                <li className="text-slate-500">🔒 TikTok : module suivant</li>
              </ol>

              {metaStatus === "connected" ? (
                <div className="mt-4">
                  <span className="badge badge-success">Meta connecté</span>
                </div>
              ) : null}
            </div>

            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="card-title">Liste des clients</div>
                  <p className="muted mt-1">{clients.length} client(s)</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {clients.length === 0 ? (
                  <div className="muted">Aucun client. Crée le premier à gauche.</div>
                ) : (
                  clients.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 hover:border-indigo-200 transition"
                    >
                      <div className="flex items-center gap-3">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url}
                            alt={c.name}
                            className="h-10 w-10 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                            {c.name?.slice(0, 1)?.toUpperCase() ?? "C"}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {c.phones?.length ? c.phones.join(" • ") : c.phone ?? "—"}
                          </div>
                        </div>

                        {/* future: bouton ouvrir fiche client */}
                        <div className="text-xs text-slate-500 font-mono">
                          {c.id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        {/* /GRID */}
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const cls =
    type === "error" ? "alert alert-error" : "alert alert-success";
  return <div className={cls}>{text}</div>;
}
