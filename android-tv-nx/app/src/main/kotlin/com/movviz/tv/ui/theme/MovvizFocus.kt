package com.movviz.tv.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.FocusState
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.focus.FocusEventModifierNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceBorder
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ClickableSurfaceScale
import androidx.tv.material3.Glow
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import java.util.Locale

// ────────────────────────────────────────────────────────────────
// Focus Bêta : un seul indicateur, un anneau blanc pur de 3 dp dessiné
// À L'EXTÉRIEUR de l'élément (3 dp d'écart) — il reste lisible sur le rail
// ivoire et sur le bouton lavande, qui n'ont donc jamais besoin de changer
// de fond au focus. Pas de halo, pas d'agrandissement de la carte : seule
// son image zoome (MovvizMotion.kt). Changement instantané : la navigation
// D-pad se répète trop souvent pour être animée.
// ────────────────────────────────────────────────────────────────

/** Épaisseur et écart par défaut de l'anneau extérieur. */
val MovvizFocusRingWidth: Dp = 3.dp
val MovvizFocusRingGap: Dp = 3.dp

/**
 * Anneau de focus extérieur (indicateur unique en Bêta).
 *
 * À poser sur le `modifier` EXTERNE de la Surface (ou de tout élément
 * focalisable) : il suit tout seul le focus de la cible juste en dessous
 * (`isFocused`), et dessine le contour de `shape` agrandi de `gap + width`
 * autour des bornes, en phase de dessin uniquement (aucune recomposition).
 * Laisser ≥ 6 dp de marge autour (contentPadding des grilles) pour qu'un
 * parent qui rogne ne le coupe pas.
 *
 * Usage : `Surface(onClick, modifier = Modifier.movvizFocusRing(shape, enabled = beta), shape = …)`.
 *
 * @param enabled false = aucun dessin (pratique pour `enabled = beta`).
 * @param focused source de vérité externe optionnelle (lecture différée au
 *  dessin) ; par défaut, l'état de focus observé sous ce modifier.
 */
fun Modifier.movvizFocusRing(
    shape: Shape,
    color: Color = MovvizBetaFocusColor,
    width: Dp = MovvizFocusRingWidth,
    gap: Dp = MovvizFocusRingGap,
    enabled: Boolean = true,
    focused: (() -> Boolean)? = null,
): Modifier = if (enabled) this then FocusRingElement(shape, color, width, gap, focused) else this

/** Variante du plan (§3.5) : focus fourni par l'appelant, lu au dessin. */
fun Modifier.movvizFocusRing(
    focused: () -> Boolean,
    shape: Shape,
    color: Color = MovvizBetaFocusColor,
    width: Dp = MovvizFocusRingWidth,
    gap: Dp = MovvizFocusRingGap,
): Modifier = movvizFocusRing(shape = shape, color = color, width = width, gap = gap, focused = focused)

private data class FocusRingElement(
    val shape: Shape,
    val color: Color,
    val width: Dp,
    val gap: Dp,
    val focused: (() -> Boolean)?,
) : ModifierNodeElement<FocusRingNode>() {
    override fun create() = FocusRingNode(shape, color, width, gap, focused)
    override fun update(node: FocusRingNode) {
        node.shape = shape
        node.color = color
        node.width = width
        node.gap = gap
        node.focused = focused
        node.invalidateCache()
    }
    override fun InspectorInfo.inspectableProperties() {
        name = "movvizFocusRing"
        properties["shape"] = shape
        properties["color"] = color
    }
}

private class FocusRingNode(
    var shape: Shape,
    var color: Color,
    var width: Dp,
    var gap: Dp,
    var focused: (() -> Boolean)?,
) : Modifier.Node(), DrawModifierNode, FocusEventModifierNode {
    private var observedFocus = false
    private var cachedSize = Size.Unspecified
    private var cachedOutline: Outline? = null

    fun invalidateCache() {
        cachedOutline = null
        invalidateDraw()
    }

    override fun onFocusEvent(focusState: FocusState) {
        if (focusState.isFocused != observedFocus) {
            observedFocus = focusState.isFocused
            if (focused == null) invalidateDraw()
        }
    }

    override fun ContentDrawScope.draw() {
        drawContent()
        val isOn = focused?.invoke() ?: observedFocus
        if (!isOn) return
        val strokePx = width.toPx()
        val insetPx = gap.toPx() + strokePx / 2f
        if (cachedOutline == null || cachedSize != size) {
            cachedSize = size
            cachedOutline = outsetOutline(shape.createOutline(size, layoutDirection, this), insetPx)
        }
        cachedOutline?.let { drawOutline(it, color, style = Stroke(strokePx)) }
    }
}

/** Agrandit un contour de `inset` px de chaque côté ; les rayons grandissent
 *  d'autant pour rester concentriques à la forme. */
