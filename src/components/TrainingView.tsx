"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard, type Arrow } from "react-chessboard";
import { ArrowLeft, ChevronRight, Lightbulb, LoaderCircle, RotateCcw, Star, Swords } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { DrillRecord } from "@/lib/db/types";
import {
  OPENINGS,
  POSITIONS,
  firstMoves,
  openingName,
  type OpeningDrill,
  type PositionDrill,
  type Side,
} from "@/lib/training/drills";
import { bookMoves, lineLength, pickBookMove } from "@/lib/training/tree";
import { analyse, buildFacts } from "@/lib/client/analysis";
import { classify } from "@/lib/chess/evaluation";
import { ELO_MAX, ELO_MIN, newGame } from "@/lib/client/game-flow";
import { CoachChat } from "./CoachChat";
import { BOARD_STYLE, Button, IconButton, KEYS, Segmented, useKeyShortcuts } from "./ui";

const SIDE_KEY = "schaakcoach.oefenkant";
const ELO_KEY = "schaakcoach.elo";

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} van 3 sterren`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          className={`size-4 ${i < n ? "fill-[var(--inaccuracy)] text-[var(--inaccuracy)]" : "text-[var(--border)]"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Start een partij vanuit een oefening en open die op het speelscherm. */
async function startGameFrom(
  router: ReturnType<typeof useRouter>,
  side: Side,
  elo: number,
  from: Parameters<typeof newGame>[3],
) {
  const repo = getRepository();
  const ongoing = await repo.getOngoingGame();
  if (ongoing) await repo.saveGame({ ...ongoing, status: "afgelopen", result: "*", endReason: "afgebroken" });
  const game = newGame(side, elo, "training", from);
  const last = game.plies.at(-1);
  if (last) {
    // Evaluatie van de eindstelling van de theorie, voor de winstkansbalk.
    last.evalAfter = (await analyse(last.fenAfter, 1)).lines[0]?.score ?? { cp: 0 };
    last.bookEval = true;
  }
  await repo.saveGame(game);
  router.push(`/?hervat=${game.id}`);
}

function storedElo(): number {
  try {
    const v = Number(localStorage.getItem(ELO_KEY));
    return v >= ELO_MIN && v <= ELO_MAX ? v : 1200;
  } catch {
    return 1200;
  }
}

/* ───────────────────────── Openingsoefening ───────────────────────── */

type Feedback = { kind: "ok" | "ook" | "fout" | "hint"; text: string; arrow?: { from: string; to: string } };

function OpeningDrillView({ drill, side, onExit }: { drill: OpeningDrill; side: Side; onExit: () => void }) {
  const router = useRouter();
  const [moves, setMoves] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [checking, setChecking] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [result, setResult] = useState<DrillRecord | null>(null);
  const [round, setRound] = useState(0);
  const saved = useRef(false);

  const chess = useMemo(() => {
    const c = new Chess();
    for (const m of moves) c.move(m);
    return c;
  }, [moves]);
  const expected = bookMoves(drill.lines, moves);
  const finished = expected.length === 0;
  const myTurn = !finished && chess.turn() === side;
  const total = lineLength(drill.lines, moves);

  // Tegenstander speelt een theoriezet (willekeurige variant).
  useEffect(() => {
    if (finished || chess.turn() === side) return;
    const t = setTimeout(() => {
      const m = pickBookMove(drill.lines, moves);
      if (m) setMoves((prev) => [...prev, m]);
    }, 450);
    return () => clearTimeout(t);
  }, [moves, finished, chess, side, drill.lines]);

  // Einde van de lijn: voortgang opslaan (één keer per ronde).
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    getRepository().recordDrill(drill.id, side, mistakes).then(setResult);
  }, [finished, drill.id, side, mistakes]);

  function restart() {
    saved.current = false;
    setMoves([]);
    setMistakes(0);
    setFeedback(null);
    setResult(null);
    setRound((r) => r + 1);
  }

  function arrowFor(san: string) {
    const m = new Chess(chess.fen()).move(san);
    return { from: m.from, to: m.to };
  }

  function tryMove(from: string, to: string): boolean {
    setMoveFrom(null);
    if (!myTurn || checking) return false;
    const fenBefore = chess.fen();
    const probe = new Chess(fenBefore);
    let san: string;
    try {
      san = probe.move({ from, to, promotion: "q" }).san;
    } catch {
      return false;
    }
    if (expected.includes(san)) {
      setFeedback({ kind: "ok", text: san });
      setMoves((prev) => [...prev, san]);
      return true;
    }
    // Geen theorie: laat Stockfish oordelen of de zet ook speelbaar is.
    const book = expected[0];
    setChecking(true);
    Promise.all([analyse(fenBefore, 1), analyse(probe.fen(), 1)]).then(([before, after]) => {
      const { drop } = classify(before.lines[0]?.score ?? { cp: 0 }, after.lines[0]?.score ?? { cp: 0 }, side, false);
      // Theorie leren: alleen een afwijking die vrijwel even sterk is telt als "kan ook".
      const fine = drop < 0.05;
      if (!fine) setMistakes((n) => n + 1);
      setFeedback({
        kind: fine ? "ook" : "fout",
        text: fine ? `${san} kan ook. Theorie: ${book}` : `${san} is niet goed. Theorie: ${book}`,
        arrow: arrowFor(book),
      });
      setChecking(false);
    });
    return false;
  }

  function tap(square: string) {
    if (!myTurn || checking) return;
    if (moveFrom && chess.moves({ square: moveFrom as never, verbose: true }).some((m) => m.to === square)) {
      tryMove(moveFrom, square);
      return;
    }
    const piece = chess.get(square as never);
    setMoveFrom(piece && piece.color === side && square !== moveFrom ? square : null);
  }

  function hint() {
    if (!myTurn) return;
    setMistakes((n) => n + 1);
    setFeedback({ kind: "hint", text: `Theorie: ${expected[0]}`, arrow: arrowFor(expected[0]) });
  }

  useKeyShortcuts((key) => {
    if (key === "Escape") {
      onExit();
      return true;
    }
    return false;
  });

  const arrows: Arrow[] = feedback?.arrow
    ? [{ startSquare: feedback.arrow.from, endSquare: feedback.arrow.to, color: "rgba(4,120,87,0.9)" }]
    : [];
  const squareStyles: Record<string, React.CSSProperties> = {};
  const last = chess.history({ verbose: true }).at(-1);
  if (last) {
    squareStyles[last.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[last.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  if (moveFrom) {
    squareStyles[moveFrom] = { background: "rgba(47, 111, 79, 0.5)" };
    for (const m of chess.moves({ square: moveFrom as never, verbose: true }))
      squareStyles[m.to] = m.captured
        ? { background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)" };
  }

  const status = checking
      ? "Stockfish kijkt mee…"
      : myTurn
        ? "Jouw zet"
        : "Tegenstander…";
  const feedbackColor =
    feedback?.kind === "ok" ? "text-good" : feedback?.kind === "fout" ? "text-mistake" : "text-[var(--muted)]";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <IconButton label="Terug naar oefeningen" shortcut={KEYS.back} variant="ghost" onClick={onExit}>
            <ArrowLeft className="size-5" aria-hidden />
          </IconButton>
          <h1 className="min-w-0 truncate text-lg font-semibold">{openingName(drill, side)}</h1>
        </div>
        <div className="board-touch aspect-square w-full max-w-[560px] overflow-hidden rounded-lg">
          <Chessboard
            key={round}
            options={{
              id: "oefenbord",
              position: chess.fen(),
              boardOrientation: side === "w" ? "white" : "black",
              onPieceDrop: ({ sourceSquare, targetSquare }) =>
                targetSquare ? tryMove(sourceSquare, targetSquare) : false,
              onPieceDrag: () => setMoveFrom(null),
              onSquareClick: ({ square }) => tap(square),
              allowDragging: myTurn && !checking,
              allowDrawingArrows: false,
              arrows,
              squareStyles,
              ...BOARD_STYLE,
            }}
          />
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--panel)]" aria-hidden>
          <div
            className="h-1 rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${(moves.length / total) * 100}%` }}
          />
        </div>
        <div className={`flex min-h-12 items-center gap-2 px-1 ${finished ? "hidden" : ""}`}>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" role="status" aria-live="polite">
            {checking && <LoaderCircle className="size-4 animate-spin text-[var(--muted)]" aria-hidden />}
            <span>{status}</span>
            {feedback && !finished && (
              <span className={`truncate ${feedbackColor}`}>
                · {feedback.kind === "ok" ? `✓ ${feedback.text}` : feedback.text}
              </span>
            )}
          </p>
          {!finished && (
            <IconButton label="Hint (telt als fout)" variant="ghost" onClick={hint} disabled={!myTurn || checking}>
              <Lightbulb className="size-5" aria-hidden />
            </IconButton>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {finished && (
          <section className="space-y-4" aria-label="Resultaat">
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-bold ${mistakes === 0 ? "text-good" : ""}`}>
                {mistakes === 0 ? "Lijn gekend" : `${mistakes} ${mistakes === 1 ? "fout" : "fouten"}`}
              </p>
              {result && <Stars n={Math.min(3, result.streak)} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={restart}>
                <RotateCcw className="size-4" aria-hidden /> Opnieuw
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  startGameFrom(router, side, storedElo(), { moves, source: `oefenen:${drill.id}:${side}` })
                }
              >
                <Swords className="size-4" aria-hidden /> Speel verder
              </Button>
            </div>
            <CoachChat
              key={`${round}-${moves.length}`}
              placeholder="Vraag naar het plan"
              buildFacts={(question) =>
                buildFacts({
                  plies: newGame(side, 1200, "training", { moves }).plies,
                  playerColor: side,
                  focusPly: null,
                  question,
                })
              }
              suggestions={["Wat is het plan?", "Waar moet ik op letten?"]}
            />
          </section>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Overzicht ───────────────────────── */

export function TrainingView() {
  const router = useRouter();
  // Laatst gekozen kleur (op de server: wit, zodat er geen hydration-verschil ontstaat).
  const storedSide = useSyncExternalStore<Side>(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(SIDE_KEY) === "b" ? "b" : "w";
      } catch {
        return "w";
      }
    },
    () => "w",
  );
  const [chosenSide, setSideState] = useState<Side | null>(null);
  const side = chosenSide ?? storedSide;
  const [stats, setStats] = useState<Map<string, DrillRecord>>(new Map());
  const [active, setActive] = useState<OpeningDrill | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (active) return;
    getRepository()
      .listDrills()
      .then((list) => setStats(new Map(list.map((d) => [d.id, d]))));
  }, [active]);

  const setSide = (s: Side) => {
    setSideState(s);
    try {
      localStorage.setItem(SIDE_KEY, s);
    } catch {
      /* negeren */
    }
  };

  if (active) return <OpeningDrillView drill={active} side={side} onExit={() => setActive(null)} />;

  async function startPosition(p: PositionDrill) {
    setStarting(p.id);
    await startGameFrom(router, p.side, ELO_MAX, { startFen: p.fen, source: `oefenen:${p.id}`, goal: p.goal });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Oefenen</h1>

      <section className="space-y-3" aria-label="Openingen">
        <Segmented
          label="Kleur"
          value={side}
          onChange={setSide}
          options={[
            { value: "w", label: "Met wit" },
            { value: "b", label: "Met zwart" },
          ]}
        />
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {OPENINGS.map((o) => {
            const rec = stats.get(`${o.id}:${side}`);
            return (
              <li key={o.id}>
                <button
                  onClick={() => setActive(o)}
                  className="flex min-h-16 w-full items-center gap-3 px-1 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{openingName(o, side)}</span>
                    <span className="san block truncate text-sm font-normal text-[var(--muted)]">{firstMoves(o)}</span>
                  </span>
                  <Stars n={Math.min(3, rec?.streak ?? 0)} />
                  <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2" aria-label="Situaties">
        <h2 className="text-sm text-[var(--muted)]">Eindspel</h2>
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {POSITIONS.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => startPosition(p)}
                disabled={starting !== null}
                className="flex min-h-14 w-full items-center gap-3 px-1 text-left disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 font-medium">{p.name}</span>
                <span className="text-sm text-[var(--muted)]">{p.goal === "mat" ? "Zet mat" : "Promoveer"}</span>
                {starting === p.id ? (
                  <LoaderCircle className="size-4 animate-spin text-[var(--muted)]" aria-hidden />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
