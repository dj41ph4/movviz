# Changelog

Alle noemenswaardige wijzigingen aan Movviz, gegroepeerd per ontwikkelmijlpaal.

---

## v1.13.16 — Augustus 2026

### Vertragingen op de achtergrond zijn nu zichtbaar in de logs — met de verantwoordelijke gebruiker

- **Nieuw**: achtergrondwerk (de handmatige bulk "Zoek alles wat ontbreekt", gepland RSS-matching, kwaliteitsupgrades, herhalingen voor gemiste releases) pauzeert nu terwijl je de app actief gebruikt en hervat een paar seconden nadat je stopt — je voelt er nooit iets van. Elke keer dat zo'n vertraging echt optreedt, legt het diagnostische zoeklog het vast in één nette, leesbare regel: welke achtergrondtaak werd afgeremd, welke gebruiker was actief (naam + id) en hoe lang het wachten duurde (bijv. "Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Opgelost**: stil frontend-polling telt niet meer als gebruikersactiviteit. De statuspeilingen (engine-torrents elke 500 ms, jobs elke 2 s, perf-metingen elke 5 s, Plex-activiteit elke 5 s, afspeelvoortgang elke 10 s…) hielden de app voor altijd als "actief" gemarkeerd zodra één enkele pagina open bleef — dus de achtergrond hervatte nooit echt. Nu tellen alleen echte interacties (navigatie, zoekopdrachten, klikken): laat de app open en de achtergrond hervat een paar seconden na je laatste klik.
- **Gewijzigd**: de handmatige bulkzoekopdracht draait nu in de achtergrondbaan net als de geplande taken — hij erft het verlaagde indexerquotum (je eigen zoekopdrachten blijven prioriteit) en geeft tussen items de beurt af.

## v1.13.15 — Augustus 2026

### Navigatiebalk bleef ondoorzichtig na terugscrollen naar boven

- **Opgelost**: de transparant-naar-ondoorzichtig navigatiebalk die in v1.13.12 werd toegevoegd, werd correct ondoorzichtig bij het naar beneden scrollen, maar werd nooit meer transparant bij het helemaal terugscrollen naar boven. Overgestapt op een betrouwbaardere detectiemethode zodat de scrollpositie in beide richtingen correct wordt weergegeven.

## v1.13.14 — Augustus 2026

### Dashboardrijen kunnen nu een volledig grid openen — "Alles bekijken" was nooit echt aangesloten

- **Opgelost**: de carrousels van het dashboard ("Voor jou", "Recent toegevoegd", "Binnenkort", "Trending") hadden een "Alles bekijken"-functie ingebouwd in het rijcomponent zelf, maar geen enkele dashboardrij gaf hier ooit een bestemming aan mee — dus verscheen die stilzwijgend nooit, op geen enkele rij, sinds dit deel van het dashboard voor het eerst is gebouwd. Rijen blijven precies zoals ze zijn: compacte horizontale stroken; "Alles bekijken" opent nu de volledige set als een echt filterbaar grid (Ontdekken voor aanbevelings-/trendingrijen, je Bibliotheek — vooraf gefilterd om te passen — voor rijen die zijn samengesteld uit wat je al bezit).

## v1.13.13 — Augustus 2026

### Bèta-player is nu een persoonlijke keuze per account, standaard uit

- **Gewijzigd**: voorheen had de Bèta-player één centrale aan/uit-schakelaar voor de hele instantie — als een beheerder hem inschakelde, veranderde stilzwijgend het afspeelgedrag voor elk account. Er zijn nu twee lagen: een beheerdersschakelaar in Instellingen die de functie alleen algemeen beschikbaar maakt, en een persoonlijke schakelaar op de eigen Profielpagina van elke gebruiker die hem daadwerkelijk voor dat account inschakelt — standaard uit, ongeacht wat de beheerder heeft ingesteld.

## v1.13.12 — Augustus 2026

### Zes browse-verbeteringen, gekozen uit een designreview

