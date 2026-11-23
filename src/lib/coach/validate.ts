// Controleert of het antwoord van het taalmodel alleen zetten en evaluaties noemt
// die echt in de feiten staan. Dit is de vangrail tegen verzonnen varianten.

import { Chess } from "chess.js";
import type { CoachFacts } from "./types";

// SAN met stukletter, slagzet of rokade. Losse velden ("e4") worden niet gecontroleerd,
// omdat die in gewone zinnen ook velden aanduiden ("de pion op e4").
const SAN_RE =
  /(?<![A-Za-z0-9])(?:O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=?[QRBN])?)[+#]?(?![A-Za-z0-9])/g;

const EVAL_RE = /(?<![\w.])([+-]?\d{1,2}[.,]\d{1,2})(?![\d])/g;
const PERCENT_RE = /\d{1,3}\s?%/g;

function normalizeSan(s: string): string {
  return s
    .replace(/0/g, "O")
    .replace(/[+#!?]/g, "")
    .replace("=", "");
}

function legalSans(fen: string): string[] {
  try {
    return new Chess(fen).moves();
  } catch {
    return [];
  }
}

function pgnSans(pgn: string): string[] {
  if (!pgn) return [];
  try {
    const c = new Chess();
    c.loadPgn(pgn);
    return c.history();
  } catch {
    return [];
  }
}

export function allowedMoves(f: CoachFacts): Set<string> {
  const all: string[] = [];
  all.push(...pgnSans(f.pgn));
  if (f.focus) {
    all.push(f.focus.san);
    for (const b of f.focus.bestMoves) all.push(b.san, ...b.sanMoves);
    if (f.focus.refutation) all.push(...f.focus.refutation.sanMoves);
    // Legale zetten van de speler in de besproken stelling mogen genoemd worden
    // (bv. "je had ook Nf3 kunnen overwegen"). Zetten van de tegenstander ná de fout
    // moeten uit een engine-variant komen.
    all.push(...legalSans(f.focus.fenBefore));
  }
  for (const w of f.whatIf) all.push(w.san, ...w.sanMoves);
  for (const l of f.current?.lines ?? []) all.push(...l.sanMoves);
  all.push(...legalSans(f.currentFen));
  return new Set(all.map(normalizeSan));
}

export interface ValidationResult {
  ok: boolean;
  unknownMoves: string[];
  unknownEvals: string[];
}

export function validateAnswer(answer: string, f: CoachFacts): ValidationResult {
  const allowed = allowedMoves(f);
  const unknownMoves = new Set<string>();
  for (const m of answer.matchAll(SAN_RE)) {
    if (!allowed.has(normalizeSan(m[0]))) unknownMoves.add(m[0]);
  }
  // Cijfers horen niet in het antwoord: de speler ziet scores en winstkansen al in de app.
  const unknownEvals = new Set<string>();
  for (const m of answer.matchAll(EVAL_RE)) unknownEvals.add(m[1]);
  for (const m of answer.matchAll(PERCENT_RE)) unknownEvals.add(m[0]);
  return {
    ok: unknownMoves.size === 0 && unknownEvals.size === 0,
    unknownMoves: [...unknownMoves],
    unknownEvals: [...unknownEvals],
  };
}
