import { askCoach } from "@/lib/coach/coach";
import type { CoachRequest } from "@/lib/coach/types";

export async function POST(request: Request) {
  // Optionele beveiliging: als COACH_ACCESS_TOKEN gezet is, moet de browser hem meesturen.
  // Zo kan niemand anders je gratis API-limiet opmaken als de site online staat.
  const required = process.env.COACH_ACCESS_TOKEN;
  if (required && request.headers.get("x-coach-token") !== required) {
    return Response.json(
      { error: "Ongeldig of ontbrekend coach-wachtwoord. Vul het in bij Instellingen." },
      { status: 401 },
    );
  }
  let body: CoachRequest;
  try {
    body = (await request.json()) as CoachRequest;
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (!body?.facts || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "facts en messages zijn verplicht." }, { status: 400 });
  }
  const result = await askCoach(body);
  return Response.json(result, { status: result.error ? 502 : 200 });
}
