"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itemClass = (active: boolean) =>
  `block px-3 py-2 rounded-md ${
    active ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
  }`;

export default function Sidebar() {
  const pathname = usePathname();

 const items = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clients", href: "/clients" },
  { label: "Calendrier", href: "/calendar" },
  { label: "Publications", href: "/publications" },
  { label: "Gym", href: "/gym" },
  { label: "Notifications", href: "/notifications" },
  { label: "Abonnement", href: "/subscription" },
];


  return (
    <aside className="w-64 border-r min-h-screen p-4">
      <div className="text-xl font-bold mb-4">Jadoline</div>

      <nav className="space-y-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={itemClass(pathname === it.href)}
          >
            {it.label}
          </Link>
        ))}

        <div className="pt-3">
          <Link href="/logout" className="block px-3 py-2 rounded-md text-red-600 hover:bg-red-50">
            Déconnexion
          </Link>
        </div>
      </nav>
    </aside>
  );
}
