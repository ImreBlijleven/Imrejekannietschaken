"use client";

import { useState } from "react";
import type { ChatMessage, CoachFacts, CoachResponse } from "@/lib/coach/types";
import { loadSettings } from "@/lib/client/settings";

interface Props {
  contextLabel: string; // bv. "Zet 12... Nf6" of "Huidige stelling"
  buildFacts: (question: string) => Promise<CoachFacts>;
  suggestions?: string[];
}

interface UiMessage extends ChatMessage {
  warnings?: string[];
  meta?: string;
  error?: boolean;
}

/** Chat met de coach. Geef een `key` mee per context zodat het gesprek reset bij een andere zet. */
export function CoachChat({ contextLabel, buildFacts, suggestions = [] }: Props) {
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
      setStatus("Stockfish analyseert…");
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
      if (data.error) {
        setMessages([...history, { role: "assistant", content: data.error, error: true }]);
      } else {
        setMessages([
          ...history,
          {
            role: "assistant",
            content: data.answer,
            warnings: data.warnings,
            meta: data.provider ? `${data.provider} · ${data.model}` : undefined,
          },
        ]);
      }
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", content: `Er ging iets mis: ${e instanceof Error ? e.message : e}`, error: true },
      ]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel)] min-h-[240px] sm:min-h-[320px]">
      <div className="px-4 py-2 border-b border-[var(--border)] text-sm">
        <span className="font-semibold">Coach</span>
        <span className="text-[var(--muted)]"> · {contextLabel}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[55vh] sm:max-h-[420px]">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Stel een vraag over deze zet. Noem een zet (bv. &ldquo;wat als Nf3?&rdquo;) en Stockfish analyseert hem
            eerst. Zetten staan in Engelse notatie (N = paard, B = loper, R = toren, Q = dame).
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block text-left whitespace-pre-wrap rounded-lg px-3 py-2 text-sm max-w-[95%] ${
                m.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : m.error
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : "bg-[var(--bg)]"
              }`}
            >
              {m.content}
            </div>
            {m.warnings && m.warnings.length > 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">⚠️ {m.warnings.join(" · ")}</p>
            )}
            {m.meta && <p className="mt-1 text-[10px] text-[var(--muted)]">{m.meta}</p>}
          </div>
        ))}
        {busy && <p className="text-sm text-[var(--muted)] animate-pulse">{status}</p>}
      </div>
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="text-sm sm:text-xs rounded-full border border-[var(--border)] px-3 py-1.5 sm:py-1 hover:bg-[var(--bg)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 p-3 border-t border-[var(--border)]"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Vraag de coach…"
          className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          Vraag
        </button>
      </form>
    </div>
  );
}
