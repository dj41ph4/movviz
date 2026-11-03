package com.movviz.nx.mobile.data

import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.movviz.nx.mobile.BuildConfig
import com.movviz.nx.mobile.UpdateReceiver
import com.squareup.moshi.Json
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
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
    @Json(name = "draft") val draft: Boolean? = null,
    @Json(name = "prerelease") val prerelease: Boolean? = null,
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
 * (liste des releases), on compare la version à la nôtre, on télécharge
 * l'APK de la release (SHA-256 vérifié contre le digest publié) et on
 * ouvre l'installeur système (FileProvider + ACTION_VIEW). L'APK se
 * remplace lui-même (même package, même clé de signature) sans perte de
 * données.
 *
 * Conçue pour ne JAMAIS bloquer l'appli : toute erreur (réseau, HTTP, hash,
 * utilisateur qui annule) renvoie null ou lève — l'app continue normalement.
 */
class UpdateManager(private val context: Context) {
    private val client = ApiClient.httpClient()
    // Sans plafond de durée totale : les 20 s du client API coupaient l'APK dès
    // que la connexion passait sous 6,5 Mbit/s, et la mise à jour échouait.
    private val downloadClient = ApiClient.streamingHttpClient()
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val releasesAdapter = moshi.adapter<List<ReleaseDto>>(Types.newParameterizedType(List::class.java, ReleaseDto::class.java))

    /** Nom de l'asset publié par le workflow CI. */
    // Canal NX Mobile indépendant : il ne doit jamais proposer l'APK NX TV
    // (même version/tag mais applicationId et ergonomie différents).
    private val expectedAssetName = "Movviz-NX-Mobile-client.apk"

    /** Vrai quand la dernière vérification n'a pas abouti : l'absence de mise à jour
     *  ne doit pas s'afficher « à jour » si GitHub n'a simplement pas répondu. */
    @Volatile
    var lastCheckFailed = false
        private set

    /** Retourne la mise à jour à appliquer, ou null si à jour / indisponible.
     *  Cherche la version la plus haute qui contient déjà notre APK : une release
     *  toute neuve reste sans APK le temps de sa compilation. */
    suspend fun checkForUpdate(): UpdateInfo? = withContext(Dispatchers.IO) {
        lastCheckFailed = false
        try {
            val request = Request.Builder()
                .url("https://api.github.com/repos/dj41ph4/movviz/releases?per_page=15")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Movviz-AndroidTV/${BuildConfig.VERSION_NAME}")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    android.util.Log.w("MovvizUpdate", "check: HTTP ${response.code}")
                    lastCheckFailed = true
                    return@withContext null
                }
                val releases = response.body?.string()?.let { releasesAdapter.fromJson(it) }
                if (releases == null) {
                    lastCheckFailed = true
                    return@withContext null
                }
                var best: UpdateInfo? = null
                for (release in releases) {
                    val tag = release.tagName ?: continue
                    if (release.draft == true || release.prerelease == true) continue
                    if (!isNewerVersion(tag, best?.tag ?: BuildConfig.VERSION_NAME)) continue
                    val asset = release.assets?.firstOrNull { it.name == expectedAssetName } ?: continue
                    val url = asset.url ?: continue
                    val digest = asset.digest ?: continue
                    best = UpdateInfo(tag = tag, apkUrl = url, sha256 = digest, size = asset.size ?: 0L)
                }
                android.util.Log.i("MovvizUpdate", "check: local=${BuildConfig.VERSION_NAME}, disponible=${best?.tag}")
                best
            }
        } catch (e: Exception) {
            // Avant ce correctif : un échec réseau (DNS, timeout, TLS…) se refermait
            // ici sans aucune trace, indiscernable d'un simple "pas de mise à jour".
            android.util.Log.w("MovvizUpdate", "check: échec", e)
            lastCheckFailed = true
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
                .header("User-Agent", "Movviz-AndroidTV/${BuildConfig.VERSION_NAME}")
                .build()
            downloadClient.newCall(request).execute().use { response ->
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
     *  contexte application (pas une Activity) — sans ce flag, le clic
     *  « Autoriser » plante l'app (AndroidRuntimeException, constaté). */
    fun openInstallPermissionSettings() {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Déclenche l'installation en ARRIÈRE-PLAN de l'APK téléchargé
     *  (PackageInstaller session API) : pas d'écran système, l'app reste
     *  affichée avec la barre de progression (0→1 pendant l'écriture).
     *
     *  Le commit fait tuer le process à la fin de l'installation ; le
     *  receiver UpdateReceiver (MY_PACKAGE_REPLACED) relance alors
     *  MainActivity automatiquement — reboot de l'app façon Netflix.
     *  En cas d'échec silencieux du commit, le timeout de l'overlay
     *  ramène l'application à son état normal.
     */
    fun installInBackground(file: File, onProgress: (Float) -> Unit) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(context.packageName)
        // Sans ceci, l'API 31+ exige un écran de confirmation système avant tout
        // commit() — le commit() ci-dessous ne lève rien mais reste EN ATTENTE de
        // cette confirmation qui n'arrive jamais (rien ne l'affiche) : ni succès
        // ni échec, l'appli croit que "ça a marché" et rien ne s'installe jamais.
        // C'est la cause de la boucle « mise à jour qui recommence à chaque
        // lancement » — voir aussi le fallback dans UpdateReceiver si le système
        // exige quand même la confirmation malgré cette demande.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            val size = file.length()
            // fsync(OutputStream) marque juste les données comme prêtes à être
            // appliquées sur disque — il NE FERME PAS le stream (contrairement
            // à ce qu'affirmait un commentaire précédent ici, qui menait à ne
            // jamais appeler close()). Résultat constaté : commit() levait
            // SecurityException "Files still open" — PackageInstallerSession
            // refuse de sceller une session avec un write transfer encore
            // ouvert. Le stream DOIT être fermé explicitement avant commit().
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
                    // MUTABLE est OBLIGATOIRE sur API 35+ : le système exige
                    // un status receiver mutable pour commit() (constaté :
                    // IllegalArgumentException "should come from a mutable
                    // PendingIntent" — l'installation échouait silencieusement).
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

    /** Repli quand l'installation en arrière-plan (PackageInstaller) échoue
     *  ou est refusée en silence par le système — constaté sur certains
     *  Google TV (Chromecast 4K) où le commit passe sans erreur mais rien
     *  ne s'installe. On ouvre alors l'installeur système classique
     *  (ACTION_VIEW + FileProvider) : un écran natif « Voulez-vous mettre à
     *  jour cette application ? » s'affiche, l'utilisateur valide avec la
     *  télécommande. L'APK est déjà téléchargé et vérifié, ce chemin ne
     *  refait aucun réseau. */
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
