package com.movviz.nx.mobile.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Temps réel (mot d'ordre : dynamique et rapide) — écoute /api/events, le
 * même flux que le site web : un « vu », une reprise, « Ma liste » changés
 * sur le PC (ou la TV) arrivent ici à l'instant, sans attendre un
 * rafraîchissement. Chaque événement donne son canal (« watch »,
 * « download », « library »…) à [onEvent], sur le thread principal.
 *
 * Ne tourne que l'app à l'écran (start/stop suivent setAppVisible), se
 * reconnecte seul (1 s, puis jusqu'à 30 s d'écart) et coupe net à l'arrêt.
 * Après une RECONNEXION, il signale « resync » : les événements manqués
 * pendant la coupure sont rattrapés par une seule relecture.
 */
class LiveEvents(val baseUrl: String, private val onEvent: (channel: String, data: String) -> Unit) {
    private var job: Job? = null
    @Volatile private var call: Call? = null

    // Le serveur envoie un « keepalive » toutes les 15 s : 45 s sans rien =
    // connexion morte (Wi-Fi coupé, veille réseau), on se reconnecte.
    private val client by lazy {
        ApiClient.httpClient().newBuilder()
            .readTimeout(45, TimeUnit.SECONDS)
            .callTimeout(0, TimeUnit.MILLISECONDS)
            .build()
    }

    fun start(scope: CoroutineScope) {
        if (job?.isActive == true) return
        job = scope.launch(Dispatchers.IO) {
            var backoff = 1_000L
            var connectedBefore = false
            while (isActive) {
                try {
                    val request = Request.Builder()
                        .url(baseUrl.trimEnd('/') + "/api/events")
                        .header("Accept", "text/event-stream")
                        .build()
                    val current = client.newCall(request)
                    call = current
                    current.execute().use { response ->
                        if (!response.isSuccessful) return@use
                        backoff = 1_000L
                        if (connectedBefore) withContext(Dispatchers.Main) { onEvent("resync", "") }
                        connectedBefore = true
                        val source = response.body?.source() ?: return@use
                        var channel: String? = null
                        val data = StringBuilder()
                        while (isActive) {
                            val line = source.readUtf8Line() ?: break
                            when {
                                line.startsWith("event:") -> channel = line.substring(6).trim()
                                line.startsWith("data:") -> data.append(line.substring(5).trim())
                                line.isEmpty() -> {
                                    val done = channel
                                    val payload = data.toString()
                                    channel = null
                                    data.setLength(0)
                                    if (done != null) withContext(Dispatchers.Main) { onEvent(done, payload) }
                                }
                            }
                        }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    // Coupure, serveur redémarré (mise à jour) : on retente.
                } finally {
                    call = null
                }
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(30_000L)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
        call?.cancel() // débloque une lecture en attente sur le réseau
        call = null
    }
}
