import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      <div className="dashboard-container">
        <Sidebar />
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
