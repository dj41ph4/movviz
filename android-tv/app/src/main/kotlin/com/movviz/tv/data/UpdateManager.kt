package com.movviz.tv.data

import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.movviz.tv.BuildConfig
import com.movviz.tv.UpdateReceiver
import com.squareup.moshi.Json
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

/** DerniÃ¨re release disponible sur GitHub (repo public â€” API sans auth). */
data class UpdateInfo(
    val tag: String,
    val apkUrl: String,
    val sha256: String,
    val size: Long,
)

private data class ReleaseDto(
    @Json(name = "tag_name") val tagName: String? = null,
    @Json(name = "assets") val assets: List<AssetDto>? = null,
)

private data class AssetDto(
    @Json(name = "name") val name: String? = null,
    @Json(name = "browser_download_url") val url: String? = null,
    @Json(name = "digest") val digest: String? = null,
    @Json(name = "size") val size: Long? = null,
)

/**
 * Auto-update Android TV sans magasin d'applications.
 *
 * Le repo Movviz est public : on interroge directement l'API GitHub
 * (`releases/latest`), on compare la version Ã  la nÃ´tre, on tÃ©lÃ©charge
 * l'APK AU de la release (SHA-256 vÃ©rifiÃ© contre le digest publiÃ©) et on
 * ouvre l'installeur systÃ¨me (FileProvider + ACTION_VIEW). L'APK AU porte
 * la mÃªme clÃ© de signature que le retail : la mise Ã  jour se fait par-dessus
 * sans perte de donnÃ©es.
 *
 * ConÃ§ue pour ne JAMAIS bloquer l'appli : toute erreur (rÃ©seau, HTTP, hash,
 * utilisateur qui annule) renvoie null ou lÃ¨ve â€” l'app continue normalement.
 */
class UpdateManager(private val context: Context) {
    private val client = ApiClient.httpClient()
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val releaseAdapter = moshi.adapter(ReleaseDto::class.java)

    /** Nom de l'asset publiÃ© par le workflow CI pour la variante AU. */
    private val expectedAssetName = "Movviz-Android-TV-client-AU.apk"

    /** Retourne la mise Ã  jour Ã  appliquer, ou null si Ã  jour / indisponible. */
    suspend fun checkForUpdate(): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("https://api.github.com/repos/dj41ph4/movviz/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Movviz-AndroidTV/${BuildConfig.VERSION_NAME}")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string() ?: return@withContext null
                val release = releaseAdapter.fromJson(body) ?: return@withContext null
                val tag = release.tagName ?: return@withContext null
                if (!isNewerVersion(tag, BuildConfig.VERSION_NAME)) return@withContext null
                val asset = release.assets?.firstOrNull { it.name == expectedAssetName }
                    ?: return@withContext null
                val url = asset.url ?: return@withContext null
                val digest = asset.digest ?: return@withContext null
                UpdateInfo(tag = tag, apkUrl = url, sha256 = digest, size = asset.size ?: 0L)
            }
        } catch (e: Exception) {
            null
        }
    }

    /** TÃ©lÃ©charge l'APK (avec progression 0â†’1) et vÃ©rifie son SHA-256. */
    suspend fun download(info: UpdateInfo, onProgress: (Float) -> Unit): File =
        withContext(Dispatchers.IO) {
            val dir = File(context.cacheDir, "update").apply { mkdirs() }
            val part = File(dir, "update.part")
            val target = File(dir, "update.apk")
            part.delete()

            val request = Request.Builder()
                .url(info.apkUrl)
                .header("User-Agent", "Movviz-AndroidTV/${BuildConfig.VERSION_NAME}")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
                val body = response.body ?: throw IOException("empty body")
                val total = if (info.size > 0) info.size else body.contentLength()
                val digest = MessageDigest.getInstance("SHA-256")
                part.outputStream().use { out ->
                    body.byteStream().use { input ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        var read: Int
                        var done = 0L
                        while (input.read(buffer).also { read = it } != -1) {
                            out.write(buffer, 0, read)
                            digest.update(buffer, 0, read)
                            done += read
                            if (total > 0) onProgress((done.toFloat() / total).coerceIn(0f, 1f))
                        }
                    }
                }
                val received = digest.digest().joinToString("") { "%02x".format(it) }
                val expected = info.sha256.removePrefix("sha256:").lowercase()
                if (received != expected) {
                    part.delete()
                    throw IOException("SHA-256 mismatch (received $received, expected $expected)")
                }
            }
            if (!part.renameTo(target)) throw IOException("rename failed")
            target
        }

    /** Autorisation "installer des applications inconnues" dÃ©jÃ  accordÃ©e. */
    fun canInstallUnknown(): Boolean =
        Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()

    /** Ouvre les rÃ©glages systÃ¨me pour autoriser les sources inconnues. */
    fun openInstallPermissionSettings() {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")),
        )
    }

    /** DÃ©clenche l'installation en ARRIÃˆRE-PLAN de l'APK tÃ©lÃ©chargÃ©
     *  (PackageInstaller session API) : pas d'Ã©cran systÃ¨me, l'app reste
     *  affichÃ©e avec la barre de progression (0â†’1 pendant l'Ã©criture).
     *
     *  Le commit fait tuer le process Ã  la fin de l'installation ; le
     *  receiver UpdateReceiver (MY_PACKAGE_REPLACED) relance alors
     *  MainActivity automatiquement — reboot de l'app faÃ§on Netflix.
     *  En cas d'Ã©chec silencieux du commit, le timeout de l'overlay
     *  ramÃ¨ne l'application Ã  son Ã©tat normal.
     */
    fun installInBackground(file: File, onProgress: (Float) -> Unit) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(context.packageName)
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            val size = file.length()
            // API 35+ : openWrite retourne directement un OutputStream
            // (avant c'était un ParcelFileDescriptor) — on écrit dessus puis
            // fsync AVANT la fermeture, comme l'exige PackageInstaller.
            val stream = session.openWrite("base.apk", 0, size)
            try {
                file.inputStream().use { input ->
                    val buffer = ByteArray(256 * 1024)
                    var read: Int
                    var done = 0L
                    while (input.read(buffer).also { read = it } != -1) {
                        stream.write(buffer, 0, read)
                        done += read
                        onProgress((done.toFloat() / size).coerceIn(0f, 1f))
                    }
                }
                stream.flush()
                session.fsync(stream)
            } finally {
                stream.close()
            }
            session.commit(
                PendingIntent.getBroadcast(
                    context,
                    0,
                    Intent(context, UpdateReceiver::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ).intentSender,
            )
            session.close()
        } catch (e: Exception) {
            try {
                session.abandon()
            } catch (_: Exception) {
            }
            throw IOException("installation failed", e)
        }
    }

    /** Compare "v1.16.19" vs "1.16.18" â€” la plus haute gagne. */
    private fun isNewerVersion(tag: String, current: String): Boolean {
        val a = parseVersion(tag)
        val b = parseVersion(current)
        for (i in 0 until maxOf(a.size, b.size)) {
            val x = a.getOrElse(i) { 0 }
            val y = b.getOrElse(i) { 0 }
            if (x != y) return x > y
        }
        return false
    }

    private fun parseVersion(value: String): List<Int> =
        value.trim().removePrefix("v").split(".").mapNotNull { it.toIntOrNull() }

    private companion object {
        const val DEFAULT_BUFFER_SIZE = 8192
    }
}
