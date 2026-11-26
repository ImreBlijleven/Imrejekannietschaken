// Gespreide herhaling: wat je goed doet komt later terug, wat je fout doet snel.

/** Wachttijd in dagen na 1, 2, 3, ... keer op rij goed. */
export const INTERVALS = [1, 3, 7, 16, 35, 80];
const AGAIN_MINUTES = 10; // fout: binnen dezelfde dag opnieuw

export interface Schedule {
  streak: number;
  due: string; // ISO
}

export function nextSchedule(prevStreak: number, correct: boolean, now = new Date()): Schedule {
  if (!correct) return { streak: 0, due: new Date(now.getTime() + AGAIN_MINUTES * 60_000).toISOString() };
  const streak = prevStreak + 1;
  const days = INTERVALS[Math.min(streak, INTERVALS.length) - 1];
  return { streak, due: new Date(now.getTime() + days * 86_400_000).toISOString() };
}
