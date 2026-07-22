"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useT } from "@/i18n/provider";
import { Folder, HardDrive, ArrowUp, X, Loader2, FileVideo } from "lucide-react";

interface Listing {
  path: string;
  parent: string | null;
  isRoot: boolean;
  drives: string[];
  dirs: { name: string; path: string }[];
  files: { name: string; path: string }[];
}

/**
 * Lets the user browse the server's filesystem and pick a specific video
 * file — used when automatic matching (by name or computed path) can't find
 * a broken library entry's real file, e.g. because it now sits in a folder
 * named for a completely different title after a bad rename.
 */
export function RepairFileBrowserModal({
  initial, onCancel, onChoose,
}: {
  initial: string;
  onCancel: () => void;
  onChoose: (path: string) => void;
}) {
  const t = useT();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  const browse = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/library/repair-paths/browse?path=${encodeURIComponent(p)}`, { cache: "no-store" });
      setListing(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { browse(initial); }, [browse, initial]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl glass-strong shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-bold text-ink">{t("repairPaths.browseTitle")}</h3>
          <button onClick={onCancel} className="text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
          <button
            onClick={() => listing?.parent !== null && browse(listing?.parent ?? "")}
            disabled={loading || (listing && listing.parent === null) || false}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass text-ink-soft transition-colors hover:text-ink disabled:opacity-30"
            title={t("settings.parentFolder")}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-1.5 text-xs text-ink-soft">
            {listing?.path || t("settings.drives")}
          </code>
        </div>

        {listing && listing.drives.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-5 py-3">
            {listing.drives.map((d) => (
              <button
                key={d}
                onClick={() => browse(d)}
                className="flex items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-brand-glow"
              >
                <HardDrive className="h-3.5 w-3.5" /> {d}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[180px] flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-ink-dim"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : listing && (listing.dirs.length > 0 || listing.files.length > 0) ? (
            <>
              {listing.dirs.map((d) => (
                <button
                  key={d.path}
                  onClick={() => browse(d.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <Folder className="h-4 w-4 shrink-0 text-brand-glow" />
                  <span className="truncate">{d.name}</span>
                </button>
              ))}
              {listing.files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => onChoose(f.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-brand/10 hover:text-brand-glow"
                  title={t("repairPaths.selectFile")}
                >
                  <FileVideo className="h-4 w-4 shrink-0 text-cyan" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-ink-dim">{t("repairPaths.noFiles")}</div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-white/10 px-5 py-4">
          <button onClick={onCancel} className="rounded-xl glass px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
            {t("settings.cancel")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
