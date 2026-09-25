package com.movviz.nx.mobile.ui.ai

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.Locale

/**
 * L'assistant à voix haute, avec les voix du téléphone (demande explicite :
 * gratuit, sans quota). Le moteur de synthèse d'Android (Google en général)
 * propose plusieurs voix françaises ; les plus naturelles passent en tête et
 * le choix reste sur l'appareil.
 */
class AiVoice(context: Context) : TextToSpeech.OnInitListener {
    private val prefs = context.getSharedPreferences("movviz_ai_voice", Context.MODE_PRIVATE)
    private val main = Handler(Looper.getMainLooper())
    private val tts = TextToSpeech(context.applicationContext, this)
    private var afterSpeech: (() -> Unit)? = null

    var ready by mutableStateOf(false)
        private set
    var voices by mutableStateOf<List<Voice>>(emptyList())
        private set
    var voiceName by mutableStateOf(prefs.getString(KEY_VOICE, null))
        private set
    var speakEnabled by mutableStateOf(prefs.getBoolean(KEY_SPEAK, false))
        private set
    var speaking by mutableStateOf(false)
        private set

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        tts.language = Locale.FRANCE
        voices = runCatching { tts.voices.orEmpty() }.getOrDefault(emptySet())
            .filter { it.locale.language == "fr" && !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
            .sortedWith(compareByDescending<Voice> { it.quality }.thenBy { it.isNetworkConnectionRequired }.thenBy { it.name })
        voices.firstOrNull { it.name == voiceName }?.let { tts.voice = it }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) { main.post { speaking = true } }
            override fun onDone(utteranceId: String?) { main.post { finished() } }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { main.post { finished() } }
        })
        ready = true
    }

    private fun finished() {
        speaking = false
        val next = afterSpeech
        afterSpeech = null
        if (next != null && !tts.isSpeaking) next()
    }

    /** Libellé lisible : « Voix 2 · naturelle », jamais « fr-fr-x-frd-local ». */
    fun label(voice: Voice): String {
        val index = voices.indexOf(voice) + 1
        val natural = voice.quality >= Voice.QUALITY_HIGH
        return buildString {
            append("Voix ").append(index)
            if (natural) append(" · naturelle")
            if (voice.isNetworkConnectionRequired) append(" · en ligne")
        }
    }

    fun toggleSpeak(on: Boolean) {
        speakEnabled = on
        prefs.edit().putBoolean(KEY_SPEAK, on).apply()
        if (!on) stop()
    }

    fun select(voice: Voice) {
        voiceName = voice.name
        prefs.edit().putString(KEY_VOICE, voice.name).apply()
        tts.voice = voice
        speak("Salut, c'est avec cette voix que je te parlerai. Ça te va ?")
    }

    /** Dit le texte (sans emojis ni mise en forme), puis appelle [then]. */
    fun speak(text: String, then: (() -> Unit)? = null) {
        val words = speakable(text)
        if (!ready || words.isEmpty()) { then?.invoke(); return }
        afterSpeech = then
        tts.speak(words, TextToSpeech.QUEUE_FLUSH, null, "movviz-ai-${System.nanoTime()}")
    }

    fun stop() {
        afterSpeech = null
        tts.stop()
        speaking = false
    }

    fun shutdown() {
        stop()
        tts.shutdown()
    }

    companion object {
        private const val KEY_VOICE = "voice"
        private const val KEY_SPEAK = "speak"

        /** Ce qui vaut la peine d'être dit : ni emojis, ni markdown, ni marqueurs. */
        fun speakable(text: String): String = text
            .replace(Regex("""\[\[[^\]]*]]"""), "")
            .replace(Regex("""[*_`#>]+"""), "")
            .replace(Regex("""[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}\x{200D}]"""), "")
            .replace(Regex("""\s+"""), " ")
            .trim()
    }
}
