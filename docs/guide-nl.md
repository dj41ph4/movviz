# Movviz Gebruikershandleiding

## 1. Overzicht

Movviz is een verenigd multimediaal commandocentrum. Het brengt ontdekking (TMDb), zoeken op Torznab/Newznab-indexers, een film- en seriebibliotheek, multi-gebruikersverzoekbeheer, een ingebouwde BitTorrent-engine, Plex-integratie en nog veel meer samen — allemaal in één premium interface met een cinematografische uitstraling.

**Belangrijke concepten:**

- **Bibliotheek** — Films en series die je toevoegt om te monitoren. Elke titel heeft een status (Beschikbaar, Aan het downloaden, Ontbrekend, Bezig met zoeken) en kan worden voorzien van tags, gemonitord en automatisch doorzocht via de indexers.
- **Indexer** — Torznab/Newznab-diensten die releases indexeren. Movviz raadpleegt ze om beschikbare downloads te vinden voor jouw gemonitorde content.
- **Engine** — De ingebouwde BitTorrent-client. Elke categorie (film/serie) draait zijn eigen engine-instantie met onafhankelijke downloadpaden, snelheidslimieten en seed-ratio's.
- **Verzoeken** — Gebruikers kunnen titels aanvragen die nog niet in de bibliotheek staan. Beheerders keuren verzoeken goed of af, waarna automatisch zoeken wordt gestart.
- **Plex** — Optionele integratie voor bibliotheeksynchronisatie (importeren wat Plex bezit), watchlist-synchronisatie (automatisch aanvragen van Plex-watchlist-toevoegingen) en het bijhouden van kijkstatus per gebruikersprofiel.

**Technische stack:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion, SWR en een speciale ESM BitTorrent-engine op een aparte poort.

**Poorten (standaard):** Webinterface op 9810, BitTorrent-engine op 9820, Cloudflare-oplosser op 9830, peer-to-peer op 51413/51414.

---

## 2. Aan de slag

### Eerste start — Installatiewizard

De eerste keer dat je Movviz opent (of als er nog geen beheerdersaccount bestaat), word je begeleid door een installatiewizard in 6 stappen op `/setup`:

