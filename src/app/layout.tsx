import type { Metadata, Viewport } from "next";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schaakcoach",
  description: "Speel tegen Stockfish en praat met een coach over je zetten.",
  appleWebApp: { capable: true, title: "Schaakcoach", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // nodig voor safe-area (notch / home-balk)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavBar />
        <main
          className="mx-auto w-full max-w-6xl flex-1 px-2 pt-2 sm:px-4 sm:py-6"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
