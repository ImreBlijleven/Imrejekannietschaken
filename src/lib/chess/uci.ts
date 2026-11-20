import { Chess } from "chess.js";

/** Zet een UCI-zet (bv. "e2e4", "e7e8q") om naar een zet-object voor chess.js. */
export function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

/** Zet een reeks UCI-zetten om naar SAN vanaf een FEN. Stopt bij een ongeldige zet. */
export function uciLineToSan(fen: string, uciMoves: string[], max = 12): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves.slice(0, max)) {
    try {
      const m = chess.move(uciToMove(uci));
      san.push(m.san);
    } catch {
      break;
    }
  }
  return san;
}

/** Formatteert een SAN-variant met zetnummers, bv. "12. Nf3 Nc6 13. Bb5". */
export function formatLine(fen: string, sanMoves: string[]): string {
  const parts = fen.split(" ");
  let color = parts[1] as "w" | "b";
  let moveNo = parseInt(parts[5] ?? "1", 10);
  const out: string[] = [];
  sanMoves.forEach((san, i) => {
    if (color === "w") out.push(`${moveNo}. ${san}`);
    else out.push(i === 0 ? `${moveNo}... ${san}` : san);
    if (color === "b") moveNo++;
    color = color === "w" ? "b" : "w";
  });
  return out.join(" ");
}
