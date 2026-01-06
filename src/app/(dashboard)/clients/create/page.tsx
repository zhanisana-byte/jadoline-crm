"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CreateClientPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [showInProfile, setShowInProfile] = useState(true);

  const [ruleWeek, setRuleWeek] = useState("5");
  const [ruleMonth, setRuleMonth] = useState("20");
  const [ruleFbStoryDaily, setRuleFbStoryDaily] = useState(true);
  const [ruleIgStoryWeek, setRuleIgStoryWeek] = useState("4");
  const [avoid, setAvoid] = useState("Politique, sujets sensibles, bad buzz...");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rulesText = useMemo(() => {
    return [
      `Publications / semaine : ${ruleWeek}`,
      `Publications / mois : ${ruleMonth}`,
      `Stories Facebook : ${ruleFbStoryDaily ? "Tous les jours" : "Selon planning"}`,
      `Stories Instagram : ${ruleIgStoryWeek} / semaine`,
      `À éviter : ${avoid}`,
    ].join("\n");
  }, [ruleWeek, ruleMonth, ruleFbStoryDaily, ruleIgStoryWeek, avoid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Non connecté");

      // récupérer agency_id depuis users_profile
      const { data: profile, error: pErr } = await supabase
        .from("users_profile")
        .select("agency_id")
        .eq("user_id", user.id)
        .single();

      if (pErr) throw new Error(pErr.message);
      if (!profile?.agency_id) throw new Error("Aucune agence liée à ce compte");

      const phones = [phone1, phone2].map((x) => x.trim()).filter(Boolean);

      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_id: profile.agency_id,
          name: name.trim(),
          phones,
          logo_url: logoUrl.trim() || null,
          created_by: user.id,
          show_in_profile: showInProfile,
          rules_text: rulesText, // on va le mettre dans clients.brief_avoid côté API
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur création client");

      router.push(`/clients/${json.client_id}`);
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Créer un client</h1>
        <p className="text-sm text-slate-500">
          Ajoute un client + règles de base (MVP). Les réseaux & connexions viennent après.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border bg-white/90 p-6 shadow-sm space-y-6">
        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
            {err}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Nom du client *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ex: BB Gym Ennasr"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Logo (URL)</label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Téléphone 1</label>
            <input
              value={phone1}
              onChange={(e) => setPhone1(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="+216 ..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Téléphone 2</label>
            <input
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="+216 ..."
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4">
          <div className="font-semibold mb-3">Règles (MVP)</div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Publications / semaine</label>
              <input
                value={ruleWeek}
                onChange={(e) => setRuleWeek(e.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Publications / mois</label>
              <input
                value={ruleMonth}
                onChange={(e) => setRuleMonth(e.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={ruleFbStoryDaily}
                onChange={(e) => setRuleFbStoryDaily(e.target.checked)}
              />
              <span className="text-sm">Planning story Facebook chaque jour</span>
            </div>

            <div>
              <label className="text-sm font-medium">Stories Instagram / semaine</label>
              <input
                value={ruleIgStoryWeek}
                onChange={(e) => setRuleIgStoryWeek(e.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">À éviter</label>
              <input
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-2">Résumé enregistré dans le client :</div>
            <pre className="text-xs bg-white border rounded-xl p-3 whitespace-pre-wrap">{rulesText}</pre>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showInProfile}
              onChange={(e) => setShowInProfile(e.target.checked)}
            />
            Afficher ce client dans mon profil
          </label>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Création..." : "Créer le client"}
          </button>
        </div>
      </form>
    </div>
  );
}
