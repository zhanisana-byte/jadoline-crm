"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "AGENCY" | "SOCIAL_MANAGER";

export default function RegisterClient() {
  const supabase = createClient();
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>("AGENCY");
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [joinAgencyId, setJoinAgencyId] = useState("");
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
          account_type: accountType,
          agency_name: accountType === "AGENCY" ? agencyName : null,
          join_agency_id:
            accountType === "SOCIAL_MANAGER" && joinAgencyId
              ? joinAgencyId
              : null,
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (!error) router.push("/check-email");
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      
      {/* TYPE */}
      <div className="flex gap-4">
        <button
          onClick={() => setAccountType("AGENCY")}
          className={`flex-1 p-4 rounded-xl ${
            accountType === "AGENCY" ? "bg-indigo-600 text-white" : "bg-gray-100"
          }`}
        >
          Agence
        </button>

        <button
          onClick={() => setAccountType("SOCIAL_MANAGER")}
          className={`flex-1 p-4 rounded-xl ${
            accountType === "SOCIAL_MANAGER"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100"
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

        {accountType === "AGENCY" && (
          <input
            className="input"
            placeholder="Nom de l’agence"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
          />
        )}

        {accountType === "SOCIAL_MANAGER" && (
          <input
            className="input"
            placeholder="Agency ID (optionnel)"
            value={joinAgencyId}
            onChange={(e) => setJoinAgencyId(e.target.value)}
          />
        )}

        <input
          className="input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="input"
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl"
        >
          Créer mon compte
        </button>
      </div>
    </div>
  );
}
