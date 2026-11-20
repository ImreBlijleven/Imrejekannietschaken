// Evaluaties, winstkansen en zet-labels.
//
// De drempels en formules volgen Lichess:
// - winningChances: lila modules/analyse/src/main/WinPercent.scala / Advice.scala
//   https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala
// - nauwkeurigheid: https://lichess.org/page/accuracy

/** Engine-score vanuit het perspectief van WIT. Precies één van beide is gezet. */
export interface Score {
  cp?: number;
  mate?: number; // >0: wit geeft mat in N, <0: zwart geeft mat in N
}

export type Label = "beste" | "goed" | "onnauwkeurig" | "fout" | "blunder";

export const LABEL_TEXT: Record<Label, string> = {
  beste: "Beste zet",
  goed: "Goed",
  onnauwkeurig: "Onnauwkeurig",
  fout: "Fout",
  blunder: "Blunder",
};

const MATE_CP = 1000;

/** Score omgerekend naar centipawns (mat wordt afgekapt op ±1000). */
export function toCp(score: Score): number {
  if (score.mate !== undefined) {
    if (score.mate === 0) return 0;
    return score.mate > 0 ? MATE_CP : -MATE_CP;
  }
  return Math.max(-MATE_CP, Math.min(MATE_CP, score.cp ?? 0));
}

/** Winstkans in [-1, 1] voor wit (Lichess "winning chances"). */
export function winningChances(score: Score): number {
  const cp = toCp(score);
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/** Winstkans in procent (0..100) voor de gegeven kleur. */
export function winPercent(score: Score, color: "w" | "b"): number {
  const wc = winningChances(score);
  const forColor = color === "w" ? wc : -wc;
  return 50 + 50 * forColor;
}

/**
 * Label voor een zet op basis van het verlies aan winstkans voor de speler.
 * Drempels (in winningChances-schaal) zoals in Lichess Advice.scala:
 * 0.3 blunder, 0.2 fout, 0.1 onnauwkeurig.
 */
export function classify(
  before: Score,
  after: Score,
  mover: "w" | "b",
  playedIsBest: boolean,
): { label: Label; drop: number } {
  const sign = mover === "w" ? 1 : -1;
  const drop = Math.max(0, sign * (winningChances(before) - winningChances(after)));
  let label: Label;
  if (playedIsBest || drop < 0.02) label = "beste";
  else if (drop >= 0.3) label = "blunder";
  else if (drop >= 0.2) label = "fout";
  else if (drop >= 0.1) label = "onnauwkeurig";
  else label = "goed";
  return { label, drop };
}

/** Nauwkeurigheid van één zet (0..100) volgens de Lichess-formule. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const diff = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * diff) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/** Leesbare score, bv. "+1.25", "-0.40", "#3", "#-2" (vanuit wit). */
export function formatScore(score: Score): string {
  if (score.mate !== undefined) return `#${score.mate}`;
  const pawns = (score.cp ?? 0) / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}
