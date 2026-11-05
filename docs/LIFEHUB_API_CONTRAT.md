# Contrat API Movviz → LifeHub

Synchronisation de l'historique « vu » d'un utilisateur Movviz vers LifeHub.

> **Statut : livré en v1.28.60.** La route `GET /api/lifehub/export` est disponible ; les clés API par utilisateur existaient déjà.

## Principe

LifeHub **vient chercher** les données dans Movviz (modèle « pull »).

1. L'utilisateur crée une clé API dans son profil Movviz.
2. Il colle dans LifeHub : l'URL de son serveur Movviz + cette clé.
3. LifeHub appelle périodiquement la route d'export de Movviz avec cette clé.

Aucun système de clés n'est à créer côté LifeHub : il stocke simplement la clé Movviz de l'utilisateur (comme un secret).

## Authentification

- Les clés sont **par utilisateur** (format `mvz_…`), créées dans le profil Movviz. Le texte de la clé n'est affiché qu'une seule fois ; Movviz ne stocke que son hash.
- Chaque requête porte l'en-tête :

```http
Authorization: Bearer mvz_xxxxxxxxxxxxxxxxxxxxxxxx
```

- La clé identifie un seul compte Movviz : la réponse ne contient **que les titres vus de cet utilisateur**, jamais ceux d'un autre.
- Une clé est révocable à tout moment depuis le profil ; elle renvoie alors `401`.

## Route d'export

```http
GET {MOVVIZ_URL}/api/lifehub/export?since=2026-11-05T00:00:00Z
Authorization: Bearer mvz_xxxxxxxx
```

| Paramètre | Obligatoire | Description |
|---|---|---|
| `since` | non | Date ISO 8601. Ne renvoie que les titres dont l'état a changé depuis cette date (synchro incrémentale). Sans lui : tout l'historique. |

LifeHub conserve la date de son dernier appel réussi et la renvoie dans `since` au passage suivant.

### Réponse `200`

**Même format que le fichier d'export LifeHub** (`LifeHUB.json`) : le code d'import existant de LifeHub peut être réutilisé tel quel.

```json
{
  "source": "Movviz",
  "export_date": "2026-11-05",
  "nombre": 2,
  "titres": [
    {
      "media_type": "movie",
      "tmdb_id": 170,
      "title": "28 Jours plus tard",
      "status": "vu",
      "current_season": null,
      "current_episode": null,
      "updated_at": "2026-10-29 09:53:36.593+00"
    },
    {
      "media_type": "tv",
      "tmdb_id": 94605,
      "title": "Arcane",
      "status": "en_cours",
      "current_season": 1,
      "current_episode": 9,
      "updated_at": "2026-11-05 20:10:00+00"
    }
  ]
}
```

### Champs

| Champ | Type | Règle |
|---|---|---|
| `media_type` | `"movie"` \| `"tv"` | Type du titre. |
| `tmdb_id` | entier | Identifiant TMDb : c'est la clé de rapprochement avec LifeHub. |
| `title` | texte | Titre affiché. |
| `status` | `"vu"` \| `"en_cours"` | Voir ci-dessous. |
| `current_season`, `current_episode` | entier ou `null` | Uniquement pour une série `en_cours` : **prochain épisode à voir**. `null` sinon. |
| `updated_at` | texte | Date du dernier changement côté Movviz (`AAAA-MM-JJ HH:MM:SS.mmm+00`, UTC). |

Règles de statut :

- **Film vu** → `status: "vu"`.
- **Série dont tous les épisodes (saisons ≥ 1) sont vus** → `status: "vu"`, saison/épisode à `null`.
- **Série partiellement vue** → `status: "en_cours"`, avec `current_season` / `current_episode` = épisode qui suit le dernier vu.

Champs absents de la réponse (`poster_path`, `genres`, `cast_names`, `rating`, `note`, `release_year`) : Movviz ne les gère pas. **LifeHub doit les ignorer et ne jamais écraser ses propres notes et métadonnées** avec une valeur absente.

Une série dont aucun épisode n'a été vu dans Movviz n'apparaît pas dans la réponse (rien à synchroniser). Les épisodes spéciaux (saison 0) sont ignorés.

### Erreurs

| Code | Cas |
|---|---|
| `401` | Clé absente, invalide ou révoquée. |
| `400` | `since` mal formé. |

## Règle de fusion recommandée côté LifeHub

- Rapprocher chaque titre par `(media_type, tmdb_id)`.
- Un titre déjà `vu` dans LifeHub ne repasse jamais à `en_cours` à cause d'un export Movviz (on ne « dé-voit » pas).
- Pour une série `en_cours`, ne reculer la progression que si elle est plus avancée dans Movviz que dans LifeHub.
- Les films et séries que Movviz ne renvoie pas ne sont jamais supprimés de LifeHub.

## Import dans l'autre sens (déjà livré, v1.28.59)

Réglages › Netflix & LifeHub › « Import LifeHub » : l'utilisateur dépose son export `.json` LifeHub ; ses films et séries vus sont marqués vus sur son propre compte Movviz (et sur son Plex s'il est lié).

Correspondance utilisée à l'import (inverse de l'export) :

- film `vu` → film vu ;
- série `vu` → tous les épisodes des saisons ≥ 1 vus ;
- série `en_cours` → les épisodes **avant** `(current_season, current_episode)` sont vus, l'épisode courant ne l'est pas.
