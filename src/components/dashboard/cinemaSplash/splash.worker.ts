/**
 * Beta splash render loop, off the main thread: while the dashboard parses its data and renders
 * underneath, the page's main thread is busy for long stretches — here the animation keeps its
 * frames regardless.
 */
import { CinemaSplashRenderer } from "./renderer";

export type SplashWorkerMessage =
  | { type: "init"; canvas: OffscreenCanvas; pw: number; ph: number; k: number; progress: number; reduce: boolean }
  | { type: "resize"; pw: number; ph: number; k: number }
  | { type: "progress"; value: number }
  | { type: "text"; bitmap: ImageBitmap }
  | { type: "reduce"; value: boolean }
  | { type: "stop" };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<SplashWorkerMessage>) => void) | null;
  postMessage(message: unknown): void;
  requestAnimationFrame?: (cb: (now: number) => void) => number;
  close(): void;
};

const STILL_TIME = 3.2;
let renderer: CinemaSplashRenderer | null = null;
let reduce = false;
let running = false;
let start = 0;
let shown = false;

const nextFrame = (cb: (now: number) => void) =>
  scope.requestAnimationFrame ? scope.requestAnimationFrame(cb) : setTimeout(() => cb(performance.now()), 16);

function announce() {
  if (shown) return;
  shown = true;
  scope.postMessage({ type: "shown" });
}

function still() {
  if (!renderer?.isReady()) return;
  renderer.render(STILL_TIME, true);
  announce();
}

function frame(now: number) {
  if (!renderer || !running) return;
  renderer.render((now - start) / 1000, false);
  announce();
  nextFrame(frame);
}

function play() {
  if (running || !renderer?.isReady()) return;
  running = true;
  start = performance.now();
  nextFrame(frame);
}

scope.onmessage = (e) => {
  const m = e.data;
  switch (m.type) {
    case "init": {
      reduce = m.reduce;
      renderer = new CinemaSplashRenderer(m.canvas);
      renderer.resize(m.pw, m.ph, m.k);
      renderer.setProgress(m.progress);
      renderer.onLayerLoaded = () => {
        if (reduce) still();
      };
      renderer.load().then(
        () => (reduce ? still() : play()),
        () => scope.postMessage({ type: "failed" }),
      );
      break;
    }
    case "resize":
      renderer?.resize(m.pw, m.ph, m.k);
      if (reduce) still();
      break;
    case "progress":
      renderer?.setProgress(m.value);
      if (reduce) still();
      break;
    case "text":
      if (renderer) renderer.setTextLayer(m.bitmap);
      else m.bitmap.close();
      if (reduce) still();
      break;
    case "reduce":
      reduce = m.value;
      if (reduce) {
        running = false;
        still();
      } else play();
      break;
    case "stop":
      running = false;
      renderer?.dispose();
      renderer = null;
      scope.close();
      break;
  }
};
