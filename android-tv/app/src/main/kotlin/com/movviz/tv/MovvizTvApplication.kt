package com.movviz.tv

import android.app.Application
import com.movviz.tv.data.ApiClient

/** Initialise le CookieJar persistant avant que quoi que ce soit d'autre
 *  (MainActivity, AppViewModel) ne puisse déclencher un appel réseau. */
class MovvizTvApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ApiClient.initialize(this)
    }
}
