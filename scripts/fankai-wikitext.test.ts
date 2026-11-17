import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FANKAI_ID_MAX, FANKAI_ID_MIN, fankaiBaseTitle, fankaiDisplayTitle, fankaiIdFor, hasFanMarker, isFankaiId,
  parseFankaiPage, parseFankaiReleaseName, parseRedirect, splitTemplateArgs,
} from "@/lib/metadata/fankaiWikitext";
import { parseRelease } from "@/lib/naming/parser";
import { fanReleaseName, fanVersionConflict, releaseTitleMatches, releaseYearTarget, seriesNeedsReleaseYear, seriesSearchTitles, seriesYearIsCompatible } from "@/lib/library/matching";

// Shapes of real Fan-Kai pages (fan-kai.fandom.com/fr), texts shortened.
const DEATH_NOTE = `{{Fiche_Série|image1=Death note kai affiche.png|kaieur=[https://fan-kai.fandom.com/fr/wiki/Cat%C3%A9gorie:Odji-san Odji-san]|type=[https://fan-kai.fandom.com/fr/wiki/Lexique Kai]|statut=Terminé|source=Manga|épisodes=37|films=6|qualité=1080p|al_-_mal=[https://anilist.co/anime/1535/DEATH-NOTE AL] {{!}} [https://myanimelist.net/anime/1535/Death_Note MAL]|langue(s)=Multi-dubs (FR,EN)
Multi-subs (FR,EN)|temps-kai=11h20
14h48}}Un étudiant trouve un carnet qui tue.
{| class="fandom-table"
!FILMS
!ÉPISODES
!CHAPITRES
!DURÉE
!AFFICHES
|-
| {{Resume|1 - Light vs L Partie 1|Light découvre le cahier.|1}}
|1-5
|1-9
|01h29
|[[Fichier:Death note kai affiche 01.png|sans_cadre]]
|-
|{{Resume|2 - Light vs L Partie 2|Une femme au poste [[Kira|de police]].|2}}
|5-10
|11-22
|01h46
|[[Fichier:Death note kai affiche 02.png|sans_cadre]]
|}
[[Catégorie:Kai]]`;

// Bleach Yabai: sagas on the left with rowspans, CHAPITRES before ÉPISODES, progress column.
const BLEACH_YABAI = `{{Fiche_Série|image1=Bleach yabai affiche.png|type=Yabai|statut=En cours|al_-_mal=[https://myanimelist.net/anime/269/Bleach MAL]}}
Un lycéen voit les fantômes.
__TOC__
{| class="fandom-table"

!SAGAS
!ARCS
!FILMS
!CHAPITRES
!ÉPISODES
!DURÉE
!AFFICHES
!AVANCEMENT
|-
| colspan="2" rowspan="2" |
== Shinigami remplaçant ==
|{{Resume|1 - Death and Strawberry|Ichigo rencontre Rukia.|1}}
|1-6
|1-3
|00h52
|[[Fichier:Bleach yabai affiche 01.png|sans_cadre]]
|✅
|-
|{{Resume|2 - Memories in the rain|Sado et la perruche.|2}}
|7-25
|4-9
|01h42
|[[Fichier:Bleach yabai affiche 02.png|sans_cadre]]
|⌚
|}`;

// Naruto Kai (Mixouille): no Resume template, h:mm:ss durations, separator rows.
const NARUTO = `{{Fiche_Série|image1=Naruto kai affiche.webp|type=Kai|statut=Terminé}}Un ninja.
{| class="fandom-table"
!SAGAS
!ARCS
!FILMS
!EPISODES
!DURÉE
|-
| colspan="2" |
== Introduction ==
|1 - Ninja à tout prix
|1-5
|1:25:22
|-
| colspan="2" |
----<br />
|26
| HORS-SERIE
|-
| rowspan="2" |2e épreuve
|No. 2 - Orochimaru
|27-32
11-12
|1:34:49
|}`;

// One Piece Kai: the page carries a second version's table, numbered from 1 again.
const TWO_VERSIONS = `{{Fiche_Série|type=Kai}}
{| class="fandom-table"
!FILMS
!EPISODES
!DURÉE
|-
|{{Resume|1 - Romance Dawn|A.|1}}
|1-3
|01h00
|-
|{{Resume|2 - Orange|B.|2}}
|4-8
|01h10
|}
{| class="fandom-table"
!FILMS
!EPISODES
!DURÉE
|-
|{{Resume|1 - Autre version|C.|1}}
|1-4
|01h20
|}`;

test("Fiche_Série: kaieur, type, MAL/AniList ids and multi-line fields", () => {
  const page = parseFankaiPage(DEATH_NOTE)!;
  assert.equal(page.fiche.posterFile, "Death note kai affiche.png");
  assert.equal(page.fiche.kaieur, "Odji-san");
  assert.equal(page.fiche.kind, "Kai");
  assert.equal(page.fiche.malId, 1535);
  assert.equal(page.fiche.anilistId, 1535);
  assert.equal(page.fiche.originalEpisodes, 37);
  assert.equal(page.fiche.languages, "Multi-dubs (FR,EN) · Multi-subs (FR,EN)");
  assert.equal(page.synopsis, "Un étudiant trouve un carnet qui tue.");
});

