import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeMessage, encodeMessage } from "../src/lib/connect/network/castv2.ts";
import { parseRendererDescription } from "../src/lib/connect/network/ssdp.ts";
import { buildQuery, receiversFrom } from "../src/lib/connect/network/mdns.ts";
import { didl, hms, parseHms } from "../src/lib/connect/network/dlna.ts";
import { CAST_TOKEN_RE, createCastMedia, getCastMedia } from "../src/lib/connect/castMedia.ts";
import { DEVICE_ID_RE } from "../src/lib/connect/types.ts";
import { NETWORK_ID_RE } from "../src/lib/connect/network/manager.ts";

test("CASTV2 : un message encodé se relit à l'identique", () => {
  const frame = encodeMessage("sender-movviz", "receiver-0", "urn:x-cast:com.google.cast.receiver", { type: "LAUNCH", appId: "CC1AD845", requestId: 7 });
  assert.equal(frame.readUInt32BE(0), frame.length - 4);
  const decoded = decodeMessage(frame.subarray(4));
  assert.equal(decoded.source, "sender-movviz");
  assert.equal(decoded.destination, "receiver-0");
  assert.equal(decoded.namespace, "urn:x-cast:com.google.cast.receiver");
  assert.deepEqual(decoded.data, { type: "LAUNCH", appId: "CC1AD845", requestId: 7 });
  // Une charge de plus de 127 octets : longueur sur plusieurs octets (varint).
  const long = encodeMessage("a", "b", "c", { text: "x".repeat(400) });
  assert.equal((decodeMessage(long.subarray(4)).data as { text: string }).text.length, 400);
});

test("DLNA : la description d'un téléviseur donne son nom et l'URL AVTransport", () => {
  const xml = `<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><device>
    <friendlyName>[TV] Salon &amp; Co</friendlyName><modelName>QE55</modelName><UDN>uuid:abc-123</UDN>
    <serviceList>
      <service><serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType><controlURL>/rc</controlURL></service>
      <service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType><controlURL>/upnp/control/AVTransport1</controlURL></service>
    </serviceList></device></root>`;
  const r = parseRendererDescription(xml, "http://192.168.1.20:9197/dmr");
  assert.ok(r);
  assert.equal(r.name, "[TV] Salon & Co");
  assert.equal(r.udn, "uuid:abc-123");
  assert.equal(r.avTransportUrl, "http://192.168.1.20:9197/upnp/control/AVTransport1");
  assert.equal(r.avTransportType, "urn:schemas-upnp-org:service:AVTransport:1");
  // Sans AVTransport (simple serveur de médias), ce n'est pas un lecteur.
  assert.equal(parseRendererDescription(xml.replace(/AVTransport/g, "ContentDirectory"), "http://x/"), null);
});

test("DLNA : temps et fiche DIDL échappée", () => {
  assert.equal(hms(3725), "01:02:05");
  assert.equal(parseHms("01:02:05"), 3725);
  assert.equal(parseHms("0:00:07.250"), 7);
  assert.equal(parseHms("NOT_IMPLEMENTED"), 0);
  const meta = didl("http://h/a?b=1&c=2", "Tom & Jerry <3", "video/x-matroska", null);
  assert.match(meta, /Tom &amp; Jerry &lt;3/);
  assert.match(meta, /http:\/\/h\/a\?b=1&amp;c=2/);
  assert.doesNotMatch(meta, /<3/);
});

/** Paquet mDNS de réponse comme en envoie un Chromecast (PTR + SRV + TXT + A). */
function chromecastPacket(): Buffer {
  const name = (n: string) => Buffer.concat([...n.split(".").map((l) => Buffer.concat([Buffer.from([Buffer.byteLength(l)]), Buffer.from(l)])), Buffer.from([0])]);
  const rr = (owner: string, type: number, data: Buffer) => {
    const head = Buffer.alloc(10);
    head.writeUInt16BE(type, 0); head.writeUInt16BE(1, 2); head.writeUInt32BE(120, 4); head.writeUInt16BE(data.length, 8);
    return Buffer.concat([name(owner), head, data]);
  };
  const instance = "Chromecast-abc._googlecast._tcp.local";
  const srvData = Buffer.concat([Buffer.from([0, 0, 0, 0, 0x1f, 0x49]), name("abc.local")]);
  const txtEntries = ["id=abc123def", "fn=TV du salon", "md=Chromecast", "ca=201221"].map((e) => Buffer.concat([Buffer.from([Buffer.byteLength(e)]), Buffer.from(e)]));
  const header = Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 3]);
  return Buffer.concat([
    header,
    rr("_googlecast._tcp.local", 12, name(instance)),
    rr(instance, 33, srvData),
    rr(instance, 16, Buffer.concat(txtEntries)),
    rr("abc.local", 1, Buffer.from([192, 168, 1, 42])),
  ]);
}

test("mDNS : un Chromecast est reconnu avec son nom, son adresse et son port", () => {
  const query = buildQuery();
  assert.equal(query.readUInt16BE(4), 1);
  const [r] = receiversFrom([chromecastPacket()]);
  assert.ok(r);
  assert.equal(r.name, "TV du salon");
  assert.equal(r.host, "192.168.1.42");
  assert.equal(r.port, 8009);
  assert.equal(r.model, "Chromecast");
  assert.equal(r.video, true);
  // Paquet tronqué ou vide : aucune exception, aucun appareil.
  assert.deepEqual(receiversFrom([Buffer.alloc(5), chromecastPacket().subarray(0, 40)]), []);
});

