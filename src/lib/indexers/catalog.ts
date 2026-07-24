import type { CatalogEntry } from "./types";

/**
 * Built-in catalog of indexer definitions the user can add in one click.
 * Predefined entries carry a known, publicly documented API endpoint, so
 * adding one only asks for what's actually needed to authenticate — an API
 * key, or a username/password pair. The two "Generic" entries cover any other
 * standards-compliant indexer by letting the user paste its own endpoint.
 *
 * Newznab category ids: 2000 = Movies, 5000 = TV, 3000 = Audio, 7000 = Books.
 */
export const INDEXER_CATALOG: CatalogEntry[] = [
  {
    key: "generic-torznab",
    name: "Generic Torznab",
    kind: "torznab",
    protocol: "torrent",
    authType: "apikey",
    description:
      "Connect any Torznab-compatible torrent indexer by pasting its API URL and credentials.",
    categories: [2000, 5000],
  },
  {
    key: "generic-newznab",
    name: "Generic Newznab",
    kind: "newznab",
    protocol: "usenet",
    authType: "apikey",
    description:
      "Connect any Newznab-compatible usenet indexer by pasting its API URL and credentials.",
    categories: [2000, 5000],
  },
  {
    key: "c411",
    name: "C411",
    kind: "torznab",
    protocol: "torrent",
    authType: "apikey",
    siteUrl: "https://c411.org",
    baseUrl: "https://c411.org/api",
    description: "French-language private tracker with a native Torznab API.",
    categories: [2000, 5000],
  },
  {
    key: "torr9",
    name: "Torr9",
    kind: "torznab",
    protocol: "torrent",
    authType: "apikey",
    siteUrl: "https://torr9.net",
    baseUrl: "https://api.torr9.net/api/v1/torznab",
    description: "French-language private tracker with a native Torznab API (use your passkey as the API key).",
    categories: [2000, 5000],
  },
  {
    key: "nzbgeek",
    name: "NZBgeek",
    kind: "newznab",
    protocol: "usenet",
    authType: "apikey",
    siteUrl: "https://nzbgeek.info",
    baseUrl: "https://api.nzbgeek.info/api",
    description: "General-purpose usenet indexer with broad movie & TV coverage.",
    categories: [2000, 5000],
  },
  {
    key: "nzbfinder",
    name: "NZBFinder",
    kind: "newznab",
    protocol: "usenet",
    authType: "apikey",
    siteUrl: "https://nzbfinder.ws",
    baseUrl: "https://nzbfinder.ws/api",
    description: "Community usenet indexer covering movies, TV and more.",
    categories: [2000, 5000],
  },
  {
    key: "drunkenslug",
    name: "DrunkenSlug",
    kind: "newznab",
    protocol: "usenet",
    authType: "apikey",
    siteUrl: "https://drunkenslug.com",
    baseUrl: "https://drunkenslug.com/api",
    description: "Long-running usenet indexer with movie & TV categories.",
    categories: [2000, 5000],
  },
  {
    key: "dognzb",
    name: "DOGnzb",
    kind: "newznab",
    protocol: "usenet",
    authType: "apikey",
    siteUrl: "https://dognzb.cr",
    baseUrl: "https://api.dognzb.cr/api",
    description: "Invite-based usenet indexer with strict release standards.",
    categories: [2000, 5000],
  },
  {
    key: "nzbcat",
    name: "NZBcat",
    kind: "newznab",
    protocol: "usenet",
    authType: "apikey",
    siteUrl: "https://nzb.cat",
    baseUrl: "https://nzb.cat/api",
    description: "Usenet indexer focused on fast, complete releases.",
    categories: [2000, 5000],
  },
  {
    key: "tr4ker",
    name: "Tr4ker",
    kind: "torznab",
    protocol: "torrent",
    authType: "x-api-key",
    siteUrl: "https://tr4ker.com",
    description: "Tracker français — ajoutez l'en-tête X-Api-Key à chaque requête.",
    categories: [2000, 5000],
  },
];

export function catalogEntry(key: string) {
  return INDEXER_CATALOG.find((c) => c.key === key) ?? null;
}
