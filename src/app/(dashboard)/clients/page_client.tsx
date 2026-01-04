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

export default function ClientsPageClient() {
  const supabase = createClient();
  const searchParams = useSearchParams();

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

  // ✅ message si retour OAuth meta
  useEffect(() => {
    const metaConnected = searchParams.get("meta");
    if (metaConnected === "connected") {
      setOk("✅ Meta connecté. Tu peux continuer la création du client.");
      // optionnel: nettoyer l’URL sans refresh
      // window.history.replaceState({}, "", "/clients");
    }
  }, [searchParams]);

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

  function resetForm() {
    setName("");
    setPhones([""]);
    setLogoFile(null);
    setSocialDrafts([]);
    setError(null);
    setOk(null);
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

  async function uploadClientLogo(params: { agencyId: string; clientId: string; file: File }) {
    const { agencyId, clientId, file } = params;

    if (!file.type.startsWith("image/")) {
      throw new Error("Le logo doit être une image (png/jpg/webp).");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `agencies/${agencyId}/clients/${clientId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("client-logos")
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error("Impossible de récupérer l’URL publique du logo.");

    const { error: dbErr } = await supabase.from("clients").update({ logo_url: publicUrl }).eq("id", clientId);
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

      setOk("✅ Client + réseaux enregistrés.");
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
      <div className="page-hero p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0">Clients</h1>
            <p className="muted mt-1">
              Création client: Nom + Téléphones (multi) + Logo (optionnel) + Réseaux (manuel)
            </p>
          </div>

          <button onClick={loadContextAndClients} disabled={loading} className="btn btn-ghost">
            ↻ Refresh
          </button>
        </div>

        {error ? <Alert type="error" text={error} /> : null}
        {ok ? <Alert type="ok" text={ok} /> : null}

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr] gap-4 mt-5">
          {/* Left: create */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0">Créer un client</h2>
              <span className="badge badge-info">MVP</span>
            </div>

            <div className="tip-box mt-4">
              <div className="font-semibold">Texte à éviter (auto)</div>
              <div className="mt-1 text-slate-700 text-sm">
                {avoidPreview ? avoidPreview : "Aucun autre client pour le moment."}
              </div>
              <div className="muted mt-1">⚙️ Trigger SQL (plus tard).</div>
            </div>

            <div className="mt-4">
              <label>Nom client *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: BBGym"
              />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label>Téléphones (multi) *</label>
                <button type="button" onClick={addPhone} className="btn btn-ghost">
                  + Ajouter numéro
                </button>
              </div>

              <div className="mt-2 grid gap-2">
                {phones.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_44px] gap-2 items-center">
                    <PhoneInput
                      defaultCountry="tn"
                      value={p}
                      onChange={(val) => updatePhone(idx, val)}
                      inputStyle={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid rgba(226,232,240,.9)",
                        padding: "10px 12px",
                        fontSize: 14,
                      }}
                      countrySelectorStyleProps={{
                        buttonStyle: { borderRadius: 12, border: "1px solid rgba(226,232,240,.9)" },
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      disabled={phones.length === 1}
                      className="btn"
                      style={{
                        width: 44,
                        height: 44,
                        padding: 0,
                        borderRadius: 12,
                        border: "1px solid rgba(254,202,202,.9)",
                        background: phones.length === 1 ? "rgba(2,6,23,.04)" : "rgba(254,242,242,.9)",
                        color: "#b91c1c",
                        cursor: phones.length === 1 ? "not-allowed" : "pointer",
                      }}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label>Logo (optionnel)</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Preview logo"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      objectFit: "cover",
                      border: "1px solid rgba(226,232,240,.9)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      border: "1px dashed rgba(148,163,184,.9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: 12,
                    }}
                  >
                    Logo
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <SocialAccountsInline onChange={setSocialDrafts} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={onCreateClient} disabled={saving || loading} className="btn btn-primary">
                {saving ? "Création..." : "Créer le client"}
              </button>
              <button onClick={resetForm} disabled={saving} className="btn btn-ghost">
                Reset
              </button>
            </div>
          </div>

          {/* Right: list */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="card-title">Liste clients</div>
                <div className="muted mt-1">{clients.length} client(s)</div>
              </div>
              {agencyId ? <span className="badge badge-success">Agency OK</span> : <span className="badge">—</span>}
            </div>

            <div className="mt-4 grid gap-3">
              {loading ? (
                <div className="muted">Chargement…</div>
              ) : clients.length === 0 ? (
                <div className="muted">Aucun client pour le moment.</div>
              ) : (
                clients.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt={c.name}
                          style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: "rgba(2,6,23,.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                          {c.name?.slice(0, 2)?.toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                        <div className="muted truncate">
                          {c.phones?.length ? c.phones.join(" · ") : c.phone ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 tip-box">
              <div className="font-semibold">Étape suivante</div>
              <div className="mt-1 text-slate-700 text-sm">
                Après création du client → on branche <b>Meta</b> (FB/IG), puis TikTok module par module.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const cls =
    type === "error" ? "alert alert-error" : "alert alert-success";
  return <div className={cls}>{text}</div>;
}
