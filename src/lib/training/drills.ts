// Oefeningen: openingen (een boom van theorie-lijnen) en situaties (een stelling met een doel).
// Alle lijnen worden gecontroleerd door scripts/check-drills.mts (legaal + geen fout volgens Stockfish).

export type Side = "w" | "b";

export interface OpeningDrill {
  kind: "opening";
  id: string;
  /** Naam per kant: met wit oefen je bv. "Tegen het Koningsindisch", met zwart "Koningsindisch". */
  names: Partial<Record<Side, string>>;
  /** Theorie-lijnen in SAN vanaf de beginstelling. Samen vormen ze een boom. */
  lines: string[][];
  /** Korte notatie voor de lijst als de gemeenschappelijke beginzetten te weinig zeggen. */
  preview?: string;
}

export interface PositionDrill {
  kind: "position";
  id: string;
  name: string;
  fen: string;
  side: Side;
  goal: "mat" | "promoveren";
}

export type Drill = OpeningDrill | PositionDrill;

const l = (s: string) => s.trim().split(/\s+/);

export const OPENINGS: OpeningDrill[] = [
  {
    kind: "opening",
    id: "italiaans",
    names: { w: "Italiaans", b: "Tegen Italiaans" },
    lines: [
      l("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O"),
      l("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 a6 O-O d6"),
      l("e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6"),
    ],
  },
  {
    kind: "opening",
    id: "spaans",
    names: { w: "Spaans", b: "Tegen Spaans" },
    lines: [
      l("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O"),
      l("e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8"),
    ],
  },
  {
    kind: "opening",
    id: "schots",
    names: { w: "Schots", b: "Tegen Schots" },
    lines: [
      l("e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7"),
      l("e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6"),
    ],
  },
  {
    kind: "opening",
    id: "najdorf",
    names: { b: "Siciliaans Najdorf", w: "Tegen Siciliaans Najdorf" },
    lines: [
      l("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7"),
      l("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O"),
    ],
  },
  {
    kind: "opening",
    id: "caro-kann",
    names: { b: "Caro-Kann", w: "Tegen Caro-Kann" },
    lines: [
      l("e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7"),
      l("e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 cxd4 Nxd4 Ne7"),
      l("e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4"),
    ],
  },
  {
    kind: "opening",
    id: "frans",
    names: { b: "Frans", w: "Tegen Frans" },
    lines: [l("e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3 cxd4 Nxd4"), l("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4")],
  },
  {
    kind: "opening",
    id: "damegambiet",
    names: { w: "Damegambiet", b: "Tegen het Damegambiet" },
    lines: [
      l("d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6"),
      l("d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4"),
      l("d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6"),
    ],
  },
  {
    kind: "opening",
    id: "koningsindisch",
    names: { w: "Tegen het Koningsindisch", b: "Koningsindisch" },
    lines: [
      l("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7"),
      l("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 d5 a5 Bg5 h6"),
      l("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 c5 Nge2 Nc6 Qd2"),
    ],
  },
  {
    kind: "opening",
    id: "nimzo",
    names: { b: "Nimzo-Indisch", w: "Tegen Nimzo-Indisch" },
    lines: [l("d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O"), l("d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6")],
  },
  {
    kind: "opening",
    id: "londen",
    names: { w: "Londen-systeem", b: "Tegen het Londen-systeem" },
    preview: "1.d4 en 2.Bf4",
    lines: [
      l("d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3"),
      l("d4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 O-O"),
    ],
  },
];

export const POSITIONS: PositionDrill[] = [
  { kind: "position", id: "mat-dame", name: "Mat met dame", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1", side: "w", goal: "mat" },
  { kind: "position", id: "mat-toren", name: "Mat met toren", fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1", side: "w", goal: "mat" },
  {
    kind: "position",
    id: "pion-promoveren",
    name: "Pion naar de overkant",
    fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1",
    side: "w",
    goal: "promoveren",
  },
];

/** Naam van een opening voor een kant (val terug op de andere naam). */
export function openingName(o: OpeningDrill, side: Side): string {
  return o.names[side] ?? o.names[side === "w" ? "b" : "w"] ?? o.id;
}

/** Gemeenschappelijke beginzetten van alle lijnen (max. `plies`), bv. "1.e4 e5 2.Nf3 Nc6 3.Bc4". */
export function firstMoves(o: OpeningDrill, plies = 7): string {
  if (o.preview) return o.preview;
  const shared: string[] = [];
  for (let i = 0; i < plies; i++) {
    const m = o.lines[0][i];
    if (!m || o.lines.some((line) => line[i] !== m)) break;
    shared.push(m);
  }
  return shared.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(" ");
}
