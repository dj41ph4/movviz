plugins {
    id("com.android.library")
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.movviz.shared"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    // Transitional shared brain: consume the TV data layer as source rather
    // than copying it. The TV module itself remains untouched.
    sourceSets["main"].java.apply {
        srcDir("../../android-tv/app/src/main/kotlin/com/movviz/tv/data")
        // APK update orchestration is TV-only and intentionally does not
        // belong in the smartphone shared brain.
        exclude("**/UpdateManager.kt")
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.moshi.kotlin)
    implementation(libs.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)
}

// Kotlin sources from the TV directory use the Kotlin source-set pipeline;
// exclude the TV-only updater there as well as from the Android source set.
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    exclude("**/UpdateManager.kt")
}
