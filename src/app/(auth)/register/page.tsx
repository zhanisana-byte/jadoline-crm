// app/(auth)/layout.tsx
import "@/app/auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-wrap">{children}</div>
    </div>
  );
}
