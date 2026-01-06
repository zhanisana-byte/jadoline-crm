import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users_profile")
    .select("current_agency_id")
    .eq("user_id", auth.user.id)
    .single();

  const agencyId = profile?.current_agency_id;

  // Si pas d’agence active, on affiche un message (pas 404)
  if (!agencyId) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-lg font-semibold">Aucune agence active</div>
          <div className="text-sm text-slate-600 mt-1">
            Sélectionne une agence (current_agency_id) dans ton profil.
          </div>
          <div className="mt-4">
            <Link className="underline text-blue-600" href="/profile">
              Aller au profil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: clients } = await supabase
    .from("clients")
    .select(`
      id, name, category, logo_url, created_at,
      client_social_accounts(id),
      member_client_access(id)
    `)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-500">
            Gérez vos clients et leurs réseaux sociaux
          </p>
        </div>

        <Link
          href="/clients/create"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          + Créer un client
        </Link>
      </div>

      <div className="rounded-2xl border bg-white/90 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Réseaux</th>
              <th className="text-left px-4 py-3">Membres</th>
              <th className="text-left px-4 py-3">Création</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {clients?.map((c) => (
              <tr key={c.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.logo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-semibold text-slate-400">
                          {c.name?.slice(0, 1)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {String(c.category)}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  {c.client_social_accounts?.length ?? 0}
                </td>
                <td className="px-4 py-3">
                  {c.member_client_access?.length ?? 0}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}
                </td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/clients/${c.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-100"
                  >
                    ⚙️ Gérer
                  </Link>
                </td>
              </tr>
            ))}

            {!clients?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Aucun client pour le moment
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
