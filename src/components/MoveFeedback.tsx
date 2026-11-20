"use client";

import type { ReactNode } from "react";
import type { PlyRecord } from "@/lib/db/types";
import { LABEL_TEXT, winPercent, type Score } from "@/lib/chess/evaluation";
import { GENERIC_CATEGORIES } from "@/lib/chess/patterns";
import { LABEL_STYLE } from "./MoveList";

/** Beoordeling van één zet: label, winstkans voor → na, en bij een fout de betere zet. */
export function MoveFeedback({
  ply,
  previousEval,
  actions,
}: {
  ply: PlyRecord | null;
  previousEval?: Score; // fallback voor oude partijen zonder evalBefore
  actions?: ReactNode;
}) {
  if (!ply?.label) return null;
  const st = LABEL_STYLE[ply.label];
  const isMistake = ply.label === "onnauwkeurig" || ply.label === "fout" || ply.label === "blunder";
  const before = ply.evalBefore ?? previousEval;
  const winAfter = winPercent(ply.evalAfter, ply.color).toFixed(0);

  return (
    <div className="space-y-1.5 px-1" aria-live="polite">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="san text-lg">{ply.san}</span>
        <span className={`font-semibold ${st.cls}`}>
          {st.icon} {LABEL_TEXT[ply.label]}
        </span>
        <span className="num ml-auto text-sm text-[var(--muted)]">
          {before ? `${winPercent(before, ply.color).toFixed(0)}% → ` : ""}
          {winAfter}%
        </span>
      </p>
      {isMistake && ply.bestSan && (
        <p className="text-sm text-[var(--muted)]">
          Beter: <span className="san text-[var(--fg)]">{ply.bestSan}</span>
          {ply.detail && !(ply.category && GENERIC_CATEGORIES.includes(ply.category)) && <> · {ply.detail}</>}
        </p>
      )}
      {actions && <div className="grid grid-cols-2 gap-2 pt-1.5">{actions}</div>}
    </div>
  );
}
