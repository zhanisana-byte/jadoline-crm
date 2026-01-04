import { createSupabaseServer } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = createSupabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return <div className="container p-6">Non connecté</div>;

  // profil user
  const { data: profile } = await supabase
    .from("users_profile")
    .select("full_name, role, agency_id")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "OWNER" || profile?.role === "ADMIN";

  // clients visibles dans le profil
  let clientsQuery = supabase
    .from("clients")
    .select("id,name,created_by,created_at")
    .eq("agency_id", profile.agency_id);

  if (!isAdmin) {
    clientsQuery = clientsQuery.eq("created_by", user.id);
  }

  const { data: clients } = await clientsQuery;

  // visibilité
  const { data: visibility } = await supabase
    .from("client_profile_visibility")
    .select("client_id,show")
    .eq("user_id", user.id);

  const visibleMap = new Map(
    (visibility || []).map((v) => [v.client_id, v.show])
  );

  return (
    <div className="container py-6">
      <h1>Mon profil</h1>

      <div className="card p-4 mt-4">
        <div className="font-semibold">{profile.full_name}</div>
        <div className="text-sm text-slate-500">
          Rôle : {profile.role}
        </div>
      </div>

      <div className="card p-4 mt-6">
        <h2 className="mb-3">Clients visibles dans mon profil</h2>

        {clients?.length === 0 && (
          <div className="text-sm text-slate-500">Aucun client</div>
        )}

        <div className="grid gap-2">
          {clients?.map((c) => {
            const show = visibleMap.get(c.id) !== false;

            return (
              <div
                key={c.id}
                className="flex items-center justify-between border rounded-xl p-3 bg-white"
              >
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    Créé par {c.created_by === user.id ? "moi" : "CM"}
                  </div>
                </div>

                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    show ? "bg-green-100 text-green-700" : "bg-slate-200"
                  }`}
                >
                  {show ? "Visible" : "Masqué"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
