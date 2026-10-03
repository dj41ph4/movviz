import assert from "node:assert/strict";
import { test } from "node:test";
import { createRowImagePreloader } from "../src/components/media/rowImagePreloader";

test("carousel warms two widths ahead, handles resize and late artwork, and cleans up", () => {
  const originals = [globalThis.IntersectionObserver, globalThis.ResizeObserver, globalThis.MutationObserver] as const;
  const observers: any[] = [];
  let resize!: () => void;
  let mutate!: () => void;
  let resizeDisconnected = false;
  let mutationDisconnected = false;
  class IntersectionMock {
    observed = new Set<unknown>();
    disconnected = false;
    constructor(public callback: (entries: unknown[]) => void, public options: unknown) { observers.push(this); }
    observe(image: unknown) { this.observed.add(image); }
    unobserve(image: unknown) { this.observed.delete(image); }
    disconnect() { this.disconnected = true; }
  }
  globalThis.IntersectionObserver = IntersectionMock as any;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() { resizeDisconnected = true; }
  } as any;
  globalThis.MutationObserver = class {
    constructor(callback: () => void) { mutate = callback; }
    observe() {}
    disconnect() { mutationDisconnected = true; }
  } as any;
  try {
    let decodes = 0;
    const first = { loading: "lazy", complete: true, decode: () => { decodes++; return Promise.resolve(); } };
    const second = { loading: "lazy", complete: true, decode: () => Promise.resolve() };
    const images = [first];
    const row = { clientWidth: 1000, querySelectorAll: () => images, contains: (image: any) => images.includes(image) };
    const cleanup = createRowImagePreloader(row as any);
    assert.deepEqual(observers[0].options, { root: row, rootMargin: "0px 2000px", threshold: 0 });
    observers[0].callback([{ target: first, isIntersecting: false }]);
    assert.equal(first.loading, "lazy");
    observers[0].callback([{ target: first, isIntersecting: true }]);
    assert.equal(first.loading, "eager");
    assert.equal(decodes, 1);
    observers[0].callback([{ target: first, isIntersecting: true }]);
    assert.equal(decodes, 1);
    images.push(second);
    mutate();
    assert.ok(observers[0].observed.has(second));
    images.shift();
    mutate();
    assert.ok(!observers[0].observed.has(first));
    row.clientWidth = 600;
    resize();
    assert.ok(observers[0].disconnected);
    assert.equal(observers[1].options.rootMargin, "0px 1200px");
    assert.ok(observers[1].observed.has(second));
    cleanup();
    assert.ok(observers[1].disconnected && resizeDisconnected && mutationDisconnected);
  } finally {
    [globalThis.IntersectionObserver, globalThis.ResizeObserver, globalThis.MutationObserver] = originals;
  }
});
