import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createRowImagePreloader } from "../src/components/media/rowImagePreloader";
import { beginForegroundRequest } from "../src/lib/priority/foregroundRequests";

type Rect = { left: number; right: number; top: number; bottom: number };
type Callback = () => void;
const flushMicrotasks = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

class Events {
  listeners = new Map<string, Set<Callback>>();
  addEventListener(type: string, callback: Callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(callback);
  }
  removeEventListener(type: string, callback: Callback) { this.listeners.get(type)?.delete(callback); }
  emit(type: string) { [...(this.listeners.get(type) ?? [])].forEach((callback) => callback()); }
  listenerCount(type?: string) {
    return type ? this.listeners.get(type)?.size ?? 0 : [...this.listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0);
  }
}

class ImageMock extends Events {
  src: string;
  rect: Rect;
  complete = false;
  naturalWidth = 500;
  eagerAssignments = 0;
  decodes = 0;
  decodeGate?: Promise<void>;
  private loadingValue = "lazy";
  constructor(src: string, rect: Rect = { left: 1200, right: 1450, top: 120, bottom: 280 }) {
    super(); this.src = src; this.rect = rect;
  }
  get loading() { return this.loadingValue; }
  set loading(value: string) { this.loadingValue = value; if (value === "eager") this.eagerAssignments++; }
  getBoundingClientRect() { return this.rect; }
  async decode() { this.decodes++; await this.decodeGate; }
  finish(type: "load" | "error" = "load") { this.complete = true; if (type === "error") this.naturalWidth = 0; this.emit(type); }
}

class RowMock extends Events {
  clientWidth = 1000;
  rect: Rect = { left: 0, right: 1000, top: 100, bottom: 300 };
  constructor(public images: ImageMock[] = []) { super(); }
  querySelectorAll() { return this.images; }
  contains(image: ImageMock) { return this.images.includes(image); }
  getBoundingClientRect() { return this.rect; }
}

