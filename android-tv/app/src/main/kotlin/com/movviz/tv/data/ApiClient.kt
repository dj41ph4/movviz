package com.movviz.tv.data

import android.content.Context
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Le serveur cible n'est connu qu'à l'exécution (choisi dans le wizard),
 * jamais à la compilation — contrairement à un client Retrofit classique à
 * baseUrl fixe. Un seul OkHttpClient (donc un seul CookieJar, partagé)
 * pour toute la durée de vie de l'appli ; seule l'instance Retrofit est
 * reconstruite si l'URL change (changement de serveur depuis les réglages,
 * cas rare).
 *
 * `initialize(context)` doit être appelé une fois (voir MovvizTvApplication)
 * avant tout appel réseau — c'est ce qui construit le CookieJar persistant,
 * qui a besoin d'un Context Android pour ses SharedPreferences.
 */
object ApiClient {
    private lateinit var cookieJar: PersistentCookieJar

    fun initialize(context: Context) {
        if (::cookieJar.isInitialized) return
        cookieJar = PersistentCookieJar(context)
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    // BASIC seulement : ne jamais logguer le corps des requêtes
                    // (identifiants en clair dans /api/auth/login).
                    level = HttpLoggingInterceptor.Level.BASIC
                }
            )
            .build()
    }

    private val moshi: Moshi by lazy {
        Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    }

    private var cachedBaseUrl: String? = null
    private var cachedService: MovvizApiService? = null

    /** Le client OkHttp partagé — utilisé directement par le lecteur
     *  (Media3 OkHttpDataSource) pour que le cookie de session capturé au
     *  login s'applique aussi au flux vidéo, sans dupliquer la logique
     *  d'auth. */
    fun httpClient(): OkHttpClient = okHttpClient

    /** Déconnexion — vide le cookie persistant, jamais laissé sur un
     *  boîtier TV potentiellement partagé entre plusieurs personnes. */
    fun clearSession() {
        cookieJar.clear()
    }

    fun service(baseUrl: String): MovvizApiService {
        val normalized = baseUrl.trim().trimEnd('/')
        cachedService?.let { if (cachedBaseUrl == normalized) return it }

        val retrofit = Retrofit.Builder()
            .baseUrl("$normalized/")
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

        return retrofit.create(MovvizApiService::class.java).also {
            cachedBaseUrl = normalized
            cachedService = it
        }
    }
}
