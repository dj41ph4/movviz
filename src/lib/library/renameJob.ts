import { enqueueJob, getJobsByType, isSourceActive } from "@/lib/jobs/queue";
import { scanRenames } from "./renameScan";
import { executeRenames } from "./renameExec";
import type { RenameCandidate } from "./renameScan";
import type { RenameResult } from "./renameExec";
import type { Job } from "@/lib/jobs/types";

const SOURCE_ID = "libraryRename";
const EXEC_SOURCE_ID = "libraryRenameExecute";

const g = globalThis as typeof globalThis & {
  __movvizRenameCandidates?: RenameCandidate[];
  __movvizRenameLanguage?: string;
  __movvizRenameLog?: string[];
  __movvizRenameExecLog?: string[];
  __movvizRenameExecResults?: { results: RenameResult[]; plexRefreshed: boolean } | null;
};

export function getRenameCandidates(): RenameCandidate[] {
  return g.__movvizRenameCandidates ?? [];
}
export function getRenameLanguage(): string {
  return g.__movvizRenameLanguage ?? "fr-FR";
}
export function getRenameLog(): string[] {
  return g.__movvizRenameLog ?? [];
}

export function isRenameScanRunning(): boolean {
  return isSourceActive(SOURCE_ID);
}

export function startRenameScan(language: string): Job {
  // Clear previous results
  delete g.__movvizRenameCandidates;
  delete g.__movvizRenameLanguage;
  delete g.__movvizRenameLog;

  return enqueueJob(
    "libraryRename",
    "Analyse de renommage",
    1,
    async (setProgress) => {
      const log: string[] = [];
      g.__movvizRenameLog = log;

      const candidates = await scanRenames(language, (current, total) => {
        setProgress(current, total);
      }, (msg) => {
        log.push(msg);
      });

      g.__movvizRenameCandidates = candidates;
      g.__movvizRenameLanguage = language;
      setProgress(1, 1);
    },
    SOURCE_ID
  );
}

export function isRenameExecuteRunning(): boolean {
  return isSourceActive(EXEC_SOURCE_ID);
}
export function getRenameExecuteLog(): string[] {
  return g.__movvizRenameExecLog ?? [];
}
export function getRenameExecuteResults(): { results: RenameResult[]; plexRefreshed: boolean } | null {
  return g.__movvizRenameExecResults ?? null;
}
export function getLatestRenameExecuteJob(): Job | null {
  return getJobsByType("libraryRename").find((j) => j.sourceId === EXEC_SOURCE_ID) ?? null;
}

export function startRenameExecute(
  selections: { id: string; type: "movie" | "series" }[],
  language: string
): Job {
  delete g.__movvizRenameExecLog;
  delete g.__movvizRenameExecResults;

  return enqueueJob(
    "libraryRename",
    `Application du renommage (${selections.length})`,
    selections.length,
    async (setProgress) => {
      const log: string[] = [];
      g.__movvizRenameExecLog = log;

      const result = await executeRenames(selections, language, (current, total) => {
        setProgress(current, total);
      }, (msg) => {
        log.push(msg);
      });

      g.__movvizRenameExecResults = result;
    },
    EXEC_SOURCE_ID
  );
}
