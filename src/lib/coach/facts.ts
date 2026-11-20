// Bouwt de CoachFacts uit engine-analyses. Werkt in browser én Node (testset).

import { Chess } from "chess.js";
import type { AnalysisResult, EngineLine } from "../chess/engine-core";
import { formatScore, winPercent, LABEL_TEXT, type Label } from "../chess/evaluation";
import { CATEGORY_TEXT, type Category } from "../chess/patterns";
import { formatLine, uciLineToSan } from "../chess/uci";
import type { FocusMoveFact, LineFact, PatternFact, WhatIfFact } from "./types";
import type { PatternStat } from "../db/repository";
import { describeLine, describeMove, hangingPieces } from "./describe";

export function lineFact(fen: string, line: EngineLine, maxPlies = 8): LineFact {
  const sanMoves = uciLineToSan(fen, line.pv, maxPlies);
  return { text: formatLine(fen, sanMoves), sanMoves, eval: formatScore(line.score) };
}

export function buildFocusFact(args: {
  fenBefore: string;
  san: string;
  label: Label;
  before: AnalysisResult; // analyse van fenBefore (bij voorkeur multipv 3)
  after: AnalysisResult; // analyse van de stelling na de zet
  category?: Category;
  categoryDetail?: string;
}): FocusMoveFact {
  const { fenBefore, san, before, after } = args;
  const chess = new Chess(fenBefore);
  const mover = chess.turn();
  const moveNumber = parseInt(fenBefore.split(" ")[5] ?? "1", 10);
  chess.move(san);
  const fenAfter = chess.fen();
  const opp = mover === "w" ? "b" : "w";
  const scoreBefore = before.lines[0]?.score ?? { cp: 0 };
  const scoreAfter = after.lines[0]?.score ?? { cp: 0 };

  const bestMoves = before.lines.slice(0, 3).map((l) => {
    const lf = lineFact(fenBefore, l);
    return { ...lf, san: lf.sanMoves[0] ?? "" };
  });
  const refutation = after.lines[0] ? lineFact(fenAfter, after.lines[0]) : undefined;

  // Inhoudelijke feiten in woorden, zodat de coach de stelling kan uitleggen zonder cijfers.
  const insights: string[] = [];
  const threatsBefore = hangingPieces(fenBefore, mover);
  if (threatsBefore.length) insights.push(`Vóór de zet stond al onder vuur: ${threatsBefore.join(", ")}.`);
  insights.push(`Gespeelde zet: ${describeMove(fenBefore, san)}.`);
  const hangingAfter = hangingPieces(fenAfter, mover);
  if (hangingAfter.length) insights.push(`Na de zet staat onder vuur: ${hangingAfter.join(", ")}.`);
  if (refutation?.sanMoves.length)
    insights.push(`Sterkste vervolg daarna: ${describeLine(fenAfter, refutation.sanMoves, 3).join("; ")}.`);
  const best = bestMoves[0];
  if (best?.san && best.san !== san) {
    insights.push(`Beste zet: ${describeMove(fenBefore, best.san)}.`);
    const bestLine = describeLine(fenBefore, best.sanMoves, 3).slice(1);
    if (bestLine.length) insights.push(`Met als vervolg: ${bestLine.join("; ")}.`);
    const c = new Chess(fenBefore);
    c.move(best.san);
    const oppHanging = hangingPieces(c.fen(), opp);
    if (oppHanging.length)
      insights.push(`Na de beste zet staat bij de tegenstander onder vuur: ${oppHanging.join(", ")}.`);
  }

  return {
    moveNumber,
    color: mover === "w" ? "wit" : "zwart",
    san,
    fenBefore,
    fenAfter,
    label: LABEL_TEXT[args.label],
    evalBefore: formatScore(scoreBefore),
    evalAfter: formatScore(scoreAfter),
    winChanceBefore: winPercent(scoreBefore, mover),
    winChanceAfter: winPercent(scoreAfter, mover),
    bestMoves,
    refutation,
    category: args.category ? CATEGORY_TEXT[args.category] : undefined,
    categoryDetail: args.categoryDetail,
    insights,
  };
}

export function whatIfFact(fen: string, san: string, analysisAfter: AnalysisResult): WhatIfFact {
  const c = new Chess(fen);
  const m = c.move(san);
  const fenAfter = c.fen();
  const line = analysisAfter.lines[0];
  const reply = line ? lineFact(fenAfter, line, 7) : { text: "", sanMoves: [], eval: "?" };
  const prefix = formatLine(fen, [m.san]);
  return {
    san: m.san,
    sanMoves: [m.san, ...reply.sanMoves],
    text: reply.text ? `${prefix} ${reply.text}` : prefix,
    eval: reply.eval,
  };
}

/** Vind SAN-zetten in een vraag die legaal zijn in de gegeven stelling. */
export function movesMentioned(question: string, fen: string): string[] {
  let legal: string[];
  try {
    legal = new Chess(fen).moves();
  } catch {
    return [];
  }
  const norm = (s: string) => s.replace(/[+#]/g, "").replace(/0/g, "O");
  // Nederlandse stukletters (K D T L P) omzetten naar Engels.
  const nlToEn = (s: string) =>
    s
      .replace(/^D/, "Q")
      .replace(/^T/, "R")
      .replace(/^L/, "B")
      .replace(/^P(?=[a-hx])/, "N");
  const found = new Set<string>();
  for (const tok of question.split(/[\s,;?!()]+/)) {
    const t = norm(tok.replace(/\.$/, ""));
    if (!t) continue;
    for (const cand of [t, nlToEn(t)]) {
      const hit = legal.find((m) => norm(m) === cand);
      if (hit) found.add(hit);
    }
  }
  return [...found].slice(0, 3);
}

export function patternFacts(stats: PatternStat[]): PatternFact[] {
  return stats.slice(0, 5).map((s) => ({ text: CATEGORY_TEXT[s.category], count: s.count, recent: s.recent }));
}
