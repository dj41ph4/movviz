import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  hasForegroundActivity,
  isUserActive,
  markForegroundActivity,
  markUserActivity,
} from "@/lib/priority/userActivity";

type ActivityGlobal = typeof globalThis & {
  __movvizForegroundLeases?: Map<string, number>;
  __movvizLastUserActivity?: { at: number; user: { id: string; username: string } | null };
};
const activityGlobal = globalThis as ActivityGlobal;

function preserveActivityState(t: TestContext) {
  const previousLeases = new Map(activityGlobal.__movvizForegroundLeases);
  const previousActivity = activityGlobal.__movvizLastUserActivity;
  activityGlobal.__movvizForegroundLeases?.clear();
  delete activityGlobal.__movvizLastUserActivity;
  t.after(() => {
    activityGlobal.__movvizForegroundLeases?.clear();
    for (const [userId, until] of previousLeases) activityGlobal.__movvizForegroundLeases?.set(userId, until);
    if (previousActivity) activityGlobal.__movvizLastUserActivity = previousActivity;
    else delete activityGlobal.__movvizLastUserActivity;
  });
}

test("a request lease outlasts click activity but expires exactly five seconds after its last ping", (t) => {
  preserveActivityState(t);
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  assert.equal(hasForegroundActivity(), false);
  markForegroundActivity({ id: "foreground_a", username: "viewer" });
  assert.equal(hasForegroundActivity(), true);
  assert.equal(isUserActive(), true);
  now += 2_500;
  assert.equal(isUserActive(), false);
  assert.equal(hasForegroundActivity(), true);
  now += 2_499;
  assert.equal(hasForegroundActivity(), true);
  now += 1;
  assert.equal(hasForegroundActivity(), false);
});

test("a second ping renews the lease without leaving an older lease behind", (t) => {
  preserveActivityState(t);
  let now = 2_000_000;
  t.mock.method(Date, "now", () => now);
  const user = { id: "foreground_renew", username: "viewer" };
  markForegroundActivity(user);
  now += 4_000;
  markForegroundActivity(user);
  now += 1_000;
  assert.equal(hasForegroundActivity(), true);
  now += 3_999;
  assert.equal(hasForegroundActivity(), true);
  now += 1;
  assert.equal(hasForegroundActivity(), false);
});

test("different user IDs retain independent leases even when their displayed names match", (t) => {
  preserveActivityState(t);
  let now = 3_000_000;
  t.mock.method(Date, "now", () => now);
  markForegroundActivity({ id: "foreground_first", username: "same_name" });
  now += 2_000;
  markForegroundActivity({ id: "foreground_second", username: "same_name" });
  now += 3_000;
  assert.equal(hasForegroundActivity(), true);
  assert.equal(activityGlobal.__movvizForegroundLeases?.has("foreground_first"), false);
  assert.equal(activityGlobal.__movvizForegroundLeases?.has("foreground_second"), true);
  now += 2_000;
  assert.equal(hasForegroundActivity(), false);
});

test("renewing one user's request cannot renew another user's lease", (t) => {
  preserveActivityState(t);
  let now = 4_000_000;
  t.mock.method(Date, "now", () => now);
  const first = { id: "foreground_a", username: "first" };
  markForegroundActivity(first);
  now += 1_000;
  markForegroundActivity({ id: "foreground_b", username: "second" });
  now += 3_000;
  markForegroundActivity(first);
  now += 2_000;
  assert.equal(hasForegroundActivity(), true);
  assert.equal(activityGlobal.__movvizForegroundLeases?.has("foreground_b"), false);
  assert.equal(activityGlobal.__movvizForegroundLeases?.has("foreground_a"), true);
  now += 3_000;
  assert.equal(hasForegroundActivity(), false);
});

test("ordinary interaction retains the existing activity window and creates no request lease", (t) => {
  preserveActivityState(t);
  let now = 5_000_000;
  t.mock.method(Date, "now", () => now);
  markUserActivity({ id: "foreground_click", username: "viewer" });
  assert.equal(isUserActive(), true);
  assert.equal(hasForegroundActivity(), false);
  now += 2_500;
  assert.equal(isUserActive(), false);
  assert.equal(hasForegroundActivity(), false);
});
