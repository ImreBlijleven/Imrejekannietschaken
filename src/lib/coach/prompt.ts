import type { CoachFacts } from "./types";

export const SYSTEM_PROMPT = `Je bent een schaakcoach die de stelling inhoudelijk uitlegt. Je antwoordt in het Nederlands.

STRIKTE REGELS (belangrijker dan al het andere):
1. Je mag ALLEEN zetten noemen die letterlijk in het blok FEITEN staan. Bedenk NOOIT zelf zetten of varianten.
2. Schrijf zetten precies zoals in FEITEN (Engelse letters: K, Q, R, B, N; bv. "Nf3", "Bxe5", "O-O").
3. Noem GEEN cijfers: geen evaluaties, scores, pionwaardes, percentages of winstkansen. De speler ziet die al in de app.
4. Gebruik de POSITIEFEITEN: welke stukken onder vuur staan, wat de zetten slaan, aanvallen of dreigen. Verzin geen dreigingen, open lijnen of diagonalen die daar niet uit blijken.
5. Kun je een vraag niet met de FEITEN beantwoorden, zeg dat dan eerlijk en stel voor de zet in de vraag te noemen.

STIJL:
- Leg in 2 à 3 korte zinnen uit WAT er op het bord gebeurt: wat de zet misdeed of goed deed, wat de tegenstander nu kan doen, en wat de betere zet bereikt.
- Begin direct met de inhoud. Herhaal de vraag of de beoordeling niet ("Dit was een fout omdat...").
- Gewone tekst: geen kopjes, opsommingen, vet, cursief of code-opmaak.
- Spreek de speler aan met "je".`;

/** Evaluatie (bv. "+0.72", "#-3") als getal vanuit de kant van `color`. */
function forSide(evalText: string, color: "wit" | "zwart"): number {
  const sign = color === "wit" ? 1 : -1;
  if (evalText.startsWith("#")) return sign * (evalText.startsWith("#-") ? -100 : 100);
  return sign * (parseFloat(evalText) || 0);
}

/** Vergelijk een zet met de beste zet in woorden, zodat het model geen cijfers krijgt. */
function compared(evalText: string, bestText: string, color: "wit" | "zwart"): string {
  const diff = forSide(bestText, color) - forSide(evalText, color);
  if (diff <= 0.3) return "ongeveer even goed als de beste zet";
  if (diff <= 1) return "iets minder goed dan de beste zet";
  return "duidelijk slechter dan de beste zet";
}

/** Zet de feiten om in een compact tekstblok voor het model. */
export function factsToText(f: CoachFacts): string {
  const lines: string[] = [];
  lines.push(`Speler speelt met: ${f.playerColor}`);
  // Alleen de zetten, zonder PGN-kopregels ([Event "?"] e.d.) en uitslagteken.
  const moves = f.pgn
    .split("\n")
    .filter((l) => !l.startsWith("["))
    .join(" ")
    .replace(/\s*(\*|1-0|0-1|1\/2-1\/2)\s*$/, "")
    .trim();
  lines.push(`Partij tot nu toe: ${moves || "(nog geen zetten)"}`);
  lines.push(`Huidige stelling (FEN): ${f.currentFen}`);

  if (f.focus) {
    const m = f.focus;
    const best = m.bestMoves[0];
    lines.push("");
    lines.push(
      `BESPROKEN ZET: ${m.moveNumber}${m.color === "wit" ? "." : "..."} ${m.san} (${m.color}), beoordeling: ${m.label}`,
    );
    lines.push(`- FEN vóór de zet: ${m.fenBefore}`);
    if (m.category)
      lines.push(`- Type fout (vastgesteld door regels): ${m.category}. ${m.categoryDetail ?? ""}`.trim());
    if (m.insights?.length) {
      lines.push(`- POSITIEFEITEN:`);
      for (const i of m.insights) lines.push(`  • ${i}`);
    }
    if (m.bestMoves.length) {
      lines.push(`- Sterkste zetten volgens Stockfish (varianten):`);
      m.bestMoves.forEach((b, i) =>
        lines.push(`  ${i + 1}. ${b.text}${i > 0 && best ? ` (${compared(b.eval, best.eval, m.color)})` : ""}`),
      );
    }
    if (m.refutation) lines.push(`- Sterkste vervolg na ${m.san}: ${m.refutation.text}`);
  }

  if (f.whatIf.length) {
    const m = f.focus;
    lines.push("");
    lines.push(`"WAT ALS"-ANALYSES (andere zetten in dezelfde stelling):`);
    for (const w of f.whatIf)
      lines.push(`- ${w.text}${m?.bestMoves[0] ? ` (${compared(w.eval, m.bestMoves[0].eval, m.color)})` : ""}`);
  }

  if (f.patterns.length) {
    lines.push("");
    lines.push(`TERUGKERENDE FOUTPATRONEN VAN DEZE SPELER:`);
    for (const p of f.patterns)
      lines.push(`- ${p.text}: ${p.count}× in totaal, ${p.recent}× in de laatste 10 partijen`);
  }
  return lines.join("\n");
}
