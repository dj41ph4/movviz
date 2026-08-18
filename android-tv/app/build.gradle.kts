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
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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

    // Compose for TV — composants focus-first (TvLazyRow, Carousel, gestion
    // D-pad native) plutôt que le vieux Leanback (View-based, legacy).
    implementation(libs.tv.foundation)
    implementation(libs.tv.material)

    implementation(libs.navigation.compose)

    // Media3/ExoPlayer — décodage matériel, HDR, pistes audio/sous-titres :
    // un <video> web n'offre aucune de ces garanties sur boîtier TV.
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.media3.common)
    implementation(libs.media3.datasource.okhttp)

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
}