test("Liens de lecture : jeton de 256 bits, un seul fichier, inconnu = refusé", () => {
  const token = createCastMedia({ userId: "u1", path: "/media/film.mkv", mode: "direct", title: "Film", transcodeAudio: false, durationSec: 100 });
  assert.match(token, CAST_TOKEN_RE);
  assert.equal(getCastMedia(token)?.path, "/media/film.mkv");
  assert.equal(getCastMedia("0".repeat(64)), null);
  assert.equal(getCastMedia("../../etc/passwd"), null);
});

test("Identifiants des écrans réseau compatibles avec le contrat des appareils", () => {
  for (const id of ["cast_0123456789abcdef01234567", "dlna_0123456789abcdef01234567"]) {
    assert.match(id, NETWORK_ID_RE);
    assert.match(id, DEVICE_ID_RE);
  }
});

test("Même réseau : les écrans du salon ne sont proposés qu'à la maison", async () => {
  const { isSameNetwork, v6Prefix64 } = await import("../src/lib/connect/network/sameNetwork.ts");
  const home = { publicV4: "91.86.41.92", v6Prefixes: ["2a01:cc00:ca42:0"] };
  // Chez soi par le nom de domaine public : la box voit sa propre adresse publique.
  assert.equal(isSameNetwork("91.86.41.92", home), true);
  assert.equal(isSameNetwork("::ffff:91.86.41.92", home), true);
  assert.equal(isSameNetwork("10.0.1.23", home), true);
  // En 4G ou chez un ami : autre adresse publique.
  assert.equal(isSameNetwork("37.165.12.8", home), false);
  // IPv6 : même /64 que le serveur, quelle que soit l'écriture.
  assert.equal(v6Prefix64("2a01:cc00:ca42::8906:6431:8efd:43d"), "2a01:cc00:ca42:0");
  assert.equal(isSameNetwork("2a01:cc00:ca42:0:1111:2222:3333:4444", home), true);
  assert.equal(isSameNetwork("2a04:cec0:1000:5::1", home), false);
  // Dans le doute (aucune adresse, box muette) : liste complète, comme avant.
  assert.equal(isSameNetwork(null, home), true);
  assert.equal(isSameNetwork("37.165.12.8", { publicV4: null, v6Prefixes: [] }), true);
  assert.equal(isSameNetwork("2a04:cec0:1000:5::1", { publicV4: null, v6Prefixes: [] }), true);
});

test("Profil Cast : le Nest Hub reçoit du H.264 + AAC, un Google TV garde la source", async () => {
  const { castProfileFor, remuxArgs } = await import("../src/lib/connect/castMedia.ts");
  const uhd = { videoCodec: "hevc", bitDepth: 10, width: 3840, hdr: true, audioCodec: "eac3" };
  // Vérifié sur un vrai Nest Hub : HEVC/E-AC3 en copie = erreur, il faut recoder.
  // Conversion HDR→SDR coupée (réglage, ou banc d'essai < 3×) : jamais de tonemap, simple passage en 8 bits.
  const hub = castProfileFor("Google Nest Hub", uhd);
  assert.deepEqual(hub.video, { width: 1280, toneMap: false, preset: "ultrafast", fastDecode: true });
  const fast = remuxArgs("/m/f.mkv", 0, hub);
  assert.ok(fast.indexOf("-skip_loop_filter") >= 0 && fast.indexOf("-skip_loop_filter") < fast.indexOf("-i"));
  assert.ok(!remuxArgs("/m/f.mkv", 0, hub).join(" ").includes("tonemap"));
  // Autorisée : 720 px, comme le moteur de lecture.
  assert.deepEqual(castProfileFor("Google Nest Hub", { ...uhd, toneMapAllowed: true }).video, { width: 720, toneMap: true, preset: "ultrafast", fastDecode: true });
  assert.equal(hub.transcodeAudio, true);
  assert.deepEqual(castProfileFor("Google Nest Hub", { ...uhd, hdr: false, width: 1920 }).video, { width: 1280, toneMap: false, preset: "veryfast" });
  // Chromecast avec Google TV : HEVC HDR et E-AC3 passent tels quels.
  const gtv = castProfileFor("Chromecast with Google TV", uhd);
  assert.equal(gtv.video, null);
  assert.equal(gtv.transcodeAudio, false);
  // H.264 1080p + AAC : copie partout, aucun recodage inutile.
  assert.deepEqual(castProfileFor("Chromecast", { videoCodec: "h264", bitDepth: 8, width: 1920, audioCodec: "aac" }), { video: null, transcodeAudio: false });
  // Modèle inconnu, source inconnue : profil sûr.
  assert.ok(castProfileFor(null, {}).video);
  const args = remuxArgs("/m/film.mkv", 90, hub);
  assert.ok(args.includes("libx264"));
  assert.ok(args.join(" ").includes("scale=min(1280\\,iw):-2:flags=fast_bilinear"));
  assert.deepEqual(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 2), ["-ss", "90.00"]);
  assert.ok(remuxArgs("/m/a.mp4", 0, { transcodeAudio: false, video: null }).includes("copy"));
});
