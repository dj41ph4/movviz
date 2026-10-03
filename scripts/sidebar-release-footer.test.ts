import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SidebarReleaseFooterProps } from "../src/components/layout/SidebarReleaseFooter";

// Render the actual TSX component with React, without extending the test loader.
const source = readFileSync(new URL("../src/components/layout/SidebarReleaseFooter.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const componentModule = { exports: {} as { SidebarReleaseFooter: ComponentType<SidebarReleaseFooterProps> } };
vm.runInNewContext(compiled, { module: componentModule, exports: componentModule.exports, require: createRequire(import.meta.url) });
const Footer = componentModule.exports.SidebarReleaseFooter;
const base: SidebarReleaseFooterProps = {
  version: "1.25.166", collapsed: false, installing: false, onInstall: () => {},
  labels: { currentVersion: "Version actuelle : 1.25.166", available: "Mise à jour 1.25.167 disponible", install: "Installer 1.25.167", inProgress: "Mise à jour en cours", upToDate: "À jour" },
};
const render = (props: Partial<SidebarReleaseFooterProps> = {}) => renderToStaticMarkup(createElement(Footer, { ...base, ...props }));

test("installed version remains visible and links to About for every user", () => {
  const html = render();
  assert.match(html, /Movviz v1\.25\.166/);
  assert.match(html, /href="\/settings\?tab=about"/);
  assert.match(html, /aria-label="Version actuelle : 1\.25\.166"/);
  assert.doesNotMatch(html, /<button|Installer|À jour/);
});

test("compact rail still displays the exact installed version", () => {
  const html = render({ collapsed: true });
  assert.match(html, />v1\.25\.166<\/a>/);
  assert.doesNotMatch(html, /Movviz v/);
});

test("Windows and native Linux offer installation while NAS only offers instructions", () => {
  for (const platform of ["win32", "linux"]) {
    const html = render({ updateInfo: { platform, oneClickSupported: true, latestVersion: "1.25.167", updateAvailable: true } });
    assert.match(html, /<button/); assert.match(html, /Installer 1\.25\.167/);
  }
  const nas = render({ updateInfo: { platform: "linux", oneClickSupported: false, latestVersion: "1.25.167", updateAvailable: true } });
  assert.doesNotMatch(nas, /<button/);
  assert.match(nas, /Mise à jour 1\.25\.167 disponible/);
  assert.equal((nas.match(/href="\/settings\?tab=about"/g) ?? []).length, 2);
});

test("compact update action remains accessible and installation disables duplicate clicks", () => {
  const html = render({ collapsed: true, installing: true, updateInfo: { platform: "win32", latestVersion: "1.25.167", updateAvailable: true } });
  assert.match(html, /<button[^>]*disabled=""/);
  assert.match(html, /aria-label="Mise à jour en cours"/);
  assert.match(html, /animate-spin/);
});

test("unavailable release checks never falsely report up to date", () => {
  assert.doesNotMatch(render({ updateInfo: { platform: "linux", latestVersion: null, updateAvailable: false } }), /À jour/);
  assert.match(render({ updateInfo: { platform: "linux", latestVersion: null, updateAvailable: false, releaseUrl: "https://github.com/dj41ph4/movviz/releases/tag/v1.25.166" } }), /À jour/);
});

test("release footer stays outside navigation and only admin receives update data", () => {
  const sidebar = readFileSync(new URL("../src/components/layout/Sidebar.tsx", import.meta.url), "utf8");
  assert.ok(sidebar.indexOf("<SidebarReleaseFooter") > sidebar.indexOf("</nav>"));
  assert.match(sidebar, /updateInfo=\{user\?\.role === "admin" \? updateInfo : undefined\}/);
  assert.match(sidebar, /flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto/);
  assert.doesNotMatch(sidebar, /version: _version/);
});
