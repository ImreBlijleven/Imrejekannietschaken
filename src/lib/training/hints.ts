// Hints in drie stappen, puur met chess.js (geen taalmodel):
// 1. een idee ("Er is een paardvork mogelijk"), 2. welk stuk, 3. de zet zelf.

import { Chess, type Square } from "chess.js";
import type { Score } from "../chess/evaluation";
import { PIECE_NAME as NAME, PIECE_VALUE as VALUE, hangingPieces } from "../coach/describe";

export interface Hints {
  idea: string;
  piece: { square: string; text: string };
  move: { from: string; to: string; san: string };
}

const CENTER = new Set(["c4", "d4", "e4", "f4", "c5", "d5", "e5", "f5"]);

/** Vijandelijke stukken die het stuk op `from` aanvalt (in stelling `chess`). */
function attackedBy(chess: Chess, from: Square, color: "w" | "b"): { sq: Square; type: string; defended: boolean }[] {
  const opp = color === "w" ? "b" : "w";
  const out: { sq: Square; type: string; defended: boolean }[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== opp) continue;
      if (!chess.attackers(p.square as Square, color).includes(from)) continue;
      out.push({ sq: p.square as Square, type: p.type, defended: chess.attackers(p.square as Square, opp).length > 0 });
    }
  }
  return out;
}

/**
 * Bouw de hints voor de zet `san` (de theoriezet of de beste zet van Stockfish) in stelling `fen`.
 * `score` (vanuit wit) is optioneel en wordt alleen gebruikt om een mat te herkennen.
 */
export function buildHints(fen: string, san: string, score?: Score): Hints {
  const before = new Chess(fen);
  const side = before.turn();
  const after = new Chess(fen);
  const m = after.move(san);
  const piece = NAME[m.piece];

  const hints = {
    piece: { square: m.from, text: `Speel met je ${piece}.` },
    move: { from: m.from, to: m.to, san: m.san },
  };
  const done = (idea: string): Hints => ({ idea, ...hints });

  // 1. Mat in de stelling (alleen als Stockfish het ziet)
  if (score?.mate !== undefined && (side === "w" ? score.mate > 0 : score.mate < 0)) {
    const n = Math.abs(score.mate);
    return done(n === 1 ? "Er is mat in één zet." : `Er zit mat in de stelling (in ${n}). Zoek de sterkste aanval.`);
  }
  if (m.san.includes("#")) return done("Er is mat in één zet.");

  // Alleen nog een koning bij de tegenstander: mattechniek (dame/toren tegen koning)
  const opp = side === "w" ? "b" : "w";
  const loneKing = !before
    .board()
    .flat()
    .some((p) => p && p.color === opp && p.type !== "k");
  const heavy = before
    .board()
    .flat()
    .some((p) => p && p.color === side && (p.type === "q" || p.type === "r"));
  if (loneKing && !m.promotion && heavy) {
    if (m.san.includes("+")) return done("Een schaak kan hier sterk zijn: hoeveel vakjes houdt de koning over?");
    if (m.piece === "k") return done("Breng je koning dichterbij om je dame of toren te steunen.");
    return done("Maak het vak van de koning kleiner en duw hem naar de rand.");
  }
  if (loneKing && !m.promotion) {
    // Pionneneindspel tegen een alleenstaande koning
    if (m.piece === "k") return done("Begeleid de pion met je koning: houd de vijandelijke koning op afstand.");
    if (m.piece === "p") return done("Kan de pion nu veilig een stap vooruit?");
  }

  // 2. Eigen stuk onder vuur, en de zet redt dat stuk
  const threatened = hangingPieces(fen, side).find((t) => t.includes(` op ${m.from} `));
  if (threatened) return done(`Let op je ${piece} op ${m.from}: die staat onder vuur.`);

  // 3. Materiaal winnen
  if (m.captured) {
    const defended = before.attackers(m.to as Square, side === "w" ? "b" : "w").length > 0;
    if (!defended) return done("Er staat iets onbeschermd bij de tegenstander. Kun je het pakken?");
    if (VALUE[m.captured] > VALUE[m.piece]) return done("Kun je materiaal winnen?");
  }

  // 4. Vork / dubbele aanval
  const targets = attackedBy(after, m.to as Square, side).filter(
    (t) => t.type === "k" || VALUE[t.type] > VALUE[m.piece] || (!t.defended && VALUE[t.type] >= 3),
  );
  if (targets.length >= 2)
    return done(m.piece === "n" ? "Er is een paardvork mogelijk." : "Er is een dubbele aanval mogelijk.");

  // 5. Promoveren, schaak, rokade
  if (m.promotion) return done("Kun je een pion laten promoveren?");
  if (m.san.includes("+")) return done("Een schaak kan hier sterk zijn.");
  if (m.isKingsideCastle() || m.isQueensideCastle()) return done("Breng je koning in veiligheid.");

  // 6. Druk zetten: het stuk valt na de zet iets nieuws aan
  const newTargets = attackedBy(after, m.to as Square, side)
    .filter((t) => t.type !== "k")
    .filter((t) => !before.attackers(t.sq, side).includes(m.from as Square))
    .sort((a, b) => VALUE[b.type] - VALUE[a.type]);
  if (newTargets.length) return done(`Hoe kun je druk zetten op ${newTargets[0].sq}?`);

  // 7. Algemene plannen
  const homeRank = side === "w" ? "1" : "8";
  if ((m.piece === "n" || m.piece === "b") && m.from[1] === homeRank) return done("Ontwikkel een stuk.");
  if (m.piece === "p" && CENTER.has(m.to)) return done("Vecht om het centrum.");
  if (m.piece === "r") {
    const file = m.to[0];
    const ownPawnOnFile = after
      .board()
      .flat()
      .some((p) => p && p.type === "p" && p.color === side && p.square[0] === file);
    if (!ownPawnOnFile) return done("Zet een toren op een open lijn.");
  }
  if (m.piece === "k") return done("Gebruik je koning actief.");
  if (m.piece === "p") return done("Welke pionzet versterkt je stelling?");
  return done("Welk stuk kan actiever staan?");
}
