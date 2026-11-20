"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Chessboard, type Arrow } from "react-chessboard";
import { ChevronLeft, ChevronRight, Flag, LoaderCircle, Minus, Plus, Undo2 } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { GameMode, GameRecord, PlyRecord } from "@/lib/db/types";
import {
  ELO_MAX,
  ELO_MIN,
  STOCKFISH_ELO_MIN,
  applyMove,
  biggestMistakes,
  chessFromPlies,
  evaluatePlayerPly,
  finalize,
  finishIfOver,
  newGame,
  opponentMove,
  outcome,
  resultText,
  strengthName,
} from "@/lib/client/game-flow";
import { analyse, buildFacts } from "@/lib/client/analysis";
import { CATEGORY_TEXT } from "@/lib/chess/patterns";
import { uciToMove } from "@/lib/chess/uci";
import { CHAT_INTRO_MOVE, CoachChat } from "./CoachChat";
import { EvalGraph } from "./EvalGraph";
import { MoveFeedback } from "./MoveFeedback";
import { LABEL_STYLE, MoveList, moveNumber } from "./MoveList";
import { BOARD_STYLE, Button, Card, IconButton } from "./ui";

const ELO_KEY = "schaakcoach.elo";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const plyName = (p: PlyRecord) => `${moveNumber(p)}${p.color === "w" ? "." : "..."} ${p.san}`;

