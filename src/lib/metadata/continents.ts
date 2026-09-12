/**
 * Continent groupings for the Discover origin-country filter. Each entry maps
 * to a curated set of ISO 3166-1 country codes passed to TMDb's
 * `with_origin_country` discover parameter. The lists include sovereign
 * states and the ISO territories that TMDb can return as an origin country:
 * selecting a continent must never silently exclude one of its countries.
 */

export interface ContinentDef {
  id: string;
  countries: string[];
}

export const CONTINENTS: ContinentDef[] = [
  {
    id: "europe",
    countries: [
      "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE",
      "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR", "HR", "HU",
      "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME",
      "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ",
      "SK", "SM", "UA", "VA", "XK",
    ],
  },
  {
    id: "northAmerica",
    countries: [
      "AG", "AI", "AW", "BB", "BL", "BM", "BQ", "BS", "BZ", "CA", "CR", "CU",
      "CW", "DM", "DO", "GD", "GL", "GP", "GT", "HN", "HT", "JM", "KN", "KY",
      "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PM", "PR", "SV", "SX", "TC",
      "TT", "US", "VC", "VG", "VI",
    ],
  },
  {
    id: "southAmerica",
    countries: ["AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR", "UY", "VE"],
  },
  {
    id: "asia",
    countries: [
      "AF", "AM", "AZ", "BD", "BH", "BN", "BT", "CC", "CN", "CX", "GE", "HK",
      "ID", "IL", "IN", "IO", "IQ", "IR", "JO", "JP", "KG", "KH", "KP", "KR",
      "KW", "KZ", "LA", "LB", "LK", "MM", "MN", "MO", "MV", "MY", "NP", "OM",
      "PH", "PK", "PS", "QA", "SA", "SG", "SY", "TH", "TJ", "TL", "TM", "TR",
      "TW", "UZ", "VN", "YE",
    ],
  },
  {
    id: "africa",
    countries: [
      "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ",
      "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "KE",
      "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA",
      "NE", "NG", "RE", "RW", "SC", "SD", "SH", "SL", "SN", "SO", "SS", "ST",
      "SZ", "TD", "TG", "TN", "TZ", "UG", "YT", "ZA", "ZM", "ZW",
    ],
  },
  {
    id: "oceania",
    countries: [
      "AS", "AU", "CK", "FJ", "FM", "GU", "KI", "MH", "MP", "NC", "NF", "NR",
      "NU", "NZ", "PF", "PG", "PN", "PW", "SB", "TK", "TO", "TV", "UM", "VU", "WF", "WS",
    ],
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
