"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Arrow } from "react-chessboard";

const COLOR = "rgba(37, 99, 235, 0.8)"; // blauw: eigen ideeën, los van groen/rood/oranje van de app

interface Marks {
  key: string; // stelling waarbij de tekening hoort; bij een nieuwe zet verdwijnt ze
  arrows: { from: string; to: string }[];
  rings: string[];
}

/**
 * Pijlen en ringen tekenen op het bord, ook op de telefoon: in tekenmodus tik je een veld en dan een
 * tweede veld (pijl), of twee keer hetzelfde veld (ring). Nog eens tekenen haalt het weer weg.
 * De tekening hoort bij één stelling (`positionKey`) en verdwijnt na een zet.
 */
export function useArrowDrawing(positionKey: string) {
  const [on, setOn] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [marks, setMarks] = useState<Marks>({ key: positionKey, arrows: [], rings: [] });
  const current = marks.key === positionKey ? marks : { key: positionKey, arrows: [], rings: [] };

  /** Verwerk een tik op een veld. Geeft true als de tik voor het tekenen was. */
  function tap(square: string): boolean {
    if (!on) return false;
    if (!from) {
      setFrom(square);
      return true;
    }
    if (from === square) {
      const rings = current.rings.includes(square)
        ? current.rings.filter((s) => s !== square)
        : [...current.rings, square];
      setMarks({ ...current, rings });
    } else {
      const exists = current.arrows.some((a) => a.from === from && a.to === square);
      const arrows = exists
        ? current.arrows.filter((a) => !(a.from === from && a.to === square))
        : [...current.arrows, { from, to: square }];
      setMarks({ ...current, arrows });
    }
    setFrom(null);
    return true;
  }

  function toggle() {
    setOn((v) => !v);
    setFrom(null);
  }

  const arrows: Arrow[] = current.arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: COLOR }));
  const squareStyles: Record<string, React.CSSProperties> = {};
  for (const s of current.rings) squareStyles[s] = { boxShadow: `inset 0 0 0 4px ${COLOR}` };
  if (on && from) squareStyles[from] = { background: "rgba(37, 99, 235, 0.35)" };

  return { on, toggle, tap, arrows, squareStyles };
}

/** Potlood-knop voor de tekenmodus. */
export function DrawButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  const label = on ? "Stop met tekenen" : "Pijlen tekenen";
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-lg sm:size-11 ${
        on ? "bg-[#2563eb] text-white" : "text-[var(--fg)] hover:bg-[var(--panel)]"
      }`}
    >
      <Pencil className="size-5" aria-hidden />
    </button>
  );
}
