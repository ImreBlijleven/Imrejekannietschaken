"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { GameRecord } from "@/lib/db/types";
import { outcome, resultText, strengthName, type Outcome } from "@/lib/client/game-flow";
import { GameReview } from "./GameReview";
import { showToast } from "./Toaster";
import { Card, IconButton, Skeleton, formatDateTime, useDelayed } from "./ui";

const BADGE: Record<Outcome | "bezig", string> = {
  gewonnen: "bg-[var(--accent-soft)] text-good",
  verloren: "bg-[var(--bg)] text-blunder",
  remise: "bg-[var(--bg)] text-[var(--fg)]",
  afgebroken: "bg-[var(--bg)] text-[var(--muted)]",
  bezig: "bg-[var(--bg)] text-[var(--warning)]",
};

/** Eén partij in de lijst. Zonder `game` toont dezelfde rij grijze blokken (laadstand). */
function GameRow({
  game: g,
  onOpen,
  onDelete,
}: {
  game?: GameRecord;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const state = g ? (g.status === "bezig" ? "bezig" : outcome(g)) : null;
  return (
    <li className="flex items-center">
      <button
        onClick={onOpen}
        disabled={!g}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg)] disabled:hover:bg-transparent"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2">
            {g && state ? (
              <>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${BADGE[state]}`}>
                  {g.status === "bezig" ? "Bezig" : resultText(g)}
                </span>
                <span className="num text-xs text-[var(--muted)]">{formatDateTime(g.createdAt)}</span>
              </>
            ) : (
              <>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3.5 w-24" />
              </>
            )}
          </span>
          {g ? (
            <span className="num block text-sm">
              {strengthName(g)} · {g.playerColor === "w" ? "wit" : "zwart"} · {Math.ceil(g.plies.length / 2)} zetten
              {g.accuracy !== undefined && (
                <span className="whitespace-nowrap text-[var(--muted)]"> · {g.accuracy.toFixed(0)}% nauwkeurig</span>
              )}
            </span>
          ) : (
            <Skeleton className="h-4 w-56 max-w-full" />
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
      </button>
      <IconButton
        label="Partij verwijderen"
        variant="ghost"
        disabled={!g}
        className="mr-2 text-[var(--muted)] hover:text-[var(--danger)]"
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden />
      </IconButton>
    </li>
  );
}

export function GamesView() {
  const repo = useMemo(() => getRepository(), []);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [open, setOpen] = useState<GameRecord | null>(null);
  const showSkeleton = useDelayed(games === null);

  useEffect(() => {
    repo.listGames().then(setGames);
  }, [repo]);

  if (open) return <GameReview game={open} onClose={() => setOpen(null)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mijn partijen</h1>
      {games === null && showSkeleton && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]" aria-busy="true" aria-label="Partijen laden">
            <GameRow />
            <GameRow />
            <GameRow />
          </ul>
        </Card>
      )}
      {games?.length === 0 && (
        <Card className="p-5 text-sm text-[var(--muted)]">Nog geen partijen gespeeld. Start er een via Spelen.</Card>
      )}
      {games && games.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {games.map((g) => (
              <GameRow
                key={g.id}
                game={g}
                onOpen={() => setOpen(g)}
                onDelete={async () => {
                  // Direct verwijderen (soft delete) met een Ongedaan-maken-melding i.p.v. een bevestigingsvraag.
                  // Optimistisch: eerst uit de lijst, bij een fout terugzetten met een melding.
                  setGames((list) => list?.filter((x) => x.id !== g.id) ?? null);
                  try {
                    await repo.deleteGame(g.id);
                  } catch {
                    setGames(await repo.listGames());
                    showToast({ message: "Verwijderen mislukt. De partij staat er nog." });
                    return;
                  }
                  showToast({
                    message: "Partij verwijderd.",
                    action: {
                      label: "Ongedaan maken",
                      onClick: async () => {
                        await repo.restoreGame(g.id);
                        setGames(await repo.listGames());
                      },
                    },
                  });
                }}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
