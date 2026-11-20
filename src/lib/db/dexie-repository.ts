"use client";

// IndexedDB-implementatie met Dexie. https://dexie.org/docs/Tutorial/React

import Dexie, { type Table } from "dexie";
import type { Repository, PatternStat } from "./repository";
import { now } from "./repository";
import { SCHEMA_VERSION, type ExportFile, type GameRecord, type MistakeRecord } from "./types";
import type { Category } from "../chess/patterns";

class CoachDb extends Dexie {
  games!: Table<GameRecord, string>;
  mistakes!: Table<MistakeRecord, string>;

  constructor() {
    super("schaakcoach");
    this.version(1).stores({
      games: "id, createdAt, updatedAt, status",
      mistakes: "id, gameId, category, createdAt, updatedAt",
    });
  }
}

/** Nieuwste versie van een record wint (op basis van updatedAt). */
function newer<T extends { updatedAt: string }>(a: T | undefined, b: T): boolean {
  return !a || a.updatedAt < b.updatedAt;
}

export class DexieRepository implements Repository {
  private db = new CoachDb();

  async saveGame(game: GameRecord) {
    await this.db.games.put({ ...game, updatedAt: now() });
  }

  async getGame(id: string) {
    const g = await this.db.games.get(id);
    return g && !g.deleted ? g : undefined;
  }

  async listGames() {
    const all = await this.db.games.orderBy("createdAt").reverse().toArray();
    return all.filter((g) => !g.deleted);
  }

  async getOngoingGame() {
    const list = await this.db.games.where("status").equals("bezig").toArray();
    return list.filter((g) => !g.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async deleteGame(id: string) {
    const ts = now();
    await this.db.transaction("rw", this.db.games, this.db.mistakes, async () => {
      await this.db.games.update(id, { deleted: true, updatedAt: ts });
      await this.db.mistakes.where("gameId").equals(id).modify({ deleted: true, updatedAt: ts });
    });
  }

  async saveMistake(m: MistakeRecord) {
    await this.db.mistakes.put({ ...m, updatedAt: now() });
  }

  async listMistakes(filter?: { category?: Category; gameId?: string }) {
    let coll = this.db.mistakes.toCollection();
    if (filter?.gameId) coll = this.db.mistakes.where("gameId").equals(filter.gameId);
    else if (filter?.category) coll = this.db.mistakes.where("category").equals(filter.category);
    const list = await coll.toArray();
    return list
      .filter((m) => !m.deleted)
      .filter((m) => !filter?.category || m.category === filter.category)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async patternStats(): Promise<PatternStat[]> {
    const [mistakes, games] = await Promise.all([this.listMistakes(), this.listGames()]);
    const recentGameIds = new Set(games.slice(0, 10).map((g) => g.id));
    const map = new Map<Category, PatternStat>();
    for (const m of mistakes) {
      const s = map.get(m.category) ?? { category: m.category, count: 0, recent: 0, lastSeen: m.createdAt };
      s.count++;
      if (recentGameIds.has(m.gameId)) s.recent++;
      if (m.createdAt > s.lastSeen) s.lastSeen = m.createdAt;
      map.set(m.category, s);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  async exportAll(): Promise<ExportFile> {
    return {
      app: "schaakcoach",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now(),
      games: await this.db.games.toArray(),
      mistakes: await this.db.mistakes.toArray(),
    };
  }

  async importAll(file: ExportFile) {
    if (file.app !== "schaakcoach") throw new Error("Dit is geen schaakcoach-backup.");
    if (file.schemaVersion > SCHEMA_VERSION)
      throw new Error("Deze backup komt uit een nieuwere versie van de app.");
    let games = 0;
    let mistakes = 0;
    await this.db.transaction("rw", this.db.games, this.db.mistakes, async () => {
      for (const g of file.games) {
        if (newer(await this.db.games.get(g.id), g)) {
          await this.db.games.put(g);
          games++;
        }
      }
      for (const m of file.mistakes) {
        if (newer(await this.db.mistakes.get(m.id), m)) {
          await this.db.mistakes.put(m);
          mistakes++;
        }
      }
    });
    return { games, mistakes };
  }
}

let repo: Repository | null = null;
export function getRepository(): Repository {
  if (!repo) repo = new DexieRepository();
  return repo;
}
