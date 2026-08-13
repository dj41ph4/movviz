# Changelog

Alle noemenswaardige wijzigingen aan Movviz, gegroepeerd per ontwikkelmijlpaal.

---

## v1.13.65 — Augustus 2026

### FFmpeg-remux: gekopieerde AC-3-audio was niet decodeerbaar door de browser — stille weergave

- **Grondoorzaak bevestigd**: de audio-kopieerwhitelist van de remux bevatte `ac3`/`ac-3` (spiegelbeeld van die van de Plex-transcode) — maar de context is anders: aan Plex-transcodezijde wordt gekopieerde AC-3 door hls.js getransmuxt naar fMP4 voor MSE (gedecodeerd door Chrome met Dolby-pack); aan remuxzijde wordt de stream gelezen door de NATIEVE decoder van de `<video>` in progressieve MP4, en Chrome/Edge decoderen AC-3 niet in die context → perfect beeld, geen geluid, zonder enige HTTP-fout.
- **Opgelost**: de audio-kopieerwhitelist van de remux is nu beperkt tot universeel decodeerbare codecs (`aac`/`mp4a`/`mp3`) — al de rest (AC-3, EC-3, DTS, TrueHD…) wordt getranscodeerd naar AAC 192 kbit/s, de geluidsgarantie van de lokale remux. De whitelist van de Plex-transcode blijft ongewijzigd (de context rechtvaardigt dit).
- **Opgelost**: race condition in `FfmpegRemuxEngine.seek()` — de DELETE van de oude sessie werd fire-and-forget verstuurd; als de GET van de nieuwe sessie eerder bij de server aankwam, doodde `stopAllForRatingKey` de zojuist aangemaakte sessie en viel de seek terug op HLS. De DELETE wordt nu afgewacht vóór het laden.

### De Hero speelde steeds dezelfde titels uit

- **Opgelost**: pools zonder natuurlijke volgorde (persoonlijke suggesties, ontdekking, nooit bekeken) worden nu gemengd met een deterministische seed per dag en per gebruiker — rotatie elke 24 uur in plaats van dezelfde 2-3 titels die eindeloos vastgepind blijven; de chronologische pools (recentlyAdded, upcoming, recentActivity) blijven ongewijzigd.

## v1.13.64 — Augustus 2026

### De servercrash bij ffmpeg-remux kwam nog steeds terug — v1.13.62 verhielp de verkeerde listener

- **Grondoorzaak live bevestigd** (Ace Ventura in Afrika 500751, crash meerdere keren achter elkaar gereproduceerd na de uitrol van v1.13.62): de vorige oplossing voegde een `'error'`-handler toe aan de ffmpeg-stream, maar `Readable.toWeb()` registreert ALTIJD zijn eigen interne handler daarbovenop — de onze verhinderde niet dat die alsnog werd uitgevoerd. Het echte scenario: wanneer de client (de videospeler) de weergave als eerste afbreekt, is diens eigen webstream al vernietigd — de code signaleerde daarna toch nogmaals een fout op diezelfde, al dode stream, en de interne adapter van Node crashte bij de poging om een reeds gesloten stream te sluiten (`uncaughtException: Controller is already closed`), waardoor de hele server in een algemene 503 viel, precies zoals voorheen.
- **Opgelost**: de stream wordt niet langer opnieuw als fout gemeld als hij al vernietigd is — precies het geval dat zich voordoet bij elke clientafbreking tijdens een ffmpeg-fout.

### De stiltebewaking onderbrak de ffmpeg-weergave ~6 seconden na de start, bij een stream die normaal afspeelde

- **Grondoorzaak live bevestigd** (Ace Ventura in Afrika 500751): de servertijdstempels toonden een crash bijna precies 6 seconden na elke `[remux] start` — het standaardvenster van de stiltebewaking, uit voorzorg geactiveerd op het ffmpeg-pad. In tegenstelling tot de MSE-engine (waar de browser een codec moet decoderen waarvan de ondersteuning alleen getest, nooit gegarandeerd is), is ffmpeg-audio ofwel een bit-exacte kopie van een reeds whitelisted decodeerbare track, ofwel getranscodeerd naar AAC — geen onzekerheid om te dekken. De bewaking werd dus onterecht geactiveerd, vernietigde de engine en verbrak de verbinding, wat op zijn beurt de bovenstaande servercrash veroorzaakte.
- **Opgelost**: de stiltebewaking wordt niet langer geactiveerd op het ffmpeg-pad.

## v1.13.63 — Augustus 2026

### Een serie met slechts één "binnenkort"-aflevering werd als ontbrekend weergegeven — de seriekaart negeerde de status "upcoming"

- **Grondoorzaak bevestigd**: `LibrarySeriesCard` berekende de volledigheid van een serie met `available === monitored.length`, waarbij nog niet uitgezonden afleveringen ("binnenkort") werden meegeteld alsof ze al beschikbaar hadden moeten zijn — een volledig gedownloade serie met slechts één nog niet uitgezonden aflevering viel daardoor terug op het amberkleurige badge "ontbreekt", terwijl `SeasonAccordion`, `TitleContent` en de Bibliotheekpagina "beschikbaar OF binnenkort" al correct als compleet behandelen.
- **Opgelost**: de seriekaart past nu dezelfde regel toe als elders in de app.

### "Zoeken en vervangen" stelde voor een bestand te vervangen door een bijna identiek bestand wanneer de huidige taal onbekend was

