"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { getRepository } from "@/lib/db/dexie-repository";
import { loadSettings, saveSettings, type Settings } from "@/lib/client/settings";
import type { ExportFile } from "@/lib/db/types";

export function SettingsView() {
  const repo = useMemo(() => getRepository(), []);
  // Alleen in de browser renderen (localStorage bestaat niet op de server).
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");

  if (!isClient) return null;
  if (!settings) {
    setSettings(loadSettings());
    return null;
  }

  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  async function doExport() {
    const data = await repo.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `schaakcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`Backup gemaakt: ${data.games.length} partijen, ${data.mistakes.length} fouten.`);
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as ExportFile;
      const res = await repo.importAll(data);
      setMsg(`Geïmporteerd: ${res.games} partijen en ${res.mistakes} fouten bijgewerkt.`);
    } catch (e) {
      setMsg(`Import mislukt: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold">Instellingen</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Analyse</h2>
        <label className="block text-sm">
          Diepte Stockfish: <span className="font-mono">{settings.engineDepth}</span>
          <input
            type="range"
            min={10}
            max={20}
            value={settings.engineDepth}
            onChange={(e) => update({ ...settings, engineDepth: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <p className="text-xs text-[var(--muted)]">Hoger = nauwkeuriger maar trager. 14 is een goede balans.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Coach-wachtwoord</h2>
        <input
          type="password"
          value={settings.coachToken}
          onChange={(e) => update({ ...settings, coachToken: e.target.value })}
          placeholder="Alleen nodig als COACH_ACCESS_TOKEN op de server is ingesteld"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-[var(--muted)]">
          Je partijen en foutpatronen staan alleen in deze browser. Maak af en toe een backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={doExport} className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm">
            Exporteren
          </button>
          <label className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm cursor-pointer">
            Importeren
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </label>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </section>
    </div>
  );
}
