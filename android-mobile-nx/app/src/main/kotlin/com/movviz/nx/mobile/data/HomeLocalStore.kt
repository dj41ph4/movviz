package com.movviz.nx.mobile.data

import android.content.Context
import android.util.Log
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.File
import java.security.MessageDigest

/** Snapshot borné du premier écran TV. Il reprend les DTO existants, sans
 * seconde représentation métier, et ne peut jamais traverser un profil. */
data class HomeSnapshot(
    val schemaVersion: Int = SCHEMA_VERSION,
    val generatedAt: Long,
    val serverIdentity: String,
    val userId: String,
    val profileId: String,
    val movies: List<LibraryMovieDto>,
    val series: List<LibrarySeriesDto>,
    val recentEpisodes: List<RecentEpisodeDto>,
    val continueWatching: List<OnDeckEntryDto>,
    val dashboardLayout: DashboardLayoutDto,
    val dashboardHero: List<DashboardHeroSlideDto>,
    val movieRows: List<MetadataRowDto>,
    val seriesRows: List<MetadataRowDto>,
    val movieRecommendations: List<SearchResultDto>,
    val seriesRecommendations: List<SearchResultDto>,
) {
    companion object { const val SCHEMA_VERSION = 1 }
}

/** Fichier atomique interne, cloisonné par serveur + compte + profil. */
class HomeLocalStore(context: Context) {
    private val root = File(context.applicationContext.filesDir, "home-snapshots")
    private val adapter = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
        .adapter(HomeSnapshot::class.java)

    fun read(serverUrl: String, userId: String, profileId: String): HomeSnapshot? = runCatching {
        val file = fileFor(serverUrl, userId, profileId)
        val snapshot = adapter.fromJson(file.readText()) ?: return null
        snapshot.takeIf {
            it.schemaVersion == HomeSnapshot.SCHEMA_VERSION &&
                it.serverIdentity == normalizedServer(serverUrl) &&
                it.userId == userId && it.profileId == profileId
        }
    }.onFailure { Log.w("TV-PERF", "LOCAL_STATE_READ_FAILED", it) }.getOrNull()

    fun write(snapshot: HomeSnapshot) {
        val file = fileFor(snapshot.serverIdentity, snapshot.userId, snapshot.profileId)
        file.parentFile?.mkdirs()
        val temporary = File(file.parentFile, "${file.name}.tmp")
        temporary.writeText(adapter.toJson(snapshot))
        if (!temporary.renameTo(file)) {
            temporary.delete()
            throw IllegalStateException("Impossible de remplacer le snapshot Home")
        }
    }

    private fun fileFor(serverUrl: String, userId: String, profileId: String): File =
        File(root, "${hash(normalizedServer(serverUrl))}/${hash(userId)}/${hash(profileId)}/home.snapshot.json")

    private fun normalizedServer(value: String) = value.trim().trimEnd('/')
    private fun hash(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
}