function browser(t: TestContext, visibilityState = "visible") {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const intersections: IntersectionMock[] = [];
  const resizes: ResizeMock[] = [];
  const mutations: MutationMock[] = [];
  const cleanups: Callback[] = [];
  const foregroundEnds: Callback[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  class IntersectionMock {
    observed = new Set<object>();
    disconnected = false;
    constructor(public callback: (entries: { target: object; isIntersecting: boolean }[]) => void, public options: IntersectionObserverInit = {}) { intersections.push(this); }
    observe(target: object) { this.observed.add(target); }
    unobserve(target: object) { this.observed.delete(target); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
    intersect(target: object, isIntersecting: boolean) { this.callback([{ target, isIntersecting }]); }
  }
  class ResizeMock {
    target?: object;
    disconnected = false;
    constructor(public callback: Callback) { resizes.push(this); }
    observe(target: object) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  class MutationMock {
    target?: object;
    options?: MutationObserverInit;
    disconnected = false;
    constructor(public callback: Callback) { mutations.push(this); }
    observe(target: object, options: MutationObserverInit) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  const windowMock = Object.assign(new Events(), {
    innerWidth: 1000, innerHeight: 800,
    requestAnimationFrame(callback: FrameRequestCallback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
  });
  const documentMock = Object.assign(new Events(), { visibilityState });
  const globals = { window: windowMock, document: documentMock, IntersectionObserver: IntersectionMock, ResizeObserver: ResizeMock, MutationObserver: MutationMock };
  for (const [key, value] of Object.entries(globals)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const flush = async () => {
    await flushMicrotasks();
    const pending = [...frames.values()]; frames.clear();
    pending.forEach((callback) => callback(0));
    await flushMicrotasks();
  };
  t.after(async () => {
    cleanups.forEach((cleanup) => cleanup());
    foregroundEnds.forEach((end) => end());
    await flushMicrotasks();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    intersections, resizes, mutations, frames, window: windowMock, document: documentMock, flush,
    start(row: RowMock, options: { playbackActive?: boolean } = {}) {
      const cleanup = createRowImagePreloader(row as unknown as HTMLElement, options);
      cleanups.push(cleanup); return cleanup;
    },
    horizontal(row: RowMock) { return intersections.findLast((observer) => observer.options.root === row as unknown as HTMLElement)!; },
    viewport(row: RowMock) { return intersections.find((observer) => !observer.options.root && observer.observed.has(row))!; },
    mutation(row: RowMock) { return mutations.find((observer) => observer.target === row)!; },
    foreground() { const end = beginForegroundRequest(); foregroundEnds.push(end); return end; },
    near(row: RowMock) { this.viewport(row).intersect(row, true); },
    horizon(row: RowMock, image: ImageMock, inside = true) { this.horizontal(row).intersect(image, inside); },
  };
}

test("a horizontal intersection cannot warm a shelf far below the viewport", async (t) => {
  const env = browser(t);
  const image = new ImageMock("/far.jpg", { left: 1200, right: 1450, top: 1700, bottom: 1880 });
  const row = new RowMock([image]); row.rect = { left: 0, right: 1000, top: 1600, bottom: 1900 };
  env.start(row);
  assert.deepEqual(env.viewport(row).options, { rootMargin: "800px 0px", threshold: 0 });
  assert.deepEqual(env.horizontal(row).options, { root: row, rootMargin: "0px 2000px", threshold: 0 });
  env.horizon(row, image); await env.flush();
  assert.equal(image.loading, "lazy");
  env.near(row); await env.flush();
  assert.equal(image.loading, "eager");
  image.finish(); await env.flush();
  assert.equal(image.decodes, 1);
  env.horizon(row, image); await env.flush();
  assert.equal(image.eagerAssignments, 1, "repeated intersection must not warm the same source twice");
});

test("two-width horizon adapts to resize and discovers late artwork", async (t) => {
  const env = browser(t);
  const first = new ImageMock("/first.jpg");
  const row = new RowMock([first]); env.start(row); env.near(row);
  env.horizon(row, first, false); await env.flush();
  assert.equal(first.loading, "lazy");
  env.horizon(row, first); await env.flush(); first.finish(); await env.flush();
  const second = new ImageMock("/late-logo.png", { left: 1800, right: 2000, top: 120, bottom: 280 });
  row.images.push(second); env.mutation(row).callback(); await env.flush();
  assert.ok(env.horizontal(row).observed.has(second));
  assert.equal(second.loading, "lazy", "new images still wait for horizontal proximity");
  env.horizon(row, second); await env.flush(); assert.equal(second.loading, "eager");
  const oldObserver = env.horizontal(row);
  row.clientWidth = 600; row.rect.right = 600;
  env.resizes.find((observer) => observer.target === row)!.callback(); await env.flush();
  assert.ok(oldObserver.disconnected);
  assert.equal(env.horizontal(row).options.rootMargin, "0px 1200px");
  assert.ok(env.horizontal(row).observed.has(second));
  assert.deepEqual(env.mutation(row).options, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
});

test("two speculative loads are shared across shelves while visible artwork bypasses saturation", async (t) => {
  const env = browser(t);
  const a = new ImageMock("/a.jpg"), b = new ImageMock("/b.jpg"), c = new ImageMock("/c.jpg");
  const first = new RowMock([a, b]), second = new RowMock([c]);
  env.start(first); env.start(second); env.near(first); env.near(second);
  env.horizon(first, a); env.horizon(first, b); env.horizon(second, c); await env.flush();
  assert.equal(a.loading, "eager"); assert.equal(b.loading, "eager"); assert.equal(c.loading, "lazy");
  const visible = new ImageMock("/visible.jpg", { left: 100, right: 350, top: 120, bottom: 280 });
  second.images.push(visible); env.mutation(second).callback(); await env.flush();
  assert.equal(visible.loading, "eager", "visible art must not wait behind the global speculative budget");
  assert.equal(c.loading, "lazy");
  a.finish(); await env.flush();
  assert.equal(c.loading, "eager", "a completed load releases capacity for another shelf");
});

test("foreground data pauses speculative work and resumes it without delaying visible images", async (t) => {
  const env = browser(t);
  const end = env.foreground();
  const visible = new ImageMock("/visible-data.jpg", { left: 100, right: 350, top: 120, bottom: 280 });
  const ahead = new ImageMock("/ahead-data.jpg");
  const row = new RowMock([visible, ahead]); env.start(row); env.near(row); env.horizon(row, ahead); await env.flush();
  assert.equal(visible.loading, "eager"); assert.equal(ahead.loading, "lazy");
  visible.finish(); await env.flush(); assert.equal(visible.decodes, 0);
  end(); await env.flush(); assert.equal(ahead.loading, "eager");
});

test("new foreground data cancels waiting speculation until that data finishes", async (t) => {
  const env = browser(t);
  const a = new ImageMock("/foreground-a.jpg"), b = new ImageMock("/foreground-b.jpg"), c = new ImageMock("/foreground-c.jpg");
  const row = new RowMock([a, b, c]); env.start(row); env.near(row);
  for (const image of row.images) env.horizon(row, image);
  await env.flush(); assert.equal(c.loading, "lazy");
  const end = env.foreground(); a.finish(); await env.flush();
  assert.equal(c.loading, "lazy", "releasing a load must not start waiting artwork during foreground data");
  assert.equal(a.decodes, 0);
  end(); await env.flush(); assert.equal(c.loading, "eager");
});

test("speculative decode is bounded globally and queued decode yields to foreground data", async (t) => {
  const env = browser(t);
  const a = new ImageMock("/decode-a.jpg"), b = new ImageMock("/decode-b.jpg");
  let release!: () => void;
  a.decodeGate = new Promise<void>((resolve) => { release = resolve; });
  t.after(() => release());
  const first = new RowMock([a]), second = new RowMock([b]);
  env.start(first); env.start(second); env.near(first); env.near(second);
  env.horizon(first, a); env.horizon(second, b); await env.flush();
  a.finish(); b.finish(); await env.flush();
  assert.equal(a.decodes, 1); assert.equal(b.decodes, 0, "only one speculative decode may run across shelves");
  const end = env.foreground(); release(); await env.flush();
  assert.equal(b.decodes, 0, "waiting decode must yield when foreground data starts");
  end();
});

test("a failed image releases its global load slot and is not decoded", async (t) => {
  const env = browser(t);
  const a = new ImageMock("/error-a.jpg"), b = new ImageMock("/error-b.jpg"), c = new ImageMock("/error-c.jpg");
  const row = new RowMock([a, b, c]); env.start(row); env.near(row);
  for (const image of row.images) env.horizon(row, image);
  await env.flush(); assert.equal(c.loading, "lazy");
  a.finish("error"); await env.flush();
  assert.equal(a.listenerCount(), 0); assert.equal(a.decodes, 0); assert.equal(c.loading, "eager");
});

test("active playback pauses speculation while visible images still load", async (t) => {
  const env = browser(t);
  const visible = new ImageMock("/visible-player.jpg", { left: 100, right: 350, top: 120, bottom: 280 });
  const ahead = new ImageMock("/ahead-player.jpg");
  const row = new RowMock([visible, ahead]); env.start(row, { playbackActive: true }); env.near(row); env.horizon(row, ahead); await env.flush();
  assert.equal(visible.loading, "eager"); assert.equal(ahead.loading, "lazy");
  visible.finish(); await env.flush(); assert.equal(visible.decodes, 0);
  row.emit("scroll"); await env.flush(); assert.equal(ahead.loading, "lazy");
});

test("a hidden document starts no loads and visibility change resumes useful images", async (t) => {
  const env = browser(t, "hidden");
  const visible = new ImageMock("/hidden-visible.jpg", { left: 100, right: 350, top: 120, bottom: 280 });
  const ahead = new ImageMock("/hidden-ahead.jpg");
  const row = new RowMock([visible, ahead]); env.start(row); env.near(row); env.horizon(row, ahead); await env.flush();
  assert.equal(visible.loading, "lazy"); assert.equal(ahead.loading, "lazy");
  env.document.visibilityState = "visible"; env.document.emit("visibilitychange"); await env.flush();
  assert.equal(visible.loading, "eager"); assert.equal(ahead.loading, "eager");
  env.document.visibilityState = "hidden"; env.document.emit("visibilitychange");
  ahead.finish(); await env.flush(); assert.equal(ahead.decodes, 0);
});

test("source fallback settles the old load, replaces listeners and warms the new source once", async (t) => {
  const env = browser(t);
  const image = new ImageMock("https://cdn.test/logo.png");
  const row = new RowMock([image]); env.start(row); env.near(row); env.horizon(row, image); await env.flush();
  assert.equal(image.eagerAssignments, 1); assert.equal(image.listenerCount(), 2);
  image.src = "/tmdb/w500/local-logo.png";
  env.mutation(row).callback(); await env.flush();
  assert.equal(image.eagerAssignments, 2, "a recycled element must warm its replacement source");
  assert.equal(image.listenerCount("load"), 1); assert.equal(image.listenerCount("error"), 1);
  image.finish(); await env.flush();
  assert.equal(image.listenerCount(), 0); assert.equal(image.decodes, 1, "the prior source must not decode its replacement");
  env.mutation(row).callback(); env.horizon(row, image); await env.flush();
  assert.equal(image.eagerAssignments, 2); assert.equal(image.decodes, 1);
});

test("removing a loading image releases its slot without decoding the detached element", async (t) => {
  const env = browser(t);
  const a = new ImageMock("/removed-a.jpg"), b = new ImageMock("/removed-b.jpg"), c = new ImageMock("/waiting-c.jpg");
  const row = new RowMock([a, b, c]); env.start(row); env.near(row);
  for (const image of row.images) env.horizon(row, image);
  await env.flush(); assert.equal(c.loading, "lazy");
  row.images = [b, c]; env.mutation(row).callback(); await env.flush();
  assert.equal(a.listenerCount(), 0); assert.equal(a.decodes, 0);
  assert.equal(env.horizontal(row).observed.has(a), false);
  assert.equal(c.loading, "eager", "removal must settle the old load instead of occupying the global slot forever");
});

test("cleanup disconnects observers, removes listeners, cancels queued work and the pending frame", async (t) => {
  const env = browser(t);
  const a = new ImageMock("/cleanup-a.jpg"), b = new ImageMock("/cleanup-b.jpg"), c = new ImageMock("/cleanup-c.jpg");
  const row = new RowMock([a, b, c]); const cleanup = env.start(row); env.near(row);
  for (const image of row.images) env.horizon(row, image);
  await env.flush(); row.emit("scroll");
  assert.equal(env.frames.size, 1);
  cleanup(); await env.flush();
  assert.equal(env.frames.size, 0);
  assert.ok(env.intersections.every((observer) => observer.disconnected));
  assert.ok(env.resizes.every((observer) => observer.disconnected));
  assert.ok(env.mutations.every((observer) => observer.disconnected));
  assert.equal(row.listenerCount(), 0); assert.equal(env.window.listenerCount(), 0); assert.equal(env.document.listenerCount(), 0);
  assert.equal(a.listenerCount(), 0); assert.equal(b.listenerCount(), 0); assert.equal(c.loading, "lazy");
  env.foreground()(); row.emit("scroll"); env.document.emit("visibilitychange"); await env.flush();
  assert.equal(a.decodes + b.decodes + c.decodes, 0); assert.equal(c.loading, "lazy");
});

test("absence of IntersectionObserver keeps normal browser loading available", (t) => {
  const env = browser(t);
  Object.defineProperty(globalThis, "IntersectionObserver", { value: undefined, writable: true, configurable: true });
  const image = new ImageMock("/normal-browser.jpg");
  const cleanup = env.start(new RowMock([image])); cleanup();
  assert.equal(image.loading, "lazy"); assert.equal(env.intersections.length, 0);
});
