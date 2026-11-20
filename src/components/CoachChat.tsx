"use client";

import { useId, useState } from "react";
import { LoaderCircle, SendHorizontal, TriangleAlert } from "lucide-react";
import type { ChatMessage, CoachFacts, CoachResponse } from "@/lib/coach/types";
import { loadSettings } from "@/lib/client/settings";

interface Props {
  placeholder: string; // bv. "Vraag iets over 3. Nf3"
  buildFacts: (question: string) => Promise<CoachFacts>;
  suggestions?: string[];
}

interface UiMessage extends ChatMessage {
  warnings?: string[];
  meta?: string;
  error?: boolean;
}

/** Chat met de coach. Geef een `key` mee per context zodat het gesprek reset bij een andere zet. */
export function CoachChat({ placeholder, buildFacts, suggestions = [] }: Props) {
  const inputId = useId();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: UiMessage[] = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const facts = await buildFacts(question);
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
    } catch {
      setMessages([...history, { role: "assistant", content: "Geen verbinding met de coach.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Coach" className="space-y-3">
      {messages.length > 0 && (
        <div className="space-y-3" aria-live="polite">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-[15px] text-[var(--on-accent)]">
                {m.content}
              </p>
            ) : (
              <div key={i} title={m.meta}>
                <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${m.error ? "text-[var(--danger)]" : ""}`}>
                  {m.content}
                </p>
                {m.warnings && m.warnings.length > 0 && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-[var(--warning)]">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                    {m.warnings.join(" · ")}
                  </p>
                )}
              </div>
            ),
          )}
          {busy && <LoaderCircle className="size-4 animate-spin text-[var(--muted)]" aria-label="Coach denkt na" />}
        </div>
      )}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="min-h-12 rounded-full bg-[var(--panel)] px-4 text-sm hover:bg-[var(--border)] disabled:opacity-45 sm:min-h-11"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
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
          placeholder={placeholder}
          enterKeyHint="send"
          className="min-h-12 min-w-0 flex-1 rounded-lg bg-[var(--panel)] px-3 sm:min-h-11"
        />
        <button
          disabled={busy || !input.trim()}
          aria-label="Verstuur vraag"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-45 sm:size-11"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <SendHorizontal className="size-5" aria-hidden />}
        </button>
      </form>
    </section>
  );
}
