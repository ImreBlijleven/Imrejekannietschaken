// Toont het feitenblok dat de coach krijgt, voor een paar posities uit de testset.
import { Chess } from "chess.js";
import { createNodeEngine } from "./node-engine.mts";
import { POSITIONS } from "./testset-positions.mts";
import { classify } from "../src/lib/chess/evaluation";
import { detectPattern } from "../src/lib/chess/patterns";
import { buildFocusFact } from "../src/lib/coach/facts";
import { factsToText } from "../src/lib/coach/prompt";

const { engine, terminate } = createNodeEngine();
for (const pos of POSITIONS.filter((p) => process.argv.slice(2).some((a) => p.name.includes(a)))) {
  const c = new Chess();
  for (const m of pos.moves.slice(0, -1)) c.move(m);
  const fenBefore = c.fen();
  const played = c.move(pos.moves.at(-1)!);
  const before = await engine.analyse(fenBefore, { depth: 14, multipv: 3 });
  const after = await engine.analyse(c.fen(), { depth: 14 });
  const { label } = classify(before.lines[0].score, after.lines[0].score, played.color, before.bestMove === played.lan);
  const pat = detectPattern(fenBefore, played.lan, before, after);
  const focus = buildFocusFact({ fenBefore, san: played.san, label, before, after, category: pat.category, categoryDetail: pat.detail });
  console.log(`\n===== ${pos.name} =====\n` + factsToText({ playerColor: played.color === "w" ? "wit" : "zwart", pgn: c.pgn(), currentFen: c.fen(), focus, whatIf: [], patterns: [] }));
}
terminate();
