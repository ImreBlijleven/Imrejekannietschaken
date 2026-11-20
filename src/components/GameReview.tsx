"use client";

import { useState } from "react";
import { Chessboard, type Arrow } from "react-chessboard";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { GameRecord } from "@/lib/db/types";
import { buildFacts } from "@/lib/client/analysis";
import { biggestMistakes, resultText, strengthName } from "@/lib/client/game-flow";
import { uciToMove } from "@/lib/chess/uci";
import { CHAT_INTRO_MOVE, CoachChat } from "./CoachChat";
import { EvalGraph } from "./EvalGraph";
import { MoveFeedback } from "./MoveFeedback";
import { MoveList, moveNumber } from "./MoveList";
import { BOARD_STYLE, Card, IconButton, KEYS, Kbd, KeyHint, formatDate, useKeyShortcuts } from "./ui";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Terugkijken van een opgeslagen partij, met coach per zet. Opent op je grootste fout. */
export function GameReview({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(
    () => biggestMistakes(game, 1)[0]?.ply ?? (game.plies.length ? game.plies.length - 1 : null),
  );
  const [showBest, setShowBest] = useState(true);
  const ply = selected !== null ? game.plies[selected] : null;
  const isMistake = !!ply?.label && !["beste", "goed"].includes(ply.label) && !!ply.bestUci;
  const withArrows = isMistake && showBest;

  const arrows: Arrow[] = [];
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (ply && withArrows) {
    const p = uciToMove(ply.uci);
    const b = uciToMove(ply.bestUci!);
    arrows.push({ startSquare: p.from, endSquare: p.to, color: "rgba(185,28,28,0.85)" });
    arrows.push({ startSquare: b.from, endSquare: b.to, color: "rgba(4,120,87,0.9)" });
  } else if (ply) {
    const lm = uciToMove(ply.uci);
    squareStyles[lm.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[lm.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  const fen = ply ? (withArrows ? ply.fenBefore : ply.fenAfter) : START_FEN;
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
      <div className="flex items-center gap-2">
        <IconButton label="Terug naar partijen" shortcut={KEYS.back} variant="ghost" onClick={onClose}>
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">
            {formatDate(game.createdAt)} · {resultText(game)}
          </h1>
          <p className="truncate text-xs text-[var(--muted)]">
            {strengthName(game)} · {game.playerColor === "w" ? "wit" : "zwart"}
            {game.accuracy !== undefined && <> · nauwkeurigheid {game.accuracy.toFixed(0)}%</>}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-6">
        <div className="space-y-2">
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
          <div className="flex min-h-12 sm:min-h-11 items-center gap-2">
            <IconButton label="Vorige zet" shortcut={KEYS.prev} onClick={() => go(-1)} disabled={!selected}>
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <IconButton
              label="Volgende zet"
              shortcut={KEYS.next}
              onClick={() => go(1)}
              disabled={selected === game.plies.length - 1}
            >
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
            <span className="text-sm font-medium">{label}</span>
          </div>
          {isMistake && (
            <label className="flex min-h-12 sm:min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} />
              <span>
                Pijlen tonen: <span className="text-blunder">rood = gespeeld</span>,{" "}
                <span className="text-good">groen = beter</span>
              </span>
            </label>
          )}
          {ply && ply.color === game.playerColor ? (
            <MoveFeedback ply={ply} previousEval={game.plies[ply.ply - 1]?.evalAfter} pending={false} />
          ) : ply ? (
            <Card className="px-4 py-3 text-sm">
              Zet van de computer: <span className="san">{ply.san}</span>
            </Card>
          ) : null}
          <Card className="p-3">
            <EvalGraph plies={game.plies} playerColor={game.playerColor} selected={selected} onSelect={setSelected} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="space-y-2 p-1.5 sm:p-3">
            <MoveList plies={game.plies} selected={selected} onSelect={setSelected} showLabels />
            <KeyHint>
              <Kbd>←</Kbd> <Kbd>→</Kbd> door de zetten bladeren · <Kbd>Esc</Kbd> terug naar de lijst
            </KeyHint>
          </Card>
          <CoachChat
            key={`${game.id}-${selected}`}
            contextLabel={label}
            intro={CHAT_INTRO_MOVE}
            buildFacts={(question) =>
              buildFacts({ plies: game.plies, playerColor: game.playerColor, focusPly: selected, question })
            }
            suggestions={isMistake ? ["Waarom was dit fout?", "Wat had ik moeten spelen?"] : ["Waarom is dit een goede zet?", "Wat is het plan nu?"]}
          />
        </div>
      </div>
    </div>
  );
}
