"use client";

import { winPercent, type Score } from "@/lib/chess/evaluation";
import type { PlyRecord } from "@/lib/db/types";

/**
 * Laatste bekende evaluatie tot en met zet `upto` (index). Een zet van de speler die nog
 * beoordeeld wordt, heeft nog geen echte evaluatie: dan houden we de vorige aan.
 */
export function evalAt(plies: PlyRecord[], playerColor: "w" | "b", upto: number | null): Score | undefined {
  const last = upto ?? plies.length - 1;
  for (let i = last; i >= 0; i--) {
    const p = plies[i];
    if (p.book) {
      if (p.bookEval) return p.evalAfter;
      continue; // theoriezet zonder evaluatie: kijk verder terug
    }
    if (p.color !== playerColor || p.label) return p.evalAfter;
  }
  return undefined;
}

/** Winstkans als balk onder het bord: jouw kleur links, schuift mee na elke zet. */
export function EvalBar({ score, playerColor }: { score?: Score; playerColor: "w" | "b" }) {
  const pct = score ? winPercent(score, playerColor) : 50;
  // Wit en zwart als op het bord; een donkere rand houdt het witte deel zichtbaar op een lichte achtergrond.
  const mine = playerColor === "w" ? "#ffffff" : "#2a2927";
  const theirs = playerColor === "w" ? "#2a2927" : "#ffffff";
  const mate = score?.mate !== undefined ? Math.abs(score.mate) : null;
  const label = mate !== null ? `M${mate}` : `${Math.round(pct)}%`;

  return (
    <div
      className="flex items-center gap-2 px-1"
      role="meter"
      aria-label="Jouw winstkans"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={`Winstkans ${label}`}
    >
      <div
        className="relative h-3 flex-1 overflow-hidden rounded-full border border-[#8a8780]"
        style={{ background: theirs }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: mine }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#8a8780]" aria-hidden />
      </div>
      <span className="num w-10 text-right text-sm font-semibold">{label}</span>
    </div>
  );
}
