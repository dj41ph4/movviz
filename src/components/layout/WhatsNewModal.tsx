"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useVersion } from "@/lib/version/VersionContext";

interface ChangelogSection {
  heading: string;
  items: string[];
}
interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

const STORAGE_KEY = "movviz_last_seen_version";

/** CHANGELOG.md bullets use `**bold**` for emphasis (e.g. "**Sécurité :**") — no markdown lib in this project, so just handle that one case. */
function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

/**
 * Shown once per browser whenever the running app version doesn't match the
 * last one this browser saw — covers a Windows one-click update just as much
 * as a Docker/NAS re-pull, since both just change the version the server
 * reports. Content comes straight from CHANGELOG.md (see /api/system/changelog),
 * so it only ever exists in the French wording already required there.
 */
export function WhatsNewModal() {
  const t = useT();
  const version = useVersion();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!version || version === "0.0.0") return;
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen === version) return;
    // Deliberately no "first-ever launch, skip it" branch: this feature only
    // just shipped, so every existing browser starts with lastSeen === null —
    // treating that as "nothing to show" would mean nobody ever sees it.
    // Passing `since` pulls every version missed since the last time this
    // browser was open, not just the latest — someone who skipped several
    // releases sees the full story, not only the newest entry.
    const qs = lastSeen ? `?since=${encodeURIComponent(lastSeen)}` : "";
    fetch(`/api/system/changelog${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { entries: ChangelogEntry[] } | null) => {
        if (d?.entries && d.entries.length > 0) {
          setEntries(d.entries);
          setVisible(true);
        }
        localStorage.setItem(STORAGE_KEY, version);
      })
      .catch(() => {
        localStorage.setItem(STORAGE_KEY, version);
      });
  }, [version]);

  const close = () => setVisible(false);

  return (
    <AnimatePresence>
      {visible && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl glass-strong p-6 shadow-2xl"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-ink">{t("update.whatsNewTitle")}</h2>
                  <p className="text-xs text-ink-dim">
                    {entries.length > 1
                      ? t("update.whatsNewVersionRange", { from: entries[entries.length - 1].version, to: entries[0].version })
                      : t("update.whatsNewVersion", { version: entries[0].version })}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-dim ring-focus hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {entries.map((e) => (
                <div key={e.version}>
                  {entries.length > 1 && (
                    <p className="mb-2 text-xs font-black text-ink">v{e.version}</p>
                  )}
                  <div className="space-y-4">
                    {e.sections.map((section) => (
                      <div key={section.heading}>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-glow">{section.heading}</p>
                        <ul className="space-y-1.5">
                          {section.items.map((item, i) => (
                            <li key={i} className="text-sm leading-relaxed text-ink-soft">
                              • {renderBold(item)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={close}
              className="mt-6 flex h-11 w-full items-center justify-center rounded-xl brand-gradient text-sm font-bold text-white"
            >
              {t("update.whatsNewClose")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
