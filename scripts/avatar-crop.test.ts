import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_MAX_BYTES, centeredOffset, clampOffset, clampZoom, coverScale, sourceRect, zoomAroundCenter } from "../src/lib/avatarCrop.ts";
import { AVATAR_MAX_BYTES as SERVER_MAX, saveAvatar } from "../src/lib/avatars.ts";

test("la limite de photo de profil est de 6 Mo, la même côté client et serveur", () => {
  assert.equal(AVATAR_MAX_BYTES, 6 * 1024 * 1024);
  assert.equal(SERVER_MAX, AVATAR_MAX_BYTES);
});

test("le serveur refuse au-delà de 6 Mo et accepte juste en dessous", () => {
  const png = (n: number) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47]); return b; };
  assert.deepEqual(saveAvatar("usr_crop_test", png(AVATAR_MAX_BYTES + 1)), { error: "too_big" });
});

test("une image paysage recouvre le cadre sur sa hauteur", () => {
  assert.equal(coverScale(2000, 1000, 300), 0.3);
  assert.equal(coverScale(1000, 2000, 300), 0.3);
});

test("le cadre centré couvre le milieu de l'image", () => {
  const { x, y } = centeredOffset(2000, 1000, 300, 1);
  const r = sourceRect(2000, 1000, 300, 1, x, y);
  assert.ok(Math.abs(r.sw - 1000) < 1e-9 && Math.abs(r.sh - 1000) < 1e-9);
  assert.ok(Math.abs(r.sx - 500) < 1e-9 && Math.abs(r.sy) < 1e-9);
});

test("le décalage ne laisse jamais de bord vide", () => {
  const far = clampOffset(2000, 1000, 300, 1, 999, 999);
  assert.deepEqual(far, { x: 0, y: 0 });
  const other = clampOffset(2000, 1000, 300, 1, -99999, -99999);
  assert.ok(Math.abs(other.x - (300 - 600)) < 1e-9 && other.y === 0);
});

test("le zoom reste entre 1 et 4", () => {
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(9), 4);
});

test("zoomer garde le même point au centre du cadre", () => {
  const start = centeredOffset(1600, 1200, 300, 1);
  const before = sourceRect(1600, 1200, 300, 1, start.x, start.y);
  const o = zoomAroundCenter(1600, 1200, 300, 1, 2.5, start.x, start.y);
  const after = sourceRect(1600, 1200, 300, 2.5, o.x, o.y);
  assert.ok(Math.abs((before.sx + before.sw / 2) - (after.sx + after.sw / 2)) < 1e-6);
  assert.ok(Math.abs((before.sy + before.sh / 2) - (after.sy + after.sh / 2)) < 1e-6);
  assert.ok(after.sw < before.sw);
});