private fun outsetOutline(outline: Outline, inset: Float): Outline = when (outline) {
    is Outline.Rectangle -> Outline.Rectangle(outline.rect.inflate(inset))
    is Outline.Rounded -> {
        val r = outline.roundRect
        fun CornerRadius.grow() = if (x <= 0f && y <= 0f) this else CornerRadius(x + inset, y + inset)
        Outline.Rounded(
            RoundRect(
                left = r.left - inset, top = r.top - inset, right = r.right + inset, bottom = r.bottom + inset,
                topLeftCornerRadius = r.topLeftCornerRadius.grow(),
                topRightCornerRadius = r.topRightCornerRadius.grow(),
                bottomRightCornerRadius = r.bottomRightCornerRadius.grow(),
                bottomLeftCornerRadius = r.bottomLeftCornerRadius.grow(),
            ),
        )
    }
    is Outline.Generic -> {
        val bounds = outline.path.getBounds()
        val path = androidx.compose.ui.graphics.Path().apply {
            addPath(outline.path)
            if (bounds.width > 0f && bounds.height > 0f) {
                val sx = (bounds.width + 2 * inset) / bounds.width
                val sy = (bounds.height + 2 * inset) / bounds.height
                val matrix = androidx.compose.ui.graphics.Matrix().apply {
                    translate(bounds.center.x, bounds.center.y)
                    scale(sx, sy)
                    translate(-bounds.center.x, -bounds.center.y)
                }
                transform(matrix)
            }
        }
        Outline.Generic(path)
    }
}

/**
 * Bordure de carte. Stable : exactement l'ancien `focusedBorder` (`stableFocused`),
 * aucun filet au repos. Bêta : filet 1 dp `line` au repos, 1 dp plus clair au
 * focus — le focus lui-même est porté par [movvizFocusRing].
 *
 * Usage : `Surface(border = movvizCardBorder(shape, BorderStroke(2.dp, Color.White)), …)`.
 */
@Composable
fun movvizCardBorder(shape: Shape, stableFocused: BorderStroke): ClickableSurfaceBorder =
    if (LocalMovvizBeta.current) {
        ClickableSurfaceDefaults.border(
            border = Border(BorderStroke(1.dp, LocalMovvizPalette.current.line), shape = shape),
            focusedBorder = Border(BorderStroke(1.dp, MovvizBetaCardFocusedLine), shape = shape),
        )
    } else {
        ClickableSurfaceDefaults.border(focusedBorder = Border(stableFocused, shape = shape))
    }

/**
 * Échelle Bêta d'une Surface cliquable : jamais d'agrandissement au focus,
 * 0.98 à l'appui (1 en mouvement réduit). À n'utiliser que dans une branche
 * Bêta ; Stable garde son `scale` historique.
 */
@Composable
@ReadOnlyComposable
fun movvizBetaSurfaceScale(): ClickableSurfaceScale = ClickableSurfaceDefaults.scale(
    focusedScale = 1f,
    pressedScale = if (LocalMovvizReduceMotion.current) 1f else MovvizMotion.PRESS_SCALE,
)

private val NoGlow = ClickableSurfaceDefaults.glow(glow = Glow.None, focusedGlow = Glow.None, pressedGlow = Glow.None)

/**
 * Chip de filtre / d'onglet (tri, genres, Films/Séries, langues…).
 * Bêta : pilule 36 dp, fond `chipContainer` + filet `line` ; actif = ivoire
 * (texte `#17151E`) ; focus = anneau extérieur blanc, quel que soit l'état
 * actif (le focus reste toujours distinguable de la sélection).
 * Stable : pilule `MovvizSurface`, actif `MovvizBrand`, focus 2 dp blanc —
 * mais un écran Stable existant garde de préférence son propre composable.
 *
 * Usage : `MovvizChip("Séries", active = tab == Series, onClick = { … }, focusRequester = entry)`.
 */
