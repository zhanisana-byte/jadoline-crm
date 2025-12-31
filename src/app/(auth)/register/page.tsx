"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (signUpError) { setLoading(false); return setMsg(signUpError.message); }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setLoading(false); return setMsg("Compte créé. Vérifie ton email puis connecte-toi."); }
    const resp = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName }),
    });
    const data = await resp.json();
    setLoading(false);
    if (!resp.ok) return setMsg(data?.error || "Erreur bootstrap");
    router.push("/dashboard");
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-sm text-slate-500 mt-1">Jadoline CRM</p>
        <div className="mt-4">
          <label className="text-sm">Nom de l’agence</label>
          <input className="input mt-1" value={agencyName} onChange={(e)=>setAgencyName(e.target.value)} required />
        </div>
        <div className="mt-3">
          <label className="text-sm">Nom complet</label>
          <input className="input mt-1" value={fullName} onChange={(e)=>setFullName(e.target.value)} required />
        </div>
        <div className="mt-3">
          <label className="text-sm">Email</label>
          <input className="input mt-1" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </div>
        <div className="mt-3">
          <label className="text-sm">Mot de passe</label>
          <input type="password" className="input mt-1" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        </div>
        {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}
        <button className="btn-primary mt-5 w-full" disabled={loading}>{loading ? "..." : "Créer mon compte"}</button>
        <div className="mt-4 text-sm">Déjà un compte ? <Link href="/login">Connexion</Link></div>
      </form>
    </div>
  );
}
