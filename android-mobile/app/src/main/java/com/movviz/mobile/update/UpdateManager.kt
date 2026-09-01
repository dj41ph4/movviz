package com.movviz.mobile.update

import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.movviz.mobile.BuildConfig
import com.movviz.tv.data.ApiClient
import com.squareup.moshi.Json
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest

/** Dernière release disponible sur GitHub (repo public — API sans auth). */
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
 * Auto-update Android mobile sans magasin d'applications — port exact du
 * mécanisme de la version TV (android-tv/.../data/UpdateManager.kt), avec
 * l'asset et le User-Agent adaptés au client smartphone. Voir ce fichier
 * pour le détail des choix (PackageInstaller silencieux + repli installeur
 * système, vérification SHA-256, etc.).
 */
class UpdateManager(private val context: Context) {
    private val client = ApiClient.httpClient()
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val releaseAdapter = moshi.adapter(ReleaseDto::class.java)

    /** Nom de l'asset publié par le workflow CI (android-mobile-build.yml). */
    private val expectedAssetName = "Movviz-Android-Mobile-client.apk"

    /** Retourne la mise à jour à appliquer, ou null si à jour / indisponible. */
    suspend fun checkForUpdate(): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("https://api.github.com/repos/dj41ph4/movviz/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Movviz-AndroidMobile/${BuildConfig.VERSION_NAME}")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    android.util.Log.w("MovvizUpdate", "check: HTTP ${response.code}")
                    return@withContext null
                }
                val body = response.body?.string() ?: return@withContext null
                val release = releaseAdapter.fromJson(body) ?: return@withContext null
                val tag = release.tagName ?: return@withContext null
                if (!isNewerVersion(tag, BuildConfig.VERSION_NAME)) {
                    android.util.Log.i("MovvizUpdate", "check: à jour (local=${BuildConfig.VERSION_NAME}, latest=$tag)")
                    return@withContext null
                }
                val asset = release.assets?.firstOrNull { it.name == expectedAssetName }
                    ?: return@withContext null
                val url = asset.url ?: return@withContext null
                val digest = asset.digest ?: return@withContext null
                android.util.Log.i("MovvizUpdate", "check: mise à jour trouvée $tag (local=${BuildConfig.VERSION_NAME})")
                UpdateInfo(tag = tag, apkUrl = url, sha256 = digest, size = asset.size ?: 0L)
            }
        } catch (e: Exception) {
            android.util.Log.w("MovvizUpdate", "check: échec", e)
            null
        }
    }

    /** Télécharge l'APK (avec progression 0→1) et vérifie son SHA-256. */
    suspend fun download(info: UpdateInfo, onProgress: (Float) -> Unit): File =
        withContext(Dispatchers.IO) {
            val dir = File(context.cacheDir, "update").apply { mkdirs() }
            val part = File(dir, "update.part")
            val target = File(dir, "update.apk")
            part.delete()

            val request = Request.Builder()
                .url(info.apkUrl)
                .header("User-Agent", "Movviz-AndroidMobile/${BuildConfig.VERSION_NAME}")
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

    /** Autorisation "installer des applications inconnues" déjà accordée. */
    fun canInstallUnknown(): Boolean =
        Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()

    /** Ouvre les réglages système pour autoriser les sources inconnues.
     *  FLAG_ACTIVITY_NEW_TASK est OBLIGATOIRE : ce manager tourne sur le
     *  contexte application (pas une Activity). */
    fun openInstallPermissionSettings() {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Installation en ARRIÈRE-PLAN de l'APK téléchargé (PackageInstaller
     *  session API) — voir la version TV pour le détail de chaque piège
     *  (setRequireUserAction, fsync avant close, PendingIntent mutable). */
    fun installInBackground(file: File, onProgress: (Float) -> Unit) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(context.packageName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            val size = file.length()
            val stream = session.openWrite("base.apk", 0, size)
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
            stream.close()
            session.commit(
                PendingIntent.getBroadcast(
                    context,
                    0,
                    Intent(context, UpdateReceiver::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                ).intentSender,
            )
            session.close()
            android.util.Log.i("MovvizUpdate", "session $sessionId commit OK")
        } catch (e: Exception) {
            android.util.Log.e("MovvizUpdate", "install failed (session $sessionId)", e)
            try {
                session.abandon()
            } catch (_: Exception) {
            }
            throw IOException("installation failed", e)
        }
    }

    /** Repli quand l'installation en arrière-plan échoue ou est refusée en
     *  silence par le système — ouvre l'installeur système classique. */
    fun installViaSystemInstaller(file: File) {
        val apkUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Compare "v1.16.19" vs "1.16.18" — la plus haute gagne. */
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
