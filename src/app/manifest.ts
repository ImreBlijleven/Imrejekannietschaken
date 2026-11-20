import type { MetadataRoute } from "next";

// Maakt "Zet op beginscherm" mogelijk; de app opent dan schermvullend zonder browserbalk.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Schaakcoach",
    short_name: "Schaakcoach",
    description: "Speel tegen Stockfish en praat met een coach over je zetten.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f5f2",
    theme_color: "#2f6f4f",
    lang: "nl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
