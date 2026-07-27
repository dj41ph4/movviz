const STATUS_MAP: Record<string, Record<string, string>> = {
  fr: {
    "Returning Series": "Série en cours",
    Ended: "Terminée",
    Canceled: "Annulée",
    "In Production": "En production",
    Planned: "Planifiée",
    "Post Production": "Post-production",
    Released: "Sorti",
    Rumored: "Rumeur",
    Pilot: "Pilote",
  },
  en: {
    "Returning Series": "Returning Series",
    Ended: "Ended",
    Canceled: "Canceled",
    "In Production": "In Production",
    Planned: "Planned",
    "Post Production": "Post Production",
    Released: "Released",
    Rumored: "Rumored",
    Pilot: "Pilot",
  },
  de: {
    "Returning Series": "Fortlaufende Serie",
    Ended: "Beendet",
    Canceled: "Abgesagt",
    "In Production": "In Produktion",
    Planned: "Geplant",
    "Post Production": "Postproduktion",
    Released: "Veröffentlicht",
    Rumored: "Gerücht",
    Pilot: "Pilot",
  },
  it: {
    "Returning Series": "Serie in corso",
    Ended: "Conclusa",
    Canceled: "Cancellata",
    "In Production": "In produzione",
    Planned: "Pianificata",
    "Post Production": "Post-produzione",
    Released: "Uscito",
    Rumored: "Vociferato",
    Pilot: "Pilota",
  },
  nl: {
    "Returning Series": "Terugkerende serie",
    Ended: "Beëindigd",
    Canceled: "Geannuleerd",
    "In Production": "In productie",
    Planned: "Gepland",
    "Post Production": "Postproductie",
    Released: "Uitgebracht",
    Rumored: "Gerucht",
    Pilot: "Pilot",
  },
};

export function translateStatus(status: string, locale: string): string {
  const langMap = STATUS_MAP[locale];
  if (!langMap) return status;
  return langMap[status] ?? status;
}
