import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReleaseName, posterPathFromUrl } from "@/lib/c411/resolve";
import { safeC411Origin, c411OriginFromBaseUrl } from "@/lib/c411/safeUrl";

// ── parseReleaseName ─────────────────────────────────────────────────────

test("movie release keeps clean title + year", () => {
  const p = parseReleaseName("Inception.2010.MULTI.1080p.BluRay.x264-EXCELLENCE");
  assert.equal(p.clean, "inception");
  assert.equal(p.year, 2010);
  assert.equal(p.kind, "movie");
});

test("series release with season+episode markers is a series", () => {
  const p = parseReleaseName("Disjointed.S01E05.MULTI.VF2.1080p.WEBRip.x264");
  assert.equal(p.clean, "disjointed");
  assert.equal(p.kind, "series");
});

test("season-only pack is a series", () => {
  const p = parseReleaseName("Breaking.Bad.S05.COMPLETE.MULTI.VOSTFR.720p.BluRay");
  assert.equal(p.clean, "breaking bad");
  assert.equal(p.kind, "series");
});

test("separators and French tags are stripped", () => {
  const p = parseReleaseName("Le.Chant.d.u.loup_VFQ.HDR10.UHD.2160p.WEB-DL");
  assert.equal(p.clean, "le chant d u loup");
  assert.equal(p.kind, "unknown"); // no year, no season marker
});

test("no year and no season marker stays unknown", () => {
  const p = parseReleaseName("Some.Obscure.Title.WEBRip.x264");
  assert.equal(p.kind, "unknown");
});

test("year keeps the first year found in the name", () => {
  const p = parseReleaseName("2012.Seal.Team.2021.E12");
  assert.equal(p.year, 2012);
});

test("'Pack' in a series name does not become a movie hint by itself", () => {
  const p = parseReleaseName("Twin.Peaks.S02.INTEGRALE.VFF");
  assert.equal(p.kind, "series");
});

// ── posterPathFromUrl ────────────────────────────────────────────────────

test("TMDb image URL becomes a relative path", () => {
  assert.equal(
    posterPathFromUrl("https://image.tmdb.org/t/p/w500/abc123.jpg"),
    "/abc123.jpg"
  );
  assert.equal(posterPathFromUrl("https://image.tmdb.org/t/p/original/xyz.png"), "/xyz.png");
});

test("null / malformed URLs return null", () => {
  assert.equal(posterPathFromUrl(null), null);
  assert.equal(posterPathFromUrl(""), null);
  assert.equal(posterPathFromUrl("https://example.com/no/tmdb/here.jpg"), null);
});

// ── safeC411Origin ───────────────────────────────────────────────────────

test("https public host passes", () => {
  assert.equal(safeC411Origin("https://c411.org"), "https://c411.org");
  assert.equal(safeC411Origin("https://c411.org/api"), "https://c411.org");
});

test("non-https schemes are rejected", () => {
  assert.equal(safeC411Origin("http://c411.org"), null);
  assert.equal(safeC411Origin("ftp://c411.org"), null);
});

test("private / loopback hosts are rejected", () => {
  assert.equal(safeC411Origin("https://localhost:9810"), null);
  assert.equal(safeC411Origin("https://127.0.0.1"), null);
  assert.equal(safeC411Origin("https://192.168.1.10"), null);
  assert.equal(safeC411Origin("https://10.0.0.5"), null);
  assert.equal(safeC411Origin("https://169.254.0.1"), null);
  assert.equal(safeC411Origin("https://172.16.4.1"), null);
  assert.equal(safeC411Origin("https://172.32.4.1"), null); // outside 172.16-31
});

test("credentials embedded in the URL are rejected", () => {
  assert.equal(safeC411Origin("https://user:pass@c411.org"), null);
});

test("malformed input is rejected", () => {
  assert.equal(safeC411Origin("c411.org"), null);
  assert.equal(safeC411Origin(""), null);
  assert.equal(safeC411Origin("https://"), null);
});

// ── c411OriginFromBaseUrl ────────────────────────────────────────────────

test("Torznab base URL derives the site origin", () => {
  assert.equal(c411OriginFromBaseUrl("https://c411.org/api"), "https://c411.org");
  assert.equal(c411OriginFromBaseUrl("https://c411.org/api/v1"), "https://c411.org");
});

test("unsafe base URL yields null", () => {
  assert.equal(c411OriginFromBaseUrl("http://c411.org/api"), null);
  assert.equal(c411OriginFromBaseUrl("https://10.0.0.1/api"), null);
});
