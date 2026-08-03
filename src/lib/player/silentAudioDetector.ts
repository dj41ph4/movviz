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
export function watchForSilentAudio(
  el: HTMLMediaElement,
  onSilent: () => void,
  options?: { windowMs?: number; threshold?: number }
): () => void {
  const windowMs = options?.windowMs ?? 6000;
  const threshold = options?.threshold ?? 0.01;

  let stopped = false;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let maxLevel = 0;
  let source: MediaElementAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;

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
    try { if (source && analyser) source.disconnect(analyser); } catch { /* already gone */ }
  };

  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return stop;

    const audioCtx = new AudioContextCtor();
    // Autoplay policy can create the context "suspended" until it picks up
    // the page's existing user-activation — a suspended context feeds the
    // analyser nothing, which would otherwise read as false silence (and,
    // since createMediaElementSource reroutes the element's own output
    // through this same context, could even cause the real silence it's
    // meant to detect). Resume proactively and re-check before deciding.
    if (audioCtx.state === "suspended") void audioCtx.resume();
    source = audioCtx.createMediaElementSource(el);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    source.connect(audioCtx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const sample = () => {
      if (stopped || !analyser) return;
      if (audioCtx.state === "suspended") void audioCtx.resume();
      analyser.getByteTimeDomainData(data);
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > maxLevel) maxLevel = v;
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);

    timer = setTimeout(() => {
      // Never conclude "silent" while the context couldn't even run — that
      // would be a false positive, not a real detection.
      const wasSilent = !stopped && audioCtx.state === "running" && maxLevel < threshold;
      stop();
      if (wasSilent) onSilent();
    }, windowMs);
  } catch (err) {
    // Web Audio unavailable/blocked, or createMediaElementSource() already
    // called once for this <video> element (throws InvalidStateError on a
    // second call, e.g. React StrictMode's double-invoked effects reusing
    // the same DOM node) — no-op. Playback continues on its normal path,
    // we just lose the safety net for this session.
    console.warn("[player] silent-audio watch unavailable:", err);
  }

  return stop;
}
