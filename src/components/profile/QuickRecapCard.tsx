"use client";

export default function QuickRecapCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <h2 className="text-lg font-semibold">Récap rapide</h2>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>✅ Un utilisateur peut être dans plusieurs agences</li>
          <li>✅ On travaille uniquement avec Agency ID (pas de clé)</li>
          <li>✅ Un CM peut travailler sur plusieurs agences</li>
        </ul>
      </div>
    </div>
  );
}
