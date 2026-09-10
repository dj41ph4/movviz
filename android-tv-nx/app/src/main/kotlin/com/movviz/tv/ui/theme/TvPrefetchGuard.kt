package com.movviz.tv.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import java.lang.reflect.Method
import java.util.Collections

/**
 * androidx.tv:tv-foundation 1.0.0-alpha11 (dernière version publiée) a été
 * compilé contre compose.foundation 1.6.8 et appelle en interne
 * LazyLayoutPrefetchState.schedulePrefetch avec CETTE signature précise. Le
 * compose-bom du module résout un foundation bien plus récent dont la
 * signature a changé : tout TvLazyRow/TvLazyColumn/TvLazyVerticalGrid
 * plantait au premier scroll D-pad (NoSuchMethodError, app tuée
 * immédiatement) — reproduit en direct sur l'émulateur Android TV en
 * descendant simplement dans les rangées de l'accueil, alors que le même
 * correctif existait déjà côté android-mobile-nx (TvPrefetchGuard.kt) mais
 * n'avait jamais été porté ici. androidx.tv n'a jamais republié
 * tv-foundation contre un foundation plus récent sans casser tout son
 * ancien paquet lazy.* donc bumper la lib n'est pas une option.
 *
 * TvLazyListState/TvLazyGridState exposent en interne un commutateur
 * (`prefetchingEnabled`, vrai par défaut) qui court-circuite l'appel fautif
 * avant qu'il ne parte — le préchargement n'est qu'une optimisation de
 * performance, aucun comportement visible n'en dépend. On le désactive par
 * réflexion une fois par état (la méthode est `internal`, donc invisible à
 * la compilation normale, mais reste publique en bytecode Kotlin).
 */
private val prefetchSetterCache = Collections.synchronizedMap(HashMap<Class<*>, Method?>())

private fun disableTvFoundationPrefetch(state: Any) {
    val clazz = state.javaClass
    val setter = prefetchSetterCache.getOrPut(clazz) {
        runCatching {
            clazz.getDeclaredMethod("setPrefetchingEnabled\$tv_foundation_release", Boolean::class.javaPrimitiveType)
                .apply { isAccessible = true }
        }.getOrNull()
    }
    runCatching { setter?.invoke(state, false) }
}

/** À chaîner directement sur rememberTvLazyListState()/rememberTvLazyGridState(). */
@Composable
fun <T : Any> T.withTvPrefetchDisabled(): T = apply {
    remember(this) { disableTvFoundationPrefetch(this) }
}