- **Nieuw**: rijen tonen nu een dunne scrollpositie-indicator en randpijlen die verschijnen bij hover, en scrollen een volledige pagina tegelijk in plaats van vrij te slepen.
- **Nieuw**: de rij "Trending" markeert nu de top 10 met een genummerde ranglijstweergave, op basis van dezelfde echte populariteitsvolgorde waarop de rij al gesorteerd was.
- **Nieuw**: het hoveren over een posterkaart (desktop) toont nu kort jaar, speelduur en genretags indien beschikbaar, in plaats van niets.
- **Gewijzigd**: de bovenste navigatiebalk is nu transparant bovenaan de pagina en wordt effen zodra je scrolt.
- **Gewijzigd**: de afleveringenlijst voor een titel die nog niet in je bibliotheek staat, toont nu een thumbnail en een korte beschrijving per aflevering, in plaats van slechts een kale rij. (Afleveringen van titels die al in je bibliotheek staan, hebben dit nog niet — dat vereist nieuwe gegevens die bij import worden verzameld, apart bijgehouden.)
- **Nieuw**: op mobiel gebruikt de dashboard-hero nu speciale portretillustraties in plaats van een uitgesneden versie van de desktopbanner.

## v1.13.11 — Augustus 2026

### Weergavepersonalisatie volgt nu je account, niet alleen je browser

- **Gewijzigd**: het GPU-prestatieprofiel, animaties, thema (licht/donker/automatisch), interfacetaal en de weergavedichtheid van de bibliotheek werden alleen in de browser opgeslagen — bij het wisselen van apparaat of browser werd alles teruggezet naar de standaardwaarden. Ze worden nu opgeslagen bij je account en volgen je overal waar je inlogt, terwijl ze nog steeds direct worden toegepast op het apparaat dat je gebruikt.
- **Verplaatst**: de schakelaar "Animaties" staat nu in Instellingen → Prestaties GPU, naast het profiel waarop hij daadwerkelijk van invloed is, in plaats van onder Dashboard.

## v1.13.10 — Augustus 2026

### Knoppen van de mobiele onderste navigatiebalk werkten alleen bij tikken boven het icoon

- **Opgelost, bevestigd in productie**: op mobiel deed rechtstreeks tikken op de tabknoppen Kalender/Aanvragen/Meer vaak niets — maar tikken net erboven werkte wel. Oorzaak: de toast-meldingscontainer is overal aanwezig en blijft altijd in de pagina staan, zelfs zonder zichtbare meldingen. De mobiele laag ervan beslaat de volledige breedte van het scherm, ligt precies bovenop de onderste tabbalk, en is onzichtbaar — maar een onzichtbaar element blokkeert nog steeds klikken eronder, tenzij expliciet anders aangegeven. Tikken die in dat overlappende gebied terechtkwamen, troffen stilletjes niets in plaats van de tabknop te bereiken.
- De onzichtbare container blokkeert nu niets meer eronder; alleen een daadwerkelijk zichtbare melding (zeldzaam en kortstondig) blijft tikbaar/afsluitbaar, precies zoals voorheen.

## v1.13.09 — Augustus 2026

### De Blood+ matching-fix uit v1.13.06 werkte in de praktijk nooit — de echte oorzaak gevonden

- **Opgelost, bevestigd in productie**: v1.13.06 paste de titel-matchingfunctie aan om "+" als het woord "plus" te behandelen (zodat "Blood+" niet verward zou worden met ongerelateerde shows). Toch toonde handmatig zoeken nog steeds "Blood Of Zeus", "Dexter New Blood", "Blood-C" en anderen als geldige kandidaten voor "Blood+" — omdat een compleet andere, eerdere stap (degene die een zoekopdracht uit het zoekvak omzet in de daadwerkelijke tekst die naar indexers wordt gestuurd) de "+" al verwijderde voordat de gerepareerde matchingfunctie deze ooit te zien kreeg, waardoor die fix voor elke echte zoekopdracht stilletjes ongedaan werd gemaakt. Een zoekopdracht voor "Blood+" kwam bij de matcher aan als het kale woord "Blood", dat natuurlijk bijna alles met "Blood" in de titel matcht.
- Die eerdere stap behoudt "+" en "&" nu ook als woorden, op dezelfde manier waarop de matchingfunctie dat al deed — waarmee het echte gat wordt gedicht, niet alleen dat van de functie die de bron van het probleem leek.

