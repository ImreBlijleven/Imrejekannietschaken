"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, type Arrow } from "react-chessboard";
import { ChevronRight } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { PatternStat } from "@/lib/db/repository";
import type { MistakeRecord } from "@/lib/db/types";
import { CATEGORY_TEXT, GENERIC_CATEGORIES, type Category } from "@/lib/chess/patterns";
import { LABEL_TEXT, classify } from "@/lib/chess/evaluation";
import { analyse } from "@/lib/client/analysis";
import { buildFocusFact, movesMentioned, patternFacts, whatIfFact } from "@/lib/coach/facts";
import type { CoachFacts } from "@/lib/coach/types";
import { CoachChat } from "./CoachChat";
import { LABEL_STYLE } from "./MoveList";
import { BOARD_STYLE, Skeleton, formatDate, useDelayed } from "./ui";

const MIN_GAMES = 5; // vanaf zoveel partijen zijn patronen enigszins betrouwbaar

async function factsForMistake(m: MistakeRecord, question: string, stats: PatternStat[]): Promise<CoachFacts> {
  const c = new Chess(m.fenBefore);
  c.move(m.san);
  const [before, after] = await Promise.all([analyse(m.fenBefore, 3), analyse(c.fen(), 1)]);
  const { label } = classify(
    before.lines[0].score,
    after.lines[0].score,
    m.fenBefore.split(" ")[1] as "w" | "b",
    false,
  );
  const whatIf = [];
  for (const san of movesMentioned(question, m.fenBefore).filter((s) => s !== m.san)) {
    const t = new Chess(m.fenBefore);
    t.move(san);
    whatIf.push(whatIfFact(m.fenBefore, san, await analyse(t.fen(), 1)));
  }
  return {
    playerColor: m.fenBefore.split(" ")[1] === "w" ? "wit" : "zwart",
    pgn: "",
    currentFen: c.fen(),
    focus: buildFocusFact({
      fenBefore: m.fenBefore,
      san: m.san,
      label,
      before,
      after,
      category: m.category,
      categoryDetail: m.detail,
    }),
    whatIf,
    patterns: patternFacts(stats),
  };
}

/** Pijlen voor gespeelde (rood) en betere (groen) zet. */
function mistakeArrows(m: MistakeRecord): Arrow[] {
  const arrows: Arrow[] = [];
  for (const [san, color] of [
    [m.san, "rgba(185,28,28,0.85)"],
    [m.bestSan, "rgba(4,120,87,0.9)"],
  ] as const) {
    try {
      const mv = new Chess(m.fenBefore).move(san);
      arrows.push({ startSquare: mv.from, endSquare: mv.to, color });
    } catch {
      /* onbekende zet: geen pijl */
    }
  }
  return arrows;
}

