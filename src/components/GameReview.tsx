"use client";

import { useState } from "react";
import { Chessboard, type Arrow } from "react-chessboard";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { GameRecord } from "@/lib/db/types";
import { buildFacts } from "@/lib/client/analysis";
import { biggestMistakes, resultText, strengthName } from "@/lib/client/game-flow";
import { uciToMove } from "@/lib/chess/uci";
import { CoachChat } from "./CoachChat";
import { EvalGraph } from "./EvalGraph";
import { MoveFeedback } from "./MoveFeedback";
import { MoveList, moveNumber } from "./MoveList";
import { BOARD_STYLE, IconButton, KEYS, formatDate, useKeyShortcuts } from "./ui";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Terugkijken van een opgeslagen partij, met coach per zet. Opent op je grootste fout. */
export function GameReview({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(
    () => biggestMistakes(game, 1)[0]?.ply ?? (game.plies.length ? game.plies.length - 1 : null),
  );
  const ply = selected !== null ? game.plies[selected] : null;
  const isMistake = !!ply?.label && !["beste", "goed"].includes(ply.label) && !!ply.bestUci;

  const arrows: Arrow[] = [];
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (ply && isMistake) {
    const p = uciToMove(ply.uci);
    const b = uciToMove(ply.bestUci!);
    arrows.push({ startSquare: p.from, endSquare: p.to, color: "rgba(185,28,28,0.85)" });
    arrows.push({ startSquare: b.from, endSquare: b.to, color: "rgba(4,120,87,0.9)" });
  } else if (ply) {
    const lm = uciToMove(ply.uci);
    squareStyles[lm.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[lm.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  const fen = ply ? (isMistake ? ply.fenBefore : ply.fenAfter) : START_FEN;
  const label = ply ? `${moveNumber(ply)}${ply.color === "w" ? "." : "..."} ${ply.san}` : "Beginstelling";

  const go = (d: number) => {
    if (!game.plies.length) return;
    setSelected(Math.min(game.plies.length - 1, Math.max(0, (selected ?? -1) + d)));
  };

  useKeyShortcuts((key) => {
    if (key === "ArrowLeft") {
      go(-1);
      return true;
    }
    if (key === "ArrowRight") {
      go(1);
      return true;
    }
    if (key === "Escape") {
      onClose();
      return true;
    }
    return false;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <IconButton label="Terug naar partijen" shortcut={KEYS.back} variant="ghost" onClick={onClose}>
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <h1 className="min-w-0 truncate text-lg font-semibold">
          {resultText(game)}
          <span className="num font-normal text-[var(--muted)]">
            {" "}
            · {formatDate(game.createdAt)} · {strengthName(game)}
          </span>
        </h1>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-8">
        <div className="space-y-3">
          <div className="board-touch aspect-square w-full max-w-[520px] overflow-hidden rounded-lg">
            <Chessboard
              options={{
                id: "reviewbord",
                position: fen,
                boardOrientation: game.playerColor === "w" ? "white" : "black",
                allowDragging: false,
                arrows,
                squareStyles,
                ...BOARD_STYLE,
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="Vorige zet" shortcut={KEYS.prev} variant="ghost" onClick={() => go(-1)} disabled={!selected}>
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <IconButton
              label="Volgende zet"
              shortcut={KEYS.next}
              variant="ghost"
              onClick={() => go(1)}
              disabled={selected === game.plies.length - 1}
            >
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
            <span className="san pl-1 text-sm">{label}</span>
          </div>
          {ply && ply.color === game.playerColor && (
            <MoveFeedback ply={ply} previousEval={game.plies[ply.ply - 1]?.evalAfter} />
          )}
          <EvalGraph plies={game.plies} playerColor={game.playerColor} selected={selected} onSelect={setSelected} />
        </div>
        <div className="space-y-4">
          <div className="border-y border-[var(--border)] py-1">
            <MoveList plies={game.plies} selected={selected} onSelect={setSelected} showLabels />
          </div>
          <CoachChat
            key={`${game.id}-${selected}`}
            placeholder={`Vraag iets over ${label}`}
            buildFacts={(question) =>
              buildFacts({ plies: game.plies, playerColor: game.playerColor, focusPly: selected, question })
            }
            suggestions={isMistake ? ["Waarom fout?", "Wat was beter?"] : ["Waarom goed?", "Wat nu?"]}
          />
        </div>
      </div>
    </div>
  );
}
