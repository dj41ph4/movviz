package com.movviz.nx.mobile.connect

import android.content.Context
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Un envoi en cours : écran visé (id + nom) et étape affichée. */
data class CastJob(val screenId: String, val screenName: String, val stage: String)

/**
 * Envois « Lire sur… » hors de la feuille : fermer le panneau pendant un envoi
 * (20 à 60 s pour un téléviseur DLNA) ne l'annule plus, et le rouvrir retrouve
 * l'animation et l'étape en cours. Un seul envoi à la fois.
 */
object CastProgress {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _job = MutableStateFlow<CastJob?>(null)
    val job: StateFlow<CastJob?> = _job.asStateFlow()

    /**
     * Lance [work] pour l'écran donné ; [work] reçoit de quoi publier l'étape et
     * renvoie le message de fin (affiché en toast) et le succès.
     */
    fun start(
        context: Context,
        screenId: String,
        screenName: String,
        firstStage: String,
        onSent: (String) -> Unit = {},
        work: suspend (stage: (String) -> Unit) -> Pair<Boolean, String>,
    ): Boolean {
        if (_job.value != null) return false
        val app = context.applicationContext
        _job.value = CastJob(screenId, screenName, firstStage)
        scope.launch {
            val (ok, message) = try {
                work { s -> _job.value = _job.value?.copy(stage = s) }
            } catch (e: Exception) {
                false to "Impossible de lancer la lecture sur $screenName"
            } finally {
                _job.value = null
            }
            withContext(Dispatchers.Main) {
                if (ok) runCatching { onSent(screenName) }
                Toast.makeText(app, message, Toast.LENGTH_SHORT).show()
            }
        }
        return true
    }
}
