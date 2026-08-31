/**
 * Shared, reference-counted body scroll lock for overlays.
 *
 * Framer Motion deliberately keeps an exiting overlay mounted while the next
 * one may already be entering. Restoring `body.style.overflow` from each
 * component independently therefore races: the last exiting component can
 * put `hidden` back after every overlay has gone. Keeping this tiny state on
 * globalThis also makes it safe when Next bundles callers in separate client
 * chunks.
 */

interface BodyScrollLockState {
  count: number;
  overflow: string;
  paddingRight: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __movvizBodyScrollLock: BodyScrollLockState | undefined;
}

function getState(): BodyScrollLockState {
  if (!globalThis.__movvizBodyScrollLock) {
    globalThis.__movvizBodyScrollLock = { count: 0, overflow: "", paddingRight: "" };
  }
  return globalThis.__movvizBodyScrollLock;
}

/**
 * Prevent page scrolling until the returned release function has been called
 * for every active overlay. Calling `release` twice is intentionally harmless.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};

  const state = getState();
  if (state.count === 0) {
    state.overflow = document.body.style.overflow;
    state.paddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  state.count += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const current = getState();
    current.count = Math.max(0, current.count - 1);
    if (current.count !== 0) return;

    document.body.style.overflow = current.overflow;
    document.body.style.paddingRight = current.paddingRight;
  };
}
