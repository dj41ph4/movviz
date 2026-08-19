package com.movviz.tv.data

import android.content.Context
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

    val serverUrl: Flow<String?> = context.dataStore.data.map { it[serverUrlKey] }

    suspend fun setServerUrl(url: String) {
        // Normalise : retire un éventuel "/" final pour que la concaténation
        // avec les chemins d'API ("$base/api/...") ne double jamais le slash.
        val normalized = url.trim().trimEnd('/')
        context.dataStore.edit { it[serverUrlKey] = normalized }
    }

    suspend fun clearServerUrl() {
        context.dataStore.edit { it.remove(serverUrlKey) }
    }
}
