"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const itemClass = (active: boolean) =>
  `block px-3 py-2 rounded-md transition ${
    active
      ? "bg-slate-100 font-semibold text-slate-900"
      : "text-slate-700 hover:bg-slate-50"
  }`;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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
    <aside className="w-64 border-r min-h-screen p-4 bg-white">
      <div className="text-xl font-bold mb-6">Jadoline</div>

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

        <div className="pt-6 border-t">
          <button
            className="block w-full text-left px-3 py-2 rounded-md text-red-600 hover:bg-red-50 transition"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
          >
            Déconnexion
          </button>
        </div>
      </nav>
    </aside>
  );
}
