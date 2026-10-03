// Pulls the CHANGELOG.md section for the version in package.json and writes it
// to dist/release-notes.md, so the GitHub Release for a version tag shows the
// real French "for humans" notes instead of an auto-generated commit list.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const version = pkg.version;

const lines = readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8").split("\n");
const headerRe = /^##\s+(?:v|\[)?([\d.]+)(?:\])?(?:\s|$)/;

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
  throw new Error(`CHANGELOG.md : notes manquantes pour la version ${version}`);
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

if (!/^###\s+.+/m.test(notes) || !/^-\s+\S/m.test(notes)) throw new Error(`CHANGELOG.md : notes vides pour ${version}`);
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
if (lock.version !== version || lock.packages?.[""]?.version !== version) throw new Error("Version du lockfile incohérente");
if (!readFileSync("README.md", "utf8").includes(`Version actuelle : v${version}</strong>`)) throw new Error("Version du README incohérente");
if (process.argv.includes("--check")) {
  console.log(`Notes et versions vérifiées : ${version}`);
  process.exit(0);
}

mkdirSync("dist", { recursive: true });
writeFileSync(path.join("dist", "release-notes.md"), notes + "\n", "utf8");
console.log(`Notes de version extraites pour ${version} :\n${notes}`);
