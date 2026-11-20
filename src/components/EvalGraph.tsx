"use client";

import type { PlyRecord } from "@/lib/db/types";
import { winPercent } from "@/lib/chess/evaluation";

/** Winstkans van de speler per halve zet (0–100%). Tik om naar die zet te gaan. */
export function EvalGraph({
  plies,
  playerColor,
  selected,
  onSelect,
}: {
  plies: PlyRecord[];
  playerColor: "w" | "b";
  selected: number | null;
  onSelect: (ply: number) => void;
}) {
  if (plies.length < 2) return null;
  const W = 600;
  const H = 120;
  const pts = [50, ...plies.map((p) => winPercent(p.evalAfter, playerColor))];
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H - (Math.max(2, Math.min(98, v)) / 100) * H;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  const marks = plies.filter((p) => p.color === playerColor && (p.label === "blunder" || p.label === "fout"));

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-24 w-full cursor-pointer rounded-lg bg-[var(--panel)]"
          preserveAspectRatio="none"
          role="img"
          aria-label="Grafiek van je winstkans per zet"
          onClick={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)) - 1;
            if (i >= 0 && i < plies.length) onSelect(i);
          }}
        >
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--border)" strokeDasharray="4 4" />
          <path d={area} fill="var(--accent)" opacity="0.14" />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {selected !== null && (
            <line
              x1={x(selected + 1)}
              x2={x(selected + 1)}
              y1="0"
              y2={H}
              stroke="var(--fg)"
              strokeOpacity="0.35"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Punten als HTML, zodat ze rond blijven ondanks het uitgerekte SVG */}
        {marks.map((p) => (
          <span
            key={p.ply}
            aria-hidden
            className={`pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--panel)] ${
              p.label === "blunder" ? "bg-[var(--blunder)]" : "bg-[var(--mistake)]"
            }`}
            style={{ left: `${(x(p.ply + 1) / W) * 100}%`, top: `${(y(pts[p.ply + 1]) / H) * 100}%` }}
          />
        ))}
        <span className="pointer-events-none absolute left-2 top-1 text-[11px] text-[var(--muted)]">jij</span>
        <span className="pointer-events-none absolute bottom-1 left-2 text-[11px] text-[var(--muted)]">tegenstander</span>
      </div>
    </figure>
  );
}
