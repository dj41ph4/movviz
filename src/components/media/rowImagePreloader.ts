/** Warm the visible carousel and two viewport widths on either side.
 * Keep existing cards mounted: focus, popovers and local action state survive.
 * Use the rendered image itself, preserving CDN/local fallback and cache rules.
 */
export function createRowImagePreloader(row: HTMLElement): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};

  let observer: IntersectionObserver | undefined;
  let width = -1;
  const warmed = new WeakSet<HTMLImageElement>();
  const images = new Set<HTMLImageElement>();

  const collect = () => {
    for (const image of images) {
      if (!row.contains(image)) {
        observer?.unobserve(image);
        images.delete(image);
      }
    }
    row.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (images.has(image)) return;
      images.add(image);
      observer?.observe(image);
    });
  };

  const resize = () => {
    if (width === row.clientWidth) return;
    width = row.clientWidth;
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const image = entry.target as HTMLImageElement;
        // Eager loading starts before the next page is requested, without
        // a second fetch through a different URL or a detached Image object.
        image.loading = "eager";
        if (!warmed.has(image)) {
          warmed.add(image);
          const decode = () => { void image.decode?.().catch(() => {}); };
          if (image.complete) decode();
          else image.addEventListener("load", decode, { once: true });
        }
      }
    }, { root: row, rootMargin: `0px ${width * 2}px`, threshold: 0 });
    images.forEach((image) => observer!.observe(image));
  };

  resize();
  collect();
  const resizing = new ResizeObserver(resize);
  resizing.observe(row);
  // Async artwork and newly loaded rows also join the same preload horizon.
  const mutations = new MutationObserver(collect);
  mutations.observe(row, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    resizing.disconnect();
    mutations.disconnect();
  };
}
