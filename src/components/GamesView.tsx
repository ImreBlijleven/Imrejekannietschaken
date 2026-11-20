"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { GameRecord } from "@/lib/db/types";
import { outcome, resultText, strengthName, type Outcome } from "@/lib/client/game-flow";
import { GameReview } from "./GameReview";
import { Card, IconButton, formatDateTime } from "./ui";

const BADGE: Record<Outcome | "bezig", string> = {
  gewonnen: "bg-[var(--accent-soft)] text-good",
  verloren: "bg-[var(--bg)] text-blunder",
  remise: "bg-[var(--bg)] text-[var(--fg)]",
  afgebroken: "bg-[var(--bg)] text-[var(--muted)]",
  bezig: "bg-[var(--bg)] text-[var(--warning)]",
};

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
      {games.length === 0 && (
        <Card className="p-5 text-sm text-[var(--muted)]">Nog geen partijen gespeeld. Start er een via Spelen.</Card>
      )}
      {games.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {games.map((g) => {
              const state = g.status === "bezig" ? "bezig" : outcome(g);
              return (
                <li key={g.id} className="flex items-center">
                  <button
                    onClick={() => setOpen(g)}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg)]"
                  >
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${BADGE[state]}`}>
                          {g.status === "bezig" ? "Bezig" : resultText(g)}
                        </span>
                        <span className="num text-xs text-[var(--muted)]">{formatDateTime(g.createdAt)}</span>
                      </span>
                      <span className="num block text-sm">
                        {strengthName(g)} · {g.playerColor === "w" ? "wit" : "zwart"} · {Math.ceil(g.plies.length / 2)}{" "}
                        zetten
                        {g.accuracy !== undefined && (
                          <span className="whitespace-nowrap text-[var(--muted)]"> · {g.accuracy.toFixed(0)}% nauwkeurig</span>
                        )}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                  </button>
                  <IconButton
                    label="Partij verwijderen"
                    variant="ghost"
                    className="mr-2 text-[var(--muted)] hover:text-[var(--danger)]"
                    onClick={async () => {
                      if (!confirm("Deze partij en de bijbehorende fouten verwijderen?")) return;
                      await repo.deleteGame(g.id);
                      setGames(await repo.listGames());
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
