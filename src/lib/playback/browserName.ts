/** Nom court du navigateur d'après son user-agent (« Chrome 130 », « Firefox 132 »…) ; null si non reconnu. */
export function browserFromUserAgent(ua: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/\bEdg(?:e|A|iOS)?\/(\d+)/, "Edge"],
    [/\bOPR\/(\d+)/, "Opera"],
    [/\bSamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/\b(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
    [/\b(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
    [/\bVersion\/(\d+)[^]*Safari\//, "Safari"],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return null;
}
