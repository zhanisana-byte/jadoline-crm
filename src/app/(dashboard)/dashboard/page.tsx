import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-[260px] shrink-0">
            <Sidebar />
          </aside>

          {/* Content */}
          <main className="min-w-0 flex-1 rounded-xl bg-white shadow-sm border border-slate-200 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
