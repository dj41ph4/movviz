/**
 * Runtime safety net for the native-first playback path: every codec
 * decision upstream (webcodecs.ts's pickStrategy, the AC-3/E-AC-3
 * MediaSource-support probe) is a static pre-playback guess. None of them
 * are re-verified once the file is actually playing, and an unsupported or
 * unroutable audio track does NOT fire the <video> `error` event — the
 * browser just plays the video track with no sound, with no way to recover
 * short of the user noticing and clicking "revenir au HLS" themselves.
 *
 * This watches real decoded audio energy for a short window after playback
 * starts and reports true silence back to the caller, which is expected to
 * fall back to the HLS/transcode leg (the same recovery path `onError`
 * already uses) — so the native/WebCodecs/MSE-first priority stays intact
 * and HLS becomes a true fallback instead of a manual escape hatch.
 */
type AudioProbe = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  analyserConnected: boolean;
};

// A browser only permits one MediaElementSourceNode for a given <video> for
// its entire lifetime. The player may restart direct playback on that same
// element (resume, retry, route change), so keep and reuse the probe instead
// of silently losing the detector after its first use.
const probes = new WeakMap<HTMLMediaElement, AudioProbe>();

function getProbe(el: HTMLMediaElement): AudioProbe | null {
  try {
    let probe = probes.get(el);
    if (!probe) {
      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      const context = new AudioContextCtor();
      const source = context.createMediaElementSource(el);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      source.connect(context.destination);
      probe = { context, source, analyser, analyserConnected: true };
      probes.set(el, probe);
    } else if (!probe.analyserConnected) {
      probe.source.connect(probe.analyser);
      probe.analyserConnected = true;
    }
    if (probe.context.state === "suspended") void probe.context.resume();
    return probe;
  } catch (err) {
    console.warn("[player] silent-audio watch unavailable:", err);
    return null;
  }
}

export function watchForSilentAudio(
  el: HTMLMediaElement,
  onSilent: () => void,
  options?: { windowMs?: number; threshold?: number; requireStarted?: boolean }
): () => void {
  const windowMs = options?.windowMs ?? 6000;
  const threshold = options?.threshold ?? 0.01;
  // Gate de démarrage : avec une fenêtre < 1s (leg directe, voir VideoPlayer),
  // un média encore en buffering réseau décoderait 0 échantillon → faux
  // silence. Ne conclure qu'une fois le décodage réellement commencé
  // (readyState >= HAVE_CURRENT_DATA et position > 0), avec un plafond au-delà
  // duquel on abandonne SANS verdict (buffering/erreur, pas notre cas).
  const requireStarted = options?.requireStarted ?? false;
  const startTimeoutMs = 12000;

  let stopped = false;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let maxLevel = 0;
  const decodedBytes = el as HTMLMediaElement & { webkitAudioDecodedByteCount?: number };
  const initialDecodedBytes = typeof decodedBytes.webkitAudioDecodedByteCount === "number"
    ? decodedBytes.webkitAudioDecodedByteCount
    : null;
  let maxDecodedBytes = initialDecodedBytes ?? 0;
  const probe = getProbe(el);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    // Deliberately do NOT disconnect `source` from the AudioContext's
    // destination or close the context: creating a MediaElementSourceNode
    // permanently reroutes this <video>'s audio output through Web Audio
    // for the element's lifetime (browsers don't let you hand it back to
    // the default output path). Disconnecting here would silence playback
    // — including a later HLS/WebCodecs leg reusing the same <video>
    // element. Only the analyser tap is torn down.
    if (probe?.analyserConnected) {
      try { probe.source.disconnect(probe.analyser); } catch { /* already gone */ }
      probe.analyserConnected = false;
    }
  };

  if (probe || initialDecodedBytes != null) {
    const data = new Uint8Array(probe?.analyser.frequencyBinCount ?? 0);
    const sample = () => {
      if (stopped) return;
      if (probe) {
        if (probe.context.state === "suspended") void probe.context.resume();
        probe.analyser.getByteTimeDomainData(data);
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > maxLevel) maxLevel = v;
        }
      }
      if (typeof decodedBytes.webkitAudioDecodedByteCount === "number") {
        maxDecodedBytes = Math.max(maxDecodedBytes, decodedBytes.webkitAudioDecodedByteCount);
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);

    const verdict = () => {
      // The Web Audio meter catches output silence; Chromium's decoded-byte
      // counter covers the cases where a media element cannot be reattached
      // to a meter. Both are checked only after actual video playback began.
      const meterSilent = probe?.context.state === "running" && maxLevel < threshold;
      const decoderSilent = initialDecodedBytes != null && maxDecodedBytes <= initialDecodedBytes;
      const wasSilent = !stopped && (meterSilent || (!probe && decoderSilent));
      stop();
      if (wasSilent) onSilent();
    };

    const armWindow = () => {
      if (stopped) return;
      if (
        requireStarted &&
        (el.readyState < 2 || el.currentTime <= 0) &&
        Date.now() - armedAt < startTimeoutMs
      ) {
        timer = setTimeout(armWindow, 250);
        return;
      }
      timer = setTimeout(verdict, windowMs);
    };
    const armedAt = Date.now();
    armWindow();
  }

  return stop;
}
