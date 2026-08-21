package com.movviz.tv.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "movviz_prefs")

/**
 * Persiste UNIQUEMENT l'URL du serveur choisie dans le wizard — jamais les
 * identifiants ni le cookie de session (celui-ci vit dans le CookieJar
 * OkHttp d'ApiClient, en mémoire pour l'instant ; un CookieJar persistant
 * viendra quand l'appli devra survivre à un redémarrage sans re-login).
 */
class ServerPrefs(private val context: Context) {
    private val serverUrlKey = stringPreferencesKey("server_url")
    private val autoUpdateEnabledKey = booleanPreferencesKey("auto_update_enabled")

    val serverUrl: Flow<String?> = context.dataStore.data.map { it[serverUrlKey] }

    val autoUpdateEnabled: Flow<Boolean> = context.dataStore.data.map { it[autoUpdateEnabledKey] ?: true }

    suspend fun setServerUrl(url: String) {
        val normalized = url.trim().trimEnd('/')
        context.dataStore.edit { it[serverUrlKey] = normalized }
    }

    suspend fun setAutoUpdateEnabled(enabled: Boolean) {
        context.dataStore.edit { it[autoUpdateEnabledKey] = enabled }
    }

    suspend fun clearServerUrl() {
        context.dataStore.edit { it.remove(serverUrlKey) }
    }
}
