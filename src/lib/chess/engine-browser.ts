"use client";

import { UciEngine } from "./engine-core";

// De engine-bestanden worden bij `npm install` naar /public/stockfish gekopieerd
// (zie scripts/copy-stockfish.mjs). Lite single-threaded: geen speciale headers nodig.
// https://github.com/nmrugg/stockfish.js#which-engine-should-i-use
const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";

export function createBrowserEngine(): { engine: UciEngine; terminate: () => void } {
  const worker = new Worker(ENGINE_URL);
  const engine = new UciEngine((cmd) => worker.postMessage(cmd));
  worker.onmessage = (ev: MessageEvent) => {
    const data = typeof ev.data === "string" ? ev.data : String(ev.data);
    for (const line of data.split("\n")) engine.receive(line);
  };
  return { engine, terminate: () => worker.terminate() };
}

let analysisSingleton: UciEngine | null = null;
let opponentSingleton: UciEngine | null = null;

/** Engine voor analyse (volle sterkte). */
export function getAnalysisEngine(): UciEngine {
  if (!analysisSingleton) analysisSingleton = createBrowserEngine().engine;
  return analysisSingleton;
}

/** Aparte engine voor de tegenstander, zodat het speelniveau de analyse niet beïnvloedt. */
export function getOpponentEngine(): UciEngine {
  if (!opponentSingleton) opponentSingleton = createBrowserEngine().engine;
  return opponentSingleton;
}
