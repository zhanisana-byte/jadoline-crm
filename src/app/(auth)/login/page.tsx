"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.get("confirmed") === "1") {
      setMsgType("success");
      setMsg("Votre compte a été confirmé avec succès ✅ Vous pouvez vous connecter.");
    }

    if (params.get("error")) {
      setMsgType("error");
      setMsg("Le lien de confirmation est invalide ou expiré ❌");
    }
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsgType("error");
      setMsg(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <p className="text-sm text-slate-500 mt-1">Jadoline CRM</p>

        <div className="mt-4">
          <label className="text-sm">Email</label>
          <input
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label className="text-sm">Mot de passe</label>
          <input
            type="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {msg && (
          <div
            className={`mt-4 text-sm border rounded-xl px-3 py-2 ${
              msgType === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {msg}
          </div>
        )}

        <button className="btn-primary mt-5 w-full" disabled={loading}>
          {loading ? "..." : "Se connecter"}
        </button>

        <div className="mt-4 text-sm">
          <Link href="/register">Créer un compte</Link>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Chargement…</div>}>
      <LoginInner />
    </Suspense>
  );
}