@Composable
fun MovvizChip(
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    leadingIcon: ImageVector? = null,
) {
    val beta = LocalMovvizBeta.current
    val palette = LocalMovvizPalette.current
    val shape = MovvizBetaShapes.Chip
    val container = if (active) palette.chipActiveContainer else palette.chipContainer
    val content = if (active) palette.chipActiveContent else if (beta) palette.inkSoft else palette.ink
    val focusedContainer = if (active) palette.chipActiveContainer else palette.surfaceRaised
    val focusedContent = if (active) palette.chipActiveContent else palette.ink
    Surface(
        onClick = onClick,
        modifier = modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .movvizFocusRing(shape, enabled = beta)
            .semantics { selected = active }
            .height(36.dp),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = container,
            contentColor = content,
            focusedContainerColor = focusedContainer,
            focusedContentColor = focusedContent,
            pressedContainerColor = focusedContainer,
            pressedContentColor = focusedContent,
        ),
        border = if (beta) {
            ClickableSurfaceDefaults.border(
                border = Border(BorderStroke(1.dp, if (active) Color.Transparent else palette.line), shape = shape),
                focusedBorder = Border(BorderStroke(1.dp, if (active) Color.Transparent else palette.lineStrong), shape = shape),
            )
        } else {
            ClickableSurfaceDefaults.border(focusedBorder = Border(BorderStroke(2.dp, Color.White), shape = shape))
        },
        scale = if (beta) movvizBetaSurfaceScale() else ClickableSurfaceDefaults.scale(),
        glow = NoGlow,
    ) {
        Row(
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (leadingIcon != null) Icon(leadingIcon, contentDescription = null, modifier = Modifier.size(16.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** Variante de [MovvizBetaButton]. */
enum class MovvizButtonVariant {
    /** Lavande `#E4D9FF`, texte prune `#211830` (Lire, Voir la fiche, Installer). */
    Primary,
    /** Blanc 7 % + filet `lineStrong` (bande-annonce, vu, Plus tard). */
    Secondary,
}

/**
 * Bouton d'action Bêta. Le fond ne change PAS au focus : l'anneau extérieur
 * porte l'indication (il reste visible sur la lavande). Hauteur min 40 dp,
 * rayon 10 dp (`MovvizBetaShapes.HeroButton` dans le hero), 0.98 à l'appui.
 * Réservé aux branches Bêta.
 *
 * Usage : `MovvizBetaButton("Lire", onClick = play, icon = MovvizIconPlay, focusRequester = primary)`.
 */
@Composable
fun MovvizBetaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MovvizButtonVariant = MovvizButtonVariant.Primary,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    shape: Shape = MovvizBetaShapes.Button,
    focusRequester: FocusRequester? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 18.dp),
) {
    val palette = LocalMovvizPalette.current
    val primary = variant == MovvizButtonVariant.Primary
    val container = if (primary) palette.primaryContainer else Color.White.copy(alpha = 0.07f)
    val content = if (primary) palette.onPrimaryContainer else palette.ink
    val border = Border(
        BorderStroke(1.dp, if (primary) Color.Transparent else palette.lineStrong),
        shape = shape,
    )
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .movvizFocusRing(shape)
            .defaultMinSize(minHeight = 40.dp),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = container,
            contentColor = content,
            focusedContainerColor = container,
            focusedContentColor = content,
            pressedContainerColor = container,
            pressedContentColor = content,
            disabledContainerColor = container.copy(alpha = container.alpha * 0.4f),
            disabledContentColor = content.copy(alpha = 0.5f),
        ),
        border = ClickableSurfaceDefaults.border(border = border, focusedBorder = border, pressedBorder = border),
        scale = movvizBetaSurfaceScale(),
        glow = NoGlow,
    ) {
        Row(
            modifier = Modifier.align(Alignment.Center).padding(contentPadding),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (icon != null) Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Text(text, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * Cible de focus visible pour les états chargement / vide / erreur : sur
 * TV, un écran sans contenu doit quand même offrir un point d'entrée D-pad
 * VISIBLE (jamais une boîte invisible). Bêta : anneau extérieur ; Stable :
 * bordure 2 dp blanc 75 % (comme les chips). OK déclenche `onClick` (ex.
 * « Réessayer ») ; sans `onClick`, OK ne fait rien mais le focus reste visible.
 *
 * Usage : `MovvizFocusTarget(focusRequester = entry, onClick = retry) { Text("Réessayer") }`.
 */
@Composable
fun MovvizFocusTarget(
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    onClick: (() -> Unit)? = null,
    shape: Shape = if (LocalMovvizBeta.current) MovvizBetaShapes.Control else MovvizCardShape,
    content: @Composable BoxScope.() -> Unit,
) {
    val beta = LocalMovvizBeta.current
    val palette = LocalMovvizPalette.current
    Surface(
        onClick = onClick ?: {},
        modifier = modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .movvizFocusRing(shape, enabled = beta),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            contentColor = palette.inkSoft,
            focusedContainerColor = Color.White.copy(alpha = 0.06f),
            focusedContentColor = palette.ink,
            pressedContainerColor = Color.White.copy(alpha = 0.06f),
            pressedContentColor = palette.ink,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = if (beta) Border.None else Border(BorderStroke(2.dp, Color.White.copy(alpha = 0.75f)), shape = shape),
        ),
        scale = if (beta) movvizBetaSurfaceScale() else ClickableSurfaceDefaults.scale(focusedScale = 1f),
        glow = NoGlow,
        content = content,
    )
}

/**
 * Surtitre Bêta : filet d'accent 28×1 dp, 12 dp d'écart, puis le texte en
 * Geist Mono capitales espacées (mis en capitales ici, en français).
 *
 * Usage : `BetaEyebrow("La sélection Movviz · Film")`.
 */
@Composable
fun BetaEyebrow(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = LocalMovvizPalette.current.eyebrow,
    ruleColor: Color = LocalMovvizPalette.current.accent,
    showRule: Boolean = true,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        if (showRule) {
            Box(Modifier.width(28.dp).height(1.dp).background(ruleColor))
            Spacer(Modifier.width(12.dp))
        }
        Text(
            text = text.uppercase(Locale.FRENCH),
            style = LocalMovvizTextStyles.current.eyebrow,
            color = color,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