/** Eén categorie met teller en balk. Zonder `stat` toont dezelfde rij grijze blokken (laadstand). */
function CategoryRow({
  stat,
  max = 1,
  on = false,
  onSelect,
}: {
  stat?: PatternStat;
  max?: number;
  on?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={!stat}
      aria-pressed={stat ? on : undefined}
      className={`flex min-h-14 w-full items-center gap-3 px-1 py-3 text-left ${on ? "text-[var(--accent-ink)]" : ""}`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          {stat ? (
            <>
              <span className="font-medium">{CATEGORY_TEXT[stat.category]}</span>
              <span className="num shrink-0 text-[var(--muted)]">{stat.count}×</span>
            </>
          ) : (
            <>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-8" />
            </>
          )}
        </div>
        <div className="h-1 rounded-full bg-[var(--panel)]">
          {stat && (
            <div className="h-1 rounded-full bg-[var(--accent)]" style={{ width: `${(stat.count / max) * 100}%` }} />
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
    </button>
  );
}

export function PatternsView() {
  const repo = useMemo(() => getRepository(), []);
  const detailRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<PatternStat[] | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [selected, setSelected] = useState<MistakeRecord | null>(null);
  const [totalGames, setTotalGames] = useState(0);
  const showSkeleton = useDelayed(stats === null);

  useEffect(() => {
    repo.patternStats().then(setStats);
    repo.listGames().then((g) => setTotalGames(g.filter((x) => x.status === "afgelopen").length));
  }, [repo]);

  useEffect(() => {
    if (!category) return;
    repo.listMistakes({ category }).then((list) => {
      setMistakes(list);
      setSelected(list[0] ?? null);
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    });
  }, [repo, category]);

  const header = (
    <h1 className="flex items-baseline justify-between gap-3 text-3xl font-bold tracking-tight">
      Patronen
      {stats && stats.length > 0 && (
        <span className="num text-sm font-normal tracking-normal text-[var(--muted)]">
          {totalGames} {totalGames === 1 ? "partij" : "partijen"}
          {totalGames < MIN_GAMES && " · nog weinig data"}
        </span>
      )}
    </h1>
  );

  if (!stats)
    return (
      <div className="space-y-6">
        {header}
        {showSkeleton && (
          <ul
            aria-label="Categorieën laden"
            aria-busy="true"
            className="divide-y divide-[var(--border)] border-y border-[var(--border)]"
          >
            <li>
              <CategoryRow />
            </li>
            <li>
              <CategoryRow />
            </li>
            <li>
              <CategoryRow />
            </li>
          </ul>
        )}
      </div>
    );

  if (stats.length === 0)
    return (
      <div className="space-y-4">
        {header}
        <p className="text-[var(--muted)]">Nog geen fouten. Speel eerst een paar partijen.</p>
      </div>
    );

  const max = Math.max(...stats.map((s) => s.count));

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:gap-8">
        <ul
          aria-label="Categorieën"
          className="divide-y divide-[var(--border)] self-start border-y border-[var(--border)]"
        >
          {stats.map((s) => (
            <li key={s.category}>
              <CategoryRow stat={s} max={max} on={category === s.category} onSelect={() => setCategory(s.category)} />
            </li>
          ))}
        </ul>

        {category && (
          <div ref={detailRef} className="scroll-mt-4 space-y-3">
            <ul className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2">
              {mistakes.map((m) => {
                const on = selected?.id === m.id;
                const st = LABEL_STYLE[m.label];
                return (
                  <li key={m.id} className="shrink-0">
                    <button
                      onClick={() => setSelected(m)}
                      aria-pressed={on}
                      className={`flex min-h-12 items-center gap-1.5 rounded-full px-3.5 text-sm sm:min-h-11 ${
                        on ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--panel)]"
                      }`}
                    >
                      <span className="san">{m.san}</span>
                      <span className={`font-bold ${on ? "" : st.cls}`}>{st.icon}</span>
                      <span className={`num text-xs ${on ? "" : "text-[var(--muted)]"}`}>
                        {formatDate(m.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selected && (
              <>
                <div className="board-touch aspect-square w-full max-w-[440px] overflow-hidden rounded-lg">
                  <Chessboard
                    options={{
                      id: "patroonbord",
                      position: selected.fenBefore,
                      boardOrientation: selected.fenBefore.split(" ")[1] === "w" ? "white" : "black",
                      allowDragging: false,
                      arrows: mistakeArrows(selected),
                      ...BOARD_STYLE,
                    }}
                  />
                </div>
                <p className="px-1 text-sm text-[var(--muted)]">
                  <span className={`font-semibold ${LABEL_STYLE[selected.label].cls}`}>
                    {LABEL_TEXT[selected.label]}
                  </span>{" "}
                  · beter: <span className="san text-[var(--fg)]">{selected.bestSan}</span>
                  {selected.detail && !GENERIC_CATEGORIES.includes(selected.category) && <> · {selected.detail}</>}
                </p>
                <CoachChat
                  key={selected.id}
                  placeholder={`Vraag iets over ${selected.san}`}
                  buildFacts={(q) => factsForMistake(selected, q, stats)}
                  suggestions={["Waarom fout?", "Hoe herken ik dit?"]}
                />
              </>
            )}
          </div>
        )}
      </div>

      {!category && (
        <CoachChat
          key="algemeen"
          placeholder="Vraag iets over je patronen"
          buildFacts={async () => ({
            playerColor: "wit",
            pgn: "",
            currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            whatIf: [],
            patterns: patternFacts(stats),
          })}
          suggestions={["Wat zijn mijn zwakke punten?", "Waar moet ik op oefenen?"]}
        />
      )}
    </div>
  );
}
