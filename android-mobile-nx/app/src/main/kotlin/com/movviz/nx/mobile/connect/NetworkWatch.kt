package com.movviz.nx.mobile.connect

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import com.movviz.nx.mobile.data.ApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Passage 4G → Wi-Fi (ou l'inverse) : sans ça, les connexions HTTP ouvertes en
 * 4G restaient dans le pool d'OkHttp et resservaient une fois en Wi-Fi. Le
 * serveur voyait donc toujours l'adresse 4G, se croyait « hors de chez soi » et
 * cachait les écrans du salon jusqu'au redémarrage de l'app. Ici : pool vidé
 * (connexions au repos seulement : une vidéo en cours n'est pas coupée) et
 * [generation] incrémenté, que le panneau « Lire sur… » suit pour relancer
 * aussitôt toutes ses recherches.
 */
object NetworkWatch {
    private val _generation = MutableStateFlow(0)
    val generation: StateFlow<Int> = _generation.asStateFlow()

    @Volatile private var registered = false
    /** Réseau par défaut et son type (Wi-Fi ou non) au dernier relevé. */
    @Volatile private var last: Pair<Network, Boolean>? = null

    fun start(context: Context) {
        if (registered) return
        val cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        registered = runCatching {
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                    val now = network to caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                    val before = last
                    last = now
                    // Premier relevé au démarrage : rien n'a changé.
                    if (before != null && before != now) changed()
                }
                override fun onLost(network: Network) {
                    if (last?.first == network) { last = null; changed() }
                }
            })
        }.isSuccess
    }

    private fun changed() {
        runCatching { ApiClient.httpClient().connectionPool.evictAll() }
        _generation.value += 1
    }
}
