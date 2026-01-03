"use client";

export default function QuickRecapCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Récap rapide</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <div>✅ Un utilisateur peut être dans plusieurs agences</div>
        <div>🧩 On collabore via l’Agency ID</div>
        <div>👥 Un CM peut travailler sur plusieurs agences</div>
      </div>
    </div>
  );
}
