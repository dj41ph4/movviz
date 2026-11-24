/**
 * Trace des étapes du lecteur, réservée à iPhone/iPad : sert uniquement au diagnostic
 * (ajoutée à la télémétrie de coupure). Sans effet, et sans coût, sur les autres appareils.
 */

const MAX = 16;
const marks: string[] = [];
let enabled: boolean | null = null;

function isIos(): boolean {
  if (enabled === null) {
    enabled = typeof navigator !== "undefined" && /iPhone|iPad/i.test(navigator.userAgent);
  }
  return enabled;
}

export function iosMark(label: string): void {
  if (!isIos()) return;
  marks.push(`${(performance.now() / 1000).toFixed(1)}:${label}`);
  if (marks.length > MAX) marks.shift();
}

export function iosTrace(): string {
  return marks.join(" ");
}
