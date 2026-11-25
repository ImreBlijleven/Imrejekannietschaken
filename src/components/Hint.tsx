"use client";

import { Lightbulb, LoaderCircle } from "lucide-react";
import type { Hints } from "@/lib/training/hints";

/** Lampje: elke tik geeft een stap meer (idee → stuk → zet). */
export function HintButton({
  level,
  onClick,
  disabled,
  busy,
  costs,
}: {
  level: number;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  costs?: boolean; // eerste hint telt als fout (openingsoefening)
}) {
  const label =
    level === 0
      ? `Hint${costs ? " (telt als fout)" : ""}`
      : level < 3
        ? `Meer hulp (stap ${level + 1} van 3)`
        : "Hint gegeven";
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy || level >= 3}
      aria-label={label}
      title={label}
      className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-[var(--fg)] hover:bg-[var(--panel)] disabled:opacity-40 sm:size-11"
    >
      {busy ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : (
        <Lightbulb
          className={`size-5 ${level > 0 ? "fill-[var(--inaccuracy)] text-[var(--inaccuracy)]" : ""}`}
          aria-hidden
        />
      )}
      {level > 0 && (
        <span className="absolute bottom-1.5 flex gap-0.5" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`size-1 rounded-full ${i <= level ? "bg-[var(--inaccuracy)]" : "bg-[var(--border)]"}`}
            />
          ))}
        </span>
      )}
    </button>
  );
}

/** De hint zelf: na stap 1 het idee, na stap 2 ook het stuk, na stap 3 ook de zet. */
export function HintText({ hints, level }: { hints: Hints | null; level: number }) {
  if (!hints || level === 0) return null;
  return (
    <p
      className="flex items-start gap-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--accent-ink)]" aria-hidden />
      <span>
        {hints.idea}
        {level >= 2 && <> {hints.piece.text}</>}
        {level >= 3 && (
          <>
            {" "}
            Zet: <span className="san">{hints.move.san}</span>
          </>
        )}
      </span>
    </p>
  );
}

/** Bordmarkering voor de hint: stuk oplichten (stap 2) en pijl (stap 3). */
export function hintBoard(hints: Hints | null, level: number) {
  const squareStyles: Record<string, React.CSSProperties> = {};
  const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  if (hints && level >= 2) squareStyles[hints.piece.square] = { boxShadow: "inset 0 0 0 4px rgba(217, 119, 6, 0.85)" };
  if (hints && level >= 3)
    arrows.push({ startSquare: hints.move.from, endSquare: hints.move.to, color: "rgba(217, 119, 6, 0.9)" });
  return { squareStyles, arrows };
}
