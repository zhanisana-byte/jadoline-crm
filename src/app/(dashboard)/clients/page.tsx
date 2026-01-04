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

type MetaConnRow = {
  id: string;
  client_id: string;
  fb_page_id: string | null;
  ig_account_id: string | null;
  created_at: string | null;
};

export default function ClientsPage() {
  return (
    <Suspense fallback={<div className="container py-10"><div className="card p-6">Chargement…</div></div>}>
      <ClientsInner />
    </Suspense>
  );
}

function ClientsInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [metaConnections, setMetaConnections] = useState<MetaConnRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ---- Form ----
  const [name, setName] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const connectedClientIds = useMemo(() => {
    return new Set(metaConnections.map((m) => m.client_id));
  }, [metaConnections]);

  const metaConnected = searchParams.get("meta") === "connected";
  const metaError = searchParams.get("meta") === "error";

  useEffect(() => {
    if (metaConnected) setOk("✅ Meta connecté. Tu peux maintenant choisir Page/IG pour ce client.");
    if (metaError) setError("❌ Meta: connexion échouée. Vérifie permissions/scopes et réessaie.");
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
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
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

    const { data: cRows, error: cErr } = await supabase
      .from("clients")
      .select("id, name, phone, phones, logo_url, created_at")
      .eq("agency_id", agid)
      .order("created_at", { ascending: false });

    if (cErr) {
      setError(cErr.message);
      setClients([]);
      setMetaConnections([]);
      setLoading(false);
      return;
    }

    setClients((cRows ?? []) as ClientRow[]);

    // meta connections (status)
    const { data: mRows, error: mErr } = await supabase
      .from("meta_connections")
      .select("id, client_id, fb_page_id, ig_account_id, created_at")
      .eq("agency_id", agid)
      .order("created_at", { ascending: false });

    if (mErr) {
      // On ne bloque pas la page si meta_connections est vide ou pas encore prête
      setMetaConnections([]);
    } else {
      setMetaConnections((mRows ?? []) as MetaConnRow[]);
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

    if (!file.type.startsWith("image/")) throw new Error("Le logo doit être une image (png/jpg/webp).");

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

      setOk("✅ Client créé. Maintenant tu peux connecter Meta (FB/IG) depuis la liste.");
      await loadAll();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  function metaConnectUrl(clientId: string) {
    // On envoie client_id pour que le callback sache à quel client associer la connexion
    return `/api/meta/login?client_id=${encodeURIComponent(clientId)}`;
  }

  return (
    <div className="container py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0">Clients</h1>
          <p className="mt-2 muted">
            Création client: Nom + Téléphones (multi) + Logo (optionnel). Ensuite connexion Meta (FB/IG) par client.
          </p>
        </div>

        <button onClick={loadAll} disabled={loading} className="btn btn-ghost">
          ↻ Refresh
        </button>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.25fr_.9fr] gap-6">
        {/* LEFT: Create */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="card-title">Créer un client</div>
              <div className="muted mt-1">MVP: rapide, propre, prêt pour Meta.</div>
            </div>
            <span className="badge badge-info">MVP</span>
          </div>

          <div className="mt-5">
            <label>Nom client *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: BBGym" />
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
                <div key={idx} className="grid grid-cols-[1fr_48px] gap-2 items-center">
                  <PhoneInput
                    defaultCountry="tn"
                    value={p}
                    onChange={(val) => updatePhone(idx, val)}
                    inputStyle={{
                      width: "100%",
                      borderRadius: 14,
                      border: "1px solid rgba(226,232,240,.9)",
                      padding: "10px 12px",
                    }}
                    countrySelectorStyleProps={{
                      buttonStyle: { borderRadius: 14, border: "1px solid rgba(226,232,240,.9)" },
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => removePhone(idx)}
                    disabled={phones.length === 1}
                    title="Supprimer"
                    className="btn"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      border: "1px solid #fee2e2",
                      background: phones.length === 1 ? "#f8fafc" : "#fff1f2",
                      color: "#b91c1c",
                      cursor: phones.length === 1 ? "not-allowed" : "pointer",
                      padding: 0,
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

            <div className="mt-2 flex items-center gap-4">
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />

              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Preview logo"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    objectFit: "cover",
                    border: "1px solid rgba(226,232,240,.9)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    border: "1px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                  }}
                >
                  Logo
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={onCreateClient} disabled={saving || loading} className="btn btn-primary">
              {saving ? "Création..." : "Créer le client"}
            </button>
            <button onClick={resetForm} disabled={saving} className="btn btn-ghost">
              Reset
            </button>
          </div>

          <div className="tip-box mt-5">
            Après création → utilise <b>“Connecter Meta”</b> sur le client.  
            On associe la connexion au <b>client_id</b> (pas besoin RS manuel).
          </div>
        </div>

        {/* RIGHT: List */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="card-title">Liste clients</div>
              <div className="muted mt-1">{clients.length} client(s)</div>
            </div>
            <span className="badge badge-success">Agency OK</span>
          </div>

          <div className="mt-4 grid gap-3">
            {clients.map((c) => {
              const connected = connectedClientIds.has(c.id);

              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 flex items-center justify-between gap-3"
                  style={{ boxShadow: "0 10px 22px rgba(2,6,23,.06)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.name}
                        style={{ width: 40, height: 40, borderRadius: 14, objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 14,
                          background: "rgba(2,6,23,.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        {c.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-sm text-slate-500 truncate">{c.phone ?? "—"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connected ? (
                      <span className="badge badge-success">Meta connecté</span>
                    ) : (
                      <span className="badge badge-info">Meta non connecté</span>
                    )}

                    <a className="btn btn-primary" href={metaConnectUrl(c.id)}>
                      Connecter Meta
                    </a>
                  </div>
                </div>
              );
            })}

            {clients.length === 0 ? (
              <div className="muted mt-2">Aucun client pour le moment. Crée ton premier client à gauche.</div>
            ) : null}
          </div>

          <div className="tip-box mt-5">
            Étape suivante : après “Connecter Meta”, tu auras Page FB + IG Business du client dans la DB,
            puis on fera le module “Publications” (auto-post).
          </div>
        </div>
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "ok"; text: string }) {
  const cls = type === "error" ? "alert alert-error" : "alert alert-success";
  return <div className={cls}>{text}</div>;
}
