import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { tmdbConfigured } from "@/lib/metadata/tmdb";
import { loadIndexers } from "@/lib/indexers/store";
import { testIndexer } from "@/lib/indexers/torznab";
import { loadReleaseRules } from "@/lib/library/releaseRules";
import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";
import { loadLibraryHealthReport, type LibraryHealthIssue, type LibraryHealthReport } from "@/lib/library/libraryHealthCheck";
import { getDecisionLog } from "@/lib/library/decisionLog";

/**
 * Doctor Movviz (LOT4.4) — a single on-demand analysis pass that reuses only
 * data already collected elsewhere (health checks, library-health-check,
 * decision log, config) — no new collection mechanism. Deliberately
 * synchronous with the button click (never polled automatically), per the
 * session's "must stay fast" constraint.
 */

export interface DoctorRecommendation {
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface DoctorReport {
  ranAt: number;
  recommendations: DoctorRecommendation[];
  config: {
    tmdbConfigured: boolean;
    indexers: { name: string; ok: boolean }[];
    blockedWordsCount: number;
    codecScores: { x264: number; x265: number; av1: number };
    qualityProfiles: { name: string; minScore: number; allowedResolutions: string[] }[];
  };
  /** Summary only: per-kind counts plus the first issues as examples — the
   *  full list (tens of thousands on a large library, 6 MB in prod) is never
   *  shown by the Doctor panel. */
  libraryHealth: (Omit<LibraryHealthReport, "issues"> & {
    issues: LibraryHealthIssue[];
    issuesTotal: number;
    issueCounts: Partial<Record<LibraryHealthIssue["kind"], number>>;
  }) | null;
  recentDecisions: ReturnType<typeof getDecisionLog>;
}

const LIBRARY_HEALTH_EXAMPLES = 50;

export async function runDoctorAnalysis(): Promise<DoctorReport> {
  const recommendations: DoctorRecommendation[] = [];

  const engineOk = await fetch(`${ENGINE_BASE}/health`, { headers: engineHeaders(), cache: "no-store" })
    .then((r) => r.ok)
    .catch(() => false);
  if (!engineOk) {
    recommendations.push({ severity: "critical", message: "Le moteur de téléchargement est injoignable — aucune recherche ni téléchargement automatique ne peut aboutir tant qu'il n'est pas relancé." });
  }

  if (!tmdbConfigured()) {
    recommendations.push({ severity: "warning", message: "Aucune clé TMDb configurée — Découverte et les métadonnées utilisent la clé par défaut, limitée. Réglages → Métadonnées." });
  }

  const enabledIndexers = loadIndexers().filter((i) => i.enabled);
  const indexerResults = await Promise.all(
    enabledIndexers.map(async (ix) => ({ name: ix.name, key: ix.key, ok: ix.key === "extto" ? ix.lastTest?.ok === true : (await testIndexer(ix)).ok }))
  );
  const failing = indexerResults.filter((r) => !r.ok);
  if (enabledIndexers.length === 0) {
    recommendations.push({ severity: "critical", message: "Aucun indexeur configuré — la recherche automatique et manuelle ne peuvent rien trouver. Réglages → Indexeurs." });
  } else if (failing.length > 0) {
    for (const f of failing) {
      recommendations.push({ severity: "warning", message: f.key === "extto"
        ? `Indexeur « ${f.name} » en échec — tester la connexion EXT.to dans Réglages → Indexeurs pour voir l'erreur de session ou d'accès.`
        : `Indexeur « ${f.name} » en échec — vérifier son URL/clé API, ou le désactiver s'il n'est plus valide. Réglages → Indexeurs.` });
    }
  }

  const rules = loadReleaseRules();
  const veryHighMinScore = DEFAULT_QUALITY_PROFILES.filter((p) => p.minScore >= 70);
  if (veryHighMinScore.length === DEFAULT_QUALITY_PROFILES.length) {
    recommendations.push({ severity: "info", message: "Tous les profils de qualité ont un score minimum élevé (≥70) — si des recherches restent bloquées sans résultat, c'est un point à vérifier en premier." });
  }

  const libraryHealth = loadLibraryHealthReport();
  if (libraryHealth && libraryHealth.issues.length > 0) {
    const inconsistent = libraryHealth.issues.filter((i) => i.kind === "inconsistent_status").length;
    const stillUpcoming = libraryHealth.issues.filter((i) => i.kind === "released_still_upcoming").length;
    if (inconsistent > 0) {
      recommendations.push({ severity: "warning", message: `${inconsistent} entrée(s) ont un statut incohérent (ex. "disponible" sans fichier) — voir le diagnostic bibliothèque.` });
    }
    if (stillUpcoming > 0) {
      recommendations.push({ severity: "info", message: `${stillUpcoming} entrée(s) sont sorties mais toujours marquées "à venir" — seront rattrapées à la prochaine recherche des sorties du jour, ou lancer le diagnostic bibliothèque manuellement.` });
    }
  } else if (!libraryHealth) {
    recommendations.push({ severity: "info", message: "Le diagnostic bibliothèque n'a jamais encore été lancé — Réglages → Tâches → « Diagnostic bibliothèque » pour un premier état des lieux." });
  }

  if (recommendations.length === 0) {
    recommendations.push({ severity: "info", message: "Rien à signaler — la configuration et la bibliothèque semblent cohérentes." });
  }

  return {
    ranAt: Date.now(),
    recommendations,
    config: {
      tmdbConfigured: tmdbConfigured(),
      indexers: indexerResults,
      blockedWordsCount: rules.blockedWords.length,
      codecScores: rules.codecScores,
      qualityProfiles: DEFAULT_QUALITY_PROFILES.map((p) => ({ name: p.name, minScore: p.minScore, allowedResolutions: p.allowedResolutions })),
    },
    libraryHealth: libraryHealth
      ? {
          ...libraryHealth,
          issues: libraryHealth.issues.slice(0, LIBRARY_HEALTH_EXAMPLES),
          issuesTotal: libraryHealth.issues.length,
          issueCounts: libraryHealth.issues.reduce<Partial<Record<LibraryHealthIssue["kind"], number>>>((acc, i) => {
            acc[i.kind] = (acc[i.kind] ?? 0) + 1;
            return acc;
          }, {}),
        }
      : null,
    recentDecisions: getDecisionLog(15),
  };
}
