"use client";

import { Chess } from "chess.js";
import { getAnalysisEngine } from "../chess/engine-browser";
import type { AnalysisResult } from "../chess/engine-core";
import { classify } from "../chess/evaluation";
import { detectPattern } from "../chess/patterns";
import { buildFocusFact, currentFact, movesMentioned, patternFacts, whatIfFact } from "../coach/facts";
import type { CoachFacts } from "../coach/types";
import { getRepository } from "../db/dexie-repository";
import type { PlyRecord } from "../db/types";
import { loadSettings } from "./settings";

const cache = new Map<string, Promise<AnalysisResult>>();

/** Analyseer een stelling met Stockfish; resultaten worden per sessie gecachet. */
export function analyse(fen: string, multipv = 1): Promise<AnalysisResult> {
  const multi = cache.get(`${fen}|3`);
  if (multi && multipv <= 3) return multi;
  const key = `${fen}|${multipv}`;
  let p = cache.get(key);
  if (!p) {
    p = getAnalysisEngine().analyse(fen, { depth: loadSettings().engineDepth, multipv });
    cache.set(key, p);
  }
  return p;
}

/** Bouw de coach-feiten voor een vraag over een bepaalde zet (of de huidige stelling). */
export async function buildFacts(args: {
  plies: PlyRecord[];
  startFen?: string; // voor partijen vanuit een oefenstelling
  playerColor: "w" | "b";
  focusPly: number | null; // index in plies, of null = algemene vraag
  question: string;
}): Promise<CoachFacts> {
  const { plies, playerColor, focusPly, question } = args;
  const upto = focusPly === null ? plies.length : focusPly + 1;
  const chess = new Chess(plies[0]?.fenBefore ?? args.startFen);
  for (const p of plies.slice(0, upto)) chess.move(p.san);
  const currentFen = chess.fen();

  let focus: CoachFacts["focus"];
  let whatIfFen = currentFen;
  if (focusPly !== null && plies[focusPly]) {
    const ply = plies[focusPly];
    const [before, after] = await Promise.all([analyse(ply.fenBefore, 3), analyse(ply.fenAfter, 1)]);
    const { label } = classify(
      before.lines[0]?.score ?? { cp: 0 },
      after.lines[0]?.score ?? { cp: 0 },
      ply.color,
      before.bestMove === ply.uci,
    );
    const pattern =
      label === "beste" || label === "goed" ? undefined : detectPattern(ply.fenBefore, ply.uci, before, after);
    focus = buildFocusFact({
      fenBefore: ply.fenBefore,
      san: ply.san,
      label,
      before,
      after,
      category: pattern?.category,
      categoryDetail: pattern?.detail,
    });
    whatIfFen = ply.fenBefore;
  }

  // Geen zet in focus: geef de coach de sterkste plannen in de huidige stelling.
  const current = focus ? undefined : currentFact(currentFen, await analyse(currentFen, 3));

  const whatIf = [];
  for (const san of movesMentioned(question, whatIfFen).filter((s) => s !== focus?.san)) {
    const c = new Chess(whatIfFen);
    c.move(san);
    whatIf.push(whatIfFact(whatIfFen, san, await analyse(c.fen(), 1)));
  }

  const stats = await getRepository().patternStats();
  return {
    playerColor: playerColor === "w" ? "wit" : "zwart",
    pgn: chess.pgn(),
    currentFen,
    focus,
    current,
    whatIf,
    patterns: patternFacts(stats),
  };
}
