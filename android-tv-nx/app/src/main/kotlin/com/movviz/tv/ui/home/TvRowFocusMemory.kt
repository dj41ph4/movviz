package com.movviz.tv.ui.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onPlaced

/** A deleted selection falls back to its former position, then the preceding last item. */
internal fun rememberedTvItemIndex(keys: List<String>, selectedKey: String?, previousIndex: Int): Int =
    selectedKey?.let(keys::indexOf)?.takeIf { it >= 0 }
        ?: previousIndex.coerceIn(0, keys.lastIndex.coerceAtLeast(0))

internal fun TvTitleCard.focusIdentity(): String =
    "${if (isMovie) "movie" else "series"}:$tmdbId:${seriesPart.orEmpty()}:$id"

/** Lazy TV rows require one stable key per rendered card. Keep the first
 *  occurrence and preserve server order when a feed contains duplicates. */
internal fun uniqueTvRowCards(cards: List<TvTitleCard>): List<TvTitleCard> =
    cards.distinctBy { it.focusIdentity() }

/** Identité d'une carte de grille (catalogue, « Voir tout », personne) :
 *  l'id seul pour un film, `id-partie` quand une série est découpée en
 *  parties logiques qui partagent le même id fournisseur (Bleach / TYBW). */
internal fun tvGridItemKey(id: String, part: String?): String =
    if (part.isNullOrEmpty()) id else "$id-$part"

/** Clé de rangée pour la mémoire de l'accueil : deux rangées au même titre
 *  (« Prochainement », « Tendances ») ne doivent jamais partager leur
 *  mémoire, d'où l'identifiant de section en préfixe. */
internal fun tvRowKey(sectionId: String, heading: String): String = "$sectionId/$heading"

/**
 * Demande le focus sans jamais planter : entre l'attachement observé et la
 * demande, le nœud peut avoir été détaché (recyclage paresseux, navigation),
 * et `requestFocus` lève alors IllegalStateException. Renvoie vrai si le
 * focus a effectivement bougé (un refus n'est pas un succès).
 */
internal fun FocusRequester.requestFocusSafely(): Boolean =
    runCatching { requestFocus(androidx.compose.ui.focus.FocusDirection.Enter) }.getOrDefault(false)

/**
 * Règle d'entrée unique pour un conteneur à mémoire : d'abord la cible
 * mémorisée (identité stable), sinon l'enfant sauvegardé par `focusRestorer`
 * (qui épingle aussi l'élément focalisé pour qu'il survive au recyclage),
 * sinon la recherche directionnelle par défaut.
 *
 * Ordre volontaire : Compose applique les focusProperties de la cible vers
 * le haut de la chaîne et le DERNIER appliqué gagne — notre `onEnter` placé
 * avant `focusRestorer()` remplace donc le sien, tout en gardant son
 * `onExit` (sauvegarde + épinglage). Vérifié dans ui 1.9.0
 * (FocusTargetNode.fetchFocusProperties, FocusRestorerNode).
 *
 * @param container demandeur attaché au conteneur : sert à restaurer
 *  l'enfant sauvegardé et peut être demandé de l'extérieur (retour de fiche).
 * @param target cible mémorisée actuellement attachée, ou null.
 */
@OptIn(ExperimentalComposeUiApi::class)
internal fun Modifier.tvRememberedEntry(
    container: FocusRequester,
    target: () -> FocusRequester?,
): Modifier = this
    .focusRequester(container)
    .focusProperties {
        onEnter = {
            val moved = target()?.requestFocusSafely() == true
            if (!moved) runCatching { container.restoreFocusedChild() }
        }
    }
    .focusRestorer()

