"use client";

import { useEffect, useEffectEvent, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

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
      className={`inline-flex min-h-12 sm:min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm transition-[filter,background-color] disabled:pointer-events-none disabled:opacity-45 ${
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
  shortcut,
  variant = "secondary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: Shortcut;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      aria-label={label}
      aria-keyshortcuts={shortcut?.aria}
      title={shortcut ? `${label} (${shortcut.hint})` : label}
      className={`inline-flex size-12 sm:size-11 shrink-0 items-center justify-center rounded-lg transition-[filter,background-color] disabled:pointer-events-none disabled:opacity-35 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
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

/**
 * Grijs blok in de vorm van echte inhoud. Pulseert alleen zonder "reduced motion".
 * Gebruik binnen dezelfde component als de geladen staat, zodat er niets verspringt.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block rounded-md bg-[var(--border)] motion-safe:animate-pulse ${className}`} />;
}

/** true zodra `active` langer dan `ms` aanhoudt; voorkomt een flits van skeletons bij snel laden. */
export function useDelayed(active: boolean, ms = 300): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setLate(true), ms);
    return () => {
      clearTimeout(t);
      setLate(false);
    };
  }, [active, ms]);
  return active && late;
}

/** Sneltoets: `hint` is wat je ziet (bv. "←"), `aria` de naam voor aria-keyshortcuts (bv. "ArrowLeft"). */
export interface Shortcut {
  hint: string;
  aria: string;
}
export const KEYS = {
  prev: { hint: "←", aria: "ArrowLeft" },
  next: { hint: "→", aria: "ArrowRight" },
  back: { hint: "Esc", aria: "Escape" },
} satisfies Record<string, Shortcut>;

/** Typt iemand in een veld? Dan gaan sneltoetsen niet af. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

/**
 * Globale sneltoetsen zonder modifier (pijltjes, Esc). Gaan niet af tijdens typen,
 * bij IME-invoer of met Ctrl/⌘/Alt ingedrukt. Geef `true` terug als de toets is afgehandeld.
 */
export function useKeyShortcuts(onKey: (key: string) => boolean | void) {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      if (handle(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}

/** Keuze uit een paar opties (radiogroep), vlak in één balk. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-xl bg-[var(--panel)] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-12 rounded-lg px-2 text-sm transition-colors sm:min-h-11 ${
              on
                ? "bg-[var(--accent)] font-semibold text-[var(--on-accent)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Aan/uit-schakelaar als volle rij (makkelijk te raken op de telefoon). */
export function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-[var(--panel)] px-4 text-left text-sm sm:min-h-11"
    >
      <span className="flex items-center gap-2">{children}</span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
