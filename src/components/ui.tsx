"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--on-accent)] font-semibold hover:brightness-110 active:brightness-95",
  secondary:
    "bg-[var(--panel)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg)] active:bg-[var(--border)]",
  ghost: "text-[var(--fg)] hover:bg-[var(--bg)] active:bg-[var(--border)]",
  danger: "text-[var(--danger)] border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--bg)]",
};

/** Knop met minimaal 44px aanraakvlak (Apple HIG). */
export function Button({
  variant = "secondary",
  block = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm transition-[filter,background-color] disabled:pointer-events-none disabled:opacity-45 ${
        block ? "w-full" : ""
      } ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Vierkante icoonknop, 44×44, met verplicht toegankelijk label. */
export function IconButton({
  label,
  variant = "secondary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-[filter,background-color] disabled:pointer-events-none disabled:opacity-35 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--panel)] ${className}`}>{children}</div>
  );
}

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const DATETIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Eén datumnotatie in de hele app: "20 nov 2026". */
export function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}
export function formatDateTime(iso: string): string {
  return DATETIME_FMT.format(new Date(iso));
}

/** Gemeenschappelijke bordkleuren en goed leesbare coördinaten. */
export const BOARD_STYLE = {
  lightSquareStyle: { backgroundColor: "var(--sq-light)" },
  darkSquareStyle: { backgroundColor: "var(--sq-dark)" },
  lightSquareNotationStyle: { color: "#7a5a3a", fontWeight: 700 },
  darkSquareNotationStyle: { color: "#ffffff", fontWeight: 700 },
};
