// Puzzels uit de Lichess-puzzeldatabase (CC0, database.lichess.org), geselecteerd met
// scripts/select-puzzles.py naar public/puzzles.json. Plus "herkansing": je eigen fouten.

import { Chess } from "chess.js";
import type { Category } from "../chess/patterns";
import type { MistakeRecord, ReviewRecord } from "../db/types";

/** Eén "vind de zet"-opgave. Zetten in UCI. */
export interface PuzzleItem {
  key: string; // id voor de herhaling: "puzzel:<id>" of "fout:<id>"
  kind: "puzzel" | "fout";
  startFen: string;
  setupMove?: string; // zet van de tegenstander vóór de opgave (Lichess-puzzels)
  solution: string[]; // jouw zet, antwoord, jouw zet, ...
  acceptAlternatives: boolean; // ook een andere, even sterke zet goed rekenen (eigen fouten)
  rating?: number;
  themes?: string[];
  context?: string; // bv. "Op 20 nov speelde je hier Qh5."
  lichessId?: string;
}

export const THEME_NAMES: Record<string, string> = {
  fork: "Vork",
  pin: "Penning",
  skewer: "Spies",
  discoveredAttack: "Aftrekaanval",
  hangingPiece: "Onbeschermd stuk",
  mateIn1: "Mat in 1",
  mateIn2: "Mat in 2",
  backRankMate: "Mat op de achterste rij",
  deflection: "Afleiding",
  attraction: "Lokken",
  trappedPiece: "Ingesloten stuk",
  intermezzo: "Tussenzet",
  defensiveMove: "Verdedigen",
};

/** Welke puzzelthema's helpen tegen welk foutpatroon uit je eigen partijen. */
export const THEMES_FOR_PATTERN: Partial<Record<Category, string[]>> = {
  vork_toegelaten: ["fork"],
  stuk_hangend: ["hangingPiece"],
  tactiek_toegelaten: ["pin", "skewer", "discoveredAttack", "defensiveMove"],
  tactiek_gemist: ["fork", "pin", "deflection", "attraction"],
  mat_toegelaten: ["defensiveMove", "backRankMate"],
  mat_gemist: ["mateIn1", "mateIn2"],
  koning_onveilig: ["defensiveMove"],
};

interface PuzzleFile {
  themes: string[];
  puzzles: [string, string, string, number, number[]][];
}

let cache: Promise<PuzzleItem[]> | null = null;

/** Laad de puzzels (één keer per sessie, pas als je ze nodig hebt). */
export function loadPuzzles(): Promise<PuzzleItem[]> {
  if (!cache) {
    cache = fetch("/puzzles.json")
      .then((r) => r.json() as Promise<PuzzleFile>)
      .then((f) =>
        f.puzzles.map(([id, fen, moves, rating, themeIdx]) => {
          const ms = moves.split(" ");
          return {
            key: `puzzel:${id}`,
            kind: "puzzel" as const,
            startFen: fen,
            setupMove: ms[0],
            solution: ms.slice(1),
            acceptAlternatives: false,
            rating,
            themes: themeIdx.map((i) => f.themes[i]),
            lichessId: id,
          };
        }),
      );
    cache.catch(() => (cache = null));
  }
  return cache;
}

/**
 * Kies een sessie: eerst puzzels uit dit thema die aan herhaling toe zijn, dan nieuwe puzzels
 * zo dicht mogelijk bij je puzzelrating.
 */
export function pickPuzzles(
  all: PuzzleItem[],
  themes: string[],
  rating: number,
  reviews: Map<string, ReviewRecord>,
  count = 10,
): PuzzleItem[] {
  const now = new Date().toISOString();
  const inTheme = all.filter((p) => p.themes?.some((t) => themes.includes(t)));
  const due = inTheme.filter((p) => {
    const r = reviews.get(p.key);
    return r && r.due <= now;
  });
  const fresh = inTheme
    .filter((p) => !reviews.has(p.key))
    .sort((a, b) => Math.abs((a.rating ?? 0) - rating) - Math.abs((b.rating ?? 0) - rating));
  return [...due.slice(0, Math.ceil(count / 2)), ...fresh].slice(0, count);
}

/** Herkansing: je fouten en blunders als opgave; eerst wat aan de beurt is, dan nieuwe. */
export function pickMistakes(mistakes: MistakeRecord[], reviews: Map<string, ReviewRecord>, count = 10): PuzzleItem[] {
  const now = new Date().toISOString();
  const items: { item: PuzzleItem; order: string }[] = [];
  for (const m of mistakes) {
    if (m.label !== "fout" && m.label !== "blunder") continue;
    const key = `fout:${m.id}`;
    const r = reviews.get(key);
    if (r && r.due > now) continue;
    let best;
    try {
      best = new Chess(m.fenBefore).move(m.bestSan);
    } catch {
      continue;
    }
    const date = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(m.createdAt));
    items.push({
      // herhalingen eerst (oudste eerst), dan nieuwe fouten (nieuwste eerst)
      order: r ? `0${r.due}` : `1${String(9e15 - new Date(m.createdAt).getTime()).padStart(16, "0")}`,
      item: {
        key,
        kind: "fout",
        startFen: m.fenBefore,
        solution: [best.lan],
        acceptAlternatives: true,
        context: `Op ${date} speelde je hier ${m.san}.`,
      },
    });
  }
  return items
    .sort((a, b) => a.order.localeCompare(b.order))
    .slice(0, count)
    .map((x) => x.item);
}

/** Aantal eigen fouten dat nu aan de beurt is (voor de teller in het overzicht). */
export function dueMistakeCount(mistakes: MistakeRecord[], reviews: Map<string, ReviewRecord>): number {
  return pickMistakes(mistakes, reviews, Infinity).length;
}

/* Puzzelrating: Elo-achtig, per apparaat bewaard. */
const RATING_KEY = "schaakcoach.puzzelrating";

export function loadPuzzleRating(): number {
  try {
    const v = Number(localStorage.getItem(RATING_KEY));
    return v > 0 ? v : 1200;
  } catch {
    return 1200;
  }
}

export function updatePuzzleRating(current: number, puzzleRating: number, solved: boolean): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - current) / 400));
  const next = Math.round(current + 24 * ((solved ? 1 : 0) - expected));
  try {
    localStorage.setItem(RATING_KEY, String(next));
  } catch {
    /* negeren */
  }
  return next;
}
