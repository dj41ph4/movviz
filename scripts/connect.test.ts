import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCommand, parseRegistration, parseState } from "../src/lib/connect/types.ts";
import { attachStream, getDevice, listDevices, registerDevice, removeDevice, reportState, sendCommand } from "../src/lib/connect/registry.ts";
import { eventBus } from "../src/lib/events/EventBus.ts";

const reg = (id: string, over: Record<string, unknown> = {}) => ({ id, name: "Salon", kind: "tv" as const, receiver: true, ...over });

test("parseRegistration refuse un identifiant ou un type invalide", () => {
  assert.ok(parseRegistration({ id: "abcdefgh12", name: "Salon", kind: "tv", receiver: true }));
  assert.equal(parseRegistration({ id: "court", name: "Salon", kind: "tv" }), null);
  assert.equal(parseRegistration({ id: "abcdefgh12", name: "Salon", kind: "frigo" }), null);
  assert.equal(parseRegistration({ id: "abcdefgh12", name: "   ", kind: "tv" }), null);
  assert.equal(parseRegistration({ id: "abc defgh12", name: "x", kind: "tv" }), null);
});

test("parseCommand valide chaque ordre et borne les valeurs", () => {
  assert.deepEqual(parseCommand({ kind: "pause" }), { kind: "pause" });
  assert.deepEqual(parseCommand({ kind: "seek", seconds: 12.34 }), { kind: "seek", seconds: 12.3 });
  assert.equal(parseCommand({ kind: "seek", seconds: -1 })?.kind, "seek");
  assert.equal(parseCommand({ kind: "seek", seconds: "x" }), null);
  assert.equal(parseCommand({ kind: "format" }), null);
  const play = parseCommand({ kind: "play", title: " Dune ", mediaType: "movie", tmdbId: 438631, resumeSeconds: 90, junk: 1 });
  assert.deepEqual(play, { kind: "play", title: "Dune", mediaType: "movie", tmdbId: 438631, resumeSeconds: 90 });
  // Série : saison et épisode vont ensemble.
  assert.equal(parseCommand({ kind: "play", title: "X", mediaType: "series", tmdbId: 1, season: 1 }), null);
  assert.ok(parseCommand({ kind: "play", title: "X", mediaType: "series", tmdbId: 1, season: 1, episode: 2 }));
  assert.equal(parseCommand({ kind: "play", title: "X", mediaType: "movie", tmdbId: 0 })?.kind, "play");
  assert.equal(parseCommand({ kind: "play", title: "", mediaType: "movie", tmdbId: 5 }), null);
});

test("parseState normalise l'état rapporté", () => {
  const s = parseState({ status: "playing", title: "A", position: 10.06, duration: 3600, tmdbId: 3 });
  assert.equal(s?.status, "playing");
  assert.equal(s?.position, 10.1);
  assert.equal(parseState({ status: "dancing" }), null);
});

test("un appareil enregistré est listé pour son utilisateur seulement", () => {
  registerDevice("u1", reg("device-aaa1"));
  assert.equal(listDevices("u1").length >= 1, true);
  assert.equal(listDevices("u2").some((d) => d.id === "device-aaa1"), false);
  assert.equal(getDevice("u2", "device-aaa1"), null);
  removeDevice("u1", "device-aaa1");
  assert.equal(getDevice("u1", "device-aaa1"), null);
});

test("un ordre n'atteint que l'appareil visé, et seulement un récepteur", () => {
  registerDevice("u1", reg("device-bbb1"));
  registerDevice("u1", reg("device-bbb2", { receiver: false, kind: "mobile" }));
  const seen: string[] = [];
  const off = eventBus.on((e) => { if (e.type === "connect_command") seen.push(e.targetId); });
  assert.equal(sendCommand("u1", "device-bbb1", { kind: "pause" }), true);
  assert.equal(sendCommand("u1", "device-bbb2", { kind: "pause" }), false);
  assert.equal(sendCommand("u2", "device-bbb1", { kind: "pause" }), false);
  assert.equal(sendCommand("u1", "device-inconnu", { kind: "pause" }), false);
  off();
  assert.deepEqual(seen, ["device-bbb1"]);
});

test("un identifiant déjà pris par un autre compte n'est pas récupérable", () => {
  registerDevice("u1", reg("device-ccc1"));
  reportState("u1", "device-ccc1", { status: "playing", position: 5, duration: 10, updatedAt: 1 });
  registerDevice("u2", reg("device-ccc1", { name: "Autre" }));
  assert.equal(getDevice("u1", "device-ccc1"), null);
  assert.equal(getDevice("u2", "device-ccc1")?.state, null);
  assert.equal(reportState("u1", "device-ccc1", { status: "idle", position: 0, duration: 0, updatedAt: 2 }), false);
});

test("l'état rapporté est conservé et diffusé ; idle remet les compteurs à zéro", () => {
  registerDevice("u3", reg("device-ddd1"));
  const states: string[] = [];
  const off = eventBus.on((e) => { if (e.type === "connect_state") states.push(e.state.status); });
  reportState("u3", "device-ddd1", { status: "playing", title: "A", position: 42, duration: 100, updatedAt: 1 });
  assert.equal(getDevice("u3", "device-ddd1")?.state?.position, 42);
  reportState("u3", "device-ddd1", { status: "idle", position: 42, duration: 100, updatedAt: 2 });
  assert.equal(getDevice("u3", "device-ddd1")?.state?.position, 0);
  off();
  assert.deepEqual(states, ["playing", "idle"]);
});

test("un flux ouvert garde l'appareil en ligne ; la fermeture est sans danger répétée", () => {
  registerDevice("u4", reg("device-eee1"));
  const close = attachStream("u4", "device-eee1");
  assert.equal(getDevice("u4", "device-eee1")?.online, true);
  close();
  close();
  assert.equal(getDevice("u4", "device-eee1")?.online, true);
});

test("attente longue : un ordre réveille l'appareil qui l'attend, rien d'ancien n'est rejoué", async () => {
  const { waitCommands } = await import("../src/lib/connect/registry.ts");
  registerDevice("u5", reg("device-fff1"));
  // Première attente sans numéro : courte, rien en file.
  const first = await waitCommands("u5", "device-fff1", null, 30);
  assert.deepEqual(first.commands, []);
  const waiting = waitCommands("u5", "device-fff1", first.seq, 2000);
  setTimeout(() => sendCommand("u5", "device-fff1", { kind: "pause" }), 20);
  const got = await waiting;
  assert.deepEqual(got.commands, [{ kind: "pause" }]);
  assert.equal(got.seq > first.seq, true);
  // Un autre compte n'y lit rien.
  const other = await waitCommands("u6", "device-fff1", null, 20);
  assert.deepEqual(other.commands, []);
  // Le même numéro ne rejoue pas l'ordre déjà reçu.
  const again = await waitCommands("u5", "device-fff1", got.seq, 20);
  assert.deepEqual(again.commands, []);
});

test("attente longue : l'appareil reste en ligne pendant qu'il attend", async () => {
  const { waitCommands } = await import("../src/lib/connect/registry.ts");
  registerDevice("u7", reg("device-ggg1"));
  const waiting = waitCommands("u7", "device-ggg1", null, 50);
  assert.equal(getDevice("u7", "device-ggg1")?.online, true);
  await waiting;
});
