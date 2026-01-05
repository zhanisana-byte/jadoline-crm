"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "AGENCY" | "SOCIAL_MANAGER";

export default function RegisterClient() {
  const supabase = createClient();
  const router = useRouter();

  const [type, setType] = useState<AccountType>("AGENCY");
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          account_type: type,
          agency_name: type === "AGENCY" ? agencyName : null,
          join_agency_id: type === "SOCIAL_MANAGER" ? agencyId || null : null,
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (!error) router.push("/check-email");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-8">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Créer un compte Jadoline</h1>
          <p className="text-gray-500 text-sm">
            CRM professionnel multi-agence
          </p>
        </div>

        {/* TYPE SWITCH */}
        <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setType("AGENCY")}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === "AGENCY"
                ? "bg-white shadow text-indigo-600"
                : "text-gray-500"
            }`}
          >
            Agence
          </button>

          <button
            onClick={() => setType("SOCIAL_MANAGER")}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === "SOCIAL_MANAGER"
                ? "bg-white shadow text-indigo-600"
                : "text-gray-500"
            }`}
          >
            Social Manager
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-4">
          <input
            className="input"
            placeholder="Nom complet"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          {type === "AGENCY" && (
            <input
              className="input"
              placeholder="Nom de l’agence"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
          )}

          {type === "SOCIAL_MANAGER" && (
            <input
              className="input"
              placeholder="Agency ID (optionnel)"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
            />
          )}

          <input
            className="input"
            placeholder="Email professionnel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="input"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* SUBMIT */}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
        >
          Créer mon compte
        </button>

        {/* FOOTER */}
        <p className="text-center text-sm text-gray-500">
          Déjà un compte ?{" "}
          <a href="/login" className="text-indigo-600 hover:underline">
            Connexion
          </a>
        </p>
      </div>
    </div>
  );
}
