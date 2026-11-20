// UCI-protocol rond Stockfish, los van de omgeving (browser-Worker of Node).
// UCI-specificatie: https://backscattering.de/chess/uci/

import type { Score } from "./evaluation";

export interface EngineLine {
  multipv: number;
  depth: number;
  score: Score; // vanuit wit
  pv: string[]; // UCI-zetten
}

export interface AnalysisResult {
  fen: string;
  depth: number;
  lines: EngineLine[]; // gesorteerd op multipv (1 = beste)
  bestMove: string | null;
}

type Job = {
  run: () => void;
  onLine: (line: string) => boolean; // true = klaar
};

/** Seriële wachtrij van UCI-opdrachten; één engine-proces voert één opdracht tegelijk uit. */
export class UciEngine {
  private queue: Job[] = [];
  private current: Job | null = null;
  private ready: Promise<void>;

  constructor(private send: (cmd: string) => void) {
    this.ready = new Promise((resolve) => {
      this.enqueue({
        run: () => this.send("uci"),
        onLine: (line) => {
          if (line === "uciok") {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /** Moet aangeroepen worden voor elke uitvoerregel van de engine. */
  receive(line: string) {
    const trimmed = line.trim();
    if (!trimmed || !this.current) return;
    if (this.current.onLine(trimmed)) {
      this.current = null;
      this.next();
    }
  }

  private enqueue(job: Job) {
    this.queue.push(job);
    if (!this.current) this.next();
  }

  private next() {
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    job.run();
  }

  async setOption(name: string, value: string | number) {
    await this.ready;
    return new Promise<void>((resolve) => {
      this.enqueue({
        run: () => {
          this.send(`setoption name ${name} value ${value}`);
          this.send("isready");
        },
        onLine: (line) => {
          if (line === "readyok") {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /** Analyseer een positie. Scores worden omgerekend naar het perspectief van wit. */
  async analyse(
    fen: string,
    opts: { depth?: number; movetime?: number; multipv?: number } = {},
  ): Promise<AnalysisResult> {
    await this.ready;
    const multipv = opts.multipv ?? 1;
    const whiteToMove = fen.split(" ")[1] === "w";
    const lines = new Map<number, EngineLine>();

    return new Promise((resolve) => {
      this.enqueue({
        run: () => {
          this.send(`setoption name MultiPV value ${multipv}`);
          this.send("ucinewgame");
          this.send(`position fen ${fen}`);
          this.send(
            opts.movetime ? `go movetime ${opts.movetime}` : `go depth ${opts.depth ?? 14}`,
          );
        },
        onLine: (line) => {
          if (line.startsWith("info") && line.includes(" pv ")) {
            const parsed = parseInfo(line, whiteToMove);
            if (parsed) lines.set(parsed.multipv, parsed);
            return false;
          }
          if (line.startsWith("bestmove")) {
            const best = line.split(" ")[1];
            const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
            resolve({
              fen,
              depth: sorted[0]?.depth ?? 0,
              lines: sorted,
              bestMove: best && best !== "(none)" ? best : null,
            });
            return true;
          }
          return false;
        },
      });
    });
  }
}

function parseInfo(line: string, whiteToMove: boolean): EngineLine | null {
  const tokens = line.split(" ");
  const get = (key: string) => {
    const i = tokens.indexOf(key);
    return i >= 0 ? tokens[i + 1] : undefined;
  };
  const scoreIdx = tokens.indexOf("score");
  if (scoreIdx < 0) return null;
  // Tussentijdse grenswaarden overslaan.
  if (tokens[scoreIdx + 3] === "lowerbound" || tokens[scoreIdx + 3] === "upperbound") return null;
  const kind = tokens[scoreIdx + 1];
  const value = parseInt(tokens[scoreIdx + 2], 10);
  const sign = whiteToMove ? 1 : -1;
  const score: Score = kind === "mate" ? { mate: sign * value } : { cp: sign * value };
  const pvIdx = tokens.indexOf("pv");
  return {
    multipv: parseInt(get("multipv") ?? "1", 10),
    depth: parseInt(get("depth") ?? "0", 10),
    score,
    pv: tokens.slice(pvIdx + 1),
  };
}
