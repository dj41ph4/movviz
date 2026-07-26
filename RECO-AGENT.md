# Recommandations issues de l'audit externe

> À donner à Claude pour analyse et implémentation.
> Récupérées d'un échange avec ChatGPT qui a audité les forces/faiblesses de Movviz.
> Seules les recommandations concrètes et non-redondantes avec l'existant sont listées.

---

## 1. Scoring — pénalité de redondance bibliothèque

**Problème :** le scoring actuel valide la correspondance technique (bon épisode, bonne qualité, bonne langue) sans regarder le chevauchement avec les fichiers déjà possédés.

**Exemple concret :**
```
Bibliothèque : The.Office S01-S08 déjà possédés
Résultat A : The.Office.Complete.S01-S09.1080p — 120 Go → score technique haut
Résultat B : The.Office.S09.1080p — 15 Go → meilleur choix réel
```

**Attendu :** ajouter un facteur `redundancyPenalty` dans le score qui estime le contenu en doublon à partir du nom + taille + épisodes déclarés. Pas besoin de parser le torrent entier — le squelette des épisodes dans le nom suffit.
- Si le résultat couvre X saisons dont Y déjà présentes → pénalité proportionnelle
- Si l'utilisateur cherche un épisode précis et que le résultat est un pack → forte pénalité
- Si l'utilisateur cherche une intégrale et que le résultat est un pack → pas de pénalité

---

## 2. Score expliqué dans l'UI

**Problème :** le scoring est tracé dans les logs mais invisible dans l'interface au moment de la décision.

**Attendu :** au moment d'afficher un résultat de recherche (auto ou manuel), afficher une ligne structurée :
```
Pourquoi ce choix :
✓ Saison correspondante (+20)
✓ VF disponible (+15)
✓ 1080p préféré (+10)
✓ Redondance faible (+5)
Score final : 78
```
Et pour les rejets :
```
Refusé :
✗ Contenu déjà possédé à 80% (-30)
✗ Qualité inférieure au existant (-15)
```

Utile pour le debug, la confiance utilisateur, et l'identification de mauvais choix du moteur.

---

## 3. Scheduler — boost jour de sortie

**Problème :** la tâche "recherche manquants" a une priorité fixe. Un épisode qui sort aujourd'hui devrait être recherché plus agressivement.

**Attendu :** le calendrier connaît les dates de sortie. Si un épisode sort aujourd'hui, la tâche de recherche devrait temporairement monter en priorité (intervalle plus court, retry plus rapide). Pas de nouvelle architecture — juste un trigger calendrier → priorité dynamique.

---

## 4. Préférences suggérées (pas apprises)

**Problème :** un utilisateur peut refuser manuellement le 4K à chaque recherche sans que le système ne retienne la préférence.

**Attendu :** après N rejets d'un même critère (qualité, taille, codec), proposer à l'utilisateur d'enregistrer la préférence. Pas de ML, pas d'historique automatique — juste une suggestion explicite :
```
"Vous avez refusé les releases 4K à 5 reprises.
Voulez-vous limiter votre profil qualité à 1080p maximum ?"
```

---

## 5. Retry intelligent après échecs

**Problème :** actuellement les recherches échouées sont re-tentées à intervalles réguliers, ce qui gaspille des appels API sur des titres probablement indisponibles.

**Attendu :** espacer les tentatives de façon exponentielle après N échecs consécutifs (1h → 4h → 12h → 24h → 7 jours). Réinitialiser le compteur si une nouvelle source est ajoutée (nouvel indexeur, nouvelle saison qui commence). Pas de changement d'architecture — juste une logique de backoff dans le scheduler.

---

## Non retenu

Les idées suivantes ont été écartées car déjà implémentées, over-engineered, ou dangereuses :
- Content Lifecycle Engine → existe déjà
- Worker manager → scheduler existant
- Autopilot → comportement par défaut
- Intent detector → existe déjà
- ML / apprentissage implicite → boucle négative possible
- Patterns temporels VF/VOSTFR → ROI faible, données insuffisantes
- Simulation avant action → lourd, debug déjà présent dans les logs
- Navigation sidepanel avec historique → trop lourd pour un drawer