1. **Taal** — Kies de interfacetaal uit 5 beschikbare opties: français (fr), English (en), Italiano (it), Nederlands (nl), Deutsch (de).
2. **TMDb API-sleutel** — The Movie Database (TMDb) levert alle ontdekking, metadata, posters en zoekopdrachten. Je kunt de ingebouwde standaardsleutel gebruiken of je eigen sleutel invoeren via [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. **TVDB API-sleutel** — TheTVDB levert aanvullende metadata, vooral voor anime. Haal een sleutel op via [thetvdb.com/api-information](https://www.thetvdb.com/api-information).
4. **Indexer** — Voeg een of meer Torznab- of Newznab-indexers toe. Dit zijn de bronnen die Movviz doorzoekt bij het zoeken naar releases. Je kunt ze toevoegen via een catalogus of een generiek endpoint handmatig configureren.
5. **Downloadclient** — Configureer de ingebouwde BitTorrent-engine-instanties (één voor films, één voor series). Stel bibliotheekmappen, downloadpaden, snelheidslimieten, seed-ratio's en automatisch startgedrag in.
6. **Plex** — Optioneel een Plex Media Server koppelen voor bibliotheeksynchronisatie, watchlist-synchronisatie en Plex-authenticatie.

Elke stap kan worden overgeslagen en later worden geconfigureerd via Instellingen.

### Account aanmaken / inloggen

Na de installatie kom je op de inlogpagina via `/login`. Movviz ondersteunt twee authenticatiemethoden:

- **Lokaal account** — Registreer met gebruikersnaam en wachtwoord. Het eerste account (aangemaakt tijdens de installatie) is beheerder. Latere registraties maken wachtende gebruikers aan die door een beheerder moeten worden goedgekeurd.
- **Plex-authenticatie** — Klik op "Inloggen met Plex" om te authenticeren via je Plex-account. Er opent een popup voor Plex-autorisatie; zodra deze is voltooid, wordt de login automatisch uitgevoerd.

Als je al een account hebt, gebruik dan direct het inlogformulier. Gebruik de link "Nog geen account?" om naar de registratiemodus te schakelen.

---

## 3. Dashboard (/)

Het dashboard is je startpagina — statistieken in één oogopslag en recente activiteit.

### Aanpasbare widgets

Het bovenste gedeelte toont tegels met tellingen van:
- **Films** — Totaal aantal films in de bibliotheek
- **Series** — Totaal aantal series in de bibliotheek
- **Afleveringen** — Totaal aantal gemonitorde afleveringen
- **Ontbrekende afleveringen** — Gemonitorde afleveringen die nog niet beschikbaar zijn
- **Beschikbaar** — Beschikbare films + afleveringen
- **Aan het downloaden** — Films + afleveringen die momenteel worden gedownload of gezocht
- **Ontbrekend** — Films met de status ontbrekend
- **Beschikbare afleveringen** — Beschikbare gemonitorde afleveringen

**Bewerkmodus:** Klik op het potloodpictogram om de bewerkmodus te openen. In de bewerkmodus kun je:
- **Tegels herschikken** door te slepen (Framer Motion-herschikking)
- **Tegels verwijderen** met de X-knop op elke tegel
- **Verborgen tegels toevoegen** via het dropdownmenu "Widget toevoegen"

Klik op het vinkje om de bewerkmodus te verlaten en de lay-out op te slaan.

### Downloadwachtrij

Onder de statistiektegels toont de **downloadwachtrij** actieve en in de wachtrij staande torrents van de engine, met realtime voortgangsupdates.

### Recent toegevoegd

Het onderste gedeelte toont de 12 meest recent toegevoegde films in een progressief raster. Elke kaart toont de poster, titel en downloadvoortgang als de film momenteel wordt gedownload.

---

## 4. Ontdekken (/discover)

De Ontdekken-pagina is je startpunt voor het vinden van nieuwe content om aan de bibliotheek toe te voegen.

### Contenttypeselector

Bovenaan kies je tussen **Film** en **Serie** om door content per type te bladeren. De genres, rijen en zoekresultaten worden dienovereenkomstig bijgewerkt.

### Dynamische rijen (homeweergave)

Wanneer er geen filter actief is, toont de Ontdekken-pagina horizontale samengestelde rijen met content:
- **Nu populair** — Wat er momenteel populair is
- **Populair** — Meest populaire titels
- **Hoogst gewaardeerd** — Titels met de hoogste beoordelingen
- **Binnenkort** — Aankomende releases
- **Nu in de bioscoop / Nu op tv** — Momenteel in de bioscoop of op televisie
- **Kassa** — Films met de hoogste opbrengsten
- **Kinderen** — Familievriendelijke content
- **Nieuwe releases** — Recent toegevoegd aan streamingdiensten
- **Nieuwe series / Vernieuwd** — Nieuwe of recent vernieuwde tv-series

Elke rij is een horizontaal scrollbare carrousel. Door op een kaart te klikken ga je naar de detailpagina van de titel. Door op "Alles bekijken" te klikken, schakel je over naar een rasterweergave met paginering, gefilterd op die categorie.

**Ranglijsten:** Sommige rijen (bijv. Hoogst gewaardeerd, Kassa) worden weergegeven als genummerde ranglijsten in plaats van carrousels.

### Studio- en netwerkknoppen

Onder de contentrijen vind je knoppen voor **studio's** (productiemaatschappijen) en **netwerken** (televisienetwerken). Door op een studio te klikken worden films van dat bedrijf gefilterd; door op een netwerk te klikken worden series van dat netwerk gefilterd.

### Genrestegels

Er worden kleurverlooptegels voor elk genre getoond. Door erop te klikken worden de resultaten op dat genre gefilterd.

### Filters

Wanneer je een filter activeert of een zoekopdracht uitvoert, schakelt de pagina over van de home-lay-out naar een navigatieraster met paginering en deze bedieningselementen:

- **Zoekveld** — Typ om op titel te zoeken (vertraagd met 350ms)
- **Genre-dropdown** — Filteren op genre
- **Jaar-invoerveld** — Filteren op uitgavejaar
- **Sorteer-dropdown** — Sorteren op Trending (populariteit), Hoogst gewaardeerd (gemiddelde beoordeling) of Meest recent (uitgavedatum)
- **Actieve filter-chips** — Tonen actieve filters (genre, jaar, studio, netwerk, rij-categorie) met een X om ze te wissen
- **Resetknop** — Alle filters in één keer wissen

### Oneindige resultaten

Het navigatieraster laadt resultaten in pagina's. Terwijl je naar beneden scrollt, worden er automatisch meer resultaten geladen via een IntersectionObserver. Een knop "Meer laden" verschijnt ook onderaan als alternatief.

### Toevoegen aan bibliotheek

Elke kaart in de navigatieweergave heeft een overlayknop om **aan de bibliotheek toe te voegen**. Wanneer erop wordt geklikt, voegt Movviz de titel toe aan je bibliotheek en begint automatisch te zoeken naar een release. De kaart toont de huidige status (Beschikbaar, Aan het downloaden, Ontbrekend) als de titel al in je bibliotheek staat.

---

## 5. Bibliotheek (/library)

De Bibliotheekpagina heeft drie tabbladen: Bibliotheek, Kalender en Gezocht.

### 5.1. Tabblad Bibliotheek

De hoofdweergave van de bibliotheek toont al je films en series in een progressief responsief raster.

**Filters:**
- **Type** — Alles, Alleen films of Alleen series
- **Status** — Alles, Beschikbaar, Aan het downloaden of Ontbrekend
- **Tag** — Als er tags aan titels zijn toegewezen, verschijnen er tagknoppen om op te filteren
- **Sorteren** — Op titel (alfabetisch) of Recent (meest recent toegevoegd)

**Progressief renderen:** De eerste 100 kaarten worden onmiddellijk weergegeven; de rest wordt in batches geladen met `requestIdleCallback`, zodat de pagina responsief blijft, zelfs met duizenden titels.

**Kaarten:** Filmkaarten tonen de poster (met een voortgangsbalk tijdens het downloaden), titel, jaar en statusbadge. Seriekearten tonen vergelijkbare informatie voor de algehele seriestatus.

**Reconciliatie:** De beheerder kan een bibliotheekreconciliatie uitvoeren om ontbrekende bestanden of niet-geregistreerde bestanden op de schijf te detecteren. Problemen worden inline gemeld.

### 5.2. Kalender

Toont aankomende filmreleases en uitzenddatums van afleveringen, gegroepeerd per datum. Items van vandaag worden gemarkeerd. Elk item toont de posterminiatuur, titel, taalbadge (VF/VO) en links naar de detailpagina van de titel.

### 5.3. Gezocht

Lijst alle ontbrekende gemonitorde items — films met de status ontbrekend en gemonitorde afleveringen die nog niet beschikbaar zijn.

Functionaliteit:
- **Knop "Alles downloaden"** — Zoekt naar alle ontbrekende items in batch (maximaal 5 gelijktijdige zoekopdrachten), met een voortgangsteller
- **Zoeken per item** — Elke ontbrekende film of aflevering heeft een zoekknop om onmiddellijk een indexer-zoekopdracht voor dat specifieke item te starten

Items worden getoond met hun titel, releasedatum/uitzenddatum en hoe lang geleden ze zijn toegevoegd.

---

## 6. Collecties (/collections)

### 6.1. Saga's (TMDb-franchises)

Automatisch gedetecteerde TMDb-franchisecollecties (bijv. "Star Wars", "Harry Potter") worden in deze sectie getoond.

- **Voortgang** — Elke saga toont een teller van bezit/totaal (bijv. 4/11) en een voortgangsbalk
- **Bibliotheek analyseren** — De beheerder kan een sagascan starten om nieuwe collecties uit de bibliotheek te detecteren
- **Weergavemodus** — Groot raster, klein raster of lijst (opgeslagen in localStorage)

Door op een saga te klikken, ga je naar de detailpagina met alle items in de collectie.

### 6.2. Aangepaste collecties

Door gebruikers gemaakte collecties om je bibliotheek naar wens in te delen.

- **Aanmaken** — Klik op de knop "Nieuwe collectie" om een aangepaste collectie te maken
- **Weergavemodus** — Net als bij saga's: groot raster, klein raster of lijst

---

## 7. Activiteit (/activity)

De Activiteit-pagina houdt downloadbewerkingen, gebeurtenissen en fouten bij.

### 7.1. Downloads (Wachtrij)

Toont de realtime downloadwachtrij van de BitTorrent-engine.

**Zichtbare statussen:**
- **Metadata** — Metadata/torrent-info aan het downloaden
- **Aan het downloaden** — Download bezig
- **Aan het seeden** — Voltooid, nu aan het seeden
- **Gepauzeerd** — Gepauzeerd door gebruiker of systeem
- **Gestopt** — Geen peers/activiteit
- **Voltooid** — Download afgerond

**Acties per item:**
- Pauzeren / Hervatten
- Opnieuw starten
- Uit wachtrij verwijderen
- Verwijderen + downloadbestanden wissen

**Handmatig toevoegen:** Je kunt handmatig torrents toevoegen via magnet-link of door een `.torrent`-bestand te uploaden.

**Statusfilters** — Filter de wachtrij op status om je te concentreren op specifieke statussen.

### 7.2. Geschiedenis

Een chronologisch logboek van gebeurtenissen met betrekking tot je content:
- **Opgehaald** — Een release is opgehaald van een indexer
- **Geïmporteerd** — Een download is geïmporteerd in de bibliotheek
- **Bijgewerkt** — Een bestaand bestand is vervangen door een betere kwaliteit
- **Mislukt** — Een download of import is mislukt
- **Geblokkeerd** — Een release is geblokkeerd door de blokkeerlijst

### 7.3. Gezocht

Hetzelfde als het tabblad Gezocht in de Bibliotheek — ontbrekende gemonitorde items die individueel kunnen worden doorzocht.

### 7.4. Fouten

Een gefilterde weergave van de geschiedenis die alleen mislukte gebeurtenissen toont voor snelle foutopsporing.

---

## 8. Indexer Zoeken (/search)

De zoekpagina stelt je in staat om rechtstreeks je geconfigureerde indexers te doorzoeken.

**Zoekbalk** — Voer een query in en druk op Enter of klik op de startknop.

**Film/Serie-schakelaar** — Beperk de zoekopdracht tot film- of seriecategorieën op je indexers.

**Sorteerbare resultatentabel** — Resultaten worden weergegeven in een responsieve tabel met sorteerbare kolommen:
- **Titel** — Releasenaam (monospace)
- **Score** — Kwaliteitsscore (gekleurd: groen ≥ 90, amber ≥ 75)
- **Indexer** — Welke indexer de release heeft teruggegeven
- **Leeftijd** — Hoe lang geleden gepubliceerd
- **Grootte** — Bestandsgrootte
- **Peers** — Aantal seeders (gekleurd)
- **Actie** — Ophaalknop om handmatig te downloaden

**Kwaliteitsscore:** Elke release wordt beoordeeld op basis van je releaseprofielen en aangepaste formats. Hogere scores geven betere overeenkomsten voor jouw voorkeuren aan.

**Ophaalknop** — Download handmatig een specifieke release. De knop verandert in een vinkje zodra de release is opgehaald.

**Recente releases** — Wanneer er geen zoekopdracht is ingevoerd, toont de pagina recente releases van je indexers voor de geselecteerde categorie.

**Fouten per indexer** — Als een indexer een fout retourneert (verkeerde sleutel, snelheidslimiet, enz.), wordt dit getoond in een waarschuwingsbanner, zodat je weet waarom sommige indexers geen resultaten hebben geretourneerd.

---

## 9. Verzoeken (/requests)

Gebruikers kunnen films of series aanvragen die nog niet in de bibliotheek staan.

**Een verzoek indienen:** Klik op de detailpagina van een titel op "Toevoegen aan bibliotheek." Als het item nog niet in de bibliotheek staat, wordt er een verzoek aangemaakt (afhankelijk van de gebruikersrechten).

**Verzoekenlijst:** Toont alle verzoeken met poster, titel, beoordeling, jaar, beschrijving, wie het heeft aangevraagd en wanneer.

**Wachtende verzoeken:** Nieuwe verzoeken verschijnen met een badge "In afwachting".

**Beheerdersacties:**
- **Goedkeuren** — Keurt het verzoek goed en start automatisch zoeken
- **Afwijzen** — Wijst het verzoek af

**Status goedgekeurd verzoek:** Na goedkeuring wordt de statusbadge bijgewerkt om de werkelijke bibliotheekstatus weer te geven (Bezig met zoeken, Aan het downloaden, Ontbrekend, Beschikbaar).

**Tabbladen:** In afwachting (standaard) toont alleen onafgehandelde verzoeken; Alles toont elk verzoek. De badge in de zijbalk toont het aantal wachtende verzoeken.

---

## 10. Geschiedenis (/history)

Een uitgebreid gebeurtenissenlogboek, apart van de Activiteit-pagina.

**Filters:**
- **Type** — Alles, Film of Serie
- **Gebeurtenistype** — Alles, Opgehaald, Geïmporteerd, Bijgewerkt of Mislukt

**Gebeurtenissentabel:** Elke regel toont de contenttitel, gebeurtenistype (met pictogram), grootte, tijdstempel, indexer/actor en kwaliteitsscore. Door op een titel te klikken, ga je naar de detailpagina.

---

## 11. Problemen (/issues)

Gebruikers kunnen problemen melden met media-items.

**Een probleem melden:** Klik op de detailpagina van een titel die in de bibliotheek staat op "Meld een probleem." Kies het probleemtype:
- **Video** — Problemen met videokwaliteit of afspelen
- **Audio** — Problemen met audiotracks
- **Ondertiteling** — Ontbrekende of onjuiste ondertiteling
- **Anders** — Elk ander probleem

**Problemenlijst:** Toont alle gemelde problemen met poster, titel, probleemtypebadge, status, beschrijving, melder en tijdstip.

**Reacties:** Elk probleem heeft een draadgestuurd reactiesysteem. Klik op de knop met het reactietal om het gesprek uit te vouwen. Voeg reacties toe via het invoerveld onderaan.

**Beheerdersacties:**
- **Oplossen** — Markeer een probleem als opgelost
- **Heropenen** — Heropent een eerder opgelost probleem

**Tabbladen:** Open (standaard) toont onopgeloste problemen; Alles toont elk probleem.

---

## 12. Gebruikers (/users)

Gebruikersbeheer voor beheerders. Toont een lijst van alle gebruikers.

**Wachtende gebruikers:**
- Gebruikers die zich hebben geregistreerd maar nog niet zijn goedgekeurd, verschijnen in een gemarkeerde sectie
- **Goedkeuren** — Activeert het gebruikersaccount
- **Afwijzen** — Verwijdert de wachtende gebruiker

**Actieve gebruikers:**
Elke gebruikersrij toont:
- Gebruikersnaam met authenticatiebadge (Lokaal of Plex)
- Rol (Gebruiker of Beheerder) met inline in-/uitschakeling
- Schakelaar **Automatische goedkeuring** — Wanneer ingeschakeld, worden verzoeken van deze gebruiker automatisch goedgekeurd
- Link naar de gebruikersdetailpagina

**Lokale gebruiker aanmaken:** Opent een modaal om direct een nieuwe lokale gebruiker aan te maken (gebruikersnaam + wachtwoord).

**Plex-gebruikers importeren:** Als Plex is verbonden, importeer Plex-servergebruikers als Movviz-gebruikers.

### Gebruikersdetails (/users/:id)

Door op een gebruiker te klikken, wordt de detailpagina met drie tabbladen geopend:

**Algemeen:**
- **Ontdekken per continent** — Bepaalt welke continenten worden weergegeven op de Ontdekken-pagina van de gebruiker
- **Verzoeklimieten** — Per gebruiker limieten voor film- en serieverzoeken (met Onbeperkt-vakje)
- **Automatische goedkeuring** — Schakelaar voor automatische goedkeuring van verzoeken
- **Plex-watchlist-synchronisatie** — Als de gebruiker een Plex-token heeft, kunnen Plex-watchlist-toevoegingen automatisch worden aangevraagd

**Rechten:**
- **Rol** — Gebruiker of Beheerder (een beheerder kan zichzelf niet degraderen)
- **Kan verzoeken beheren** — Delegeert verzoekbeheer aan niet-beheerders

**Wachtwoord:** Voor niet-Plex-gebruikers kunnen beheerders het wachtwoord opnieuw instellen.

---

## 13. Profiel (/profile)

De profielpagina van elke gebruiker voor persoonlijke instellingen.

### Wachtwoord

Wijzig je wachtwoord door het huidige wachtwoord en een nieuw wachtwoord in te voeren (minimaal 8 tekens).

### API-token

Maak en beheer persoonlijke API-toegangstokens voor programmatische toegang.

- **Token aanmaken** — Geef het een naam en kopieer vervolgens het gegenereerde token (eenmalig weergegeven)
- **Tokenlijst** — Toont alle tokens met aanmaakdatum en laatste gebruik
- **Intrekken** — Verwijder een token om het ongeldig te maken

### Ontdekken per continent

Selecteer welke continenten je wilt prioriteren bij het ontdekken. Dit filtert films en series op je Ontdekken-pagina op basis van productielanden.

### Watchlist

Je persoonlijke watchlist — titels die je hebt gemarkeerd voor later.

Elk watchlist-item toont de poster, beoordeling en acties bij hover:
- **Toevoegen aan bibliotheek** — Voegt de titel toe aan de bibliotheek en verwijdert deze uit de watchlist
- **Verwijderen** — Verwijdert uit de watchlist zonder toe te voegen

Je kunt titels aan je watchlist toevoegen vanaf elke titeldetailpagina via de bladwijzerknop.

---

## 14. Instellingen (/settings)

De Instellingen zijn georganiseerd in 5 groepen met een inklapbare zijbalk op desktop en onderaan-navigatie op mobiel. Alle instellingentabbladen (behalve Info) zijn alleen toegankelijk voor beheerders.

### 14.1. Downloaden

**Client:** Twee ingebouwde BitTorrent-engine-instanties — één voor films, één voor series. Elke instantie toont:
- Statusindicator (online/offline)
- Protocol (Torrent)
- Categoriekoppeling (Film/Serie)
- Samenvatting van de huidige configuratie

Tijdens het bewerken kun je configureren:
- **Bibliotheekmap** — Waar mediabestanden worden opgeslagen voor Plex
- **Downloadmap** — Waar onvolledige downloads naartoe gaan
- **Voltooid-map** — Waar voltooide downloads naartoe worden verplaatst
- **Maximaal actieve downloads** — Limiet voor gelijktijdige downloads
- **Seed-ratio** — Doelratio voordat seeden wordt gestopt
- **Maximale peers** — Maximaal aantal peer-verbindingen per torrent
- **Uploadslots** — Uploadslots per torrent
- **Downloadsnelheidslimiet** — Globale downloadlimiet (KB/s; "Onbeperkt" indien leeg)
- **Uploadsnelheidslimiet** — Globale uploadlimiet
- **Automatisch starten** — Of de instantie start met de engine

**Mapverkenner:** Als de engine op dezelfde machine draait, kun je met een ingebouwde mapverkenner visueel door paden navigeren en deze selecteren. Voor externe/Docker-configuraties voer je het pad handmatig in.

**Engine opnieuw starten-knop** — Als de engine offline is, verschijnt er een knop om opnieuw te starten.

**Indexer:** Configureer Torznab/Newznab-indexers voor het zoeken naar releases.

Elke indexer toont:
- Protocol (Torrent/Usenet) met pictogram
- Naam en basis-URL
- Verbindingsstatus (OK/Mislukt/Niet getest) met details van de laatste test
- Authenticatie-indicatoren (API-sleutel of inloggegevens)
- Aan/uit-schakelaar
- Prioriteitsinstelling

**Instellingen per indexer:**
- **Categorieën** — Welke contentcategorieën moeten worden doorzocht (uitklapbaar paneel)
- **Filters** — Minimale/maximale grootte (MB) en maximale leeftijd (dagen)
- **Cloudflare-oplosser** — Schakel de Cloudflare-oplosser in voor door Cloudflare beschermde indexers
- **Testknop** — Test de verbinding in realtime
- **Verwijderen** — Indexer verwijderen

**Indexer toevoegen:** Twee-stappenproces:
1. Kies uit een catalogus van vooraf gedefinieerde indexers (Torznab/Newznab)
2. Voer URL, authenticatie (API-sleutel of gebruikersnaam/wachtwoord) en categorieën in

**Oplosser-URL:** Configureer de FlareSolverr-URL (standaard: `http://localhost:9830`) die door de Cloudflare-oplosser wordt gebruikt.

**Kwaliteit:** Score- en filterregels voor releases, die release-profielen en aangepaste formaten combineren in één tabblad.

- **Geblokkeerde woorden** — Een lijst met woorden die, indien aanwezig in een releasetitel, ervoor zorgen dat deze wordt afgewezen. Voeg woorden afzonderlijk toe; verwijder ze met de X-knop.
- **Maximale grootten** — Maximaal toegestane groottes voor films (GB), afleveringen (GB) en seizoenen (GB). Releases die deze overschrijden worden afgewezen.
- **Codec-scores** — Scores voor videocodecs: x264, x265 en AV1. Hogere scores maken releases met die codec waarschijnlijker om gekozen te worden.
- **Aangepaste formaten** — Op regex gebaseerde scoreregels toegepast op releasetitels. Elk formaat heeft een naam, een score (positief of negatief) en regex-termen. Maak ze aan om patronen zoals "HDR", "Dolby Vision", "Remux" enz. te prioriteren of te degraderen.

### 14.2. Bibliotheek

**Metadata:** Configuratie van externe gegevensbronnen.

- **TMDb** — De API-sleutel van The Movie Database. Je kunt de ingebouwde standaardsleutel gebruiken of je eigen sleutel opgeven. Test de sleutel om te verifiëren dat deze werkt. Optie om de standaardsleutel te herstellen is beschikbaar.
- **TVDB** — De API-sleutel van TheTVDB voor aanvullende metadata. Bevat een schakelaar om TVDB specifiek voor **anime**-titels te gebruiken.
- **OMDb** — De API-sleutel van The Open Movie Database voor Rotten Tomatoes-scores en Metacritic-beoordelingen. Testen om te verifiëren.
- **Ontdekken-lay-out** — Kies tussen de standaard **Movviz**-lay-out (postercarrousels + ranglijsten) of de **Allociné**-lay-out, die de stijl van de Ontdekken-pagina aanpast.

**Plex:** Integratie met Plex Media Server.

- **Verbinding:**
  - **Hostname** — Hostnaam of IP van de Plex-server
  - **Poort** — Standaard 32400
  - **SSL** — Inschakelen om HTTPS te gebruiken
  - **Koppelen/Opnieuw koppelen** — Authenticeren met je Plex-account via browserpopup
  - **Test** — Connectiviteit verifiëren
- **Bibliotheeksynchronisatie:**
  - Inschakelen om automatische synchronisatie van Plex-bibliotheken naar Movviz in te schakelen
  - **Nu synchroniseren** — Start onmiddellijke synchronisatie
  - **Nieuwe volledige scan** — Forceer een volledige herscan in plaats van incrementeel
  - Resultaten tonen hoeveel films/series zijn toegevoegd en vergeleken
- **Watchlist-synchronisatie:**
  - Inschakelen om wereldwijde Plex-watchlist-synchronisatie in te schakelen
  - Wanneer ingeschakeld, kunnen gebruikers die inloggen met Plex hun Plex-watchlist automatisch zien omzetten in verzoeken
- **Plex-profielen (Gebruikerstoewijzing):**
  - Wijs elke Movviz-gebruiker toe aan een specifieke Plex Managed User (profiel), zodat de kijkstatus de geschiedenis van dat profiel weerspiegelt

**Naamgeving:** Sjablonen voor bestands- en mapnamen met interactieve token-invoeging.

Sjablonen voor:
- **Filmmap** — bijv. `{title} ({year})`
- **Filmbestand** — bijv. `{title} ({year}) [{quality}]`
- **Seriemap** — bijv. `{title} ({year})`
- **Seizoensmap** — bijv. `Seizoen {season:00}`
- **Afleveringsbestand** — bijv. `{series} - S{season:00}E{episode:00} - {title}`

**Interactieve tokens:** Klik op een veld en vervolgens op een token-knop om het op de cursorpositie in te voegen. Beschikbare tokens: `{title}`, `{year}`, `{quality}`, `{season}`, `{episode}`, `{series}` en meer.

**Punten of spaties:** Kies of scheidingstekens punten of spaties gebruiken.

**Live voorbeeld:** Terwijl je sjablonen bewerkt, toont een voorbeeld hoe de resulterende bestandspaden eruitzien voor een voorbeeldfilm en -aflevering.

**Importeren:** Externe watchlists die gesynchroniseerd en automatisch aan de bibliotheek kunnen worden toegevoegd (in het tabblad "Importeren").

Ondersteunde bronnen:
- **Trakt** — Trakt-gebruikerslijsten
- **IMDb** — IMDb-lijsten
- **Letterboxd** — Letterboxd-watchlist

Voor elke lijst configureer:
- **Naam** — Een beschrijvend label
- **Type** — Trakt, IMDb of Letterboxd
- **URL** — De lijst-URL
- **Automatisch goedkeuren** — Indien ingeschakeld, worden items uit deze lijst automatisch goedgekeurd
- **Sync-knop** — Handmatig een synchronisatie starten

**Seerr-import:** Importeer aanvragen van een bestaande Overseerr-instantie.

- **URL** — Je Seerr-server-URL
- **API-sleutel** — API-sleutel voor authenticatie
- **Test** — Verbinding controleren
- **Nu importeren** — Importproces starten

**Blokkering:** Titels die nooit aan de bibliotheek mogen worden toegevoegd.

- **Geblokkeerde titel toevoegen** — Zoek een titel op TMDb, selecteer deze, voeg optioneel een reden toe en bevestig
- **Blokkering** — Toont alle geblokkeerde titels met type, titel, jaar, reden, wie ze heeft geblokkeerd en wanneer
- **Deblokkeren** — Verwijder een titel uit de blokkering

### 14.3. Schijf

**Indexering:** Scan de hoofdmap van de bibliotheek op verweesde bestanden — mediabestanden op de schijf die niet worden bijgehouden in de Movviz-bibliotheek. Eén tabblad met een Film/Serie-schakelaar.

- Selecteer de hoofdmap om te scannen
- Overeenkomsten worden gepresenteerd met een geïntegreerde TMDb-zoekopdracht voor handmatig matchen
- Importeer met één klik om gematchte bestanden aan je bibliotheek toe te voegen

**Hernoemen:** Mappen en bestanden hernoemen volgens je naamgevingssjablonen.

Proces:
1. **Analyseren** — Scan je bibliotheek en genereer een lijst met hernoemkandidaten met huidige versus verwachte paden
2. **Selecteren** — Kies welke items je wilt hernoemen (Alles, Alleen films, Alleen series of individuele selectie)
3. **Voorbeeld** — Bekijk de wijzigingen
4. **Uitvoeren** — Pas hernoemingen toe met realtime voortgang en logboek

Instellingen:
- **Taal** — Kies de TMDb-taal voor vertaalde titels (beïnvloedt map-/bestandsnamen)
- **"Verwijder lege mappen"** — Na hernoemen, automatisch nu lege mappen verwijderen
- **Voortgang + realtime logboek** — Houd de bewerking in realtime bij

**Onderhoud:** Groepeert schijfonderhoudsoperaties in één tabblad.

**Paden repareren:** Detecteert bibliotheekitems waarvan de bestanden zijn verplaatst of ontbreken.

1. **Analyseren** — Vergelijk bibliotheekgegevens met het daadwerkelijke bestandssysteem
2. Resultaten worden gecategoriseerd:
   - **Zeker** — Een unieke overeenkomst (automatisch geselecteerd)
   - **Dubbelzinnig** — Meerdere mogelijke overeenkomsten (vereist menselijke keuze)
   - **Conflict** — Een bestand dat overeenkomt met meerdere bibliotheekitems
3. **Bestandsbrowser** — Voor handmatige correctie open je een bestandsbrowser om het juiste pad te vinden
4. **Toepassen** — Koppel de geselecteerde items opnieuw

**Lege mappen:** Scan geconfigureerde hoofdmap op lege mappen.

- Scan recursief alle geconfigureerde bibliotheekhoofdmappen
- Negeert veelvoorkomende systeembestanden (`.DS_Store`, `Thumbs.db`, `Desktop.ini`, enz.)
- **Verwijderen** — Verwijder geselecteerde lege mappen
- **Recursieve bovenliggende opschoning** — Na verwijdering worden nu lege bovenliggende mappen ook recursief verwijderd

**Prullenbak:** Vangnet voor verwijderde inhoud.

Wanneer een film of serie samen met zijn bestanden uit Movviz wordt verwijderd, kunnen de bestanden naar een prullenbakmap worden verplaatst in plaats van permanent te worden verwijderd.

- **Filmmap** — Pad waar verwijderde filmbestanden naartoe gaan
- **Seriemap** — Pad waar verwijderde seriebestanden naartoe gaan
- **Bewaring** — Dagen voordat prullenbakbestanden permanent worden verwijderd (configureerbaar)
- **Aantal items** — Toont hoeveel items zich momenteel in de prullenbak bevinden

### 14.4. Meldingen

Configureer pushmeldingen voor media-evenementen (opgehaald, geïmporteerd, mislukt, enz.). Dit ene tabblad groepeert transporten, webhook en activiteitsopties.

**Transporten:**
- **Discord** — Webhook-URL
- **Telegram** — Bot-token + Chat-ID
- **Gotify** — Server-URL + App-token
- **Slack** — Webhook-URL
- **Pushbullet** — API-token

Elk transport:
- In-/uitschakelen
- Configuratievelden (wachtwoorden worden gemaskeerd)
- **Testknop** — Stuurt een testmelding om de configuratie te verifiëren

**Webhook:** Stuur HTTP-POST-meldingen naar een aangepaste URL.

- **Inschakelen** schakelaar
- **URL** — Het webhook-eindpunt
- **Testknop** — Stuurt een testpayload

**Kwaliteitsupgrades:** Schakel het automatisch zoeken en downloaden van hogere kwaliteitsversies van reeds beschikbare inhoud in of uit.

### 14.5. Systeem

**Diagnostiek:** Realtime systeemstatusoverzicht.

- **Engine** — BitTorrent-engine online/offline
- **TMDb** — TMDb API-connectiviteit
- **Indexer** — Verbindingsstatus per indexer
- **Processen:**
  - **Web** — Webinterfaceproces: % CPU, RAM, uptime
  - **Engine** — Engineproces: % CPU, RAM, uptime
- **Schijfruimte** — Totale, vrije en gebruikte ruimte op geconfigureerde paden
- **Bibliotheekstatistieken** — Totaal aantal films, series, afleveringen
- **Prestaties** — API-aanroepen en latenties
- **Engine-logboek** — Live weergave van engine-uitvoer
- **Oplosser-logboek** — Live weergave van Cloudflare-oplosser-uitvoer

**Geplande taken:** Lijst van alle terugkerende achtergrondtaken.

Elke taak toont:
- **Naam** — Wat de taak doet
- **Interval** — Hoe vaak deze wordt uitgevoerd
- **Laatste uitvoering** — Wanneer deze voor het laatst is uitgevoerd
- **Volgende uitvoering** — Wanneer deze de volgende keer wordt uitgevoerd
- **Knop "Nu uitvoeren"** — Start de taak handmatig

**Takenwachtrij:** Actieve en recente achtergrondtaken.

- Toont momenteel lopende taken met status en voortgang
- Geschiedenis van recent voltooide taken
- **Prioriteit** — Schuifregelaar (0–100) per taaktype om de uitvoeringsprioriteit te regelen
- Taken met hogere prioriteit worden eerst uitgevoerd wanneer meerdere taken in de wachtrij staan

**Cache:** Statistieken en beheer voor caches.

Elke cache-entry toont:
- **Naam** — Cache-identificatie
- **Hits** — Succesvolle cache-opzoekingen
- **Missers** — Mislukte cache-opzoekingen
- **Sleutels** — Aantal items in de cache
- **Grootte** — Geschat geheugengebruik

Acties:
- **Vullen** — Een cache vooraf laden
- **Leegmaken** — Alle items in een cache ongeldig maken

**Back-up:** JSON-configuratie exporteren en importeren.

- **Exporteren** — Download alle instellingen, bibliotheekmetadata en configuratie als JSON-bestand
- **Importeren** — Upload een eerder geëxporteerd JSON-bestand om de configuratie te herstellen

**Info:** Applicatie-informatie.

- **Versie** — Huidige Movviz-versienummer
- **Licentie** — GNU General Public License v3.0
- **Project ondersteunen** — Link om de ontwikkeling te ondersteunen
- **Updates:**
  - **Controleer op updates** knop
  - Op **Windows**: One-click installatieknop die de update automatisch downloadt en toepast
  - Op **Docker/andere platformen**: Toont een link naar de GitHub-releasespagina met instructies

**Gevarenzone:** Onomkeerbare acties onderaan de groep, visueel gescheiden.

Elke actie vereist het typen van een bevestigingswoord voordat deze kan worden uitgevoerd:
- **Alle films wissen** — Verwijdert alle films uit de bibliotheek
- **Alle series wissen** — Verwijdert alle series uit de bibliotheek
- **Activiteitsgeschiedenis wissen** — Verwijdert alle activiteitsgeschiedenis
- **Meldingen wissen** — Verwijdert alle meldingsconfiguraties
- **Aanvragen wissen** — Verwijdert alle gebruikersaanvragen
- **Gemelde problemen wissen** — Verwijdert alle gemelde problemen
- **Plex-synchronisatiestatus resetten** — Reset de Plex-synchronisatie tracking

---

## 15. Titeldetail (/title/:type/:id)

Een uitgebreide detailpagina voor films en series, die alles over een titel toont.

### Content-secties

- **Achtergrond** — Volledige breedte hero-afbeelding bovenaan
- **Poster** — Verticale poster met verloopoverlay
- **Titel** — Naam van de film of serie
- **Beoordelingen** — TMDb-, IMDb-, Rotten Tomatoes- (via OMDb) en Metacritic-scores
- **Jaar, Duur, Seizoenen** (voor series), **Genres**
- **Tagline** — De tagline van de film of serie (indien beschikbaar)
- **Verhaal** — Volledige samenvatting / plotbeschrijving
- **Budget / Opbrengst** — Voor films, financiële gegevens van TMDb

### Actieknoppen

- **Toevoegen aan bibliotheek** — Als nog niet in bibliotheek, voegt de titel toe en start zoeken
- **Bekijken op Plex** — Indien beschikbaar in bibliotheek en Plex is verbonden, opent direct de Plex-webspeler
- **Zoeken** — Als het item in de bibliotheek bestaat, start een nieuwe indexer-zoekopdracht (ook gebruikt voor kwaliteitsupdates)
- **Handmatige keuze** — Opent de vooringevulde indexerzoekpagina voor handmatige release-selectie
- **Bladwijzer / Bladwijzer verwijderen** — Toevoegen aan of verwijderen uit je persoonlijke watchlist
- **Trailer** — Opent een modaal met de YouTube-trailer
- **Saga** — Voor films, linkt naar de TMDb-collectie-/sagapagina

### Bibliotheekstatusbadge

Toont de huidige status van de titel in je bibliotheek: Beschikbaar, Aan het downloaden, Bezig met zoeken of Ontbrekend.

### Cast en Crew

- **Cast** — Horizontaal scrollende rij met acteursportretten en personagenamen; klik voor persoonsdetails
- **Crew** — Raster van crewleden per functie (Regisseur, Scenarist, enz.) met "Meer tonen"-uitbreiding

### Seizoenen (Series)

Voor series toont een seizoenenpaneel elk seizoen met zijn afleveringen. Elke aflevering toont:
- Afleveringsnummer en titel
- Uitzenddatum
- Monitoringschakelaar
- Statusbadge
- Zoekknop per seizoen

### Trefwoorden

Tags/trefwoorden van TMDb weergegeven als pillen.

### Aanbevolen

Vergelijkbare titels van TMDb weergegeven als een posterraster.

### Zijbalkinformatie

- Originele titel
- Status (Uitgebracht, Afgelopen, Lopende serie, enz.)
- Releasedatum / eerste uitzenddatum
- Budget en opbrengst (films)
- Oorspronkelijke taal
- Landen van herkomst
- Studio's / Productiemaatschappijen
- **Streamingplatforms** — Logo's van beschikbare streamingproviders (bijv. Netflix, Disney+, enz.)
- **Externe links** — Pictogrammen voor Plex, TMDb, IMDb, Rotten Tomatoes, Letterboxd

### Verzoekmodals

Als de titel nog niet in de bibliotheek staat, opent het klikken op "Toevoegen aan bibliotheek" een verzoekmodal specifiek voor het type (film of serie) met opties voor de gebruiker.

### Handmatige keuze-modal

Opent de indexerzoekpagina (`/search`) in een modaal/dialoogcontext, vooringevuld met de metadata van de titel en de juiste bibliotheekreferentie voor automatische import na ophalen.

---

## 16. Sneltoetsen

- **Cmd+K / Ctrl+K** — Opent het universele commandopalet voor snelle navigatie en zoeken
- **Zijbalknavigatie** — Alle hoofd secties zijn toegankelijk via de zijbalk: Dashboard, Ontdekken, Bibliotheek, Collecties, Zoeken, Verzoeken, Activiteit, Geschiedenis, Problemen, Gebruikers (beheerder), Instellingen (beheerder)

---

## 17. Probleemoplossing

### Engine offline

**Symptomen:** Downloads starten niet, activiteit toont geen wachtrijen, rode "offline"-indicator in Instellingen > Downloaden > Client.

**Oplossingen:**
- Controleer of het engineproces draait (`npm run engine` of de Windows-service)
- Controleer of poort 9820 niet wordt geblokkeerd door een firewall
- Klik in Instellingen > Downloaden > Client op "Engine opnieuw starten"
- Bekijk de engine-logboeken in Instellingen > Systeem > Diagnostiek > Engine-logboek
- Controleer of het engine-statusbestand niet beschadigd is

### Indexer-fouten

**Symptomen:** Zoekresultaten zijn leeg, of specifieke indexers tonen status "mislukt".

**Oplossingen:**
- Controleer het testresultaat van elke indexer in Instellingen > Downloaden > Indexer
- Controleer of je API-sleutels nog geldig zijn
- Voor door Cloudflare beschermde indexers, schakel "Cloudflare-oplosser" in en zorg dat FlareSolverr draait
- Controleer de minimale/maximale groottefilters en maximale leeftijd — deze kunnen te restrictief zijn
- Zoek naar indexer-foutmeldingen in de waarschuwingsbanner op de zoekpagina

### Verbonden paden (Docker-bindmounts)

**Symptomen:** Bestanden bestaan op schijf maar de bibliotheek toont status "ontbrekend". De scan Paden repareren toont kandidaten met onjuiste paden.

**Oplossingen:**
- Voer een scan Paden repareren uit in Instellingen > Schijf > Onderhoud > Paden repareren
- Voor Docker-bindmounts probeert Movviz stille automatische herkoppeling — controleer of dit is gelukt
- Als automatische herkoppeling niet heeft gewerkt, gebruik dan de handmatige bestandsbrowser om paden te corrigeren
- Zorg ervoor dat je Docker-volumemounts consistent zijn tussen herstarts

### Verlopen sessies

**Symptomen:** 401-fouten op API-aanroepen, onverwachte omleiding naar inlogpagina.

**Oplossingen:**
- Log uit en log opnieuw in
- Als je Plex-authenticatie gebruikt, koppel dan je Plex-account opnieuw
- Sessiecookies worden beheerd door de server — als de server opnieuw opstart, kunnen sessies ongeldig worden
- Controleer of de systeemklok nauwkeurig is (sessietokenvalidatie is tijdsgevoelig)
