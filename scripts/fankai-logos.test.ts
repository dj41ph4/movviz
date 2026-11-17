import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePng, encodePng, lightenDarkLogo, opaqueLuminance } from "@/lib/metadata/pngLogoTint";
import { entryForPackFolder, type FankaiEntry } from "@/lib/metadata/fankai";

/** A width×height RGBA PNG: left half `ink`, right half transparent. */
function logo(ink: [number, number, number], width = 8, height = 4, opaque = false): Buffer {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    const inked = opaque || x < width / 2;
    rgba[o] = inked ? ink[0] : 255; rgba[o + 1] = inked ? ink[1] : 255; rgba[o + 2] = inked ? ink[2] : 255;
    rgba[o + 3] = inked || opaque ? 255 : 0;
  }
  return encodePng({ width, height, rgba });
}

test("PNG encode/decode round trip", () => {
  const png = logo([10, 120, 200]);
  const decoded = decodePng(png)!;
  assert.equal(decoded.width, 8);
  assert.equal(decoded.height, 4);
  assert.deepEqual([...decoded.rgba.subarray(0, 4)], [10, 120, 200, 255]);
  assert.equal(decoded.rgba[4 * 7 + 3], 0);
});

test("a black logo on transparency turns white, keeping its shape", () => {
  const out = lightenDarkLogo(logo([0, 0, 0]));
  const decoded = decodePng(out)!;
  assert.deepEqual([...decoded.rgba.subarray(0, 4)], [255, 255, 255, 255]);
  assert.equal(decoded.rgba[4 * 7 + 3], 0, "transparent pixels stay transparent");
  assert.ok(opaqueLuminance(decoded)! > 250);
});

test("colored, light or boxed logos are left untouched", () => {
  for (const png of [logo([200, 30, 30]), logo([240, 240, 240]), logo([0, 0, 0], 8, 4, true)]) {
    assert.equal(lightenDarkLogo(png), png);
  }
  const notPng = Buffer.from("<!DOCTYPE html>");
  assert.equal(lightenDarkLogo(notPng), notPng);
});

function entry(title: string, page = title, aliases: string[] = []): FankaiEntry {
  return { id: title.length, page, title, baseTitle: title, aliases, fiche: {} as FankaiEntry["fiche"], synopsis: "", parts: [], parentTmdbId: null };
}

test("pack folders find their version", () => {
  const entries = [
    entry("Death Note Kaï", "Death Note Kai"), entry("Death Note Kaï (Roro)"),
    entry("Hunter x Hunter (2011) Kaï"), entry("Hunter x Hunter (1999) Kaï"),
    entry("Naruto Yabai (Triggerforce)"), entry("Naruto Shippuden Yabai (Triggerforce)"),
    entry("GTO Kaï"), entry("Dragon Ball GT FAN-CUT"),
  ];
  const title = (folder: string) => entryForPackFolder(folder, entries)?.entry.title ?? null;
  assert.equal(title("Death Note Kaï"), "Death Note Kaï");
  assert.equal(title("Hunter x Hunter Kaï (2011)"), "Hunter x Hunter (2011) Kaï");
  assert.equal(title("Hunter x Hunter Kaï (1999)"), "Hunter x Hunter (1999) Kaï");
  assert.equal(title("Naruto Yabai"), "Naruto Yabai (Triggerforce)");
  assert.equal(title("Naruto Shippuden Yabai"), "Naruto Shippuden Yabai (Triggerforce)");
  assert.equal(title("Dragon Ball GT Fan-Cut"), "Dragon Ball GT FAN-CUT");
  assert.equal(entryForPackFolder("GTO Kaï", entries)?.exact, true);
  assert.equal(entryForPackFolder("GTO Kai (Autres langues)", entries)?.exact, false);
  assert.equal(title("One Piece Kaï"), null);
});
