"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard";
import { getRepository } from "@/lib/db/dexie-repository";
import type { GameMode, GameRecord, PlyRecord } from "@/lib/db/types";
import {
  ELO_MAX,
  ELO_MIN,
  STOCKFISH_ELO_MIN,
  strengthName,
  applyMove,
  chessFromPlies,
  evaluatePlayerPly,
  finalize,
  finishIfOver,
  newGame,
  opponentMove,
  resultText,
} from "@/lib/client/game-flow";
import { analyse, buildFacts } from "@/lib/client/analysis";
import { CoachChat } from "./CoachChat";
import { MoveList } from "./MoveList";
import { MoveFeedback } from "./MoveFeedback";
import { EvalGraph } from "./EvalGraph";
import { CATEGORY_TEXT } from "@/lib/chess/patterns";
import { uciToMove } from "@/lib/chess/uci";

const ELO_KEY = "schaakcoach.elo";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function Setup({ onStart, ongoing, onResume }: {
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
  const opt = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-sm ${active ? "border-[var(--accent)] bg-[var(--accent)]/10 font-semibold" : "border-[var(--border)]"}`;

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
      <h1 className="text-2xl font-bold">Nieuwe partij</h1>
      {ongoing && (
        <div className="rounded-lg bg-[var(--accent)]/10 p-3 text-sm flex items-center justify-between gap-2">
          <span>Je hebt een partij in uitvoering ({ongoing.plies.length} halve zetten).</span>
          <button onClick={onResume} className="rounded-lg bg-[var(--accent)] text-white px-3 py-1.5">
            Verder spelen
          </button>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-1">Kleur</legend>
        <div className="flex gap-2">
          {(["w", "b", "random"] as const).map((c) => (
            <button key={c} onClick={() => setColor(c)} className={opt(color === c)}>
              {c === "w" ? "Wit" : c === "b" ? "Zwart" : "Willekeurig"}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-1 flex w-full justify-between">
          <span>Sterkte computer</span>
          <span className="font-mono font-semibold">Elo {elo}</span>
        </legend>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="50 Elo lager"
            onClick={() => setElo(Math.max(ELO_MIN, elo - 50))}
            className="rounded-lg border border-[var(--border)] w-11 h-11 text-xl shrink-0"
          >
            −
          </button>
          <input
            type="range"
            min={ELO_MIN}
            max={ELO_MAX}
            step={50}
            value={elo}
            onChange={(e) => setElo(Number(e.target.value))}
            aria-label="Elo van de computer"
            className="w-full h-11 accent-[var(--accent)]"
          />
          <button
            type="button"
            aria-label="50 Elo hoger"
            onClick={() => setElo(Math.min(ELO_MAX, elo + 50))}
            className="rounded-lg border border-[var(--border)] w-11 h-11 text-xl shrink-0"
          >
            +
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {elo < STOCKFISH_ELO_MIN
            ? "Onder 1320 is de sterkte een schatting: Stockfish speelt dan af en toe een willekeurige zet."
            : "Stockfish' eigen Elo-stand. Gekalibreerd tegen andere engines, dus niet precies gelijk aan je online rating."}
        </p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-1">Modus</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => setMode("training")} className={`${opt(mode === "training")} text-left`}>
            <div>Training</div>
            <div className="text-xs font-normal text-[var(--muted)]">Beoordeling na elke zet, terugnemen mag</div>
          </button>
          <button onClick={() => setMode("partij")} className={`${opt(mode === "partij")} text-left`}>
            <div>Partij</div>
            <div className="text-xs font-normal text-[var(--muted)]">Zonder hulp; analyse na afloop</div>
          </button>
        </div>
      </fieldset>
      <button
        onClick={() => onStart(color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color, elo, mode)}
        className="w-full rounded-lg bg-[var(--accent)] text-white py-3 font-semibold"
      >
        Start partij
      </button>
    </div>
  );
}

export function PlayView() {
  const repo = useMemo(() => getRepository(), []);
  const gameRef = useRef<GameRecord | null>(null);
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
      if (g.mode === "training" && (updated.label === "fout" || updated.label === "blunder")) {
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
      if (g.mode === "training" && (updated.label === "fout" || updated.label === "blunder")) {
        setWaitForContinue(true); // even pauzeren zodat je kunt terugnemen of vragen stellen
        return;
      }
      await runOpponent();
    },
    [commit, runOpponent],
  );

  async function start(color: "w" | "b", elo: number, mode: GameMode) {
    if (ongoing) {
      // Een openstaande partij wordt afgesloten als je een nieuwe begint.
      await repo.saveGame({ ...ongoing, status: "afgelopen", result: "*" });
    }
    const g = newGame(color, elo, mode);
    gameRef.current = g;
    setSelected(null);
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
    await commit();
  }

  async function continueGame() {
    setWaitForContinue(false);
    await runOpponent();
  }

  async function resign() {
    const g = gameRef.current;
    if (!g || g.status !== "bezig") return;
    g.result = g.playerColor === "w" ? "0-1" : "1-0";
    finalize(g);
    setWaitForContinue(false);
    await commit();
  }

  if (!game) return <Setup onStart={start} ongoing={ongoing} onResume={resume} />;

  const finished = game.status === "afgelopen";
  const showLabels = game.mode === "training" || finished;
  const lastPlayerPly = [...game.plies].reverse().find((p) => p.color === game.playerColor) ?? null;
  const focusPly = selected !== null ? game.plies[selected] : null;
  const feedbackPly = focusPly ?? lastPlayerPly;

  // Bord: live stelling, of bij een geselecteerde fout de stelling vóór de zet met pijlen.
  const showMistakeArrows =
    focusPly && showBest && focusPly.bestUci && focusPly.label && !["beste", "goed"].includes(focusPly.label);
  let boardFen = game.plies.at(-1)?.fenAfter ?? START_FEN;
  const arrows: Arrow[] = [];
  if (focusPly) {
    boardFen = showMistakeArrows ? focusPly.fenBefore : focusPly.fenAfter;
    if (showMistakeArrows) {
      const played = uciToMove(focusPly.uci);
      const best = uciToMove(focusPly.bestUci!);
      arrows.push({ startSquare: played.from, endSquare: played.to, color: "rgba(220,38,38,0.8)" });
      arrows.push({ startSquare: best.from, endSquare: best.to, color: "rgba(22,163,74,0.85)" });
    }
  }

  const squareStyles: Record<string, React.CSSProperties> = {};
  const lastPly = game.plies.at(-1);
  if (!focusPly && lastPly) {
    const lm = uciToMove(lastPly.uci);
    squareStyles[lm.from] = { background: "rgba(255, 214, 0, 0.35)" };
    squareStyles[lm.to] = { background: "rgba(255, 214, 0, 0.45)" };
  }
  if (moveFrom && !focusPly) {
    squareStyles[moveFrom] = { background: "rgba(47, 111, 79, 0.5)" };
    const chess = chessFromPlies(game.plies);
    for (const m of chess.moves({ square: moveFrom as never, verbose: true })) {
      squareStyles[m.to] = m.captured
        ? { background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)" };
    }
  }
  const go = (d: number) => {
    if (!game.plies.length) return;
    const cur = selected ?? game.plies.length - 1;
    const next = Math.max(0, Math.min(game.plies.length - 1, cur + d));
    setSelected(!finished && next === game.plies.length - 1 && d > 0 && selected !== null ? null : next);
  };

  const chatAllowed = game.mode === "training" || finished;
  // De chat gaat over de geselecteerde zet, of anders over je laatste (beoordeelde) zet.
  const chatPly = focusPly ?? (lastPlayerPly?.label ? lastPlayerPly : null);
  const plyName = (p: PlyRecord) => `${p.fenBefore.split(" ")[5]}${p.color === "w" ? "." : "..."} ${p.san}`;
  const chatLabel = chatPly ? plyName(chatPly) : "Huidige stelling";
  const mistakes = game.plies.filter((p) => p.color === game.playerColor && p.category);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-6 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm px-1">
          <span>
            {game.playerColor === "w" ? "Jij: wit" : "Jij: zwart"} ·{" "}
            {strengthName(game)} · {game.mode === "training" ? "Training" : "Partij"}
          </span>
          <span className="text-[var(--muted)]">
            {busy === "computer" ? "Computer denkt na…" : busy === "beoordelen" ? "Beoordelen…" : ""}
          </span>
        </div>
        <div className="board-touch w-full max-w-[560px] aspect-square">
          <Chessboard
            options={{
              position: boardFen,
              boardOrientation: game.playerColor === "w" ? "white" : "black",
              onPieceDrop: ({ sourceSquare, targetSquare }) => onDrop(sourceSquare, targetSquare),
              onPieceDrag: () => setMoveFrom(null),
              onSquareClick: ({ square }) => onSquareTap(square),
              allowDragging: !finished && selected === null,
              squareStyles,
              arrows,
              allowDrawingArrows: false,
              id: "speelbord",
            }}
          />
        </div>
        {/* Op de telefoon staat de beoordeling direct onder het bord. */}
        {showLabels && (
          <div className="lg:hidden">
            <MoveFeedback ply={feedbackPly} pending={busy === "beoordelen" && !focusPly} compact />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => go(-1)}
            disabled={!game.plies.length}
            aria-label="Vorige zet"
            className="rounded-lg border border-[var(--border)] px-4 py-2 disabled:opacity-40"
          >
            ◀
          </button>
          <button
            onClick={() => go(1)}
            disabled={selected === null}
            aria-label="Volgende zet"
            className="rounded-lg border border-[var(--border)] px-4 py-2 disabled:opacity-40"
          >
            ▶
          </button>
          {focusPly ? (
            <>
              <span className="text-[var(--muted)]">Zet {plyName(focusPly)}</span>
              {!finished && (
                <button
                  onClick={() => setSelected(null)}
                  className="ml-auto rounded-lg bg-[var(--accent)] text-white px-3 py-2"
                >
                  Terug naar partij
                </button>
              )}
            </>
          ) : (
            <span className="text-[var(--muted)] text-xs">Tik op een stuk en dan op een veld, of sleep.</span>
          )}
        </div>
        {focusPly?.label && !["beste", "goed"].includes(focusPly.label) && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} />
            Pijlen: rood = gespeeld, groen = beter
          </label>
        )}
        {!finished && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {waitForContinue && (
              <button
                onClick={continueGame}
                className="col-span-2 rounded-lg bg-[var(--accent)] text-white px-4 py-3 sm:py-2 text-sm font-semibold"
              >
                Doorgaan zonder terugnemen
              </button>
            )}
            {game.mode === "training" && (
              <button
                onClick={takeBack}
                disabled={!!busy || !lastPlayerPly}
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 sm:py-2 text-sm disabled:opacity-50"
              >
                ↶ Terugnemen
              </button>
            )}
            <button
              onClick={() => confirm("Weet je zeker dat je wilt opgeven?") && resign()}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 sm:py-2 text-sm"
            >
              🏳 Opgeven
            </button>
          </div>
        )}
        {finished && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
            <p className="text-lg font-semibold">{resultText(game)}</p>
            {game.accuracy !== undefined && (
              <p className="text-sm">
                Nauwkeurigheid: <span className="font-semibold">{game.accuracy.toFixed(0)}%</span>
              </p>
            )}
            <EvalGraph plies={game.plies} playerColor={game.playerColor} selected={selected} onSelect={setSelected} />
            {mistakes.length > 0 && (
              <div className="text-sm">
                <p className="font-medium mb-1">Je fouten in deze partij (klik om te bekijken):</p>
                <ul className="space-y-1">
                  {[...mistakes]
                    .sort((a, b) => (b.drop ?? 0) - (a.drop ?? 0))
                    .slice(0, 5)
                    .map((m) => (
                      <li key={m.ply}>
                        <button onClick={() => setSelected(m.ply)} className="underline underline-offset-2">
                          {m.fenBefore.split(" ")[5]}
                          {m.color === "w" ? "." : "..."} {m.san}
                        </button>{" "}
                        <span className="text-[var(--muted)]">— {CATEGORY_TEXT[m.category!]}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => {
                gameRef.current = null;
                setGame(null);
                setOngoing(null);
              }}
              className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm"
            >
              Nieuwe partij
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {showLabels && (
          <div className="hidden lg:block">
            <MoveFeedback ply={feedbackPly} pending={busy === "beoordelen" && !focusPly} />
          </div>
        )}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-2 sm:p-3">
          <MoveList plies={game.plies} selected={selected} onSelect={setSelected} showLabels={showLabels} />
        </div>
        {chatAllowed ? (
          <CoachChat
            key={`${game.id}-${chatPly?.ply ?? "live"}`}
            contextLabel={chatLabel}
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
                ? ["Waarom is deze zet goed of slecht?", "Wat had ik moeten spelen?", "Wat is het idee achter de beste zet?"]
                : ["Wat is het plan in deze stelling?", "Waar moet ik op letten?"]
            }
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            In de partijmodus is de coach beschikbaar na afloop van de partij.
          </p>
        )}
      </div>
    </div>
  );
}
