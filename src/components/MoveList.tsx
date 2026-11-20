"use client";

import { useEffect, useRef } from "react";
import type { PlyRecord } from "@/lib/db/types";
import type { Label } from "@/lib/chess/evaluation";

/** Eén betekenis per label, in elk thema; kleur wordt altijd met een symbool gecombineerd. */
export const LABEL_STYLE: Record<Label, { icon: string; cls: string }> = {
  beste: { icon: "★", cls: "text-good" },
  goed: { icon: "✓", cls: "text-good" },
  onnauwkeurig: { icon: "?!", cls: "text-inaccuracy" },
  fout: { icon: "?", cls: "text-mistake" },
  blunder: { icon: "??", cls: "text-blunder" },
};

interface Props {
  plies: PlyRecord[];
  selected: number | null;
  onSelect: (ply: number) => void;
  showLabels: boolean;
}

export function moveNumber(p: PlyRecord) {
  return p.fenBefore.split(" ")[5] ?? "1";
}

export function MoveList({ plies, selected, onSelect, showLabels }: Props) {
  const rows: { no: string; w?: PlyRecord; b?: PlyRecord }[] = [];
  for (const p of plies) {
    const no = moveNumber(p);
    let row = rows.at(-1);
    if (!row || row.no !== no || (p.color === "w" && row.w)) {
      row = { no };
      rows.push(row);
    }
    row[p.color] = p;
  }

  const chip = (p?: PlyRecord) => {
    if (!p) return <span />;
    const st = showLabels && p.label ? LABEL_STYLE[p.label] : null;
    const on = selected === p.ply;
    return (
      <button
        onClick={() => onSelect(p.ply)}
        aria-pressed={on}
        className={`san inline-flex min-h-11 min-w-11 items-center justify-center justify-self-start rounded-md px-2 text-left text-sm hover:bg-[var(--bg)] ${
          on ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : ""
        }`}
      >
        {p.san}
        {st && (
          <span className={`ml-1 font-bold ${st.cls}`} aria-label={p.label}>
            {st.icon}
          </span>
        )}
      </button>
    );
  };

  if (plies.length === 0) return <p className="px-2 py-3 text-sm text-[var(--muted)]">Nog geen zetten.</p>;

  return (
    <>
      <MoveStrip plies={plies} selected={selected} chip={chip} />
      <div className="hidden max-h-72 grid-cols-[2.5rem_1fr_1fr] overflow-y-auto text-sm sm:grid">
        {rows.map((r) => (
          <div key={`${r.no}-${r.w?.ply ?? r.b?.ply}`} className="contents">
            <span className="num flex items-center text-[var(--muted)]">{r.no}.</span>
            {chip(r.w)}
            {chip(r.b)}
          </div>
        ))}
      </div>
    </>
  );
}

/** Telefoon: alle zetten op één regel die horizontaal scrolt en meeloopt met de selectie. */
function MoveStrip({
  plies,
  selected,
  chip,
}: Pick<Props, "plies" | "selected"> & { chip: (p?: PlyRecord) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>("[data-sel='1']");
    if (target) el.scrollTo({ left: target.offsetLeft - el.clientWidth / 2 + target.offsetWidth / 2 });
    else el.scrollLeft = el.scrollWidth;
  }, [plies.length, selected]);
  return (
    <div
      ref={ref}
      className="no-scrollbar flex items-center overflow-x-auto whitespace-nowrap sm:hidden"
      style={{ maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)" }}
    >
      {plies.map((p) => (
        <span key={p.ply} data-sel={selected === p.ply ? "1" : "0"} className="flex items-center">
          {p.color === "w" && <span className="num pl-2 text-sm text-[var(--muted)]">{moveNumber(p)}.</span>}
          {chip(p)}
        </span>
      ))}
    </div>
  );
}
