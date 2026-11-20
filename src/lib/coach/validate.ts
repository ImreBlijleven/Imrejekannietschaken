// Controleert of het antwoord van het taalmodel alleen zetten en evaluaties noemt
// die echt in de feiten staan. Dit is de vangrail tegen verzonnen varianten.

import { Chess } from "chess.js";
import type { CoachFacts } from "./types";

// SAN met stukletter, slagzet of rokade. Losse velden ("e4") worden niet gecontroleerd,
// omdat die in gewone zinnen ook velden aanduiden ("de pion op e4").
const SAN_RE =
  /(?<![A-Za-z0-9])(?:O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=?[QRBN])?)[+#]?(?![A-Za-z0-9])/g;

const EVAL_RE = /(?<![\w.])([+-]\d{1,2}[.,]\d{1,2})(?![\d])/g;

function normalizeSan(s: string): string {
  return s.replace(/0/g, "O").replace(/[+#!?]/g, "").replace("=", "");
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
  all.push(...legalSans(f.currentFen));
  return new Set(all.map(normalizeSan));
}

function allowedEvals(f: CoachFacts): number[] {
  const vals: string[] = [];
  if (f.focus) {
    vals.push(f.focus.evalBefore, f.focus.evalAfter);
    f.focus.bestMoves.forEach((b) => vals.push(b.eval));
    if (f.focus.refutation) vals.push(f.focus.refutation.eval);
  }
  f.whatIf.forEach((w) => vals.push(w.eval));
  return vals.filter((v) => !v.startsWith("#")).map((v) => parseFloat(v));
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
  const evals = allowedEvals(f);
  const unknownEvals = new Set<string>();
  for (const m of answer.matchAll(EVAL_RE)) {
    const v = parseFloat(m[1].replace(",", "."));
    // Afronden mag (bv. +1.25 → +1.3)
    if (!evals.some((e) => Math.abs(e - v) <= 0.3)) unknownEvals.add(m[1]);
  }
  return {
    ok: unknownMoves.size === 0 && unknownEvals.size === 0,
    unknownMoves: [...unknownMoves],
    unknownEvals: [...unknownEvals],
  };
}
