// Stockfish in Node (voor scripts/testset). https://github.com/nmrugg/stockfish.js#nodejs-npm
import { createRequire } from "node:module";
import { UciEngine } from "../src/lib/chess/engine-core";

const require = createRequire(import.meta.url);

export function createNodeEngine(): { engine: UciEngine; terminate: () => void } {
  const holder: { engine?: UciEngine } = {};
  const sf = require("stockfish")("lite-single", (line: string) => holder.engine?.receive(line));
  const engine = new UciEngine((cmd) => sf.processCommand(cmd));
  holder.engine = engine;
  return { engine, terminate: () => sf.terminate() };
}
