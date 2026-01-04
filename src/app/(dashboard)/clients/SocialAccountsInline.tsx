"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SocialDraft = {
  platform: "META_FACEBOOK_PAGE" | "META_INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  value: string; // username/page name (pas de liens)
};

export function SocialAccountsInline({
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

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Réseaux sociaux (manuel MVP)</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Pas de liens, juste les noms/@username. (OAuth Meta/TikTok plus tard)
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={!canAdd.fb} onClick={() => add("META_FACEBOOK_PAGE")} style={btn}>
            + Facebook
          </button>
          <button type="button" disabled={!canAdd.ig} onClick={() => add("META_INSTAGRAM")} style={btn}>
            + Instagram
          </button>
          <button type="button" disabled={!canAdd.tt} onClick={() => add("TIKTOK")} style={btn}>
            + TikTok
          </button>
          <button type="button" disabled={!canAdd.yt} onClick={() => add("YOUTUBE")} style={btn}>
            + YouTube
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 13 }}>Aucun réseau ajouté.</div>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {drafts.map((d, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 12,
                background: "#fff",
                display: "grid",
                gridTemplateColumns: "220px 1fr 44px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>{label(d.platform)}</div>

              <input
                value={d.value}
                onChange={(e) => update(idx, e.target.value)}
                placeholder="Ex: bbgym_gafsa"
                style={input}
              />

              <button type="button" onClick={() => remove(idx)} title="Supprimer" style={del}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "white",
  cursor: "pointer",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
};

const del: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid #fee2e2",
  background: "#fff1f2",
  color: "#b91c1c",
  cursor: "pointer",
};
