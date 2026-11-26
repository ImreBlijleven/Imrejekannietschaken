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
  /** Benoemde varianten: de naam geldt zodra de gespeelde zetten met `moves` beginnen. */
  variations: Variation[];
  /** Valstrik: je speelt altijd deze kant; "afstraffen" = de fout benutten, "verdedigen" = een val ontwijken. */
  trap?: { side: Side; goal?: "afstraffen" | "verdedigen" };
}

export interface Variation {
  moves: string[];
  name: string;
}

export interface PositionDrill {
  kind: "position";
  id: string;
  name: string;
  fen: string;
  side: Side;
  goal: "mat" | "promoveren" | "remise";
}

/**
 * Middenspel-plan: een typische stelling (ontstaan uit een opening). Je speelt PLAN_MOVES zetten tegen Stockfish
 * en slaagt als je stelling niet duidelijk slechter is geworden.
 */
export interface PlanDrill {
  kind: "plan";
  id: string;
  name: string;
  moves: string[]; // zetten vanaf de beginstelling tot de oefenstelling
  side: Side;
}

export const PLAN_MOVES = 10;
/** Maximaal verlies aan winstkans (procentpunten) om het plan als geslaagd te tellen. */
export const PLAN_MAX_DROP = 10;

/** Bij "remise houden" slaag je ook als je zoveel eigen zetten overleeft. */
export const SURVIVE_MOVES = 30;

export type Drill = OpeningDrill | PositionDrill;

