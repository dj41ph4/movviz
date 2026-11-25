import { decodeXml, type DlnaRenderer } from "./ssdp";

/** Pilotage UPnP AVTransport d'un téléviseur DLNA : charger une URL, lire, pause, aller à, arrêter, position. */

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

async function soap(r: DlnaRenderer, action: string, args: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${r.avTransportType}"><InstanceID>0</InstanceID>${args}</u:${action}></s:Body></s:Envelope>`;
  const response = await fetch(r.avTransportUrl, {
    method: "POST",
    headers: { "content-type": 'text/xml; charset="utf-8"', soapaction: `"${r.avTransportType}#${action}"` },
    body,
    signal: AbortSignal.timeout(6000),
  });
  const text = (await response.text()).slice(0, 256 * 1024);
  if (!response.ok) throw new Error(`dlna_${action}_${response.status}`);
  return text;
}

/** « 01:23:45 » ↔ secondes. */
export function hms(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function parseHms(value: string | null | undefined): number {
  const m = /^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec((value ?? "").trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Fiche DIDL-Lite décrivant la vidéo (titre, type, profil DLNA) : beaucoup de téléviseurs l'exigent. */
export function didl(url: string, title: string, mime: string, posterUrl: string | null): string {
  const res = `<res protocolInfo="http-get:*:${escapeXml(mime)}:DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000">${escapeXml(url)}</res>`;
  const art = posterUrl ? `<upnp:albumArtURI>${escapeXml(posterUrl)}</upnp:albumArtURI>` : "";
  return `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"><item id="movviz" parentID="0" restricted="1"><dc:title>${escapeXml(title)}</dc:title><upnp:class>object.item.videoItem.movie</upnp:class>${art}${res}</item></DIDL-Lite>`;
}

export async function dlnaLoad(r: DlnaRenderer, url: string, title: string, mime: string, posterUrl: string | null): Promise<void> {
  // Un lecteur occupé refuse parfois une nouvelle URL : on l'arrête d'abord, sans tenir compte d'un refus.
  await soap(r, "Stop", "").catch(() => {});
  await soap(r, "SetAVTransportURI", `<CurrentURI>${escapeXml(url)}</CurrentURI><CurrentURIMetaData>${escapeXml(didl(url, title, mime, posterUrl))}</CurrentURIMetaData>`);
  await soap(r, "Play", "<Speed>1</Speed>");
}

export const dlnaPlay = (r: DlnaRenderer) => soap(r, "Play", "<Speed>1</Speed>").then(() => {});
export const dlnaPause = (r: DlnaRenderer) => soap(r, "Pause", "").then(() => {});
export const dlnaStop = (r: DlnaRenderer) => soap(r, "Stop", "").then(() => {});
export const dlnaSeek = (r: DlnaRenderer, seconds: number) => soap(r, "Seek", `<Unit>REL_TIME</Unit><Target>${hms(seconds)}</Target>`).then(() => {});

export interface DlnaStatus {
  state: "playing" | "paused" | "buffering" | "idle";
  position: number;
  duration: number;
}

const inner = (xml: string, name: string) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decodeXml(m[1]) : null;
};

export async function dlnaStatus(r: DlnaRenderer): Promise<DlnaStatus> {
  const [transport, position] = await Promise.all([soap(r, "GetTransportInfo", ""), soap(r, "GetPositionInfo", "")]);
  const raw = (inner(transport, "CurrentTransportState") ?? "").toUpperCase();
  const state = raw === "PLAYING" ? "playing" : raw === "PAUSED_PLAYBACK" ? "paused" : raw === "TRANSITIONING" ? "buffering" : "idle";
  return { state, position: parseHms(inner(position, "RelTime")), duration: parseHms(inner(position, "TrackDuration")) };
}
