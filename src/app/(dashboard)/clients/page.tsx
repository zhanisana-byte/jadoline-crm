"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  name: string;
  category?: string | null;
  logo_url?: string | null;
  created_at?: string | null;
  phones?: string[] | null;
};

type PhoneDraft = { country: string; number: string };

const COUNTRY_CODES: { code: string; label: string; dial: string }[] = [
  { code: "TN", label: "Tunisie", dial: "+216" },
  { code: "FR", label: "France", dial: "+33" },
  { code: "AE", label: "UAE", dial: "+971" },
  { code: "SA", label: "Saudi", dial: "+966" },
  { code: "DZ", label: "Algérie", dial: "+213" },
  { code: "MA", label: "Maroc", dial: "+212" },
];

export default function ClientsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profileAgencyId, setProfileAgencyId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // modal
  const [open, setOpen] = useState(false);

  // form
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [phones, setPhones] = useState<PhoneDraft[]>([
    { country: "TN", number: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const canSave = useMemo(() => {
    return name.trim().length >= 2 && !!profileAgencyId && !saving;
  }, [name, profileAgencyId, saving]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        window.location.href = "/login";
        return;
      }

      // agency_id (pas current_agency_id)
      const { data: profile, error: pErr } = await supabase
        .from("users_profile")
        .select("agency_id")
        .eq("user_id", auth.user.id)
        .single();

      if (!isMounted) return;

      if (pErr) {
        setErr(pErr.message);
        setLoading(false);
        return;
      }

      const agencyId = profile?.agency_id || null;
      setProfileAgencyId(agencyId);

      if (!agencyId) {
        setLoading(false);
        return;
      }

      const { data: list, error: lErr } = await supabase
        .from("clients")
        .select("id, name, logo_url, created_at, phones")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (lErr) {
        setErr(lErr.message);
        setLoading(false);
        return;
      }

      setClients((list as any) || []);
      setLoading(false);
    }

    boot();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  function resetForm() {
    setName("");
    setLogoFile(null);
    setLogoPreview(null);
    setPhones([{ country: "TN", number: "" }]);
    setFormErr(null);
  }

  function openModal() {
    resetForm();
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function addPhone() {
    setPhones((prev) => [...prev, { country: "TN", number: "" }]);
  }

  function removePhone(idx: number) {
    setPhones((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePhone(idx: number, patch: Partial<PhoneDraft>) {
    setPhones((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  }

  function dialFor(country: string) {
    return COUNTRY_CODES.find((c) => c.code === country)?.dial || "+216";
  }

  async function uploadLogoIfAny(agencyId: string) {
    if (!logoFile) return null;

    // ⚠️ bucket: "client-logos" (à créer dans Supabase Storage)
    const ext = logoFile.name.split(".").pop() || "png";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const path = `${agencyId}/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from("client-logos")
      .upload(path, logoFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
    return data.publicUrl || null;
  }

  async function createClient() {
    setFormErr(null);
    setSaving(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Non connecté");

      if (!profileAgencyId) throw new Error("Aucune agence liée");

      const cleanedPhones = phones
        .map((p) => {
          const num = p.number.trim();
          if (!num) return null;
          // on stocke sous forme "+216 12345678"
          return `${dialFor(p.country)} ${num}`;
        })
        .filter(Boolean) as string[];

      const logoUrl = await uploadLogoIfAny(profileAgencyId);

      // ✅ insert direct (si RLS ok) sinon on fera API route après
      const { data: inserted, error: insErr } = await supabase
        .from("clients")
        .insert({
          agency_id: profileAgencyId,
          name: name.trim(),
          phones: cleanedPhones,
          logo_url: logoUrl,
          created_by: user.id,
        })
        .select("id, name, logo_url, created_at, phones")
        .single();

      if (insErr) throw new Error(insErr.message);

      setClients((prev) => [inserted as any, ...prev]);
      setOpen(false);

      // Option: rediriger vers gestion
      // window.location.href = `/clients/${inserted.id}`;
    } catch (e: any) {
      setFormErr(e?.message || "Erreur création");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-2xl border bg-white p-6">Chargement…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-lg font-semibold">Erreur</div>
          <div className="text-sm text-rose-700 mt-2">{err}</div>
        </div>
      </div>
    );
  }

  if (!profileAgencyId) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-lg font-semibold">Aucune agence active</div>
          <div className="text-sm text-slate-600 mt-1">
            Ton profil n’a pas <code>agency_id</code>. Va sur Profil et vérifie.
          </div>
          <div className="mt-3">
            <Link className="underline text-blue-600" href="/profile">
              Aller au profil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-500">
            Gérez vos clients et leurs réseaux sociaux
          </p>
        </div>

        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          + Créer un client
        </button>
      </div>

      <div className="rounded-2xl border bg-white/90 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Téléphones</th>
              <th className="text-left px-4 py-3">Création</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.logo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-semibold text-slate-400">
                          {c.name?.slice(0, 1)?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        ID: {c.id.slice(0, 8)}…
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-slate-600">
                  {c.phones?.length ? (
                    <div className="flex flex-col gap-1">
                      {c.phones.slice(0, 2).map((p, i) => (
                        <span key={i}>{p}</span>
                      ))}
                      {c.phones.length > 2 && (
                        <span className="text-xs text-slate-400">
                          +{c.phones.length - 2} autres
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-slate-500">
                  {c.created_at
                    ? new Date(c.created_at).toLocaleDateString()
                    : "-"}
                </td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/clients/${c.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-100 transition"
                  >
                    ⚙️ Gérer
                  </Link>
                </td>
              </tr>
            ))}

            {!clients.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  Aucun client pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeModal}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border overflow-hidden">
              <div className="p-5 border-b flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Créer un client</div>
                  <div className="text-xs text-slate-500">
                    Infos client + logo + téléphones (MVP)
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="h-10 w-10 rounded-xl border hover:bg-slate-50"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-5">
                {formErr && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
                    {formErr}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Nom du client *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Ex: BB Gym Ennasr"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Logo (upload)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 w-full"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setLogoFile(f);
                        if (f) setLogoPreview(URL.createObjectURL(f));
                        else setLogoPreview(null);
                      }}
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      Stockage: bucket <code>client-logos</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center border">
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-slate-400 text-xs">Preview</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Choisis une image pour afficher le logo du client.
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">Téléphones</div>
                    <button
                      type="button"
                      onClick={addPhone}
                      className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50"
                    >
                      + Ajouter un numéro
                    </button>
                  </div>

                  <div className="space-y-3">
                    {phones.map((p, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[140px_1fr_44px] gap-2 items-center"
                      >
                        <select
                          value={p.country}
                          onChange={(e) =>
                            updatePhone(idx, { country: e.target.value })
                          }
                          className="rounded-xl border px-3 py-2 bg-white"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label} ({c.dial})
                            </option>
                          ))}
                        </select>

                        <input
                          value={p.number}
                          onChange={(e) =>
                            updatePhone(idx, { number: e.target.value })
                          }
                          className="rounded-xl border px-3 py-2 bg-white outline-none"
                          placeholder="Ex: 58 433 782"
                        />

                        <button
                          type="button"
                          onClick={() => removePhone(idx)}
                          disabled={phones.length === 1}
                          className="h-11 w-11 rounded-xl border bg-white hover:bg-rose-50 disabled:opacity-50"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Les numéros seront enregistrés sous forme : <code>+216 58 433 782</code>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t flex items-center justify-between gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl border hover:bg-slate-50"
                >
                  Annuler
                </button>

                <button
                  onClick={createClient}
                  disabled={!canSave}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Création..." : "Créer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
