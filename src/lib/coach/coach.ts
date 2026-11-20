// Coach-logica: model aanroepen, antwoord controleren, zo nodig één keer laten corrigeren,
// en bij een fout (bv. limiet bereikt) doorschakelen naar de volgende aanbieder.

import { SYSTEM_PROMPT, factsToText } from "./prompt";
import { complete, providerConfigs, type LlmMessage, type ProviderConfig } from "./providers";
import type { CoachRequest, CoachResponse } from "./types";
import { validateAnswer } from "./validate";

export async function askCoach(
  req: CoachRequest,
  providers: ProviderConfig[] = providerConfigs(),
): Promise<CoachResponse> {
  if (providers.length === 0) {
    return {
      answer: "",
      warnings: [],
      error:
        "Geen AI-aanbieder ingesteld. Zet bv. GROQ_API_KEY in .env.local (zie README) en herstart de server.",
    };
  }

  const history = req.messages.slice(-10);
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `FEITEN (van Stockfish en chess.js):\n${factsToText(req.facts)}` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const errors: string[] = [];
  for (const p of providers) {
    try {
      let answer = await complete(p, messages);
      let check = validateAnswer(answer, req.facts);
      if (!check.ok) {
        // Eén correctiepoging met concrete feedback.
        const problems = [
          check.unknownMoves.length ? `zetten die niet in FEITEN staan: ${check.unknownMoves.join(", ")}` : "",
          check.unknownEvals.length ? `evaluaties die niet in FEITEN staan: ${check.unknownEvals.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("; ");
        answer = await complete(p, [
          ...messages,
          { role: "assistant", content: answer },
          {
            role: "user",
            content: `Je antwoord bevat ${problems}. Herschrijf het antwoord zonder deze zetten/getallen; gebruik alleen wat in FEITEN staat. Geef alleen het verbeterde antwoord.`,
          },
        ]);
        check = validateAnswer(answer, req.facts);
      }
      const warnings: string[] = [];
      if (check.unknownMoves.length)
        warnings.push(`Niet door de engine bevestigde zetten: ${check.unknownMoves.join(", ")}`);
      if (check.unknownEvals.length)
        warnings.push(`Niet door de engine bevestigde evaluaties: ${check.unknownEvals.join(", ")}`);
      return { answer, warnings, provider: p.name, model: p.model };
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { answer: "", warnings: [], error: `Alle aanbieders faalden. ${errors.join(" | ")}` };
}
