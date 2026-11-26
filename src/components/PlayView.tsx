"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Chessboard, type Arrow } from "react-chessboard";
import { ChevronLeft, ChevronRight, Flag, Lightbulb, LoaderCircle, Minus, Plus, Undo2 } from "lucide-react";
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
  survivedMoves,
} from "@/lib/client/game-flow";
import { analyse, buildFacts } from "@/lib/client/analysis";
import { CATEGORY_TEXT } from "@/lib/chess/patterns";
import { uciLineToSan, uciToMove } from "@/lib/chess/uci";
import { buildHints, type Hints } from "@/lib/training/hints";
import { PLAN_MOVES, SURVIVE_MOVES } from "@/lib/training/drills";
import { CoachChat } from "./CoachChat";
import { EvalBar, evalAt } from "./EvalBar";
import { HintButton, HintText, hintBoard } from "./Hint";
import { DrawButton, useArrowDrawing } from "./ArrowDrawing";
import { EvalGraph } from "./EvalGraph";
import { MoveFeedback } from "./MoveFeedback";
import { LABEL_STYLE, MoveList, moveNumber } from "./MoveList";
import { BOARD_STYLE, Button, IconButton, KEYS, Segmented, Switch, useKeyShortcuts } from "./ui";

const ELO_KEY = "schaakcoach.elo";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const plyName = (p: PlyRecord) => `${moveNumber(p)}${p.color === "w" ? "." : "..."} ${p.san}`;

/* ───────────────────────── Nieuwe partij ───────────────────────── */

