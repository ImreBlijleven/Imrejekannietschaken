"use client";

import { Chess } from "chess.js";
import { getOpponentEngine } from "../chess/engine-browser";
import { classify, moveAccuracy, winPercent } from "../chess/evaluation";
import { detectPattern } from "../chess/patterns";
import { uciLineToSan, uciToMove } from "../chess/uci";
import { getRepository } from "../db/dexie-repository";
import { newId, now } from "../db/repository";
import { SCHEMA_VERSION, type GameMode, type GameRecord, type PlyRecord } from "../db/types";
import { analyse } from "./analysis";

export const LEVELS = [
  { value: 0, name: "Beginner" },
  { value: 3, name: "Makkelijk" },
  { value: 6, name: "Gemiddeld" },
  { value: 10, name: "Gevorderd" },
  { value: 15, name: "Sterk" },
  { value: 20, name: "Maximaal" },
];

export function newGame(playerColor: "w" | "b", level: number, mode: GameMode): GameRecord {
  const ts = now();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: SCHEMA_VERSION,
    playerColor,
    level,
    mode,
    status: "bezig",
    result: "*",
    pgn: "",
    plies: [],
  };
}

export function chessFromPlies(plies: PlyRecord[]): Chess {
  const c = new Chess();
  for (const p of plies) c.move(p.san);
  return c;
}

/** Voeg een zet toe (nog zonder engine-info). Geeft null bij een illegale zet. */
export function applyMove(
  game: GameRecord,
  move: string | { from: string; to: string; promotion?: string },
): PlyRecord | null {
  const chess = chessFromPlies(game.plies);
  const fenBefore = chess.fen();
  let m;
  try {
    m = chess.move(move);
  } catch {
    return null;
  }
  const ply: PlyRecord = {
    ply: game.plies.length,
    san: m.san,
    uci: m.lan,
    color: m.color,
    fenBefore,
    fenAfter: chess.fen(),
    evalAfter: { cp: 0 },
  };
  game.plies.push(ply);
  game.pgn = chess.pgn();
  return ply;
}

/** Beoordeel een zet van de speler met Stockfish en sla een eventuele fout op als patroon. */
export async function evaluatePlayerPly(game: GameRecord, ply: PlyRecord): Promise<PlyRecord> {
  const [before, after] = await Promise.all([analyse(ply.fenBefore, 3), analyse(ply.fenAfter, 1)]);
  const sBefore = before.lines[0]?.score ?? { cp: 0 };
  const sAfter = after.lines[0]?.score ?? { cp: 0 };
  const { label, drop } = classify(sBefore, sAfter, ply.color, before.bestMove === ply.uci);
  const bestUci = before.bestMove ?? undefined;
  const bestSan = bestUci ? uciLineToSan(ply.fenBefore, [bestUci], 1)[0] : undefined;

  const updated: PlyRecord = {
    ...ply,
    evalAfter: sAfter,
    bestUci,
    bestSan,
    label,
    drop,
    accuracy: moveAccuracy(winPercent(sBefore, ply.color), winPercent(sAfter, ply.color)),
  };

  if (label === "onnauwkeurig" || label === "fout" || label === "blunder") {
    const pattern = detectPattern(ply.fenBefore, ply.uci, before, after);
    updated.category = pattern.category;
    updated.detail = pattern.detail;
    const ts = now();
    await getRepository().saveMistake({
      id: newId(),
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: SCHEMA_VERSION,
      gameId: game.id,
      ply: ply.ply,
      fenBefore: ply.fenBefore,
      san: ply.san,
      bestSan: bestSan ?? "",
      bestLineSan: before.lines[0] ? uciLineToSan(ply.fenBefore, before.lines[0].pv, 8) : [],
      refutationSan: after.lines[0] ? uciLineToSan(ply.fenAfter, after.lines[0].pv, 8) : [],
      label,
      drop,
      category: pattern.category,
      detail: pattern.detail,
      phase: pattern.phase,
    });
  }
  return updated;
}

let configuredLevel: number | null = null;

/** Laat de computer een zet kiezen op het ingestelde niveau. */
export async function opponentMove(fen: string, level: number): Promise<{ from: string; to: string; promotion?: string } | null> {
  const engine = getOpponentEngine();
  if (configuredLevel !== level) {
    await engine.setOption("Skill Level", level);
    configuredLevel = level;
  }
  const movetime = level <= 6 ? 300 : level <= 15 ? 700 : 1200;
  const res = await engine.analyse(fen, { movetime });
  return res.bestMove ? uciToMove(res.bestMove) : null;
}

/** Zet status/uitslag als de partij voorbij is. Geeft true als de partij klaar is. */
export function finishIfOver(game: GameRecord): boolean {
  const chess = chessFromPlies(game.plies);
  if (!chess.isGameOver()) return false;
  if (chess.isCheckmate()) game.result = chess.turn() === "w" ? "0-1" : "1-0";
  else game.result = "1/2-1/2";
  finalize(game);
  return true;
}

export function finalize(game: GameRecord) {
  game.status = "afgelopen";
  const acc = game.plies.filter((p) => p.color === game.playerColor && p.accuracy !== undefined);
  game.accuracy = acc.length ? acc.reduce((s, p) => s + (p.accuracy ?? 0), 0) / acc.length : undefined;
}

export function resultText(game: GameRecord): string {
  if (game.result === "1/2-1/2") return "Remise";
  if (game.result === "*" || !game.result) return "Opgegeven / afgebroken";
  const whiteWon = game.result === "1-0";
  const playerWon = (game.playerColor === "w") === whiteWon;
  return playerWon ? "Je hebt gewonnen! 🎉" : "Je hebt verloren";
}
