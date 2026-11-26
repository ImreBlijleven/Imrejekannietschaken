"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard, type Arrow } from "react-chessboard";
import { ArrowLeft, ChevronRight, Flame, LoaderCircle, RotateCcw, Star, Swords } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { DrillRecord } from "@/lib/db/types";
import {
  OPENINGS,
  PLANS,
  PLAN_MOVES,
  TRAPS,
  POSITIONS,
  currentVariation,
  firstMoves,
  openingName,
  type OpeningDrill,
  type PositionDrill,
  type Side,
} from "@/lib/training/drills";
import { bookMoves, lineLength, pickBookMove } from "@/lib/training/tree";
import { analyse, buildFacts } from "@/lib/client/analysis";
import { classify, winPercent } from "@/lib/chess/evaluation";
import { ELO_MAX, ELO_MIN, newGame } from "@/lib/client/game-flow";
import { CoachChat } from "./CoachChat";
import { PuzzleSession } from "./PuzzleSession";
import { markTrainedToday, trainingStreak } from "@/lib/training/streak";
import {
  THEME_NAMES,
  THEMES_FOR_PATTERN,
  dueMistakeCount,
  loadPuzzleRating,
  loadPuzzles,
  pickDaily,
  pickMistakes,
  pickPuzzles,
  type PuzzleItem,
} from "@/lib/training/puzzles";
import { HintButton, HintText, hintBoard } from "./Hint";
import { DrawButton, useArrowDrawing } from "./ArrowDrawing";
import { buildHints } from "@/lib/training/hints";
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
    // Middenspel-plan: winstkans bij de start onthouden als maatstaf.
    if (from?.goal === "plan") game.goalBaseline = winPercent(last.evalAfter, side);
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

type Feedback = { kind: "ok" | "ook" | "fout"; text: string; arrow?: { from: string; to: string } };