function Setup({
  onStart,
  ongoing,
  onResume,
}: {
  onStart: (c: "w" | "b", elo: number, mode: GameMode, hints: boolean) => void;
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
  const [allowHints, setAllowHints] = useState(false);

  return (
    <div className="mx-auto max-w-lg space-y-8 pt-2 sm:pt-6">
      {ongoing && (
        <button
          onClick={onResume}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-[var(--accent-soft)] px-4 text-left"
        >
          <span>
            <span className="block font-semibold">Verder spelen</span>
            <span className="num block text-sm text-[var(--muted)]">
              {strengthName(ongoing)} · zet {Math.ceil(ongoing.plies.length / 2)}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </button>
      )}

      <h1 className="text-3xl font-bold tracking-tight">Nieuwe partij</h1>

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

      <div className="space-y-2">
        <p className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--muted)]">Tegenstander</span>
          <span className="num text-lg font-semibold">
            {elo}
            {elo < STOCKFISH_ELO_MIN && <span className="text-sm font-normal text-[var(--muted)]"> ≈</span>}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <IconButton
            label="50 Elo lager"
            onClick={() => setElo(Math.max(ELO_MIN, elo - 50))}
            disabled={elo <= ELO_MIN}
          >
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
            className="h-12 w-full sm:h-11"
          />
          <IconButton
            label="50 Elo hoger"
            onClick={() => setElo(Math.min(ELO_MAX, elo + 50))}
            disabled={elo >= ELO_MAX}
          >
            <Plus className="size-5" aria-hidden />
          </IconButton>
        </div>
      </div>

      <Segmented
        label="Modus"
        value={mode}
        onChange={setMode}
        options={[
          { value: "training", label: "Met hulp" },
          { value: "partij", label: "Zonder hulp" },
        ]}
      />
      {mode === "partij" && (
        <div className="-mt-6">
          <Switch checked={allowHints} onChange={setAllowHints}>
            <Lightbulb className="size-4 text-[var(--muted)]" aria-hidden />
            Hints toestaan
          </Switch>
        </div>
      )}

      <Button
        variant="primary"
        block
        className="min-h-14 text-base"
        onClick={() =>
          onStart(
            color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color,
            elo,
            mode,
            mode === "partij" && allowHints,
          )
        }
      >
        Start
      </Button>
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
  const errors = count("blunder") + count("fout") + count("onnauwkeurig");
  return (
    <section className="space-y-4 pb-2" aria-label="Uitslag">
      <div className="flex items-end justify-between gap-3">
        <h1 className={`text-3xl font-bold tracking-tight ${o === "gewonnen" ? "text-good" : ""}`}>
          {resultText(game)}
        </h1>
        {game.accuracy !== undefined && (
          <p className="num text-3xl font-bold" title="Nauwkeurigheid">
            {game.accuracy.toFixed(0)}%
          </p>
        )}
      </div>
      <p className="num flex flex-wrap gap-x-4 text-sm">
        {errors === 0 ? (
          <span className="text-good">Foutloos</span>
        ) : (
          <>
            {count("blunder") > 0 && <span className="text-blunder">{count("blunder")} ??</span>}
            {count("fout") > 0 && <span className="text-mistake">{count("fout")} ?</span>}
            {count("onnauwkeurig") > 0 && <span className="text-inaccuracy">{count("onnauwkeurig")} ?!</span>}
          </>
        )}
        {(game.hintsUsed ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[var(--muted)]">
            <Lightbulb className="size-3.5" aria-hidden />
            {game.hintsUsed} {game.hintsUsed === 1 ? "hint" : "hints"}
          </span>
        )}
      </p>
      <EvalGraph plies={game.plies} playerColor={game.playerColor} selected={selected} onSelect={onSelect} />
      {top.length > 0 && (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {top.map((m) => (
            <li key={m.ply}>
              <button
                onClick={() => onSelect(m.ply)}
                className="flex min-h-12 w-full items-center gap-3 px-1 text-left text-sm"
              >
                <span className={`w-6 shrink-0 font-bold ${LABEL_STYLE[m.label!].cls}`}>
                  {LABEL_STYLE[m.label!].icon}
                </span>
                <span className="san">{plyName(m)}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{CATEGORY_TEXT[m.category!]}</span>
                <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="primary" block className="min-h-14 text-base" onClick={onNew}>
        Nieuwe partij
      </Button>
    </section>
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
  // Hint voor de stelling na `at` halve zetten: idee → stuk → zet (op basis van de beste zet van Stockfish).
  const [hint, setHint] = useState<{ at: number; level: number; hints: Hints | null; loading: boolean }>({
    at: -1,
    level: 0,
    hints: null,
    loading: false,
  });
  // Eigen pijlen en ringen; horen bij de getoonde stelling en verdwijnen na een zet.
  const draw = useArrowDrawing(`${game?.id ?? ""}:${game?.plies.length ?? 0}:${selected ?? "live"}`);
  const [waitForContinue, setWaitForContinue] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null); // tik-om-te-zetten: gekozen stuk

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
    const chess = chessFromPlies(g.plies, g.startFen);
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
      // Oefensituatie: doel "promoveren" gehaald?
      if (g.goal === "promoveren" && updated.san.includes("=")) {
        g.result = g.playerColor === "w" ? "1-0" : "0-1";
        g.endReason = "doel";
        finalize(g);
      }
      const over = g.status === "afgelopen" || finishIfOver(g);
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

  async function start(color: "w" | "b", elo: number, mode: GameMode, hints = false) {
    if (ongoing) {
      // Een openstaande partij wordt afgesloten als je een nieuwe begint.
      await repo.saveGame({ ...ongoing, status: "afgelopen", result: "*", endReason: "afgebroken" });
    }
    const g = newGame(color, elo, mode, { hints });
    gameRef.current = g;
    setSelected(null);
    setMoveFrom(null);
    setWaitForContinue(false);
    await commit();
    if (color === "b") await runOpponent();
  }

  async function resume() {
    if (ongoing) await resumeGame(ongoing);
  }

  async function resumeGame(saved: GameRecord) {
    const g: GameRecord = { ...saved, plies: [...saved.plies] };
    gameRef.current = g;
    setOngoing(null);
    setSelected(null);
    await commit();
    const last = g.plies.at(-1);
    if (last && last.color === g.playerColor && !last.label && !last.book) await afterPlayerMove(last);
    else await runOpponent();
  }

  // Vanuit Oefenen: /?hervat=<id> opent die partij direct.
  const onOngoingLoaded = useEffectEvent((g: GameRecord | undefined) => {
    const wanted = new URLSearchParams(window.location.search).get("hervat");
    if (g && wanted === g.id) {
      window.history.replaceState(null, "", "/");
      void resumeGame(g);
    } else setOngoing(g ?? null);
  });
  useEffect(() => {
    repo.getOngoingGame().then(onOngoingLoaded);
  }, [repo]);

  function canMove(): boolean {
    const g = gameRef.current;
    if (!g || busy || waitForContinue || g.status !== "bezig" || selected !== null) return false;
    return chessFromPlies(g.plies, g.startFen).turn() === g.playerColor;
  }

  function onDrop(from: string, to: string | null): boolean {
    const g = gameRef.current;
    setMoveFrom(null);
    if (!g || !to || !canMove()) return false;
    const chess = chessFromPlies(g.plies, g.startFen);
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
    const chess = chessFromPlies(g.plies, g.startFen);
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
    g.pgn = chessFromPlies(g.plies, g.startFen).pgn();
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

  /** Volgende hint-stap. De eerste keer rekent Stockfish de beste zet uit (meestal al in de cache). */
  async function nextHint() {
    const g = gameRef.current;
    if (!g) return;
    const at = g.plies.length;
    const current = hint.at === at ? hint : { at, level: 0, hints: null, loading: false };
    if (current.level >= 3 || current.loading) return;
    if (current.hints) {
      setHint({ ...current, level: current.level + 1 });
      return;
    }
    setHint({ ...current, loading: true });
    const fen = chessFromPlies(g.plies, g.startFen).fen();
    const a = await analyse(fen, 3);
    if (gameRef.current !== g || g.plies.length !== at || !a.bestMove) {
      setHint({ at: -1, level: 0, hints: null, loading: false });
      return;
    }
    const san = uciLineToSan(fen, [a.bestMove], 1)[0];
    setHint({ at, level: 1, hints: buildHints(fen, san, a.lines[0]?.score), loading: false });
    g.hintsUsed = (g.hintsUsed ?? 0) + 1;
    await commit();
  }

  /** Eén zet terug of vooruit. Vooruit naar de laatste zet tijdens een lopende partij = terug naar live. */
  function step(d: number) {
    if (!game || !game.plies.length) return;
    const last = game.plies.length - 1;
    const next = Math.max(0, Math.min(last, (selected ?? last) + d));
    selectPly(game.status !== "afgelopen" && d > 0 && next === last && selected !== null ? null : next);
  }

  useKeyShortcuts((key) => {
    if (!game) return false;
    if (key === "ArrowLeft") {
      step(-1);
      return true;
    }
    if (key === "ArrowRight") {
      step(1);
      return true;
    }
    if (key === "Escape" && selected !== null && game.status !== "afgelopen") {
      selectPly(null);
      return true;
    }
    return false;
  });

  if (!game) return <Setup onStart={start} ongoing={ongoing} onResume={resume} />;

  const finished = game.status === "afgelopen";
  const reviewing = selected !== null;
  const showLabels = game.mode === "training" || finished;
  const lastPlayerPly = [...game.plies].reverse().find((p) => p.color === game.playerColor) ?? null;
  const focusPly = selected !== null ? game.plies[selected] : null;
  const playerToMove = !finished && chessFromPlies(game.plies, game.startFen).turn() === game.playerColor;
  const canInteract = playerToMove && !busy && !waitForContinue && !reviewing;
  const selection = canInteract ? moveFrom : null; // geen achtergebleven selectie buiten je beurt

  // Bord: live stelling, of bij een geselecteerde fout de stelling vóór de zet met pijlen.
  const focusIsMistake = !!focusPly?.label && !["beste", "goed"].includes(focusPly.label) && !!focusPly.bestUci;
  const showMistakeArrows = focusIsMistake;
  const arrows: Arrow[] = [];
  let boardFen = game.plies.at(-1)?.fenAfter ?? game.startFen ?? START_FEN;
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
  const hintActive = canInteract && hint.at === game.plies.length;
  const hintLevel = hintActive ? hint.level : 0;
  if (hintActive) {
    const marks = hintBoard(hint.hints, hintLevel);
    Object.assign(squareStyles, marks.squareStyles);
    arrows.push(...marks.arrows);
  }
  arrows.push(...draw.arrows);
  Object.assign(squareStyles, draw.squareStyles);
  if (selection) {
    squareStyles[selection] = { background: "rgba(47, 111, 79, 0.5)" };
    for (const m of chessFromPlies(game.plies, game.startFen).moves({ square: selection as never, verbose: true })) {
      squareStyles[m.to] = m.captured
        ? { background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)" };
    }
  }

  // Doel van een oefensituatie, kort achter de status.
  const goalText =
    game.goal === "plan"
      ? ` · nog ${Math.max(0, PLAN_MOVES - survivedMoves(game))} zetten`
      : game.goal === "remise"
      ? ` · houd nog ${Math.max(0, SURVIVE_MOVES - survivedMoves(game))} zetten vol`
      : game.goal === "mat"
        ? " · zet mat"
        : game.goal === "promoveren"
          ? " · promoveer"
          : "";

  // Status onder het bord: kort, altijd duidelijk wie aan zet is.
  const status = finished
    ? { text: resultText(game), spin: false }
    : reviewing
      ? { text: plyName(focusPly!), spin: false }
      : busy === "beoordelen"
        ? { text: "Stockfish rekent…", spin: true }
        : busy === "computer"
          ? { text: "Computer denkt…", spin: true }
          : waitForContinue
            ? { text: "Pauze", spin: false }
            : playerToMove
              ? { text: `Jij aan zet${goalText}`, spin: false }
              : { text: "Computer aan zet", spin: false };

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

  // Beoordeling: geselecteerde zet van jou, anders je laatste zet.
  const feedbackPly = focusPly
    ? focusPly.color === game.playerColor
      ? focusPly
      : null
    : finished
      ? null
      : lastPlayerPly;
  const prevEval = feedbackPly ? game.plies[feedbackPly.ply - 1]?.evalAfter : undefined;
  const feedback = (
    <MoveFeedback ply={feedbackPly} previousEval={prevEval} actions={reviewing ? undefined : pauseActions} />
  );

  const chatAllowed = game.mode === "training" || finished;
  const chatPly = focusPly ?? (lastPlayerPly?.label ? lastPlayerPly : null);
  const isBad = !!chatPly?.label && !["beste", "goed"].includes(chatPly.label);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-8">
      <div className="space-y-4">
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
          <div className="board-touch aspect-square w-full max-w-[560px] overflow-hidden rounded-lg">
            <Chessboard
              options={{
                id: "speelbord",
                position: boardFen,
                boardOrientation: game.playerColor === "w" ? "white" : "black",
                onPieceDrop: ({ sourceSquare, targetSquare }) => onDrop(sourceSquare, targetSquare),
                onPieceDrag: () => setMoveFrom(null),
                onSquareClick: ({ square }) => {
                  if (!draw.tap(square)) onSquareTap(square);
                },
                allowDragging: canInteract && !draw.on,
                squareStyles,
                arrows,
                allowDrawingArrows: true, // computer: rechtermuisknop slepen
                ...BOARD_STYLE,
              }}
            />
          </div>
          <EvalBar score={evalAt(game.plies, game.playerColor, selected)} playerColor={game.playerColor} />
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Vorige zet"
              shortcut={KEYS.prev}
              variant="ghost"
              onClick={() => step(-1)}
              disabled={!game.plies.length || selected === 0}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <IconButton
              label="Volgende zet"
              shortcut={KEYS.next}
              variant="ghost"
              onClick={() => step(1)}
              disabled={selected === null || selected === game.plies.length - 1}
            >
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
            <p className="flex min-w-24 flex-1 items-center gap-2 pl-1 text-sm" role="status" aria-live="polite">
              {status.spin && <LoaderCircle className="size-4 shrink-0 animate-spin text-[var(--muted)]" aria-hidden />}
              <span className="truncate">{draw.on ? "Tik twee velden voor een pijl" : status.text}</span>
            </p>
            {reviewing && !finished && (
              <Button
                variant="primary"
                onClick={() => selectPly(null)}
                title="Terug naar de partij (Esc)"
                aria-keyshortcuts="Escape"
              >
                Live
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1">
              <DrawButton on={draw.on} onClick={draw.toggle} />
              {!finished && !reviewing && (
                <>
                  {(game.mode === "training" || game.hints) && (
                    <HintButton
                      level={hintLevel}
                      onClick={nextHint}
                      disabled={!canInteract}
                      busy={hint.loading && hint.at === game.plies.length}
                    />
                  )}
                  {game.mode === "training" && !waitForContinue && (
                    <IconButton
                      label="Zet terugnemen"
                      variant="ghost"
                      onClick={takeBack}
                      disabled={!!busy || !lastPlayerPly}
                    >
                      <Undo2 className="size-5" aria-hidden />
                    </IconButton>
                  )}
                  <IconButton label="Opgeven" variant="ghost" onClick={resign} className="text-[var(--muted)]">
                    <Flag className="size-5" aria-hidden />
                  </IconButton>
                </>
              )}
            </div>
          </div>
        </div>

        {hintActive && <HintText hints={hint.hints} level={hintLevel} />}

        {/* Telefoon: beoordeling direct onder het bord, met de pauzeknoppen erin. */}
        {showLabels && feedbackPly?.label && <div className="lg:hidden">{feedback}</div>}
      </div>

      <div className="space-y-4">
        {showLabels && feedbackPly?.label && <div className="hidden lg:block">{feedback}</div>}
        <div className="border-y border-[var(--border)] py-1">
          <MoveList plies={game.plies} selected={selected} onSelect={selectPly} showLabels={showLabels} />
        </div>
        {chatAllowed && (
          <CoachChat
            key={`${game.id}-${chatPly?.ply ?? "live"}`}
            placeholder={chatPly ? `Vraag iets over ${plyName(chatPly)}` : "Vraag de coach"}
            buildFacts={(question) =>
              buildFacts({
                plies: game.plies,
                startFen: game.startFen,
                playerColor: game.playerColor,
                focusPly: chatPly?.ply ?? null,
                question,
              })
            }
            suggestions={
              chatPly
                ? isBad
                  ? ["Waarom fout?", "Wat was beter?"]
                  : ["Waarom goed?", "Wat nu?"]
                : ["Wat is het plan?"]
            }
          />
        )}
      </div>
    </div>
  );
}
