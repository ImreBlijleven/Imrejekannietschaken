"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Download, Minus, Plus, Upload } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import { loadSettings, saveSettings, type Settings } from "@/lib/client/settings";
import type { ExportFile } from "@/lib/db/types";
import { Button, IconButton } from "./ui";

const DEPTH_MIN = 10;
const DEPTH_MAX = 20;

export function SettingsView() {
  const repo = useMemo(() => getRepository(), []);
  const depthId = useId();
  const tokenId = useId();
  // Alleen in de browser renderen (localStorage bestaat niet op de server).
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isClient) return null;
  if (!settings) {
    setSettings(loadSettings());
    return null;
  }

  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    setSaved(true);
  };
  const setDepth = (d: number) => update({ ...settings, engineDepth: Math.max(DEPTH_MIN, Math.min(DEPTH_MAX, d)) });

  async function doExport() {
    const data = await repo.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `schaakcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ text: `${data.games.length} partijen geëxporteerd.` });
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as ExportFile;
      const res = await repo.importAll(data);
      setMsg({ text: `${res.games} partijen geïmporteerd.` });
    } catch (e) {
      setMsg({ text: `Importeren mislukt: ${e instanceof Error ? e.message : e}`, error: true });
    }
  }

  const row = "space-y-3 py-5";
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="flex items-baseline justify-between pb-2 text-3xl font-bold tracking-tight">
        Instellingen
        {saved && (
          <span className="flex items-center gap-1 text-sm font-normal tracking-normal text-good" role="status">
            <Check className="size-4" aria-hidden /> Opgeslagen
          </span>
        )}
      </h1>

      <div className="divide-y divide-[var(--border)]">
        <section className={row}>
          <div className="flex items-baseline justify-between">
            <label htmlFor={depthId} className="font-medium">
              Rekendiepte
            </label>
            <span className="num font-semibold">{settings.engineDepth}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="Minder diep" onClick={() => setDepth(settings.engineDepth - 1)} disabled={settings.engineDepth <= DEPTH_MIN}>
              <Minus className="size-5" aria-hidden />
            </IconButton>
            <input
              id={depthId}
              type="range"
              min={DEPTH_MIN}
              max={DEPTH_MAX}
              value={settings.engineDepth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="h-12 w-full sm:h-11"
            />
            <IconButton label="Dieper" onClick={() => setDepth(settings.engineDepth + 1)} disabled={settings.engineDepth >= DEPTH_MAX}>
              <Plus className="size-5" aria-hidden />
            </IconButton>
          </div>
        </section>

        <section className={row}>
          <label htmlFor={tokenId} className="block font-medium">
            Wachtwoord coach
          </label>
          <input
            id={tokenId}
            type="password"
            autoComplete="current-password"
            value={settings.coachToken}
            onChange={(e) => update({ ...settings, coachToken: e.target.value })}
            className="min-h-12 w-full rounded-lg bg-[var(--panel)] px-3 sm:min-h-11"
          />
        </section>

        <section className={row}>
          <h2 className="font-medium">Backup</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={doExport}>
              <Download className="size-4" aria-hidden /> Exporteren
            </Button>
            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 text-sm hover:bg-[var(--bg)] focus-within:outline focus-within:outline-2 focus-within:outline-[var(--accent)] sm:min-h-11">
              <Upload className="size-4" aria-hidden /> Importeren
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
              />
            </label>
          </div>
          {msg && (
            <p className={`text-sm ${msg.error ? "text-[var(--danger)]" : "text-[var(--muted)]"}`} role="status">
              {msg.text}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