function OpeningDrillView({ drill, side, onExit }: { drill: OpeningDrill; side: Side; onExit: () => void }) {
  const router = useRouter();
  const [moves, setMoves] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hint, setHint] = useState({ at: -1, level: 0 }); // hint-stap voor de zet op positie `at`
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
  const hintLevel = hint.at === moves.length ? hint.level : 0;
  const draw = useArrowDrawing(`${round}:${moves.length}`);
  const finished = expected.length === 0;
  const myTurn = !finished && chess.turn() === side;
  const total = lineLength(drill.lines, moves);
  const variation = currentVariation(drill, moves);

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

  /** Volgende hint-stap; de eerste stap per zet telt als fout. */
  function nextHint() {
    if (!myTurn || hintLevel >= 3) return;
    if (hintLevel === 0) setMistakes((n) => n + 1);
    setHint({ at: moves.length, level: hintLevel + 1 });
  }

  useKeyShortcuts((key) => {
    if (key === "Escape") {
      onExit();
      return true;
    }
    return false;
  });

  const hints = myTurn && expected[0] ? buildHints(chess.fen(), expected[0]) : null;
  const hintMarks = hintBoard(hints, hintLevel);
  const arrows: Arrow[] = feedback?.arrow
    ? [{ startSquare: feedback.arrow.from, endSquare: feedback.arrow.to, color: "rgba(4,120,87,0.9)" }]
    : hintMarks.arrows;
  arrows.push(...draw.arrows);
  const squareStyles: Record<string, React.CSSProperties> = {};
  const last = chess.history({ verbose: true }).at(-1);
  if (last) {
    squareStyles[last.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[last.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  Object.assign(squareStyles, hintMarks.squareStyles, draw.squareStyles);
  if (moveFrom) {
    squareStyles[moveFrom] = { background: "rgba(47, 111, 79, 0.5)" };
    for (const m of chess.moves({ square: moveFrom as never, verbose: true }))
      squareStyles[m.to] = m.captured
        ? { background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)" };
  }

  const status = checking ? "Stockfish kijkt mee…" : myTurn ? "Jouw zet" : "Tegenstander…";
  const feedbackColor =
    feedback?.kind === "ok" ? "text-good" : feedback?.kind === "fout" ? "text-mistake" : "text-[var(--muted)]";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <IconButton label="Terug naar oefeningen" shortcut={KEYS.back} variant="ghost" onClick={onExit}>
            <ArrowLeft className="size-5" aria-hidden />
          </IconButton>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{openingName(drill, side)}</h1>
            {/* Huidige variant: wordt specifieker naarmate de zetten de variant bepalen. */}
            <p
              key={variation ?? "-"}
              className="truncate text-sm text-[var(--accent-ink)] motion-safe:animate-[fadein_300ms_ease-out]"
              aria-live="polite"
            >
              {variation ?? "Beginstelling"}
            </p>
          </div>
          {!finished && (
            <div className="ml-auto">
              <HintButton level={hintLevel} onClick={nextHint} disabled={!myTurn || checking} costs />
            </div>
          )}
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
              onSquareClick: ({ square }) => {
                if (!draw.tap(square)) tap(square);
              },
              allowDragging: myTurn && !checking && !draw.on,
              allowDrawingArrows: true, // computer: rechtermuisknop slepen
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
        <div className="flex min-h-12 items-center gap-2 px-1">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" role="status" aria-live="polite">
            {checking && <LoaderCircle className="size-4 animate-spin text-[var(--muted)]" aria-hidden />}
            <span>{draw.on ? "Tik twee velden voor een pijl" : finished ? "" : status}</span>
            {feedback && !finished && !draw.on && (
              <span className={`truncate ${feedbackColor}`}>
                · {feedback.kind === "ok" ? `✓ ${feedback.text}` : feedback.text}
              </span>
            )}
          </p>
          <DrawButton on={draw.on} onClick={draw.toggle} />
        </div>
        {!finished && <HintText hints={hints} level={hintLevel} />}
      </div>

      <div className="space-y-4">
        {finished && (
          <section className="space-y-4" aria-label="Resultaat">
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-bold ${mistakes === 0 ? "text-good" : ""}`}>
                {mistakes > 0
                  ? `${mistakes} ${mistakes === 1 ? "fout" : "fouten"}`
                  : drill.trap
                    ? drill.trap.goal === "verdedigen"
                      ? "Val ontweken"
                      : "Val afgestraft"
                    : "Lijn gekend"}
              </p>
              {result && <Stars n={Math.min(3, result.streak)} />}
            </div>
            {variation && <p className="-mt-2 text-sm text-[var(--muted)]">{variation}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={restart}>
                <RotateCcw className="size-4" aria-hidden /> Opnieuw
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  startGameFrom(router, side, storedElo(), {
                    moves,
                    source: `oefenen:${drill.id}:${side}`,
                    opening: variation ?? openingName(drill, side),
                  })
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
  const [session, setSession] = useState<{
    title: string;
    load: () => Promise<PuzzleItem[]>;
    onComplete?: () => void;
  } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [dueMistakes, setDueMistakes] = useState<number | null>(null);
  const [forYou, setForYou] = useState<string[]>([]);
  // Puzzelrating (op de server: standaardwaarde, geen hydration-verschil).
  // Dagen op rij (per apparaat; op de server 0, geen hydration-verschil). Opnieuw lezen na elke sessie.
  const streakKey = useSyncExternalStore(
    () => () => {},
    () => {
      const st = trainingStreak();
      return `${st.days}:${st.today ? 1 : 0}`;
    },
    () => "0:0",
  );
  const [streakDays, streakToday] = streakKey.split(":").map(Number);
  const puzzleRating = useSyncExternalStore(
    () => () => {},
    () => loadPuzzleRating(),
    () => 1200,
  );

  useEffect(() => {
    if (active || session) return;
    const repo = getRepository();
    repo.listDrills().then((list) => setStats(new Map(list.map((d) => [d.id, d]))));
    Promise.all([repo.listMistakes(), repo.listReviews("fout"), repo.patternStats()]).then(
      ([mistakes, reviews, stats]) => {
        setDueMistakes(dueMistakeCount(mistakes, new Map(reviews.map((r) => [r.id, r]))));
        // Thema's die passen bij je twee vaakste foutpatronen.
        const themes = [...new Set(stats.slice(0, 2).flatMap((st) => THEMES_FOR_PATTERN[st.category] ?? []))];
        setForYou(themes.slice(0, 3));
      },
    );
  }, [active, session]);

  const setSide = (s: Side) => {
    setSideState(s);
    try {
      localStorage.setItem(SIDE_KEY, s);
    } catch {
      /* negeren */
    }
  };

  if (active)
    return <OpeningDrillView drill={active} side={active.trap?.side ?? side} onExit={() => setActive(null)} />;
  if (session)
    return (
      <PuzzleSession
        title={session.title}
        load={session.load}
        onComplete={session.onComplete}
        onExit={() => setSession(null)}
      />
    );

  /** Dagelijkse training: mix van herkansingen, herhalingen en nieuwe puzzels in je zwakke thema's. */
  function startDaily() {
    setSession({
      title: "Dagelijkse training",
      onComplete: markTrainedToday,
      load: async () => {
        const repo = getRepository();
        const [puzzles, mistakes, reviews] = await Promise.all([
          loadPuzzles(),
          repo.listMistakes(),
          repo.listReviews(),
        ]);
        return pickDaily({
          puzzles,
          mistakes,
          reviews: new Map(reviews.map((r) => [r.id, r])),
          rating: loadPuzzleRating(),
          weakThemes: forYou,
        });
      },
    });
  }

  /** Puzzelsessie in één of meer thema's, rond je puzzelrating. */
  function startThemes(title: string, themes: string[]) {
    setSession({
      title,
      load: async () => {
        const [all, reviews] = await Promise.all([loadPuzzles(), getRepository().listReviews("puzzel")]);
        return pickPuzzles(all, themes, loadPuzzleRating(), new Map(reviews.map((r) => [r.id, r])));
      },
    });
  }

  function startHerkansing() {
    setSession({
      title: "Herkansing",
      load: async () => {
        const repo = getRepository();
        const [mistakes, reviews] = await Promise.all([repo.listMistakes(), repo.listReviews("fout")]);
        return pickMistakes(mistakes, new Map(reviews.map((r) => [r.id, r])));
      },
    });
  }

  const tacticThemes = Object.keys(THEME_NAMES).filter((t) => t !== "defensiveMove");
  const row = "flex min-h-16 w-full items-center gap-3 px-1 py-2.5 text-left disabled:opacity-60";

  async function startPosition(p: PositionDrill) {
    setStarting(p.id);
    await startGameFrom(router, p.side, ELO_MAX, { startFen: p.fen, source: `oefenen:${p.id}`, goal: p.goal });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Oefenen</h1>

      <div className="space-y-2">
        <Button variant="primary" block className="min-h-14 text-base" onClick={startDaily}>
          Train 10 minuten
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-sm text-[var(--muted)]">
          <Flame className={`size-4 ${streakDays > 0 ? "text-[var(--inaccuracy)]" : ""}`} aria-hidden />
          {streakDays === 0
            ? "Begin vandaag een reeks"
            : `${streakDays} ${streakDays === 1 ? "dag" : "dagen"} op rij${streakToday ? "" : " · train vandaag om door te gaan"}`}
        </p>
      </div>

      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]" aria-label="Voor jou">
        <li>
          <button onClick={startHerkansing} disabled={!dueMistakes} className={row}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Herkansing</span>
              <span className="block text-sm text-[var(--muted)]">
                {dueMistakes === null
                  ? "Je eigen fouten"
                  : dueMistakes > 0
                    ? `${dueMistakes} ${dueMistakes === 1 ? "fout" : "fouten"} uit je partijen te herhalen`
                    : "Niets te herhalen"}
              </span>
            </span>
            {dueMistakes ? (
              <span className="num rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-[var(--on-accent)]">
                {dueMistakes}
              </span>
            ) : null}
            <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
          </button>
        </li>
        {forYou.length > 0 && (
          <li>
            <button onClick={() => startThemes("Voor jou", forYou)} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Voor jou</span>
                <span className="block truncate text-sm text-[var(--muted)]">
                  {forYou.map((t) => THEME_NAMES[t]).join(", ")} · past bij je foutpatronen
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
            </button>
          </li>
        )}
        <li>
          <button onClick={() => startThemes("Verdedigen", ["defensiveMove"])} className={row}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Verdedigen</span>
              <span className="block text-sm text-[var(--muted)]">Vind de enige zet die houdt</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
          </button>
        </li>
      </ul>

      <section className="space-y-2" aria-label="Tactiek">
        <h2 className="flex items-baseline justify-between text-sm text-[var(--muted)]">
          Tactiek
          <span className="num">rating {puzzleRating}</span>
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {tacticThemes.map((t) => (
            <button
              key={t}
              onClick={() => startThemes(THEME_NAMES[t], [t])}
              className="min-h-12 rounded-lg bg-[var(--panel)] px-3 text-left text-sm font-medium hover:bg-[var(--border)]"
            >
              {THEME_NAMES[t]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2" aria-label="Middenspel">
        <h2 className="text-sm text-[var(--muted)]">Middenspel</h2>
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {PLANS.map((p) => (
            <li key={p.id}>
              <button
                onClick={async () => {
                  setStarting(p.id);
                  await startGameFrom(router, p.side, ELO_MAX, {
                    moves: p.moves,
                    source: `oefenen:${p.id}`,
                    goal: "plan",
                    opening: p.name,
                  });
                }}
                disabled={starting !== null}
                className="flex min-h-16 w-full items-center gap-3 px-1 py-2.5 text-left disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block truncate text-sm text-[var(--muted)]">
                    Met {p.side === "w" ? "wit" : "zwart"} · speel {PLAN_MOVES} zetten volgens plan
                  </span>
                </span>
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

      <section className="space-y-2" aria-label="Valstrikken">
        <h2 className="text-sm text-[var(--muted)]">Valstrikken</h2>
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {TRAPS.map((t) => {
            const tSide = t.trap!.side;
            const rec = stats.get(`${t.id}:${tSide}`);
            return (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t)}
                  className="flex min-h-16 w-full items-center gap-3 px-1 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{openingName(t, tSide)}</span>
                    <span className="block truncate text-sm text-[var(--muted)]">
                      Met {tSide === "w" ? "wit" : "zwart"} ·{" "}
                      {t.trap!.goal === "verdedigen" ? "ontwijk de val" : "straf af"}
                    </span>
                  </span>
                  <Stars n={Math.min(3, rec?.streak ?? 0)} />
                  <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3" aria-label="Openingen">
        <h2 className="text-sm text-[var(--muted)]">Openingen</h2>
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
                <span className="text-sm text-[var(--muted)]">
                  {p.goal === "mat" ? "Zet mat" : p.goal === "remise" ? "Houd remise" : "Promoveer"}
                </span>
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
