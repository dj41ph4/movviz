package com.movviz.tv.ui.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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

/**
 * La tête de rangée a changé : l'utilisateur qui s'y trouvait (ou qui n'est
 * jamais entré dans la rangée) doit y rester, sur la nouvelle première carte.
 * Celui qui a navigué plus loin garde sa carte : elle ne lui est jamais retirée.
 */
internal fun shouldFollowRowHead(previousHead: String?, head: String?, selectedKey: String?): Boolean =
    previousHead != null && head != null && previousHead != head &&
        (selectedKey == null || selectedKey == previousHead)

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
    /** Vrai pendant qu'une rangée rend le focus à sa nouvelle première carte :
     *  ce changement ne vient pas de l'utilisateur, l'écran ne doit pas défiler. */
    var holdBringIntoView by mutableStateOf(false)
    fun attach(key: String, requester: FocusRequester) { rows[key] = requester }
    fun detach(key: String, requester: FocusRequester) { if (rows[key] === requester) rows.remove(key) }
    // Vrai dès qu'une fiche est ouverte depuis CETTE composition de l'accueil
    // (non sauvegardé : l'accueil recréé au retour repart à faux).
    private var originMarkedHere = false
    fun select(key: String) {
        if (detailOrigin.value != null && key == "hero") return
        selectedRow.value = key
        // L'origine ne se libère qu'au RETOUR, quand sa rangée a repris le
        // focus. Au moment du clic, le focus rebondit sur la rangée avant que
        // l'accueil ne quitte l'écran (vérifié aux traces) : la marque était
        // effacée aussitôt posée, et au retour le hero pouvait reprendre le
        // focus — on retombait sur « Voir la fiche » au lieu de la carte quittée.
        if (detailOrigin.value == key && !originMarkedHere) detailOrigin.value = null
    }
    fun markDetailOrigin(key: String) {
        originMarkedHere = true
        detailOrigin.value = key
    }
    fun isDetailOrigin(key: String): Boolean = detailOrigin.value == key
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
    // Première carte connue de la rangée. Sauvegardée : une rangée sortie de
    // l'écran perd sa composition, pas le souvenir de sa tête.
    private val headKey: MutableState<String?> = mutableStateOf(null),
) {
    private val attached = mutableMapOf<String, FocusRequester>()
    private var rowHasFocus = false
    // Carte qui a le focus en ce moment (null si aucune dans cette rangée).
    private var focusedKey: String? = null
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
                    focusedKey = key
                    selectedKey.value = key
                    selectedIndex.value = index
                } else if (focusedKey == key) {
                    focusedKey = null
                }
            }
    }

    fun detach() = host?.detach(rowKey, rowRequester)
    fun targetIndex(keys: List<String>): Int = rememberedTvItemIndex(keys, selectedKey.value, selectedIndex.value)
    fun hasSelection(): Boolean = selectedKey.value != null

    /** La carte focalisée existe toujours après un changement de clés (ex. page
     *  suivante ajoutée à la grille) : il n'y a rien à restaurer. */
    fun focusSurvives(keys: List<String>): Boolean = focusedKey?.let(keys::contains) == true
    fun rememberedKey(): String? = selectedKey.value
    fun rememberedIndex(): Int = selectedIndex.value

    /**
     * La carte mémorisée vient de disparaître de la liste (retirée de la
     * reprise, par exemple) : la mémoire passe à la carte qui prend sa place
     * (même position, sinon la dernière) et le focus la suit — seulement si la
     * rangée avait le focus. Sans cela, Compose choisissait seul une carte voisine — pas
     * forcément la plus proche de celle qu'on venait de retirer.
     */
    suspend fun adoptNeighbour(
        keys: List<String>,
        formerIndex: Int,
        isVisible: (Int) -> Boolean,
        scrollToItem: suspend (Int) -> Unit,
    ) {
        if (keys.isEmpty()) return
        val index = formerIndex.coerceIn(0, keys.lastIndex)
        val key = keys[index]
        // Rangée sans focus : rien à déplacer, la mémoire garde sa position
        // (la prochaine entrée retombe déjà sur cette même place).
        if (!rowHasFocus) return
        selectedKey.value = key
        selectedIndex.value = index
        if (!isVisible(index)) scrollToItem(index)
        repeat(RESTORE_FRAME_ATTEMPTS) {
            withFrameNanos { }
            if (focusedKey == key || attached[key]?.requestFocusSafely() == true) return
        }
    }

    /**
     * Enregistre la tête courante. Vrai si la rangée doit revenir sur sa
     * nouvelle première carte (voir [shouldFollowRowHead]). Le retour d'une
     * fiche ouverte depuis cette rangée reste prioritaire : il rend la carte
     * ouverte, même si elle n'est plus en tête.
     */
    fun followHead(keys: List<String>): Boolean {
        val head = keys.firstOrNull() ?: return false
        val previous = headKey.value
        headKey.value = head
        if (host?.isDetailOrigin(rowKey) == true) return false
        if (!shouldFollowRowHead(previous, head, selectedKey.value)) return false
        if (selectedKey.value != null) {
            selectedKey.value = head
            selectedIndex.value = 0
        }
        return true
    }

    /** Donne le focus à la nouvelle première carte si la rangée l'avait déjà ;
     *  en cas de refus, le focus reste simplement sur la carte actuelle. */
    suspend fun focusHeadIfRowFocused(keys: List<String>) {
        val head = keys.firstOrNull() ?: return
        host?.holdBringIntoView = true
        try {
            // La colonne doit avoir recomposé avant la demande de focus.
            withFrameNanos { }
            repeat(RESTORE_FRAME_ATTEMPTS) {
                withFrameNanos { }
                if (!rowHasFocus || focusedKey == head) return
                if (attached[head]?.requestFocusSafely() == true) {
                    // Le défilement vers la carte focalisée se calcule aux frames suivantes.
                    repeat(RESTORE_FRAME_ATTEMPTS) { withFrameNanos { } }
                    return
                }
            }
        } finally {
            host?.holdBringIntoView = false
        }
    }

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
): TvRowFocusMemory = rememberTvItemFocusMemory(rowKey, keys, LocalTvHomeFocusMemory.current, isVisible, scrollToItem, followHead = true)

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
    followHead: Boolean = false,
): TvRowFocusMemory {
    val selectedKey = rememberSaveable(key) { mutableStateOf<String?>(null) }
    val selectedIndex = rememberSaveable(key) { mutableStateOf(0) }
    val headKey = rememberSaveable(key) { mutableStateOf<String?>(null) }
    val memory = remember(host, key) { TvRowFocusMemory(selectedKey, selectedIndex, host, key, headKey) }
    DisposableEffect(memory) { onDispose { memory.detach() } }
    // Lu pendant la composition, AVANT que la liste ne retire la carte : à cet
    // instant la mémoire désigne encore la carte disparue et sa position.
    val vanishedIndex = remember(memory, keys) {
        memory.rememberedKey()?.takeIf { keys.isNotEmpty() && it !in keys }?.let { memory.rememberedIndex() }
    }
    LaunchedEffect(memory, keys) {
        if (vanishedIndex != null) {
            if (followHead) memory.followHead(keys)
            memory.adoptNeighbour(keys, vanishedIndex, isVisible, scrollToItem)
            return@LaunchedEffect
        }
        // La liste garde en tête d'écran la carte qui y était, même déplacée :
        // sans ce retour, la nouvelle première carte restait cachée à gauche.
        // Défilement sans condition : à cet instant, l'état visible est celui
        // d'avant le changement de clés.
        if (followHead && memory.followHead(keys)) {
            scrollToItem(0)
            memory.focusHeadIfRowFocused(keys)
            return@LaunchedEffect
        }
        // Ne restaurer que si la carte focalisée a disparu (contenu remplacé)
        // ou au retour sur l'écran. Quand une page s'ajoute pendant que
        // l'utilisateur descend dans la grille, la carte focalisée est toujours
        // là : la « restaurer » faisait défiler la grille vers une carte déjà
        // dépassée et lui rendait le focus — la grille sautait et semblait
        // figée sous la télécommande (écran « Sur Disney Plus »).
        if (memory.hasSelection() && keys.isNotEmpty() && !memory.focusSurvives(keys)) {
            val target = memory.targetIndex(keys)
            if (!isVisible(target)) scrollToItem(target)
            withFrameNanos { }
            memory.restoreAttached(keys)
        }
    }
    return memory
}
