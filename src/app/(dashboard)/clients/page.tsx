"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ClientsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ---- Form states ----
  const [name, setName] = useState("");
  const [phoneE164, setPhoneE164] = useState(""); // stocke directement +XXX...
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
    setOk(null);
    setError(null);
  }

  function isValidE164(p: string) {
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

    const cleanPhone = phoneE164.trim();
    if (!isValidE164(cleanPhone)) {
      setError("Téléphone invalide. Exemple: +21620121521");
      return;
    }

    setSaving(true);

    try {
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

      if (logoFile) {
        await uploadClientLogo({ agencyId, clientId, file: logoFile });
      }

      setOk("✅ Client créé avec succès.");
      await loadContextAndClients();
      resetForm();

      // Option: ouvrir direct la page réseaux
      // router.push(`/dashboard/clients/${clientId}/socials`);
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
            Création client: Nom + Téléphone + Logo (optionnel). Les réseaux sont gérés dans la fiche “Réseaux”.
          </p>
        </div>
        <button onClick={() => loadContextAndClients()} disabled={loading} style={secondaryBtn}>
          ↻ Refresh
        </button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      {/* Create Card */}
      <Card title="Créer un client">
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
            <label style={labelStyle}>Nom client *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: BBGym" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Téléphone (tous pays) *</label>
            <div style={{ marginTop: 8 }}>
              <PhoneInput
                defaultCountry="tn"
                value={phoneE164}
                onChange={(val) => setPhoneE164(val)}
                inputStyle={{ width: "100%", borderRadius: 12, border: "1px solid #e2e8f0", padding: "10px 12px" }}
                countrySelectorStyleProps={{ buttonStyle: { borderRadius: 12, border: "1px solid #e2e8f0" } }}
              />
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
              Format stocké: <b>{phoneE164 || "—"}</b>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Logo (optionnel)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            {logoPreview ? (
              <img src={logoPreview} alt="Preview logo" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: "1px solid #e2e8f0" }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 14, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                Logo
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button onClick={onCreateClient} disabled={saving || loading} style={primaryBtn}>
            {saving ? "Création..." : "Créer le client"}
          </button>
          <button onClick={resetForm} disabled={saving} style={secondaryBtn}>
            Reset
          </button>
        </div>
      </Card>

      {/* List */}
      <Card title="Liste des clients">
        {loading ? (
          <div style={{ marginTop: 10, color: "#64748b" }}>Chargement...</div>
        ) : clients.length === 0 ? (
          <div style={{ marginTop: 10, color: "#94a3b8" }}>Aucun client pour le moment.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {clients.map((c) => (
              <div key={c.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} style={{ width: 48, height: 48, borderRadius: 14, objectFit: "cover", border: "1px solid #e2e8f0" }} />
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

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ maxWidth: 420, textAlign: "right" }}>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>Texte à éviter (auto)</div>
                    <div style={{ color: "#475569", fontSize: 13 }}>{c.brief_avoid ? c.brief_avoid : "—"}</div>
                  </div>

                  <button type="button" onClick={() => router.push(`/dashboard/clients/${c.id}/socials`)} style={secondaryBtn}>
                    🌐 Réseaux
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "white" }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const style =
    type === "error"
      ? { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }
      : { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#065f46" };

  return <div style={{ marginTop: 14, padding: 12, borderRadius: 12, ...style }}>{text}</div>;
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#0f172a" };

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
