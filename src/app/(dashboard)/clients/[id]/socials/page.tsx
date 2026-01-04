"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SocialRow = {
  id: string;
  client_id: string;
  platform: "META_FACEBOOK_PAGE" | "META_INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "FB_GROUP";
  publish_mode: "AUTO" | "ASSISTED" | "MANUAL";
  display_name: string | null;
  username: string | null;
  url: string | null;
  page_id: string | null;
  ig_business_id: string | null;
  in_portfolio: boolean | null;
  linked_to_page: boolean | null;
  last_error: string | null;
};

export default function ClientSocialsPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const clientId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [clientName, setClientName] = useState<string>("");

  const [rows, setRows] = useState<SocialRow[]>([]);

  // champs manuels (MVP)
  const [igUsername, setIgUsername] = useState("");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [groupUrl, setGroupUrl] = useState("");

  const fbRow = useMemo(() => rows.find((r) => r.platform === "META_FACEBOOK_PAGE"), [rows]);
  const igRow = useMemo(() => rows.find((r) => r.platform === "META_INSTAGRAM"), [rows]);

  function startMetaConnect() {
    window.location.href = `/api/meta/start?client_id=${encodeURIComponent(clientId)}`;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    setOk(null);

    const { data: c, error: cErr } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .single();

    if (cErr) {
      setError(cErr.message);
      setLoading(false);
      return;
    }
    setClientName(c?.name ?? "");

    const { data, error: sErr } = await supabase
      .from("client_social_accounts")
      .select("id, client_id, platform, publish_mode, display_name, username, url, page_id, ig_business_id, in_portfolio, linked_to_page, last_error")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (sErr) {
      setError(sErr.message);
      setRows([]);
    } else {
      const r = (data ?? []) as SocialRow[];
      setRows(r);

      const ig = r.find((x) => x.platform === "META_INSTAGRAM");
      const tt = r.find((x) => x.platform === "TIKTOK");
      const yt = r.find((x) => x.platform === "YOUTUBE");
      const gp = r.find((x) => x.platform === "FB_GROUP");

      setIgUsername(ig?.username ?? "");
      setTiktokUsername(tt?.username ?? "");
      setYoutubeUrl(yt?.url ?? "");
      setGroupUrl(gp?.url ?? "");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function upsertAssisted(platform: SocialRow["platform"], payload: Partial<SocialRow>) {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const { error: uErr } = await supabase.from("client_social_accounts").upsert({
        client_id: clientId,
        platform,
        publish_mode: "ASSISTED",
        ...payload,
      });
      if (uErr) throw uErr;

      setOk("✅ Enregistré.");
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Réseaux — {clientName || "Client"}</h1>
          <div style={{ color: "#64748b", marginTop: 6 }}>
            AUTO quand possible (Meta + IG lié). Sinon ASSISTÉ.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.back()} style={secondaryBtn}>
            ← Retour
          </button>
          <button onClick={() => loadAll()} style={secondaryBtn} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {error ? <Alert type="error" text={error} /> : null}
      {ok ? <Alert type="ok" text={ok} /> : null}

      {/* META */}
      <Card title="Meta (Facebook + Instagram)">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Facebook Page</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {fbRow ? `✅ Connectée: ${fbRow.display_name ?? "Page"}` : "⚪ Non connectée"}
              </div>
            </div>

            <button onClick={startMetaConnect} style={primaryBtn}>
              🔵 {fbRow ? "Reconnecter Meta" : "Connecter Meta"}
            </button>
          </div>

          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700 }}>Instagram</div>
            {igRow?.ig_business_id ? (
              <div style={{ marginTop: 6, color: "#065f46" }}>
                ✅ Lié à une page → Publication <b>AUTO</b>
              </div>
            ) : (
              <div style={{ marginTop: 6, color: "#92400e" }}>
                🟡 Non lié à une page → Publication <b>ASSISTÉE</b>
                <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                  Solution PRO: créer une page Facebook dédiée (ex: “BBGym – Instagram Tech”), lier IG ↔ cette page, puis reconnecter Meta.
                </div>
              </div>
            )}
          </div>

          {/* IG username manuel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Instagram username (assisté)</label>
              <input value={igUsername} onChange={(e) => setIgUsername(e.target.value)} placeholder="bbgym_gafsa" style={inputStyle} />
            </div>
            <button
              disabled={saving}
              onClick={() =>
                upsertAssisted("META_INSTAGRAM", {
                  username: igUsername.trim() || null,
                  display_name: igUsername.trim() ? `@${igUsername.trim()}` : null,
                  in_portfolio: true,
                  linked_to_page: !!igRow?.ig_business_id,
                })
              }
              style={secondaryBtn}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Card>

      {/* TikTok */}
      <Card title="TikTok (assisté)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>TikTok username</label>
            <input value={tiktokUsername} onChange={(e) => setTiktokUsername(e.target.value)} placeholder="bbgym_gafsa" style={inputStyle} />
            <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
              MVP: publication assistée. OAuth TikTok plus tard.
            </div>
          </div>
          <button
            disabled={saving}
            onClick={() =>
              upsertAssisted("TIKTOK", {
                username: tiktokUsername.trim() || null,
                display_name: tiktokUsername.trim() ? `@${tiktokUsername.trim()}` : null,
              })
            }
            style={secondaryBtn}
          >
            Enregistrer
          </button>
        </div>
      </Card>

      {/* YouTube */}
      <Card title="YouTube (assisté)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>URL chaîne YouTube</label>
            <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@..." style={inputStyle} />
          </div>
          <button
            disabled={saving}
            onClick={() =>
              upsertAssisted("YOUTUBE", {
                url: youtubeUrl.trim() || null,
                display_name: youtubeUrl.trim() ? "YouTube" : null,
              })
            }
            style={secondaryBtn}
          >
            Enregistrer
          </button>
        </div>
      </Card>

      {/* Groupe */}
      <Card title="Groupe Facebook (assisté)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>URL du groupe</label>
            <input value={groupUrl} onChange={(e) => setGroupUrl(e.target.value)} placeholder="https://facebook.com/groups/..." style={inputStyle} />
          </div>
          <button
            disabled={saving}
            onClick={() =>
              upsertAssisted("FB_GROUP", {
                url: groupUrl.trim() || null,
                display_name: groupUrl.trim() ? "Groupe Facebook" : null,
              })
            }
            style={secondaryBtn}
          >
            Enregistrer
          </button>
        </div>
      </Card>

      {loading ? <div style={{ color: "#64748b", marginTop: 10 }}>Chargement...</div> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "white" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
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
