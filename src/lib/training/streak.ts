// Dagen op rij getraind (per apparaat). Een dag telt zodra je de dagelijkse training afmaakt.

const KEY = "schaakcoach.trainingsdagen";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function markTrainedToday() {
  const days = new Set(load());
  days.add(dayKey(new Date()));
  try {
    localStorage.setItem(KEY, JSON.stringify([...days].sort().slice(-400)));
  } catch {
    /* negeren */
  }
}

/** Aantal dagen op rij, eindigend vandaag of gisteren (dan kun je de reeks vandaag nog voortzetten). */
export function trainingStreak(): { days: number; today: boolean } {
  const days = new Set(load());
  const d = new Date();
  const today = days.has(dayKey(d));
  if (!today) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return { days: n, today };
}
