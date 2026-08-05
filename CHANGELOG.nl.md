# Changelog

Alle noemenswaardige wijzigingen aan Movviz, gegroepeerd per ontwikkelmijlpaal.

---

## v1.12.71 — Augustus 2026

### Het venster "nieuw" volgt nu de interfacetaal

- Releasenotities zijn nu gelokaliseerd per interfacetaal (met terugval op Engels voor wat nog niet vertaald is), in plaats van één vast-talig bestand.
- **Opgelost**: de releasenotities ontbraken stilletjes in zowel de Docker- als de Windows-build — het bestand waaruit ze worden gelezen was in geen van beide gepakte builds daadwerkelijk aanwezig, waardoor het venster "nieuw" niets had om te tonen.

## v1.12.70 — Augustus 2026

### Download-engine — hoofdoorzaak van permanent ontkoppelde downloads

- **Opgelost, bevestigd in productie**: het verwijderen van een torrent uit de download-engine meldde succes en wiste zijn eigen tracking (inclusief tot welke bibliotheektitel hij behoorde), zelfs wanneer de onderliggende downloadclient er stilletjes niet in slaagde om hem daadwerkelijk te verwijderen — de torrent bleef ongehinderd draaien en seeden, maar de engine had er geen enkel record meer van. Dit is wat downloads veroorzaakte die nooit meer aan een titel gekoppeld konden worden, ongeacht hoe vaak een herstelscan werd uitgevoerd. De engine wist zijn eigen boekhouding nu pas zodra de verwijdering onafhankelijk is bevestigd; anders blijft de torrent getrackt en kan opnieuw worden geprobeerd in plaats van een permanente wees te worden.

## v1.12.51 – v1.12.69 — Augustus 2026

Nauwkeurigheids- en betrouwbaarheidspas voor matching en engine: detectie van complete-seriespacks (seizoensbereiktermen, bescherming tegen valse positieven), herstel van vastgelopen downloads verstevigd met atomaire verplaatsingen zonder overschrijving en een betrouwbare import-callback, per-serie/film schrijfvergrendeling om een race condition te sluiten die de status van een voltooide aflevering kon laten wegvallen, en reconciliatie van dubbele downloads zodat een opnieuw opgehaald bestand de bibliotheek niet meer op de verkeerde status laat vastzitten. Gebruikershandleiding bijgewerkt met recent uitgebrachte functies (titel bewerken, filmversies, koppelen van ontkoppelde downloads, anime-instellingen).

## v1.12.24 – v1.12.50 — Augustus 2026

Zoeken naar complete-seriespacks (één query, seizoensbereikbewust), betrouwbaarheid van downloadherstel (mapscan, matching van weesbestanden, opschonen van duplicaten), beveiligde verwijdering van duplicaten, en een kleine geautomatiseerde testsuite voor de kern van release-matching.

## v1.10.90 – v1.12.23 — Juli–Augustus 2026

Workflow voor kwaliteitsupgrades (Optimaliseren / Negeren, detectie van betekenisvolle upgrades), een opnieuw ontworpen resolutie-/codec-badgesysteem, GPU/animatie-prestatieprofielen, en engine-stabilisatie over alle verwisselbare downloadbackends heen (crashfixes, anti-stallregel, per-serie zoekvergrendeling).

## v1.10.39 – v1.10.89 — Juli 2026

Herschrijving van de download-engine met verwisselbare backends (native/aria2, WebTorrent, libtorrent), een onderhoudstool "downloads herstellen" voor weesbestanden, een premium toast-notificatiesysteem, audiocodec-badges, en beta-verbeteringen aan de in-app afspeelfunctie (directe weergave, transcodelogging).

## v1.10.12 – v1.10.17 — Juli 2026

Nauwkeurigheidspas voor taaldetectie: audiotracktaal uitgelezen via Plex, Franse variant-tags (VF/VFQ/VFF/TRUEFRENCH) die correct voldoen aan kwaliteitsprofielen, opschonen van dubbele afleveringen, en een fix voor voortijdig opgegeven torrents.

## v1.10.1 – v1.10.6 — Juli 2026

Decision Guard (handhaving van de blocklist vóór het ophalen), detectie van franchises/collecties, een opnieuw ontworpen downloadwachtrij en diagnostisch dashboard, en verfijningen van trailers/kalender.

## v1.8.0 – v1.9.9 — Juli 2026

Verenigd titelpaneel (één component voor de uitschuif- en volledige-pagina-weergaven), een prullenbak-/herstelvangnet voor verwijderde titels, mobiele responsiviteitspas, en een fix voor een geheugenlek in de metadatacache.

## v1.4.5 – v1.7.9 — Juli 2026

Beveiligingsverharding (path traversal, databasebeschermingen, CodeQL-meldingen), de laatste beschermingen van het prullenbaksysteem, een live in-app player, realtime updates door de hele interface, monitoring van Plex-activiteit, en ondersteuning voor collecties.

## v1.1.67 – v1.4.4 — Juli 2026

In-app player met automatische fallback naar Plex-transcodering, import van verzoeken uit Overseerr (Seerr), multi-architectuur Docker-builds, en een reductie van de instellingennavigatie van 26 naar 18 tabbladen.

## v1.1.50 – v1.1.66 — Juli 2026

Eerste publieke release: TMDb-ontdekking, zoeken op Torznab/Newznab-indexers, verenigde film-/seriebibliotheek, multi-gebruikersverzoeken, de ingebouwde BitTorrent-engine, en Plex-synchronisatie — plus vroege stabiliteits- en beveiligingsfixes (sessiebeheer, deduplicatie van de bibliotheek, upgrades van dependencies).
