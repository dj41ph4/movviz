"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { Download, Upload, Loader2 } from "lucide-react";

export function BackupSettings() {
  const t = useT();
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    window.location.href = "/api/backup";
  };

  const onFile = async (file: File) => {
    setRestoring(true);
    setMessage(null);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setMessage(res.ok ? t("backup.restored") : t("backup.restoreFailed"));
    } catch {
      setMessage(t("backup.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <p className="mb-4 text-sm text-ink-dim">{t("backup.intro")}</p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportBackup}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white"
        >
          <Download className="h-4 w-4" /> {t("backup.export")}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
          className="flex h-10 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft disabled:opacity-50"
        >
          {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t("backup.restore")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>
      <p className="mt-3 text-xs text-amber">{t("backup.restoreWarning")}</p>
      {message && <p className="mt-2 text-sm text-ink-soft">{message}</p>}
    </div>
  );
}
