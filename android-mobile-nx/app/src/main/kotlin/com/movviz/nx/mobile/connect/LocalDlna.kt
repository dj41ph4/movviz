package com.movviz.nx.mobile.connect

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import com.movviz.nx.mobile.data.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.math.abs

/** Téléviseur DLNA (Samsung, LG… sans Google Cast) vu par le téléphone sur son Wi-Fi. */
data class DlnaScreen(val id: String, val name: String, val controlUrl: String, val serviceType: String, val samsung: Boolean = false)

/** Réseau Wi-Fi du téléphone (ni VPN ni données mobiles). */
internal object WifiNet {
    @Suppress("DEPRECATION")
    fun network(context: Context): Network? {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return null
        return cm.allNetworks.firstOrNull { n ->
            val caps = cm.getNetworkCapabilities(n)
            caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        }
    }
}

/**
 * DLNA côté téléphone : chez un ami, le serveur ne voit pas son réseau, c'est le
 * téléphone qui trouve le téléviseur (SSDP) et lui confie le lien public signé
 * du serveur Movviz. Ensuite le téléviseur lit SEUL, directement depuis le
 * serveur : le téléphone ne relaie rien, il sert juste de télécommande
 * (UPnP AVTransport : pause, position, sauts, arrêt).
 *
 * Paliers : 1. fichier tel quel (le téléviseur décode et navigue lui-même) ;
 * 2. flux H.264 1080p + AAC que tout téléviseur lit (vieux modèle, 4K/HDR) ;
 * 3. même chose en HTTP si le serveur a une adresse HTTP publique
 * (MOVVIZ_PUBLIC_HTTP_URL) — DLNA ne prévoit pas le HTTPS et certains
 * téléviseurs le refusent.
 */
object LocalDlna {
    const val DEVICE_ID = "dlna_local"
    private const val SSDP_ADDR = "239.255.255.250"
    private const val SSDP_PORT = 1900
    private val TARGETS = listOf("urn:schemas-upnp-org:device:MediaRenderer:1", "urn:schemas-upnp-org:service:AVTransport:1")
    private val json = "application/json".toMediaType()
    private val xml = "text/xml; charset=\"utf-8\"".toMediaType()

