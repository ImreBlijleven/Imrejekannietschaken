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

// Stockfish ondersteunt UCI_Elo van 1320 t/m 3190 (UCI-optie "UCI_Elo").
// https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html
export const ELO_MIN = 400;
export const ELO_MAX = 3000;
export const STOCKFISH_ELO_MIN = 1320;

/** Oude partijen hadden een niveau (Skill Level) in plaats van Elo. */
const OLD_LEVEL_NAMES: Record<number, string> = {
  0: "Beginner",
  3: "Makkelijk",
  6: "Gemiddeld",
  10: "Gevorderd",
  15: "Sterk",
  20: "Maximaal",
};

export function strengthName(game: Pick<GameRecord, "elo" | "level">): string {
  if (game.elo !== undefined) return `Elo ${game.elo}${game.elo < STOCKFISH_ELO_MIN ? " (geschat)" : ""}`;
  return OLD_LEVEL_NAMES[game.level] ?? `Niveau ${game.level}`;
}

export function newGame(playerColor: "w" | "b", elo: number, mode: GameMode): GameRecord {
  const ts = now();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: SCHEMA_VERSION,
    playerColor,
    level: 20,
    elo,
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

let configuredElo: number | null = null;

/**
 * Laat de computer een zet kiezen op de gekozen Elo.
 * - Vanaf 1320: Stockfish' eigen sterktebeperking (UCI_LimitStrength + UCI_Elo).
 * - Onder 1320: Stockfish' zwakste stand, plus af en toe een willekeurige legale zet.
 *   Dit is een eigen benadering en niet gekalibreerd.
 */
export async function opponentMove(
  fen: string,
  elo: number,
): Promise<{ from: string; to: string; promotion?: string } | null> {
  const engine = getOpponentEngine();
  const target = Math.max(STOCKFISH_ELO_MIN, Math.min(3190, elo));
  if (configuredElo !== target) {
    await engine.setOption("UCI_LimitStrength", "true");
    await engine.setOption("UCI_Elo", target);
    configuredElo = target;
  }

  if (elo < STOCKFISH_ELO_MIN) {
    // Kans op een willekeurige zet: 0% bij 1320, oplopend tot 60% bij 400.
    const randomChance = (0.6 * (STOCKFISH_ELO_MIN - elo)) / (STOCKFISH_ELO_MIN - ELO_MIN);
    if (Math.random() < randomChance) {
      const moves = new Chess(fen).moves({ verbose: true });
      if (moves.length) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        await new Promise((r) => setTimeout(r, 400)); // even "nadenken"
        return { from: m.from, to: m.to, promotion: m.promotion };
      }
    }
  }

  const movetime = elo < 1800 ? 400 : elo < 2400 ? 800 : 1200;
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
