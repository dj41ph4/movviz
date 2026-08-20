import java.util.Properties

val retailPropsFile = rootProject.file("keystore.properties")

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.movviz.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.movviz.tv"
        minSdk = 24 // Android TV / Fire TV coverage — la grande majorité des boîtiers en circulation
        targetSdk = 35
versionCode = 11646
        versionName = "1.16.46"
    }

    // Deux canaux de distribution depuis le même code :
    //  - retail : APK stable, installé à la main (l'APK historique, signature
    //    retail — l'auto-update y est désactivé pour ne jamais surprendre)
    //  - au : variante "auto-update" — vérifie GitHub au lancement, télécharge
    //    et installe la nouvelle version AU avec un écran de progression.
    // Les deux partagent la même clé de signature retail : l'AU peut se
    // remplacer lui-même (même package, même clé) sans perdre les données.
    flavorDimensions += "channel"
    productFlavors {
        create("retail") {
            dimension = "channel"
            buildConfigField("boolean", "AUTO_UPDATE", "false")
        }
        create("au") {
            dimension = "channel"
            applicationIdSuffix = ".au"
            buildConfigField("boolean", "AUTO_UPDATE", "true")
            // Label distinct dans le launcher pour ne pas confondre les deux
            // APK installés côte à côte pendant une migration.
            resValue("string", "app_name", "Movviz AU")
        }
    }

    signingConfigs {
        if (retailPropsFile.exists()) {
            create("retail") {
                val props = Properties().apply { retailPropsFile.inputStream().use { load(it) } }
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
            // application. Keep retail signed and optimized by the Android
            // toolchain, but do not shrink until the mapped crash is fixed.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (retailPropsFile.exists()) signingConfig = signingConfigs.getByName("retail")
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
