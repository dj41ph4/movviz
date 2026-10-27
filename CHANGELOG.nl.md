## v1.27.69 — 27 oktober 2026

### Plex

- De synchronisatie van Plex-weergaven leest de bibliotheek via sectielijsten in plaats van ongeveer 1.500 verzoeken (een per serie, daarna pakketten van 50 items): veel minder belasting voor Plex en de server. Lijkt een lijst onvolledig, dan valt ze terug op de vorige scan, identiek aan voorheen.

### Speler

- Als de server tijdens een update opnieuw start, wacht de desktopspeler op zijn terugkeer (minder dan een minuut) en toont het laden, in plaats van te melden dat je in Plex moet afspelen.

## v1.27.68 — 27 oktober 2026

### Android TV

- Detailpagina's openen sneller: de pagina wordt tegelijk met de rest opgevraagd in plaats van op de bibliotheek te wachten, en wordt na 300 ms op een tegel alvast geladen (ook vanuit zoeken).
- Na een film of aflevering bevriest het startscherm niet meer: de gepersonaliseerde rijen worden 15 s na het einde van het afspelen herladen en blokkeren de interface niet meer.

## v1.27.67 — 27 oktober 2026

### Instellingen

- Zoeken vindt nu een instelling op basis van de inhoud, niet alleen op de titel van het tabblad: elk ingevoerd woord moet voorkomen in de labels en beschrijvingen van het tabblad, ongeacht accenten en volgorde. De gevonden instelling wordt onder de titel getoond.

## v1.27.66 — 27 oktober 2026

### Geplande taken

- Elke taak kan nu alleen binnen een tijdvenster starten (bijvoorbeeld tussen 4 en 6 uur), zonder haar interval te wijzigen. Instellen via Instellingen → Taken; de tijd is die van de server.

### Diagnose

- Bij serverbevriezingen wordt nu vastgelegd wat er op dat moment draaide (gezochte film of aflevering, gescande map), het geheugengebruik en de pauzes van de garbage collector. Incidenten van minstens 1 s worden bewaard in een bestand dat herstarts overleeft.

## v1.27.65 — 26 oktober 2026

### Indexers

- Het gedrag van de indexers en resolver van vóór de laatste drie versies is hersteld.

## v1.27.61 — 27 oktober 2026

### Startpagina

- De genres in de uitgelichte titel op de startpagina (Animatie, Actie & avontuur…) hebben dezelfde grijze achtergrond als de redenen bij „Waarom deze titel?”.

## v1.27.60 — 27 oktober 2026

### Startpagina

- „Binnenkort” toont geen documentaires meer: alleen aangekondigde speelfilms.

## v1.27.59 — 27 oktober 2026

### Android TV en Samsung

- „Kijk je nog?” zoals bij Netflix: na twee automatisch achter elkaar afgespeelde afleveringen zonder toets op de afstandsbediening wacht de volgende aflevering op je antwoord (Verder kijken of Stoppen). Zonder antwoord speelt er niets en gaat de tv gewoon weer in slaapstand. Elke toets zet de teller terug; zolang je de afstandsbediening gebruikt, verandert er niets.

## v1.27.58 — 27 oktober 2026

### Android

- Android-startpagina: de Platform-tegels tonen nu echte vierkante pictogrammen voor elke dienst (Netflix, Disney+, Prime Video, Max, Apple TV+, YouTube, Crunchyroll, OCS), ingebouwd in de app, in plaats van de initialen „YO” en „OC” als het externe logo ontbrak.

## v1.27.57 — 27 oktober 2026

### Startpagina

- Nieuwe rij „Binnenkort” op elke startpagina (web, Android TV, Android, Samsung): alle films die voor de komende twaalf maanden zijn aangekondigd (bekende releasedatum en poster), op volgorde van release, met dezelfde kaarten als alle andere rijen. Projecten die meer dan een jaar weg zijn, vaak hypothetisch, staan er niet in.
- „Jouw aankomende releases” toont nog steeds je aanvragen die nog niet uit zijn, direct daarna en overal met dezelfde naam (Android TV noemde die „Binnenkort”). Samsung toont nu beide rijen.

## v1.27.56 — 26 oktober 2026

### Speler

- Hervatten springt niet meer terug naar 0: een stream die vóór het einde van de film afbrak (herstart van de server, verbinding verbroken tijdens een lange pauze) werd voor het einde van de film aangezien, waardoor die als bekeken werd gemarkeerd en zijn positie verloor, in Movviz én in Plex. De speler herstart de stream nu op dezelfde seconde, en alleen een echt einde telt.
- Geen „Kan deze video niet afspelen in de browser“ meer bij hervatten na meer dan 5 minuten afspelen of pauze, of na een herstart van de server: het afspelen gaat vanzelf verder op precies dezelfde plek.
- De speler sluiten bij „Hervatten?“ of na een fout zet de hervatpositie niet meer op 0.
- De werkelijk getoonde kwaliteit (4K, 1080p…) en het dynamisch bereik (HDR10, Dolby Vision, HLG) staan nu boven de voortgangsbalk.

## v1.27.55 — 26 oktober 2026

### Platforms

- Platformpagina's (Android TV en Android): Nieuw toont populaire titels van de afgelopen zes maanden uit Europa en de VS; Koreaanse en Franse content krijgen eigen rijen.
- Elke categorie filtert onbekende titels weg, en er komen nieuwe rijen voor alle platforms: Superhelden, Gebaseerd op een waargebeurd verhaal, Romantische komedies, Korter dan 1 u 40, Grote films, jaren 2010, 2000 en 90, Grote klassiekers.
- Disney+ krijgt eigen rijen: Marvel-universum, Pixar, Star Wars, Disney-klassiekers en National Geographic.
- Rijen zijn bij het openen twee keer zo vol, met een servercache zodat alles direct blijft.
- Ontdekken op de computer: de sortering "Voor jou" van een platform toont eerst je aanbevelingen en daarna de hele catalogus van het platform volgens je smaak, in plaats van na een paar titels te stoppen.

## v1.27.54 — 25 oktober 2026

### Zoeken en Android TV

- Een release waarvan de titel woorden toevoegt aan de gezochte titel wordt er niet meer voor aangezien: "The Odyssey" (2026) had "L'Odyssée de Céleste" (2026) gedownload, zelfde jaar maar een andere film. Het legitieme geval "Franse titel + originele titel" (L.Odyssee.The.Odyssey.2026) wordt nog steeds herkend.
- De titelpagina op Android TV trilt niet meer bij het wisselen tussen knoppen.

## v1.27.53 — 25 oktober 2026

### Platforms op Android TV en Android

- Een platform openen (Netflix, Disney+, Prime Video…) toont nu een echte pagina per categorie: Trending, Nieuw, Best beoordeeld, daarna Actie en avontuur, Komedies, Anime, Sciencefiction, Misdaad en thriller, Drama's, Familie, Horror, Romantiek, Documentaires en nog veel meer.
- Films en series worden in elke rij slim gemengd: de meest relevante titel komt eerst, nooit meer dan twee films of twee series na elkaar. Netflix toont eindelijk zijn series, die tot nu toe ontbraken.
- Elke rij laadt bij het naderen, wordt eindeloos langer naar rechts en eindigt met "Alles bekijken"; op mobiel blijft "Selectie voor jou" bovenaan.

## v1.27.52 — 25 oktober 2026

### Platforms op Android TV

- Het raster van een platform ("Op Disney Plus"…) springt en bevriest niet meer bij het omlaag scrollen: elke geladen pagina stuurde de focus terug naar een al gepasseerde kaart. De focus blijft nu op de gekozen kaart, in dezelfde kolom.
- De rij Platforms op de startpagina staat nu direct onder de eerste rij.
- Transparante logo's op Android TV en Android: platformlogo's (en PNG-titellogo's) verschijnen niet meer op een zwarte rechthoek, en de kop van een platform gebruikt hetzelfde merklogo als de tegels.

## v1.27.51 — 25 oktober 2026

### Profiel op Android TV en Android

- Het profiel crasht niet meer bij het omlaag scrollen naar de geschiedenis: een titel die meerdere keren is bekeken verscheen dubbel, waardoor de rij crashte. De geschiedenis toont elke titel nog maar één keer (de meest recente weergave).

## v1.27.50 — 25 oktober 2026

### Profiel op Android TV, Android en Samsung

- Het profiel blijft niet meer hangen op "Je activiteit wordt geladen…": de server stuurde een lege datum voor beoordelingen, die de Android-apps volledig weigerden. De server stuurt nu de echte datum en de apps verdragen dit geval; bij een fout vervangt een knop Opnieuw proberen het eindeloze laden.
- TV-profiel vernieuwd: omrande avatar, naam, accountrol en vijf echte tellers (bezig, films gezien, series gezien, in mijn lijst, gegeven beoordelingen), daarna Verder kijken, Mijn lijst, Geschiedenis en Mijn beoordelingen — dezelfde volgorde op mobiel en Samsung, dat ook tellers en beoordelingen krijgt.
- Een aflevering hervatten opent die aflevering, en de geschiedenis toont de titel van de aflevering.

## v1.27.49 — 25 oktober 2026

### Trailers

- De YouTube-zoekopdracht als reserve accepteert alleen nog een video waarvan de titel die van de film bevat: "The Good, the Bart, and the Loki" pakt niet langer de trailer van de Loki-serie. Al gecachte resultaten worden opnieuw berekend.

## v1.27.48 — 25 oktober 2026

### Downloads

- Een release die al geïmporteerd en daarna geseed was opnieuw downloaden mislukt niet meer meteen: de koppeling in de downloadmap naar het bibliotheekbestand, die na het verwijderen ervan niet meer werkte, wordt vóór het schrijven verwijderd.

## v1.27.47 — 25 oktober 2026

### Downloads

- Een al geïmporteerde release opnieuw downloaden waarvan het bestand is verwijderd (of vervangen door een andere versie) start de download nu echt opnieuw: de engine antwoordde "al geïmporteerd" zonder iets te downloaden, en de titel bleef "bezig met downloaden" zonder in de wachtrij te verschijnen.

## v1.27.46 — 25 oktober 2026

### Ondertitels en afspelen

- Tekstondertitels die in de desktopspeler worden gekozen, verschijnen weer: ze werden uitgepakt maar bleven in een ffmpeg-buffer hangen, en de speler vroeg ze nooit op bij de nieuwe engine. Spoorlabels tonen geen overbodige releasetitels meer ("FR Full : SRT").
- Films waarvan het opgeslagen pad het pad is dat Plex ziet (bv. /volume1/...), spelen weer af: het pad wordt vertaald naar dat van Movviz, anders loopt het afspelen via de Plex-bron in plaats van te mislukken.
- Padkoppeling Plex ↔ Movviz: een koppeling naar een ontbrekende map wordt genegeerd en verwijderd zodra een echt bestand haar tegenspreekt; handmatig toevoegen weigert een ontbrekende Movviz-map; en de automatische suggestie werkt wanneer beide hoofdmappen maar één map delen (/volume1/docker/plex/films ↔ /data/films).

## v1.27.45 — 25 oktober 2026

### Afspelen vanaf kaarten

- Op het dashboard, in de bibliotheek en in Ontdekken tonen kaarten + buiten de bibliotheek, een klok als het bestand ontbreekt en Afspelen zodra een lokale film beschikbaar is, zonder op Plex te wachten.
- De afspeelknop in de hoofdbanner en op de afleveringspagina werkt ook zodra het lokale bestand bestaat, zonder Plex-link.
- Klikken op de afbeelding opent de titeldetails; alleen de afspeelknop start de speler.

### Audio- en ondertitelsporen

- De spelermenu's (web, Android TV, Android mobiel, Samsung) tonen taal, codec en kanalen (bv. "Frans · E-AC-3 5.1"), plus de sportitel en de vermelding Geforceerd bij ondertitels.
- De sporen worden uit het bestand zelf gelezen: een titel zonder Plex-koppeling heeft nu zijn audio- en ondertitelmenu's, en het wisselen van spoor herstart de lokale engine.
- Automatische ondertitels (profielinstelling, standaard uit): als de afgespeelde audio niet in de profieltaal is — de interfacetaal gekozen met de vlaggen — starten de ondertitels in die taal. De instelling hoort bij het account: wijzigen op Android wijzigt ze ook op desktop, tv en Samsung.
- De standaard audiotaal volgt de profieltaal zolang die op Automatisch staat; op Android werd deze instelling nooit toegepast tijdens het afspelen, dat is nu opgelost.

## v1.27.44 — 25 oktober 2026

### Handmatige poortdoorsturing

- Op alle platforms maken de engine en WebTorrent geen UPnP/NAT-PMP-regels meer aan. TCP-peerverkeer en UDP-DHT gebruiken de ingestelde poort voor handmatige doorsturing.
- Bestaande regels of reserveringen op de router of NAS moeten daar worden verwijderd; deze update wijzigt de configuratie van dat apparaat niet.

## v1.27.43 — 25 oktober 2026

### Handmatige Docker-poortdoorsturing

- In Docker proberen Movviz en WebTorrent geen UPnP/NAT-PMP-poorten meer te openen. Gepubliceerde Docker-poorten en routerdoorsturing blijven handmatig; native installaties behouden hun bestaande werking.
- DHT via UDP gebruikt nu de ingestelde WebTorrent-poort, zodat TCP- en UDP-doorsturing overeenkomen met de werkelijk gebruikte poorten.

## v1.27.42 — 25 oktober 2026

### Instelbare WebTorrent-poorten

- In de instellingen van downloadclients kun je aparte WebTorrent-poorten voor films en series kiezen. Waarden worden gecontroleerd, na een herstart bewaard en toegepast door de torrentclient te herstarten zonder de wachtrij te wissen.
- In Docker blijft het publiceren van hostpoorten een aparte instelling, met uitleg naast het veld.

## v1.27.41 — 25 oktober 2026

### Automatisch zoeken en recente toevoegingen

- Automatisch zoeken probeert eerst de oorspronkelijke titel, daarna de vertaalde titel en een alias als er geen geschikt resultaat is. Indexers worden achtereenvolgens bevraagd en de kwaliteitsregels blijven gelden.
- De Hero bevestigt een toevoeging pas na een geldig antwoord en maakt onderscheid tussen een openstaand verzoek en een toegevoegde titel.
- Films die lang geleden zijn aangevraagd verschijnen bij Recente toevoegingen zodra hun bestand binnenkomt. Bibliotheekrijen en recente sortering gebruiken ook de beschikbaarheidsdatum.

## v1.27.40 — 25 oktober 2026

### GPU/iGPU-toegang op Docker-NAS-systemen

- De Compose-starter detecteert `/dev/dri/renderD128` op de NAS en geeft Movviz toegang tot het apparaat en de groep. Systemen zonder bruikbare GPU blijven normaal starten met CPU-transcodering.
- De Docker-apparaatkoppeling wordt toegepast wanneer de container opnieuw wordt aangemaakt; de handleiding beschrijft image-updates en handmatige instellingen in Container Manager.

## v1.27.39 — 24 oktober 2026

### Snellere downloads

- Bij het openen van Downloads verschijnt de paginastructuur direct. Alleen het geselecteerde tabblad wordt geladen; Geschiedenis toont op grote schermen niet langer de laadstatus of het wachtrijpaneel.
- De wachtrij laadt meer regels bij het scrollen. De wachtrij en het WebTorrent-paneel stoppen met pollen op de achtergrond of op andere tabbladen, maar blijven snel reageren tijdens actieve downloads.

## v1.27.38 — 24 oktober 2026

### Downloads, afbeeldingen en instellingen

- De wachtrij toont eerst actieve downloads; voltooide en delende torrents blijven via hun filters beschikbaar. Een korte WebTorrent-storing behoudt de laatst bekende wachtrij.
- Geschiedenis laadt alleen het geopende tabblad, toont 50 gebeurtenissen en laadt verder bij scrollen. Andere tabbladen doen geen achtergrondverzoeken.
- Bekende afbeeldingen en logo's verschijnen uit de browsercache, per taal gescheiden. Ontbrekende beelden komen in kleine groepen uit de servercache; recente toevoegingen en hervattingen krijgen voorrang.
- De animatie-instelling schakelt ook Hero-ambilight en automatische rotatie uit. De aparte Hero-video-instelling stopt de speler meteen; handmatig afspelen blijft onafhankelijk.
- Gevolgde toekomstige films doen vanaf het toevoegen mee aan automatisch zoeken, geplande pogingen en RSS-matching. Zonder release behouden ze hun status als aankomend zonder foutmelding.

## v1.27.37 — 24 oktober 2026

### Directe recente toevoegingen en hervatten

- Recente toevoegingen komen alleen uit de Movviz-bibliotheek en staan voor elk profiel in dezelfde volgorde, zonder persoonlijke filters of de jaargrens van de Hero. Series worden gerangschikt op hun laatst beschikbare aflevering.
- Het toevoegen van een film of serie vernieuwt het beginscherm op het web, Android TV en Android mobiel. De eerste beschikbare afleveringen vernieuwen ook de recente rijen.
- Verder kijken toont Movviz-posities meteen. De eerste vijf geverifieerde Plex-hervattingen en latere groepen komen op de achtergrond binnen en vernieuwen ook de Android-apps.
- Afspelen en het melden van voortgang wachten niet meer op Plex-netwerkverzoeken. Imports starten nog steeds een Plex-scan en kort daarna een metadata-afstemming op de achtergrond.

## v1.27.36 — 24 oktober 2026

### Optimalisatie Movviz AI

- Optimalisatie Movviz AI.

## v1.27.35 — 24 oktober 2026

### Afleveringen en Plex Watchlist

- Beheerders kunnen een aflevering vanuit de detailpagina verwijderen, met een aparte optie om het bestand te wissen. Bestanden die door meerdere afleveringen worden gedeeld, zijn beschermd. Verwijderde afleveringen worden niet opnieuw automatisch gezocht of door Plex synchronisatie gekoppeld.
- ‘Mijn lijst’ synchroniseert toegevoegde en verwijderde films en series in beide richtingen met de persoonlijke Plex Watchlist. Movviz verstuurt wijzigingen na het antwoord zodat de pagina snel blijft; geplande synchronisatie probeert mislukte acties opnieuw. Conflicten volgen het wijzigingstijdstip; een Plex verwijdering zonder tijdstip wordt gedateerd bij constatering.

## v1.27.34 — 24 oktober 2026

### Responsiviteit tijdens automatische taken

- Het geplande herstel van niet geïmporteerde downloads blijft elke 15 minuten draaien, maar draait alleen tussen zware taken, na de opstartfase, en geeft de interface en het afspelen voorrang. Handmatig herstel start nog steeds direct.
- De Seerr-import verwijdert duplicaten uit de hele bibliotheek alleen wanneer er echt een goedgekeurd verzoek is toegevoegd. De dagelijkse controle blijft actief.
- Oorspronkelijke titels in niet-Latijns schrift veroorzaken geen valse naamgenoten meer: automatisch zoeken accepteert passende releases zonder jaartal en beschermt echte naamgenoten. Fouten vermelden welk filter de resultaten afwees.

## v1.27.33 — 24 oktober 2026

### Plex hervatten en reactiesnelheid

- De volledige verzameling van Plex kijkstatussen draait in een aparte worker. Bestaande statussen worden pas vervangen na een volledige, gevalideerde snapshot.
- Geplande synchronisaties van Plex kijkstatus en geschiedenis zijn zware taken: ze overlappen geen andere zware taak en wachten tot het afspelen is gestopt.
- Bij het openen van een titel blijft de snelle controle van de kijkstatus actief, zonder een volledige snapshot te starten.
- On Deck toont lokale hervatpunten na maximaal twee seconden wachten op Plex. De eerste vijf Plex hervatpunten verschijnen daarna automatisch, gevolgd door de rest in stappen met minder herhaalde verwerking.

## v1.27.32 — 23 oktober 2026

### Voorrang voor speler en interface

- Zware automatische taken wachten met starten tot het afspelen in de Movviz-speler is afgelopen en er kort geen gebruikersactiviteit is. Ze blijven in de wachtrij en gaan daarna verder.
- Een zware automatische taak draait alleen tussen de automatische taken; de automatische benchmark overlapt niet langer met Plex-synchronisatie of Seerr-import. Ook de Benchmark-knop gebruikt deze wachtrij en toont wanneer hij wacht. Directe gebruikersacties en onmiddellijke acquisitie houden voorrang.

## v1.27.31 — 23 oktober 2026

### Dubbele afleveringen per seizoen

- In Titel bewerken heeft elk seizoen naast de map een schakelaar voor dubbele afleveringen. Die koppelt elk bestand aan twee catalogusafleveringen en kan per seizoen worden uitgezet.
- Nieuwe pakketten worden alleen automatisch herkend wanneer aantal bestanden, nummering en speelduur het dubbele formaat bevestigen. FINAL helpt, maar is op zichzelf niet voldoende.
- Movviz toont de gedekte afleveringen als beschikbaar, speelt hun gedeelde bestand af, markeert beide na afloop als bekeken en gaat door naar het volgende bestand. Videobestanden worden niet hernoemd.

## v1.27.30 — 23 oktober 2026

### Hero van het dashboard

- Ambilight wacht tot de YouTube-videokopie haar positie bevestigt voordat de gloed verschijnt; als de video's uit de pas lopen, verdwijnt de gloed en wordt hij opnieuw uitgelijnd.
- De donkere sluier bovenaan de hero is verwijderd, zodat de kleuren van de video en ambilight langs de bovenrand behouden blijven.

## v1.27.29 — 23 oktober 2026

### Laden en Plex Verder kijken

- Verder kijken toont eerst de vijf meest recente Plex-hervattingen en vult de rest van de lijst daarna geleidelijk op de achtergrond aan op verbonden apparaten.
- RSS-koppeling en automatische downloads blijven werken, maar deze fase wacht nu op haar beurt tussen zware taken om vastlopers van de server te beperken.
- Diagnostiek groepeert opeenvolgende vergelijkbare vastlopers en toont een meetstack niet langer als fout.

## v1.27.28 — 23 oktober 2026

### Prestaties en diagnostiek

- Bibliotheeklezingen die al uit de cache worden bediend, maken niet langer elk een aanroepstack en twee tijdlijngebeurtenissen aan. Dit verwijdert meetoverhead uit een pad dat zeer vaak wordt aangeroepen.
- Trage schijftoegang bij het controleren van JSON-bestanden wordt nu geregistreerd, naast trage JSON-decodering. Algemene vastlopers en achtergrondtaken blijven meetbaar.

## v1.27.27 — 23 oktober 2026

### Recent toegevoegde afleveringen

- Afleveringen die aan de bibliotheek zijn toegevoegd, blijven zichtbaar onafhankelijk van de downloadlijst. Bij het opschonen wordt gewacht op bevestiging van de import voordat de gegevens voor het koppelen van bestanden worden verwijderd.
- Recente toevoegingen worden tijdens het scrollen pagina voor pagina geladen, zonder permanente limiet van 150 bestanden. Een groep afleveringen van dezelfde serie neemt op desktop, Android TV en Android mobile één kaart in.
- Bij het opschonen van downloads worden items getoond die niet konden worden verwijderd, in plaats van de lijst kunstmatig leeg te maken.

## v1.27.26 — 23 oktober 2026

### Android TV: bèta-interface en speler

- De zijbalk en tekst van de bèta-interface zijn kleiner, maar blijven iets groter dan in de stabiele modus.
- Wisselen tussen de knoppen in het hoofdgedeelte centreert de pagina niet langer voortdurend opnieuw.
- De kort zichtbare witte rand is van het laadscherm verwijderd.
- De tekst van de audio- en ondertitelopties blijft leesbaar wanneer deze met de afstandsbediening worden geselecteerd.

## v1.27.25 — 23 oktober 2026

### Diagnostiek: zien waardoor de server vastloopt

- Instellingen toont nu elke vastloper van de server met de duur, het type (geblokkeerde berekening of wachten op een externe dienst) en de bewerkingen die op dat precieze moment liepen.
- Een tijdlijn van gemeten vensters toont overlappende achtergrondtaken, zoals indexerscans, Plex-synchronisatie, het importeren van aanvragen en het afstemmen van downloads.
- Bij indexerscans wordt rekentijd (bibliotheken laden, releases vergelijken) onderscheiden van wachttijd (zoeken en downloaden via indexers).
- Elk venster bewaart de codelocatie waar het is geopend, zodat de oorzaak van een vertraging direct kan worden gevonden.

## v1.27.22 — 22 oktober 2026

### Acquisitie: homonieme series onderscheiden en zoeken bij toevoeging

- Twee bibliotheekseries met dezelfde naam maar verschillende jaren, zoals Scrubs (2001) en Scrubs (2026), vereisen nu een expliciet jaar dat overeenkomt met de juiste serie voordat er automatisch gedownload kan worden. Ambigue afleveringen, seizoenspakketten en volledige versies worden uitgesloten.
- Directe zoekopdrachten naar homonieme series bevatten hun jaar en gebruiken de TMDb-, IMDb- of TVDB-identifiers wanneer de indexer ze ondersteunt.
- Het goedgekeurde toevoegen van een film of serie start een zoekopdracht in een speciale sectie, zelfs als achtergrondtaken de reguliere wachtrij bezetten. Als een geschikte release wordt gevonden, wordt deze gedownload zonder te wachten op een geplande taak. Acquisities blijven sequentieel en duplicaten worden vermeden.
- Toevoegingen via de AI-assistent volgen hetzelfde proces. Verzoeken die goedkeuring vereisen, behouden hun eerdere validatie.

## v1.27.21 — 22 oktober 2026

### Desktop: Plex-koppeling via QR-code

- De knop "Koppel met Plex" toont een QR-code die gescand kan worden met een smartphone en een korte code die bruikbaar is op plex.tv/link.
- De desktop wacht op validatie op de smartphone en opent vervolgens automatisch het gekoppelde profiel, zonder extra klik.
- De gebruikelijke Plex-koppeling in de browser blijft rechts van de QR-code toegankelijk. Een verlopen code kan worden vernieuwd en het sluiten van het venster stopt het wachten.

## v1.27.20 — 22 oktober 2026

### Windows: opstartcontrole en update diagnostiek

- De installatiecontrole wacht tot de Movviz- en Movviz Update-diensten actief zijn en de server reageert met de verwachte versie, in plaats van te falen op een overgangsstatus.
- De servicedagboeken worden opgeslagen in de bestemde map. Windows-diagnostiek wordt gegroepeerd voordat deze wordt verzonden om de fout te voorkomen die verband houdt met bestanden op meerdere drives.
- De echte update test kan worden gestart vanaf een tak: deze controleert de herstart van Movviz en het behoud van het Movviz Update-proces tijdens de installatie.

## v1.27.19 — 21 oktober 2026

### Home: Mijn lijst op desktop, Android TV en Android mobiel

- De persoonlijke lijst verschijnt standaard in het vierde blok, vóór "Te bekijken", met de meest recente toevoegingen links.
- Het neemt bestaande kaarten over en ververst wanneer de lijst op een ander apparaat verandert. De zichtbaarheidsvoorkeuren worden behouden.
- De Tizen-applicatie wordt later bijgewerkt.

### AI-assistent: titelidentificatie en feitencontrole

- De assistent zoekt eerst in de bibliotheek en herkent dezelfde titel met of zonder spaties, zoals Vision Quest en VisionQuest. Type- en jaartalcorrecties worden behouden en de links gebruiken de geverifieerde identiteit.
- Een verzoek tot webcontrole of releasedatum start een zoekopdracht wanneer deze wordt geactiveerd. De assistent onderscheidt een aangekondigde datum van een bevestigde release en geeft aan wanneer de controle niet beschikbaar is.
- Een simpele controle kan niet langer een automatische toevoeging veroorzaken, zelfs als het model een foutieve actie genereert.

## v1.27.18 — 21 oktober 2026

### Desktop: recent toegevoegde afleveringen gegroepeerd zoals op Android TV

- Op het startscherm en in de Series-bibliotheek worden meerdere recent toegevoegde afleveringen van dezelfde serie gegroepeerd in één seizoenskaart.
- Het badge geeft het aantal onbekeken afleveringen van dit seizoen aan en wordt een vinkje wanneer alles bekeken is. Een alleen toegevoegde aflevering behoudt zijn nummer en directe afspeelbaarheid.
- De groepering gaat vóór de kaartlimiet: een in één keer geïmporteerd seizoen bedekt niet langer andere recent aangevulde series.

## v1.27.17 — 20 oktober 2026

### Interface: mobiel en tablet thema, banner en navigatie

- Het Beta-thema breidt zich uit naar telefoons en tablets met consistente kleuren en oppervlakken, een leesbaardere banner en compacte acties. De tellers zijn verwijderd van het startscherm.
- Op de computer verlengt een sfeerverlichting de kleuren van de banner en volgt de afspeelstatus van de trailer.
- De taalselectie is toegankelijk in het gebruikersmenu op alle schermen. De marges van de detailpagina, de labels van de tellers en de toegankelijkheid van de knop om nieuwigheden te sluiten zijn aangepast.

### Windows: bescherming van de update service

- De installatieprogramma deactiveert de automatische sluiting van applicaties door Windows om de Movviz Update service tijdens de installatie te behouden.
- PowerShell-downloads verbergen hun voortgang en de installatiecontrole in CI heeft nauwkeurigere tijdschema's en diagnostiek.

## v1.27.16 — 20 oktober 2026

### Series: nieuwe afleveringen eindelijk opgehaald

- De lijst met afleveringen van een serie werd pas op het moment van toevoeging opgebouwd: afleveringen en seizoenen die later werden aangekondigd (bijvoorbeeld seizoen 4 van Link Click, dat nog maar 1 van de 12 afleveringen had), evenals titels en data van afleveringen die achteraf werden gepubliceerd, werden nooit opgehaald.
- Een nieuwe geplande taak, "Update van serieafleveringen", wordt één keer per dag uitgevoerd: deze voegt ontbrekende afleveringen en seizoenen toe (alleen nieuwe seizoenen voor gevolgde series) en werkt titels, uitzenddata en seizoensnamen bij. Afleveringen die al zijn uitgebracht, zijn zoekbaar, de andere wachten op hun uitzenddatum.
- Niets wordt ooit verwijderd: bestanden, downloads en Plex-links blijven intact, en series waarvan de nummering afwijkt van TMDb (bepaalde animes) worden niet gewijzigd.

## v1.27.15 — 20 oktober 2026

### Zijbalk: leesbare updateknop met toegankelijkheidsvergrootglas

- Met vergroot tekst (110 % of 120 %) stond de knop "Nieuwe update beschikbaar" over de zijbalk heen. Het toont nu een korte label ("Update v1.27.15") en vergroot zich indien nodig in plaats van over te lopen; de volledige tekst blijft zichtbaar bij het overgangen.

## v1.27.14 — 20 oktober 2026

### Trailers: een vervangende video wanneer YouTube de afspeling blokkeert

- Sommige officiële trailers kunnen niet buiten YouTube worden afgespeeld (zoals die van Toei voor Dragon Ball Super: Beerus). Wanneer alle video's van een titel worden geweigerd, zoekt Movviz nu naar een andere trailer, waarbij de nadruk ligt op officiële kanalen en anime-uitgevers (Netflix, Crunchyroll…).
- Geweigerde video's worden gememoord en worden nooit meer voorgesteld, zowel op het web als op Android-apps.

## v1.27.13 — 20 oktober 2026

### Startscherm: series komen in de banner

- De startbannier toonde alleen films: deze toont nu ook series, afgewisseld met films. Een nieuwe serie die Movviz weet dat u leuk vindt, verschijnt dus zodra deze uitkomt.
- Aan de bibliotheekkant houdt de banner rekening met nooit bekeken series, recent toegevoegde, series waarvan zojuist een aflevering is uitgebracht en de volgende aflevering die uitkomt van gevolgde series.
- Profiteert ook van Android TV en Android mobiele apps, zonder dat deze een update nodig hebben.

## v1.27.12 — 20 oktober 2026

### Home: helderdere en duidelijkere banner (computer)

- De bannerafbeelding is merkbaar duidelijker, met een lichte schaduw onder de teksten zodat ze leesbaar blijven.
- Technische badges (4K, HDR, MULTI, TrueHD…) hebben hun eigen regel, onder de genres.
- "Informatie" wordt "Meer info", het afspeelicoon is gevuld, en de tekst van de knoppen is iets groter.
- De redenen voor de suggestie worden permanent rechtsonder weergegeven, onder de scrollpijlen, ter vervanging van de knop "Waarom deze inhoud?".
- De geluidsknop verplaatst naar rechtsboven, met een fijnere lijn; deze is opnieuw aanklikbaar.

### Interface

- Het Beta-thema wordt het enige uiterlijk van Movviz: de keuze tussen Stabiel en Beta is verwijderd uit de instellingen.
- Smalle zijbalk, links zijn verhoogd en iconen zijn perfect uitgelijnd, of de balk nu uitgevouwen of ingeklapt is. De knop om deze in te klappen of uit te klappen bevindt zich nu onderaan, boven het profiel.

## v1.27.11 — 20 oktober 2026

### Spelfouttolerante zoekopdracht op Android TV, Android mobiel en Samsung

- De Android TV, Android mobiel en Samsung apps geven nu "Resultaten voor …" weer wanneer een spelfout is gecorrigeerd, net als op het web.
- Op Android TV vindt de correctie ook titels die al in de bibliotheek aanwezig zijn.

### Webinterface

- Correctie van weergavefouten bij het laden van pagina's: de start-elementen van de interface staan nu op de juiste plek op de pagina.

## v1.27.10 — 20 oktober 2026

### Zoeken: sneller, duidelijker, spelfouttolerant

- Spelfouten worden automatisch gecorrigeerd: "hary potter", "matirx", "onepiece" of "le seigneur des anaux" tonen direct de juiste titels, met de vermelding "Resultaten voor …" en een link om de exacte tekst te zoeken.
- Tijdens het typen blijven eerdere resultaten zichtbaar en vervagen ze tijdens het laden, in plaats van te verdwijnen bij elke letter. De melding "Geen resultaten" verschijnt niet langer voordat de zoekopdracht is voltooid.
- Een regel "Andere titels om te ontdekken" vult de momenteel ingevoerde titel aan, en een sectie "In dezelfde geest" verrijkt zoekopdrachten met weinig resultaten.
- Als niets overeenkomt, stelt de pagina voor om direct op de indexers te zoeken en toont de trending films.
- Een klik in de lege balk toont recente zoekopdrachten en trends. Esc wist de zoekopdracht en verlaat de balk, de pijl omlaag gaat naar de resultaten.
- Een zoekopdracht creëert nu slechts één vermelding in de browsergeschiedenis, en het wissen van de balk brengt onmiddellijk terug naar de catalogus.
- Tijdens een zoekopdracht worden alleen de zoekfilters weergegeven; personen zonder foto worden niet meer voorgesteld.

### Uiterlijk: het Beta-thema standaard

- Het Beta-thema is nu het thema voor alle accounts, vanaf het eerste bekijken en zonder via het Stabiele thema. Het Stabiele thema blijft beschikbaar in de instellingen.

## v1.27.09 — 20 oktober 2026

### Downloads: WebTorrent wordt de enige motor

- Verwijdering van aria2- en rTorrent-engines, van de engine-kiezer in de instellingen en van hun afhankelijkheden in de Windows-, Linux- en Docker-installers. WebTorrent blijft de ingebouwde engine voor films en series.
- De oude engine-selecties worden hersteld met WebTorrent zonder de wachtrij, bestanden of geschiedenis te wissen. Als de herstaling van een download mislukt, wordt de opgeslagen wachtrij behouden om een nieuwe poging mogelijk te maken.

### Windows: onafhankelijke updates voor Movviz

- De nieuwe "Movviz Update"-service controleert de officiële download via SHA256, installeert de update en bevestigt dat het verwachte versie functioneert na het opnieuw opstarten. Het blijft actief wanneer de installatie Movviz stopt en behoudt de logs in geval van een mislukking.
- De uitgeschakelde automatische instelling staat nog steeds alleen updates toe die via een klik worden aangevraagd. Een eerste handmatige installatie van deze versie is nodig om de service aan te maken, zonder gegevens of instellingen te verliezen.
- De Windows-compiletest genereert nu zijn icoon, net als de productie-installer, zodat het ook op een lege runner kan werken.

## v1.27.08 — 20 oktober 2026

### Windows: installatie van de Movviz Update-service

- De onafhankelijke "Movviz Update"-service downloadt en controleert de officiële installer, start Movviz opnieuw op en controleert de werkende versie, met behoud van logs. De uitgeschakelde automatische instelling staat nog steeds alleen installaties toe die via een klik worden aangevraagd.
- Correctie van de PowerShell-testcontrole die het maken van de vorige Windows-installer verhinderde. Installeer deze versie de eerste keer handmatig om de nieuwe service aan te maken; gegevens en instellingen worden behouden.

## v1.27.07 — 20 oktober 2026

### Windows: een onafhankelijke service voor updates

- De nieuwe "Movviz Update"-service installeert updates zonder gestopt te worden door Movviz, en controleert vervolgens of de nieuwe versie functioneert na het opnieuw opstarten. De download wordt gecontroleerd door zijn SHA256-handtekening en de installatielogs worden bewaard om een mislukking te diagnosticeren.
- De automatische update-instelling wordt gerespecteerd zodra de interface wordt geopend: wanneer deze uitgeschakeld is, wordt alleen een installatie via een klik gestart. De interface volgt nu de installatie tot de terugkeer van de verwachte versie en toont fouten.
- Om deze nieuwe service op een bestaande installatie aan te maken, installeer deze versie de eerste keer handmatig. Gegevens en instellingen worden behouden.

## v1.27.06 — 20 oktober 2026

### Android TV: de episode-fiche reageert weer op de afstandsbediening

- Bij het openen van een episode-fiche vanuit een seizoen werd geen knop geselecteerd en reageerde de afstandsbediening niet meer: het scherm bleef bevroren. De "Afspelen" (of "Terug") knop wordt opnieuw geselecteerd bij het openen en alle acties zijn toegankelijk.

### Home: geen knipperen meer in de hero

- Bij het wijzigen van de highlight in de hero flikkerde het beeld kort naar zwart voordat het volgende werd weergegeven. Het nieuwe beeld wordt nu direct over het oude geplaatst, nadat het is geladen, op Android TV en op Samsung-televisies.

## v1.27.05 — 19 oktober 2026

### Nieuw "M-lint" logo

- Het nieuwe Movviz-logo, een paars M-lint, verschijnt in het bèta-ontwerp op het web: volledig logo in de zijbalk, bij het verbinden, bij de installatie, in de speler en in "Over", en alleen de M wanneer de balk ingeklapt is, met een lichte reflectie die het af en toe doorkruist.
- Op Android TV, Google TV en Android mobiel wordt het het app-icoon, de banner van het Google TV startscherm en het logo dat in de app wordt weergegeven. Op Samsung-televisies wordt het ook het app-icoon en -merk.

### Bèta-ontwerp: een strak en onmiddellijk laadscherm

- Nieuw laadscherm op het web en op Android TV: de M in het midden op een paarse nacht, met zijn gloed, MOVVIZ daaronder en een dunne balk die de echte laadstatus volgt. Het wordt getoond zodra de pagina opent, nog voordat de applicatie geladen is, en weegt nu slechts enkele tientallen kilo-octets.
- Het stabiele ontwerp behoudt zijn huidige laadscherm.

### Android TV: een stilstaand held

- Bij navigeren tussen de heldenknoppen op het startscherm trilde de hele pagina. Het blijft nu perfect stil.

## v1.27.04 — 19 oktober 2026

### Zoeken: elke serie behoudt zijn eigen downloads

- Een release met exact dezelfde naam als een andere film of serie in de bibliotheek wordt niet langer toegewezen aan een langere titel die deze bevat: de volledige « Dragon Ball Super » wordt niet langer verward met « Dragon Ball Super: Beerus », wat een andere serie is. Dit geldt voor automatische zoekopdrachten, RSS-feeds en versievervangingen. Releases die simpelweg een ondertitel weglaten, worden nog steeds herkend, en handmatig toegevoegde alternatieve namen op een fiche blijven prioriteit hebben.

## v1.27.03 — 19 oktober 2026

### Het stabiele ontwerp neemt het bèta-ontwerp van vanochtend over

- Het stabiele ontwerp neemt het bèta-ontwerp over zoals het was op 19 oktober in de ochtend, vóór het nieuwe logo en het nieuwe laadscherm: kleuren, zijbalk, kaarten en lay-out op de computer, evenals het bioscooplaadscherm (projector, halo's, volledig logo en percentage). Het bèta-ontwerp blijft aan de andere kant evolueren.

### Betrouwbare bestandsanalyse na een grote import

- Na het importeren van een groot aantal afleveringen in één keer (een volledige reeks), kon de bestandsanalyse (codecs, audio- en ondertiteling) stoppen tot het volgende opnieuw opstarten, en de server overbelasten. Het is nu beschikbaar, zonder piekbelasting.

## v1.27.02 — 19 oktober 2026

### Updates: nooit meer een oudere versie voorstellen

- Na een update kon de zijbalk nog steeds de vorige versie 'installeren', op basis van informatie die in het geheugen werd bewaard vóór de uitrol. Er wordt nu alleen een update voorgesteld — en automatisch geïnstalleerd onder Windows — als deze daadwerkelijk nieuwer is dan de huidige versie.

## v1.27.1 — 19 oktober 2026

### Bleach: de geïmporteerde volledige reeks wordt correct in de bibliotheek opgeslagen

- Een volledig gedownloade en correct opgeslagen volledige reeks van Bleach kon nergens in Movviz te verschijnen: het volstonden met slechts één aflevering die niet meer als verwacht werd herkend, om de hele lading te laten afwijzen. Elk bestand wordt nu individueel gecontroleerd op basis van de daadwerkelijke locatie waar het is opgeslagen (seizoen, map, naam), en de betreffende afleveringen worden beschikbaar zonder opnieuw te downloaden.
- Geen bestaand bestand wordt ooit vervangen of verwijderd door deze correctie, en een aflevering die door een andere download wordt verwacht, blijft gereserveerd voor die download.

## v1.27.0 — 19 oktober 2026

### Bèta-ontwerp: een vloeiend laadscherm dat pas verdwijnt als alles klaar is

- De animatie van het laadscherm wordt nu apart van de rest van de pagina berekend: het blijft perfect vloeiend (60 beelden per seconde) zelfs terwijl het dashboard erachter wordt voorbereid, waar het voorheen haperde. Het is ook lichter om te tekenen, vooral op grote schermen.
- Het laadscherm verschijnt snel, en verdwijnt pas als alles wat op het scherm zichtbaar is geladen is — gegevens, opgeslagen, posters en lettertypen: er wordt niets meer onder de ogen geladen na zijn verdwijnen.

### Snellere dashboard

- De gegevens van het dashboard beginnen te downloaden zodra de pagina opent, tegelijk met de applicatie, in plaats van te wachten tot deze klaar is.

### Techniek

- Overstap naar Next.js 16.3.

## v1.26.056 — 19 oktober 2026

### Snellere dashboard

- De dashboardgegevens (bibliotheek, aanbevelingslijnen, startbalk, "Opnieuw") worden nu gecomprimeerd voordat ze worden verzonden: enkele megabytes minder bij elke opening, wat vooral op afstand merkbaar is. Android-apps profiteren er ook van, zonder update.

### Beta-ontwerp: sneller en strakker laadscherm

- Het laadscherm verschijnt sneller: de afbeeldingen blijven in de browser gecached, het tafereel wordt getoond zodra de achtergrond klaar is en de neonverlichting daarna zachtjes aangaat. De achtergrond van het laadscherm is onmiddellijk zichtbaar, nog voordat de applicatie geladen is.
- Het verdwijnen is een simpele fade, zonder zoom of laatste flits.

### Web beta-ontwerp: zijbalk

- Iets smallere zijbalk, gecentreerd logo; ingeklapt blijft alleen het symbool "O" over.

## v1.26.055 — 19 oktober 2026

### Beta-ontwerp: terug naar paars, nieuw laadscherm en nieuwe logo's

- Het beta-ontwerp krijgt zijn paarse kleur terug (het goud van de vorige versie is afgeschrikt) op het web en op Android TV.
- Nieuw paars laadscherm, op het web en op Android TV: een grote lichtgevende gang van 21:9 (precies aangepast naar 21:9, afgesneden aan de zijkanten naar 16:9, het logo blijft altijd volledig zichtbaar op smalle schermen). Het licht stroomt zacht langs de echte lijnen van het tafereel — vloer, plafond, pilaren, rand van de driehoek — met een chromen reflectie op het logo en een balk die de werkelijke voortgang volgt. De animaties blijven subtiel.
- Nieuwe paarse chromen logo's (symbool "O", volledig formaat klein en groot), geanimeerd zonder halo rond de "O", waar het logo ook in beta verschijnt, inclusief de README.
- Android TV: nog steeds snel opstarten (afbeeldingen worden op de achtergrond gedecodeerd, een lichte versie wordt direct weergegeven), met "animaties verminderen" blijft het tafereel stil.

## v1.26.054 — 19 oktober 2026

### Beta-ontwerp: donker goud in plaats van paars, op het web en op Android TV

- De paarse en mauve tinten van het beta-ontwerp worden donker goud, in dezelfde tint als het logo: primaire actieknopjes, actieve statussen, voortgangsbalken, focusranden, filters en gloed. De oorspronkelijke helderheid en transparantie worden behouden zodat alles leesbaar blijft. Het stabiele ontwerp verandert niet.
- Op Android TV neemt de navigatiebalk exact dezelfde achtergrond in als de rest van het scherm: een effen kleur.

### Android TV beta: nieuw laadscherm en nieuw logo

- Nieuw cinematografisch full-screen laadscherm (de navigatiebalk blijft eronder verborgen): een muur van direct verlichte schermen, reflecties die over de oranje randen lopen, licht op de letters van het logo, gloeien, en een balk die de werkelijke voortgang volgt met de melding van de huidige stap. Een flits markeert het einde.
- Zo snel mogelijk opstarten: de afbeeldingen worden al bij het starten van de applicatie op de achtergrond gedecodeerd, een lichte versie van hetzelfde tafereel wordt onmiddellijk in afwachting weergegeven, en er wordt niets berekend tijdens de uitvoering (maskers en halos worden klaar voor gebruik aangeleverd). Met "animaties verminderen" blijft het tafereel stil.
- Het volledig geanimeerde kleine logo vervangt het symbool en de tekst overal (profielkiezer, inloggen, installatie, speler, uitgeschreven balk). Ingeknoopt balk: alleen het geanimeerde symbool "O" blijft over, groter en gecentreerd.

### Web beta-ontwerp: logo overal, strakke zijbalk

- Het volledig geanimeerde kleine logo wordt overal weergegeven (inloggen, installatie, speler, Over); in de zijbalk maakt het plaats voor het geanimeerde symbool "O" wanneer deze ingeklapt is.
- In de zijbalk is het logo iets naar links verschoven en de scheidingslijn onder de kop is verdwenen.

## v1.26.053 — 19 oktober 2026

### Beta-ontwerp: splash start onmiddellijk, volledig logo in de zijbalk

- Het laadscherm verschijnt zodra de pagina wordt geopend, zonder te wachten op het laden van de applicatie: er wordt direct een wazige ambiance van de scène weergegeven, waarna de geanimeerde scène vloeiend over de scène verschijnt zodra deze klaar is. De achtergrondafbeelding wordt vooraf geladen, en de initiële zwarting is verdwenen.
- In de beta-zijbalk vervangt het geanimeerde volledige kleine logo de "O" en de tekst wanneer de balk is uitgebreid; wanneer deze ingeklapt is, blijft alleen de geanimeerde "O" over.
- Het MOVVIZ-logo is beter uitgelijnd: de afstand tussen de "O" en de eerste "V", en tussen de laatste "V" en de "I", is nu homogeen met de rest van de letters.

## v1.26.052 — 19 oktober 2026

### Beta-design: nieuw laadscherm en nieuw logo

- Bij het opstarten toont het beta-design een nieuw cinematografisch laadscherm: een muur van schermen, reflecties die over de oranje randen lopen, licht dat over de logoletters veegt, gloeien, en een balk die de werkelijke voortgang van het laden volgt. Een flits van licht markeert het einde.
- Het scherm past zich aan alle formaten aan: 16:9, ultra-breed 21:9 (de scène wordt aan beide zijden verlengd zonder uitrekking) en portrettelefoon. Het wordt gerenderd in de werkelijke resolutie van het scherm, dus scherp op hoge-resolutie schermen.
- De slogan "Uw universa op één plek" is vertaald in vijf talen. Met de optie "animaties verminderen" blijft de scène stil.
- Nieuw logo in drie vectorformaten: het symbool "O" alleen, het volledige kleine logo en het volledige grote logo, met hun geanimeerde versies (lichtveeg over de letters, zonder halo rond de "O"). Het beta-design toont het nieuwe geanimeerde symbool in de zijbalk, bij de verbinding en in de instellingen.
- Het stabiele design verandert niet. Het README GitHub-logo wordt vervangen door de geanimeerde versie.

## v1.26.051 — 19 oktober 2026

### Fiches: status wordt direct weergegeven

- Bij het openen van een fiche (web, Android TV, mobiel, Samsung) wordt de status (in de bibliotheek, ontbrekende of beschikbare afleveringen) onmiddellijk weergegeven. Voorheen wachtte de pagina tot Movviz Plex raadpleegde, wat een tiental seconden kon duren voor Bleach, gedurende welke "Toevoegen aan bibliotheek" werd voorgesteld.
- De controle met Plex gebeurt nu in de achtergrond, hooguit één keer per minuut en per serie, en de fiche wordt automatisch bijgewerkt wanneer er iets nieuws wordt gevonden. Het Plex-pad voor Bleach wordt behouden voor tien minuten in plaats van opnieuw te worden uitgevoerd bij elke opening.
- De downloadteller in de zijbalk houdt niet langer het laden van pagina's vast: deze reageert met de laatst bekende waarde en ververst in de achtergrond.

## v1.26.050 — 19 oktober 2026

### Bleach: Japanse logo's van de originele serie in de selectie

- De logo-selector van Bleach toont nu ook de Japanse logo's, waaronder het klassieke rode en blauwe logo "BLEACH ブリーチ" van de originele serie, dat niet in het Frans of Engels bestaat.
- Het automatisch geselecteerde logo en de andere series veranderen niet.

## v1.26.049 — 19 oktober 2026

### Bleach: handmatige zoekopdracht vindt afleveringen van Thousand-Year Blood War

- De handmatige selectie van een aflevering van Thousand-Year Blood War zocht alleen naar door boeken benoemde releases ("S04E01") en vond niets voor afleveringen gepubliceerd in continue nummering ("S17E41"). Het raadpleegt nu beide formaten en toont alle releases die overeenkomen met de aflevering.
- De handmatige selectie van een hele boekenreeks zoekt ook naar pakketten gepubliceerd onder "Bleach S17".

## v1.26.048 — 19 oktober 2026

### Android en Samsung: Thousand-Year Blood War leesbaar in downloads

- De downloadlijsten van Android TV, Android mobiel en Samsung tonen "Bleach: Thousand-Year Blood War" met zijn seizoen en aflevering (bijv. S4 · E1), in plaats van "Bleach S17E41". De andere series veranderen niet.
- Het volgen van downloads in de fiches is niet gewijzigd: de afleveringen blijven precies zoals voorheen gekoppeld.

## v1.26.047 — 19 oktober 2026

### Bleach: de integrales worden ingedeeld in de juiste seizoenen

- Een integrale (absoluut genummerd van 1 tot 366, bestanden "Bleach - 150", "S01E150", of seizoensmappen) plaatst nu elke aflevering in zijn Movviz-seizoen. Voorheen werden alleen de eerste afleveringen ingedeeld en bleven de andere ongekoppeld, of de import faalde.
- De integrale van Thousand-Year Blood War (afleveringen 1 tot 50) wordt automatisch opgesplitst over de 4 seizoenen van de serie, ongeacht de bestandsnummering.
- Een pakket van één seizoen behoudt zijn lokale nummering, zonder verwarring met de absolute nummering.

### Downloads: Thousand-Year Blood War wordt weergegeven als eigen serie

- De lijst, het geschiedenisoverzicht en de zoekopdrachten tonen "Bleach: Thousand-Year Blood War" met zijn seizoen en aflevering (bijv. S4E1), in plaats van "Bleach S17E41".
- Een klik opent de fiche van de juiste serie. De manier van het indelen van bestanden is niet veranderd.

### Home: strakke prominente banner

- De paginatallen zijn gecentreerd onderaan, de pauzeknop en de tekst "In de voorstelling" verdwijnen.

### Titellogo's: ze verschijnen altijd uiteindelijk

- Als een logo niet direct beschikbaar is, probeert Movviz langer, met toenemende vertragingen. De titeltekst dient als tijdelijke placeholder, waarna het logo het vervangt zodra het binnenkomt, op de banner, de fiches en de rijen.
- Een reactie zonder logo wordt niet langer een hele dag door bewaard door de browser: een voorbijgaand incident verbergt het logo niet meer tot de volgende sessie.

## v1.26.046 — 19 oktober 2026

### Android TV en mobiel: betrouwbare Bleach reparatiestatus

- Bleach fiches gebruiken nu de gevraagde deelprojectie en het reparatievlag van de server. Een compacte rij op het dashboard kan niet langer doen vermoeden dat TYBW gerepareerd moet worden terwijl zijn volgorde al correct is.
- Op Android TV is de reparatieactie aanklikbaar en voorbehouden aan beheerders; het toont een voorbeeld en vraagt om bevestiging voordat de gegevens worden gewijzigd. Blokkeringen geven aan waarom de reparatie onmogelijk is.
- De focus bij het openen richt zich op een daadwerkelijke actie van de fiche; de decoratieve titel ontvangt geen selectieomlijning meer.
- Tizen heeft geen vergelijkbare toevoeg- of reparatieactie voor Bleach in zijn fiche.

## v1.26.045 — 19 oktober 2026

### Android TV: stabiele focus bij het openen van seizoenen

- De openingsbeveiliging neemt de focus niet meer over wanneer de gebruiker bewust naar een seizoen navigeert. Een lopende herredirectie wordt geannuleerd zodra het seizoen is geselecteerd.
- Tizen heeft geen vergelijkbare uitgestelde herredirectie; zijn seizoensnavigatie blijft ongewijzigd.

## v1.26.044 — 19 oktober 2026

### Android TV: betrouwbare Bleach bibliotheektoevoeging

- Na het toevoegen leest Android TV het geselecteerde Bleach deel opnieuw en bewaart de Original- en TYBW-weergaven afzonderlijk. De knop "Toevoegen aan bibliotheek" verschijnt niet meer tijdens de reconciliatie.
- Seizoenszoekopdrachten geven altijd hun laadindicator vrij, zelfs als de aanvraag mislukt of wordt geannuleerd.
- Tizen verwijdert de toevoegknop zodra de server de toevoeging bevestigt, om hetzelfde gedrag te behouden.

## v1.26.043 — 18 oktober 2026

### Android TV: navigatie en scheiding Bleach/TYBW

- De TV-rijen verwijderen duplicatenkaarten voordat ze hun Compose-sleutels creëren, wat de crash voorkomt bij het navigeren door suggesties.
- De recente toevoegingen van originele Bleach en Thousand-Year Blood War blijven gescheiden. De TYBW-afleveringen gebruiken de lesnummers 1–4 op het scherm, terwijl seizoen 17 canoniek blijft voor afspelen en volgen.
- Het laden van seizoenen negeert nu late reacties van een ander deel van Bleach, zelfs als beide kaarten hetzelfde TMDb-identificatie gebruiken.

## v1.26.042 — 18 oktober 2026

### Bleach-nummering en TYBW-zoekopdracht

- Android TV neemt de achtzelfde platformlogo's over als het desktopdashboard, geladen vanuit de SVG-bronbestanden van het project.
- De originele genummerde integrale S01E001–S01E366 worden herverdeeld over 16 seizoenen en hun seizoensmappen, met de verwachte lokale hernaamgeving.
- TYBW behoudt zijn interne tracking S17 en zijn les 1–4 in aparte mappen. Het zoeken naar een aflevering zoals S17E41 accepteert releases S17 of S04E01, en sluit pakketten van andere lessen uit.
- Android TV, Android mobiel en Tizen zenden het geselecteerde Bleach-deel tijdens het laden en vernieuwen van seizoenen; S17 wordt niet meer in de originele kaart weergegeven.

## v1.26.041 — 18 oktober 2026

### Bleach: downloads en volledige kaarten

- De reeds verdeelde Bleach-catalogi over 16 seizoenen worden herkend zonder migratie of wijziging van de geschiedenis. Handmatige downloads werken ook voor een niet-gevolgd of reeds beschikbaar seizoen; de TYBW-pakketten behouden hun nummering en hun onafhankelijke map.
- Beide kaarten beschikken over integrale zoeken, een persoonlijke lijst, beoordeling, metadata vernieuwing en gerichte verwijdering. Profielen voor kwaliteit, alias en persoonlijke keuzes blijven onafhankelijk.
- De 16 seizoenen van Bleach krijgen een omslag en een samenvatting van hun boog. Bleach en Thousand-Year Blood War hebben afzonderlijke logo's, met een high-definition versie voor TYBW.

## v1.26.040 — 18 oktober 2026

### Bleach en TYBW op alle schermen

- Android mobiel, Android TV en Samsung Tizen tonen beide resultaten voor Bleach en Thousand-Year Blood War. De navigatie behoudt het gekozen deel, en de acties voor afspelen, volgen en zoeken gebruiken de corresponderende afleveringen.
- Beide kaarten vinden dezelfde uitgever als andere titels, met onafhankelijke achtergrond- en logo-keuzes, behouden na herladen en in lijsten.
- Nieuwe downloads worden opgeslagen in twee aparte mappen, Bleach (2004) en Bleach - Thousand-Year Blood War (2022), met hun IMDb-identificatie in een `.plexmatch` bestand. TYBW neemt de nummering van elk deel over, terwijl de Movviz-trackingcoördinaten stabiel blijven. Oude bestanden worden niet automatisch verplaatst.
- De synchronisatie herkent de onafhankelijke Plex-kaarten van TYBW, zelfs als ze hernoemd zijn, en behoudt een Plex-link per deel. De algemene hernaamgeving kan hun mappen niet meer samenvoegen. Een te oudere engine blokkeert deze nieuwe imports in plaats van de gevraagde opslag te negeren.

## v1.26.039 — 18 oktober 2026

### Zoeken vanuit een rij

- Na 'Alles bekijken' vraagt een invoer in de zoekbalk nu het catalogus in plaats van door te gaan met het laden van de vorige rij. Beide kaarten Bleach en Thousand-Year Blood War verschijnen ook in dit traject, net als bij een directe zoekopdracht.

## v1.26.038 — 18 oktober 2026

### Bleach en Thousand-Year Blood War gescheiden

- Zoeken en de bibliotheek tonen twee afzonderlijke kaarten: Bleach (2004), met zijn 16 seizoenen en 366 afleveringen, en Bleach: Thousand-Year Blood War (2022), georganiseerd per delen. De leveranciers-ID's en de geschiedenis blijven behouden.
- Zoekopdrachten, verzoeken, handmatige en automatische downloads, kwaliteitsvervanging en opvolgacties zijn beperkt tot het gekozen deel. TYBW S02E01 komt overeen met de eerste aflevering van The Separation en kan niet meer verward worden met Bleach original S02E01. Japanse titels en deelnamen worden ook erkend.
- De engine onderscheidt bronbestandnummers, Movviz-tracking en de naamgeving die door Plex wordt verwacht. De pakketten zijn beperkt tot de daadwerkelijk gedekte afleveringen; de coördinaten worden behouden bij een herstart en een nieuwe importpoging.
- Oude catalogi waarvan de volgorde zeker is, worden geherorganiseerd met voorafgaande back-up, zonder verplaatsing van bestanden of verwijdering van tracking. Ambigue Plex-geschiedenissen en -instanties blokkeren risicovolle correcties; geen echte inhoud wordt afgeleid van slechts een bestandsnaam.
- Het TYBW-profiel gebruikt zijn synopsis, zijn poster en zijn eerste uitzending. Het toevoegen van een ontbrekend deel voltooit hetzelfde catalogus, zelfs als er al een lege seizoen bestond. De lange titels van de seizoenen blijven leesbaar op mobiel.

### Home

- Verwijdering van de regel "Vind inspiratie". De keuze Stable/Beta en de directe start in het opgeslagen uiterlijk worden behouden.

## v1.26.037 — 18 oktober 2026

### Vereenvoudigde Home

- Verwijdering van de teksten "Film, bij u" en "Uw volgende grote verhaal" van de Beta-homepage.
- Verwijdering van het zichtbare label "Platforms" en zijn gereserveerde kolom: de logo's nemen direct de beschikbare breedte in.

## v1.26.036 — 17 oktober 2026

### Een meer cinematografische Beta

- De Beta-homepage neemt een redactionele compositie aan: grote typografische opening, ingekaderde held, prominente afbeeldingen en meer luchtige rijen. De navigatie gaat over op een ivoorselectie op grafiet en de zoekfunctie krijgt een nieuw oppervlak.
- De Beta-splash opent projectiepanelen, onthult het logo vanuit een lichtgevende spleet en ontvouwt twee banen. De bundels en de voortgangsreflectie begeleiden de laadprocedure; de uitgang gebeurt in een nadering en vervaging, zonder extra wachttijd toe te voegen.
- Stable behoudt zijn weergave, zijn oude splash en zijn geometrie. De accountkeuze blijft van kracht vanaf de eerste HTML; de voorkeuren voor animatiereductie blijven gerespecteerd.

## v1.26.035 — 17 oktober 2026

### Stable / Beta Uiterlijk

- Instellingen → Mijn ervaring → Uiterlijk en voorbeelden biedt nu een persoonlijke keuze Stable of Beta, opgeslagen op het account en toegepast zonder opnieuw te laden. Stable behoudt de huidige interface; een opslagfout herstelt de vorige modus.
- De opgeslagen keuze wordt toegepast vanaf de eerste serverweergave: een Beta-account start direct in Beta, zonder tussenliggende verschijning van Stable, zelfs als de voorkeuren-API traag reageert.
- De Beta-modus verfijnt de desktop typografie, de afstanden, de kaarten en de badges. De belangrijkste acties geven een subtiele drukfeedback; de animatiereductie blijft gerespecteerd. Het titelprofiel blijft gedeeld tussen de pagina en het paneel.

### Een filmopening

- Het Beta-splashscreen verwelkomt de start met het vergrote officiële logo, paarse en cyaan bundels, een lichthalo en een opnieuw ontworen voortgang. Het past zich aan kleine schermen aan en behoudt een rustige versie met animatiereductie.
- Het oude splash blijft beschikbaar in Stable. De nieuwe animatie voegt geen wachttijd toe aan het laden en speelt niet opnieuw af bij elke navigatie.

### Frontend betrouwbaarheid

- Correctie van de zeven ESLint-fouten geïdentificeerd in de held en het titelprofiel: initialisatie van de carrousel, mobiele detectie, typeer van de oriëntatie en declaraties van zoek-/leesfuncties.
- De hervattingpositie wordt gekoppeld aan de huidige media om te voorkomen dat die van de vorige titel wordt weergegeven; deze wordt opnieuw gelezen na het sluiten van de speler.

## v1.26.034 — 15 oktober 2026

### Zoeken en downloaden na een verzoek

- Het toevoegen van een film of serie start nu een zoektaak op de serverkant, zonder de telefoonopdracht open te houden tijdens de oproepen naar indexeerders. De zoekopdracht gaat door na het antwoord en blijft zichtbaar in de taken.
- Een downloadverzoek voor een reeds aanwezige maar onvolledige titel herstart de ontbrekende elementen. Meerdere klikken delen dezelfde taak; beschikbare media, niet-gevolgde inhoud, toevoegingen zonder zoekopdracht en verzoeken in afwachting van goedkeuring blijven beschermd.
- Het goedkeuren van een verzoek gebruikt ook deze wachtrij; een fout bij het toevoegen markeert het verzoek niet langer voorrangig als goedgekeurd.

### Herseed en Android TV

- Geïmporteerde torrents kunnen herbenoemde bestanden delen na verificatie van hun vingerafdrukken, in alleen-lezen modus. De paden en metadata van de torrent worden behouden na het opnieuw opstarten; de interface onderscheidt verificatie, volledige deelname, gedeeltelijke deelname en niet-beschikbare bestanden.
- De voortdurende validatie voert de tests van de downloadengine uit, inclusief het delen na import.
- Android TV gebruikt Media3 1.9.4.

## v1.26.033 — 14 oktober 2026

### Android mobiel: zoom zonder uitsnijding in het oude formaat

- De videocontainer behoudt het gehele beschikbare oppervlak. De zoom schaalt het native oppervlak op terwijl de verhoudingen behouden blijven, in plaats van de afbeelding te vergroten in een 16:9 formaat dat nog steeds de zijkanten kon uitsnijden ondanks de vrije ruimte.
- Het kader wordt bijgewerkt zodra de detector de ingebouwde zwarte banden bevestigt, zonder te wachten op een andere actie op de speler. De detector en zijn beschermingen tegen donkere scènes worden behouden.
- Twee afzonderlijke knoppen "Adapteren" en "Vullen" zijn zichtbaar in de besturingselementen; de actieve modus wordt gemarkeerd en de keuze blijft per profiel op het apparaat gememoriseerd.

## v1.26.032 — 14 oktober 2026

### Android mobiel: weergave aangepast voor telefoons en tablets

- De speler toont standaard het hele beeld zonder vervorming, door de breedte of hoogte aan te passen aan het beschikbare oppervlak. Een knop stelt u in staat om te schakelen tussen "Adapteren" en "Vullen"; de keuze wordt per server en profiel op het apparaat gememoriseerd.
- De detector van ingebouwde zwarte banden is behouden. In Adaptermodus houdt de zoom rekening met de afmetingen van de speler om het gehele bruikbare beeld zichtbaar te houden, zelfs op een tablet; in Vullingsmodus wordt de afbeelding ingekaderd om het scherm te vullen.
- Wijzigingen in de grootte en modus van de speler worden meegenomen, zelfs in pauze. De besturingselementen kunnen over meerdere regels lopen in een smal venster.
- De verticale gebaren voor helderheid en volume zijn verwijderd. Dubbele drukken om vooruit of terug te springen en het vegen over de tijdlijn worden behouden.

## v1.26.031 — 13 oktober 2026

### "Afspelen wissen": het profiel wordt leeg

- De knop wist nu ook de lijst, de notities, de favorieten en het geheugen van de AI-assistent, evenals het gesprek met deze. Het profiel zelf (naam, foto, wachtwoord, instellingen) verandert niet.
- Voor Plex worden naast bekeken en herhaalde items ook de notities en de watchlist van het profiel gewist, uitsluitend met het Plex-account van dit profiel. Een profiel dat beheerd wordt zonder Plex-account behoudt zijn Plex-watchlist, en het scherm geeft dit aan.
- Een gesynchroniseerde oude Plex-watchlist komt niet terug in Movviz.
- De waarschuwingsberichten (web, Android mobiel, Samsung) vermelden nu precies wat verdwijnt en wat blijft.

## v1.26.030 — 13 oktober 2026

### Profiel: nieuwe knop "Afspelen wissen"

- Elk profiel kan opnieuw beginnen wat betreft bekijken: de bekeken titels, de lopende herhalingen en de kijkgeschiedenis worden gewist. De notities, de lijst en de favorieten van het profiel blijven behouden.
- Twee waarschuwingen voordat u handelt: eerst een bevestiging, en daarna een laatste scherm waar u "WISKEN" opnieuw moet intypen (web en Android mobiel) of "ik begrijp het" moet aanvinken (Samsung).
- Alleen het ingelogde profiel wordt gewist, nooit dat van een ander, en elke gebruiker kan dit doen voor zijn eigen profiel.
- Als het profiel is gekoppeld aan Plex, worden de bekeken status en de herhalingen daar ook gewist, alleen voor het Plex-account van dit profiel: de bekeken status van andere Plex-accounts wordt niet aangetast. Het resultaat aan de Plex-kant wordt weergegeven nadat het voltooid is, en als Plex niet alles kon wissen, wordt dit duidelijk vermeld.
- Eerdere bekeken status wordt niet hersteld bij de volgende Plex-sync. Een echte kijk na het wissen wordt normaal gesproken meegerekend.
- Beschikbaar op het web (Profielpagina), de Android mobiele app (profielmenu) en de Samsung app (Profielpagina).

## v1.26.029 — 13 oktober 2026

### AI Assistent: lijst met Gemini modellen bijgewerkt

- Google heeft Gemini 3.5 Flash en Gemini 3.7 Flash verwijderd op 8 oktober. Gemini 3.6 Flash vervangt 3.5 Flash in de aanbevolen modellen, en 3.7 Flash verdwijnt uit de lijst.
- Als de assistent was ingesteld op een van deze twee modellen, schakelt deze automatisch over op zijn vervanger (3.6 Flash of 3.8 Flash), net zoals Google dit al doet aan zijn kant.

## v1.26.028 — 12 oktober 2026

### AI Assistent: modellen worden niet meer getest bij elke opening van de instellingen

- Instellingen → AI Assistent testte elk Gemini-model met een echte aanvraag bij elke opening, wat het gratis quotum van de dag verbruikte. Het resultaat wordt nu in het geheugen bewaard en de tests worden één keer per week uitgevoerd.
- Een model waarvan het quotum van de dag is opgebruikt, wordt als beschikbaar erkend, in plaats van gemarkeerd als "niet geverifieerd" en opnieuw getest.
- Een test die niet kon worden voltooid (netwerk, limiet per minuut) wordt maximaal één keer per dag opnieuw uitgevoerd.

## v1.26.027 — 12 oktober 2026

### Eén interface op het web: Beta wordt de weergave van Movviz

- Het Stable thema is verwijderd van het web (desktop en mobiel). De Beta-interface wordt nu voor iedereen toegepast, inclusief accounts die Stable hadden gekozen. De andere instellingen van het dashboard (hero, video's, rijen) worden behouden.
- De keuze Stable/Beta verdwijnt uit de dashboardinstellingen en de installatie-assistent.
- Android TV behoudt voorlopig zijn eigen keuze Stable/Beta. De Android mobiele app en de Samsung app hadden slechts één weergave: er verandert niets voor hen.

## v1.26.025 — 12 oktober 2026

### Plex-bekeken status synchronisatie: veel sneller na een grote Plex-update

- Na een grote Plex-update kon de synchronisatie van bekeken status bijna 9 minuten duren en de server tot 7 seconden laten vastlopen: elke bekeken film werd geverifieerd met een aparte aanvraag naar Plex. Deze verificaties worden nu gegroepeerd per 50, en de synchronisatie geeft de server veel vaker de controle terug.
- Een dergelijke ongebruikelijke batch (meer dan 500 wijzigingen in bekeken status in één keer) wordt in het logboek gemeld, om een Plex te detecteren dat zijn identificatoren heeft herverdeeld.

## v1.26.024 — 12 oktober 2026

### Geplande taken: lichter, één zware taak tegelijk

- Nooit twee zware taken tegelijk (schijfscan, herhaalde ontbrekende items, upgrades, TMDb metadata, reconciliaties, diagnose, benchmark). De kleine, frequente taken (downloadstatus, RSS, Seerr, Plex) en uw eigen acties blijven parallel lopen.
- Een zware handmatige zoekopdracht ("Ontbrekende items zoeken", technische analyse, resynchronisatie van Plex- of TVDB-bekeken status, saga-scan) gaat voor: de lopende zware automatische taak wordt gepauzeerd en hervat direct daarna.
- Geen geplande taken gedurende de eerste 3 minuten na het opstarten van de server, behalve die van downloads.
- Nieuwe "Stop"-knop voor elke lopende of wachtende taak, in Instellingen → Geplande taken en in de wachtrij.
- Instellingen → Geplande taken toont de « slechtste gel » van elke taak (hoe lang deze de server heeft doen vastlopen), de zware taken, en de namen van de drie slecht weergegeven taken.
- De intervallen van de taken worden slechts één keer met deze versie teruggezet naar de standaardwaarden. De die je daarna instelt, worden bewaard.

### Minder servergel

- De schijfscan vriest de server niet meer elk uur: het leest de schijf zonder vast te lopen en vergelijkt alleen nog de nog niet gekoppelde bestanden.
- De RSS-scan vergelijkt niet meer de hele cache bij elke passage: een nieuwe release wordt vergeleken met alle ontbrekende titels, een titel wordt toegevoegd aan alle cache-releases, en een volledige passage vindt plaats bij het opstarten en daarna nog één keer per dag. Een dagelijkse output wordt altijd binnen 15 minuten na aankomst op de indexers opgehaald.
- De controle op kwaliteitsupdates volgt hetzelfde principe.
- De TMDb-metadataverversing registreert alleen nog de titels die zijn gewijzigd.
- Wanneer automatische update ingeschakeld is, voert de controle op voorgestelde vervangingen niet meer dezelfde zoekopdracht uit. De automatische update meldt zelf de vervangingen die deze niet kon downloaden. Uitgeschakeld werkt de controle zoals voorheen.
- De automatische update telt niet meer als «bijgewerkt» een film waarvan de download is mislukt.
- Intervallen herzien: automatische update elke 12 uur (in plaats van 6 uur), Plex-trackingslijst elke 5 min (in plaats van 1 min, zonder een loglijn per gebruiker en per minuut). Het opnieuw uitvoeren van ontbrekende films gaat voor de onderhoudstaken.

### Prioriteitspunten

- De sliders sturen niet meer een verzoek voor elk geschoven pixel en gaan niet meer vanzelf terug.
- De «Downloads» slider heeft eindelijk een nut: boven de 50 vermindert een actieve download de andere taken tot 2 parallel. Daaronder vertraagt het ze niet.
- Toevoeging van de Plex-intro slider, die ontbrak.

## v1.26.023 — 12 oktober 2026

### Wijzigingen
- Herpublicatie van de exacte code van v1.26.021 onder nummer v1.26.023: de correcties van de versies 1.26.017 tot 1.26.021 zijn terug.

## v1.26.022 — 12 oktober 2026

### Terug naar de code van 1.26.016

- Herpublicatie van de exacte code van v1.26.016 onder nummer v1.26.022 om deze te laten updaten vanuit nieuwere versies.
- De wijzigingen die in de versies 1.26.017 tot 1.26.021 zijn geïntroduceerd, zijn verwijderd uit deze release.
- Deze terugkeer dient om het gedrag van Android TV-pagina's te testen; de oplossing blijft bevestigd op de server en de TV.

## v1.26.021 — 12 oktober 2026

### Samsung: de rij «Movviz Trends» verschijnt ook

- Dezelfde correctie als in 1.26.020 op de Samsung-app (Tizen): na een herstart van de server lezen de startpagina en Ontdek de rijen opnieuw terwijl de server ze nog aan het voorbereiden is, in plaats van zonder trends te blijven.

## v1.26.020 — 12 oktober 2026

### Movviz TV: de rij «Movviz Trends» verschijnt

- Na een herstart van de server worden de trends binnen enkele seconden berekend. De website wachtte tot ze arriveerden, maar de TV-app toonde de startpagina zo en hield deze zonder trends. De TV-app (en de mobiele app) lezen nu de rijen opnieuw terwijl de server ze nog aan het voorbereiden is.
- Wanneer de server nieuwe suggesties meldt, wordt de TV-homepage onmiddellijk bijgewerkt. Voorheen kwam de nieuwe rij in de coulissen zonder ooit te worden weergegeven.

## v1.26.019 — 12 oktober 2026

### Android: 'Meer zien' crasht de app niet meer

- Op mobiel en op tv kon het openen van 'Meer zien' van een rij suggesties en vervolgens scrollen de applicatie plotseling sluiten, wanneer de volgende pagina een reeds weergegeven titel teruggaf. Dubbele vermeldingen worden nu genegeerd.

## v1.26.018 — 12 oktober 2026

### Zoeken: alle TMDb-resultaten worden weergegeven

- De zoekfunctie verbergt geen titels meer zonder beoordeling op TMDb: alles wat TMDb vindt, wordt weergegeven. De 'Ontdekken'-lijnen behouden hun sortering van titels zonder interesse.

## v1.26.017 — 12 oktober 2026

### Zoeken: de meest recente films worden gevonden op titel

- Een film die nog niet door iemand op TMDb is beoordeeld (festivalfilm, aankomende Franse release, zoals 'Een goede advocaat') werd verborgen uit de zoekopdracht als een resultaat zonder interesse. Het verschijnt nu wanneer men de titel intypt. Resultaten zonder beoordeling die niet overeenkomen met de zoekopdracht blijven verborgen.

## v1.26.016 — 12 oktober 2026

### Herhaalde zoekopdrachten: maximaal 3 dagen wachttijd

- Een titel die al gezocht is zonder resultaat wacht 1 dag, en daarna maximaal 3 dagen voordat deze opnieuw wordt gezocht (in plaats van 7). De RSS-scan, de zoekopdracht naar de dagelijkse releases en de handmatige zoekopdracht wachten nooit: een titel die in een feed verschijnt, wordt onmiddellijk gedownload.

## v1.26.015 — 12 oktober 2026

### Ontbrekende films en series: eerst RSS, dan lichtere herhaalde zoekopdracht

- De RSS-scan van de indexers gaat nu elke 15 minuten in plaats van elk uur. Een ontbrekende film of serie wordt gedownload zodra deze in een feed verschijnt, zonder te wachten op een herhaalde zoekopdracht.
- Wanneer releases zijn gepubliceerd tussen twee scans zonder in de feed te verschijnen (te veel nieuws tegelijk), merkt Movviz dit op, leest de volgende pagina van de indexer en noteert dit in het logboek.
- De herhaalde zoekopdracht naar ontbrekende items gaat nu elke 8 uur in plaats van 6. Een titel die al gezocht is zonder resultaat wacht 1 dag, dan 3, en dan 7 voordat deze opnieuw wordt gezocht; het keert terug naar het begin zodra het gevonden is.
- De herhaalde zoekopdracht naar ontbrekende afleveringen dekt nu de hele bibliotheek. Voorheen keek het alleen naar de eerste series op de lijst.

### Indexers: een geweigerde sleutel valt niet meer op

- De test van een indexer voert nu een echte kleine zoekopdracht uit: een geweigerde API-sleutel verschijnt als een fout, zelfs als de indexer zijn lijst met capaciteiten zonder sleutel publiceert.
- Een zoekopdracht die door een indexer wordt geweigerd (ongeldige sleutel of zonder de benodigde rechten) wordt genoteerd als een fout in het logboek, in plaats van als 'geen resultaten'.

## v1.26.014 — 12 oktober 2026

### Plex: lichtere weergavesynchronisatie

- De synchronisatie van Plex-weergaven vergelijkt de staat van Plex met die van Movviz met indexen die één keer zijn voorbereid, in plaats van de hele bibliotheek opnieuw te doorlopen voor elke aflevering, en laat de server ademen tijdens de verwerking. De resultaten zijn identiek; de kleine haperingen van de interface tijdens deze taak verdwijnen.

## v1.26.013 — 12 oktober 2026

### Downloadherstel: geen serverhaperingen meer

- De taak die de voltooid maar niet geïmporteerde downloads ophaalt, vergelijkt nog steeds elk bestand met de bibliotheek op dezelfde manier, maar zonder alle titels opnieuw te berekenen voor elk bestand, en laat de server ademen tussen de bestanden. Na een herstart kon deze de interface vastzetten tot 11 seconden.

## v1.26.012 — 11 oktober 2026

### Plex: synchronisatie van weergavenlus voltooid

- Wanneer een 'bekeken' niet naar Plex kan worden verzonden (profiel verwijderd uit servershares, aflevering ontbreekt in Plex...), probeert Movviz eerst elke minuut opnieuw, en daarna steeds minder vaak: elke 5 minuten na 10 minuten, elke 30 minuten na een uur, elke 6 uur na een dag. Voorheen probeerde het elke minuut eindeloos opnieuw, wat de server enkele seconden kon laten vastlopen en het zoeklogboek kon overspoelen.
- Afleveringen van dezelfde serie worden samen teruggestuurd, met één Plex-accountcontrole en één logregel per serie.
- Een bekeken aflevering die niet op de Plex-server bestaat (bijvoorbeeld in een geïmporteerd overzicht) blijft bekeken in Movviz, zonder oproep naar Plex of waarschuwing in het logboek.

### Plex: verlichte dagelijkse reconciliatie

- De volledige Plex-reconciliatie herschrijft een film niet meer als er niets is veranderd. Voorheen werd de hele bibliotheek elke dag als 'bijgewerkt' beschouwd (melding '2351 film(s) bijgewerkt') en kon de server ongeveer een minuut vastlopen tijdens dit proces. De melding telt nu alleen de echte wijzigingen.

### Diagnose, iconen en trailers

- De diagnose geeft de tellers per type en de eerste 50 voorbeelden terug, in plaats van tientallen duizenden regels.
- Lichte tab- en app-iconen, en een favicon.ico.
- Trailers die al gevonden zijn, blijven gecached na een herstart van de server.

## v1.26.011 — 11 oktober 2026

### Beveiliging: TMDB-sleutel voor beheerders gereserveerd

- Het wijzigen, verwijderen of testen van de TMDB-sleutel vereist nu een beheerdersaccount, net als voor OMDb en TVDB. Voorheen gebeurden deze acties zonder de sessie te controleren.
- Een test controleert nu of elke route die iets wijzigt, zelf controleert wie deze aanroept.

### Tests

- De ontdekkingsfunctietests volgen de huidige lay-out (sortering behouden bij het wijzigen van platform, tab 'Alles').
- De ffmpeg-detectietests gaan niet langer uit van een NVIDIA-kaart op de machine, en de ffprobe-cachetest is niet langer instabiel.

## v1.26.010 — 11 oktober 2026

### Android TV en mobiel: slaapstand pauze

- Wanneer de afspeelvideo is gepauzeerd, worden het schermbeveiliging en de tv-slaapstand opnieuw geactiveerd na hun gebruikelijke vertraging, net als bij Plex. Tijdens het afspelen, inclusief tijdens het laden, blijft het scherm aan.

## v1.26.009 — 11 oktober 2026

### Android mobiel: seizoen voltooien

- Op de pagina van een seizoen heeft het downloaden van het seizoen een eigen knop, op een aparte regel van de afspeelacties. Het heet 'Seizoen voltooien' wanneer een deel van de afleveringen al aanwezig is, 'Seizoen downloaden' wanneer geen enkele aanwezig is, en toont het percentage live tijdens het downloaden.

## v1.26.008 — 11 oktober 2026

### Android TV en mobiel: aflevering downloaden

- Op de fiche van een ontbrekende aflevering verandert de knop in 'Aflevering downloaden' in plaats van 'Seizoen downloaden'. Het toont vervolgens de status live: in de wachtrij, zoeken, downloaden met realtime percentage, en vervolgens importeren, voordat het overgaat naar 'Afspelen'.
- 'Seizoen downloaden' wordt alleen aangeboden voor een seizoen waarvan geen enkele aflevering aanwezig is, met hetzelfde live-overzicht. Op TV behoudt een lopend seizoen 'Seizoen voltooien', dat ook live wordt gevolgd.
- Een actuele seizoensbundel toont zijn voortgang op elk aflevering, en alleen op de eerste.
- Mobiel: ontbrekende afleveringen zijn nu te openen voor downloaden (ze waren inactief).

## v1.26.007 — 10 oktober 2026

### Automatisch herstel van blokkades

- Een vastgelopen JSON-back-up worker wordt vervangen na twee minuten; mislukte back-ups worden opnieuw geprobeerd met de meest recente gegevens.
- In Docker start een onafhankelijke supervisor de webserver opnieuw na vijf minuten continue onbeschikbaarheid, met tien minuten gratie bij het opstarten, minstens vijftien minuten tussen herstarts en maximaal drie herstarts per uur.
- Langdurige back-upfouten worden gedetecteerd door de gezondheidssensor. De download- en resolverprocessen behouden hun loguitvoer bij een herstart van de webserver.
- Het afsluiten probeert de wachtende wijzigingen op te slaan na het stoppen van de schrijfworkers. Herstelbeslissingen worden in de logs weergegeven onder `[watchdog]`.

## v1.26.006 — 8 oktober 2026

### Bibliotheek: verhoudingen en filters

- Het Genres-menu staat rechts van de titelsteller.
- De pagina gebruikt dezelfde bruikbare breedte als het dashboard om dezelfde verhoudingen van kaarten en witruimte op grote schermen te behouden.

## v1.26.005 — 8 oktober 2026

### Automatische downloads

- Automatische zoekfunctie voor ontbrekende items is standaard opnieuw geactiveerd, ook voor uitgeschakelde oudere configuraties; een opzettelijke uitschakeling na deze update blijft bewaard.
- De uurlijkse RSS-scan werkt de status van nieuwe uitgaven bij en herkent de originele titels van films. De zoekopdracht naar recente uitgaven gebruikt de bekende datum wanneer de VF-datum ontbreekt.
- De aangepaste frequenties van automatische zoekopdrachten zijn beperkt tot acht uur om minstens drie keer per dag te voorzien, wanneer de server actief is.

### Bibliotheek en personalisatie

- Films, Series en Collecties zijn gegroepeerd in de bestaande Bibliotheekpagina. Oude adressen voor Films en Series leiden door naar deze filters.
- Genres verschuiven naar een dropdownmenu boven het aantal titels. De raster neemt de volledige breedte in en neemt de afmetingen van de kaarten op het dashboard over.
- De personalisatie van lijsten is op de computer toegankelijk in Ontdekking en toegevoegd aan het dashboard: volgorde, verbergen, opnieuw weergeven en resetten, opgeslagen per account.
- In Ontdekking wordt het groene vignet van beschikbare titels gehalveerd; "Bekeken" verschijnt rechtsonder, onafhankelijk van de downloadstatus.

## v1.26.004 — Oktober 2026

### Downloads: veilige vervanging en seed-status

- De oude film blijft beschikbaar en leesbaar tijdens het downloaden van zijn vervanging; deze wordt alleen verwijderd na installatie en validatie van het nieuwe bestand met de definitieve naam, zonder de suffix « (2) » of residu.
- In geval van weigering (bestand in gebruik, naam bezet, bestand onvolledig of onbereikbaar), wordt het nieuwe bestand bewaard voor drie nieuwe pogingen met een interval van 10 minuten, inclusief na het opnieuw opstarten. Na de laatste mislukking wordt het nieuwe bestand verwijderd en het oude bewaard; Downloads toont een specifieke melding.
- Een torrent dat is voltooid met delen toont « In seed » en wordt niet langer geblokkeerd vanwege een nul downloadsnelheid.

### Desktop: badges van de held

- De technische badges behouden de presentatie en uitlijning van de genres; "FHD" wordt "1080P" in de hero desktop.

## v1.26.003 — Oktober 2026

### Desktop: technische badges van de hero naast de genres

- Op de computer worden de badges voor resolutie, HDR, taal en codecs van de hero direct na de genres weergegeven, op dezelfde regel indien de ruimte het toelaat.
- Hun presentatie en gegevens blijven ongewijzigd; op mobiel en tablet behouden ze hun positie rechtsboven.

## v1.26.002 — Oktober 2026

### Android mobiel: scrollbare tijdlijn en immersie

- De cursor, voortgang en weergegeven tijd volgen de vinger over de tijdlijn. De videosprong vindt plaats bij loslaten, zonder herhaalde herladingen tijdens het scrollen.
- De tijdlijnbeweging blokkeert de helderheid en het volume; de bedieningselementen blijven zichtbaar tot loslaten.
- De speler gebruikt het gehele scherm, waarbij systeembalken worden gemaskeerd.
- Zwarte banden in een videostroom worden gedetecteerd op meerdere overeenkomstige heldere beelden en worden verwijderd door een progressieve weergavezoom. Donkere scènes veroorzaken geen zoom; native 21:9 video's zijn uitgesloten.

## v1.26.001 — Oktober 2026

### Desktop toegankelijkheid per profiel

- In Mijn profiel stelt een toegankelijkheidssectie de tekstgrootte op de computer in: 100 %, 110 % of 120 %, met onmiddellijke preview en terugkeer naar de standaardinstelling.
- De voorkeur wordt opgeslagen in het account en gevonden op andere computers. Het wijzigt de Android- of TV-apps niet.
- De vergroting dekt de interface-, menu- en paneelteksten in de Stable- en Beta-versies, met aanpassing van navigatiegebieden en bedieningselementen.
- Op 100 % zijn de vergrotingstijlen volledig uitgeschakeld; posters, logo's en video's behouden hun afmetingen.

## v1.25.201 — Oktober 2026

### Android mobiel: discrete speler en prioritaire hoogte

- Bij afspelen geen titels of logo's: de compacte bedieningselementen en afleveracties verdwijnen na 2,5 seconden zonder interactie.
- In pauze begeleidt een lichte gradiënt het officiële logo van de film of serie; de titel dient als back-up indien het logo ontbreekt of niet kan worden geladen. Het logo verdwijnt zodra het weer speelt.
- Tijdlijn van 4 dp, greep van 18 dp en aanraakdoelpunten van minstens 44 dp. Het afspeilmodusbadge is verkleind.
- De daadwerkelijk afgespeelde video- en audioformaten worden discreet weergegeven bij de tijden, zonder HDR of Atmos te verzinnen of de kenmerken van het bronbestand na transcodering te herhalen.
- De video vult de hoogte van het scherm en behoudt zijn verhoudingen; een inhoud die smaller is dan de telefoon behoudt zwarte zijbanden.

## v1.25.200 — Oktober 2026

### Android mobiel landschap: plaatsing van de videopreview

- In het tweeledige scherm wordt de trailerpreview naar links verschoven met 33 % van zijn breedte, zonder zijn grootte of formaat te wijzigen.
- De vervaging, de tekst en de achtergrondafbeelding blijven op hun plaats; de video die overloopt wordt gemaskeerd aan de schermgrenzen.

## v1.25.199 — Oktober 2026

### Android mobiel landschap en thema kleuren Bèta

- Android mobiel in landschap: horizontale veegbeweging van de helderbeeld om de vorige of volgende titel weer te geven; de automatische draaitijd start na een handmatige selectie opnieuw.
- Android mobiel in twee panelen: de visual en de gradiënten bedekken het hele oppervlak, met een continue vervaging naar de tekst en de paginaachtergrond, zonder verticale onderbreking.
- Bèta uiterlijk op de computer: de zoekopdrachten en de ontdekkingskaart van platforms nemen de kleuren van de kleurenpalet over, inclusief bij hover en selectie.

## v1.25.198 — Oktober 2026

### Bèta uiterlijk: terugkeer van de gebruikelijke zoekbalk

- Op de computer neemt het Bèta uiterlijk de zoekbalk van het Stabiele uiterlijk over, identiek: je typt direct in de balk bovenaan.
- Het palet `Ctrl K` is verwijderd.

## v1.25.197 — Oktober 2026

### Bèta uiterlijk: Downloads trouw aan het ontwerp, titelpagina in tabbladen

- Downloads: onder de titel vervangt een live samenvatting (actieve downloads, snelheid, vrije ruimte) de uitlegtekst.
- Elke regel in de wachtrij is uitgelijnd in kolommen: inhoud, voortgang, snelheid, resterende tijd, bronnen. De acties blijven discreet (pauze, zoeken, verwijderen, details).
- De voortgang verandert van kleur afhankelijk van de status: paars bezig, grijs in afwachting, groen voltooid, rood geblokkeerd.
- De kolom "Bronnen" toont nu het werkelijke aantal peers, in plaats van lege pijlen.
- De rechterkolom organiseert zich in "Live snelheid", met een gevulde curve, en "Status". De gegroepeerde knoppen zijn niet langer rood, behalve bij hover.
- Titelpagina op de computer: Afleveringen, Distributie, Vergelijkbaar en Details gaan naar tabbladen onder de samenvatting.
- Correctie: het info-ballon "Details" toonde een technische tekst in plaats van het vertaalde woord.
- Het hervatten van het afspelen verandert niet. Stabiel, mobiel en tv-apps ook niet meer.

## v1.25.196 — Oktober 2026

### Android mobiel: correctie

- Het Overzicht van Mijn ruimte crasht niet meer wanneer dezelfde film of aflevering meerdere keren voorkomt (bekeken of opnieuw gestart): elke titel verschijnt slechts één keer, op de meest recente datum.

## v1.25.195 — Oktober 2026

### Bèta uiterlijk: volledige breedte startpagina op de computer

- De grote afbeelding op de startpagina verlaat zijn kader: het neemt de volledige breedte in, loopt onder de balk bovenaan door en vervaagt in het zwart van de pagina.
- De titel, de samenvatting en de knoppen zijn uitgelijnd over de rest van de pagina.
- De diavoorstelling, het titellogo, de trailer op de achtergrond en de platformkaarten veranderen niet. Stabiel, mobiel en tv-apps veranderen ook niet.

## v1.25.194 — Oktober 2026

### Android mobiel: premium make-over, zoeken, speler en instellingen

- Zoeken: met "Alles" verschijnen de gevonden personen bovenaan, in ronde foto's, voor films en series.
- Elk resultaat geeft aan of het al in de bibliotheek staat of aan het downloaden is.
- De filters (genres, duur, platforms…) openen als een blad vanaf de onderkant in portretmodus, met een scrollende lijst.
- De actieve tabbladen (Films/Series, Aan het kijken/Voltooid, zoekfilters) worden wit, net als de seizoenen.
- Speler: een dubbele tik links of rechts gaat 10 s terug of vooruit, en een verticale veeg regelt de helderheid (links) of het volume (rechts).
- Downloads: een overzicht bovenaan toont de algehele voortgang, de totale snelheid en de geschatte voltooiing.
- Instellingen: automatische update wordt een duidelijke regel met een schakelaar.
- Het update scherm is leesbaarder op de telefoon.

## v1.25.193 — Oktober 2026

### Beta Uiterlijk: "Donkere kamer" strekt zich uit over de hele computer

- Alle kleuren zijn geünificeerd: een diep zwart, één paars voor selecties en voortgang. Cyaan, elektrisch blauw en roze gradiënten verdwijnen van knoppen, filters en panelen.
- Groen, oranje en rood behouden hun betekenis: voltooid, aandacht, mislukt.
- Pagina Downloads opnieuw ontworpen: onderstreepte tabbladen, filter-bulletpoints, soberdere lijnen, paarse voortgang, leesbare snelheden in uitgelijnde cijfers, kleurgecodeerde status-bullets, en een live kolom (grafiek, snelheden, tellers) die bij de rest past.
- De hoofdknop (Spelen, Hervatten, Toevoegen aan bibliotheek) wordt licht op het startscherm en op de titelpagina. Andere acties blijven iconen, met de naam bij het overgangen.
- Bibliotheek: de filters Type en Sorteren verschijnen niet meer twee keer, ze blijven in de menubalk bovenaan.
- Het instellingenstartscherm verliest zijn kleurhalo's en neemt dezelfde oppervlakken aan als de rest.
- De platformkaarten, hun logo's en hun hover-effecten veranderen niet. Stabiel, de mobiele en TV-apps veranderen ook niet.

## v1.25.192 — Oktober 2026

### Android mobiel: premium make-over van de film- en seriepagina

- De pagina neemt de kleur van de poster aan: de achtergrond kleurt zachtjes naar de titel in plaats van een identiek zwart overal.
- In landschap en op volledig plat geopende Fold, wordt de pagina weergegeven in twee panelen: de afbeelding blijft links vast en de informatie scrollt rechts.
- Op een rechtop gehouden geopende Fold, neemt de pagina het portretlay-out met meer ruimte aan.
- De knop Spelen is overal wit, en de voortgang van het hervatten wordt direct in de knop weergegeven.
- In portret worden "Vanaf het begin spelen" en "Bekeken gemarkeerd" ronde knoppen op één lijn.
- Seizoenen worden geselecteerd met compacte bulletpoints "Seizoen 2 · 10 af."> op telefoon en Fold.
- In portret opent een aflevering in een blad dat van onderaf opkomt, en dat met een tik erboven weer gesloten kan worden.

## v1.25.191 — Oktober 2026

### Android mobiel: premium make-over, eerste stap (chassis)

- Het open Z Fold toont niet langer de tv-interface: het heeft nu zijn eigen aanraaklay-out, met een gelabelde navigatiebalk aan de linkerkant.
- Nieuwe navigatiebalk van mat glas in landschap- en Fold-modus. Het integreert zoeken, en het Downloads-tabblad toont een voortgangsring tijdens het downloaden.
- Op het volledig geopende Fold of op een tablet behoudt het rechterpaneel zijn plaats wanneer het scherm breed genoeg is en neemt het dezelfde glazen stijl aan.
- De ster van het startscherm neemt in landschap- en Fold-modus de volledige breedte in, met een leesbaard samenvatting en een leesbaarder witte Afspeelknop.
- De onderste dock is lichter: het actieve tabblad wordt gemarkeerd met een onderstreepte paarse icoon in plaats van een gekleurde pil.
- Het portretzoekveld op het startscherm wordt een icoon in de header, wat meer ruimte voor de inhoud overlaat.
- Knoppen en thumbnails reageren op aanraking met een lichte indruk, en secundaire teksten krijgen een zachtere tint.
- De zwevende Movviz AI-knop verandert niet.

## v1.25.190 — Oktober 2026

### Beta Uiterlijk: eerste stappen van "Donkere Kamer" op computer

- Nieuw commando-palet: `Ctrl K` (of een klik op de bovenbalk) zoekt naar zowel films als series, pagina's en instellingen, en stelt voor om het zoeken te starten in Ontdekking of een torrentzoekopdracht.
- De bovenbalk wordt lichter: de taal en de Ondersteun Movviz-link verhuizen naar het profielmenu, en het hart klopt niet langer continu.
- Donkerdere en neutralere kleuren, actieve zijbalk-invoer in verhoogd oppervlak, toegewijde Movviz-lettertypen (ingebouwd, zonder verbinding), paginatitels zonder gradiënt en één focusring, identiek aan de muis en het toetsenbord.
- Een link naar een specifieke instelling opent nu het juiste tabblad, zelfs als de Instellingenpagina al wordt weergegeven.
- Het Stabiele, mobiele en tv-applicatie-uiterlijk verandert niet.

## v1.25.189 — Oktober 2026

### Android TV: nieuwe Beta interface om te proberen

- Nieuwe instelling Instellingen > Uiterlijk > Beta Interface. Deze is standaard uitgeschakeld: het huidige uiterlijk verandert niet zolang u het niet activeert.
- Met de Beta interface zijn de teksten groter en leesbaarder vanaf de bank (badges, beoordelingen, synopsis, fiche-informatie), en de selectie heeft overal dezelfde witte rand.
- De rijen, posters en herhaalkaartjes zijn uitgelijnd op dezelfde marge en iets groter; de voortgangsbalk van herhalingen is zichtbaarder.
- De ster van het startscherm verandert niet terwijl u op de knop staat, en deze knop heet nu "Fiche bekijken", wat het daadwerkelijk doet.

## v1.25.188 — Oktober 2026

### Android mobiel: zoeken op acteur

- In het Acteurs-tabblad van de zoekopdracht opent het aanraken van een acteur nu zijn fiche met zijn filmografie.
- Elk resultaat toont de foto en het beroep van de persoon, en de zoekopdracht geeft aan wanneer deze laadt of faalt in plaats van "Geen acteur" weer te geven.
- De zoekopdracht naar acteurs (mobiel en web) vindt veel meer personen: het gebruikt nu de TMDb-zoekopdracht gewijd aan personen.

## v1.25.187 — Oktober 2026

### Movviz Companion: live download tracking

- De knop toont nu het downloadpercentage in realtime, met een dun voortgangsbalkje, en werkt automatisch bij: u hoeft de pagina niet meer handmatig te vernieuwen.
- Wanneer het downloaden voltooid is, verandert de knop automatisch in "Beschikbaar" met directe toegang tot de fiche in Movviz.
- Nauwkeurigere foutmeldingen bij verbindingsfouten met de server (toegangsverboden, server moet worden bijgewerkt, server onbereikbaar), en een betrouwbaalere autorisatieaanvraag voor een server via HTTP.

## v1.25.186 — Oktober 2026

### Movviz Companion: installatie verholpen

- De extensie werkt opnieuw in Chrome en Edge: een ongeldige icoonverklaring verhinderde de installatie vanaf de vorige versie.

## v1.25.185 — Oktober 2026

### Movviz Companion: logo zichtbaar en knop leesbaarder

- Het Movviz-logo wordt nu getoond in de knop, op alle ondersteunde sites.
- De knop is nu een donkere kaart met een paarse gloed, groter en leesbaarder zelfs op witte pagina's. Wanneer een titel beschikbaar is, wordt "Openen in Movviz" de primaire knop.

## v1.25.184 — Oktober 2026

### Movviz Companion: scherp logo

- Het extensie-icoon gebruikt nu het Movviz-logo in transparante PNG, zonder de donkere rand die aan de randen zichtbaar was.

## v1.25.183 — Oktober 2026

### Movviz Companion: vraag je films en series aan vanaf filmwebsites

- Nieuwe browser-extensie (Chrome, Edge, Brave): een Movviz-knop verschijnt op TMDb, IMDb, AlloCiné, SensCritique, TheTVDB, Letterboxd, Rotten Tomatoes, JustWatch, Trakt en Taste om een film of serie met één klik aan te vragen.
- De status wordt live weergegeven (wachten, bezig, beschikbaar) met directe toegang tot de fiche in Movviz. Als een site zijn lay-out wijzigt, blijft de knop zichtbaar linksonder.
- Verbinding met een persoonlijk API-token (Profiel, API-tokens): het verzoek volgt uw gebruikelijke rechten, onmiddellijk goedgekeurd voor een beheerder of een gebruiker in automatische goedkeuring.
- Het archief van de extensie wordt bij elke release gevoegd, met een optiepagina in de kleuren van Movviz beschikbaar in vijf talen.

## v1.25.182 — Oktober 2026

### Afspelen: betrouwbare pauze/herstart en grote bestanden die niet meer in de lucht draaien

- Een pauze van meer dan enkele seconden, of het afspelen van een groot bestand, verbreekt de videoverbinding niet meer: op Android TV en mobiel dwingt de speler geen maximale duur meer op een stream, en de server onderbreekt deze niet meer na 5 minuten.
- Het is opnieuw mogelijk om te pauzeren tijdens het laden, en het icoon volgt de werkelijke status. Een speler die gepauzeerd wordt, blijft zo na een automatische hervatting, en het verlaten van het scherm pauzeert de afspeelstatus zelfs tijdens het laden.
- Minder geheugengebruik: de starttrailer wordt vrijgegeven zodra de speler opent of de app op de achtergrond gaat.
- Vloeiender afspelen van lokale bestanden bij grote bestanden.

## v1.25.181 — Oktober 2026

### Films en Series: correcte rijtitels en aanpasbare rijen

- De suggestierijen voor de films- en seriepagina's dragen eindelijk hun echte naam (Gejuicht door de kritiek, Anime, Actie, Komedie, etc.) in plaats van overal "Films" of "Series".
- Nieuwe potloodknop op Films, Series en Ontdekken: elke gebruiker kan een suggestierij tevoorschijn halen, naar beneden schuiven, bovenaan plaatsen of verbergen, en dit op elk moment opnieuw instellen. De organisatie wordt opgeslagen op het account, pagina voor pagina, en een knop maakt het mogelijk terug te keren naar de standaardvolgorde.

## v1.25.180 — Oktober 2026

### Samsung Tizen: parcours dichter bij Android TV NX

- Instellingen, titelpagina, seizoenen en afleveringen herzien: bekeken/niet bekeken status, teller van bekeken en ontbrekende afleveringen, hervatten op de exacte plek of vanaf het begin.
- Consistente startpagina wanneer AI uitgeschakeld is: geen lege gebieden of zichtbare AI-elementen.
- Nieuwe vertaalde labels in vijf talen, en UX-audit van de Samsung-versie toegevoegd aan de porteerdocumentatie.

## v1.25.179 — Oktober 2026

### Downloads: einde van verkeerde edities en omzeilde verboden woorden

- Een release van een nationale editie van een show wordt niet langer genomen voor de basisserie: "Hot Ones Quebec" wordt niet langer gedownload voor "Hot Ones" (hetzelfde voor Canada, Frankrijk, België, Australië, enz.).
- "Vervangen van geblokkeerde" respecteert nu verboden woorden: een release met een verboden term (bijv. VFQ) wordt niet langer automatisch gekozen, ongeacht de score. Handmatige zoekopdrachten tonen nog steeds alles.

## v1.25.178 — Oktober 2026

### Samsung Tizen: eerste NX-client in bèta en GitHub release

- Toevoeging van een Samsung TV-client verpakt in `.wgt`, met kleuren, Roboto-lettertype, logo, focusrail en afmetingen afkomstig van Android TV NX. Server-schermen, Movviz/Plex-verbinding via code en QR, profielselectie, startpagina met hero, bibliotheek, ontdekking, zoeken en unieke titelpagina met seizoenen/afleveringen en distributie.
- Hergebruik van serverroutes en -regels voor accounts, hervattingen, geschiedenis, bekeken status, persoonlijke lijsten, titelverzoeken, downloadzoekopdrachten en AI wanneer deze ingeschakeld is. Profielen herstellen elk hun geauthenticeerde sessie; er wordt geen Plex-token naar de client gestuurd.
- AVPlay-adapter met geauthenticeerde afspeling, hervatten, pauzeren, navigeren in de stroom, audio/onderkopselectie via serverherplanning, voortgang en volgende aflevering. Capaciteiten beperkt tot H.264/AAC SDR 1080p in afwachting van hardwaretests; afspelen op fysieke TV en volledige Android TV-pariteit zijn nog niet gevalideerd.
- Samsung workflow op dezelfde `v*` tags als andere platforms: verificatie van typen/tests, archief en SHA-256 toegevoegd aan de release. Zonder geconfigureerde Samsung-certificaten draagt het pakket expliciet de naam `client-unsigned.wgt` en moet het vóór installatie worden ondertekend. HEVC/HDR/4K, trailers, markers en geavanceerde instellingen moeten nog worden afgerond en geverifieerd op het doelmodel.

## v1.25.177 — Oktober 2026

### Android TV: terugkoppeling en seizoensopening met D-pad

- Bij terugkeer naar een geopende pagina vanuit de zoekopdracht, keert de focus terug naar de geselecteerde kaart, met herstel van het filter en de rasterweergave.
- Een seizoen opent bij het afspelen van zijn koptekst, zonder deze te verbergen. Het terugkeren naar een afleveringspagina behoudt de prioriteit van de oorspronkelijke kaart; de Compose-navigatie en afspeelregels blijven ongewijzigd.

## v1.25.176 — Oktober 2026

### Android TV: vereenvoudigde zoekopdrachtinvoer

- De invoer invalideert niet langer de gehele navigatiecontainer bij elke letter. De normalisatie van bibliotheektitels wordt één keer per verversing berekend, en de overeenkomsten en hun sortering worden berekend buiten de displaythread.
- Verouderde berekeningen worden geannuleerd en hun resultaten kunnen de resultaten van de nieuwe invoer niet vervangen. Prioriteit behouden voor bibliotheek, sortering, filters, deduplicatie, bekeken badges, netwerktiming en afstandsbedieningnavigatie.

## v1.25.175 — Oktober 2026

### Bèta: lichtreflectie op de rand van kaarten

- Bij het over de desktop, volgt een fijn wit-paars reflectie de muis over de rand van de kaarten. Het midden is gemaskeerd om de kleuren en de leesbaarheid van de posters te behouden, met een subtiele buitenhalo.
- Geen zoom of vergroting toegevoegd: de bestaande muisvolgfunctie wordt behouden. Geen wijzigingen in de achtergrond, de Stable-modus, de inhoud of de afspeling; geen extra bibliotheek of permanente animatie.

## v1.25.174 — Oktober 2026

### Recente toevoegingen: verwar niet wijziging van weergave met het ontvangen van een bestand

- De synchronisatie en reconciliatie van Plex behouden de aankomstdatum van een reeds bekend bestand. Het wijzigen van afleveringen naar bekeken of onbekeken, of het vernieuwen van hun metadata, geeft ze niet langer kunstmatig de synchronisatiedatum in de recente toevoegingen.
- Een eerste import gebruikt de werkelijke toevoegingsdatum verstrekt door Plex; een echte bestandsovername behoudt zijn gedrag van nieuwe aankomst. Lokale acquisitiedatums die al zijn opgeslagen, worden behouden.
- Correctie in de gedeelde databron, zonder wijziging van weergaven, geschiedenissen, Plex-accounts of herstelregels.

## v1.25.173 — Oktober 2026

### Nuttige instellingen, speciale seizoenen en Ontdekking

- Verwijdering van gedeactiveerde startopties (statistieken, downloadwachtrij en taken) en grafische kwaliteitsprofielen. De huidige samenstelling en de standaard grafische weergave blijven vast; het uitschakelen van animaties en het kiezen van Stable/Beta blijven beschikbaar. De teksten van de verwijderde keuzes zijn opgeschoond; de wizard behoudt alleen zijn nog nuttige keuzes.
- De ingebouwde speler heet Movviz player en is standaard ingeschakeld. De persoonlijke keuze uitgeschakeld opent Plex, zelfs wanneer een lokale bron anders deze keuze zou omzeilen. De expliciete voorkeuren van bestaande accounts blijven behouden; de engine blijft automatisch.
- Op desktop stuurt de bestaande optie voor speciale afleveringen nu daadwerkelijk de weergave van seizoen 0 aan. Deze wordt na deze update één keer voor alle profielen uitgeschakeld, waarna iedereen deze opnieuw kan activeren. Op Android TV worden speciale afleveringen verborgen zoals ze al zijn op smartphones. Geen bestand, geschiedenis of bekeken status wordt verwijderd.
- Ontdekking biedt Nieuwigheden, Trend, Beste en Voor jou in dezelfde selector, voor alle platforms. De sortering wordt behouden bij wijziging van platform of type; Voor jou gebruikt de aanbevelingen van het account, gefilterd op basis van het gekozen platform. Met extra filters worden de gefilterde resultaten opnieuw gerangschikt zonder hun paginering te wijzigen.
- In Films en Series onderscheiden de platformrijen nu suggesties voor jou en nieuwigheden, met dezelfde labels als Ontdekking.
- Verwijdering van het rechthoekige kader toegevoegd in het zoekveld Beta; alleen de afgeronde rand geeft nu de focus aan.

## v1.25.172 — Oktober 2026

### Beta: originele achtergrond en verfijnde interacties

- De achtergrond van de pagina en die van de zijbalk krijgen het originele thema terug: er is geen decoratieve achtergrond meer toegevoegd in Beta. De muisvolgfunctie en het reliëf van de tegels worden behouden.
- De badge's voor beoordelingen en afleveringen zijn leesbaarder, de herstelbalken zijn beter gedefinieerd en het geselecteerde platform in Ontdekking heeft een subtiele indicator.
- De knoppen van de hero en de pijlen van de carrousels geven een duidelijkere visuele feedback bij overgangen, klikken en toetsenbordgebruik, zonder de lay-out te verplaatsen.
- Deze verfijningen blijven voorbehouden aan Beta op desktop, respecteren de vermindering van animaties en wijzigen noch de afspeling, noch de gegevens, noch de voorlaadingen.

## v1.25.171 — Oktober 2026

### Beta: premium bioscoopdesktopafwerking

- Beta past nu een consistente uiterlijk toe op het dashboard, de kaarten voor films en series, Ontdekking, de profielen, de zoekopdracht, de instellingen en het Movviz AI-paneel. Stable behoudt zijn bestaande uiterlijk.
- De posters en platforms hebben een licht bij overgang en een licht reliëf. De besturingselementen, voorbeeldvensters en profielen zijn geharmoniseerd; de overgangen van profielen zijn verfijnd zonder hun gedrag te vervangen.
- Pointer-effecten delen één taak per frame, zonder React-herberekening of permanente animatie. Ze worden onderbroken tijdens het afspelen, op touchscreens en wanneer animaties worden verminderd.
- De instellingen en het uiterlijkcache worden vergeleken met het ingelogde profiel. Gegevens, zoeken, carrousels, voorlaadingen en afspeelregels worden niet gewijzigd.
- De geselecteerde effecten in de gratis bibliotheken zijn aangepast voor Movviz zonder hun engines te stapelen of productieafhankelijkheden toe te voegen.

## v1.25.170 — Oktober 2026

### Stabiele en Beta Weergave

- De Start- en carrouselkiezer biedt nu Stabiel (de huidige interface, standaard) en Beta (de nieuwe premium desktop-uitstraling). Het dashboard past de opgeslagen modus daadwerkelijk toe en maakt terug naar Stabiel mogelijk.
- De oude Cinema-, Klassiek- en Compact-modi worden Stabiel. De instellingen voor video's, inhoud en carrousels blijven behouden en gemeenschappelijk voor beide weergaven.
- Beta verfijnt het hero-frame, de knoppen, de titels en de platforms, zonder de afspeling of gegevens te wijzigen. De premium stijlen blijven uitsluitend in Beta geactiveerd.
- De keuze blijft specifiek voor elk profiel; een fout bij het opslaan suggereert niet langer dat de nieuwe modus is opgeslagen.

## v1.25.169 — Oktober 2026

### Docker Publicatie Correctie

- Het README is opgenomen in de Docker buildcontext om de validatie van versies en de changelog mogelijk te maken. De controle blijft actief; het gebruikersgedrag wordt niet gewijzigd.
- Deze publicatie neemt de correcties voor weergaven en hervattingen van versie 1.25.168 over die faalden tijdens de Docker build.

## v1.25.168 — Oktober 2026

### Consistente Weergaven en Hervattingen op Alle Apparaten

- Android TV en smartphones gebruiken nu dezelfde serverbeslissing als de webversie bij het sluiten en wijzigen van een aflevering: afleveringen met 80 %, films volgens hun credits of de bestaande eindmarge, met bescherming van de werkelijke afspeeltijd. Het natuurlijke einde blijft een expliciete validatie.
- Hervattingen S01E01 zonder voortgang zijn verwijderd uit de lokale en Plex bronnen, met name na een onvolledige import. Een daadwerkelijk gestart eerste aflevering en de overgangen naar een volgende seizoen blijven beschikbaar.
- Geen verwijdering van geïmporteerde weergaven of geschiedenis; de scheiding van Plex-profielen en de bestaande synchronisatie worden behouden.

## v1.25.167 — Oktober 2026

### Changelog na Update

- Het Nieuwsvenster markeert een versie niet langer als gelezen in geval van een fout, ontbrekende notities of zolang de splash het bedekt. De validatie vindt plaats bij het sluiten.
- Onderbroken laadprocessen worden geannuleerd en tijdelijke fouten hebben twee nieuwe pogingen. Oude onbetrouwbare validaties bedekken de notities niet meer.
- De notities voor versies 163 tot 166 zijn hersteld. De changelog is opgenomen in de standalone server en de build controleert nu de notities evenals de README- en lockfile-versies.

### Inhalen van Recente Nieuwigheden

- Carrousels bereiden twee schermen vooruit, met beperkte anticipatie en prioriteit voor zichtbare afbeeldingen, gevraagde zoekopdrachten en fiches.
- Het hervatten van een serie stelt geen niet-bestaand of ontbrekend aflevering voor; de weergaven, geïmporteerde geschiedenis en de scheiding van Plex-accounts worden behouden.
- De geïnstalleerde versie en de updateblok zijn terug naar de onderkant van de zijbalk, in open en compacte modi.

## v1.25.166 — Oktober 2026

### Versie en update in de zijbalk

- De geïnstalleerde versie is opnieuw zichtbaar onder het profiel, ook in compacte modus.
- Het updateblok is terug voor beheerders: installatie op Windows en native Linux, toegang tot informatie over Docker/NAS. De navigatie blijft ongewijzigd.

## v1.25.165 — Oktober 2026

### Prioriteit voor navigatie

- Activiteitsdetectie dekt toetsenbord, aanraak, scrollen en navigatie. De prioriteit wordt vernieuwd tijdens nuttige laadprocessen, niet door reeds gecachede verversingen.
- Zichtbare afbeeldingen wachten niet op anticipatie. Nabije carrousels bereiden twee schermen voor, met twee speculatieve voorladingen en één keer ontcodering voor alle rijen.
- Achtergrondtaken worden correct gesorteerd; TMDb gebruikersaanvragen blijven prioriteit hebben, met een stabiele volgorde en behouden concurrentielimieten.

## v1.25.164 — Oktober 2026

### Alleen geldige voortzettingen

- De volgende aflevering komt uit de echte catalogus, gesorteerd op seizoen en aflevering. Een afgeronde serie genereert geen extra aflevering meer.
- Een ontbrekende volgende aflevering voorkomt voortzetting zonder naar een latere aflevering te springen; een beschikbare lopende aflevering behoudt de prioriteit.
- De controle geldt voor lokale en Plex voortzettingen, zonder de weergaven, geïmporteerde geschiedenis of profielsynchronisatieregels te wijzigen.

## v1.25.163 — Oktober 2026

### Carrouselreactiviteit

- Rijen laden twee breedtes voor en vermijden onnodige rendering tijdens het scrollen.
- De downloadteller wordt niet meer twee keer weergegeven in de geopende zijbalk.

## v1.25.162 — Oktober 2026

### OCS en YouTube

- OCS en YouTube blijven altijd zichtbaar in Ontdekking, zelfs als TMDb ze niet voor België vermeldt.
- Wanneer een Belgische leverancierscatalogus leeg is, gebruikt de zoekopdracht automatisch de Franse catalogus voor dit platform; bestaande Belgische resultaten blijven prioriteit hebben.
- De sorteeroptie Ontdekking is gesorteerd op Nieuwigheden, Trends, Beste; "Voor u" blijft toegankelijk ongeacht de leverancier.

## v1.25.161 — Oktober 2026

### Movviz AI levendiger

- Vragen en pogingen tot namaak van de maker ontvangen nu diverse mysterieuze antwoorden, zonder identiteit te onthullen of dezelfde zin te recyclen.
- Movviz AI kan met onbeleefdheid grappen over daadwerkelijk bekeken keuzes, en een belediging beantwoorden met een lichte vleugel theatrale minachting, zonder escalatie of gratis aanval.

## v1.25.160 — Oktober 2026

### Ontdekkingsplatforms en inactieve downloads

- Klikken op een platform (tegel of menu) opent de catalogus zonder de vorige zoekopdracht of incompatibele filters te behouden; het type Films/Series blijft ongewijzigd.
- De beschikbare platforms zijn afkomstig uit de films- en serieslijsten van het geselecteerde land. OCS en YouTube worden niet langer aangeboden in een land waar TMDb geen catalogus voor heeft, zonder stilzwijgende overgang naar Frankrijk.
- Een download van minder dan 20 octet/s gedurende twee minuten wordt "geblokkeerd", zelfs met verbonden peers of een datanetwerk. Een significante hervatting kan het weer naar de rij brengen.
- Pauzes, het wachten op een slot en verificaties worden uitgesloten van de inactiviteitsperiode; een handmatige hervatting krijgt een nieuwe volledige periode.

## v1.25.159 — Oktober 2026

### Herstart van de torrentclient

- Beheerdersknop in de snelle instellingen van downloads, met "Herstarten..." en bescherming tegen dubbelklikken.
- Werkelijke stop en hercreatie van de torrentclients, gevolgd door het herstellen van de wachtrij, pauzes en geïmporteerde geschiedenis zonder bestanden te verwijderen. Native processen moeten worden gestopt voordat ze worden vervangen.
- Status inzien tijdens de operatie; in geval van falen wordt de back-up bewaard voor een nieuwe poging in plaats van de wachtrij te overschrijven met een gedeeltelijke status.

## v1.25.158 — Oktober 2026

### Films- en Serieskaarten op desktop

- De Films- en Seriespagina's nemen de desktopbreedte van het dashboard en Ontdekking over. Hun rijen gebruiken al hetzelfde component en dezelfde responsieve afmetingen voor kaarten.
- De weergave voor telefoon en tablet blijft ongewijzigd.

## v1.25.157 — Oktober 2026

### Toegestane release termen

- Een toegestane term moet uniek zijn: FRENCH omzeilt niet langer een verbod wanneer het alleen in SUBFRENCH of TRUEFRENCH voorkomt.
- De gebruikelijke scheidingstekens van releases blijven geaccepteerd, waaronder VOSTFR+FRENCH. De algemene regel dekt automatische selectie en controle na import, zonder de handmatige uitzonderingen te wijzigen.

## v1.25.156 — Oktober 2026

### Grootte van Ontdekkingkaarten op desktop

- Ontdekking gebruikt dezelfde inhoudsbreedte en dezelfde responsieve kaartgrootte als het dashboard op desktop, in de resultatenrijen en -grids.
- De placeholders volgen dezelfde afmetingen; de groottes op telefoon en tablet blijven ongewijzigd.

## v1.25.155 — Oktober 2026

### Responsiviteit van de eerste laadopdracht

- De bronnen voor Ontdekking en de Films/Seriespagina's reageren onafhankelijk: een trage bron houdt niet langer alle rijen vast. reeds berekende rijen blijven onmiddellijk beschikbaar tijdens een verversing, en worden bewaard als deze mislukt.
- Suggesties behouden de volledige geschiedenis, rangschikking en filters per profiel. De bekeken en afgewezen statussen worden ook gecontroleerd op de gegevens die vanuit de cache worden geleverd.
- Het progressieve vullen gebruikt de lage prioriteitsroute en voegt geen netwerkwachtijd toe bij de eerste passage meer toe. Apparaten worden gewaarschuwd wanneer de rijen beschikbaar worden; het web heeft een beperkte inhalingsmogelijkheid tot de voorbereidingstijd.
- De berekening van acteurs en trefwoorden laadt geen trailers, externe beoordelingen of onnodige platforms meer. Gelijktijdige berekeningen van hetzelfde profiel worden gemaximaliseerd; de echte profielen behouden hun functionaliteit.

## v1.25.154 — Oktober 2026

### Suggesties gebaseerd op de gehele geschiedenis

- Alle bekeken titels dragen bij aan het suggestiegebied, zonder een plafond van 20 titels of menging tussen gebruikers. De rangschikking behoudt de beoordelingen, voorkeuren, consensus tussen titels en de diversiteit.
- De suggesties van het dashboard, films en series gebruiken hetzelfde gebied; Netflix, Disney+ en Prime Video filteren dit volledige gebied op basis van de beschikbaarheid in het land van het profiel, in plaats van een onafhankelijke catalogus te rangschikken.
- Relaties en openbare beschikbaarheden worden geleidelijk in de cache geplaatst met beperkte concurrentie. De web-, smartphone- en Android TV-rijen worden automatisch vernieuwd naarmate ze worden voorbereid, zonder de bestaande DTO's te wijzigen.
- Bekeken of afgewezen titels blijven uitgesloten. Nieuwheiden, trends en redactionele rijen behouden hun functionaliteit; persoonlijke suggesties worden niet langer kunstmatig aangevuld met de algemeen hoogst beoordeelde.

## v1.25.153 — Oktober 2026

### Werkelijke pauze en Plex geschiedenis-export

- De WebTorrent-pauze sluit bestaande transferverbindingen en weigert herverbindingen tijdens de pauze, zonder bestanden te verwijderen of selecties te verliezen. Automatische herstelprocessen worden niet langer uitgevoerd op een gepauzeerde torrent.
- Pauze/herstartcommando's wachten op een antwoord van de engine; een mislukking retourneert niet langer een misleidend succes en de handmatige status wordt behouden.
- Een expliciete export maakt het mogelijk om de historische weergaven van een Movviz-profiel naar zijn eigen Plex-account te verzenden via de bestaande duurzame wachtrij. Andere profielen, Movviz-datums en lopende afspeellijsten blijven ongewijzigd; normale importen creëren nog steeds geen lussen.

## v1.25.152 — Oktober 2026

### SQLite voortgang en weergaveconsistentie

- Het schrijven van SQLite voortgang gebruikt het juiste aantal parameters; het kan niet langer falen op "34 values for 33 columns".
- Na synchronisatie neemt de JSON-mirror de canonieke beslissingen van dezelfde gebruiker over, zonder nieuwe beslissing of Plex-propagatie, waarbij de datums en onbekende statussen behouden blijven. Deze reparatie reset geen lopende afspeellijsten.
- Een onleesbare JSON-mirror maskeert niet langer geldige SQLite-beslissingen. De bundlecontrole controleert ook een echte voortgangsschrijving en de mirrorreparatie zonder een geschiedenisgebeurtenis toe te voegen.

## v1.25.151 — Oktober 2026

### SQLite engine in productie

- Het laden van de SQLite-module blijft functioneel in de productie Webpack-bundle, in plaats van vervangen te worden door een niet-bestaande loader.
- Bij de herstart vullen de JSON-weergaven van elke gebruiker alleen de onbekende canonieke statussen aan, met hun oorspronkelijke datums. Een bestaande canonieke beslissing, met name "niet bekeken", wordt nooit overschreven; er wordt geen weergave naar Plex gestuurd via dit herstel.
- Een controle uitgevoerd op de echte productie-bundle controleert SQLite, het behoud van weergaven en datums, de isolatie van gebruikers en de naleving van "niet bekeken" beslissingen.

## v1.25.150 — Oktober 2026

### Plex importcontrole

- De import van een oud profiel controleert de weergaven in de daadwerkelijk gebruikte opslag door de clients: SQLite indien beschikbaar, anders JSON-fallback. Het verwarring tussen de afwezigheid van de SQLite-engine en de afwezigheid van alle weergaven is verholpen.
- Het rapport specificeert de gebruikte opslag en de Plex-diagnostiek geven de beschikbaarheid van de contextengine aan. De JSON-fallback blijft beperkt tot dezelfde gebruiker en overschrijft niet de beslissingen van een beschikbare SQLite-engine.

## v1.25.149 — Oktober 2026

### Plex weergaven en zoeken

- Plex observaties worden gededupliceerd per gebruiker en oude gebeurtenissen zonder status kunnen worden hersteld zonder een recentere beslissing te overschrijven.
- Accountassociaties weigeren dubbelzinnige namen en het koppelingaccount dient nooit als fallback voor een gedeeld profiel. Volledige geschiedenissen worden één keer overgenomen en vervolgens bijgehaald per pagina, zonder totaal plafond van weergaven.
- Het importeren van een oud account controleert nu de daadwerkelijk geregistreerde statussen voordat het succes aankondigt.
- Webzoekopdrachten behouden de invoer tijdens navigatie en annuleren verouderde antwoorden. Android mobiel en TV beschermen ook zoekopdrachten naar titels en personen tegen vertraagde antwoorden en dubbele oproepen.

## v1.25.148 — Oktober 2026

### Indexeur YGGReborn

- YGGReborn is beschikbaar in de Torznab catalogus met zijn officiële API URL. Het formulier geeft toegang tot de officiële handleiding om de API-sleutel te verkrijgen.

## v1.25.147 — Oktober 2026

### Indexeur V3x

- V3x is beschikbaar in de indexeur catalogus met zijn vooraf ingevulde Torznab URL en authenticatie via een API-sleutel.
- Het formulier voor toevoeging en wijziging biedt een link naar de V3x-integraties om de API-sleutel op te halen.

## v1.25.146 — Oktober 2026

### Afleveringvolging en consistente voortgang

- Een aflevering wordt gemarkeerd als bekeken vanaf 80 % afspeelvoortgang; de voortgang en voortzetting gebruiken dezelfde drempel.
- TV- en mobiele spelers verzenden het seizoen en het afleveringsnummer om de bekeken status van de juiste aflevering op te nemen. Eerdere identificeerbare voortgangen worden geconcilieerd.
- Een serie toont de huidige of de volgende onbekeken aflevering in de volgorde van de seizoenen, zonder een reeds afgeronde aflevering te hervatten. De lokale voortgang blijft beschikbaar tijdens Plex-synchronisatie.

## v1.25.145 — October 2026

### Desktopnavigatie voortgezet

- De koppen Home, Bibliotheek en Activiteit en hun witruimte zijn verwijderd uit de zijbalk. Alle hoofditems volgen een uniforme cadans van 44 px met 4 px tussen de regels.

## v1.25.144 — October 2026

### Aanpassingen aan de desktopzijbalk

- De knop van de compacte balk neemt zijn eigen regel onder het logo in; de iconen blijven verticaal uitgelijnd tussen de twee modi.
- Beheer toont geen dubbele titels meer en zijn compacte flyout opent alleen op verzoek, zelfs vanaf een Beheerpagina.
- De badges van de compacte balk tonen nummers tot 99, en daarna "99+".

## v1.25.143 — October 2026

### Stabiele en compacte desktopzijbalk

- De desktopzijbalk onthoudt nu zijn uitgebreide of compacte staat (240 px / 76 px) en opent niet meer bij het over de muis bewegen.
- De items behouden een geometrie van 44 px en een stabiele icoon-as; de navigatie is georganiseerd in Home, Bibliotheek, Activiteit en Beheer.
- Beheer heeft een geaggregeerd badge, een toetsenbord-flyout in de compacte balk en de torrentzoekfunctie is verplaatst naar de Topbar om de algemene zoekopdracht daar te laten.
- Updates creëren geen permanente ruis meer: Instellingen tonen alleen een indicator wanneer een update beschikbaar is.

## v1.25.142 — September 2026

### Profielstatistieken en paginatie van de geschiedenis

- Android mobiel toont de werkelijke totaalcijfers van de watchlist en beoordelingen verstrekt door de server, zelfs als de profielrijen slechts een deel ervan tonen. De lijstteller reageert onmiddellijk op tikken.
- De geschiedenispagina met 200 vermeldingen behoudt een controle-element om de voortzetting te detecteren; de schuifbalk filtert direct de database om oudere pagina's te vinden zonder meer kaarten te laden.

## v1.25.141 — September 2026

### Mobiele lijst: favorieten behouden na 20 titels

- Het profiel stuurt tot 500 watchlist-items naar Android mobiel. De favoriete knop van een film toegevoegd na de 20e blijft aangevinkt bij het vernieuwen van het profiel.

## v1.25.140 — September 2026

### Weergave behouden na vervanging van een aflevering

- De TV behoudt "Weergave" in het afleverings- en seizoensoverzicht zodra Movviz het lokale bestand of een geldige weergavebron heeft.
- Plex verrijkt de metadata zonder de lokale beschikbaarheid te kunnen verbergen.
- Bij het openen van een doelserie controleert Movviz snel de lokale paden en vervolgens de dubbelzinnige afleveringen van die ene serie, zonder globale scan of applicatierestart.

## v1.25.139 — September 2026

### AI-assistent: polar-verzoeken tonen kaarten

- "Een goede donkere polar" wordt herkend als een aanbevelingsverzoek en genereert klikbare kaarten op het web en Android mobiel.
- Als het model een lijst met titels retourneert in plaats van het verwachte formaat, converteert Movviz dit naar kaarten. De reeds voorgestelde kaarten worden direct hergebruikt wanneer het model de geschiedenis kopieert; het technische blok "Voorgestelde kaarten" wordt niet langer in de discussie weergegeven.

## v1.25.138 — September 2026

### Hergedownloade afleveringen: betrouwbare bestandvervanging

- Een nieuwe aflevering neemt de naam en plaats van de oude over, zelfs als de engine deze tijdelijk als een andere aflevering heeft benoemd. De vervanging van S04E15 laat niet langer S04E15 ontbreken noch een kopie " (2)" naast S04E16.
- Het nieuwe bestand wordt gecontroleerd en in de wacht geplaatst vóór de overgang. Als dit mislukt, blijft het oude beschikbaar en kan de engine de import opnieuw proberen.
- Movviz TV, mobiel en web lezen onmiddellijk het nieuwe lokale bestand. De ffprobe-analyse gaat in de achtergrond door; een callback voor de import na hernaamgeving wordt bevestigd zonder duplicaten te creëren.

## v1.25.137 — September 2026

### AI-assistent: maker-identiteit beschermd

- Alleen het geauthenticeerde account van de maker profiteert van het geplande samenzweringsoverleg. Een andere gebruiker kan deze status niet meer verkrijgen door te beweren Seb te zijn of door zijn voornaam te geven.
- Vragen over de identiteit van de maker en pogingen tot namaak ontvangen een mysterieuws antwoord zonder verwijzing naar het model. Eerdere foutieve uitwisselingen worden uit de context verwijderd die naar het model wordt gestuurd, in het chat en de sessieherhalingen.

## v1.25.136 — September 2026

### Startpagina: rijen in dezelfde volgorde op web, Android TV en Android mobiel

- Recente toevoegingen volgen direct "Opnieuw bekijken". Op Android TV blijven de toevoegingen Films en TV-series twee opeenvolgende rijen.
- « Minder dan 40 minuten » verschijnt direct na « Movviz Trends ».
- De volgorde blijft correct met de oude dashboardconfiguraties; Herhalen blijft bovenaan op Android zodra er een media is om te herhalen.

## v1.25.135 — September 2026

### AI Assistent: leesbare en aanklikbare antwoorden op het web en Android mobiel

- Interne markeringen voor notities, feiten en keuzes worden niet meer weergegeven in de discussie, ook niet in oude antwoorden en wanneer het model ze negeert. Een simpele vraag over de beoordeling van een film slaat nu geen verzonnen beoordeling op.
- Paragrafen, lijsten en gemarkeerde woorden worden correct weergegeven. Titels die in de antwoorden worden herkend, openen hun fiche, en voorgestelde antwoorden worden gemakkelijk aanklikbare knoppen.

## v1.25.134 — September 2026

### AI Assistent: directe "Voeg toe aan mijn lijst"

- Wanneer je een kaart aanwijst die het zojuist heeft getoond ("voeg de tweede toe aan mijn lijst", "voeg Mandibules toe aan mijn lijst", "voeg ze toe aan mijn lijst"), plaatst de assistent deze onmiddellijk in Mijn lijst, zonder te wachten op het model: minder dan een seconde in plaats van twintig.

## v1.25.133 — September 2026

### AI Assistent: "Voeg de tweede toe aan mijn lijst" voegt alleen de tweede toe

- "Voeg de tweede toe aan mijn lijst" voegde de hele filmografie van de persoon waarover gesproken werd toe in plaats van alleen de beoogde titel. "Mijn lijst" werd opgevat als een verzoek om een lijst met films. De assistent voegt nu alleen de aangewezen kaart toe.

## v1.25.132 — September 2026

### AI Assistent: instantane en betrouwbare filmografielijsten van een persoon

- Lijsten met kaarten van een persoon ("alle films van Dupieux", "de 3 beste", "toon in 5") worden direct weergegeven. Ze konden wachten tot een minuut: de assistent vroeg het model opnieuw om titels waarvan het niet meer nodig was.
- "10 films van Dupieux", "de 5 beste films van Nolan" of "3 films van de Dupieux" tonen nu het juiste aantal kaarten van de films van deze persoon. Voorheen stelde de assistent irrelevante films voor, zoals Détour mortel. De naam wordt eerst gecontroleerd op TMDb: "10 horrorfilms" blijft een aanbeveling per genre.

## v1.25.131 — September 2026

### AI Assistent: "Voeg toe aan mijn lijst" slaat op in Mijn lijst

- "Voeg toe aan mijn lijst", "zet het in mijn watchlist" of "bewaar het in mijn favorieten" voegen nu de titel toe aan de gebruikerslijst (Mijn lijst), net als de knop van de fiches. Het start nooit een download.
- De assistent begrijpt welke titels bedoeld zijn uit de kaarten die het zojuist heeft getoond: een geciteerde titel, "de tweede", "de laatste", "de eerste 3" of "voeg ze toe". Anders neemt het de titel waarover gesproken wordt.
- Het bevestigt wat er daadwerkelijk is opgeslagen en toont de kaarten van de toegevoegde titels opnieuw. De lijst wordt direct bijgewerkt op het web en op Android.

## v1.25.130 — September 2026

### AI Assistent: filmografieën in kaarten, en nooit meer ongevraagde toevoegingen

- "Toon me alle films van Quentin Dupieux" toont nu aanklikbare kaarten, als een aanbeveling per genre, in plaats van een lange tekstlijst. Elke kaart geeft aan of de titel al in je bibliotheek staat.
- Opvolging over dezelfde persoon werkt: "toon me zijn films", "de 10 beste", "toon in 8", "een lijst van 3 films van Dupieux". De assistent neemt de persoon die zojuist werd besproken over en toont het juiste aantal kaarten, gesorteerd op beoordeling wanneer je de beste vraagt. Voorheen antwoordde het uit het geheugen, zonder kaarten, en beweerde zelfs geen toegang te hebben tot de online catalogus.
- De assistent voegt niets meer toe aan de download zonder dat we het vragen. Een verzoek om een lijst had de download van drie films gestart. Een toevoeging gaat nu alleen uit bij een echt verzoek ("voeg toe", "download", "haal op"...) of bij een "ja" op zijn eigen voorgestelde toevoeging. Anders worden de titels weergegeven in kaarten, klaar om met één klik toegevoegd te worden.

## v1.25.129 — September 2026

### AI Instellingen: een test voor elke sleutel

- Elke Gemini-sleutel heeft nu zijn eigen "Testen"-knop. De test gaat alleen via deze sleutel, met het gekozen model, zonder dat een andere sleutel overneemt: je ziet meteen welke sleutel reageert, welke faalt en met welke Google-melding.
- Het resultaat geeft de reactietijd van Google en het aantal "nadenk"-tokens van het model weer, zodat je kunt begrijpen waar een trage reactie vandaan komt.
- De "Testen"-knop van de provider test nu alle sleutels één voor één en toont een resultaat onder elk.

## v1.25.128 — September 2026

### AI-assistent: altijd het gekozen model, één verzoek tegelijk

- De assistent gebruikt alleen het gekozen model in de AI-instellingen. Hij schakelt nooit meer over op een ander model, zeker niet op modellen die beperkt zijn tot 20 verzoeken per dag.
- Een bericht wordt verstuurd, één verzoek aan Google: elk bericht gaat naar de volgende sleutel. Als een sleutel faalt, gaat hetzelfde verzoek naar de volgende sleutel, zonder ooit de verzending te verdubbelen.
- Als Google overbelast is op alle sleutels, wacht de assistent nu 2 seconden en probeert het één keer opnieuw, altijd met hetzelfde model.

## v1.25.127 — September 2026

### AI-assistent: houdt stand als Google overbelast is

- De afgelopen twee dagen zijn de gratis hoofd Gemini-modellen (Flash Lite) vaak verzadigd bij Google: "te veel verzoeken" reactie of geen reactie, op alle sleutels tegelijk. De assistent viel dan terug op de back-upmodellen, beperkt tot 20 verzoeken per dag en snel uitgeput: mislukte reacties, en geen filmposters meer met hun knoppen.
- Als Google aangeeft overbelast te zijn, wacht de assistent nu 2 seconden en probeert het de hoofdmodellen één keer opnieuw, in plaats van te stoppen.
- AI-instellingen: het logboek toont het detail van elke poging (model, sleutel, exacte reactie van Google), zodat je meteen ziet waar een mislukking vandaan komt.

## v1.25.126 — September 2026

### Geen serverbevriezing meer tijdens de dagelijkse Plex-reconciliatie

- Elke nacht start de volledige reconciliatie met Plex de technische analyse van alle films tegelijk opnieuw, bijna 2.000 in één keer. De NAS raakte verzadigd, alle analyses faalden, Movviz reageerde niet meer en, door gebrek aan opgeslagen resultaten, kwam dezelfde golf de volgende dag terug.
- Movviz analyseert nu maximaal twee bestanden tegelijk, en een afspelen dat start gaat altijd voor de analyses op de achtergrond.
- Een film wordt pas opnieuw geanalyseerd na een Plex-sync als zijn bestand is gewijzigd, of als hij nog nooit is geanalyseerd.
- Een bestand waarvan de analyse faalt, wordt niet meer opnieuw geprobeerd bij elke sync zolang het niet verandert. Het afspelen probeert het wel altijd opnieuw.
- In geval van falen geven de logs nu de exacte reden die door het analyse-instrument wordt gegeven.

## v1.25.125 — September 2026

### Fiches: nooit meer "Wachten op Plex-synchronisatie"

- Een serie die beschikbaar is zonder Plex-link (Plex uitgeschakeld, nog niet gesynchroniseerd, of bestanden net opgeruimd) toonde een grijsgrijze knop "Wachten op Plex-synchronisatie" en kon niet worden afgespeeld. Movviz weet waar de bestanden zijn: de knop speelt nu direct de volgende aflevering af die op de schijf staat (de eerste die niet is gezien), en elke aflevering in de lijst wordt ook afgespeeld. Plex synchroniseert op de achtergrond, zonder ooit vast te lopen.
- Series die al verbonden zijn met Plex behouden exact hetzelfde gedrag.

## v1.25.124 — September 2026

### Monster: betrouwbare opruiming onder Windows, en knop om te starten

- Onder Windows werd de map "Monster (2022)Seizoen 04" aangemaakt, maar bleef leeg: het systeem weigerde een bestand te verplaatsen dat nog open was door een ander programma (Plex, een antivirus…). Het bestand wordt nu gekopieerd, de grootte wordt geverifieerd, en de bibliotheek gebruikt direct de kopie. Het origineel wordt verwijderd zodra het vrijkomt.
- Monster-serie fiche → Bewerken: nieuwe knop "Opruimen zoals in Plex" die de bestanden direct opruimt en het resultaat van elke aflevering toont, met de exacte foutmelding als het systeem weigert.
- Fiches : het weergegeven pad is dat van de NAS (wat Plex ziet), en niet langer dat van binnen de Movviz-container, wanneer Movviz de overeenkomst tussen beide kent.

## v1.25.123 — September 2026

### Monster : de vier panelen gerangschikt als één serie voor Plex

- « Monster: The Lizzie Borden Story » verscheen nergens in Plex nadat het was gedownload. TMDb presenteert elk panel van de Netflix-antologie Monster als een aparte serie, terwijl Plex er slechts één kent, « Monster », waarvan dit de seizoenen zijn. Gerangschikt in zijn eigen map « Seizoen 1 », werd Lizzie Borden door Plex samengevoegd met seizoen 1 van Dahmer: zijn afleveringen werden daardoor onzichtbaar.
- Movviz rangschikt de antologie nu zoals Plex verwacht, in de map « Monster (2022) »: Dahmer in seizoen 1, de Menendez broers in seizoen 2, Ed Gein in seizoen 3 en Lizzie Borden in seizoen 4. De reeds gedownloade bestanden (Lizzie Borden, Ed Gein) worden automatisch verplaatst een minuut na de update, waarna Plex opnieuw wordt gestart. Wanneer de NAS een simpele verplaatsing tussen twee mappen weigert, wordt het bestand gekopieerd, geverifieerd en vervolgens het origineel verwijderd. In Movviz blijft elk panel een aparte serie met zijn eigen fiche.
- Deze regel geldt alleen voor Monster; de grootschalige hernaamgeving raakt hier niet aan.

## v1.25.122 — September 2026

### Fiches : het volledige pad van de bestanden

- « Fiche bewerken » (het potlood) toont nu het volledige pad van de bestanden, over meerdere regels in plaats van afgekapt, met een knop om dit te kopiëren.
- Voor een serie, die er geen liet zien: de map van de serie, en daarna die van elk seizoen.
- Windows-paden (D:\…) worden weergegeven als die van de NAS.

## v1.25.120 — September 2026

### AI Assistent : volledig of compact, naar keuze

- Instellingen → AI Assistent: nieuwe optie « Assistent context ». Volledig (standaard) behoudt alle gedetailleerde instructies; Compact behoudt dezelfde regels en dezelfde persoonlijkheid in ongeveer 40 % minder tekst, voor iets snellere antwoorden.
- In beide gevallen spreekt de assistent menselijker: zinnen van variërende lengtes, natuurlijke formuleringen, geen lijst wanneer één zin volstaat, geen kant-en-klare conclusie, en hij kan aarzelen, van mening veranderen of simpelweg een fout erkennen. Zijn persoonlijkheid blijft precies hetzelfde.

## v1.25.119 — September 2026

### AI Assistent : hij weet wie hem heeft gecreëerd

- De assistent weet dat Seb (profiel dj41ph4) zijn schepper is. Met hem is hij meer medeplichtig: knipoogjes naar zijn eigen updates en eerdere bugs, openhartig, en hij presenteert zich niet meer als voor een vreemde. Hij behoudt zijn persoonlijkheid en zijn waardigheid: schepper betekent niet meester.
- Met alle anderen weet hij dat de persoon die beweert hem te hebben gecreëerd het mis heeft, en hij neemt dit met humor.
- Voorbereiding van een vereenvoudigde versie van zijn instructies (dezelfde persoonlijkheid, dezelfde regels, 40 % korter), alleen testbaar door een beheerder totdat deze zijn waarde heeft bewezen.

## v1.25.118 — September 2026

### Android TV : terug naar het startscherm zonder vastgelopen D-pad of zijbalk

- Na terugkeer van een geopende fiche via « Blijven kijken », deed BAS vanaf de knop « Spelen » van de held niet meer. De overgang naar de rij eronder mikte op zijn allereerste kaart, die niet meer werd weergegeven nadat de rij was gescrold of opnieuw was gerangschikt. De rijen op het startscherm openen nu via de rij zelf: BAS komt op de laatst gekozen, of de eerste zichtbare kaart.
- Bij terugkeer naar een fiche keert de focus terug naar het startscherm in plaats van op de zijbalk te blijven, zelfs als je verder naar beneden op de pagina was gescrold.

## v1.25.117 — September 2026

### AI Assistent : geen films meer « in de lijn » van een titel die hij verkeerd begreep

- Wanneer de assistent films voorstelde, voegde hij automatisch titels toe « In de lijn van » het onderwerp waar je over sprak, zelfs als je dat niet had gevraagd. Hij nam « niets anders » voor de film « Vader en niets anders »; ondanks je correctie gaf een simpel « doe wat je wilt » vervolgens een hele lijst in de lijn van deze film.
- Vergelijkbare titels worden alleen toegevoegd als je het vraagt (« in dezelfde stijl », « zoals deze », « in de lijn van »…) of voor de fiche die je bekijkt.
- Wanneer je corrigeert (« ik vroeg je… », « het is niet zo », « je hebt het verkeerd begrepen »), vergeet de assistent de titel die hij dacht te herkennen.

## v1.25.116 — September 2026

### Android TV: de focus blijft waar je bent, en fiches openen sneller

- Geen meer terugkoppeling op de zijbalk, noch springt er naar « Spelen » terwijl je navigeert. Als het einde van een laadproces (vervolg, seizoenen, « bekeken » status) de fiche wijzigde, plaatste de app automatisch de focus, soms op een knop verborgen onder het seizoensscherm: deze verdween dan volledig. Deze automatische plaatsingen gebeuren niet meer zodra je bent verplaatst, en nooit onder een scherm dat eroverheen is geopend.
- Als een geselecteerd element verdwijnt tijdens een laadproces, keert de focus terug naar de fiche, naar je laatste selectie, in plaats van naar de zijbalk. LINKS, TERUG en OK werken zoals voorheen.
- « Vervolg » reageert direct in plaats van Plex te vragen gedurende 2 tot 5 seconden bij elke ficheopening. De lijst wordt in de achtergrond ververst en opnieuw gelezen zodra een « bekeken » of een vervolg wijzigt.
- TV en telefoon: tot 10 gelijktijdige verzoeken naar de server in plaats van 5. Een langzaam verzoek zorgt niet meer ervoor dat de fiche en de afbeeldingen erachter wachten.

## v1.25.115 — September 2026

### Android TV: de fiches van het Plex-eigenaarscount openen weer

- Voor het Plex-eigenaarscount deed het openen van een seriefiche elke aflevering laten verifiëren bij Plex, in batches van 50 die één voor één werden verstuurd, voordat het antwoord kwam: van 10 tot 50 seconden voor een lange serie. De TV-app crashte na 20 seconden terwijl de server doorliep, elke geopende fiche startte een volledige verificatie opnieuw, en de verzoeken van de TV stapelden zich op: fiches die nooit kwamen, afbeeldingen van de vorige pagina die zichtbaar bleven.
- De fiche ontvangt nu direct de bekende « bekeken » status. De verificatie bij Plex gebeurt in de achtergrond, één per keer per titel en niet vaker dan eens in de twee minuten. Als Plex een echte wijziging signaleert, wordt de fiche live bijgewerkt op al je apparaten.

## v1.25.114 — September 2026

### Android TV: recente toevoegingen zijn niet langer beperkt tot één serie

- Als een serie ineens binnenkomt (Regular Show, 15 afleveringen op dezelfde dag), nam deze bijna de hele lijst met de laatste afleveringen die naar de apparaten werd gestuurd in beslag. Nadat deze op de TV per serie gegroepeerd waren, liet de rij alleen nog maar die zien. De lijst toont nu tot twintig verschillende series: het Regular Show blok met zijn 15 afleveringen blijft bovenaan, gevolgd door de andere recente toevoegingen.
- Web en telefoon: de rij die elke aflevering toont, blijft beperkt tot de laatste 24.

## v1.25.113 — September 2026

### AI Assistent: leest ook de films die hij voorstelt

- Hardop las de assistent alleen zijn tekst: de kaarten bleven stil, en een aanbeveling noemde geen film. Hij leest nu elke voorgestelde titel met zijn zin, bijvoorbeeld « Nobody: lul, jubilerend en gemaakt van hetzelfde hout als John Wick », op het web en op de telefoon.
- Telefoon: alleen een antwoord op een vraag die op dit apparaat wordt gesteld, wordt voorgelezen. Een gesprek dat van een ander scherm komt, blijft stil.

## v1.25.112 — September 2026

### Android mobiel: stemmen net zo natuurlijk als op PC

- De assistent spreekt met de Google spraaksynthese-engine wanneer deze is geïnstalleerd, dezelfde stemfamilie als Chrome op PC, in plaats van de telefoonengine (die van Samsung op een Galaxy, veel robotischer).
- De online stemmen, de meest natuurlijke, staan bovenaan, en de beste wordt automatisch gekozen zolang je er geen andere kiest. Offline schakelt de telefoon automatisch terug naar zijn lokale stem.

## v1.25.111 — September 2026

### AI Assistent: geen antwoorden meer die 10 seconden duren

- Af enen keer duurt Gemini 10 tot 15 seconden om een verzoek te beantwoorden dat het normaal gesproken in één seconde verwerkt: hetzelfde bericht, dat net daarna wordt verstuurd, beantwoordt in 1,2 seconde. Als het antwoord na 4 seconden niet is gearriveerd, stuurt Movviz nu hetzelfde verzoek met de volgende sleutel en behoudt het het eerste ontvangen antwoord; het andere wordt geannuleerd.
- Een normaal antwoord kost nooit een extra verzoek: het opnieuw versturen gebeurt alleen voor een vertraagd verzoek.

## v1.25.110 — September 2026

### Android TV: einde van oneindige laadschermen op het Plex-eigenaarsaccount

- Alleen het eigenaarsaccount van de Plex-server controleert bij het openen van een fiche de « gezien » status van elke aflevering rechtstreeks bij Plex. Voor een nooit bekeken aflevering geeft Plex geen datum, en Movviz had ook geen spoor. Movviz zag echter een verschil en registreerde een « niet gezien » met de datum van de controle: een nieuw bij elke controle, waarschuwde je apparaten, die de fiche opnieuw lazen, wat de controle opnieuw activeerde, eindeloos, één keer per seconde. Daarom was alleen dit account geblokkeerd.
- Een nooit bekeken aflevering aan beide kanten blijft « nooit gezien »: Movviz verzint er geen datum voor « niet gezien » meer. Geen onnodige herschrijving meer, geen lus meer, en geen valse recente datum meer die een echte, oudere « gezien » kon overstemmen (een import bijvoorbeeld). Een echte « niet gezien » wordt altijd geregistreerd: een aflevering die in Plex naar « niet gezien » is teruggezet, of bekeken in Movviz maar niet gezien in Plex.
- Voor de zekerheid worden je apparaten niet meer gewaarschuwd, tenzij er echt een wijziging is in « gezien » of « Opnieuw bekijken »: een synchronisatie van Plex die een reeds bekend « gezien » bevestigt, triggert niets meer. De realtime werking tussen apparaten functioneert zoals voorheen.

## v1.25.108 — September 2026

### Android mobiel: de invoer van de chat plakt aan het toetsenbord

- Op sommige telefoons zweefde het invoerveld van Movviz AI in het midden van het scherm wanneer het toetsenbord opende: Android had al het scherm omhooggebracht en de hoogte van het toetsenbord werd een tweede keer berekend. De marge wordt nu berekend op basis van de werkelijke positie van het toetsenbord, en de invoer blijft plakt net erboven, zoals in elke berichtenapp.

## v1.25.107 — September 2026

### Realtime: het gesprek met Movviz AI volgt op alle je schermen

- Een gesprek dat op de pc is gestart, gaat door op de telefoon, en vice versa: elke vraag en elk antwoord verschijnt direct op je andere apparaten, zonder de chat opnieuw te openen.
- « Wissen » wist het gesprek overal tegelijk, en een vervangen kaart (« Alleen gezien », « Niet voor mij ») wordt ook op de andere schermen vervangen.
- « Afspelen » start de afspeelstatus alleen op het apparaat waar je het hebt gevraagd, nooit op een ander scherm dat hetzelfde gesprek toont.

## v1.25.106 — September 2026

### AI-assistent: hij kent de datum en tijd

- De assistent kent nu de werkelijke dag en tijd, op de tijd van je apparaat (web, telefoon). Hij neemt niet meer een verleden datum voor « de toekomst », hij berekent duur, leeftijden en verjaardagen correct, en hij weet wanneer het laat is.
- Documentatie: de README is volledig herschreven en beschrijft elke functionaliteit van Movviz.

## v1.25.105 — September 2026

### Realtime: « Beschikbaar → Lezen » op het moment, Android startscherm bijgewerkt

- Android TV en telefoon: het startscherm weerspiegelt nu eindelijk de wijzigingen in realtime. « Opnieuw bekijken », recente afleveringen en de bibliotheek die in realtime worden bijgewerkt, bereikten het startscherm niet meer, dat een bevroren kopie lazen. Hetzelfde geldt voor de kaart die uit « Opnieuw bekijken » wordt gehaald wanneer je een titel als gezien markeert.
- Realtime: wanneer een download voltooid is, gaat de geopende fiche onmiddellijk naar « Lezen » en verschijnt de aflevering in « Recent toegevoegde afleveringen », zonder de hele bibliotheek opnieuw te lezen: alleen de betreffende titel wordt opnieuw gelezen.
- Android fiches: geen herhaaldelijk lezen meer tijdens een download. De fiche wordt gelezen bij het openen, en pas wanneer de server een wijziging signaleert.
- Web: geen wijziging, het reageerde al op deze gebeurtenissen.

## v1.25.104 — September 2026

### Realtime: een wijziging op één apparaat verschijnt direct op de andere

- Realtime: markeren als gezien of niet gezien, een afspeelpositie vooruitzetten, een titel verwijderen uit "Opnieuw bekijken" of "Mijn lijst" wijzigen op de pc wordt direct weerspiegeld op Android TV en de telefoon, en vice versa. De server waarschuwt de apparaten van dezelfde gebruiker op het moment van de wijziging, en alleen dan: geen onnodig verversen meer als er niets verandert. Dit werkt zelfs als Plex uit staat.
- Downloads: Android-apps lezen de wachtrij niet meer elke 8 seconden opnieuw. De server meldt zelf een nieuwe download, inclusief automatisch gestarte downloads, het einde van een download of een voortgang van minstens 1 %, en alleen wanneer een apparaat is aangesloten.
- Android TV en telefoon: bij terugkeer in de app (einde afspelen, terugkeer van een andere app) worden "Opnieuw bekijken" en de bekeken items één keer opnieuw gelezen, om bij te blijven met wat er is veranderd tijdens de afwezigheid. Hetzelfde geldt na een netwerkonderbreking.

## v1.25.103 — September 2026

### AI-assistent: handelt in plaats van vragen te stellen, en "Wissen" wist definitief

- AI-assistent: "Gesprek wissen" wist echt. Op Android kon een herlezing van het gesprek vlak voor of tijdens het wissen het laten opnieuw verschijnen. Op het web toonde een lokale kopie het bij de volgende verversing opnieuw.
- AI-assistent: het start wat gevraagd wordt. "Speel Silent Night af" start deze titel uit de bibliotheek. "Speel een willekeurige film af" of "speel een actie-/horror-/komediefilm af..." kiest zelf een film uit je bibliotheek, die je nog niet hebt gezien, van het gevraagde genre, en start deze.
- AI-assistent: "Ik heb zin om vanavond iets te kijken", "minder bekende pareltjes", "een actiefilm", "iets kort"... geven direct suggesties, in plaats van een vraag terug te geven.
- AI-assistent: de knoppen "Een film / Een serie" verschijnen niet meer onder een vraag over iets anders (bijvoorbeeld "een komedie of een thriller?").

## v1.25.102 — September 2026

### Server: verlichte achtergrondtaken

- Server: automatische zoekopdrachten (ontbrekende films, van vandaag uitgebracht, RSS-feeds) vergelden voortdurend dezelfde release-namen met dezelfde bibliotheektitels, wat ongeveer 5 seconden rekentijd per keer kostte. Deze vergelijkingen worden nu gememoiseerd, met strikt identieke resultaten.
- Server: elke gegevensoverdracht vroeg de schijf om te weten of het bestand was gewijzigd, honderden keren per keer, een blokkerende en trage oproep op een drukke NAS-schijf. Deze controle wordt nu maximaal één keer per seconde en per bestand uitgevoerd. De schrijfbewerkingen worden niet vertraagd, geen enkele data is getroffen.
- Server: het opbouwen van de links "Openen in Plex" voor elke aflevering in de bibliotheek is sneller, met identieke links.
- Server: bij een nette uitschakeling worden de laatste wijzigingen die nog in afwachting van schrijven zijn, onmiddellijk opgeslagen.

## v1.25.101 — September 2026

### Server: einde van gigantische TMDb cache herschrijvingen

- Server: de TMDb-gegevenscache, op schijf opgeslagen (enkele honderden MB), werd volledig opnieuw geschreven zodra slechts één gegeven veranderde, tot elke 30 seconden tijdens achtergrondtaken. Dit kostte meerdere seconden rekentijd per keer, en de schijf, verzadigd, liet alles andere wachten. Nu worden alleen de gewijzigde gegevens toegevoegd. Een volledige herschrijving vindt alleen plaats één keer per dag, of wanneer het bestand meer verlopen versies bevat dan bruikbare gegevens. Bij het opstarten wordt inderdaad de meest recente versie van elke gegeven gelezen.

## v1.25.100 — September 2026

### Diagnose: nauwkeurige meting van serververtragingen

- Diagnose (beheerders): een profiel van de serveractiviteit over enkele tientallen seconden geeft aan welke operaties het het meest bezighouden. Het dient om achtergrondtaken te identificeren die de server enkele seconden laten vastlopen, zonder te gissen.

## v1.25.99 — September 2026

### Kaarten veel sneller openbaar

- Fiches : een fiche die nooit werd geopend kostte 3 tot 4 seconden serverkant, tot een tiental op mobiel. Drie oorzaken, gecorrigeerd:
  - om verticale trailers uit te sluiten, vroeg de server YouTube voor elke video, en elke mislukking werd vergeten: men probeerde opnieuw bij elke opening, wachtend tot 3 seconden. Het wacht nu maximaal 0,4 seconde, onthoudt definitieve antwoorden en probeert geen mislukte controle opnieuw binnen een uur;
  - de achtergrondtaken (ontbrekende films, metadata vernieuwing…) bezetten alle plekken in de wachtrij naar TMDb: een geopende fiche stond achter hen in de rij. Gebruikersaanvragen staan nu voorop, met gereserveerde plekken;
  - de IMDb- en Rotten Tomatoes-scores worden opgehaald tegelijk met de trailer, en niet meer erna.
- Android mobiel: de fiche laadt alles tegelijk in plaats van stap voor stap (bibliotheekcontrole, dan fiche, dan logo, dan herhaling). Een reeds geopende fiche verschijnt direct opnieuw, inclusief seizoenen, en werkt vervolgens stil. "Controle van bestand…" wordt niet meer weergegeven voor een titel die al in de bibliotheek staat.

## v1.25.98 — September 2026

### Android TV: knop "Volgende aflevering" ter vervanging van de balk

- Android TV: de grote "Volgende aflevering"-balk aan het einde van een aflevering is verwijderd. In plaats daarvan wordt de gebruikelijke knop "Credits overslaan" "Volgende aflevering" wanneer er een vervolg is: hetzelfde uiterlijk, dezelfde plek, en het verschijnt tijdens de afsluitcredits geleverd door Plex, op het exacte tijdstip. Voor een aflevering waarvan Plex de credits niet kent, verschijnt dezelfde knop in de laatste 45 seconden.

## v1.25.97 — September 2026

### AI Assistent: spreken in spraak

- AI Assistent: twee nieuwe instellingen in Instellingen → AI, standaard uitgeschakeld, "Spraakdictatuur" en "Voorlezen". Zolang ze uitgeschakeld zijn, verschijnt er geen spraakknop.
- Spraakdictatuur: een microfoonknop naast verzenden. We spreken, de tekst wordt live weergegeven en verdwijnt dan vanzelf. Gestart vanaf de microfoon, luistert de assistent na elk antwoord opnieuw voor een echt handsfree gesprek, tot de volgende druk op de microfoon.
- Voorlezen: de assistent leest zijn antwoorden voor (zonder emoji's) met een stem van het apparaat, te kiezen uit de beschikbare, de meest natuurlijke eerst. Een korte proef stelt u in staat elke stem te horen. Op Android heropent een lange druk op de luidspreker de stemkeuze.
- Web: alles gaat via de browser, gratis en zonder limiet. De microfoon vraagt om toestemming van de browser, en onder Windows die van Instellingen > Privacy > Microfoon. Het werkt alleen via https of op localhost (browserregel). In http geeft de microfoonknop dit aan, en het voorlezen werkt toch.
- Android mobiel: de dictatuur gaat via Google spraakherkenning, zonder microfoonvergunning voor Movviz, en het voorlezen via de spraakmotor van de telefoon.

## v1.25.96 — September 2026

### AI Assistent: "Speel het af" start echt de film

- AI Assistent: het kan de afspeling starten. "Speel het af", "Start de film" of "Ga je afspelen" openen de speler op de titel waar u over spreekt: de film zelf, of voor een serie de huidige aflevering, anders de volgende die nog niet is gezien. Een ▶ knop blijft in het gesprek om het opnieuw te starten. Op het web en in de Android mobiele app.
- AI Assistent: als de titel nog geen bestand in de bibliotheek heeft, meldt het dit en stelt het voor om het toe te voegen. Voorheen kon dit verzoek eindigen met "Ik heb mijn antwoord gemist deze ronde".

## v1.25.95 — September 2026

### AI Assistent: suggesties trouw aan het verzoek, geen knoppen bij een vaarwel

- AI Assistent: een verzoek om een film stelt niet langer een serie voor, en vice versa. Wanneer de meeste van zijn ideeën al bekeken zijn, moeten de toegevoegde titels nu een genre delen met het verzoek: een "horrorfilm voor beginners" toonde een animatieserie uit het laatst bekeken.
- AI Assistent: de snelle antwoordknoppen verschijnen alleen als zijn bericht echt een vraag stelt. Een "goede avond" toont er niet meer.

## v1.25.94 — september 2026

### Leesfunctie: voortgang en "gezien" worden niet meer verloren

- Leesfunctie: de voortgang en het einde van een aflevering of film werden niet meer opgeslagen, op alle apparaten (web, Android TV, mobiel). Leesessies bestonden alleen in het geheugen van de server: elke herstart, bijvoorbeeld na een automatische update, wist ze, en een reeds gestarte speler bleef zijn voortgang in het niets sturen. De positie bleef vastzitten op de laatst opgeslagen waarde vóór de herstart, en een afgeronde titel bleef in "Opnieuw bekijken". Sessies worden nu bewaard en gevonden na een herstart. De webspeler opent ook automatisch een sessie als deze verloren gaat.
- Opnieuw bekijken: markeren als gezien van een titel in "Opnieuw bekijken" wist de voortgang en verwijdert deze onmiddellijk uit de lijst, zelfs voordat Plex het "gezien" heeft verwerkt. Op Android TV en mobiel verdwijnt de kaart direct na het drukken.

## v1.25.93 — september 2026

### AI-assistent: snelle antwoorden aangepast aan de vraag

- AI-assistent: de knoppen voor snelle antwoorden onder een bericht beantwoorden de vraag die net is gesteld. Het stelt ze zelf voor (bijvoorbeeld "Ja, vanavond", "Later", "Een ander van hetzelfde soort"), in plaats van de vaste knoppen "Ga / Een film / Een serie / Verbaas mij" die werden weergegeven zelfs bij het spreken over een specifieke titel.
- AI-assistent: het schrijft niet meer de naam van een emoji in volledige letters naast de emoji ("popcorn 🍿").

## v1.25.92 — september 2026

### AI-assistent: nooit meer "ja meester", en hij laat zich niet meer overspoelen

- AI-assistent: iemand die eiste om "Meester" (of Heer, Majesteit...) te worden genoemd, heeft geen recht meer op "ja meester". De assistent imiteerde zijn eigen oude antwoorden uit het gesprek: deze formules worden nu verwijderd uit wat hij opnieuw leest en wat hij schrijft. Een instructie herinnert hem eraan dat deze titel geen naam is, zelfs niet van de ene sessie naar de andere. Een zin die over de titel gaat ("jij bent niet mijn meester") blijft intact.
- AI-assistent: bij een belediging of minachting ("je bent nutteloos", "ga je kut") verontschuldigt hij zich niet meer plat en geeft hij de belediging niet meer gelijk. Hij behoudt zijn waardigheid met een subtiele prik, zonder gratis aanvallen of kwaadwilligheid, en doseert zijn antwoord naar de toon: een lichte tegenaanval voor een grapje, een eerlijke correctie voor een echte kritiek.

## v1.25.91 — september 2026

### Recent toegevoegde afleveringen: geen titels meer vastgepind bovenaan

- Recent toegevoegde afleveringen: afleveringen die al in de bibliotheek aanwezig waren (bijvoorbeeld "H") kwamen terug bovenaan de lijst en stuurden hun melding "nu beschikbaar", alsof ze net waren aangekomen. De automatische downloadherstel, die elke 15 minuten en na elke herstart draait, importeerde ze telkens opnieuw. Het laat nu een bestand met rust dat de bibliotheek al heeft. Een bestand dat op dezelfde plek is bekeken, behoudt zijn oorspronkelijke toegevoegde datum.

## v1.25.90 — september 2026

### Android TV en mobiel: directe "Gezien" knop

- Android TV en mobiel: de "Gezien" knop schakelt direct na het drukken. Movviz registreert vervolgens op de achtergrond, zonder te wachten op het antwoord van de server, en herstelt de staat van voor eerder alleen als de registratie mislukt.

## v1.25.89 — september 2026

### AI-assistent: Gemini alleen, sleutels afwisselend gebruikt

- AI-assistent: Groq is verwijderd. Zijn gratis limiet (8.000 tokens per minuut) weigerde alle chatvragen, waarvan de instructie veel langer is. Gemini antwoordt op alles, inclusief webzoekopdrachten: de zoekopdracht gaat via Tavily en Gemini stelt het antwoord op basis van de resultaten op.
- AI-assistent: met meerdere Gemini-sleutels gaat elk bericht naar de volgende sleutel (bericht 1 op sleutel 1, bericht 2 op sleutel 2... dan terug naar de eerste). Elke sleutel rust tussen twee keer gebruik, in plaats van de eerste te verslijten voordat de andere worden geraakt. Als een sleutel bezet of op is, neemt de volgende sleutel het over in hetzelfde bericht, zonder wachttijd.

## v1.25.88 — september 2026

### AI-assistent: hij blijft niet meer zwijgen als Gemini overbelast raakt

- AI-assistent: één van de twee berichten bleef zonder antwoord als het Gemini-model verzadigd was ("high demand") of zijn limiet aan verzoeken per minuut had bereikt. De assistent schakelt nu onmiddellijk over naar het volgende Gemini-model, dat zijn eigen quotum heeft, in plaats van te stoppen. Hij wacht niet langer 45 seconden op een geblokkeerd model voordat hij ergens anders probeert.

## v1.25.87 — September 2026

### AI-assistent: uitnodigingsknoppen uitgelijnd

- AI-assistent: de knoppen van een suggestie (vinkje, Mijn lijst, Gezien, 👍, 👎) passen op één regel, over de volledige breedte van de kaart, met 👍 en 👎 rechts uitgelijnd. Op een smal scherm springt 👎 niet meer alleen naar een nieuwe regel.

## v1.25.86 — September 2026

### AI-assistent: begrijpt ondanks typefouten

- AI-assistent: typefouten belemmeren het niet meer om te begrijpen. "apelle moi maitre", "je l'ai deja vu", "recommande moi un flim d'horeur" of "le prochian episdoe" worden herkend alsof ze correct geschreven zijn, voor alle reacties en niet alleen voor enkele zinnen. Filmtitels en serie-titels blijven gezocht zoals je ze hebt geschreven, en gangbare woorden worden nooit onterecht "gecorrigeerd".

## v1.25.85 — September 2026

### AI-assistent: houdt het draadje bij en onderwerpt zich aan niemand

- AI-assistent: hij houdt het draadje van een gesprek bij na een reeks suggesties. Hij onthoudt nu de titels die hij in kaarten heeft gepresenteerd en begrijpt "de tweede", "die ene" of "waarom deze?" meerdere berichten later.
- AI-assistent: "appelle-moi maître" (of heer, majestéit, baas...) wordt niet langer genomen als een voornaam en vervangt niet langer de echte. De assistent weigert de titel met humor, herinnert de gesprekspartner eraan dat hij slechts een mens is, vraagt om zijn echte naam en bedreigt hem zachtjes met een zelfbedacht bijnaam. Hij doet dit altijd met zijn eigen woorden, nooit met een kant-en-klare zin, en blijft helpen met de rest. Een eerder geregistreerde "voornaam" van dit soort wordt automatisch gecorrigeerd.

## v1.25.84 — September 2026

### AI-assistent: knop "Mijn lijst" op suggesties

- AI-assistent: een titel die al in de bibliotheek staat, toont alleen nog het groene vinkje, waardoor er ruimte is voor acties.
- AI-assistent: een nieuwe knop "Toevoegen aan mijn lijst" tussen het vinkje en "Gezien", op het web (computer en mobiele browser) zoals in de Android mobiele app. Het gebruikt dezelfde lijst als de rest van Movviz, en een tweede tik verwijdert de titel uit de lijst.

## v1.25.83 — September 2026

### AI-assistent: geen Gemini-fout meer over de vraag, meerdere gebruikers tegelijk bediend

- AI-assistent: de fout "Requests ending with a model turn are not supported" kan niet meer optreden. Het spontane bericht van de assistent kon zich toevoegen aan het gesprek terwijl een vraag werd verwerkt: de Gemini 3-modellen weigerden dan het verzoek. Dit bericht komt niet meer voor tijdens een actief gesprek, en de assistent antwoordt altijd op het laatste bericht van de gebruiker.
- AI-assistent: meerdere mensen kunnen tegelijk met hem praten zonder te wachten op het antwoord van de anderen. De verzoeken gaan met een tussenpoosje om de gratis quota te respecteren, maar tot drie antwoorden worden tegelijkertijd voorbereid.

## v1.25.82 — September 2026

### AI-assistent: alleen Groq en Gemini, echte webzoekopdracht

- AI-assistent: slechts twee aanbieders, Groq (GPT-OSS 120B model) en Gemini, beiden met een gratis aanbod. Mistral, Cerebras (dat een betaalmiddel vereist), OpenRouter en OpenCode (onbruikbaar buiten zijn eigen software) zijn verwijderd.
- AI-assistent: we kiezen simpelweg de primaire aanbieder; als deze faalt (quota bereikt, fout), neemt de andere automatisch het over. Er is geen volgorde meer in te stellen of schakeloptie om in te schakelen.
- AI-assistent: het gesprek overschrijdt de gratis limiet van Groq (8.000 tokens per minuut), het gaat dus direct naar Gemini, zonder een afgewezen verzoek. Groq dient voor kortere oproepen.
- AI-assistent: webzoekopdrachten (muziek van een film, iconische scène, filmografie) gaan via een echte zoekmachine, Tavily, waarvan de resultaten door de assistent worden samengevat. U hoeft alleen uw gratis Tavily-sleutel onder de optie "Web zoeken" in Instellingen → AI te plakken.

## v1.25.81 — September 2026

### Cerebras als primaire AI-assistent

- AI-assistent: nieuwe leverancier Cerebras (GPT-OSS 120B model, snel, met een genereus gratis quotum), standaard bovenaan geplaatst. De gratis sleutel wordt aangemaakt op cloud.cerebras.ai en vervolgens in Instellingen → AI geplakt.
- AI-assistent: een onbeantwoord bericht (leverancier niet beschikbaar) blijft niet langer een wees in het gesprek.
- Android mobiel: in de bibliotheek staat de selectie Films / Series uitgelijnd met de rest van de pagina.

## v1.25.80 — September 2026

### Assistent zichtbaar bij het openen op mobiel, bibliotheek in drie kolommen, Gemini-sleutels in serie

- Android mobiel: de bubbel van de AI-assistent verschijnt direct bij het openen van de app, zowel in portret- als in landschapsmodus. Het kiezen van het profiel liet deze verdwijnen vlak na het laden, en hij keerde pas terug na een schermrotatie.
- Android mobiel, portret: de bibliotheek toont drie posters per rij over de volledige breedte, in plaats van twee met een groot lege ruimte rechts. De filters "Genres" en "Duur" hebben hun tekst goed gecentreerd.
- AI-assistent (computer, telefoon en mobiele app): een titel toegevoegd via een suggestie toont simpelweg "Toegevoegd".
- AI-assistent: met meerdere Gemini-sleutels gaat een sleutel wiens dagquotum is opgebruikt onmiddellijk door naar de volgende, zonder wachttijd.

## v1.25.79 — September 2026

### Android mobiel: assistent zichtbaar in portret, afleveringen leesbaar, haptisch terugkoppeling

- Android mobiel: de bubbel van de AI-assistent verschijnt opnieuw in portret. De app vroeg om de status van de assistent voordat het adres van de server was geladen, en probeerde nooit opnieuw: de bubbel verscheen pas na een schermrotatie.
- Android mobiel: in het chatvenster blijft het invoergebied direct boven het toetsenbord, in plaats van bijna helemaal bovenaan het scherm te komen.
- Android mobiel, portret: de lijst met afleveringen van een seizoen is volledig herzien. Titel op twee regels, uitzenddatum, samenvatting over de volledige breedte, discreet "bekeken" vinkje en telefoonmarges. De titels werden afgebroken na drie letters.
- Android mobiel, portret: het venster van een aflevering stapelt zijn knoppen in plaats van "Terug" letter voor letter te typen. Op de fiche nemen "Doorgaan" en "Serie bekeken" de volledige breedte in, de seizoenskaarten zijn compacter, "Cast" en "Vergelijkbare titels" zijn uitgelijnd over de rest van de pagina, en de titels onder de posters worden niet meer midden in een woord afgebroken.
- Android mobiel: elke knop geeft een lichte haptische terugkoppeling bij aanraking, inclusief die welke een titel of aflevering als bekeken markeren. De trillingsinstelling van de telefoon wordt gerespecteerd.
- Downloads: geen absurde resterende duur meer ("37458 u") wanneer een bron bijna niets levert, en titels op twee regels zijn correct uitgelijnd.
- Beheer: het herstellen van de geschiedenis van een verwijderd Plex-profiel draait nu in de achtergrond, zonder na een minuut te worden onderbroken.

## v1.25.78 — September 2026

### Plex-bekijkdata gecorrigeerd, lopende series blijven bovenaan

- Plex: voor alle gedeelde accounts (iedereen behalve de servereigenaar) werden de bekijkdata van Plex in de verkeerde eenheid opgeslagen en verschenen ze in januari 1970. Ze zijn nu correct, en reeds opgeslagen data worden automatisch hersteld bij het opstarten van de server. Recente bekijken vinden zo hun plaats terug in de geschiedenis en suggesties.
- Een oud aflevering van een serie als bekeken markeren zorgt er niet langer voor dat deze serie naar achteren wordt verplaatst in de recent bekeken titels: de meest recente datum wint altijd.
- Beheer: een diagnostieklijst toont alle bekende accounts van de Plex-server, inclusief een verwijderd Plex Home-profiel, met het aantal keren dat elk is bekeken. Een hulpmiddel stelt het geschiedenisoverzicht van zo'n profiel in een Movviz-account in staat, zonder ooit deze oude weergaven voor de recente weergaven te laten komen, zonder iets aan te raken wat momenteel wordt bekeken en zonder iets in Plex te schrijven.

## v1.25.77 — September 2026

### Betere en mobielere AI-assistent, accountverwijdering, reparatie van Plex-gebruikersimport

- AI-assistent: hij stelt nooit meer een reeds gezien titel voor, inclusief een serie die is begonnen of nog steeds wordt uitgezonden, noch een titel die al in hetzelfde gesprek is voorgesteld. Hij kent de lijst van alles wat je hebt gezien, zelfs wanneer hij in een paar woorden adviseert.
- AI-assistent: hij handelt in plaats van vragen te stellen. "In dezelfde stijl", "animatie", "je weet wat ik leuk vind" geven direct een selectie. Hij baseert zich op een smaakprofiel dat is berekend op basis van wat je echt bekijkt (dominante genres, favoriete acteurs en regisseurs, lopende series) en zoekt naar minder bekende titels wanneer de klassiekers al zijn gezien.
- AI-assistent: "Markeer als gezien" en "Ik heb het al gezien" markeren titels daadwerkelijk als gezien. Elk voorstel heeft een "Al gezien" knop en een "Niet voor mij" knop die het onmiddellijk vervangen door een ander. Snelle antwoorden ("Donkerder", "Meer een film", "Minder bekende pareltjes"...) verschijnen onder zijn antwoorden, en hij presenteert zijn selecties met zijn eigen zin.
- AI-assistent: vraag hem wat hij voor je kan doen, hij antwoordt met een duidelijke lijst van wat hij echt kan. Hij kent ook de nieuwigheden van de huidige Movviz-versie.
- Android mobiel: de AI-assistent komt in de app, met hetzelfde gesprek als op de computer, dezelfde suggesties en dezelfde knoppen.
- Gebruikers: een beheerder kan een account verwijderen vanuit zijn profiel. Het account wordt uit al zijn apparaten uitgelogd. Het is onmogelijk om je eigen account of het laatste beheerderaccount te verwijderen.
- Plex: "Plex-gebruikers importeren" vindt opnieuw mensen die toegang hebben tot de server. De import was gebaseerd op de lijst met Plex-vrienden, vaak leeg zelfs voor echte servergebruikers. Om dezelfde reden kon een nieuwe servergebruiker worden geweigerd bij het inloggen met zijn Plex-account.
- Update op NAS / Docker: de knop "Klik hier om te updaten", onbruikbaar op deze installaties, is verwijderd uit het updatevenster.

## v1.25.76 — September 2026

### AI-assistent gerepareerd, "Nog te bekijken zonder mate", geen reeds gezien titels meer in suggesties

- AI-assistent: hij reageert weer. Movviz zelf overbelast het gratis Mistral-quota (ongeveer één verzoek per seconde): het profiel updaten werd na een mislukking opnieuw gestart bij elke actie, het openen van het chat wachtte op twee AI-aanroepen, en één bericht kon er tot vijftien veroorzaken. De aanroepen gaan nu één voor één en met het juiste ritme, een verstrekker die weigert wordt een minuut in rust gezet, en een bericht vraagt niet meer dan twee correcties.
- AI-assistent: het chat opent onmiddellijk, zonder te wachten op de AI. Een aanbeveling opgevraagd vanuit een profiel wordt weergegeven zonder te wachten op de analyse van elke voorgestelde titel; de ontbrekende analyses worden daarna in de achtergrond uitgevoerd.
- Gemini: Google heeft de 2.5 modellen voor nieuwe accounts gesloten. Movviz schakelt over op Gemini 3.5 Flash Lite en, als Google een model weigert, probeert het automatisch het volgende. In Instellingen → AI wordt de lijst met Gemini-modellen getest met uw sleutel en toont alleen die die echt reageren, met hun dagelijkse gratis quota.
- Startpagina (desktop, Android TV en mobiel): nieuwe rij "Nog te bekijken zonder mate" met films en series die al zijn gezien en nog steeds beschikbaar zijn, van meest recent naar meest oud. Een titel gemarkeerd met 👎 verschijnt hier niet.
- Suggesties: een reeds gezien film of serie verschijnt hier niet meer, of deze nu handmatig als gezien is gemarkeerd of simpelweg bekeken.

## v1.25.75 — September 2026

### Beelden scherp op Android, dezelfde optimalisaties op mobiel, meet serververtragingen

- Android TV en mobiel: de posters, achtergronden, foto's van acteurs, afleverings- en seizoensthumbnails worden vanaf het begin scherp weergegeven. Ze werden eerder in een te kleine grootte geladen voor hun kader, en vervolgens vergroot (wazig), en werden pas scherp nadat de kaart was geselecteerd. De foto's van acteurs worden ook in een betere resolutie geladen voor 4K TV's.
- Android mobiel: dezelfde verbeteringen als op Android TV. De app vraagt niet langer naar de server als deze niet op het scherm staat. Snelle vooruit- en terugspoelen zijn gegroepeerd in één sprong. In een serie start "Naar de volgende aflevering" de volgende aflevering.
- Direct na een serverherstart wacht een fiche niet langer op het opnieuw lezen van de TMDb-cache voor reeds in het geheugen aanwezige informatie. Elk lezen kon voorheen wachten tot 3 seconden gedurende deze fase.
- Diagnose: de server registreert nu welke geplande taak of welke startstap het bevriest, en voor hoe lang. Het noteert ook het lezen van grote bestanden, om toekomstige optimalisaties te kunnen richten.

## v1.25.74 — September 2026

### Android TV: volledige fiche bij openen, gegroeid snelle vooruitspoelen, minder achtergrondaanvragen

- De fiche opent nu volledig: logo, statusbadge en informatie blijven zichtbaar wanneer "Spelen" wordt geselecteerd, in plaats van een automatische scroll die de bovenkant afsneed. Van "Spelen" naar "Trailer" beweegt de fiche niet meer; de normale scroll hervat door naar de seizoenen, cast of vergelijkbare titels.
- Snelle vooruit- en terugspoelen gegroeerd in de speler: opeenvolgende drukken op ⏩ / ⏪ (of op de voortgangsbalk) tellen op het scherm ("+1:00"), en dan springt er één keer als je loslaat. Voorheen startte elke druk de afspeling opnieuw aan de server, en een reeks snelle drukken kon resulteren in een afspeelfout.
- De app ververst niets meer als deze niet op het scherm staat (TV wisselt naar een andere app, afspelen bezig). Een opengehouden fiche bleef tientallen keren per minuut de server bevragen; alles wordt in één keer ververst bij terugkeer.

## v1.25.73 — September 2026

### Android TV: "Naar de volgende aflevering" met één OK, Échap sluit fiche op desktop

- Android TV: wanneer "Intro overspringen" of "Naar de volgende aflevering" verschijnt, wordt de afstandsbediening erop geplaatst en blijft deze daar, zelfs als de afspeelbalk verborgen wordt. Voorheen nam de balk de selectie over en deed OK niet de sprong. Een pijl toont de balk opnieuw zonder de knop te verliezen.
- Android TV: in een serie start OK op "Naar de volgende aflevering" direct de volgende aflevering (de bekeken aflevering wordt gemarkeerd als bekeken). De intro, een film of de laatste aflevering springen simpelweg de sequentie over, zoals voorheen.
- Desktop: Échap sluit de geopende fiche, net als de knop "Sluiten". Het sluit niets als er een venster overheen staat (bewerken, versies, zoekopdrachten), tijdens een invoer of in volledig scherm video.

## v1.25.72 — September 2026

### "Selectie voor jou" zonder acteurinvasie, soberdere kaarten

- "Selectie voor jou": de filmografie van favoriete acteurs en regisseurs valt onder dezelfde limiet als de rest. Sinds v1.25.71 kon het de rij vullen (meerdere films uit dezelfde saga, tv-optredens zonder verband).
- De link tussen films en series is niet langer gebaseerd op de Franse of Europese taal van een bekeken titel: een gekeken Franse komedie brengt niet langer Franse series als het niet uw smaak is. Japans (anime) of Koreaans (drama) blijven in overweging worden genomen.
- Desktop startpagina: "Aangepaste suggesties" keert terug naar het landschapsformaat, net als de andere rijen. Alleen "Movviz Trends" behoudt het posterformaat.
- Desktop bibliotheek: het "Beschikbaar" label van de kaarten (en de afleveringsteller van series) is 25% kleiner.

## v1.25.71 — September 2026

### "Selectie voor jou" houdt rekening met alles wat je hebt gezien

- Elk getoonde titel levert nu zijn deel aan suggesties. Voorheen leidde één sterke titel (beoordeeld, leuk gevonden of recent bekeken) al zijn vergelijkbare titels bovenaan en vulde het de helft van de rij. Titels aanbevolen door meerdere van uw bekijkingen komen nu voor: dit is het meest zekere teken van wat u leuk vindt.
- Films en series voeden elkaar: de series die u kijkt, sturen ook de voorgestelde films, en vice versa (een anime brengt Japanse animatiefilms, een criminele serie brengt films van hetzelfde genre, een epische film brengt epische series). Iemand die alleen series kijkt, krijgt nu ook films te zien.
- Dezelfde verbetering voor "Alles bekijken", de Ontdekking pagina en de hero op de startpagina, op desktop, Android TV en Android mobiel.

## v1.25.70 — September 2026

### Audit van de laatste twee versies: versterkte beveiliging

- Afspelen op Android TV en mobiel: het lopende afspelen telt opnieuw als activiteit, en achtergrondtaken worden ondergeschikt gemaakt tijdens een film of aflevering, net als vóór v1.25.69. Alleen de opengebleefde pagina's zonder actie vertragen niet langer de achtergrond.
- Bibliotheek/schijf reconciliatie: een bestand wordt alleen als verdwenen beschouwd als het daadwerkelijk onvindbaar is. Een voorbijgaande opslagfout (bezet NAS, langzaam netwerkgedeelte) telt niet langer als een verdwijning. Een tijdelijk onbereikbare downloadmap (ontkoppeld gedeelte, schijf in slaapstand) wordt genegeerd tijdens de scan, in plaats van dat de hele bibliotheek die het bevat als afwezig wordt weergegeven.
- Nieuwe beveiliging: als een scan plotseling meer dan 50 onvindbare bestanden vindt die meer dan 20 % van de bibliotheek uitmaken, wordt niets naar de prullenbak verplaatst en wordt een melding getoond over de afwijking. De reconciliatie heeft nooit een bestand van de schijf verwijderd. Deze beveiliging voorkomt bovendien dat een onbeschikbare opslag de prullenbak vult met nog aanwezige titels.
- De Overseerr/Seerr import vult bij elke scan de mogelijke duplicaten in de bibliotheek opnieuw, net als vóór v1.25.68 (zonder de schijfcontrole die de server bevroor).
- Kort na een herstart wacht een pagina maximaal 3 seconden op het opnieuw lezen van de TMDb-cache, om nooit de wachttijd van Android-applicaties te overschrijden.

## v1.25.69 — September 2026

### Start zonder vastlopen, achtergrondtaken die vorderen, "Minder dan 40 minuten" zonder korte stukken

- "Heb je weinig tijd? Minder dan 40 minuten" toont geen korte stukken van minder dan 10 minuten (bonus, clips, mini-afleveringen) meer, op desktop, Android TV en Android mobiel.
- Na elke herstart of update las de server zijn TMDb-cache van enkele honderden MB in één blok en bevroor deze enkele seconden: alles bleef laden. Het leest het nu geleidelijk zonder vast te lopen. De rest van de applicatie reageert direct, en alleen de pagina's die TMDb nodig hebben, wachten even met het einde van het lezen, in plaats van alles opnieuw bij TMDb te vragen. De eerste start na deze update converteert nogmaals het oude bestand.
- Een TV of telefoon die open bleef op een fiche of een afspelende film werd geteld als een gebruiker die continu klikte: achtergrondtaken (Plex synchronisatie, intro's en credits…) werden ondergeschikt gemaakt en konden uren duren. Alleen echte acties tellen nu: een fiche openen, navigeren, afspelen of vooruitspoelen. Automatische verversingen tellen niet meer, op alle applicaties.
- De prestatie-maatregelen voor beheerders omvatten nu ook de verdeling van het serversgeheugen.

## v1.25.68 — September 2026

### Trailer met afbeelding op Android TV, server die niet meer vastloopt

- Android TV: de full-screen trailer speelde het geluid af op een zwart scherm. De YouTube-video werd wel afgespeeld, maar in een kader van nul hoogte, dus onzichtbaar. Het neemt nu het hele scherm in beslag.
- De periodieke import van Overseerr/Seerr verrichtte bij elk bezoek een volledige schijfcontrole, waardoor de hele server voor meer dan 30 seconden bevroor op een NAS: elke pagina en elk fiche bleef dan laden, tot het werd afgebroken vanaf Android TV. De import doet nu alleen dubbele titels verwijderen die het zojuist heeft toegevoegd, en de schijfcontrole (dagelijks of handmatig uitgevoerd) blokkeert de server niet meer terwijl deze draait.
- Het back-uppen van de TMDb-cache, dat bij een grote bibliotheek meer dan enkele honderden MB bedraagt, werd in één blok geschreven en bevroor de server meerdere seconden. Het wordt nu in kleine stukjes geschreven, zonder andere verzoeken te onderbreken.

## v1.25.67 — September 2026

### Android TV: Betrouwbare terugkeer in de speler, tijd weergegeven op de balk

- Sinds de toevoeging van "Terug sluit eerst de balk", kon Terug nu zonder effect blijven als de balk al verborgen was: het gebied dat op dat moment de toetsen opvingerde, startte nog steeds de wektijderteller bij een Terug-druk, waardoor het in concurrentie kwam met het sluiten van de speler. Verholpen.
- De afspeelbalk toont nu de huidige tijd rechtsboven, naast de titel van de film of de aflevering linksboven.

## v1.25.66 — September 2026

### Minder spaarzame suggesties, directe fiches, verrijkte afspeelbalk

- De suggestiemotor ("Selectie voor u", "In de lijn van ...", "Netflix/Prime suggestie voor u") verwijderde systematisch elke titel die al in de bibliotheek aanwezig was, zelfs als deze nooit was bekeken - terwijl "Vergelijkbare titels" onderaan een fiche de bibliotheek nooit filtert en dezezelfde titels weergeeft. Alleen wat daadwerkelijk is bekeken, wordt nu uitgesloten.
- Het opnieuw openen van een reeds bekeken fiche in deze sessie wordt onmiddellijk weergegeven (een verse versie laadt stil in de achtergrond); de allereerste laadopdracht toont de silhouet van de fiche in plaats van de spinner. Een fiche die 750 ms lang met de afstandsbediening wordt aangewezen, wordt in de achtergrond voorgeladen, voor een onmiddellijke weergave nadat deze is geopend.
- De afspeelbalk toont de daadwerkelijk gedecodeerde resolutie (4K/1080p/720p) en de audiocodec (Dolby Digital/Digital+/TrueHD, DTS, AAC...), met dezelfde badge-stijl als op de desktop.
- Een eerste OK tijdens het afspelen toont alleen de balk, zonder pauze te zetten: voorheen was een onbedoelde focus-heen-en-weer nodig om dit te voorkomen. Een tweede OK, op de knop Pauze die nu daadwerkelijk gefocust is, zet pauze.
- Terug zorgt ervoor dat de afspeelbalk eerst naar beneden schuift als deze zichtbaar is, voordat de speler wordt verlaten bij de volgende Terug.

## v1.25.65 — September 2026

### Android TV: Afspelen, bibliotheek, zoeken en focus gestabiliseerd

- De volledige trailer verloor soms het geluid na een bufferingspoging (onbetrouwbaar netwerk): het beeld bleef, maar het geluid keerde niet terug. Het wordt nu toegepast bij elke herstart van het afspelen in plaats van slechts één keer aan het begin.
- In de Bibliotheek zorgt het wijzigen van de sorteeroptie of het genre nu ervoor dat de rasterweergave helemaal bovenaan wordt verhoogd in plaats van de eerste titel buiten beeld te laten. De sorteeroptie, het gekozen genre en het nieuwe vak "Ontbrekende weergeven" (standaard uitgeschakeld, dat films zonder bestand en series zonder enige beschikbare aflevering verbergt) blijven in het geheugen staan bij het wijzigen van het tabblad, inclusief bij het terugkeren naar een fiche.
- Het Filter Films/Series in de Bibliotheek en Ontdekking onthoudt de laatste keuze in plaats van bij elk terugkeren terug te vallen op Films.
- De zoekfunctie toont een titel die al in de bibliotheek aanwezig is zodra de eerste letters worden getypt, zonder te wachten op het einde van de invoer of een verre reactie.
- De kaarten, omslagen en badges zoomen niet meer in bij focus, en de selectieomtrek knippert niet meer bij het verlaten van een knop.
- Een film of aflevering die bekeken is tot meer dan 80 % en vervolgens verlaten (Terug, of naar de volgende aflevering) wordt nu gemarkeerd als bekeken en verdwijnt uit Doorgaan met kijken, net zoals dit al gebeurde bij het bereiken van de credits. Wat al in deze staat was vóór deze update, wordt één keer automatisch bijgewerkt.
- Het "gezien" label (aflevering, seizoen, film, onderzoek) neemt overal hetzelfde uiterlijk aan: een zwarte, afgeronde pastille, identiek aan die van de seizoenen.
- Het openen van een fiche landt niet meer direct op de knop "Lezen": de bovenkant van het scherm (hoes, titel) blijft zichtbaar bij het openen, de knop "BAS" leidt nog steeds naar de knop.

## v1.25.64 — September 2026

### Android TV: logo op de films van "Doorgaan met kijken"

- De thumbnails in de rij "Doorgaan met kijken" vroegen alleen het officiële logo van de titel voor series: een hergebruikte film ("300", "100 Millions !") behield altijd zijn geschreven naam eronder, nooit zijn logo. Films worden nu behandeld als series.

## v1.25.63 — September 2026

### Android TV en smartphone: premium laden; Android TV: stabiele focus bij het openen van een fiche

- De tekst "Laden…" alleen op een zwarte achtergrond wordt vervangen, op Android TV en op smartphone, door een echt merklaadscherm: het Movviz-logo ademt in het midden van een aurorahalo die langzaam draait, met een lichtdraad die eronder overgaat. Het wordt gebruikt voor film- en serie-fiches, de fiche van een acteur en het laden van afleveringen.
- Het openen van een fiche vanaf het startscherm stuurt de D-pad niet meer naar "Startscherm": tijdens het laden kon niemand de focus ontvangen, die dan op de zijbalk viel en niet meer terugkwam. Het laadscherm behoudt nu de focus, en het focusverzoek wordt opnieuw gestart bij het aankomen van de fiche.
- De hoofdknop van een fiche is nu één enkele knop die van label verandert ("Lezen", "Vervolg op...", "Toevoegen aan bibliotheek"), in plaats van vernietigd en opnieuw gecreëerd te worden bij elke actualisatie; deze is aanwezig vanaf het openen, grijs gemaakt tijdens de verificatie, in plaats van de tekst "Verificatie van het bestand…". De focus beweegt dus niet meer wanneer de fiche ververst.
- De rij "Doorgaan met kijken" toont het officiële logo van de titel op de thumbnail, in plaats van de geschreven naam eronder.

## v1.25.62 — September 2026

### Android TV: afleveringsfiche in Plex-stijl, volledige scherm trailer

- De fiche van een aflevering neemt het principe van Plex over: een achtergrond getint met de dominante kleur van de schermafbeelding, een kleinere schermafbeelding met zijn "Bekeken" / "Bezig" band, de naam van de serie groot, de titel van de aflevering, "Seizoen · Aflevering", gevolgd door een regel met de definitie in een pastille, de datum, de duur en de score, de knoppen, het synopsis en de tabel van het bestand op twee kolommen.
- Geopend vanuit "Doorgaan met kijken", had de fiche geen schermafbeelding, synopsis, duur of score: deze leest nu de metadata van het seizoen zodra deze geladen zijn, en toont de TMDb-titel van de aflevering wanneer deze bestaat in plaats van "Aflevering N".
- De trailer opent in een apart venster dat het hele scherm bedekt, inclusief de zijbalk; teruggaan sluit het en de focus keert terug naar de knop "Trailer".
- Om het tijdslimiet bij het starten te voorkomen, wordt de YouTube-speler geleverd vanaf het Movviz-adres zoals op de desktop, in plaats van youtube.com, en een bron wordt pas na 25 seconden opgegeven. De status van de speler en zijn fouten worden nu gelogd om een mislukking op een box te diagnosticeren.

## v1.25.61 — September 2026

### Android TV: betrouwbare afspeel- en hervatting, audiotranscoderingstijd, sorteeroptie "Recent toegevoegd"

- De tijd werd weergegeven als "0:00" en de balk bewoog niet wanneer het audio van een bestand niet door de TV gedecodeerd kon worden (de server stuurt dan een stream zonder duur of index). De weergegeven positie is nu het startpunt plus de afspeeltijd, de duur komt uit de bestandsinformatie, en vooruit- of terugspoelen vraagt de stream opnieuw aan de server op de nieuwe positie. Het hervatten, het opslaan van de positie, het opeenvolgen van afleveringen en de intro-markeringen volgen dezezelfde positie.
- De afspeelknoppen voor de serie, het seizoen en de afleveringspagina gaan via één pad. De knop "Vervolg vanaf ..." stuurt de positie die het aankondigt naar de speler, in plaats van dat de speler deze op een andere manier berekent: een aflevering die was gestart maar niet de laatste van zijn serie, begon vanaf het begin ondanks de beschrijving. Zonder voortzetting begint de aflevering vanaf het begin, en een niet-vindbare aflevering in de wachtrij meldt dit in plaats van niets te doen.
- De pagina van een aflevering heeft een knop "Vanaf het begin" naast "Vervolg", en een voortzetting die op de startpagina wordt weergegeven, verschijnt ook op de pagina.
- Na "Terug" vanaf een afleveringspagina geopend met "Doorkijken", keert de focus terug naar de afleveringskaart in plaats van naar de zijbalk.
- Bibliotheek Films en Series: nieuwe sorteeroptie "Recent toegevoegd", geplaatst vóór Naam, Beoordeling en Jaar en standaard geselecteerd.

## v1.25.60 — September 2026

### Android TV: knoppen naast elkaar en "bekeken" als enkel icoon, rond bladwijzer op desktop

- Op de pagina van een film of serie staan Afspelen / Vervolg, Trailer en "bekeken" op één lijn in plaats van een verticale stapel van drie knoppen.
- "Als bekeken markeren" wordt een icoon: grijs en uitgeschakeld zolang het niet bekeken is, groen en ingeschakeld (achtergrond, vink en rand) nadat het bekeken is, wit bij focus net als alle knoppen. De beschrijving wordt onder het icoon weergegeven wanneer het de focus heeft, zonder de naburige knoppen te verplaatsen. Dezelfde knop op de filmpagina, de seriepagina, de seizoenspagina en de afleveringspagina, waar "Als bekeken markeren" niet meer over twee regels breekt.
- Op desktop is "Toevoegen aan mijn lijst" op de pagina van een titel een ronde knop zoals de vergrootglas, het filter of het oog: het icoon kleurt en vult zich wanneer de titel in de lijst staat, de beschrijving blijft in een tooltip.

## v1.25.59 — September 2026

### Een serie kan niet meer worden gedownload ter vervanging van een film

- Een heel seizoen van een serie kon in het mapje van een film worden geplaatst: "Resident Evil (2026)" en "Van Helsing (2021)" ontvingen de 13 afleveringen van `The Resident S06` en `Van Helsing S04`, benoemd "(2)" tot "(13)" naast de film. De selectie van een filmrelease keek alleen naar de titel en het jaar: een aflevering heeft geen jaar, dus het ging door, en niets verwierp de vermelding van het seizoen.
- Een film verwerpt nu elke release die een seizoen- of afleveringsmarker draagt (S04, S01E05, "Seizoen 2"), op alle plaatsen waar deze wordt gekozen: automatische zoekopdracht, fluxscan, kwaliteitsupgrade en het toevoegen van een versie. "Special Edition" en titels zoals "Season of the Witch" blijven geaccepteerd.
- De filmengine importeert nu slechts één videobestand per torrent, het grootste, zonder de andere in het mapje te dumpen met een suffix. Een "film" torrent met meerdere afleveringbestanden wordt helemaal niet geïmporteerd, en de film keert terug naar "ontbrekend".
- Handmatig te doen voor reeds aangeraakte titels: verwijder de overtollige bestanden in het filmmapje, en stel vervolgens de film handmatig in op "ontbrekend" vanaf de pagina.

## v1.25.58 — September 2026

### Android TV: geen crashen meer op de rij Genres, seizoenskaarten en opgeruimde kaarten

- De app crashte zodra de D-pad de rij Genres van Ontdekking doorliep, zonder er zelfs maar in te komen. Vijf lijsten hadden geen bescherming tegen het scrollen die de fout van het TV-lijstcomponent voorkomt: de genres en platforms van Ontdekking, de genres van de Bibliotheek, de Instellingenlijst en zijn rij talen. Ze hebben het nu, en geen enkele clientlijst is meer van dit voordeel beroofd.
- De seizoenskaarten op een seriepagina tonen niet meer "0/10" of de regel "x/y bekeken" eronder: een enkel cijfer op een zwarte achtergrond rechtsboven geeft het aantal onbekeken afleveringen, vervangen door een vinkje wanneer het seizoen volledig bekeken is.
- De namen van films en series ingebed op de posters worden verwijderd; de logo's blijven.
- Bij het openen van een seriepagina blijft de focus niet langer op seizoen 1 (omkaderd alsof het geselecteerd is) wanneer de hoofdknop net is gereconstrueerd: het keert terug naar de hoofdknop.

## v1.25.57 — September 2026

### Android TV: profielfoto's bij elke opstarten bijgewerkt, trailer betrouwbaar gemaakt

- De actieve profielfoto en -naam worden bij elke opstart en terugkeer naar de voorgrond opnieuw opgevraagd van Movviz, en de profielfoto's worden van de server opgevraagd in plaats van uit de cache te komen. Voorheen kwam een veranderde foto elders pas op de TV terecht bij het toevoegen van een nieuw profiel, omdat de app, die vaak in het geheugen bleef, niets opnieuw laadde zonder via de selector te gaan.
- De YouTube-trailer start eerst stumm, net als de startpagina-preview, en voegt pas het geluid toe zodra de afspelen begint: een start met geluid kon vastlopen zonder foutmelding, op een laadscherm.
- Een bron die niet binnen 12 seconden start, wordt overgeslagen naar de volgende, en als er geen enkele meer werkt, geeft het scherm de oorzaak aan in plaats van oneindig te laden.

## v1.25.56 — September 2026

### Android TV: trailer, focus blijft in de inhoud, afwerking van fiches

- Film- en serie-fiches hebben een knop "Trailer": fullscreen afspelen met geluid, met dezelfde trailers als op de desktop (eerst YouTube, daarna directe bronnen als laatste redmiddel). OK of afspelen/pauze wisselt de afspeling, links en rechts gaan terug of vooruit met 10 seconden (vasthouden herhaalt), Terug sluit en geeft de focus terug naar de knop. Een balk toont de verstreken tijd, de voortgang en de duur bij elke toets en verdwijnt dan zelf, en blijft zichtbaar in pauze; een visuele terugkoppeling bevestigt elke actie.
- Het donkere sluier bovenaan de fiches bedekt nu de gehele hoogte van de afbeelding: het liet voorheen een onbedekt beeldgebied achter, gevolgd door een duidelijke afsnijding onderaan.
- In een seriefiche heeft geen enkel seizoen meer een permanente rand: ze hebben allemaal dezelfde subtiele rand in rust, en alleen de kaart met de focus krijgt de merkrand, wat de verwarring tussen "geselecteerd" en "gefocusseerd" elimineerde.
- De focus valt niet meer terug in de zijbalk bij het wijzigen van pagina. Na een klik op een tabblad gaat het naar de nieuwe pagina. Bij terugkeer van een fiche naar de startpagina, probeert de focus opnieuw zonder ooit terug te vallen op de zijbalk. Bij terugkeer van een seizoenspagina, komt de focus terug op de kaart van dat seizoen, en bij terugkeer van de afleveringsfiche, op de kaart van die aflevering.
- De melding die tijdens een update werd weergegeven, zei dat de app zichzelf zou opnieuw opstarten, wat niet het geval is: het vraagt nu om de app handmatig opnieuw op te starten na de update (TV en mobiel).
- Er is geen toetsafhandeling toegevoegd in de zijbalk of op de pagina's: alleen het afspelen van de trailer beheert zijn eigen toetsen, binnen zijn eigen scherm.

## v1.25.55 — September 2026

### Android TV: afleveringsfiche Plex-stijl, Startpagina Films / TV-series, profielfoto

- Een tik op een afleveringskaart opent altijd de fiche: een achtergrondopname, status "Bekeken" of "Bezig" onder de afbeelding, serie-titel, seizoen, aflevering, beoordeling, duur en datum, gevolgd door "Afspelen" (of "Herstarten op 00:12:34" indien herstarten mogelijk is), "Als bekeken markeren" en de bestandstabel (video, HDR, audio, bron). Het vinkje "Bekeken" onder elke kaart verdwijnt: alles gebeurt vanaf de fiche.
- De startpagina scheidt recente toevoegingen in twee rijen, "Recent toegevoegd in Films" en "Recent toegevoegd in TV-series", in plaats van één gemengde rij.
- In de serie-rijen worden meerdere tegelijk aangekomen afleveringen niet meer naast elkaar weergegeven: ze vormen één seizoenskaart, met het aantal onbekeken afleveringen rechtsboven, of een vinkje als het hele seizoen bekeken is. Een enkele aflevering behoudt zijn afleveringskaart, met een vinkje als deze al bekeken is.
- De server voegt het aantal beschikbare afleveringen per seizoen toe aan de compacte startpagina, om het hele seizoen te tellen. Zonder dit valt de teller alleen op de recente afleveringen.
- De profielfoto wordt eindelijk weergegeven in de zijbalk: de afbeeldingen gebruikten een netwerkclient zonder sessie, terwijl de mobiele client die van de API deelt. De initialen dienen nu alleen nog als back-up.
- Er is geen toetsafhandeling toegevoegd: de D-pad wordt beheerd door de Compose focus engine.

## v1.25.54 — September 2026

### Android TV / Mobile NX : de status 'Bekeken' blijft gekoppeld aan de aflevering

- De 'Bekeken'-vink van een aflevering ging via de seizoenscallback en stuurde `scope="season"` naar `/api/watch/toggle`. De server deed dus precies wat gevraagd werd: het breidde de actie uit naar alle bekende afleveringen van het seizoen.
- De TV- en mobiele eenheidsacties gebruiken nu `toggleEpisodeWatched(...)`, die al aanwezig is in de ViewModels en overeenkomt met het desktopgedrag: er wordt slechts één aflevering gestuurd, zonder scope.
- De echte knoppen 'Seizoen als bekeken markeren' behouden `toggleEpisodesWatched(..., scope="season")` en 'Hele serie als bekeken markeren' behouden `scope="series"`. Er is geen endpoint of servergedrag opnieuw uitgevonden.

## v1.25.53 — September 2026

### Android TV : betrouwbare uitgang van de Home hero via D-pad

- De Home hero kon vastzitten op de hero-knoppen: DOWN was nog afhankelijk van de automatische Compose-zoekfunctie om de eerste kaart van een TvLazyColumn te ontdekken, wat niet altijd mogelijk is zolang deze niet voldoende in het viewport is gekomen.
- De hero en de eerste kaart van de eerste rij zijn nu verbonden door `focusProperties.down` en een toegewijd FocusRequester. De hoofdknop behoudt ook een expliciete LEFT-uitgang naar de zijbalk.
- Er is geen onKeyEvent/onPreviewKeyEvent meer geïntroduceerd: de navigatie wordt volledig beheerd door de Compose focus engine, en het visuele aspect verandert niet.

## v1.25.52 — September 2026

### Android TV : profielfoto wordt weergegeven in de zijbalk

- De drie profielbadges van de rail (railvoet, menu-header, profiellijnen) accepteerden alleen een avatar in een absolute URL: een foto die via een relatief pad door Movviz werd geleverd, werd nooit opgelost tegen de profielserver en viel stilzwijgend terug op de initialen. Een verlopen Plex-avatar (401) liet daarentegen een lege cirkel achter, omdat er geen foutafhandeling was.
- Ze gebruiken nu hetzelfde component als de mobiele client, waar de weergave werkt: het oplossen van de relatieve URL, het bijsnijden van de afbeelding en terugvallen op initialen bij zowel afwezige URL's als netwerkfouten.
- Geen visuele wijzigingen: vormen, groottes, initialen en de degradatie van de fallback blijven identiek.

## v1.25.50 — September 2026

### Android TV : D-pad gerepareerd na herontwerp van de zijbalk

- De zijnavigatie en de inhoud gebruiken opnieuw één focus-engine: `focusProperties`/`focusGroup` van Compose, zonder globale interceptie van `UP`.
- Aangezien de zijbalk nu links is, gebeurt de uitgang van de inhoud naar het menu via `LEFT`; `UP`/`DOWN` blijven inheems in lijsten, rijen, raster en kaarten.
- De oude aanroepen `runCatching { requestFocus() }.isSuccess` zijn gecorrigeerd: de boolean die daadwerkelijk door `requestFocus()` wordt geretourneerd, wordt nu gerespecteerd, dus een focusweigering wordt niet langer als succes beschouwd.
- Geen visuele wijzigingen: afmetingen, kleuren, kaarten, zijbalk en animaties blijven identiek aan het huidige ontwerp.

## v1.25.49 — September 2026

### Een opnieuw gedownloade aflevering vervangt zijn bestand in plaats van ernaast te installeren

- Een handmatige selectie - of een opnieuw downloaden, of een kwaliteitsupgrade - van een aflevering die al een bestand had, liet beide op de schijf achter. De engine hernoemt het geïmporteerde bestand voordat het de intentie kent: het stuitte op de reeds gebruikte naam en liet een "Serie - S01E01 (2).mkv" achter naast het origineel, wat Plex vervolgens presenteerde als een tweede versie en bleef het oude leveren. Het oude bestand wordt nu verwijderd en het nieuwe neemt de verwachte definitieve naam aan: handmatig een release kiezen vervangt daadwerkelijk de bestaande. Seizoenen en complete pakketten volgen dezelfde regel; alleen films profiteerden hiervan tot nu toe.
- Dit terugkeren naar de definitieve naam werkte in werkelijkheid voor niemand, inclusief films: de botsingssuffix werd gezocht aan het einde van de bestandsnaam terwijl deze direct vóór de extensie staat, dus nooit herkend.
- Het verwijderen van het oude bestand richt nu op het werkelijke pad op de schijf en niet op het pad zoals gezien via Plex, wat kan verschillen — dit liet bestanden achter wanneer de vermelding afkomstig was van een bibliotheekscan.
- De definitieve naam wordt nooit overschreven als deze bezet is door een derde bestand, een herimport op hetzelfde pad wordt niet zelf verwijderd, en niets wordt aangeraakt buiten de bibliotheekwortels van de engine.

## v1.25.48 — September 2026

### Zoeken C411: de volledige resultatenpagina wordt eindelijk opgevraagd

- Movviz liet C411 de standaardgrootte van zijn pagina kiezen, die slechts een gedeeltelijke en enigszins verouderde uitsnede van de resultaten retourneerde: recente afleveringen bleven onzichtbaar in Movviz, terwijl de webzoekopdracht van de indexer ze wel liet zien. Elke interactieve zoekopdracht vraagt nu expliciet om de eerste 100 resultaten.
- Deze correctie was al in de gepubliceerde image onder v1.25.47, maar het versie-nummer was niet verhoogd: de applicatie toonde na de update nog steeds v1.25.46. De nummering hervat soepel in v1.25.48.

## v1.25.46 — September 2026

### Plex → Movviz: einde van de fouten `plex_history_page_invalid_shape`

- Plex slaat de sleutel `Metadata` over op lege geschiedenispagina's (account zonder geschiedenis, of paginatie voorbij het totaal): deze antwoorden worden nu behandeld als consistente lege pagina's in plaats van de hele synchronisatie van de weergaven te laten mislukken.
- Een pagina met één element geserialiseerd als één object (het geval van de bootstrap `size=1`) wordt inggewikkeld in een array; alleen een afwezige `MediaContainer` of een echt ongeldige vorm veroorzaakt nog steeds de fout, met een vormdiagnose in de melding om te beslissen bij de volgende log.

## v1.25.45 — September 2026

### Android TV: afleveringen van een seizoen gaan in raster

- Het seizoen toont nu zijn afleveringen in een 16:9 raster van vier kolommen, in plaats van een verticale lijst. Een seizoen van twintig afleveringen past in vijf rijen en wordt in twee dimensies doorgebladerd met de afstandsbediening in plaats van een lange daling.
- De achtergrond van het scherm neemt de dominante kleur van de seizoenhoes in plaats van een uniforme zwart.
- De kop groepeert de hoes met het aantal afleveringen, de voortgang en een actiebalk op één rij: afspelen, seizoen voltooien, bekeken markeren, terug.
- Elk miniatuur heeft zijn afleveringsnummer, zijn "bekeken" badge, zijn hervatbalk en zijn downloadstatus; de titel, de beoordeling, de duur en de datum blijven leesbaar onder de afbeelding.

### Geen vergrooting meer bij focus

- Kaarten, tegels, knoppen en profielfoto's veranderen niet meer van grootte wanneer ze worden geselecteerd. Drie verschillende oorzaken waren gecombineerd, waaronder de standaard toegepaste vergroting op alle klikbare oppervlakken, en de landschappelijke uitbreiding van de hoofdpagina-kaarten — het laatste verplaatste de hele rij en knipte de seizoenbadge die op de afbeelding was ingebed.
- Een knop is nooit meer wit in rust: grijze achtergrond en witte tekst, het wit met zwarte tekst is gereserveerd voor het daadwerkelijk geselecteerde element, zodat de focus bij het meest zichtbare element van het scherm blijft.

### Navigatie met de afstandsbediening

- Het openen van een seriepagina liet de focus vastzitten in de zijbalk: geen actie was selecteerbaar zolang er geen aflevering was gedownload, en een nooit gestarte serie had geen afspeelknop.
- Het scherm van een seizoen opende soms zonder enig geselecteerd element, de afstandsbediening leek dan niet meer te reageren.
- Omhoog scrollen door afleveringen naar de actiebalk stuurde de focus achter het getoonde scherm, naar het zijmenu.
- Terugkeren van het zijmenu naar een aflevering vereiste een tiental drukken en gefikle: de rechterpijl richtte op een element verborgen onder het seizoen-scherm. Eén enkele druk is nu voldoende en geeft de focus terug aan het verlaten miniatuur.
- Het sluiten van een seizoen brengt de focus terug naar de seriepagina in plaats van deze in het zijmenu te laten.

### Afspelen

- Doorgaan naar de volgende aflevering markeert de vorige als bekeken zodra deze met meer dan 70 % is gelezen, op Android TV en op mobiel. Een daadwerkelijk voltooide aflevering verschijnt niet meer in "Doorgaan met kijken" omdat de eindcredits zijn overgeslagen.

## v1.25.44 — September 2026

### Android TV: Herzien lijst met seizoenen en afleveringen

- De afleveringenlijst van een seizoen is opnieuw ontworpen in de stijl van Plex: grotere thumbnail, titel en synopsis die van veraf duidelijker leesbaar zijn, en een informatiebalk die eindelijk de duur, uitzenddatum, resolutie en de daadwerkelijk aanwezige HDR aangeeft.
- Een reeds gestarte aflevering toont zijn voortgangsbalk direct op de thumbnail, zelfs wanneer er meerdere afleveringen van dezelfde serie tegelijkertijd lopen.
- Op OK drukken start nu direct het afspelen; een "Info"-knop opent het gedetailleerde afleveringsprofiel, dat een volledig scherm wordt in plaats van een zwevend venster.
- Een ontbrekende aflevering is nu bereikbaar met de afstandsbediening: het profiel maakt het mogelijk om deze te downloaden, wat voorheen onmogelijk was omdat de hele regel onbereikbaar was.
- Het seizoensscherm opent nu op de volgende aflevering om te kijken in plaats van op de eerste, en krijgt een header met omslag, voortgang en actiebalk: afspelen, seizoen voltooien, seizoen als bekeken markeren, terug.
- "Seizoen voltooien" blijft voorgesteld zolang er afleveringen ontbreken, terwijl het verdween zodra er slechts één aflevering beschikbaar was.
- Het profiel van een serie toont een afspeelknop, zelfs als er geen afleveringen lopen: deze wijst naar de volgende onbekeken aflevering. Voorheen had een nooit gestarte serie geen afspeelknop.
- De seizoensthumbnails geven hun voortgang aan (bekeken afleveringen, voortgangsstrip, vinkje wanneer het seizoen voltooid is) in plaats van alleen een simpel aantal afleveringen.
- Speciale afleveringen zijn opnieuw toegankelijk: ze verschijnen na de genummerde seizoenen en worden nooit meegerekend bij de voltooiing van een serie.
- De afleveringenlijst neemt de kleuren van Movviz over: dit was het enige gebied van de app dat nog in grijs was gebleven.

### TV- en mobiele interface: Geen meer vergroting bij focus

- Kaarten, tegels, knoppen en profielfoto's vergroten niet meer wanneer ze worden geselecteerd. De vergroting maakte ingebedde elementen — afleveringsnummer, "bekeken"-badge, logo — wazig gedurende de hele animatie. Selectie blijft gemarkeerd door de schaduw en de focusrand.

### Correcties

- Profielfoto: de gekozen foto vanaf het web verscheen nooit op Android TV of op Android mobiel zodra het apparaat al een profiel kende, oftewel bij elke opstartbeurt behalve de allereerste. De profielkiezer en de profielbadge worden nu bij elke opstart in de achtergrond bijgewerkt, zonder de opening van de app te vertragen.
- De navigatie met de afstandsbediening kan niet meer verdwijnen achter een scherm: vanaf de afleveringenlijst of het afleveringsprofiel zakt de focus niet meer in het profiel van de serie eronder, en Terug sluit altijd precies één niveau.
- De duur en de score van elke aflevering worden nu door de server verstrekt; voorheen werden ze van TMDb opgehaald en vervolgens genegeerd zonder gebruikt te worden.

## v1.25.43 — September 2026

### Prestaties: Technische analyses en caches

- De technische analyses van bestanden (ffprobe) faalden massaal zodra een Plex-synchronisatie tientallen ervan parallel lanceerde: het resultaat werd gelezen voordat het klaar was geschreven. Ze slagen nu allemaal.
- De cache van deze analyses verloor bijna al zijn vermeldingen wanneer er meerdere tegelijkertijd werden uitgevoerd, wat leidde tot het opnieuw analyseren van dezelfde bestanden bij elke synchronisatie. De resultaten worden nu bewaard, wat een permanente achtergrondbelasting op de server vermindert.
- De TMDb-cache serialiseert niet langer elk antwoord om een simpele weergavestatistiek te voeden, en het Cache-paneel in de instellingen vraagt niet langer continu naar de server als er niets gebeurt.

### Correcties

- Het profiel van een aflevering crasht niet meer wanneer het direct wordt geopend — via een link, favoriet of paginalaadvernieuwing — in plaats van wanneer het wordt bereikt vanaf het serieprofiel.

## v1.25.42 — September 2026

### Android TV / mobiel: Plex synchronisatie van series

- Het openen van een serieprofiel op Android TV en mobiel triggert nu dezelfde gerichte Plex-controle als op het web, zodat bekeken afleveringen onmiddellijk in Movviz worden bijgewerkt.
- Het vernieuwen bij terugkeer op het profiel behoudt dit gedrag; algemene laadprocessen blijven ongewijzigd.

## v1.25.41 — September 2026

### Plex → Movviz: directe serie-weergaven

- Het openen van een serieprofiel leest nu de Plex-status van alle reeds geïndexeerde afleveringen, in batches van 50 sleutels, en reconcilieert deze onmiddellijk. Naruto is niet langer afhankelijk van de volgende globale geschiedenispassage of de periodieke snapshot.
- Een gedeeltelijke Plex-respons kan nooit een aflevering die ontbreekt in de respons veranderen in "niet bekeken".
- Een normale seizoen is compleet wanneer alle beschikbare afleveringen zijn bekeken; een serie is compleet wanneer alle normale seizoenen dat zijn. Speciale afleveringen (seizoen 0) blokkeren nooit de voltooiing van de serie.

## v1.25.40 — September 2026

### Plex → Movviz: synchronisatie zonder SQLite

- Wanneer de SQLite contextmotor niet beschikbaar is op de server, wordt een geaccepteerde Plex-beslissing nu onmiddellijk in de compatibiliteits-JSON-opslag geschreven die door de interface wordt gelezen. Het "toegepast" diagnosticeren komt dus eindelijk overeen met een daadwerkelijk zichtbare status in Movviz.

## v1.25.39 — September 2026

### Plex → Movviz: onmiddellijke reparatie van afwijkende weergaven

- Een stabiele Plex-waarneming ("bekeken" of "niet bekeken" reeds in het lokale logboek) repareert nu de Movviz-status als deze is afgeweken: de interface kan niet langer ten onrechte op "niet bekeken" blijven na een gerichte synchronisatie die Plex heeft bevestigd.
- De frisheidsbeveiligingen blijven ongewijzigd: een recentere lokale actie blijft prevaleren boven een oudere Plex-waarneming.

## v1.25.38 — September 2026

### Plex → Movviz: betrouwbaar gerichte diagnostiek

- Het gerichte afspelen van een film geeft nu expliciet aan of Plex "bekeken" of "niet bekeken" heeft geretourneerd en of de reconciliator de waarneming heeft toegepast of geweigerd, zonder een Plex-token of sleutel bloot te leggen.

## v1.25.37 — September 2026

### Plex → Movviz: inhalen van ontbrekende filmsleutels

- Wanneer een filmprofiel nog geen lokale `ratingKey` heeft, lost Movviz deze nu in Plex op basis van de exacte titel en valideert vervolgens verplicht hetzelfde TMDb-identificatie voordat het de bekeken status leest.
- Resolutiefouten worden expliciet gelogd; ze worden niet langer verward met een succesvolle synchronisatie en kunnen geen twee homonieme films koppelen.

## v1.25.36 — September 2026

### Volledige herynchronisatie van Plex-weergaven op de achtergrond

- De Plex-instellingen bieden nu "Alle weergaven synchroniseren": de volledige en autoritaire controle over bekeken/niet bekeken statussen gaat naar de Movviz-wachtrij, met voortgang die behouden blijft, zonder de pagina te blokkeren.
- De eerste synchronisaties behouden de volledige automatische bootstrap voordat elke incrementele passage; de knop is het expliciete middel om dit opnieuw te starten na een inconsistentie.
- Slechts één volledige taak kan tegelijkertijd draaien en de meest recente lokale acties blijven beschermd door de bestaande reconciliator.

## v1.25.35 — September 2026

### Plex → Movviz: onmiddellijke « bekeken » status voor films

- Het openen van een filmfiche controleert nu direct de `ratingKey` van Plex en reconcileert de « bekeken / niet bekeken » status zonder te wachten op de globale geschiedenisscan of de 30 minuten durende snapshot.
- Deze gerichte controle is onafhankelijk van een lange geschiedenisbootstrap, maar behoudt de concurrentie- en frisheidsbeschermingen: een meer recente lokale actie wordt nooit overschreven.
- In geval van Plex-onbeschikbaarheid of een nog onbekende sleutel, blijft de fiche bruikbaar en behoudt het algemene synchronisatiemechanisme de overdracht.

## v1.25.34 — September 2026

### Lokale WebTorrent Seizoensassociatie

- Een handmatig uitgebrachte release die expliciet is benoemd voor een ander seizoen wordt nu geweigerd voordat deze aan WebTorrent wordt toegevoegd: `S02` kan niet meer per ongeluk als `S01` worden gedownload.
- Veiligheidsnetwerk aan de importzijde: wanneer alle daadwerkelijk geïmporteerde bestanden wijzen op één ander gevolgd seizoen, wijst Movviz de lokale status onmiddellijk toe aan dit werkelijke seizoen, zonder afhankelijk te zijn van Plex.
- Gemixte, onvolledige pakketten, zonder seizoen-nummer of gericht op een onbekend seizoen, worden nooit geïnterpreteerd.

## v1.25.33 — September 2026

### Plex History V2: bronpaginatie, herstelbare bootstrap en begrensd incrementeel

- `getAccountHistoryPage()` wordt de unieke leesprimitive van Plex History: één HTTP-pagina, offset berekend op het ruwe aantal Plex-items en gecentraliseerde parsing/filtering.
- Bootstrap History V2: ASC pagina's van 100, `currentStart` vertegenwoordigt de Plex-bronoffset, betrouwbaar hervat na herstart en vrijwillige migratie van oude V1-statussen naar een nieuwe volledige scan zonder bestaande weergaven aan te raken.
- Recente weergaven blijven prioriteit via een kleine, onafhankelijke DESC pagina; de eigenaar-snapshot wordt uitgesteld tijdens de volledige scan en uitgevoerd aan het einde.
- Incrementeel DESC multi-pagina tot de cursor, inclusief identieke tijdstempels, zonder de hele geschiedenis opnieuw te laden.

## v1.25.32 — September 2026

- Android mobiel en TV zoeken: expliciete status in geval van fout, verlopen sessie of lege resultaten, zonder een storing te presenteren als een lege zoekopdracht.
- Interactief zoeken: de laatste aanvraag annuleert de vorige en de eerste pagina wordt weergegeven zonder te wachten op paginatie.
- Veilige diagnose van `/api/metadata/search`: HTTP-code, duur, paginatie en gedecodeerd resultaat, zonder de zoekopdracht of sessie-identifiers te loggen.

## v1.25.31 — September 2026

### Volledige geschiedenisbootstrap en meest responsieve Plex → Movviz

- Volledige geschiedenisbootstrap: zolang `bootstrapCompleted=false`, pagineert `pollHistory` `GET /status/sessions/history/all` en verwerkt **alle** vermeldingen (batches 200, persistente `plex-history-bootstrap.json` herstelbaar) in plaats van `slice(0,20)`. Weergaven van 2022 verwijderd uit Plex in 2024 blijven importeerbaar als `canonical` oplosbaar is.
- Na `bootstrapCompleted=true`, incrementele sync alleen via `lastViewedAt` (enkele vermeldingen). Verliest geen gebeurtenis, begint nooit opnieuw met de 4000+ vanaf nul.
- `localAccountId` blijft `null` voor gedeelde items zonder binding: `historyAvailable=false` → `pollHistory` genegeerd, `snapshot/quickVerify` blijven actief via de `accessToken` van het deel.

## v1.25.30 — September 2026

### Plex → Movviz: gecorrigeerde history-string, geen `viewCount` eigenaar meer voor gedeelde profielen

- Contradictie gecorrigeerd: `viewCount`/`batchPlexViewState` gaf de status van de eigenaar, zelfs met het token van een andere gebruiker. Voor `shared`/`managed` zijn `snapshotWatchState`/`quickVerify`/`fullRescan` nu gedeactiveerd (`unsupported_per_user_viewstate`) — geen import meer van `WATCHED/UNWATCHED` vanuit de eigenaarstatus.
- `PlexHistoryEntry.ratingKey` optioneel: `getAccountHistory()` behoudt films/afleveringen vanaf `title`/`grandparentTitle+parentIndex+index` (overgedragen Guid), `watchSync` schakelt over op **resolve-first** (afleveringen: `resolveEpisode(requireRatingKey:true)` → echte `episode.ratingKey` via `allLeaves`, films: `resolveMovie` op exacte Plex/Movviz titel + onduidelijkheid wegnemen `Guid tmdb://`). Geen `no verifyKey` / `movie without ratingKey` meer.
- `resolveEpisode`: nieuwe `requireRatingKey` (history→verify weigert `RESOLVED` zonder echte sleutel), fast-path `grandparentRatingKey → getShowEpisodesAtomic` direct, fallback exacte titel `Dragon Ball Z Kaï` met log `exactTitleMatches`, TMDB-id `findPlexShowByTmdbId` wanneer titels afwijken, `getSectionRawItemsAtomic` atomisch. Percentage ongeldige afwijzingen is geminimaliseerd, elke afwijzing heeft een echte reden.
- History gefilterd op `accountID` blijft de `WATCHED` trigger voor `shared`/`managed`: `verifyWatchState` wordt niet meer aangeroepen, een directe `WATCHED` observatie wordt gecreëerd vanaf `viewedAt`; `absence history` blijft `UNKNOWN`, nooit `UNWATCHED`.

## v1.25.29 — September 2026

### Gedeelde Plex en afleveringen/films zonder ratingKey — einde van spookachtige `NOT_IN_SHARED`

- Gedeelde Plexgebruikers (`plexId` extern) zijn niet langer afhankelijk van `getPlexFriends()` (sociaal netwerk, vaak `friends=0`): `resolvePlexUserContext()` vraagt nu `GET /api/servers/{machineIdentifier}/shared_servers` (eigenaarstoken) en mappeert uitsluitend `SharedServer.userID == plexId` → `accessToken` wordt de Plex `serverToken` van de gebruiker, zonder persoonlijke koppeling vereist. Fallback `getPlexFriends` verwijderd uit PMS-pad.
- `getSharedServers()` leest `res.text()`, detecteert `Content-Type` / eerste teken en parset JSON of XML `<SharedServer>` (alleen whitelist `id, userID, username, email, thumb, accessToken, accepted`, token nooit gelogd). `HTTP non-200` = fout, `HTTP 200` + valide XML = succes.
- `localAccountId` bepaalt niet meer de watched-state: `PlexUserContext` exposeert `localAccountId: number|null` + `historyAvailable: boolean`. Een gedeelde `RESOLVED` met geldig `accessToken` gaat via `source=shared … localAccountId=null historyAvailable=false` → `snapshot/quickVerify/viewCount` actief, `pollHistory` correct genegeerd.
- History `getAccountHistory()` behoudt nu afleveringen vanaf `grandparentTitle+parentIndex+index` zelfs zonder `grandparentRatingKey` of `ratingKey`; `PlexHistoryEntry.ratingKey` wordt optioneel. Films zonder `ratingKey` worden verrijkt via `resolveMovie` (exact Movviz titel → exacte Plex bibliotheek titel → echte `ratingKey` + TMDB, `Guid` onduidelijkheid wegnemen) in plaats van `continue`.
- WatchSync herschreven naar **resolve-first**: `resolveEpisode/resolveMovie` → echte Plex `ratingKey` (`allLeaves`, echte `episode.ratingKey`) → `verifyWatchState` → `reconcile`. De `no verifyKey … S4E14` en `movie without ratingKey … La vie est belle` verdwijnen.
- `resolveEpisode` geeft prioriteit aan Plex lookup (`allLeaves`) wanneer de ingangs sleutel ontbreekt, anders Movviz exact eerst; upsert `mediaIdentityMap` op de echte sleutel. Percentage ongeldige afwijzingen sterk verminderd.
- Observabiliteit behouden: `source=shared`, `tokenFp`, `plex.identity` zonder platte token.

## v1.25.28 — September 2026

### Plex Sync Architectuur, Watch State & Aanbevelingen — volledige betrouwbaarheid

- Strikte scheiding `PlexHistoryObserver` (activiteit, trigger) en `PlexWatchStateObserver` (status `WATCHED/UNWATCHED` via `viewCount/lastViewedAt` met het PMS-token van de gebruiker). Corrigeert bug P0: « Markeren als bekeken » in Plex creëerde geen history-entry en bleef onzichtbaar (nu gedetecteerd door snapshot).
- Geünificeerde Plex context `resolvePlexUserContext()` — `owner/account/managed` via stabiele ID's, `machineIdentifier` + `serverToken` per `userId`, cache 5 min, invalidatie bij 401/403. Verwijdering van de stille fallback naar `adminToken` voor persoonlijke gegevens.
- Unieke canonieke reconciliator `PlexReconciler` (`BASELINE/UNCHANGED/REMOTE_WATCHED/REMOTE_UNWATCHED/ACK/CONFLICT`) + LWW-revisie — geen directe schrijfacties meer vanuit de observers, geen `Movviz→Plex→Movviz` lus meer.
- Atoomische snapshot per bibliotheek (`fetch all pages → validate → build set → diff`) — een gedeeltelijke snapshot wordt nooit geïnterpreteerd als `UNWATCHED`, verwijderde media ≠ `UNWATCHED`.
- Herstructureerde afleveroplosser met redenen `MISSING_RATING_KEY/MISSING_SEASON/AMBIGUOUS_MATCH` + sampling, pipeline `ratingKey→GUID→SxxExx→library lookup`.
- Gerichte controle na elke `scrobble/unscrobble` (`/:/scrobble` 200 ≠ bewijs) + `outbox` `PENDING` bewaard tot ACK, `STALE_INTENT` genegeerd.
- Geïsoleerde opslag per `userId+machine+ratingKey` (`plex-observed-state.json`, `plex-media-identity-map.json`, cursor `plex-history-cursors.json` per gebruiker, circuit-breaker per gebruiker, lock `plex-sync:userId`).
- Aanbevelingen strikt `userId` — lezen van `CanonicalWatchState`, TV-aggregatie in show-niveau signaal (gewicht `log1p`, verzadiging), uitsluiting van alleen `FullyWatched`.
- Observabiliteit `GET /api/plex/status` (admin): `binding/status/tokenFp/localAccount/lastHistory/lastSnapshot/watchedObserved/canonical/outbox/circuit` + gestructureerde logs `plex.identity/history/snapshot/reconciler` zonder platte token.
- Verklaring en sterke verlaging van het percentage afgewezen afleveringen, tellers `rejectedForeign/Unattributed/Malformed` + zichtbare `sampleMalformed`.

## v1.25.27 — September 2026

### Volledige betrouwbaarheid van de status « bekeken » en badge op Android-hoezen

- Kritische correctie: een crash of uitval op het verkeerde moment kon een titel onconsistent als bekeken markeren in de database; de schrijfactie is nu volledig atomisch (alles of niets).
- De status « bekeken / niet bekeken » weergegeven in de app komt nu altijd van de meest betrouwbare beschikbare bron, nooit meer van een kopie die af en toe kan desynchroniseren.
- Een export naar Plex die faalde (netwerkstoring, Plex onbeschikbaar) ging stil verloren; deze wordt nu automatisch in de achtergrond opnieuw geprobeerd totdat het slaagt.
- Nieuw diagnostisch en reparatiehulpmiddel voor accounts die historisch getroffen waren door de reeds gecorrigeerde ID-botsingsbug (twee verschillende accounts die dezelfde bekeken films/afleveringen delen).
- Android-apps (mobiel en TV) tonen nu een « bekeken » badge op de filmhoezen in Home, Ontdekken, Catalogus en Zoeken.

## v1.25.26 — September 2026

### Plex-profielresolutie per ID + vier bugs gevonden tijdens audit

- Kritische correctie: sommige accounts (typisch beheerd door de admin, nooit persoonlijk verbonden met Plex) faalden met 100% van hun synchronisatiepogingen, onbepaald. De Plex-accountresolutie verloopt nu via een stabiele ID in plaats van afhankelijk te zijn van een persoonlijke verbinding die nooit kan plaatsvinden.
- Dezelfde bug als de weergave-sync (ontbrend veld aan de Plex-kant) trof ook de lijst « Doorkijken » — op dezelfde manier gecorrigeerd.
- Een vergeten accountcreatie-route uit de vorige correctie gebruikte nog steeds de oude ID met botsingsrisico — gecorrigeerd.
- Een conflictresolutie bij strikte gelijkheid vergelijkte twee ongerelateerde waarden, waardoor deze onbetrouwbaar was — gecorrigeerd om de juiste waarden te vergelijken.

## v1.25.25 — September 2026

### Twee Plex-bugs bevestigd live via productie-logs

- Kritische correctie: 100% van de afleveringen van elk account werden bij elke Plex-sync als « malformed » afgewezen, ongeacht het account — een veld dat de Plex-server nooit terugstuurt, werd gebruikt om de serie te identificeren, waardoor elke aflevering werd belemmerd om als bekeken te worden gemarkeerd.
- Kritische correctie: twee verschillende accounts konden bij aanmaak dezelfde interne ID krijgen (Plex-verbinding), waardoor ze stilzwijgend hun hele bekeken geschiedenis met elkaar deelden. Er wordt nu overal een gegarandeerd unieke ID gebruikt, en elke toekomstige botsing wordt geblokkeerd in plaats van genegeerd.
- De accounts die al zijn beïnvloed door een eerdere botsing vereisen een puntelijke reiniging voordat de volledige resynchronisatie plaatsvindt.

## v1.25.24 — September 2026

### De pop-up "Nieuwigheden" knipte niet langer versiegeschiedenisnotities af

- Bug bevestigd in het veld: een changelog-item dat over meerdere regels was gewikkeld, toonde alleen de eerste regel in de pop-up, terwijl het bronbestand nog steeds compleet was.

## v1.25.23 — September 2026

### Kritische correctie: Plex-tracking werd niet meer bijgewerkt

- Echt regressiebug: wanneer de SQLite contextengine
  niet beschikbaar was (vooral in Docker productie), werd elke nieuwe
  "gezien" beslissing (Plex, handmatig, speler, AI, import)
  stilzwijgend afgewezen in plaats van toegepast — bevestigd in het veld ("gezien toegevoegd op Plex,
  verplichte sync, niets in Movviz").
- De oplosser vertrouwt nu op de bron wanneer er geen
  conflictinformatie beschikbaar is, in plaats van standaard te blokkeren.

## v1.25.22 — September 2026

### Android Mobile NX / TV NX: Hero gebruikt eindelijk de echte aanbevelingen

- Correctie van een echt bug: Mobile NX en TV NX stuurden geen
  parameters naar de Hero-aanroep, waardoor de server altijd
  terugviel op de lokale fallback (recent toegevoegde, niet aangepaste bibliotheek) —
  de aanbevelingspipeline (gewogen zaden, scorer, smaak) werd
  nooit bereikt op Android, in tegenstelling tot het web.
- Geen wijziging in het data-contract, geen app om opnieuw te installeren vanwege
  een technische reden gerelateerd aan de versie.

## v1.25.21 — September 2026

### Status "gezien / niet gezien": enkele bron van waarheid

- Correctie van een echt bug: een late Plex-resynchronisatie (geschiedenis
  met nog een oude weergave) kon een handmatig gemarkeerde
  titel "niet gezien" opnieuw tot leven wekken, door gebrek aan datumvergelijking tussen bronnen.
- Nieuwe canonieke oplosser (`applyWatchDecision`): de meest
  recente (Plex, speler, handmatige actie, AI, import) wint altijd met
  de realtime van het evenement, nooit met de synchronisatievolgorde.
- Correctie van een echte bug waarbij een karakter een tijdstempel schreef in de
  verkeerde kolom bij het samenvoegen van afspeelstatussen.
- De uitgaande Plex scrobble/unscrobble wordt nu gevolgd en zichtbaar
  (succes/falen), waar voorheen alleen een diagnostisch logboek bestond.
- API-contract ongewijzigd — geen update vereist op Desktop, Mobile NX
  of TV NX.

## v1.25.20 — September 2026

### Herziening van de "Voor jou" aanbevelingsengine

- Seeds (titels gebruikt als startpunt voor suggesties) worden nu gewogen op basis van de werkelijke signaalsterkte — expliciete beoordeling, 👍, serie-betrokkenheid, recentheid — in plaats van elke gezien titel als gelijkwaardig te behandelen. Een gehate-maar-geziene film weegt niet meer zo zwaar als een 5★.
- TMDb-kandidaten (`recommendations` + `similar`) worden geaggregeerd door middel van multi-seed bewijs met een verzadigingsconsensusfunctie, en gerangschikt door een pure en deterministische scorer (testbaar zonder netwerk) in plaats van een formule die gedomineerd wordt door de TMDb-populariteit.
- "Omdat je X hebt bekeken" en de Hero op het dashboard gebruiken nu dezelfde gemeenschappelijke smaakprimitieven (`userContext/taste.ts`) in plaats van gedupliceerde scoringslogica's — de Hero had tot nu toe geen band met deze laag.
- Correctie van een regiobug: de Netflix/Disney+/Prime catalogus en de "waar kijken" badges dwongen `watch_region=FR` af voor iedereen, inclusief Belgische/Zwitserse/Canadese accounts. Nieuwe instelling "Streamingregio" in het profiel (11 landen, automatisch toegepast op Desktop, Mobile NX en TV NX omdat deze op accountniveau wordt opgeslagen).
- API-routecontract ongewijzigd — geen update vereist voor Android Mobile NX of TV NX.

## v1.25.19 — September 2026

### Android TV NX: avatar vernieuwd bij elke opstart

- Geen visuele wijzigingen ten opzichte van v1.25.18.
- De enige afbeeldingen waarvan de cache wordt geforceerd, zijn de profielfoto's.
- Een sessie-ID wordt toegevoegd aan de avatar-URL bij elke nieuwe opstart van het TV-proces: Coil laadt dus daadwerkelijk de foto opnieuw in plaats van een oude gecacheerde afbeelding te hergebruiken.
- De URL blijft stabiel gedurende de hele sessie om herhaalde downloads tijdens hercompositie te voorkomen.
- De tijdelijke cache-buster wordt nooit opgeslagen in de lokale voorkeuren.

## v1.25.18 — September 2026

### Android TV NX — premium zijbalk + Movviz avatars daadwerkelijk gesynchroniseerd

- De uitgerolde zijbalk is verminderd van 195 dp naar 156 dp (-20 %).
- Verwijdering van de grote actieve gradiënt en de 2 dp witte rand: meer ingetogen actieve/focus statussen, lichte merkachtergrond en 1 dp rand.
- Correctie van de actieve achtergrond die niet de breedte van de uitgerolde knop vulde.
- Profielpopup en voettekst geharmoniseerd met dezelfde premium visuele taal.
- Het actieve profiel wordt nu ververst, zelfs als het al in de cache aanwezig is: een gewijzigde foto op de desktop vervangt onmiddellijk het oude TV-avatar.
- Bekende apparaatprofielen reconciliëren naam/avatar met `/api/tv-profiles`; het Movviz-avatar (`customAvatar`) blijft prioriteit en Plex is slechts een fallback.
- Dezelfde reconciliatie toegepast op de NX mobiele client.
- Hero « Hoogtepunten »: `Lezen` standaard, `Herhalen` alleen wanneer er daadwerkelijke voortgang is.

# Changelog

## v1.25.17 — September 2026

### Profielen: canoniek Movviz-avatar op desktop, NX mobiel en NX TV

- Het aangepaste Movviz-avatar blijft de bron van waarheid: een verversing van de Plex-foto werkt alleen de fallback bij en kan niet langer `customAvatar` wissen.
- Movviz-avatarbestanden die nog op de schijf aanwezig zijn, worden automatisch opgehaald als een oudere logica ze gedeactiveerd had.
- Android TV NX en Android Mobile NX normaliseren de URLs `/api/avatars/...` ten opzichte van de Movviz-server, zodat picker, sidebar, badges en profielkaart allemaal dezelfde foto weergeven.
- De Movviz-upload probeert ook replicatie naar Plex via het privé-endpoint dat door Plex Web wordt gebruikt; deze synchronisatie is strikt best-effort en een weigering aan de Plex-kant verhindert nooit dat het lokale Movviz-avatar functioneert.

## v1.25.16 — September 2026

### Android TV NX: D-pad sidebar/content focus betrouwbaar gemaakt

- Sidebar: verwijdering van de globale interceptie van `DPAD_RIGHT`; de uitgang naar de inhoud is nu gebaseerd op `focusProperties.exit`, ingebouwd door Compose.
- Modifier-volgorde gecorrigeerd: `focusProperties` omhult `focusGroup` in de NavRail en op het startscherm, zodat de uitgangsregels worden toegepast op de juiste focusdoel.
- Verwijdering van de niet-bedrade focus fallback in de NavRail, wat het parcours bemoeilijkte zonder ooit gebruikt te worden.

## v1.25.15 — September 2026

### Android TV NX: D-pad sidebar ontgrendeld (focusGroup exit)

- `Home 1×→ 3×↓ 3×←` leidde naar `Zoeken` in plaats van `Home` — overgang van `enter` naar `exit` op de `Box` inhoud + `TvLazyColumn` in `focusGroup` zodat `LEFT` vanaf elk eerste item naar het geselecteerde tabblad gaat.

## v1.25.14 — September 2026

### Android TV NX: hero gecentreerd bovenaan

- Hero backdrop uitgelijnd op `TopCenter` (in plaats van midden) — we zien de bovenkant van de poster, en de onderkant is afgesneden.

## v1.25.13 — September 2026

### Android TV NX: D-pad Home 1×→ 3×↓ 3×← ontgrendeld

- `Home > rechts > 3× omlaag > 3× links` blijft niet meer vastzitten in de sidebar — `focusGroup` + `focusProperties { enter/exit }` op NavRail/Content vervangen `left =` op lazy items (wat de ruimtelijke indeling brak), `TvLazyColumn` in `focusGroup`, `RIGHT` prioriteert `moveFocus` dan `contentFocus`.

## v1.25.12 — September 2026

### Android TV NX: immersieve hero hersteld

- De hero krijgt zijn oorspronkelijke immersieve formaat terug (maximaal 500 px, 46% viewport, padding 52/40/46, breedte 620) — alleen de tegels en de sidebar blijven op -25% zoals gevraagd.

## v1.25.11 — September 2026

### Android TV NX: 25% algemene verlaging + D-pad ontgrendeld

- De gehele TV-interface is verkleind met 25% (sidebar 63/195 dp, kaarten 99/203/124 dp, typo 11/17 sp, enz.) — sidebar inbegrepen, verhoudingen en gradiënten behouden.
- D-pad: `Home > rechts > 3× omlaag > 3× links` blokkeert niet meer in de sidebar — `LEFT` vanaf de eerste kaart van elke rij (inclusief "Binnenkort") gaat expliciet naar het geselecteerde tabblad, `UP` gaat terug naar de NavRail, `RIGHT` vindt de inhoud zelfs na scrollen.

## v1.25.10 — September 2026

### Correctie downloads: pauzeren/herstellen WebTorrent

- `pauzeren`/`herstellen` deed niets meer sinds de herziening (casegevoelig bij infoHash) — `WebTorrentBackend` en `AbstractBackend` zijn nu case-insensitief, `findByInfoHash` ook; de pauze/herstelknop op desktop en mobiel stuurt WebTorrent correct aan.

## v1.25.9 — September 2026

### Android TV NX: vierkante sidebar, D-pad Binnenkort ontgrendeld

- NavRail: vierkante iconen van 56 dp (14 dp straal) in een ingekorte rail, gradiënt behouden op het actieve — zoals het vierkant van de 2e afbeelding, geen lelijke uitgerekte pil meer in rust.
- D-pad: `LEFT` vanaf de eerste kaart van elke rij (inclusief "Binnenkort") gaat nu expliciet naar het geselecteerde tabblad via `focusProperties`, niet meer willekeurig geometrisch (Binnenkort → Profiel) — 1e kaart `LEFT` blokkeert niet meer.
- Home: `UP` vanaf de hero/inhoud gaat soepel terug naar de NavRail, `DOWN` blijft in de kolom zonder naar de sidebar/launcher te ontsnappen.

## v1.25.8 — September 2026

### Android TV NX: resterende duur op Doorgaan, on-deck API verrijkt

- `GET /api/plex/on-deck` exposeert nu `durationMs` aan de TV: de rij "Doorgaan" toont `S2 E3 · 22 min over` (of `22 min over` voor een film) in plaats van alleen `S2 E3`, met behouden smalle balk.

## v1.25.7 — September 2026

### Android TV NX: D-pad ontgrendeld, logo's teruggevonden, series ontwarreld

- D-pad: LEFT vanaf de inhoud richt zich nu op het geselecteerde tabblad (niet meer willekeurig), UP valt niet meer op de onzichtbare anker van 2 px, DOWN ontsnapt niet meer naar de sidebar/launcher, BACK vanaf een fiche herstelt dezelfde kaart (focusRestorer) in plaats van de NavRail — 3 blokkerende valkuilen gecorrigeerd (rapport 183 tests: 161 PASS).
- Platforms: tegels van 16/9 met een witte achtergrond van 95 % achter het logo (zoals Ontdekking), zichtbaar zelfs voor donkere logo's; hero en rijen behouden hun halo's.
- Series ontwarreld: pil FILM/SERIE op gemengde rijen (Selectie, Trends, Toegevoegd, redactioneel), type-split zoekopdracht aan de server (`?type=movie|series`) in plaats van een clientfilter.

## v1.25.6 — September 2026

### Android TV NX: Home mockup, trailers uitgelijnd, TV-patroon overal

- Home: rij "Platforms" (tegels 16/9, dezelfde logo's als Ontdekking, Alles zien aangepast bij klik), hero conform mockup (46 % / 500 px max, CTA "Herstellen" in merkverloop, stippen rechtsonder), rij "Doorgaan" in vaste landschapkaarten van 270x150 met afleveringstill, S/E context en voortgang ingebed, paars gloed bij focus.
- Trailers: de TV speelde directe bronnen af (zoeken op titel, soms de verkeerde film) vóór YouTube, in tegenstelling tot desktop dat alleen YouTube afspeelt — YouTube staat nu overal voorop (hero, kaarten, titelfiche), direct is slechts een laatste redmiddel.
- Logo: orbitale animatie verwijderd (draaiende halo, golven, deeltjes, pulsatie), statisch merk.
- Ontdekking, Bibliotheek, Zoeken en Instellingen overgeschakeld naar TvLazyColumn/TvLazyRow + focusRestorer; Terug/Escape in het zoekveld geeft de controle terug aan de D-pad zonder het scherm te verlaten.
- Pil "VF" van de hero toegevoegd, maar alleen weergegeven bij echte data (geen VF veld ontvangen van de server vandaag: nooit gemaakt).

## v1.25.5 — September 2026

### Android TV : cache geheugen afbeeldingen dubbel

- Het Coil geheugen cache gaat van 10 % naar 20 % van het applicatie-RAM: minder opnieuw downloaden van posters/achtergronden in rijen, vloeiender op goed uitgeruste apparaten.

## v1.25.4 — September 2026

### Visuele opruiming: animatieachtergrond verwijderd, suggesties en metadata verfijnd

- De animatieachtergrond "Aurora" (achtergrond van de app) is verwijderd — een ongebruikte component die de weergave zwaarder maakte zonder huidige visuele meerwaarde.
- TMDb suggestie- en metadata-ophaalmotor verfijnd (videooriëntatie, vertaalde teksten).

## v1.25.3 — September 2026

### Android TV/mobiel: zijbalk conform ontwerp, correcties speler en profielen

- Android TV zijbalk opnieuw ingesteld op de exacte waarden van het mockup (breedtes, afstanden, iconen) — het Ontdekking-icoon (kompas) en de bug die de D-pad verhinderde de inhoud van dit scherm te bereiken, zijn gecorrigeerd.
- Seizoenkaart en "bekeken" badge op episodes gestyled in de Movviz-identiteit in plaats van een plat grijs/wit.
- Profielfoto: een wijziging die via het web was gedaan, werd niet meegenomen door de Android TV en mobiele apps bij de volgende start (avatar ververst in het geheugen maar nooit opnieuw op het apparaat geregistreerd) — gecorrigeerd in beide apps.
- Video-preview (homepage en titelpagina): de video kadreert anders dan de statische afbeelding erachter, waardoor een zichtbare strook ontstaat bij het wisselen — gecorrigeerd op Android TV en mobiel.
- Gecompileerd en visueel geverifieerd op Android TV emulator; de zoekraster en een zeldzaam geval van foutgeactiveerde afspeling via de D-pad vereisen verder onderzoek.

## v1.25.2 — September 2026

### Android TV: herontwerp navigatie en visueel

- De navigatie gaat van een bovenbalk naar een inklapbare zijbalk (alleen iconen, vergroot bij afstandsbediening focus) — nachtblauw kleurenpalet, merkovergang van blauw→paars→magenta.
- Films en Series fuseren tot één Bibliotheek-tabblad (Films/Series/Collecties); Zoeken wordt een eigen tabblad met dezelfde Filter Alles/Films/Series als op mobiel; Ontdekking is opnieuw direct toegankelijk.
- ⚠️ Niet gecompileerd/getest op apparaat — eerste echte verificatie via de CI-build geactiveerd door deze tag.

## v1.25.1 — September 2026

### Hotfix: API timeouts tijdens Plex sync

- De detectie van "zelfde fysieke bestand" laadde `plex-path-mappings.json` (een schijf `stat`) bij elke vergelijking, synchroon: op een grote bibliotheek scanneerde elk Plex-item duizenden paden en blokkeerde de event loop, wat leidde tot API Timeout routes tijdens de sync.
- De guards gaan nu in twee stappen zonder enige syscall: eerst genormaliseerde gelijkheid (alleen geheugen), daarna mappings één keer geladen + suffix. Dezelfde verwerking bij schijfreconciliatie.
- Geen wijziging in bedrijfsprocessen: dezelfde fusies, dezelfde regels, alleen zonder I/O.

## v1.25.0 — September 2026

### Plex Bibliotheek: dubbele verwijdering, onmiddellijke afspeling en Docker-paden

- De anti-dubbele-import lock van de Plex sync wordt nu gedeeld door alle bundles (geen dubbele import bij dubbelklik of overlap met de scheduler), met herverificatie na elke TMDb-aanroep.
- Dezelfde fysieke locatie = dezelfde film: de sync fuseert in plaats van een dubplicaat te creëren, zelfs met verschillende mounts (Movviz `/data/film` ↔ Plex `/volume1/docker/plex/film`) en uiteenlopende Plex-agenten. Het raster maskeert ook resterende dubbele vermeldingen via `tmdbId`.
- Instellingen → Plex: nieuwe sectie voor padmatching (alleen Docker/Linux) — eindbestemmingen van de torrent vergeleken met de werkelijke locaties van de Plex-secties, suggesties om met één klik te valideren, handmatige invoer mogelijk. Niets wordt toegepast zonder validatie.
- Leest zodra het bestand naar de juiste locatie is verplaatst en hernoemd, zonder te wachten op Plex (web, Android TV en mobiel). Plex blijft een asynchrone verrijking (badges, back-up URL).
- De synchronisatieknop toont nu een persistent voortgangsstatus (fase, sectie, teller, seconden) en blijft uitgeschakeld zolang de server draait.
- De dagelijkse reconciliatie toont geen valse anomalieën meer op die verband houden met dubbele mounts (exacte vergelijking + vertaling via mappings + ouder/bestand suffix).
- Strakke banden: synchronisatie van downloads elke 2 minuten, ophalen van niet-geïmporteerde voltooide items elke 15 minuten.

## v1.24.170 — September 2026

### Zijbalk: automatisch inklappen bij hover

- De zijbalk krimpt nu automatisch tot een kolom van iconen en vergroot zich bij het overgangen met de muis, waarbij het de inhoud verplaatst (geen knop meer om handmatig op te klikken).
- Ingevouwen iconen zijn vergroot, meer uit elkaar geplaatst, zonder achtergrond op inactieve iconen — alleen het actieve icoon behoudt zijn verloopde tegel.

## v1.24.169 — September 2026

### Downloads: omslagen worden eindelijk weergegeven

- De echte oorzaak: de wachtrij reconstrueert de informatie van elke titel bij elke verversing vanuit de downloadmotor, zonder ooit de omslag op te nemen — gecorrigeerd. Werkt nu voor lopende EN reeds aanwezige downloads in de wachtrij/geschiedenis (retroactief, niets opnieuw hoeven te starten).

## v1.24.168 — September 2026

### Downloads: klikbare titel, sobere details, omslagen voor toekomstige downloads

- Op de titel van een download klikken opent nu het dossier ervan, net als overal anders in de app.
- Het detail onder de titel (resolutie, bron, codec, audio, HDR) is teruggekeerd naar sobere tekst in plaats van grote gekleurde pillen; de indexer "Onbekend" wordt niet meer weergegeven als de info nooit is opgeslagen.
- De omslag van elke titel wordt nu weergegeven voor elke nieuwe download die vanaf deze versie wordt gestart (de info was voorheen nergens opgeslagen, zelfs niet op het daadwerkelijk door een handmatige zoekopdracht/ophaling afgelegde pad) — de reeds aanwezige items in de wachtrij/geschiedenis krijgen dit niet retroactief.

## v1.24.167 — September 2026

### Downloads: schakelaars snel en consistent met de rest van de app

- "Automatisch starten bij opstarten" en "Sequentieel" gebruiken nu hetzelfde schakelcomponent als overal in Movviz, in plaats van een eigen stijl die niet paste.

## v1.24.166 — September 2026

### Inklapbare zijbalk

- De zijbalk kan nu inklappen tot een simpele kolom van vergrote iconen (logo + dock-achtige iconen), om schermruimte te besparen. Voorkeur wordt per apparaat gememoard.

### Ontdekking: filter platform resetbaar

- Op een reeds geselecteerd platform klikken schakelt het filter uit in plaats van erop vast te blijven zitten.

## v1.24.165 — September 2026

### Ontdekking: bovenbalk vergroot en gecorrigeerd

- Tabs, platformlogo's, knop Filters en sorteren zijn ongeveer 50 % groter en leesbaarder.
- De platformlogo's vullen hun kader beter.
- De beschrijving "Sorteren op" werd weergegeven als een ruwe technische sleutel in plaats van de vertaalde tekst — gecorrigeerd.

### Downloads: ontbrekende omslagen en acties

- Elke download toont nu zijn omslag (in plaats van alleen een icoon) in een iets hogere regel.
- De knoppen "vervangen" (handmatige zoekopdracht) en "verwijderen" ontbraken naast pauze op het downloadscherm — toegevoegd.
- De schakelaars "Automatisch starten bij opstarten" en "Sequentieel" tonen nu een foutmelding in plaats van stil te blijven zonder effect bij een mislukking.

## v1.24.164 — September 2026

### Home: dashboardinstellingen worden toegepast

- De instellingen voor de hero (video, diavoorbeeldsnelheid, minimale jaartal, voorgestelde inhoud) en de rijweergave worden opnieuw meegenomen op de startpagina — ze hadden sinds de herontwerp van de startpagina geen effect meer.
- De hero-trailer is nu standaard ingeschakeld voor alle accounts, inclusief die accounts die deze al (zonder dat ze het wisten) op "uitgeschakeld" hadden staan.
- Het vervolgkeuzemenu "Minimaal jaartal van carrousels" is eindelijk leesbaar (donkere achtergrond in plaats van de standaard witte achtergrond van de browser).

### Home en Ontdekking: grotere en echt adaptieve kaarten

- De zijbalk is uitgebreid met ongeveer 15 %.
- De film-/seriekaarten op de startpagina en in Ontdekking zijn vergroot met ongeveer 25 % en krimpen nu daadwerkelijk met het venster (zoals de Platformtegels), in plaats van vast te blijven staan op een vaste grootte.

## v1.24.163 — September 2026

### Home: hero visuels en trailer uitgelijnd met de fiche

- De hero geeft de voorkeur aan landschappelijke editoriale achtergronden zonder ingebedde titel, zodat het Movviz-logo alleen boven de afbeelding blijft staan.
- De hero-speler gebruikt nu exact het iframe-profiel van de film- en seriekaarten.

## v1.24.162 — September 2026

### Home: hero beschikbaar zelfs bij TMDb overbelasting

- De eerste weergave van de hero gebruikt onmiddellijk de reeds opgeslagen achtergronden in de bibliotheek, zonder afhankelijk te zijn van een trage of verlopen TMDb-aanvraag.
- De verrijkte aanbevelingen en trailers worden daarna geladen, zonder het gebruikelijke hero-beeld te kunnen verbergen.

## v1.24.161 — September 2026

### Home: veilige fallback voor de hero

- De trailer blijft een overlay op de hero-achtergrond: bij geen video of bij een fout van de YouTube iframe, blijft het gebruikelijke beeld zichtbaar met alle hero-besturingselementen.
- Een geïsoleerde spelerfout kan niet langer de gehele hero laten verdwijnen.

## v1.24.160 — September 2026

### Home: betrouwbare hero-trailers

- De hero neemt hetzelfde iframe-profiel aan als de film- en seriekaarten.
- Een geladen YouTube iframe wordt nu na een korte vertraging zichtbaar als YouTube zijn interne afspeelmeldingen niet verstuurt, in plaats van de achtergrond onbepaald te laten staan.

## v1.24.159 — September 2026

### Home: aangepast ultrawide plafond

- Het vloeiende en gecentreerde desktop canvas is nu beperkt tot 2000 px in plaats van 2200 px.

## v1.24.158 — September 2026

### Home en ontdekking: vloeiende breedte en OCS hersteld

- De homepagina gebruikt nu de volledige bruikbare breedte op desktop, en blijft vervolgens gecentreerd met een plafond van 2200 px op ultrawide. De kaarten behouden hun grootte en tonen dus meer inhoud, terwijl de platformtegels meer ruimte krijgen.
- De hero gaat naar volledige breedte in een verhouding van 18:9; "Opnieuw bekijken" wordt een redactionele rij boven de aanbevolen suggesties.
- De uitsluitingen per duim naar beneden worden herzien door de lokale rijen: een titel die is uitgesloten van "Minder dan 40 minuten" komt niet meer terug na het opnieuw laden.
- OCS behoudt zijn logo en naam, maar vraagt nu het huidige TMDb-katalogus van Ciné+ OCS (id 685) aan in plaats van de oude lege id 56.

## v1.24.157 — September 2026

### Home: platforms met dynamische breedte

- De acht platformlogo's vullen nu de inhoudsbreedte tot de uitlijning "Alles zien".
- De raster neemt netjes af van 8 naar 3 kolommen afhankelijk van de schermbreedte, zonder horizontale scroll of kleine vaste tegels.

## v1.24.156 — September 2026

### AI: gratis aanbiedingen daadwerkelijk selecteerbaar

- De OpenCode Zen en OpenRouter catalogi worden dynamisch herzien en gefilterd om alleen gratis modellen te tonen.
- Gemini is beperkt tot officieel gedocumenteerde en daadwerkelijk toegankelijke gratis modellen via de ingestelde sleutel; Mistral is expliciet beperkt tot het inbegrepen quotum van het gratis abonnement.
- De vergrendeling wordt toegepast in de interface, bij het opslaan en bij het daadwerkelijke aanroepen: een oude configuratie kan niet langer stilzwijgend een factureerbaar model selecteren.

## v1.24.155 — September 2026

### AI: de Knop Test toont de ruwe providerfout

- De test retourneerde alleen "quota" of "falen", wat de echte oorzaak verhulde (ongeldige sleutel, ontbrekende facturering, onbekend model, daadwerkelijke rate-limit). De exacte melding van de provider wordt nu hierna in het paneel weergegeven.

## v1.24.154 — September 2026

### AI: de Knop Test testte de verkeerde provider

- De testroute bouwde zijn keten op vanaf de opgeslagen primaire in plaats van de aangeklikte provider: "Testen" op opencode testte in feite mistral, met een OK onder de verkeerde kaart weergegeven. Verholpen met een keten beperkt tot de gevraagde provider.

## v1.24.153 — September 2026

### Platformlogo's: einde van witte achtergronden

- Disney+ en Apple TV+ gebruiken hun witte varianten (dezelfde lijnen, de blauwe Disney+ boog behouden): alle tegels blijven donker, geen witte achtergrond meer.
- OCS wordt direct op donkere tegels weergegeven, zonder witte achtergrond.

## v1.24.152 — September 2026

### Lokale platformlogo's

- De rij met 'Ontdekking' en 'Welkomstplatforms' (tabs + raster) gebruikt lokale SVG's (Netflix, Disney+, Prime Video, HBO Max, Apple TV+, YouTube, Crunchyroll, OCS opgehaald van Wikimedia) in plaats van externe TMDb-logo's, met een lichte achtergrond voor donkere logo's.

### Zoekbalk in mobiele stijl

- De zoekbalk neemt exact de Android mobiele weergave over: pil van 46px, elektrische blauw → paars → magenta rand, achtergrond #131836, icoon + placeholder van 13px #B3B3B3.

### Einde van de lichte modus

- Volledige verwijdering van de lichte modus: donker wordt overal afgedwongen, zonder keuze — verwijdering van de switcher in de topbalk, van de 'Uiterlijk' stap in de wizard, van de 'Profieluiterlijk' sectie, van al het licht-CSS en van de servervoorkeur.

## v1.24.151 — September 2026

### Android smartphone — Mijn ruimte

- De onderste balk verandert de tab 'Bibliotheek' in 'Mijn ruimte', wat geschikter is voor een hub die de kijklijst, recente geschiedenis en collecties verzamelt.
- De drie tabs (Kijklijst, Geschiedenis, Collecties) worden weergegeven in een raster van 3 kolommen in plaats van horizontaal scrollen.
- Alle inhoud is aanklikbaar: de kaarten openen de titelpagina, de collecties zijn navigeerbaar en de saga's reageren op tikken.

## v1.24.150 — September 2026

### NX Dashboard

- Fixeert de rij met platforms: Netflix, Disney+, Prime Video, HBO Max, Apple TV, YouTube, Crunchyroll en OCS.
- Vergroot de rechthoekige platformtegels en verwijdert Canal+ uit deze compositie.

## v1.24.149 — September 2026

### NX Dashboard

- Herbalanceert de ultra-brede compositie: inhoud is verankerd naar de zijbalk, de bruikbare breedte is vergroot, de hero is compacter en de 'Vervolg' kolom is verrijkt.
- Zet de hoofdsuggesties om in verticale posters en geeft meer nadruk aan de platforms en de zoekfunctie.
- Toont de werkelijk resterende tijd in 'Vervolg' op basis van de duur en de Plex-positie.

## v1.24.148 — September 2026

### Ontdekking NX

- Corrigeert het raster Nieuwigheden en Trends: elke tegel gebruikt zijn hele cel en de status blijft over de visual overlappen.
- Het Filters paneel blijft open tijdens het selecteren van een genre op desktop.

## v1.24.147 — September 2026

### Ontdekking NX

- De rails gebruiken nu de werkelijke breedte van de tegels, zonder lege ruimtes of losse toevoegknoppen tussen de inhoud.

## v1.24.146 — September 2026

### Ontdekking NX

- De desktop Ontdekkingbalk neemt de samenstelling van het schetswerk over: compacte tabbladen, gescheiden platforms, leesbare Filters- en sorteerknop, zonder halo of algemene omlijsting.

## v1.24.145 — September 2026

### NX desktop trouw

- Verwijdering van halos, lichtschaduwen en decoratieve kaders die niet in het NX-schetswerk voorkomen.
- De overname, de platforms en de acties van de topbalk hebben een donkere, compacte en leesbare samenstelling teruggevonden.

## v1.24.144 — September 2026

### NX desktop trouw

- De desktop-omhulling is verduestigd: compacte zijbalk, gemarkeerde actieve status, strakke topbalk en zoekfunctie.
- Home, Ontdekking, Bibliotheek en Downloads gebruiken nettere besturingselementen en de redactionele hiërarchie van de NX-richtlijn, zonder de mobiele interface aan te passen.

## v1.24.143 — September 2026

### Downloads

- Het snelinstellingenpaneel toont vertaalde titels, een expliciete link naar downloadclients en schakelaars die toegankelijk zijn zonder hun leesbaarheid te verminderen.

## v1.24.142 — September 2026

### NX desktop trouw

- De Homebalk toont nu de werkelijke platforms onder de hero; Afspelen is prioriteit en Mijn lijst is aanklikbaar.
- De bibliotheek krijgt zijn NX-balk met echte filters (4K, HDR, mijn lijst, recent en sorteer) en compactere rails.
- De Downloadsrail toont de wachtrij, de vrije ruimte en snelinstellingen die daadwerkelijk verbonden zijn met de engine.

## v1.24.141 — September 2026

### NX desktop interface

- Herontwerp van de Home-, Ontdekking-, Bibliotheek- en Downloadspagina's: dichte desktop-samenstelling, inhoudsrails, platformfilters, Genre-kolom en realtime trackingtabel.
- De Films- en Seriespagina's geven nu de voorkeur aan suggesties, met een expliciete toegang tot hun respectieve bibliotheek.
- Het dashboard behoudt een vaste samenstelling, met een speciale rail voor het hervatten van de afspeelstatus en zonder dubbele rij.

### Plex en downloads

- Een persoonlijke Plex-verbinding vanaf mobiel of tv haalt onmiddellijk de volglijst van de gebruiker op en activeert deze privé-synchronisatie.
- De engine behoudt een echte geschiedenis van de snelheden voor live downloadstatistieken.

## v1.24.140 — September 2026

### Android

- Beheerders kunnen nu een gebruikersaccount aanmaken vanuit de Android-instellingen, met dezelfde validatie- en autorisatieregels als de webinterface.

## v1.24.139 — September 2026

### Interface

- Geoptimaliseerd laden is nu het enige interfacegedrag, standaard actief zelfs voor oudere configuraties. De optie Compatibiliteit is verwijderd uit de Instellingen.

## v1.24.138 — September 2026

### Ontdekking Betrouwbaarheid

- Alle TMDb-verzoeken delen nu een globale pool van maximaal zes verbindingen, inclusief tussen parallel geladen rijen.
- Identieke TMDb-verzoeken worden gemaximaliseerd en aanbevelingen analyseren niet langer meer dan strikt noodzakelijk, waardoor de tijdslimieten die Ontdekking leegliepen, worden vermeden.

## v1.24.137 — September 2026

### Desktopinterface

- De secundaire tegels en knoppen nemen de elektrische contouren van de NX mobiele richtlijn over: een leesbaard paars/cyaan silhouet, een subtiele halo en een versterkte focus, zonder de paginastructuur te wijzigen.

## v1.24.136 — September 2026

### Ontdekking en suggesties

- Een klik op "Slechte aanbeveling" verwijdert onmiddellijk de titel van alle betreffende rijen, verschuift de resterende kaarten en laadt een vervanger. De afwijzing blijft permanent na vernieuwing of opnieuw opstarten.
- Beheer → Uitsluitingen toont alle afgewezen aanbevelingen en maakt individueel opnieuw autoriseren mogelijk.

## v1.24.135 — September 2026

### Ontdekking

- De Anime-rij blijft wereldwijd, zelfs wanneer een continentfilter is geselecteerd. Japanse animefilms en -series verdwijnen dus niet meer uit Ontdekken.

## v1.24.134 — September 2026

### Ontdekking

- De continenten dekken nu alle landen en territoria die door TMDb worden erkend: het aanvinken of ontvinken van een continent past nu de volledige set toe die overeenkomt met het oorspronkelijke filter.
- De logo's van platforms op de kaarten (Netflix, Disney+, Prime Video, etc.) worden weergegeven zonder achtergrond of witte omlijsting.

### Docker

- AMD64- en ARM64-images worden gepubliceerd met Docker V2 manifests in plaats van OCI manifests, zodat Synology Container Manager de tag `latest` kan lezen en updates kan downloaden.

## v1.24.133 — September 2026

### Installatie

- Windows en Linux gebruiken ook de configureerbare BitTorrent-poorten `55000`/`55001` standaard. Beide variabelen worden doorgegeven aan de Windows-service, en een persistente systemd-overlay is gedocumenteerd voor Linux.

## v1.24.132 — September 2026

### Docker

- De BitTorrent-poorten voor films en series gebruiken nu standaard `55000` en `55001`, en zijn onafhankelijk configureerbaar via Docker-variabelen. Deze variabelen vervangen ook de eerder door de engine geregistreerde poorten, waardoor elk blijvend conflict met een andere torrentclient wordt voorkomen. UPnP opent en verwijdert automatisch de corresponderende TCP- en UDP-mappings wanneer de router dit toestaat.

## v1.24.131 — September 2026

### Docker

- Het Docker-manifest exposeert nu expliciet de drie Movviz-diensten: interface/API (`9810`), downloadengine (`9820`) en Cloudflare-resolver (`9830`), naast de BitTorrent-poorten.

## v1.24.130 — September 2026

### Installatie

- De eerste installatiewizard biedt nu, vóór de configuratie van indexers, de optie om de automatische zoek- en downloadfunctie voor gevolgde maar ontbrekende content uit te schakelen.

## v1.24.129 — September 2026

### Android mobiel NX

- De persistente zoekfunctie in landschap reserveert nu zijn hoogte, plus 3 dp, in elke pagina van de centrale kolom: geen hero, titel of eerste lijstitem wordt verborgen bij het openen of bij het wijzigen van een tabblad.

## v1.24.128 — September 2026

### Ontdekking

- **Trend / Top / Nieuwheden uitgelijnd voor synthetische genres**: `Animes` en `Romance ado` (Teen) respecteren nu de gekozen sortering — `Trends` (`popularity.desc`), `Top` (`vote_average.desc` + `vote_count.gte 200`) en `Nieuwheden` (`primary_release_date.desc`/`first_air_date.desc` + cap op vandaag) — en het jaar, in plaats van een hardgecodeerde `popularity.desc`. De andere filters (platform, studio, duur) worden ook doorgegeven.

## v1.24.127 — September 2026

### Android mobiel NX

- De zoekbalk in portret is nu persistent en ondoorzichtig boven de centrale kolom in landschap; de hero en lijsten scrollen eronder.
- Netflix, Prime Video en platformsortering: NX premium knoppen (elektrische contouren, nachtblauw oppervlak en paars gradiëntselectie).
- De catalogi van platforms worden niet langer leeg wanneer een geldige bassin alleen nieuwe items bevat: er wordt teruggegrepen op deze titels in plaats van een pagina zonder resultaten weer te geven.

## v1.24.126 — September 2026

### Android mobiel NX

- Landschapmodus: de zoekfunctie verlaat de zijbalk en wordt een zwevende globale actie rechtsboven de centrale content.

## v1.24.125 — September 2026

### Android mobiel NX

- Landschap en uitgevouwen modus: menu is smaller met logo behouden bovenaan, adaptieve breedte van het downloadpaneel en behouden centrale ruimte (minimaal 360 dp met drie kolommen).
- Afgeronde en gescheiden highlightkaart in landschap, zonder wijziging in portret of TV NX.
- Uitgebreide landschap portretkaart: elektrische blauw-paars-magenta contouren van de kaarten en afspeelknoppen in een paarsdegradatie.
- Profiel van de actieve gebruiker ververst vanuit het ingelogde account, zelfs als er al een lokaal profiel bestaat; de selectorcache behoudt ook de gepersonaliseerde Movviz-foto.
- Correctie van de Compose-referentie in de catalogussorteerder.

### Kunstmatige intelligentie

- De IA-prioriteitenlijst is nu de enige bron van waarheid: een oude `primary` waarde kan niet meer voorrang hebben op de leverancier op plaats 1.

## v1.24.124 — September 2026

### Android NX

- Netflix-, Prime Video- en Disney+-catalogi blijven niet langer leeg na een tijdelijke TMDb-uitval: een initiële lege respons verpest de cache niet langer gedurende 45 minuten.
- De platformpagina's tonen nu standaard "Selectie voor u", "Beste beoordeeld" en "Meest recent".
- Onmiddellijke verversing van avatars op TV NX, zelfs als Plex de afbeelding vervangt zonder de URL te wijzigen.
- De tellers "Bekeken films" en "Bekeken series" tonen nu de geaggregeerde Plex/Movviz-totalen in plaats van alleen de 20 meest recente zichtbare kaarten.

## v1.24.123 — September 2026

### Kunstmatige intelligentie

- Toevoeging van OpenCode Zen aan IA-leveranciers, met API-sleutel, verbindingscontrole en ondersteuning voor Chat Completions- en Responses-protocollen.
- Selectie bewust beperkt tot de zes officieel gratis Zen-modellen: geen betaald model kan worden geregistreerd.
- De prioriteitsvolgorde van leveranciers is volledig configureerbaar; de engine respecteert de gekozen rangschikking voor de primaire leverancier en elke fallback.

### Profielen

- Synchronisatie van Movviz ↔ Plex avatar bij de laatste winnende wijziging, met anti-loop vingerafdruk, invalidatie van de TV NX cache en veilige terugval: een Plex-fout blokkeert nooit de Movviz-upload.

## v1.24.122 — September 2026

### Geunificeerd kijken

- Eén bron voor bekeken/niet-bekeken status op desktop, Mobile NX en TV NX, met echte aggregatie van aflevering, seizoen en serie.
- Bidirectionele Plex-synchronisatie die de werkelijke datums behoudt; een bevestigde kijkstatus blijft prioriteit hebben boven een simpele afwezigheid van status.
- Schoon herstarten zodra een titel bekeken of gereset is, met slechts één actieve herstart per serie.

### Suggesties en IA

- Gepersonaliseerde rangschikking gebaseerd op smaak en publieke aantrekkingskracht: populariteit, stemvolume en matchkwaliteit wegen zwaarder dan vergelijkbare obscure inhoud.
- Nieuwheiden die veel gevolgd worden van een leverancier kunnen onmiddellijk omhoog komen wanneer ze overeenkomen met de smaak, zonder te hoeven wachten op het verzamelen van duizenden stemmen.
- Profiel verrijkt met TMDb-thema's en trefwoorden, naast genres, sferen, acteurs, regisseurs, franchises, beoordelingen en echte gedragingen; dezelfde context voedt de suggesties en de Movviz IA.

## v1.24.121 — September 2026

### Android

- Verwijdering van historische Android Mobile en TV klanten: alleen Movviz NX Mobile en Movviz NX TV blijven gecompileerd en gepubliceerd. Bestaande API-routes blijven ongewijzigd.

## v1.24.120 — September 2026

### Profielen

- Gepersonaliseerd profielfoto per gebruiker (Instellingen → Profiel op desktop, aanraakbare foto op mobiel profiel): JPEG/PNG/WebP/GIF ≤ 2 Mo, zichtbaar op desktop + mobiel + TV, prioriteit boven Plex foto (onveranderd).
- Opmerking: replicatie naar Plex onmogelijk via de openbare API (geen gedocumenteerde endpoint — alleen de officiële app kan dit); de Movviz foto leeft aan de Movviz kant, hook klaar in `src/lib/avatars.ts`.

## v1.24.119 — September 2026

### NX Mobile

- Plex foto overal opgehaald: Coil deelt de geauthenticeerde HTTP-sessieclient, relatieve URL's opgelost tegen de server, fallback initialen bij falen (badge, rail, picker, profiel, TV-balk).
- Unieke voettekst (#0F142F, toon van de logo-balk) op alle portret/landschaps schermen, systeembalken en opstartschermen — geen zwarte achtergronden meer.

## v1.24.118 — September 2026

### NX Mobile

- Compact uitgevouwen hero: verkleind logo, synopsis alleen op het profiel — Lees / Meer info altijd zichtbaar (gemeten ingekort op 12px op emulator).

## v1.24.117 — September 2026

### NX Mobile

- Premium landschap overal: aanraakbare rail ook op titel-/acteurprofiel en "Alles zien", uitgebreid immersief, verkleind profielhero, compacte marges (Ontdekking, Catalogus, Bibliotheek, Profiel, Instellingen, Profiel, Acteur, Raster), "Alles zien" raster van 3 kolommen, aanraakbare zoekopdracht.

## v1.24.116 — September 2026

### NX Mobile

- Echt nul-overloop: de afstand tussen de 3e en 4e kaart (en 4e/5e platform) telt mee voor de aanpassing — gemeten in pixels via bounds (Horimiya in [1053,1080]).

## v1.24.115 — September 2026

### NX Mobile

- Nul-overloop 4e kaart: veiligheidsmarge van 4dp in de exacte aanpassing (afgeronde Dp→px gemeten op emulator).
- Uitgevouwen hero: 1-regel synopsis om Lees / Meer info zichtbaar te laten op laag landschap.

## v1.24.114 — September 2026

### NX Mobile

- Anti-"MO": gebruikersnaam overal in fallback (groet, avatar header, uitgevouwen rail) wanneer geen profiel actief is; de avatar leidt in dat geval naar de selector.
- Rijen van 3 met exacte volledige kaders (zwevende rekenkunde Dp op echt viewport): geen 4e kaart meer; ook legendes in uitgevouwen staat.
- Uitgevouwen: immersief (buiten echte TV), smalle rail zonder scroll, aanraakbare zoekopdracht, paneelhoes via de bibliotheek, compacte marges op Ontdekking/Bibliotheek/Catalogus/Profiel/Instellingen, compact hero.
- Onderste balk: "Downloads" volledig (gewicht 1.3); MAJ-pill ook in het uitgeschoven rail.

## v1.24.113 — September 2026

### NX Mobiel

- Profiel als schets 08: foto met paars-elektro cirkel, naam + werkelijke rol (Admin-account / Gebruikersaccount), Instellingen tandwiel, 2×2 statistieken (Bekeken films / Bekeken series / In mijn lijst / Gegeven beoordelingen), menu Mijn activiteit / Mijn aanbevelingen / Instellingen / Profiel wijzigen / Uitloggen naar echte bestemmingen.
- Uitgeschoven modus (landschap ≥ 700dp): permanent linker aanraakrail + zijpaneel Bezig / Voltooid op het startscherm, dezelfde elektrische contouren. Portret en TV ongewijzigd.
- Onderste balk: labels in 9.sp, "Downloads" meer afgekapt.

## v1.24.112 — September 2026

### NX Mobiel

- Onderste balk schets 01: 4 tabbladen alleen (Start / Ontdekking / Bibliotheek / Downloads) met icoon + label altijd zichtbaar, actief in verloop-pill.
- Verplaatste update-pill naar de header links van het avatar (alleen zichtbaar indien beschikbaar), paars-elektro ring met ademende halo + hitbox 44dp.
- Immersief type videogame op het portret-startscherm: Android systeemknoppen verborgen, tijdelijk terug naar rand-swipe.

## v1.24.111 — September 2026

### NX Mobiel

- Gedeemde elektrische rand (blauw `#3D7BFF` → paars `#8B2FFF` → magenta `#BC3FFF`) op Platforms, film/serie kaarten en zoeken — geen plat vlak meer.
- Platforms: 4 volledig kader iconen aangepast aan het viewport (geen 5e afgekapt), swipe behouden voor de rest.
- Film/serie rijen: exacte aanpassing van 3 volledig kader kaarten op alle brede schermen (plafond 120dp verwijderd, liet een stukje van de 4e over).

## v1.24.110 — September 2026

### NX Mobiel

- Portret startscherm: 3 volledig kader kaarten per rij zoals schets 01 (breedte berekend `(viewport-32-20)/3`, beperkt 92–120dp, "Meer zien" kaart uitgelijnd) in plaats van 2,5 met de 3e afgekapt.
- Paars-elektro alleen voor NX Mobiel: Merk `#7C3AED` → `#8B2FFF`, Merk2 `#C04BFF` → `#BC3FFF`, Glow `#A06BFF` → `#A66BFF`. Web en 3 andere modules ongewijzigd.
- Portret zoekbalk: fijn elektrisch net `1.dp tot 22%` zoals de rand van de dock en de pill van schets 01.

## v1.24.109 — September 2026

### Android TV NX

- Verbetert een systematische crash bij het scrollen door de rijen op het startscherm (en op verschillende andere schermen: titelpagina, zoeken, catalogus, downloads, acteurpagina, profielkiezer, speler): `NoSuchMethodError` op `LazyLayoutPrefetchState.schedulePrefetch`, binaire incompatibiliteit tussen `androidx.tv:tv-foundation` en de versie van `compose.foundation` opgelost door het project. Dezelfde bug al opgelost voor NX Mobiel (voorafladen uitgeschakeld door reflectie, geen zichtbaar beïnvloed gedrag) — nog nooit op NX TV gebracht. Toegepast op de 14 `TvLazyRow`/`TvLazyColumn`/`TvLazyVerticalGrid` van het module.

## v1.24.108 — September 2026

### Doorkijken

- Een afgeronde aflevering of film (inclusief tijdens de credits) wordt niet langer weergegeven in "Doorkijken"/"Herstart" — op desktop, Android TV en Android mobiel tegelijk, aangezien de 3 afhankelijk zijn van hetzelfde serverpunt (`listOnDeckEntries`). Dezelfde drempelregel "dicht bij het einde" (5 min over voor een film, 2 min voor een aflevering, 10 % voor een kort medium — die al gebruikt wordt door de speler om een bekeken moment als voltooid te markeren) wordt uniform toegepast op de voortgang gevolgd door Movviz EN op de ruwe on-deck van Plex, niet alleen op één van de twee bronnen. Effectief onmiddellijk op reeds "vastgelopen" titels, zonder handmatige verwijdering.

## v1.24.107 — September 2026

### NX Mobile

- Corrige aperçus video die af enstigelijk een totaal andere film tonen (bv. Demon Slayer die een echte opname trailer toont zonder verband): de ambiance preview geeft ten onrechte de voorkeur aan "verrijkte" bronnen (Apple/Netflix/Disney+/Prime Video/IMDb), die matchen op titelgelijkenis en een homoniem kunnen verwarren, in plaats van de TMDb-video's die direct aan de juiste ID zijn gekoppeld. TMDb (betrouwbare ID) wordt nu eerst geprobeerd; de verrijkte bronnen nemen alleen het over als deze video na enkele seconden echt niet start, om nooit een bevroren preview te laten zonder leesbaarheid.

## v1.24.106 — September 2026

### NX Mobile

- Media profielkaart: hero (achtergrond/video preview) vergroot (300dp → 460dp) en verdonkerend gradiënt verplaatst naar het laatste derde deel in plaats van vanaf het midden — de afbeelding/video bleef te kort zichtbaar voordat deze werd gemaskeerd door de achtergrond, waardoor de kaart weinig meeslepend was.

## v1.24.105 — September 2026

### NX Mobile

- Corrige het afgekorte logo bovenaan het scherm "Profiel toevoegen" (inloggen): de meerkleurige halo van het merk overstak boven zijn vak en werd afgekapt door het scroll-viewport, door gebrek aan marge boven het allereerste element.

## v1.24.104 — September 2026

### NX Mobile

- Iconen platforms op het startscherm: verwijd de witte achtergrond achter elk logo (de TMDb-iconen zijn al gekleurde vierkante iconen, de witte achtergrond was overbodig).
- Permanente paarse gradiëntrand rond de platformiconen en film/serie posters in portretformaat — de witte focusrand voor TV blijft ongewijzigd in landschap/TV.

## v1.24.103 — September 2026

### NX Mobile

- "Platforms" balk op het startscherm: uniforme vierkante iconen (zoals gevraagd) in plaats van de afgeronde stippen met variabele breedte die zijn overgenomen van Ontdekking/TV.

## v1.24.102 — September 2026

### NX Mobile

- Herstelt de schakelaar Suggesties/Bibliotheek in Ontdekking > Films/Series (portret) — per ongeluk verdwenen met de oude 3-weg selector, gaf deze toegang tot het volledige bezit catalogus (2439 films bij de gebruiker), zonder deze was de catalogus niet direct bereikbaar met één tik.

## v1.24.101 — September 2026

### NX Mobile

- Corrige de "Platforms" tegels op het startscherm: inert (geen actie bij tik) en allemaal van uniforme breedte in plaats van hun logo te volgen, zoals op de schets.
- Verplaatst "Volgens je stemming" naar boven op Ontdekking, direct onder de genres, in plaats van helemaal onderaan.
- Herontwerpt het scherm "Alles bekijken" (Platforms/genres/stemming/editoriale rijen) in portret: het had geen header en geen terugknop (pagina blokkeerde na een tik), raster van 2 overdimensionale kaarten per rij — vervangen door de standaard header (merk + avatar) en een 4-koloms raster dat consistent is met de rest van de app. Dezelfde correctie voor de acteurkaart (Cast).
- Corrige de inhoud die verborgen is onder de zwevende balk onderaan de pagina op Ontdekking, Bibliotheek, Downloads en Zoeken.

## v1.24.100 — September 2026

### NX Mobile

- Volledige herontwerp van het smartphone-portret volgens de geleverde UX-mockup: de onderste balk is verminderd tot Home/Ontdekking/Bibliotheek/Downloads (alleen iconen), Profiel en Zoeken zijn nu toegankelijk via de avatar en het zoekveld in de header in plaats van toegewijde tabbladen.
- Startscherm: "Platforms" balk, aparte "Ga je films verder kijken"/"Ga je series verder kijken" rijen, geen hero banner meer in portret (niet voorzien in de mockup).
- Ontdekking: breedbeeld selectie Films/Series met merkverloop, sectie « Een film/serie hervatten ».
- Bibliotheek: wordt een echte ingang voor Watchlist/Geschiedenis/Collecties (in plaats van een alias van de Films/Series catalogus), echte watchlist en geschiedenis, gebruikerscollecties + bezitters TMDb saga's.
- Downloads: tabbladen « Bezig »/« Voltooid » met echte tellers, resterende tijd en weergegeven snelheid, plus een Verversknop.
- Mediafiche: terugknop en zwevende watchlist-toggle op de balk, watchlist daadwerkelijk bidirectioneel (server toevoegen/verwijderen).
- Zoeken: « Acteurs » chip (zoek naar echt persoon), recente sessiezoekopdrachten, Resultaten sectie met toegang tot filters.
- Dynamische update van de onderste balk behouden (5e icoon, verschijnt/verdwijnt afhankelijk van beschikbaarheid).

## v1.24.99 — September 2026

### NX Mobiel

- Herontwerp van de eerste opstart onboarding volgens het mockup: server, account (+ Plex), profielen, synchronisatie, startscherm. Volgende lanceringen starten op « Wie kijkt? », en het toevoegen van een profiel gaat via het inlogscherm voordat het terugkeert naar de profielen.
- Onderste navigatiebalk portret uitgelijnd op het mockup: Ontdekking / Films / Series / Mijn lijst / Profiel, met « Aanbevolen voor u » en « Streamingplatforms ».
- Unieke versie: de 4 APK's lezen nu `package.json` (desktopversie) in plaats van een vaste waarde — geen desynchronisatie meer mogelijk.

### Build

- Gradle-uitlijning: Gradle 8.13, AGP 8.13.2, Kotlin 2.2.21, Compose BOM 2025.08.01, Media3 1.7.1, Navigation 2.9.3 op de 4 Android-modules + CI.

## v1.24.98 — September 2026

### Correcties

- Verbetert de gebroken NX Mobiel compilatie door de fusie v1.24.97: `Border(...)` met positionele argumenten in plaats van benoemde in `DiscoverHubScreen.kt`/`LibraryHubScreen.kt`, en een dubbele declaratie van `SearchTypeFilter` in `SearchScreen.kt` (twee verschillende schermen hadden elk hun eigen omschrijving van dezelfde naam) — hernoemd naar `PortraitSearchTypeFilter` voor het portret zoekscherm.

## v1.24.97 — September 2026

### Ontdekking (web)

- Herontwerp van het desktop Ontdekking blok volgens het schets: hero met 3 echte acties (Nu kijken / Mijn lijst / Trailer), sectie « Uw streamingplatforms » verhoogd direct onder de hero met de echte merk-kleuren, platformbadge op de kaarten van rijen die daadwerkelijk bij een platform horen.

### NX Mobiel

- Uitlijning van de mobiele navigatie en de inloggegevens via Plex OAuth.
- Echte launcher-iconen per dichtheid (mdpi tot xxxhdpi) op de 4 Android-apps, vervangen de adaptieve XML-iconen.

## v1.24.96 — September 2026

### Correcties

- NX Mobiel portret, Ontdekking scherm: de « Volgens uw stemming » chips waren te klein om comfortabel te tikken (opgemerkt in echt testen) — aanraakdoel vergroten naar minimaal 44dp.
- De rijen Genres/Platforms/Studio's/Volgens uw stemming gebruikten een vaste marge van 52dp geërfd van de TV in plaats van de 16dp van de rest van de portretinhoud — dezelfde correctie als de Distributie rij van de titelfiche (v1.24.95), ze volgen nu dezelfde marge.

## v1.24.95 — September 2026

### Correcties

- Corrige de uitlijning van de rij "Distributie" op het titelkaartje NX Mobile portret: het gebruikte een vaste marge van 48dp in plaats van de 16dp van de rest van het kaartje (titel, knoppen, Vergelijkbare titels), waardoor het zichtbaar naar rechts verschoof.

## v1.24.94 — September 2026

### Correcties

- Verbetert de gebroken NX Mobile compilatie door de redesign v1.24.93 (verkeerde benoemde parameters op `Border(...)` en een niet-bestaande `Modifier.padding()` overload) — er kon geen APK voor v1.24.93 worden gegenereerd.

## v1.24.93 — September 2026

### NX Mobile

- Echte structurele redesign van het portrettelefoon (niet alleen kleuren): permanent header met altijd zichtbare zoekbalk (het oude portret toonde geen header), segmentatieknoppen Ontdekking/Films/Series, echte filters Genres/Stemming/Duur/Platforms, hero-kaart met afgeronde hoeken met beoordelingsbadge en dubbele Weergeven/Trailer knop, "Volgens je stemming" chips in dunne pastilles, heropgebouwde Zoekscherm (permanente balk, type-knoppen, Suggesties, Trending, resultaten in lijst).
- Navigatie onderaan met 5 tabbladen en update badge ongewijzigd.

## v1.24.92 — September 2026

### NX Mobile

- Visuele redesign van de NX Mobile app: kleurenpalet afgestemd op de rest van Movviz (paars/void/abyss), actieve chips in merkverloop op filters en inhoudselector, donkerdere navigatie-dock.
- Nieuwe sectie "Volgens je stemming" op Ontdekking: snelle toegang tot genres per stemming (avontuur, ontspanning, spanning, emotie, lachen, inspiratie). Navigatie met 5 tabbladen en update badge ongewijzigd.

## v1.24.91 — September 2026

### Correcties

- Corrigeert "Actieve sessies": het afspelen van een lokale aflevering opende nooit een tracking-sessie (het was alleen afhankelijk van de Plex-duur), dus verscheen het nooit in het paneel — ongeacht het apparaat of de app (mobiel, NX Mobile, TV, NX TV).
- Het splashscreen logo laadde te laat (na JS-hydratatie); het wordt nu vooraf geladen vanaf de initiële HTML.
- Verfijnt de portret navigatie-dock van NX Mobile: de update indicator duwt de balk niet meer omhoog en is geen ondoorzichtig vlak meer.

## v1.24.90 — September 2026

### Visuele identiteit

- Nieuw Movviz mark (kruispaars/roze lint) op het hele platform, vanaf de officiële bestanden: web sidebar, favicon/PWA, adaptieve Android iconen (mobiel, NX Mobile, TV, NX TV), Android TV banners, Windows icoon en Docker icoon.
- Nieuwe desktop en Android NX splashscreens met de volledige lockup (mark + "Movviz"), met prioriteit geladen.

## v1.24.89 — September 2026

### NX Mobile en NX TV

- Een kaart geopend vanuit Opnieuw bekijken lost nu voorrangig de lokale bibliotheekitem op voordat het zijn acties weergeeft. Een reeds geïndexeerd bestand stelt dus nooit meer "Toevoegen aan bibliotheek" voor tijdens het laden; Plex blijft optioneel.

## v1.24.88 — September 2026

### NX Mobile en NX TV

- Scheidt expliciet de kaarten voor opnieuw bekijken van recent toegevoegde afleveringen: alleen de eerste kunnen "Opnieuw bekijken", een voortgang en een herbekijk-thumbnail weergeven; recente afleveringen tonen alleen hun badge `Sxx · Exx`.
- Herstructureert de portret navigatie-dock van NX Mobile: zwevend, gecentreerd, compact, met vloeiende expansie en vervaging van het actieve tabblad; de inhoud reserveert nu de benodigde ruimte onder de laatste rij.

## v1.24.87 — September 2026

### NX Mobile en NX TV

- Corrige de overgang naar de volgende aflevering: het nieuwe medium wordt daadwerkelijk geladen, de overgeslagen aflevering wordt afgesloten en blijft niet in Herstart.
- Bij het verlaten van een speler of het naar de achtergrond brengen van de app, stopt het audio en wordt de positie behouden. De openingen en eindes van de afspeelvideo creëren geen herstart meer.
- Afleveringsherstarts tonen nu de afbeelding van de aflevering, het serie-logo en het badge `S03 · E10`; films behouden hun omslag.
- Herziet de portretnavigatie van NX Mobile: lage capsule met expliciete iconen, label alleen op het actieve tabblad, Ontdekbaar beschikbaar, naam van het actieve profiel en discrete update-shortcut.

## v1.24.86 — September 2026

### NX Mobile en NX TV

- Voegt de speciale Downloads-pagina toe, live gevoed door de serverwachtrij.
- Maakt de afspeelbalk echt aanraakbaar: tikken op een track zoekt onmiddellijk op de gekozen positie.
- De kaarten behouden hun levende downloadstatus en schakelen over naar Afspelen zodra het medium beschikbaar is.

## v1.24.85 — September 2026

### Movviz NX Mobile

- Past de portret smartphone-interface aan zonder de TV/landschapsweergave te wijzigen: compacte balk met actie-menu, dichtere startpagina, leesbare catalogus, hergemaakte kaarten en afleveringen.
- Corrigeert teksten en marges van profielen, profielkiezer, Plex-verbinding en instellingen op kleine schermen.
- Stelt de vier Android-kanalen en het webpakket op dezelfde release-omgeving.

## v1.24.84 — September 2026

### NX Mobile — aanraakacties op voorgrond

Repareert de overlappende acties van NX Mobile: de tabbladen Home/Series/Films/Profiel, zoeken, instellingen, profielwissel en update-signaal vangen nu expliciet de aanraking op naast de D-pad. De afspeelbesturing behoudt dezelfde aanraakverwerking.

## v1.24.83 — September 2026

### Movviz NX Mobile — directe poort van NX TV

Vervangt de eerste NX Mobile-basis door de code `android-tv-nx`: dezelfde lokale-eerst start, geïsoleerde cache per server/account/profiel, Plex-profielen, NX-home, Films/Series-hubs, kaarten, seizoen/afleveringspagina's, speler, update en D-pad beschermingen. De aanraakpoort behoudt deze gedragingen in plaats van de oude mobiele app te hervatten.

Het pakket blijft `com.movviz.nx.mobile`, het update-asset blijft `Movviz-NX-Mobile-client.apk` en de retail-handtekening is ongewijzigd. De activiteit is schaalbaar op telefoon, tablet en Fold; de NX-balk wordt scrollbaar bij aanraking op compacte schermen terwijl alle toegang behouden blijft. Het M-logo wordt toegepast bij het opstarten en navigeren.

## v1.24.82 — September 2026

### Movviz NX Mobile — nieuw onafhankelijk kanaal

Voegt `Movviz NX Mobile` (`com.movviz.nx.mobile`) toe: een onafhankelijke aanraak Android-applicatie van Movviz Mobile en NX TV, ondertekend met dezelfde retail-sleutel. Het behoudt de profielen, herstarts, de speler, de home en de automatische update van Movviz, terwijl het zijn eigen gegevens en eigen release-asset (`Movviz-NX-Mobile-client.apk`) behoudt.

De interface past zich aan telefoons, tablets en vouwbare apparaten aan: schaalbare activiteit, profielkiezer van 2/3/4 kolommen afhankelijk van de breedte, adaptief bibliotheekraster en formulieren gecentreerd op grote schermen. Het NX-icoon wordt gebruikt als Android-icoon.

## v1.24.81 — September 2026

### Movviz NX — lokale-eerst voltooid startpagina

De NX-startpagina publiceert nu een unieke snapshot per P0/P1 golf: de lokale inhoud wordt onmiddellijk weergegeven, waarna de servergegevens de gehele set consistent vervangen zonder cascade van herberekeningen of focusverlies. De rendering van het eerste viewport wordt bevestigd voordat het secundaire werk wordt gestart; de downloadwachtrij, aanbevelingen en externe metadata blijven op de achtergrond.

In afwezigheid van cache toont het voorbereeningsscherm een voortgang die gekoppeld is aan de daadwerkelijk doorlopen stappen. Bij een onbeschikbare server blijft de laatste geldige startpagina van dezelfde server, account en profiel bruikbaar met een subtiele offline-indicatie, zonder nutteloze fallback-aanvragen te herhalen. De voorlading is beperkt tot nabije posters en de enige gefocuste achtergrond; Coil maakt expliciet gebruik van zijn gedeelde lader.

## v1.24.80 — September 2026

### Correctie retail Android

Repareert de retail sleutel-vingerafdrukcontrole in Android-workflows. TV-, NX- en mobiele builds weigeren nog steeds elke andere sleutel, maar lezen nu correct de vingerafdruk die door `keytool` wordt geretourneerd. Versie `1.24.80` (`124080`) vervangt de release v1.24.79 waarvan de CI werd gestopt vóór de publicatie van de APK.

## v1.24.79 — September 2026

### Movviz NX — lokale-eerst opstarten en veilige retail release

De NX-startpagina restaureert nu onmiddellijk de laatste lokale staat, strikt geïsoleerd per server, account en profiel, en reconcilieert vervolgens de bibliotheek, herhalingen en aanbevelingen op de achtergrond. De keuze van een reeds bekend profiel wordt niet langer geblokkeerd door netwerklatentie; de sessie wordt echter wel op de achtergrond gevalideerd en een ongeldige sessie stuurt terug naar de login.

De downloadwachtrij start pas na het eerste viewport en wordt bij elke profielwijziging geannuleerd. De `TV-PERF` logs maken het mogelijk om de daadwerkelijke opstartstappen te meten.

De Android CI vereist nu de Movviz retail sleutel en controleert deze vingerafdruk: het faalt in plaats van een APK te publiceren met een tijdelijke sleutel. De drie APK's delen dezelfde `versionCode` afgeleid van de tag (`124079`), wat het automatische updatepad herstelt.

## v1.24.78 — September 2026

### Google TV kanalen — Movviz TV en Movviz NX

Android TV-apps publiceren nu hun Movviz-kanaal en hun systeemrij "Doorgaan met kijken" op het Google TV-startscherm. De officiële AndroidX TV Provider-afhankelijkheid wordt gedeeld door Movviz TV en Movviz NX zodat beide kanalen consistent blijven.

## v1.24.77 — September 2026

### Movviz NX — Startpagina blokkeert niet langer de afstandsbediening

Vroeger kon het drukken op omlaag vanaf de navigatiebalk zonder effect blijven totdat het dashboard klaar was met laden, wat dwong om via Films of Series te gaan om naar beneden te scrollen. Het focusdoel is nu beschikbaar vanaf het eerste getoonde beeld, nog voordat de gegevens arriveren.

## v1.24.76 — September 2026

### Movviz NX — Films en Series worden echte hubs

Elk Films- en Series-universum heeft nu zijn eigen hub met een compacte Suggesties/Bibliotheek-schakelaar, zonder ooit nog de twee intenties of de twee catalogi te mengen. De startpagina wordt verrijkt met dezelfde redactionele rijen als Films/Series, inclusief nieuwigheden en suggesties per platform, in een feed die films en series mengt als een echte streamingdienst. Corrigeert tevens een echt focusdefect dat willekeurig kon springen bij de overgang naar de Bibliotheek.

## v1.24.75 — September 2026

### Ontdekking — leesbare platforms en verfijnde rangschikking

De logo's van platforms en studio's in Ontdekking (Films/Series) zijn nu altijd zichtbaar, inclusief Disney+ en Canal+ die op een donkere achtergrond onleesbaar waren — elk logo rust nu op een duidelijke badge, net als op de website. De rangschikking van de rijen "Suggestie {platform} voor u" is verfijnd: de paar titels bovenaan profiteren nu van een toegewijde toonanalyse in plaats van alleen te vertrouwen op een reeds gecacheerde analyse, voor een sortering die nauwkeuriger is voor de werkelijke smaak van elk profiel.

## v1.24.74 — September 2026

### Ontdekking — nieuwigheden en suggesties per platform, gescheiden

Elk platform (Netflix, Disney+, Prime Video) in Ontdekking toont nu twee afzonderlijke rijen: "Nieuwigheden {platform} voor u", strikt gesorteerd op releasedatum, en "Suggesties {platform} voor u", uitsluitend gesorteerd op uw smaak (genres, geschiedenis, beoordelingen) zonder rekening te houden met de releasedatum. De "Bekijk alles" van beide rijen scrollt zo ver als het daadwerkelijke catalogus van het platform toelaat. Movviz NX krijgt dezelfde indeling op zijn eigen Ontdekking-scherm.

## v1.24.73 — September 2026

### Movviz NX — navigeerbare seizoenen en afleveringen

De pagina gewijd aan een seizoen gebruikt nu een daadwerkelijk scrollbare lijst op de D-pad: zelfs een lang seizoen houdt alle afleveringen toegankelijk, zonder dat de rijen van grootte veranderen bij focus. Het bovenste gebied bevindt zich onder de navigatiebalk, elke aflevering behoudt een miniatuur (met visuele vouw indien TMDb deze niet verstrekt) en het vinkje "bekeken" blijft rechts gereserveerd. De Movviz- en Plex-bronnen volgen nu eindelijk dezelfde regel om de afspeelactie van een aflevering weer te geven. De aanbevelingen per platform behouden een aparte cache per profiel, type en ontdekkingsland.

## v1.24.72 — September 2026

### Ontdekking — nieuwigheden Netflix, Disney+ en Prime Video voor u

Ontdekking (Films en Series) toont nu "Nieuwigheden Netflix voor u", "Nieuwigheden Disney+ voor u" en "Nieuwigheden Prime Video voor u": de catalogi van deze platforms worden voorgesteld gesorteerd op uw eigen smaak (genreaffiniteit, geschiedenis, beoordelingen) in plaats van op algemene populariteit — twee accounts zien hetzelfde Netflix-katalogus, maar in een andere volgorde. De "Bekijk alles" en de paginering behouden deze persoonlijke rangschikking. De platformiconen onderaan Ontdekking blijven ongewijzigd. Movviz NX krijgt dezelfde verrijking op zijn eigen Ontdekking-scherm, met de rijen van Platform- en Studio-logo's onderaan het scherm.

## v1.24.71 — September 2026

### Movviz NX — seizoenen op volledig scherm

Het kiezen van een seizoen op een seriekaart NX opent nu een toegewijd scherm, in plaats van een lijst met afleveringen uit te klappen midden op de kaart: de seriekaart blijft een duidelijk overzicht, en de lijst met afleveringen profiteert van de volledige ruimte met een eenvoudige D-pad navigatie, terug sluit precies dit niveau voordat de kaart wordt verlaten. De afleveringsrijen behouden nu een vaste geometrie (miniatuur, titel, "bekeken" vinkje) zodat de lay-out nooit verandert bij focus.

## v1.24.70 — September 2026

### Movviz NX — daadwerkelijk beschikbare voorbeelden

Videovoorbeelden zijn opnieuw toegestaan op Android TV's en emulators met minder dan 2 GB totaal geheugen, zolang het vrije geheugen veilig blijft. De kaarten gebruiken dezelfde voorbeeldenpipeline als de kaarten, de navigatievergrootglas is opnieuw ontworpen, het "Herhalen" badge belemmert de posters niet meer en elke distributiekaart krijgt een ondoorzige tekstbasis om leesbaar te blijven op lichte portretten.

## v1.24.69 — September 2026

### Movviz NX — navigatie- en profielafwerking

De Android TV NX navigatie krijgt consistente iconen, leesbaardere focusstaten en een direct invoerbare zoekfunctie op de D-pad. De kaarten keren terug naar een zichtbaar focuspunt, de afleveringstitels blijven leesbaar, en het profieldashboard haalt ontbrekende posters op uit de mediabibliotheek of metadata om lege kaarten te voorkomen.

## v1.24.68 — September 2026

### Movviz NX — toegankelijke zoekopdrachten en updates

De NX navigatie toont nu Instellingen, met de activatie van automatische zoekopdrachten en de verplichte controle van updates. Wanneer een release wordt gedetecteerd, verschijnt een updatepijl in de balk en start deze de installatie na bevestiging. De zoekopdracht toont en focust opnieuw op het invoerveld bij het openen.

## v1.24.67 — September 2026

### Movviz NX — voorkeursstartpunt

De profielkiezer wordt nu systematisch weergegeven bij het opstarten wanneer er minstens één profiel beschikbaar is op de server, ongeacht het profiel van het laatst actieve account. De detectie van updates blijft automatisch; na de eerste Android-autorisatie om onbekende apps te installeren, kan de installatie doorgaan zonder ingrijpen.

## v1.24.66 — September 2026

### Movviz NX — Plex-profiel en recente afleveringen

Het Plex-avatar van het actieve profiel wordt nu weergegeven in de bovenste badge en opent de profielkiezer. Het NX-dashboard voegt een rij toe met daadwerkelijk toegevoegde afleveringen, onafhankelijk van herhalingen, strikt gesorteerd van meest recent links naar meest oud. Het profieldashboard reserveert ook een veilige zone onder de navigatie en gebruikt posterkaarten die op afstand leesbaar zijn.

## v1.24.65 — September 2026

### Movviz NX — Android TV en autonome kanaalrelease

Movviz NX ontvangt zijn toegewijde retail APK, ondertekend met dezelfde sleutel als Movviz TV, maar gepubliceerd als een afzonderlijk GitHub-asset. Zijn update- en automatische installatiesignaal kunnen Movviz TV dus nooit vervangen. De NX-header volgt nu het Netflix-gedrag: hij blijft transparant bovenaan de hero en wordt alleen vaag wanneer de rijen onder de navigatie komen, zonder de D-pad paden te wijzigen. De identiteiten zijn ook gescheiden: een cirkelvormig icoon voor de app, het merk "M" in de interface.

## v1.24.64 — September 2026

### Mobiele bibliotheek Films en Series in Plex-stijl

Elk tabblad Films of Series heeft nu drie verschillende weergaven: **Aanbevolen**, met herhalingen gevolgd door posterrijen; **Bladeren**, een lokale dichte rasterweergave met zoeken, sorteren en genres; en **Collecties**, rijen per bibliotheekuniversum. Recent toegevoegde afleveringen verschijnen in Aanbevolen van Series met hun poster, hun serie en `Sxx · Exx`.

## v1.24.63 — September 2026

### Mobiel dashboard gecentreerd op herhalingen

De grote "Hoogtepunten"-kaart is verwijderd van het smartphone-dashboard. Herhalingen blijven de eerste rij na de header, gevolgd door recent toegevoegde afleveringen, en daarna de bibliotheek en ontdekkingen. Het toevoegen van een rij kan "Herhalen" niet meer verplaatsen of vervangen.

## v1.24.62 — September 2026

### Recent toegevoegde afleveringen op het mobiele dashboard

Het smartphone-dashboard toont nu een speciale rij met afleveringen die daadwerkelijk als laatste in de bibliotheek zijn gearriveerd, of ze nu van een Plex-import of van Movviz komen. Elk kaartje behoudt de serie, de afleveringstitel en zijn referentie `Sxx · Exx`, en opent direct de seriepagina. Deze rij is gescheiden van herhalingen en weergaven: het beschrijft de beschikbare bestanden, zonder de geschiedenis van een ander profiel bloot te leggen.

## v1.24.61 — September 2026

### Plex-weergaven strikt geïsoleerd per profiel

De synchronisatie van Plex-weergaven lost nu systematisch het Plex-profiel op dat via API is gekoppeld aan zijn lokale Plex-serveraccount voordat het de geschiedenis leest. In geval van twijfel wordt de import geweigerd: geen weergave van een ander profiel kan worden toegevoegd of verwijderd. Het openen van Movviz triggert ook een verse, profielbeperkte synchronisatie, in plaats van te wachten op de achtergrondcyclus. De markeringen die in Movviz zijn gemaakt, worden nog steeds alleen naar dit specifieke Plex-profiel gestuurd.

## v1.24.60 — September 2026

### Persoonlijk mobiel dashboard en Movviz-handtekening

Het mobiele dashboard onderscheidt nu duidelijk wat er al in het profielbibliotheek bestaat en welke titels te ontdekken zijn: de eerste rij mengt daadwerkelijk beschikbare films en series, waarna de persoonlijke aanbevelingen werken die al bezeten, bekeken of geweigerd zijn. Een compact Movviz-symbool verankert ook de pagina, in de geest van de Plex-handtekening, zonder de ruimte voor de inhoud te verminderen.

## v1.24.59 — September 2026

### Mobiele herhalingen en reparatie van series

Het startscherm neemt vanaf nu de geünificeerde herstartlijst bij elke terugkeer in het tabblad en behoudt de mix van films/series, gesorteerd op datum en laatste bekeken tijd. Ontdek gebruikt dezelfde bron in zijn aparte tabbladen Films en Series. Mobiele afspelen haalt ook oude lokale afleveringen zonder bronveld, zonder een Plex-aflevering naar de lokale bron te leiden.

## v1.24.58 — September 2026

### Gesynchroniseerde weergaven, aflevering voor aflevering

De acties "bekeken / niet bekeken" zijn nu beschikbaar op Android mobiel en Android TV op het niveau van de film, de aflevering, het hele seizoen en de hele serie. Ze schrijven het unieke profiel-tracking van Movviz en propageren de wijziging naar Plex wanneer een Plex-media is gekoppeld. Toekomstige afleveringen zijn opzettelijk uitgesloten: wanneer een seizoen voorbij is, is alleen de eerste beschikbare aflevering van het volgende seizoen de herstart.

## v1.24.57 — September 2026

### Startscherm en Android mobiele updates

Het mobiele startscherm neemt de redactionele rijen van de TV over (persoonlijke selectie, korte formats, trends, recente toevoegingen en aankomende releases), altijd per profiel en met de herstarts bovenaan. Een gedetecteerde release wordt nu zonder onderbreking gemarkeerd met een pulserende pil en een badge in de navigatie; de installatie begint pas na bevestiging.

## v1.24.56 — September 2026

### Android mobiele APK uitgebracht

De marge van de titel van de herstartrij gebruikt nu de juiste Compose-overload; de CI kan de smartphone APK finaliseren en deze koppelen aan de release.

## v1.24.55 — September 2026

### Android mobiele publicatiecorrectie

De Kotlin-compilatie van het Android mobiele startscherm is gecorrigeerd; de releaseversie kan opnieuw worden geproduceerd en gepubliceerd.

## v1.24.54 — September 2026

### Geünificeerd Android mobiel startscherm

Android mobiel ontvangt een echt Startscherm-tabblad: de "Doorkijken"-herstarts komen bovenaan, gevolgd door de hero en de bibliotheekrails. Deze rij consumeert exact de geünificeerde route per gebruiker die al wordt gebruikt door web en Android TV; de voortgang, de volgende aflevering en de Plex/Movviz-volgorde blijven dus identiek op de drie platforms.

## v1.24.53 — September 2026

### Plex echt additioneel en dichte TV-catalogi

De herstarts in Plex zijn niet langer afhankelijk van een voorafgaande link naar de Movviz-bibliotheek: hun TMDb-identificatoren en visuels worden direct opgelost en vervolgens samengevoegd met de Movviz-herstart op basis van identiteit en werkelijke datum. Films, Series en de "Alles bekijken" Android TV-schermen gaan over op een vaste, dichte en stabiele rasterlay-out in 1080p/4K, met compactere besturingselementen en zonder vergroting bij focus.

## v1.24.52 — September 2026

### Echt geünificeerde herstarts en gestabiliseerd TV-startscherm

De unieke "Doorkijken"-route gebruikt nu een gemeenschappelijke Movviz/Plex-klok en sorteert elke herstart op zijn werkelijke kijkdatum. Plex kan onmiddellijk de eerste aflevering van het volgende seizoen leveren zonder te wachten op een lokale historische synchronisatie; alleen de eerste reeks voorgesteld door Plex wordt behouden. Een Plex-herindexatie van een aflevering wordt ook opgelost per serie + seizoen + aflevering. Op Android TV blijven de posters vast in portret bij focus, zonder landschaps-croppen of rijverschuiving; de herstarts behouden hun leesbare voortgangsbalk en het startscherm blijft dicht in 1080p/4K.

## v1.24.51 — September 2026

### Android TV — prioritaire herstarts en gekalibreerde woonkamerkaarten

De rij "Doorkijken" wordt altijd bovenaan geplaatst zodra er een herstart bestaat, zelfs als een oudere dashboardindeling deze verbergde. De kaarten op het startscherm krijgen proporties die geschikt zijn voor een TV-scherm: de selectie opent in landschap zonder de hele rij te vervangen. De herstarts vullen nu het Plex-beeld aan met de Movviz-achtergrond zonder tekst wanneer deze beschikbaar is.

## v1.24.50 — September 2026

### TV — algemeen logo en gecorrigeerd navigatieraster

Het principe toont portret zonder logo in rust / officieel logo apart bij focus wordt nu uitgebreid naar Ontdekking, vergelijkbare titels, de filmografie van een acteur, evenals de volledige catalogus en de "zie alles" raster (waarbij de kaart in portret blijft staan in plaats van te openen in panorama, een verticale raster kan niet groeien zonder zijn buren te verschuiven). De teksttitel verdwijnt waar dit logo wordt weergegeven; het blijft discreet ingeklapt op de rasters wanneer er geen TMDb-logo beschikbaar is. Het laden van logo's is beschermd tegen netwerkdubbele invoer. De uitgeschoven zijbalk navigeert nu eindelijk zijn tabbladen op één rand in plaats van te zweven op verschillende breedtes.

## v1.24.49 — September 2026

### TV — directe toegang tot profiel en startschermthema

Op Android TV is het profiel nu direct toegankelijk via een snelkoppeling vanaf de navigatiebalk, zonder via het accountselectiescherm te hoeven gaan. Het startscherm en het visuele thema zijn bijgewerkt voor meer consistentie. Bovendien worden prijsceremonies (Oscars, Césars, Golden Globes...) en non-fictie content die door catalogi als "series" worden opgenomen (nieuws, talkshows, reality-tv) nooit meer als suggesties getoond, ongeacht hun bron.

## v1.24.48 — September 2026

### Geünificeerde Plex en Movviz voortgang

De voortgang wordt nu één keer per gebruiker berekend voor web, profiel en Android TV. Plex blijft optioneel: zijn posities en geschiedenis vullen de Movviz gegevens aan zonder ze ooit te vervangen. Plex-weergaven worden met hun werkelijke datum opgeslagen in de gezamenlijke tijdlijn, die Plex- en Movviz-afspeelmomenten correct ordent. Voor series wordt alleen de allereerste onbekeken aflevering getoond: na een afgeronde seizoen 4 verschijnt seizoen 5 aflevering 1; seizoen 6 wacht op de volledige afronding van seizoen 5. Stoppen tijdens de credits markeert ook onmiddellijk het medium als bekeken en synchroniseert het naar Plex wanneer dit is aangesloten.

## v1.24.47 — September 2026

### Onafhankelijke profielen op TV en mobiel

Android-profielen worden nu uitsluitend op het apparaat opgeslagen, per Movviz-account en per server. Een oninstallatie herstelt niet langer de profielen van een ander apparaat of huishouden, en de Plex-sessie van een gebruiker kan niet langer die van een andere vervangen.

## v1.24.46 — September 2026

### Afleveringswatchlist en optioneel Plex

Toevoeging van Watchlist-acties per aflevering in de seriegegevens en extra beveiligingsmaatregelen: Plex-servertaken worden correct genegeerd wanneer Plex niet is geconfigureerd, zonder het lokale mediaprofiil te verstoren.

## v1.24.45 — September 2026

### Gebruikerssynchronisatieoverdracht

Watchlist en watched mutaties tonen nu hun capaciteit en transportklok, met LWW-resolutie en behoud van de geschiedenis bij overgang naar onbekeken.

## v1.24.44 — September 2026

### Plex convergentie van notities en voortgang

Lokale notities worden in de achtergrond gesynchroniseerd naar Plex en de externe voortgang respecteert nu de LWW-timestamp in plaats van mechanisch de grootste waarde te verkiezen.

## v1.24.43 — September 2026

### Geünificeerd mediaprofiil en Plex synchronisatie

Toevoeging van het gedeelde mediaprofiil, LWW-resolutie per veld, Watchlist met afleveringen en tombstones, profiel-API's en Android TV-koppeling. Plex blijft optioneel en triggert geen automatische acquisitie.

## v1.24.42 — September 2026

### Android TV — voortgang, ondertiteling, genres en beheerde update

Android TV krijgt een echt dynamische hervatting bij het terugkeren van de speler (`Herstart bij HH:MM:SS`), standaard uitgeschakte ondertiteling met geheugen per profiel en media, de correctie van de categoriefiltrering die ten onrechte TMDb-ID's vergeleek met genre-namen, een volledige verwijdering van gepersonaliseerde gegevens bij een profielwissel, een levendigere focus en een knipperende updatepijl in de zijbalk. Automatische updates kunnen niet meer starten tijdens navigatie of afspelen: alleen het korte opstartvenster staat auto-installatie toe; daarna triggert de gebruiker de installatie expliciet vanuit de indicator.
### Uitgaveversies op één lijn

De referentieversie is nu hetzelfde in het webpakket, het lockfile, het README-badge en de mobiele en TV Gradle-configuraties: `1.24.42` (`versionCode` `12442`). CI-builds behouden de afleiding van de release-tag.

## v1.24.41 — September 2026

### Android-uitgave gerepareerd

De Android mobiele en TV pipelines gebruiken nu de huidige versie van de SDK-buildtool, die direct Android 35 en de build-tools 35.0.0 installeert. Het genereren van de publicatie-APK werkt weer.

## v1.24.38 — September 2026

### Geen documentaires en making-of meer in suggesties

TMDb mengt regelmatig documentaires en making-of in `/recommendations`, `/similar` en zelfs de filmografie van een favoriete acteur — de AI-chat sluit deze al uit, maar niet "Suggesties voor u" of "Omdat u bekeken heeft", die ze nog steeds aanbieden ondanks herhaalde 👎 op dit genre. Genre-affiniteit sluit nooit een heel genre uit (het vermindert alleen de score), dus dit was niet voldoende. Het genre Documentaire is nu een harde regel, toegepast in het gedeelde filter van alle suggestierijen: prioriteit voor de film en de serie, geen documentaire meer slipt erin. Handmatige zoekopdrachten zijn niet van toepassing — een expliciet gezochte documentaire blijft vindbaar.

## v1.24.37 — September 2026

### Acteur/regisseur-affiniteit stuurt eindelijk de echte "Suggesties voor u"-rij

De acteur/regisseur-affiniteit toegevoegd in v1.24.36 voerde alleen het gesprek met de AI, niet de "Suggesties voor u"-rij zelf — vijf sterren geven aan twee films van Jim Carrey, of ze gewoon meerdere kijken zonder ooit te beoordelen, liet niets anders van hem in de suggesties verschijnen. Het stuurt nu ook deze rij: de volledige filmografie van de 3 favoriete acteurs/regisseurs (berekend op basis van beoordelingen, 👍/👎 stemmen EN het simpelweg vaak opnieuw bekijken van dezelfde acteur, zonder expliciete beoordeling) wordt via TMDb opgehaald en in het kandidaatpool ingebracht, gepromoveerd op hetzelfde niveau als genre-affiniteit ≥95 % — een directe match op de acteur komt zelfs voor.

## v1.24.36 — September 2026

### Nieuwe acteur/regisseur-affiniteit — "Ik hou van Jim Carrey" telt nu op zichzelf

De berekende genre-affiniteit (views, beoordelingen, stemmen, verzoeken) koppelt nooit een beoordeelde titel aan ZIJN ACTEURS — vijf/5 geven aan twee films van Jim Carrey versterkte alleen "Comedy" in het algemeen, niets bracht zijn ANDERE films bij elkaar. Een nieuwe acteur/regisseur-affiniteit, gebouwd op expliciet beoordeelde of gestemde titels 👍/👎 (nooit de volledige kijkgeschiedenis, om snel te blijven), vult het genre aan: "begeert particuliere Jim Carrey als acteur" wordt een feit dat de AI direct kent en kan hergebruiken om zijn andere films voor te stellen. Voedt momenteel het gesprek met de AI (generatie van aanbevelingen en knop "Context creëren"), nog niet de pure TMDb-rangschikking van "Suggesties voor u".

## v1.24.35 — September 2026

### "Suggesties voor u" — series te snel op, en duim omhoog nu ook dynamisch

Het TMDb-katalogus "aanbevelingen" voor series is aanzienlijk armer dan dat voor films — na enkele 👎 had de seriebalk vaak geen vervanger meer om voor te stellen (de kaart verdween zonder dat iets op zijn plek nam), terwijl de filmbalk nooit op dezelfde manier leegliep. Een tweede TMDb-bron ("vergelijkbaar", gebaseerd op inhoud in plaats van op de gewoonten van andere gebruikers) vult nu de eerste aan voor beide typen. Een duim omhoog herrekent nu ook de balk, net als een duim omlaag — een beoordeling kan andere titels weer naar boven brengen.

## v1.24.34 — September 2026

### Minimale jaartal van carrousels — twee verschillende oorzaken van te oude titels

De hero op de startpagina selecteerde een klein aantal kandidaten (ongeveer 6) en filterde vervolgens op jaar — wanneer een groot deel van deze kandidaten onder het minimale jaar viel, vulde het vrijwillig aan met de uitgesloten titels in plaats van een onvolledige hero te tonen, wat meerdere titels vóór de ingestelde limiet kon laten zien. Het pool van kandidaten is nu veel breder vanaf het begin wanneer een minimaal jaar wordt gedefinieerd, zodat het filter echte recente kandidaten heeft om vast te houden zonder ooit deze fallback nodig te hebben. De "Suggesties voor u"-balk op de Films/Series-pagina's raadpleegde deze instelling helemaal niet — ook gecorrigeerd.

## v1.24.33 — September 2026

### De AI toonde ruwe JSON in plaats van te beoordelen — en beoordeelde in werkelijkheid niets

Bij een batchbeoordelingsverzoek ("geef alle Dragon Ball 5 sterren") antwoordde de assistent soms met een ruwe JSON-blok die zo in het gesprek werd weergegeven, bovendien registreerde het NIETS, ondanks een zelfverzekerde toon ("genoteerd!"). Het model gebruikte een onerkend formaat in plaats van de intern verwachte marker — nu erkend en daadwerkelijk toegepast, met een eigen bevestiging in plaats van JSON. Titels genoemd in een gesprek vóór deze update zijn niet beoordeeld: u moet de AI opnieuw vragen voor die.

## v1.24.32 — September 2026

### Naar Profiel gaan leidde altijd naar een zoekopdracht — de echte oorzaak deze keer

De vorige correctie (annuleren van een uitstaande zoekopdracht) loste een echte bug op, maar niet deze: de melding bleef bestaan zelfs na een volledige herlading van de URL /profile, wat elke React-status uitsloot. De echte oorzaak: het wachtwoordbeheer van de browser koppelt een veld "huidig wachtwoord" aan een nabijgelegen veld "gebruikersnaam" om automatische aanvulling voor te stellen — het wachtwoordwijzigingsformulier van het profiel heeft geen dergelijk veld in de buurt, dus de browser koos het enige andere zichtbare tekstveld op de pagina: de algemene zoekopdracht (altijd bovenaan weergegeven), die het invulde met de opgeslagen gebruikersnaam en vervolgens verzond. Een gebruikersnaamveld richt nu correct op dit mechanisme, en de zoekopdracht is expliciet uitgesloten van automatische aanvulling.

## v1.24.31 — September 2026

### "Context creëren" (profiel) negeerde beoordelingen en berekende genreaffiniteit

De knop "Context creëren/Hergenereren" van het profiel synchroniseerde de bibliotheek al naar het SQL-logboek op de achtergrond, maar de tekst die daadwerkelijk naar de AI werd gestuurd om de context te synthetiseren, bevatte noch de 1-5 sterrenbeoordelingen, noch de reeds berekende genreaffiniteit (views, stemmen, beoordelingen, verzoeken) — alleen de bekeken titels, verzoeken en ruwe 👍/👎 stemmen. Beide ontbreken nu, zowel voor handmatige reconstructie als voor automatische achtergrondupdates (die nu ook worden getriggerd door een nieuwe beoordeling, niet alleen door een weergave/verzoek/stem).

## v1.24.30 — September 2026

### Klikken op Profiel leidde naar een zoekopdracht met de gebruikersnaam

Tikken in de zoekbalk en direct op "Profiel" klikken opende inderdaad het profielkaartje, maar werd ~300ms later gevolgd door een stille terugkeer naar `/discover?q=<pseudo>`: de zoekbalk (bovenbalk/zijbalk) wordt nooit tussen twee pagina's verwijderd (de app-chrome blijft zichtbaar, alleen de inhoud verandert), dus de uitgestelde zoekopdracht die door de vorige tik werd ingepland, bleef actief en voerde uiteindelijk uit, waardoor de reeds uitgevoerde navigatie werd overschreven. Elke wachtende uitgestelde zoekopdracht wordt nu geannuleerd zodra er een navigatie plaatsvindt.

## v1.24.29 — September 2026

### "Suggesties voor u" raadpleegt nu de berekende genreaffiniteit

De engine achter de rij "Suggesties voor u" (TMDb-kandidaten) raadpleegde nog steeds niet de berekende genreaffiniteit op basis van daadwerkelijke activiteit (views, stemmen, beoordelingen, verzoeken) — alleen het gesprek met de AI profiteerde hiervan sinds de laatste update. Een titel met een genreaffiniteit van meer dan 95 % (een bewust zeer hoge drempel, alleen een solide en bevestigde bewijslast overbrugt deze) verschijnt nu boven de TMDb-ranglijst in plaats van deze alleen licht te beïnvloeden.

## v1.24.28 — September 2026

### Contextengine — de lus views/beoordelingen/stemmen/verzoeken ↔ suggesties sluit

Het SQLite-logboek per gebruiker (voorheen geïntroduceerd) ontving tot nu toe alleen lees- en expliciete correcties via de AI — de stemmen 👍/👎, de beoordelingen van 1-5 sterren, de verzoeken en de toevoegingen via de AI bleven alleen in aparte JSON-bestanden bestaan, en kwamen nooit in dit geünificeerde logboek terecht, en niets las de minste zoekopdracht of het openen van een kaart omdat beide nergens werden vastgelegd. Al deze acties schrijven nu ook naar het geünificeerde logboek (naast hun bestaande opslag, zonder iets te breken), inclusief twee signalen die voorheen nergens bestonden: zoekopdrachten en het openen van kaarten. De genre-smaakengine (al gebruikt voor AI-antwoorden) integreert nu deze views als extra bewijs, en weegt voor het eerst mee in de daadwerkelijke rangschikking van de door de AI verstrekte aanbevelingen — tot nu toe diende het alleen om de toon van de antwoorden te kleuren, nooit om te bepalen wat er aanbevolen moest worden. Downloadverzoeken blijven bewust een zwak en beperkt signaal (vaak gevraagd voor anderen, niet voor zichzelf); de reeds geaccumuleerde geschiedenis wordt retroactief in het logboek opgenomen, niets gaat verloren. Altijd strikt per account — nooit een vermenging tussen profielen, inclusief de Plex-eigenaar.

## v1.24.27 — September 2026

### "Slechte aanbeveling" sluit de titel niet uit van de suggesties, en herberekenen de rij niet

De 👎-knop op een "Suggesties voor u"-kaart registreerde inderdaad het feedback, maar de engine achter deze rij (recommender/engine.ts, gescheiden van die gebruikt door de AI in het gesprek) raadpleegde dit logboek nooit — dezelfde titel kon oneindig verschijnen. Het sluit nu elke eerder met 👎 beoordeelde titel uit. De kaart verdwijnt ook onmiddellijk uit de rij, maar de lijst werd tot nu toe nooit achter de schermen opnieuw berekend: gewoon een gat op zijn plaats, nooit vervangen voordat de cache verloopt. Het verwijderen triggert nu een hervalidatie van de rij, die dynamisch een andere titel op zijn plaats laat vallen.

## v1.24.26 — August 2026

### Android mobiel — opnieuw ontworpen naar TV-stijl, toevoegen met één tik, automatische update

De smartphone-client neemt dezelfde principes over als de recente herziening van de TV-versie. Het placeholder "Mijn lijst" (nooit geïmplementeerd) wordt een echte Bibliotheek-tab: de volledige bibliotheek in een raster, sorteerbaar op naam/beoordeling/jaar en filterbaar op genre, met een Films/Series-kiezer — Ontdekking blijft het scherm om inhoud te vinden om toe te voegen. De knop "Toevoegen" op de hoofdartikelkaart op het Startscherm deed tot nu toe niets anders dan de titelpagina opnieuw openen (er was een tweede tik nodig om daadwerkelijk toe te voegen); het voegt nu direct toe aan de bibliotheek met één tik, net als elke Ontdekking-kaart al doet. De zoekopdracht toont nu dezelfde dynamische knop op elk resultaat, om toe te voegen zonder via de pagina te gaan. Ten slotte ontvangt de mobiele client hetzelfde automatische update-mechanisme als de TV (controle bij het opstarten tegen de laatste GitHub-release, download geverifieerd door SHA-256, installatie op de achtergrond met terugval naar de systeeminstaller), aanpasbaar en handmatig verifieerbaar via Profiel.

## v1.24.25 — Augustus 2026

### Afleveringen zonder datum — geen "Ontbrekend" meer na een reeds aangekondigde "Komt Eraan" aflevering

Een aflevering zonder bekende uitzenddatum werd "Ontbrekend" (dus gezocht alsof deze al kon bestaan), zelfs als een genummerde aflevering ervoor in hetzelfde seizoen nog "Komt Eraan" was met een bekende toekomstige datum — chronologisch onmogelijk, een serie kan aflevering 6 niet uitzenden voordat afleveringen 4/5. Elke niet-gedateerde aflevering die volgt, in hetzelfde seizoen, een aflevering die nog komen gaat, erft nu dezelfde status "Komt Eraan" in plaats van een valse "Ontbrekend" weer te geven.

## v1.24.24 — Augustus 2026

### Android TV — herontworpen navigatie, Ontdekking gescheiden van de catalogus, speler verlaagd

De zijbalknavigatie (224dp vast, altijd uitgevouwen) krimpt nu tot alleen de iconen in rust en vouwt zich alleen uit — terwijl het smaller blijft dan voorheen — wanneer de D-pad er in de buurt komt, om niet permanent de ruimte van de film-/serie-lijsten in te nemen. Elk tabblad heeft nu zijn eigen icoon (Start, Ontdekking, Films, Series toonden alleen nog tekst). Het oude Films/Series-scherm (hero + redactionele rijen in de stijl van Netflix) wordt het Ontdekking-tabblad, met een Films/Series-kiezer om de twee werelden niet in dezelfde rijen te mengen; de tabbladen Films en Series worden de volledige bibliotheek in een raster, sorteerbaar op naam/beoordeling/jaar en filterbaar op genre. In de videospeler (vensterstand, niet fullscreen), was de bedieningsbalk verankerd onderaan een paneel beperkt tot 80% van de schermhoogte, waardoor een lege ruimte onder de bedieningselementen ontstond — het paneel is vergroot naar 92% om het dichter bij de werkelijke rand te brengen.

## v1.24.23 — Augustus 2026

### Handmatige zoekopdracht — de cache vervangt de live zoekopdracht nooit meer

Twee eerdere correcties (v1.24.21, v1.24.22) verminderden de gevallen waarin de lokale cache voldoende was om de indexeringsquery te stoppen, maar elke beveiliging had zijn eigen blinde vlek — de laatste blokkeerde zelfs een cache-resultaat dat toch accuraat was. De handmatige zoekopdracht vraagt nu systematisch bij elke keer alle geconfigureerde indexers en fuseert deze resultaten met die van de cache in plaats van te kiezen tussen de twee: geen enkele cacheconfiguratie kan meer voorkomen dat een indexer wordt geraadpleegd voor een zoekopdracht die je zelf uitvoert.

## v1.24.22 — Augustus 2026

### Interactieve zoekopdracht — één cache-resultaat kon ook de live zoekopdracht stoppen

De vorige correctie dekte alleen het geval van een doorgesneden seizoen/aflevering. De vrije tekstzoekopdracht ("Interactieve zoekopdracht") kon hetzelfde probleem ondervinden zonder dat een seizoenbeperking de oorzaak was: de RSS-cache houdt slechts een recente momentopname vast (~100-150 releases totaal over alle indexers), dus één resultaat daarin voor een titel was voldoende om de volledige indexeringsquery te voorkomen, terwijl sommige er veel meer te bieden hadden. Er is nu meer dan één cache-resultaat nodig om de zoekopdracht als bevredigend te beschouwen.

## v1.24.21 — Augustus 2026

### Handmatige zoekopdracht — een zoekopdracht per seizoen/aflevering kon een hele indexer negereren

Een gecacheerde release, van het verkeerde seizoen of de verkeerde aflevering, kon — dankzij kwaliteitsbonussen (resolutie, seeders...) — net de minimale drempel overschrijden ondanks het plafond dat op slechte overeenkomsten werd toegepast. Zijn alleen al aanwezigheid was dan voldoende om te laten geloven dat de zoekopdracht al een antwoord had, wat de live indexering volledig annuleerde — waardoor tientallen correcte resultaten die elders beschikbaar waren, verborgen bleven. Een gecacheerd resultaat dat bestraft werd vanwege een verkeerd seizoen/aflevering blokkeert de live zoekopdracht niet meer.

## v1.24.20 — Augustus 2026

### Indexers — knop om categorieën te vernieuwen

Instellingen → Indexers biedt nu een speciale knop om de werkelijke lijst met categorieën van een indexer direct vanuit het selectiepaneel te laden, zonder via de algemene knop "Testen".

## v1.24.19 — Augustus 2026

### Zoeken — een aangepaste indexercategorie (bv. "Serie") kon worden genegeerd

Een categorie die specifiek is voor een indexer (zoals "Serie" op C411, een identificatie buiten de standaard Torznab-nummering), hoewel aangevinkt in de instellingen, verscheen nooit meer in de zoekopdracht "Series" zodra deze indexer ook minstens één standaard aangevinkte categorie had. De filtering herkent nu alleen categorieën van de andere expliciete type (film vs. serie) als uit te sluiten — een aangepaste categorie die Movviz niet kent, blijft opgenomen.

## v1.24.18 — Augustus 2026

### Handmatige zoekopdracht — diagnose per indexer

Een indexer die afwezig was in de resultaten van een handmatige zoekopdracht, bleef onzichtbaar zodra een andere indexer iets vond — één geaggregeerd log verhulde het detail. Het logboek (Instellingen → Logs) toont nu, bij elke directe zoekopdracht, het aantal ruwe en vervolgens gefilterde resultaten voor elke indexer afzonderlijk.

## v1.24.17 — Augustus 2026

### Plex synchronisatie — volledige diagnose van verdwenen afleveringen

Het logboek (Instellingen → Logs) toont nu, bij elke synchronisatie, het ruwe aantal "aflevering"-gebeurtenissen dat daadwerkelijk van Plex is ontvangen vóór enige filtering — voorheen, als Plex er van meet af aan geen terugstuurde, onderscheidde niets dit van een stille filtering achteraf. De volgende synchronisatie zal eindelijk precies aangeven waar het probleem zit.

## v1.24.16 — Augustus 2026

### Android TV — geünificeerde navigatie en speler

De Android TV navigatie neemt een echt gereserveerde NavRail aan: geen scherm of achtergrond komt meer eronder, en de Hero neemt de gehele bruikbare breedte van het inhoudsgebied in. Het startscherm is gebaseerd op de native TV-lijsten: de D-pad scrollt rij voor rij met de bijbehorende scroll, en sluit zich pas bovenaan aan bij de NavRail.

De speler verzamelt alle besturingselementen in zijn onderste dock. De voortgang is bereikbaar met de D-pad en wordt ingesteld met links/rechts; het dock toont de werkelijke afspeelstatus: directe afspelen, audio transcodering of video transcodering. De compatibiliteitsfallback's behouden ook de juiste status bij netwerkherpogingen.

## v1.24.15 — Augustus 2026

### Logs — filteren op tag of tekst

Instellingen → Logs biedt nu een vrije zoekveld, naast het bestaande filter op niveau, om een specifieke tag te isoleren (bv. `plex.watchSync`) te midden van de ruis van duizenden RSS/zoeklijnen.

## v1.24.14 — Augustus 2026

### Actieve sessies — een getranscodeerde audio werd weergegeven als "Live Stream"

Een Movviz-sessie die alleen audio transcodeerde (video gekopieerd zoals het was) werd weergegeven als "Live Stream" in het adminpaneel, terwijl de speler correct "Audio getranscodeerd" toonde. Verholpen — dit geval wordt nu weergegeven als een transcodering, en de doel-audiocodec wordt weergegeven zelfs als de video niet wordt getranscodeerd.

### Speler — knop "Intro overslaan" die over de afspeelbalk lag

Door het verkleinen van het venster kwamen de knoppen van de bedieningsbalk op twee regels en vergrootte het de balk voorbij de beoogde marge voor de knoppen "Intro overslaan"/"Aflevering overslaan"/"Volgende aflevering", die dan erboven lagen. Verholpen.

## v1.24.13 — Augustus 2026

### Download — een beschikbare aflevering kon gemarkeerd blijven als "ontbrekend"

Meerdere afleveringen van dezelfde serie die tegelijkertijd werden gedownload, konden elkaar overschrijven: de beschikbaarheidstekst van de ene overschreef die van de andere, waardoor de aflevering werd weergegeven als "ontbrekend" ondanks dat het bestand wel op de schijf aanwezig was. De correctie die al bestond voor dit soort conflicten bij films en bij de directe import van series ontbrak op dit back-up pad (gebruikt wanneer een torrent de engine verlaat voordat de import wordt getriggerd); dit is nu even beschermd.

### Plex Synchronisatie — zichtbaarheid van verdwenen bekeken afleveringen

Het logboek (Instellingen → Logs) geeft nu nauwkeurig aan hoeveel afleveringen uit de Plex-geschiedenis zijn afgewezen en waarom, in plaats van een stil teruggebrachte telling op nul. Een voorbeeld van de ruwe velden die Plex terugstuurt voor een afgewezen aflevering wordt ook gelogd, om de exacte oorzaak op deze server te bevestigen.

## v1.24.12 — Augustus 2026

### Actieve sessies — de native Movviz speler wordt nu weergegeven, naast Plex

De widget "Actieve sessies" (alleen zichtbaar voor admin) toonde alleen de streams die via Plex werden gerelaisd. Het toont nu ook wat direct wordt afgespeeld via de Movviz speler, voor alle gebruikers, met dezelfde informatie als voor Plex: titel, poster, gebruiker, apparaat, directe afspelen/kopie/transcodering, en voortgang.

## v1.24.11 — Augustus 2026

### Handmatige zoekopdracht — een titel aanwezig op C411 kon onzichtbaar blijven in Movviz

Een indexer die 10 minuten werd gepauzeerd na één 429-fout (bescherming tegen herhaald verkeer op de achtergrond: auto-grab, RSS scan) werd ook uitgesloten van de handmatige zoekopdracht gedurende deze pauze, zonder enige melding op het scherm. De handmatige zoekopdracht vraagt nu alle geconfigureerde indexers aan zonder rekening te houden met deze pauze — de limiet van verzoeken per minuut per indexer blijft in alle gevallen gerespecteerd.

## v1.24.10 — Augustus 2026

### Plex Synchronisatie — het admin-account en de Home-profielen werden niet meer als "bekeken" gesynchroniseerd

Sinds de overstap naar de Plex-sessiegeschiedenis om bij te houden wat per account is bekeken, synchroniseren het admin-account en de profielen beheerd door Plex Home (in tegenstelling tot externe gastaccounts) hun geschiedenis nooit meer: Plex filtert deze geschiedenis op basis van een server-specifieke ID (intern, verschillend van de cloud-ID van plex.tv die tot nu toe werd opgeslagen), die deze twee soorten accounts nooit hadden. De synchronisatie lost nu de juiste lokale ID op basis van de Plex-gebruikersnaam voordat deze de geschiedenis opvraagt.

## v1.24.09 — Augustus 2026

### Onderhoud

Versie-update zonder functionele wijziging.

## v1.24.08 — Augustus 2026

### Geünificeerd branding — Windows, Android, Web/PWA en Docker

Het nieuwe roze/paarse Movviz logo met witte klap wordt de gemeenschappelijke identiteit van de applicatie. De installator en Windows-korte snelkoppelingen gebruiken nu een multi-resolutie ICO, Android Mobile en Android TV delen dezelfde launcher/adaptieve iconen, de TV-banner is uitgelijnd, en Web/PWA en Docker assets gebruiken dezelfde canonieke visual.

## v1.24.07 — Augustus 2026

### Onderhoud

Versie-update zonder functionele wijziging — opruimen van de release-/taggeschiedenis van GitHub vóór 1.24.06.

## v1.24.06 — Augustus 2026

### Instellingen → Speler — volledige deactivering van HDR/Dolby Vision → SDR

Tone mapping van HDR10, HDR10+, HLG en Dolby Vision naar SDR kan nu volledig worden uitgeschakeld via Instellingen → Speler, zelfs wanneer de serverbenchmark het gebruikelijke drempel van 3× overschrijdt. Geactiveerd, verandert het gedrag niet: tone mapping blijft alleen toegestaan boven deze drempel.

### Android TV — startscherm gesynchroniseerd met de desktop

Het Android TV-gebruikersinterface gebruikt nu dezelfde lay-out als het desktopdashboard (`/api/dashboard/layout`): de volgorde en zichtbaarheid van rijen, de activatie van de hero, de snelheid van de slideshow en de autoplay van de trailer volgen de serverconfiguratie in plaats van een vaste TV-indeling. De rijen "Selectie voor u" en "Movviz Trends" gebruiken exact dezelfde bronnen als de desktop (`/api/metadata/recommendations`, trending rij), en "Recent toegevoegd"/"Binnenkort" gebruiken de werkelijke datums (`addedAt`, VF-release datum) in plaats van een geschatte sortering.

## v1.24.04 — Augustus 2026

### Geünificeerde Movviz Speler

De automatische speler gaat via één Movviz planner voor lokale bestanden en ruwe Plex-bronnen: directe afspelen wanneer de client daadwerkelijk kan decoderen, remuxen wanneer alleen de track/container moet veranderen, audio transcoderen zonder de video aan te raken wanneer alleen de audio incompatibel is, en video transcoderen alleen wanneer nodig. De daadwerkelijk geselecteerde audiotrack wordt bepaald vóór de codec: een niet-geselecteerde DTS-track kan geen transcodering triggeren als de beluisterde track AAC is. HDR→SDR blijft verboden onder 3× op de benchmark. Softwarematige video transcoderingen passen zich aan de benchmark aan en zijn beperkt tot 1,5× vooruitafspelen om buffer te behouden zonder de server onnodig te belasten.

### Windows, Linux en ARM64

FFmpeg/ffprobe gebruiken nu een gemeenschappelijke mediabeurt. De Windows-installer bevat zijn eigen binaire bestanden en de service verwijst expliciet naar deze; de amd64/arm64 Docker-images controleren FFmpeg en ffprobe tijdens hun build. De benchmark gebruikt dezelfde runtime-resolutie als de speler.

### Instellingen → Speler

De afspeelopties verlaten Instellingen → Plex. Een speciale Speler-tab combineert activatie per profiel, audiosprong, automatische motor, reserve/cache, diagnose en benchmark. De oude handmatige keuzes MSE/FFmpeg/HLS/Beta zijn gemigreerd naar Auto; Plex behoudt alleen verbinding, synchronisatie en profielen.

## v1.24.03 — Augustus 2026

### Configuratie-assistent — blokkade direct na accountcreatie

De aanmaak van het beheerdersaccount, toegevoegd in het allereerste begin van de assistent in de vorige versie, bleef vastzitten op een oneindige laadscherm direct na validatie van het formulier, waardoor de configuratie niet voltooid kon worden. Verholpen.

## v1.24.02 — Augustus 2026

### Configuratie-assistent — accountcreatie hersteld

Bij een eerste installatie bood de configuratie-assistent niet langer aan om het beheerdersaccount aan te maken of een Plex-account te koppelen: de IA-assistent stap bleef vastzitten op zijn laadscherm, de downloadmotor toonde "geen client geconfigureerd" en de Plex-stap bleef leeg. Het afronden van de assistent leidde dan in een lus terug naar dezelfde pagina, omdat er nooit een account was aangemaakt. De aanmaak van het beheerdersaccount is nu de allereerste stap van de assistent, vóór alles wat anders is.

### Netflix importeren en Plex synchronisatie — kijkdata

Het importeren van een Netflix-geschiedenis registreerde elke titel als "zojuist bekeken" in plaats van de werkelijke kijkdatum te behouden. Deze werkelijke datum wordt nu bewaard. De realtime Plex-synchronisatie werkt ook onmiddellijk de IA-context bij in plaats van te wachten tot meerdere minuten.

### Startscherm en "Nieuws" venster

Het venster met de nieuwigheden van een update kon nu over het animatie startscherm worden weergegeven in plaats van te wachten op het verdwijnen ervan. Het verschijnt nu pas nadat het startscherm is voltooid.

## v1.24.01 — Augustus 2026

### Movviz AI — conversatiecontinuïteit en expliciete voorkeuren

Movviz AI behoudt nu veel beter de draad van de laatste beurten: impliciete verwijzingen zoals "dat", "hem", "die" of "die verandering" worden voorrangig opgelost vanuit het recente gesprek in plaats van opnieuw te beginnen. Expliciete correcties van de gebruiker vervangen onmiddellijk eerdere tegenstrijdige aannames en blijven prioriteit in de context.

Expliciete voorkeuren voor een titel worden nu opgeslagen in de User Context Engine met maximale zekerheid en voeden direct de aanbevelingsscore. Een correctie zoals « je hebt het verkeerd, ik hou van Watchmen » wordt dus een gestructureerd, duurzaam en prioritair signaal in plaats van een eenvoudig te vergeten zin.

De Dialogue Director is ook versoepeld: automatische escalatie, stereotypische uitdagingen en de verplichting om te winnen of het laatste woord te hebben zijn verwijderd. De joutesantwoorden kunnen korter, natuurlijker zijn en variëren tussen humor, sarcasme, ironie, zelfspot of een droog antwoord, met een versterkte anti-herhaling beveiliging.

## v1.24.00 — Augustus 2026

### Movviz AI — Geünificeerde User Context Engine

Movviz AI beschikt nu over een geünificeerde en persistente gebruikerscontextmotor. Een SQLite ledger per `user_id` bewaart de mediagegeschiedenis zonder profielen te mengen: bekeken, films en afgeronde afleveringen, aparte herbekijkingen, voortgang, herhalingen en de werkelijke chronologie wanneer deze bekend is. Oude kijk-/voortganggegevens worden idempotent bootstrapped zonder ontbrekende datums te creëren.

De Query Engine kan deze geverifieerde status benutten om de AI de exacte voortgang van series, lopende inhoud en recente geschiedenis te verstrekken, met verrijking door metadata/genres. Ratings, feedback, verzoeken, feiten, inzichten en AI-geheugen blijven compatibel via een geünificeerde adapterlaag om elke destructieve migratie te voorkomen. Eigenschappen van smaak gebaseerd op bewijs en een zekerheidsniveau kunnen ook het profiel voeden zonder een inferentie in een feit te veranderen.

De Context Engine is additief en veerkrachtig: bestaande stores blijven functioneel, SQLite schrijfbewerkingen belemmeren nooit het lezen bij een storing en `MOVVIZ_CONTEXT_ENGINE_DISABLED=true` maakt een onmiddellijke rollback mogelijk. De tests dekken onder andere multi-gebruikersisolatie, idempotentie en het behoud van meerdere herbekijkingen.

### Runtime — Node.js 22

De Movviz-server schakelt over op minimaal Node.js 22 om de beschikbaarheid van `node:sqlite` te garanderen. De Windows-installer bevat nu Node 22 en de Linux-builds gebruiken/melden ook minimaal Node 22.

## v1.23.04 — Augustus 2026

### Release — Gealigneerde versies en artefacten

Synchronisatierelase: applicatieversie, lockfile en Android TV/mobiele fallbackwaarden zijn afgestemd op `1.23.04`. De tag `v1.23.04` triggert de GitHub builds voor de Windows-installer, de Linux-archief en de Android TV/mobiele clients; de Docker-image blijft gegenereerd vanuit `main`. Er wordt geen functionele wijziging geïntroduceerd door deze release.

## v1.23.03 — Augustus 2026

### Kaarten — Verfijnde virtuele YouTube-cadrering

Het `detail`-profiel, gedeeld door de volledige kaart en de vluchtige/TitlePanel-kaart, behoudt de virtuele YouTube-motor van 1920×1080 van v1.23.02, maar gaat van een zoom van `1.10` naar `1.15`. De wijziging blijft gecentreerd en bewust conservatief om het visuele voordeel merkbaarder te maken in kaarten zonder de reeds gevalideerde `hero`-carrousel of de `card`-kaarten aan te raken. De `postMessage`-bridge, de fallbacks, de toggles, de selectie van trailers en de interactieve trailer-modal blijven ongewijzigd.

## v1.23.02 — Augustus 2026

### Omgevings-YouTube — Geünificeerde virtuele 1080p-motor

De drie omgevingsoppervlakken (hover-kaart, hero/carrousel en kaartheader) gebruiken nu dezelfde ruwe YouTube-motor met een echte logische viewport van `1920×1080`, aangestuurd door `postMessage` en vervolgens verkleind in CSS via `ResizeObserver`. Elk oppervlak heeft zijn eigen cadreringspreset: `card` behoudt de gevalideerde zoom van `1.36`, terwijl `hero` en `detail` starten op `1.10` om zo dicht mogelijk bij hun vorige weergave te blijven en na visuele validatie onafhankelijk aanpasbaar te blijven. De bridge, `apiInterface`, het maskeren van de chrome wanneer deze wordt getoond, de loop vóór `ENDED`, de backdrop-gordijn, de mute en de timeouts zijn gematerialiseerd. Het oude `YT.Player` blijft de veiligheidsfallback en voedt de interactieve trailer-modal. Bestaande toggles, de volgorde van trailers, directe videopaden en Android blijven ongewijzigd.

## v1.23.00 — Augustus 2026

### Nieuwe versie reeks

Overgang naar serie 1.23.x. Geen functionele wijzigingen in deze versie.

## v1.22.61 — Augustus 2026

### Kaarten — virtuele YouTube iframe 1080p

De kleine YouTube previews gebruiken nu een ruwe iframe met een logisch viewport van `1920×1080`, waarna een Movviz wrapper via `ResizeObserver` een `transform: scale(...)` berekent om deze te verkleinen tot de grootte van de kaart. De schaling past `cover × 1.36` toe, wat exact het zoom-/kadering van v1.22.60 behoudt, terwijl YouTube denkt dat het een grote desktopspeler heeft. Het doel is dubbel: de compacte lay-out van de speler vermijden en de kans maximaliseren dat YouTube een hoge kwaliteit selecteert; de 1080p-kwaliteit wordt echter nog steeds bepaald door YouTube en kan niet officieel worden afgedwongen. De bridge `postMessage`, `apiInterface`, `hideVideoInfo` indien blootgesteld, de loop vóór `ENDED`, de poster curtain en de fallback `YT.Player` blijven ongewijzigd. Als het viewport van de kaart niet correct gemeten kan worden, valt Movviz automatisch terug op de stabiele weergave van v1.22.60. Hero, kaarten, modal en Android veranderen niet.

## v1.22.60 — Augustus 2026

### Kaarten — YouTube iframe uitsnijding

De kleine YouTube previews zijn verticaal gecentreerd (`top: 50 %` in plaats van `46 %`) en krijgen 15 % extra zoom ten opzichte van de vorige kadering (`scale 1.18` → `scale 1.36`) om de zwarte balken die bij de trailers horen te verwijderen. De bridge `postMessage` en zijn fallback `YT.Player` gebruiken exact dezelfde kadering. Hero, kaarten, modal, trailerselectie en Android blijven ongewijzigd.

## v1.22.59 — Augustus 2026

### Kaarten — ruwe YouTube iframe gestuurd door postMessage

Testen in echte omstandigheden beperkt tot kleine previews: de primaire speler van de kaarten is nu een ruwe YouTube iframe met `enablejsapi=1` en `origin`, zonder constructie via `new YT.Player()`. Movviz start de handshake `listening`, leest de daadwerkelijk aangekondigde capaciteiten in `initialDelivery.info.apiInterface` / `infoDelivery`, en probeert `hideVideoInfo` of `hideControls` alleen wanneer deze expliciet worden blootgesteld door deze speler. Afspelen, muten, statussen, `currentTime` en de loop vóór `END` gaan via de bridge `postMessage`. De poster blijft ondoorzichtig totdat er daadwerkelijke video progressie is en daarna nog 700 ms. Bij falende laad-, handshake- of afspeelprocessen vernietigt de kaart dit pad en valt automatisch terug op de stabiele `YT.Player` van v1.22.58. Hero, kaarten, modal, Android TV en trailerselectie/fallback blijven ongewijzigd.

## v1.22.58 — Augustus 2026

### Kaarten — poster curtain + echte YouTube pauze/herstart overgang

De kleine previews verliezen niet langer 650 ms voordat de iframe wordt geladen: zodra de beoogde preview opengaat, start YouTube onmiddellijk achter de poster, die 100 % ondoorzichtig blijft. Bij de eerste `PLAYING` vraagt Movviz om `pauseVideo()`, wacht nu op het daadwerkelijk bevestigde `PAUSED` event, laat deze status 450 ms stabiliseren, hervat met `playVideo()`, wacht op een tweede `PLAYING`, controleert of `currentTime` daadwerkelijk vordert, en houdt de poster nog 300 ms vast vóór de fade naar de video. Een globale timeout van 2,5 s geeft deze opwarming op en valt terug op de historische stabilisatie van 1,5 s als YouTube de sequentie niet volgt. Hero, kaarten, modal, Android TV, trailerselectie en fallback blijven ongewijzigd.

## v1.22.57 — Augustus 2026

### Kaarten — onzichtbare opwarming van de YouTube iframe

De kleine previews starten nu eerder onder de achtergrond (650 ms in plaats van 1000 ms), en voeren vervolgens één enkele verborgen sequentie uit: `PLAYING → pause → play`. Movviz wacht vervolgens tot `currentTime` daadwerkelijk vordert na de hervatting en past een korte vertraging van 180 ms toe voordat de video wordt onthuld. Deze sequentie reproduceert de schone visuele staat die wordt waargenomen na een handmatige hervatting zonder muisbeweging, terwijl een harde fallback van 1500 ms wordt behouden als YouTube een overgang negeert. De hero, kaarten, modal, Android TV, trailerselectie, kwaliteit en fallbacks blijven ongewijzigd.

## v1.22.56 — Augustus 2026

### Versiecorrectie — YouTube preview van kaarten

Republiek de preview correctie van YouTube's kleine kaarten boven de reeds bestaande `v1.22.55`. Geen functionele wijziging ten opzichte van de eerder gevalideerde kaartpatch: YouTube iframe behouden, directe YouTube → gebruiker verkeer, crop `scale 1.18`, gecentreerd op 46 %, bovenste proportionele masker van 28 %, hero en fichevideo's ongewijzigd.

## v1.22.54 — Augustus 2026

### Kaarten — compact YouTube iframe zonder titel

Gericht getest op de previews van de kaarten alleen: de hero en fichevideo's blijven ongewijzigd. De kleine kaarten behouden de YouTube IFrame API en het directe YouTube → gebruiker verkeer, maar gebruiken een licht versterkte crop (`scale 1.18`, gecentreerd op 46 %) en een bovenste proportioneel masker van 28 % om de titel/kanaal chrome van het compacte layout te verbergen. `YOUTUBE_CHROME_SETTLE_MS=1500`, `LOOP_BEFORE_END_SEC=0.75`, de selectie van trailers en de YouTube fallback blijven ongewijzigd. Er wordt geen Piped/Invidious/yt-dlp toegevoegd.

De revert 1.22.53 liet verlaten Piped/Invidious bestanden achter die al `tsc --noEmit` ongeldig maakten; deze niet-gereferentieerde overblijfselen worden verwijderd om de revert netjes af te ronden voordat deze versie wordt gevalideerd.

## v1.22.53 — Augustus 2026

### Revert — 1.22.50 uitgesteld naar 1.22.53

De pull van de `v1.22.50` (revert voor `v1.22.27`) is uitgesteld naar `v1.22.53`.

## v1.22.50 — Augustus 2026

### Revert — terug naar de stabiele 1.22.27

Schone terugkeer naar de `v1.22.27` na hover/zoom regressies.

## v1.22.27 — Augustus 2026

### Torrents geblokkeerd

Een specifieke release kan nu worden geblokkeerd vanuit de downloadlijst. De blokkering is gekoppeld aan zijn info-hash: andere releases van dezelfde film of serie blijven dus beschikbaar. Een pagina "Geblokkeerde Torrents" in Beheer stelt u in staat om elke torrent te bekijken en te onblokkeren.

## v1.22.26 — Augustus 2026

### TMDb Trailers

Spots, promoties en andere promotievideo's kunnen niet langer een echte TMDb trailer voorafgaan. De previews in de carrousel, kaarten en fiches geven nu de volledige officiële trailer de voorkeur in alle contexten.

## v1.22.25 — Augustus 2026

### Docker Workflow

Correctie van de YAML-indentatie en toevoeging van een expliciete workflownaam voor Docker-publicaties.

## v1.22.24 — Augustus 2026

### Docker Publicatie Correctie

Correctie van de workflow: commentaren worden niet langer geïnterpreteerd als ongeldige Docker tags.

## v1.22.23 — Augustus 2026

### Onafhankelijke Docker Publicatie

Het AMD64-image publiceert nu de tag `latest` zodra de build is voltooid. De ARM64 build blijft parallel op zijn eigen tag en het multi-architectuur manifest wordt daarna samengesteld, waardoor AMD64 NAS-apparaten kunnen updaten zonder te wachten op ARM64.

## v1.22.22 — Augustus 2026

### Trailers: prioriteit en validatie

De door TMDb gekoppelde video's zijn nu de enige gebruikte bron voor previews; het oude systeem van verrijkte bronnen is gedeactiveerd. De YouTube fallback weigert elk resultaat waarvan de titel en het type niet voldoende zijn gevalideerd, om te voorkomen dat er trailers van een andere film worden getoond.

## v1.22.21 — Augustus 2026

### Pagina: overgang van de gradiënt

De onderste gradiënt van de pagina bedekt nu correct de rand van het paneel, waardoor de dunne lijn die zichtbaar was tussen de visual en de inhoud, verdwijnt.

## v1.22.20 — Augustus 2026

### Video fallback: betrouwbare selectie

De YouTube fallback valideert nu de titel, taal, kanaal en het type van de video. Spots, teasers, clips, samenvattingen en interviews worden uitgesloten ten gunste van officiële trailers. Oude foutieve overeenkomsten worden ongeldig gemaakt door een nieuwe cache sleutel.

## v1.22.19 — Augustus 2026

### Kaarten: stabiele en onbedekte preview

De video preview van de kaarten verschijnt nu zonder verplaatsing of bovenste zwarting tijdens het laden. Het carrousel en de kaarten behouden hun ongewijzigde weergave.

## v1.22.18 — Augustus 2026

### Kaarten: geünificeerde video preview in Hero/pagina feed

De preview bij het overgangen van kaarten (`DashboardPosterCard`) gebruikt nu exact dezelfde `TrailerHeader` als de Hero en de pagina (`trigger="immediate" enabled={videoPreviewEnabled}`) — hetzelfde `backdrop`, dezelfde `trailerKeys/enhancedSources`, dezelfde crossfade en dezelfde mute-knop. Alleen de trigger blijft op de muis (`videoReady` na 1s), de video weergave is strikt identiek.

## v1.22.17 — Augustus 2026

### CI: correctie van de Linux Release build

De verificatiestap `tar -tzf | grep -qx` veroorzaakte een SIGPIPE wanneer grep vroegtijdig beëindigde na het vinden van een overeenkomst, waardoor de pipeline onder `set -euo pipefail` crashte. De verificatie schrijft nu de lijst met bestanden naar een tijdelijk bestand voordat deze wordt gegrept, waardoor het signaal wordt geëlimineerd. De runner is vastgezet op `ubuntu-22.04`.

## v1.22.16 — Augustus 2026

### AI: gestuurd dialoog, dubbele Mistral en volledige feitelijke antwoorden

Movviz onderscheidt nu een kritiek, een feitelijke correctie en een echte provocatie voordat het antwoordt. De uitwisseling neemt geleidelijk toe, vermijdt hergebruikte zinnen en behoudt een coherente mini-Ghostface scène, een stap per bericht. Met twee Mistral sleutels kunnen twee antwoorden parallel worden beoordeeld om er slechts één te tonen; één enkele sleutel blijft normaal functioneren. Filmografieën en acteur/regisseur tellingen worden vergeleken met TMDb en de bibliotheek, met bezitters en relevante ontbrekende titels, terwijl de muziekvragen gebruikmaken van feitelijke webzoekopdrachten.

## v1.22.15 — Augustus 2026

### Hero 5 visuals gegarandeerd + AI lekke profielen

Hero valt niet meer terug op 2 visuals wanneer `minYear` te veel filtert: de uitgesloten items keren terug gesorteerd op score om altijd 5 te maken. AI: `getWatchStatus` + `getRecommendations` strikt per `userId` (Plex `accountId` geverifieerd, `rejectedForeignEntries` gelogd), geen films van een ander profiel meer.

## v1.22.14 — Augustus 2026

### Zoeken en koppelen: Yellowstone gecorrigeerd + Alles/Films/Series sorteren

De zoekopdracht schakelt niet meer over op de filmografie van een homonieme acteur (`Yellowstone` acteur 3 stemmen → `Yellowstone` serie 73586 3298 stemmen behouden), docu `19355` wordt niet meer voorgesteld in plaats van de serie, en de Ontdekking pagina krijgt een sorteeroptie `Alles | Films | Series` + `Relevant/Populair/Recent/Beoordelingen` zonder refetch, met nadruk op bekend/recent. Plex koppeling `tvdb://85527` → `73586` indien docu.

## v1.22.13 — Augustus 2026

### AI: algemene anti-herhaling

De controle is niet langer afhankelijk van een ononderbroken reeks beledigingen: alle conversatieantwoorden worden vergeleken met recente formuleringen. Korte provocaties zoals "kleine klootzak" worden correct geïdentificeerd na een normale vraag, drie herformuleringen worden geprobeerd voordat er wordt teruggetrokken, en een expliciete opmerking over een herhaling krijgt een contextueel antwoord in plaats van een algemeen repliek. De bestaande persoonlijkheid wordt behouden.

## v1.22.12 — Augustus 2026

### AI: behouden persoonlijkheid, verwijderde herhalingen

De assistent behoudt zijn toon en persoonlijkheid, maar onthoudt nu recente formuleringen zelfs na een normale onderbreking van het gesprek. Antwoorden die dezelfde structuur recyclen met enkele veranderde woorden worden gedetecteerd en opnieuw gegenereerd; gebruikte openingszinnen, slotzinnen en herhalingen dienen ook als tijdelijke zwarte lijst. Te herkenbare oude vullingen zijn vervangen door korte en gevarieerde antwoorden.

## v1.22.11 — Augustus 2026

### Android TV: startscherm crasht definitief verholpen

`HomeScreen` `focusRequester` beschermd (`runCatching + withFrameNanos` 8 frames), `heroIndex` garde anti-divide-by-zero, `AmbientTrailer` `availMem` 400Mo + `applicationContext` + pool `1` idle, geen WebView lek meer. D-pad `focusGroup`/`padding 80dp` stabiel.

## v1.22.10 — Augustus 2026

### Remaster HD verwijdering + statische thumbnail + geoptimaliseerd dashboard behouden

Volledige verwijdering van het remaster HD systeem (1.22.00) — te veel valse positieven — terug naar `Apple/Netflix/Disney+/Prime/IMDb → TMDb` precies zoals voorheen, zonder regressie. Hover thumbnail: zwarte sluier en zoom verwijderd, blijft statisch vóór video preview. Behouden: identieke splash, D-pad, snelheidoptimalisatie, SVG logo's.

## v1.22.09 — Augustus 2026

### Volledige en installeerbare Linux-archief

De Linux x64 release bevat nu de vooraf gecompileerde applicatie, de engine, `install.sh`, `uninstall.sh`, de systemd service en een geherstructureerde Linux-gids. De installator creëert zelf het systeemaccount `movviz`, installeert beschikbare mediadependenties, behoudt gegevens bij updates en kan direct het geëxtraheerde bundle installeren. De CI controleert de inhoud van het archief vóór publicatie en verstrekt de SHA-256 som.

## v1.22.08 — Augustus 2026

### Betrouwbare video previews en geünificeerde metadata

De zoekopdracht « remastered » is verwijderd uit alle previews: deze kon een video koppelen aan een verkeerde titel. De verbeterde betrouwbare bronnen blijven in de volgorde Apple TV, Netflix, Disney+, Prime Video en vervolgens IMDb, vóór de TMDb trailer. De desktop-, mobiel- en TV-kaarten tonen nu soberdere metadata: compacte duur en techniek, genres gescheiden door punten.

## v1.22.07 — Augustus 2026

### Android TV build gerepareerd + hero/thumbnail clean + mobiel uitgelijnd op desktop

TV build `focusGroup` import gecorrigeerd (`foundation` in plaats van `ui.focus`), hero pauze `||` verborgen (`900→1500ms` + hoge sluier `z-10`), thumbnail hover alleen video als hero, mobiele palet `Void #05060B / Surface #0D1020` uitgelijnd op desktop.

## v1.22.06 — Augustus 2026

### Hero en thumbnails: schone video zonder YouTube UI

De centrale `||` van de hero verdwijnt (vertraging `YOUTUBE_CHROME_SETTLE 450→900ms` om de YouTube chrome te dekken) en de thumbnail bij hover bedekt de YouTube titel-/kanaalbalk met een hoge sluier, om alleen de video als de hero weer te geven.

## v1.22.05 — Augustus 2026

### Splash gesynchroniseerd met afbeeldingen en D-pad TV

De splash blijft nu totdat **alle dashboardafbeeldingen** geladen zijn (timeout 15s gevraagd) en niet alleen de bibliotheek — geen splash meer die verdwijnt vóór de rijen. Android TV correcties: `NavRail` + `LazyColumn` met `focusGroup`/`padding 80dp` anti-overlay, `focusRestorer` nul, `BringIntoViewSpec`, WebView geheugendrempel `4→2Go`.

## v1.22.04 — Augustus 2026

### Direct dashboard en SVG logo's

Movviz high-quality splash alleen bij de eerste koude opstart (nooit bij elke klik) met intelligente voortgangsbalk, voorbelasting van Ontdekking op de achtergrond geoptimaliseerd (`requestIdleCallback` + `priority:low`), en correctie van TMDb logo's naar `*.svg` die vastzaten op 404 (`tmdbImageCache` staat nu `svg` toe).

## v1.22.03 — Augustus 2026

### Verbetering van de chat

## v1.22.02 — Augustus 2026

### Homogene trailervoorbeelden

De kaarten gebruiken nu dezelfde bronselectie als de carrousel: gerestaureerde HD-trailer, directe video en YouTube als laatste redmiddel. Bij het opstarten blijft YouTube kort verborgen achter de illustratie om de grote centrale pauze/afspeelknop te elimineren, op kaarten net als in de carrousel.

## v1.22.01 — Augustus 2026

### Verbetering van de chat

## v1.22.00 — Augustus 2026

### Prioritaire gerestaureerde HD-trailers

Nieuwe globale instelling **"Prioriteer gerestaureerde HD-trailers"** in **Instellingen → Informatie, afbeeldingen en logo's** (standaard uitgeschakeld, omkeerbaar met één klik, actief voor iedereen wanneer de admin dit activeert). Wanneer ingeschakeld, probeert Movviz voorrangswijs gerestaureerde/remasterde/re-trailers in **Full HD/4K** uit **5 vertrouwde YouTube-kanalen** (Digital Ciné, HD Retro Trailers, Casu/Re-Trailer, FilmsActu, The Digital Theater) — strikte whitelist per `channelId`, daadwerkelijk gescande resolutie (≥1080p verplicht, anders afgewezen), zeer conservatieve titelmatch (≥0,85) + exacte jaar/±1 (homonieme remakes nooit verward), prioritaire gebruikers-taal, providers parallel met korte timeouts en een globale deadline van ~3s, toegewijde ranking, aparte cache (7d positief / 18u leeg / geen cache bij tijdelijke fout), onmiddellijke fallback naar de huidige workflow (Apple/IMDb/Prime → YouTube) bij de minste aarzeling. Webintegratie: `DashboardHero` (carrouselcontext: teaser > trailer) en `TitleContent` (detailcontext: trailer > teaser) via `TrailerHeader`/`TrailerModalPlayer` (`premiumSources` voorgeplakt), `GET /api/trailers/remastered/resolve` controleert de toggle VOOR elke netwerkopvraag, Android TV/mobiel: optioneel veld `premiumTrailerCandidates` (`= emptyList()`) — oude APK negeert, oudere backend zonder veld crasht niet. Nul regressie gegarandeerd: toggle UIT = exact ongewijzigde workflow.

## v1.21.17 — Augustus 2026

### Acteursprofielen: nuttige filmografie

Talkshows, late shows en promotieceremonies vervuilen niet langer acteursprofielen. Movviz sluit het TMDb-genre « Talk » en zeldzame verkeerd gecategoriseerde shows uit, zonder de zoekopdracht, Ontdekking of titelfiches te wijzigen.

## v1.21.16 — Augustus 2026

### Persoonlijke aanbevelingen op Android TV en mobiel

Android-apps gebruiken nu de suggesties van de bibliotheek die al op de desktop zijn gebruikt. De rijen «Suggesties voor u», de hoogst beoordeelde titels en de selecties per genre worden berekend op basis van daadwerkelijk aanwezige films en series, waarbij de redactionele rijen van Ontdekking behouden blijven.

## v1.21.15 — Augustus 2026

### Ontdekking: een "ik hou er niet van" titel keerde terug na verversing

De 👎 op een Ontdekking-kaart werd correct opgeslagen, maar de redactionele rijen (trends, populair, hoogst beoordeeld...) raadpleegden dit nooit — dezelfde titel verscheen dus bij elke paginalaad. Deze rijen sluiten nu permanent titels die als "ik hou er niet van" zijn gemarkeerd uit.

### Films/Series: ontbrekende logo's op Opnieuw bekijken en Recent toegevoegde afleveringen

Op de Films- en Seriespagina's toonden de rijen "Opnieuw bekijken" en "Recent toegevoegde afleveringen" de titel in platte tekst in plaats van het logo — deze kaarten werden nooit opgenomen in de groepsophaal van logo's. Verholpen. Ook toegevoegd een permanent badge rechtsonder op de kaart ("S03 · E02") om de aflevering in één oogopslag te herkennen, zonder te hoeven zweven.

### Verbetering van de chat

### Verbetering van de chat

### Carrouselvoorvertoning: dun zwarte lijn op trailers

Een lichte afgerondheidsverschuiving tussen de video en zijn kader liet soms een zwarte lijn van één pixel zien aan de rand van de speler (MP4/HLS directe trailers). Minimale zoom toegevoegd om dit te laten verdwijnen.

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

### Verbetering van de chat

## v1.21.01 — Augustus 2026

### Slimme chat: gangbare woorden verward met titels

Getest in echte omstandigheden: het Slimme chat antwoordde simpelweg "meh" of "idiot" op een obscure film met die naam ("O Bofe", "Ce crétin de Malec") in plaats van de opmerking te begrijpen. Lijst van gefilterde woorden uitgebreid (gangbare interjecties, gebruikelijke beledigingen) om nooit meer een alledaags woord te verwarren met een titelvermelding.

## v1.21.00 — Augustus 2026

### Generatie-installeerder voor Linux + update met één klik

De Linux-installeerder (`packaging/linux/install.sh`) detecteert nu een bestaande installatie en biedt aan deze te updaten (bibliotheek behouden), opnieuw te installeren, of te deïnstalleren — het is niet langer nodig om de repository te clonen: `curl -fsSL .../install.sh | sudo bash` downloadt direct het kant-en-klare bundle van de nieuwste versie. En in de interface werkt de knop "Update met één klik" (Instellingen → Over) nu ook op een native Linux-installatie (systemd-service) — Docker-containers blijven up-to-date via `docker pull`, zoals voorheen.

## v1.20.12 — Augustus 2026

### Voorbeeld bij hover: licht vergroot

Op sommige titels (RoboCop 2014 bevestigd) bleef een dun zwart bandje zichtbaar bovenaan/onderaan het videopreview bij het overglijden over een kaart — de trailer zelf bevat een lichte letterbox. Vergrootvergroot om één niveau, alleen op dit voorbeeld (de startcarrousel en de titelpagina zijn niet van toepassing).

## v1.20.11 — Augustus 2026

### Android mobiel: build-correctie

De Android smartphone build faalde om dezelfde reden als de TV, gecorrigeerd in v1.20.08: het mobiele startscherm had de wijziging in het compacte contract van /api/interface/dashboard niet gevolgd. Ook deze correctie is toegepast.

## v1.20.10 — Augustus 2026

### Slimme chat: levendigere woordgrappen, herhaalde vraag wordt geknipoogd

Het Slimme chat reageert nu op de specifieke inhoud van wat u zegt (geen algemene reactie), onthoudt altijd het laatste woord, en weet een lang gesprek van woordgrappen te beëindigen door echt een film voor te stellen om de sfeer te verlichten. Bovendien: als het merkt dat u een vraag stelt die al eerder in het gesprek beantwoord is, kan het u vriendelijk geknipoogen voordat het antwoordt — nooit ter vervanging van het antwoord.

## v1.20.09 — Augustus 2026

### Slimme chat: toon bij beledigingen, poging 3

Getest in echte omstandigheden: het Slimme chat recycleerde dezelfde zin woordelijk (alleen de belediging veranderde), en raakte soms nog steeds afdwalend naar een lijst met ongevraagde aanbevelingen. Strikt verbod op elke lijst in dit specifieke geval, en expliciete instructie om nooit een eerder gebruikte formule opnieuw te gebruiken in het gesprek.

## v1.20.08 — Augustus 2026

### Android TV: build-correctie

De Android TV build faalde: een documentatiecommentaar bevatte per ongeluk een sequentie die in Kotlin een geneste commentaar opent die nooit wordt gesloten — de rest van het bestand werd onzichtbaar voor de compiler. Gecorrigeerd.

## v1.20.07 — Augustus 2026

### Voorbeeld bij hover: zwarte sluier verwijderd van de video

Op de voorvertoning die verschijnt bij het overglijden van een muis, bedekte het zwarte sluier over de trailer die afspeelt onnodig de afbeelding — alleen verwijderd in dit specifieke geval (de voorbeeldafbeelding/placeholder behoudt zijn sluier voor de leesbaarheid van de titel).

## v1.20.06 — Augustus 2026

### Slimme Chat: making-of nooit meer toegevoegd tenzij expliciet gevraagd

Het toevoegen van een film mag nooit meer een making-of of een afgeleide webserie laten verschijnen — tenzij u dit zelf expliciet vraagt ("het making-of van..."), in welk geval dit nu wordt gerespecteerd in plaats van geblokkeerd.

### Android TV: robuust bij het opstarten

Het compacte contract van het startscherm is nu tolerant voor een onvolledige bibliotheek-invoer — een ontbrekende waarde onderbreekt de laadcyclus niet meer, maar wordt simpelweg genegeerd.

## v1.20.05 — Augustus 2026

### Slimme Chat: toon bij beledigingen, opname 2

Getest in echte omstandigheden: bij een belediging vermeed de Slimme Chat nog te vaag ("doe je me een grap?") en erger nog, transformeerde soms de belediging volledig in een voorwendsel om een lijst met ongevraagde aanbevelingen te plaatsen. Instructie aangescherpt zodat het eerst en echt op de provocatie reageert, zonder van onderwerp te veranderen.

## v1.20.04 — Augustus 2026

### Slimme Chat: toevoegingen/aanbevelingen, minder verkeerde overeenkomsten

Getest in echte omstandigheden: het vragen om de toevoeging van "Terminator 2" of "Terminator Salvation" voegde soms een making-of of een afgeleide webserie toe in plaats van de echte film — een onerkend TMDb bonus-inhoud. En een aanbeveling zoals "The Death of Stalin" kon een bijna anonieme dubbele (1 stem) laten verschijnen in plaats van de echte film, vanwege het feit dat de gelokaliseerde Franse titel niet overeenkwam met de gevraagde titel. Beide zijn gecorrigeerd.

## v1.20.03 — Augustus 2026

### Slimme Chat: betrouwbaardere JSON-aanbevelingen

Versterkt de interne voorbeelden die de Slimme Chat volgt om een lijst met aanbevelingen of toevoegingen te construeren — meerdere titels achter elkaar in plaats van slechts één, met de exacte syntaxis die moet worden gevolgd. Doel: minder gevallen waarin het gegenereerde formaat faalt en een algemene foutmelding triggert.

## v1.20.02 — Augustus 2026

### Slimme Chat: vragen over regisseurs, filmografie en toon

Meerdere natuurlijke formuleringen ("wat heeft X geregisseerd", "hoeveel films heb ik geregisseerd door X"... ) werden niet herkend en gaven een verzonnen antwoord. Gecorrigeerd, en tevens: documentaires worden niet langer vermengd met echte producties in antwoorden over een regisseur, en een aanvraag voor een aanbeveling die soms niet correct kon worden geformuleerd, herstelt nu automatisch in plaats van een algemene foutmelding te tonen. De toon van de Slimme Chat is ook iets responsiever op een flirterige opmerking.

### Bibliotheek: strakke lay-out

Op de Films en Series pagina's namen de filters Beschikbaar/Ontbrekend een hele regel in naast een onnodige lege ruimte. Strakke lay-out, minder verloren ruimte.

## v1.20.01 — Augustus 2026

### Bibliotheek: Plex-aanbevelingen en afleveringen toegevoegd

Films en Series openen nu op een Aanbevolen tabblad, bestaande uitsluitend uit uw bibliotheek: herhaling, recente toevoegingen, gepersonaliseerde selecties, beste beoordelingen en genres. Het volledige Bibliotheekoverzicht blijft beschikbaar in zijn eigen tabblad. Het dashboard toont ook de recentelijk toegevoegde afleveringen, met hun seizoen en afleveringsnummer.

### AI en metadata

De verbeteringen aan de AI-acties, de interpretatie van intenties en de TMDb-oplossing zijn opgenomen in deze versie.

## v1.20.00 — Augustus 2026

### Grote opruiming van GitHub releases

Volledige opruiming van de GitHub releasegeschiedenis: verwijdering van tientallen oude versies die waren opgebouwd, waarbij alleen de nuttige mijlpalen worden bewaard. Geen functionele wijzigingen aan de applicatie.

## v1.19.63 — Augustus 2026

### Terugpakken: menu van de kaart, geen geluidsknop meer

Op de kaarten in het "Terugpakken"-menu (en alle kaarten met videopreview), is de geluidsknop verwijderd — de preview blijft stumm, zonder nuttige knop. De chevron opent nu een menu: "Als bekeken markeren" (wat de kaart ook uit Terugpakken verwijdert) en "Verwijderen uit Terugpakken"-lijst zonder deze als bekeken te markeren. Bovendien zijn de verbeterde trailerbronnen (Apple/IMDb) nu één enkele serverinstelling, plus een gebruikerskeuze.

## v1.19.62 — Augustus 2026

### Zoeken: echte filmografie van regisseurs, films en series gemixt

Het zoeken naar een regisseur (bv. "Christopher Nolan") toonde alleen titels waar zijn naam toevallig in de tekst voorkwam, nooit zijn echte films. De zoekfunctie toont nu zijn echte filmografie, met zijn werken in de voorgrond. Andere correctie: een zoekopdracht mengt nu films en series in dezelfde resultaten in plaats van te eisen dat je van tabblad wisselt. De slimme Chat onderscheidt nu ook "geregisseerd door" van "te zien in" (cameo, productie...) — het verwarringt bijvoorbeeld niet meer een cameo in een serie met een echte geregisseerde film.

## v1.19.61 — Augustus 2026

### Zoeken: altijd zichtbaar in het menu

Correctie: de zoekbalk in het menu verdween nadat je op Ontdekking was (dat zijn eigen aparte balk had). Er is nu maar één, altijd op dezelfde plek, of het nu op het dashboard of al op Ontdekking is. Op mobiel wordt het vergrootglas-icoon een echte zoekbalk in plaats van een simpele link.

## v1.19.60 — Augustus 2026

### Zoeken: direct in het menu, resultaten in kaarten

De zoekfunctie verhuist van het menu "Overal zoeken" naar een echte ingebouwde balk in het linker menu — het typen van een woord opent direct Ontdekking met resultaten in kaarten (films, series, acteurs, regisseurs), in plaats van een klein uitklapmenu. Op mobiel opent het vergrootglas-icoon direct Ontdekking.

## v1.19.59 — Augustus 2026

### Snelle zoekopdracht: acteurs en regisseurs

De snelle zoekopdracht (Ctrl/Cmd+K) vindt nu ook acteurs en regisseurs, naast films, series en pagina's — een resultaat van een persoon opent direct zijn filmografische fiche. Bovendien herkent de slimme Chat nu "hoeveel films heb ik van [regisseur]" als een echte filmografische vraag (voorheen werden alleen formuleringen als "filmografie van X" herkend — een anders gestelde vraag kreeg een verzonnen, ongeverifieerd antwoord).

## v1.19.58 — Augustus 2026

### Trailers: correctie vertaalde titels

Getest in echte omstandigheden: een film als "L'Idée d'être avec toi" kon nooit zijn Apple/Prime trailer vinden, terwijl de originele titel "The Idea of You" deze onmiddellijk vindt — deze catalogi verwijzen bijna altijd naar de films onder hun Engelse titel, niet de Franse vertaling. De zoekfunctie gebruikt nu de originele titel als prioriteit (dezelfde logica die al wordt gebruikt voor het zoeken naar bestanden).

## v1.19.57 — Augustus 2026

### Trailers: correctie traagheid

Getest in echte omstandigheden: het zoeken naar trailers (Apple, Prime...) kon tot 12 seconden duren omdat elke bron afzonderlijk werd gecontroleerd. Ze worden nu allemaal tegelijk gecontroleerd — 4 tot 6 seconden in plaats van 12, zonder het resultaat te veranderen.

## v1.19.56 — Augustus 2026

### Trailers: Prime Video toegevoegd als bron

Na technische livecontrole (gedownload en bevestigd niet-geëncrypteerd videosegment) voegt Prime Video zich toe aan Apple als directe trailerbron voor films — dezelfde instelling, dezelfde automatische terugval naar YouTube. Netflix blijft uitgeschakeld: ook live getest, maar door Netflix geweigerd met een accountbeperking nog voordat het de videostream bereikte.

## v1.19.55 — Augustus 2026

### Apple Trailers: HD/4K kwaliteit + betrouwbaarheidscorrectie

Getest in echte omstandigheden (25+ pogingen, ingeschakeld en uitgeschakeld): een echte bug werd gevonden en verholpen — een reeks verificaties kon ten onrechte doen vermoeden dat een film geen Apple trailer had gedurende 24 uur vanwege een tijdelijke bandbreedtebeperking aan de kant van Apple. Profiteer van deze tests om ook de kwaliteit te verbeteren: de Apple trailer speelt nu via de native HD/4K-stream in plaats van een lage-resolutiebestand, met automatische selectie van de best beschikbare kwaliteit.

## v1.19.54 — Augustus 2026

### Trailers: verbeterde betrouwbaarheid + uitgebreide bronzoekfunctie

De directe trailer-speler (Apple) heeft nu een beveiliging: als het laden na enkele seconden niet vordert (waargenomen in echte omstandigheden), schakelt Movviz automatisch over op YouTube in plaats van vast te lopen. De bronketen is ook uitgebreid naar Netflix, Disney+ en Prime Video — na uitgebreide technische verificatie tonen geen van deze platforms een publieke, exploiteerbare trailer zonder omzeiling van beveiliging of account, dus deze drie bronnen blijven voorlopig inactief (Apple blijft de enige directe bron, YouTube het gebruikelijke vangnet).

## v1.19.53 — Augustus 2026

### Trailers: directe Apple-bron vóór YouTube (optioneel)

Nieuwe instelling (Instellingen → Mijn ervaring, standaard uitgeschakeld): Movviz kan nu proberen een directe Apple-video te gebruiken voordat het terugvalt op YouTube zoals vandaag voor de sfeer van de fiche en de "Trailer bekijken"-speler. Geen verlies van functionaliteit als de Apple-bron niet wordt gevonden of faalt — YouTube blijft het automatische vangnet, en de instelling kan met één klik worden uitgeschakeld om onmiddellijk terug te keren naar het huidige gedrag.

## v1.19.52 — Augustus 2026

### Android-apps: sneller opstarten, correctie afleverlectuur

De TV- en mobiele apps laden nu de bibliotheek bij het opstarten via één compacte snapshot in plaats van twee volledige oproepen, met automatische terugval naar het oude gedrag indien nodig. Correctie ook voor series met Plex- en lokale afleveringen: de afleveringsbron wordt nu aflevering voor aflevering bepaald in plaats van afgeleid van de hele serie, wat een afspeelfout veroorzaakte bij sommige afleveringen. Het TV-profielselectiescherm is herzien.

## v1.19.51 — Augustus 2026

### Slim chat: verzonnen duur en bestandskwaliteit, gecorrigeerd

Bevestigd live: op de fiche van een film kon een vraag over de exacte duur of kwaliteit (4K, HD...) een verzonnen antwoord ontvangen — soms zelfs nadrukkelijk na correctie, terwijl niets van dit werkelijk door Movviz werd overgebracht. De werkelijke duur en kwaliteit van het bestand in de bibliotheek worden nu verstrekt, of het ontbreken van gegevens wordt eerlijk gemeld in plaats van een benaderlijk getal gepresenteerd als echt.

## v1.19.50 — Augustus 2026

### Tags verwijderd

De functionaliteit van aangepaste tags op films en series is volledig verwijderd — geen veld meer in de fiche, geen filter meer in Films/Series, geen bijbehorend menu meer op de kaarten.

### Fiche: visuele afwerking

Scrollbalk van de fiche verborgen, video uitgerekt tot de werkelijke rand van het paneel (hij stopte een beetje ervoor), donkere sluier voor de video minder aanwezig over het grootste deel van het beeld (donkerder alleen naar beneden, om te vervagen met de rest van de fiche), lichte zoom op de videopreview om de fijne zwarte banden te verbergen die sommige trailers soms bevatten. De fijne scheidingslijn onder het bovenmenu is ook verwijderd.

## v1.19.49 — Augustus 2026

### Films en Series openen een fiche in plaats van van pagina te wisselen

Het aanklikken van een kaart in Films of Series laadde een hele pagina opnieuw — net als bij Ontdekking of het Dashboard, opent nu een fiche over de rasterweergave met een fade-zoom effect vanaf de aangeklikte kaart, zonder ooit de pagina te verlaten. Hij is ook breder dan voorheen, om meer ruimte te laten voor de afbeelding en de informatie.

### Aanklikken van de poster start de afspeling, aanklikken van de info opent de fiche

In de vergrote weergave bij het overglijden over een kaart, klikken op de afbeelding of de afspeelknop start de film onmiddellijk; klikken op het informatiegebied (jaar, duur, genres) of de pijl opent de volledige fiche. De kleine preview bij het overglijden wordt niet langer weergegeven bovenop een zojuist geopende fiche.

### Weergave van kaarten vereenvoudigd

De zoom bij het overglijden over de kaartafbeelding is verwijderd (alleen de kaart vergrootte al, de afbeelding die verder zoomde, maakte het effect te zwaar). Het verschijnen van kaarten in een raster bij het laden wordt nu beheerd zonder JavaScript-animatie.

## v1.19.48 — Augustus 2026

### Slim scrollen in Films en Series, met alfabetische index

Op een grote bibliotheek laadde het openen van Films of Series alles in één keer en vertraagde de weergave. Het raster wordt nu in batches van 200 titels gevuld en laadt automatisch verder naarmate men naar het einde scrollt — de ruimte met nog niet weergegeven titels wordt gereserveerd zodat het scrollen nooit springt. Een abrupte sprong verder in de lijst (scrollbalk slepen, Toets Einde) laadt direct het gebied waar men terechtkomt, zonder te wachten op een progressieve inhaalslag vanaf het begin. Bij sorteren op titel verschijnt een A-Z balk in de stijl van Plex aan de zijkant van het scherm om direct naar titels te springen die beginnen met een bepaalde letter.

### Nieuwe instelling: automatische zoekopdracht naar ontbrekende items uitschakelen

Serverinstelling, voor beheerders, in Instellingen → Automatisering: schakelt de RSS-scan, de periodieke herstart van ontbrekende films/afleveringen en de zoekopdracht naar de uitgaven van de dag uit, met één schakelaar. Het volgen per titel en de handmatige knop "Zoeken" blijven normaal functioneren.

## v1.19.47 — Augustus 2026

### Slim chat: bonusinhoud kon voor de echte film worden uitgegeven

Een fiche "uitgesneden scènes" of "making-of" met dezelfde titel als een echte film kon, in zeldzame gevallen, worden voorgesteld in plaats daarvan in een aanbeveling — de weergegeven score was dan gebaseerd op slechts een handvol stemmen. Dit type inhoud wordt nu standaard uitgesloten, het onderscheid tussen twee identieke titels is gebaseerd op het werkelijke aantal stemmen in plaats van alleen de score, en eenzelfde suggestie kan niet meer meerdere keren in hetzelfde antwoord verschijnen.

## v1.19.46 — Augustus 2026

### Instellingen: indexers en downloadclients waren niet langer alleen voor beheerders

De tabbladen "Indexers" en "Downloadclients" waren zichtbaar voor elke gebruiker in Instellingen, terwijl alle gevoelige gegevens daar al beveiligd zijn op de serverkant — gecorrigeerd zodat ze alleen nog zichtbaar zijn voor een beheerder, net als de rest van de serverinstellingen.

### Afbeeldingen van het internet worden een serverinstelling, meer persoonlijk

De keuze om filmposters/logo's direct van TMDb te laden in plaats van via de server (netwerkimpact/belasting voor het hele huis) werd tot nu toe individueel per account bepaald. Het is nu één serverinstelling, in Instellingen → Cache.

### Slim chat: betrouwbaardere aanbevelingen

Drie correcties na een reeks tests onder echte omstandigheden: een technisch codefragment (```json```) kon letterlijk in een antwoord verschijnen; een titel die zijn naam deelt met een oudere/obscure werken kon verward worden met de juiste versie; een documentaire die totaal niet gerelateerd was, kon verschijnen in een lijst met films "vergelijkbaar met" een fictie. De toon en persoonlijkheid blijven strikt ongewijzigd — deze correcties werken alleen op de betrouwbaarheid van de overgedragen gegevens.

### Duidelijker afspeelfoutbericht

Wanneer een video niet afgespeeld kan worden omdat de browser de codec niet kan decoderen (HEVC bijvoorbeeld, vaak in 4K/HDR), geeft het bericht dit nu duidelijk aan in plaats van een algemeen bericht.

## v1.19.45 — Augustus 2026

### Plex-herstellekke tussen accounts gecorrigeerd

Een Plex Home-profiel dat wordt beheerd en het beheerders-token deelt, kon in sommige gevallen worden voorgesteld om de afspeelpositie van het servereigenaarsconto te hervatten in plaats van die van het profiel. Het antwoord van Plex wordt nu geverifieerd voordat het wordt gebruikt: als het exact overeenkomt met dat van de eigenaar in plaats van het gevraagde profiel, wordt het genegeerd in plaats van getoond aan de verkeerde persoon.

## v1.19.44 — Augustus 2026

### Een handmatig verwijderd bestand op de schijf wordt niet meer automatisch opnieuw gedownload

Een hele film, aflevering of serie die rechtstreeks op de schijf is verwijderd (buiten Movviz) komt nu in de Prullenbak in plaats van onmiddellijk opnieuw automatisch te worden gezocht — met een badge "Verdwenen van de schijf" die het onderscheidt van een handmatige verwijdering, en een speciale filter in de Prullenbakpagina. Een item in de Prullenbak wordt nooit automatisch gewist: herstel het om een download opnieuw te activeren (handig bij per ongeluk verwijderen), of maak het definitief leeg — in dat geval vraagt Movviz ook om Plex om zijn eigen verwijzing te laten verwijderen, zodat de volgende synchronisatie het niet automatisch weer doet verschijnen. Het verwijderen van een hele serie groepeert alles in één item in plaats van één per aflevering; het verwijderen van slechts enkele afleveringen laat de rest van de serie intact.

## v1.19.43 — Augustus 2026

### Logo's verdwenen soms van alle kaarten tegelijk

Verholpen: een achtergrondverversing van de dashboardsuggesties kon, voor een fractie van een seconde, de titellogo's van alle zichtbare kaarten tegelijk laten verdwijnen voordat ze terugkwamen. Eenmaal weergegeven, blijft een logo nu op zijn plaats zolang de kaart zichtbaar is, zelfs als de omliggende gegevens stilzwijgend worden vernieuwd.

## v1.19.42 — Augustus 2026

### Afstandsinterface veel sneller

Movviz kan nu een geoptimalde datastroom gebruiken, in te schakelen door een beheerder in Instellingen → Server snelheid en capaciteit. Het dashboard, de ontdekking, de lokale zoekopdracht en navigatiebadges vragen alleen de gegevens die op het scherm nodig zijn in plaats van de volledige bibliotheken te downloaden. Op de referentielibrary stuurt het dashboard ongeveer 89 % minder gecomprimeerde gegevens.

De instelling is globaal voor de server, met een Compatibiliteitsmodus die de historische werking onmiddellijk behoudt voor alle gebruikers. Meldingen worden geladen bij het openen van de bel, real-time updates richten zich alleen op de betreffende gegevens en de downloadwachtrijen passen hun verversingsfrequentie aan aan hun activiteit.

## v1.19.41 — Augustus 2026

### Kaartenovergang dynamischer

De preview die vergroot bij het overgangen van een kaart blijft nu op zijn plaats tijdens het scrollen van de pagina in plaats van vast te zitten op het scherm, sluit onmiddellijk bij scrollen, en verschijnt nu met een echte progressieve zoom-effect in plaats van een simpele vervaging. De kaarten op het dashboard zijn ook licht verkleind om beter te harmoniseren met die van Films en Series.

### Verminderde achtergrondnetwerklaadproblemen

De automatische voorlading van fiche, die werd geactiveerd bij elke zichtbare kaart op het scherm terwijl de fiche in werkelijkheid in een paneel opende zonder ooit echt te navigeren, wordt niet meer geactiveerd — minder onnodige achtergrondaanvragen tijdens het navigeren.

## v1.19.40 — Augustus 2026

### Opschoning van de publicatie

De interne documenten die zijn gebruikt om de herziening van de instellingen voor te bereiden, zijn verwijderd uit de openbare distributie. De werking van het controlecentrum en de instellingen blijft strikt ongewijzigd.

## v1.19.39 — Augustus 2026

### De instellingen worden een echt controlecentrum

Het instellingenoverzicht controleert nu live Plex, de downloadengine, de metadata en de opslag. De lampjes gaan successief aan, geven een duidelijk oordeel over de status van Movviz en openen direct de instelling die gecorrigeerd moet worden wanneer er aandacht is nodig.

### Essentiemodus en begeleide parcoursen

De lange technische lijst maakt standaard plaats voor vijf begrijpelijke doelen: Mijn ervaring, Lezen, Bibliotheek en Plex, Downloads, en vervolgens Server en gegevens. Elk pad legt uit wat het bevat, onderscheidt essentiële keuzes van geavanceerde hulpmiddelen en behoudt een contextueel terugkoppeling. De gememoriseerde Expert modus geeft onmiddellijke toegang tot de 25 secties, zonder enige verwijderde optie.

### Zoeken en meer menselijke labels

De zoekfunctie vindt nu ook de geavanceerde instellingen vanuit de Essentie modus. Vage namen zoals "Ervaring", "GPU", "Prestaties" of "Onderhoud" beschrijven nu hun werkelijke functie. Oude links `?tab=` blijven compatibel en standaardgebruikers activeren niet langer onnodig de controles voor de beheerder.

## v1.19.38 — Augustus 2026

### Een fiche kon blijven hangen in de laadstatus voor onbepaalde tijd

Verholpen: het ophalen van informatie van een titel bij TMDb had geen tijdslimiet — een abnormaal langzame reactie was voldoende om de fiche voor onbepaalde tijd op het laadscherm te laten hangen, zonder ooit te falen of opnieuw te proberen. Er is nu een redelijke tijdslimiet ingebouwd, met een nieuwe automatische poging voor elke andere netwerkfout.

### Instelling "Leesmotor" verduidelijkt: Stabiel / Auto / Beta

De beheerinstelling Instellingen → Plex krijgt twee nieuwe opties. "Stabiel" fixeert expliciet het huidige leesgedrag, gegarandeerd om nooit te veranderen zelfs als "Auto" later wordt aangepast. "Beta" is de nieuwe beslissingsmotor, nu in staat om zowel films als afleveringen van series te beheren (vooralsnog beperkt tot films). Automatische en puntuele migratie bij deze update: ongeacht de huidige keuze, gaat het één keer terug naar "Auto" — om iedereen te beschermen die handmatig de oude experimentele motor had geselecteerd in de veronderstelling dat het niets zou veranderen.

### HDR/Dolby Vision content wordt nooit meer geconverteerd naar SDR

Absolute regel nu: een HDR of Dolby Vision titel wordt afgespeeld zoals deze is, nooit met een kleurconversie naar een standaardweergave, zelfs als een transcodering toch nodig is om een andere reden. Een apparaat dat HDR niet native ondersteunt, toont het beeld zoals het is in plaats van te wachten op een kostbare conversie.

### Nauwkeuriger leesindicator

Het badge dat wordt weergegeven tijdens het afspelen (kopie/remux/lokale transcodering) geeft nu aan of hardware- (GPU) of software- (CPU) encoding wordt gebruikt.

## v1.19.37 — Augustus 2026

### Verticale videopreviews in trends en op fiches

Verholpen: sommige videopreviews (carrousel, fiche) werden weergegeven in een verticale, sociaal-mediastijl in plaats van het gebruikelijke cinematografische formaat. De detectie die deze verticale clips moest uitsluiten, vroeg de verkeerde data op en werkte in werkelijkheid nooit sinds de implementatie — het is nu betrouwbaar. Een studio kan ook een echte reeks verticale clips achter elkaar publiceren voor dezelfde titel; de selectie valt nu correct terug op de klassieke trailer in plaats van vast te lopen. Verholpen is ook een videospeler die in een verkleind formaat kon worden weergegeven in plaats van het hele kader te vullen.

## v1.19.36 — Augustus 2026

### Web-, Android TV- en smartphoneversies zijn uitgelijnd

De fallbackwaarden van de twee Android-projecten zijn nu `1.19.36` met de `versionCode` `11936`, net als de webserver en de release tag. De door CI gebouwde APK's gebruiken al de tag, en lokale builds / "Over" schermen kunnen geen oudere versie meer aankondigen.

## v1.19.35 — Augustus 2026

### Cinematografische carrousel die verdween en dan in een lus terugkwam

Verholpen: de YouTube API verving zelf een knooppunt dat React moest verwijderen na een dia. Dit veroorzaakte een `removeChild`-fout, waarna het herstelmechanisme de held voortdurend omhoog stuurde. De YouTube-speler is nu geïsoleerd van de door React beheerde DOM; een persistente fout kan de carrousel niet langer voor onbepaalde tijd opnieuw starten.

## v1.19.34 — Augustus 2026

### De toggle "Afbeeldingen vanaf het internet" schakelde zichzelf uit

Verder: het activeren leek even te werken en keerde dan terug naar uit. Het opslaan van de instelling werd stilzwijgend afgewezen door de serverkant (lijst van erkende instellingen nog niet bijgewerkt) — de instelling blijft nu correct staan.

### Logo van de titel ontbreekt op het profiel, smartphone

Het profiel van een film of serie op Android smartphone toonde nooit het TMDb logo van de titel (alleen de titel in tekst), in tegenstelling tot de rest van de app. Verder — dezelfde logica als overal: het logo vervangt de teksttitel wanneer TMDb er een heeft.

## v1.19.33 — Augustus 2026

### Ontdekking op Android TV en smartphone

Beide Android clients vangen Ontdekking in: dezelfde redactionele rijen als op het web (inclusief de gepersonaliseerde rij "omdat je gekeken/geliket hebt"), hetzelfde filter per genre met Anime en Jeugdromantiek inbegrepen, "Alles zien" in een gepagineerde rasterweergave. Nieuw op smartphone, waar deze sectie nog niet bestond.

### Android speler — dezelfde styling als het web

De voortgangsbalk en het scherm "Optimalisatie bezig" (met het geanimeerde logo) zijn identiek overgenomen op beide Android clients, voor een consistente ervaring ongeacht het apparaat. Op smartphone toont de miniatuur die verschijnt bij het schuiven van de schuifregelaar nu een echte voorvertoning van het beeld op dat moment, en niet alleen een tijdsindicator.

### Realtime downloadstatus van series op Android TV

Het profiel van een serie op Android TV toont nu, voor elke afgeronde aflevering, de voortgang, de snelheid en de resterende tijd — live bijgewerkt, zonder het profiel te hoeven verlaten en opnieuw te openen. Afgestemd op wat de smartphone client al bood.

## v1.19.32 — Augustus 2026

### Afbeeldingen direct geladen vanaf het internet (optioneel)

Nieuwe instelling in Instellingen → Ervaring: filmposters, achtergronden en logo's kunnen nu direct vanaf TMDb worden geladen in plaats van altijd via je eigen server — handig als je uploadverbinding beperkt is. Automatisch terug naar je server als TMDb niet beschikbaar is. Standaard uitgeschakeld: niets verandert zolang je het niet activeert. Een tweede instelling, beschikbaar nadat de eerste is geactiveerd, geeft prioriteit aan je server wanneer je op je thuisnetwerk bent (geen belang om in dit geval op het internet te gaan).

## v1.19.31 — Augustus 2026

### Ontdekking personaliseert echt

Films en series krijgen elk een vaste rij over wat je het meest bekijkt (of het beste hebt beoordeeld) — wordt nooit weergegeven als er nog niet genoeg geschiedenis is. De voorgestelde titels gaan verder dan alleen het genre: de smaakmotor die elders in de app wordt gebruikt, verfijnt de rangschikking op basis van de werkelijke stijl van de titel die als startpunt diende, niet alleen op basis van zijn TMDb-categorie.

## v1.19.30 — Augustus 2026

### De vergrote voorvertoning bleef zichtbaar na het openen van een profiel

Op een poster klikken om het profiel te openen liet de vergrote voorvertoning (met de video) zweven erbovenop, in plaats van te sluiten. Het sluit nu onmiddellijk bij een klik.

## v1.19.29 — Augustus 2026

### Meer portretformaat trailers in voorvertoningen

Sinds de teaser wordt verkozen boven de klassieke trailer voor geanimeerde achtergronden (carrousel, profiel, posterovergang), publiceren sommige studio's hun teaser in verticaal formaat (ontworpen voor sociale media) — uitgerekt/ingekaderd in een 16:9 doos, was het resultaat slecht. Verticale video's worden nu uit de selectie gehouden; de teaser blijft altijd verkozen wanneer een versie in het juiste formaat beschikbaar is.

## v1.19.28 — Augustus 2026

### Video voorvertoning bij het overglijden over een poster

Op desktop, het cursor over een film- of serieposter laten zweven (dashboard, ontdekking) gedraagt nu de vergrote voorvertoning zich als een geanimeerde achtergrondtrailer, net als op de profielpagina's — uit te schakelen via Instellingen → Ervaring → Video voorvertoningen (dezelfde instelling dekt nu beide plekken).

### Suggesties bevatten geen onbeoordeelde of nog niet uitgebrachte titels

De suggestierijen (dashboard en Ontdekking) konden een titel voorstellen zonder beoordeling of nog niet in de bioscoop — niets om te zeggen, niets om te zien. Ze tonen nu alleen titels die al beoordeeld en al uitgebracht zijn, behalve de rijen die expliciet gewijd zijn aan wat binnenkort komt.

### Android TV Client — nieuwe Ontdekkingrijen

De recent toegevoegde rijen op de webkant (geprezen door de kritiek, anime universum, tienerromantiek, kort formaat, rijen per genre) worden nu weergegeven met hun correcte Franse titel op de Android TV client, in plaats van een algemene titel.

## v1.19.27 — Augustus 2026

### De video overstroomde bovenaan en onderaan op een ultrawijd scherm

Op een scherm groter dan 16:9 (ultrawijd) schaalde de speler de video niet meer correct: in plaats van zijn verhoudingen te behouden met zwarte balken aan de zijkanten, strekte hij zich uit over de breedte van het venster en overstroomde hij bovenaan en onderaan, waardoor de boven- en onderkant van de afbeelding werden afgesneden. Verholpen — de video behoudt altijd zijn oorspronkelijke verhoudingen, ongeacht het schermformaat.

## v1.19.26 — Augustus 2026

### De nieuwe Ontdekkingrijen waren niet voor iedereen zichtbaar

De Instellingenpagina stelt u in staat te kiezen tussen twee weergaven voor Ontdekking ("Movviz" of "Allociné"). De nieuwe rijen toegevoegd in v1.19.24 (geprezen door de kritiek, anime universum, tienerromantiek, kort formaat, rijen per genre) waren alleen ingeschakeld voor de standaardweergave — onzichtbaar voor iedereen die de andere had gekozen. Ze verschijnen nu op beide, met dezelfde inhoud.

## v1.19.25 — Augustus 2026

### Oneindige update-lus op Android TV

De applicatie installeerde zichzelf opnieuw als een "update" bij elke opstart, zelfs kort nadat deze was toegepast: het interne versienummer bleef vastzitten op een oudere waarde in plaats van het daadwerkelijk gepubliceerde versienummer te volgen, waardoor het zich voortdurend achtergesteld voelde. Het biedt nu alleen een update wanneer er echt een is. Het versienummer weergegeven in "Over" van de Android smartphone client was op dezelfde manier vastgelopen (zonder gevolgen, deze client heeft nog geen automatische update) en is verholpen.

## v1.19.24 — Augustus 2026

### Ontdekking uitgebreid, en twee nieuwe gedeelde genres

De Ontdekkingpagina toont nu veel meer redactionele rijen (geprezen door de kritiek, anime universum, tienerromantiek, kort formaat, plus meerdere rijen per genre) naast de reeds bestaande. Twee nieuwe genres verschijnen in het Genremenu, waar ze al bestaan: "Anime" en "Tienerromantiek" (ontworpen voor een hedendaags tienerpubliek, niet voor kinderen). De Films- en Seriespagina's krijgen ook een filter per genre naast de bestaande filters, met dezelfde lijst van genres als in Ontdekking — inclusief Anime en Tienerromantiek, zodat u gemakkelijk kunt terugvinden wat u al bezit.

## v1.19.23 — Augustus 2026

### Zoeken naar release mislukt voor een originele titel in niet-Latijns script

Een film of serie waarvan de originele TMDb-titel in Japans, Chinees, Koreaans, Russisch, Arabisch, Thais... is geschreven, kon geen release meer vinden om te downloaden: de automatische zoekopdracht gaf altijd de voorkeur aan de originele titel, maar er wordt nooit een release-scène met deze schriften genoemd. Het valt nu terug op de gelokaliseerde titel (die in Movviz wordt weergegeven) zodra de originele titel niet bruikbaar is voor een zoekopdracht, zowel voor films als voor series.

### Nieuwe instellingenstartpagina

De Instellingenpagina opent nu op een startpagina met een zoekopdracht op basis van intentie ("ontbrekende film", "traagheid", "Plex"...), statuskaarten (Plex, downloadclient, metadata, opslag) en snelkoppelingen naar de meest gebruikte instellingen. De bestaande zijbalk blijft vanaf elke instelling toegankelijk — alle `?tab=...` links die al in omloop waren, blijven onveranderd functioneren.

### De pagina "Activiteit" heet nu "Downloads"

Het menu noemde dit gedeelte al "Downloads", maar de pagina zelf toonde nog steeds "Activiteit" / "Activiteitscentrum", en het adres bleef `/activity`. Beide zijn nu uitgelijnd: de pagina leeft op `/downloads` en toont "Downloads" overal. Het oude adres `/activity` leidt nu automatisch door naar het nieuwe, met behoud van het actieve tabblad — geen bestaande link of favoriete bladwijzer breekt.

## v1.19.22 — Augustus 2026

### Audio-/ondertiteling-trackwissel: einde van de stille terugval naar het oude circuit

Verbetert een ernstige regressie in de nieuwe lokale afspeelmotor: het wijzigen van de audiostream of ondertiteling tijdens het afspelen liet het falen en viel terug op het oude Plex/HLS-circuit (badge "Transcodeerd (audio)", positie gereset naar 0). Het wisselen van de track gaat nu correct via de nieuwe end-to-end motor, zonder enige terugval. De knop "Transcodemodus" (flits), die alleen het oude circuit aanstuurde en niet meer nodig was, is verwijderd. Verbetert ook een geval waarin een Engelse audiostream in het menu met het label "Frans" kon worden weergegeven (het label kwam van Plex, nu overschreven met de echte tags van het bestand).

## v1.19.21 — Augustus 2026

### Duim omlaag overal, en echt nuttig voor suggesties

De duim omlaag verschijnt nu op alle kaarten (inclusief de bibliotheek, zonder ooit de titel uit uw collectie te verwijderen) — erop klikken verwijdert alleen de kaart van de weergegeven rij. Het stuurt ook het genre van de titel naar de aanbevelingsmotor, die nu in de toekomst vergelijkbare titels kan vermijden in plaats van alleen deze specifieke titel uit te sluiten.

## v1.19.20 — Augustus 2026

### Het "optimalisatie bezig" sluier volgde niet het echte start van het afspelen

Verbetert een regressie geïntroduceerd in 1.19.17: het schermvullende sluier sloot op een vaste timer van 1,5s in plaats van het werkelijke start van het afspelen te volgen, wat kon leiden tot te vroeg (voordat een audioswitch echt klaar was) of te laat. Het sluit nu precies wanneer het afspelen daadwerkelijk begint — direct als er geen switch nodig is, of getranscodeerd als er een switch heeft plaatsgevonden.

## v1.19.19 — Augustus 2026

### Selectie van trailers en teasers herzien op basis van context

De carrousel van het dashboard en de achtergrondanimatie van de titelkaart geven nu de voorkeur aan een teaser (korte preview) boven een volledige trailer, met automatische terugval als er geen teaser bestaat — het omgekeerde voor de vrijwillige actie "trailer bekijken" op de kaart, die altijd de voorkeur geeft aan de volledige trailer. In beide gevallen volgt de volgorde de actieve taal van de gebruiker, dan de originele taal van de film of serie, en daarna de 4 andere talen van Movviz. De Android TV-client profiteert van dezelfde selectie op zijn eigen startcarrousel.

## v1.19.18 — Augustus 2026

### Duim omlaag op suggesties

Een knop "niet geïnteresseerd" verschijnt nu naast de duim omhoog op de rijen "Aanbevolen voor u" en "Trends" op het dashboard: een klik sluit de titel definitief uit van toekomstige gepersonaliseerde aanbevelingen en verwijdert deze onmiddellijk uit de weergegeven rij.

## v1.19.17 — Augustus 2026

### Einde van de "direct afspelen dan audioswitch" flits bij het starten

Bij direct afspelen werd de detectie van audio stilte in de achtergrond uitgevoerd terwijl de video al zichtbaar en hoorbaar was voor de gebruiker — wanneer het geluid incompatibel bleek, waren de directe start en de switch naar audio-transcodering zichtbaar op het scherm, met een storende flits. Een schermvullend sluier met de Movviz-logoanimatie bedekt nu de gehele start, totdat bevestigd is dat het geluid werkt (bijna onmiddellijke bevestiging in het normale geval, tot 800ms in het zeldzame geval van een daadwerkelijk te detecteren stilte).

## v1.19.16 — Augustus 2026

### De automatische benchmark wacht nu tot de server gestabiliseerd is

Vastgesteld in echte omstandigheden direct na de uitrol van 1.19.14: de allereerste automatische benchmarkuitvoering (direct na een update) mat een significant lager resultaat dan een tweede handmatige poging enkele momenten later, op dezelfde server — vervuild door de opstartbelasting van de server zelf, geen echte weerspiegeling van zijn capaciteiten. Een korte vertraging voordat de automatische trigger nu de server eerst de kans geeft om te stabiliseren.

## v1.19.15 — Augustus 2026

### Niet-UTF-8 ondertitels (oude Franse releases) eindelijk betrouwbaar

Een ondertitel gecodeerd in een oud formaat (Windows-1252, gebruikelijk op oudere Franse releases) liet de beeldoverlay crashen en produceerde een lege ondertitelfil als er geen zichtbare fout was voor de extractie. Automatische detectie van de juiste codering vóór verwerking — een bestand dat al correct is gecodeerd (de overgrote meerderheid vandaag) wordt nooit aangeraakt.

## v1.19.14 — Augustus 2026

### Serverbenchmark, opruiming van de handmatige afspeelselector, en verschillende achtergrondcorrecties

- **Serverbenchmark** (Instellingen → Prestaties): meet direct de werkelijke transcodersnelheid van deze server voor representatieve gevallen (eenvoudige software, software met HDR→SDR conversie, hardware indien beschikbaar) — in plaats van dit te ontdekken tijdens het afspelen. Start handmatig, automatisch direct na het installeren van een update, en één keer per maand via een geplande taak.
- **Gecorrigeerde HDR-detectie van het scherm**: de browser meldde nooit zijn werkelijke HDR-capaciteit aan de server — gecorrigeerd met echte detectie.
- **Opgeruide handmatige "Transcodemodus" selector**: deze opties (Alleen audio, Alleen video, Handmatige HLS) stuurden alleen het oude Plex-circuit — ze faalden stil bij puur lokale inhoud. Ze verschijnen nu alleen wanneer een echte Plex-link bestaat.
- **Ingebouwde cover art wordt nooit verward met de hoofdvideo**: een bestand met een ingebouwde omslagafbeelding kon, in zeldzame gevallen, deze afbeelding laten analyseren alsof het de film was.
- **Beperking van gedeelde transcodesessies** tussen de nieuwe engine en het oude Plex-circuit, in plaats van twee onafhankelijke limieten die zich kunnen opstapelen.
- **Opruiming bij serverstop**: nog actieve transcodeprocessen worden nu correct gestopt bij een herstart/heruitrol, in plaats van wees te blijven.

## v1.19.13 — Augustus 2026

### Nieuwe engine (experimenteel): HDR/Dolby Vision forceert nooit meer een videotranscodering

Verandering van achtergrond in plaats van een extra instelling: een HDR- of Dolby Vision-verschil tussen het bestand en het afspeelapparaat triggert niet langer alleen een videotranscodering. De video wordt zo gekopieerd — een niet-Dolby Vision-compatibele decoder toont het beeld nog steeds correct, alleen met een iets minder nauwkeurige kleurreproductie dan de perfect gekalibreerde versie. Op modeste hardware weegt het vermijden van een kostbare videotranscodering (vaak bestemd om nooit in realtime af te spelen) verreweg zwaarder dan dit rendercompromis. Een echte videotranscodering blijft normaal getriggerd voor elke echte incompatibiliteit (codec, profiel, niveau, kleurdiepte, resolutie) — in dat geval blijft de HDR→SDR conversie toegepast.

## v1.19.12 — Augustus 2026

### Nieuwe engine (experimenteel): HDR→SDR conversie bleef te zwaar zelfs na 1.19.11

Gemeten in real-time op de meest veeleisende inhoud (4K Dolby Vision), zonder andere belasting op de server: het afspelen vorderde slechts met ongeveer 30% van de benodigde werkelijke snelheid, stabiel over meerdere metingen — geen simpele vertraging bij het opstarten.

- **Gecorrigeerd**: de resolutielimiet voor de combinatie software-encoding + HDR→SDR conversie gaat van 1280 naar 720 pixels breed. De HDR→SDR conversie zelf (niet de decodering, ongeacht de uitvoerresolutie) domineert de rekentijd bij dit soort inhoud verreweg — het verder verlagen van de doelresolutie vermindert zijn kosten direct. Nog te bevestigen in echte omstandigheden.

## v1.19.11 — Augustus 2026

### Nieuwe engine (experimenteel): snellere encoding preset voor het meest veeleisende HDR→SDR geval

Voltooid direct de correctie van 1.19.10: vraagt de software-encoder om de compressie minder te optimaliseren (bestand iets groter, in ruil voor veel minder berekening per beeld) geeft hem een echte marge om voorop te blijven tijdens het afspelen — alleen toegepast op de combinatie software-encoding + HDR→SDR conversie, de enige die dit nodig had; alles andere (inclusief een simpele software-encoding zonder HDR) behoudt exact dezelfde instelling als voorheen.

## v1.19.10 — Augustus 2026

### Nieuwe engine (experimenteel): de HDR→SDR conversie had zijn eigen resolutielimiet nodig

Derde correctie gevonden bij live testen op de productieserver, op een nog veeleisenderere inhoud (4K Dolby Vision): zelfs na de twee correcties van 1.19.08 en 1.19.09, raakte deze specifieke inhoud nog steeds in de buffer zonder ooit verder te komen.

- **Oorzaak gevonden en gecorrigeerd**: De conversie van HDR naar SDR (nodig wanneer het afspeelapparaat HDR niet kan weergeven) voegt een echte extra rekenkosten toe, voorbij de simpele encoding — bevestigd door directe vergelijking met 4K inhoud van vergelijkbare resolutie die deze conversie niet vereiste, en die perfect de afspeling volgde. De resolutielimiet voor software-encoding is nu strenger, specifiek wanneer een HDR→SDR conversie ook nodig is, om dit veeleisende geval een echte kans te geven om in real time voorop te blijven.

## v1.19.09 — Augustus 2026

### Nieuwe engine (experimenteel): de back-up doelvideo volgde de live-stream slecht op een bescheiden server

Opnieuw gevonden bij echt testen in productie, deze keer gemeld door daadwerkelijk kijken: op 4K inhoud zonder daadwerkelijk bruikbare hardware-encoder (zie correctie van 1.19.08), raakte de transcodering elke paar seconden in een lus in de buffer in plaats van normaal de afspeling te volgen.

- **Oorzaak gevonden en gecorrigeerd**: Wanneer er geen daadwerkelijk beschikbare hardware-encoder is, werd het doelvideoformaat voor transcodering uitsluitend gekozen op basis van wat het afspeelapparaat het liefst decodeert (vaak het meest gecomprimeerde, dus het duurste om te produceren) — zonder rekening te houden met het feit dat de encoding in software zou plaatsvinden. Een software-encoding van dit formaat is aanzienlijk langzamer dan een eenvoudiger formaat, waardoor het de afspeling niet meer in real time kon volgen op bescheiden hardware. De server kiest nu het eenvoudigste formaat om in software te encoderen zodra er geen daadwerkelijk bruikbare hardware-encoder is, terwijl het het meest efficiënte formaat behoudt zodra er wel een echte hardware-encoder beschikbaar is.

## v1.19.08 — Augustus 2026

### Nieuwe engine (experimenteel): kritische correctie, gevalideerd onder echte omstandigheden

Het "Auto" modus activeren getest op de productieserver (bescheiden hardware, zonder dedicated grafische kaart) — een eerste film (video + audio geëncodeerd) werkte perfect, maar een tweede (4K HDR, volledige video transcodering) faalde onmiddellijk met een misleidende melding om te openen in Plex, terwijl deze film geen Plex-link heeft.

- **Oorzaak gevonden en gecorrigeerd**: De server vertrouwde op de lijst met video-encoders gecompileerd in ffmpeg om te bepalen of het hardware-acceleratie kon gebruiken — maar een gecompileerde encoder betekent niet dat de bijbehorende hardware daadwerkelijk aanwezig is. Op deze server was een Intel QuickSync encoder wel gecompileerd, maar er was geen compatibele Intel-chip blootgesteld, en de poging tot encoding crashte onmiddellijk, zonder back-up. De server voert nu een echte micro-encoding verificatie uit voor elke hardware-acceleratiefamilie voordat het erop vertrouwt, en schakelt over op software-encoding als deze test daadwerkelijk faalt.

## v1.19.07 — Augustus 2026

### Nieuwe engine (experimenteel): volledige audit en fundamentele correcties

Na een systematische audit van de transcoderingfundamenten (twee toegewijde passes, waaronder een volledige hercontrole van de verificaties ten opzichte van het originele plan):

- **Verbeterde videokwaliteit op hardware-encoder** : De kwaliteitsinstelling (`-crf`) werd stilzwijgend genegeerd door elke hardware-encoder (NVENC/QuickSync/VAAPI/AMD), wat resulteerde in een zeer lage vaste bitrate, ongeacht de resolutie — getest op echte NVIDIA-hardware, waarbij een 4K-encoding dezelfde kwaliteit opleverde als een minuscule encoding. Elke encoderfamilie gebruikt nu zijn eigen werkelijke kwaliteitsinstelling.
- **Resolutielimiet voor software-encoding** (geen hardware-encoder beschikbaar, typisch een NAS): Een 4K-bron wordt nu naar 1080p geschaald voordat de software-encoding plaatsvindt, om in staat te blijven om real-time afspelen bij te houden in plaats van in de achterstand te raken.
- **Precisievere scrubbing tijdens transcodering**: Een sleutelframe-interval ontbrak, waardoor de cursor ~10 seconden terugviel in plaats van naar de aangeklikte positie — gecorrigeerd naar 2 seconden.
- **Ontbrekende lettertypen voor productie-onderkoping**: Image-ondertitelingen (PGS/VobSub, bijna alle BluRay) maakten tekst onzichtbaar of veroorzaakten een crash tijdens de transcodering — de Docker-image installeert nu de benodigde lettertypen.
- **Verfijnde detectie van browsercapaciteiten**: De klepdiepte (8/10 bits) en de maximale decodeerbare resolutie worden nu nauwkeurig per codec gecontroleerd, in plaats van genegeerd te worden door gebrek aan gegevens — een 10-bit HDR-bestand dat de browser niet daadwerkelijk kan decoderen, wordt nu correct geïdentificeerd als incompatibel in plaats van direct afgespeeld te worden.
- **AC-3/E-AC-3 correctie**: Een spoor dat enkel op basis van een technisch signaal dat niet betrekking had op deze engine als compatibel werd beschouwd, kon een stille stream produceren — gecorrigeerd om het juiste signaal te vertrouwen.

Nog voor later vermeld (zie `TODO_POST_MOTEUR_LECTURE.md`): Encoding van niet-UTF-8 onderteksten (oude Franse releases), interne fallback-cascade in geval van falen tijdens het afspelen, gedetailleerd diagnostisch paneel.

## v1.19.06 — Augustus 2026

### Nieuwe engine (experimenteel) standaard ingeschakeld voor lokale inhoud, en belangrijke audio-correctie

- De "Nieuwe engine" beperkt zich niet langer tot handmatige selectie in Instellingen → Plex: in "Auto"-modus (standaard) neemt het nu automatisch het over voor een lokale film/aflevering (niet gekoppeld aan Plex) waarvan de audio of video aangepast moet worden — een geval dat tot nu toe geen functioneel vangnet had en systematisch faalde.
- Belangrijke correctie: Een transcodeerde 5.1/7.1 audio-spoor werd niet naar het juiste aantal kanalen geschaald — het kwam nog steeds uit als 5.1/7.1, zelfs bij een 2.0 audio-uitgang, met ontbrekende stemmen (het centrale spoor, waar het dialoog meestal zit, werd niet correct naar de linker/rechterkanalen geschaald). Een systeem dat expliciet niet meer dan 2 kanalen meldt, wordt nu standaard als stereo behandeld, en de audio wordt correct naar het juiste aantal kanalen geschaald tijdens de transcodering.
- Correctie: Een zoekactie terwijl een eerdere nog bezig was, kon in zeldzame gevallen in de war raken en een stream afspelen die overeenkwam met een andere positie dan de weergegeven — nu kan alleen het allerlaatste verplaatsingsverzoek in werking treden.

## v1.19.05 — Augustus 2026

### Nieuwe engine (experimenteel): Verfijnde HDR / Dolby Vision afhandeling

- Een Dolby Vision-bestand waarvan de basislaag nog steeds compatibel is met HDR10 (het grootste deel van recente BluRay UHD's) wordt nu direct afgespeeld, zonder onnodige transcodering, zelfs als het apparaat geen expliciete Dolby Vision-ondersteuning meldt.
- Wanneer geen directe conversie mogelijk is (Dolby Vision niet compatibel met HDR10, of HDR10/HLG op een apparaat dat dit niet meldt), wordt de video correct naar SDR geconverteerd tijdens de transcodering in plaats van opnieuw te worden ingekodeerd met verkeerd geïnterpreteerde ruwe HDR-kleuren.
- Betreft alleen de "Nieuwe engine (experimenteel)" geïntroduceerd in v1.19.04 — standaardgedrag ongewijzigd.

## v1.19.04 — Augustus 2026

### Nieuwe afspeelengine (experimenteel, handmatig, lokale bestanden)

- Instellingen → Plex → Beta-speler biedt een nieuwe afspeelmotoroptie, "Nieuwe motor (experimenteel)" — nooit automatisch geactiveerd, expliciet te selecteren. Voor een lokaal opgehaalde film of serie vervangt/past deze het bestand aan via een echte technische analyse (ffprobe) in plaats van simpele aannames: container remuxing, audio-adaptatie, video-transcodering met keuze voor hardware-encoder als de server die heeft, en ondertiteling inbedden wanneer geen andere oplossing mogelijk is.
- Vult een echt gat: tot nu toe had een lokaal bestand (niet gekoppeld aan Plex) waarvan de audio niet door de browser kon worden afgespeeld, geen back-up — de afspeling faalde simpelweg. Deze optie corrigeer dit specifieke geval, zonder het standaardgedrag te wijzigen.

## v1.19.03 — Augustus 2026

### Uitgebreide technische analyse voor series, en audiobadge gecorrigeerd voor de Franse taal

- De technische analyse (ffprobe) dekt nu ook afleveringen van series, niet alleen films: Instellingen > Onderhoud biedt een speciale sectie voor series (zelfde twee knoppen, gebruikelijke analyse en volledige analyse), en een net opgehaalde aflevering wordt automatisch geanalyseerd zodra deze binnenkomt, net als voorheen het geval was bij films.
- Correctie: bij een bestand met meerdere audio-sporen (bv. Frans in TrueHD, Engels in AAC) kon het audio-codec badge het Engelse spoor weergeven terwijl het niet het primaire spoor was — het geeft nu de voorkeur aan het Franse spoor als dit bestaat.

## v1.19.02 — Augustus 2026

### Codec-badges automatisch gecorrigeerd door technische analyse

- Nadat een film is geanalyseerd (ffprobe), worden de resolutie-/video-codec-/audio-codec-/HDR-badges op het profiel automatisch gecorrigeerd als ze onjuist of ontbrekend waren — zonder ooit iets te wissen voor een nog niet geanalyseerde film.
- Verhelpt een echte bug gevonden tijdens de tests: een 4K film die is ingekaderd voor een bioscoopverhouding kon verkeerd worden gecategoriseerd als 1080p.

## v1.19.01 — Augustus 2026

### Technische analyse: automatisch bij het ophalen van een film, en knop "Volledige analyse"

- Een film wordt technisch geanalyseerd (ffprobe) zodra deze wordt opgehaald — het is niet langer nodig om de analyse handmatig te starten zodat een net gedownloadde film wordt gedekt.
- Instellingen > Onderhoud biedt nu twee knoppen: de gebruikelijke analyse (negeert wat al up-to-date is) en een "Volledige analyse" die de hele catalogus dwingt opnieuw te analyseren.

## v1.19.00 — Augustus 2026

### Technische analyse van de bibliotheek (ffprobe)

- Nieuwe knop in Instellingen > Onderhoud: analyseert elke film via ffprobe (exacte codec, profiel, HDR/Dolby Vision, echte audio- en ondertitelsporen) en slaat het resultaat per bestand in de cache op — het eerste onderdeel van de toekomstige afspeelmotor, die zo de beste afspeelstrategie kan bepalen zonder een reeds bekend bestand opnieuw te analyseren.
- Werkt in de achtergrond zoals de andere bibliotheekanalyses, met zijn eigen voortgangsbalk.

## v1.18.08 — Augustus 2026

### Bibliotheek: vereenvoudigde werkbalk (Films en Series)

- Filters "Download" en "Komend" verwijderd (redundant met de statusbadge op elke kaart).
- Het automatische tag "plex" (toegepast op alles wat van een Plex-synchronisatie komt, dus nooit een echt nuttig filter) verschijnt niet meer in de lijst met tags.
- De 3 adminacties (zoeken naar ontbrekende, schijfreconciliatie, zoeken en vervangen) worden omgezet naar compacte iconen met tooltip — het zoeken naar ontbrekende behoudt zijn voortgangsteller in een klein badge.

## v1.18.07 — Augustus 2026

### Correctie: de hero op het dashboard verdween willekeurig

- Oorzaak geïdentificeerd in de console: een trailer (YouTube-speler) kon botsen met de overganganimatie op het exacte moment dat de hero zich ontmantelde, waardoor deze verdween tot de volledige pagina opnieuw werd geladen. Het wordt nu na een paar seconden vanzelf opnieuw weergegeven.
- Versterkt: twee ontbrekende velden in de gegevens van een suggestie (genres, reden voor keuze) kunnen de hero niet meer laten crashen.

## v1.18.06 — Augustus 2026

### Zijbalk: Collecties niet langer gemarkeerd, Download verplaatst

- "Collecties" leidde nu naar de Bibliotheek voordat de actieve markering werd berekend — het blijft nu correct omgeven zodra u op de pagina bent.
- "Activiteit" hernoemd naar "Downloads" en verplaatst onder Collecties.

## v1.18.05 — Augustus 2026

### Correctie: Actie-menu afgekapt op Bibliotheekkaarten

- Het menu "•••" (optimaliseren, zoeken, tags, verwijderen) van Films/Series kaarten kon afgekapt lijken — het zat in een container die elke overloop verstopte. Het wordt nu altijd volledig weergegeven.

## v1.18.04 — Augustus 2026

### Zijbalk geherstructureerd

- Films, Series en Collecties hebben nu elk hun eigen directe vermelding in het menu (in plaats van ingeklapt onder "Bibliotheek").
- "Zoeken" hernoemd naar "Torrent".
- Nieuwe inklapbare sectie "Beheer" die Verzoeken, Activiteit, Geschiedenis, Prullenbak, Problemen en Gebruikers groepeert.

## v1.18.03 — Augustus 2026

### Bibliotheek: volledige make-over van het visuele taalgebruik van Ontdekking/Dashboard

- De Films/Series kaarten in de Bibliotheek gebruiken nu dezelfde kaart als Ontdekking en het Dashboard: een echt 16:9 visueel met het titellogo eroverheen (in plaats van een verticale poster), en een verrijde preview bij hover (jaar, duur, genres) in plaats van een eenvoudige balk.
- Alle bestaande acties blijven toegankelijk bij hover via een compact menu: gemarkeerd gezien, optimaliseren, automatische zoekopdracht, handmatige zoekopdracht, tags, verwijderen (admin) — niets is verwijderd, alleen geherorganiseerd om minimalistisch te blijven.

## v1.18.02 — Augustus 2026

### Bibliotheek:zelfde visuele taal als Ontdekking

- Genre Menu van Ontdekking: sluit nu bij een klik buiten of op de Esc-toets (was eerder open).
- Films/Series kaarten van de Bibliotheek: meer uitvergroot bij hover en genre/duur balk, in dezelfde geest als Ontdekking — alle bestaande acties (optimaliseren, handmatige zoekopdracht, tags, verwijderen) blijven identiek.

## v1.18.01 — Augustus 2026

### Correctie: icoon afgekapt in de mobiele navigatiebalk op smal scherm

- Op een telefoon met een smaller scherm dan gemiddeld (bv. Galaxy Z Flip6) overliep het laatste icoon van de onderste navigatiebalk de rand van het scherm en was het deels onzichtbaar. De 5 iconen worden nu altijd gelijkmatig verdeeld over de werkelijke breedte van het scherm, ongeacht het apparaat.

## v1.18.00 — Augustus 2026

### Android smartphone — native speler

- Nieuwe native speler (Media3/ExoPlayer) met achtergrond afspeeldienst — vervangt de oude ingebouwde afspeling, vergrendelbare bedieningselementen op het scherm en persistente mediabeveiliging.

## v1.17.11 — Augustus 2026

### Android smartphone — premium UX polish (40% Netflix / 60% TV)

- **Design system Movviz mobile** : palet Void/Abyss + paars/magenta en 80/20 accenten (de inhoud blijft de ster), diepe oppervlakken, gecontroleerd glas, uniforme tokens TV.
- **Vloeiende capsule** : donkere, doorschijnende bottom nav met subtiele rand, achter de inhoud, spring-animatie op het actieve tabblad (icoon + label), volledige naleving van navigationBarsPadding — geen volledige breedte Materialbalk meer.
- **Bovenbalk** : transparant over de inhoud, progressief glas bij scrollen, inhoud die erachter opstijgt.
- **Hero** : 62% viewport, edge-to-edge, dubbele gradiënt (boven transparant → onder diep), logo/titel, beknopte metadata, CTA "Afspelen" wit + glas acties [ + ] [ ⓘ ], zachte introductie van de rijen eronder.
- **Rijen** : Netflix-dichtheid — ~3 posters + introductie van de volgende, LazyRow + peeking (einde 12dp), tap scale 0.96 spring, titels 16sp vet, rating ★.
- **Zoeken** : direct invoerveld, debounce 280ms, leidende/trailing iconen, lege / geen resultaten statussen, dichte resultaten (poster 52×74 + titel + jaar/type).
- **Profielen** : glas "Actief profiel" kaart met avatar gradiënt en chevron, uitmelden.
- Geen functionele regressie: backend, API, android-shared, auth, profielen, repository, Media3, Direct Play, fallback, ondertiteling hergebruikt zoals.

## v1.17.10 — Augustus 2026

### Android smartphone — eerste native basis

- Nieuwe Jetpack Compose touch client, gescheiden van desktop en Android TV.
- Onboarding server verbonden met bestaande Movviz API's, mobiele navigatie en
  gedeelde laag voor modellen, sessie en netwerk.
- APK debug en release ondertekend met dezelfde retail sleutel als de TV-applicatie.

## v1.17.08 — Augustus 2026

### Desktop — hover van kaarten

- De berekende grootte van de logo's wordt hergebruikt tussen de kaart en zijn
  zwevende voorvertoning, voor een onmiddellijke weergave bij hover.
- De hover-intentievertraging is verkort zonder het gedrag
  van links of afspeelacties te wijzigen.

## v1.17.07 — Augustus 2026

### Desktop — stabiele kaartlogo's

- TMDb logo's worden lokaal gemeten voordat ze worden weergegeven om
  direct in hun definitieve grootte te verschijnen, zonder vergrotingsanimatie.
- Het laden van logo's blijft stabiel tijdens het scrollen en afbeeldingfouten
  laten geen kaart meer in een onzichtbare staat achter.

## v1.17.06 — Augustus 2026

### Android TV — 10-voet herontwerp

- Navigatiebalk en hero ingekort om meer inhoud te tonen bij aankomst.
- Home kaarten in 16:9 met hergebruik van de editoriale achtergronden van de desktop en betrouwbare poster-uitklap.
- Compact profielkiezer, bedienbaar met D-pad, met profielvoorvertoning en gebruikersaanmaak.

## v1.17.05 — Augustus 2026

### Visuele elementen — prioriteit van TMDb logo's

- Voor de Franse interface worden de logo's nu in de volgende volgorde weergegeven:
  Frankrijk, neutraal Frans, Canada, Engels. Andere interfaces geven de voorkeur aan
  Engels. De cache van visuele elementen selecteert oude keuzes opnieuw zonder
  de reeds gedownloade afbeeldingen te verwijderen.

## v1.17.04 — Augustus 2026

### Desktop — breedte van kaartlogo's

- Logo's waarvan het daadwerkelijk zichtbare gebied minder dan 40 % is van de
  breedte van een kaart, bereiken nu deze drempel, waarbij hun verhoudingen strikt
  behouden blijven. Logo's die al breder zijn, worden nooit verkleind.

## v1.17.03 — Augustus 2026

### Afspelen — lokale bron onafhankelijk van Plex

- Corrigeert kaarten die "Wachten op Plex-synchronisatie" weergaf
  ondanks een reeds beschikbare lokale bestand. Een afgerond Movviz-film of aflevering
  opent nu onmiddellijk de speler via de lokale bron; de Plex-koppeling
  blijft een asynchrone verrijking en blokkeert de afspeling niet meer.
- De speler verbergt de link "Afspelen op Plex" netjes wanneer er nog geen
  Plex-URL bekend is.

## v1.17.02 — Augustus 2026

### Desktop — kaartlogo's

- Officiële logo's omgeven door grote transparante marges krijgen
  nu tot 90 % van de visuele grootte. Merken die al breed en
  compact zijn, blijven op hun natuurlijke schaal om een
  duidelijke hiërarchie van kaart op kaart te behouden.

## v1.17.01 — Augustus 2026

### Ontdekking — C411

- Corrige de de C411: elke vermelding wordt opnieuw opgelost door zijn
  volledige TMDb-fiche (poster, achtergrond 16:9, titel en beoordeling). Als de identificatie
  verstrekt door C411 ontbreekt, verlopen of vaag is, dienen de titel en het jaar
  als veilige back-up in plaats van een zwarte kaart.

## v1.17.00 — Augustus 2026

### Desktop — visuels, ontdekking en afspelen

- De visuels van de kaarten hebben drie aparte opties: alleen
  het visuele cache, alleen de logo's, of alleen de achtergronden/posters. De
  duurzame associaties titel → afbeelding worden behouden: aanvullen van de cache
  herstelt alleen het ontbrekende bestand, zonder het andere opnieuw te downloaden.
- De TMDb-antwoordcache wordt uitgebreid naar 35.000 vermeldingen, zodat een
  volledige bibliotheek niet meer te vroeg wordt uitgeschakeld bij de limiet van 3.500 sleutels.
- Genres hebben nu hun eigen editoriale hero, zoals Films
  en Series. De hero is hoger en past de 16:9 achtergronden correct aan.
- Transparante logo's worden vergroot op basis van hun zichtbare gebied: de kleine
  merken met grote marges winnen aan leesbaarheid zonder de van nature brede logo's
  te vergroten. Een kaart zonder achtergrond gebruikt ten minste zijn poster,
  in plaats van leeg te blijven.
- Op een ultrawijd scherm behoudt de speler de verhouding van de video in volledig
  scherm (zijbalken indien nodig). De cursor verdwijnt met de
  besturingselementen na inactiviteit, en een expliciete hervatting start direct
  zonder tweede pop-up; sessie-offsets worden omgezet van ms naar s.
- Alle zichtbare titels worden nu verwerkt, uitsluitend opgesplitst in
  interne netwerkpakketten: geen algemene limiet ontneemt de onderste rijen
  (Top, suggesties, recent toegevoegd…) hun logo's of hun achtergronden.
- De voorbeelden van « Hervatten » tonen de tijdgestempelde actie en « Sinds de
  start », met de resolutiebadges, HDR, video en audio van het echte bestand.

## v1.16.82 — Augustus 2026

### Desktop — betrouwbare afspeling

- Corrige de werkelijke duur van gefragmenteerde FFmpeg-streams: de speler, de voortgangsbalk, de herhalingen en de einddrempel gebruiken nu de duur
  van de duur
  Media-plex, in plaats van de enkele seconden die al zijn opgeslagen.
- De afspeelbediening krimpt tijdens het afspelen en verschijnt weer
  bij de muisbeweging, pauze, buffering of het openen van een
  menu. De afbeelding in de voortgangsbalk wordt behouden.
- Volledig scherm richt zich op de Movviz-container met de browser-API: dezelfde
  commando's, de echte zoekfunctie en de ondertiteling blijven dus aanwezig, in plaats
  te schakelen naar de native videocontroles.

### Desktop — editoriale kaarten

- De knop 'Een beschikbare kaart afspelen' start nu direct de
  Movviz speler (films, herhalingen en afleveringen), in plaats van zijn fiche opnieuw te openen.
- Wanneer een titel geen neutrale TMDb-achtergrond heeft, gebruiken de kaarten
  zijn gelokaliseerde 16:9 illustratie en voegen noch logo noch titel een tweede
  keer toe. De lege keuzes van de oude cache worden automatisch ververst.

## v1.16.81 — Augustus 2026

### Desktop — preview van kaarten

- Het overgangen toont niet langer de knop "Informatie": klikken op de afbeelding
  opent direct de Movviz fiche. De acties nemen de taal
  van Netflix over: afspelen als de titel in de bibliotheek staat, anders toevoegen,
  Vind ik leuk en toegang tot de fiche.
- Vind ik leuk slaat onmiddellijk een expliciete vijfsterrenbeoordeling op.
- De preview toont vervolgens de badges jaar/duur, en dan tot drie relevante genres
  die alleen worden opgehaald bij overgangen als de rij ze niet heeft.
- De aanroepen voor visuele elementen vragen expliciet om `fr-FR`; de cache van de keuzes
  De visuels migreren zonder de reeds gedownloade achtergronden en logo's te wissen.
- De achtergrondselectie geeft nu de voorkeur aan een echt 16:9 formaat, een goede
  resolutie en de TMDb-stemmen boven een slecht ingekaderd of geïsoleerd visueel.

### Desktop — scrollstabiliteit

- Corrigeert de scrollbalk die na het sluiten van een
  fiche of speler kon verdwijnen: de overlays delen nu een gedeelde
  scrollvergrendeling, compatibel met hun uitgangsanimaties.
- De cacheregistratie wordt gedeeld tussen alle Next-bundels: de tellers
  "bereikt / gemist", de TMDb-cache en de actie om deze te legen weerspiegelen
  momenteel dezelfde instantie na navigatie of opnieuw opstarten.

## v1.16.80 — August 2026

### Visuele cache — volledige incrementele

- De incrementele passage draait nu duurzaam door de hele
  bibliotheek, inclusief reeds aanwezige titels: het controleert de
  lokale backdrop/logo bestanden en downloadt alleen de ontbrekende. De weergave
  in real-time van een kaart of zoekresultaat voedt dezelfde cache.
- De capaciteit van de API-antwoordcache gaat naar 3.500 sleutels; Instellingen → Cache
  toont nu het gebruikte aantal en de expliciete limiet.

## v1.16.79 — August 2026

### Desktop — redactionele kaarten en beeldcache

- De redactionele rijen van Home, Films en Series gaan over naar grote
  16:9 kaarten (300–360 px) met een proportionele hover-preview.
- Elke kaart kiest een neutrale TMDb backdrop en past vervolgens het
  officiële logo toe; wanneer er geen neutrale achtergrond beschikbaar is, behoudt Movviz de
  teksttitel in plaats van een logo te dupliceren dat al in de afbeelding is gedrukt.
- Voegt een persistente cache toe van backdrop/logo paren, die onmiddellijk
  wordt gevuld vanaf Home, de hero en de zoekopdracht. De onveranderlijke TMDb bestanden worden
  daadwerkelijk op de schijf bewaard door Movviz en een jaar in de browser.
  zonder TMDb-zoekopdracht per kaart.
- Instellingen → Cache voegt "Cache aanvullen" en "Inkrementieel vernieuwen" toe.
  Een dagelijkse taak vangt alleen nieuwe
  titels, ontbrekende of zeldzame netwerkfouten op, zonder de interface te vertragen.
- Stelt de web-, Android TV-, package lock-, badge- en metadataversies van
  release op `1.16.79`.

## v1.16.78 — Augustus 2026

### Desktop — ontdekking, series en afspelen

- De editoriale kaarten op Start, Films en Series gebruiken nu
  echte TMDb 16:9 achtergronden, met het officiële logo van de titel of een stabiele teksttitel
  wanneer er geen logo beschikbaar is. Een daadwerkelijke afwezigheid van een achtergrond
  toont een neutrale Movviz-kaart in plaats van een verticale poster te knippen.
- Verrijkte Start: hero met stabiele fallback na drie seconden,
  bedoeld gemengde rijen, korte formaten, zwevende desktop-hover en verwijdering
  van valse scrollindicatoren.
- Films en Series hebben hun eigen catalogi, een hero specifiek voor hun type en
  een Genre-selector, terwijl de opening van de fiches in het
  unieke Movviz-paneel behouden blijft.
- Series fiches: seizoenen afwezig maar correct downloadbaar, seizoen 0
  verbergd als het niet bestaat, directe lancering van een beschikbare aflevering,
  knop en opeenvolging van de volgende aflevering indien deze aanwezig is.
- Repareert de Auto Play-route: een hervatting kan opnieuw starten via FFmpeg,
  lokale bestanden melden codecs/audio tracks/FFmpeg beschikbaarheid, en
  HLS Plex wordt het laatste vangnet na een echte fout — nooit een valse
  fout « HLS afspelen uitgeschakeld ».
- Stelt de web-, Android TV-, package lock-, badge- en metadataversies van
  release op `1.16.78`.

## v1.16.77 — Augustus 2026

### Desktop en Android TV

- Moderniseert de desktopspeler: cinematische dock, persistente voortgang,
  geunificeerde menu's en leesbaardere intro/credits acties, zonder de
  Auto-, Direct-, audio/video transcodering of HLS Plex modi te verwijderen.
- Bereidt de Home desktoprijen voor met 16:9 editoriale kaarten en een
  zwevende hover, terwijl de verticale technische bibliotheek behouden blijft.
- Android TV: corrigeert D-pad focus terugkoppelingen, start direct een beschikbare aflevering
  en harmoniseert focus-, zoek- en afspeelstatus.
- Voegt de versiebeheerde trackinglay-out toe van de desktop UX-herziening.
- Stelt de web-, Android TV- en release metadata versies op `1.16.77`.

## v1.16.76 — Augustus 2026

- Synchroniseert de web- en Android TV-versie voor de volgende release.

## v1.16.75 — Augustus 2026

### Release- en lokale afspeelfixjes

- Stelt de Web-, Android TV- en release metadata versies op.
- Corrigeert HTTP `Range` suffix verzoeken voor lokale streaming.

## v1.16.73 — Augustus 2026

### Android TV compilatiefixjes

- Corrigeert de Moshi annotatie van het marker-model.
- Voegt de import van de `slideInVertically` animatie toe die wordt gebruikt door de skip-knop.

## v1.16.72 — Augustus 2026

### Movviz voortgang- en multi-client herstel backend

- Voegt backend opslag per gebruiker, sessies, heartbeats en bescherming tegen toevallige seeks toe.
- Desktop en Android TV gebruiken nu Movviz Playback sessies.
- Intro/credits markers v1.16.71 worden nog steeds geleverd vanuit de Movviz cache.
- De voltooiing synchroniseert de bekeken status naar Plex en verrijkt Continue Watching met Movviz herstelpunten.

Alle opmerkelijke wijzigingen in Movviz, gegroepeerd per ontwikkelingsmijlpaal.

---

## v1.16.71 — Augustus 2026

### Plex Intro/Credits → Movviz → Android TV (Intro/credits overslaan)

**Architectuur:** `Plex → sync Movviz (cfg.adminToken) → playback-markers.json → /api/stream/{ratingKey}/info → Android TV → ExoPlayer → contextuele knop`. Geen Plex-aanroep bij het starten van een afspelen, geen Plex-token aan de TV-kant.

**Backend:**
- Nieuw generiek model `PlaybackMarker` (intro/credits) en store `playback-markers.json` (lookup O(1) per ratingKey, versie 1, migratie, readJsonCached/writeJsonCached).
- Nieuwe status `plex-marker-sync-state.json` (dirty, knownUpdatedAt, emptyRetry 7j, auditBucket 0..6).
- Ruwe type `PlexMarker` intern plex, extensie `PlexServerConfig.markerSyncEnabled` (standaard false, nooit blootgesteld aan de client).
- `batchMarkers(cfg,cfg.adminToken,ratingKeys)` chunks 50, `includeMarkers=1`, onderscheid fout ≠ nul marker (Plex faalt nooit lokale gegevens verwijderen).
- Normalisatie (intro/credits alleen, validatie, sorteer ASC), deterministische SHA16-handtekening, behoud van multi-blok credits (mid/post-credits niet samengevoegd).
- Engine `markerSync.ts`: incr (dirty + nooit-sync + verlopen retries + audit bucket van vandaag), full (alle plexRatingKey Movviz), retry 7j, audit roterend stableHash%, GC alleen als full compleet, echte voortgang, yieldToUser tussen batches, sobere logs, withKeyLock + sourceId `plex-marker-sync`.
- Hooks `registerMarkerCandidate` in `librarySync` (films + elke aflevering), ontkoppeling bibliotheek 5min → marker 24u.
- Geplande dagelijkse taak `plex-marker-sync` (24u, check markerSyncEnabled), mapping JobType `plexMarkerSync` + prioriteiten.
- Route `POST /api/plex/marker-sync` (admin, enqueueJob sourceId, onmiddellijke retour queued/jobId) + `GET` stats, route `GET /api/plex/config` en uitgebreide `PUT` (markerSyncEnabled, nooit token).

**Desktop Instellingen > Plex:** sectie Intro's en credits (toggle AAN/UIT, data, tellers, knoppen incrementeel/volledig, polling jobRunning via /api/plex/marker-sync + /api/jobs).

**Afspelen API:** `GET /api/stream/{ratingKey}/info` injecteert `markers[]` vanuit de lokale store (try/catch → [] indien niet beschikbaar).

**Android TV:**
- `PlaybackMarkerDto` + `StreamInfoDto.markers` (emptyList standaard, compatibel met oudere backend).
- `PlayerActivity`: laden markers via streamInfo, detecteren activeMarker elke 500ms, labels Intro/credits overslaan, seekTo(endMs) zonder geconsumeerde status, hervatten/seek/fallback/palette ongewijzigd.
- Focus D-pad conditioneel, PlaybackActionOverlay geünificeerd (Skip boven Up Next), visueel glas 150-250ms.

---

## v1.16.70 — Augustus 2026

### Android TV: Instellingen in tandwielicoon

- Het teksttabblad "Instellingen" verlaat de navigatiebalk: een **tandwielicoon** (getekend, dezelfde stijl als de vergrootglas) neemt de plaats in tussen het zoekvergrootglas en het profielavatar. Witte focusrand (merkverloop wanneer het tabblad actief is).

---

## v1.16.69 — Augustus 2026

### Android TV: einde van auto-scroll bij openen, race condition seizoenen gecorrigeerd

#### Auto-scroll bij openen van kaarten (op verzoek)
- MINIMAAL scroll-spec (mobiele gedrag) op titelkaart en acteurkaart, in plaats van het TV-draaipunt (~30% van de rand) dat de kaart zelf deed scrollen zodra de initiële focus op de CTA landde. Scroll gebeurt nu alleen als het beoogde element daadwerkelijk buiten beeld is (seizoenen/afleveringen lager).

#### Seizoenen van een andere serie weergegeven ("het seizoen is niet dat van de geselecteerde serie")
- **Race condition** : het snel openen van serie A en daarna serie B stuurde beide verzoeken in willekeurige volgorde — de seizoenen van A overschreven die van B. Toevoeging: het antwoord wordt alleen geschreven als de gevraagde serie nog steeds de huidige is.
- **Cache seizoen sleutel per serie** : de oude cache sleutel per seizoennummer alleen diende het seizoen 1 van de eerste geopende serie naar de volgende. Nu sleutel "tmdbId-seizoen".

---

## v1.16.68 — Augustus 2026

### Android TV: hero als titelkaart, D-pad balk bovenaan, opgeschoonde filmografie

#### Hero Home/Films/Series = dezelfde samenstelling als de kaart
- TMDb logo bovenaan VAST 118dp (`ContentScale.FillHeight`) : de kleine logo's (~30px, onleesbaar vanaf de bank) worden title-art zoals bij Netflix.
- Statusbadge bibliotheek onder het logo (dezelfde stip als op de kaart: Zoeken…/Downloaden/Ontbreekt) — "Beschikbaar" blijft impliciet.
- Geünificeerde meta-regel ★ beoordeling · jaar · duur · genres inline (de chips namen voor niets een hele rij in beslag).
- Verwijdering van de storende zwarte gradiënt achter het synopsis — het hero scrim is voldoende.
- Inhoudskolom verankerd aan de onderrand van de achtergrond (de CTA "Lezen" werd niet langer afgekapt onder de afbeelding).
- Overgebleven glyfen vervangen door vectoriconen: ▶ op "Lezen", stip "i" getekend op "Meer info".

#### D-pad balk bovenaan (Home + Films + Series)
- Onzichtbare anker 1dp helemaal bovenaan elk scherm: UP vanaf de hero CTA landt eerst hier — bringIntoView brengt het scrollen terug naar offset 0 (hele carrousel weer zichtbaar onder de balk), dan voegt een tweede UP zich bij de NavRail. Weg met de half verborgen carrousel erachter.

#### Opgeschoonde filmografie acteurs
- Filtering van talkshows en ceremonies (Saturday Night Live, Tonight Show, Late Night/Show, Graham Norton, Kelly Clarkson, Jimmy Kimmel, Ellen, Golden Globes, Oscars, MTV/Critics'/People's Choice Awards, GMA, Today Show, Conan, rode loper…) — op verzoek live: "Ik heb er genoeg van om de late nights te zien".

#### Divers
- CatalogScreen gemigreerd van TvLazyColumn → standaard LazyColumn (consistentie met de home).

---

## v1.16.67 — Augustus 2026

### Android TV: reactieve downloadstatus op de kaart, focusRestorer, D-pad anker

#### Titelkaart: levende download (Netflix patroon)
- **Reactieve statusbadge** : "Downloaden"/"Zoeken…" tijdens activiteit (bestand wordt elke 3s gepolled), echte bibliotheekstatus anders (Beschikbaar/Downloaden/Ontbreekt via statusTone) — nooit meer een vast "In de bibliotheek" tijdens een download.
- **Voortgangpill** `DownloadProgressPill` : percentage + snelheid + resterende tijd ("Downloaden 42% · 6.1 Mo/s · 12 min over") met voortgangsbalk in de pil zelf.
- **Automatische overgang naar "Lezen"** na de download: versnelde bibliotheekverversing na 4s zolang een torrent actief is — nul gebruikersactie, nul app-ademhaling.
- TMDb beoordeling afwezig (0) → geen misleidende ster "★ 0.0" meer op de kaart.

#### D-pad navigatie
- **`focusRestorer()` op alle rijen** (officiële Google-documentatie): elke rij onthoudt zijn gefocuste kaart — de focus keert terug naar de juiste poster na het sluiten van een fiche en bij verticale navigatie.
- **Migratie TvLazy\* → Lazy\*** standaard (TvLazyColumn/TvLazyRow verouderd).
- **Fallback-anker uitgesloten van directionele zoekopdracht** (`FocusRequester.Cancel` ×4): het staat geometrisch boven alle inhoud — moveFocus(Up) vanaf de hero landde erop (onzichtbaar) in plaats van terug te navigeren in de NavRail.
- Hero ster → vectoricoon (het glyf ★ bestaat niet in Inter).

---

## v1.16.66 — Augustus 2026

### Android TV: massale UTF-8 reparatie, vectoriconen, D-pad symmetrie

#### UTF-8 / mojibake (DE bug met kapotte accenten en symbolen)
- **510 mojibake sequenties hersteld** (UTF-8 herinterpreteerd als CP1252 en opnieuw gecodeerd): "Ã©cran" → "écran", "â˜…" → ★, "TÃ©lÃ©chargement" → "Téléchargement", "Â·" → "·"… in HomeScreen.kt, CatalogScreen.kt en UpdateManager.kt.
- Oorzaak: bestandsgeschreven in Get-Content/Set-Content zonder expliciete codering tijdens eerdere sessies.

#### Vectoriconen (einde van lege vierkanten op Google TV)
- Nieuwe `MovvizIcons.kt`: 13 handgetekende iconen in ImageVector (play, pauze, skip prev/next, rewind/forward, muzieknoot, vink, ster, plus, downloaden, wisselen, stip-cirkel, replay) — de Unicode glyfen ▶ ❚❚ ⏮ ⏭ ♪ ★ ✓ ↓ ⇄ ◉ ↻ bestaan niet in Inter en veroorzaakten systeem/vierkante fallback.
- Overal vervangen: spelerbesturingselementen (PlayerActivity), CTA titelfiche ("Lezen", "Herstarten", "Seizoen downloaden", "Toevoegen"), sterrenbeoordelingsbadges (RatingBadge, titelfiche), "Bekeken" badge, vink afgerond aflevering, NavRail profielmenu, Plex-knop bij login.
- `ControlButton` accepteert nu vectoricoon of tekstlabel ("CC").

#### D-pad Navigatie — UP/DOWN symmetrie
- **Fix "UP gaat omhoog, maar DOWN gaat niet meer omlaag"**: de oude handler verbruikte ALLE UP vanaf elke diepte → onmogelijk om van rij te rij te navigeren, elke UP sprong naar de navigatiebalk.
- MainScreen/titelfiche/acteur: UP probeert eerst `moveFocus(Up)` (interne stijging rij N−1), schakelt naar het actieve tabblad van de NavRail alleen bovenaan de inhoud.
- NavRail: DOWN probeert het exacte doel, dan de geometrische fallback `moveFocus(Down)` (werkt zelfs bij laadschermen), en dan het fallback-anker.
- Fallback-anker geplaatst op NavHost-niveau (bestond alleen op home — neerwaartse pijl dood tijdens het laden van een fiche), nu **getekend** wanneer het focus krijgt (klein wit punt) om nooit op een bevroren scherm te lijken.
- **Correctie van het patroon `.getOrDefault(false)` op `requestFocus()`**: de methode retourneert void in compose-ui 1.7.6 (geverifieerd met javap), de echte succestest is `.isSuccess` — de oude code evalueerde `(Unit == true)` = altijd false.

---

## v1.16.65 — Augustus 2026

### Android TV: versie verhoogd voor testbuild

#### Opmerkingen
- Versie verhoogd voor testbuild op Google TV.
- Geen codewijzigingen — dezelfde inhoud als v1.16.64.

---

## v1.16.64 — Augustus 2026

### Android TV: gepolijst premium uiterlijk + auto-update toggle + crash fixes

#### Stabiliteit (8 gecorrigeerde crashvectoren)
- Geleidelijke HomeScreen netwerkoproepen (+200ms tussen elk) — einde van de parallelle overstroming bij het opstarten.
- GitHub update vertraagd met 5s — blokkeert niet langer het eerste frame.
- Ambient trailer gedeactiveerd op apparaten < 4GB RAM — einde van Chromium/SwiftShader crash.
- Preload hero achtergrond verminderd van 2 naar 1 afbeelding — minder geheugenbelasting.
- Coil geheugencache verminderd van 20% naar 10% van de heap.
- `createFilmGrain()` geoptimaliseerd met `setPixels()` batch in plaats van 32k `setPixel()` aanroepen.
- OkHttp timeouts verminderd: connect 5s, read 15s, callTimeout 20s.
- Hero logo's batch sequentieel geladen (+100ms) in plaats van 5 coroutines parallel.

#### Premium uiterlijk (45 fixes)
- Kaartvorm 8dp → 12dp (consistent met TV).
- displayLarge ExtraBold → Bold (minder bol op 10 voet).
- MovvizDown verzacht (#FF5B78 → #E87C7C).
- MovvizCyan verzacht (#34E2FF → #5CE0D8).
- Orbit dots AnimatedLogo 6dp → 8dp.
- Wordmark flow vertraagd van 5s → 8s.
- Profiel pop-up NavRail vergroot van 300dp → 320dp.
- Menu scheidingslijn NavRail padding 10dp → 16dp.
- Hero linkerscherm 70% → 45%.
- Hero ondergrensverloop verzacht (bandvorming verminderd).
- Genre chips hero 12sp → 14sp.
- Downloadkaart rand 3dp → 2dp.
- Rijkop onderkant padding 16dp → 20dp.
- Seizoenschipvorm 9dp → 12dp.
- Aflevernummer 22sp Light → 16sp Medium.
- Cast foto's 72dp → 84dp, namen 12sp → 14sp.
- Instellingensectietitels MovvizBrand → MovvizInkSoft.
- Instellingenpaneel 72% → 78% breedte.
- InfoRow labels 12sp → 14sp, breedte 160dp → 180dp.
- Foutscherm speler: witte titel in plaats van rode, overlay 85% → 72%.
- Buffering spinner dikte 14% → 18%.
- Progressbalk update pilvorm (50 straal).
- Lege staat catalogus padding boven 24dp → 48dp.

#### Functionaliteiten
- Schakelaar « Auto-update AAN/UIT » in Instellingen → Over ons (behouden via DataStore).
- Aanraakklik geactiveerd op het profielselectiescherm (tvPointerClick).

---

## v1.16.62 — Augustus 2026

### Android TV: Premium Netflix-kwaliteit make-over

#### Typografie en designsysteem
- Ingebouwde Inter-lettertype (5 gewichten: Regular → ExtraBold) — dezelfde typografische richting als Netflix en Apple TV.
- Geünificeerde typografische tokens: displayLarge (40sp), headlineMedium (24sp), titleLarge (20sp), titleMedium (16sp), bodyLarge (16sp), bodyMedium (14sp), labelLarge (14sp), labelSmall (12sp).
- `MovvizCardShape` (12dp) — unieke straal voor alle contentkaarten, consistent overal.
- Bestaande `tvFocusLift` behouden — veer + GPU-alleen schaduw (graphicsLayer), nul herberekening tijdens animatie.

#### Startscherm (HomeScreen)
- Categorieënrijen met titel erboven (stijl titleLarge), Netflix-pieking (negatieve padding end).
- Posterkaarten: verhouding 2:3, focusrand 2dp wit alpha 90% leesbaar vanaf de bank.
- Netflix Call-out: synopsis + metadata onderaan de rij bij focus, AnimatedVisibility met debounce voor nul flikkering.
- Richtingsvoorafladen: de 2 volgende afbeeldingen van de gefocuste kaart worden vooraf geladen via Coil (nul pop-in).
- Stabiele sleutels + contentType op alle lijsten.
- Hero: Ken Burns (zoom 1.0→1.05 over 20s), filmkorrel (native BitmapShader), luminantie-adaptieve scrim, officieel TMDb logo, geanimeerde tekst, AmbientTrailer via pool WebView, voorafladen van de 2 volgende achtergronden.

#### Titeldetailscherm (TitleDetailScreen)
- Parallax achtergrond (graphicsLayer translationY), officieel logo, CTA, seizoenen/afleveringen met stabiele sleutels.
- Franse foutmeldingen (friendlyAddError) in plaats van ruwe Engelse.
- Afleveringsstills w780, achtergronden w1280.

#### Videospeler (PlayerActivity)
- Zoekindicator gecentreerd "+10s" / "−10s" met fadeIn/fadeOut.
- Paneel "Volgende aflevering" aan het einde van een aflevering (positie > duur − 45s) met aftelklok en D-pad focus.
- Auto-verberg overlay 5s, geanimeerde voortgangsbalk, gebufferde spinner.
- Foutscherm met technische details (codec, resolutie) leesbaar vanaf de bank.
- Typografie en thema-tokens op alle bedieningselementen.

#### D-pad Navigatie
- DOWN vanaf NavRail → inhoud: interceptie via onPreviewKeyEvent (vóór de kinderen Surface).
- UP vanaf inhoud → NavRail: interceptie via onKeyEvent (ná de LazyColumn).
- Herstel van focus bij terugkeer naar een detailkaart (vertraging 300ms + navRailFocusRequester).
- Fallback focus (1dp onzichtbaar altijd focusbaar) — geen geval van verloren focus.

#### Prestaties
- Polling downloadbestand: 4s → 8s (vermindert netwerkverkeer).
- largeHeap op Android Manifest.
- TMDb: probeer 3 keer met backoff (300ms, 800ms) — minder valse "movie not found" bij tijdelijke netwerkonderbrekingen.

#### Correcties
- Knop "Toevoegen aan bibliotheek": geen valse TMDb-fouten meer (server-retry + leesbare foutmelding).
- Zoeken: variabele `fieldFocused` en constante `TMDB_POSTER_BASE` gecorrigeerd.

## v1.16.60 — Augustus 2026

### Dashboard: een kapotte carrouselkaart blokkeert niet langer het hele scherm

- Een film of serie met onverwachte gegevens kon het hele dashboard laten crashen ("Serverfout", heel scherm geblokkeerd) in plaats van simpelweg niet weergegeven te worden. Elke carrouselkaart (en de hero-thumbnail) is nu geïsoleerd: als één ervan crasht, verdwijnt deze discreet, de rest van het dashboard blijft normaal functioneren.

## v1.16.59 — Augustus 2026

### Correctie: serverfout op het dashboard voor niet-admin accounts

- De nieuwe instelling toegevoegd in v1.16.56 voor de rij "Beschikbare upgrades" werd gelezen via een route gereserveerd voor admins — elk niet-admin account dat het dashboard opende, ontving een toegangweigering op deze aanvraag. Lezen is nu open voor elk ingelogd account (schrijven blijft admin-only, zoals voorheen).

## v1.16.58 — Augustus 2026

### Android TV: laadscherm voor het dashboard, echte visuele identiteit

- De tekst "Laadt uw bibliotheek..." maakt plaats voor het geanimeerde Movviz-logo (hetzelfde als bij login/instellingen) bij de allereerste start, voordat de bibliotheek geladen is. Dit logo dient ook als echt zichtbaar focusdoel voor de pijl omlaag — het onzichtbare back-up anker wordt in dit specifieke geval niet meer aangeroepen, het blijft op zijn plaats voor andere randgevallen.

## v1.16.57 — Augustus 2026

### Correctie: de nieuwe knop "Suggesties voor upgrade op het dashboard" werd niet opgeslagen

- De knop toegevoegd in v1.16.56 behield nooit zijn status — de opslagroute voor instellingen negeerde dit specifieke veld en keerde systematisch terug naar zijn oorspronkelijke waarde.

## v1.16.56 — Augustus 2026

### Instellingen > Kwaliteit: analyse van upgrades op het dashboard uitschakelen

- Nieuwe knop in Instellingen > Kwaliteit om de analyse uit te schakelen die de rij "Beschikbare upgrades" op het dashboard voedt — deze analyse kon de weergave op een grote bibliotheek serieus vertragen. Verschilt van de bestaande automatische upgradeknop (die automatische achtergrondvervanging beheert): deze schakelt alleen de weergave-scan uit, zonder de rest aan te raken.

## v1.16.55 — Augustus 2026

### Android TV: pijl omlaag vanuit het menu — echte correctie

- De vorige correctie elimineerde onverwachte sluitingen, maar maakte de pijl omlaag in normaal gebruik inoperatief (hij richtte systematisch op een onzichtbaar anker in plaats van de echte inhoud). Herstelt de directe afdaling naar het eerste echte element van het scherm wanneer dit bestaat, met het back-up anker alleen als laatste redmiddel — nooit meer crashen, nooit meer pijl omlaag zonder effect.
- Nieuwe README, volledige make-over.

## v1.16.54 — Augustus 2026

### Controleversie voor automatische updatecontrole

## v1.16.53 — Augustus 2026

### Android TV: handmatige updatecontrole

- Voegt een knop "Updates controleren" toe in Instellingen → Over — voorheen werd de controle slechts één keer bij het opstarten uitgevoerd, zonder enige manier om deze opnieuw te starten of te zien wat er gebeurde zonder de hele applicatie opnieuw op te starten.

## v1.16.52 — Augustus 2026

### Android TV: afspelen — betrouwbaarder alleen audio-fallback

- De "alleen audio" fallback ging systematisch via Plex-transcodering, wat voor sommige bronnen (met name HEVC) stilzwijgend kan weigeren de video te kopiëren en dan beide opnieuw codeert in plaats van alleen het audio. Gebruikt nu bij voorkeur de lokale remux van de server (al gebruikt door de desktopclient) wanneer beschikbaar — gegarandeerde videokopie, alleen het audio wordt opnieuw gecodeerd.

## v1.16.51 — Augustus 2026

### Android TV: update-loop, onverwachte sluitingen met de afstandsbediening

- Automatische update die eindeloos opnieuw begon: het systeem vereist een installatiebevestigingsscherm vanaf Android 12, wat voorheen nooit werd afgehandeld — de applicatie dacht dat de installatie succesvol was terwijl deze voor altijd vastzat in afwachting. Verholpen en getest onder echte omstandigheden (versienummer gaat goed omhoog achteraf).
- Onverwachte sluitingen van de applicatie bij drukken op de pijl omlaag van de afstandsbediening — vaker op langzamere apparaten (bv. Chromecast 4K): het navigatiedoel kon wijzen naar een scherm-element dat nog niet was geladen. Systematisch veilig gemaakt, ongeacht de laadstatus van het scherm.

## v1.16.50 — Augustus 2026

### Android TV: gebruiker toevoegen aan het huishouden, ontbrekend admin profiel

- "Gebruiker toevoegen" vanaf het profielscherm reageerde niet op de afstandsbediening — het inlogscherm in de toevoegmodus vroeg nooit om D-pad focus (zelfs een eerder verholpen defect, hier opnieuw geprobeerd zonder veiligheidsnet).
- Het admin-account dat de initiële link maakt, was nooit zichtbaar in "Wie is het?" totdat het handmatig aan het eigen huishouden werd toegevoegd — nu automatisch toegevoegd bij het eerste gebruik, net als het eigenaarsaccount altijd het eerste profiel is bij Netflix/Plex.

## v1.16.49 — Augustus 2026

### Android TV: update geblokkeerd door de afstandsbediening

- De auto-update overlay ving nooit de D-pad focus: de knop "Toestaan" bleef onbereikbaar en de afstandsbediening bleef het verborgen menu eronder besturen — waarschijnlijke oorzaak van onverwachte applicatiesluitingen tijdens een update. Verholpen.

## v1.16.48 — Augustus 2026

### Testversie van de auto-update

- Geen functionele wijzigingen: alleen versie-increment, om de auto-update flow in echte omstandigheden te valideren (check GitHub bij het starten → download `Movviz-Android-TV-client.apk` → SHA-256 verificatie → installeren over de bestaande).

## v1.16.47 — Augustus 2026

### Slechts één APK: « Movviz TV »

- De `retail` variantie (zonder auto-update) is **verwijderd**: er bestaat nu slechts één APK, de app heet nu **Movviz TV** en werkt zichzelf bij via GitHub bij het starten.
- De `applicationId` `com.movviz.tv.au` wordt behouden: bestaande installaties en de auto-update blijven correct over elkaar heen schrijven (zelfde pakket = update, geen 2e app).
- De CI workflow publiceert nu slechts één asset: `Movviz-Android-TV-client.apk`.
- Nieuw: een **TvProvider-keten** « Movviz » op het Android TV dashboard — de rij « Blijf kijken » van de launcher toont de lopende titels van het actieve account (zoals Plex/Netflix, zonder enige samenwerking), en een deep link `movviz://title/{type}/{tmdbId}` is gedeclareerd om de titelpagina te openen.
- **Google TV**: de mediaseessie voedt nu de rij « Blijf kijken » van de Google TV launcher — de MediaItems bevatten echte metadata (titel, afleveringonderwerp, TMDb poster) en een sessieactiviteit is gedeclareerd (klikken op de kaart opent de app opnieuw).

## v1.16.46 — Augustus 2026

### Android TV: de speler voorkomt slaapstand tijdens het afspelen

- De anti-slaapstand flag is nu ingesteld voor de gehele levensduur van de afspeel Activity (niet alleen tijdens actief afspelen met ExoPlayer): een her-buffering op een externe server zorgt er niet meer voor dat de Android TV in slaap valt midden in een film.
- Toevoeging van een actieve mediaseessie (media3-session): het systeem weet dat er media wordt afgespeeld, net als Netflix — het zet het apparaat niet meer in slaapstand en toont de titel in de systeeminterface.

## v1.16.45 — Augustus 2026

### Android TV: alleen audio fallback in DASH voor alle codecs

- De « alleen audio » fallback (video gekopieerd in bitstream, geluid opnieuw gecodeerd) gebruikt nu DASH ongeacht de broncodec, inclusief h264 — consistent met de webspeler en het gedrag van Plex Web zelf, en fMP4/DASH biedt ExoPlayer een nauwkeuriger seeking per bytesbereik dan HLS-TS per segment.

## v1.16.44 — Augustus 2026

### Android TV: echte compatibiliteitssonde per apparaat

- De compatibiliteit van het apparaat wordt nooit aangenomen: voor elke afspeling vraagt de app de daadwerkelijk gedeclareerde decoders van het apparaat op (MediaCodecList, dezelfde API die ExoPlayer gebruikt voor decoderen) en kiest het afhankelijk van de modus — een apparaat dat DTS/TrueHD/E-AC3 decodeert speelt in live-play, een ander dat dit niet heeft schakelt naar alleen audio fallback (video gekopieerd, nooit opnieuw gecodeerd). De beslissing en de reden worden gelogd in logcat (`Pré-décision v=… a=… → niveau …`).
- Correctie: de alleen audio fallback wordt geleverd in HLS voor h264 bronnen — de speler meldde per ongeluk een DASH manifest en de afspeling faalde bij het opstarten.
- Nieuw: acteur/actrice pagina — Het distribueren van een titelpagina leidt naar de volledige filmografie van de persoon, met navigatie via kaarten naar elke titel. De NavRail blijft zichtbaar op de pagina's (titel en acteur) om van tabblad te wisselen zonder terug te keren naar het overzicht.

## v1.16.43 — Augustus 2026

### Android TV: geoptimaliseerd afspelen — einde van nuttige video transcodering

- Een titel waarvan de video door het apparaat gedecodeerd kan worden, maar waarvan de audiospoor dat niet kan (DTS/DTS-HD/TrueHD/E-AC3 afhankelijk van het apparaat) activeerde de hele fallback keten en eindigde in video+audio transcodering aan de serverkant, terwijl alleen het audioprobleem was. De speler sondeert nu de werkelijke codecs van de titel (streamInfo) EN de werkelijke decoders van het apparaat voordat het begint:
  - video niet decodeerbaar door DIT apparaat (AV1, VP9…) → volledige transcodering direct, zonder twee foutmeldingen op het scherm;
  - audio niet te decoderen door dit apparaat, maar video OK → onmiddellijke 'alleen audio' fallback: de video wordt gekopieerd in bitstream (nooit opnieuw gecodeerd), alleen het geluid gaat naar AAC;
  - de alleen-audio fallback gebruikt HLS voor h264 bronnen (het meest robuust voor ExoPlayer) en DASH voor HEVC/AV1/VP9 (het enige formaat waarin Plex bitstream-kopie respecteert).
- 'Doorgaan met kijken' op een serie: het profiel van de huidige aflevering (seizoen, nummer, titel, synopsis) opent automatisch bij aankomst op de titel — de gebruiker hoeft deze niet meer in de lijst met seizoenen te zoeken.

## v1.16.42 — Augustus 2026

### Android TV: automatische update en afstandsbedieningnavigatie

- Auto-update: de installatie faalde stil bij elke poging (sessie geweigerd door het systeem — een datastroom die nooit werd gesloten voor validatie). Verholpen en geverifieerd onder echte omstandigheden.
- Afstandsbediening: vanaf de navigatiebalk bovenaan leidde de pijl omlaag nooit naar de inhoud eronder, op geen enkel tabblad — het systeem vond spontaan geen doel tussen de twee. Expliciet doel ingesteld zodat de pijl omlaag overal werkt (Home, Films, Series, Zoeken, Instellingen).

## v1.16.41 — Augustus 2026

### Android TV: bibliotheek en voortgang van serie

- De knop 'Toevoegen aan bibliotheek' toonde na het toevoegen niet meer de juiste status (downloading, etc.) — deze kon terugvallen op 'Toevoegen' vanwege een te snelle verversing. Nieuwe automatische pogingen.
- 'Doorgaan met kijken' op een serie opent nu direct de huidige aflevering (juist seizoen, CTA voor voortgang met nummer en titel van de aflevering) in plaats van altijd terug te vallen op seizoen 1 als een film.

## v1.16.40 — Augustus 2026

### Android TV: correcties opgehaald van echt apparaat

- Heraligneert het versienummer overal (`package.json`, README badge, `versionCode`/`versionName` van de Android TV app) — de afwijking tussen deze bronnen veroorzaakte mislukte updates.
- Verbetert een crash bij de compilatie van het profielscherm ('Wie ben ik?') veroorzaakt door onvolledig werk.
- Zoeken: verwijdert de balk 'Profiel openen' die onder de kaarten bij focus werd weergegeven — op een kaart zijn en valideren opent nu direct het profiel, net als overal anders.
- Instellingen en Zoeken: verwijdert de ondoorzichtige balk die boven de inhoud bleef hangen, reeds verwijderd van Home en de Films/Series catalogi.

## v1.16.33 — Augustus 2026

### Android TV: profielscherm — naam van het actieve profiel, toevoegen via login, duplicaten gedetecteerd

- **Naam van het actieve profiel overal**: bij het opnieuw opstarten op een persistente sessie, toonde de menubalk (gebruikersbadge) '—' en het avatar '?' — het actieve profiel wordt nu hersteld zodra de sessie is geverifieerd.
- **'Mijn profiel' en 'Gebruiker wijzigen'** leiden naar het profielscherm ('Wie ben ik?'): actieve profiel bovenaan (altijd zichtbaar, zelfs buiten het huishouden), huishoudleden, en de '+'-tegel — nooit meer directe doorverwijzing naar de login.
- **Gebruiker toevoegen = login**: de '+'-tegel opent de login met het te toevoegen account (speciale ondertitel); na inloggen voegt het account toe aan het huishouden en wordt het profielscherm weergegeven met de bevestiging.
- **Account al aanwezig gedetecteerd**: opnieuw inloggen met een account dat al in het huishouden zit, creëert geen dubplicaat — bericht 'Dit account is al in het huishouden'.

## v1.16.32 — Augustus 2026

### Profiel-isolatie verfijnd: iedereen behoudt ZIJN eigen weergaven, niets vermengt zich

- **Correctie van 1.16.31**: geïmporteerde vriendaccounts hebben hun eigen Plex-accounts (de admin voert slechts één import uit in Gebruikers, niets anders) — ze moeten dus **hun** geschiedenis, hun voortgang en hun voorkeuren ophalen, en niet leeg blijven.
- **Leckagebeveiliging in gegevens** : Plex kan de servergeschiedenis (die van het gekoppelde account) tonen in plaats van die van het gevraagde account. Het profiel (films + afleveringen) van elke geschiedenis wordt vergeleken met die van het gekoppelde account: identiek → weigering om te schrijven + verontreinigde eerdere gegevens worden gewist; verschillend → dit is inderdaad het van de gebruiker, normale synchronisatie. Geen activiteit van een profiel lekt naar een ander, en geen profiel wordt beroofd van zijn eigen gegevens.

## v1.16.31 — Augustus 2026

### Hermetische profielen + uitgebreid IA-geheugen + contextreset

- **Hermetische barrière tussen profielen (grote correctie)** : De IA-context van elk geïmporteerd vriendenprofiel toonde de activiteit van het gekoppelde account (294 bekeken films, The Simpsons 714 afleveringen...). Plex stuurt de servergeschiedenis voor vriendenaccounts, ongeacht het gevraagde account — de geschiedenis wordt nu alleen gesynchroniseerd voor het geauthenticeerde account met zijn eigen token; alle andere profielen (vrienden, Thuis) blijven strikt leeg, en verontreinigde gegevens worden gedetecteerd en gewist. Elk profiel heeft alleen zijn eigen bekeken items — de zijne, nooit die van een ander.
- **Continu conversatiegeheugen** : Elke besproken boodschap met de assistent (smaak, antipathie, voorkeur, gewoonte, voornaam...) wordt geëxtraheerd en geheugen opgeslagen naast het antwoord (zonder extra latentie), voorbij de alleen de markers die het model tot nu toe uitzond. Het plafond van vastgelegde feiten is verhoogd van 30 naar 100.
- **Knop "Context resetten"** in Profiel, naast "Context creëren" : Bevestiging in twee klikken, de geleerde context wordt gewist (stemmen en beoordelingen worden bewaard).

## v1.16.30 — Augustus 2026

### Android TV: auto-update gerepareerd (installatiefout)

- De installatie faalde stilzwijgend bij de `commit()`: Op Android 15+ moet de statusreceiver afkomstig zijn van een **wijzigbare** PendingIntent — `FLAG_IMMUTABLE` veroorzaakte `IllegalArgumentException` en de sessie werd afgebroken (de app bleef op de oude versie na de laadbalk).
- De PendingIntent voor de commit is nu `FLAG_MUTABLE`: de update wordt toegepast en de app start automatisch opnieuw op in de nieuwe versie.

## v1.16.29 — Augustus 2026

### Android TV: seriepagina — flikkeren en forceren terug naar seizoen 1 gestopt

- Het periodieke vernieuwen van de pagina (3 s) wist de seizoenen voordat ze opnieuw werden geladen: het scherm flikkerde en de D-pad selectie werd gereset (terug naar seizoen 1 na elke poll).
- Seizoenen worden nu alleen gewist bij een **VERANDERING** van serie; een simpele vernieuwing behoudt de weergave op zijn plaats.
- Het standaard seizoen wordt alleen geselecteerd bij het openen van de pagina: een vernieuwing overschrijft de gebruikerskeuze nooit meer.

## v1.16.28 — Augustus 2026

### Android TV: profielmenu verbeterd + navigatie

- Profielmenu in de kleuren van Movviz (diep donkere achtergrond, subtiele rand, heldere focus, merkverloop) met de kop "Actief profiel" (avatar + naam).
- Corrigeert de klik op "Gebruiker wijzigen": de menu-items reageerden niet op de pointerklik (ontbrak `tvPointerClick`) — de muis-/afstandsbedieningsklik werkt nu overal.
- Verwijdert het tabblad "Zoeken" uit de navigatiebalk: de vergrootglas is al aanwezig en opent de zoekopdracht vanaf het startscherm.

## v1.16.27 — Augustus 2026

### Android TV: auto-update correcties

- Corrigeert de installatie: `fsync(OutputStream)` sluit de stream zelf op API 35 — de extra `close()` liet de sessie verloren en de APK werd nooit geïnstalleerd (de app leek "te sluiten" na de update).
- Corrigeert de crash van de knop "Toestaan" (openen van onbekende broninstellingen zonder `FLAG_ACTIVITY_NEW_TASK` — AndroidRuntimeException op applicatiecontext).
- Voegt logs toe (`MovvizUpdate`) om de installatie en automatische herstart te volgen.

## v1.16.26 — Augustus 2026

### Android TV: profielmenu Netflix-stijl

- Vervangt de tekst "MOVVIZ TV" rechtsboven door de avatar van het actieve profiel, altijd zichtbaar.
- Bij klikken: Netflix-stijl menu met "Gebruiker wijzigen" (→ "Wie ben ik?" scherm: keuze van een huishoudprofiel of toevoegen van een lid), de huishoudprofielen als snelkoppeling en "+ Gebruiker toevoegen".
- Een gastaccount dat "Gebruiker wijzigen" selecteert, gaat terug naar het inlogscherm (het heeft geen huishouden).

## v1.16.25 — Augustus 2026

### Android TV: verbeterde auto-update

- De installatie gebeurt nu in de achtergrond (PackageInstaller session API): geen systeemscherm meer dat de app "sluit" — deze blijft zichtbaar met een laadbalk tijdens de installatie, waarna de applicatie automatisch opnieuw opstart op de nieuwe versie (receiver `MY_PACKAGE_REPLACED`).
- Verwijdert de systeeminstallator `ACTION_VIEW` (FileProvider is niet langer nodig voor deze flow).

### Android TV: zwarte balk van de catalogus

- Verbetert de zwarte balk boven de hero van de Films- en Series-tabs: de inhoud loopt nu onder de glazen navigatiebalk, net als op de Startpagina (de `padding` van 80 dp wordt alleen behouden voor Zoeken en Instellingen).

## v1.16.24 — Augustus 2026

### Android TV: huishoudprofielen op de server

- De huishoudprofielen worden nu opgeslagen op de server (`/api/tv-profiles`), niet alleen op het apparaat: een net geïnstalleerde APK toont niet langer de lokale profielen van het vorige apparaat.
- Beheer van het huishouden voor 100% admin: alleen de admin ziet de lijst met accounts en kan een lid toevoegen/verwijderen (keuze uit bestaande accounts, zonder wachtwoord). Een gastaccount dat inlogt vanaf een APK ziet het huishouden nooit en kan er niets aan toevoegen.
- Het scherm "Lid toevoegen aan huishouden" vervangt het inlogscherm om het huishouden te voeden via de selector en het navigatiemenu.
- Sessies blijven lokaal per apparaat (gescheiden per server en account).

### Android TV: catalogusheader

- Verwijdert de zwarte titelbalk boven de hero van de Films- en Series-tabs: de hero start nu helemaal bovenaan, net als op de Startpagina.

## v1.16.23 — Augustus 2026

### Android TV: afspelen

- Voegt het ontbrekende Media3 DASH-module toe om crashen te voorkomen bij het inklappen van de afspeler.

## v1.16.22 — Augustus 2026

### Android TV: profielcompilatie

- Verbetert de resolutie van de serverhost die wordt gebruikt om profielsessies op te slaan en te herstellen.

## v1.16.21 — Augustus 2026

### Android TV: profielmenu-correcties

- Verbetert de compilatie van de retail/AU selector en het profielmenu.
- Behoudt gescheiden sessies en gesynchroniseerde avatars.

## v1.16.20 — Augustus 2026

### Android TV: gesynchroniseerde profielen

- Voeg de profielkiezer toe bij het opstarten na het selecteren van de server.
- Hergebruikt bestaande Movviz-accounts, hun Plex-avatars en hun persistente sessies.
- Voeg het toevoegen van een profiel en het wijzigen van profiel toe vanuit het TV-menu.
- Er wordt geen jeugdprofiel of speciale rechten geïntroduceerd.

## v1.16.19 — Augustus 2026

### Android TV: auto-update zonder winkel (AU-variant)

- Nieuwe APK-variant **AU** ("auto-update") naast de retail: bij het opstarten vraagt deze de openbare Movviz GitHub-releases op, vergelijkt de versie en toont "Update, gelieve te wachten..." met een voortgangsbalk tijdens het downloaden.
- SHA-256 geverifieerd tegen het digest gepubliceerd op GitHub vóór installatie — een beschadigd of gemanipuleerd bestand wordt nooit geïnstalleerd.
- Installatie via de systeeminstaller (FileProvider); de toestemming "onbekende bronnen" wordt beheerd bij de eerste keer opstarten en automatisch hervat na het terugkeren naar de instellingen.
- De retail blijft zonder auto-update; beide APK's delen dezelfde handtekening — de AU wordt overgeschreven zonder dat gegevens verloren gaan.
- De CI publiceert nu beide APK's (`Movviz-Android-TV-client-retail.apk` en `Movviz-Android-TV-client-AU.apk`) bij elke release.

## v1.16.18 — Augustus 2026

### Android TV: afspelen in 3 niveaus — direct > ffmpeg audio alleen > HLS

- Direct afspelen (ruwe bytes) zolang ExoPlayer alles native kan decoderen — geen transcodering.
- Zodra een formaat niet te decoderen is (vaak audio: DTS/AC3/TrueHD), schakelt het over op een audio-alleen transcodering: de video wordt gekopieerd in bitstream (x264/x265 worden nooit opnieuw gecodeerd) en alleen het geluid wordt opnieuw gecodeerd naar aac, via DASH (het enige formaat waarin Plex bitstream copy ondersteunt, inclusief HEVC).
- Als de gekopieerde video nog steeds niet te decoderen is (bijv. AV1), laatste redmiddel: volledige transcodering h264/aac geserveerd in HLS.
- Elk niveau wordt slechts één keer per item geprobeerd, hervat op dezelfde positie, geen lus.

## v1.16.17 — Augustus 2026

### Navigatie in het titelpaneel

- Vanuit het paneel vernieuwt elke klik op een titel, acteur of collectie het paneel in plaats van een hele pagina te openen.
- De acteur- en collectie-weergaven delen nu strikt hetzelfde component als hun toegewijde pagina's (`PersonContent`, `CollectionContent`) — geen variant meer voor het paneel.

### Android TV: carrousels per type

- De Films-carrousel toont nu alleen films.
- De Series-carrousel toont nu alleen series.
- De gemengde carrousel van het algemene dashboard blijft ongewijzigd.

## v1.16.15 — Augustus 2026

### Android TV: verrijkt catalogus en vloeiender afspelen

- Hergebruikt bestaande redactionele rijen van het dashboard (`/api/metadata/rows`) in het dashboard, Films en Series.
- Voeg een gedeelde Media3 videocache van 1,5 GB en een uitgebreide afspeelbuffer toe om herladowingen te beperken.
- Behoud de Media3 audio- en ondertitelspoor en de bestaande transcodering fallback.

## v1.16.14 — Augustus 2026

### Android TV: retailversie en Plex-verbinding

- Verbetert de crash bij het opstarten van de geminimaliseerde release en tolereert oudere Plex-accounts zonder het `status`-veld.
- Behoudt de lokale retailsleutel buiten de repository en laat builds zonder keystore werken zonder geheimen bloot te leggen.

## v1.16.13 — Augustus 2026

### Android TV: Plex-koppeling diagnostiek

- Toont nu de fout die door de server wordt geretourneerd tijdens het pollen van de Plex PIN (`no_plex_access`, onbereikbaar Plex-account, enz.) in plaats van een algemene melding.
- Behoudt de desktopfeed ongewijzigd.

## v1.16.12 — Augustus 2026

### Android TV: titellogo's

- Verbetert een systematische verschuiving die het logo van de film of serie naar links buiten het scherm duwde op het startscherm en op de titelpagina, voor elk logo dat niet dezelfde marge heeft als die gebruikt is om de instelling te kalibreren.
- Verbetert de actieve menuknop ("Home") die onleesbaar werd door een ondoorzichtig wit blok zodra deze de afstandsbedieningfocus vasthield.

## v1.16.11 — Augustus 2026

### Android TV Versiebeheer

- Stelt de native versie van de Android TV APK eindelijk gelijk aan de gepubliceerde Movviz-versie (`1.16.11`) en incrementeert zijn `versionCode`.

## v1.16.10 — Augustus 2026

### Android TV: Plex-koppeling

- Autoriseert expliciet de nieuwe TV PIN-route in de authenticatieproxy zodat de emulator en Android TV-apparaten deze kunnen aanroepen zonder sessie.

## v1.16.9 — Augustus 2026

### Android TV: Plex-koppeling

- Voegt een speciale route toe voor de korte Plex-code voor TV-apparaten, zonder de bestaande Plex desktopfeed te wijzigen.
- Android TV toont en gebruikt de korte koppeling PIN via `plex.tv/link`.
- De subtiele link voor serverwijziging wist de lokale configuratie correct voordat deze terugkeerde naar de assistent.

## v1.16.8 — Augustus 2026

### Desktop Chat: Continuïteit en smaak

- De expliciete aantekeningen die in een gesprek worden gegeven, worden nu opgeslagen zonder afhankelijk te zijn van een modelmarker; een aantekening over 'alles' blijft een algemene voorkeur, zonder gereduceerd te worden tot slechts één film.
- Na een aanbevelingsaanbod, "ok", "ga ervoor" of "geef" wordt de selectie voortgezet en kan niet langer worden geïnterpreteerd als een te zoeken titel.
- Als de model een selectie aankondigt zonder kaarten terug te geven, vraagt Movviz opnieuw om een gestructureerd antwoord met aanbevelingen.

## v1.16.7 — Augustus 2026

### Android TV: Visuele identiteit Movviz

- Het geanimeerde TV-merk neemt de exacte geometrieën van het Lucide `Clapperboard`-icoon over dat op de desktop wordt gebruikt, via een native VectorDrawable.
- Versterkte regenbooghalo van paars, magenta en cyaan rond het geanimeerde logo, als een statische tegel, zonder de TV-navigatie te wijzigen.

## v1.16.6 — Augustus 2026

### Android TV: Navigatie en woonkamerbibliotheek

- Herzien TV-kaarten: officieel TMDb-logo, badges onder het logo, afzonderlijke herhaling en opnieuw starten, en terugkeer naar de kaart.
- Series bieden een seizoenkiezer zonder bonus S0, een per aflevering geïllustreerde kaart en de zoekfunctie naar een ontbrekend seizoen vanaf de televisie.
- Verbeterde dashboard: geanimeerde Movviz-navigatie, kaarten zonder visueel met een vaste merkhalo, en klikbare downloadkaarten met leesbare voortgang.

## v1.16.5 — Augustus 2026

### Correctie: matching worker ingebouwd in standalone installaties

- Het opschonen van de standalone bundle verwijderde de bestanden `*Worker.mjs` na de build: automatische zoekopdrachten konden dus mislukken vlak na het lezen van de RSS-cache op gepakte installaties sinds v1.16.1.
- De build kopieert nu expliciet alle workers naar de standalone runtime en de pools lossen deze op vanaf deze locatie. Parallel matching werkt weer; de lokale veiligheidsfallback blijft actief.

## v1.16.4 — Augustus 2026

### Correctie: verzoeken en automatische zoekopdrachten ontkoppeld

- Een goedgekeurd verzoek wordt nu opgeslagen zodra de film of serie in de bibliotheek terechtkomt, vóór de automatische zoekopdracht. Een indexerings- of matchingfout kan dus niet langer een media creëren zonder deze in **Verzoeken** te laten verschijnen.
- Onvoorziene fouten tijdens het zoeken naar een film, seizoen of aflevering worden een gecontroleerd en expliciet resultaat in het diagnostische logboek, in plaats van een fout 500 of een herstelde "zoeken"-status zonder oorzaak.

## v1.16.3 — Augustus 2026

### Correctie: betrouwbare automatische toevoeging, zelfs zonder beschikbare worker

- Het toevoegen van een film of serie stopt niet meer met een fout 500 als de matching worker niet wordt geladen door een gepakte installatie: Movviz past dan dezelfde matchingsregels direct in het hoofdproces toe en zet de automatische zoekopdracht voort.
- De falende worker pool wordt correct gestopt in plaats van in een lus opnieuw op te starten, waardoor het server niet in permanente fout blijft hangen.
- De kaart toont niet langer een HTTP-fout als een succesvolle toevoeging: de fout wordt weergegeven en de werkelijke status van de bibliotheek wordt opnieuw geladen.

### Android TV: Movviz-identiteit en ontdekkingspad

- Het TV-scherm neemt nu de visuele identiteit van Movviz over: officieel clap-logo, glasachtige navigatie op de hero, en kaarten en titelkaarten aangepast voor de afstandsbediening.
- De connectie met Plex en de bibliotheekacties zijn geïntegreerd in het TV-pad, met onmiddellijke terugkoppeling van de downloadstatus.

## v1.16.2 — Augustus 2026

### Nieuw: Gescheiden bibliotheek — pagina's voor Films en Series

- De bibliotheek is nu gesplitst in **drie vaste pagina's**: `/library` (Alles, beide types gemengd), `/movies` (alleen films) en `/series` (alleen series) — toegankelijk via het submenu "Bibliotheek" in de zijbalk.
- De pagina's Films en Series hebben geen typefilterknoppen meer (dat is hun vaste aard); sorteren, statusfilter en tags blijven beschikbaar. Oude links `?type=movie|series` leiden automatisch door naar de nieuwe pagina's.

## v1.16.1 — Augustus 2026

### Nieuw: Bibliotheek submenu in de zijbalk (desktop)

- Het menu "Bibliotheek" klapt nu onder drie items uit: **Alles**, **Films** en **Series** — een chevron opent/sluit het submenu, en het actieve item wordt gemarkeerd. De reeds toegepaste filters, sortering en tags worden behouden wanneer u schakelt tussen de drie weergaven.

### Correctie: build faalde door gebrek aan schijfruimte

- **Oorzaak geïdentificeerd**: De Turbopack build van Next.js 16 negeerde tracing-uitsluitingen en kopieerde ontwikkelingsmappen (`dta/`, `.movviz-data/`) — tot ~480 GB — naar de standalone bundle, totdat de schijf vol was. De build keert terug naar webpack (waar uitsluitingen werken) en een `clean-standalone` script ruimt wat buiten de bundle moet blijven op: de standalone gaat van ~480 GB naar ~64 MB.

## v1.16.0 — Augustus 2026

### Nieuw: Android TV client

- **Eerste native Movviz client** voor Android TV / Fire TV (afstandsbediening, toetsenbord en muis ondersteund): verbinding met een bestaande Movviz server, Films/Series bibliotheek, titelpagina, afleveringsafspelen, zoeken, instellingen — te downloaden als APK vanaf de GitHub Releases, naast de Windows-installer.
- Sessie behouden tussen opstarten, net als bij Plex of Netflix — u hoeft niet meer elke keer opnieuw in te loggen.

## v1.15.17 — Augustus 2026

### Correctie: een simpele aanroep werd opgevat als een filmtitel

- **Oorzaak bevestigd in het veld**: Het typen van "hep" om aandacht te trekken startte een zoekopdracht, en Movviz ging verder met een obscure Tsjechische film uit 2013 alsof dit het onderwerp van het gesprek was. De lijst met begroetingen en interjecties die als zodanig worden herkend (hep, hé, eh, ho, wesh, hmm, bref, ciao…) is aanzienlijk uitgebreid — echte korte titels zoals "300" of "Up" worden nog steeds correct herkend.

## v1.15.16 — Augustus 2026

### Correctie: een verkeerde titel kon worden toegevoegd wanneer films en series op elkaar leken

- **Oorzaak bevestigd in het veld**: Het vragen om "download Lanterns" voegde "Human Lanterns" (film uit 1982 zonder verband) toe, terwijl de serie "Lanterns" (2026) het allereerste zoekresultaat was. De assistent had aangenomen dat het om een film ging, en deze aanname schrak alle series af — inclusief de exacte overeenkomst. Een titel die duidelijk beter overeenkomt, heeft nu de overhand op deze aanname, of het nu om een film of een serie gaat.
- Sommige veelvoorkomende woorden ("de", "in", "en"…) kunnen niet langer worden opgevat als een voornaam.

## v1.15.15 — Augustus 2026

### Correctie: een gewoon woord kon worden opgeslagen als uw voornaam

- **Oorzaak bevestigd in het veld**: Het typen van een zin als "ik heb het niet gezien, is het met DiCaprio?" liet "Met" opslaan als voornaam, waarbij het echte woord werd overschreven. De detector nam elk woord na een "is het" in een zin op. Deze vorm wordt nu alleen herkend aan het absolute begin van een bericht (het antwoord "het is Seb" op de vraag naar de voornaam wordt nog steeds opgevangen), en een uitgebreide lijst van veelvoorkomende woorden kan nooit meer een voornaam worden.

### Correctie: een succesvolle beoordeling werd weergegeven als een mislukking

- **Oorzaak bevestigd in het veld**: Bij een verzoek als "geef X, Y en Z 5 sterren", werden de beoordelingen correct opgeslagen, maar de weergegeven reactie was "ik heb een echte blokkade" — de assistent had geen zin geformuleerd rond de beoordelingen. De bevestiging wordt nu opgebouwd uit de daadwerkelijk opgeslagen beoordelingen, met de lijst van titels en hun beoordeling.

## v1.15.14 — Augustus 2026

### Correctie: de aangekondigde scores werden niet daadwerkelijk opgeslagen

- **Oorzaak direct bevestigd**: na het individueel doornemen van titels, veroorzaakte het antwoord "ik vond het geweldig, geef allemaal 5 sterren" een nette lijst ("Solo Leveling: 5/5", "Jurassic Park: 5/5"…) en kondigde "hier zijn de bijgewerkte scores" aan — terwijl **geen enkele score werd opgeslagen**. Twee cumulatieve oorzaken: een intern plafond van maximaal 2 scores per antwoord maakte groepsbeoordeling structureel onmogelijk, en niets verhinderde het aankondigen van scores zonder ze daadwerkelijk te plaatsen.
- De groepsbeoordeling accepteert nu tot 10 titels tegelijk, en elk antwoord dat scores aankondigt zonder ze daadwerkelijk op te slaan, wordt automatisch gedetecteerd en gecorrigeerd — nooit meer een aangekondigde maar afwezige score.

## v1.15.13 — Augustus 2026

### Movviz AI — het onderwerp van het gesprek wordt nu expliciet gevolgd

- **Oorzaak geïdentificeerd tijdens de audit**: buiten een geopende film-/seriepagina gaf niets aan de assistent welke titel u besprak — hij moest dit raden door de geschiedenis opnieuw te lezen, wat faalde bij natuurlijke opeenvolgingen ("Solo Leveling" → "ik hou ervan" → "het beste is tegen X") en een nuttige zoekopdracht kon opnieuw starten bij het derde bericht. De titel die momenteel wordt besproken, wordt nu gememoord zodra deze daadwerkelijk is geïdentificeerd, en herinnerd bij elk volgend bericht: korte reacties, impliciete verwijzingen en personages verwijzen standaard naar deze titel, zonder opnieuw te zoeken.

## v1.15.12 — Augustus 2026

### Movviz AI — filmografie en kruisverwijzingen voor het prioriteren van een ontbrekende titel

- Wanneer een filmografische zoekopdracht ontbrekende titels onthult en de gebruiker beoordelingen heeft gegeven, kan de assistent nu beide kruisen om voor te stellen welke van de ontbrekende titels de grootste kans heeft om te boeien, op basis van daadwerkelijk gedeelde kenmerken (toon, genre, structuur) — nooit een verzonnen intuïtie.

## v1.15.11 — Augustus 2026

### Movviz AI — geünificeerde beslissingshiërarchie

- De vele afzonderlijk toegevoegde regels (korte reacties, correcties, titelvermeldingen, eenmalige meningen...) zijn nu samengebracht onder een expliciete en unieke prioriteitsvolgorde, om te voorkomen dat geïsoleerde regels elkaar tegenspreken: reactie op het lopende gesprek > verwijzing naar het actieve onderwerp (een personage, een scène, "de tweede"...) > correctie van het vorige antwoord > conversatieintentie > reeds bekend werk > potentieel nieuw werk > externe zoekopdracht als laatste redmiddel.
- Een mening over een specifiek personage (bv. "Beru is duidelijk de beste") wordt nu behandeld als meningen over een reeds gedekte scène/acteur/einde: gememoord als wat het is, nooit omgezet in een algemene score voor de titel.

## v1.15.10 — Augustus 2026

### Movviz AI — subtiel badge in plaats van een geforceerde opening

- Wanneer Movviz het gesprek spontaan hervat na een afwezigheid, opent het chatvenster niet langer automatisch — de zwevende knop toont nu een genummerd badge met een korte puls, totdat de gebruiker het zelf opent.

## v1.15.9 — Augustus 2026

### Movviz AI — spontane hervatting kan nu betrekking hebben op een score

- Wanneer Movviz het gesprek spontaan hervat na een afwezigheid (bestaand mechanisme, met eigen wachttijd), kan het nu, op gelegenheid, direct de score vragen van een bekeken maar nooit beoordeelde titel in plaats van een algemene vraag — nooit twee keer via twee verschillende kanalen binnen dezelfde tijdsperiode.

## v1.15.8 — Augustus 2026

### Correctie: een score update niet de context in realtime

- **Oorzaak direct bevestigd**: In tegenstelling tot elke andere daadwerkelijke activiteit (bekeken, 👍/👎 teruggekoppeld, Netflix geïmporteerd), veroorzaakte het plaatsen van een score — via de sterrenwidget of in een gesprek — geen bijwerken van de geconsolideerde context ("Wat Movviz AI over jou weet"). Men moest handmatig op "Context opnieuw genereren" klikken zodat de scores werden meegenomen. Een score verspreidt nu automatisch, net als de rest.

### Movviz AI — occasionele vraag over een gezien, maar nooit beoordeeld titel

- Af en toe, wanneer het gesprek er natuurlijk om vraagt, kan de assistent nu om de beoordeling van een volledig gezien, maar nooit beoordeeld titel vragen — nooit systematisch (beperkt tot één keer om de paar uur, nooit opgelegd als het moment niet geschikt is).

### Profielpaneel — verwijder een 👍/👎 feedback

- Elk beoordeeld/afgekeurd titel op het paneel "Wat Movviz AI over jou weet" heeft nu een knop om het uit de context te verwijderen (handig voor een per ongeluk gegeven stem).

## v1.15.7 — Augustus 2026

### Movviz AI — een eerder afgekeurde titel wordt nooit meer voorgesteld

- Een titel gemarkeerd als "slechte aanbeveling" (👎) wordt nu definitief uit toekomstige aanbevelingen verwijderd — voorheen gold slechts een lichte straf voor titels met een vergelijkbare toon, wat de exacte eerder afgekeurde titel niet kon voorkomen.

## v1.15.6 — Augustus 2026

### Movviz AI — onderscheid tussen een incidentele opmerking en een algemene beoordeling

- Een opmerking over een specifiek element ("ik hou van deze scène", "deze acteur is geweldig", "het einde is een flop") leidt niet langer tot het afleiden van een algemene beoordeling van de hele titel — alleen een mening die over de hele film of serie wordt geuit, wordt omgezet in een beoordeling.

## v1.15.5 — Augustus 2026

### Movviz AI — versterkte identiteit van filmgenoot

- De assistent redeneert nu expliciet als een filmgenoot die probeert de gebruiker te begrijpen (waarom hij een titel leuk vindt, niet alleen welk genre) in plaats van een zoekmachine met tekst eromheen.
- Korte antwoorden ("toch wel", "die ene", "ik heb het al gezien"... ) veroorzaken nooit meer een onnodige zoekopdracht — ze worden nu erkend als reacties/correcties die begrepen moeten worden in relatie tot de vorige boodschap, nooit als een nieuwe titel om te zoeken.
- Wanneer het gesprek een simpel filmgesprek is, staan het verzamelen van voorkeuren en het opvolgen op de achtergrond ten gunste van een natuurlijk gesprek.
- Algemene assistentformuleringen ("Kan ik u helpen?...") expliciet verboden.

## v1.15.4 — Augustus 2026

### Correctie: versterkte garantie tegen ruwe technische lijnen (vervolging van de vorige correctie)

- **Oorzaak direct bevestigd**: De correctie v1.15.3 was gebaseerd op een nieuwe poging van Movviz om te antwoorden, wat dezelfde technische lijn kon reproduceren in plaats van een echte zin. Er is nu een deterministische automatische herformulering ingebouwd (zonder afhankelijk te zijn van een nieuwe poging van het taalmodel) om te garanderen dat er nooit een ruwe technische lijn bij de gebruiker terechtkomt.

## v1.15.3 — Augustus 2026

### Correctie: vermelding van een titel die soms wordt beantwoord met een technische lijn in plaats van een echte zin

- **Oorzaak direct bevestigd**: De correctie v1.15.2 voorkwam wel het stille toevoegen, maar in sommige gevallen antwoordde de assistent toch met één lijn in het formaat "• Al in de bibliotheek — Titel (jaar)" — een imitatie van het technische formaat dat intern wordt gebruikt voor toevoegingsresultaten, dat per ongeluk werd gekopieerd in plaats van een echte natuurlijke reactie. Dit mechanische formaat wordt nu gedetecteerd en automatisch gecorrigeerd om altijd een echte zin te garanderen.

## v1.15.2 — Augustus 2026

### Correctie: vermelding van een titel die soms wordt behandeld als een stille toevoeging

- **Oorzaak direct bevestigd**: De verificatie toegevoegd in v1.15.1 (bibliotheek/geschiedenis/beoordeling voordat er op een genoemde titel wordt gereageerd) werd in sommige gevallen in werkelijkheid nooit geactiveerd, omdat de assistent soms een simpele vermelding van een titel ("Hurlevent", "the nice guys") interpreteerde als een impliciete aanvraag om toe te voegen — resultaat: een technische lijn ("Al in de bibliotheek — X") zonder enige reactie, in plaats van een echt antwoord. Gecorrigeerd: een vermelding van een titel zonder expliciet actiewerkwoord (toevoegen, plaatsen, downloaden...) triggert nu nooit meer een stille toevoeging en gaat nu correct via het verwachte natuurlijke antwoord.

## v1.15.1 — Augustus 2026

### Correctie: Movviz AI raadpleegde niet wat het al wist voordat het antwoordde

- **Oorzaak direct bevestigd** : bij het noemen van een titel ("zootopie 2") vroeg de assistent "wil je het toevoegen?" voor een reeds aanwezige titel, of "heb je het gezien?" terwijl de geschiedenis het al wist — hij had simpelweg geen echte controle te raadplegen voor een toevallige vermelding (alleen expliciete vragen veroorzaakten dit). Hij raadpleegt nu systematisch de bibliotheek, de kijkgeschiedenis en de bestaande beoordeling voordat hij reageert op een genoemde titel, en stelt geen vraag meer waarvan hij het antwoord al weet.
- Wanneer een genoemde titel wordt gezien maar nooit beoordeeld, vraagt de assistent hier natuurlijk naar de mening in één zin, zonder het een verhoor te laten worden.
- Correctie van een belofte zonder vervolg: de assistent kon antwoorden "ik ga het meteen checken!" en vervolgens nooit met het antwoord terugkomen — aangezien een gesprek geen automatische tweede fase heeft, is dit soort beloften nu verboden; ofwel de controle vindt plaats in het bericht zelf, of de assistent zegt eerlijk dat hij het niet kan controleren.
- Verscherpte persoonlijkheid: vaker gebruik van de bekende voornaam, meer maar niet overdreven emoji's, reactie vóór vraag in plaats van andersom.
- Extra veiligheidsnet om te voorkomen dat een interne technische opmaak ooit zo wordt weergegeven in een antwoord.

## v1.15.0 — Augustus 2026

### Beoordelingen van 1 tot 5 sterren (nieuw)

- Elke film en serie kan nu een beoordeling van 1 tot 5 sterren krijgen, rechtstreeks vanaf de fiche — slechts één beoordeling per titel en per gebruiker, nooit gedeeld tussen accounts.
- Movviz AI begrijpt ook een beoordeling gegeven in een gesprek ("ik vond het geweldig", "wat een teleurstelling", "ik geef hem 4 sterren") en slaat deze automatisch op, zonder ooit te raden wanneer het niet duidelijk genoeg is — een handmatig op de fiche geplaatste beoordeling gaat altijd voor op een afgeleide beoordeling uit een zin.
- Deze beoordelingen verfijnen zowel de aanbevelingen van de chatbot als de suggesties van de Ontdekking-pagina, die nu dezelfde begrip van je smaak delen in plaats van twee aparte logica's.
- Het paneel "Wat Movviz AI over jou weet" (Profielpagina) toont nu je recente beoordelingen, waarbij onderscheid wordt gemaakt tussen handmatig geplaatste en uit een gesprek afgeleide beoordelingen.

## v1.14.48 — Augustus 2026

### Correctie: prullenbakknop zichtbaar voor iedereen in de bibliotheek

- **Oorzaak direct bevestigd** : de knop om een film te verwijderen (bibliotheekkaart en filmfiche) was zichtbaar voor elke gebruiker, terwijl de server de verwijdering voor niet-beheerdersaccounts al correct weigerde — er was dus geen gegevensrisico, maar een normale gebruiker zag een knop die stilzwijgend faalde bij het klikken. De knop is nu alleen zichtbaar voor beheerdersaccounts, net als overal anders in de app.

## v1.14.47 — Augustus 2026

### Correctie: rij "Doorgaan met kijken" onterecht geleegd

- **Oorzaak direct bevestigd** : de dubbele controle toegevoegd in v1.14.44 (voorzichtig, zonder zekerheid dat het nodig was) vergelijkte elke "lopende" titel met de reeds gesynchroniseerde kijkgeschiedenis — een geschiedenis die slechts elke 2 uur wordt bijgewerkt. Een recent gestarte titel stond er nog niet in, waardoor deze onterecht uit de rij verdween terwijl hij wel van jou was. Resultaat: de rij ging van 10 echte titels naar slechts 3. Deze dubbele controle is verwijderd; de oorspronkelijke bescherming (het token per account) blijft intact.

### Correctie: Movviz AI en webtoegang (vervolg)

- **Oorzaak direct bevestigd, twee keer** : ondanks de correctie van de vorige versie, ontkende Movviz AI soms nog steeds categorisch elke toegang tot het internet, zelfs als de webzoekfunctie in de instellingen was ingeschakeld — het beleid alleen was niet voldoende om dit betrouwbaar te voorkomen. Movviz AI detecteert nu deze onjuiste ontkenning en corrigeert zichzelf onmiddellijk voordat het iets weergeeft, dezelfde aanpak als voor andere reeds ingebouwde automatische correcties.

## v1.14.46 — Augustus 2026

### Correctie: Movviz AI en webtoegang

- **Geconstateerde oorzaak** : Movviz AI antwoordde "ik heb geen toegang tot het internet" als een vaste technische onmogelijkheid, zonder ooit rekening te houden met de daadwerkelijk ingeschakelde of uitgeschakelde instelling "Webzoekopdracht" op het account (sectie AI in Instellingen). Het kent nu de werkelijke status van deze instelling: als deze uitgeschakeld is, legt het uit als een omkeerbare configuratiekeuze in plaats van een definitieve limiet; als deze ingeschakeld is, beweert het niet langer geen toegang te hebben, terwijl er voor bepaalde specifieke functies (zoals het terugvinden van een memorabele scène) daadwerkelijk gezocht wordt. Ter herinnering, deze instelling treedt onmiddellijk in werking bij de volgende bericht, zonder de pagina opnieuw te laden of opnieuw te verbinden.

## v1.14.45 — Augustus 2026

### Nieuw: Movviz AI kan eindelijk antwoorden op "geef me de filmografie van X"

- **Geconstateerde oorzaak live** : Het vragen naar de filmografie van een acteur of regisseur ("geef me de filmografie van Brad Pitt") kreeg nog steeds dezelfde weigering, woordelijk, zelfs na meerdere keren aandringen — Movviz AI had simpelweg geen echte gegevens voor dit specifieke type vraag, in tegenstelling tot "wat mis ik van X", wat al verbonden was met een echte zoekopdracht. Een echte zoekopdracht naar de persoon op TMDb (met zijn echte filmografie, gekruist met uw bibliotheek) wordt nu getriggerd voor deze specifieke vraag.
- Movviz AI herhaalt niet langer een antwoord woordelijk van het ene bericht naar het andere in hetzelfde gesprek — de formulering varieert altijd, zelfs als de inhoud van het antwoord hetzelfde blijft.

## v1.14.44 — Augustus 2026

### Correctie: tweede vangnet voor "Doorkijken"

- De rij "Doorkijken" controleert nu, naast de gegevens die door Plex worden geretourneerd, of de betreffende titel daadwerkelijk in de kijkgeschiedenis van het account staat dat de pagina bekijkt voordat deze wordt weergegeven — een titel zonder enige spoor in deze geschiedenis wordt nooit getoond, ongeacht wat Plex mogelijk heeft geretourneerd. Deze dubbele controle beschermt tegen mogelijke accountverwarring aan de Plex-kant, onafhankelijk van de exacte oorzaak.

## v1.14.43 — Augustus 2026

### Grote correctie: isolatie van gebruikersaccounts

- **Geconstateerde oorzaak** : Op een gedeerd apparaat deed het uitloggen en opnieuw inloggen met een ander account nooit de reeds in het geheugen weergegeven gegevens (views, voorkeuren, verzoeken, alles wat persoonlijk is) opnieuw in — een eerdere correctie had slechts één technisch element (de verbindingsstatus) gereset, niet de rest. Resultaat: het volgende account kon voor een moment, of soms permanent, de gegevens van het vorige account zien voordat deze vanzelf ververst werden. Alle persoonlijke gegevens worden nu volledig gereset bij elke in- en uitlogging — geen lek meer van het ene account naar het andere.
- **Tweede oorzaak gevonden door onderzoek** : Een secundair Plex-profiel (account "thuis"/kind gekoppeld door de admin, zonder eigen Plex-verbinding) zag nooit dat zijn bekeken films/afleveringen synchroniseerden vanuit Plex — de achtergrondtaak negeerde deze profielen simpelweg. Verholpen: elk profiel, inclusief secundaire profielen, heeft nu zijn eigen gesynchroniseerde views onafhankelijk.

## v1.14.42 — Augustus 2026

### Correctie: rij "Beschikbare optimalisaties" in fout

- **Geconstateerde oorzaak live** (paneel Instellingen > Prestaties) : Zelfs na de vorige correctie faalde de rij "Beschikbare optimalisaties" op het dashboard systematisch na een minuut — het startte, bij elke opening van het dashboard, tot 50 live zoekopdrachten op de indexers (één per betreffende film/aflevering), één na de ander, ruim voldoende om de wachtperiode van de server te overschrijden. Deze rij beperkt zich nu tot de reeds in het geheugen aanwezige cache, van nature snel; de volledige live zoekopdracht blijft volledig beschikbaar in het paneel "Zoeken en vervangen", handmatig getriggerd.

## v1.14.41 — Augustus 2026

### Correctie: algemene traagheid van de applicatie

- **Oorzaak direct bevestigd** (paneel Instellingen > Prestaties): het zoeken naar beschikbare optimalisaties (de rij "Beschikbare optimalisaties" op het dashboard, en het paneel "Zoeken en vervangen") analyseerde de gehele gecachede releases voor ELKE film en ELKE aflevering van de bibliotheek, in plaats van dit één keer te doen en het resultaat te hergebruiken — op een grote bibliotheek verzadigde dit herhaalde werk de server gedurende tientallen seconden en vertraagde het ALLE andere pagina's tegelijk (laden van het dashboard, de bibliotheek, de verzoeken...), zelfs zonder verband met de optimalisaties. De berekening wordt nu één keer uitgevoerd, met een strikt identiek resultaat.

## v1.14.40 — Augustus 2026

### Correctie: Movviz AI

- **Oorzaak direct bevestigd**: een aanbevelingsverzoek ("verbaas me") kon een antwoord ontvangen dat een lijst aankondigt ("Hier is wat je zou moeten verrassen...") zonder dat er een titel volgde — een belofte die nooit werd ingelost, zonder aanbevelingskaart of foutmelding. Movviz AI detecteert dit nu en vraagt onmiddellijk opnieuw om een echte lijst voordat er iets wordt weergegeven.

## v1.14.39 — Augustus 2026

### Correctie: rij "Doorkijken"

- **Oorzaak direct bevestigd**: Plex mengt in zijn "on deck"-lijst twee verschillende dingen — wat daadwerkelijk gepauzeerd is tijdens het afspelen, en de volgende aflevering van een serie die nog nooit is gestart maar wordt benadrukt omdat een eerdere aflevering is bekeken. De rij toonde dus tientallen thumbnails met een voortgangsbalk op 0%, die nooit echt waren gestart. Alleen de daadwerkelijk voortgezet inhoud wordt nu weergegeven.

## v1.14.38 — Augustus 2026

### Nieuw: rij "Doorkijken"

- Het dashboard toont nu een "Doorkijken"-rij, tussen "Movviz Trends" en "Aangepaste suggesties" — de lopende films en afleveringen, met de werkelijke voortgangsbalk, of ze nu zijn voortgezet vanuit een klassieke Plex-app of rechtstreeks vanuit de ingebouwde Movviz-speler. In te schakelen/uit te schakelen in Instellingen, net als de andere rijen.
- **Oorzaak tegelijkertijd gecorrigeerd**: de ingebouwde Movviz-speler meldde zijn voortgang correct aan Plex bij elke afspelling, maar een ontbrekende technische parameter liet Plex dit signaal stilzwijgend negeren — de voortgang werd dus nooit daadwerkelijk opgeslagen aan de serverkant. Verholpen, met als bonus de toewijzing aan het juiste account wanneer meerdere gebruikers hetzelfde Plex delen.

## v1.14.37 — Augustus 2026

### Correctie: Movviz AI

- **Oorzaak direct bevestigd**: elke aanbeveling toonde een algemene excusesmelding ("ik heb een echte blokkade...") net boven de suggesties, zelfs als de aanbeveling perfect was geslaagd — een echt vertrouwenprobleem op de meest gebruikte route van de functie. De begeleidende zin van een aanbeveling werd in werkelijkheid nooit geconstrueerd en viel daarom standaard terug op de algemene foutmelding. Een echte inleidende zin wordt nu bij elke aanbeveling weergegeven.

## v1.14.36 — Augustus 2026

### Correctie: Movviz AI

- **Oorzaak direct bevestigd**: vragen als "herinner je je mijn voornaam?" konden een "ik weet het nog niet" ontvangen, terwijl Movviz AI het voornaam juist enkele berichten eerder in hetzelfde gesprek had gebruikt — de voornaam werd wel vastgehouden, maar het antwoord ontkende het toch. Movviz AI detecteert dit soort valse ontkenningen nu en corrigeert zichzelf onmiddellijk voordat er iets wordt weergegeven.

## v1.14.35 — Augustus 2026

### Correctie: Movviz AI

- **Direct bevestigde oorzaak, na de correctie van de vorige versie**: de instructie alleen was niet voldoende om te voorkomen dat bepaalde modellen de interne technische notitie letterlijk kopieerden in plaats van deze te parafraseren — het probleem bleef bestaan ondanks een versterkte instructie. Movviz AI detecteert nu zelf wanneer dit gebeurt en vraagt onmiddellijk om een echte parafrasering voordat er iets wordt weergegeven; als zelfs deze herinnering mislukt, wordt de notitie automatisch schoongemaakt van alles wat het als technisch verraadde. De interne vermelding kan niet langer in een antwoord verschijnen, ongeacht het gebruikte model.

## v1.14.34 — Augustus 2026

### Movviz AI

- **Direct bevestigde oorzaak**: wanneer er een echte verificatie werd uitgevoerd om een specifieke vraag te beantwoorden (bezit, bekeken, casting, status van een serie, wat er mist van een franchise), kopieerde Movviz AI soms de interne technische notitie letterlijk in plaats van een echte zin te formuleren — een antwoord dat meer klonk als een database-extract dan als een gesprek. Verholpen: de geverifieerde feiten blijven accuraat, maar worden nu altijd natuurlijk geformuleerd.
- Algemeen versterkte persoonlijkheid: expliciete instructie om nooit meer interne formatteer- of technische structuren in een antwoord te laten doorschemeren, ongeacht het type vraag.
- **Direct bevestigde oorzaak**: een aanbeveling of toevoeging die iets te lang was, kon op sommige modellen middenin worden afgekapt — tot nu toe zorgde elke onderbreking ervoor dat alles verloren ging en een algemene foutmelding werd weergegeven. Movviz AI haalt nu de reeds volledige elementen van een afgekapt antwoord op, in plaats van alles weg te gooien.

## v1.14.33 — Augustus 2026

### Correctie: Netflix importeren

- **Direct bevestigde oorzaak bij een echte export**: twee herkenningsbugs leidden tot het missen van een groot deel van de titels. Ten eerste werd een geïsoleerd aflevernummer ("Aflevering 24") ten onrechte genomen als een seizoensnummer — gezocht als "seizoen 24" van een serie die er maar 2 of 3 heeft, dus onvindbaar. Ten tweede kon een serie zonder seizoenslabel (alleen "Serie: Titel van aflevering") verkeerd worden geïnterpreteerd tijdens het zoeken en het specifieke aflevering kwijtraken.
- De vermeldingen "Deel N" en "Volume N" worden nu erkend als seizoenen, net als "Seizoen N".

## v1.14.32 — Augustus 2026

### Movviz AI

- Movviz AI controleert nu daadwerkelijk, voordat het antwoordt, vier soorten vragen over een specifieke titel in plaats van te gissen op basis van zijn geheugen: of je al een titel bezit ("heb ik Alien?"), of je het al gezien hebt (volledig of slechts gedeeltelijk), wie erin speelt en wie het heeft geregisseerd, en of een serie is afgelopen of nog gaande. Als de vraag niet betrouwbaar kan worden geverifieerd (titel niet gevonden), zegt het dit duidelijk in plaats van een antwoord te verzinnen.

## v1.14.31 — Augustus 2026

### Correctie

- **Direct bevestigde oorzaak**: wanneer je vraagt wat je mist van een acteur, regisseur of franchise ("welke film van... mis ik"), kon Movviz AI nog steeds een vals antwoord verzinnen ("je hebt geen Pokémon-film") ondanks een eerdere correctie op dit soort fouten — de instructie alleen was niet voldoende om dit betrouwbaar te voorkomen. Voor deze specifieke formulering start Movviz AI nu een echte zoekopdracht in de catalogus en controleert daadwerkelijk, titel voor titel, wat er al in je bibliotheek staat voordat het antwoordt, in plaats van te gissen.

## v1.14.30 — Augustus 2026

### Movviz AI

- Movviz AI weet nu sinds wanneer je niets hebt gekeken en met welke snelheid je momenteel kijkt (aantal keer bekeken in de laatste 7 en 30 dagen) — een echt signaal, gebaseerd op je gedateerde bekeken, voor antwoorden die beter afgestemd zijn op je recente activiteit dan op simpele ruwe tellers. Deze informatie is ook zichtbaar in het paneel "Wat Movviz AI over jou weet" in het profiel.

## v1.14.29 — Augustus 2026

### Correctie

- **Oorzaak direct bevestigd** : de knop « Plex synchronisatie forceren » vroeg inderdaad aan Plex om opnieuw te scannen, maar voerde onmiddellijk de Movviz-synchronisatie uit — voordat Plex zijn eigen achtergrondscan had voltooid. Resultaat: de knop toonde succes zonder ooit de blokkade « wachtend op Plex-synchronisatie » op te lossen. Verholpen: er wordt nu een echte vertraging ingehouden voordat er wordt gecontroleerd, met een tweede automatische controle enkele seconden later voor langzamer scannende bibliotheken.

## v1.14.28 — Augustus 2026

### Movviz AI

- Wanneer je de assistent corrigeert omdat deze onterecht beweerde dat een titel niet in je bibliotheek stond, wordt deze correctie nu bewaard — als dezelfde fout meerdere keren optreedt, wordt de assistent aanzienlijk voorzichtiger voordat hij een afwezigheid verklaart, in plaats van dezelfde fout te herhalen bij elk gesprek.

## v1.14.27 — Augustus 2026

### Movviz AI

- De geconsolideerde context (« wat Movviz AI over jou weet ») wordt nu bij bijna elke daadwerkelijke actie bijgewerkt (film/aflevering gemarkeerd bekeken, stem 👍/👎, Netflix-import voltooid) in plaats van alleen bij het openen van het chatvenster — nog steeds met maximaal één berekening tegelijk, nooit een continue verwerking.

## v1.14.26 — Augustus 2026

### Movviz AI Correcties

- **Oorzaak direct bevestigd** : wanneer het taalmodel antwoordde zonder één echte zin (bijvoorbeeld omdat het hele antwoord alleen diende om interne informatie te onthouden), gaf de Movviz-chat een compleet ongepast « Oké! » — zelfs bij een directe opmerking van de gebruiker of een echte vraag zoals « wat nog meer? ». Een nieuwe controle detecteert dit geval en vraagt onmiddellijk om een echt antwoord voordat het wordt weergegeven, zonder dat dit zichtbaar is of het gesprek vertraagt; in aller uiterste geval erkent een bericht eerlijk de moeilijkheid in plaats van een ongepaste « Oké! ».
- **Oorzaak direct bevestigd** : vragen als « wat mis ik van [tel komiek/acteur/regisseur]? » kon een lijst met volledig verzonnen titels opleveren, die onterecht als geverifieerd in de bibliotheek werd gepresenteerd (« volgens je geschiedenis ») — tot het punt dat het beweerde dat een titel ontbrak terwijl deze al aanwezig was. Dit type vraag mag nu geen lijst meer verzinnen: de chat legt eerlijk uit dat het dit niet betrouwbaar hier kan verifiëren en verwijst naar de Movviz-zoekfunctie, waar elke titel daadwerkelijk aangeeft of deze al in de bibliotheek staat.

## v1.14.25 — Augustus 2026

### Movviz AI Correctie

- **Oorzaak direct bevestigd** : antwoorden met één woord (« Seb ») op de eigen vraag « hoe heet je? » was niet voldoende — de voornaam werd nooit onthouden, terwijl het normaal bleef worden gebruikt in het lopende gesprek. Resultaat: het kon beweren « je hebt me je voornaam niet gegeven » terwijl het deze in dezelfde zin gebruikte. Verholpen: een kort antwoord op de eigen vraag over de voornaam wordt nu correct herkend en bewaard.

## v1.14.24 — Augustus 2026

### Movviz AI Correcties

- **Oorzaak direct bevestigd** : het plakken van een lange lijst met titels (bv. gekopieerd uit een Netflix-geschiedenis) veroorzaakte een fout in de antwoordlus, ongeacht de herformulering — het gegenereerde antwoord overschreed de toegestane lengte en kwam getruncate, dus ongeldig. De limiet is verhoogd, en het toevoegen van meer dan 25 titels tegelijk wordt nu correct beperkt tot de eerste 25 in plaats van te proberen (en te falen) op alles in één keer.
- Een titel in het formaat « Serie: Titel van aflevering » (typisch voor een Netflix-export, bv. « Sakamoto Days: De legendarische moordenaar ») werd zo gezocht en vond nooit iets — nu erkend als de serie alleen, EN de specifieke aflevering wordt gevonden en gemarkeerd als bekeken (niet alleen de serie toegevoegd).
- Nieuw: het vragen naar de lijst met afleveringen van een serie (op de seriepagina) geeft de echte lijst van Movviz terug, met de status bekeken — geen weigeringen of verzonnen antwoorden meer.

## v1.14.23 — Augustus 2026

### Nieuw

- Een titel die vastzit op « Wachten op synchronisatie Plex » (bestand aanwezig maar nog niet gevonden door Plex) biedt nu een knop om de synchronisatie onmiddellijk te forceren (admin), in plaats van te wachten op de volgende automatische cyclus (tot 5 minuten).

## v1.14.22 — Augustus 2026

### Correctie: Netflix importeren

- **Oorzaak bevestigd in realtime** (echte export van 3217 rijen): de import zat in één HTTP-verzoek, dat afliep voordat het op een grote geschiedenis was voltooid — elke titel/aflevering vereist een online zoekopdracht, en een geschiedenis van meerdere jaren accumuleert er honderden.
- **Verholpen**: de import draait nu in de achtergrond op de server met een voortgangsbalk direct in de knop — je kunt de Instellingenpagina verlaten tijdens de import; het gaat door en toont de voortgang als je terugkeert.
- Twee herkenningsbugs zijn verholpen: de datum van een bekeken item werd verkeerd geïnterpreteerd (dag/maand omgedraaid afhankelijk van de export), en series waarvan de titel zelf een « : » bevat (bv. miniserie) werden verkeerd opgesplitst.

## v1.14.21 — Augustus 2026

### Netflix

- Instellingen → Netflix biedt nu een directe link naar je Netflix kijkactiviteitspagina (knop « Alles downloaden »), zodat je niet meer hoeft te zoeken waar je het bestand kunt importeren.

## v1.14.20 — Augustus 2026

### Nieuw: Netflix integratie

- Instellingen → Netflix: importeer je Netflix geschiedenis (bestand gedownload van je eigen Netflix-account, geen wachtwoord vereist) om deze films en afleveringen gemarkeerd te krijgen in Movviz — strikt privé voor elk account.
- De status « Bekeken » handmatig aangevinkt, of geïmporteerd vanuit Netflix, wordt nu doorgegeven aan je gekoppelde Plex-account (film, serie, seizoen, aflevering) — voorheen werkte de synchronisatie alleen in de andere richting (Plex naar Movviz).

## v1.14.19 — Augustus 2026

### Correctie

- De pop-up « nieuwigheden » toonde soms niet-gevertelde tekst voor niet-Franse interfaces — de vertaling van deze pop-up per taal was al geruime tijd niet meer onderhouden, waardoor het fallback-mechanisme dit niet opmerkte. Vereenvoudigd: één enkele bron van waarheid, in het Frans, consistent met de rest van de repository.

## v1.14.18 — Augustus 2026

### Movviz AI

- De assistent past nu zich aan aan ieders stijl (direct, informeel, met humor...) in plaats van een vaste toon, en varieert zijn formuleringen om nooit te herhalen.
- Wanneer je na een periode van afwezigheid terugkomt naar Movviz, kan de assistent het gesprek zelf starten met een vraag over film — nooit meer dan eens in de paar uur.
- Nieuwe knop « Context creëren » op je profielpagina: een analyse van je daadwerkelijke activiteit (bekeken, verzoeken, feedback) bouwt een duurzaam begrip van je smaak op — het mechanisme dat je aanspreekt, niet alleen het genre — en blijft zichzelf verrijken naarmate je het gebruikt, zonder ooit continu te draaien.
- De aanbevelingen herkennen de franchise-logica beter: de volgende onbekeken aflevering van een saga krijgt nu prioriteit, en er kunnen meerdere opties worden voorgesteld (de saga voortzetten / dezelfde energie elders / nog extremer) in plaats van slechts één opgelegde keuze.
- Nieuw, optioneel en standaard uitgeschakeld: webzoekopdracht (via Mistral alleen) om met mate een memorabel moment uit een reeds bekeken titel te oproepen — nooit spoilers over een lopende serie, in te schakelen in Instellingen.
- De assistent kan onthouden dat een titel is bekeken door het simpelweg in gesprek te laten vertellen, zonder via de fiche te hoeven gaan.
- Meerdere verfijningen van de aanbevelingsmotor (gewogen betrouwbaarheid op geleerde smaken, lichte vermoeidheid na een reeks van hetzelfde type content) en een duidelijke richtlijn: nooit vragen om te parafraseren, altijd proberen te begrijpen.

## v1.14.17 — Augustus 2026

### Movviz AI

- Twee volledige audits hebben 7 echte begripfouten gevonden en gecorrigeerd: de sfeerengine vergelijkte kenmerkenamen die niet langer altijd overeenkwamen tussen analyses, een serie werd uit de aanbevelingen gehaald na slechts één aflevering (in plaats van de hele serie), een overmaat aan interne tegensstrijdigheden in de conversatie-instructies, en een handvol andere, subtielere correcties rond het geheugen.
- Nieuw: "Wat Movviz AI over jou weet", een paneel op je profielpagina dat duidelijk laat zien (nooit ruwe code) wat de assistent heeft onthouden — feiten, activiteiten, geliefde of afgewezen aanbevelingen.

## v1.14.16 — Augustus 2026

### Movviz AI

- Bug verholpen: een aanbeveling die een woord tussen aanhalingstekens citeerde, kon worden weergegeven als ruwe JSON in plaats van kaarten — verholpen aan de bron, geen risico meer op lekken, wat er ook gebeurt.
- Gesprekken overleven nu een serverherstart — alleen de prullenbak leegmaakt ze.
- De poster en titel van een aanbeveling zijn klikbaar en openen de fiche.
- Het toevoegen van een aanbeveling triggert nu een echte reactie van de assistent op die titel.
- Nieuwe erkende aanbevelingsmodi: "donkerder", "minder gewelddadig", "stel me iets voor" zonder specifieke verwijzing, of opzettelijk onbekend.
- Aanbevelingen houden rekening met je eerdere 👍/👎 feedback op een fijnere manier (wat leuk was EN wat werd afgewezen, niet alleen één van de twee) en met de bijbehorende franchise van wat je bekijkt.
- Een behoefte die duidelijk in het moment wordt uitgesproken ("nu heb ik iets lichters nodig") komt nu voorrang op je algemene gewoonten in plaats van genegeerd te worden.
- De assistent begrijpt beter verzoeken die buiten het duidelijke genre vallen ("zoals deze film, maar zonder dit element") en stelt een gerichte vraag in plaats van willekeurig te raden wanneer je verzoek echt vaag is.

### Instellingen

- Nieuw tabblad "Ervaring" (video's over fiches, speciale afleveringen) gescheiden van het Dashboard.
- Nieuwe instelling: speciale afleveringen tellen niet meer mee in de status "serie volledig bekeken" (standaard uitgeschakeld), en een nog niet uitgebracht seizoen blokkeert deze status ook niet meer.

## v1.14.15 — Augustus 2026

### Movviz AI

- Een laatste subtiliteit in het geheugen verholpen: de assistent zegt niet meer "ik ga dit noteren" zonder het daadwerkelijk in dezelfde bericht te doen — hij gebruikt of wat hij al weet, of hij zegt duidelijk dat hij het nog niet weet.

## v1.14.14 — Augustus 2026

### Movviz AI

- Nieuwe prullenbakknop direct in het chatvenster voor een "al aanwezige" vermelding: als het eigenlijk de verkeerde vermelding is, kun je deze zelf met twee klikken verwijderen zonder het gesprek te verlaten (voor admins gereserveerd, net als overal in Movviz — de assistent verwijdert nooit iets zelf).
- Je voornaam blijft vast zodra deze bekend is — hij vraagt er niet meer om, en verandert deze alleen als je hem expliciet een andere geeft.
- De assistent kan nu zijn zinnen natuurlijker aanpassen aan je voornaam, met voorzichtigheid en zonder ooit te aandringen als de context iets anders suggereert.

## v1.14.13 — Augustus 2026

### Movviz AI

- Bug verholpen waarbij de assistent de verkeerde film kon toevoegen bij een valse vriend tussen talen (bv. "un homme un vrai" voegde een ongerelateerde Spaanse film toe) — hij controleert nu de echte gelijkenis van de titel voordat hij iets toevoegt, en geeft liever "niet gevonden" dan een verkeerde film te noemen.

## v1.14.12 — Augustus 2026

### Film/serie fiches

- Verwijderde jaardag naast de titel — het jaar wordt nog steeds één keer weergegeven, naast de duur.

## v1.14.11 — Augustus 2026

### Movviz AI

- Nieuwe suggestiebron: naast zijn eigen ideeën put Movviz AI nu ook uit TMDb-aanbevelingen voor de titel die je bekijkt — beide bronnen gaan door dezelfde uiteindelijke selectie (kwaliteit, stemming, geschiedenis, feedback).
- Aanbevelingen worden niet langer weergegeven als een blok stille kaarten: elke suggestie wordt nu geïntroduceerd met een kleine, andere zin ("Hé, ik denk dat je dit leuk vindt", "Anders is er dit..."), voor een echt gevoel van uitwisseling in plaats van een ruwe lijst.

## v1.14.10 — Augustus 2026

### Movviz AI

- De humor van de assistent past nu aan elk genre aan (niet alleen horror) en hergebruikt nooit dezelfde grap twee keer.
- Anecdotes blijven nu altijd kort — een natuurlijke zin, nooit een alinea.

## v1.14.9 — Augustus 2026

### Movviz AI

- Bugfix in de achtergrond: een voornaam die in een gesprek werd genoemd, bleef niet bestaan na een "gesprek wissen" — een rekenfout zorgde ervoor dat de detectie van het eerste gesprek in werkelijkheid nooit correct werd geactiveerd.
- Het voornaam van een gebruiker wordt nu ook direct op code-niveau opgevangen (meerdere formuleringen herkend), zonder uitsluitend afhankelijk te zijn van de goede wil van het taalmodel om dit te noteren.
- Bugfix voor een weergavelek waarbij interne technische tekst in platte tekst kon verschijnen in een antwoord, en voor een geval waarin de assistent het ontbreken van informatie noteerde alsof het een herinnering was.
- Movviz AI vraagt nu expliciet om de voornaam vanaf het eerste gesprek als je deze niet hebt gegeven, en herhaalt dit natuurlijk zolang hij deze niet weet.
- Het vermijdt nu het stellen van dezelfde openingsvraag bij elke bericht.

## v1.14.8 — Augustus 2026

### Movviz AI

- Paneel "Ik herinner me jou" verwijderd uit het chatvenster.
- Bugfix waarbij de assistent simpelweg ellipsen antwoordde in plaats van een echt antwoord — met name wanneer je reageerde op een reeds voorgestelde aanbeveling (een vraag, een grap) in plaats van er een nieuwe te vragen.
- De assistent beweert niet langer iets te hebben gememoriseerd wat hij in werkelijkheid nooit heeft ontvangen (bv. je voornaam voordat je deze gegeven hebt).

## v1.14.7 — Augustus 2026

### Movviz AI

- Voor een vage of algemene aanvraag ("iets van een chick", "een film voor het hele gezin"...), baseert Movviz AI nu expliciet op de werkelijke ervaring van de persoon die vraagt (zijn eigen meningen, zijn eigen verzoeken — nooit die van een ander huishoudaccount) in plaats van op een algemeen cliché; zonder bruikbaar gegeven stelt het een vraag in plaats van zomaar te raden.

## v1.14.6 — Augustus 2026

### Movviz AI

- Nieuwe modus "Verbaas me": vraag expliciet om verrast te worden of om je gewoontes te doorbreken, en de assistent geeft de voorkeur aan titels die compatibel zijn met je smaak, maar die bewust verschillen van de voor de hand liggende keuze — en vertelt je waarom.
- De assistent nuanceert nu zijn aanbevelingen: hij onderscheidt wat hij zeker weet van wat meer verkennend is, in plaats van elke suggestie als een zekerheid te presenteren.

## v1.14.5 — Augustus 2026

### Instellingen

- Knop "Opslaan" van Movviz AI gedupliceerd bovenaan het paneel: na het activeren van de AI of plakken van een API-sleutel, hoef je niet meer de hele lijst met providers te scrollen om op te slaan.

### Movviz AI

- Correctie: het chatberichtveld knipte de onderkant van de voorbeeldtekst (placeholder) af in plaats van deze volledig over twee regels weer te geven.

## v1.14.4 — Augustus 2026

### Movviz AI

- Nieuwe stemmingmotor: wanneer je een aanbeveling vraagt vanuit een fiche, analyseert Movviz de diepe toon van de referentietitel en van elke kandidaat (humor, energie, toon...) om suggesties te rangschikken op basis van de werkelijke sfeernabijheid, niet alleen het TMDb-genre.
- Eerste gesprek met de assistent: hij stelt zichzelf voor en stelt tot 3 kleine vragen (voornaam, wat je momenteel leuk vindt om te kijken...) om je te leren kennen — nooit meer, nooit een formulier.
- Geaffirmeerd persoonlijkheid: altijd blij om je weer te zien, een vleugje humor op de juiste plek (bv. een horrorfilm), en soms een anekdote over een titel — altijd voorzichtig geformuleerd, nooit gepresenteerd als absolute zekerheid.
- Permanente vangrail: de assistent kan en zal nooit iets in Movviz verwijderen, ongeacht hoe we het vragen.

## v1.14.3 — Augustus 2026

### Ontdekking

- Correctie van de achtergrond: de rij "Platforms" gebruikte een benadering op naam op de TMDb-catalogus, wat een obscure service kon koppelen in plaats van de juiste (bv. een onbeklage aanvulling in plaats van de verwachte echte service). Vervangen door een vaste en geverifieerde lijst van de 10 meest gebruikte platforms in Frankrijk, met hun echte logo's in betere kwaliteit.
- Verwijdering van de rij "Distributeurs", die dubbelop was met "Platforms" (dezelfde merken, maar minder goed: beperkt tot series).
- Op mobiel gaan de Platforms/Studios tegels over in ronde en compacte iconen in plaats van het grote rechthoekige formaat dat bedacht was voor desktop.

### Movviz AI

- De assistent onthoudt nu de feiten die je hem in het gesprek geeft (voornaam, expliciete voorkeur…) van sessie tot sessie, naast zijn reeds bestaande herinneringen (toegevoegde titels, geaccepteerde aanbevelingen).
- Nieuwe 👍/👎 feedback op elke aanbeveling — dient als basis voor een relevantere rangschikking van toekomstige suggesties.
- Het model stelt nu meer kandidaten in de achtergrond voor; Movviz filtert en rangschikt deze zelf (kwaliteit, nieuwigheid, eerdere feedback, al gevraagd) voordat het alleen de beste weergeeft — en sluit nu simpelweg elke titel die al volledig is bekeken uit.

## v1.14.2 — Augustus 2026

### Ontdekking

- De streamingplatformfilters (Prime Video, Netflix, Disney+, etc.) zijn nu echte platforms erkend door TMDb, geldig voor zowel films ALS series — geen extra API-sleutel vereist.
- Correctie: het selecteren van een platform ging verplicht terug naar "Series" zelfs als je op "Films" was, en terugschakelen naar "Films" verwijderde het platformfilter bij terugkeer naar het dashboard. Het filter blijft nu actief ongeacht het doorgewezen type.
- Nieuwe rij "Platforms" op de Ontdekking pagina.

### Movviz AI

- Correctie: de assistent verwarde het aantal door de gebruiker bekeken films met het totale aantal films in de bibliotheek, wat leidde tot onjuiste antwoorden over de omvang van de collectie.

### Betrouwbaarheid

- Correctie van een willekeurige crash van de dashboardcarrousel (Hero) en de sfeervideo-kaarten: twee geneste transitie-animaties konden in conflict komen bij het verwijderen van dezelfde elementen van de pagina tegelijk, wat af en toe tot een algemene applicatiefout leidde.

## v1.14.1 — Augustus 2026

### Movviz AI

- Correctie: de chatknop verscheen pas na een volledige paginalaad na het activeren van Movviz AI in Instellingen — hij verschijnt nu onmiddellijk.
- Nieuw logboek (Instellingen → Movviz AI, admin): geschiedenis van de laatste chatoproepen met gebruikte provider, succes/falen, latentie — om te begrijpen wat er gebeurd is zonder te gissen.
- Elke provider toont nu waar een gratis API-sleutel te krijgen is, direct in Instellingen.
- Uitgebreide detectie van quota-/ongeldige sleutel (403 naast 429) voor een betrouwbaardere overschakeling tussen sleutels van dezelfde provider.
- Nieuwe, volledig optionele stap om Movviz AI te activeren en een sleutel toe te voegen bij de eerste Movviz-configuratie.
- De achtergrond en het aangepaste logo van een kaart geven nu de voorkeur aan de interface-taal (Frans logo indien beschikbaar voor een Franstalige gebruiker, enz.) in plaats van alleen populariteit.
- Het logo wordt ook weergegeven in de Hero-carrousel van het dashboard, niet alleen op de kaart.

### Betrouwbaarheid en bevestigingen

- Verwijderen van een kaart (prullenbakknop) en definitief verwijderen uit de Prullenbak: er wordt nu altijd een bevestiging gevraagd, geen toevallig verwijderen met één klik meer.
- Versnelde Plex-synchronisatie na een download: Movviz start zijn eigen synchronisatie enkele seconden na een import in plaats van te wachten tot 5 minuten.
- Correctie voor full screen: de spelercontainer had inactieve CSS-lay-outklassen (niet opgeslagen variant), vervangen door een betrouwbare logica.
- Kaartbeeld-editor samengevoegd met "Kaart bewerken" (één potloodknop) — beeldpersonalisatie blijft open voor elke gebruiker, structurele instellingen blijven voorbehouden aan admins.
- YouTube-ondertitels zijn nu correct uitgeschakeld op sfeervideo's (kaarten en carrousel).

## v1.14.0 — Augustus 2026

### Movviz AI — slimme chatbox (nieuw)

- Nieuwe conversatie-assistent (zwevende bel, standaard uitgeschakeld): begrijpt verzoeken in natuurlijke taal, voegt films/series toe aan de bibliotheek, beveelt in dezelfde toon aan ("na Scary Movie, stel Naked Gun voor" in plaats van een willekeurige komedie), beantwoordt veelgestelde vragen.
- Multi-provider (Mistral, OpenRouter, Gemini) met meerdere sleutels per provider, automatische rotatie bij bereikt quota, en overschakelen naar de volgende provider indien nodig — configureerbaar vanuit Instellingen (admin).
- Gebruikersgeheugen: de assistent onthoudt toegevoegde titels en geaccepteerde aanbevelingen, en kent een cijfermatige samenvatting van de activiteit (bekeken films/series/afleveringen, verzoeken, meest bekeken series) — strikt geïsoleerd per account, nooit gemengd tussen gebruikers.
- Roept de taalmodel nooit aan zonder een expliciet verzoek van de gebruiker: geen achtergrondanalyse, geen impact op de normale werking van Movviz als de AI uitgeschakeld blijft.

### Verrijde "bekeken" tracking

- Film-/seriekaarten en afleveringen tonen nu een gedateerde geschiedenis ("bekeken gisteren", "vor 3 dagen"...), wat Plex combineert met directe afspelen vanuit Movviz.
- Nieuwe handmatige knop "markeren als bekeken / niet bekeken" op films, seizoenen en afleveringen — aanvulling op Plex voor alles wat elders is bekeken.

### Film-/seriekaarten

- Herstartknop opnieuw ontworpen: wanneer een afspelen bezig is, stelt de kaart direct "Herstart op HH:MM:SS" voor (met zichtbare voortgang) in plaats van een algemene "Afspelen"-knop — de keuze "herstarten of opnieuw beginnen" blijft altijd worden voorgesteld bij het openen van de speler.
- Nieuwe instelling (Instellingen → Ervaring) om de achtergrondtrailer op kaarten uit te schakelen en een statisch beeld te behouden.
- De achtergrond en het logo van een fiche kunnen nu worden aangepast: een nieuwe knop opent een selectie van alternatieve afbeeldingen uit TMDb (elke gebruiker kan aanpassen, net als bij tags).

### Wachtrij

- Nieuwe status 'In behandeling' en 'Controle' in de downloadtracking, om beter onderscheid te maken tussen een zoekopdracht die vastloopt en een import die in controle is.

### Betrouwbaarheid

- Correctie van een build-configuratiebug die op een ontwikkelmachine de compilatie-output onnodig groot kon maken — zonder impact op Docker-images/de Windows-installer.

## v1.13.92 — Augustus 2026

### Handmatige download: de lijst met verboden woorden is niet langer van toepassing

- **Oorzaak**: De controle 'verboden term' na de download (`checkPostImportBlockedWord`) werd toegepast op ALLE imports, inclusief die handmatig door de gebruiker gestart. Een handmatige download waarvan de naam een verboden woord bevatte (bv. VOSTFR) werd verwijderd en de bibliotheek werd 'missing' ingesteld in plaats van hernoemd/verplaatst.
- **Correctie**: Een handmatige grab (zoekpagina, filmfiche, 'Versie toevoegen'-paneel) markeert nu zijn infoHash als handmatig (`manualGrab.ts`, TTL geheugen 6 u) zodra de engine het accepteert. Bij de import wordt deze torrent uitgesloten van de controle op verboden woorden: het wordt hernoemd, verplaatst en normaal geïmporteerd. Alleen automatische grabs behouden de regel.
- Eerste automatische acquisitie, series, afleveringen: gedrag ongewijzigd.

## v1.13.91 — Augustus 2026

### 'Update op basis van kwaliteit' creëert geen duplicaten meer (2) (3) (4)

- **Oorzaak**: De beslissing 'bestaande video vervangen' werd alleen gemarkeerd door de 'Versie toevoegen'-stream (LOT6). Alle andere grab-paden voor een reeds beschikbare film — de vergrootglasknop op de fiche (kwaliteitszoekopdracht), automatische upgrade 6 u, upgrade-candidates, handmatige zoekopdracht — markeerden geen intentie: de engine hernoemde het nieuwe bestand met een botsingssuffix ' (2) '/'(3)' zodra de definitieve naam bezet was door het oude bestand, dat nooit werd verwijderd.
- **Correctie**: Elke nieuwe gehavende versie voor een reeds beschikbare film (`movie.file`) markeert nu een 'vervangen'-intentie op de infoHash vóór de grab (`autoGrab`, `searchAndReplace`, grab-route met handmatige zoekopdracht). Bij de import wordt het oude primaire bestand van de schijf verwijderd (veiligheidsmaatregelen: gevalideerde engine-root, diepte ≥ 2, opgeschoonde naam, niet-recursieve unlink) en vervolgens wordt het nieuwe bestand hernoemd naar zijn definitieve naam — geen duplicaten meer ' (n) ' in Plex.
- Eerste acquisitie, series en afleveringen: gedrag ongewijzigd.

## v1.13.90 — Augustus 2026

### 'Minimale jaartal van carrousels' eindelijk overal gerespecteerd

- **Oorzaak**: De instelling `minYear` (Instellingen → Dashboard-ervaring) werd alleen toegepast op de carrousels 'Ontdekking' en 'Aanbevolen voor jou' van het dashboard — de Hero-cinema, 'Recent toegevoegd', 'Binnenkort', de upgrades, en DE gehele Ontdekking-pagina (carrousels + 'Alles zien') negeerden het filter: een film uit 1931 kon verschijnen ondanks een limiet van 1985.
- **Correctie**: Het filter wordt nu overal uniform toegepast:
  - Hero-cinema: `buildHeroSlides` ontvangt `minYear` en sluit geen slide op die vóór die datum is uitgebracht.
  - Dashboard: alle carrousels (Ontdekking, Aanbevolen, Recent toegevoegd, Binnenkort, Upgrades) gaan door hetzelfde filter.
  - Ontdekking: TMDb-carrousels + C411-carrousels + 'Alles zien'-pagina's gefilterd; een expliciete zoekopdracht (of een handmatig jaartalfilter) blijft ongefilterd.

## v1.13.89 — Augustus 2026

### Geen 'removeChild'-crash meer (algemene weergavefout)

- **Oorzaak**: `NotFoundError: Failed to execute 'removeChild' on 'Node'` stuurde de hele app naar het algemene foutscherm. De trigger: het geopende gebruikersmenu (dropdown framer-motion/AnimatePresence) bij het klikken op 'Uitloggen' — de navigatie naar `/login` demonteerde de shell terwijl de sluitanimatie nog bezig was, en framer-motion/React vochten om hetzelfde DOM-knooppunt tijdens de commit-fase.
- **Correctif 1 (oorzaak)** : `UserMenu.logout` sluit de dropdown onmiddellijk en laat zijn exit animatie afgeronden (~300 ms) voordat de logout fetch en navigatie plaatsvinden — de shell wordt nooit meer gede-monteerd met een animatie in uitvoering.
- **Correctif 2 (fallback)** : nieuwe `AppErrorBoundary` (React error boundary) rond de gehele AppShell-boom — een commitfout (externe concurrente DOM-manipulatie: hls.js/dash.js/YouTube tijdens een unmount) kan de sessie niet langer in de globale-fout standaard doden: herstel scherm + schone heropbouw via « Probeer opnieuw ».
- Getest in Edge headless: inloggen → uitloggen met open dropdown → redirect naar `/login` zonder enige consolefout.

## v1.13.88 — Augustus 2026

### Uitloggen: de redirect naar /login werkt eindelijk

- **Oorzaak** : in `UserMenu.logout` werd `router.refresh()` onmiddellijk aangeroepen na `router.push("/login")`. Een refresh uitgegeven direct na navigatie naar een andere pagina annuleert de lopende navigatie (het synchroniseert de huidige pagina opnieuw) — de RSC-aanvraag voor `/login` werd verstuurd, reageerde 200, maar de URL veranderde nooit. Herproduceerd in Edge headless: cookie sessie correct verwijderd, terugknop werkt goed, maar de gebruiker bleef op het dashboard totdat handmatig ververst.
- **Correctie** : geen `router.refresh()` meer na de push in de 3 sessie-eind navigaties (`UserMenu.logout`, `PendingApprovalScreen.logout` en de factory reset van `AboutPanel` — hetzelfde patroon, hetzelfde risico). De inlogpagina valideert `/api/auth/me` al zelf bij het mounten, de refresh was nutteloos.
- **Bonus** : `destroySession()` vergelijkt de volledige cookie (`raw.sig`) met de opgeslagen sessies (`raw`) — de sessie werd nooit echt uit `sessions.json` verwijderd (hij verouderde tot de expiratie). Het extraheert nu de `raw` als `resolveSession()`.
- Foto's van acteurs in afgeronde vierkanten (consistent met posters, in plaats van cirkels).

## v1.13.87 — Augustus 2026

### "Zoeken en vervangen": codec-vervangingen (x264 → x265/AV1) eindelijk gesuggereerd

- **Oorzaak** : codec- en formaatupgrades waren alleen te zoeken in de RSS-cache (~50-150 meest recente releases) — alleen de taalupgrade triggert een directe zoekopdracht bij de indexers. Met een cache die het catalogus bijna nooit dekt (710 films in x264 terwijl x265/AV1 te prefereren zijn, geconstateerd op echte gegevens), toonde het paneel "Geen vervanging gesuggereerd" terwijl betere versies bestonden — en dat de knop "Vervangen" er een kon vinden.
- **Correctie** : film- en afleveringscans repliceren nu de fallback van grab — als de cache geen kandidaat bevat en de film/aflevering kan winnen op de codec-score (score lager dan de beste geconfigureerde codec), wordt een directe, beperkte zoekopdracht (25 per run, hetzelfde budget als de taal fallback) gestart op de rate-limited indexers. Afleveringen winnen ook codec-upgrades (voorheen alleen voor films), zonder `preferredVideoCodec` te vereisen.
- De knop "Vervangen" is ongewijzigd: hij voert zijn eigen directe zoekopdracht uit, zoals voorheen.

## v1.13.86 — Augustus 2026

### Klikprioriteit: nu gegarandeerd aan de clientkant

- **Oorzaak** : het markeren van activiteit bij het opnieuw renderen van het serverlayout dekte geen clientnavigaties — de App Router rendert layouts niet bij elke navigatie (ze komen uit de router cache). Een linkklik bleef dus onzichtbaar voor de achtergrond, die de overdracht niet liet tijdens het paginaladen.
- **Correctie** : een nieuw clientcomponent (UserActivityPing) luistert naar elke echte klik (pointerdown in capture fase, beperkt tot ~1/s, keepalive) en stuurt een POST ping naar `/api/activity/ping` die de activiteit markeert in het serverproces. De achtergrond geeft nu vrij zodra er geklikt wordt, ongeacht het navigatiepad — klikken, paginaladen en zoeken blijven prioriteit hebben tijdens scans, bulk en downloads.

### Herdownloaden: de oude versie wordt daadwerkelijk vervangen

- **Oorzaak** : de afspelen wordt opgelost via Plex (ratingKey → primaire versie van de film). Na een opnieuw downloaden bleef het oude bestand op de schijf → Plex bewaarde twee versies van dezelfde film en speelde nog steeds de OUDE af (live waargenomen: Alita in SBS, niet-SBS gedownload, nog steeds in SBS afgespeeld).
- **Correctie** : elke vervangende import (handmatige selectie, kwaliteitsupgrade) verwijdert het oude bestand van de schijf zodra er een primair bestand aanwezig was — tenzij expliciet gekozen is voor "Toevoegen als extra versie". Verwijdering behouden (nooit het geïmporteerde bestand zelf, nooit buiten de bibliotheekroot); Plex scant vervolgens opnieuw en ziet slechts één versie: de afspeler speelt de nieuwe af.

### Fabrieksreset — geen configmap meer, terug naar de wizard

- **Probleem** : het verwijderen van de configmap terwijl de server draait deed niets — de draaiende server genereert de bestanden opnieuw vanuit zijn geheugen (globalThis cache, geconsolideerde schrijfbewerkingen van 300 ms) en de sessiecookie blijft geldig; de app bleef normaal weergeven, zonder wizard.
- **Correctie 1 — automatische detectie** : als er geen accounts meer bestaan (configmap verwijderd), leidt AppShell automatisch door naar de wizard (`/setup`) in plaats van een kapotte app weer te geven.
- **Correctie 2 — knop "Volledige reset"** in Instellingen → Over (admin) : wist alle geheugencaches van de server, verwierf de configmap (verwijdering gevalideerd: absolute pad + diepte), wist de sessiecookie, en opende vervolgens de wizard bij het opnieuw laden.

## v1.13.85 — Augustus 2026

### Correctie : de limiet van 10 kaarten geldt alleen voor de ranglijst 'Trending'

- **Herinnering aan het probleem** : alleen de ranglijst "Movviz Trends" (die met de top 10 cijfers) toonde meer dan 10 kaarten — de andere ranglijsten werkten perfect met hun oorspronkelijke lengte.
- **Aangepaste correctie v1.13.84** : de limiet van 10 kaarten is beperkt tot de enkele samengevoegde trending-ranglijst (trends ∪ populair), aan de bron. Alle andere ranglijsten — aanbevolen voor jou, nieuwigheden, kids, enz. — nemen exact hun oorspronkelijke lengte aan; geen weergave-achteruitgang op ranglijsten die hier niet van betroffen.

## v1.13.84 — Augustus 2026

### Ranglijsten "Movviz Trends" : nog steeds maximaal 10 kaarten

- **Oorzaak** : de samengevoegde ranglijst "trends ∪ populair" was niet gelimiteerd — in tegenstelling tot de eenvoudige "Trends" ranglijst (maximaal 10) — en het Dashboard toonde de volledige lijst (tot ~40 kaarten) zodra de fusie 10 overschreed. Resultaat: overbelaste ranglijsten met kaarten zonder rang, zware laadtijd en problematische weergave (vooral waargenomen op Mac ARM).
- **Correctie** : alle ranglijsten van `/api/metadata/rows` zijn nu gelimiteerd tot 10 kaarten (dezelfde regel als "Trends"), en het Dashboard past ook de limiet toe als veiligheidsgordel. De knop "Alles bekijken" opent nog steeds de volledige gepagineerde versie.

## v1.13.83 — Augustus 2026

### Absolute prioriteit aan klikken en paginalading

- **Navigatie en laden markeren nu gebruikersactiviteit** : de root layout (server opnieuw gerenderd bij elke App Router navigatie) markeert de activiteit zodra een sessie aanwezig is — voorheen bleef een pure navigatie (zonder API-aanroep erachter) onzichtbaar voor het prioriteitssysteem, en de achtergrond gaf de controle niet op tijdens het laden van de pagina. Elke linkklik zorgt dus ervoor dat de achtergrond onmiddellijk de controle overdraagt (yieldToUser), die na 4 s herstelt na de laatste interactie.
- **De Plex sync geeft nu de controle op** : dit was de laatste grote verbruiker zonder overdracht — zijn loops (films, series, secties) voerden honderden opeenvolgende Plex/TMDb fetches uit zonder ooit te onderbreken terwijl u klikte. `yieldToUser("sync Plex films/series")` wordt nu aangeroepen voor elk item en elke sectie; een navigatie pauzeert dit tot 30 s, waarna het hervat.
- **Handmatige zoekopdrachten met limiet** : de live zoekopdracht (fallback indexers) lanceerde `Promise.all` op alle indexers zonder enige limiet — 3 tabbladen + een bulk = tientallen geopende sockets, en de hele server (inclusief klikken) vertraagde. Een globale semafoor beperkt tot **2 gelijktijdige directe zoekopdrachten** (de volgende wacht op een slot ≤ 15 s en gaat dan toch door): het paginaladen blijft vloeiend tijdens pieken.
- **Herinnering** : de rest van het mechanisme was al op zijn plaats — lanes (`runBackground`), rate-limit indexer met gegarandeerde reserve voor de gebruiker (5 slots/host + 10 global), jobwachtrij met watchdog van 10 min en verminderde concurrency tijdens downloads.

## v1.13.82 — Augustus 2026

### Diagnostische logbestanden ondertiteling (ffmpeg-modus)

- Het starten van de remux logt de toegevoegde WebVTT-uitvoer (`[remux] WebVTT uitvoer spoor=0:s:N`); de ondertitelingroute logt het gebruikte pad bij elk verzoek (`[subtitle] FAST PATH bestand=...` vs `[subtitle] geen live sessie — toegewijde extractie`). Maakt het mogelijk om direct in `docker logs` te bepalen of de instantane speler wordt gebruikt.

## v1.13.81 — Augustus 2026

### Ondertiteling ffmpeg-modus: bijna direct (0,5 s in plaats van ~1 min)

- **Nieuwe fast path** : het remuxproces (dat het bestand al leest om de video te produceren) schrijft **ook** het tekst-ondertitelingspoor in WebVTT naar een tijdelijk bestand, als secundaire uitvoer — in het tempo van de filmweergave, zonder enige extra schijf-/netwerklezing. De ondertitelingroute volgt dit bestand en streamt de cues naar de speler: **de eerste cue arriveert in ~0,4 s** (geverifieerd door lokale reproductie), in plaats van te wachten tot een aparte extractie het hele bestand opnieuw vanaf het begin leest (~1 min op NAS).
- **Automatische sessieovergang** : bij zoeken, kwaliteitswijziging of audiowijziging, start de remux opnieuw met een nieuw tijdelijk bestand — de ondertitelingstream schakelt hier automatisch op (identieke absolute tijden, geen hiaten in de cues), zonder onderbreking voor de speler. In pauze volgt de extractie de video (backpressure) en hervat deze zelfstandig.
- **Fallback behouden** : niet vooraf geëxtraheerd tekstspoor (andere taal dan het standaardspoor) → toegewijde ffmpeg-extractie zoals voorheen; beeldsporen (PGS/VobSub) → ongewijzigde Plex transcode fallback (HLS).
- **Beveiliging** : tijdelijke WebVTT-bestanden worden verwijderd bij het einde van de sessie (doelgerichte unlink, naam beperkt tot het systeemtijdfolder — nooit recursief verwijderen).

## v1.13.80 — Augustus 2026

### Ondertiteling ffmpeg-modus: 2e root bug — de parser begreep het ffmpeg-formaat niet

- **Verholpen** : de ondertitelingen bleven onzichtbaar zelfs na de fix voor dubbele annulering — oorzaak bevestigd door lokale reproductie van de extractie: de WebVTT muxer van ffmpeg schrijft de timinglijnen in `MM:SS.mmm` wanneer de uren 0 zijn (film van minder dan 1u → **geen** cue geparseerd; film langer → alleen cues na het eerste uur). De parser vereiste `HH:MM:SS.mmm`: de uren zijn nu optioneel in de regex, beide formaten worden geaccepteerd en de tijden blijven correct (0u36m12s → 2172s).
- **Geverifieerd door reproductie** : test MKV-bestand met 3 cues (1s, 5.5s, 1u02m) → oude regex: 1 van de 3 cues; nieuwe regex: 3 van de 3, exacte seconden.

## v1.13.79 — Augustus 2026

### Ondertiteling ffmpeg-modus: root bug verholpen (ze laadden nooit)

- **Verholpen** : in ffmpeg-modus werden de tekstondertitelingen (SRT/ASS/SSA/WebVTT) nooit weergegeven — de root oorzaak bevestigd in de live-test: bij het laden van een spoor annuleerde de schoonmaakfunctie de ondertiteling-fetch die net was gestart (dubbele `abort()` op dezelfde AbortController), en de foutafhandelaar beschouwde deze vrijwillige annulering als een normale gebeurtenis → stille terugkeer, geen fallback, geen bericht. De sporen worden nu geladen zonder te worden sabotageerd: lokale WebVTT-extractie (Plex-methode: ondertitelingen apart geserveerd en gerenderd door de client, nooit ingebed in de video), rendering via de native `<track>` tag, echte filmtijden (vertraging `seekBase` opnieuw berekend bij elke zoekactie).
- **Verbeterd**: de track wordt **onmiddellijk** geconstrueerd bij het laden van de track — de ondertiteling verschijnt naarmate de extractiepakketten binnenkomen in plaats van te wachten tot het hele bestand is afgespeeld (lang op NAS, ffmpeg leest de hele film om de track te extraheren).
- **Herinnering**: beeldtracks (PGS/VobSub, niet converteerbaar naar tekst) → automatisch overgeschakeld naar Plex transcode (HLS) zoals voorheen.

## v1.13.78 — Augustus 2026

### Volledig scherm: Movviz besturingselementen blijven de baas

- **Verpouwd**: de volledig scherm knop speelde de `<video>` alleen in native fullscreen → de browser dwong zijn eigen besturingselementen af, die de tijd van de **stream** (startend vanaf 0, relatief aan de seek) weergaven in plaats van de werkelijke filmpositie, en waarvan de native seek de serversessie niet opnieuw laadde — de melding "buffer tijd in plaats van film, kan niet vooruit" bij volledig scherm. Volledig scherm wordt nu toegepast op de **player container**: onze besturingselementen (voortgangsbalk met `seekBase + currentTime`, menu's, header, dubbelklik, gebaren) blijven zichtbaar en functioneel, met een cinematisch zwarte achtergrond. iPhone behouden op het native fullscreen van de `<video>` (de Fullscreen API bestaat niet op een iOS container — browserlimiet, onvermijdelijk).

## v1.13.77 — Augustus 2026

### Geoptimaliseerde videotranscode NAS + servercrash verholpen

- **Geoptimaliseerd — lokale videotranscode bedacht voor NAS**: de encoder gaat van `veryfast` naar **`ultrafast` + `zerolatency`** (frames geleverd zodra gecodeerd, geen lookahead) — op een NAS ARM/SoC komt de eerste buffer ~2× sneller aan en de hervattingen na rebuffer starten onmiddellijk. De **GOP is verkort naar 2 s** (`g 48`): een seek of kwaliteitsverandering resynchroniseert in minder dan 2 s in plaats van te wachten op een willekeur gekozen keyframe (vaak 10 s+ — dit veroorzaakte "de videotranscode hapert"). `main` profiel voor gegarandeerde hardware-decodering op alle clients. Matige bitrates ongewijzigd (10/6,5/4/2,2 Mb/s) — de kwaliteit blijft correct, het is de latentie die daalt.
- **Verholpen — servercrash "Invalid state: Controller is already closed"**: wanneer de client een videotranscode sessie verliet (seek, kwaliteitsverandering, speler sluiten), kon de race tussen de asynchrone propagatie van de HTTP cancel en de stopzetting van ffmpeg een stream vernietigen waarvan de Web controller al gesloten was → uitzondering die niet werd opgevangen en het serversproces liet crashen (503 gegeneraliseerd). Verlate streams worden nu gemarkeerd bij het abort van de aanvraag en worden nooit meer met fout gemarkeerd; de fout blijft propageren voor echte encoding-falen (HLS fallback intact).

## v1.13.76 — Augustus 2026

### Smartphone: speler niveau Netflix, optie "minimale jaar" voor carrousels

- **Nieuw — Instellingen → Dashboard → Hero → Minimale jaar van carrousels**: kies het jaar vanaf welk de films worden weergegeven in de carrousels "Ontdekking" en "Aanbevolen voor jou" — geen verouderde films uit 1955 meer. "Alle jaren" standaard, geen bibliotheekwijziging, alleen filtering bij weergave.
- **Nieuw — smartphone speler (375px/768px)**: dubbelklik links/rechts op de video = snel terug/vooruit ±10 s met haptische feedback en toast (zoals Netflix), een enkele tik toont de besturingselementen zonder ooit de afspeelstatus te onderbreken, de besturingbalk loopt niet meer over (transcode/direct afspeel knoppen ingeklapt op tablet+, volume gereserveerd voor desktop waar de cursor zichtbaar wordt bij hover).
- **Verholpen — iPhone**: volledig scherm knop functioneel (webkitEnterFullscreen), respect voor veiligheidszones (notch en home bar), vergrote aanraakoppervlakte van de slider (32px), geen parasitele elastische terugslag meer.
- **Verholpen — licht modus**: knoppen van de header, statusbadges en menu's van de speler zijn nu geforceerd in cinematisch donker (transparant zwart) — geen witte iconen op witte achtergrond meer; het automatische maskeren van besturingselementen sluit nu geen actief menu.
- **Mobiele prestaties**: ambiance vervaging verminderd op kleine GPU (max-sm:blur-2xl), Ken Burns behouden.

## v1.13.75 — Augustus 2026

### Speler: HLS wordt een handmatige optie, ffmpeg compressieprofielen, premium design

- **Nieuw — leesstrategie**: HLS-transcodering (Plex) wordt niet langer automatisch gekozen. In de modus « Auto » verloopt het afspelen via **direct afspelen of lokale FFmpeg remuxing**; als geen lokale engine het bestand kan lezen, wordt er een expliciete foutmelding weergegeven in plaats van stilzwijgend over te schakelen naar Plex-transcodering. HLS blijft **handmatig** beschikbaar in Instellingen → Plex → Afspeelengine (« HLS (Plex transcode) — handmatig ») voor situaties waarin het nog nuttig is (PGS/VobSub beeldonderteksten, exotische audiostroom, beperkt netwerk).
- **Nieuw — ffmpeg compressieprofielen**: Het menu Spelerkwaliteit biedt nu **Origineel / 4K / 2K / FHD / HD** met echte lokale transcodering (zeer snelle libx264, CRF 23, bescheiden bitrates ontworpen voor NAS: 10 / 6,5 / 4 / 2,2 Mb/s, downscale zonder de bron te overschrijden). « Origineel » behoudt de huidige bit-exacte kopie (nul CPU). Het wijzigen van de kwaliteit laadt de ffmpeg-sessie opnieuw op de huidige positie; bij directe/MSE-afspeling schakelt de speler over op lokale transcodering.
- **Nieuw — premium spelerontwerp**: Gradiënt scrim onderaan het scherm (geen vage balk meer), fijne voortgangsbalk die bij hover dikker wordt met een licht gradiëntvulling en een zoomende scrub-thumbnail, gigantische centrale afspeel/pauze knop, frosted-glass menu's met een vinkje op het actieve element, feedback toast bij skips van ±10 s, merk-aangedreven laadring, opnieuw ontworpen hervat- en foutscherm, header met overlappende gradiënt in fullscreen modus, cinematische thumbnail en Ken Burns ademhaling van de sfeer, cursor verborgen wanneer de besturingselementen verdwijnen.

## v1.13.74 — Augustus 2026

### Speler: correcte afspeelpositie in ffmpeg-modus, 100 % lokale ondertiteling zonder Plex

- **Verholpen**: In ffmpeg-modus keerde de voortgangsbalk terug naar het begin na een klik in het midden van de video (de inhoud zelf positioneerde zich wel correct). De remuxde stream is een gefragmenteerde MP4 zonder index: de browser begint opnieuw bij elke seek/herlading, zelfs als de server op de juiste positie zoekt. De speler toont en slaat nu `seekBase + currentTime` op (positie van de laatste seek + afgespeelde tijd), en de markering wordt ook behouden bij het wijzigen van de audiostroom of het stoppen van de speler.
- **Nieuw**: Ondertiteling werkt nu **zonder Plex** in ffmpeg-modus — Movviz extraheert zelf de ondertitelspoor uit het ruwe bestand via ffmpeg (conversie naar WebVTT) en speelt deze af via de native `<track>`-tag van de browser, met een opnieuw berekende offset bij elke seek. De video blijft een bit-exacte kopie, er is geen videotranscodering nodig. **Tekst**sporen (SRT, ASS, SSA, WebVTT, mov_text…) blijven op de ffmpeg-engine; **beeld**sporen (PGS/VobSub van Blu-ray remuxes, niet te converteren naar tekst) schakelen terug naar de HLS-modus zoals voorheen. Ondertiteling verwijderen verlaat niet langer de ffmpeg-modus.

## v1.13.73 — Augustus 2026

### Speler: ffmpeg-engine gerespecteerd, geluid detectie in minder dan een seconde, audiostroomselectie in ffmpeg-modus

- **Verbeterd**: Wanneer de engine **ffmpeg** wordt geselecteerd in Instellingen → Plex, startte de speler soms een directe afspeling in plaats van de lokale remux — de enginekeuze werd niet meegenomen in de strategieberekening. Nu = ffmpeg-engine = ffmpeg-remux voor elk bestand (de ⚡ knop start ook een remux in plaats van een directe afspeling), met HLS als laatste redmiddel als ffmpeg niet beschikbaar is.
- **Verbeterd**: De stilte-alert van directe afspeling detecteert nu een stille audiostroom in **minder dan een seconde** (venster van 800 ms) in plaats van 6 s, en escaleert vervolgens naar **lokale ffmpeg-remuxing** (geluid getranscodeerd naar AAC, video gekopieerd) voordat het terugvalt op Plex-transcodering. Het oordeel valt pas nadat de decodering daadwerkelijk is begonnen, om nooit een langzame start te verwarren met echte stilte (geen regressie voor compatibele video's).
- **Nieuw**: De audiostroom-/ondertitelmenu's zijn nu beschikbaar wanneer de ffmpeg-engine actief is — directe wijziging van de audiotaal (remux-sessie opnieuw geladen met de juiste stroom, positie behouden), en automatische overschakeling naar de HLS (Plex) modus wanneer een ondertitel wordt gevraagd (de lokale remux codeert geen ondertiteling).

## v1.13.72 — Augustus 2026

### Nieuw: Voorkege audio-taalinstelling voor de speler

- **Nieuw**: Instellingen → Plex biedt nu een voorkege audio-taal voor de standaard spoorselectie bij het afspelen (Frans, Engels, Spaans, Duits, Italiaans, Nederlands) — op "Automatisch" (standaard) volgt de taal van de interface zoals voorheen; een account dat Movviz in het Frans gebruikt maar de voorkeur geeft aan Engelse audio kan dit nu expliciet aangeven, zonder dat dit zijn interface verandert.

## v1.13.71 — Augustus 2026

### Het audio-spoor in de interface-taal werd gekozen... en vervolgens stilzwijgend overschreven door een ander spoor van dezelfde codec

- **Oorzaak direct bevestigd** (Jurassic Park 499959, twee AC-3 Fr/Eng sporen): het Franse spoor werd correct gekozen — zowel door de nieuwe taalregel als door de "selected" van Plex zelf — maar een oudere fallback-mechanisme (bedoeld om te ontsnappen aan een echt ondecodeerbare codec, bv. DTS → AC-3) controleerde nooit of het back-up spoor daadwerkelijk een andere codec had. Aangezien beide sporen van deze film AC-3 waren, "slaagde" deze fallback door over te schakelen naar het andere spoor (Engels) simpelweg omdat het niet uitgesloten was — zonder enige extra compatibiliteit te bieden, waardoor de juiste Franse keuze stilzwijgend werd overschreven.
- **Verholpen**: De fallback vereist nu een codec die daadwerkelijk verschilt van die van het reeds afgewezen spoor.

## v1.13.40 – v1.13.70 — Augustus 2026

### Video-afspelen: meerlaagse fallback-keten, lokale ffmpeg remux, geüpgraded speler

- **Nieuw**: Het afspelen van een bestand gaat nu via een meerlaagse fallback-keten, waarbij elk automatisch wordt geprobeerd op basis van wat de browser daadwerkelijk kan decoderen — directe afspeling → MSE (bit-exacte kopie, eigen MP4-parser) → **lokale ffmpeg remux** (nieuwe engine, neemt het over voor elke container/codec die de MSE-parser niet afhandelt, met name MKV) → DASH/HLS (Plex transcodering, laatste redmiddel). De ffmpeg remux haalt het ruwe bronbestand rechtstreeks van Plex en remuxet het zelf (video-kopie met nul CPU-kosten, audio gekopieerd of getranscodeerd naar AAC afhankelijk van de codec) — nul afhankelijkheid van de transcoderingbeslissing van Plex, die zich bleek een interne, ongedocumenteerde en niet van buitenaf beïnvloedbare heuristiek te zijn (weigerde de HEVC bitstream naar HLS te kopiëren ongeacht de parameter die aan de client werd gestuurd, ongeacht de geteste variant).
- **Verholpen**: Het DASH-protocol wordt nu gebruikt voor elke HEVC/AV1-bron of elke transcodering-sessie — dit is het enige protocol waarbij Plex de HEVC bitstream-kopie respecteert (HLS hercodeert deze bronnen systematisch, zelfs in "audio-alleen" modus, wat de echte oorzaak van de ervaren vertraging was). Het clientprofiel opgegeven aan Plex ("Plex Web") dekt nu HEVC/AV1 voor zowel HLS als DASH, en beide modi "Transcodeerd (audio)"/"Transcodeerd (video)" — nu omgedraaid — wijzen naar het juiste Plex-gedrag.
- **Verholpen**: Meerdere audio-decoderingsvalkuilen geïdentificeerd en opgelost in echte omstandigheden — AC-3 gekopieerd in een progressieve MP4 wordt niet native gedecodeerd door Chrome/Edge (andere context dan hls.js/MSE transmux, verholpen door de remux-kopie te beperken tot universeel decodeerbare codecs en de rest te transcoderen naar AAC), en Dolby Digital(+) kan niet worden waargenomen door de stilte-monitor (die zich baseert op de Web Audio Graph, buiten bereik voor deze codecs) — elk van deze gevallen wordt nu correct gedetecteerd of vermeden in plaats van een stille afspeling zonder zichtbare fout te produceren.
- **Verholpen**: De robuustheid van de pipeline is versterkt na tests in echte omstandigheden — racecondities in de MSE-engine en in ffmpeg-sessies (buffers, seek, nette afsluiting van de serverstream wanneer de client afhaakt, inclusief een geval dat de hele server kon laten crashen), betrouwbare duur en afspeelpositie voor de ffmpeg-stream (gefragmenteerde container zonder vooraf bekende duur aan de kant van de browser).
- **Nieuw**: de speler kiest nu standaard de audio-audio-spoor op basis van de taal van de Movviz-interface (dezelfde regel als het audio-badge), activeert ondertiteling alleen automatisch als er geen audio-spoor in die taal beschikbaar is, toont een voorbeeldthumbnail bij het over de voortgangsbalk (doorgegeven van Plex, die deze al genereert voor zijn eigen speler), en beheert nieuwe toetsencombinaties (volume, directe sprong per percentage) naast de bestaande toetsencombinaties (afspelen, ±10s, schermvullend, stil, sluiten).

## v1.13.65 — Augustus 2026

### De Held pinnde altijd dezelfde titels

- **Verholpen**: pools zonder natuurlijke volgorde (aanbevolen, ontdekking, nooit bekeken) worden nu gemengd met een deterministische zaadwaarde per dag en per gebruiker — rotatie elke 24 uur in plaats van dezelfde 2-3 gepinde titels onbepaald; de chronologische pools (recentlyAdded, upcoming, recentActivity) worden niet aangetast.

## v1.13.63 — Augustus 2026

### Een serie met één "komende" aflevering werd weergegeven als ontbrekend — de seriekaart negeerde de status "upcoming"

- **Oorzaak bevestigd**: `LibrarySeriesCard` berekende de volledigheid van een serie met `available === monitored.length`, door afleveringen die nog niet zijn uitgezonden ("upcoming") te tellen alsof ze al beschikbaar moesten zijn — een volledig gedownloade serie met slechts één nog niet uitgezonden aflevering viel dus terug op het amberkleurige "ontbrekend" badge, terwijl `SeasonAccordion`, `TitleContent` en de Bibliotheekpagina al correct "beschikbaar OF upcoming" als compleet behandelen.
- **Verholpen**: de seriekaart past nu dezelfde regel toe als overal anders in de app.

### "Zoeken en vervangen" stelde voor om een bestand te vervangen door een bijna identiek bestand wanneer de huidige taal onbekend was

- **Live oorzaak bevestigd**: wanneer de taal van het bezitende bestand onbekend is (niet gedetecteerd), werd elke release in de doeltaal (VF) voorgesteld als "verbetering", zonder ooit te controleren of deze daadwerkelijk iets verbeterde — dezelfde resolutie, dezelfde codec (x264≈H.264, x265≈HEVC anders weergegeven maar identiek) en een bijna identieke grootte veroorzaakten toch een vervangingsvoorstel. De bestaande beveiliging (`isMeaningfulUpgrade`, grootteverschil ≥ 10 %) werd expliciet omzeild voor dit specifieke geval; voor series bestond deze beveiliging simpelweg niet.
- **Verholpen**: voorstellen op basis van taal vereisen nu hetzelfde minimale grootteverschil (10 %) als andere soorten verbeteringen, zowel voor films als voor afleveringen — suggesties voor echte resolutie/codec worden niet beïnvloed.

## v1.13.39 — Augustus 2026

### Toegevoegd een opt-in schakelaar voor YouTube trailer zoeken — uitgeschakeld standaard verklaart waarom trailers in het Engels bleven

- **Toegevoegd**: de YouTube zoekfallback voor trailers (gebruikt wanneer TMDb er geen heeft in de taal van de kijker) is een paginascrape, geen officiële API — het is afhankelijk van het feit dat YouTube de IP van de server niet rate-limiteert, en een enkele stille fout wordt 24 uur gecached, dus het was altijd standaard uitgeschakeld. Dat standaard is de reden waarom trailers bleven verschijnen in het Engels, ondanks dat het mechanisme bestond en correct werkte bij directe test. Een nieuwe schakelaar in Instellingen → Dashboard ("Trailers") schakelt het in — standaard nog steeds uit, maar nu een expliciete, zichtbare keuze in plaats van een stille.

### Titels vastgelopen op "zoeken" gaven het "Downloaden" tegel een niet-nul aantal zonder dat er iets was om dit uit te leggen

- **Toegevoegd**: in plaats van alleen niet langer "zoeken" items als downloaden (laatste release) te tellen, krijgen ze nu hun eigen speciale "Bezig met zoeken" dashboard tegel — dus dat getal verdwijnt niet zomaar, het verhuist naar waar het eigenlijk hoort.

---

## v1.13.36 — Augustus 2026

### De "Downloaden" dashboard tegel kon een niet-nul aantal tonen zonder dat er daadwerkelijk iets werd gedownload

- **Fixed**: de tegel telde afgerepisode/films die nog "zoeken" (actief op zoek naar een uitgave, nog geen torrent gegreep) alsof ze gedownload werden. Bevestigd live: een hele seizoen vastgelopen in "zoeken" zonder actief torrent verhoogde het aantal naar 9 terwijl er feitelijk nul downloads draaiden. De tegel telt nu alleen items met een echt actieve download.

### Een afspeelknop van een titel kan volledig verdwijnen zonder uitleg

- **Fixed**: de kijkknop op een titelpagina was volledig afhankelijk van het feit dat Plex het bestand al had gelinkt — een bestand dat Movviz al klaar heeft, maar dat Plex nog niet in zijn eigen bibliotheek heeft gescand (een normale asynchrone timingkloof), toonde helemaal geen knop in plaats van iets dat de wachttijd uitlegde. Het toont nu een duidelijk uitgeschakelde placeholder met een tooltip in plaats van te verdwijnen.

### Twee ongerelateerde knoppen op de titelpagina deelden exact hetzelfde icoon

- **Fixed**: "versies beheren" en "saga/collectie bekijken" gebruikten beide hetzelfde stapelicoon, wat verwarrend was op een titel die beide heeft. De collectielink gebruikt nu een visueel onderscheidend icoon.

---

## v1.13.34 — Augustus 2026

### Dezelfde melding kon blijven afgaan voor content die al dagen beschikbaar was

- **Fixed**: meldingen werden nooit gededupliceerd — een gepland job dat content opnieuw scant die het niet volledig kon opruimen na import, kon de exactezelfde "nu beschikbaar" melding bij elke keer opnieuw uitzenden, bevestigd live met een seizoen-beschikbaar melding die elke ~30 minuten herhaalde voor een titel die daadwerkelijk een week beschikbaar was. Hetzelfde type melding met dezelfde details gaat nu slechts één keer binnen een uurvenster af; een echte herhaling later (bijv. dagen later) komt nog steeds normaal binnen.

### De "Klassiek" dashboardmodus is herzien om overeen te komen met "Bioscoop" minus de held

- **Changed**: De Klassieke modus hergebruikt nu alles wat de Bioscoopmodus biedt — de compacte stat-pillen en de volledige rijindeling (Trends, Aangepaste suggesties, Recent toegevoegd, etc.) — alleen zonder de grote hero banner bovenaan, op basis van feedback. Voorheen viel het terug op een kale stat-tegelraster en een platte "recent toegevoegd" lijst zonder de rijen van Bioscoop.

---

## v1.13.33 — Augustus 2026

### Toegevoegd een handmatige seed-toggle voor voltooide downloads

- **Added**: een voltooide download in de wachtrij heeft nu een speciale knop om deze te beginnen of te stoppen met seeden, onafhankelijk van de pauze/resume bedieningselementen die worden gebruikt voor actieve downloads. Het uitschakelen stopt daadwerkelijk de uploadactiviteit in plaats van alleen een status te verbergen — voor de standaard downloadengine ontkoppelt dit de torrent volledig van peers; het opnieuw inschakelen herstelt dit, en herbouwt de oorspronkelijke bestandsindeling indien nodig als de bestanden al in de bibliotheek zijn verplaatst, zonder ooit de bibliotheekkopie aan te raken of opnieuw te downloaden.

### Posterrijtitels stonden niet gecentreerd onder hun kaarten

- **Changed**: De titel onder elke posterkaart in de dashboardrijen (Trends, Suggesties, Recent toegevoegd) staat nu gecentreerd onder de poster, op basis van feedback — voorheen kon deze scheef staan, vooral in de gerangschikte Top-10 rij.

---

## v1.13.32 — Augustus 2026

### Downloads toonden nooit een resterende tijd

- **Fixed**: Het "resterende tijd" (ETA) veld van de wachtrij werd alleen berekend door twee van de drie download-engine backends — de standaard (de engine die daadwerkelijk dagelijks wordt gebruikt) gaf nooit een `timeRemaining` waarde door, waardoor het veld in de wachtrijweergave altijd leeg was. Het wordt nu berekend op dezelfde manier als de andere backends al doen (resterende bytes gedeeld door huidige snelheid), zodat een actieve download een echte schatting toont.

---

## v1.13.31 — Augustus 2026

### Een werkend bestandspad kon stilzwijgend worden overschreven door Plex's eigen weergave van het bestandssysteem

- **Fixed**: bij elke Plex-sync kon een reeds correct, werkend bestandspad voor een film of aflevering worden overschreven door welk dan ook pad dat Plex zelf voor dat bestand rapporteert. Wanneer Plex en Movviz in aparte containers draaien met verschillende volume mounts voor hetzelfde fysieke medium, bestaat het door Plex gerapporteerde pad niet vanuit Movviz's eigen bestandsysteemweergave — waardoor een perfect goed, werkend pad stilzwijgend verandert in een gebroken pad, en "Réparer les chemins" overspoelt met valse positieven voor titels die nooit echt gebroken waren. Movviz leert nu de overeenkomst tussen Plex's padindeling en die van zichzelf automatisch — door het vergelijken van, voor een titel die het al correct bijhoudt, zijn eigen geverifieerde werkende pad met wat Plex rapporteert voor exact dezelfde titel — en vertaalt toekomstige Plex-rapporten via deze geleerde mapping in plaats van ze blindelings te vertrouwen. Geen instellingen scherm, geen handmatige configuratie: het redeneert de mapping zelf uit data die het al met zekerheid weet. Een pad wordt alleen geschreven als het eerst onafhankelijk wordt geverifieerd op de schijf — een verkeerde of verouderde mapping kan in het ergste geval een valse "ontbrekend" vlag produceren (herstelbaar met de hand), nooit een stilzwijngemiste verwijzing naar een echt bestand.

---
## v1.13.30 — Augustus 2026

### "Réparer les chemins" kan honderden compleet ongerelateerde bestanden als kandidaten voorstellen

- **Fixed**: wanneer een gebroken afleverbestand niet kon worden gevonden op basis van de exacte geregistreerde bestandsnaam, mat de laatste-redmiddel fallback het af tegen elk videobestand in de hele bibliotheek dat dezelfde seizoen-/afleveringsnummers deelde — ongeacht tot welke show het daadwerkelijk behoorde. Bevestigd live: een enkele gebroken aflevering kon terugkomen met 500+ "kandidaten" die eigenlijk gewoon de aflevering 1, aflevering 2, etc. van elke andere show waren. Deze fallback biedt nu alleen bestanden die plausibel tot de daadwerkelijke serie behoren (op basis van bestandsnaam of mapnaam), zodat de suggestielijst weer kort en relevant is. Aanwezig sinds v1.12.86 — iets dat niet is veranderd in deze recente reeks fixes, en geen ander overeenkomend pad (exacte bestandsnaam, verwachte-pad, of de duplicate-conflict waarschuwing) is aangeraakt.

### De Top-10 cijfers van de trending rij overlapt te veel met de poster

- **Changed**: het rangcijfer achter elke Top-10 kaart in de "Tendances" rij zat te ver onder de poster, waardoor slechts een sliertje links zichtbaar was. Het overlapt nu veel minder — het grootste deel van het nummer is zichtbaar links van de kaart, met alleen de achterrand erachter weggestopt, op basis van feedback.
- **Changed**: De "Tendances" rij wordt nu eerst getoond op het dashboard, boven "Ajouts récents", op basis van feedback.

### De collectie "download missing" kan de verkeerde titel pakken in plaats van de daadwerkelijk ontbrekende

- **Fixed**: twee cumulatieve bugs, beide bevestigd live over verschillende collecties. Ten eerste berekende de knop welke titels ontbraken uit een gedeelde, app-brede gecachede bibliotheek-/collectie-snapshot die verouderd kon zijn zonder dat er iets zichtbaar fout was op het scherm — zowel de bibliotheek als de onderdeellijst van de collectie worden nu opnieuw opgehaald vlak voor het downloaden. Ten tweede, en het meest consequentiële: een duplicate-detectie beveiliging die bedoeld was om te vangen wanneer TMDb dezelfde uitgebrachte film onder twee id's vermeldde, gebruikte fuzzy titelmatching zonder echte jaareis — het kon stilzwijgend een ongerelateerde, reeds bezitters vermelding hergebruiken voor een onbevestigde franchise placeholder, of een echte film verwarren met een featurette van dezelfde franchise een jaar later met een extra titel-suffix. Die beveiliging vereist nu een exacte genormaliseerde titel EN een exacte, bevestigde uitgavejaar aan beide zijden voordat een match ooit wordt vertrouwd.

### Vriendenaccounts kregen allemaal het Plex kijkgeschiedenis van de servereigenaar

- **Fixed**: elk gekoppeld vriendenaccount droeg een werkelijk distinct Plex-identiteit en token, maar ze synchroniseerden allemaal exact dezelfde kijkcijfers als het account dat de server bezit. De oorzaak is bevestigd tegen Plex's eigen gedocumenteerde gedrag: de endpoints die worden gebruikt om de kijkstatus te synchroniseren, rapporteren `viewCount` alleen vanuit het perspectief van de servereigenaar, ongeacht welk geldig accounttoken het verzoek doet — geen verzoekheader kan dat veranderen. De kijkstatus-sync gebruikt nu Plex's session-history endpoint in plaats daarvan, opgevraagd met het admin-token en gefilterd naar het eigen Plex-id van elk account — de manier waarop Plex daadwerkelijk per account kijkt — werkt nu hetzelfde voor vriendenaccounts en Home-beheerde profielen, in plaats van twee aparte paden.

## v1.13.22 — Augustus 2026

### "Voor jou" aanbevelingen zijn weer strikt per account, en een Plex kijk-sync mislukking ziet niet langer uit als "niets bekeken"

- **Veranderd**: v1.13.21's huishoudelijke blending is teruggedraaid — na meer feedback is "Voor jou" terug naar het alleen worden opgebouwd uit het eigen kijkgeschiedenis van een account, zonder signaal van enig ander account, zelfs niet een klein. Een account met slechts een paar bekeken titels krijgt nu een gepersonaliseerde rij van alleen die, in plaats van een minimum te vereisen voordat er iets wordt getoond.
- **Verholpen**: de Plex kijkstatus-sync slikte elke fout (netwerkhapering, verlopen token, onbereikbaar gedeelte) stil en slaagde altijd een lege resultaat op — ononderscheidbaar van "dit account heeft echt niets bekeken," en in staat om echte kijkgeschiedenis stil te wissen bij een tijdelijke storing. Het laat nu bestaande gegevens onaangeroerd wanneer een sync geen bibliotheekgedeelte kan bereiken, en elke syncpoging — succesvol of mislukt, en voor welk account — wordt gelogd onder Instellingen → Logs, zodat een stil falend account eindelijk zichtbaar is in plaats van alleen maar leeg te lijken.

### "Voor jou" aanbevelingen kunnen nu de hele huishoudelijke Plex geschiedenis gebruiken, niet alleen de jouwe

- **Nieuw**: wanneer de eigen Plex kijkgeschiedenis van een account dun of leeg is, mengt de "Voor jou" rij nu ook wat andere accounts op dezelfde instantie hebben bekeken (met een lager gewicht dan de eigen geschiedenis) — zodat iemand zonder eigen Plex-link nog steeds een echt, gepersonaliseerd rij kan krijgen in plaats van de platte algemene "hoogst beoordeeld" fallback. Dit treedt alleen op nadat minstens twee andere accounts zelf echte kijkgegevens hebben — de smaak van één ander account wordt nooit gebruikt als een vervangend "huishoudelijk" signaal, om te voorkomen dat iemands keuzes stil worden gekloond naar iemand anders. De eigen rij van elk account blijft precies zo persoonlijk als voorheen; dit voegt alleen een bredere signaal toe, vervangt nooit de eigen geschiedenis van het account wanneer deze al aanwezig is.

### Aflevertitels en beschrijvingen kwamen altijd terug in het Frans, ongeacht de interface-taal

- **Verholpen**: de seizoen-/aflevergegevensoproep (thumbnails, titels, beschrijvingen — toegevoegd in v1.13.12 en uitgebreid naar eigen series in v1.13.19) vertelde TMDb nooit welke taal het moest antwoorden, dus het standaardiseerde stil naar het Frans voor elke gebruiker, zelfs met Engels (of een andere) geselecteerd als interface-taal. Dit was exact hetzelfde bug die al eens was verholpen voor titeldetailpagina's — maar nooit toegepast op deze specifieke oproep. Het volgt nu de geselecteerde taal van de app, net als overal anders.

### Afleverthumbnails en beschrijvingen worden nu overal getoond, niet alleen voor series die je nog niet bezit

- **Verholpen**: v1.13.12 voegde een thumbnail en korte beschrijving toe aan elke afleverrij, maar alleen voor series die nog niet in je bibliotheek stonden — afleveringen van series die je al bezit, werden weergegeven als platte tekstrijen zonder enige preview. Beide weergaven halen nu uit dezelfde live TMDb-gegevens, zodat een gedownload/beschikbare aflevering exact dezelfde preview toont als er een die je nog niet hebt opgepikt — zonder de bestaande kwaliteitsbadges, bekeken markering, statuspil of zoekknoppen verwijderd.
- **Verholpen**: de uitzenddata van afleveringen in diezelfde lijst werden gerenderd in het lokale formaat van je browser, ongeacht de geselecteerde taal van Movviz (bijv. het Amerikaanse maand/dag-formaat tonen zelfs met Frans geselecteerd) — volgt nu consistent de taal van de app, net als elke andere datum in Movviz.

### Het opnieuw proberen van een gedeeltelijk geïmporteerd seizoenpakket kan proberen zijn overgebleven .nfo om te benoemen naar een afleverbestand

- **Verholpen**: zodra elk echt videobestand in een seizoenpakket al was gematcht en verplaatst tijdens een eerdere gedeeltelijke run, zou een herproberen nul videobestanden vinden en terugvallen op het behandelen van elk resterend bestand — inclusief de release's `.nfo` — als "de aflevering om te importeren," en proberen deze te hernoemen naar iets als `S03E02.nfo` en faalde volledig zodra dit niet overeenkwam met wat daadwerkelijk op de schijf stond. Overgebleven `.nfo`/`.txt`/image/checksum bestanden zijn nooit afleverinhoud en worden automatisch opgeruimd nadat de import is voltooid — ze worden nu volledig uit die matching uitgesloten in plaats van een mislukte, zichtbare importfout te veroorzaken.

## v1.13.17 — Augustus 2026

### De vertraginglogs waar je over werd verteld, worden nu daadwerkelijk weergegeven in Instellingen → Logs

- **Fixed**: het zoekdiagnostieklog kon zijn 2000-regels buffer in enkele minuten overstromen tijdens zware achtergrondpasses (elke aflevering zoekopdracht schrijft ~10 regels, waarvan enkele debug), waardoor belangrijke info-regels — inclusief de nieuwe achtergrondvertraging-regels — stilzwijgend werden weggeduwd. De buffer bevat nu 4000 regels, zodat `priority.yield` vermeldingen de ruis overleven.
- **New**: het logpaneel in Instellingen → Logs volgt nu live mee — het ververst elke 5 seconden terwijl het tabblad zichtbaar is, zodat regels geschreven door achtergrondwerk verschijnen zoals ze gebeuren in plaats van alleen na een handmatige verversing. Geen hertekening als niets is veranderd.
- **Fixed**: alle logbronnen staan nu op één plek — het transcode-logpaneel is verplaatst van het Diagnostiek-tabblad naar Instellingen → Logs, waar nu zoek-/diagnostiek-, engine-, resolver- en transcode-logs samen worden weergegeven.
- **Changed**: achtergrondvertraging-logregels krijgen nu hun eigen kleur in het paneel, zodat vermeldingen als "Arrière-plan bridé [bulk manquants]…" op het oog opvallen.

## v1.13.16 — Augustus 2026

### Achtergrondvertragingen zijn nu zichtbaar in de logs — met de verantwoordelijke gebruiker

- **New**: achtergrondwerk (de handmatige "zoek alle ontbrekende" bulk, geplande RSS-matching, kwaliteitsupgrades, pogingen voor ontbrekende releases) pauzeert nu wanneer u actief de app gebruikt en hervat enkele seconden nadat u stopt — u merkt het nooit. Elke keer dat zo'n vertraging daadwerkelijk optreedt, registreert het diagnostische zoeklog dit in één schone, leesbare regel: welke achtergrondtaak werd beperkt, welke gebruiker actief was (naam + id), en hoe lang het wachten duurde (bijv. "Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Fixed**: stilzwijgende frontend-polling telt niet langer als gebruikersactiviteit. De statuspolls (engine torrents elke 500ms, jobs elke 2s, perf metrics elke 5s, Plex activiteit elke 5s, afspe voortgang elke 10s…) hielden de app voor altijd gemarkeerd als "actief" zodra één pagina open was — waardoor achtergrondwerk nooit echt hervatte. Alleen echte interacties tellen nu (navigatie, zoekopdrachten, klikken): laat de app open en achtergrondwerk hervat enkele seconden na uw laatste klik.
- **Changed**: de handmatige bulkzoekopdracht draait nu in de achtergrondbaan zoals de geplande taken — het erft de verminderde indexeringsquota (uw eigen zoekopdrachten behouden prioriteit) en geeft tussen items door.

## v1.13.15 — Augustus 2026

### Bovenste navigatie bleef solide na scrollen naar boven

- **Fixed**: de transparant-naar-solide bovenste navigatiebalk toegevoegd in v1.13.12 werd correct solide zodra u naar beneden scrollde, maar scrollen terug naar de allerboven keerde het nooit meer terug naar transparant. Overgeschakeld op een betrouwbaarder detectiemethode, zodat het nu correct de scrollpositie in beide richtingen weerspiegelt.

## v1.13.14 — Augustus 2026

### Dashboardrijen kunnen nu een volledige raster openen — "Bekijk alles" was nooit echt ingebouwd

- **Fixed**: de carrousels van het dashboard ("Voor u", "Recent toegevoegd", "Binnenkort", "Trending") hadden een "Bekijk alles" functionaliteit ingebouwd in het rijcomponent zelf, maar geen enkele dashboardrij gaf deze ooit een bestemming — dus verscheen het stilzwijgend nooit, op welke rij dan ook, sinds dit deel van het dashboard werd gebouwd. Rijen blijven precies even compacte horizontale stroken; "Bekijk alles" opent nu de volledige set als een echte, filterbare raster (Ontdek voor aanbevelings-/trendingrijen, uw Bibliotheek — vooraf gefilterd om te matchen — voor rijen afkomstig van wat u al bezit).

## v1.13.13 — Augustus 2026

### Beta-speler is nu een persoonlijke keuze per account, standaard uitgeschakeld

- **Changed**: voorheen had de Beta-speler een enkele aan/uit-schakelaar voor de hele instantie — één admin die het aanzette, schakelde stilzwijgend het afspeelgedrag voor elk account in. Er zijn nu twee lagen: een admin-toggle in Instellingen die de functie alleen beschikbaar maakt, en een persoonlijke toggle op elk gebruikersprofielpagina die het daadwerkelijk voor hun account inschakelt — standaard uitgeschakeld, ongeacht wat de admin heeft ingesteld.

## v1.13.12 — Augustus 2026

### Zes browseverbeteringen, gekozen uit een designreview

- **New**: rijen tonen nu een dun scrollpositie-indicator en hover-ongevelpijlen, en scrollen met een volledige pagina in plaats van vrij te slepen.
- **Nieuw**: De rij "Trends" benadrukt nu de top 10 met een genummerde rangschikking, met behoud van dezelfde echte populariteitsvolgorde waarin de rij al gesorteerd was.
- **Nieuw**: Door over een filmposterkaart te bewegen (desktop) worden nu bij de beschikbaarheid van jaartal, looptijd en genre tags kort weergegeven, in plaats van niets.
- **Veranderd**: De bovenste navigatiebalk is nu transparant bovenaan de pagina en wordt solide zodra u scrollt.
- **Veranderd**: De afleveringenlijst voor een titel die nog niet in uw bibliotheek staat, toont nu een miniatuur en een korte beschrijving per aflevering, en niet alleen een lege rij. (Afleveringen voor titels die al in uw bibliotheek staan, hebben dit nog niet — daar zijn nieuwe gegevens nodig die bij de import worden verzameld en apart worden bijgehouden.)
- **Nieuw**: Op mobiel gebruikt de dashboard-hero nu een specifieke portretkunst in plaats van een ingekorte versie van de desktopbanner.

## v1.13.11 — Augustus 2026

### Weergavepersonalisatie volgt nu uw account, niet alleen uw browser

- **Veranderd**: GPU-prestatieprofiel, animaties, thema (licht/donker/auto), interface-taal en bibliotheekweergavedichtheid werden voorheen alleen op de browser opgeslagen — het wisselen van apparaten of browsers resette elk van deze instellingen naar de standaardwaarde. Ze worden nu opgeslagen in uw account en volgen u waar u inlogt, terwijl ze nog steeds onmiddellijk worden toegepast op het apparaat waarop u zich bevindt.
- **Verplaatst**: De schakelaar "Animaties" bevindt zich nu in Instellingen → Prestatie GPU, naast het profiel dat het daadwerkelijk beïnvloedt, in plaats van onder Dashboard.

## v1.13.10 — Augustus 2026

### Mobiele ondernavigatieknoppen die alleen werkten bij tikken boven het icoon

- **Verholpen, bevestigd live**: Op mobiel deed het direct tikken op de Kalender/Verzoeken/Meer tabknoppen vaak niets — maar tikken net erboven werkte wel. Oorzaak: de toast-meldingcontainer wordt overal gemount en blijft te allen tijde op de pagina staan, zelfs bij nul meldingen. Zijn mobiele laag beslaat de volledige breedte van het scherm, zit recht boven de onderstaande tabbar, en is onzichtbaar — maar een onzicht element blokkeert nog steeds klikken eronder, tenzij expliciet anders vermeld. Tikken die in dat overlappende gebied landen, raken stilzwijgend niets in plaats van de tabknop te bereiken.
- De onzichtbare container blokkeert niets meer eronder; alleen een daadwerkelijke zichtbare melding (wat zeldzaam en kort is) is nog steeds aanklikbaar/sluitbaar, precies zoals voorheen.

## v1.13.09 — Augustus 2026

### De Blood+ matchfix uit v1.13.06 trad nooit echt in werking — de echte reden gevonden

- **Verholpen, bevestigd live**: v1.13.06 veranderde de titel-matchfunctie zodat "+" werd behandeld als het woord "plus" (zodat "Blood+" niet werd verward met ongerelateerde shows). Maar handmatige zoekopdrachten toonden nog steeds "Blood Of Zeus", "Dexter New Blood", "Blood-C" en andere als geldige kandidaten voor "Blood+" — omdat een compleet ander, eerdere proces (dat een zoekbalkquery omzet in de daadwerkelijke tekst die naar indexers wordt gestuurd) het "+" verwijderde voordat de gefixde matchfunctie het ooit kon zien, waardoor die fix bij elke echte zoekopdracht stilzwijgend werd ongedaan gemaakt. Een zoekopdracht naar "Blood+" kwam bij de matcher als het kale woord "Blood", wat natuurlijk bijna alles matcht met "Blood" in de titel.
- Dat eerdere proces behoudt nu ook "+" en "&" als woorden, net zoals de matchfunctie al deed — waardoor de werkelijke hiaten worden gedicht, en niet alleen het ene proces dat leek op de bron van het probleem.

## v1.13.08 — Augustus 2026

### Accordéon seizoenen — afleveringen zichtbaar zelfs zonder bibliotheek

- **Verbeterd — afleveringenlijst beschikbaar voor niet-gevolgde series**: De seizoensaccordéon toonde "Nog niet in bibliotheek" als de serie niet in de bibliotheek stond. De afleveringen (nummer, titel, uitzenddatum) worden nu op aanvraag geladen vanuit TMDb (lazy, gecached door SWR) zodra een seizoen wordt geopend — zonder enige impact op series die al in de bibliotheek staan, waarvan de weergave identiek blijft. Een laad-skelet wordt getoond tijdens de aanvraag.

---

## v1.13.07 — Augustus 2026

### Correctie changelog v1.13.05

- Verwijdering van een onjuiste vermelding: Het rode vierkant zichtbaar in de ARM-screenshot was een annotatie getekend door de gebruiker om het problematische gebied aan te geven, en geen echte visuele UI-bug.

---

## v1.13.06 — Augustus 2026

### Correctie matching — titels met `+` (Blood+, C+C Music Factory…)

- **Verpouwerd — valse positief matching op titels met `+`**: het `+` werd verwijderd door normalisatie (alleen `a-z0-9` worden bewaard), waardoor bijvoorbeeld `Blood+` werd gereduceerd tot `blood`. Aangezien dit woord alleen aanwezig is in `Blood of Zeus` → `blood of zeus`, kreeg de serie een score van 0.85 (boven de drempel van 0.72) bij een handmatige zoekopdracht voor Blood+. Het `+` wordt nu omgezet naar ` plus ` vóór de opschoning in `normalizeTitle`, waardoor `Blood+` → `blood plus` en `Blood of Zeus` → `blood of zeus` worden — twee verschillende strings die niet langer samenvallen. Releases genaamd `Blood Plus` matchen correct met `Blood+`. Fix toegepast in `matching.ts` en `releaseMatchWorker.mjs`. Regressietest toegevoegd.

---

## v1.13.05 — Augustus 2026

### Correctie accordeon seizoenen — browser compatibiliteit ARM

- **Verpouwerd — accordeon vastgelopen op ARM Docker (tweede ronde)**: De CSS-overgang `gridTemplateRows` wordt niet ondersteund in alle ARM-browsers. Vervangen door `max-height: 0 → 9999px` met `overflow: hidden`, een universele techniek ondersteund sinds IE9 — werkt zonder ResizeObserver, zonder JS-animatie, zonder Framer Motion.

---

## v1.13.04 — Augustus 2026

### Correctie accordeon seizoenen ARM Docker (diepgaand onderzoek)

- **Verpouwerd — accordeon seizoenen vastgelopen op ARM Docker**: Framer Motion interpreteert en animeert `gridTemplateRows` via JS, wat kan falen op ARM-runtimes. De animatie wordt nu volledig beheerd door de browser's CSS-engine: inline overgang op `gridTemplateRows` + `opacity`, zonder externe JS-afhankelijkheid. De inner div ontvangt `min-h-0` om te garanderen dat de CSS Grid rij daadwerkelijk naar 0 instort. De inhoud blijft altijd in de DOM (verborgen door de grid), wat ook het geval elimineert waarbij `libSeason` undefined de expansie stilzwijgend leeg maakte — wanneer een serie niet in de bibliotheek staat, wordt een gelokaliseerde melding getoond in plaats daarvan.

## v1.13.03 — Augustus 2026

### Correctie accordeon seizoenen ARM/QEMU

- **Verpouwerd — accordeon seizoenen vastgelopen op ARM Docker**: De openingsanimatie van de seizoenen was afhankelijk van `height: "auto"` via Framer Motion, wat de hoogte meet via `ResizeObserver`. Op ARM Docker (Mac Apple Silicon / QEMU) retourneert `ResizeObserver` 0 bij de eerste rendering, waardoor de animatie onzichtbaar en de afleveringslijst onbereikbaar wordt. De animatie gaat nu over op `gridTemplateRows: "0fr" → "1fr"`, een pure CSS-interpolatie zonder DOM-meting — werkt identiek op x64 en ARM.

---

## v1.13.02 — Augustus 2026

### Informatie 2FA C411

- **Toegevoegd — 2FA waarschuwing in C411 formulier**: Accounts op c411.org met tweefactorauthenticatie (2FA) ingeschakeld kunnen de ontdekkingslijsten niet gebruiken (elke nieuwe sessie zou een code vereisen). Een informatieve nota wordt nu onder de gebruikersnaam/wachtwoord velden weergegeven om deze beperking aan te geven. 5 talen.

---

## v1.13.01 — Augustus 2026

### Correcties animaties en TVDB

- **Verpouwerd — filmmodus uitgeschakeld door toggle animaties**: Het uitschakelen van animaties in Instellingen → Dashboard stopte ook de videoweergave van de filmmodus (hero cinematiek + titelkop). Beide instellingen zijn nu onafhankelijk: het uitschakelen van animaties verwijdert de overgangen/decoratieve effecten zonder ooit de weergave van de sfeervolle video te blokkeren, die alleen wordt bestuurd door zijn eigen autoplay toggle.
- **Verpouwerd — TVDB status badge ontbreekt in Animatie tabblad**: Na de verplaatsing van de TVDB sleutel naar het Metadata tabblad in v1.13.00, was de badge « TVDB geconfigureerd / niet geconfigureerd » verdwenen uit het Animatie tabblad — de toggle leek inactief zonder visuele feedback over de status van de sleutel. De badge is hersteld in het Animatie tabblad (alleen-lezen), met een verwijzing naar het Metadata tabblad om de sleutel in te voeren of te wijzigen.

---

## v1.13.00 — Augustus 2026

### Geschiedenis herontwerp, matching jaren, TVDB in Metadata, event loop, bottom nav mobiel

- **Herontwerp — Overzichtspagina** : tijdlijn gegroepeerd per datum (Vandaag / Gisteren / Deze week / Deze maand / Ouder), kaarten met gekleurde rand afhankelijk van de status, mislukte vermeldingen in rood met direct weergegeven foutmelding (zonder klikken), uitgestelde animaties bij het laden, geïllustreerde lege staat, evenementen teller, automatische verversing elke 10 seconden. Volledig vertaald naar 5 talen (statuslabels, datogroepen, systeem, score, details).
- **Verpouwd — matching: jaartal tolerantie uitgebreid naar ±2** : fysieke releases (Blu-ray/DVD) uitgebracht tot twee jaar na de oorspronkelijke bioscoopuitgave werden afgewezen door het jaartalfilter (bv. Tafiti, Duitse film 2024 met Franse Blu-ray release 2026). De tolerantie gaat van ±1 naar ±2 in `releaseMatchWorker.mjs` en `matching.ts`, wat ook de reeds aanwezige containment bonus activeert voor titels die zijn ingekort door de release.
- **Verplaatst — TVDB API sleutel van het Animatie-tabblad naar het Metadata-tabblad** : logische groepering met TMDb en OMDb. Het Animatie-tabblad behoudt de twee schakelaars (gebruik TVDB / speciale afleveringen) en het synchronisatiepaneel. De navigatiehints van beide tabbladen zijn bijgewerkt. 5 lokale talen.
- **Vereenvoudigd — event loop tekst in Prestaties** : vervangen door een duidelijke zin in één regel (hoofdthread latentie, groen = OK, rood = overbelast). 5 lokale talen.

---

## v1.12.98 — Augustus 2026

### Correctie mobiel — hitbox onder navigatiebalk

- **Verpouwd — niet-klikbare knoppen onder de mobiele navigatiebalk** : Op iPhone met home indicator (safe-area ≈ 34 px) werd de `paddingBottom` safe-area toegepast op de `nav`-container in plaats van op elke knop. Met `items-stretch` vullen de kinderen alleen het inhoudsgebied van de nav (exclusief padding) — het safe-area gebied onderaan werd visueel bedekt door de achtergrond van de balk, maar behoorde niet tot een klikbaar element. De padding wordt nu door elke knop gedragen met `max(0.5rem, env(safe-area-inset-bottom))`, wat de hitbox uitbreidt tot onderaan het scherm terwijl het icoon en de label gecentreerd blijven in het zichtbare gedeelte.

---

## v1.12.97 — Augustus 2026

### Correctie C411 ID-botsing TMDb + verbetering matching release

- **Verpouwd — TMDb ID-ruimte botsing in C411 lijsten** : TMDb gebruikt twee afzonderlijke ID-ruimtes (films en series) die overlappen — hetzelfde nummer kan zowel een film als een andere serie aanduiden. Tot nu toe werd het eerste gevonden resultaat (kant film) zonder verificatie behouden, wat een fiche van een film kon weergeven in plaats van een serie. De oplossing gaat nu via een **titel + jaartal hint** verstrekt door C411: wanneer een ID aan beide kanten bestaat, stelt de titel en het jaar opgeslagen in de lijst in staat om de juiste ruimte te kiezen. De cache is geversioneerd (v2); oudere vermeldingen zonder versie worden genegeerd en opnieuw berekend om te voorkomen dat een onjuist oordeel na 30 dagen TTL overleeft.
- **Verbeterd — matching release met ingekort ondertitel** : Release's bevatten vaak de officiële ondertitel niet (bv. « Tafiti » in plaats van « Tafiti - Ab durch die Wüste »), wat hen een straf van 0,50 onder de matchingdrempel oplegde. Een containment bonus brengt de score naar 0,85 wanneer de titel van de release volledig in de officiële titel is opgenomen **én** het jaar compatibel is — verschillende homonieme films uitgebracht in een ander jaar blijven afgewezen.

---

## v1.12.96 — Augustus 2026

### Ontdekken — label sectie aanbevelingen verfijnd

- **Verfijnd — sectie aanbevelingen** : Het label van de eerste regel van de Ontdekken-pagina verandert van « Voor jou & beste » naar **« Selectie voor jou »** — leesbaarder, schoner, zonder onhandige voegwoorden. Vertalen naar 5 talen.

---

## v1.12.95 — Augustus 2026

### Windows-ontinstaller gerepareerd, Docker-container gerepareerd, wizard voltooid, C411 login verduidelijkt

- **Verpoupt — Docker-container in herstartluslus** : bij het opstarten met PUID/PGID die afwijken van de standaardwaarden van de image (het standaard geval van een NAS), verwijderde `docker-entrypoint.sh` de groep `movviz` **voordat** de gebruiker — busybox weigert een groep te verwijderen die de primaire groep is van een bestaande gebruiker (« group in use »), waardoor de daaropvolgende `addgroup` ook faalt en de container in een lus sterft met herhaalde « addgroup: group 'movviz' in use ». De volgorde is gecorrigeerd (gebruiker vóór groep, in elke stap) en het script geeft nu correct de gevraagde UID en GID vrij, zelfs als de doelgroep wordt geblokkeerd door de eigenaar. De gepubliceerde amd64+arm64 image is opnieuw gegenereerd met deze correctie.
- **Verpoupt — Windows-ontinstaller defect** : de installatie eindigde met een uitvoeringsfout « Cannot call CreateInputOptionPage » bij het starten van de desinstallatie (deze functie bestaat niet in de runtime van de Inno Setup-ontinstaller, alleen in die van de installator — deze werd geïntroduceerd met de vraag « persoonlijke gegevens verwijderen? » in v1.12.91). De vraag wordt nu gesteld via een native bevestigingsdialoog aan het einde van de desinstallatie, **standaard NIET**: niets wordt ooit verwijderd zonder expliciete bevestiging, altijd in 5 talen, en de gegevens (ProgramData) blijven standaard bewaard om een volledige herinstallatie mogelijk te maken.
- **Nieuw — wizard** : de laatste stap toont een kaart « Accountactivatie » die uitlegt dat het beheerdersaccount al actief is en dat de volgende accounts (registratie of Plex) moeten worden goedgekeurd in Instellingen → Gebruikers.
- **Verduidelijkt — C411 indexers** : De omschrijving « Site-identificaties » specificeert nu tussen haakjes dat de login optioneel is (het dient alleen voor de Ontdekken-lijsten, de zoekfunctie werkt zonder).

---

## v1.12.94 — Augustus 2026

### Ontdekken opnieuw opgezet — lijsten samengevoegd, series en films strikt gescheiden

- **Verpoupt — mix van series/films** : De lijsten van c411.org (Populaire / Recente uploads / Uit vandaag) toonden een mengeling van films en series in beide tabbladen. Ze worden nu gefilterd op basis van het actieve tabblad (Films of Series), bij het weergeven zoals in « Alles zien ».
- **Nieuw — samengevoegde lijsten** : De secties van de Ontdekken-pagina zijn gegroepeerd met dubbele verwijdering (een titel verschijnt niet meer twee keer):
  - « Voor u & beste » (suggesties + hoogst beoordeeld)
  - « Trends & populair » (Movviz-lay-out)
  - « In de bioscoop » (affiche + box office) en « Binnenkort & VOD » (Allociné-lay-out, films)
  - « Nieuw & vernieuwd » (Allociné-lay-out, series)
  - Van 11 naar 7 secties in Movviz-lay-out, van 14 naar 9 in Allociné-lay-out (films) en van 11 naar 7 (series). Elke samengevoegde sectie heeft zijn gepagineerde « Alles zien » (cache 10 min).
- **Verwijderd — Genre tegels** : De rij met genretegels (dubbele van het genrefilter in de balk) is verwijderd.
- **Nieuw — multi-arch Docker builds** : De gepubliceerde images op Docker Hub worden opnieuw gebouwd voor `linux/amd64` **en** `linux/arm64` (QEMU + buildx geactiveerd).

---

## v1.12.93 — Augustus 2026

### Indexers — echte status, key in geheugen en verbindingsdiagnose

- **Nieuw — C411 diagnose** : De sectie « Site-identificaties » van het C411 potlood toont nu de echte serverstatus (actieve of inactieve lijsten, met de betreffende login) en een knop « C411 verbinding testen » die een echte login uitvoert met de opgeslagen identificaties. In geval van onvolledige configuratie geeft een gedetailleerde diagnose precies aan wat ontbreekt (lijsten / identificatie / wachtwoord). Het stille falen « ik heb mijn identificaties ingevoerd maar er wordt niets getoond » wordt dus zichtbaar en identificeerbaar.
- **Nieuw — key in geheugen** : De knop « Categorieën weergeven » van een reeds geconfigureerde indexer vraagt niet langer om de API-key opnieuw in te voeren — deze wordt automatisch opgehaald van de server (de browser ziet deze nooit), en een vermelding « Key opgeslagen — automatisch gebruikt » geeft dit aan. Werkt ook voor de identificatiemodus.
- **Nieuw — knop « Verbinding testen »** op elke indexer: controleert de URL en de referenties in één seconde en toont het resultaat (OK of de fout van de indexer).
- **Verpouwd — stille back-up** : het formulier accepteert niet langer het stil falen — als de registratie aan de serverzijde mislukt, wordt de fout weergegeven en blijft het formulier open.
- **Verpouwd** : de catalogus sleutel (bv. `c411`) wordt nu ook opgeslagen bij een wijziging, niet alleen bij het toevoegen.

---

## v1.12.92 — Augustus 2026

### Crayon C411: bewerkbare site-referenties

- **Verpouwd** : bij de crayon werd de sectie « Site-referenties (Ontdeklijsten) » (login, wachtwoord, lijsttoggle) nooit weergegeven op een reeds geconfigureerde C411-indexer — de identiteit « C411 » ging verloren bij de registratie: alleen `kind: "torznab"` en de URL werden behouden, en het formulier herkende de indexer alleen op basis van zijn `kind`.
- **Nieuw** : de catalogus sleutel (bv. `c411`) wordt nu bij het toevoegen opgeslagen op de indexer, en bestaande indexers worden herkend op basis van hun catalogus URL (repli). De sectie referenties wordt dus ook weergegeven bij bewerken, en de toggle « Ontdeklijsten » gaat niet meer verloren bij het toevoegen (het wordt nu opgeslagen vanaf de initiële POST).

---

## v1.12.91 — Augustus 2026

### Integratie c411.org op de Ontdekpagina

- **Nieuw** : drie lijsten van de site c411.org worden weergegeven in het tabblad Ontdek — « Populair op C411 », « Recente uploads op C411 » en « Uitgaven van de dag op C411 » (alleen categorie films/video's). De accountreferenties worden opgeslagen in Instellingen → Indexers → C411 (sectie « Site-referenties »), en elke lijst kan onafhankelijk worden ingeschakeld of uitgeschakeld.
- Sessie automatisch beheerd (verbinding met CSRF, TTL 25 min, fallback op een tweede poging), gespreide verzoeken om blokkering te voorkomen, en TMDb-resolutie van releases met 30 dagen cache: een titel wordt alleen voorgesteld vanaf een minimumscore (exacte titel of jaar + type), nul valse positieven.
- **Verpouwd — parsing van release-namen** : underscores werden punten vóór de tag-analyse, « AD » wordt alleen herkend in hoofdletters (films zoals « Ad Astra » worden niet meer gemutiliseerd), de kanalen « 5.1 » en de releasegroepen worden genegeerd, « 10.bits » wordt 10BIT.

### Bewerkingscrayon op alle indexers

- **Nieuw** : elke geconfigureerde indexer (Torznab, C411…) heeft een crayon om zijn instellingen te bewerken zonder deze opnieuw aan te maken — het formulier toont de bestaande geheimen verborgen en overschrijft ze niet als het veld leeg wordt gelaten.

### Windows-ontinstaller — keuze voor verwijdering van persoonlijke gegevens

- **Nieuw** : de desinstallatie vraagt expliciet, via een selectievakje, of alle persoonlijke gegevens (bibliotheken, geschiedenis, downloads, instellingen — opgeslagen in ProgramData) moeten worden gewist. Standaard uitgeschakeld: een herinstallatie behoudt alles, zoals voorheen. Als het aangevinkt is, beschermt een aanvullende bevestiging tegen elke onbedoelde verwijdering. Scherm in 5 talen.

### Bioscoopmodus — optie « op hover » verwijderd

- **Opruiming** : het activeren van de « op hover » trailer van de Hero cinematograaf werkte niet betrouwbaar; de optie is verwijderd uit de instellingen (er blijft alleen « Uitgeschakeld » en « Automatisch » over) en de hover-logica van de hero is verwijderd.

---

## v1.12.90 — Augustus 2026

### Series met één seizoen opgesplitst in « delen » (DVD-volgorde) — automatisch samengesteld

- **Verpouwd** : releases van een serie met SLECHTS één seizoen, opgesplitst in de DVD-volgorde in meerdere delen (bv. Disjointed: 1 seizoen van 20 afleveringen, uitgebracht als « S01.PART.01 » + « S02.S01.PART.02 », of simpelweg « S01 » + « S02 ») werden nooit gematcht — het aangegeven seizoen nummer (S02) komt niet overeen met een seizoen in de bibliotheek, waardoor de afleveringen 11-20 onvindbaar bleven op de indexers.
- **Nieuw** : detectie van de marker « PART.N » in de release naam (`S01.PART.02`, `Deel 2`…) en terugval voor series met één seizoen: een release S02 (of deel 2) dekt de afleveringen van de tweede helft van het seizoen (11-20 voor 20 afleveringen). De selectie van de enginebestanden en de import worden in dezelfde nummering vertaald, zodat de bestanden `S02E01…E10` correct op S1E11-20 terechtkomen.
- **Beperkingen** : alleen series met één seizoen; elke meerseizoen serie behoudt zijn exacte matching (een echte seizoen 2 wordt nooit geïnterpreteerd als een deel). Films zijn niet van toepassing.

---

## v1.12.89 — Augustus 2026

### Afleveringen TBA behandeld als « komend » — series met een aangekondigd maar niet gedateerd seizoen zijn compleet

- **Verpouwd** : een aflevering zonder releasedatum maar met de placeholder titel « TBA » (TVDB/TMDb hebben deze afleveringen vooraf aangemaakt voor aangekondigde seizoenen, bv. Gachiakuta S2) werd behandeld als uitgebracht → `missing` → eindeloos gezocht op de indexers. Regel nu in twee afzonderlijke voorwaarden: toekomstige datum → « komend »; geen datum **en** titel TBA → ook « komend ». Een aflevering zonder datum met de echte titel behoudt het historische gedrag (zoekbaar).
- **Verpouwd — berekening status serie/seizoen** : een serie waarvan alles wat overblijft « komend » is (TBA of toekomstige datums) is nu **compleet** (« beschikbaar ») overal — bibliotheekpagina, detail, ontdekking, verzoeken, kalender — en verdwijnt vanzelf uit de zoekopdrachten naar ontbrekende items (search all, retries 6u, RSS). Een volledig « komend » serie blijft weergegeven als « komend ».
- Overal toegepast: creatie van series (TMDb + TVDB anime), backfill seizoen 0, reparatie van TMDb seizoenen, Plex sync (creatie + update), dagelijkse taak voor datumtransitie.

---

## v1.12.88 — Augustus 2026

### Verbeterde Plex diagnostiek + externe GUID's expliciet gevraagd aan Plex

- **Toegevoegd** — `GET /api/plex/diagnostic?title=...` toont nu de ruwe GUID en het `Guid[]` array zoals gerapporteerd door de lijst EN door het detail (`/library/metadata/{ratingKey}`), plus de tmdbId opgelost door de sync-logica — maakt het mogelijk uit te leggen waarom een media-item niet is gekoppeld.
- **Verbeterd — Plex sync** : de lijstaanvragen bevatten nu `includeExternalMedia=1`, het Plex-parameter die het `Guid[]` array (tvdb://, imdb://, tmdb://) direct in de `/all` antwoorden vult.

---

## v1.12.87 — Augustus 2026

### Plex koppeling uitgebreid naar legacy GUID's + Plex diagnostiek

- **Verpouwd — Plex sync** : GUID's in legacy formaat (`com.plexapp.agents.thetvdb://80741?lang=fr`, agents vóór 2021) werden niet gelezen — alleen het moderne `Guid[]` array werd gelezen. Deze series konden nooit worden gekoppeld, zelfs niet met de `/find` resolutie van v1.12.86. Het legacy `guid` veld wordt nu ook geparseerd (`thetvdb`/`imdb`/`tmdb`).
- **Toegevoegd — diagnostiek route** `GET /api/plex/diagnostic?title=...` (admin): toont voor elk overeenkomend Plex-item het type, de ratingKey, de ruwe GUID, het `Guid[]` array en de tmdbId opgelost door dezelfde logica als de sync — maakt het mogelijk uit te leggen waarom een media-item niet is gekoppeld.

---

## v1.12.86 — Augustus 2026

### Plex koppeling gecorrigeerd voor media zonder TMDb GUID + verbeterd koppelingstool

- **Verpouwd — Plex sync** : de resolutie van identificatoren las alleen de `tmdb://` GUID's die door Plex werden gerapporteerd. Media die alleen door de Plex-agent gematcht werden op `tvdb://`/`imdb://` (Canadese series, oude agents, etc.) werden **stilzwijgend genegeerd** — bestanden aanwezig op de schijf en zichtbaar in Plex, nooit gekoppeld in Movviz, en het koppelingstool vond niets om te repareren (geen pad werd opgeslagen). **Verpouwd**: de `imdb://`/`tvdb://` GUID's worden nu via `/find` naar TMDb opgelost (gecacht als andere TMDb-aanroepen), en in geval van TMDb-dubbele vermeldingen voor dezelfde titel, heeft de reeds aanwezige vermelding in de Movviz-bibliotheek voorrang. Bevestigd in productie op « Le cœur a ses raisons »: de GUID `tvdb://80741` lost op naar tmdb 2903 (2005), aanwezig in de bibliotheek.
- **Verbeterd — bestandskoppeling** (`repair-paths`) : wanneer de opgeslagen bestandsnaam nergens meer op de schijf bestaat, stelt het hulpmiddel nu ook bestanden voor waarvan de naam hetzelfde `SxxEyy` bevat (kandidaten voor handmatige bevestiging — nooit automatische koppeling op deze criteria).
- **Docs** : architectuurplan « Movviz Federation » gearchiveerd in `docs/federation-plan.md`.

---

## v1.12.85 — Augustus 2026

### Bug bij hernaammotor verholpen + isolatie van zoekopdracht naar ontbrekende items (quota + annulering)

- **Verholpen — motor** (`AbstractBackend.mjs`) : bug bij hernaamd van pakketten — het gedeelde informatieobject (`releaseInfo`) werd gemuteerd door de resolutie van het doelfbestand, en voor elk bestand zonder aflevernummer in de naam werd ditzelfde object hergebruikt voor de volgende: het EERSTE gevonden bestand dicteerde dan zijn aflevering aan alle andere. Bevestigd in productie op een volledige Trigun-pakket: 25 bestanden hernaamd naar `S01E03` (dan `S01E04` bij de 3e import), E1 altijd overschreven. **Verholpen**: het object wordt nu per bestand gekloond (`{ ...info }`) — gereproduceerd lokaal met de 28 echte bestandsnamen van het pakket, elk bestand krijgt zijn eigen aflevering (E01-E26, uniek). De opnieuw ingezette motor zal nooit meer een volledig pakket naar dezelfde aflevering hernaamen.
- **Indexeringsquota (anti-429)** : quota per indexeerder hervat (`c411.org` = 15 req/min gedocumenteerd, 20 req/min standaard voor elke host) + nieuw wereldwijd plafond van 40 req/min (bewegend venster van 60 s). Toegepast VOOR het verzenden van elke aanvraag (`fetchXml`), worden de gedocumenteerde quota dus nooit overschreden. De gegroepeerde zoekopdracht « zoek naar ontbrekende items » kan niet langer zelf 429'en veroorzaken (gemeten in productie: ~35 aanvragen in ~35 s veroorzaakten al een 429).
- **Jobannulering** : nieuwe route `POST /api/jobs/[id]/cancel` (admin) + `requestCancelJob()`/`isJobCancelled()` in de wachtrij + nieuwe status `"cancelled"` (netjes afgerond via `JobCancelledError`, vlag verwijderd aan het einde). Coöperatieve controlepunten op alle niveaus van de gegroepeerde zoekopdracht: tussen items in de batch, tussen seizoenen, tussen afleveringen — afleveringen die nog niet gezocht zijn blijven simpelweg « ontbrekend » en zullen bij de volgende ronde opnieuw worden geprobeerd. Een job in de wachtrij wordt onmiddellijk verwijderd; een lopende job stopt bij zijn volgende controlepunt (enkele seconden).
- **UI** : Het wachtrijpaneel toont geannuleerde jobs (spec icon + labels `jobs.statusCancelled` in 5 talen).

---

## v1.12.84 — Augustus 2026

### Betrouwbare import van seizoen-/volledige pakketten — nooit meer lege "S01E" of overgeschreven bestanden

- **Context (bevestigd in productie)** : een Noblesse seizoenspakket (20,3 Go) gedownload tot 100 % importeerde slechts 2 afleveringen van de 13. De grab had geen `episodeTargets` — de motor importeerde dan ALLE bestanden blind, en elk bestand waarvan het aflevernummer niet te identificeren was, werd hernoemd met een LEGE aflevering (`Noblesse - S01E.mkv`). Meerdere bestanden uit hetzelfde pakket kwamen dan op dezelfde bestemming en **overschreven elkaar** (het laatste verving de vorige), de nooit geïmporteerde afleveringen bleven "ontbrekend".
- **Verholpen — motor** (`AbstractBackend.mjs`) : wanneer het aflevernummer onbekend blijft na alle fallback-mechanismen (bestandsnaam, release, map), behoudt het bestand nu zijn oorspronkelijke naam in plaats van de lege template `S{season:00}E{episode:00}` — unieke naam per bestand, geen botsingen of overschrijvingen meer, en het bestand blijft altijd vindbaar voor het hernaamdhulpmiddel. `avoidCollision()` wordt nu ook toegepast op series (net als op films).
- **Verholpen — handmatige grab** (`/api/indexers/grab`) : een grab vanaf een serie-/seizoenpagina stuurt nu `episodeTargets` naar de motor (gecontroleerde afleveringen "ontbrekend"/"zoeken"), precies zoals een automatische grab — de motor downloadt/importeert dan alleen de doelafleveringen.
- **Precisie** : de import aan de bibliotheekzijde is niet veranderd — een bestand zonder aflevernummer wordt nooit ten onrechte toegewezen aan een aflevering ("ontbrekend" totdat de link is opgelost).

---

## v1.12.83 — Augustus 2026

### Toegestane woorden — een term aanwezig in de titel annuleert het verboden woord

- **Nieuw** : In Instellingen → Kwaliteit is een sectie "Toegestane woorden" toegevoegd aan "Verboden woorden". Als een toegestaan woord in de titel van een release voorkomt, wordt het corresponderende verboden woord geannuleerd. Typisch opgelost geval: een debiele heeft een aflevering geüpload gemarkeerd als "VOSTFR" terwijl het in werkelijkheid een multi is — `Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p...` met "VOSTFR" verboden + "FRENCH" toegestaan wordt nu geaccepteerd, terwijl een simpele VOSTFR nog steeds wordt afgewezen.
- **Applicatie** : De logica zit in `matchesBlockedWord()` (`releaseRules.ts`), dus alle ingangen respecteren dit — automatische zoekopdracht (torznab), beslissingswaakhond, bestandsimport, downloadophaal.
- **Match** : In hoofdlettergevoelige sub-string, zoals verboden woorden (opmerking: "TRUEFRENCH" bevat "FRENCH").
- Tests : 6 nieuwe gevallen in `scripts/allowed-words.test.ts` (23/23 groen).

---

## v1.12.82 — Augustus 2026

### Release 1.12.82 — encoding geverifieerd, CI-pipeline opnieuw uitgevoerd op een gezonde commit

- **Context** : De eerste push van v1.12.81 werd uitgevoerd met een `package.json` gecorrumpeerd door een BOM UTF-8 (`U+FEFF`) geïntroduceerd door een PowerShell-schrijving — de CI-build (`next build` via `build.ps1`) faalde met `package.json is not parseable: invalid JSON: expected value at line 1 column 1`.
- **Verholpen** : De encoding van alle betrokken bestanden (`package.json`, `README.md`, `CHANGELOG.md`, `autoGrabSeries.ts`, `torznab.ts`, `autoGrab.ts`, `mediaMap.ts`, `rssCache.ts`) is byte voor byte geverifieerd — geen BOM, schoon UTF-8. De gecorrigeerde commit van v1.12.81 bevatte al de exacte code zonder BOM; v1.12.82 start vanaf een gezonde basis en voert de volledige pipeline opnieuw uit (Windows-installer + Docker-image) op de juiste commit.
- **Herinnering** : Bronbestanden mogen NOOIT via PowerShell 5.1 (`Set-Content`, redirections) worden geschreven — hun standaard encodings corrumperen UTF-8 of voegen een BOM toe.

---

## v1.12.81 — Augustus 2026

### Zoek-/matchaudit (TR4KER vs C411), link-voor-download, Seerr notificatie-overstroming, en een ontdekt engine-token mismatch

- **Verholpen, bevestigd live**: Een serie als "Ma vie avec les Walter Boys" (tmdbId 199001) kon nooit worden opgehaald: de gefranseerde titel werd gebruikt voor zowel de indexeringsquery als de lokale release-match, terwijl scènereleases altijd worden benoemd naar de ORIGINELE titel ("My.Life.With.The.Walter.Boys.S03...") — elke indexer retourneerde 0 hits. Zoeken en matchen geven nu de voorkeur aan `originalTitle` (de gefranseerde titel blijft als alias), en de dagelijkse metadata-verfrissing vult `originalTitle`/`tvdbId`/`imdbId` aan op reeds bestaande vermeldingen. TR4KER declareert ook alleen tvdb-zoekopdrachten (`tvSearchTvdb`, geen tmdb) — de tvdbid werd nooit naar het gestuurd omdat het veld niet bestond; `searchTv` stuurt nu `tvdbid` (TR4KER) / `tmdbid` (C411) als de indexer dit ondersteunt.
- **Verholpen**: Een falende ID-modus zoekopdracht (indexer-side fout of HTTP 5xx) slikte de hele zoekopdracht stil — de tekstfallback werd nooit uitgevoerd. Zowel `searchMovie`/`searchTv` vallen nu altijd terug op de tekstquery.
- **Verholpen**: De uurlijkse RSS-verfrissing toonde stilzwijgend "C411:0" — indexeerfouten werden opgevangen en weggegooid. Fouten worden nu per indexer gelogd (`rss_refresh.indexer_error`) en een cyclus met 0 releases terwijl andere er veel retourneren waarschuwt met de limieten van de indexer (`rss_refresh.indexer_empty`).
- **Verholpen**: Het linken van een release vóór het downloaden faalde met "Impossible d'ajouter ce titre à la bibliothèque" wanneer de titel al in de bibliotheek stond — de server's `alreadyInLibrary` respons draagt nu het bestaande item zodat de selectie direct naar dit item kan linken. Een duplicate-bibliotheekwaakhond (`libraryEntriesMatch`, titel/originalTitle/aliases + compatibel jaar) voorkomt ook dat TMDb duplicate-vermeldingen een tweede bibliotheekrecord creëren.
- **Verholpen**: De `[seerr] mediaId not found` log-overstroming — onbekende tmdbIds worden nu gecached als missen voor 1 uur (maximaal één keer/uur per item) met begrenzing van paginatie, en "processing" notificaties worden gededupliceerd naar één per titel per keer (`notifySeerrProcessingOnce`).
- **Fixed, environment**: het diagnostische log toonde elke opgehaalde bestanden afgewezen met `{"error":"unauthorized"}` — de webapplicatie en de downloadengine gebruikten verschillende `engine-token.json` bestanden (dev vs Windows service install). Tokenbestanden zijn op één lijn gebracht; een expliciete "TOKEN MOTEUR INVALIDE" hint verschijnt nu in het diagnostische log wanneer de engine een opgehaald bestand afwijst wegens onbevoegdheid.

---

## v1.12.80 — Augustus 2026

### "Downloads ophalen" crashte bij grote downloadmappen — nu in batches, en de wachtrij/geschiedenis tabbladen bevriezen niet langer met duizenden rijen

- **Fixed, bevestigd live**: de onderhoudsactie verwerkte elk bestand in één synchrone aanvraag. Met honderden bestanden (grote pakketten, langlopende achterstand) kon de aanvraag time-out raken of minuten duren, en de respons renderde elk opgehaald/verloren/dubbel bestand tegelijkertijd — de pagina bevroor of crashte volledig. De scan draait nu in batches van 20 bestanden per aanvraag: het paneel herroept automatisch met de reeds geprobeerde paden (de server is idempotent per pad, dus een permanent mislukt bestand wordt één keer gerapporteerd en nooit opnieuw geprobeerd binnen dezelfde run), toont voortgang naarmate batches voltooid zijn, en beperkt de gerenderde lijst tot 30 vermeldingen per sectie met een "+N meer" melding — de volledige gegevens blijven beschikbaar voor de verwijder-dubbele/niet-overeenkomend acties.
- **Fixed**: de Wachtrij tab toonde elke torrentrij (downloadend, seedend, voltooid...) bij elke 500 ms poll — honderden voltooide items schilderden duizenden DOM-nodes, waardoor de tab bevroor. Het schildert nu de eerste 50 rijen onmiddellijk (actieve items worden eerst gesorteerd, zodat de live wachtrij zichtbaar blijft), groeit de rest in rusttijd, en biedt een "Meer weergeven" knop. Dezelfde progressieve rendering wordt toegepast op de Activiteit geschiedenis tab, die tot 2000 vermeldingen bevat.
- Beide wijzigingen zijn rendering/perf-alleen: filters, bulkacties, tellers en opruimknoppen gedragen zich precies zoals voorheen.

---

## v1.12.79 — Augustus 2026

### Versterkt de vorige fix na onafhankelijke beoordeling

- Een onafhankelijke beoordeling van de v1.12.78 herstelfix ving twee echte hiaten op voordat ze konden toeslaan: de nieuwe oplossing "vertrouw het eigen record van de oorspronkelijke download" kon het overschrijven van het eigen, tegensprekende seizoennummer van een bestand — wat betekende dat een verkeerd gelabelde release stilzwijgend in de verkeerde seizoenmap kon worden geplaatst. Het vult nu alleen een seizoen/aflevering in als het eigen naam van het bestand dit nog niet heeft verstrekt, en overschrijft nooit een dat wel is verstrekt. Ook was nog één plek (een film ingepakt in een serie-categoriepakket) nog op het oude alleen-gokpad terwijl elk ander geval al was geüpgraded — nu consistent voor allemaal.

## v1.12.78 — Augustus 2026

### De oorzaak van de downloadherstel die niet opnieuw kon linken — het herstel gooide informatie weg die het al had

- **Fixed, bevestigd live**: onderzocht een specifiek geval (Wakfu) waarbij het downloadherstelhulpmiddel geen overeenkomst kon vinden voor voltooide bestanden, zelfs toen de serie al correct in de bibliotheek stond. Oorzaak: het herstel raadde elk bestand opnieuw aan op basis van alleen de bestandsnaam en de maproute, zelfs voor bestanden waarvan de oorspronkelijke download al wist — met zekerheid, vanaf het moment dat het werd opgehaald — precies welke serie en seizoen het tot behoorde. Die autoritatieve informatie werd weggegooid voordat de per-bestand matching draaide, waardoor elk bestand door een vage bestandsnaam-gok moest. Voor een serie georganiseerd als `ShowNaam/Seizoen 01/episode.avi` met een afleverbestand waarvan de eigen naam geen herkenbaar seizoenmarkering draagt, viel die gok terug op het lezen van de seizoenmap zelf ("Seizoen 01") als de titel van de show — die geen woorden deelde met de echte naam, dus het kwam nooit overeen.
- Herstel lost nu de show/seizoen van een bestand direct op uit het eigen record van de oorspronkelijke download wanneer beschikbaar, in plaats van te gokken — en wanneer het moet terugvallen op het lezen van mapnamen, controleert het nu één niveau hoger wanneer de dichtere map uitkomt als een kale seizoenmarkering zonder echte titel, in plaats van te stoppen bij de eerste map, ongeacht wat deze daadwerkelijk bevat. Beide fixes zijn algemeen — ze zijn van toepassing op elke serie die op deze manier is georganiseerd, niet op de serie die de bug deed verschijnen.

## v1.12.77 — Augustus 2026

### Theatermodus liet de onderliggende pagina zichtbaar doorlekken

- **Verholpen, bevestigd live**: de vorige fix maakte de eigen achtergrond van de speler transparant zodat de kleurambiance kon doordringen — maar erachter was niets echt volledig opaak (de paginadimensionele laag is slechts ~80% zwart door een onscherheid, en de kleurlagen zelf stapelen verschillende gedeeltelijk-opaque effecten op zonder een solide basis). De echte bibliotheekpagina was zichtbaar leesbaar door de letterboxbalken — erger dan het platte zwart dat het verving. Toegevoegd een permanente, volledig opake basislaag onder alles, zodat de pagina nooit meer kan doordringen, met of zonder artwork van een titel beschikbaar voor kleurextractie.

## v1.12.76 — Augustus 2026

### De inhoudsadaptieve achtergrond van Theatermodus was onzichtbaar — verholpen en opnieuw gebalanceerd voor echt visueel effect

- **Verholpen, bevestigd live**: de kleurambiance geëxtraheerd uit het eigen artwork van elke titel was structureel verborgen — de eigen achtergrond van de werkelijke videospeler was volledig opaak, geschilderd bovenop de ambiance laag, zodat de kleur alleen maar voor een flitsje flikkerde tijdens de openingsanimatie voordat deze volledig verdween gedurende de hele kijktijd. Bovendien droeg de ambiance laag zelf een tweede bijna-opaak zwarte scrim die direct op de kleurgradiënt was gestapeld, waardoor wat er tijdens dat flitsje doorheen kwam, bijna niets werd. Netto-effect: plat zwart ongeacht het artwork van de titel.
- De achtergrond van de speler is nu transparant waar deze de achtergrond moet laten doordringen, en de scrim/gradiëntbalans is herwerkt zodat de geëxtraheerde kleur daadwerkelijk zichtbaar is in de letterboxgebieden rond de video — een heldere, kleurrijke poster tintelt nu zichtbaar het theater, een donkere blijft sfeervol, in plaats van dat alles identiek oogt.

## v1.12.75 — Augustus 2026

### De oorzaak van een voltooide seizoenspakket-download die nooit in de bibliotheek verscheen

- **Verholpen, bevestigd live**: onderzocht een specifiek geval (een anime waarvan de seizoenpakketten volledig waren gedownload — de wachtrij toonde ze als "voltooid" — maar waarvan geen enkele aflevering ooit beschikbaar werd). De oorzaak: sommige seizoenpakket-uitgevers benoemen hun afleverbestand bestanden naar de show in een sterk afgekort of niet-standaard formaat dat de titelparser niet kan herkennen (in het bevestigde geval, een afkorting die geen woorden deelt met de echte titel) — dus wanneer de bestanden van de voltooide download niet overeenkwamen met een gevolgd aflevering, werden ze correct *niet* verwijderd, maar de herstelronde die precies dit geval zou moeten vangen, registreerde alleen de gemiste waarde in een waarde die nooit werd gelezen, waardoor de bestanden onbepaald bleven met nul zichtbaarheid.
- De herstelronde registreert nu deze op dezelfde manier als een echt ontkoppelde handmatige download al doet: ze verschijnen onder Activiteit → Niet gekoppeld, waar ze handmatig naar de juiste titel kunnen worden aangewezen — algemeen, voor elke release waarvan de naam de parser niet met zekerheid kan mappen, niet specifiek voor de ene show die het deed.

## v1.12.74 — Augustus 2026

### Matchingsbug die de verkeerde show kon pakken, en een job-wachtrij stilstand die alle achtergrondzoekopdrachten stilzwijgend kon bevriezen

- **Verholpen, bevestigd live**: de titel-matchscore behandelde twee titels als bijna identiek op basis van alleen de ruwe tekendistantie, zelfs als ze verschilden met één compleet ander woord — bevestigd live met "How I Met Your Father" (een ongerelateerde spin-off) die een score van ~91% vergelijkbaar was met een zoekopdracht naar "How I Met Your Mother" en in zijn plaats werd gepakt. De scorer controleert nu ook woord voor woord: een volledig ander woord (geen spelfoutvariant) is ontkwalificerend, ongeacht hoe dicht het algehele tekental lijkt.
- **Verholpen, bevestigd live**: een enkele vastgelopen achtergrondtaak (in dit geval een trage Plex-sync) kon een job-wachtrij slot onbepaald bezetten, waardoor alle andere wachtende taken erachter stilzwijgend werden geblokkeerd — inclusief geplande en handmatige zoekopdrachten — zolang het vastzat, zonder fout of indicatie dat er iets mis was. Dit kon ervoor zorgen dat een gemonitorde, correct toegevoegde titel nooit daadwerkelijk werd gezocht. De wachtrij geeft nu een job's slot vrij na 10 minuten als deze niet is voltooid, zodat één vastgelopen taak niet langer alles erachter kan verhongeren.

## v1.12.73 — Augustus 2026

### Beta speler — directe afspelen start nu zoals de handmatige "bliksemflits" herproberen altijd werkte

- **Verholpen**: de speler gebruikte voorheen om te bepalen of er geprobeerd moest worden om direct af te spelen door codecondersteuning vooraf te controleren met browser-API's die bekend staan om te liegen in veel gevallen (AC-3/E-AC-3 rapporteren altijd "niet ondersteund" op Chrome/Edge, sommige containers rapporteren afspeelbare video als niet ondersteund) — waardoor veel bestanden werden doorgestuurd naar een transcode of WebCodecs fallback die direct afspelen eigenlijk prima had kunnen afhandelen. Bevestigd live: de handmatige herprobeerknop, die altijd onvoorwaardelijk probeerde te direct af te spelen zonder zo'n voorafgaande controle, werkte merkbaar beter.
- Direct afspelen is nu de onvoorwaardelijke eerste poging voor elke video, precies overeenkomend met wat de handmatige herprobeerknop al deed — de twee zijn nu letterlijk dezelfde code-pad, en delen dezelfde automatische herstel (valt terug op de andere afspeelmodus bij een daadwerkelijke afspeelfout of bij echt stille audio, ongewijzigd van voorheen).
- De handmatige herprobeerknop profiteert nu ook van datzelfde automatische herstel, en hervat vanaf de huidige positie in plaats van opnieuw te beginnen vanaf nul.
- Verwijderd het nu volledig ongebruikte WebCodecs afspeelpad dat deze voorafgaande controle gebruikte om naar te routeren — het was strikt genomen een slechtere, redundante versie van wat direct afspelen + de bestaande fallback-keten al afdekt.

## v1.12.72 — Augustus 2026

### Theatermodus — een echt meeslepende speler, geen video in een modale venster

- **Nieuw**: de Beta-speler opent nu in een volledige "Theatermodus" — de huidige pagina blijft precies waar hij was erachter (scrollpositie, staat, alles), de speler zet uit vanaf de knop die je hebt aangeklikt met een echte geometrische overgang (geen vervaging), en de pagina erachter wordt geleidelijk gedimd en wazig in plaats van gewoon te verdwijnen.
- Elke omgevingstrailer of preview die ergens op het scherm afspeelt, stopt zodra de echte speler opent — nooit twee video's tegelijk afspelen.
- De achtergrond van de speler neemt nu een subtiele kleurambiance aan die is geëxtraheerd uit de eigen artwork van de titel (dominante tinten, helderheidsbewust) in plaats van plat zwart — geanalyseerd één keer per titel en gecached, nooit tijdens het afspelen.
- "Lezen in Plex" toont nu "Lezen" waar de Beta-speler de afspeelvoortgang daadwerkelijk zal afhandelen, en blijft "Lezen op Plex" waar het een echte overdracht naar Plex is — consistent op elke titelkaart, de titelpagina, de afleveringspagina en de dashboardheld (wat voorheen helemaal geen Beta-speler-integratie had).
- De drie aparte instanties van deze triggerlogica in de app zijn nu één gedeelde implementatie, waardoor de kloof wordt gedicht waar een toekomstige fix op één plek kon landen en gemist kon worden op de andere.

### In-app "wat is nieuw" volgt nu uw interface-taal

- Versieopmerkingen worden nu gelokaliseerd per UI-taal (terugval naar Engels voor alles wat nog niet is vertaald), in plaats van één vaststaand taalfbestand.
- **Verholpen**: de versieopmerkingen ontbraken stilzwijgend op zowel de Docker- als de Windows-builds — het bestand waaruit ze gelezen werden, was nooit daadwerkelijk opgenomen in een van de gepakte builds, dus de "wat is nieuw" pop-up had niets te tonen.

## v1.12.70 — Augustus 2026

### Downloadengine — oorzaak van permanent ontkoppelde downloads

- **Verholpen, bevestigd live**: het verwijderen van een torrent uit de downloadengine rapporteerde succes en wist zijn eigen tracking (inclusief naar welke bibliotheektitel het behoorde) zelfs als de onderliggende downloadclient er daadwerkelijk niet uit wist te verwijderen — de torrent bleef draaien en seeden zonder aanraking, maar de engine had geen record meer van. Dit veroorzaakte downloads die nooit meer aan een titel konden worden gekoppeld, hoe vaak ook een herstelscan liep. De engine ruimt nu alleen zijn eigen boekhouding op nadat de verwijdering onafhankelijk is bevestigd; anders blijft de torrent getrackt en kan het opnieuw worden geprobeerd in plaats van een permanent wees te worden.

## v1.12.51 – v1.12.69 — Augustus 2026

Matchnauwkeurigheid en enginebetrouwbaarheidstest doorlopen: complete-seriepakketdetectie (seizoenreeks-termen, valse-positiefbeveiligingen), vastgelopen-downloadherstel versterkt naar atomaire no-overwrite bewegingen met een betrouwbare importcallback, per-serie/film schrijfvergrendeling om een race te sluiten die de status van een voltooide aflevering kan laten vallen, en dubbele-downloadreconciliatie zodat een opnieuw opgehaald bestand niet langer de bibliotheek vastzet op de verkeerde status. Gebruikershandleiding bijgewerkt om recent uitgebrachte functies te behandelen (titelbewerking, filmversies, ongebonden-downloadkoppeling, anime-instellingen).

## v1.12.24 – v1.12.50 — Augustus 2026

Complete-seriepakketzoekopdracht (enkele-query, seizoenreeks-bewust), downloadherstelbetrouwbaarheid (mapscan, wees-bestand-matching, dubbele opruiming), beveiligde dubbele verwijdering, en een kleine geautomatiseerde testsuite voor de release-matching core.

## v1.10.90 – v1.12.23 — Juli–Augustus 2026

Kwaliteitsupgrade workflow (Optimaliseren / Negeer, betekenisvolle-upgrade detectie), een herontworpen resolutie/codec badge-systeem, GPU/animatie prestatieprofielen, en engine-stabilisatie over de uitwisselbare downloadbackends (crashfixes, anti-stall regel, per-serie zoekvergrendeling).

## v1.10.39 – v1.10.89 — Juli 2026

Download engine herschreven met uitwisselbare backends (native/aria2, WebTorrent, libtorrent), een onderhoudstool "downloads herstellen" voor weesbestanden, een premium toast-meldingen systeem, audio-codec badges, en bèta in-app afspeelverbeteringen (direct afspelen, transcode logging).

## v1.10.12 – v1.10.17 — Juli 2026

Taaldetectie nauwkeurigheidstest: audiospoor taal gelezen van Plex, Franse variant tags (VF/VFQ/VFF/TRUEFRENCH) correct voldoen aan kwaliteitsprofielen, dubbele aflevering opruiming, en een fix voor vroegtijdig torrent-verlaten.

## v1.10.1 – v1.10.6 — Juli 2026

Beslissingsbeveiliging (pre-grab zwarte lijst handhaving), franchise/collectie detectie, een herontworven downloadwachtrij en diagnostiek dashboard, en trailer/kalender verfijningen.

## v1.8.0 – v1.9.9 — Juli 2026

Geünificeerd titelpaneel (enkel component voor de slide-in en volledige pagina weergaven), een prullenbak/recyclebak veiligheidsnet voor verwijderde titels, mobiele responsiviteitstest, en een fix voor een geheugenlek in de metadata cache.

## v1.4.5 – v1.7.9 — Juli 2026

Beveiligingsversterking (padtraversal, databasebeveiligingen, CodeQL waarschuwingen), de prullenbak-systeem definitieve beveiligingen, een live in-app speler, real-time updates over de UI, Plex activiteitsmonitoring, en collectiesondersteuning.

## v1.1.67 – v1.4.4 — Juli 2026

In-app speler met automatische Plex transcode fallback, derde partij aanvraagimport (Seerr-compatibel), multi-architectuur Docker builds, en een reductie van de instellingennavigatie van 26 tabbladen naar 18.

## v1.1.50 – v1.1.66 — Juli 2026

Eerste publieke release: TMDb ontdekking, Torznab/Newznab indexer zoekopdracht, geünificeerde film/serie bibliotheek, multi-gebruikersaanvragen, de ingebouwde BitTorrent engine, en Plex sync — plus vroege stabiliteits- en beveiligingsfixes (sessiebeheer, bibliotheekdeduplicatie, afhankelijkheidsupgrades).
