"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Spelen", icon: "♞" },
  { href: "/patronen", label: "Patronen", icon: "📊" },
  { href: "/partijen", label: "Partijen", icon: "📜" },
  { href: "/instellingen", label: "Instellingen", icon: "⚙️" },
];

/** Bovenbalk op grote schermen, tabbalk onderaan op de telefoon (bereikbaar met je duim). */
export function NavBar() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <header className="hidden sm:block border-b border-[var(--border)] bg-[var(--panel)]">
        <nav className="mx-auto max-w-6xl flex items-center gap-1 px-4 py-3">
          <span className="font-bold mr-4">♞ Schaakcoach</span>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--bg)] ${active(n.href) ? "font-semibold text-[var(--accent)]" : ""}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--panel)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(n.href) ? "text-[var(--accent)] font-semibold" : "text-[var(--muted)]"}`}
          >
            <span className="text-xl leading-none" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
