from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
main_activity = root / "android-tv-nx/app/src/main/kotlin/com/movviz/tv/MainActivity.kt"
main_screen = root / "android-tv-nx/app/src/main/kotlin/com/movviz/tv/ui/home/MainScreen.kt"
home_screen = root / "android-tv-nx/app/src/main/kotlin/com/movviz/tv/ui/home/HomeScreen.kt"
tv_root = root / "android-tv-nx/app/src/main/kotlin"


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected block not found: {label}")
    return text.replace(old, new, 1)


# MainScreen: sidebar is LEFT now. Remove the old global UP interception and
# let Compose own vertical traversal. Only a real LEFT exit enters NavRail.
s = main_screen.read_text()
for imp in [
    "import androidx.compose.ui.input.key.Key\n",
    "import androidx.compose.ui.input.key.KeyEventType\n",
    "import androidx.compose.ui.input.key.key\n",
    "import androidx.compose.ui.input.key.onKeyEvent\n",
    "import androidx.compose.ui.input.key.type\n",
    "import androidx.compose.ui.platform.LocalFocusManager\n",
]:
    s = s.replace(imp, "")
if "import androidx.compose.foundation.focusGroup\n" not in s:
    s = s.replace(
        "import androidx.compose.foundation.layout.padding\n",
        "import androidx.compose.foundation.layout.padding\nimport androidx.compose.foundation.focusGroup\n",
    )
if "import androidx.compose.ui.focus.focusProperties\n" not in s:
    s = s.replace(
        "import androidx.compose.ui.focus.FocusRequester\n",
        "import androidx.compose.ui.focus.FocusRequester\nimport androidx.compose.ui.focus.focusProperties\n",
    )
old = """    val focusManager = LocalFocusManager.current
    Box(
        // L'accueil possède sa propre arborescence TV : son TvLazyColumn doit
        // recevoir UP directement pour remonter de rangée en rangée. Les
        // écrans historiques conservent leur repli global vers la NavRail,
        // afin que cette correction ne change pas leurs parcours existants.
        modifier = Modifier.fillMaxSize().onKeyEvent { event ->
            if (tab == HomeTab.HOME && !searchOpen) return@onKeyEvent false
            if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionUp) return@onKeyEvent false
            if (focusManager.moveFocus(FocusDirection.Up)) true
            else navRailFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
        },
"""
new = """    Box(
        // La navigation est désormais une sidebar à GAUCHE. Le déplacement
        // vertical reste entièrement natif (TvLazyColumn/TvLazyRow). On ne
        // redirige que la vraie sortie LEFT du groupe vers l'onglet actif,
        // via focusProperties, sans intercepter les touches.
        modifier = Modifier.fillMaxSize()
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == FocusDirection.Left) {
                        navRailFocusRequester ?: FocusRequester.Default
                    } else {
                        FocusRequester.Default
                    }
                }
            }
            .focusGroup(),
"""
s = must_replace(s, old, new, "MainScreen global UP handler")
s = s.replace(
    "// Cible HAUT depuis le contenu → NavRail : onglet sélectionné de la\n",
    "// Cible GAUCHE depuis le contenu → NavRail : onglet sélectionné de la\n",
)
main_screen.write_text(s)


# HomeScreen already has the correct LEFT focusProperties before focusGroup.
# Remove only the competing global UP engine and old top-nav anchor shortcut.
s = home_screen.read_text()
old = """    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == androidx.compose.ui.focus.FocusDirection.Left) navRailFocusRequester ?: androidx.compose.ui.focus.FocusRequester.Default else androidx.compose.ui.focus.FocusRequester.Default
                }
            }
            .focusGroup()
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionUp) return@onPreviewKeyEvent false
                // UP depuis le contenu : tenter d'abord un déplacement naturel
                // (rangée → rangée, carte → hero). S'il échoue (déjà tout en
                // haut), aller sur l'onglet sélectionné de la NavRail.
                if (focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Up)) true
                else navRailFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
            },
"""
new = """    Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == androidx.compose.ui.focus.FocusDirection.Left) navRailFocusRequester ?: androidx.compose.ui.focus.FocusRequester.Default else androidx.compose.ui.focus.FocusRequester.Default
                }
            }
            .focusGroup(),
"""
s = must_replace(s, old, new, "HomeScreen competing UP handler")
old_anchor = """                            if (anchorOwnsContentFocus) it.focusRequester(contentFocus)
                                .focusRequester(topAnchor).focusable()
                                .onPreviewKeyEvent { event ->
                                    if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionUp) {
                                        navRailFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
                                    } else false
                                }
                            else it.focusRequester(topAnchor)
"""
new_anchor = """                            if (anchorOwnsContentFocus) it.focusRequester(contentFocus)
                                .focusRequester(topAnchor).focusable()
                            else it.focusRequester(topAnchor)
"""
s = must_replace(s, old_anchor, new_anchor, "HomeScreen top anchor UP handler")
s = s.replace(
    "    // Destination UP uniquement depuis l'ancre réellement située au sommet.\n"
    "    // Ne jamais l'employer depuis une carte : TvLazyColumn doit d'abord\n"
    "    // résoudre la rangée précédente et faire défiler le contenu.\n",
    "    // Destination GAUCHE vers la NavRail. Le déplacement vertical reste\n"
    "    // entièrement géré par les listes TV natives.\n",
)
for imp in [
    "import androidx.compose.ui.input.key.Key\n",
    "import androidx.compose.ui.input.key.KeyEventType\n",
    "import androidx.compose.ui.input.key.key\n",
    "import androidx.compose.ui.input.key.onPreviewKeyEvent\n",
    "import androidx.compose.ui.input.key.type\n",
]:
    s = s.replace(imp, "")