## v1.12.79 — Augustus 2026

### De vorige fix verstevigd na een onafhankelijke review

- Een onafhankelijke review van de recovery-fix uit v1.12.78 ving twee echte gaten op voordat ze konden bijten: de nieuwe "vertrouw op het eigen record van de oorspronkelijke download"-resolutie had een expliciet, afwijkend seizoensnummer uit de eigen bestandsnaam kunnen overschrijven — waardoor een verkeerd gelabelde release stilletjes in de verkeerde seizoensmap terecht had kunnen komen. Nu vult het alleen een seizoen/aflevering aan die de bestandsnaam zelf nog niet leverde, en overschrijft het nooit een waarde die wel al aanwezig was. Daarnaast liep één resterend geval (een film gebundeld in een pakket van de categorie series) nog op het oude, puur op gokken gebaseerde pad terwijl elk ander geval al was bijgewerkt — nu consistent over alle gevallen heen.

## v1.12.78 — Augustus 2026

### Grondoorzaak waardoor ook download-recovery niet kon herkoppelen — recovery gooide informatie weg die het al had

- **Opgelost, bevestigd in productie**: een specifiek geval onderzocht (Wakfu) waarbij de download-recoverytool geen match kon vinden voor voltooide bestanden, ook al stond de show al correct in de bibliotheek. Grondoorzaak: recovery raadde de show van elk bestand opnieuw, puur op basis van bestandsnaam en mappad, zelfs voor bestanden waarvan de oorspronkelijke download al — met zekerheid, vanaf het moment dat deze werd binnengehaald — precies wist bij welke serie en seizoen het hoorde. Die gezaghebbende informatie werd weggegooid voordat de matching per bestand plaatsvond, waardoor elk bestand alsnog door een onzekere gok op basis van de bestandsnaam moest. Bij een show georganiseerd als `ShowNaam/Saison 01/aflevering.avi`, met een afleveringsbestand waarvan de naam zelf geen herkenbare seizoensmarkering bevat, viel die gok terug op het lezen van de seizoensmap zelf ("Saison 01") als titel van de show — die geen enkel woord deelt met de echte naam, waardoor er nooit een match ontstond.
- Recovery herleidt de show/het seizoen van een bestand nu rechtstreeks uit het eigen record van de oorspronkelijke download wanneer beschikbaar, in plaats van te gokken — en wanneer het toch moet terugvallen op het lezen van mapnamen, controleert het nu een niveau hoger telkens wanneer de dichtstbijzijnde map slechts een kale seizoensmarkering blijkt te zijn zonder echte titel erin, in plaats van te stoppen bij de eerste map ongeacht wat die daadwerkelijk bevat. Beide fixes zijn generiek — ze gelden voor elke show die op deze manier is georganiseerd, niet alleen de show waarbij de bug aan het licht kwam.

## v1.12.77 — Augustus 2026

### Theatermodus liet de onderliggende pagina zichtbaar doorschemeren

