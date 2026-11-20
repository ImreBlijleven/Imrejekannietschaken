"use client";

import type { PlyRecord } from "@/lib/db/types";
import { winPercent } from "@/lib/chess/evaluation";

/** Winstkans van de speler per halve zet (0–100%). */
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
  const y = (v: number) => H - (v / 100) * H;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-28 rounded-lg bg-[var(--bg)] cursor-pointer"
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
      <path d={area} fill="var(--accent)" opacity="0.15" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {plies.map((p, i) =>
        p.label === "blunder" || p.label === "fout" ? (
          <circle
            key={i}
            cx={x(i + 1)}
            cy={y(pts[i + 1])}
            r="4"
            fill={p.label === "blunder" ? "#dc2626" : "#ea580c"}
          />
        ) : null,
      )}
      {selected !== null && (
        <line x1={x(selected + 1)} x2={x(selected + 1)} y1="0" y2={H} stroke="var(--fg)" opacity="0.4" />
      )}
    </svg>
  );
}
