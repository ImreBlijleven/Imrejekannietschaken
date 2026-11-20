"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { PlyRecord } from "@/lib/db/types";
import { LABEL_TEXT, toCp, winPercent, type Score } from "@/lib/chess/evaluation";
import { CATEGORY_TEXT } from "@/lib/chess/patterns";
import { LABEL_STYLE } from "./MoveList";

/** Evaluatie vanuit de speler: "+1,2" betekent altijd "jij staat beter". */
function forPlayer(score: Score, color: "w" | "b"): string {
  if (score.mate !== undefined) {
    const mine = color === "w" ? score.mate > 0 : score.mate < 0;
    return mine ? `jij geeft mat in ${Math.abs(score.mate)}` : `mat tegen jou in ${Math.abs(score.mate)}`;
  }
  const pawns = ((color === "w" ? 1 : -1) * toCp(score)) / 100;
  const txt = Math.abs(pawns).toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (Math.abs(pawns) < 0.3) return "gelijk";
  return pawns > 0 ? `+${txt} voor jou` : `−${txt} (tegenstander beter)`;
}

export function MoveFeedback({
  ply,
  previousEval,
  pending,
  actions,
}: {
  ply: PlyRecord | null;
  previousEval?: Score; // fallback voor oude partijen zonder evalBefore
  pending: boolean;
  actions?: ReactNode; // bv. "Terugnemen" / "Doorgaan" na een fout
}) {
  const box = "rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm";
  if (pending) {
    return (
      <div className={`${box} flex items-center gap-2 text-[var(--muted)]`} role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Stockfish beoordeelt je zet…
      </div>
    );
  }
  if (!ply || !ply.label) {
    return (
      <div className={`${box} text-[var(--muted)]`}>
        Doe een zet. Je ziet hier direct hoe goed hij was.
      </div>
    );
  }
  const st = LABEL_STYLE[ply.label];
  const isMistake = ply.label === "onnauwkeurig" || ply.label === "fout" || ply.label === "blunder";
  const before = ply.evalBefore ?? previousEval;
  const winBefore = before ? winPercent(before, ply.color) : undefined;
  const winAfter = winPercent(ply.evalAfter, ply.color);

  return (
    <div className={`${box} space-y-2`} role="status" aria-live="polite">
      <p className="flex flex-wrap items-baseline gap-x-2 text-base">
        <span className="san">{ply.san}</span>
        <span className={`font-bold ${st.cls}`}>
          {st.icon} {LABEL_TEXT[ply.label]}
        </span>
      </p>
      <p className="text-[var(--muted)]">
        {winBefore !== undefined ? (
          <>
            Winstkans <span className="num font-medium text-[var(--fg)]">{winBefore.toFixed(0)}%</span> →{" "}
            <span className="num font-medium text-[var(--fg)]">{winAfter.toFixed(0)}%</span>
          </>
        ) : (
          <>
            Winstkans <span className="num font-medium text-[var(--fg)]">{winAfter.toFixed(0)}%</span>
          </>
        )}
        <span aria-hidden> · </span>
        <span className="num">{forPlayer(ply.evalAfter, ply.color)}</span>
      </p>
      {isMistake && ply.bestSan && (
        <p>
          Beter was <span className="san">{ply.bestSan}</span>.
          {ply.category && (
            <>
              {" "}
              <span className="font-medium">{CATEGORY_TEXT[ply.category]}:</span> {ply.detail}
            </>
          )}
        </p>
      )}
      {actions && <div className="grid grid-cols-2 gap-2 pt-1">{actions}</div>}
    </div>
  );
}
