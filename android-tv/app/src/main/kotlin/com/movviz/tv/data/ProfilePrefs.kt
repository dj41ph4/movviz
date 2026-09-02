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

/** Préférence de sous-titres mémorisée localement par profil ET média.
 * Absence de valeur = OFF : on ne laisse jamais ExoPlayer activer une piste
 * texte de lui-même au premier lancement d'un film/épisode. */
data class SubtitlePreference(
    val enabled: Boolean,
    val language: String? = null,
)

class PlaybackPrefs(
    context: Context,
    private val serverUrl: String,
    private val profileId: String,
) {
    private val prefs = context.applicationContext.getSharedPreferences("movviz_playback_prefs", Context.MODE_PRIVATE)

    fun subtitlePreference(mediaKey: String): SubtitlePreference {
        val prefix = key(mediaKey)
        val enabled = prefs.getBoolean("$prefix|enabled", false)
        val language = prefs.getString("$prefix|language", null)
        return SubtitlePreference(enabled = enabled, language = language)
    }

    fun saveSubtitlePreference(mediaKey: String, enabled: Boolean, language: String? = null) {
        prefs.edit()
            .putBoolean("${key(mediaKey)}|enabled", enabled)
            .putString("${key(mediaKey)}|language", language)
            .apply()
    }

    private fun key(mediaKey: String): String =
        "${serverUrl.trim().trimEnd('/')}|$profileId|subtitle|$mediaKey"
}
