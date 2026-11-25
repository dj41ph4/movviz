package com.movviz.tv.connect

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.movviz.tv.R
import com.movviz.tv.data.ApiClient
import com.movviz.tv.data.LiveEvents
import com.movviz.tv.data.ServerPrefs
import com.movviz.tv.ui.player.PlayerActivity
import com.movviz.tv.ui.player.QueueItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Movviz Connect sur la TV : déclare ce boîtier au serveur, écoute les ordres
 * qui lui sont adressés (« lire ce titre », pause, aller à…) et rapporte ce
 * qui se lit. Tourne tant que l'app est à l'écran ; avec « Ouverture à
 * distance », il reste actif app fermée (et démarre avec le boîtier) pour
 * qu'un téléphone puisse ouvrir Movviz et lancer la lecture.
 */
class ConnectService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var events: LiveEvents? = null
    private var runJob: Job? = null
    private val json = "application/json".toMediaType()

    override fun onBind(intent: Intent?): IBinder? = null

    private var foregroundRefused = false

    override fun onCreate() {
        super.onCreate()
        ApiClient.initialize(applicationContext)
        // Android 12+ peut refuser un service de premier plan démarré depuis l'arrière-plan : on s'arrête net.
        foregroundRefused = runCatching { startAsForeground() }.onFailure { Log.w(TAG, "service de premier plan refusé", it) }.isFailure
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val remoteWake = ConnectHub.remoteWakeEnabled(applicationContext)
        // Relancé par le système (intent nul) sans « Ouverture à distance » : rien à écouter app fermée.
        if (foregroundRefused || (intent == null && !remoteWake && visibleActivities == 0)) {
            running = false
            stopSelf()
            return START_NOT_STICKY
        }
        if (runJob?.isActive != true) runJob = scope.launch { run() }
        return if (remoteWake) START_STICKY else START_NOT_STICKY
    }

    override fun onDestroy() {
        events?.stop()
        val id = ConnectHub.deviceId(applicationContext)
        val base = baseUrl
        if (base != null) {
            // Retrait immédiat de la liste des autres appareils (sinon il expire tout seul).
            CoroutineScope(Dispatchers.IO).launch {
                runCatching { ApiClient.httpClient().newCall(Request.Builder().url("$base/api/connect/devices?id=$id").delete().build()).execute().close() }
            }
        }
        scope.cancel()
        running = false
        super.onDestroy()
    }

    private var baseUrl: String? = null

    private suspend fun run() {
        val url = ServerPrefs(applicationContext).serverUrl.first()?.trimEnd('/')
        if (url.isNullOrBlank() || url.toHttpUrlOrNull() == null) {
            stopSelf()
            return
        }
        baseUrl = url
        val id = ConnectHub.deviceId(applicationContext)
        val stream = LiveEvents(url, "/api/events?device=$id") { channel, data ->
            when (channel) {
                "connect-command" -> onCommand(url, id, data)
                // Reconnexion (redémarrage du serveur) : il a tout oublié, on se redéclare.
                "resync" -> scope.launch { register(url, id) }
            }
        }
        events = stream
        register(url, id)
        stream.start(scope)
        scope.launch {
            while (isActive) {
                delay(HEARTBEAT_MS)
                register(url, id)
            }
        }
        // Une activité apparaît ou disparaît : la disponibilité change, on se redéclare aussitôt.
        scope.launch { visibility.collect { register(url, id) } }
        reportStateLoop(url, id)
    }

    private suspend fun register(url: String, id: String) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("id", id)
            .put("name", ConnectHub.deviceName(applicationContext))
            .put("kind", "tv")
            // Récepteur seulement si la lecture peut vraiment démarrer : app à l'écran, ou ouverture
            // à distance autorisée. Sinon la TV n'est pas proposée (au lieu d'un « envoyé » sans effet).
            .put("receiver", visibleActivities > 0 || ConnectHub.canOpenFromBackground(applicationContext))
        runCatching {
            ApiClient.httpClient().newCall(
                Request.Builder().url("$url/api/connect/devices").post(body.toString().toRequestBody(json)).build(),
            ).execute().close()
        }
    }

    private fun onCommand(url: String, id: String, data: String) {
        val event = runCatching { JSONObject(data) }.getOrNull() ?: return
        if (event.optString("targetId") != id) return
        val command = event.optJSONObject("command") ?: return
        when (command.optString("kind")) {
            "play" -> scope.launch { play(url, command) }
            "pause" -> ConnectHub.dispatch(ConnectHub.PlayerCommand.Pause)
            "resume" -> ConnectHub.dispatch(ConnectHub.PlayerCommand.Resume)
            "stop" -> ConnectHub.dispatch(ConnectHub.PlayerCommand.Stop)
            "seek" -> ConnectHub.dispatch(ConnectHub.PlayerCommand.Seek((command.optDouble("seconds", 0.0) * 1000).toLong()))
        }
    }

    /** « Lire » : demande au serveur quoi lire (fichier, épisode, reprise) puis ouvre le lecteur. */
    private suspend fun play(url: String, command: JSONObject) {
        val type = if (command.optString("mediaType") == "series") "series" else "movie"
        val tmdbId = command.optInt("tmdbId", 0).takeIf { it > 0 } ?: return
        val query = buildString {
            append("tmdbId=").append(tmdbId).append("&type=").append(type)
            if (command.has("season") && command.has("episode")) {
                append("&season=").append(command.optInt("season")).append("&episode=").append(command.optInt("episode"))
            }
            if (command.optBoolean("fromBeginning", false)) append("&fromBeginning=1")
            else if (command.has("resumeSeconds")) append("&resume=").append(command.optDouble("resumeSeconds", 0.0))
        }
        val resolved = withContext(Dispatchers.IO) {
            runCatching {
                ApiClient.httpClient().newCall(Request.Builder().url("$url/api/connect/resolve?$query").build()).execute().use { response ->
                    if (!response.isSuccessful) null else response.body?.string()?.let { JSONObject(it) }
                }
            }.getOrNull()
        } ?: return
        val target = resolved.optJSONObject("target") ?: return
        val items = resolved.optJSONArray("queue") ?: return
        val queue = (0 until items.length()).mapNotNull { i ->
            val item = items.optJSONObject(i) ?: return@mapNotNull null
            QueueItem(
                ratingKey = item.optString("ratingKey").takeIf { it.isNotBlank() } ?: return@mapNotNull null,
                label = item.optString("label").takeIf { it.isNotBlank() && type == "series" },
                seasonNumber = item.optInt("season", -1),
                episodeNumber = item.optInt("episode", -1),
                localKey = item.optString("localKey").takeIf { it.isNotBlank() && it != "null" },
            )
        }
        if (queue.isEmpty()) return
        val startIndex = resolved.optInt("startIndex", 0).coerceIn(0, queue.size - 1)
        val resumeMs = if (resolved.has("resumeSeconds")) (resolved.optDouble("resumeSeconds", 0.0) * 1000).toLong() else null
        val intent = PlayerActivity.forQueue(
            context = this,
            baseUrl = url,
            type = type,
            tmdbId = tmdbId,
            title = target.optString("title"),
            queue = queue,
            startIndex = startIndex,
            // Personne devant l'écran pour répondre à « reprendre ? » : le choix est déjà fait.
            startFromBeginning = resumeMs == null,
            posterPath = target.optString("posterPath").takeIf { it.isNotBlank() && it != "null" },
            profileId = ConnectHub.savedProfile(applicationContext),
            resumeMs = resumeMs,
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        runCatching { startActivity(intent) }.onFailure { Log.w(TAG, "ouverture du lecteur refusée", it) }
    }

    /** État du lecteur ouvert, rapporté aux autres appareils (télécommande). */
    private suspend fun reportStateLoop(url: String, id: String) {
        var lastKey: String? = null
        var lastAt = 0L
        var lastPos = -1L
        while (scope.isActive) {
            val snap = ConnectHub.readPlayer()
            val status = when {
                snap == null -> "idle"
                snap.buffering -> "buffering"
                snap.playing -> "playing"
                else -> "paused"
            }
            val key = "$status:${snap?.tmdbId}:${snap?.season}:${snap?.episode}"
            val now = System.currentTimeMillis()
            val pos = snap?.positionMs ?: 0L
            val due = key != lastKey ||
                (status == "playing" && now - lastAt >= 5_000L) ||
                (status != "playing" && status != "idle" && kotlin.math.abs(pos - lastPos) >= 1_500L)
            if (due && !(lastKey == null && status == "idle")) {
                val state = JSONObject().put("status", status)
                if (snap != null) {
                    state.put("title", snap.title)
                        .put("mediaType", if (snap.type == "movie") "movie" else "series")
                        .put("position", snap.positionMs / 1000.0)
                        .put("duration", snap.durationMs.coerceAtLeast(0L) / 1000.0)
                    if (snap.tmdbId > 0) state.put("tmdbId", snap.tmdbId)
                    if (snap.season >= 0 && snap.episode >= 0) state.put("season", snap.season).put("episode", snap.episode)
                } else {
                    state.put("position", 0).put("duration", 0)
                }
                val body = JSONObject().put("deviceId", id).put("state", state).toString()
                withContext(Dispatchers.IO) {
                    runCatching {
                        ApiClient.httpClient().newCall(Request.Builder().url("$url/api/connect/state").post(body.toRequestBody(json)).build()).execute().close()
                    }
                }
            }
            if (due) {
                lastKey = key
                lastAt = now
                lastPos = pos
            }
            delay(1_000L)
        }
    }

    private fun startAsForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager?.createNotificationChannel(
                NotificationChannel(CHANNEL, "Movviz Connect", NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) },
            )
        }
        val notification: Notification = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this))
            .setSmallIcon(R.drawable.ic_movviz_clapperboard)
            .setContentTitle("Movviz")
            .setContentText("Prêt à recevoir une lecture depuis un autre appareil")
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    companion object {
        private const val TAG = "MovvizConnect"
        private const val CHANNEL = "movviz_connect"
        private const val NOTIFICATION_ID = 4107
        private const val HEARTBEAT_MS = 20_000L
        private const val STOP_GRACE_MS = 5_000L

        @Volatile private var running = false
        @Volatile private var visibleActivities = 0
        private val visibility = kotlinx.coroutines.flow.MutableSharedFlow<Unit>(extraBufferCapacity = 1)
        private val main = android.os.Handler(android.os.Looper.getMainLooper())
        private var pendingStop: Runnable? = null

        fun start(context: Context) {
            pendingStop?.let { main.removeCallbacks(it) }
            pendingStop = null
            if (running) return
            running = true
            val intent = Intent(context, ConnectService::class.java)
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
            }.onFailure {
                running = false
                Log.w(TAG, "démarrage refusé", it)
            }
        }

        fun stop(context: Context) {
            if (!running) return
            running = false
            context.stopService(Intent(context, ConnectService::class.java))
        }

        /** Une activité Movviz passe à l'écran : Connect écoute. */
        fun activityStarted(context: Context) {
            visibleActivities++
            start(context.applicationContext)
            visibility.tryEmit(Unit)
        }

        /** Plus aucune activité à l'écran : Connect s'arrête, sauf « Ouverture à distance ». */
        fun activityStopped(context: Context) {
            visibleActivities = (visibleActivities - 1).coerceAtLeast(0)
            ConnectHub.persistProfile(context.applicationContext)
            visibility.tryEmit(Unit)
            if (visibleActivities > 0 || ConnectHub.remoteWakeEnabled(context)) return
            val app = context.applicationContext
            val stopRun = Runnable { if (visibleActivities == 0 && !ConnectHub.remoteWakeEnabled(app)) stop(app) }
            pendingStop = stopRun
            main.postDelayed(stopRun, STOP_GRACE_MS)
        }
    }
}
