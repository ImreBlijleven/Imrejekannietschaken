// Logica van een openingsoefening: welke zetten passen nog in de theorie?

/** Lijnen die beginnen met de gespeelde zetten. */
export function compatibleLines(lines: string[][], played: string[]): string[][] {
  return lines.filter((line) => line.length > played.length && played.every((m, i) => line[i] === m));
}

/** Alle theoriezetten in deze stelling (uniek). */
export function bookMoves(lines: string[][], played: string[]): string[] {
  return [...new Set(compatibleLines(lines, played).map((line) => line[played.length]))];
}

/** Kies een theoriezet voor de tegenstander; elke lijn even waarschijnlijk. */
export function pickBookMove(lines: string[][], played: string[], random = Math.random): string | null {
  const options = compatibleLines(lines, played).map((line) => line[played.length]);
  return options.length ? options[Math.floor(random() * options.length)] : null;
}

/** Totale lengte van de langste nog passende lijn (voor de voortgang). */
export function lineLength(lines: string[][], played: string[]): number {
  const fitting = lines.filter((line) => played.every((m, i) => line[i] === m));
  return Math.max(played.length, ...fitting.map((line) => line.length));
}
