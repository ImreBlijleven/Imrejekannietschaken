// Steekproef: klopt de oplossing van de Lichess-puzzels volgens onze Stockfish?
// Gebruik: npm run check-puzzles [aantal]
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { createNodeEngine } from "./node-engine.mts";
import { classify } from "../src/lib/chess/evaluation";
import { uciToMove } from "../src/lib/chess/uci";

const data = JSON.parse(readFileSync(new URL("../public/puzzles.json", import.meta.url), "utf8"));
const n = Number(process.argv[2] ?? 150);
const sample = [...data.puzzles].sort(() => Math.random() - 0.5).slice(0, n);
const { engine, terminate } = createNodeEngine();
let ok = 0, near = 0, bad = 0;
for (const [id, fen, moves] of sample) {
  const ms = moves.split(" ");
  const c = new Chess(fen);
  c.move(uciToMove(ms[0])); // eerste zet = zet van de tegenstander
  const fenBefore = c.fen();
  const sol = c.move(uciToMove(ms[1]));
  if (sol.san.includes("#")) { ok++; continue; }
  const before = await engine.analyse(fenBefore, { depth: 14 });
  const after = await engine.analyse(c.fen(), { depth: 14 });
  const { drop } = classify(before.lines[0].score, after.lines[0].score, sol.color, before.bestMove === sol.lan);
  if (before.bestMove === sol.lan || drop < 0.02) ok++;
  else if (drop < 0.1) near++;
  else { bad++; console.log(`✗ ${id}: oplossing ${sol.san}, Stockfish wil ${before.bestMove} (verlies ${drop.toFixed(2)})`); }
}
terminate();
console.log(`\n${n} puzzels: ${ok} beste zet, ${near} bijna even goed, ${bad} afwijkend`);
