"use client";

import { useParams } from "next/navigation";

export default function ClientMetaPage() {
  const params = useParams();
  const clientId = String(params.clientId);

  const connectUrl = `/api/meta/login?client_id=${encodeURIComponent(clientId)}`;

  return (
    <div className="container py-6">
      <div className="page-hero p-5 sm:p-6">
        <div className="card p-6">
          <h1 className="m-0">Connexion Meta</h1>
          <p className="muted mt-2">
            Connecte Facebook + Instagram pour ce client. Les comptes seront récupérés automatiquement via Meta OAuth.
          </p>

          <div className="tip-box mt-4">
            <div className="font-semibold mb-1">Conditions</div>
            <div className="text-slate-700 text-sm">
              - Tu dois être <b>admin</b> d’une page Facebook.<br />
              - L’Instagram doit être <b>Business</b> et lié à cette page.
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a className="btn btn-primary" href={connectUrl}>
              Connecter Facebook / Instagram
            </a>
            <a className="btn btn-ghost" href="/clients">
              Retour Clients
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
