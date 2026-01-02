"use client";

import React from "react";

export const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) => (
  <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const CardBody = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`p-5 ${className}`}>{children}</div>;

export const Btn = ({
  children,
  onClick,
  disabled,
  variant = "outline",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-200 text-slate-800 hover:bg-slate-50";
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
};

export const Badge = ({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "blue";
}) => {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return <span className={`px-2.5 py-1 rounded-full text-xs border ${cls}`}>{children}</span>;
};

export const safeDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

export const firstAgency = (a: any) => (Array.isArray(a) ? a[0] ?? null : a ?? null);

export const humanErr = (e: any) =>
  e?.message || e?.error_description || e?.hint || "Erreur inconnue";
