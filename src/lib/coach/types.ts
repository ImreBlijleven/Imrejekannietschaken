// Feiten die naar de coach gaan. Alles hierin komt uit Stockfish of chess.js;
// het taalmodel mag alleen hierover praten.

export interface LineFact {
  text: string; // bv. "12. Nf3 Nc6 13. Bb5"
  sanMoves: string[];
  eval: string; // bv. "+1.25" of "#3" (vanuit wit)
}

export interface FocusMoveFact {
  moveNumber: number;
  color: "wit" | "zwart";
  san: string;
  fenBefore: string;
  fenAfter: string;
  label: string; // bv. "Blunder"
  evalBefore: string;
  evalAfter: string;
  winChanceBefore: number; // % voor de speler
  winChanceAfter: number;
  bestMoves: (LineFact & { san: string })[];
  refutation?: LineFact; // beste vervolg van de tegenstander na de gespeelde zet
  category?: string;
  categoryDetail?: string;
  insights?: string[]; // inhoudelijke positiefeiten (chess.js), zonder cijfers
}

export interface WhatIfFact extends LineFact {
  san: string; // de zet waarnaar gevraagd werd
}

export interface PatternFact {
  text: string;
  count: number;
  recent: number;
}

export interface CoachFacts {
  playerColor: "wit" | "zwart";
  pgn: string;
  currentFen: string;
  focus?: FocusMoveFact;
  whatIf: WhatIfFact[];
  patterns: PatternFact[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequest {
  facts: CoachFacts;
  messages: ChatMessage[];
}

export interface CoachResponse {
  answer: string;
  warnings: string[];
  provider?: string;
  model?: string;
  error?: string;
}
