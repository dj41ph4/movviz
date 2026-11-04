import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * Consentement explicite à la politique de confidentialité et à la licence.
 *
 * Exigé uniquement quand `MOVVIZ_REQUIRE_PRIVACY_CONSENT=1` — variable posée par le
 * paquet UGREEN (UPK), dont l'App Center impose un consentement actif au premier
 * lancement. Toutes les autres installations (Docker, Synology, Windows, Linux…)
 * gardent exactement leur comportement actuel : aucune case, aucun refus.
 */

/** À incrémenter quand la politique change de façon à justifier un nouveau consentement. */
export const PRIVACY_POLICY_VERSION = "2026-11-04";

export function privacyConsentRequired(): boolean {
  return process.env.MOVVIZ_REQUIRE_PRIVACY_CONSENT === "1";
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "privacy-consent.json");

export interface ConsentRecord {
  version: string;
  /** Horodatage ISO de l'acceptation. */
  acceptedAt: string;
  /** Compte qui a accepté (absent tant que le premier compte n'existe pas encore). */
  userId?: string;
}

interface ConsentFile {
  /** Acceptation faite à l'installation, avant la création du premier compte. */
  instance?: ConsentRecord;
  /** Acceptation de chaque compte créé ensuite, par identifiant. */
  users?: Record<string, ConsentRecord>;
}

function load(): ConsentFile {
  return readJsonCached<ConsentFile>(FILE, {});
}

export function getInstanceConsent(): ConsentRecord | null {
  return load().instance ?? null;
}

/** Vrai si l'installation a accepté la version courante de la politique. */
export function hasCurrentInstanceConsent(): boolean {
  return getInstanceConsent()?.version === PRIVACY_POLICY_VERSION;
}

export function recordInstanceConsent(): ConsentRecord {
  const record: ConsentRecord = { version: PRIVACY_POLICY_VERSION, acceptedAt: new Date().toISOString() };
  writeJsonCached(FILE, { ...load(), instance: record });
  return record;
}

/** Associe l'acceptation à un compte (créé après coup, ou inscrit avec la case cochée). */
export function recordUserConsent(userId: string): void {
  const file = load();
  const record: ConsentRecord = { version: PRIVACY_POLICY_VERSION, acceptedAt: new Date().toISOString(), userId };
  writeJsonCached(FILE, {
    ...file,
    // Première acceptation de l'installation : elle fait aussi foi pour l'instance (création du premier compte).
    instance: !file.instance ? record : file.instance.userId ? file.instance : { ...file.instance, userId },
    users: { ...(file.users ?? {}), [userId]: record },
  });
}
