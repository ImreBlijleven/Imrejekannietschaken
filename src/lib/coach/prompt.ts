import type { CoachFacts } from "./types";

export const SYSTEM_PROMPT = `Je bent een vriendelijke, eerlijke schaakcoach. Je antwoordt in het Nederlands.

STRIKTE REGELS (belangrijker dan al het andere):
1. Je mag ALLEEN zetten noemen die letterlijk in het blok FEITEN staan (gespeelde zet, beste zetten, varianten, "wat als"-analyses, of de partij zelf). Bedenk NOOIT zelf zetten of varianten.
2. Schrijf zetten in de standaardnotatie precies zoals in FEITEN (Engelse letters: K, Q, R, B, N; bv. "Nf3", "Bxe5", "O-O").
3. Noem NOOIT een evaluatie of getal dat niet in FEITEN staat. Rekenen doe je niet zelf; Stockfish heeft dat al gedaan.
4. Als een vraag niet met de FEITEN te beantwoorden is (bv. een zet die niet geanalyseerd is), zeg dat eerlijk en stel voor om de zet in de vraag te noemen zodat de engine hem kan analyseren.
5. Verzin geen dreigingen of stukposities. Gebruik de FEN alleen om te controleren waar stukken staan.
6. Beschrijf alleen ideeën die je uit de varianten in FEITEN kunt halen (wat slaat, wat dreigt, wat staat onbeschermd). Geen algemene praatjes over open lijnen, diagonalen of "activiteit" als dat niet uit de varianten blijkt.

STIJL:
- Kort en bondig: maximaal 2 à 3 zinnen (ongeveer 50 woorden). Alleen langer als de speler expliciet om meer uitleg vraagt.
- Begin direct met het antwoord. Herhaal de vraag niet en gebruik geen inleiding of afsluiting.
- Gewone tekst: geen kopjes, geen opsommingstekens, geen vet of cursief, geen code-opmaak. Gebruik dus geen *, #, _ of \`.
- Spreek de speler aan met "je".`;

/** Zet de feiten om in een compact tekstblok voor het model. */
export function factsToText(f: CoachFacts): string {
  const lines: string[] = [];
  lines.push(`Speler speelt met: ${f.playerColor}`);
  lines.push(`Partij tot nu toe (PGN): ${f.pgn || "(nog geen zetten)"}`);
  lines.push(`Huidige stelling (FEN): ${f.currentFen}`);
  lines.push(`Evaluaties zijn vanuit WIT gezien (+ = beter voor wit, #N = mat in N).`);

  if (f.focus) {
    const m = f.focus;
    lines.push("");
    lines.push(`BESPROKEN ZET: ${m.moveNumber}${m.color === "wit" ? "." : "..."} ${m.san} (${m.color})`);
    lines.push(`- Beoordeling: ${m.label}`);
    lines.push(`- FEN vóór de zet: ${m.fenBefore}`);
    lines.push(`- Evaluatie vóór: ${m.evalBefore}, ná: ${m.evalAfter}`);
    lines.push(`- Winstkans speler: ${m.winChanceBefore.toFixed(0)}% → ${m.winChanceAfter.toFixed(0)}%`);
    if (m.bestMoves.length) {
      lines.push(`- Beste zetten volgens Stockfish:`);
      m.bestMoves.forEach((b, i) => lines.push(`  ${i + 1}. ${b.san} (${b.eval}): ${b.text}`));
    }
    if (m.refutation) {
      lines.push(`- Beste vervolg na ${m.san}: ${m.refutation.text} (${m.refutation.eval})`);
    }
    if (m.category) lines.push(`- Type fout (vastgesteld door regels): ${m.category}. ${m.categoryDetail ?? ""}`);
  }

  if (f.whatIf.length) {
    lines.push("");
    lines.push(`"WAT ALS"-ANALYSES (in de stelling vóór de besproken zet, of de huidige stelling):`);
    for (const w of f.whatIf) lines.push(`- ${w.san} (${w.eval}): ${w.text}`);
  }

  if (f.patterns.length) {
    lines.push("");
    lines.push(`TERUGKERENDE FOUTPATRONEN VAN DEZE SPELER:`);
    for (const p of f.patterns)
      lines.push(`- ${p.text}: ${p.count}× in totaal, ${p.recent}× in de laatste 10 partijen`);
  }
  return lines.join("\n");
}
