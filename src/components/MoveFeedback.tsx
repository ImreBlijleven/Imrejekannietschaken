"use client";

import type { PlyRecord } from "@/lib/db/types";
import { LABEL_TEXT, formatScore } from "@/lib/chess/evaluation";
import { CATEGORY_TEXT } from "@/lib/chess/patterns";
import { LABEL_STYLE } from "./MoveList";

export function MoveFeedback({ ply, pending }: { ply: PlyRecord | null; pending: boolean }) {
  if (pending) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 text-sm animate-pulse">
        Stockfish beoordeelt je zet…
      </div>
    );
  }
  if (!ply || !ply.label) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
        Doe een zet; je krijgt hier direct een beoordeling.
      </div>
    );
  }
  const st = LABEL_STYLE[ply.label];
  const isMistake = ply.label === "onnauwkeurig" || ply.label === "fout" || ply.label === "blunder";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 text-sm space-y-1">
      <p className="text-base">
        <span className="font-mono font-semibold">{ply.san}</span>{" "}
        <span className={`font-bold ${st.cls}`}>
          {st.icon} {LABEL_TEXT[ply.label]}
        </span>
      </p>
      <p className="text-[var(--muted)]">
        Evaluatie na je zet: <span className="font-mono">{formatScore(ply.evalAfter)}</span>
        {ply.drop !== undefined && ply.drop > 0.02 && (
          <> · winstkans −{(ply.drop * 50).toFixed(0)}%</>
        )}
      </p>
      {isMistake && ply.bestSan && (
        <p>
          Beter was <span className="font-mono font-semibold">{ply.bestSan}</span>.
        </p>
      )}
      {isMistake && ply.category && (
        <p>
          <span className="font-medium">{CATEGORY_TEXT[ply.category]}:</span> {ply.detail}
        </p>
      )}
    </div>
  );
}
