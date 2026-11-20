"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, type Arrow } from "react-chessboard";
import { ChevronRight } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import type { PatternStat } from "@/lib/db/repository";
import type { MistakeRecord } from "@/lib/db/types";
import { CATEGORY_TEXT, type Category } from "@/lib/chess/patterns";
import { LABEL_TEXT, classify } from "@/lib/chess/evaluation";
import { analyse } from "@/lib/client/analysis";
import { buildFocusFact, movesMentioned, patternFacts, whatIfFact } from "@/lib/coach/facts";
import type { CoachFacts } from "@/lib/coach/types";
import { formatLine } from "@/lib/chess/uci";
import { CHAT_INTRO_MOVE, CoachChat } from "./CoachChat";
import { LABEL_STYLE } from "./MoveList";
import { BOARD_STYLE, Card, formatDate } from "./ui";

const MIN_GAMES = 5; // vanaf zoveel partijen zijn patronen enigszins betrouwbaar

async function factsForMistake(m: MistakeRecord, question: string, stats: PatternStat[]): Promise<CoachFacts> {
  const c = new Chess(m.fenBefore);
  c.move(m.san);
  const [before, after] = await Promise.all([analyse(m.fenBefore, 3), analyse(c.fen(), 1)]);
  const { label } = classify(before.lines[0].score, after.lines[0].score, m.fenBefore.split(" ")[1] as "w" | "b", false);
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

export function PatternsView() {
  const repo = useMemo(() => getRepository(), []);
  const detailRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<PatternStat[] | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [selected, setSelected] = useState<MistakeRecord | null>(null);
  const [totalGames, setTotalGames] = useState(0);

  useEffect(() => {
    repo.patternStats().then(setStats);
    repo.listGames().then((g) => setTotalGames(g.filter((x) => x.status === "afgelopen").length));
  }, [repo]);

  useEffect(() => {
    if (!category) return;
    repo.listMistakes({ category }).then((list) => {
      setMistakes(list);
      setSelected(list[0] ?? null);
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }, [repo, category]);

  if (!stats) return <p className="text-[var(--muted)]">Laden…</p>;

  const header = (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold">Jouw foutpatronen</h1>
      <p className="text-sm text-[var(--muted)]">
        Elke onnauwkeurigheid, fout en blunder wordt automatisch ingedeeld, met vaste regels en Stockfish (niet door de
        AI).
      </p>
    </div>
  );

  if (stats.length === 0)
    return (
      <div className="space-y-4">
        {header}
        <Card className="p-5 text-sm text-[var(--muted)]">
          Nog geen fouten opgeslagen. Speel een paar partijen; daarna zie je hier waar je de meeste punten verliest.
        </Card>
      </div>
    );

  const max = Math.max(...stats.map((s) => s.count));

  return (
    <div className="space-y-6">
      {header}

      {totalGames < MIN_GAMES && (
        <p className="rounded-xl bg-[var(--accent-soft)] p-4 text-sm">
          Gebaseerd op {totalGames} {totalGames === 1 ? "partij" : "partijen"}. Speel er nog {MIN_GAMES - totalGames}{" "}
          voor een betrouwbaarder beeld.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section aria-label="Categorieën" className="space-y-2">
          {stats.map((s) => {
            const on = category === s.category;
            return (
              <button
                key={s.category}
                onClick={() => setCategory(s.category)}
                aria-pressed={on}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border bg-[var(--panel)] px-4 py-3 text-left hover:bg-[var(--bg)] ${
                  on ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{CATEGORY_TEXT[s.category]}</span>
                    <span className="num shrink-0 text-[var(--muted)]">
                      {s.count}×{s.recent !== s.count && <> · {s.recent}× recent</>}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg)]">
                    <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${(s.count / max) * 100}%` }} />
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
              </button>
            );
          })}
        </section>

        <div ref={detailRef} className="scroll-mt-4 space-y-3">
          {!category && (
            <Card className="p-5 text-sm text-[var(--muted)]">Kies een categorie om voorbeelden uit je partijen te zien.</Card>
          )}
          {category && (
            <>
              <h2 className="font-semibold">{CATEGORY_TEXT[category]}: voorbeelden</h2>
              <ul className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
                {mistakes.map((m) => {
                  const on = selected?.id === m.id;
                  const st = LABEL_STYLE[m.label];
                  return (
                    <li key={m.id} className="shrink-0">
                      <button
                        onClick={() => setSelected(m)}
                        aria-pressed={on}
                        className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm ${
                          on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--panel)]"
                        }`}
                      >
                        <span className="san">{m.san}</span>
                        <span className={`font-bold ${st.cls}`}>{st.icon}</span>
                        <span className="text-xs text-[var(--muted)]">{formatDate(m.createdAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {selected && (
            <Card className="space-y-3 p-3 sm:p-4">
              <div className="board-touch mx-auto aspect-square w-full max-w-[400px] overflow-hidden rounded-lg">
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
              <p className="text-xs text-[var(--muted)]">
                <span className="text-blunder">Rood</span> = jouw zet, <span className="text-good">groen</span> = beter.
              </p>
              <p className="text-sm">
                <span className={`font-semibold ${LABEL_STYLE[selected.label].cls}`}>{LABEL_TEXT[selected.label]}:</span> je
                speelde <span className="san">{selected.san}</span>, beter was{" "}
                <span className="san">{selected.bestSan}</span>. {selected.detail}
              </p>
              {selected.bestLineSan.length > 0 && (
                <p className="text-sm text-[var(--muted)]">
                  Beste vervolg: <span className="san text-[var(--fg)]">{formatLine(selected.fenBefore, selected.bestLineSan.slice(0, 6))}</span>
                </p>
              )}
              <CoachChat
                key={selected.id}
                contextLabel={`${selected.san} · ${CATEGORY_TEXT[selected.category]}`}
                intro={CHAT_INTRO_MOVE}
                buildFacts={(q) => factsForMistake(selected, q, stats)}
                suggestions={["Waarom was dit fout?", "Hoe herken ik dit de volgende keer?"]}
              />
            </Card>
          )}
        </div>
      </div>

      <CoachChat
        key="algemeen"
        contextLabel="Al je patronen"
        intro="Vraag wat je zwakste punten zijn of waar je deze week op kunt oefenen. De coach gebruikt de tellingen hierboven."
        buildFacts={async () => ({
          playerColor: "wit",
          pgn: "",
          currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          whatIf: [],
          patterns: patternFacts(stats),
        })}
        suggestions={["Wat zijn mijn grootste zwakke punten?", "Waar moet ik deze week op oefenen?"]}
      />
    </div>
  );
}
