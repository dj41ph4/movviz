import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import postcss, { type Node, type AtRule } from "postcss";
import { isPremiumAppearance } from "../src/lib/appearance/policy.ts";
import { createPremiumPointerController, premiumPointerValues } from "../src/lib/appearance/premiumPointer.ts";

test("premium appearance is opt-in and cannot inherit another profile's cached choice", () => {
  assert.equal(isPremiumAppearance("cassy", { userId: "cassy", layout: { mode: "beta" } }), true);
  assert.equal(isPremiumAppearance("friend", { userId: "cassy", layout: { mode: "beta" } }), false);
  assert.equal(isPremiumAppearance(null, { userId: "cassy", layout: { mode: "beta" } }), false);
  assert.equal(isPremiumAppearance("cassy", { userId: "cassy", layout: { mode: "cinema" } }), false);
  assert.equal(isPremiumAppearance("cassy", undefined), false);
});

test("spotlight coordinates and tilt stay bounded, including outside the card", () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(premiumPointerValues(rect, 110, 70), { x: "50.00%", y: "50.00%", rx: "0.00deg", ry: "0.00deg" });
  assert.deepEqual(premiumPointerValues(rect, -1000, 1000), { x: "0.00%", y: "100.00%", rx: "-1.50deg", ry: "-1.50deg" });
});

function fixture() {
  const frames = new Map<number, () => void>();
  let sequence = 0;
  const pointer = createPremiumPointerController((fn) => { frames.set(++sequence, fn); return sequence; }, (id) => { frames.delete(id); });
  const makeElement = () => {
    const styles = new Map<string, string>();
    const attributes = new Set<string>();
    let reads = 0;
    const element = {
      isConnected: true,
      getBoundingClientRect: () => { reads++; return { left: 0, top: 0, width: 100, height: 100 }; },
      style: { setProperty: (key: string, value: string) => styles.set(key, value), removeProperty: (key: string) => styles.delete(key) },
      setAttribute: (key: string) => attributes.add(key), removeAttribute: (key: string) => attributes.delete(key),
    } as unknown as HTMLElement;
    return { element, styles, attributes, reads: () => reads };
  };
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((fn) => fn()); };
  return { pointer, frames, makeElement, flush };
}

test("pointer bursts schedule one frame, one geometry read, and no idle loop", () => {
  const { pointer, frames, makeElement, flush } = fixture();
  const target = makeElement();
  for (let i = 0; i < 80; i++) pointer.move(target.element, i, i);
  assert.equal(frames.size, 1);
  assert.equal(target.reads(), 1);
  flush();
  assert.equal(target.styles.get("--mv-light-x"), "79.00%");
  assert.equal(frames.size, 0);
  pointer.reset();
  assert.equal(target.styles.size, 0);
  assert.equal(target.attributes.size, 0);
});

test("switching target and disabling effects cancels pending writes and clears old tilt", () => {
  const { pointer, frames, makeElement, flush } = fixture();
  const first = makeElement();
  const second = makeElement();
  pointer.move(first.element, 90, 90);
  pointer.move(second.element, 10, 10);
  assert.equal(frames.size, 1);
  assert.equal(first.attributes.size, 0);
  flush();
  assert.equal(first.styles.size, 0);
  assert.equal(second.styles.get("--mv-light-x"), "10.00%");
  pointer.move(second.element, 70, 70);
  pointer.reset();
  assert.equal(frames.size, 0);
  assert.equal(second.styles.size, 0);
});

test("every premium style rule is scoped to Beta and desktop", () => {
  const css = readFileSync(new URL("../src/components/appearance/premium.css", import.meta.url), "utf8");
  postcss.parse(css).walkRules((rule) => {
    assert.ok(rule.selector.startsWith('html[data-movviz-appearance="beta"]'), rule.selector);
    let parent: Node | undefined = rule.parent;
    let desktop = false;
    while (parent) {
      if (parent.type === "atrule") {
        const atRule = parent as AtRule;
        if (atRule.name === "media" && atRule.params.includes("min-width: 1024px")) desktop = true;
      }
      parent = parent.parent;
    }
    assert.ok(desktop, rule.selector);
  });
  const source = readFileSync(new URL("../src/components/appearance/AppearanceProvider.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("if (!beta || reduceMotion || playbackActive) return;"));
  assert.ok(source.includes("pointer.reset();"));
});

test("Beta leaves the page and sidebar backgrounds to the original theme", () => {
  const css = readFileSync(new URL("../src/components/appearance/premium.css", import.meta.url), "utf8");
  postcss.parse(css).walkRules((rule) => {
    if (!rule.selector.endsWith(" .nx-desktop-shell") && !rule.selector.endsWith(" .nx-sidebar")) return;
    rule.walkDecls((declaration) => {
      assert.ok(!declaration.prop.startsWith("background"), declaration.toString());
    });
  });
  assert.ok(css.includes("var(--mv-light-x"), "Keep the pointer spotlight");
  assert.ok(css.includes("var(--mv-tilt-x"), "Keep the pointer tilt");
});
