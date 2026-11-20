"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getRepository } from "@/lib/db/dexie-repository";
import type { PatternStat } from "@/lib/db/repository";
import type { MistakeRecord } from "@/lib/db/types";
import { CATEGORY_TEXT, type Category } from "@/lib/chess/patterns";
import { LABEL_TEXT } from "@/lib/chess/evaluation";
import { analyse } from "@/lib/client/analysis";
import { buildFocusFact, movesMentioned, patternFacts, whatIfFact } from "@/lib/coach/facts";
import { classify } from "@/lib/chess/evaluation";
import type { CoachFacts } from "@/lib/coach/types";
import { CoachChat } from "./CoachChat";
import { formatLine } from "@/lib/chess/uci";

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

export function PatternsView() {
  const repo = useMemo(() => getRepository(), []);
  const [stats, setStats] = useState<PatternStat[] | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [selected, setSelected] = useState<MistakeRecord | null>(null);
  const [totalGames, setTotalGames] = useState(0);

  useEffect(() => {
    repo.patternStats().then(setStats);
    repo.listGames().then((g) => setTotalGames(g.length));
  }, [repo]);

  useEffect(() => {
    if (category) repo.listMistakes({ category }).then(setMistakes);
  }, [repo, category]);

  if (!stats) return <p className="text-[var(--muted)]">Laden…</p>;
  if (stats.length === 0)
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
        <h1 className="text-2xl font-bold mb-2">Jouw foutpatronen</h1>
        <p className="text-[var(--muted)]">
          Nog geen fouten opgeslagen. Speel een paar partijen; elke onnauwkeurigheid, fout of blunder wordt hier
          automatisch ingedeeld.
        </p>
      </div>
    );

  const max = Math.max(...stats.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jouw foutpatronen</h1>
        <p className="text-sm text-[var(--muted)]">
          Gebaseerd op {totalGames} partij{totalGames === 1 ? "" : "en"}. De indeling gebeurt door vaste regels met
          Stockfish, niet door het taalmodel.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {stats.map((s) => (
            <button
              key={s.category}
              onClick={() => {
                setCategory(s.category);
                setSelected(null);
              }}
              className={`w-full text-left rounded-lg border p-3 ${
                category === s.category ? "border-[var(--accent)]" : "border-[var(--border)]"
              } bg-[var(--panel)]`}
            >
              <div className="flex justify-between text-sm">
                <span className="font-medium">{CATEGORY_TEXT[s.category]}</span>
                <span className="text-[var(--muted)]">
                  {s.count}× · {s.recent}× in laatste 10 partijen
                </span>
              </div>
              <div className="mt-2 h-2 rounded bg-[var(--bg)]">
                <div className="h-2 rounded bg-[var(--accent)]" style={{ width: `${(s.count / max) * 100}%` }} />
              </div>
            </button>
          ))}
          <div className="pt-4">
            <CoachChat
              key="algemeen"
              contextLabel="Al je patronen"
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
        </div>

        <div className="space-y-3">
          {category && (
            <>
              <h2 className="font-semibold">{CATEGORY_TEXT[category]}: voorbeelden</h2>
              <ul className="space-y-1 text-sm max-h-56 overflow-y-auto">
                {mistakes.map((m) => {
                  const no = m.fenBefore.split(" ")[5];
                  const dots = m.fenBefore.split(" ")[1] === "w" ? "." : "...";
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setSelected(m)}
                        className={`w-full text-left rounded px-2 py-1 hover:bg-[var(--panel)] ${
                          selected?.id === m.id ? "bg-[var(--panel)] ring-1 ring-[var(--accent)]" : ""
                        }`}
                      >
                        <span className="font-mono">
                          {no}
                          {dots} {m.san}
                        </span>{" "}
                        <span className="text-[var(--muted)]">
                          ({LABEL_TEXT[m.label]}, beter: {m.bestSan}) · {new Date(m.createdAt).toLocaleDateString("nl-NL")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {selected && (
            <div className="space-y-3">
              <div className="max-w-[360px] aspect-square">
                <Chessboard
                  options={{
                    id: "patroonbord",
                    position: selected.fenBefore,
                    boardOrientation: selected.fenBefore.split(" ")[1] === "w" ? "white" : "black",
                    allowDragging: false,
                  }}
                />
              </div>
              <p className="text-sm">
                Je speelde <span className="font-mono font-semibold">{selected.san}</span>. {selected.detail}
              </p>
              {selected.bestLineSan.length > 0 && (
                <p className="text-sm">
                  Beste variant:{" "}
                  <span className="font-mono">{formatLine(selected.fenBefore, selected.bestLineSan.slice(0, 6))}</span>
                </p>
              )}
              <CoachChat
                key={selected.id}
                contextLabel={`${selected.san} (${CATEGORY_TEXT[selected.category]})`}
                buildFacts={(q) => factsForMistake(selected, q, stats)}
                suggestions={["Waarom was dit fout?", "Hoe herken ik dit de volgende keer?"]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
