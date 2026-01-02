"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  logo_url: string | null;
  brief_avoid: string | null;
  created_at: string | null;
};

type PlatformItem = {
  platform: string; // doit matcher ton enum (temporaire tant qu'on fait pas OAuth)
  page_name: string;
  page_id: string;
};

export default function ClientsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ---- Form states ----
  const [name, setName] = useState("");
  const [phoneE164, setPhoneE164] = useState(""); // ✅ stocke directement +XXX...
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);

  // ✅ Mets ici les valeurs EXACTES de ton ENUM platform (temporaire)
  const PLATFORM_OPTIONS = useMemo(
    () => [
      { value: "FACEBOOK", label: "Facebook (Page)" },
      { value: "INSTAGRAM", label: "Instagram" },
      { value: "TIKTOK", label: "TikTok" },
      { value: "YOUTUBE", label: "YouTube" },
    ],
    []
  );

  // brief_avoid est géré automatiquement par trigger SQL
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

    // agency_id depuis users_profile
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
      .select("id, name, phone, logo_url, brief_avoid, created_at")
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
    setPhoneE164("");
    setLogoFile(null);
    setPlatforms([]);
    setOk(null);
    setError(null);
  }

  function addPlatformRow() {
    setPlatforms((prev) => [
      ...prev,
      { platform: PLATFORM_OPTIONS[0]?.value ?? "", page_name: "", page_id: "" },
    ]);
  }

  function updatePlatformRow(index: number, patch: Partial<PlatformItem>) {
    setPlatforms((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function removePlatformRow(index: number) {
    setPlatforms((prev) => prev.filter((_, i) => i !== index));
  }

  function isValidE164(p: string) {
    // E.164 simple: + puis 8-15 chiffres
    if (!p) return false;
    if (!p.startsWith("+")) return false;
    const digits = p.replace(/[^\d]/g, "");
    return digits.length >= 8 && digits.length <= 15;
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
      .from("client-logos") // ✅ bucket
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

    // ✅ Téléphone requis (tu as dit obligatoire)
    const cleanPhone = phoneE164.trim();
    if (!isValidE164(cleanPhone)) {
      setError("Téléphone invalide. Exemple: +21620121521");
      return;
    }

    // RS manuel: si une ligne existe, exiger nom+id (temporaire)
    const badPlatform = platforms.find(
      (p) => p.platform && (!p.page_id.trim() || !p.page_name.trim())
    );
    if (badPlatform) {
      setError("Chaque réseau ajouté doit avoir un Nom + un ID/URL (temporaire avant OAuth).");
      return;
    }

    setSaving(true);

    try {
      // 1) Insert client (brief_avoid géré par trigger SQL)
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({
          agency_id: agencyId,
          name: cleanName,
          phone: cleanPhone,
          created_by: userId,
        })
        .select("id, name")
        .single();

      if (cErr) throw cErr;
      if (!client?.id) throw new Error("Client non créé (id manquant).");

      const clientId = client.id as string;

      // 2) Upload logo (optionnel)
      if (logoFile) {
        await uploadClientLogo({ agencyId, clientId, file: logoFile });
      }

      // 3) Insert plateformes (optionnel, temporaire)
      if (platforms.length > 0) {
        const rows = platforms
          .filter((p) => p.platform && p.page_id.trim() && p.page_name.trim())
          .map((p) => ({
            client_id: clientId,
            platform: p.platform,
            page_name: p.page_name.trim(),
            page_id: p.page_id.trim(),
          }));

        if (rows.length) {
          const { error: pErr } = await supabase.from("client_platforms").insert(rows);
          if (pErr) throw pErr;
        }
      }

      setOk("✅ Client créé avec succès.");
      await loadContextAndClients();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Clients</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            Création client: Nom + Téléphone (tous pays) + Logo (optionnel) + Réseaux
          </p>
        </div>
        <button
          onClick={() => loadContextAndClients()}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "white",
            cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
          {error}
        </div>
      ) : null}

      {ok ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#065f46" }}>
          {ok}
        </div>
      ) : null}

      {/* Create Card */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "white",
        }}
      >
        <h2 style={{ margin: 0 }}>Créer un client</h2>

        {/* Preview brief_avoid */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Texte à éviter (auto)</div>
          <div style={{ color: "#475569", fontSize: 13 }}>
            {avoidPreview ? avoidPreview : "Aucun autre client pour le moment."}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
            ⚙️ Géré automatiquement par le trigger SQL.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: "#0f172a" }}>Nom client *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: BBGym"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: "#0f172a" }}>Téléphone (tous pays) *</label>
            <div style={{ marginTop: 8 }}>
              <PhoneInput
                defaultCountry="tn"
                value={phoneE164}
                onChange={(val) => setPhoneE164(val)}
                inputStyle={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "10px 12px",
                }}
                countrySelectorStyleProps={{
                  buttonStyle: {
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                  },
                }}
              />
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
              Format stocké: <b>{phoneE164 || "—"}</b>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 13, color: "#0f172a" }}>Logo (optionnel)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Preview logo"
                style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: "1px solid #e2e8f0" }}
              />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 14, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                Logo
              </div>
            )}
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
            Bucket: <b>client-logos</b> (public).
          </div>
        </div>

        {/* Platforms (temporaire) */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Réseaux sociaux (temporaire)</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Pour l’instant manuel. Après, on fait “Connecter Meta” (OAuth).
              </div>
            </div>

            <button onClick={addPlatformRow} type="button" style={secondaryBtn}>
              + Ajouter un réseau
            </button>
          </div>

          {platforms.length === 0 ? (
            <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 13 }}>Aucun réseau ajouté.</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {platforms.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 12,
                    background: "#ffffff",
                    display: "grid",
                    gridTemplateColumns: "180px 1fr 1fr 48px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <select
                    value={p.platform}
                    onChange={(e) => updatePlatformRow(idx, { platform: e.target.value })}
                    style={inputStyle}
                  >
                    {PLATFORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <input
                    value={p.page_name}
                    onChange={(e) => updatePlatformRow(idx, { page_name: e.target.value })}
                    placeholder="Nom page/compte"
                    style={inputStyle}
                  />

                  <input
                    value={p.page_id}
                    onChange={(e) => updatePlatformRow(idx, { page_id: e.target.value })}
                    placeholder="ID/URL (temporaire)"
                    style={inputStyle}
                  />

                  <button
                    onClick={() => removePlatformRow(idx)}
                    type="button"
                    title="Supprimer"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid #fee2e2",
                      background: "#fff1f2",
                      color: "#b91c1c",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button onClick={onCreateClient} disabled={saving || loading} style={primaryBtn}>
            {saving ? "Création..." : "Créer le client"}
          </button>
          <button onClick={resetForm} disabled={saving} style={secondaryBtn}>
            Reset
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "white" }}>
        <h2 style={{ margin: 0 }}>Liste des clients</h2>

        {loading ? (
          <div style={{ marginTop: 10, color: "#64748b" }}>Chargement...</div>
        ) : clients.length === 0 ? (
          <div style={{ marginTop: 10, color: "#94a3b8" }}>Aucun client pour le moment.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {clients.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 12,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={c.name}
                      style={{ width: 48, height: 48, borderRadius: 14, objectFit: "cover", border: "1px solid #e2e8f0" }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 14, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                      —
                    </div>
                  )}

                  <div>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{c.phone || "—"}</div>
                  </div>
                </div>

                <div style={{ maxWidth: 520, textAlign: "right" }}>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Texte à éviter (auto)</div>
                  <div style={{ color: "#475569", fontSize: 13 }}>{c.brief_avoid ? c.brief_avoid : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "white",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "white",
  cursor: "pointer",
};
