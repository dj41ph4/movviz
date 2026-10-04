import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import { widgetZip } from "./zip.mjs";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(moduleRoot, "..");
const version = JSON.parse(await fs.readFile(path.join(repo, "package.json"), "utf8")).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid app version");
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${version}`) throw new Error("Tag and package.json versions differ");
const source = path.join(moduleRoot, "src/app.ts");
const options = { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, strict: true, skipLibCheck: true, noEmit: true, types: [], lib: ["lib.es2020.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"] };
const program = ts.createProgram([source], options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => repo, getNewLine: () => "\n" }));
  process.exit(1);
}
const js = ts.transpileModule(await fs.readFile(source, "utf8"), { compilerOptions: { ...options, noEmit: false } }).outputText;
const translationKeys = [...(await fs.readFile(source, "utf8")).matchAll(/\bt\("([a-zA-Z0-9.]+)"\)/g)].map(match => match[1]);
const dictionaries = {};
for (const locale of ["fr", "en", "de", "it", "nl"]) {
  const input = await fs.readFile(path.join(repo, `src/i18n/locales/${locale}.ts`), "utf8");
  const exports = {};
  runInNewContext(ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports });
  const dictionary = exports[locale]; dictionaries[locale] = dictionary;
  for (const key of Object.keys(dictionaries.fr.tizen)) {
    if (typeof dictionary.tizen[key] !== "string") throw new Error(`Missing ${locale} translation: tizen.${key}`);
  }
  for (const key of translationKeys) {
    const value = key.split(".").reduce((node, part) => node?.[part], dictionary);
    if (typeof value !== "string") throw new Error(`Missing ${locale} translation: ${key}`);
  }
}
const files = new Map();
for (const name of ["index.html", "style.css", "config.xml"]) files.set(name, await fs.readFile(path.join(moduleRoot, name)));
files.set("config.xml", Buffer.from(files.get("config.xml").toString().replace('version="1.0.0"', `version="${version}"`)));
files.set("app.js", Buffer.from(js));
files.set("locales.js", Buffer.from(`window.MovvizLocales=${JSON.stringify(dictionaries)};window.MOVVIZ_VERSION=${JSON.stringify(version)};\n`));
files.set("icon.png", await fs.readFile(path.join(repo, "public/brand/movviz-mark.png")));
files.set("Roboto-Regular.ttf", await fs.readFile(path.join(moduleRoot, "assets/Roboto-Regular.ttf")));
files.set("Roboto-LICENSE.txt", await fs.readFile(path.join(moduleRoot, "assets/Roboto-LICENSE.txt")));
files.set("qrcode.js", await fs.readFile(path.join(repo, "node_modules/qrcode-generator/dist/qrcode.js")));
files.set("qrcode-LICENSE.txt", await fs.readFile(path.join(moduleRoot, "assets/qrcode-LICENSE.txt")));
const build = path.join(moduleRoot, "build"), dist = path.join(moduleRoot, "dist");
await fs.mkdir(build, { recursive: true }); await fs.mkdir(dist, { recursive: true });
for (const [name, data] of files) await fs.writeFile(path.join(build, name), data);
const archive = widgetZip(files), filename = "Movviz-Samsung-Tizen-client-unsigned.wgt";
await fs.writeFile(path.join(dist, filename), archive);
await fs.writeFile(path.join(dist, `${filename}.sha256`), `${createHash("sha256").update(archive).digest("hex")}  ${filename}\n`);
process.stdout.write(`Movviz Samsung Tizen ${version}: typecheck OK, ${files.size} files, ${archive.length} bytes (unsigned).\n`);
