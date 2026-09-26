/**
 * The model has no clock: without this it answers dates from its training
 * cutoff ("on est encore loin du 2 juillet 2026" while it's September 2026).
 * Every chat turn gets the real date and time, in the device's time zone
 * when the client sends one, else the server's (TZ, Europe/Paris in Docker).
 */

/** A time zone the runtime actually knows, or null. */
export function validTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/** « samedi 26 septembre 2026, 23:41 » in the given zone. */
export function formatNow(now: Date, timeZone?: string | null): string {
  const zone = validTimeZone(timeZone) ?? undefined;
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return `${date}, ${time}`;
}

export function buildNowContext(now: Date, timeZone?: string | null): string {
  return `\n\nDATE ET HEURE ACTUELLES : nous sommes le ${formatNow(now, timeZone)} (heure de l'utilisateur). C'est la vérité, elle prime sur tes connaissances d'entraînement, qui s'arrêtent plus tôt : ne conteste jamais cette date, ne traite jamais comme « futur » un événement antérieur à elle, et calcule les durées (« il y a combien de temps », « dans combien de jours », âge, anniversaire) à partir d'elle. Mentionne l'heure seulement quand c'est utile (« ce soir », « il est tard »…).`;
}
