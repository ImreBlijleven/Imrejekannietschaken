"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Download, Minus, Plus, Upload } from "lucide-react";
import { getRepository } from "@/lib/db/dexie-repository";
import { loadSettings, saveSettings, type Settings } from "@/lib/client/settings";
import type { ExportFile } from "@/lib/db/types";
import { Button, Card, IconButton } from "./ui";

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
    setMsg({ text: `Backup gemaakt: ${data.games.length} partijen en ${data.mistakes.length} fouten.` });
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as ExportFile;
      const res = await repo.importAll(data);
      setMsg({ text: `Teruggezet: ${res.games} partijen en ${res.mistakes} fouten bijgewerkt.` });
    } catch (e) {
      setMsg({
        text: `Terugzetten mislukt: ${e instanceof Error ? e.message : e}. Kies een backupbestand van Schaakcoach (.json).`,
        error: true,
      });
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Instellingen</h1>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-good" role="status">
            <Check className="size-4" aria-hidden /> Opgeslagen
          </span>
        )}
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Analyse</h2>
        <div className="flex items-baseline justify-between text-sm">
          <label htmlFor={depthId}>Rekendiepte Stockfish</label>
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
            className="h-11 w-full"
          />
          <IconButton label="Dieper" onClick={() => setDepth(settings.engineDepth + 1)} disabled={settings.engineDepth >= DEPTH_MAX}>
            <Plus className="size-5" aria-hidden />
          </IconButton>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          Hoger is nauwkeuriger maar trager. 12 is een goede balans op de telefoon, 14 op de computer.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Coach</h2>
        <label htmlFor={tokenId} className="block text-sm">
          Wachtwoord coach
        </label>
        <input
          id={tokenId}
          type="password"
          autoComplete="current-password"
          value={settings.coachToken}
          onChange={(e) => update({ ...settings, coachToken: e.target.value })}
          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3"
        />
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          Alleen nodig als de site online staat en er een wachtwoord is ingesteld (in Vercel als
          COACH_ACCESS_TOKEN). Wordt alleen op dit apparaat bewaard.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-[var(--muted)]">
          Je partijen en foutpatronen staan alleen in deze browser. Maak af en toe een backup.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={doExport}>
            <Download className="size-4" aria-hidden /> Backup maken
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 text-sm hover:bg-[var(--bg)] focus-within:outline focus-within:outline-2 focus-within:outline-[var(--accent)]">
            <Upload className="size-4" aria-hidden /> Terugzetten
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </label>
        </div>
        {msg && (
          <p className={`text-sm ${msg.error ? "text-[var(--danger)]" : ""}`} role="status">
            {msg.text}
          </p>
        )}
      </Card>
    </div>
  );
}
