"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, ChessKnight, GraduationCap, History, Settings, type LucideIcon } from "lucide-react";

const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Spelen", Icon: ChessKnight },
  { href: "/oefenen", label: "Oefenen", Icon: GraduationCap },
  { href: "/patronen", label: "Patronen", Icon: ChartColumn },
  { href: "/partijen", label: "Partijen", Icon: History },
  { href: "/instellingen", label: "Instellingen", Icon: Settings },
];

/** Bovenbalk op grote schermen, tabbalk onderaan op de telefoon (bereikbaar met je duim). */
export function NavBar() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <header className="hidden sm:block border-b border-[var(--border)] bg-[var(--panel)]">
        <nav className="safe-x mx-auto flex max-w-6xl items-center gap-1 py-2" aria-label="Hoofdmenu">
          <span className="mr-4 flex items-center gap-2 font-bold">
            <ChessKnight className="size-5 text-[var(--accent-ink)]" aria-hidden />
            Schaakcoach
          </span>
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`flex min-h-12 sm:min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-[var(--bg)] ${
                active(href) ? "font-semibold text-[var(--accent-ink)]" : ""
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <nav
        aria-label="Hoofdmenu"
        className="sm:hidden fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--panel)]"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {NAV.map(({ href, label, Icon }) => {
          const on = active(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${
                on ? "font-semibold text-[var(--accent-ink)]" : "text-[var(--muted)]"
              }`}
            >
              <Icon className="size-[22px]" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
