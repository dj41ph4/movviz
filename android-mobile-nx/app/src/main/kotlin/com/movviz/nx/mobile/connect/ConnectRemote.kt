package com.movviz.nx.mobile.connect

import android.content.Context
import android.os.Build
import com.movviz.nx.mobile.data.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID

/** Un appareil Movviz du compte qui accepte une lecture (TV, navigateur…). */
data class ConnectDevice(
    val id: String,
    val name: String,
    val kind: String,
    /** « movviz » (app Movviz), « chromecast » ou « dlna » (écran du réseau trouvé par le serveur). */
    val via: String,
    val state: ConnectState?,
)

data class ConnectState(
    val status: String,
    val title: String?,
    val season: Int?,
    val episode: Int?,
    val positionSec: Double,
    val durationSec: Double,
    /** Horloge locale à la réception : sert à faire avancer la position entre deux relevés. */
    val receivedAt: Long,
) {
    val active: Boolean get() = status == "playing" || status == "paused" || status == "buffering" || status == "loading"
    fun livePosition(now: Long): Double {
        if (status != "playing") return positionSec
        val ahead = positionSec + (now - receivedAt) / 1000.0
        return if (durationSec > 0) ahead.coerceAtMost(durationSec) else ahead
    }
}

/** Ce que « Caster » envoie : le titre (le serveur choisit l'épisode en cours pour une série). */
data class CastPayload(
    val title: String,
    val mediaType: String,
    val tmdbId: Int,
    val season: Int? = null,
    val episode: Int? = null,
    val resumeSeconds: Double? = null,
)

/**
 * Movviz Connect côté téléphone : la liste des appareils du compte, l'envoi
 * d'une lecture et la télécommande (pause, reprendre, aller à, arrêter).
 */
object ConnectRemote {
    private const val PREFS = "movviz_connect"
    private const val KEY_ID = "device_id"
    private val json = "application/json".toMediaType()

    private val _devices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val devices: StateFlow<List<ConnectDevice>> = _devices.asStateFlow()

    /** Appareil auquel ce téléphone a envoyé la dernière lecture. */
    private val _controlledId = MutableStateFlow<String?>(null)
    val controlledId: StateFlow<String?> = _controlledId.asStateFlow()

    fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_ID, null)?.takeIf { Regex("^[A-Za-z0-9_-]{8,64}$").matches(it) }?.let { return it }
        val fresh = UUID.randomUUID().toString().replace("-", "")
        prefs.edit().putString(KEY_ID, fresh).apply()
        return fresh
    }

    private fun deviceName(): String {
        val maker = Build.MANUFACTURER?.replaceFirstChar { it.uppercase() }.orEmpty()
        val model = Build.MODEL.orEmpty()
        val name = if (model.startsWith(maker, ignoreCase = true)) model else "$maker $model".trim()
        return name.ifBlank { "Téléphone Android" }.take(60)
    }

    /** Se déclare (sans être récepteur : les ordres « lire » vont aux TV) puis relit la liste. */
    suspend fun refresh(context: Context, baseUrl: String) = withContext(Dispatchers.IO) {
        val base = baseUrl.trimEnd('/')
        val id = deviceId(context)
        runCatching {
            val body = JSONObject().put("id", id).put("name", deviceName()).put("kind", "mobile").put("receiver", false)
            ApiClient.httpClient().newCall(Request.Builder().url("$base/api/connect/devices").post(body.toString().toRequestBody(json)).build()).execute().close()
        }
        val list = runCatching {
            ApiClient.httpClient().newCall(Request.Builder().url("$base/api/connect/devices").build()).execute().use { response ->
                // Session expirée ou serveur sans Connect : liste vide, jamais une TV fantôme.
                if (response.code == 401 || response.code == 404) return@use emptyList()
                if (!response.isSuccessful) return@use null
                val array = JSONObject(response.body?.string() ?: "{}").optJSONArray("devices") ?: return@use emptyList()
                val now = System.currentTimeMillis()
                (0 until array.length()).mapNotNull { i ->
                    val d = array.optJSONObject(i) ?: return@mapNotNull null
                    if (!d.optBoolean("receiver") || d.optString("id") == id) return@mapNotNull null
                    val s = d.optJSONObject("state")
                    ConnectDevice(
                        id = d.optString("id"),
                        name = d.optString("name"),
                        kind = d.optString("kind"),
                        via = d.optString("via", "movviz"),
                        state = s?.let {
                            ConnectState(
                                status = it.optString("status", "idle"),
                                title = it.optString("title").takeIf { t -> t.isNotBlank() },
                                season = if (it.has("season")) it.optInt("season") else null,
                                episode = if (it.has("episode")) it.optInt("episode") else null,
                                positionSec = it.optDouble("position", 0.0),
                                durationSec = it.optDouble("duration", 0.0),
                                receivedAt = now,
                            )
                        },
                    )
                }.sortedBy { it.name.lowercase() }
            }
        }.getOrNull()
        if (list != null) _devices.value = list
    }

    /** Vrai si l'ordre est parti ; faux si l'appareil n'est plus là (la liste est alors relue). */
    private suspend fun post(context: Context, baseUrl: String, targetId: String, command: JSONObject): Boolean = withContext(Dispatchers.IO) {
        val base = baseUrl.trimEnd('/')
        val body = JSONObject().put("targetId", targetId).put("fromId", deviceId(context)).put("command", command)
        runCatching {
            ApiClient.httpClient().newCall(Request.Builder().url("$base/api/connect/command").post(body.toString().toRequestBody(json)).build()).execute().use { it.isSuccessful }
        }.getOrDefault(false)
    }

    suspend fun play(context: Context, baseUrl: String, device: ConnectDevice, payload: CastPayload): Boolean {
        val command = JSONObject().put("kind", "play").put("title", payload.title).put("mediaType", payload.mediaType).put("tmdbId", payload.tmdbId)
        if (payload.season != null && payload.episode != null) command.put("season", payload.season).put("episode", payload.episode)
        payload.resumeSeconds?.let { command.put("resumeSeconds", it) }
        val ok = post(context, baseUrl, device.id, command)
        if (ok) {
            _controlledId.value = device.id
            _devices.value = _devices.value.map {
                if (it.id == device.id) it.copy(state = ConnectState("loading", payload.title, payload.season, payload.episode, payload.resumeSeconds ?: 0.0, it.state?.durationSec ?: 0.0, System.currentTimeMillis())) else it
            }
        } else {
            refresh(context, baseUrl)
        }
        return ok
    }

    suspend fun control(context: Context, baseUrl: String, device: ConnectDevice, kind: String, seconds: Double? = null): Boolean {
        val command = JSONObject().put("kind", kind)
        if (seconds != null) command.put("seconds", seconds.coerceAtLeast(0.0))
        val ok = post(context, baseUrl, device.id, command)
        if (ok) {
            _controlledId.value = device.id
            val now = System.currentTimeMillis()
            _devices.value = _devices.value.map { d ->
                val s = d.state
                if (d.id != device.id || s == null) d
                else d.copy(state = when (kind) {
                    "pause" -> s.copy(status = "paused", positionSec = s.livePosition(now), receivedAt = now)
                    "resume" -> s.copy(status = "playing", receivedAt = now)
                    "seek" -> s.copy(positionSec = seconds ?: s.positionSec, receivedAt = now)
                    else -> s.copy(status = "idle", positionSec = 0.0, durationSec = 0.0)
                })
            }
        }
        return ok
    }
}
