"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SocialAccountsInline, { SocialDraft } from "@/components/SocialAccountsInline";

type Agency = { id: string; name: string };

export default function CreateClientPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState<string>("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phonesText, setPhonesText] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [briefAvoid, setBriefAvoid] = useState("");

  const [socials, setSocials] = useState<SocialDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load agencies user is member of + current_agency_id
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users_profile")
        .select("current_agency_id")
        .eq("user_id", auth.user.id)
        .single();

      const { data: myAgencies } = await supabase
        .from("agency_members")
        .select("agency_id, agencies:agencies(id, name)")
        .eq("user_id", auth.user.id);

      const list: Agency[] =
        myAgencies
          ?.map((r: any) => r.agencies)
          ?.filter(Boolean)
          ?.map((a: any) => ({ id: a.id, name: a.name })) ?? [];

      setAgencies(list);

      // default agency selection
      const def = profile?.current_agency_id || list?.[0]?.id || "";
      setAgencyId(def);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phonesArr = useMemo(() => {
    return phonesText
      .split(/[,;\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [phonesText]);

  async function onSubmit() {
    setError(null);

    if (!agencyId) return setError("Choisis une agence propriétaire.");
    if (!name.trim()) return setError("Le nom du client est obligatoire.");

    setLoading(true);
    try {
      const res = await fetch("/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_id: agencyId,
          name: name.trim(),
          email: email.trim() || null,
          phones: phonesArr,
          logo_url: logoUrl.trim() || null,
          brief_avoid: briefAvoid.trim() || null,
          socials,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Erreur inconnue");
        setLoading(false);
        return;
      }

      // ✅ redirect to clients list (ou vers page client directement)
      router.push(`/clients/${json.client_id}`);
    } catch (e: any) {
      setError(e?.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Créer un client</h1>
          <p className="text-sm text-slate-500">
            Ajoute un client et ses réseaux sociaux (manuel MVP).
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border bg-white/90 backdrop-blur shadow-sm p-5 md:p-7">
          {/* Top row: Agency */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Agence propriétaire
              </label>
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              >
                <option value="">— Choisir —</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">
                Tu peux créer pour ton agence ou une agence partenaire (si tu es membre).
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Logo URL (optionnel)
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          {/* Client info */}
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Nom du client *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: BB Gym"
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Email (optionnel)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@client.com"
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Téléphones (optionnel)
              </label>
              <textarea
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                placeholder="Ex: 58 000 000, 71 000 000 (séparés par virgule ou ligne)"
                rows={3}
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
              />
              <div className="mt-1 text-xs text-slate-500">
                Converti automatiquement en tableau `phones[]`.
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Règles / À éviter (optionnel)
              </label>
              <textarea
                value={briefAvoid}
                onChange={(e) => setBriefAvoid(e.target.value)}
                placeholder="Ex: Ne pas utiliser humour noir, éviter promotions agressives, respecter charte…"
                rows={4}
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
              />
              <div className="mt-1 text-xs text-slate-500">
                (MVP) Stocké dans `clients.brief_avoid`.
              </div>
            </div>
          </div>

          {/* Social accounts manual */}
          <SocialAccountsInline onChange={setSocials} />

          {/* Error */}
          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">
              {error}
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-end">
            <button
              type="button"
              onClick={() => router.push("/clients")}
              className="px-4 py-3 rounded-2xl border bg-white hover:bg-slate-50 transition"
              disabled={loading}
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={onSubmit}
              className="px-5 py-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Création..." : "Créer le client"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
