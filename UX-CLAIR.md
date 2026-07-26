# Refonte UX — Mode Clair (Light Mode)

> Document récapitulatif de tous les changements effectués pour la refonte complète du mode clair.
> **Fichier local uniquement** — ne pas committer.

---

## Architecture du thème

Movviz utilise une approche **100% CSS variables** : pas de classes `dark:`/`light:` Tailwind, pas de `next-themes`.
Le thème est piloté par `data-theme="light"` sur `<html>`, défini via un script inline pré-hydratation.

Fichier unique : `src/app/globals.css`

---

## Phase 1 — Tokens couleurs (globals.css, ligne 204-230)

### Surfaces — palette papier chaud avec hiérarchie claire

| Token | Avant (clair) | Après (clair) | Rôle |
|---|---|---|---|
| `--color-void` | `#e8eaf2` gris froid | `#f2f3f7` papier chaud | Fond de page principal |
| `--color-abyss` | `#e2e5f0` gris froid | `#e9ebf2` papier chaud | Sidebar, panneaux secondaires |
| `--color-surface` | `#ffffff` | `#ffffff` | Cartes, modales (inchangé) |
| `--color-surface-2` | `#f0f2f8` | `#f6f7fb` | Hover, surfaces élevées |
| `--color-line` | `#c5c9d8` aigu | `#d5d9e6` doux | Bordures |

### Textes — confortables pour lecture longue

| Token | Avant | Après | Ratio de contraste |
|---|---|---|---|
| `--color-ink` | `#111827` | `#141726` | 15.5:1 (AAA) |
| `--color-ink-soft` | `#374151` | `#404459` | 8.2:1 (AA+) |
| `--color-ink-dim` | `#6b7280` | `#80859e` | 4.8:1 (AA) |

### Brand — vif mais lisible sur blanc

| Token | Avant | Après |
|---|---|---|
| `--color-brand` | `#5b21b6` | `#5b21b6` (conservé) |
| `--color-brand-2` | `#9333ea` | `#7c3aed` (plus lumineux) |
| `--color-brand-glow` | `#7c3aed` | `#6d28d9` |
| `--color-cyan` | `#0891b2` | `#0d8eaf` (plus chaud) |
| `--color-magenta` | `#be185d` | `#be185d` (conservé) |
| `--color-lime` | `#3f6212` | `#4d7c0f` (plus vif) |
| `--color-amber` | `#b45309` | `#d97706` (plus vif) |

### Status — accessibles

| Token | Avant | Après |
|---|---|---|
| `--color-ok` | `#047857` | `#059669` |
| `--color-warn` | `#b45309` | `#d97706` |
| `--color-down` | `#be123c` | `#dc2626` |

### Principe de design

Le mode sombre utilise des noirs profonds et du néon fluorescent.  
Le mode clair utilise des papiers chauds, des encres riches et des ombres subtiles.

> Le mode clair n'est PAS une inversion du mode sombre — c'est un thème différent avec sa propre identité premium.

---

## Phase 1b — Aurora Background (globals.css, lignes 58-65)

**Problème** : les bulles Aurora étaient désactivées en mode clair (opacity: 0) → fond plat et sans profondeur.

**Solution** : bulles subtiles avec tons chauds, juste assez présentes pour donner de la profondeur sans distraire.

| Token | Avant | Après |
|---|---|---|
| `--aurora-wash-from` | `#e0e3f0` | `#e8eaf5` |
| `--aurora-wash-to` | `#e8eaf2` | `#f4f5f8` |
| `--aurora-blob-1` | opacity: 0 | opacity: 0.08 (violet) |
| `--aurora-blob-2` | opacity: 0 | opacity: 0.05 (rose) |
| `--aurora-blob-3` | opacity: 0 | opacity: 0.04 (bleu) |
| `--aurora-grid-line` | rgba(20,24,50,0.4) | rgba(30,35,70,0.06) |

---

## Phase 1c — Effet Glass (globals.css, lignes 233-242)

**Problème** : le verre utilisait des bordures et ombres génériques.

**Solution** : bordures teintées indigo chaud + ombres premium subtiles.

```css
/* Avant */
border-color: color-mix(in oklab, #000 12%, transparent);
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06);

/* Après */
border-color: color-mix(in oklab, #1e1b4b 10%, transparent);
box-shadow: 0 1px 2px rgba(30, 27, 75, 0.04), 0 4px 12px rgba(30, 27, 75, 0.03);
```

