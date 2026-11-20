// Vergelijkt taalmodellen op een vaste set posities.
// Gebruik: zet API-sleutels in .env.local en draai `npm run testset`.
// Optioneel: COACH_PROVIDERS=groq,gemini,openrouter om te kiezen welke getest worden.
import { writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { createNodeEngine } from "./node-engine.mts";
import { POSITIONS } from "./testset-positions.mts";
import { classify } from "../src/lib/chess/evaluation";
import { detectPattern } from "../src/lib/chess/patterns";
import { buildFocusFact, movesMentioned, whatIfFact } from "../src/lib/coach/facts";
import { askCoach } from "../src/lib/coach/coach";
import { providerConfigs } from "../src/lib/coach/providers";
import type { CoachFacts } from "../src/lib/coach/types";

const DEPTH = 14;
const dryRun = process.argv.includes("--dry-run");
const providers = providerConfigs();
if (!dryRun && providers.length === 0) {
  console.error("Geen aanbieders met API-sleutel gevonden. Zie README (.env.local). Of draai met --dry-run.");
  process.exit(1);
}

const { engine, terminate } = createNodeEngine();
const out: string[] = [`# Testset coach (${new Date().toISOString()})`, ""];
const score: Record<string, { ok: number; warn: number; err: number }> = {};

for (const pos of POSITIONS) {
  const c = new Chess();
  for (const m of pos.moves.slice(0, -1)) c.move(m);
  const fenBefore = c.fen();
  const played = c.move(pos.moves.at(-1)!);
  const before = await engine.analyse(fenBefore, { depth: DEPTH, multipv: 3 });
  const after = await engine.analyse(c.fen(), { depth: DEPTH });
  const { label } = classify(before.lines[0].score, after.lines[0].score, played.color, before.bestMove === played.lan);
  const pattern = detectPattern(fenBefore, played.lan, before, after);
  const whatIf = [];
  for (const san of movesMentioned(pos.question, fenBefore).filter((s) => s !== played.san)) {
    const t = new Chess(fenBefore);
    t.move(san);
    whatIf.push(whatIfFact(fenBefore, san, await engine.analyse(t.fen(), { depth: DEPTH })));
  }
  const facts: CoachFacts = {
    playerColor: played.color === "w" ? "wit" : "zwart",
    pgn: c.pgn(),
    currentFen: c.fen(),
    focus: buildFocusFact({ fenBefore, san: played.san, label, before, after, category: pattern.category, categoryDetail: pattern.detail }),
    whatIf,
    patterns: [],
  };
  out.push(`## ${pos.name}`, "", `**Zet:** ${played.san} → ${facts.focus!.label}, type: ${facts.focus!.category}`, "",
    `**Beste:** ${facts.focus!.bestMoves.map((b) => `${b.san} (${b.eval})`).join(", ")}`, "", `**Vraag:** ${pos.question}`, "");
  console.log(`${pos.name}: ${played.san} = ${label} / ${pattern.category}`);
  if (dryRun) continue;

  for (const p of providers) {
    const res = await askCoach({ facts, messages: [{ role: "user", content: pos.question }] }, [p]);
    const s = (score[`${p.name} (${p.model})`] ??= { ok: 0, warn: 0, err: 0 });
    if (res.error) s.err++;
    else if (res.warnings.length) s.warn++;
    else s.ok++;
    out.push(`### ${p.name} · ${p.model}`, "", res.error ? `❌ ${res.error}` : res.answer, "");
    if (res.warnings.length) out.push(`⚠️ ${res.warnings.join(" · ")}`, "");
  }
}
terminate();

out.splice(2, 0, "| Model | Schoon | Met waarschuwing | Fout |", "|---|---|---|---|",
  ...Object.entries(score).map(([k, v]) => `| ${k} | ${v.ok} | ${v.warn} | ${v.err} |`), "",
  "Beoordeel daarnaast zelf de uitleg: klopt het idee, is het begrijpelijk?", "");
writeFileSync("testset-resultaat.md", out.join("\n"));
console.log("\nResultaat geschreven naar testset-resultaat.md");
