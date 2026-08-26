import java.util.Properties

// Same retail signing material as Android TV, kept outside source control.
// The mobile package is intentionally different, so it cannot replace TV.
val releasePropsFile = rootProject.file("../android-tv/keystore.properties")

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.movviz.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.movviz.mobile"
        minSdk = 24
        targetSdk = 35
        // Same fix as android-tv/app/build.gradle.kts — derived from the Git
        // tag by CI instead of a frozen value, so BuildConfig.VERSION_NAME
        // (shown in "About") tracks the actual published release.
        versionCode = ((project.findProperty("movvizVersionCode") as String?)?.toIntOrNull()) ?: 12006
        versionName = (project.findProperty("movvizVersionName") as String?) ?: "1.20.06"
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
            isMinifyEnabled = false
            if (releasePropsFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

dependencies {
    implementation(project(":android-shared"))
    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.material.icons.core)
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation(libs.navigation.compose)
    implementation(libs.coil.compose)
    implementation(libs.kotlinx.coroutines.android)
    // Discover feature's own Retrofit/Moshi surface (com.movviz.mobile.discover.*)
    // lives in :app, not :android-shared — android-shared's own retrofit/moshi/
    // okhttp deps are `implementation`-scoped there and don't leak transitively,
    // so :app needs the same libs directly to compile DiscoverApi.kt.
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.moshi.kotlin)
    implementation(libs.okhttp)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.exoplayer.hls)
    implementation(libs.media3.exoplayer.dash)
    implementation(libs.media3.session)
    implementation(libs.media3.common)
    implementation(libs.media3.datasource.okhttp)
    implementation(libs.media3.ui)
    implementation(libs.media3.datasource)
}
