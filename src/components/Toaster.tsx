"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number; // ms
}

// Kleine store buiten React, zodat elke component een toast kan tonen.
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(t: Omit<Toast, "id">): number {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { ...t, id }]; // maximaal 3 tegelijk
  emit();
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function ToastItem({ toast }: { toast: Toast }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true)); // inkomen via transition (onderbreekbaar)
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration ?? 8000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [toast.id, toast.duration]);

  return (
    <div
      className={`pointer-events-auto flex min-h-12 items-center gap-2 rounded-xl bg-[var(--fg)] py-1.5 pl-4 pr-1.5 text-sm text-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-200 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick();
            dismissToast(toast.id);
          }}
          className="min-h-12 sm:min-h-11 shrink-0 rounded-lg px-3 font-semibold text-[var(--accent-soft)] hover:bg-white/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Melding sluiten"
        className="inline-flex size-12 sm:size-11 shrink-0 items-center justify-center rounded-lg opacity-70 hover:bg-white/10 hover:opacity-100"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Plek voor meldingen: boven de tabbalk op de telefoon, rechtsonder op de computer. */
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] safe-x z-30 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
    >
      {list.map((t) => (
        <div key={t.id} className="w-full max-w-md">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
