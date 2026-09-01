package com.movviz.mobile.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import com.movviz.mobile.MainActivity

/**
 * Relance automatiquement l'application après une mise à jour auto — port
 * exact du receiver TV (android-tv/.../UpdateReceiver.kt), voir ce fichier
 * pour le détail du repli STATUS_PENDING_USER_ACTION.
 */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.hasExtra(PackageInstaller.EXTRA_STATUS)) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)
            android.util.Log.i("MovvizUpdate", "install result status=$status msg=" +
                intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                val confirmIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(confirmIntent) }
                        .onFailure { android.util.Log.e("MovvizUpdate", "confirmation d'installation injoignable", it) }
                } else {
                    android.util.Log.w("MovvizUpdate", "STATUS_PENDING_USER_ACTION sans EXTRA_INTENT")
                }
                return
            }
        }
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        android.util.Log.i("MovvizUpdate", "package replaced — relance automatique")
        context.startActivity(
            Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            },
        )
    }
}