test("parts: number, title, synopsis without markup, ranges, runtime, poster", () => {
  const { parts } = parseFankaiPage(DEATH_NOTE)!;
  assert.deepEqual(parts.map((p) => [p.number, p.title, p.episodes, p.chapters, p.runtime, p.posterFile]), [
    [1, "Light vs L Partie 1", "1-5", "1-9", 89, "Death note kai affiche 01.png"],
    [2, "Light vs L Partie 2", "5-10", "11-22", 106, "Death note kai affiche 02.png"],
  ]);
  assert.equal(parts[1].synopsis, "Une femme au poste de police.");
});

test("columns are read from the table's headers, whatever their order", () => {
  const { parts, synopsis } = parseFankaiPage(BLEACH_YABAI)!;
  assert.equal(synopsis, "Un lycéen voit les fantômes.");
  assert.equal(parts[0].chapters, "1-6");
  assert.equal(parts[0].episodes, "1-3");
  assert.equal(parts[0].released, true);
  // ⌚ = « en check » on the wiki's legend: not out yet.
  assert.equal(parts[1].released, false);
});

test("rows without the Resume template, clock durations and rowspan prefixes", () => {
  const { parts } = parseFankaiPage(NARUTO)!;
  assert.deepEqual(parts.map((p) => [p.number, p.title, p.episodes, p.runtime]), [
    [1, "Ninja à tout prix", "1-5", 85],
    [2, "Orochimaru", "27-32, 11-12", 95],
  ]);
});

test("a second table numbered from 1 again is another version and is left out", () => {
  assert.deepEqual(parseFankaiPage(TWO_VERSIONS)!.parts.map((p) => p.title), ["Romance Dawn", "Orange"]);
});

test("redirections and template arguments", () => {
  assert.equal(parseRedirect("#REDIRECTION [[Death Note Kai]]"), "Death Note Kai");
  assert.equal(parseRedirect("{{Fiche_Série}}"), null);
  assert.deepEqual(splitTemplateArgs("a|[[b|c]]|{{d|e}}"), ["a", "[[b|c]]", "{{d|e}}"]);
  assert.equal(parseFankaiPage("Une page sans fiche."), null);
});

test("titles: shown title, series it comes from, fan marker", () => {
  assert.equal(fankaiDisplayTitle("Death Note Kai"), "Death Note Kaï");
  assert.equal(fankaiDisplayTitle("Dragon Ball GT FAN/CUT"), "Dragon Ball GT FAN-CUT");
  assert.equal(fankaiBaseTitle("Death Note Kaï (Roro)"), "Death Note");
  assert.equal(fankaiBaseTitle("Bleach Yabai"), "Bleach");
  assert.equal(fankaiBaseTitle("One Piece Kai Ultime Pack"), "One Piece");
  for (const t of ["Death Note Kaï", "Bleach Yabai", "Demon Slayer Henshū", "Lastman FAN-CUT", "Dragon Ball Z Recut", "Naruto Kai (Mixouille)"]) assert.ok(hasFanMarker(t), t);
  for (const t of ["Jujutsu Kaisen", "Boku no Kokoro no Yabai Yatsu", "Kaiji", "Death Note", "Kai"]) assert.equal(hasFanMarker(t), t === "Kai", t);
});

test("ids: stable, in the reserved range, within a 32-bit Int", () => {
  const id = fankaiIdFor("Death Note Kai");
  assert.equal(id, fankaiIdFor("Death Note Kai"));
  assert.ok(id >= FANKAI_ID_MIN && id <= FANKAI_ID_MAX && FANKAI_ID_MAX < 2 ** 31);
  assert.ok(isFankaiId(id));
  assert.equal(isFankaiId(13916), false);
  assert.notEqual(fankaiIdFor("Death Note Kai"), fankaiIdFor("Death Note Kaï (Roro)"));
});

test("Fan-Kai file and torrent names", () => {
  assert.deepEqual(parseFankaiReleaseName("[Odji-san] Death Note Kaï - 01 - Light vs L Partie 1 1080p Multi x264.mkv"), { title: "Death Note Kaï", part: 1 });
  assert.deepEqual(parseFankaiReleaseName("One Piece Yabai - 008 - La Route de tous les Périls - 1080p.MULTI.x264 [Mixouille].mkv"), { title: "One Piece Yabai", part: 8 });
  assert.deepEqual(parseFankaiReleaseName("[Odji-san] Death Note Kaï 1080p Multi x264"), { title: "Death Note Kaï", part: null });
  assert.deepEqual(parseFankaiReleaseName("Bleach.Yabai.Integrale.MULTI.1080p"), { title: "Bleach Yabai", part: null });
  assert.equal(parseFankaiReleaseName("Jujutsu Kaisen - 01 - Ryomen Sukuna 1080p"), null);
  assert.equal(parseFankaiReleaseName("Death.Note.S01E01.1080p.MULTI"), null);
});