- **Opgelost, bevestigd in productie**: de vorige fix maakte de achtergrond van de speler zelf transparant zodat de kleursfeer kon doorschemeren — maar niets daarachter was in werkelijkheid volledig ondoorzichtig (de verdonkeringslaag van de pagina is via een blur maar zo'n 80% zwart, en de kleurlagen zelf stapelen meerdere effecten met gedeeltelijke doorzichtigheid zonder solide basis). De echte bibliotheekpagina bleek zichtbaar leesbaar door de zwarte balken heen — erger dan het vlakke zwart dat het verving. Er is een permanente, volledig ondoorzichtige basislaag toegevoegd onder alles, zodat de pagina nooit meer kan doorschemeren, met of zonder beschikbare artwork van een titel voor de kleurextractie.

## v1.12.76 — Augustus 2026

### De contentadaptieve achtergrond van Theatermodus was onzichtbaar — opgelost, en opnieuw gebalanceerd voor echte visuele impact

- **Opgelost, bevestigd in productie**: de kleursfeer die uit de eigen artwork van elke titel werd gehaald, was structureel verborgen — de achtergrond van de videospeler zelf was volledig ondoorzichtig en werd bovenop de sfeerlaag getekend, waardoor de kleur alleen ooit heel even opflitste tijdens de openingsanimatie om daarna volledig te verdwijnen voor de rest van de kijktijd. Daar bovenop droeg de sfeerlaag zelf ook nog eens een tweede bijna-ondoorzichtige zwarte overlay die rechtstreeks over het kleurverloop lag, waardoor het beetje dat tijdens dat ene moment doorscheen werd platgedrukt tot vrijwel niets. Netto-effect: vlak zwart, ongeacht de artwork van de titel.
- De achtergrond van de speler is nu transparant waar de achtergrond doorheen moet schijnen, en de balans tussen overlay en kleurverloop is herzien zodat de geëxtraheerde kleur daadwerkelijk zichtbaar is in de zwarte balken rond de video — een helder, kleurrijk poster kleurt nu zichtbaar de bioscoopzaal, een donker poster blijft sfeervol, in plaats van dat alles er identiek uitziet.

## v1.12.75 — Augustus 2026

### Grondoorzaak van een voltooide season-pack-download die nooit in de bibliotheek verscheen

- **Opgelost, bevestigd in productie**: een specifiek geval onderzocht (een anime waarvan de season packs volledig waren gedownload — de wachtrij toonde ze als "voltooid" — maar geen van de afleveringen ooit beschikbaar werd). De grondoorzaak: sommige season-pack-releases noemen hun afleveringsbestanden naar de show in een sterk afgekorte of niet-standaard vorm die de titelparser niet herkent (in het bevestigde geval een acroniem dat geen enkel woord deelt met de echte titel) — dus toen de bestanden van de voltooide download met geen enkele gevolgde aflevering overeenkwamen, werden ze terecht *niet* verwijderd, maar de recovery-pass die precies dit geval hoort op te vangen, registreerde de misser alleen in een waarde die nooit werd uitgelezen, waardoor de bestanden voor onbepaalde tijd zonder enige zichtbaarheid bleven staan.
- De recovery-pass registreert deze nu op dezelfde manier als een werkelijk niet-gekoppelde handmatige download al doet: ze verschijnen in Activité → Non liés, waar ze handmatig aan de juiste titel kunnen worden gekoppeld — generiek, voor elke release waarvan de naam de parser niet met vertrouwen kan koppelen, niet specifiek voor de ene show waarbij dit aan het licht kwam.

## v1.12.74 — Augustus 2026

### Matching-bug die de verkeerde serie kon oppikken, en een job-queue-vastloper die stilletjes alle achtergrondzoekopdrachten kon bevriezen

- **Opgelost, bevestigd in productie**: de titel-matchingscore beschouwde twee titels als bijna identiek op basis van alleen de ruwe tekenafstand, zelfs wanneer ze verschilden door één volledig ander woord — live bevestigd met "How I Met Your Father" (een niet-verwante spin-off) die ongeveer 91% gelijkenis scoorde met een zoekopdracht naar "How I Met Your Mother" en er in plaats daarvan werd opgepikt. De scorer controleert nu ook woord-voor-woord: een volledig ander woord (geen spellingsvariant) diskwalificeert de match, ongeacht hoe dicht het totale tekenaantal bij elkaar ligt.
- **Opgelost, bevestigd in productie**: één vastgelopen achtergrondtaak (in dit geval een trage Plex-synchronisatie) kon een slot in de job-queue voor onbepaalde tijd bezet houden, waardoor stilletjes elke andere wachtende job erachter werd geblokkeerd — inclusief geplande en handmatige zoekopdrachten — zolang de taak vastzat, zonder enige foutmelding of aanwijzing dat er iets mis was. Dit is wat ervoor kon zorgen dat een gevolgde, correct toegevoegde titel nooit daadwerkelijk werd doorzocht. De queue geeft nu het slot van een job na 10 minuten vrij als deze nog niet is voltooid, zodat één vastgelopen taak niet langer alles erachter kan uithongeren.

## v1.12.73 — Augustus 2026

### Beta-player — directe weergave start nu zoals de handmatige "bliksemschicht"-herhaling altijd al werkte

- **Opgelost**: de player besliste voorheen of directe weergave werd geprobeerd door vooraf codec-ondersteuning te controleren met browser-API's die bekend staan om te "liegen" in veelvoorkomende gevallen (AC-3/E-AC-3 dat op Chrome/Edge altijd "niet ondersteund" meldt, sommige containers die perfect decodeerbare video als niet-ondersteund meldden) — waardoor veel bestanden werden doorgestuurd naar een transcode of WebCodecs-fallback die directe weergave in werkelijkheid prima had afgehandeld. Live bevestigd: de handmatige herhalingsknop, die altijd onvoorwaardelijk directe weergave probeerde zonder die vooraf-controle, werkte merkbaar beter.
- Directe weergave is nu de onvoorwaardelijke eerste poging bij elke video, exact zoals de handmatige herhaling al deed — de twee zijn nu letterlijk hetzelfde codepad, met hetzelfde automatische herstel (terugval naar de andere afspeelmodus bij een echte afspeelfout of bij daadwerkelijk stille audio, ongewijzigd ten opzichte van voorheen).
- De handmatige herhalingsknop profiteert nu ook van datzelfde automatische herstel, en hervat vanaf de huidige positie in plaats van weer vanaf nul te beginnen.
- Het nu volledig ongebruikte WebCodecs-afspeelpad waarnaar deze vooraf-controle doorstuurde, is verwijderd — het was strikt een slechtere, overbodige versie van wat directe weergave + de bestaande fallbackketen al afdekken.

## v1.12.72 — Augustus 2026

### Theatermodus — een echte immersieve player, geen video in een modal

- **Nieuw**: de Beta-player opent nu in een volwaardige "Theatermodus" — de huidige pagina blijft precies staan waar hij was erachter (scrollpositie, status, alles), de player vergroot vanaf de knop waarop je klikte met een echte geometrische overgang (geen fade), en de pagina erachter verduistert en vervaagt geleidelijk in plaats van simpelweg te verdwijnen.
- Elke ambient trailer of preview die ergens op het scherm speelt, stopt op het moment dat de echte player opent — nooit twee video's tegelijk.
- De achtergrond van de player krijgt nu een subtiele kleursfeer, afgeleid uit de artwork van de titel zelf (dominante tinten, helderheidsbewust), in plaats van vlak zwart te zijn — eenmalig per titel geanalyseerd en gecachet, nooit tijdens het afspelen.
- "Bekijken op Plex" wordt nu "Afspelen" overal waar de Beta-player de weergave daadwerkelijk zelf afhandelt, en blijft "Bekijken op Plex" overal waar het om een echte overdracht naar Plex gaat — consistent op elke titelkaart, de titelpagina, de afleveringspagina, en de hero van het dashboard (die voorheen helemaal geen Beta-playerintegratie had).
- De drie afzonderlijke kopieën van deze triggerlogica verspreid over de app zijn nu één gedeelde implementatie, waarmee het risico wordt gesloten dat een toekomstige fix op één plek wordt doorgevoerd en op de andere wordt gemist.

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
