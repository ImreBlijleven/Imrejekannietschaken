"use client";

// Kleine instellingen per browser. Alles in try/catch: localStorage kan geblokkeerd zijn.

export interface Settings {
  engineDepth: number; // analysediepte Stockfish
  coachToken: string; // optioneel wachtwoord voor /api/coach (zie COACH_ACCESS_TOKEN)
}

const DEFAULTS: Settings = { engineDepth: 14, coachToken: "" };
const KEY = "schaakcoach.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* negeren */
  }
}