- **Grondoorzaak live bevestigd**: wanneer de taal van het bezeten bestand niet bekend is (niet gedetecteerd), werd elke gecachte release in de doeltaal (VF) voorgesteld als "verbetering", zonder ooit te controleren of dit daadwerkelijk iets opleverde — dezelfde resolutie, dezelfde codec (x264≈H.264, x265≈HEVC anders weergegeven maar identiek) en een bijna identieke bestandsgrootte leidden toch tot een vervangingsvoorstel. De bestaande vangrail (`isMeaningfulUpgrade`, groottemarge ≥ 10%) werd voor dit specifieke geval expliciet omzeild; aan seriezijde bestond deze vangrail eenvoudigweg niet.
- **Opgelost**: op taal gebaseerde voorstellen vereisen nu dezelfde minimale groottemarge (10%) als andere soorten verbeteringen, zowel voor films als afleveringen — echte resolutie-/codecsuggesties blijven ongewijzigd.

## v1.13.62 — Augustus 2026

### FFmpeg-remux: een mislukte ffmpeg tijdens een clientafbreking liet de hele server crashen — niet langer alleen de lopende weergave

- **Grondoorzaak live bevestigd** (Ace Ventura in Afrika 500751, twee keer dezelfde nacht): wanneer ffmpeg met een fout afsloot (`exit anormal code=255`, vaak veroorzaakt door een client die de verbinding verbreekt), forceerde de code een fout op de onderliggende Node-stream om dit aan HTTP-zijde te signaleren — maar deze stream had geen enkele foutafhandelaar gekoppeld. Node gooit de fout dan opnieuw als niet-afgevangen uitzondering (`uncaughtException: Controller is already closed`), wat het hele serverproces liet crashen: geen enkele route reageerde nog (algemene 503, ook op pagina's die niets met afspelen te maken hadden), tot aan de handmatige herstart van de container.
- **Opgelost**: foutafhandelaar gekoppeld aan de ffmpeg-stream vóór het pipen ervan — de fout wordt nu correct gemeld aan de videospeler, zonder ooit nog door te schieten naar een servercrash.

## v1.13.61 — Augustus 2026

### FFmpeg-remux: de MP4-muxer faalde stilzwijgend op AC-3-audio — `delay_moov`

- **Grondoorzaak live bevestigd** (Ace Ventura in Afrika 500751): `-movflags empty_moov` kan de MP4-header niet schrijven voordat er minstens één audiopakket is gezien wanneer het spoor als AC-3 wordt gekopieerd (framegrootte vooraf onbekend) — ffmpeg faalde met `Cannot write moov atom before AC3 packets`, direct nadat `ftyp`+`moov` (enkele KB) waren geschreven. Aan clientzijde was dit zichtbaar als geen enkele HTTP-fout: gewoon een abnormaal korte stream die netjes eindigt, een stille valkuil.
- **Opgelost**: de vlag `delay_moov` toegevoegd (`frag_keyframe+empty_moov+delay_moov+default_base_moof+omit_tfhd_offset`). Live getest tegen het echte bestand: video+audio kopiëren op 4-11× realtime snelheid (tegenover 0,1-0,9× bij Plex-transcodering).

## v1.13.60 — Augustus 2026

### Nieuwe afspeelengine: lokale ffmpeg-remux — omzeilt definitief de weigering van Plex om de HEVC-bitstream te kopiëren

- **Grondoorzaak definitief bevestigd en gesloten**: 12+ directe verzoeken tegen de Plex-API (`/video/:/transcode/universal/decision`), met variatie in bitrate, doelcodec, clientprofiel, protocol, audiospoor, ondertitels — allemaal leveren exact hetzelfde resultaat op: geforceerde H.264-hercodering, ongeacht de verzonden parameter. Serverinstellingen (externe bandbreedtelimiet, LAN-netwerken) ook gecontroleerd: geen enkele verklaart de weigering. Het is een interne, ongedocumenteerde heuristiek van Plex Media Server, van buitenaf niet te beïnvloeden — geen verdere poging tot correctie aan de clientparameterkant op dit punt.
- **Nieuw**: in plaats van Plex te laten beslissen, kan Movviz nu het ruwe bronbestand rechtstreeks bij Plex ophalen (`/library/parts/{id}/file`, waarbij `/video/:/transcode/universal` volledig wordt omzeild) en het zelf remuxen met een lokale ffmpeg (`-c:v copy` altijd, `-c:a copy` of `-c:a aac` afhankelijk van het spoor) — videokopie tegen nul CPU-kosten, audio gegarandeerd decodeerbaar door de browser, geen afhankelijkheid meer van de beslissing van Plex. Nieuwe engine `FfmpegRemuxEngine` ingevoegd in de fallbackketen van de bètaspeler tussen de bestaande MSE-engine (alleen progressieve MP4) en de Plex-transcodefallback — neemt het precies over waar de zelfgebouwde MP4-parser het opgeeft (met name MKV, het merendeel van de bibliotheek). Beschikbaarheid van het binary wordt serverzijdig gecontroleerd; stille en automatische terugval op het huidige gedrag als ffmpeg ontbreekt.
- **Opgelost**: een race condition in de MSE-engine verholpen (`resetBuffers` wachtte niet op het voltooien van lopende `SourceBuffer.remove()`-bewerkingen voordat nieuwe werden gestart, met risico op een `InvalidStateError` bij een seek).
- **Opgelost**: proactieve audiotranscode-beslissing vóór afspelen (geïnspireerd op het apparaatprofiel van Jellyfin) — voorkomt onnodige audiotranscodering wanneer de browser het gekopieerde spoor daadwerkelijk kan decoderen, terwijl de stiltebewaking als vangnet blijft voor gevallen waarin de detectie het mis heeft.

## v1.13.57 — Augustus 2026

### DASH: manifest zonder BaseURL — de initialisatiesegmenten wezen naar een niet-bestaande route, afspelen onmogelijk

- **Grondoorzaak bevestigd en opgelost**: live netwerkcapture op een echte "Transcodé (audio)"-sessie — het MPD-manifest dat Plex voor dit account teruggeeft heeft GEEN enkele `<BaseURL>`-tag; `initialization`/`media` van de `SegmentTemplate` zijn relatieve paden (`session/{id}/0/header`). `rewriteMpd()` herschreef alleen de `<BaseURL>`'s en absolute URL's, en liet relatieve paden ongemoeid in de veronderstelling dat ze worden opgelost tegen een reeds geproxyde `<BaseURL>` — behalve dat die hier ontbreekt: de browser loste ze op tegen de URL van het manifest zelf (`/api/stream/{ratingKey}/transcode?...`), wat een niet-bestaande route opleverde → systematische 404 op ELK initialisatiesegment (video en audio), nog vóór de eerste mediabyte. DASH kon in geen enkele modus starten (auto, video, audio), ongeacht de broncodec.
- **Opgelost**: `rewriteMpd()` detecteert het ontbreken van een `<BaseURL>` en verankert dan de relatieve paden `initialization`/`media` op het echte universele Plex-transcodepad (`/api/stream/plex-proxy/video/:/transcode/universal/...`); het geval waarin Plex wel een `<BaseURL>` levert, blijft ongewijzigd.

## v1.13.54 — Augustus 2026

### De clientidentiteit moet consistent zijn — MDE leest ook de querystring

- **Opgelost**: de querystring van `start.m3u8` declareerde nog steeds `X-Plex-Product=Movviz` + `X-Plex-Device=Web`, terwijl de HTTP-headers "Plex Web" imiteerden — MDE leest de `X-Plex-*`-velden uit BEIDE bronnen, dus de "Movviz"-identiteit in de URL kon het via de headers gekoppelde "Plex Web"-profiel overschrijven en de HEVC-kopie opnieuw weigeren. De querystring draagt nu exact dezelfde Plex Web-identiteit als de headers (product, device Windows, version 4.100.0, model).

## v1.13.53 — Augustus 2026

### De echte oorzaak van de lag ligt bij Plex: de video wordt opnieuw gecodeerd in transcode-sessies — het clientprofiel declareert nu HEVC/AV1 om de kopie af te dwingen

- **Opgelost**: de Plex-logs leverden het bewijs — in een "alleen audio"-transcode-sessie (`ta=1`) produceert Plex segmenten van 2,4-2,8 MB om de ~22 seconden: geen leveringsprobleem, maar een hercoderingprobleem. MDE honoreert `videoCodec=copy` voor HEVC in direct-stream-sessies, maar **weigert dit binnen een transcode-sessie** zolang het gekoppelde clientprofiel HEVC niet declareert als transcode-doelcodec voor HLS. De transcode-route stuurt nu `X-Plex-Client-Profile-Extra: append-transcode-target-codec(type=videoProfile&context=streaming&videoCodec=hevc,av1,h264&audioCodec=aac,ac3,mp3&protocol=hls)` (officiële Plex-profiluitbreiding) naast de "Plex Web"-vermomming — MDE kan de HEVC/AV1-bitstreamkopie tijdens alleen-audio-transcodes dan honoreren.
- **Diagnostiek**: de antwoordtekst van `/decision` wordt nu volledig gelogd (ingekort tot 600 tekens, verborgen het de `transcodeDecisionText` op het hoogste niveau — de exacte reden van MDE), met de beslissingstekst in zijn eigen leesbare veld.

## v1.13.52 — Augustus 2026

### De waarheid zit in de stream zelf — het eerste TS-segment wordt gescand op zijn echte streamtypes

- **Nieuw**: aangezien Movviz-afspeelsessies niet verschijnen in het dashboard/de afspeelanalyse van Plex, en de HLS-master-playlist zijn `CODECS`-attribuut weglaat, snuift de transcode-route nu het daadwerkelijke MPEG-TS-segment na de sessiestart (fire-and-forget, nul latentie toegevoegd aan de afspeelstart): hij leest de PAT/PMT-tabellen en logt de werkelijk aan de browser geleverde streamtypes (`plex-segments`). 0x24 = HEVC als bitstream gekopieerd (copy gehonoreerd, ✓-log), 0x1b = H.264 (video ondanks `tv=0` opnieuw gecodeerd → warn + consolefout), 0x0f = AAC, 0x81 = AC3-kopie, 0x87 = E-AC3... De sonde behandelt de transcode-warmup met herhalingen en blijft altijd best-effort.
- **Opgelost**: de sonde logt ook `réel` voor direct-stream-sessies waar `videoDecision` niet van toepassing is.

## v1.13.51 — Augustus 2026

### De transcode-sondes zijn niet langer stom — elke uitkomst wordt gelogd

- **Opgelost**: de `/status/sessions`-sonde kon eindigen zonder één logregel achter te laten (sessie niet gevonden, HTTP-fout of netwerkfout werden allemaal stil overgeslagen) — onzichtbare diagnostiek is geen diagnostiek. Hij logt nu altijd een uitkomst: de echte codecs van de job wanneer gevonden, "gevonden zonder TranscodeSession" voor puur direct-stream-sessies, "niet gevonden" met de lijst van actieve sessies wanneer de job nog niet is verschenen, de HTTP-status bij fouten en de opgevangen foutmelding.
- **Gewijzigd**: wanneer Plex' `/decision` antwoordt met beslissingscode-velden in plaats van een `Media[]`-array, wordt nu de volledige response-body (600 tekens) gelogd in plaats van een fragment van 200 tekens, zodat een geweigerde beslissing zijn volledige structuur toont.

## v1.13.50 — Augustus 2026

### De lopende transcode-sessie wordt geïnspecteerd — de codecs die Plex ECHT produceert worden gelogd

- **Nieuw**: direct na de sessiestart bevraagt de transcode-route `/status/sessions` en logt de werkelijke output van de job (`plex-session`: video-/audiocodecs met hun werkelijke beslissingen, broncodec, outputresolutie en jobsnelheid). Dit sluit de cirkel voor het geval "alleen-audio transcode die toch hapert": de video-copy is nu bevestigd als gehonoreerd (remux-sessies zijn vloeiend), en als een sessie de video ondanks `tv=0` opnieuw codeert, worden een warn-item plus een consolefout gegenereerd. Twee pogingen met 400 ms tussenruimte, zodat de job tijd heeft om in de sessielijst te verschijnen.
- **Gewijzigd**: de sonde blokkeert de weergave nooit — hij is best-effort en stil bij fouten.

## v1.13.49 — Augustus 2026

### De MDE-beslissingsaanroep faalt niet langer stil — de HTTP-fouten worden gelogd

- **Opgelost**: de in 1.13.48 toegevoegde `/decision`-sonde slikte fouten stil in — bij een foutstatus of onverwachte body verscheen er niets in de logs, waardoor hij als diagnostiek onbruikbaar was. Hij logt nu bij fouten de HTTP-status en de response-body (plus de opgevangen foutmelding), zodat een weigerende Plex-server precies laat zien waarom.

## v1.13.48 — Augustus 2026

### De transcode-route vraagt Plex wat het van PLAN is — de MDE-beslissing wordt gelogd vóór de sessiestart

- **Nieuw**: vóór het starten van de sessie roept de transcode-route Plex' `/video/:/transcode/universal/decision`-endpoint aan met exact dezelfde parameters en logt het plan van de Media Decision Engine (`plex-decision`: `Decision=transcode/copy`, video-/audiocodecs, container). De HLS-master-playlist laat het `CODECS`-attribuut weg bij direct-stream-sessies, dus dit is de enige betrouwbare manier om te weten of de video daadwerkelijk als bitstream wordt gekopieerd of stil opnieuw wordt gecodeerd — het geval "alleen-audio transcode die toch hapert" toont nu zijn verdict (warn-item + consolebericht wanneer MDE `tv=0` negeert).
- **Opgelost**: `videoResolution` wordt door Plex als string gerapporteerd en is niet altijd numeriek ("4k", "8k", "uhd") — `Number("4k")` = NaN, waardoor de video-bitrate-limiet voor 4K-bronnen die transcoderen stil terugviel op de 1080p-standaard (8000). De resolutielabels worden nu genormaliseerd vóór de bitrate-keuze.

## v1.13.47 — Augustus 2026

### HEVC-bitstream-copy wordt door Plex nu daadwerkelijk gehonoreerd — de player declareert het Plex Web-clientprofiel voor transcode-sessies

- **Opgelost**: Plex' Media Decision Engine kiest het clientprofiel op basis van de `X-Plex-*`-headers en weigert video-bitstream-copy (`videoCodec=copy`) voor codecs die het gematche profiel niet declareert. De player meldde zich aan als onbekend product ("Movviz"), wiens standaardprofiel geen HEVC kent — HEVC/H.265-bronnen (4K/1080p-remuxes, 10-bit HDR) werden daarom stil omgecodeerd naar H.264, zelfs wanneer de modus "alleen audio transcoderen" om een video-copy vroeg: die volledige video-transcode met bitrate-limiet was het haperen. Het transcode-startverzoek declareert nu het ingebouwde profiel "Plex Web" (HEVC over HLS ondersteund), waardoor MDE de copy honoreert: de HEVC-video wordt als bitstream gekopieerd en alleen de audio wordt opnieuw gecodeerd — de goedkope bewerking die het had moeten zijn. De apparaatnaam blijft "Movviz" en de sessietoewijzing (`X-Plex-Session-Identifier`) blijft ongewijzigd.
- **Gewijzigd**: de imitatie is beperkt tot alleen het transcode-startverzoek — daar valt de sessiebeslissing; metadata, segmentophaling en playback-/stop-routes behouden hun normale headers.

## v1.13.46 — Augustus 2026

### Transcode-logs onthullen wat Plex ECHT doet — de stille volledige re-encode is niet langer onzichtbaar

- **Nieuw**: de transcode-route leest nu het `CODECS=`-attribuut uit de master-playlist die Plex retourneert en vergelijkt het met wat is gevraagd. Wanneer bitstream-copy (`tv=0`) is aangevraagd maar Plex de video toch opnieuw codeert (HEVC/AV1 10-bit- of HDR-bronnen die Plex weigert naar HLS-TS te kopiëren, of PGS/ASS-ondertitels die in het beeld zijn gebrand), wordt een `plex-copy-refused`-waarschuwing met de oorzaak geschreven naar de logs onder Instellingen → Diagnostiek en afgedrukt in de console — precies het geval "alleen-audio transcode die toch hapert".
- **Gewijzigd**: de logitems bevatten nu de werkelijk door Plex geproduceerde codecs (`plex-codecs`), het paneel kleurt waarschuwingen amber (vs groen/rood), en de master-respons draagt de werkelijke codecs in de `x-movviz-plex-codecs`-header.

## v1.13.45 — Augustus 2026

### De optie "alleen audio transcoderen" encodeerde eigenlijk de video opnieuw — de twee modi waren omgedraaid

- **Opgelost, live bevestigd**: in het transcode-menu van de bètaplayer waren "Getranscodeerd (audio)" en "Getranscodeerd (video)" verwisseld. Kiezen voor "Getranscodeerd (audio)" stuurde `tv=1&ta=0` naar Plex — de video werd opnieuw gecodeerd naar H.264 (het dure, lag-veroorzakende deel, met bitrate-limiet) terwijl de audiotrack ongemoeid werd gekopieerd; "Getranscodeerd (video)" deed het tegenovergestelde. Het selecteren van alleen audio stuurt nu `tv=0&ta=1`: de video wordt als bitstream gekopieerd en alleen de audio wordt opnieuw gecodeerd naar AAC — de goedkope, lag-arme bewerking die Plex zelf voor dezelfde instelling uitvoert.
- **Gewijzigd**: de fix dekt beide URL-bouwers (initiële start en herladen bij het wisselen van audio-/ondertitelsporen), zodat de gekozen modus altijd overeenkomt met wat Plex daadwerkelijk doet.

## v1.13.44 — Augustus 2026

### Bèta-speler: een voorbijgaande fout op het eerste HLS-segment escaleerde niet meer meteen naar echte hercodering, en de knop "Directe test" deed niets meer

- **Opgelost**: een voorbijgaande mislukking op het allereerste HLS-segment (een korte `503` tijdens het opstarten van de hercodering aan Plex-zijde, bevestigd zelfs op de Plex-client zelf) krijgt nu een echte nieuwe poging voordat de speler de verliesvrije audiokopie opgeeft en overschakelt naar echte hercodering — voorheen escaleerde dit al bij het allereerste hobbeltje.
- **Opgelost**: de handmatige knop "Directe test" deed niets wanneer directe weergave al de actieve engine was — hij wees het `<video>`-element exact dezelfde URL opnieuw toe die het al had, iets wat de browser terecht als no-op behandelt (geen herlaadactie, geen aanvraag). De knop dwingt nu telkens een echte herlaadactie af.

---

## v1.13.40 — Augustus 2026

### Bèta-speler: directe weergave kon een ruwe MKV serveren waarvan de browser de audiotrack nooit decodeerde

- **Opgelost**: live bevestigd — een ruwe MKV die ongewijzigd van Plex naar de browser werd doorgegeven, kon het beeld perfect afspelen terwijl `webkitAudioDecodedByteCount` de hele weergave lang op nul bleef staan, zonder enige foutmelding, gewoon stilte. Wanneer directe weergave overschakelt naar de HLS-terugval voor een track die hls.js daadwerkelijk kan demultiplexen vanuit MPEG-TS (AAC/MP3/AC-3), vraagt de speler nu een verliesvrije audiokopie aan — dezelfde herverpakking die de Plex-client zelf krijgt, zonder extra kosten voor de server — en controleert aan de hand van de daadwerkelijk gedecodeerde audio-energie, waarbij pas naar echte hercodering wordt overgeschakeld als die kopie echt stil blijft. De browser-codecondersteuningstest waarvan deze beslissing afhing, is verwijderd; die leverde valse negatieven op die onnodige hercoderingen afdwongen. E-AC-3/DTS/TrueHD gaan nog steeds direct naar echte transcodering — de MPEG-TS-demultiplexer van hls.js heeft simpelweg geen parser voor deze formaten, een echte beperking van de bibliotheek, geen aanname.
- **Opgelost**: Movviz stuurde de header `X-Plex-Session-Identifier` nooit mee bij enige Plex-aanvraag, in tegenstelling tot een echte Plex-client — toegevoegd op het volledige streaming-/transcoderingsaanvraagpad.

## v1.13.39 — Augustus 2026

### Een instelling toegevoegd om YouTube-zoeken voor trailers in te schakelen — standaard uitgeschakeld, wat verklaart waarom ze in het Engels bleven

- **Toegevoegd**: de terugval via YouTube-zoeken voor trailers (gebruikt wanneer TMDb er geen in jouw taal heeft) is paginascraping, geen officiële API — het is afhankelijk van YouTube dat het IP-adres van de server niet blokkeert, en al één stille mislukking blijft 24 uur in de cache staan. Daarom stond dit standaard uitgeschakeld. Deze standaardinstelling is de reden waarom trailers in het Engels bleven, terwijl het mechanisme bestaat en prima werkt zodra je het rechtstreeks test. Een nieuwe schakelaar bij Instellingen → Dashboard ("Trailers") maakt het mogelijk om dit in te schakelen — nog altijd standaard uit, maar voortaan een expliciete en zichtbare keuze in plaats van een stille.

## v1.13.38 — Augustus 2026

### De Dolby Digital+ wijziging van v1.13.35 teruggedraaid — die maakte de stilte erger, niet beter

- **Teruggedraaid**: AC-3/E-AC-3 uitsluiten van het anti-stilte vangnet ging ervan uit dat directe weergave op deze codecs altijd echt geluid had — live bevestigd dat dit niet op elke machine klopt. Chromium heeft geen eigen AC-3/E-AC-3-decoder ingebouwd; dat is afhankelijk van een decoder die op besturingssysteemniveau geregistreerd staat, en die ontbreekt op sommige Windows-installaties (dit verschilt per machine, niet per Movviz). Het vangnet weghalen betekende dat een machine zonder deze decoder in totale stilte belandde zonder enige terugval, in plaats van de automatische overschakeling naar een getranscodeerde (dus hoorbare) stream die er voorheen wel was. Het vangnet is exact zoals voorheen terug — een echte fix die een werkelijke decodeerfout onderscheidt van de blinde vlek van het vangnet bij deze codecs vergt meer zorgvuldigheid dan deze teruggedraaide poging had.

## v1.13.37 — Augustus 2026

### Titels die vastzaten op "zoeken" lieten de tegel "Bezig met downloaden" oplopen zonder dat daar iets voor uitlegde

- **Toegevoegd**: in plaats van elementen in "zoeken" gewoon niet meer als download mee te tellen (vorige versie), hebben ze nu hun eigen tegel "Zoeken" op het dashboard — dit getal verdwijnt niet, het verschijnt gewoon waar het daadwerkelijk thuishoort.

## v1.13.36 — Augustus 2026

### De tegel "Bezig met downloaden" van het dashboard kon een getal tonen terwijl er in werkelijkheid niets werd gedownload

- **Opgelost**: de tegel telde ook afleveringen/films met status "zoeken" (actief op zoek naar een release, zonder dat er al een torrent is opgehaald) mee alsof ze aan het downloaden waren. Live bevestigd: een heel seizoen dat vastzat op "zoeken" zonder enige actieve torrent liet de teller oplopen tot 9, terwijl er in werkelijkheid geen enkele download bezig was. De tegel telt nu alleen nog elementen met een daadwerkelijk actieve download.

### De afspeelknop van een titel kon volledig verdwijnen zonder uitleg

- **Opgelost**: de afspeelknop op een titelpagina was volledig afhankelijk van het feit of Plex het bestand al had gekoppeld — een bestand dat aan de kant van Movviz al klaar was, maar dat Plex nog niet had gescand in zijn eigen bibliotheek (een normale asynchrone vertraging), toonde helemaal geen knop in plaats van iets dat de wachttijd uitlegde. Er wordt nu een duidelijk uitgeschakelde placeholder met een tooltip getoond in plaats van dat de knop verdwijnt.

### Twee ongerelateerde knoppen op de titelpagina deelden exact hetzelfde icoon

- **Opgelost**: "versies beheren" en "bekijk de saga/collectie" gebruikten allebei hetzelfde stapelicoon, wat verwarrend was bij een titel die beide heeft. De link naar de collectie gebruikt nu een visueel duidelijk ander icoon.

## v1.13.35 — Augustus 2026

### Beta-speler: directe afspelen in Dolby Digital+ was het geluid kwijtgeraakt na een recente update

- **Opgelost**: het anti-stilte-vangnet (dat de daadwerkelijk gedecodeerde audio-energie gedurende enkele seconden aan het begin van het direct afspelen bewaakt, en overschakelt naar transcoderen als het stil blijft) vangt geluid op via een Web Audio-graaf die is aangesloten op het video-element — behalve dat AC-3/E-AC-3 (Dolby Digital/Digital+) buiten de render-engine om wordt gedecodeerd, waardoor deze graaf dat geluid domweg nooit kan waarnemen. Het vangnet werd daardoor systematisch ten onrechte geactiveerd voor deze twee codecs, wat een audio-transcodering afdwong terwijl het direct afspelen vanaf het begin wel degelijk geluid had. Een recente versie heeft de handmatige knop "opnieuw direct starten" samengevoegd met hetzelfde codepad als de eerste automatische poging, waardoor dit voorheen zeldzame randgeval systematisch werd. AC-3/E-AC-3-sporen zijn nu volledig uitgezonderd van dit vangnet — direct afspelen blijft direct, met echt geluid, precies zoals voorheen.

## v1.13.34 — Augustus 2026

### Dezelfde melding kon dagenlang blijven verschijnen voor inhoud die al beschikbaar was

- **Opgelost**: meldingen werden nooit gededupliceerd — een geplande taak die inhoud opnieuw scant die hij na import niet volledig kan opruimen, kon bij elke doorgang precies dezelfde "nu beschikbaar"-melding opnieuw laten afgaan, live bevestigd met een melding over een beschikbaar seizoen die elke ~30 minuten terugkwam voor een titel die al een week beschikbaar was. Dezelfde melding met dezelfde details wordt nu nog maar één keer per uurvenster geactiveerd; een echte herhaling later (bijvoorbeeld dagen erna) verloopt nog steeds gewoon normaal.

### De modus "Klassiek" van het dashboard is herbouwd om "Cinema" over te nemen, zonder de hero

- **Gewijzigd**: de modus Klassiek neemt nu alles over wat de modus Cinema biedt — de compacte statistiekpillen en de volledige rij-lay-out (Tendances, Aanbevelingen op maat, Recent toegevoegd, enz.) — alleen zonder de grote hero-banner bovenaan, naar aanleiding van feedback. Voorheen viel deze terug op een eenvoudig raster van statistiektegels en een platte lijst "recent toegevoegd" zonder enige van de rijen van Cinema.

## v1.13.33 — Augustus 2026

### Knop toegevoegd om voltooide downloads handmatig in seed te zetten

- **Toegevoegd**: een voltooide download in de wachtrij heeft nu een eigen knop om de seed te starten of te stoppen, los van de pauze/hervat-knoppen die voorbehouden zijn aan actieve downloads. Uitschakelen stopt daadwerkelijk de uploadactiviteit, niet slechts een weergegeven status — bij de standaardengine koppelt dit de torrent volledig los van de peers; opnieuw inschakelen herstelt dit, en bouwt zo nodig de oorspronkelijke bestandsstructuur weer op als de bestanden al naar de bibliotheek zijn verplaatst, zonder ooit de kopie in de bibliotheek aan te raken of opnieuw te downloaden.

### Titels van posterrijen stonden niet gecentreerd onder de kaarten

- **Gewijzigd**: de titel onder elke poster in de rijen van het dashboard (Tendances, Suggesties, Recent toegevoegd) staat nu gecentreerd onder de poster, naar aanleiding van feedback — voorheen kon deze verschoven staan, vooral in de als Top 10 gerangschikte rij.

## v1.13.32 — Augustus 2026

### Downloads toonden nooit een resterende tijd

- **Opgelost**: het veld "resterende tijd" van de wachtrij werd maar door twee van de drie downloadengines berekend — de standaardengine (degene die in de praktijk daadwerkelijk dagelijks wordt gebruikt) gaf nooit een `timeRemaining`-waarde door, waardoor het veld in de wachtrij altijd leeg bleef. Het wordt nu op dezelfde manier berekend als de andere engines dat al doen (resterende bytes gedeeld door de huidige snelheid), zodat een lopende download nu een echte schatting toont.

## v1.13.31 — Augustus 2026

### Een geldig bestandspad kon stilzwijgend worden overschreven door Plex' kijk op het bestandssysteem

- **Opgelost**: bij elke Plex-synchronisatie kon een al correct en werkend bestandspad voor een film of aflevering worden overschreven door het pad zoals Plex dat zelf rapporteert. Wanneer Plex en Movviz in aparte containers draaien met verschillende koppelpunten voor dezelfde fysieke bestanden, bestaat het door Plex gerapporteerde pad niet vanuit het bestandssysteem van Movviz gezien — een prima werkend pad ging zo stilzwijgend stuk, waardoor "Paden herstellen" overspoeld raakte met valse positieven voor titels die eigenlijk nooit een probleem hadden. Movviz leert nu automatisch de koppeling tussen hoe Plex paden ziet en hoe het dat zelf doet — door voor een titel die al correct wordt gevolgd, het eigen geverifieerd werkende pad te vergelijken met wat Plex voor precies diezelfde titel rapporteert — en vertaalt toekomstige Plex-rapportages via deze aangeleerde koppeling in plaats van ze blindelings te vertrouwen. Geen instellingenscherm, geen handmatige configuratie: Movviz leidt de koppeling zelf af uit gegevens die het al met zekerheid kent. Een pad wordt alleen weggeschreven als vooraf is geverifieerd dat het daadwerkelijk op de schijf bestaat — een verkeerde of verouderde koppeling kan in het ergste geval een vals "ontbrekend"-signaal opleveren (handmatig te herstellen), maar nooit een stil verlies van de verwijzing naar een echt bestand.

## v1.13.30 — Augustus 2026

### "Paden herstellen" kon honderden totaal ongerelateerde bestanden als kandidaten voorstellen

- **Opgelost**: wanneer een kapot afleveringsbestand niet werd gevonden op basis van zijn exact geregistreerde bestandsnaam, vergeleek het laatste-redmiddel-terugvalmechanisme het met ALLE videobestanden in de hele bibliotheek die hetzelfde seizoen/afleveringsnummer deelden — ongeacht bij welke serie ze eigenlijk hoorden. Live bevestigd: één kapotte aflevering kon terugkomen met 500+ "kandidaten" die eigenlijk gewoon aflevering 1, aflevering 2, enz. van elke andere serie waren. Dit terugvalmechanisme biedt nu alleen nog bestanden aan die aannemelijk bij de echte serie horen (op bestandsnaam of mapnaam), waardoor de suggestielijst weer kort en relevant is. Aanwezig sinds v1.12.86 — geen wijziging uit deze recente reeks fixes, en geen ander matchpad (exacte bestandsnaam, verwacht pad, of de duplicaatwaarschuwing) is aangeraakt.

### Top-10-cijfers in de Tendances-rij overlapten te veel van de poster

- **Gewijzigd**: het rangcijfer achter elke Top-10-kaart in de "Tendances"-rij zat te ver onder de poster verstopt, waardoor links nog maar een dun streepje zichtbaar bleef. Het overlapt nu veel minder — het grootste deel van het cijfer is links zichtbaar, met alleen de achterrand weggestopt, naar aanleiding van feedback.
- **Gewijzigd**: de "Tendances"-rij staat nu bovenaan het dashboard, boven "Recent toegevoegd", naar aanleiding van feedback.

### "Ontbrekende downloaden" op een collectie kon de verkeerde titel ophalen in plaats van de echt ontbrekende

- **Opgelost**: twee bugs die elkaar versterkten, allebei live bevestigd op meerdere collecties. Ten eerste berekende de knop de ontbrekende titels op basis van een gedeelde, app-brede gecachte momentopname van bibliotheek/collectie, die verouderd kon zijn zonder dat er iets zichtbaar mis was op het scherm — de bibliotheek en de onderdelenlijst van de collectie worden nu allebei vers geverifieerd vlak voor het downloaden. Ten tweede, en dit woog het zwaarst: een dubbele-detectiecontrole die bedoeld was om te herkennen wanneer TMDb dezelfde al-uitgebrachte film onder twee verschillende id's vermeldt, gebruikte een vage titelmatch zonder een echte jaarvereiste — hij kon stilzwijgend een al-bezeten, ongerelateerde vermelding hergebruiken voor een onbevestigde, voorlopige franchise-plaatshouder, of een echte film verwarren met een featurette uit dezelfde franchise die een jaar verschoven was en een extra titelsuffix had. Deze controle vereist nu aan beide kanten een exact overeenkomende, genormaliseerde titel ÉN een exact overeenkomend, bevestigd releasejaar voordat een match wordt vertrouwd.

### Vriendenaccounts kregen allemaal de kijkgeschiedenis van de servereigenaar

- **Opgelost**: elk gekoppeld vriendenaccount had wel degelijk een echte, eigen, onderscheiden Plex-identiteit en token — toch synchroniseerden ze allemaal exact dezelfde cijfers als het account dat de server bezit. Grondoorzaak bevestigd aan de hand van het gedocumenteerde gedrag van Plex zelf: de endpoints die worden gebruikt om de kijkstatus te synchroniseren, geven de `viewCount` terug vanuit het perspectief van de servereigenaar alleen, ongeacht welk geldig account-token de aanvraag doet — geen enkele request-header kan dat veranderen. De kijkstatussynchronisatie gebruikt nu het sessiegeschiedenis-endpoint van Plex, bevraagd met het admin-token en gefilterd op het eigen Plex-id van elk account — de manier waarop Plex kijkgedrag daadwerkelijk per account bijhoudt — en werkt nu hetzelfde voor vriendenaccounts en Home-beheerde profielen, in plaats van twee gescheiden paden.

## v1.13.22 — Augustus 2026

### "Voor jou" is weer strikt persoonlijk, en een mislukte Plex-synchronisatie ziet er niet langer uit als "niets bekeken"

- **Gewijzigd**: terugdraaien van de "huishouden"-vermenging uit v1.13.21 — na meer feedback wordt "Voor jou" weer UITSLUITEND opgebouwd uit de eigen Plex-kijkgeschiedenis van het account, zonder enig signaal van andere accounts, hoe klein ook. Een account met slechts een paar bekeken titels krijgt nu een gepersonaliseerde rij op basis van alleen die titels, in plaats van dat er eerst een minimum moet worden gehaald voordat er iets verschijnt.
- **Opgelost**: de Plex-kijkstatussynchronisatie slikte stilletjes elke fout in (netwerkstoring, verlopen token, onbereikbare sectie) en sloeg toch een leeg resultaat op — niet te onderscheiden van "dit account heeft echt niets bekeken", en in staat om bij een tijdelijke storing ongemerkt een echte kijkgeschiedenis te wissen. Bestaande gegevens blijven nu ongewijzigd wanneer een synchronisatie geen enkele sectie kan bereiken, en elke synchronisatiepoging — geslaagd of mislukt, en voor welk account — wordt gelogd in Instellingen → Logs, zodat een stilletjes falend account eindelijk zichtbaar is in plaats van gewoon leeg te lijken.

## v1.13.21 — Augustus 2026

### "Voor jou" kan nu putten uit de Plex-geschiedenis van het hele huishouden, niet alleen die van jou

- **Nieuw**: wanneer de eigen Plex-kijkgeschiedenis van een account dun of leeg is, mengt de rij "Voor jou" nu ook wat andere accounts op dezelfde instantie hebben bekeken (met een lagere weging dan de eigen geschiedenis van het account) — zodat iemand zonder eigen Plex-koppeling toch een echte, gepersonaliseerde rij krijgt in plaats van de standaard generieke "best beoordeeld"-terugval. Dit treedt pas in werking zodra minstens twee andere accounts over echte kijkdata beschikken — de smaak van één ander account wordt nooit gebruikt als vervangend "huishouden"-signaal, om te voorkomen dat de keuzes van één persoon stilzwijgend op iemand anders worden gekloond. De eigen rij van elk account blijft precies zo persoonlijk als voorheen; dit voegt alleen een breder signaal toe, en vervangt nooit de eigen geschiedenis van het account wanneer die er al is.

## v1.13.20 — Augustus 2026

### Afleveringstitels en -beschrijvingen kwamen altijd in het Frans terug, ongeacht de taal van de interface

- **Opgelost**: de seizoen-/afleveringsdata-aanroep (miniaturen, titels, beschrijvingen — toegevoegd in v1.13.12, uitgebreid naar bezeten series in v1.13.19) liet TMDb nooit weten in welke taal er geantwoord moest worden, dus viel die stilzwijgend terug op het Frans voor iedereen, zelfs met Nederlands (of een andere taal) geselecteerd als interfacetaal. Dit was exact dezelfde bug die al eerder was opgelost voor de detailpagina's — alleen nooit toegepast op deze specifieke aanroep. Het volgt nu de in de app gekozen taal, zoals overal elders.

## v1.13.19 — Augustus 2026

### Afleveringsminiaturen en -beschrijvingen nu overal zichtbaar, niet alleen voor series die je nog niet bezit

- **Opgelost**: v1.13.12 voegde een miniatuur en korte beschrijving toe aan elke afleveringsrij, maar alleen voor series die nog niet in je bibliotheek stonden — afleveringen van series die je al bezat, werden getoond als gewone tekstregels zonder enige voorvertoning. Beide weergaven putten nu uit dezelfde live TMDb-gegevens, zodat een gedownloade/beschikbare aflevering exact dezelfde voorvertoning toont als een aflevering die je nog niet hebt opgehaald — zonder dat bestaande kwaliteitsbadges, de "bekeken"-markering, statuspil of zoekknoppen verdwijnen.
- **Opgelost**: de uitzenddatums in diezelfde lijst werden weergegeven volgens de locale-indeling van je browser, ongeacht de in Movviz gekozen taal (bijvoorbeeld de Amerikaanse maand/dag-volgorde, zelfs met Nederlands geselecteerd) — ze volgen nu consequent de taal van de app, zoals alle andere datums in Movviz.

## v1.13.18 — Augustus 2026

### Het hervatten van een gedeeltelijk geïmporteerd seizoenspack kon proberen om het overgebleven .nfo-bestand als afleveringsbestand te hernoemen

- **Opgelost**: zodra alle echte videobestanden van een seizoenspack in een eerdere gedeeltelijke run al waren gematcht en verplaatst, vond een nieuwe poging geen videobestanden meer en viel dan terug op het eerste overgebleven bestand — inclusief de `.nfo` van de release — door dat te behandelen als "de te importeren aflevering", te proberen het te hernoemen naar iets als `S03E02.nfo` en volledig te falen zodra dat niet overeenkwam met wat er daadwerkelijk op schijf stond. Overgebleven `.nfo`/`.txt`/afbeeldings-/checksumbestanden zijn nooit afleveringscontent en worden al automatisch opgeruimd zodra de import is voltooid — ze worden nu volledig uitgesloten van deze matching in plaats van een mislukte, voor de gebruiker zichtbare importfout te veroorzaken.

## v1.13.17 — Augustus 2026

### De aangekondigde vertragingslogs zijn nu echt zichtbaar in Instellingen → Logs

- **Opgelost**: het zoekdiagnoselog kon zijn buffer van 2000 regels in een paar minuten vullen tijdens zware achtergrondruns (elke afleveringzoekopdracht schrijft ~10 regels, waarvan meerdere als debug), waardoor belangrijke info-regels stilletjes werden weggeduwd — inclusief de nieuwe regels over achtergrondvertragingen. De buffer bevat nu 4000 regels, dus `priority.yield`-items overleven de ruis.
- **Nieuw**: het logpaneel in Instellingen → Logs ververst nu live — elke 5 seconden zolang de tab zichtbaar is; regels van achtergrondwerk verschijnen dus meteen in plaats van pas na handmatig verversen. Geen re-render als er niets is veranderd.
- **Opgelost**: alle logbronnen staan nu op één plek — het transcode-logpaneel is verplaatst van de tab Diagnostiek naar Instellingen → Logs, dat nu zoek-/diagnose-, engine-, resolver- en transcode-logs samen toont.
- **Gewijzigd**: regels over achtergrondvertragingen hebben nu een eigen kleur in het paneel, zodat "Arrière-plan bridé [bulk manquants]…"-items in één oogopslag opvallen.

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
