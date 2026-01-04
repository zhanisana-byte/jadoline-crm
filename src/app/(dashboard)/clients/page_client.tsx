"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  phones: string[] | null;
  logo_url: string | null;
  created_at: string | null;
};

export default function ClientsPage() {
  return (
    <Suspense fallback={<div className="card p-6">Chargement...</div>}>
      <ClientsInner />
    </Suspense>
  );
}

function ClientsInner() {
  const supabase = createClient();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ---- Form ----
  const [name, setName] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
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
    const meta = sp.get("meta");
    if (meta === "connected") setOk("✅ Meta connecté avec succès.");
    if (meta === "failed") setError("❌ Connexion Meta échouée. Réessaie.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    loadContextAndClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .select("id, name, phone, phones, logo_url, created_at")
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

  function resetForm() {
    setName("");
    setPhones([""]);
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

      setOk("✅ Client créé. Maintenant connecte Meta.");
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="m-0">Clients</h1>
            <p className="muted mt-1">
              Création client: Nom + Téléphones (multi) + Logo (optionnel). Les réseaux se connectent via OAuth (Meta/TikTok).
            </p>
          </div>

          <button className="btn btn-ghost" onClick={loadContextAndClients} disabled={loading} type="button">
            ↻ Refresh
          </button>
        </div>

        {error ? <Alert type="error" text={error} /> : null}
        {ok ? <Alert type="ok" text={ok} /> : null}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Create */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <h2 className="m-0">Créer un client</h2>
              <span className="badge badge-info">MVP</span>
            </div>

            <div className="tip-box mt-4">
              <div className="font-semibold mb-1">Texte à éviter (auto)</div>
              <div className="text-slate-600 text-sm">
                {avoidPreview ? avoidPreview : "Aucun autre client pour le moment."}
              </div>
              <div className="text-slate-400 text-xs mt-2">⚙️ Trigger SQL (plus tard).</div>
            </div>

            <div className="mt-4">
              <label>Nom client *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: BBGym" />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <label className="m-0">Téléphones (multi) *</label>
                <button className="btn btn-ghost" type="button" onClick={addPhone}>
                  + Ajouter numéro
                </button>
              </div>

              <div className="mt-2 grid gap-2">
                {phones.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_48px] gap-2 items-center">
                    <PhoneInput
                      defaultCountry="tn"
                      value={p}
                      onChange={(val) => updatePhone(idx, val)}
                      inputStyle={{
                        width: "100%",
                        borderRadius: 14,
                        border: "1px solid rgba(226,232,240,.85)",
                        padding: "10px 12px",
                        background: "rgba(255,255,255,.85)",
                        outline: "none",
                      }}
                      countrySelectorStyleProps={{
                        buttonStyle: {
                          borderRadius: 14,
                          border: "1px solid rgba(226,232,240,.85)",
                          background: "rgba(255,255,255,.85)",
                        },
                      }}
                    />

                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => removePhone(idx)}
                      disabled={phones.length === 1}
                      title="Supprimer"
                      style={{
                        width: 44,
                        height: 44,
                        justifyContent: "center",
                        borderRadius: 14,
                        border: "1px solid rgba(254,202,202,.9)",
                        background: phones.length === 1 ? "rgba(2,6,23,.03)" : "rgba(254,226,226,.65)",
                        color: "#b91c1c",
                      }}
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
                    className="border border-slate-200 rounded-2xl"
                    style={{ width: 64, height: 64, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="border border-dashed border-slate-300 rounded-2xl text-slate-400 flex items-center justify-center"
                    style={{ width: 64, height: 64 }}
                  >
                    Logo
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={onCreateClient} disabled={saving || loading} type="button">
                {saving ? "Création..." : "Créer le client"}
              </button>
              <button className="btn btn-ghost" onClick={resetForm} disabled={saving} type="button">
                Reset
              </button>
            </div>
          </div>

          {/* List */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="m-0">Liste clients</h2>
                <div className="muted mt-1">{clients.length} client(s)</div>
              </div>
              <span className="badge badge-success">Agency OK</span>
            </div>

            <div className="mt-4 grid gap-3">
              {loading ? (
                <div className="muted">Chargement…</div>
              ) : clients.length === 0 ? (
                <div className="muted">Aucun client pour le moment.</div>
              ) : (
                clients.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-200 bg-white/70 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 font-semibold"
                        style={{ width: 44, height: 44 }}
                      >
                        {(c.name?.trim()?.slice(0, 2) || "CL").toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.name}</div>
                        <div className="text-sm text-slate-500 truncate">
                          {c.phone || (c.phones?.[0] ?? "") || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* ✅ Bouton Connexion Meta pour CE client */}
                      <a className="btn btn-primary" href={`/clients/${c.id}/meta`}>
                        Connecter Meta
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="tip-box mt-5">
              <div className="font-semibold mb-1">Étape suivante</div>
              <div>
                Clique <b>Connecter Meta</b> sur un client → Facebook OAuth → sélection page → Instagram détecté automatiquement.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  if (type === "error") return <div className="alert alert-error">{text}</div>;
  return <div className="alert alert-success">{text}</div>;
}
