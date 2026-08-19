package com.movviz.tv.data

import android.content.Context

/** Profil de foyer Android TV — référence un compte Movviz existant (il ne
 *  crée pas un second système d'identités côté serveur). La liste des profils
 *  est encrée côté serveur (/api/tv-profiles, lecture admin-only) ;
 *  `cookieSnapshot` n'est rempli que depuis le cache LOCAL de l'appareil et
 *  ne monte jamais vers le serveur. */
data class TvProfile(
    val id: String,
    val serverUrl: String,
    val name: String,
    val avatar: String? = null,
    val cookieSnapshot: String? = null,
)

/** Cache LOCAL des sessions de profil (cookies), par (serveur, compte).
 *
 *  Ne JAMAIS monter vers le serveur : seule la liste d'identités des profils
 *  du foyer vit côté serveur (/api/tv-profiles), les sessions restent sur
 *  l'appareil — comme Netflix, un nouvel appareil redemande le mot de passe
 *  la première fois. */
class ProfilePrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("movviz_profiles", Context.MODE_PRIVATE)

    fun getSession(serverUrl: String, userId: String): String? =
        prefs.getString(key(serverUrl, userId), null)

    fun saveSession(serverUrl: String, userId: String, cookie: String) {
        prefs.edit().putString(key(serverUrl, userId), cookie).apply()
    }

    /** Oubli du serveur : purge les sessions locales de TOUS les comptes
     *  liés à cette instance (les profils côté serveur restent, eux). */
    fun clearServer(serverUrl: String) {
        val prefix = "${serverUrl.trim().trimEnd('/')}|"
        prefs.all.keys.filter { it.startsWith(prefix) }.forEach { prefs.edit().remove(it).apply() }
    }

    private fun key(serverUrl: String, userId: String): String =
        "${serverUrl.trim().trimEnd('/')}|$userId"
}