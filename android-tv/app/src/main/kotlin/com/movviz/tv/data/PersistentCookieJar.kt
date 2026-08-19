package com.movviz.tv.data

import android.content.Context
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

// Séparateur de champ non imprimable (Unit Separator ASCII) — un cookie de
// session Movviz ne le contient jamais, contrairement à ";"/" " qui
// apparaissent dans des attributs de cookie légitimes.
private const val FIELD_SEP = "\u001F"
private const val LINE_SEP = "\n"

/**
 * CookieJar qui survit au kill du process — sans ça, l'utilisateur doit se
 * reconnecter à chaque lancement de l'appli sur le boîtier TV, ce qu'aucune
 * appli Plex/Netflix ne demande. Stocke le cookie de session HttpOnly posé
 * par `/api/auth/login` (voir src/lib/auth/session.ts côté serveur) dans des
 * SharedPreferences classiques plutôt que DataStore : l'interface CookieJar
 * d'OkHttp est synchrone (appelée depuis le thread réseau), incompatible
 * avec l'API Flow/suspend de DataStore.
 *
 * Un seul cookie de session par host suffit dans la pratique (Movviz n'en
 * pose qu'un), mais le format supporte plusieurs cookies au cas où.
 */
class PersistentCookieJar(context: Context) : CookieJar {
    private val prefs = context.applicationContext.getSharedPreferences("movviz_cookies", Context.MODE_PRIVATE)
    private val store = mutableMapOf<String, List<Cookie>>()

    init {
        for ((host, raw) in prefs.all) {
            val value = raw as? String ?: continue
            store[host] = value.split(LINE_SEP).mapNotNull { line -> deserialize(line) }
        }
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (cookies.isEmpty()) return
        store[url.host] = cookies
        persist(url.host, cookies)
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookies = store[url.host] ?: return emptyList()
        val now = System.currentTimeMillis()
        val valid = cookies.filter { it.expiresAt > now }
        if (valid.size != cookies.size) {
            store[url.host] = valid
            persist(url.host, valid)
        }
        return valid
    }

    /** Efface le cookie stocké — utilisé à la déconnexion pour ne jamais
     *  laisser une session périmée traîner sur l'appareil partagé du salon. */
    fun clear() {
        store.clear()
        prefs.edit().clear().apply()
    }

    /** Snapshot d'une session pour la rattacher à un profil TV précis. */
    fun snapshot(host: String): String? = prefs.getString(host, null)

    /** Remplace la session active par celle d'un profil enregistré. */
    fun restore(host: String, raw: String?) {
        if (raw.isNullOrBlank()) {
            store.remove(host)
            prefs.edit().remove(host).apply()
            return
        }
        val cookies = raw.split(LINE_SEP).mapNotNull { deserialize(it) }
        store[host] = cookies
        prefs.edit().putString(host, raw).apply()
    }

    private fun persist(host: String, cookies: List<Cookie>) {
        prefs.edit().putString(host, cookies.joinToString(LINE_SEP) { serialize(it) }).apply()
    }

    private fun serialize(cookie: Cookie): String = listOf(
        cookie.name, cookie.value, cookie.domain, cookie.path,
        cookie.expiresAt.toString(), cookie.secure.toString(), cookie.httpOnly.toString(),
    ).joinToString(FIELD_SEP)

    private fun deserialize(line: String): Cookie? {
        val parts = line.split(FIELD_SEP)
        if (parts.size != 7) return null
        return try {
            Cookie.Builder()
                .name(parts[0])
                .value(parts[1])
                .domain(parts[2])
                .path(parts[3])
                .expiresAt(parts[4].toLong())
                .let { if (parts[5].toBoolean()) it.secure() else it }
                .let { if (parts[6].toBoolean()) it.httpOnly() else it }
                .build()
        } catch (e: IllegalArgumentException) {
            null // domaine/format corrompu — on ignore plutôt que de planter au démarrage
        }
    }
}
