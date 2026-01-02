"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AgencyRow = { id: string; name: string; owner_id: string };
type MembershipRow = { agency_id: string; role: string; status: string; user_id: string };

type SocialAccountDraft = {
  platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  asset_type: "PAGE" | "GROUP" | "ACCOUNT" | "CHANNEL";
  label: string;
  url: string;
  username: string;
};

export default function AddClientPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);

  // form
  const [agencyId, setAgencyId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [socials, setSocials] = useState<SocialAccountDraft[]>([
    { platform: "FACEBOOK", asset_type: "PAGE", label: "", url: "", username: "" },
  ]);

  // recap message (success)
  const [recap, setRecap] = useState<null | {
    clientName: string;
    agencyName: string;
    socialCount: number;
  }>(null);

  const activeAgencyId =
    typeof window !== "undefined" ? localStorage.getItem("active_agency_id") : null;

  const agencyName = useMemo(() => {
    const a = agencies.find((x) => x.id === agencyId);
    return a?.name ?? "—";
  }, [agencies, agencyId]);

  const myAgencies = useMemo(() => {
    // show agencies where user has ACTIVE membership
    const activeIds = new Set(
      memberships.filter((m) => m.status === "ACTIVE").map((m) => m.agency_id)
    );
    return agencies.filter((a) => activeIds.has(a.id));
  }, [agencies, memberships]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = authData.user;
        if (!user) throw new Error("Not authenticated");

        if (!alive) return;
        setUserId(user.id);

        // memberships
        const { data: mems, error: memErr } = await supabase
          .from("agency_members")
          .select("agency_id, role, status, user_id")
          .eq("user_id", user.id);

        if (memErr) throw memErr;

        const agencyIds = Array.from(new Set((mems ?? []).map((m: any) => m.agency_id)));

        // agencies
        const { data: ags, error: agErr } = await supabase
          .from("agencies")
          .select("id, name, owner_id")
          .in("id", agencyIds);

        if (agErr) throw agErr;

        if (!alive) return;

        setMemberships((mems ?? []) as MembershipRow[]);
        setAgencies((ags ?? []) as AgencyRow[]);

        // default agency: activeAgencyId if valid else first agency
        const validActive =
          activeAgencyId && agencyIds.includes(activeAgencyId) ? activeAgencyId : null;
        const fallback = agencyIds[0] ?? "";
        setAgencyId(validActive ?? fallback);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Erreur");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, [supabase, activeAgencyId]);

  function updateSocial(idx: number, patch: Partial<SocialAccountDraft>) {
    setSocials((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addSocialRow() {
    setSocials((prev) => [
      ...prev,
      { platform: "INSTAGRAM", asset_type: "ACCOUNT", label: "", url: "", username: "" },
    ]);
  }

  function removeSocialRow(idx: number) {
    setSocials((prev) => prev.filter((_, i) => i !== idx));
  }

  const cleanedSocials = useMemo(() => {
    // keep only rows that have at least url OR username OR label
    return socials.filter((s) => {
      const hasSomething =
        s.url.trim().length > 0 || s.username.trim().length > 0 || s.label.trim().length > 0;
      return hasSomething;
    });
  }, [socials]);

  const canSubmit = useMemo(() => {
    return agencyId && fullName.trim().length >= 2 && !busy;
  }, [agencyId, fullName, busy]);

  async function onSubmit() {
    setError(null);
    setRecap(null);

    if (!userId) return setError("Utilisateur non détecté.");
    if (!agencyId) return setError("Choisis une agence.");
    if (fullName.trim().length < 2) return setError("Nom client obligatoire.");

    setBusy(true);
    try {
      // 1) insert client
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({
          agency_id: agencyId,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
          created_by: userId,
        })
        .select("id, full_name")
        .single();

      if (cErr) throw cErr;
      if (!client?.id) throw new Error("Insertion client échouée.");

      // 2) insert socials (optional)
      if (cleanedSocials.length > 0) {
        const payload = cleanedSocials.map((s) => ({
          agency_id: agencyId,
          client_id: client.id,
          platform: s.platform,
          asset_type: s.asset_type,
          label: s.label.trim() || null,
          url: s.url.trim() || null,
          username: s.username.trim() || null,
        }));

        const { error: sErr } = await supabase.from("client_social_accounts").insert(payload);
        if (sErr) throw sErr;
      }

      // 3) recap success
      setRecap({
        clientName: client.full_name,
        agencyName,
        socialCount: cleanedSocials.length,
      });

      // reset form (keep agency)
      setFullName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setSocials([{ platform: "FACEBOOK", asset_type: "PAGE", label: "", url: "", username: "" }]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function onAgencyChange(newId: string) {
    setAgencyId(newId);
    // make it the new "active agency" for consistency
    if (typeof window !== "undefined") {
      localStorage.setItem("active_agency_id", newId);
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ajouter un client</h1>
        <p className="text-sm text-slate-500">
          Choisis l’agence, ajoute les infos, puis les réseaux sociaux.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {recap ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">✅ Client créé avec succès</div>
          <div className="mt-1">
            <span className="font-medium">Client :</span> {recap.clientName}
          </div>
          <div>
            <span className="font-medium">Agence :</span> {recap.agencyName}
          </div>
          <div>
            <span className="font-medium">Réseaux ajoutés :</span> {recap.socialCount}
          </div>
        </div>
      ) : null}

      {/* FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* left */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Agence">
            <label className="text-sm font-medium text-slate-700">Choisir une agence</label>
            <select
              value={agencyId}
              onChange={(e) => onAgencyChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-200"
            >
              {myAgencies.length === 0 ? (
                <option value="">Aucune agence</option>
              ) : (
                myAgencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Par défaut : agence active. Tu peux la changer avant validation.
            </p>
          </Section>

          <Section title="Informations client">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nom complet *">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: The Gate Restaurant"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>

              <Field label="Téléphone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 50 000 000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>

              <Field label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>

              <Field label="Notes">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Infos utiles…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Réseaux sociaux"
            right={
              <button
                type="button"
                onClick={addSocialRow}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                + Ajouter un réseau
              </button>
            }
          >
            <div className="space-y-3">
              {socials.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      Réseau #{idx + 1}
                    </div>
                    {socials.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSocialRow(idx)}
                        className="text-sm text-rose-700 hover:underline"
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Plateforme">
                      <select
                        value={s.platform}
                        onChange={(e) =>
                          updateSocial(idx, { platform: e.target.value as any })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="FACEBOOK">Facebook</option>
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="TIKTOK">TikTok</option>
                        <option value="YOUTUBE">YouTube</option>
                      </select>
                    </Field>

                    <Field label="Type">
                      <select
                        value={s.asset_type}
                        onChange={(e) =>
                          updateSocial(idx, { asset_type: e.target.value as any })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="PAGE">Page</option>
                        <option value="GROUP">Groupe</option>
                        <option value="ACCOUNT">Compte</option>
                        <option value="CHANNEL">Chaîne</option>
                      </select>
                    </Field>

                    <Field label="Label (optionnel)">
                      <input
                        value={s.label}
                        onChange={(e) => updateSocial(idx, { label: e.target.value })}
                        placeholder="Ex: Page principale"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </Field>

                    <Field label="Username (optionnel)">
                      <input
                        value={s.username}
                        onChange={(e) =>
                          updateSocial(idx, { username: e.target.value })
                        }
                        placeholder="Ex: @thegate"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="URL (optionnel)">
                        <input
                          value={s.url}
                          onChange={(e) => updateSocial(idx, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Tu peux laisser vide un champ. Une ligne est enregistrée si elle contient au
                    moins un élément (url/username/label).
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Validation..." : "Valider & créer le client"}
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setRecap(null);
              }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium hover:bg-slate-50"
            >
              Effacer message
            </button>
          </div>
        </div>

        {/* right recap */}
        <div className="space-y-4">
          <Section title="Récap avant validation">
            <ul className="text-sm text-slate-700 space-y-2">
              <li>
                <span className="text-slate-500">Agence :</span>{" "}
                <span className="font-semibold">{agencyName}</span>
              </li>
              <li>
                <span className="text-slate-500">Client :</span>{" "}
                <span className="font-semibold">{fullName.trim() || "—"}</span>
              </li>
              <li>
                <span className="text-slate-500">Réseaux à enregistrer :</span>{" "}
                <span className="font-semibold">{cleanedSocials.length}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Après validation, tu auras un message avec le récap.
            </p>
          </Section>

          <Section title="Note">
            <p className="text-sm text-slate-600">
              Plus tard, on ajoutera “Accès publication” (OAuth) par réseau : TikTok / Meta /
              YouTube. Pour l’instant on stocke les infos et on teste le flux.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

/** UI helpers */
function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
