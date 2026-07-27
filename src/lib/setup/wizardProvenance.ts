import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * Tracks which release-rules fields the setup wizard itself wrote, so the
 * "Relancer l'assistant" smart re-optimization (LOT4.2) can skip anything the
 * user has since edited manually — a value with no "wizard" provenance is
 * left untouched. Deliberately a small, closed set of fields (not a generic
 * tracked-everything system): only what wizardProfileStep/wizardHardwareStep
 * actually write.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "wizard-provenance.json");

export type WizardTrackedField =
  | "codecScores.x264"
  | "codecScores.x265"
  | "codecScores.av1"
  | "maxMovieSizeMb"
  | "maxEpisodeSizeMb"
  | "maxSeasonSizeMb";

export type WizardProvenance = Partial<Record<WizardTrackedField, "wizard" | "manual">>;

export function loadWizardProvenance(): WizardProvenance {
  return readJsonCached<WizardProvenance>(FILE, {});
}

/** Called only by the wizard itself, right after it writes a field's value. */
export function markWizardWritten(fields: WizardTrackedField[]): void {
  const current = loadWizardProvenance();
  for (const f of fields) current[f] = "wizard";
  writeJsonCached(FILE, current);
}

/** Called whenever a field changes through a NON-wizard path (e.g. ReleaseRulesPanel) — demotes it to "manual" so a future smart re-optimization leaves it alone. */
export function markManuallyEdited(fields: WizardTrackedField[]): void {
  const current = loadWizardProvenance();
  for (const f of fields) current[f] = "manual";
  writeJsonCached(FILE, current);
}
