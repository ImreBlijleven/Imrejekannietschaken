"use client";

import { useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { GameRecord } from "@/lib/db/types";
import { resultText, strengthName } from "@/lib/client/game-flow";
import { GameReview } from "./GameReview";

export function GamesView() {
  const repo = useMemo(() => getRepository(), []);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [open, setOpen] = useState<GameRecord | null>(null);

  useEffect(() => {
    repo.listGames().then(setGames);
  }, [repo]);

  if (open) return <GameReview game={open} onClose={() => setOpen(null)} />;
  if (!games) return <p className="text-[var(--muted)]">Laden…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mijn partijen</h1>
      {games.length === 0 && <p className="text-[var(--muted)]">Nog geen partijen gespeeld.</p>}
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--panel)]">
        {games.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <div className="font-medium">
                {new Date(g.createdAt).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {g.playerColor === "w" ? "wit" : "zwart"} · {strengthName(g)}
              </div>
              <div className="text-[var(--muted)]">
                {g.status === "bezig" ? "Bezig" : resultText(g)} · {Math.ceil(g.plies.length / 2)} zetten
                {g.accuracy !== undefined && <> · nauwkeurigheid {g.accuracy.toFixed(0)}%</>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(g)} className="rounded-lg bg-[var(--accent)] text-white px-3 py-1.5">
                Bekijken
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Deze partij en de bijbehorende fouten verwijderen?")) return;
                  await repo.deleteGame(g.id);
                  setGames(await repo.listGames());
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5"
              >
                Verwijderen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