    // Client à part : aucun cookie de session Movviz n'est envoyé au téléviseur.
    private val tv = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(6, TimeUnit.SECONDS)
        .callTimeout(8, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _screens = MutableStateFlow<List<DlnaScreen>>(emptyList())
    val screens: StateFlow<List<DlnaScreen>> = _screens.asStateFlow()

    /** Vrai pendant la toute première recherche (panneau : « Recherche des écrans… »). */
    private val _searching = MutableStateFlow(false)
    val searching: StateFlow<Boolean> = _searching.asStateFlow()

    private val _device = MutableStateFlow<ConnectDevice?>(null)
    val device: StateFlow<ConnectDevice?> = _device.asStateFlow()

    private var discovery: Job? = null
    /** Descriptions déjà lues (adresse → écran) : un passage ne relit que les nouveaux. */
    private val described = ConcurrentHashMap<String, DlnaScreen>()

    /** Lien public demandé au serveur. [stream] = flux continu (repli H.264), sans plages d'octets. */
    private class Link(
        val url: String, val httpUrl: String?, val mime: String, val label: String, val poster: String?,
        val startSec: Double, val durationSec: Double, val sizeBytes: Long?, val progressId: String?, val stream: Boolean,
    )

    private class Current(val baseUrl: String, val screen: DlnaScreen, val payload: CastPayload, val link: Link, val url: String) {
        /** Flux continu : position = début du flux + RelTime. */
        var offset = 0.0
        /** Dernière position sûre (null tant que le téléviseur n'en a donné aucune). */
        var position: Double? = null
        var status = "loading"
        var sequence = 0
        var lastBeat = 0L
        var poll: Job? = null
        @Volatile var reloading = false
    }
    @Volatile private var current: Current? = null

    val active: Boolean get() = current != null

    // ── Recherche ────────────────────────────────────────────────────────

    /** Recherche pendant que le panneau est ouvert, relancée toutes les 10 s et dès que le réseau change. */
    fun startDiscovery(context: Context) {
        if (discovery?.isActive == true) return
        val app = context.applicationContext
        discovery = scope.launch {
            _searching.value = _screens.value.isEmpty()
            while (isActive) {
                val found = runCatching { search(app) }.getOrDefault(emptyList())
                // Un téléviseur en cours de lecture reste listé même s'il n'a pas répondu à ce passage.
                val playing = current?.screen
                _screens.value = (found + listOfNotNull(playing?.takeIf { p -> found.none { it.id == p.id } }))
                    .sortedBy { it.name.lowercase() }
                _searching.value = false
                // 10 s, ou tout de suite après un passage 4G → Wi-Fi (écrans du nouveau réseau).
                val gen = NetworkWatch.generation.value
                withTimeoutOrNull(10_000L) { NetworkWatch.generation.first { it != gen } }
                    ?.let { _searching.value = true }
            }
        }
    }

    fun stopDiscovery() {
        discovery?.cancel()
        discovery = null
        _searching.value = false
    }

    private suspend fun search(context: Context): List<DlnaScreen> {
        val wifi = context.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        // Sans ce verrou, beaucoup de téléphones jettent les réponses multicast.
        val lock = runCatching { wifi?.createMulticastLock("movviz-dlna")?.apply { setReferenceCounted(false); acquire() } }.getOrNull()
        val locations = linkedSetOf<String>()
        try {
            DatagramSocket().use { socket ->
                // Sur le Wi-Fi, même avec un VPN actif ou un Wi-Fi « sans Internet ».
                WifiNet.network(context)?.let { net -> runCatching { net.bindSocket(socket) } }
                socket.soTimeout = 400
                val group = InetAddress.getByName(SSDP_ADDR)
                val queries = TARGETS.map { st ->
                    ("M-SEARCH * HTTP/1.1\r\nHOST: $SSDP_ADDR:$SSDP_PORT\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\n" +
                        "ST: $st\r\nUSER-AGENT: Android UPnP/1.1 Movviz/1\r\n\r\n").toByteArray()
                }
                fun sendAll() = queries.forEach { q -> runCatching { socket.send(DatagramPacket(q, q.size, group, SSDP_PORT)) } }
                // Deux envois : un paquet UDP perdu ne fait pas disparaître le téléviseur.
                sendAll()
                val begin = System.currentTimeMillis()
                var resent = false
                val buffer = ByteArray(2048)
                while (System.currentTimeMillis() - begin < 2_800) {
                    if (!resent && System.currentTimeMillis() - begin > 400) { sendAll(); resent = true }
                    val packet = DatagramPacket(buffer, buffer.size)
                    try { socket.receive(packet) } catch (_: SocketTimeoutException) { continue }
                    val text = String(packet.data, 0, packet.length, Charsets.UTF_8)
                    if (!text.startsWith("HTTP/1.1 200", ignoreCase = true)) continue
                    Regex("""(?im)^location:\s*(\S+)""").find(text)?.groupValues?.get(1)
                        ?.takeIf { it.startsWith("http://") || it.startsWith("https://") }
                        ?.let { if (locations.size < 32) locations.add(it) }
                }
            }
        } finally {
            runCatching { lock?.release() }
        }
        // Descriptions en parallèle, et seulement pour les adresses nouvelles.
        return withContext(Dispatchers.IO) {
            locations.map { loc -> async { described[loc] ?: describe(loc)?.also { described[loc] = it } } }.awaitAll()
        }.filterNotNull().distinctBy { it.id }
    }

    private fun describe(location: String): DlnaScreen? = runCatching {
        val body = tv.newCall(Request.Builder().url(location).build()).execute().use { r ->
            if (!r.isSuccessful) return null
            r.body?.string()?.take(512 * 1024) ?: return null
        }
        parseDescription(body, location)
    }.getOrNull()

    // ── Lecture ──────────────────────────────────────────────────────────

    enum class Result { OK, FAILED, LOCAL_FILE_REQUIRED, REFUSED }

    private fun requestLink(baseUrl: String, payload: CastPayload, compat: Boolean): Any? {
        val body = JSONObject().put("title", payload.title).put("mediaType", payload.mediaType).put("tmdbId", payload.tmdbId)
            .put("via", if (compat) "dlna-compat" else "dlna")
        if (payload.season != null && payload.episode != null) body.put("season", payload.season).put("episode", payload.episode)
        payload.resumeSeconds?.let { body.put("resumeSeconds", it) }
        val res = runCatching {
            ApiClient.httpClient().newCall(Request.Builder().url("${baseUrl.trimEnd('/')}/api/connect/link").post(body.toString().toRequestBody(json)).build()).execute().use { r ->
                val text = r.body?.string().orEmpty()
                if (!r.isSuccessful) return@use if (text.contains("local_file_required")) "local" else null
                JSONObject(text)
            }
        }.getOrNull()
        if (res !is JSONObject) return res
        val title = res.optString("title").takeIf { it.isNotBlank() } ?: payload.title
        val subtitle = res.optString("subtitle").takeIf { it.isNotBlank() && it != "null" }
        return Link(
            url = res.getString("url"),
            httpUrl = res.optString("httpUrl").takeIf { it.startsWith("http://") },
            mime = res.optString("contentType").takeIf { it.startsWith("video/") } ?: "video/mp4",
            label = if (subtitle != null) "$title — $subtitle" else title,
            poster = res.optString("posterUrl").takeIf { it.startsWith("https://") },
            startSec = res.optDouble("startSec", 0.0),
            durationSec = res.optDouble("durationSec", 0.0),
            sizeBytes = res.optLong("sizeBytes", 0L).takeIf { it > 0 },
            progressId = res.optString("progressSessionId").takeIf { it.isNotBlank() && it != "null" },
            stream = res.optBoolean("stream", compat),
        )
    }

    /**
     * Charge une URL sur le téléviseur et attend qu'il lise VRAIMENT : beaucoup de
     * téléviseurs acceptent l'URL puis abandonnent (format, 4K/HDR), ou passent en
     * PLAYING avant d'afficher « format non pris en charge ». Seule une position
     * qui avance prouve la lecture.
     */
    private suspend fun loadAndConfirm(screen: DlnaScreen, link: Link, url: String, startSec: Double, waitMs: Long, stage: (String) -> Unit): Boolean {
        val target = if (link.stream && startSec > 0) "$url${if (url.contains('?')) "&" else "?"}t=${startSec.toLong()}" else url
        // Les téléviseurs Samsung attendent « video/x-mkv » et refusent « video/x-matroska ».
        val mime = if (screen.samsung && link.mime == "video/x-matroska") "video/x-mkv" else link.mime
        // Un lecteur occupé refuse parfois une nouvelle URL : on l'arrête d'abord, sans tenir compte d'un refus.
        soap(screen, "Stop", "")
        val meta = didl(target, link.label, mime, link.poster, link.stream, link.durationSec, if (link.stream) null else link.sizeBytes)
        soap(screen, "SetAVTransportURI", "<CurrentURI>${esc(target)}</CurrentURI><CurrentURIMetaData>${esc(meta)}</CurrentURIMetaData>") ?: return false
        // Certains téléviseurs démarrent seuls et répondent une erreur à Play (701) : sans importance.
        soap(screen, "Play", "<Speed>1</Speed>")
        val begin = System.currentTimeMillis()
        var replays = 0
        var playingReadings = 0
        var lastRel: Double? = null
        while (System.currentTimeMillis() - begin < waitMs) {
            delay(1_000L)
            val elapsed = System.currentTimeMillis() - begin
            if (elapsed > 3_000) stage("En attente de la lecture… ${elapsed / 1000} s")
            val st = status(screen) ?: continue
            when (st.first) {
                "playing" -> {
                    val rel = st.second
                    playingReadings++
                    // Preuve : la position avance (ou, sans position fournie, trois relevés PLAYING de suite).
                    if ((rel != null && lastRel != null && rel > lastRel) || (rel == null && playingReadings >= 3)) {
                        if (!link.stream && startSec > 5) seekVerified(screen, startSec)
                        return true
                    }
                    lastRel = rel
                }
                "paused" -> return true
                "buffering" -> playingReadings = 0
                else -> {
                    playingReadings = 0
                    lastRel = null
                    // Toujours à l'arrêt : on relance Play deux fois (2,5 s puis 5 s), puis refus après 14 s.
                    if ((replays == 0 && elapsed > 2_500) || (replays == 1 && elapsed > 5_000)) {
                        replays++
                        soap(screen, "Play", "<Speed>1</Speed>")
                    } else if (elapsed > 14_000) return false
                }
            }
        }
        return false
    }

    /** Aller à la position de reprise, vérifié (certains Samsung ignorent le premier Seek). */
    private suspend fun seekVerified(screen: DlnaScreen, target: Double) {
        repeat(3) {
            soap(screen, "Seek", "<Unit>REL_TIME</Unit><Target>${hms(target)}</Target>")
            delay(1_500L)
            val pos = status(screen)?.second
            if (pos == null || abs(pos - target) < 20) return
        }
    }

    /**
     * Envoie le titre au téléviseur. [onStage] décrit l'étape en cours pour la ligne
     * du panneau. Le téléviseur lit ensuite seul depuis le serveur.
     */
    suspend fun castTo(baseUrl: String, screen: DlnaScreen, payload: CastPayload, onStage: (String) -> Unit = {}): Result = withContext(Dispatchers.IO) {
        onStage("Préparation…")
        val first = requestLink(baseUrl, payload, compat = false)
        if (first == "local") return@withContext Result.LOCAL_FILE_REQUIRED
        if (first !is Link) return@withContext Result.FAILED
        // Une seule lecture à la fois : l'écran précédent (DLNA ou Google Cast) s'arrête.
        stopActive()
        LocalCast.stopActive()
        var link: Link = first
        var url = link.url
        var ok = false
        var open: String? = link.progressId
        try {
            onStage("Connexion au téléviseur…")
            ok = loadAndConfirm(screen, link, url, link.startSec, 25_000L, onStage)
            if (!ok && !link.stream) {
                onStage("Format refusé, conversion en cours…")
                closeProgress(baseUrl, open); open = null
                val second = requestLink(baseUrl, payload, compat = true)
                if (second is Link) {
                    link = second; url = link.url; open = link.progressId
                    ok = loadAndConfirm(screen, link, url, link.startSec, 35_000L, onStage)
                }
            }
            val http = link.httpUrl
            if (!ok && http != null) {
                onStage("Nouvel essai sans chiffrement…")
                url = http
                ok = loadAndConfirm(screen, link, url, link.startSec, 30_000L, onStage)
            }
        } finally {
            // Abandon (refus ou panneau fermé) : la session d'avancement ne reste jamais ouverte.
            if (!ok) withContext(NonCancellable) {
                closeProgress(baseUrl, open)
                soap(screen, "Stop", "")
            }
        }
        if (!ok) return@withContext Result.REFUSED
        val c = Current(baseUrl, screen, payload, link, url)
        c.offset = if (link.stream) link.startSec else 0.0
        c.position = link.startSec
        c.status = "playing"
        current = c
        publish(c)
        c.poll = scope.launch {
            var misses = 0
            var idle = 0
            while (isActive && current === c) {
                delay(2_000L)
                if (c.reloading) continue
                val st = status(screen)
                if (st == null) {
                    // Téléviseur éteint ou Wi-Fi quitté : on abandonne après ~30 s sans réponse.
                    if (++misses >= 15) { finish(false); break }
                    continue
                }
                misses = 0
                if (st.first == "idle") {
                    // Deux relevés à l'arrêt de suite (un STOPPED passager pendant un saut ne compte pas).
                    if (++idle < 2) continue
                    // Fin seulement près de la vraie fin (même règle que Google Cast).
                    val pos = c.position
                    finish(link.durationSec > 0 && pos != null && pos >= link.durationSec - 120)
                    break
                }
                idle = 0
                c.status = st.first
                st.second?.let { c.position = c.offset + it }
                publish(c)
            }
        }
        Result.OK
    }

    suspend fun control(kind: String, seconds: Double?): Boolean = withContext(Dispatchers.IO) {
        val c = current ?: return@withContext false
        val s = c.screen
        when (kind) {
            "pause" -> soap(s, "Pause", "")?.also { c.status = "paused"; publish(c) } != null
            "resume" -> soap(s, "Play", "<Speed>1</Speed>")?.also { c.status = "playing"; publish(c) } != null
            "seek" -> {
                val target = (seconds ?: 0.0).coerceAtLeast(0.0)
                if (c.link.stream) {
                    // Flux continu (pas de plages d'octets) : on recharge à la nouvelle position.
                    c.reloading = true
                    val before = c.position
                    c.status = "buffering"; c.position = target; publish(c)
                    var ok = false
                    try {
                        ok = loadAndConfirm(s, c.link, c.url, target, 30_000L) {}
                    } finally {
                        // Échec : on garde l'ancienne position (un saut raté vers la fin ne vaut jamais « terminé »).
                        if (ok) { c.offset = target; c.status = "playing" } else { c.position = before; c.status = "paused" }
                        publish(c)
                        c.reloading = false
                    }
                    ok
                } else {
                    soap(s, "Seek", "<Unit>REL_TIME</Unit><Target>${hms(target)}</Target>")?.also { c.position = target; publish(c) } != null
                }
            }
            "stop" -> { soap(s, "Stop", ""); finish(false); true }
            else -> false
        }
    }

    /** Arrête la lecture DLNA pilotée d'ici (avant d'en lancer une autre ailleurs). */
    suspend fun stopActive() {
        val c = current ?: return
        withContext(Dispatchers.IO) { soap(c.screen, "Stop", "") }
        finish(false)
    }

    private fun publish(c: Current) {
        val p = c.payload
        _device.value = ConnectDevice(
            DEVICE_ID, c.screen.name, "network", "dlna",
            ConnectState(c.status, p.title, p.season, p.episode, c.position ?: 0.0, c.link.durationSec, System.currentTimeMillis()),
        )
        heartbeat(c)
    }

    private fun heartbeat(c: Current) {
        val id = c.link.progressId ?: return
        val position = c.position ?: return // position inconnue : jamais de 0 qui écraserait la reprise
        val now = System.currentTimeMillis()
        if (now - c.lastBeat < 10_000) return
        c.lastBeat = now
        val body = JSONObject().put("sequence", ++c.sequence).put("positionMs", (position * 1000).toLong()).put("isPlaying", c.status == "playing").put("mode", "dlna")
        post("${c.baseUrl.trimEnd('/')}/api/playback/sessions/$id/heartbeat", body)
    }

    private fun finish(completed: Boolean) {
        val c = current ?: return
        current = null
        c.poll?.cancel()
        _device.value = null
        val id = c.link.progressId ?: return
        val position = if (completed) c.link.durationSec else c.position
        post("${c.baseUrl.trimEnd('/')}/api/playback/sessions/$id/stop", JSONObject().apply { position?.let { put("positionMs", (it * 1000).toLong()) } })
    }

    /** Session d'avancement d'un essai abandonné : fermée sans toucher à la position. */
    private fun closeProgress(baseUrl: String, id: String?) {
        id ?: return
        post("${baseUrl.trimEnd('/')}/api/playback/sessions/$id/stop", JSONObject())
    }

    private fun post(url: String, body: JSONObject) {
        scope.launch {
            runCatching { ApiClient.httpClient().newCall(Request.Builder().url(url).post(body.toString().toRequestBody(json)).build()).execute().close() }
        }
    }

    // ── UPnP AVTransport ─────────────────────────────────────────────────

    /** Réponse SOAP, ou null si le téléviseur refuse ou ne répond pas. */
    private fun soap(s: DlnaScreen, action: String, args: String): String? = runCatching {
        val envelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">" +
            "<s:Body><u:$action xmlns:u=\"${s.serviceType}\"><InstanceID>0</InstanceID>$args</u:$action></s:Body></s:Envelope>"
        tv.newCall(
            Request.Builder().url(s.controlUrl)
                .header("SOAPAction", "\"${s.serviceType}#$action\"")
                .post(envelope.toRequestBody(xml))
                .build(),
        ).execute().use { r -> if (r.isSuccessful) r.body?.string()?.take(256 * 1024).orEmpty() else null }
    }.getOrNull()

    /** (état, position en secondes ou null si inconnue), ou null sans réponse. */
    private fun status(s: DlnaScreen): Pair<String, Double?>? {
        val transport = soap(s, "GetTransportInfo", "") ?: return null
        val position = soap(s, "GetPositionInfo", "")
        val raw = (inner(transport, "CurrentTransportState") ?: "").uppercase()
        val state = when (raw) {
            "PLAYING" -> "playing"
            "PAUSED_PLAYBACK" -> "paused"
            "TRANSITIONING" -> "buffering"
            else -> "idle"
        }
        return state to parseHms(position?.let { inner(it, "RelTime") })
    }

    // ── Outils (purs) ────────────────────────────────────────────────────

    internal fun parseDescription(xml: String, location: String): DlnaScreen? {
        val udn = tag(xml, "UDN") ?: return null
        val name = (tag(xml, "friendlyName") ?: tag(xml, "modelName") ?: return null).take(60)
        val service = Regex("""(?is)<(?:\w+:)?service>(.*?)</(?:\w+:)?service>""").findAll(xml)
            .map { it.groupValues[1] }
            .firstOrNull { (tag(it, "serviceType") ?: "").contains("AVTransport") } ?: return null
        val type = tag(service, "serviceType") ?: return null
        val control = tag(service, "controlURL") ?: return null
        // UPnP 1.0 : URLBase, si présente, sert de base aux URL relatives.
        val base = tag(xml, "URLBase")?.takeIf { it.startsWith("http") } ?: location
        val url = runCatching { URL(URL(base), control).toString() }.getOrNull() ?: return null
        val samsung = (tag(xml, "manufacturer") ?: "").contains("samsung", ignoreCase = true)
        return DlnaScreen(udn, name, url, type, samsung)
    }

    private fun tag(xml: String, name: String): String? =
        Regex("""(?is)<(?:\w+:)?$name[^>]*>(.*?)</(?:\w+:)?$name>""").find(xml)?.groupValues?.get(1)?.trim()?.let(::unescape)

    private fun inner(xml: String, name: String): String? =
        Regex("""(?is)<$name>(.*?)</$name>""").find(xml)?.groupValues?.get(1)?.let(::unescape)

    private fun unescape(v: String) = v.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")

    private fun esc(v: String) = v.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")

    internal fun hms(seconds: Double): String {
        val s = seconds.toLong().coerceAtLeast(0)
        return "%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)
    }

    /** « 01:02:03(.xxx) » → secondes ; null si absent ou illisible (NOT_IMPLEMENTED…). */
    internal fun parseHms(value: String?): Double? {
        val m = Regex("""^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$""").find(value?.trim().orEmpty()) ?: return null
        return m.groupValues[1].toDouble() * 3600 + m.groupValues[2].toDouble() * 60 + m.groupValues[3].toDouble()
    }

    /** Fiche DIDL-Lite (titre, durée, taille, profil DLNA) : beaucoup de téléviseurs l'exigent. */
    private fun didl(url: String, title: String, mime: String, poster: String?, stream: Boolean, durationSec: Double, size: Long?): String {
        // Flux continu (repli) : aucun déplacement par octets (OP=00), contenu converti (CI=1).
        val op = if (stream) "DLNA.ORG_OP=00;DLNA.ORG_CI=1" else "DLNA.ORG_OP=01;DLNA.ORG_CI=0"
        // Durée au format DIDL « H:MM:SS.000 ».
        val duration = if (durationSec > 0) {
            val s = durationSec.toLong()
            " duration=\"${s / 3600}:${"%02d".format((s % 3600) / 60)}:${"%02d".format(s % 60)}.000\""
        } else ""
        val sizeAttr = size?.let { " size=\"$it\"" }.orEmpty()
        val res = "<res protocolInfo=\"http-get:*:${esc(mime)}:$op;DLNA.ORG_FLAGS=01700000000000000000000000000000\"$duration$sizeAttr>${esc(url)}</res>"
        val art = poster?.let { "<upnp:albumArtURI>${esc(it)}</upnp:albumArtURI>" }.orEmpty()
        return "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\">" +
            "<item id=\"movviz\" parentID=\"0\" restricted=\"1\"><dc:title>${esc(title)}</dc:title><upnp:class>object.item.videoItem.movie</upnp:class>$art$res</item></DIDL-Lite>"
    }
}
