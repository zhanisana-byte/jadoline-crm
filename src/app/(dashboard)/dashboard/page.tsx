import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="card p-4">
        <div className="text-sm text-slate-500">Connecté</div>
        <div className="font-medium">{data.user?.email}</div>
      </div>
    </div>
  );
}
