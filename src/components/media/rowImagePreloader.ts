import { hasForegroundRequests, subscribeForegroundRequests } from "@/lib/priority/foregroundRequests";
import { carouselDecodeQueue, carouselImageQueue } from "./imagePreloadQueue";

/** Two widths ahead for nearby shelves. Cards, focus and actions stay mounted.
 * Visible images bypass the speculative budget, even while page data loads.
 */
export function createRowImagePreloader(row: HTMLElement, options: { playbackActive?: boolean } = {}): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  let disposed = false;
  let nearViewport = false;
  let width = -1;
  let horizontal: IntersectionObserver | undefined;
  let frame: number | undefined;
  const images = new Set<HTMLImageElement>();
  const inHorizon = new Set<HTMLImageElement>();
  const warmed = new Map<HTMLImageElement, string>();
  const finishLoads = new Map<HTMLImageElement, () => void>();

  const cancelQueued = (image: HTMLImageElement) => {
    carouselImageQueue.cancel(image);
    carouselDecodeQueue.cancel(image);
  };
  const speculativeAllowed = () => !disposed && nearViewport
    && document.visibilityState === "visible" && !options.playbackActive && !hasForegroundRequests();

  const isVisible = (image: HTMLImageElement, bounds: DOMRect) => {
    const rect = image.getBoundingClientRect();
    return rect.bottom >= Math.max(0, bounds.top) && rect.top <= Math.min(window.innerHeight, bounds.bottom)
      && rect.right >= Math.max(0, bounds.left) && rect.left <= Math.min(window.innerWidth, bounds.right)
      && bounds.bottom > 0 && bounds.top < window.innerHeight;
  };
  const decode = (image: HTMLImageElement) => {
    carouselDecodeQueue.enqueue(image, async () => {
      if (disposed || !images.has(image) || !speculativeAllowed()) return;
      await image.decode?.().catch(() => {});
    });
  };
  const load = (image: HTMLImageElement, speculative: boolean): Promise<void> => {
    if (disposed || !images.has(image) || (speculative && (!speculativeAllowed() || !inHorizon.has(image)))) return Promise.resolve();
    const src = image.src;
    if (warmed.get(image) === src) return Promise.resolve();
    // A recycled card/fallback must not orphan the previous queue promise.
    finishLoads.get(image)?.();
    warmed.set(image, src);
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
        finishLoads.delete(image);
        // Normal visible decoding remains browser-owned. Decode ahead only
        // while the page has spare capacity, not alongside critical data.
        if (image.src === src && image.naturalWidth > 0 && speculativeAllowed()) decode(image);
        resolve();
      };
      finishLoads.set(image, done);
      image.addEventListener("load", done);
      image.addEventListener("error", done);
      image.loading = "eager";
      if (image.complete) done();
    });
  };
  const update = () => {
    if (disposed) return;
    const bounds = row.getBoundingClientRect();
    const rowVisible = document.visibilityState === "visible" && bounds.bottom > 0 && bounds.top < window.innerHeight;
    const canSpeculate = speculativeAllowed();
    for (const image of images) {
      if (warmed.get(image) === image.src) {
        if (!canSpeculate) cancelQueued(image);
        continue;
      }
      if (rowVisible && isVisible(image, bounds)) {
        // A card brought into view never waits behind offscreen artwork.
        carouselImageQueue.cancel(image);
        void load(image, false);
      } else if (inHorizon.has(image) && canSpeculate) {
        const rect = image.getBoundingClientRect();
        const distance = Math.max(0, rect.left - bounds.right, bounds.left - rect.right);
        carouselImageQueue.enqueue(image, () => load(image, true), distance);
      } else {
        cancelQueued(image);
      }
    }
  };
  const schedule = () => {
    if (frame !== undefined || disposed) return;
    frame = window.requestAnimationFrame(() => { frame = undefined; update(); });
  };
  const collect = () => {
    for (const image of images) {
      if (!row.contains(image)) {
        horizontal?.unobserve(image);
        inHorizon.delete(image);
        warmed.delete(image);
        images.delete(image);
        cancelQueued(image);
        finishLoads.get(image)?.();
      }
    }
    row.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (images.has(image)) {
        // Handles recycled cards and the existing CDN-to-local fallback.
        if (warmed.get(image) !== image.src) {
          finishLoads.get(image)?.();
          warmed.delete(image);
          schedule();
        }
        return;
      }
      images.add(image);
      horizontal?.observe(image);
    });
    schedule();
  };
  const resize = () => {
    if (width === row.clientWidth) return;
    width = row.clientWidth;
    horizontal?.disconnect();
    inHorizon.clear();
    horizontal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const image = entry.target as HTMLImageElement;
        if (entry.isIntersecting) inHorizon.add(image);
        else inHorizon.delete(image);
      }
      update();
    }, { root: row, rootMargin: `0px ${width * 2}px`, threshold: 0 });
    images.forEach((image) => horizontal!.observe(image));
    schedule();
  };
  // A horizontal root alone also intersects shelves far below the fold.
  const viewport = new IntersectionObserver((entries) => {
    nearViewport = entries.some((entry) => entry.isIntersecting);
    update();
  }, { rootMargin: `${window.innerHeight}px 0px`, threshold: 0 });
  viewport.observe(row);
  resize();
  collect();
  const resizing = new ResizeObserver(resize);
  resizing.observe(row);
  const mutations = new MutationObserver(collect);
  mutations.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  const unsubscribe = subscribeForegroundRequests(update);
  row.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("scroll", schedule, { passive: true });
  document.addEventListener("visibilitychange", update);
  return () => {
    disposed = true;
    horizontal?.disconnect();
    viewport.disconnect();
    resizing.disconnect();
    mutations.disconnect();
    unsubscribe();
    row.removeEventListener("scroll", schedule);
    window.removeEventListener("scroll", schedule);
    document.removeEventListener("visibilitychange", update);
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    images.forEach(cancelQueued);
    finishLoads.forEach((finish) => finish());
  };
}
