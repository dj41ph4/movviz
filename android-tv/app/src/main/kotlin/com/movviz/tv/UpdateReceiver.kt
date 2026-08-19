package com.movviz.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Relance automatiquement l'application après une mise à jour auto.
 *
 * L'installation du nouveau package (PackageInstaller, arrière-plan) tue le
 * process de l'ancienne version ; une fois l'installation terminée, le
 * système envoie MY_PACKAGE_REPLACED à la NOUVELLE version — ce receiver
 * redémarre alors MainActivity : l'utilisateur n'a rien à relancer à la
 * main, l'app reboot toute seule sur la nouvelle version.
 */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Le commit de PackageInstaller délivre aussi un intent explicite à
        // ce receiver (avec EXTRA_STATUS) : on loggue le résultat même si
        // l'installation a échoué — en cas de succès, le process est déjà
        // mort et c'est MY_PACKAGE_REPLACED qui prend le relais.
        if (intent.hasExtra(android.content.pm.PackageInstaller.EXTRA_STATUS)) {
            val status = intent.getIntExtra(android.content.pm.PackageInstaller.EXTRA_STATUS, -1)
            android.util.Log.i("MovvizUpdate", "install result status=$status msg=" +
                intent.getStringExtra(android.content.pm.PackageInstaller.EXTRA_STATUS_MESSAGE))
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