internal class TvHomeFocusMemory(
    private val selectedRow: MutableState<String?>,
    private val detailOrigin: MutableState<String?>,
) {
    private val rows = mutableMapOf<String, FocusRequester>()
    fun attach(key: String, requester: FocusRequester) { rows[key] = requester }
    fun detach(key: String, requester: FocusRequester) { if (rows[key] === requester) rows.remove(key) }
    fun select(key: String) {
        if (detailOrigin.value != null && key == "hero") return
        selectedRow.value = key
        if (detailOrigin.value == key) detailOrigin.value = null
    }
    fun markDetailOrigin(key: String) { detailOrigin.value = key }
    fun destination(): FocusRequester = destinationOrNull() ?: FocusRequester.Default
    /** Rangée mémorisée encore attachée, ou null (laisser la recherche par défaut). */
    fun destinationOrNull(): FocusRequester? = (detailOrigin.value ?: selectedRow.value)?.let(rows::get)
    /** Clé de la dernière rangée focalisée (survit à la destruction de l'écran). */
    fun selectedRowKey(): String? = detailOrigin.value ?: selectedRow.value
}

internal val LocalTvHomeFocusMemory = staticCompositionLocalOf<TvHomeFocusMemory?> { null }

@Composable
internal fun rememberTvHomeFocusMemory(): TvHomeFocusMemory {
    val selectedRow = rememberSaveable { mutableStateOf<String?>(null) }
    val detailOrigin = rememberSaveable { mutableStateOf<String?>(null) }
    return remember { TvHomeFocusMemory(selectedRow, detailOrigin) }
}

/**
 * Mémoire de focus d'une rangée (ou d'une grille, voir [TvGridFocusMemory]) :
 * identité stable + position, qui survivent au recyclage paresseux et à la
 * destruction d'une destination de navigation.
 */
internal class TvRowFocusMemory(
    private val selectedKey: MutableState<String?>,
    private val selectedIndex: MutableState<Int>,
    private val host: TvHomeFocusMemory?,
    private val rowKey: String,
) {
    private val attached = mutableMapOf<String, FocusRequester>()
    private var rowHasFocus = false
    val rowRequester = FocusRequester()

    /** Modifier du conteneur (LazyRow / LazyVerticalGrid). */
    fun rowModifier(): Modifier = containerModifier()

    /**
     * Modifier du conteneur, avec un demandeur externe optionnel (ex. la
     * cible de restauration d'onglet passée par MainScreen) : le demander
     * entre par la règle mémoire, donc sur la carte mémorisée.
     */
    fun containerModifier(restoreRequester: FocusRequester? = null): Modifier = Modifier
        .then(if (restoreRequester != null) Modifier.focusRequester(restoreRequester) else Modifier)
        .onPlaced { host?.attach(rowKey, rowRequester) }
        .onFocusChanged {
            rowHasFocus = it.hasFocus
            if (it.hasFocus) host?.select(rowKey)
        }
        .tvRememberedEntry(rowRequester) { selectedKey.value?.let(attached::get) }

    @Composable
    fun itemModifier(key: String, index: Int): Modifier {
        val requester = remember(key) { FocusRequester() }
        DisposableEffect(key) {
            onDispose { if (attached[key] === requester) attached.remove(key) }
        }
        return Modifier.focusRequester(requester)
            .onPlaced { attached[key] = requester }
            .onFocusChanged {
                if (it.isFocused) {
                    selectedKey.value = key
                    selectedIndex.value = index
                }
            }
    }

    fun detach() = host?.detach(rowKey, rowRequester)
    fun targetIndex(keys: List<String>): Int = rememberedTvItemIndex(keys, selectedKey.value, selectedIndex.value)
    fun hasSelection(): Boolean = selectedKey.value != null
    fun rememberedKey(): String? = selectedKey.value

    /** Après un changement de clés pendant que la rangée a le focus : replace
     *  le focus sur la carte mémorisée (ou la plus proche survivante). */
    fun restoreAttached(keys: List<String>) {
        if (rowHasFocus) requestTarget(keys)
    }

    /** Demande le focus sur la carte mémorisée (ou la plus proche) si elle est
     *  attachée ; faux si rien n'a pu être focalisé. Jamais d'exception. */
    fun requestTarget(keys: List<String>): Boolean =
        keys.getOrNull(targetIndex(keys))?.let(attached::get)?.requestFocusSafely() == true

    /**
     * Restauration explicite (retour de fiche, focus initial d'un écran
     * recréé) : fait défiler jusqu'à la carte mémorisée si elle n'est pas
     * visible, attend une frame qu'elle s'attache, puis la focalise.
     * Renvoie faux si aucune carte n'a pu prendre le focus (l'appelant
     * choisit alors son repli visible).
     */
    suspend fun restoreFocus(
        keys: List<String>,
        isVisible: (Int) -> Boolean,
        scrollToItem: suspend (Int) -> Unit,
    ): Boolean {
        if (keys.isEmpty()) return false
        val target = targetIndex(keys)
        if (!isVisible(target)) scrollToItem(target)
        repeat(RESTORE_FRAME_ATTEMPTS) {
            withFrameNanos { }
            if (requestTarget(keys)) return true
        }
        return false
    }

    private companion object {
        /** Quelques frames suffisent pour qu'un élément qui vient d'être
         *  composé par le défilement soit attaché. */
        const val RESTORE_FRAME_ATTEMPTS = 3
    }
}

