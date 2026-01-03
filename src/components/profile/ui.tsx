export function humanErr(e: any): string {
  const m = String(e?.message ?? e ?? "Erreur inconnue");
  // messages fréquents
  if (m.includes("infinite recursion")) {
    return `RLS/policy: infinite recursion détectée (policy). Corrige la policy sur agency_members. Détail: ${m}`;
  }
  return m;
}

export function CopyBtn({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
      className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
    >
      Copier
    </button>
  );
}
