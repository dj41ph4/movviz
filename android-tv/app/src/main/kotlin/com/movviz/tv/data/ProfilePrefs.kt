package com.movviz.tv.data

import android.content.Context

/** Profil local de cette installation — référence un compte Movviz existant
 * sans créer un second système d'identités côté serveur. */
data class TvProfile(
    val id: String,
    val serverUrl: String,
    val name: String,
    val avatar: String? = null,
    val cookieSnapshot: String? = null,
)

/** Cache LOCAL des sessions et identités de profil, par (serveur, compte).
 * La suppression des données de l'app efface donc aussi la liste : aucun
 * profil d'un autre appareil ou d'un ancien foyer ne réapparaît. */
class ProfilePrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("movviz_profiles", Context.MODE_PRIVATE)

    fun getSession(serverUrl: String, userId: String): String? =
        prefs.getString(key(serverUrl, userId), null)

    fun saveSession(serverUrl: String, userId: String, cookie: String) {
        prefs.edit().putString(key(serverUrl, userId), cookie).apply()
    }

    /** Profile identities are device-local; they must not be resurrected from
     * a shared server foyer after the app is deleted and reinstalled. */
    fun saveProfile(serverUrl: String, userId: String, name: String, avatar: String?) {
        prefs.edit().putString(profileKey(serverUrl, userId), "$name\u0000${avatar ?: ""}").apply()
    }

    fun listProfiles(serverUrl: String): List<TvProfile> {
        val normalized = serverUrl.trim().trimEnd('/')
        val prefix = "$normalized|profile|"
        return prefs.all.keys.filter { it.startsWith(prefix) }.mapNotNull { rawKey ->
            val id = rawKey.removePrefix(prefix)
            val raw = prefs.getString(rawKey, null) ?: return@mapNotNull null
            val parts = raw.split('\u0000', limit = 2)
            TvProfile(id, normalized, parts.firstOrNull().orEmpty().ifBlank { id }, parts.getOrNull(1)?.ifBlank { null }, getSession(normalized, id))
        }
    }

    /** Oubli du serveur : purge les sessions locales de TOUS les comptes
     *  liés à cette instance (les profils côté serveur restent, eux). */
    fun clearServer(serverUrl: String) {
        val prefix = "${serverUrl.trim().trimEnd('/')}|"
        prefs.all.keys.filter { it.startsWith(prefix) }.forEach { prefs.edit().remove(it).apply() }
    }

    private fun key(serverUrl: String, userId: String): String =
        "${serverUrl.trim().trimEnd('/')}|$userId"

    private fun profileKey(serverUrl: String, userId: String): String =
        "${serverUrl.trim().trimEnd('/')}|profile|$userId"
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