/** Même mécanique qu'une rangée, sans hôte d'accueil : une grille mémorise
 *  sa carte par identité ([tvGridItemKey]) et sa position. */
internal typealias TvGridFocusMemory = TvRowFocusMemory

/**
 * Mémoire de rangée. `rowKey` identifie la rangée dans la mémoire d'accueil
 * ([LocalTvHomeFocusMemory]) et isole son état sauvegardé : passer un
 * identifiant de section ([tvRowKey]) plutôt que le seul titre affiché.
 */
@Composable
internal fun rememberTvRowFocusMemory(
    rowKey: String,
    keys: List<String>,
    isVisible: (Int) -> Boolean,
    scrollToItem: suspend (Int) -> Unit,
): TvRowFocusMemory = rememberTvItemFocusMemory(rowKey, keys, LocalTvHomeFocusMemory.current, isVisible, scrollToItem)

/**
 * Mémoire de grille (catalogue, recherche, « Voir tout », personne).
 * Brancher `memory.containerModifier(restoreFocusRequester)` sur la grille et
 * `memory.itemModifier(tvGridItemKey(card.id, card.part), index)` sur chaque
 * carte ; au retour de fiche, demander `restoreFocusRequester` (ou appeler
 * `memory.restoreFocus(...)`) ramène sur la même carte.
 *
 * @param gridKey identité de la grille (ex. "catalog:movies") — isole l'état
 *  sauvegardé si l'écran réutilise le même emplacement pour un autre contenu.
 */
@Composable
internal fun rememberTvGridFocusMemory(
    gridKey: String,
    keys: List<String>,
    isVisible: (Int) -> Boolean,
    scrollToItem: suspend (Int) -> Unit,
): TvGridFocusMemory = rememberTvItemFocusMemory(gridKey, keys, host = null, isVisible, scrollToItem)

@Composable
private fun rememberTvItemFocusMemory(
    key: String,
    keys: List<String>,
    host: TvHomeFocusMemory?,
    isVisible: (Int) -> Boolean,
    scrollToItem: suspend (Int) -> Unit,
): TvRowFocusMemory {
    val selectedKey = rememberSaveable(key) { mutableStateOf<String?>(null) }
    val selectedIndex = rememberSaveable(key) { mutableStateOf(0) }
    val memory = remember(host, key) { TvRowFocusMemory(selectedKey, selectedIndex, host, key) }
    DisposableEffect(memory) { onDispose { memory.detach() } }
    LaunchedEffect(memory, keys) {
        if (memory.hasSelection() && keys.isNotEmpty()) {
            val target = memory.targetIndex(keys)
            if (!isVisible(target)) scrollToItem(target)
            withFrameNanos { }
            memory.restoreAttached(keys)
        }
    }
    return memory
}
