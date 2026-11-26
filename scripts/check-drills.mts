// Controleert alle oefeningen: zetten legaal, geen fout volgens Stockfish, situaties geldig.
// Gebruik: npm run check-drills
import { Chess } from "chess.js";
import { createNodeEngine } from "./node-engine.mts";
import { OPENINGS, PLANS, POSITIONS, TRAPS } from "../src/lib/training/drills";
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
      const { label, drop } = classify(
        before.lines[0].score,
        after.lines[0].score,
        fenBefore.split(" ")[1] as "w" | "b",
        false,
      );
      seen.set(key, label);
      if (label === "fout" || label === "blunder") {
        console.log(`✗ ${o.id}: ${line.slice(0, i + 1).join(" ")} → ${label} (verlies ${drop.toFixed(2)})`);
        problems++;
      } else if (label === "onnauwkeurig") {
        console.log(`· ${o.id}: ${san} na ${line.slice(0, i).join(" ")} is onnauwkeurig (verlies ${drop.toFixed(2)})`);
      }
    }
  }
  // Varianten: legale zetten én begin van minstens één theorie-lijn (anders wordt de naam nooit getoond).
  for (const v of o.variations) {
    const reachable = o.lines.some((line) => v.moves.every((m, i) => line[i] === m));
    if (!reachable) {
      console.log(`✗ ${o.id}: variant "${v.name}" (${v.moves.join(" ")}) komt in geen enkele lijn voor`);
      problems++;
    }
  }
  console.log(`✓ ${o.id} (${o.lines.length} lijnen, ${o.variations.length} varianten)`);
}
// Valstrikken: alleen jouw zetten moeten goed zijn; aan het eind moet je duidelijk gewonnen staan.
for (const t of TRAPS) {
  const side = t.trap!.side;
  for (const line of t.lines) {
    const c = new Chess();
    let legal = true;
    for (const [i, san] of line.entries()) {
      const fenBefore = c.fen();
      try {
        c.move(san);
      } catch {
        console.log(`✗ ${t.id}: zet ${i + 1} "${san}" is illegaal`);
        problems++;
        legal = false;
        break;
      }
      if (fenBefore.split(" ")[1] !== side || c.isCheckmate()) continue; // matzet is altijd goed
      const before = await engine.analyse(fenBefore, { depth: 12 });
      const after = await engine.analyse(c.fen(), { depth: 12 });
      const { label, drop } = classify(before.lines[0].score, after.lines[0].score, side, false);
      if (label === "fout" || label === "blunder") {
        console.log(
          `✗ ${t.id}: jouw zet ${san} (${line.slice(0, i + 1).join(" ")}) is een ${label} (verlies ${drop.toFixed(2)})`,
        );
        problems++;
      }
    }
    if (!legal) continue;
    const end = c.isCheckmate()
      ? { mate: side === "w" ? 1 : -1 }
      : (await engine.analyse(c.fen(), { depth: 14 })).lines[0].score;
    const sign = side === "w" ? 1 : -1;
    // Afstraffen: duidelijk gewonnen. Verdedigen: minstens gelijk.
    const need = t.trap!.goal === "verdedigen" ? -50 : 200;
    const winning = end.mate !== undefined ? sign * end.mate > 0 : sign * (end.cp ?? 0) >= need;
    if (!winning) {
      console.log(`✗ ${t.id}: eindstelling niet goed genoeg (${JSON.stringify(end)}) na ${line.join(" ")}`);
      problems++;
    }
  }
  for (const v of t.variations) {
    if (!t.lines.some((line) => v.moves.every((m, i) => line[i] === m))) {
      console.log(`✗ ${t.id}: variant "${v.name}" komt in geen enkele lijn voor`);
      problems++;
    }
  }
  console.log(`✓ val ${t.id} (${t.lines.length} lijnen)`);
}

// Middenspel-plannen: legaal, juiste kant aan zet, en een stelling in balans (niet verloren, niet al beslist).
for (const p of PLANS) {
  const c = new Chess();
  try {
    for (const m of p.moves) c.move(m);
  } catch (e) {
    console.log(`✗ plan ${p.id}: illegale zet (${e})`);
    problems++;
    continue;
  }
  if (c.turn() !== p.side) {
    console.log(`✗ plan ${p.id}: verkeerde kant aan zet`);
    problems++;
    continue;
  }
  const s = (await engine.analyse(c.fen(), { depth: 16 })).lines[0].score;
  const forSide = (p.side === "w" ? 1 : -1) * (s.cp ?? (s.mate! > 0 ? 1000 : -1000));
  const ok = s.mate === undefined && forSide > -100 && forSide < 250;
  console.log(`${ok ? "✓" : "✗"} plan ${p.id}: ${JSON.stringify(s)} (voor de speler ${forSide})`);
  if (!ok) problems++;
}

for (const p of POSITIONS) {
  try {
    const c = new Chess(p.fen);
    if (c.isGameOver()) throw new Error("partij is al afgelopen");
    if (c.turn() !== p.side) throw new Error("verkeerde kant aan zet");
    const a = await engine.analyse(p.fen, { depth: 18 });
    const s = a.lines[0].score;
    const sign = p.side === "w" ? 1 : -1;
    // Winnen: duidelijk gewonnen. Remise houden: in balans (geen mat, binnen een pion).
    const ok =
      p.goal === "remise"
        ? s.mate === undefined && Math.abs(s.cp ?? 0) < 100
        : s.mate !== undefined
          ? s.mate > 0 === (p.side === "w")
          : sign * (s.cp ?? 0) > 250;
    console.log(`${ok ? "✓" : "✗"} situatie ${p.id} (${p.goal}): ${JSON.stringify(s)}`);
    if (!ok) problems++;
  } catch (e) {
    console.log(`✗ situatie ${p.id}: ${e}`);
    problems++;
  }
}
terminate();
console.log(problems ? `\n${problems} probleem/problemen` : "\nAlles in orde");
process.exit(problems ? 1 : 0);
