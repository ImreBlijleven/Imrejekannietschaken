// Beschrijft zetten en stellingen in woorden, puur met chess.js (geen taalmodel).
// Deze zinnen geven de coach inhoud om uit te leggen, zodat hij niet terugvalt op cijfers.

import { Chess, type Square } from "chess.js";

const NAME: Record<string, string> = { p: "pion", n: "paard", b: "loper", r: "toren", q: "dame", k: "koning" };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Stukken van `color` die aangevallen worden en niet (genoeg) gedekt zijn. */
export function hangingPieces(fen: string, color: "w" | "b"): string[] {
  const chess = new Chess(fen);
  const opp = color === "w" ? "b" : "w";
  const out: string[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === "k") continue;
      const attackers = chess.attackers(sq.square as Square, opp);
      if (!attackers.length) continue;
      const defenders = chess.attackers(sq.square as Square, color);
      const cheapest = Math.min(...attackers.map((a) => VALUE[chess.get(a)!.type]));
      if (defenders.length === 0) out.push(`${NAME[sq.type]} op ${sq.square} (ongedekt)`);
      else if (cheapest < VALUE[sq.type])
        out.push(`${NAME[sq.type]} op ${sq.square} (aangevallen door een minder waardevol stuk)`);
    }
  }
  return out;
}

/** Wat een zet doet, in één zin: stuk, van/naar, slaan, schaak, en welke stukken hij nu aanvalt. */
export function describeMove(fen: string, san: string): string {
  const chess = new Chess(fen);
  let m;
  try {
    m = chess.move(san);
  } catch {
    return san;
  }
  const parts: string[] = [];
  if (m.isKingsideCastle()) parts.push("rokeert kort");
  else if (m.isQueensideCastle()) parts.push("rokeert lang");
  else parts.push(`${NAME[m.piece]} van ${m.from} naar ${m.to}`);
  if (m.captured) parts.push(`slaat ${NAME[m.captured]}`);
  if (m.promotion) parts.push(`promoveert tot ${NAME[m.promotion]}`);
  if (m.san.includes("#")) parts.push("geeft mat");
  else if (m.san.includes("+")) parts.push("geeft schaak");

  // Nieuwe aanvallen van het verplaatste stuk op waardevolle of ongedekte stukken.
  const opp = m.color === "w" ? "b" : "w";
  const targets: string[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== opp || sq.type === "k") continue;
      if (!chess.attackers(sq.square as Square, m.color).includes(m.to as Square)) continue;
      const defended = chess.attackers(sq.square as Square, opp).length > 0;
      if (VALUE[sq.type] > VALUE[m.piece] || !defended) targets.push(`${NAME[sq.type]} op ${sq.square}`);
    }
  }
  if (targets.length) parts.push(`valt ${targets.join(" en ")} aan`);
  return `${m.san}: ${parts.join(", ")}`;
}

/** Beschrijf de eerste zetten van een variant, om de beurt. */
export function describeLine(fen: string, sanMoves: string[], max = 3): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const san of sanMoves.slice(0, max)) {
    out.push(describeMove(chess.fen(), san));
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return out;
}