home_screen.write_text(s)


# Detail/person/row screens: same geometry. Replace old global UP interceptor
# with a native LEFT group exit, just like the Home/MainScreen graph.
s = main_activity.read_text()
for imp in [
    "import androidx.compose.ui.input.key.Key\n",
    "import androidx.compose.ui.input.key.KeyEventType\n",
    "import androidx.compose.ui.input.key.key\n",
    "import androidx.compose.ui.input.key.onKeyEvent\n",
    "import androidx.compose.ui.input.key.onPreviewKeyEvent\n",
    "import androidx.compose.ui.input.key.type\n",
]:
    s = s.replace(imp, "")
if "import androidx.compose.foundation.focusGroup\n" not in s:
    s = s.replace(
        "import androidx.compose.foundation.focusable\n",
        "import androidx.compose.foundation.focusable\nimport androidx.compose.foundation.focusGroup\n",
    )
if "import androidx.compose.ui.focus.focusProperties\n" not in s:
    s = s.replace(
        "import androidx.compose.ui.focus.focusRequester\n",
        "import androidx.compose.ui.focus.focusRequester\nimport androidx.compose.ui.focus.focusProperties\n",
    )
s = s.replace("DetailUpToNavHandler", "DetailFocusToNavHandler")
start = s.index("/** Conteneur des écrans HORS MainScreen")
old_tail = s[start:]
if "@Composable\nprivate fun DetailFocusToNavHandler(" not in old_tail:
    raise SystemExit("Detail focus helper not found")
new_tail = """/** Conteneur des écrans HORS MainScreen (fiche titre, fiche acteur,
 * grille « voir tout »). La NavRail vit à GAUCHE : Compose garde le contrôle
 * de UP/DOWN/RIGHT à l'intérieur du contenu et seule une sortie LEFT du
 * groupe est redirigée vers l'onglet actif. Aucun événement D-pad n'est
 * consommé manuellement ici. */
@Composable
private fun DetailFocusToNavHandler(
    navRailFocusRequester: FocusRequester,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize()
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == FocusDirection.Left) {
                        navRailFocusRequester
                    } else {
                        FocusRequester.Default
                    }
                }
            }
            .focusGroup(),
    ) {
        content()
    }
}
"""
s = s[:start] + new_tail
main_activity.write_text(s)


# requestFocus returns Boolean. A Result success containing false is NOT a
# focus move. Fix that historical anti-pattern mechanically in the TV client.
pattern = re.compile(r"runCatching \{ ([^{}\n]*?\.requestFocus\(\)) \}\.isSuccess")
changed = []
fixed_count = 0
for path in tv_root.rglob("*.kt"):
    text = path.read_text()
    text2, n = pattern.subn(r"runCatching { \1 }.getOrDefault(false)", text)
    text2 = re.sub(
        r"try \{ ([A-Za-z_][A-Za-z0-9_]*)\.requestFocus\(\); true \} catch",
        r"try { \1.requestFocus() } catch",
        text2,
    )
    if text2 != text:
        path.write_text(text2)
        changed.append(str(path.relative_to(root)))
        fixed_count += n

print(f"Boolean requestFocus fixes: {fixed_count}")
for p in changed:
    print("  ", p)

# Safety assertions for exactly the regressions being repaired.
for path in tv_root.rglob("*.kt"):
    text = path.read_text()
    if pattern.search(text):
        raise SystemExit(f"Unsafe requestFocus isSuccess remains in {path}")
for path in [main_activity, main_screen, home_screen]:
    text = path.read_text()
    if "moveFocus(FocusDirection.Up)" in text or "moveFocus(androidx.compose.ui.focus.FocusDirection.Up)" in text:
        raise SystemExit(f"Global manual UP traversal remains in {path}")


# Release metadata is written only after the code patch is syntactically ready.
version = "1.25.50"
pkg = root / "package.json"
data = json.loads(pkg.read_text())
data["version"] = version
pkg.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

lock = root / "package-lock.json"
if lock.exists():
    d = json.loads(lock.read_text())
    d["version"] = version
    if "" in d.get("packages", {}):
        d["packages"][""]["version"] = version
    lock.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")

readme = root / "README.md"
r = readme.read_text()
r = r.replace("version-1.25.49-", "version-1.25.50-").replace("Version 1.25.49", "Version 1.25.50")
readme.write_text(r)

changelog = root / "CHANGELOG.md"
old = changelog.read_text()
entry = """## v1.25.50 — September 2026

### Android TV : D-pad réparé après la refonte sidebar

- La navigation latérale et le contenu utilisent de nouveau un seul moteur de focus : `focusProperties`/`focusGroup` de Compose, sans interception globale de `UP`.
- La sidebar étant désormais à gauche, la sortie du contenu vers le menu se fait sur `LEFT`; `UP`/`DOWN` restent natifs dans les listes, rangées, grilles et fiches.
- Les anciens appels `runCatching { requestFocus() }.isSuccess` ont été corrigés : le booléen réellement renvoyé par `requestFocus()` est maintenant respecté, donc un refus de focus n'est plus pris pour un succès.
- Aucun changement visuel : dimensions, couleurs, cartes, sidebar et animations restent identiques à la refonte actuelle.

"""
if not old.startswith("## v1.25.50"):
    changelog.write_text(entry + old)
