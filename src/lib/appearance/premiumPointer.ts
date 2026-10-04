/** Original, bounded implementation of spotlight/tilt interaction patterns.
 * One pending frame for the whole app, no React state and no idle animation. */
export function premiumPointerValues(rect: { left: number; top: number; width: number; height: number }, x: number, y: number) {
  const nx = Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width)));
  const ny = Math.max(0, Math.min(1, (y - rect.top) / Math.max(1, rect.height)));
  return { x: `${(nx * 100).toFixed(2)}%`, y: `${(ny * 100).toFixed(2)}%`, rx: `${((.5 - ny) * 3).toFixed(2)}deg`, ry: `${((nx - .5) * 3).toFixed(2)}deg` };
}

const PROPERTIES = ["--mv-light-x", "--mv-light-y", "--mv-tilt-x", "--mv-tilt-y"];

export function createPremiumPointerController(schedule: (fn: () => void) => number, cancel: (id: number) => void) {
  let current: HTMLElement | null = null;
  let frame: number | null = null;
  let point = { x: 0, y: 0 };
  let rect: DOMRect | null = null;
  const reset = () => {
    if (frame != null) cancel(frame);
    frame = null;
    if (current) {
      for (const key of PROPERTIES) current.style.removeProperty(key);
      current.removeAttribute("data-premium-active");
    }
    current = null;
    rect = null;
  };
  return {
    reset,
    move(element: HTMLElement | null, x: number, y: number) {
      if (!element) { reset(); return; }
      if (current !== element) {
        reset();
        current = element;
        rect = element.getBoundingClientRect();
        element.setAttribute("data-premium-active", "");
      }
      point = { x, y };
      if (frame != null) return;
      frame = schedule(() => {
        frame = null;
        if (!current || !rect || !current.isConnected) { reset(); return; }
        const value = premiumPointerValues(rect, point.x, point.y);
        current.style.setProperty(PROPERTIES[0], value.x);
        current.style.setProperty(PROPERTIES[1], value.y);
        current.style.setProperty(PROPERTIES[2], value.rx);
        current.style.setProperty(PROPERTIES[3], value.ry);
      });
    },
  };
}
