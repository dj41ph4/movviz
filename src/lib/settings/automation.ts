import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "automation-config.json");

interface AutomationConfig {
  /** Global, server-wide kill switch for the 3 scheduled tasks that search
   *  and grab MISSING content on their own (scan RSS, retry manquants,
   *  sorties du jour) — explicit admin request ("désactiver le
   *  téléchargement automatique des manquants"). Default true; existing
   *  configurations are re-enabled once by the default-version migration.
   *  An admin can still explicitly turn this off afterwards.
   *  Never touches quality-upgrade automation (auto-upgrade-all) or Plex/
   *  metadata sync — those aren't "download something that's missing". A
   *  title's own `monitored` flag and manual "Rechercher" buttons are
   *  unaffected either way — this only gates the unattended background
   *  passes. */
  autoSearchMissingEnabled: boolean;
}

const DEFAULT: AutomationConfig = { autoSearchMissingEnabled: true };
const DEFAULT_VERSION = 1;
type StoredAutomationConfig = Partial<AutomationConfig> & { autoSearchMissingDefaultVersion?: number };

function load(): AutomationConfig {
  const stored = readJsonCached<StoredAutomationConfig>(FILE, {});
  if ((stored.autoSearchMissingDefaultVersion ?? 0) < DEFAULT_VERSION) {
    // One-time reset requested for existing installations. Persist the marker
    // so an explicit opt-out made afterwards survives reads and restarts.
    save(DEFAULT);
    return { ...DEFAULT };
  }
  return { autoSearchMissingEnabled: stored.autoSearchMissingEnabled ?? DEFAULT.autoSearchMissingEnabled };
}

function save(cfg: AutomationConfig) {
  writeJsonCached(FILE, { ...cfg, autoSearchMissingDefaultVersion: DEFAULT_VERSION });
}

export function isAutoSearchMissingEnabled(): boolean {
  return load().autoSearchMissingEnabled;
}

export function setAutoSearchMissingEnabled(enabled: boolean): AutomationConfig {
  const cfg = { ...load(), autoSearchMissingEnabled: !!enabled };
  save(cfg);
  return cfg;
}
