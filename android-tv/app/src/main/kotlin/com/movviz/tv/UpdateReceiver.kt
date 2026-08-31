package com.movviz.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

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
        if (intent.hasExtra(PackageInstaller.EXTRA_STATUS)) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)
            android.util.Log.i("MovvizUpdate", "install result status=$status msg=" +
                intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))
            // setRequireUserAction(NOT_REQUIRED) (voir UpdateManager) demande une
            // install silencieuse, mais le système peut l'ignorer quand même (ex :
            // 1re mise à jour après un sideload manuel, cette appli pas encore
            // reconnue comme "installateur de référence" d'elle-même). Sans ce
            // repli, l'Intent de confirmation embarqué dans EXTRA_INTENT n'était
            // JAMAIS lancé : le commit restait en attente indéfiniment — ni succès
            // ni échec, silencieusement — c'était la cause réelle de la boucle
            // "la mise à jour recommence à chaque lancement".
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