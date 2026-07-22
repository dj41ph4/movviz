# Movviz — Mémoire pour assistants IA

## Description
Plateforme multimédia unifiée (découverte TMDb, indexeurs Torznab, bibliothèque films+séries, demandes multi-utilisateurs, moteur de téléchargement intégré, Plex). UI cinématographique premium, français principal.

## Stack
- Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + Framer Motion + lucide-react + SWR
- i18n maison (src/i18n/) — 5 langues (fr/en/it/nl/de)
- Moteur BitTorrent : service dédié engine/ (ESM pur, package isolé, transport = webtorrent)
- Ports : web 9810 (MOVVIZ_WEB_PORT), moteur 9820 (MOVVIZ_ENGINE_PORT), pairs BT 51413/51414 (MOVVIZ_TORRENT_PORT)

## Règles absolues
- Aucun crédit d'assistant IA nulle part (code, commits, doc, UI). PAS de Co-Authored-By.
- Aucune référence aux suites *arr (Sonarr/Radarr/etc.) dans code/commits/UI
- Code 100% original, zéro ligne copiée
- Aucune chaîne UI en dur → tout passe par i18n (clés FR + EN)
- Messages de commit, description repo, commentaires workflows, CHANGELOG en français
- CHANGELOG.md tenu à jour à chaque modif livrée (langage non-développeur)
- Toute fonctionnalité IA future doit rester invisible tant que non activée dans Réglages
- Intégrale (complete-series pack) : chaîne complète implémentée (moteur → torznab → grab → import → UI bouton + i18n). Typecheck + build OK.

## Versions
- Source unique : package.json (version.json supprimé le 2026-07-17)
- Exposé aux composants client via VersionContext (src/lib/version/VersionContext.tsx)
- getAppVersion() dans src/lib/updates/version.ts (lecture serveur de package.json)

## Workflow de release
1. Bump package.json version → commit "Bump version to X.Y.Z"
2. git push
3. git tag vX.Y.Z && git push origin vX.Y.Z
4. Le tag déclenche windows-installer.yml (build Inno Setup + GitHub Release)
5. Le push sur main déclenche docker-publish.yml

## i18n
- Dictionary (types.ts) force la parité structurelle entre fichiers via TypeScript
- t("chemin.faux") ne génère PAS d'erreur build — affiche le chemin brut à l'écran
- Drapeaux SVG dessinés à la main (FlagIcon.tsx) — pas d'emoji drapeau (Windows ne les supporte pas)

## Sécurité API
- middleware.ts protège /api/* (401 si pas de cookie session)
- Allowlist publique : /api/auth/login|register|logout|me, /api/auth/plex/pin|poll, /api/healthz, /api/features/public
- Routes sensibles ont aussi leur propre requireUser/requireAdmin

## Persistance
- Écritures atomiques via writeJsonCached() dans src/lib/fsJsonCache.ts (.tmp + rename)
- Toute lecture de store JSON côté web via readJsonCached() (cache mémoire validé mtime/size)
- Pas de fs.writeFileSync direct pour les stores JSON

## Architecture clé
- middleware.ts tourne en Edge runtime : ne JAMAIS y importer un store fs
- État partagé inter-routes ancré sur globalThis
- Cache TMDb : stale-while-revalidate via getStale()
- Grosses listes UI : rendu progressif (100 cartes puis requestIdleCallback)
