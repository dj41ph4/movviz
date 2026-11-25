package com.movviz.nx.mobile.connect

import android.content.Context
import android.net.Uri
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaStatus
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.cast.framework.media.CastMediaOptions
import com.google.android.gms.cast.framework.media.NotificationOptions
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.images.WebImage
import com.movviz.nx.mobile.MainActivity
import com.movviz.nx.mobile.data.ApiClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/** Options du SDK Cast : lecteur multimédia par défaut de Google, notification de lecture. */
class CastOptionsProvider : OptionsProvider {
    override fun getCastOptions(context: Context): CastOptions {
        val notification = NotificationOptions.Builder()
            .setTargetActivityClassName(MainActivity::class.java.name)
            .build()
        return CastOptions.Builder()
            .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
            .setCastMediaOptions(CastMediaOptions.Builder().setNotificationOptions(notification).build())
            .build()
    }

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null
}

/** Un écran Google Cast vu par le téléphone sur son réseau. */
data class NearbyScreen(val id: String, val name: String, val description: String?)

/**
 * Google Cast côté téléphone (SDK officiel). Les écrans sont ceux du réseau où
 * se trouve le téléphone — chez un ami, à l'hôtel — pas celui du serveur : le
 * serveur fournit un lien public signé (/api/connect/link) et l'écran va
 * chercher la vidéo lui-même. Le flux (remux, ou recodage adapté au modèle)
 * n'est pas navigable : un saut recharge à la nouvelle position (« ?t= »).
 */
object LocalCast {
    const val DEVICE_ID = "gcast_local"
    private val json = "application/json".toMediaType()

    private val _screens = MutableStateFlow<List<NearbyScreen>>(emptyList())
    val screens: StateFlow<List<NearbyScreen>> = _screens.asStateFlow()

    /** L'écran piloté depuis ce téléphone (nom + état), null sans session Cast. */
    private val _device = MutableStateFlow<ConnectDevice?>(null)
    val device: StateFlow<ConnectDevice?> = _device.asStateFlow()

    private var castContext: CastContext? = null
    private var router: MediaRouter? = null
    private var selector: MediaRouteSelector? = null
    private var sessionWaiter: CompletableDeferred<CastSession?>? = null

    private class Current(val baseUrl: String, val payload: CastPayload, val link: JSONObject, val url: String, val durationSec: Double, val progressId: String?) {
        var offset = 0.0
        var started = false
        var sequence = 0
        var lastBeat = 0L
    }
    private var current: Current? = null

    /** Faux sans services Google (téléphone dégooglisé) : la ligne n'est alors jamais proposée. */
    fun available(context: Context): Boolean = ensure(context) != null

    private fun ensure(context: Context): CastContext? {
        castContext?.let { return it }
        val ctx = runCatching { CastContext.getSharedInstance(context.applicationContext) }.getOrNull() ?: return null
        castContext = ctx
        router = MediaRouter.getInstance(context.applicationContext)
        selector = MediaRouteSelector.Builder()
            .addControlCategory(CastMediaControlIntent.categoryForCast(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID))
            .build()
        ctx.sessionManager.addSessionManagerListener(sessionListener, CastSession::class.java)
        ctx.sessionManager.currentCastSession?.let { attach(it) }
        return ctx
    }

    private val routerCallback = object : MediaRouter.Callback() {
        override fun onRouteAdded(router: MediaRouter, route: MediaRouter.RouteInfo) = publishRoutes()
        override fun onRouteRemoved(router: MediaRouter, route: MediaRouter.RouteInfo) = publishRoutes()
        override fun onRouteChanged(router: MediaRouter, route: MediaRouter.RouteInfo) = publishRoutes()
    }

    private fun publishRoutes() {
        val r = router ?: return
        val sel = selector ?: return
        _screens.value = r.routes
            .filter { !it.isDefault && !it.isBluetooth && it.isEnabled && it.matchesSelector(sel) }
            .map { NearbyScreen(it.id, it.name, it.description) }
            .sortedBy { it.name.lowercase() }
    }

    /** Recherche active pendant que le panneau est ouvert (économise la batterie le reste du temps). */
    fun startDiscovery(context: Context) {
        ensure(context) ?: return
        val r = router ?: return
        val sel = selector ?: return
        r.addCallback(sel, routerCallback, MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY)
        publishRoutes()
    }

    fun stopDiscovery() {
        router?.removeCallback(routerCallback)
    }

