"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ================= TYPES ================= */

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  agency_id: string | null;
  account_type: "AGENCY" | "SOCIAL_MANAGER";
};

type AgencyRow = {
  id: string;
  name: string | null;
};

type InviteRow = {
  id: string;
  agency_id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  created_at: string;
};

/* ================= UTILS ================= */

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

/* ================= PAGE ================= */

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [email, setEmail] = useState("");

  const [openInv, setOpenInv] = useState(false);

  /* ===== LOAD PROFILE ===== */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      setEmail(data.user.email ?? "");

      const { data: prof } = await supabase
        .from("users_profile")
        .select("user_id, full_name, agency_id, account_type")
        .eq("user_id", data.user.id)
        .single();

      setProfile(prof);

      if (prof?.agency_id) {
        const { data: ag } = await supabase
          .from("agencies")
          .select("id, name")
          .eq("id", prof.agency_id)
          .single();
        setAgency(ag);
      }

      setLoading(false);
    })();
  }, [supabase]);

  if (loading || !profile) return null;

  const displayName =
    profile.account_type === "AGENCY"
      ? agency?.name ?? "Agence"
      : profile.full_name ?? "Utilisateur";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ================= HEADER ================= */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="avatarCircle">
              {initials(displayName)}
            </div>

            <div>
              <div className="text-2xl font-extrabold">
                {displayName}
              </div>

              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="badge badge-info">
                  {profile.account_type}
                </span>

                {profile.agency_id && (
                  <span className="text-slate-500">
                    ID agence :
                    <span className="ml-1 font-mono text-indigo-700">
                      {profile.agency_id}
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {email}
              </div>
            </div>
          </div>

          <button
            onClick={() => setOpenInv(true)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Notifications
          </button>
        </div>
      </div>

      {/* ================= MODAL ================= */}
      {openInv && (
        <InvitationsModal onClose={() => setOpenInv(false)} />
      )}
    </div>
  );
}

/* ================= MODAL INVITATIONS ================= */

function InvitationsModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: inv } = await supabase
        .from("agency_invites")
        .select("id, agency_id, email, status, created_at")
        .eq("email", data.user.email)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      setInvites(inv ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  async function accept(inv: InviteRow) {
    await supabase
      .from("agency_invites")
      .update({ status: "ACCEPTED" })
      .eq("id", inv.id);

    setInvites((v) => v.filter((i) => i.id !== inv.id));
  }

  async function refuse(inv: InviteRow) {
    await supabase
      .from("agency_invites")
      .update({ status: "REVOKED" })
      .eq("id", inv.id);

    setInvites((v) => v.filter((i) => i.id !== inv.id));
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[90vw] max-w-xl">
        <div className="rounded-2xl bg-white shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold">
              Invitations en attente
            </h2>
            <button onClick={onClose}>✕</button>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">
              Chargement…
            </div>
          ) : invites.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aucune invitation
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border border-slate-200 p-4 flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold">
                      Agence
                    </div>
                    <div className="text-xs text-slate-500">
                      ID : {inv.agency_id}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => accept(inv)}
                      className="rounded-lg bg-emerald-500 text-white px-3 py-1 text-sm"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => refuse(inv)}
                      className="rounded-lg bg-rose-500 text-white px-3 py-1 text-sm"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
