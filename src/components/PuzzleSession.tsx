"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, type Arrow } from "react-chessboard";
import { ArrowLeft, Check, ChevronRight, LoaderCircle, RotateCcw, X } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import { analyse } from "@/lib/client/analysis";
import { classify } from "@/lib/chess/evaluation";
import { uciToMove } from "@/lib/chess/uci";
import { buildHints } from "@/lib/training/hints";
import { loadPuzzleRating, updatePuzzleRating, type PuzzleItem } from "@/lib/training/puzzles";
import { DrawButton, useArrowDrawing } from "./ArrowDrawing";
import { HintButton, HintText, hintBoard } from "./Hint";
import { BOARD_STYLE, Button, IconButton, KEYS, useKeyShortcuts } from "./ui";

type Phase = "laden" | "start" | "zet" | "tegenstander" | "controle" | "opgelost";

interface Result {
  key: string;
  correct: boolean;
}

/**
 * "Vind de zet": een reeks opgaven (puzzels of eigen fouten). Bij een puzzel speelt de tegenstander
 * eerst zijn zet; daarna zoek jij de oplossing. Een foute zet mag je opnieuw proberen, maar de opgave
 * telt dan als niet goed en komt sneller terug (gespreide herhaling).
 */
export function PuzzleSession({
  title,
  load,
  onExit,
}: {
  title: string;
  load: () => Promise<PuzzleItem[]>;
  onExit: () => void;
}) {
  const [items, setItems] = useState<PuzzleItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [moves, setMoves] = useState<string[]>([]); // gespeelde zetten vanaf startFen (UCI)
  const [phase, setPhase] = useState<Phase>("laden");
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "goed" | "fout" | "neutraal" } | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [rating, setRating] = useState(() => loadPuzzleRating());
  const [startRating, setStartRating] = useState(rating);
  const [hintLevel, setHintLevel] = useState(0);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const item = items?.[index];
  const offset = item?.setupMove ? 1 : 0; // aantal zetten vóór de opgave
  const step = moves.length - offset; // positie in de oplossing
  const chess = useMemo(() => {
    const c = new Chess(item?.startFen);
    for (const m of moves) c.move(uciToMove(m));
    return c;
  }, [item, moves]);
  const side = useMemo(() => {
    if (!item) return "w" as const;
    const c = new Chess(item.startFen);
    if (item.setupMove) c.move(uciToMove(item.setupMove));
    return c.turn();
  }, [item]);
  const draw = useArrowDrawing(`${round}:${index}:${moves.length}`);

  // Opgaven laden (bij start en bij "Nog een ronde").
  useEffect(() => {
    let alive = true;
    load().then((list) => {
      if (!alive) return;
      setItems(list);
      setIndex(0);
      setResults([]);
      setPhase("start");
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen opnieuw bij een nieuwe ronde
  }, [round]);

  // Begin van een opgave: eventueel eerst de zet van de tegenstander spelen.
  useEffect(() => {
    if (phase !== "start" || !item) return;
    const t = setTimeout(
      () => {
        setMoves(item.setupMove ? [item.setupMove] : []);
        setPhase("zet");
      },
      item.setupMove ? 600 : 0,
    );
    return () => clearTimeout(t);
  }, [phase, item]);

  function begin(i: number) {
    setIndex(i);
    setMoves([]);
    setFailed(false);
    setMessage(null);
    setHintLevel(0);
    setMoveFrom(null);
    setPhase("start");
  }

  async function finish(solvedClean: boolean, text: string) {
    if (!item) return;
    setPhase("opgelost");
    setMessage({ text, tone: solvedClean ? "goed" : "neutraal" });
    setResults((r) => [...r, { key: item.key, correct: solvedClean }]);
    await getRepository().recordReview(item.key, item.kind, solvedClean, item.themes);
    if (item.kind === "puzzel" && item.rating) setRating((r) => updatePuzzleRating(r, item.rating!, solvedClean));
  }

  function tryMove(from: string, to: string): boolean {
    setMoveFrom(null);
    if (phase !== "zet" || !item) return false;
    const fenBefore = chess.fen();
    const probe = new Chess(fenBefore);
    let m;
    try {
      m = probe.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    const expected = item.solution[step];
    const correct = m.lan === expected || probe.isCheckmate();

    if (correct) {
      const next = [...moves, m.lan];
      setMoves(next);
      setHintLevel(0);
      if (step + 1 >= item.solution.length || probe.isCheckmate()) {
        void finish(!failed, failed ? "Opgelost, met hulp." : "Goed!");
      } else {
        setMessage({ text: "Goed, ga door.", tone: "goed" });
        setPhase("tegenstander");
        setTimeout(() => {
          setMoves([...next, item.solution[step + 1]]);
          setPhase("zet");
        }, 450);
      }
      return true;
    }

    if (item.acceptAlternatives && step === 0) {
      // Eigen fout: een andere zet die even sterk is, rekenen we ook goed.
      setPhase("controle");
      Promise.all([analyse(fenBefore, 1), analyse(probe.fen(), 1)]).then(([b, a]) => {
        const { drop } = classify(b.lines[0]?.score ?? { cp: 0 }, a.lines[0]?.score ?? { cp: 0 }, side, false);
        if (drop < 0.05) {
          setMoves([...moves, m.lan]);
          void finish(!failed, failed ? "Opgelost, met hulp." : `Goed! ${m.san} is net zo sterk.`);
        } else {
          setFailed(true);
          setMessage({ text: `${m.san} is niet de beste zet. Probeer het nog eens.`, tone: "fout" });
          setPhase("zet");
        }
      });
      return false;
    }

    setFailed(true);
    setMessage({ text: `${m.san} is niet de oplossing. Probeer het nog eens.`, tone: "fout" });
    return false;
  }

  function tap(square: string) {
    if (draw.tap(square)) return;
    if (phase !== "zet") return;
    if (moveFrom && chess.moves({ square: moveFrom as never, verbose: true }).some((x) => x.to === square)) {
      tryMove(moveFrom, square);
      return;
    }
    const p = chess.get(square as never);
    setMoveFrom(p && p.color === side && square !== moveFrom ? square : null);
  }

  useKeyShortcuts((key) => {
    if (key === "Escape") {
      onExit();
      return true;
    }
    return false;
  });

  /* ───── weergave ───── */

  if (!items || phase === "laden")
    return (
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Opgaven laden…
      </div>
    );

  const header = (
    <div className="flex items-center gap-1">
      <IconButton label="Terug naar oefeningen" shortcut={KEYS.back} variant="ghost" onClick={onExit}>
        <ArrowLeft className="size-5" aria-hidden />
      </IconButton>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {items.length > 0 && (
          <p className="num text-sm text-[var(--muted)]">
            {Math.min(index + 1, items.length)} van {items.length}
            {item?.kind === "puzzel" && <> · puzzelrating {rating}</>}
          </p>
        )}
      </div>
    </div>
  );

  if (items.length === 0)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {header}
        <p className="text-[var(--muted)]">Niets te herhalen op dit moment. Kom later terug.</p>
      </div>
    );

  // Klaar met de ronde: samenvatting
  if (index >= items.length) {
    const goed = results.filter((r) => r.correct).length;
    const diff = rating - startRating;
    return (
      <div className="mx-auto max-w-xl space-y-6">
        {header}
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold tracking-tight">
            {goed} van {results.length} goed
          </p>
          {items.some((i) => i.kind === "puzzel") && (
            <p className={`num text-lg font-semibold ${diff > 0 ? "text-good" : diff < 0 ? "text-blunder" : ""}`}>
              {rating} ({diff >= 0 ? "+" : ""}
              {diff})
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onExit}>Terug</Button>
          <Button
            variant="primary"
            onClick={() => {
              setStartRating(rating);
              setItems(null);
              setPhase("laden");
              setRound((r) => r + 1);
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Nog een ronde
          </Button>
        </div>
      </div>
    );
  }

  const solutionSan = (() => {
    if (!item || phase !== "zet") return null;
    try {
      return new Chess(chess.fen()).move(uciToMove(item.solution[step])).san;
    } catch {
      return null;
    }
  })();
  const hints = solutionSan ? buildHints(chess.fen(), solutionSan) : null;
  const marks = hintBoard(hints, hintLevel);

  const arrows: Arrow[] = [...marks.arrows, ...draw.arrows];
  const squareStyles: Record<string, React.CSSProperties> = {};
  const lastUci = moves.at(-1);
  if (lastUci) {
    const lm = uciToMove(lastUci);
    squareStyles[lm.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[lm.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  Object.assign(squareStyles, marks.squareStyles, draw.squareStyles);
  if (moveFrom) {
    squareStyles[moveFrom] = { background: "rgba(47, 111, 79, 0.5)" };
    for (const x of chess.moves({ square: moveFrom as never, verbose: true }))
      squareStyles[x.to] = x.captured
        ? { background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)" };
  }

  const status =
    phase === "opgelost"
      ? null
      : phase === "controle"
        ? "Stockfish kijkt mee…"
        : phase === "zet"
          ? `${side === "w" ? "Wit" : "Zwart"} aan zet: vind de beste zet`
          : "Tegenstander…";
  const tone =
    message?.tone === "goed" ? "text-good" : message?.tone === "fout" ? "text-mistake" : "text-[var(--muted)]";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">{header}</div>
          {phase !== "opgelost" && (
            <HintButton
              level={hintLevel}
              onClick={() => {
                if (phase !== "zet" || hintLevel >= 3) return;
                setFailed(true); // met hint telt de opgave niet als goed
                setHintLevel(hintLevel + 1);
              }}
              disabled={phase !== "zet"}
              costs
            />
          )}
        </div>
        <div className="board-touch aspect-square w-full max-w-[560px] overflow-hidden rounded-lg">
          <Chessboard
            key={`${round}:${index}`}
            options={{
              id: "puzzelbord",
              position: chess.fen(),
              boardOrientation: side === "w" ? "white" : "black",
              onPieceDrop: ({ sourceSquare, targetSquare }) =>
                targetSquare ? tryMove(sourceSquare, targetSquare) : false,
              onPieceDrag: () => setMoveFrom(null),
              onSquareClick: ({ square }) => tap(square),
              allowDragging: phase === "zet" && !draw.on,
              allowDrawingArrows: true,
              arrows,
              squareStyles,
              ...BOARD_STYLE,
            }}
          />
        </div>
        <div className="flex min-h-12 items-center gap-2 px-1">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" role="status" aria-live="polite">
            {phase === "controle" && <LoaderCircle className="size-4 animate-spin text-[var(--muted)]" aria-hidden />}
            {draw.on ? (
              <span>Tik twee velden voor een pijl</span>
            ) : message ? (
              <span className={`flex items-center gap-1.5 ${tone}`}>
                {message.tone === "goed" && <Check className="size-4" aria-hidden />}
                {message.tone === "fout" && <X className="size-4" aria-hidden />}
                {message.text}
              </span>
            ) : (
              <span>{status}</span>
            )}
          </p>
          <DrawButton on={draw.on} onClick={draw.toggle} />
        </div>
        <HintText hints={hints} level={hintLevel} />
        {failed && phase === "zet" && hintLevel < 3 && (
          <Button onClick={() => setHintLevel(3)}>Toon de oplossing</Button>
        )}
      </div>

      <div className="space-y-4">
        {phase === "opgelost" && (
          <section className="space-y-3" aria-label="Opgelost">
            {item?.context && <p className="text-sm text-[var(--muted)]">{item.context}</p>}
            {item?.lichessId && (
              <p className="text-xs text-[var(--muted)]">
                Puzzel van{" "}
                <a
                  href={`https://lichess.org/training/${item.lichessId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Lichess
                </a>
                {item.rating && <> · rating {item.rating}</>}
              </p>
            )}
            <Button variant="primary" block onClick={() => begin(index + 1)}>
              {index + 1 < items.length ? "Volgende" : "Bekijk resultaat"}{" "}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
