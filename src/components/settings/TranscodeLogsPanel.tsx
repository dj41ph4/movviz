"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, Radio } from "lucide-react";

interface LogEntry { time: number; ratingKey: string; step: string; detail: string; status: number | "ok" | "warn" }

export function TranscodeLogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const load = async () => {
    try {
      const res = await fetch("/api/diagnostics/transcode-logs");
      setLogs((await res.json()).logs ?? []);
    } catch { }
  };

  useEffect(() => { load(); }, []);

  const clear = async () => {
    await fetch("/api/diagnostics/transcode-logs", { method: "DELETE" });
    setLogs([]);
  };

  if (!logs.length) return null;

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/12 text-cyan">
            <Radio className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">Logs transcode</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{logs.length} entrée(s)</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={load} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:text-ink transition-colors"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={clear} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:text-down transition-colors"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-1 max-h-96 overflow-auto rounded-xl glass p-3">
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${l.status === "ok" ? "bg-ok" : l.status === "warn" ? "bg-amber" : "bg-down"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink-soft">{l.ratingKey}</span>
                <span className="text-[10px] text-ink-dim">{l.step}</span>
              </div>
              <p className="truncate text-[11px] text-ink-dim">{l.detail}</p>
            </div>
            <span className="shrink-0 text-[10px] text-ink-dim">{new Date(l.time).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
