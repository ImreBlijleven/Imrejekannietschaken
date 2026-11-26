// Opslag-interface. De app gebruikt alleen deze interface; de implementatie
// (nu IndexedDB, later bv. Supabase) kan vervangen worden zonder de UI te wijzigen.

import type { Category } from "../chess/patterns";
import type { DrillRecord, ExportFile, GameRecord, MistakeRecord, ReviewRecord } from "./types";

export interface PatternStat {
  category: Category;
  count: number;
  recent: number; // aantal in de laatste 10 partijen
  lastSeen: string;
}

export interface Repository {
  saveGame(game: GameRecord): Promise<void>;
  getGame(id: string): Promise<GameRecord | undefined>;
  listGames(): Promise<GameRecord[]>;
  getOngoingGame(): Promise<GameRecord | undefined>;
  deleteGame(id: string): Promise<void>; // soft delete
  restoreGame(id: string): Promise<void>; // maakt een soft delete ongedaan

  saveMistake(m: MistakeRecord): Promise<void>;
  listMistakes(filter?: { category?: Category; gameId?: string }): Promise<MistakeRecord[]>;
  patternStats(): Promise<PatternStat[]>;

  listDrills(): Promise<DrillRecord[]>;
  recordDrill(drillId: string, side: "w" | "b", mistakes: number): Promise<DrillRecord>;

  listReviews(kind?: ReviewRecord["kind"]): Promise<ReviewRecord[]>;
  recordReview(id: string, kind: ReviewRecord["kind"], correct: boolean, themes?: string[]): Promise<ReviewRecord>;

  exportAll(): Promise<ExportFile>;
  importAll(file: ExportFile): Promise<{ games: number; mistakes: number; drills: number; reviews: number }>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}
