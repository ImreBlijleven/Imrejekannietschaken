import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schaakcoach",
  description: "Speel tegen Stockfish en praat met een coach over je zetten.",
};

const NAV = [
  { href: "/", label: "Spelen" },
  { href: "/patronen", label: "Patronen" },
  { href: "/partijen", label: "Partijen" },
  { href: "/instellingen", label: "Instellingen" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)] bg-[var(--panel)]">
          <nav className="mx-auto max-w-6xl flex items-center gap-1 px-4 py-3 overflow-x-auto">
            <span className="font-bold mr-4 whitespace-nowrap">♞ Schaakcoach</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--bg)] whitespace-nowrap">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
