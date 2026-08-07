# Movviz Federation — plan d'implémentation (archivé)

> **Statut : planifié — non implémenté.** Ce document archive la conception validée
> le 07/08/2026 pour la fonctionnalité MOVVIZ FEDERATION. Aucun code n'a été écrit
> pour cette fonctionnalité à la date d'archivage.

## Objectif

Réseau privé entre instances Movviz : amis via Plex, recommandations, demandes de
téléchargement, disponibilité des médias et lecture via Plex. Chaque utilisateur
garde 100 % de son autonomie ; un seul code source (pas de Pro/Community/fork).

## Décisions validées (07/08/2026)

1. **Agent in-process** (pattern EventBus/globalThis) — pas de sous-processus.
2. **Opt-in** — désactivé par défaut, activé dans les réglages.
3. **Broker dans le repo** : `/federation-server/` + Dockerfile, hébergé par l'infra Movviz.
4. **Pipeline natif Movviz** pour les téléchargements (indexeurs + engine, pas de Radarr/Sonarr).
5. **Écarts au spec actés** : queue SQLite → queue JSON (stack existante) ;
   WS natif Node → lib `ws` (compat Node 20) ; Radarr/Sonarr → pipeline natif.

## Contraintes

- Aucun port entrant : connexion WebSocket **sortante** unique vers le broker
  (fonctionne derrière CGNAT/double NAT).
- Aucun média ne transite : enveloppes chiffrées + IDs (TMDB/TVDB/IMDb).
- Le broker ne stocke pas de contenu : présence, routage, hachage d'emails
  (croisement à la demande, pas de stockage durable).
- Si la fédération tombe : Plex, bibliothèques, téléchargements, player intacts.

## Architecture

```
Movviz A (process Next)
├─ Federation Agent (module in-process, globalThis pattern)
│   ├─ identity.json (serverId mvz_xxx + clé X25519 persistante)
│   ├─ outbox.json (queue sortante: JSON, retry/backoff)
│   ├─ friends.json (amis Movviz: clé publique, statut, permissions)
│   └─ WS sortant ──► Federation Server (wss://, broker) ◄── WS sortant ── Movviz B

Federation Server (/federation-server/, Node + ws)
├─ présence (serverId ↔ online)
├─ routage d'enveloppes opaques {from, to, envelope}
└─ détection d'amis: croise les HASH d'emails Plex à la demande
```

- Chiffrement E2E : X25519 éphémère + clé statique destinataire → HKDF →
  AES-256-GCM (`node:crypto`, aucun package).
- Le broker ne voit que `{from, to, taille, timestamp}`.
- Détection d'amis : `query_presence { hashes: [sha256(email)...] }` ; le broker
  ne stocke ni email ni hash durable.
- Watch : requête chiffrée → réponse `{plexMachineId, ratingKey}` → lien
  `app.plex.tv` natif (auth gérée par Plex via bibliothèques partagées).

## Fichiers impactés

**Nouveaux (agent + API)**
- `src/lib/federation/identity.ts` — génération/persistance `identity.json`
- `src/lib/federation/outbox.ts` — queue sortante JSON + retry/backoff
- `src/lib/federation/crypto.ts` — E2E X25519/AES-GCM (purs, testables)
- `src/lib/federation/agent.ts` — singleton WS (globalThis), reconnect, dispatch
- `src/lib/federation/protocol.ts` — validation des enveloppes
- `src/lib/federation/friends.ts` — store amis + permissions
- `src/lib/federation/detect.ts` — sync amis Plex → hashs → query broker
- `src/app/api/federation/*/route.ts` — config, status, friends, sync, recommend,
  request, respond, availability
- `/federation-server/` — broker (index.mjs, ws, Dockerfile)
- `scripts/federation-crypto.test.ts`, `scripts/federation-outbox.test.ts`

**Modifiés (minimaux)**
- `src/lib/events/EventBus.ts` — + types `friend_online/offline`, `federation_event`
- `src/lib/notifications/router.ts` — achemine les événements fédérés reçus
- `src/components/titles/TitleContent.tsx` — **un seul** bouton Partager
  (page détail unique → panel + plein écran, règle absolue respectée)
- Section/Page Amis (responsive 375/768 px, bottom-sheet mobile)
- `src/i18n/locales/{en,fr,de,it,nl}.ts` — toutes les nouvelles clés (5 fichiers)
- `src/lib/config.ts`, `README.md`, `CHANGELOG.md`, `package.json` (v1.13.0 + `ws`)

## Schéma de données (JSON, configDir)

```
identity.json   { serverId: "mvz_xxx", privateKey, publicKey, createdAt, plexEmailHash }
federation.json { enabled, brokerUrl, autoDetectFriends, autoAcceptRecommendations, retryMs }
friends.json    [{ plexFriendId, plexUsername, emailHash, serverId?, publicKey?,
                   status, lastSeenAt, perms: { canRecommend, canRequestDownload, canWatch } }]
outbox.json     [{ id, type, receiver, payloadEnc, nonce, ephemPub, status,
                   attempts, nextAttemptAt }]
inbox → notifications store (événements reçus, type "federation")
```

## Schéma API

```
WS outbound:  register → presence → route{to, envelope} / query_presence{hashes} → ack
REST (Next, requireUser/requireAdmin):
  GET  /api/federation/config          (admin)
  PUT  /api/federation/config          (admin)
  GET  /api/federation/friends
  POST /api/federation/friends/sync    (force detection via Plex)
  POST /api/federation/recommend       { friendServerId, type, tmdbId, message }
  POST /api/federation/request         { friendServerId, type, tmdbId }  (download_request)
  POST /api/federation/respond         { eventId, accept|refuse }
  GET  /api/federation/availability    { friendServerId, type, tmdbId }
  POST /api/federation/incoming        (dispatch interne)
```

## Événements (v1)

`friend_online`, `friend_offline`, `recommendation_created`, `download_requested`,
`download_accepted`, `download_refused`, `watch_requested`.
Chaque événement : `{ id, type, sender, receiver, timestamp, payloadEnc }`.

## Migration

- Fichiers neufs uniquement, feature opt-in — aucune migration de données.
- Bump **v1.13.0** (package.json + README badge + CHANGELOG fr + tag + `--tags`).
- Sécurité : `brokerUrl` validé (https uniquement, pattern `safeBase` anti-SSRF),
  clé privée jamais exposée par une route, logs sans contenu.

## Tests

1. Unitaires (`npm test`) : roundtrip crypto 2 identités, outbox (retry/backoff/flush),
   validation protocole, matching hash amis.
2. Intégration locale : broker localhost + 2 instances dev (ports 9810/9811) →
   scénario Seb recommande → Thomas reçoit → accepte → recherche locale → watch link.
   Script style `replay-federation.mjs`.
3. Régression : `tsc --noEmit`, `npm run build`, `npm run lint`, broker down =
   aucune fonctionnalité existante touchée.

## Ordre d'implémentation (quand la feature est lancée)

1. Fondations (identity, crypto, outbox, protocol, `ws`).
2. Agent + routes API + config opt-in.
3. Détection d'amis via Plex.
4. Actions (recommend, download, watch).
5. Broker `/federation-server/` + Dockerfile.
6. UI (section Amis, bouton Partager, notifications, i18n 5 locales).
7. Tests + livraison v1.13.0.
