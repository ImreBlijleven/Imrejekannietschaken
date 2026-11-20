"use client";

import { useState } from "react";
import { Chessboard, type Arrow } from "react-chessboard";
import type { GameRecord } from "@/lib/db/types";
import { buildFacts } from "@/lib/client/analysis";
import { resultText } from "@/lib/client/game-flow";
import { uciToMove } from "@/lib/chess/uci";
import { CoachChat } from "./CoachChat";
import { EvalGraph } from "./EvalGraph";
import { MoveFeedback } from "./MoveFeedback";
import { MoveList } from "./MoveList";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Terugkijken van een opgeslagen partij, met coach per zet. */
export function GameReview({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(game.plies.length ? game.plies.length - 1 : null);
  const ply = selected !== null ? game.plies[selected] : null;
  const isMistake = !!ply?.label && !["beste", "goed"].includes(ply.label) && !!ply.bestUci;

  const arrows: Arrow[] = [];
  if (ply && isMistake) {
    const p = uciToMove(ply.uci);
    const b = uciToMove(ply.bestUci!);
    arrows.push({ startSquare: p.from, endSquare: p.to, color: "rgba(220,38,38,0.8)" });
    arrows.push({ startSquare: b.from, endSquare: b.to, color: "rgba(22,163,74,0.85)" });
  }
  const fen = ply ? (isMistake ? ply.fenBefore : ply.fenAfter) : START_FEN;
  const label = ply ? `${ply.fenBefore.split(" ")[5]}${ply.color === "w" ? "." : "..."} ${ply.san}` : "Beginstelling";

  const go = (d: number) => {
    if (!game.plies.length) return;
    const next = Math.min(game.plies.length - 1, Math.max(0, (selected ?? -1) + d));
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Partij van {new Date(game.createdAt).toLocaleDateString("nl-NL")} · {resultText(game)}
        </h1>
        <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
          ← Terug
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div className="space-y-3">
          <div className="w-full max-w-[520px] aspect-square">
            <Chessboard
              options={{
                id: "reviewbord",
                position: fen,
                boardOrientation: game.playerColor === "w" ? "white" : "black",
                allowDragging: false,
                arrows,
              }}
            />
          </div>
          {isMistake && (
            <p className="text-xs text-[var(--muted)]">Stelling vóór de zet: rood = gespeeld, groen = beter.</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => go(-1)} className="rounded-lg border border-[var(--border)] px-4 py-2">
              ◀
            </button>
            <button onClick={() => go(1)} className="rounded-lg border border-[var(--border)] px-4 py-2">
              ▶
            </button>
          </div>
          <EvalGraph plies={game.plies} playerColor={game.playerColor} selected={selected} onSelect={setSelected} />
        </div>
        <div className="space-y-4">
          {ply && ply.color === game.playerColor && <MoveFeedback ply={ply} pending={false} />}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
            <MoveList plies={game.plies} selected={selected} onSelect={setSelected} showLabels />
          </div>
          <CoachChat
            key={`${game.id}-${selected}`}
            contextLabel={label}
            buildFacts={(question) =>
              buildFacts({ plies: game.plies, playerColor: game.playerColor, focusPly: selected, question })
            }
            suggestions={["Waarom is deze zet goed of slecht?", "Wat had ik moeten spelen?"]}
          />
        </div>
      </div>
    </div>
  );
}
