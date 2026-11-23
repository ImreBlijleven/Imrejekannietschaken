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
  if (game.elo !== undefined) return `Elo ${game.elo < STOCKFISH_ELO_MIN ? "≈" : ""}${game.elo}`;
  return OLD_LEVEL_NAMES[game.level] ?? `Niveau ${game.level}`;
}

export function newGame(
  playerColor: "w" | "b",
  elo: number,
  mode: GameMode,
  from?: { startFen?: string; moves?: string[]; source?: string; goal?: GameRecord["goal"] },
): GameRecord {
  const ts = now();
  const game: GameRecord = {
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
    startFen: from?.startFen,
    source: from?.source,
    goal: from?.goal,
  };
  // Openingszetten uit een oefening alvast spelen (zonder beoordeling).
  for (const san of from?.moves ?? []) {
    const ply = applyMove(game, san);
    if (ply) ply.book = true;
  }
  return game;
}

/**
 * Bouw de stelling op uit de zetten. De startstelling komt van de eerste zet (fenBefore),
 * of van `startFen` als er nog geen zetten zijn; anders de normale beginstelling.
 */
export function chessFromPlies(plies: PlyRecord[], startFen?: string): Chess {
  const c = new Chess(plies[0]?.fenBefore ?? startFen);
  for (const p of plies) c.move(p.san);
  return c;
}

/** Voeg een zet toe (nog zonder engine-info). Geeft null bij een illegale zet. */
export function applyMove(
  game: GameRecord,
  move: string | { from: string; to: string; promotion?: string },
): PlyRecord | null {
  const chess = chessFromPlies(game.plies, game.startFen);
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
    evalBefore: sBefore,
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
  const chess = chessFromPlies(game.plies, game.startFen);
  if (!chess.isGameOver()) return false;
  if (chess.isCheckmate()) {
    game.result = chess.turn() === "w" ? "0-1" : "1-0";
    game.endReason = "mat";
  } else {
    game.result = "1/2-1/2";
    game.endReason = "remise";
  }
  finalize(game);
  return true;
}

export function finalize(game: GameRecord) {
  game.status = "afgelopen";
  const acc = game.plies.filter((p) => p.color === game.playerColor && p.accuracy !== undefined);
  game.accuracy = acc.length ? acc.reduce((s, p) => s + (p.accuracy ?? 0), 0) / acc.length : undefined;
}

export type Outcome = "gewonnen" | "verloren" | "remise" | "afgebroken";

export function outcome(game: GameRecord): Outcome {
  if (game.result === "1/2-1/2") return "remise";
  if (!game.result || game.result === "*") return "afgebroken";
  const whiteWon = game.result === "1-0";
  return (game.playerColor === "w") === whiteWon ? "gewonnen" : "verloren";
}

export function resultText(game: GameRecord): string {
  const o = outcome(game);
  if (o === "remise") return "Remise";
  if (o === "afgebroken") return "Afgebroken";
  if (o === "gewonnen") return game.endReason === "doel" ? "Doel bereikt" : game.endReason === "mat" ? "Gewonnen met mat" : "Gewonnen";
  if (game.endReason === "opgegeven") return "Opgegeven";
  return game.endReason === "mat" ? "Verloren door mat" : "Verloren";
}

/** Eerste paar halve zetten van de speler gesorteerd op verlies in winstkans. */
export function biggestMistakes(game: GameRecord, n = 3) {
  return game.plies
    .filter((p) => p.color === game.playerColor && p.category)
    .sort((a, b) => (b.drop ?? 0) - (a.drop ?? 0))
    .slice(0, n);
}
