package com.movviz.tv.connect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** « Ouverture à distance » : Connect redémarre avec le boîtier, app fermée. */
class ConnectBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (ConnectHub.remoteWakeEnabled(context)) ConnectService.start(context.applicationContext)
    }
}
