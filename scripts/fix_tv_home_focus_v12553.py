from pathlib import Path

path = Path("android-tv-nx/app/src/main/kotlin/com/movviz/tv/ui/home/HomeScreen.kt")
text = path.read_text(encoding="utf-8")

old = '''    val contentFocus = entryFocusRequester ?: remember { FocusRequester() }
    val topAnchor = remember { FocusRequester() }
'''
new = '''    val contentFocus = entryFocusRequester ?: remember { FocusRequester() }
    // Quand le hero est présent, son CTA reste la cible d'entrée depuis la
    // sidebar, mais DOWN doit viser une vraie carte déjà connue plutôt que
    // dépendre de la recherche spatiale entre deux items d'une TvLazyColumn.
    // Sur certaines TV, la première rangée n'est pas encore une candidate
    // spatiale tant qu'elle n'a pas commencé à entrer dans le viewport : le
    // hero devient alors une île de focus jusqu'au premier scroll.
    val firstRowFocus = remember { FocusRequester() }
    val topAnchor = remember { FocusRequester() }
'''
assert old in text, "content focus anchor not found"
text = text.replace(old, new, 1)

old = '''                        ctaFocusRequester = contentFocus,
                        trailerAutoplay = dashboardLayout.hero.trailerAutoplay && activeCardPreviewKey == null,
'''
new = '''                        ctaFocusRequester = contentFocus,
                        downFocusRequester = if (firstVisibleSection != null) firstRowFocus else null,
                        trailerAutoplay = dashboardLayout.hero.trailerAutoplay && activeCardPreviewKey == null,
'''
assert old in text, "hero call not found"
text = text.replace(old, new, 1)

old = 'firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,'
new = 'firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,'
count = text.count(old)
assert count >= 6, f"expected at least 6 first-row focus assignments, got {count}"
text = text.replace(old, new)

old = '''    ctaFocusRequester: FocusRequester,
    trailerAutoplay: Boolean = true,
'''
new = '''    ctaFocusRequester: FocusRequester,
    // Première carte réelle sous le hero. Utilisée uniquement par le moteur
    // de focus Compose : aucune touche n'est interceptée/consommée ici.
    downFocusRequester: FocusRequester? = null,
    trailerAutoplay: Boolean = true,
'''
assert old in text, "HeroCarousel signature not found"
text = text.replace(old, new, 1)

old = '''                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        .tvFocusLift(focused, shape = RoundedCornerShape(5.dp), maxElevation = 12.dp)
'''
new = '''                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        .focusProperties {
                            left = navRailFocusRequester ?: FocusRequester.Default
                            down = downFocusRequester ?: FocusRequester.Default
                        }
                        .tvFocusLift(focused, shape = RoundedCornerShape(5.dp), maxElevation = 12.dp)
'''
assert old in text, "primary hero CTA modifier not found"
text = text.replace(old, new, 1)

old = '''                    modifier = Modifier
                        .tvFocusLift(infoFocused, shape = RoundedCornerShape(5.dp), maxElevation = 12.dp)
'''
new = '''                    modifier = Modifier
                        .focusProperties {
                            down = downFocusRequester ?: FocusRequester.Default
                        }
                        .tvFocusLift(infoFocused, shape = RoundedCornerShape(5.dp), maxElevation = 12.dp)
'''
assert old in text, "secondary hero CTA modifier not found"
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print(f"patched {path}; rewired {count} first-row focus targets")
