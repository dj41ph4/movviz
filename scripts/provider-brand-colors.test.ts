import test from "node:test";
import assert from "node:assert/strict";
import { PROVIDER_BRAND_RGB, PROVIDER_SVG } from "@/lib/metadata/providerSvg";

test("chaque plateforme avec un logo local a une couleur de marque valide pour le halo et la bannière", () => {
  for (const id of Object.keys(PROVIDER_SVG).map(Number)) {
    const rgb = PROVIDER_BRAND_RGB[id];
    assert.ok(rgb, `couleur de marque manquante pour la plateforme ${id}`);
    const parts = rgb.split(",").map(Number);
    assert.equal(parts.length, 3, `format R,G,B attendu pour ${id}`);
    assert.ok(parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255), `canaux 0-255 pour ${id}`);
  }
});
