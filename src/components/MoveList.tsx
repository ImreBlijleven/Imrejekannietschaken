"use client";

import type { PlyRecord } from "@/lib/db/types";
import type { Label } from "@/lib/chess/evaluation";

export const LABEL_STYLE: Record<Label, { icon: string; cls: string }> = {
  beste: { icon: "★", cls: "text-emerald-600 dark:text-emerald-400" },
  goed: { icon: "✓", cls: "text-emerald-600 dark:text-emerald-400" },
  onnauwkeurig: { icon: "?!", cls: "text-amber-600 dark:text-amber-400" },
  fout: { icon: "?", cls: "text-orange-600 dark:text-orange-400" },
  blunder: { icon: "??", cls: "text-red-600 dark:text-red-400" },
};

interface Props {
  plies: PlyRecord[];
  selected: number | null;
  onSelect: (ply: number) => void;
  showLabels: boolean;
}

export function MoveList({ plies, selected, onSelect, showLabels }: Props) {
  const rows: { no: number; w?: PlyRecord; b?: PlyRecord }[] = [];
  for (const p of plies) {
    const no = parseInt(p.fenBefore.split(" ")[5] ?? "1", 10);
    let row = rows.at(-1);
    if (!row || row.no !== no || (p.color === "w" && row.w)) {
      row = { no };
      rows.push(row);
    }
    row[p.color] = p;
  }

  const cell = (p?: PlyRecord) => {
    if (!p) return <span />;
    const st = showLabels && p.label ? LABEL_STYLE[p.label] : null;
    return (
      <button
        onClick={() => onSelect(p.ply)}
        className={`text-left rounded px-2 py-0.5 font-mono text-sm hover:bg-[var(--bg)] ${
          selected === p.ply ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]" : ""
        }`}
      >
        {p.san}
        {st && <span className={`ml-1 font-bold ${st.cls}`}>{st.icon}</span>}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-0.5 text-sm max-h-64 overflow-y-auto">
      {rows.map((r) => (
        <div key={`${r.no}-${r.w?.ply ?? r.b?.ply}`} className="contents">
          <span className="text-[var(--muted)] py-0.5">{r.no}.</span>
          {cell(r.w)}
          {cell(r.b)}
        </div>
      ))}
      {plies.length === 0 && <p className="col-span-3 text-[var(--muted)]">Nog geen zetten.</p>}
    </div>
  );
}
