import java.util.Properties

val releasePropsFile = rootProject.file("keystore.properties")

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.movviz.tv"
    compileSdk = 35

    defaultConfig {
        // applicationId historique de la variante AU : gardé tel quel pour
        // que l'auto-update et les installations existantes continuent de se
        // remplacer proprement (même package = mise à jour, pas une 2e app).
        applicationId = "com.movviz.tv.au"
        minSdk = 24 // Android TV / Fire TV coverage — la grande majorité des boîtiers en circulation
        targetSdk = 35
        versionCode = 11650
        versionName = "1.16.50"
        // Canal unique depuis le retrait de la variante retail : l'APK livré
        // s'auto-met à jour via GitHub au lancement (voir UpdateManager).
        buildConfigField("boolean", "AUTO_UPDATE", "true")
    }

    signingConfigs {
        if (releasePropsFile.exists()) {
            create("release") {
                val props = Properties().apply { releasePropsFile.inputStream().use { load(it) } }
                storeFile = file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Compose TV/R8 still has an unresolved startup cast in this
            // application. Keep the release signed and optimized by the
            // Android toolchain, but do not shrink until the mapped crash
            // is fixed.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releasePropsFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        // Expose versionName à Compose (BuildConfig.VERSION_NAME) — écran
        // Paramètres, section "À propos" : un seul point de vérité pour le
        // numéro de version plutôt qu'une chaîne dupliquée à la main.
        buildConfig = true
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.activity.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material.icons.core)

    // Compose for TV — composants focus-first (TvLazyRow, Carousel, gestion
    // D-pad native) plutôt que le vieux Leanback (View-based, legacy).
    implementation(libs.tv.foundation)
    implementation(libs.tv.material)

    implementation(libs.navigation.compose)

    // Media3/ExoPlayer — décodage matériel, HDR, pistes audio/sous-titres :
    // un <video> web n'offre aucune de ces garanties sur boîtier TV.
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.session)
    implementation(libs.media3.ui)
    implementation(libs.media3.common)
    implementation(libs.media3.datasource.okhttp)
    implementation(libs.media3.datasource)
    implementation(libs.media3.database)
    // HLS — nécessaire pour le repli transcodage serveur (/api/stream/{ratingKey}/transcode,
    // manifeste .m3u8) quand le direct-play échoue (codec non décodable nativement).
    implementation(libs.media3.exoplayer.hls)
    // DASH — repli audio/vidéo servi par le transcodage FFmpeg/Plex.
    implementation(libs.media3.exoplayer.dash)

    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.moshi.kotlin)

    implementation(libs.coil.compose)

    // Persistance légère : URL du serveur + préférences utilisateur (le
    // cookie de session, lui, vit dans le CookieJar OkHttp — voir ApiClient).
    implementation(libs.datastore.preferences)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.zxing.core)
}
