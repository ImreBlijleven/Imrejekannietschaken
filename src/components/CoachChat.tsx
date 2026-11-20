"use client";

import { useId, useState } from "react";
import { LoaderCircle, SendHorizontal, TriangleAlert } from "lucide-react";
import type { ChatMessage, CoachFacts, CoachResponse } from "@/lib/coach/types";
import { loadSettings } from "@/lib/client/settings";

interface Props {
  contextLabel: string; // bv. "Zet 12... Nf6" of "Al je patronen"
  intro: string; // korte uitleg die past bij deze context
  buildFacts: (question: string) => Promise<CoachFacts>;
  suggestions?: string[];
}

interface UiMessage extends ChatMessage {
  warnings?: string[];
  meta?: string;
  error?: boolean;
}

/** Chat met de coach. Geef een `key` mee per context zodat het gesprek reset bij een andere zet. */
export function CoachChat({ contextLabel, intro, buildFacts, suggestions = [] }: Props) {
  const inputId = useId();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: UiMessage[] = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      setStatus("Stockfish rekent…");
      const facts = await buildFacts(question);
      setStatus("Coach denkt na…");
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-coach-token": loadSettings().coachToken },
        body: JSON.stringify({
          facts,
          messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json()) as CoachResponse;
      setMessages([
        ...history,
        data.error
          ? { role: "assistant", content: data.error, error: true }
          : {
              role: "assistant",
              content: data.answer,
              warnings: data.warnings,
              meta: data.provider ? `${data.provider} · ${data.model}` : undefined,
            },
      ]);
    } catch (e) {
      setMessages([
        ...history,
        {
          role: "assistant",
          content: `De coach is niet bereikbaar. Controleer je internetverbinding en probeer het opnieuw. (${
            e instanceof Error ? e.message : e
          })`,
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <section
      aria-label={`Coach: ${contextLabel}`}
      className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel)]"
    >
      <header className="flex items-baseline gap-2 border-b border-[var(--border)] px-4 py-3 text-sm">
        <h2 className="font-semibold">Coach</h2>
        <span className="truncate text-[var(--muted)]">{contextLabel}</span>
      </header>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4 sm:max-h-[420px]" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-[var(--muted)]">{intro}</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              title={m.meta}
              className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-[15px] leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-[var(--accent)] text-[var(--on-accent)]"
                  : m.error
                    ? "rounded-bl-md border border-[var(--danger)] text-[var(--danger)]"
                    : "rounded-bl-md bg-[var(--bg)]"
              }`}
            >
              {m.content}
            </div>
            {m.warnings && m.warnings.length > 0 && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--warning)]">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {m.warnings.join(" · ")}
              </p>
            )}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {status}
          </p>
        )}
      </div>
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="min-h-12 sm:min-h-11 rounded-full border border-[var(--border)] px-4 text-sm hover:bg-[var(--bg)] disabled:opacity-45"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t border-[var(--border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Vraag aan de coach
        </label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Vraag de coach…"
          enterKeyHint="send"
          className="min-h-12 sm:min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3"
        />
        <button
          disabled={busy || !input.trim()}
          aria-label="Verstuur vraag"
          className="inline-flex size-12 sm:size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-45"
        >
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}

export const CHAT_INTRO_MOVE =
  "Vraag waarom deze zet goed of slecht was. Noem je een andere zet (bv. “wat als Nf3?”), dan rekent Stockfish die eerst door.";
