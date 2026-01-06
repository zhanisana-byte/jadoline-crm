"use client";

import { useMemo, useState } from "react";

export type SocialDraft = {
  platform: "META_FACEBOOK_PAGE" | "META_INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  value: string;
};

export default function SocialAccountsInline({
  onChange,
}: {
  onChange: (drafts: SocialDraft[]) => void;
}) {
  const [drafts, setDrafts] = useState<SocialDraft[]>([]);

  const canAdd = useMemo(() => {
    const set = new Set(drafts.map((d) => d.platform));
    return {
      fb: !set.has("META_FACEBOOK_PAGE"),
      ig: !set.has("META_INSTAGRAM"),
      tt: !set.has("TIKTOK"),
      yt: !set.has("YOUTUBE"),
    };
  }, [drafts]);

  function add(platform: SocialDraft["platform"]) {
    const next = [...drafts, { platform, value: "" }];
    setDrafts(next);
    onChange(next);
  }

  function update(idx: number, value: string) {
    const next = drafts.map((d, i) => (i === idx ? { ...d, value } : d));
    setDrafts(next);
    onChange(next);
  }

  function remove(idx: number) {
    const next = drafts.filter((_, i) => i !== idx);
    setDrafts(next);
    onChange(next);
  }

  function label(p: SocialDraft["platform"]) {
    if (p === "META_FACEBOOK_PAGE") return "Facebook Page (nom)";
    if (p === "META_INSTAGRAM") return "Instagram (@username)";
    if (p === "TIKTOK") return "TikTok (@username)";
    return "YouTube (nom de chaîne)";
  }

  const Btn = ({
    disabled,
    children,
    onClick,
  }: {
    disabled?: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl border text-sm transition",
        disabled
          ? "opacity-40 cursor-not-allowed bg-white"
          : "bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="font-semibold">Réseaux sociaux (manuel MVP)</div>
          <div className="text-xs text-slate-500">
            Ajoute juste les noms/@username (connexion OAuth plus tard).
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Btn disabled={!canAdd.fb} onClick={() => add("META_FACEBOOK_PAGE")}>
            + Facebook
          </Btn>
          <Btn disabled={!canAdd.ig} onClick={() => add("META_INSTAGRAM")}>
            + Instagram
          </Btn>
          <Btn disabled={!canAdd.tt} onClick={() => add("TIKTOK")}>
            + TikTok
          </Btn>
          <Btn disabled={!canAdd.yt} onClick={() => add("YOUTUBE")}>
            + YouTube
          </Btn>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="mt-3 text-sm text-slate-400">Aucun réseau ajouté.</div>
      ) : (
        <div className="mt-3 grid gap-3">
          {drafts.map((d, idx) => (
            <div
              key={idx}
              className="rounded-2xl border bg-white p-3 md:p-4 grid md:grid-cols-[260px_1fr_48px] gap-3 items-center"
            >
              <div className="font-medium">{label(d.platform)}</div>

              <input
                value={d.value}
                onChange={(e) => update(idx, e.target.value)}
                placeholder="Ex: @bbgym_gafsa"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              />

              <button
                type="button"
                onClick={() => remove(idx)}
                title="Supprimer"
                className="h-12 w-12 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
