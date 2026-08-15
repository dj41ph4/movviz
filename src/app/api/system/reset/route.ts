import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";
import { CONFIG_DIR } from "@/lib/auth/store";
import { clearSessionCookie } from "@/lib/auth/session";
import { resetAllCaches } from "@/lib/fsJsonCache";

export const dynamic = "force-dynamic";

/**
 * Réinitialisation d'usine : revient à l'état « premier lancement » — le
 * wizard (page /setup) se réaffichera au prochain rechargement.
 *
 * Pourquoi un vrai reset serveur (et pas seulement « supprimer le dossier
 * config ») : le processus en cours garde TOUT son état en mémoire
 * (cache fsJsonCache ancré sur globalThis, écritures coalescées à 300 ms,
 * tâches de fond qui réécrivent les fichiers, session cookie toujours
 * valide). Supprimer le dossier à chaud est donc sans effet — les fichiers
 * reviennent depuis la mémoire en quelques millisecondes et l'app continue
 * de se croire configurée. Ce reset purge d'abord la mémoire, puis
 * supprime le dossier (suppression validée : chemin absolu + profondeur
 * suffisante), puis efface le cookie de session côté serveur.
 */
export async function POST(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const target = path.resolve(CONFIG_DIR);
  const parts = target.split(path.sep).filter(Boolean);
  // Garde de profondeur : le dossier config doit être un répertoire dédié
  // (ex: /home/user/.movviz-data → depth ≥ 2), jamais la racine du système
  // de fichiers ni le répertoire de travail.
  if (parts.length < 2) {
    return NextResponse.json({ error: "invalid_config_dir" }, { status: 500 });
  }

  // 1. Purge totale de la mémoire — avant la suppression, pour qu'aucune
  //    écriture coalescée en attente ne recrée les fichiers ensuite.
  resetAllCaches();

  // 2. Suppression du dossier config (validé ci-dessus).
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (e) {
    console.error("[api/system/reset] rmSync failed:", e);
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }

  // 3. Cookie de session effacé — au prochain chargement, plus aucun
  //    utilisateur ne résout : /api/auth/me répond setupRequired=true et
  //    l'AppShell redirige vers /setup (wizard).
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
