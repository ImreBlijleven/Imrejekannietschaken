"use client";

// Kleine instellingen per browser. Alles in try/catch: localStorage kan geblokkeerd zijn.

export interface Settings {
  engineDepth: number; // analysediepte Stockfish
  coachToken: string; // optioneel wachtwoord voor /api/coach (zie COACH_ACCESS_TOKEN)
}

const DEFAULTS: Settings = { engineDepth: 14, coachToken: "" };
const KEY = "schaakcoach.settings";

/** Op touch-apparaten (telefoon) standaard diepte 12: merkbaar sneller, nog steeds sterk. */
function defaults(): Settings {
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return { ...DEFAULTS, engineDepth: 12 };
  } catch {
    /* geen window */
  }
  return DEFAULTS;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    return defaults();
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* negeren */
  }
}
