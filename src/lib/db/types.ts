// Datamodel. Elk record heeft een UUID, updatedAt en schemaVersion zodat het later
// zonder conflicten naar een server-database (bv. Supabase) gesynchroniseerd kan worden.

import type { Label, Score } from "../chess/evaluation";
import type { Category, Phase } from "../chess/patterns";

export const SCHEMA_VERSION = 1;

interface SyncFields {
  id: string; // UUID
  createdAt: string; // ISO
  updatedAt: string; // ISO
  schemaVersion: number;
  deleted?: boolean; // soft delete, handig voor sync
}

export type GameMode = "training" | "partij";
export type GameStatus = "bezig" | "afgelopen";

/** Eén halve zet in een partij, met engine-informatie. */
export interface PlyRecord {
  ply: number; // 0-gebaseerd
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  evalBefore?: Score; // vanuit wit (alleen bij zetten van de speler)
  book?: boolean; // theoriezet uit een oefening, niet beoordeeld
  bookEval?: boolean; // evalAfter van deze theoriezet is echt berekend
  evalAfter: Score; // vanuit wit
  bestUci?: string; // beste zet in fenBefore (alleen voor zetten van de speler)
  bestSan?: string;
  label?: Label; // alleen voor zetten van de speler
  drop?: number; // verlies winstkans (0..1, schaal van Lichess winningChances)
  accuracy?: number;
  category?: Category; // alleen bij onnauwkeurig/fout/blunder
  detail?: string;
}

export interface GameRecord extends SyncFields {
  playerColor: "w" | "b";
  level: number; // (oud) Stockfish Skill Level 0..20, voor partijen van vóór de Elo-slider
  elo?: number; // sterkte van de computer in Elo
  mode: GameMode;
  status: GameStatus;
  result?: string; // "1-0", "0-1", "1/2-1/2", "*"
  endReason?: "mat" | "remise" | "opgegeven" | "afgebroken" | "doel";
  goal?: "mat" | "promoveren"; // doel van een oefensituatie
  pgn: string;
  plies: PlyRecord[];
  startFen?: string; // partij begint vanuit een stelling (oefensituatie); anders de beginstelling
  source?: string; // bv. "oefenen:italiaans:w"
  accuracy?: number;
}

export interface MistakeRecord extends SyncFields {
  gameId: string;
  ply: number;
  fenBefore: string;
  san: string;
  bestSan: string;
  bestLineSan: string[];
  refutationSan: string[]; // beste antwoord van de tegenstander na de fout
  label: Label;
  drop: number;
  category: Category;
  detail: string;
  phase: Phase;
}

/** Voortgang per oefening en kleur (id = "<oefening>:<w|b>"). */
export interface DrillRecord extends SyncFields {
  drillId: string;
  side: "w" | "b";
  attempts: number;
  perfect: number; // aantal foutloze rondes
  streak: number; // foutloze rondes op rij → sterren
  lastPracticed: string;
}

export interface ExportFile {
  app: "schaakcoach";
  schemaVersion: number;
  exportedAt: string;
  games: GameRecord[];
  mistakes: MistakeRecord[];
  drills?: DrillRecord[];
}