/* ───────────────────────── Nieuwe partij ───────────────────────── */

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${options.some((o) => o.hint) ? "sm:grid-cols-2" : "grid-cols-3"}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              on
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold"
                : "border-[var(--border)] hover:bg-[var(--bg)]"
            } ${o.hint ? "" : "text-center"}`}
          >
            {o.label}
            {o.hint && <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Setup({
  onStart,
  ongoing,
  onResume,
}: {
  onStart: (c: "w" | "b", elo: number, mode: GameMode) => void;
  ongoing: GameRecord | null;
  onResume: () => void;
}) {
  const [color, setColor] = useState<"w" | "b" | "random">("w");
  // Laatst gekozen Elo uit localStorage (op de server: standaardwaarde, geen hydration-verschil).
  const storedElo = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const v = Number(localStorage.getItem(ELO_KEY));
        return v >= ELO_MIN && v <= ELO_MAX ? v : 1200;
      } catch {
        return 1200;
      }
    },
    () => 1200,
  );
  const [chosenElo, setEloState] = useState<number | null>(null);
  const elo = chosenElo ?? storedElo;
  const setElo = (v: number) => {
    setEloState(v);
    try {
      localStorage.setItem(ELO_KEY, String(v));
    } catch {
      /* negeren */
    }
  };
  const [mode, setMode] = useState<GameMode>("training");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {ongoing && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <p className="font-semibold">Partij in uitvoering</p>
            <p className="text-[var(--muted)]">
              {strengthName(ongoing)} · {Math.ceil(ongoing.plies.length / 2)} zetten gespeeld
            </p>
          </div>
          <Button variant="primary" onClick={onResume}>
            Verder spelen
          </Button>
        </Card>
      )}
      <Card className="space-y-6 p-5 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-balance">Nieuwe partij</h1>
          <p className="text-sm text-[var(--muted)]">
            Speel tegen Stockfish. Na elke zet zie je hoe goed hij was, en de coach legt uit waarom.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Jij speelt met</legend>
          <Segmented
            label="Kleur"
            value={color}
            onChange={setColor}
            options={[
              { value: "w", label: "Wit" },
              { value: "b", label: "Zwart" },
              { value: "random", label: "Willekeurig" },
            ]}
          />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium">
            <span>Sterkte computer</span>
            <span className="num text-base font-semibold">Elo {elo}</span>
          </legend>
          <div className="flex items-center gap-2">
            <IconButton label="50 Elo lager" onClick={() => setElo(Math.max(ELO_MIN, elo - 50))} disabled={elo <= ELO_MIN}>
              <Minus className="size-5" aria-hidden />
            </IconButton>
            <input
              type="range"
              min={ELO_MIN}
              max={ELO_MAX}
              step={50}
              value={elo}
              onChange={(e) => setElo(Number(e.target.value))}
              aria-label="Elo van de computer"
              aria-valuetext={`Elo ${elo}`}
              className="h-11 w-full"
            />
            <IconButton label="50 Elo hoger" onClick={() => setElo(Math.min(ELO_MAX, elo + 50))} disabled={elo >= ELO_MAX}>
              <Plus className="size-5" aria-hidden />
            </IconButton>
          </div>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {elo < STOCKFISH_ELO_MIN
              ? "Onder 1320 is de sterkte een schatting: Stockfish speelt dan af en toe een willekeurige zet."
              : "Stockfish' eigen Elo-stand. Gemeten tegen andere schaakprogramma's, dus niet precies gelijk aan je online rating."}
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Modus</legend>
          <Segmented
            label="Modus"
            value={mode}
            onChange={setMode}
            options={[
              { value: "training", label: "Training", hint: "Beoordeling na elke zet, terugnemen mag" },
              { value: "partij", label: "Partij", hint: "Zonder hulp, analyse na afloop" },
            ]}
          />
        </fieldset>

        <Button
          variant="primary"
          block
          className="min-h-12 text-base"
          onClick={() => onStart(color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color, elo, mode)}
        >
          Start partij
        </Button>
      </Card>
    </div>
  );
}

/* ───────────────────────── Samenvatting na de partij ───────────────────────── */

function Summary({
  game,
  selected,
  onSelect,
  onNew,
}: {
  game: GameRecord;
  selected: number | null;
  onSelect: (ply: number) => void;
  onNew: () => void;
}) {
  const mine = game.plies.filter((p) => p.color === game.playerColor);
  const count = (l: string) => mine.filter((p) => p.label === l).length;
  const top = biggestMistakes(game, 3);
  const o = outcome(game);
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold ${o === "gewonnen" ? "text-good" : ""}`}>{resultText(game)}</h1>
          <p className="text-sm text-[var(--muted)]">
            {strengthName(game)} · {Math.ceil(game.plies.length / 2)} zetten
          </p>
        </div>
        {game.accuracy !== undefined && (
          <div className="text-right">
            <p className="num text-2xl font-bold leading-none">{game.accuracy.toFixed(0)}%</p>
            <p className="text-xs text-[var(--muted)]">nauwkeurigheid</p>
          </div>
        )}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {count("blunder") + count("fout") + count("onnauwkeurig") === 0 ? (
          <span className="text-good">✓ Geen fouten gemaakt</span>
        ) : (
          <>
            {count("blunder") > 0 && (
              <span className="text-blunder">
                ?? {count("blunder")} {count("blunder") === 1 ? "blunder" : "blunders"}
              </span>
            )}
            {count("fout") > 0 && (
              <span className="text-mistake">
                ? {count("fout")} {count("fout") === 1 ? "fout" : "fouten"}
              </span>
            )}
            {count("onnauwkeurig") > 0 && (
              <span className="text-inaccuracy">?! {count("onnauwkeurig")} onnauwkeurig</span>
            )}
          </>
        )}
      </p>
      <EvalGraph plies={game.plies} playerColor={game.playerColor} selected={selected} onSelect={onSelect} />
      {top.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold">Leerpunten uit deze partij</h2>
          <ul className="divide-y divide-[var(--border)]">
            {top.map((m) => (
              <li key={m.ply}>
                <button
                  onClick={() => onSelect(m.ply)}
                  className="flex min-h-12 w-full items-center gap-3 text-left text-sm hover:bg-[var(--bg)]"
                >
                  <span className={`w-6 shrink-0 font-bold ${LABEL_STYLE[m.label!].cls}`}>{LABEL_STYLE[m.label!].icon}</span>
                  <span className="san">{plyName(m)}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{CATEGORY_TEXT[m.category!]}</span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="primary" block onClick={onNew}>
        Nieuwe partij
      </Button>
    </Card>
  );
}

/* ───────────────────────── Speelscherm ───────────────────────── */

export function PlayView() {
  const repo = useMemo(() => getRepository(), []);
  const gameRef = useRef<GameRecord | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<GameRecord | null>(null);
  const [ongoing, setOngoing] = useState<GameRecord | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState<"" | "beoordelen" | "computer">("");
  const [waitForContinue, setWaitForContinue] = useState(false);
  const [showBest, setShowBest] = useState(true);
  const [moveFrom, setMoveFrom] = useState<string | null>(null); // tik-om-te-zetten: gekozen stuk

  useEffect(() => {
    repo.getOngoingGame().then((g) => setOngoing(g ?? null));
  }, [repo]);

  // Na afloop: terug naar boven, waar de samenvatting staat.
  const finishedNow = game?.status === "afgelopen";
  useEffect(() => {
    if (finishedNow) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [finishedNow]);

  const commit = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    setGame({ ...g, plies: [...g.plies] });
    await repo.saveGame(g);
  }, [repo]);

  const runOpponent = useCallback(async () => {
    const g = gameRef.current;
    if (!g || g.status !== "bezig") return;
    const chess = chessFromPlies(g.plies);
    if (chess.turn() === g.playerColor) return;
    setBusy("computer");
    const mv = await opponentMove(chess.fen(), g.elo ?? 1320 + g.level * 90);
    if (gameRef.current !== g) return; // partij is intussen gewisseld
    const ply = mv ? applyMove(g, mv) : null;
    if (ply) {
      const res = await analyse(ply.fenAfter, 3); // ook de 'voor'-analyse van de volgende spelerszet
      ply.evalAfter = res.lines[0]?.score ?? { cp: 0 };
    }
    finishIfOver(g);
    setBusy("");
    await commit();
  }, [commit]);

  const afterPlayerMove = useCallback(
    async (ply: PlyRecord) => {
      const g = gameRef.current;
      if (!g) return;
      setBusy("beoordelen");
      const updated = await evaluatePlayerPly(g, ply);
      if (gameRef.current !== g) return;
      g.plies[ply.ply] = updated;
      const serious = updated.label === "fout" || updated.label === "blunder";
      if (g.mode === "training" && serious) {
        try {
          navigator.vibrate?.(updated.label === "blunder" ? [80, 60, 80] : 60);
        } catch {
          /* niet ondersteund */
        }
      }
      const over = finishIfOver(g);
      setBusy("");
      await commit();
      if (over) return;
      if (g.mode === "training" && serious) {
        setWaitForContinue(true); // pauze: terugnemen, doorgaan of eerst de coach vragen
        return;
      }
      await runOpponent();
    },
    [commit, runOpponent],
  );

  async function start(color: "w" | "b", elo: number, mode: GameMode) {
    if (ongoing) {
      // Een openstaande partij wordt afgesloten als je een nieuwe begint.
      await repo.saveGame({ ...ongoing, status: "afgelopen", result: "*", endReason: "afgebroken" });
    }
    const g = newGame(color, elo, mode);
    gameRef.current = g;
    setSelected(null);
    setMoveFrom(null);
    setWaitForContinue(false);
    await commit();
    if (color === "b") await runOpponent();
  }

  async function resume() {
    if (!ongoing) return;
    const g: GameRecord = { ...ongoing, plies: [...ongoing.plies] };
    gameRef.current = g;
    setOngoing(null);
    setSelected(null);
    await commit();
    const last = g.plies.at(-1);
    if (last && last.color === g.playerColor && !last.label) await afterPlayerMove(last);
    else await runOpponent();
  }

  function canMove(): boolean {
    const g = gameRef.current;
    if (!g || busy || waitForContinue || g.status !== "bezig" || selected !== null) return false;
    return chessFromPlies(g.plies).turn() === g.playerColor;
  }

  function onDrop(from: string, to: string | null): boolean {
    const g = gameRef.current;
    setMoveFrom(null);
    if (!g || !to || !canMove()) return false;
    const chess = chessFromPlies(g.plies);
    const piece = chess.get(from as never);
    const promotion = piece?.type === "p" && (to[1] === "8" || to[1] === "1") ? "q" : undefined;
    const ply = applyMove(g, { from, to, promotion });
    if (!ply) return false;
    setGame({ ...g, plies: [...g.plies] });
    void afterPlayerMove(ply);
    return true;
  }

  /** Tik op een eigen stuk om het te kiezen, tik daarna op een doelveld. */
  function onSquareTap(square: string) {
    const g = gameRef.current;
    if (!g || !canMove()) return;
    const chess = chessFromPlies(g.plies);
    if (moveFrom) {
      const legal = chess.moves({ square: moveFrom as never, verbose: true }).some((m) => m.to === square);
      if (legal) {
        onDrop(moveFrom, square);
        return;
      }
    }
    const piece = chess.get(square as never);
    setMoveFrom(piece && piece.color === g.playerColor && square !== moveFrom ? square : null);
  }

  /** Selecteer een zet en zorg dat het bord in beeld is. */
  function selectPly(i: number | null) {
    setSelected(i);
    setMoveFrom(null);
    const el = boardRef.current;
    if (i !== null && el) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function takeBack() {
    const g = gameRef.current;
    if (!g || busy) return;
    while (g.plies.length) {
      const p = g.plies.pop()!;
      if (p.color === g.playerColor) break;
    }
    g.pgn = chessFromPlies(g.plies).pgn();
    g.status = "bezig";
    g.result = "*";
    setWaitForContinue(false);
    setSelected(null);
    setMoveFrom(null);
    await commit();
  }

  async function continueGame() {
    setWaitForContinue(false);
    await runOpponent();
  }

  async function resign() {
    const g = gameRef.current;
    if (!g || g.status !== "bezig") return;
    if (!confirm("Weet je zeker dat je wilt opgeven?")) return;
    g.result = g.playerColor === "w" ? "0-1" : "1-0";
    g.endReason = "opgegeven";
    finalize(g);
    setWaitForContinue(false);
    setSelected(null);
    setMoveFrom(null);
    await commit();
  }

  if (!game) return <Setup onStart={start} ongoing={ongoing} onResume={resume} />;

  const finished = game.status === "afgelopen";
  const reviewing = selected !== null;
  const showLabels = game.mode === "training" || finished;
  const lastPlayerPly = [...game.plies].reverse().find((p) => p.color === game.playerColor) ?? null;
  const focusPly = selected !== null ? game.plies[selected] : null;
  const playerToMove = !finished && chessFromPlies(game.plies).turn() === game.playerColor;
  const canInteract = playerToMove && !busy && !waitForContinue && !reviewing;
  const selection = canInteract ? moveFrom : null; // geen achtergebleven selectie buiten je beurt

  // Bord: live stelling, of bij een geselecteerde fout de stelling vóór de zet met pijlen.
  const focusIsMistake = !!focusPly?.label && !["beste", "goed"].includes(focusPly.label) && !!focusPly.bestUci;
  const showMistakeArrows = focusIsMistake && showBest;
  const arrows: Arrow[] = [];
  let boardFen = game.plies.at(-1)?.fenAfter ?? START_FEN;
  const squareStyles: Record<string, React.CSSProperties> = {};
  const highlightPly = focusPly ?? game.plies.at(-1);
  if (focusPly) {
    boardFen = showMistakeArrows ? focusPly.fenBefore : focusPly.fenAfter;
    if (showMistakeArrows) {
      const played = uciToMove(focusPly.uci);
      const best = uciToMove(focusPly.bestUci!);
      arrows.push({ startSquare: played.from, endSquare: played.to, color: "rgba(185,28,28,0.85)" });
      arrows.push({ startSquare: best.from, endSquare: best.to, color: "rgba(4,120,87,0.9)" });
    }
  }
  if (highlightPly && !showMistakeArrows) {
    const lm = uciToMove(highlightPly.uci);
    squareStyles[lm.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[lm.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  if (selection) {
    squareStyles[selection] = { background: "rgba(47, 111, 79, 0.5)" };
    for (const m of chessFromPlies(game.plies).moves({ square: selection as never, verbose: true })) {
      squareStyles[m.to] = m.captured
        ? { background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)" };
    }
  }

  const go = (d: number) => {
    if (!game.plies.length) return;
    const cur = selected ?? game.plies.length - 1;
    const next = Math.max(0, Math.min(game.plies.length - 1, cur + d));
    // Vooruit naar de laatste zet tijdens een lopende partij = terug naar live.
    selectPly(!finished && d > 0 && next === game.plies.length - 1 && selected !== null ? null : next);
  };

  // Status onder het bord: altijd duidelijk wie aan zet is.
  const status = finished
    ? { text: resultText(game), spin: false }
    : reviewing
      ? { text: `Je bekijkt ${plyName(focusPly!)}`, spin: false }
      : busy === "beoordelen"
        ? { text: "Stockfish beoordeelt je zet…", spin: true }
        : busy === "computer"
          ? { text: "Computer denkt na…", spin: true }
          : waitForContinue
            ? { text: "Pauze: neem terug of ga door", spin: false }
            : playerToMove
              ? { text: "Jij bent aan zet", spin: false }
              : { text: "Computer is aan zet", spin: false };

  const pauseActions = waitForContinue ? (
    <>
      <Button onClick={takeBack}>
        <Undo2 className="size-4" aria-hidden /> Terugnemen
      </Button>
      <Button variant="primary" onClick={continueGame}>
        Doorgaan
      </Button>
    </>
  ) : undefined;

  // Beoordelingskaart: geselecteerde zet van jou, anders je laatste zet.
  const opponentFocus = focusPly && focusPly.color !== game.playerColor ? focusPly : null;
  const feedbackPly = focusPly ? (opponentFocus ? null : focusPly) : lastPlayerPly;
  const prevEval = feedbackPly ? game.plies[feedbackPly.ply - 1]?.evalAfter : undefined;
  const feedback = opponentFocus ? (
    <Card className="px-4 py-3 text-sm">
      Zet van de computer: <span className="san">{opponentFocus.san}</span>
    </Card>
  ) : (
    <MoveFeedback
      ply={feedbackPly}
      previousEval={prevEval}
      pending={busy === "beoordelen" && !focusPly}
      actions={reviewing ? undefined : pauseActions}
    />
  );

  const chatAllowed = game.mode === "training" || finished;
  const chatPly = focusPly ?? (lastPlayerPly?.label ? lastPlayerPly : null);
  const chatLabel = chatPly ? plyName(chatPly) : "Huidige stelling";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-6 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="space-y-3">
        {finished && (
          <Summary
            game={game}
            selected={selected}
            onSelect={selectPly}
            onNew={() => {
              gameRef.current = null;
              setGame(null);
              setOngoing(null);
              setSelected(null);
            }}
          />
        )}

        <div ref={boardRef} className="scroll-mt-2 space-y-2">
          <p className="px-1 text-xs text-[var(--muted)]">
            Jij: {game.playerColor === "w" ? "wit" : "zwart"} · {strengthName(game)} ·{" "}
            {game.mode === "training" ? "Training" : "Partij"}
          </p>
          <div className="board-touch aspect-square w-full max-w-[560px] overflow-hidden rounded-lg">
            <Chessboard
              options={{
                id: "speelbord",
                position: boardFen,
                boardOrientation: game.playerColor === "w" ? "white" : "black",
                onPieceDrop: ({ sourceSquare, targetSquare }) => onDrop(sourceSquare, targetSquare),
                onPieceDrag: () => setMoveFrom(null),
                onSquareClick: ({ square }) => onSquareTap(square),
                allowDragging: canInteract,
                squareStyles,
                arrows,
                allowDrawingArrows: false,
                ...BOARD_STYLE,
              }}
            />
          </div>
          <div className="flex min-h-11 items-center gap-2">
            <IconButton label="Vorige zet" onClick={() => go(-1)} disabled={!game.plies.length || selected === 0}>
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <IconButton label="Volgende zet" onClick={() => go(1)} disabled={selected === null || selected === game.plies.length - 1}>
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium" role="status" aria-live="polite">
              {status.spin && <LoaderCircle className="size-4 shrink-0 animate-spin text-[var(--muted)]" aria-hidden />}
              <span className="truncate">{status.text}</span>
            </p>
            {reviewing && !finished && (
              <Button variant="primary" onClick={() => selectPly(null)}>
                Live
              </Button>
            )}
          </div>
          {focusIsMistake && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} />
              <span>
                Pijlen tonen: <span className="text-blunder">rood = gespeeld</span>,{" "}
                <span className="text-good">groen = beter</span>
              </span>
            </label>
          )}
        </div>

        {/* Telefoon: beoordeling direct onder het bord, met de pauzeknoppen erin. */}
        {showLabels && <div className="lg:hidden">{feedback}</div>}

        {!finished && !reviewing && (
          <div className="grid grid-cols-2 gap-2">
            {game.mode === "training" && !waitForContinue && (
              <Button onClick={takeBack} disabled={!!busy || !lastPlayerPly}>
                <Undo2 className="size-4" aria-hidden /> Terugnemen
              </Button>
            )}
            <Button
              variant="danger"
              onClick={resign}
              className={game.mode === "training" && !waitForContinue ? "" : "col-span-2"}
            >
              <Flag className="size-4" aria-hidden /> Opgeven
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {showLabels && <div className="hidden lg:block">{feedback}</div>}
        <Card className="p-1.5 sm:p-3">
          <MoveList plies={game.plies} selected={selected} onSelect={selectPly} showLabels={showLabels} />
        </Card>
        {chatAllowed ? (
          <CoachChat
            key={`${game.id}-${chatPly?.ply ?? "live"}`}
            contextLabel={chatLabel}
            intro={chatPly ? CHAT_INTRO_MOVE : "Vraag naar het plan of waar je op moet letten in deze stelling."}
            buildFacts={(question) =>
              buildFacts({
                plies: game.plies,
                playerColor: game.playerColor,
                focusPly: chatPly?.ply ?? null,
                question,
              })
            }
            suggestions={
              chatPly
                ? chatPly.label && !["beste", "goed"].includes(chatPly.label)
                  ? ["Waarom was dit fout?", "Wat had ik moeten spelen?"]
                  : ["Waarom is dit een goede zet?", "Wat is het plan nu?"]
                : ["Wat is het plan in deze stelling?", "Waar moet ik op letten?"]
            }
          />
        ) : (
          <Card className="p-4 text-sm text-[var(--muted)]">
            In de partijmodus is de coach beschikbaar zodra de partij is afgelopen.
          </Card>
        )}
      </div>
    </div>
  );
}
