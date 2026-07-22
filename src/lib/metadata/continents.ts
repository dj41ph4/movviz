/**
 * Continent groupings for the Discover origin-country filter. Each entry maps
 * to a curated set of ISO 3166-1 country codes passed to TMDb's
 * `with_origin_country` discover parameter — this is deliberately not
 * exhaustive (micro-states are skipped), just enough to cover the vast
 * majority of what TMDb actually indexes per region.
 */

export interface ContinentDef {
  id: string;
  countries: string[];
}

export const CONTINENTS: ContinentDef[] = [
  {
    id: "europe",
    countries: [
      "FR", "GB", "DE", "IT", "ES", "PT", "BE", "NL", "CH", "AT", "SE", "NO",
      "DK", "FI", "IE", "PL", "CZ", "GR", "HU", "RO", "RU", "UA", "IS",
    ],
  },
  {
    id: "northAmerica",
    countries: ["US", "CA", "MX"],
  },
  {
    id: "southAmerica",
    countries: ["BR", "AR", "CL", "CO", "PE", "UY", "VE", "EC", "BO", "PY"],
  },
  {
    id: "asia",
    countries: [
      "JP", "KR", "CN", "IN", "TH", "HK", "TW", "PH", "ID", "MY", "VN",
      "SG", "IL", "TR", "PK", "BD",
    ],
  },
  {
    id: "africa",
    countries: ["ZA", "NG", "EG", "MA", "TN", "DZ", "KE", "SN", "CI", "GH"],
  },
  {
    id: "oceania",
    countries: ["AU", "NZ"],
  },
];

/** Flattens the selected continent ids into the ISO country codes TMDb expects. */
export function countriesForContinents(continentIds: string[]): string[] {
  const ids = new Set(continentIds);
  const codes = new Set<string>();
  for (const c of CONTINENTS) {
    if (ids.has(c.id)) for (const code of c.countries) codes.add(code);
  }
  return [...codes];
}
