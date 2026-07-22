// Pulls the CHANGELOG.md section for the version in package.json and writes it
// to dist/release-notes.md, so the GitHub Release for a version tag shows the
// real French "for humans" notes instead of an auto-generated commit list.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const version = pkg.version;

const lines = readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8").split("\n");
const headerRe = /^##\s+\[([\d.]+)\]/;

let start = -1;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(headerRe);
  if (m && m[1] === version) {
    start = i;
    break;
  }
}

let notes;
if (start === -1) {
  notes = `Version ${version}.`;
} else {
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  notes = lines.slice(start + 1, end).join("\n").trim();
}

mkdirSync("dist", { recursive: true });
writeFileSync(path.join("dist", "release-notes.md"), notes + "\n", "utf8");
console.log(`Notes de version extraites pour ${version} :\n${notes}`);