test("the release parser reads a part as season 1, episode N", () => {
  const part = parseRelease("[Odji-san] Death Note Kaï - 03 - Second Kira 1080p Multi x264.mkv");
  assert.equal(part.title, "Death Note Kaï");
  assert.equal(part.season, 1);
  assert.equal(part.episode, 3);
  assert.equal(part.resolution, "1080p");
  const pack = parseRelease("[Odji-san] Death Note Kaï 1080p Multi x264");
  assert.equal(pack.isCompletePack, true);
  assert.equal(pack.episode, null);
  // Unchanged for everything else.
  const scene = parseRelease("Death.Note.S01E03.1080p.MULTI.x264-GRP");
  assert.deepEqual([scene.title, scene.season, scene.episode], ["Death Note", 1, 3]);
});

test("a fan version and its series never take each other's releases", () => {
  assert.equal(releaseTitleMatches("Death Note Kaï", "Death Note"), false);
  assert.equal(releaseTitleMatches("Death Note", "Death Note Kaï"), false);
  assert.equal(releaseTitleMatches("Death Note Kai", "Death Note Kaï"), true);
  assert.equal(releaseTitleMatches("Death Note", "Death Note"), true);
  assert.equal(fanVersionConflict("Dragon Ball Z Kai", ["Dragon Ball Z Kai"]), false);
  assert.equal(fanVersionConflict("Jujutsu Kaisen", ["Jujutsu Kaisen"]), false);
});

test("the match worker mirrors the Fan-Kai reading", () => {
  const worker = readFileSync(resolve(import.meta.dirname, "../src/lib/workers/releaseMatchWorker.mjs"), "utf8");
  const source = readFileSync(resolve(import.meta.dirname, "../src/lib/metadata/fankaiWikitext.ts"), "utf8");
  const marker = source.match(/const FAN_MARKER = (.+);/)![1];
  assert.ok(worker.includes(`const FAN_MARKER = ${marker};`), "same marker");
  assert.ok(worker.includes("if (fanVersionConflict(parsedTitle, candidates)) return false;"));
  assert.ok(/function parseRelease\(rawName\) \{\s+const info = parseReleaseBase\(rawName\);/.test(worker));
});

test("indexer packs carrying the original anime's year (live names, C411 and Tr4ker)", () => {
  assert.deepEqual(parseFankaiReleaseName("Naruto.Yabai.2002.INTEGRALE.MULTi.VFF.1080p.WEB.AAC.2.0.x264-FanKai"), { title: "Naruto Yabai", part: null });
  assert.deepEqual(parseFankaiReleaseName("Naruto.Shippuden.Yabai.2007.INTEGRALE.MULTi.VFF.1080p.BluRay.HDLight.AAC.2.0.x264-FanKai"), { title: "Naruto Shippuden Yabai", part: null });
  assert.deepEqual(parseFankaiReleaseName("Naruto.Yabai.iNTEGRALE.MULTi.1080p.BluRay.AAC.2.0.x264-FANKAI"), { title: "Naruto Yabai", part: null });
  assert.deepEqual(parseFankaiReleaseName("Death Note Kaï 2006 - 03 - Second Kira 1080p"), { title: "Death Note Kaï", part: 3 });
  // A year never turns an ordinary title into a fan version.
  assert.equal(parseFankaiReleaseName("Jujutsu.Kaisen.2020.INTEGRALE.MULTi.1080p"), null);
  assert.equal(releaseTitleMatches("Naruto Shippuden Yabai", "Naruto Yabai (Triggerforce)"), false);
  assert.equal(releaseTitleMatches("Naruto Yabai", "Naruto Yabai (Triggerforce)"), true);
});

test("a fan version is searched under its bare name, with no year check", () => {
  const naruto = { tmdbId: fankaiIdFor("Naruto Yabai (Triggerforce)"), title: "Naruto Yabai (Triggerforce)", year: 2023, aliases: [] };
  assert.deepEqual(seriesSearchTitles(naruto), ["Naruto Yabai"]);
  assert.equal(releaseYearTarget(naruto), null);
  assert.equal(seriesNeedsReleaseYear(naruto, [{ tmdbId: 46260, title: "Naruto Yabai (Triggerforce)", year: 2002 }]), false);
  assert.equal(seriesYearIsCompatible("2002", releaseYearTarget(naruto), false), true);
  // Unchanged for TMDb series.
  assert.deepEqual(seriesSearchTitles({ tmdbId: 46260, title: "Naruto", originalTitle: "NARUTO -ナルト-", aliases: [] }), ["Naruto"]);
  assert.equal(releaseYearTarget({ tmdbId: 46260, year: 2002 }), 2002);
  assert.equal(fanReleaseName("Death Note Kaï (Roro)"), "Death Note Kaï");
});
