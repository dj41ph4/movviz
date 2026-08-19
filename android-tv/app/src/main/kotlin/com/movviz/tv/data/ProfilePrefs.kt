package com.movviz.tv.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Profil de foyer Android TV. Il référence un compte Movviz existant et sa
 * session, il ne crée pas un second système d'identités côté serveur. */
data class TvProfile(
    val id: String,
    val serverUrl: String,
    val name: String,
    val avatar: String? = null,
    val cookieSnapshot: String? = null,
)

class ProfilePrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("movviz_profiles", Context.MODE_PRIVATE)

    @Synchronized
    fun list(serverUrl: String): List<TvProfile> {
        val raw = prefs.getString(key(serverUrl), null) ?: return emptyList()
        val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return (0 until array.length()).mapNotNull { index ->
            runCatching {
                val item = array.getJSONObject(index)
                TvProfile(item.getString("id"), serverUrl, item.getString("name"), item.optString("avatar").ifBlank { null }, item.optString("cookie").ifBlank { null })
            }.getOrNull()
        }
    }

    @Synchronized
    fun upsert(profile: TvProfile) {
        val next = list(profile.serverUrl).filterNot { it.id == profile.id } + profile
        val array = JSONArray()
        next.forEach {
            array.put(JSONObject().apply {
                put("id", it.id); put("name", it.name)
                put("avatar", it.avatar ?: ""); put("cookie", it.cookieSnapshot ?: "")
            })
        }
        prefs.edit().putString(key(profile.serverUrl), array.toString()).apply()
    }

    private fun key(serverUrl: String): String = "server_${serverUrl.trim().trimEnd('/')}"
}
