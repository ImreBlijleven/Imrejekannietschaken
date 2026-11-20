// Herkent het TYPE fout met vaste regels (chess.js + Stockfish-varianten).
// Dit gebeurt bewust in code en niet door het taalmodel, zodat de categorie betrouwbaar is.

import { Chess, type Square } from "chess.js";
import type { AnalysisResult } from "./engine-core";
import { uciToMove } from "./uci";

export type Category =
  | "mat_toegelaten"
  | "mat_gemist"
  | "stuk_hangend"
  | "vork_toegelaten"
  | "tactiek_toegelaten"
  | "tactiek_gemist"
  | "koning_onveilig"
  | "opening"
  | "middenspel_positioneel"
  | "eindspel";

export const CATEGORY_TEXT: Record<Category, string> = {
  mat_toegelaten: "Mat toegelaten",
  mat_gemist: "Mat gemist",
  stuk_hangend: "Stuk laten hangen",
  vork_toegelaten: "Vork toegelaten",
  tactiek_toegelaten: "Tactiek van tegenstander gemist",
  tactiek_gemist: "Eigen tactiek gemist",
  koning_onveilig: "Koning onveilig",
  opening: "Openingsfout",
  middenspel_positioneel: "Positionele fout (middenspel)",
  eindspel: "Eindspelfout",
};

export type Phase = "opening" | "middenspel" | "eindspel";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function material(chess: Chess, color: "w" | "b"): number {
  let sum = 0;
  for (const row of chess.board())
    for (const sq of row) if (sq && sq.color === color) sum += VALUE[sq.type];
  return sum;
}

function nonPawnMaterial(chess: Chess): number {
  let sum = 0;
  for (const row of chess.board())
    for (const sq of row) if (sq && sq.type !== "p") sum += VALUE[sq.type];
  return sum;
}

export function phaseOf(fen: string): Phase {
  const chess = new Chess(fen);
  const moveNo = parseInt(fen.split(" ")[5] ?? "1", 10);
  if (nonPawnMaterial(chess) <= 26) return "eindspel";
  if (moveNo <= 10) return "opening";
  return "middenspel";
}

/**
 * Materiaalbalans (kleur min tegenstander) langs een variant.
 * Om te voorkomen dat een variant midden in een ruil wordt afgekapt, nemen we de
 * minst gunstige waarde van de laatste twee snijpunten.
 */
function balanceAlong(fen: string, uciMoves: string[], maxPlies: number, color: "w" | "b"): number {
  const chess = new Chess(fen);
  const opp = color === "w" ? "b" : "w";
  const balances = [material(chess, color) - material(chess, opp)];
  for (const uci of uciMoves.slice(0, maxPlies)) {
    try {
      chess.move(uciToMove(uci));
    } catch {
      break;
    }
    balances.push(material(chess, color) - material(chess, opp));
  }
  return Math.min(...balances.slice(-2));
}

const PIECE_NAME: Record<string, string> = { p: "pion", n: "paard", b: "loper", r: "toren", q: "dame", k: "koning" };

/** Materiaal in gewone woorden: "de dame", "een toren", "een stuk", "2 pionnen". */
export function materialText(points: number): string {
  if (points >= 9) return "de dame";
  if (points >= 5) return "een toren";
  if (points >= 3) return "een stuk";
  return points === 1 ? "een pion" : `${points} pionnen`;
}

export interface PatternResult {
  category: Category;
  detail: string; // korte, feitelijke uitleg (Nederlands)
  phase: Phase;
}

/**
 * Bepaal de categorie van een fout.
 * @param fenBefore positie vóór de zet van de speler
 * @param playedUci de gespeelde zet
 * @param before analyse van fenBefore (beste varianten van de speler)
 * @param after  analyse van de positie ná de zet (varianten beginnen met het antwoord van de tegenstander)
 */