    private val sessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarted(session: CastSession, sessionId: String) { attach(session); sessionWaiter?.complete(session) }
        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) { attach(session) }
        override fun onSessionStartFailed(session: CastSession, error: Int) { sessionWaiter?.complete(null) }
        override fun onSessionEnded(session: CastSession, error: Int) { finish(false); _device.value = null }
        override fun onSessionSuspended(session: CastSession, reason: Int) {}
        override fun onSessionStarting(session: CastSession) {}
        override fun onSessionEnding(session: CastSession) {}
        override fun onSessionResuming(session: CastSession, sessionId: String) {}
        override fun onSessionResumeFailed(session: CastSession, error: Int) {}
    }

    private val mediaCallback = object : RemoteMediaClient.Callback() {
        override fun onStatusUpdated() = publishState()
    }

    private fun attach(session: CastSession) {
        session.remoteMediaClient?.unregisterCallback(mediaCallback)
        session.remoteMediaClient?.registerCallback(mediaCallback)
        _device.value = ConnectDevice(DEVICE_ID, session.castDevice?.friendlyName ?: "Google Cast", "network", "chromecast", null)
        publishState()
    }

    private fun publishState() {
        val session = castContext?.sessionManager?.currentCastSession ?: return
        val client = session.remoteMediaClient
        val c = current
        val name = session.castDevice?.friendlyName ?: "Google Cast"
        if (client == null || c == null) {
            _device.value = ConnectDevice(DEVICE_ID, name, "network", "chromecast", null)
            return
        }
        val status = when (client.playerState) {
            MediaStatus.PLAYER_STATE_PLAYING -> "playing"
            MediaStatus.PLAYER_STATE_PAUSED -> "paused"
            MediaStatus.PLAYER_STATE_BUFFERING, MediaStatus.PLAYER_STATE_LOADING -> "buffering"
            MediaStatus.PLAYER_STATE_IDLE -> "idle"
            else -> "loading"
        }
        val position = c.offset + client.approximateStreamPosition / 1000.0
        if (status == "playing" || status == "paused") c.started = true
        if (status == "idle" && c.started) {
            // Fin seulement près de la vraie fin : un écran qui ne décode pas saute aussi à « terminé ».
            finish(c.durationSec > 0 && position >= c.durationSec - 120)
            _device.value = ConnectDevice(DEVICE_ID, name, "network", "chromecast", null)
            return
        }
        val p = c.payload
        _device.value = ConnectDevice(
            DEVICE_ID, name, "network", "chromecast",
            ConnectState(if (status == "idle") "loading" else status, p.title, p.season, p.episode, position, c.durationSec, System.currentTimeMillis()),
        )
        heartbeat(c, position, status == "playing")
    }

    private fun heartbeat(c: Current, position: Double, playing: Boolean) {
        val id = c.progressId ?: return
        val now = System.currentTimeMillis()
        if (now - c.lastBeat < 10_000) return
        c.lastBeat = now
        val body = JSONObject().put("sequence", ++c.sequence).put("positionMs", (position * 1000).toLong()).put("isPlaying", playing).put("mode", "google-cast")
        postAsync("${c.baseUrl.trimEnd('/')}/api/playback/sessions/$id/heartbeat", body)
    }

    private fun finish(completed: Boolean) {
        val c = current ?: return
        current = null
        val id = c.progressId ?: return
        val position = if (completed) c.durationSec else (_device.value?.state?.positionSec ?: c.offset)
        postAsync("${c.baseUrl.trimEnd('/')}/api/playback/sessions/$id/stop", JSONObject().put("positionMs", (position * 1000).toLong()))
    }

    private fun postAsync(url: String, body: JSONObject) {
        Thread {
            runCatching {
                ApiClient.httpClient().newCall(Request.Builder().url(url).post(body.toString().toRequestBody(json)).build()).execute().close()
            }
        }.start()
    }

    enum class Result { OK, FAILED, LOCAL_FILE_REQUIRED, NO_SESSION }

    /** Se connecte à l'écran choisi puis y envoie le titre (modèle de l'écran → copie ou recodage). */
    suspend fun castTo(context: Context, baseUrl: String, screenId: String, payload: CastPayload): Result {
        val ctx = ensure(context) ?: return Result.FAILED
        var session = ctx.sessionManager.currentCastSession
        val route = router?.routes?.firstOrNull { it.id == screenId }
        // Déjà connecté à cet écran : on garde la session ; sinon le choisir ouvre une nouvelle session.
        if (route != null && session?.castDevice?.friendlyName != route.name) {
            val waiter = CompletableDeferred<CastSession?>()
            sessionWaiter = waiter
            withContext(Dispatchers.Main) { router?.selectRoute(route) }
            session = withTimeoutOrNull(25_000) { waiter.await() }
            sessionWaiter = null
        }
        session ?: return Result.NO_SESSION
        val model = session.castDevice?.modelName
        val link = withContext(Dispatchers.IO) {
            val body = JSONObject().put("title", payload.title).put("mediaType", payload.mediaType).put("tmdbId", payload.tmdbId)
            if (payload.season != null && payload.episode != null) body.put("season", payload.season).put("episode", payload.episode)
            payload.resumeSeconds?.let { body.put("resumeSeconds", it) }
            model?.let { body.put("model", it) }
            runCatching {
                ApiClient.httpClient().newCall(Request.Builder().url("${baseUrl.trimEnd('/')}/api/connect/link").post(body.toString().toRequestBody(json)).build()).execute().use { r ->
                    val text = r.body?.string().orEmpty()
                    if (!r.isSuccessful) return@use if (text.contains("local_file_required")) "local" else null
                    JSONObject(text)
                }
            }.getOrNull()
        }
        if (link == "local") return Result.LOCAL_FILE_REQUIRED
        if (link !is JSONObject) return Result.FAILED
        finish(false)
        val c = Current(
            baseUrl, payload, link, link.getString("url"), link.optDouble("durationSec", 0.0),
            link.optString("progressSessionId").takeIf { it.isNotBlank() && it != "null" },
        )
        current = c
        val ok = withContext(Dispatchers.Main) { load(session, c, link.optDouble("startSec", 0.0)) }
        return if (ok) Result.OK else Result.FAILED
    }

    private suspend fun load(session: CastSession, c: Current, startSec: Double): Boolean {
        val link = c.link
        val client = session.remoteMediaClient ?: return false
        val series = c.payload.mediaType == "series"
        val meta = MediaMetadata(if (series) MediaMetadata.MEDIA_TYPE_TV_SHOW else MediaMetadata.MEDIA_TYPE_MOVIE)
        val title = link.optString("title")?.takeIf { it.isNotBlank() } ?: c.payload.title
        val subtitle = link.optString("subtitle")?.takeIf { it.isNotBlank() && it != "null" }
        meta.putString(MediaMetadata.KEY_TITLE, if (series && subtitle != null) subtitle else title)
        if (series) {
            meta.putString(MediaMetadata.KEY_SERIES_TITLE, title)
            c.payload.season?.let { meta.putInt(MediaMetadata.KEY_SEASON_NUMBER, it) }
            c.payload.episode?.let { meta.putInt(MediaMetadata.KEY_EPISODE_NUMBER, it) }
        }
        link.optString("posterUrl")?.takeIf { it.startsWith("https://") }?.let { meta.addImage(WebImage(Uri.parse(it))) }
        val url = if (startSec > 0) "${c.url}?t=${startSec.toLong()}" else c.url
        val info = MediaInfo.Builder(url)
            .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
            .setContentType("video/mp4")
            .setMetadata(meta)
            .apply { if (c.durationSec > 0) setStreamDuration(((c.durationSec - startSec).coerceAtLeast(1.0) * 1000).toLong()) }
            .build()
        c.offset = startSec
        c.started = false
        val done = CompletableDeferred<Boolean>()
        client.load(MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).setCurrentTime(0).build())
            .setResultCallback { done.complete(it.status.isSuccess) }
        return withTimeoutOrNull(30_000) { done.await() } ?: false
    }

    /** Pause, reprendre, aller à (recharge à la position), arrêter. */
    suspend fun control(kind: String, seconds: Double?): Boolean = withContext(Dispatchers.Main) {
        val session = castContext?.sessionManager?.currentCastSession ?: return@withContext false
        val client = session.remoteMediaClient ?: return@withContext false
        when (kind) {
            "pause" -> { client.pause(); true }
            "resume" -> { client.play(); true }
            "stop" -> { finish(false); castContext?.sessionManager?.endCurrentSession(true); true }
            "seek" -> { val c = current ?: return@withContext false; load(session, c, (seconds ?: 0.0).coerceAtLeast(0.0)) }
            else -> false
        }
    }
}
