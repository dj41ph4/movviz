"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Talking with the assistant, with the device's own voices (demande
 * explicite : gratuit, sans quota) — the browser's speech recognition for
 * the microphone, its speech synthesis for the replies. Edge ships very
 * natural « Online (Natural) » voices, Chrome good Google ones; the user
 * picks among those of their language.
 */

const SPEAK_KEY = "movviz.ai.voice.speak";
const VOICE_KEY = "movviz.ai.voice.uri";

const BCP47: Record<string, string> = { fr: "fr-FR", en: "en-US", de: "de-DE", it: "it-IT", nl: "nl-NL" };

interface RecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface RecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

/** What is worth saying out loud: no emojis, no markdown, no hidden markers. */
export function speakableText(text: string): string {
  return text
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\p{Extended_Pictographic}|‍|️/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** What the assistant says aloud for a reply: its text, then each suggested
 *  title with its one-line pitch (« Nobody : bourrin, jubilatoire… ») — the
 *  cards were silent, so a spoken recommendation named no film at all. */
export function spokenReply(message: { content?: string | null; recommendations?: { title: string; reason?: string | null }[] | null }): string {
  const cards = (message.recommendations ?? []).map((card) => {
    const reason = card.reason?.trim().replace(/[.!…\s]+$/, "");
    return reason ? `${card.title} : ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.` : `${card.title}.`;
  });
  return [message.content ?? "", ...cards].filter((part) => part.trim()).join(" ");
}

/** Most natural first: Edge « Natural/Online », then Google, then the rest. */
function voiceRank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (name.includes("natural")) return 0;
  if (name.includes("online") || name.includes("neural")) return 1;
  if (name.includes("google")) return 2;
  return voice.localService ? 4 : 3;
}

function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const prefix = lang.slice(0, 2);
  return window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(prefix))
    .sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name));
}

/** Why the microphone cannot be used here, if it cannot. */
export type MicBlock = "unsupported" | "insecure" | null;

function micBlock(): MicBlock {
  if (typeof window === "undefined") return "unsupported";
  // Browsers only open the microphone over https or on localhost: a Windows
  // or Linux install reached at http://192.168.x.x has no dictation.
  if (!window.isSecureContext) return "insecure";
  return recognitionCtor() ? null : "unsupported";
}

/** Recognition errors worth telling the user about. */
export type MicError = "denied" | "no-mic" | "network";

export function useVoiceChat(locale: string) {
  const lang = BCP47[locale] ?? "fr-FR";
  // The chat only renders after mount (it waits for the AI session), so the
  // browser capabilities are read directly — no server render to match.
  const [mic] = useState<MicBlock>(micBlock);
  const [ttsSupported] = useState(() => typeof window !== "undefined" && !!window.speechSynthesis);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakEnabled, setSpeakEnabledState] = useState(() => read(SPEAK_KEY) === "1");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => voicesFor(lang));
  const [voiceURI, setVoiceURIState] = useState<string | null>(() => read(VOICE_KEY));
  const recognitionRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    // Chrome/Edge list their voices a moment after load.
    const load = () => setVoices(voicesFor(lang));
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [lang]);

  const setSpeakEnabled = useCallback((on: boolean) => {
    setSpeakEnabledState(on);
    write(SPEAK_KEY, on ? "1" : "0");
    if (!on) window.speechSynthesis?.cancel();
  }, []);

  const setVoiceURI = useCallback((uri: string) => {
    setVoiceURIState(uri);
    write(VOICE_KEY, uri);
  }, []);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    const synth = window.speechSynthesis;
    const words = speakableText(text);
    if (!synth || !words) { onEnd?.(); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(words);
    utterance.lang = lang;
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => { setSpeaking(false); onEnd?.(); };
    utterance.onerror = () => { setSpeaking(false); onEnd?.(); };
    synth.speak(utterance);
  }, [lang, voices, voiceURI]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  /** Listens once: the live transcript as it comes, then the final sentence. */
  const listen = useCallback((onInterim: (text: string) => void, onFinal: (text: string) => void, onError?: (error: MicError) => void) => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    window.speechSynthesis?.cancel(); // never listen to itself
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      onInterim((finalText + interim).trim());
    };
    recognition.onerror = (e) => {
      // Refused by the browser or by Windows (Paramètres > Confidentialité >
      // Microphone), no microphone at all, or the speech service unreachable.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") onError?.("denied");
      else if (e.error === "audio-capture") onError?.("no-mic");
      else if (e.error === "network") onError?.("network");
      // onend follows
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (finalText.trim()) onFinal(finalText.trim());
    };
    recognitionRef.current = recognition;
    setListening(true);
    try { recognition.start(); } catch { setListening(false); }
  }, [lang]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  return { sttSupported: mic === null, micBlock: mic, ttsSupported, listening, speaking, speakEnabled, setSpeakEnabled, voices, voiceURI, setVoiceURI, speak, cancelSpeech, listen, stopListening };
}