export function detectPattern(
  fenBefore: string,
  playedUci: string,
  before: AnalysisResult,
  after: AnalysisResult,
): PatternResult {
  const mover = fenBefore.split(" ")[1] as "w" | "b";
  const opp = mover === "w" ? "b" : "w";
  const sign = mover === "w" ? 1 : -1;
  const phase = phaseOf(fenBefore);

  const bestBefore = before.lines[0];
  const bestAfter = after.lines[0];

  const chessAfter = new Chess(fenBefore);
  const played = chessAfter.move(uciToMove(playedUci));
  const fenAfter = chessAfter.fen();

  // 1. Mat toegelaten
  const oppMatesAfter = bestAfter?.score.mate !== undefined && sign * bestAfter.score.mate < 0;
  const oppMatedBefore = bestBefore?.score.mate !== undefined && sign * bestBefore.score.mate < 0;
  if (oppMatesAfter && !oppMatedBefore) {
    return {
      category: "mat_toegelaten",
      detail: `Na ${played.san} kan de tegenstander mat geven in ${Math.abs(bestAfter.score.mate!)}.`,
      phase,
    };
  }

  // 2. Mat gemist
  const moverMatedBefore = bestBefore?.score.mate !== undefined && sign * bestBefore.score.mate > 0;
  const moverMatesAfter = bestAfter?.score.mate !== undefined && sign * bestAfter.score.mate > 0;
  if (moverMatedBefore && !moverMatesAfter) {
    return {
      category: "mat_gemist",
      detail: `Er was een mat in ${Math.abs(bestBefore.score.mate!)}.`,
      phase,
    };
  }

  const startBalance = (() => {
    const c = new Chess(fenAfter);
    return material(c, mover) - material(c, opp);
  })();
  const replyPv = bestAfter?.pv ?? [];
  const lossAfter = startBalance - balanceAlong(fenAfter, replyPv, 8, mover);

  if (replyPv.length > 0 && lossAfter >= 2) {
    const probe = new Chess(fenAfter);
    let reply;
    try {
      reply = probe.move(uciToMove(replyPv[0]));
    } catch {
      reply = null;
    }
    if (reply) {
      // 3. Stuk laten hangen: tegenstander slaat direct en wint materiaal
      if (reply.captured) {
        const movedPieceTaken = reply.to === played.to;
        const name = PIECE_NAME[reply.captured] ?? "stuk";
        // Noem het geslagen stuk alleen als dat ook echt het verlies is; anders de netto winst.
        const isTheLoss = VALUE[reply.captured] >= lossAfter - 1;
        return {
          category: "stuk_hangend",
          detail: !isTheLoss
            ? `Na ${played.san} wint de tegenstander ${materialText(lossAfter)}, te beginnen met ${reply.san}.`
            : movedPieceTaken
              ? `Je ${name} op ${played.to} stond onbeschermd: de tegenstander slaat hem met ${reply.san}.`
              : `Na ${played.san} slaat de tegenstander je ${name} met ${reply.san}.`,
          phase,
        };
      }
      // 4. Vork: het antwoord valt twee of meer waardevolle stukken aan
      const attacked: string[] = [];
      for (const row of probe.board()) {
        for (const sq of row) {
          if (!sq || sq.color !== mover) continue;
          if (sq.type !== "k" && VALUE[sq.type] < 3) continue;
          if (probe.attackers(sq.square as Square, opp).includes(reply.to as Square)) {
            attacked.push(sq.square);
          }
        }
      }
      if (attacked.length >= 2) {
        return {
          category: "vork_toegelaten",
          detail: `Na ${played.san} geeft ${reply.san} een dubbele aanval op ${attacked.join(" en ")}.`,
          phase,
        };
      }
      return {
        category: "tactiek_toegelaten",
        detail: `Na ${played.san} wint de tegenstander ${materialText(lossAfter)}, te beginnen met ${reply.san}.`,
        phase,
      };
    }
  }

  // 5. Eigen tactiek gemist: de beste variant wint materiaal, de gespeelde zet niet
  if (bestBefore) {
    const start = (() => {
      const c = new Chess(fenBefore);
      return material(c, mover) - material(c, opp);
    })();
    const gainBest = balanceAlong(fenBefore, bestBefore.pv, 6, mover) - start;
    if (gainBest >= 2 && bestBefore.pv[0] !== playedUci && lossAfter >= 0) {
      return {
        category: "tactiek_gemist",
        detail: `Met de beste zet had je ${materialText(gainBest)} kunnen winnen.`,
        phase,
      };
    }
  }

  // 6. Koning onveilig: tegenstander geeft herhaald schaak in de beste variant
  {
    const c = new Chess(fenAfter);
    let checks = 0;
    for (let i = 0; i < Math.min(5, replyPv.length); i++) {
      try {
        const m = c.move(uciToMove(replyPv[i]));
        if (i % 2 === 0 && m.san.includes("+")) checks++;
      } catch {
        break;
      }
    }
    if (checks >= 2) {
      return {
        category: "koning_onveilig",
        detail: "De tegenstander kan je koning herhaald aanvallen met schaak.",
        phase,
      };
    }
  }

  // 7. Anders: per fase
  if (phase === "opening")
    return { category: "opening", detail: "Geen directe tactiek; een minder goede openingszet.", phase };
  if (phase === "eindspel")
    return { category: "eindspel", detail: "Een onnauwkeurigheid in het eindspel.", phase };
  return {
    category: "middenspel_positioneel",
    detail: "Geen directe tactiek; de stelling werd positioneel slechter.",
    phase,
  };
}
