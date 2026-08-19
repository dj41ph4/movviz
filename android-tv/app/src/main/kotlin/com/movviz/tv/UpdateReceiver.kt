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
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        context.startActivity(
            Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            },
        )
    }
}