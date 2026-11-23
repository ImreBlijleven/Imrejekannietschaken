// Controleert alle oefeningen: zetten legaal, geen fout volgens Stockfish, situaties geldig.
// Gebruik: npm run check-drills
import { Chess } from "chess.js";
import { createNodeEngine } from "./node-engine.mts";
import { OPENINGS, POSITIONS } from "../src/lib/training/drills";
import { classify } from "../src/lib/chess/evaluation";

const { engine, terminate } = createNodeEngine();
let problems = 0;
const seen = new Map<string, string>(); // fen -> resultaat, om dubbele analyses te besparen

for (const o of OPENINGS) {
  for (const line of o.lines) {
    const c = new Chess();
    for (const [i, san] of line.entries()) {
      const fenBefore = c.fen();
      try {
        c.move(san);
      } catch {
        console.log(`✗ ${o.id}: zet ${i + 1} "${san}" is illegaal na ${line.slice(0, i).join(" ")}`);
        problems++;
        break;
      }
      const key = `${fenBefore}|${san}`;
      if (seen.has(key)) continue;
      const before = await engine.analyse(fenBefore, { depth: 12 });
      const after = await engine.analyse(c.fen(), { depth: 12 });
      const { label, drop } = classify(before.lines[0].score, after.lines[0].score, fenBefore.split(" ")[1] as "w" | "b", false);
      seen.set(key, label);
      if (label === "fout" || label === "blunder") {
        console.log(`✗ ${o.id}: ${line.slice(0, i + 1).join(" ")} → ${label} (verlies ${drop.toFixed(2)})`);
        problems++;
      } else if (label === "onnauwkeurig") {
        console.log(`· ${o.id}: ${san} na ${line.slice(0, i).join(" ")} is onnauwkeurig (verlies ${drop.toFixed(2)})`);
      }
    }
  }
  console.log(`✓ ${o.id} (${o.lines.length} lijnen)`);
}
for (const p of POSITIONS) {
  try {
    const c = new Chess(p.fen);
    if (c.isGameOver()) throw new Error("partij is al afgelopen");
    if (c.turn() !== p.side) throw new Error("verkeerde kant aan zet");
    const a = await engine.analyse(p.fen, { depth: 18 });
    const s = a.lines[0].score;
    const winning = s.mate !== undefined ? s.mate > 0 === (p.side === "w") : (p.side === "w" ? 1 : -1) * (s.cp ?? 0) > 300;
    console.log(`${winning ? "✓" : "✗"} situatie ${p.id}: ${JSON.stringify(s)}`);
    if (!winning) problems++;
  } catch (e) {
    console.log(`✗ situatie ${p.id}: ${e}`);
    problems++;
  }
}
terminate();
console.log(problems ? `\n${problems} probleem/problemen` : "\nAlles in orde");
process.exit(problems ? 1 : 0);
