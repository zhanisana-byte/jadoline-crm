"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    router.push("/dashboard");
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <p className="text-sm text-slate-500 mt-1">Jadoline CRM</p>
        <div className="mt-4">
          <label className="text-sm">Email</label>
          <input className="input mt-1" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div className="mt-3">
          <label className="text-sm">Mot de passe</label>
          <input type="password" className="input mt-1" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>
        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
        <button className="btn-primary mt-5 w-full" disabled={loading}>{loading ? "..." : "Se connecter"}</button>
        <div className="mt-4 text-sm"><Link href="/register">Créer un compte</Link></div>
      </form>
    </div>
  );
}
