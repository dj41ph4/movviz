package com.movviz.tv.ui.theme

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Paint as AndroidPaint
import android.graphics.RadialGradient
import android.graphics.Shader
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.movviz.tv.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async

/**
 * Ressources du splash Bêta, décodées HORS du thread principal.
 *
 * Tout ce qui est coûteux (masque du logo, halos des arêtes, plaque nettoyée) est précalculé et
 * livré en images : l'appareil n'a aucun calcul de pixels à faire. Le décodage démarre dès le
 * lancement du processus ([preload], appelé par l'Application si l'interface Bêta est active) :
 * quand le splash est composé, les images sont déjà là. En attendant, [lowRes] (3,7 Ko, décodée
 * en quelques millisecondes) tient lieu de décor : même image, donc aucun saut visuel.
 */
object CinemaSplashAssets {
    class Loaded(
        val plate: ImageBitmap,
        val logoMask: ImageBitmap,
        /** Une image « lumière » par famille de néons (halo + cœur déjà fusionnés), dans l'ordre de [CinemaSplashLayout.families]. */
        val families: List<ImageBitmap>,
    )

    /** Dernier état connu de la préférence Bêta, lu en parallèle du démarrage (null = pas encore lu). */
    @Volatile
    var betaHint: Boolean? = null

    @Volatile
    private var cached: Loaded? = null
    private var job: Deferred<Loaded>? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Volatile
    private var lowResCached: ImageBitmap? = null

    @Volatile
    private var glowCached: ImageBitmap? = null

    /**
     * Lueur violette à bord totalement transparent : une seule image de 128 px, étirée à la demande
     * (rond ou ovale) et dessinée en additif. Remplace tout disque/ovale plein, donc aucun contour
     * visible, et évite d'allouer un dégradé radial par image.
     */
    fun glow(): ImageBitmap = glowCached ?: run {
        val size = 128
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val paint = AndroidPaint(AndroidPaint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                size / 2f, size / 2f, size / 2f - 3f, // 3 px de bord vide : aucune ligne fine au contour une fois étirée
                intArrayOf(0xFFEEE2FF.toInt(), 0x99B089FF.toInt(), 0x337C5CFF, 0x0A7C5CFF, 0x007C5CFF),
                floatArrayOf(0f, 0.22f, 0.5f, 0.8f, 1f),
                Shader.TileMode.CLAMP,
            )
        }
        AndroidCanvas(bitmap).drawCircle(size / 2f, size / 2f, size / 2f - 1f, paint)
        bitmap.asImageBitmap().also { glowCached = it }
    }

    fun peek(): Loaded? = cached

    @Synchronized
    fun preload(context: Context) {
        if (cached != null || job != null) return
        val app = context.applicationContext
        job = scope.async { decode(app).also { cached = it } }
    }

    /** Ne rend jamais « rien » : rejoint le décodage en cours ou le lance. */
    suspend fun await(context: Context): Loaded {
        cached?.let { return it }
        preload(context)
        return job!!.await()
    }

    /** Libère ~10 Mo une fois le splash terminé ; un prochain affichage redécode (≈ 30 ms, hors thread principal). */
    @Synchronized
    fun release() {
        cached = null
        job = null
    }

    fun lowRes(context: Context): ImageBitmap =
        lowResCached ?: BitmapFactory.decodeResource(context.resources, R.drawable.splash_plate_lowres, options())
            .asImageBitmap().also { lowResCached = it }

    private fun decode(context: Context): Loaded {
        fun bitmap(id: Int) = BitmapFactory.decodeResource(context.resources, id, options()).asImageBitmap()
        return Loaded(
            plate = bitmap(R.drawable.splash_plate),
            logoMask = bitmap(R.drawable.splash_logo_mask),
            families = CinemaSplashLayout.families.map { bitmap(it.drawable) },
        )
    }

    // inScaled = false : les images sont des plaques de 1916×821, jamais redimensionnées par la densité.
    private fun options() = BitmapFactory.Options().apply {
        inScaled = false
        inPreferredConfig = Bitmap.Config.ARGB_8888
    }
}
