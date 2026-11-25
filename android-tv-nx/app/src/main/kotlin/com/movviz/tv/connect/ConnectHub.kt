package com.movviz.tv.connect

import android.content.Context
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import java.util.UUID

/**
 * Movviz Connect côté TV : identité stable de ce boîtier, réglage « ouverture
 * à distance », et pont entre le service qui reçoit les ordres et le lecteur
 * ouvert (pause, reprendre, aller à, arrêter ; état rapporté en retour).
 */
object ConnectHub {
    private const val PREFS = "movviz_connect"
    private const val KEY_ID = "device_id"
    private const val KEY_REMOTE_WAKE = "remote_wake"

    sealed interface PlayerCommand {
        data object Pause : PlayerCommand
        data object Resume : PlayerCommand
        data object Stop : PlayerCommand
        data class Seek(val positionMs: Long) : PlayerCommand
    }

    data class PlayerSnapshot(
        val playing: Boolean,
        val buffering: Boolean,
        val positionMs: Long,
        val durationMs: Long,
        val title: String,
        val type: String,
        val tmdbId: Int,
        val season: Int,
        val episode: Int,
    )

    private val _commands = MutableSharedFlow<PlayerCommand>(extraBufferCapacity = 8)
    val commands: SharedFlow<PlayerCommand> = _commands.asSharedFlow()

    @Volatile private var reader: (() -> PlayerSnapshot?)? = null

    private const val KEY_PROFILE = "profile_id"

    /** Profil actif (préférences du lecteur), renseigné par l'app à la connexion. */
    @Volatile var profileId: String? = null

    /** Le profil est gardé pour une lecture lancée app fermée (boîtier redémarré, sans AppViewModel). */
    fun persistProfile(context: Context) {
        val id = profileId ?: return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PROFILE, id).apply()
    }

    fun savedProfile(context: Context): String? =
        profileId ?: context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PROFILE, null)

    fun dispatch(command: PlayerCommand) {
        _commands.tryEmit(command)
    }

    /** Le lecteur s'annonce ; la fonction rendue le retire (seulement s'il est toujours le lecteur actif). */
    fun attachPlayer(read: () -> PlayerSnapshot?): () -> Unit {
        reader = read
        return { if (reader === read) reader = null }
    }

    /** À appeler sur le fil principal (ExoPlayer). */
    fun readPlayer(): PlayerSnapshot? = runCatching { reader?.invoke() }.getOrNull()

    fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_ID, null)?.takeIf { Regex("^[A-Za-z0-9_-]{8,64}$").matches(it) }?.let { return it }
        val fresh = UUID.randomUUID().toString().replace("-", "")
        prefs.edit().putString(KEY_ID, fresh).apply()
        return fresh
    }

    /** Le nom que l'utilisateur a donné à son boîtier (« Chromecast salon »), sinon le modèle. */
    fun deviceName(context: Context): String {
        val named = runCatching { Settings.Global.getString(context.contentResolver, "device_name") }.getOrNull()
            ?: runCatching { Settings.Secure.getString(context.contentResolver, "bluetooth_name") }.getOrNull()
        val base = named?.trim()?.takeIf { it.isNotEmpty() } ?: Build.MODEL?.trim()?.takeIf { it.isNotEmpty() } ?: "Android TV"
        return base.take(60)
    }

    fun remoteWakeEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_REMOTE_WAKE, false)

    fun setRemoteWakeEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_REMOTE_WAKE, enabled).apply()
    }

    /** Android 10+ n'ouvre une app fermée qu'avec « Afficher par-dessus les autres applications ». */
    fun canOpenFromBackground(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(context)
}
