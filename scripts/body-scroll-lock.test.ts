import assert from "node:assert/strict";
import test from "node:test";
import { lockBodyScroll } from "../src/lib/dom/bodyScrollLock.ts";

type FakeStyle = { overflow: string; paddingRight: string };

function installDom({ overflow = "", paddingRight = "", scrollbarWidth = 16 } = {}) {
  const style: FakeStyle = { overflow, paddingRight };
  Object.assign(globalThis, {
    document: {
      body: { style },
      documentElement: { clientWidth: 1000 },
    },
    window: { innerWidth: 1000 + scrollbarWidth },
  });
  globalThis.__movvizBodyScrollLock = undefined;
  return style;
}

test("body scroll remains locked until the final overlapping overlay closes", () => {
  const style = installDom();
  const releaseFirst = lockBodyScroll();
  const releaseSecond = lockBodyScroll();

  assert.equal(style.overflow, "hidden");
  assert.equal(style.paddingRight, "16px");

  releaseFirst();
  assert.equal(style.overflow, "hidden");
  releaseSecond();
  assert.equal(style.overflow, "");
  assert.equal(style.paddingRight, "");
});

test("body scroll restores the pre-existing inline styles exactly once", () => {
  const style = installDom({ overflow: "clip", paddingRight: "4px", scrollbarWidth: 0 });
  const release = lockBodyScroll();
  release();
  release();

  assert.equal(style.overflow, "clip");
  assert.equal(style.paddingRight, "4px");
});
