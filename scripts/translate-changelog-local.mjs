#!/usr/bin/env node
// One-time/local backfill of the public release history. Never sends release
// notes off the machine. Resumable checkpoints live in ignored dist/.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
const lines = source.split(/\r?\n/);
const locales = process.argv.slice(2).filter((arg) => ["en", "it", "nl", "de"].includes(arg));
if (!locales.length) throw new Error("Usage: node scripts/translate-changelog-local.mjs en|it|nl|de [...]");

const names = { en: "English", it: "Italian", nl: "Dutch", de: "German" };
const workDir = path.join(root, "dist", "changelog-translation-progress");
fs.mkdirSync(workDir, { recursive: true });

function batches() {
  const out = [];
  let current = [];
  let length = 0;
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    const nextLength = lines[index].length + 15;
    if (current.length && (current.length >= 28 || length + nextLength > 4500)) {
      out.push(current);
      current = [];
      length = 0;
    }
    current.push(index);
    length += nextLength;
  }
  if (current.length) out.push(current);
  return out;
}

const chunks = batches();

function validateLine(original, translated) {
  if (!translated || /^```/.test(translated)) return false;
  const structural = original.match(/^(#{1,3}\s+|-\s+|>\s+|\d+\.\s+)/)?.[0];
  if (structural && !translated.startsWith(structural)) return false;
  const version = original.match(/^##\s+(?:v|\[)?([\d.]+)/)?.[1];
  if (version && !translated.includes(version)) return false;
  return true;
}

async function translate(indices, locale, depth = 0) {
  const tagged = indices.map((index, i) => `[[[L${String(i).padStart(3, "0")}]]] ${lines[index]}`).join("\n");
  const prompt = `Translate every marked French line to ${names[locale]}. Return one corresponding marked line for each input line, in the same order. Copy each [[[Lnnn]]] marker exactly. Preserve Markdown syntax, version numbers, code identifiers, URLs, product names, and list structure. Translate all natural-language text, including dates. No introduction or commentary.\n\n${tagged}`;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gemma4:latest", stream: false, think: false, keep_alive: "30m", options: { temperature: 0, num_ctx: 8192, num_predict: 4000 }, prompt }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const result = await response.json();
    const text = String(result.response ?? "");
    const markers = [...text.matchAll(/\[\[\[L(\d{3})\]\]\]/g)];
    if (markers.length !== indices.length) throw new Error(`Expected ${indices.length} markers, got ${markers.length}`);
    const translated = markers.map((match, i) => {
      if (Number(match[1]) !== i) throw new Error(`Unexpected marker ${match[1]} at ${i}`);
      return text.slice(match.index + match[0].length, markers[i + 1]?.index ?? text.length).trim().replace(/\s*\n\s*/g, " ");
    });
    for (let i = 0; i < indices.length; i++) {
      if (!validateLine(lines[indices[i]], translated[i])) throw new Error(`Invalid structure at source line ${indices[i] + 1}: ${translated[i].slice(0, 80)}`);
    }
    return translated;
  } catch (error) {
    if (indices.length === 1) throw new Error(`${locale} line ${indices[0] + 1}: ${error.message}`, { cause: error });
    if (depth === 0) console.error(`${locale}: retrying smaller batch at line ${indices[0] + 1}: ${error.message}`);
    const mid = Math.floor(indices.length / 2);
    return [...await translate(indices.slice(0, mid), locale, depth + 1), ...await translate(indices.slice(mid), locale, depth + 1)];
  }
}

for (const locale of locales) {
  const progressFile = path.join(workDir, `${locale}.json`);
  const saved = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, "utf8")) : null;
  if (saved && saved.sourceHash !== sourceHash) throw new Error(`CHANGELOG.md changed since ${locale} translation began; remove ${progressFile} before retrying`);
  const translated = saved?.translated ?? Array(lines.length).fill(null);
  for (let n = 0; n < chunks.length; n++) {
    const indices = chunks[n];
    if (indices.every((index) => translated[index])) continue;
    const result = await translate(indices, locale);
    indices.forEach((index, i) => { translated[index] = result[i]; });
    fs.writeFileSync(progressFile, JSON.stringify({ sourceHash, translated }), "utf8");
    if ((n + 1) % 10 === 0 || n + 1 === chunks.length) console.log(`${locale}: ${n + 1}/${chunks.length} batches`);
  }
  if (translated.some((line, i) => lines[i].trim() && !line)) throw new Error(`${locale}: missing translated lines`);
  const output = lines.map((line, index) => {
    if (!line.trim()) return line;
    // Wrapped bullets and indented continuations must keep their indentation:
    // src/lib/changelog.ts joins them to the preceding item only when they do.
    const indent = line.match(/^\s*/)[0];
    return indent + translated[index].trimStart();
  }).join("\n");
  const target = path.join(root, `CHANGELOG.${locale}.md`);
  fs.writeFileSync(`${target}.tmp`, output, "utf8");
  fs.renameSync(`${target}.tmp`, target);
  console.log(`${locale}: complete -> ${target}`);
}