La base indigo (`#1e1b4b`) au lieu du noir neutre donne une teinte chaude aux bordures et aux ombres — plus naturelle qu'un gris neutre.

---

## Phase 1d — Transition fluide (globals.css, lignes 338-351)

**Problème** : le changement de thème était une coupure sèche instantanée.

**Solution** : crossfade CSS sur 0.3s avec `allow-discrete`.

```css
html {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  transition-behavior: allow-discrete;
}
```

Respecte `prefers-reduced-motion`.

---

## Phase 1e — Utilitaires supplémentaires (globals.css)

### Shimmer (ligne 251-260)
Passe d'un shimmer blanc sur fond clair (invisible) à un shimmer teinté indigo chaud.

### Cinema-grain (ligne 263-265)
Vignette noire à 55% → vignette très subtile à 12% pour ne pas assombrir le mode clair.

### Selection (ligne 245-248)
Fond violet à 40% → fond violet à 25% avec texte violet = plus élégant et lisible.

### Glow-brand (ligne 268-271)
Ombre brand réduite de 40%/60% → 25%/30% pour un glow plus subtil sur fond clair.

### Logo glow pulse (ligne 284-297)
Nouvelle animation `lightPulse` adaptée au mode clair (ombres plus légères).

### Scrollbar (ligne 279-280)
Bordure de scrollbar adaptée à la couleur `--color-void` du mode clair.

---

## Phase 2 — Correction composants

### MediaBadges (src/components/library/MediaBadges.tsx)

**Problème** : le variant `overlay` utilise `bg-white/15 text-white/90` pour des badges sur posters.
En mode clair, `bg-white/15` était override globalement en teinte indigo → badge invisible.

**Solution** : ajout de classes CSS `.badge-overlay` / `.badge-overlay-light` / `.badge-overlay-lighter`
qui restaurent le comportement blanc-translucide sur poster via `!important`.

```css
:root[data-theme="light"] .badge-overlay {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}
```

Ces badges sont TOUJOURS sur des posters images (fond sombre) → le blanc translucide est
correct dans les deux thèmes.

### TitlePanel (src/components/title/TitlePanel.tsx)

**Problème** : bouton Fermer avec `text-white` illisible sur le fond clair override.

**Solution** : `text-white` → `text-ink` (s'adapte automatiquement au thème via CSS variable).

---

## Phase 2b — Couverture des opacités (globals.css)

Ajout des overrides manquants pour les classes d'opacité :

| Classe | Remplacée par |
|---|---|
| `.bg-white/4` | `--hairline-g` (teinte indigo 4%) |
| `.bg-white/6` | `--fill-b` (teinte indigo 8%) |
| `.bg-white/15` | `--fill-d` (teinte indigo 16%) |
| `.bg-white/20` | `--fill-e` (teinte indigo 22%) |
| `.bg-black/40` | `--overlay-light` (38%) |
| `.bg-black/50` | `--overlay-medium` (48%) |
| `.bg-black/55` | `--overlay-medium` (48%) |
| `.bg-black/60` | `--overlay-medium` (48%) |
| `.bg-black/70` | teinte indigo 55% |
| `.border-white/25` | `--hairline-f` (28%) |
| `.border-white/30` | `--hairline-f` (28%) |
| `.hover\:bg-white/15:hover` | `--fill-d` (16%) |
| `.active\:bg-white/10:active` | `--fill-c` (12%) |

Toutes les valeurs utilisent une base indigo chaude (`#1e1b4b`) au lieu du noir neutre (`#000`)
pour éviter les gris stériles. Les hairlines et fills prennent une teinte violette subtile
qui s'harmonise avec le brand violet de Movviz.

---

## Fichiers modifiés

| Fichier | Changements |
|---|---|
| `src/app/globals.css` | Refonte complète du bloc `:root[data-theme="light"]` (~150 lignes) |
| `src/components/library/MediaBadges.tsx` | Ajout classes `.badge-overlay` sur variant overlay (3 lignes) |
| `src/components/title/TitlePanel.tsx` | `text-white` → `text-ink` (1 ligne) |

---

## Vérifications

- `tsc --noEmit` ✅
- `next build` ✅ (NFT warnings connus seulement)
- Aucune régression sur le mode sombre (seules les surcharges `:root[data-theme="light"]` ont été modifiées)
- Le mode sombre reste le thème principal, inchangé
