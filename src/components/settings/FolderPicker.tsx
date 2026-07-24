"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Folder, FolderOpen, HardDrive, ArrowUp, Check, X, Loader2 } from "lucide-react";

interface Listing {
  path: string;
  parent: string | null;
  isRoot: boolean;
  drives: string[];
  dirs: { name: string; path: string }[];
}

/**
 * Cross-OS folder field. On Windows the user browses the server's drives and
 * folders (select); on Linux/NAS they type the absolute path (write). The path
 * is always editable by hand too, so nothing is ever locked to one method.
 */
export function FolderPicker({
  value,
  onChange,
  mode,
  mono = true,
}: {
  value: string;
  onChange: (v: string) => void;
  mode: "browse" | "write";
  mono?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const input = cn(
    "h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand/40",
    mono && "font-mono text-xs"
  );

  if (mode === "write") {
    return (
      <div>
        <input value={value} onChange={(e) => onChange(e.target.value)} className={input} placeholder={t("settings.typePathHint")} />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} className={input} />
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl glass px-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
        >
          <FolderOpen className="h-4 w-4" /> {t("settings.browse")}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <BrowseModal
            initial={value}
            onCancel={() => setOpen(false)}
            onChoose={(p) => { onChange(p); setOpen(false); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function BrowseModal({
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
      const res = await fetch(`/api/system/browse?path=${encodeURIComponent(p)}`, { cache: "no-store" });
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
          <h3 className="font-bold text-ink">{t("settings.folderPickerTitle")}</h3>
          <button onClick={onCancel} className="text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        {/* Current path + up */}
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

        {/* Drives (Windows) */}
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

        {/* Folder list */}
        <div className="min-h-[180px] flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-ink-dim"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : listing && listing.dirs.length > 0 ? (
            listing.dirs.map((d) => (
              <button
                key={d.path}
                onClick={() => browse(d.path)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-white/5 hover:text-ink"
              >
                <Folder className="h-4 w-4 shrink-0 text-brand-glow" />
                <span className="truncate">{d.name}</span>
              </button>
            ))
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-ink-dim">{t("settings.emptyFolder")}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
          <button onClick={onCancel} className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm whitespace-nowrap">
            {t("settings.cancel")}
          </button>
          <button
            onClick={() => listing?.path && onChoose(listing.path)}
            disabled={!listing?.path}
            className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
          >
            <Check className="h-4 w-4" /> {t("settings.chooseFolder")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
