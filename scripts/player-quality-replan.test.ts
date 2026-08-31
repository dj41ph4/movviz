import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const source = fs.readFileSync("src/components/player/VideoPlayer.tsx", "utf8");

test("desktop unified prepare carries the active quality", () => {
  assert.match(source, /quality: overrides\.quality \?\? toPlannerQuality\(qualityRef\.current\)/);
  assert.match(source, /quality: toPlannerQuality\(qualityRef\.current\)/);
});

test("normal quality changes restart the unified engine with a planner quality override", () => {
  assert.match(source, /tryStartUnifiedEngineRef\.current\?\.\(position > 0 \? position : undefined, \{/);
  assert.match(source, /quality: toPlannerQuality\(preset\.quality\)/);
});