const l = (s: string) => s.trim().split(/\s+/);
const v = (moves: string, name: string): Variation => ({ moves: l(moves), name });

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
    variations: [
      v("e4 e5 Nf3 Nc6 Bc4", "Italiaanse partij"),
      v("e4 e5 Nf3 Nc6 Bc4 Bc5", "Giuoco Piano"),
      v("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3", "Giuoco Pianissimo"),
      v("e4 e5 Nf3 Nc6 Bc4 Nf6", "Tweepaardjesspel"),
      v("e4 e5 Nf3 Nc6 Bc4 Nf6 d3", "Tweepaardjesspel, rustige variant (4.d3)"),
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
    variations: [
      v("e4 e5 Nf3 Nc6 Bb5", "Spaanse partij"),
      v("e4 e5 Nf3 Nc6 Bb5 a6", "Morphy-verdediging"),
      v("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7", "Gesloten Spaans"),
      v("e4 e5 Nf3 Nc6 Bb5 Nf6", "Berlijnse verdediging"),
      v("e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+", "Berlijnse muur"),
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
    variations: [
      v("e4 e5 Nf3 Nc6 d4 exd4 Nxd4", "Schotse partij"),
      v("e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5", "Klassieke variant (4...Bc5)"),
      v("e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6", "Schmidt-variant (4...Nf6)"),
      v("e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5", "Mieses-variant"),
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
    variations: [
      v("e4 c5", "Siciliaans"),
      v("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3", "Open Siciliaans"),
      v("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "Najdorf-variant"),
      v("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3", "Najdorf, Engelse aanval (6.Be3)"),
      v("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2", "Najdorf, Opočenský-variant (6.Be2)"),
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
    variations: [
      v("e4 c6", "Caro-Kann"),
      v("e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5", "Klassieke variant (4...Bf5)"),
      v("e4 c6 d4 d5 e5", "Doorschuifvariant (3.e5)"),
      v("e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2", "Doorschuifvariant, Short-systeem"),
      v("e4 c6 d4 d5 exd5 cxd5", "Ruilvariant (3.exd5)"),
    ],
  },
  {
    kind: "opening",
    id: "frans",
    names: { b: "Frans", w: "Tegen Frans" },
    lines: [l("e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3 cxd4 Nxd4"), l("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4")],
    variations: [
      v("e4 e6", "Frans"),
      v("e4 e6 d4 d5 Nc3 Nf6", "Klassieke variant (3...Nf6)"),
      v("e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7", "Steinitz-variant (4.e5)"),
      v("e4 e6 d4 d5 e5", "Doorschuifvariant (3.e5)"),
    ],
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
    variations: [
      v("d4 d5 c4", "Damegambiet"),
      v("d4 d5 c4 e6", "Damegambiet geweigerd"),
      v("d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6", "Damegambiet geweigerd, Tartakower-variant"),
      v("d4 d5 c4 c6", "Slavisch"),
      v("d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5", "Slavisch, Tsjechische variant"),
      v("d4 d5 c4 dxc4", "Damegambiet aangenomen"),
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
    variations: [
      v("d4 Nf6 c4 g6", "Indische opening"),
      v("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6", "Koningsindisch"),
      v("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2", "Koningsindisch, klassieke variant"),
      v("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6", "Koningsindisch, Mar del Plata (7...Nc6)"),
      v("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 d5", "Koningsindisch, Petrosjan-variant (7.d5)"),
      v("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3", "Koningsindisch, Sämisch-variant (5.f3)"),
    ],
  },
  {
    kind: "opening",
    id: "nimzo",
    names: { b: "Nimzo-Indisch", w: "Tegen Nimzo-Indisch" },
    lines: [l("d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O"), l("d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6")],
    variations: [
      v("d4 Nf6 c4 e6 Nc3 Bb4", "Nimzo-Indisch"),
      v("d4 Nf6 c4 e6 Nc3 Bb4 e3", "Nimzo-Indisch, Rubinstein-variant (4.e3)"),
      v("d4 Nf6 c4 e6 Nc3 Bb4 Qc2", "Nimzo-Indisch, klassieke variant (4.Qc2)"),
    ],
  },
  {
    kind: "opening",
    id: "londen",
    names: { w: "Londen-systeem", b: "Tegen het Londen-systeem" },
    preview: "1.d4 en 2.Bf4",
    lines: [l("d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3"), l("d4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 O-O")],
    variations: [
      v("d4 d5 Bf4", "Londen-systeem (tegen ...d5)"),
      v("d4 Nf6 Bf4", "Londen-systeem (tegen ...Nf6)"),
      v("d4 Nf6 Bf4 g6", "Londen-systeem tegen Koningsindisch-opzet"),
    ],
  },
];

export const TRAPS: OpeningDrill[] = [
  {
    kind: "opening",
    id: "val-legal",
    names: { w: "Legal-val" },
    trap: { side: "w" },
    lines: [l("e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#"), l("e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 dxe5 Qxg4")],
    variations: [
      v("e4 e5 Nf3 d6 Bc4 Bg4", "Philidor-verdediging"),
      v("e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5", "Legal-val: wit offert de dame"),
      v("e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1", "Legal-val: zwart pakt de dame"),
    ],
  },
  {
    kind: "opening",
    id: "val-herdersmat",
    names: { b: "Herdersmat afslaan" },
    trap: { side: "b", goal: "verdedigen" },
    lines: [l("e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6"), l("e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6")],
    variations: [v("e4 e5 Bc4 Nc6 Qh5", "Wit mikt op f7"), v("e4 e5 Qh5", "Vroege damezet")],
  },
  {
    kind: "opening",
    id: "val-blackburne",
    names: { b: "Blackburne Shilling-val" },
    trap: { side: "b" },
    lines: [l("e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#")],
    variations: [
      v("e4 e5 Nf3 Nc6 Bc4 Nd4", "Blackburne Shilling-gambiet"),
      v("e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5", "Blackburne Shilling-val: wit pakt de pion"),
    ],
  },
  {
    kind: "opening",
    id: "val-noah",
    names: { b: "Noah's Ark-val" },
    trap: { side: "b" },
    lines: [l("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5 c4")],
    variations: [
      v("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6", "Spaans, Steinitz-verdediging (uitgesteld)"),
      v("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4", "Noah's Ark-val: wit slaat terug op d4"),
    ],
  },
  {
    kind: "opening",
    id: "val-lasker",
    names: { b: "Lasker-val (Albin-tegengambiet)" },
    trap: { side: "b" },
    lines: [
      l("d4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3 Bxb4 exf2+ Ke2 fxg1=N+ Rxg1 Bg4+"),
      l("d4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3 Bxb4 exf2+ Ke2 fxg1=N+ Ke1 Qh4+"),
    ],
    variations: [
      v("d4 d5 c4 e5", "Albin-tegengambiet"),
      v("d4 d5 c4 e5 dxe5 d4 e3", "Lasker-val"),
      v("d4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3 Bxb4 exf2+ Ke2 fxg1=N+", "Lasker-val: promotie tot paard"),
    ],
  },
  {
    kind: "opening",
    id: "val-englund",
    names: { b: "Englund-val" },
    trap: { side: "b" },
    lines: [l("d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#")],
    variations: [
      v("d4 e5", "Englund-gambiet"),
      v("d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3", "Englund-val: wit valt de dame aan"),
    ],
  },
  {
    kind: "opening",
    id: "val-olifant",
    names: { b: "Olifantenval" },
    trap: { side: "b" },
    lines: [l("d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8")],
    variations: [
      v("d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7", "Damegambiet geweigerd"),
      v("d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5", "Olifantenval: wit pakt op d5"),
    ],
  },
];

export const PLANS: PlanDrill[] = [
  {
    kind: "plan",
    id: "plan-iqp-aanval",
    name: "Geïsoleerde damepion: aanvallen",
    moves: l("e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O"),
    side: "w",
  },
  {
    kind: "plan",
    id: "plan-iqp-blokkade",
    name: "Geïsoleerde damepion: blokkeren",
    moves: l("e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1"),
    side: "b",
  },
  {
    kind: "plan",
    id: "plan-minderheidsaanval",
    name: "Minderheidsaanval (Carlsbad-structuur)",
    moves: l("d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8"),
    side: "w",
  },
  {
    kind: "plan",
    id: "plan-draak",
    name: "Aanval op de koning (Drakenvariant)",
    moves: l("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6"),
    side: "w",
  },
  {
    kind: "plan",
    id: "plan-frans-d4",
    name: "Frans doorschuif: druk op d4",
    moves: l("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Be2"),
    side: "b",
  },
  {
    kind: "plan",
    id: "plan-koningsindisch",
    name: "Koningsindisch: aanval op de koningsvleugel",
    moves: l("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1"),
    side: "b",
  },
];

export const POSITIONS: PositionDrill[] = [
  {
    kind: "position",
    id: "mat-dame",
    name: "Mat met dame",
    fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1",
    side: "w",
    goal: "mat",
  },
  {
    kind: "position",
    id: "mat-toren",
    name: "Mat met toren",
    fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
    side: "w",
    goal: "mat",
  },
  {
    kind: "position",
    id: "pion-promoveren",
    name: "Pion naar de overkant",
    fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1",
    side: "w",
    goal: "promoveren",
  },
  {
    kind: "position",
    id: "lucena",
    name: "Lucena: toren met pion winnen",
    fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
    side: "w",
    goal: "promoveren",
  },
  {
    kind: "position",
    id: "dame-tegen-pion",
    name: "Dame tegen pion op de 7e rij",
    fen: "7Q/8/8/8/8/1K6/4pk2/8 w - - 0 1",
    side: "w",
    goal: "mat",
  },
  {
    kind: "position",
    id: "mat-twee-lopers",
    name: "Mat met twee lopers",
    fen: "8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1",
    side: "w",
    goal: "mat",
  },
  {
    kind: "position",
    id: "philidor",
    name: "Philidor: toren-eindspel remise houden",
    fen: "4k3/8/r7/4PK2/8/8/8/1R6 b - - 0 1",
    side: "b",
    goal: "remise",
  },
  {
    kind: "position",
    id: "oppositie-verdedigen",
    name: "Oppositie: koning voor de pion",
    fen: "8/8/8/4k3/8/8/4P3/4K3 b - - 0 1",
    side: "b",
    goal: "remise",
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

/** Meest specifieke variant die bij de gespeelde zetten past (langste passende beginreeks). */
export function currentVariation(o: OpeningDrill, played: string[]): string | null {
  let best: Variation | null = null;
  for (const v of o.variations) {
    if (v.moves.length > played.length) continue;
    if (!v.moves.every((m, i) => played[i] === m)) continue;
    if (!best || v.moves.length > best.moves.length) best = v;
  }
  return best?.name ?? null;
}
