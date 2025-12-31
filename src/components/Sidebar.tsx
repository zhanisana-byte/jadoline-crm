import Link from "next/link";
const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/calendar", label: "Calendrier" },
  { href: "/dashboard/posts", label: "Publications" },
  { href: "/dashboard/gym", label: "Gym" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/billing", label: "Abonnement" },
];
export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4 hidden md:block">
      <div className="font-semibold text-lg">Jadoline</div>
      <nav className="mt-4 flex flex-col gap-1">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="rounded-xl px-3 py-2 hover:bg-slate-100">
            {it.label}
          </Link>
        ))}
        <Link href="/dashboard/logout" className="rounded-xl px-3 py-2 hover:bg-slate-100 text-red-600">
          Déconnexion
        </Link>
      </nav>
    </aside>
  );
}
