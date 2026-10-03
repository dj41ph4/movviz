import assert from "node:assert/strict";
import test from "node:test";
import {
  createActivityPingThrottle,
  isUserActivitySignal,
} from "../src/lib/priority/clientActivitySignal.ts";

function activityClock() {
  let now = 0;
  let active = true;
  let nextTimer = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const sent: number[] = [];
  const activity = createActivityPingThrottle(() => sent.push(now), {
    now: () => now,
    isActive: () => active,
    schedule(callback, delay) {
      const timer = ++nextTimer;
      timers.set(timer, { at: now + delay, callback });
      return timer;
    },
    cancel: (timer) => { timers.delete(timer); },
  });
  return {
    activity, sent, timers,
    setActive(value: boolean) { active = value; },
    advanceTo(time: number) {
      while (true) {
        const due = [...timers.entries()]
          .filter(([, value]) => value.at <= time)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
      }
      now = time;
    },
  };
}

test("trusted pointerdown with detail zero counts for mouse, touch and pen", () => {
  for (const pointerType of ["mouse", "touch", "pen", ""]) {
    const event = { type: "pointerdown", isTrusted: true, detail: 0, pointerType };
    assert.equal(isUserActivitySignal(event), true);
  }
});

test("keyboard, IME input, wheel, actual scroll and history navigation count without reading their contents", () => {
  for (const type of ["keydown", "input", "wheel", "scroll", "popstate", "hashchange"]) {
    assert.equal(isUserActivitySignal({ type, isTrusted: true }), true);
  }
});

test("synthetic events, pointer movement and hover never count", () => {
  for (const type of ["pointerdown", "keydown", "input", "wheel", "scroll", "popstate", "hashchange"]) {
    assert.equal(isUserActivitySignal({ type, isTrusted: false }), false);
  }
  for (const type of ["pointermove", "mousemove", "pointerover", "mouseover", "focus"]) {
    assert.equal(isUserActivitySignal({ type, isTrusted: true }), false);
  }
});

test("continuous activity stays prioritized with at most one ping per second", () => {
  const clock = activityClock();
  clock.activity.signal();
  for (let now = 100; now <= 3_900; now += 100) {
    clock.advanceTo(now);
    clock.activity.signal();
    assert.ok(clock.timers.size <= 1);
  }
  clock.advanceTo(4_000);
  assert.deepEqual(clock.sent, [0, 1_000, 2_000, 3_000, 4_000]);
  assert.equal(clock.timers.size, 0);
  clock.advanceTo(60_000);
  assert.equal(clock.sent.length, 5);
});

test("the final interaction in a short burst is sent once after the throttle window", () => {
  const clock = activityClock();
  clock.activity.signal();
  clock.advanceTo(100);
  clock.activity.signal();
  clock.advanceTo(900);
  clock.activity.signal();
  assert.deepEqual(clock.sent, [0]);
  clock.advanceTo(1_000);
  assert.deepEqual(clock.sent, [0, 1_000]);
  assert.equal(clock.timers.size, 0);
});

test("hidden or unauthenticated activity never starts a timer and hiding cancels the trailing ping", () => {
  const clock = activityClock();
  clock.activity.signal();
  clock.advanceTo(100);
  clock.activity.signal();
  clock.setActive(false);
  clock.activity.cancelPending();
  clock.activity.signal();
  assert.equal(clock.timers.size, 0);
  clock.advanceTo(10_000);
  assert.deepEqual(clock.sent, [0]);
  clock.setActive(true);
  clock.activity.signal();
  assert.deepEqual(clock.sent, [0, 10_000]);
  assert.equal(clock.timers.size, 0);
});

test("a deferred callback rechecks visibility before it can send", () => {
  const clock = activityClock();
  clock.activity.signal();
  clock.advanceTo(100);
  clock.activity.signal();
  clock.setActive(false);
  clock.advanceTo(1_000);
  assert.deepEqual(clock.sent, [0]);
  assert.equal(clock.timers.size, 0);
});
