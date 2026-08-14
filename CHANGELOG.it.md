# Changelog

Tutte le modifiche rilevanti a Movviz, raggruppate per tappa di sviluppo.

---

## v1.13.67 — Agosto 2026

### Remux FFmpeg: cliccare più avanti nella barra di avanzamento riportava all'inizio

- **Causa radice confermata in diretta**: la barra di avanzamento e i pulsanti ±10s impostavano direttamente `video.currentTime` — funziona per una sorgente nativamente seekable, ma il flusso ffmpeg in pipe non ha un intervallo seekable lato browser (MP4 frammentato senza indice); impostare `.currentTime` su di esso non produce alcun effetto utile e il lettore torna all'inizio.
- **Corretto**: per la leg ffmpeg, il clic sulla barra di avanzamento e i pulsanti ±10s passano ora attraverso il motore (`FfmpegRemuxEngine.seek()`), che riavvia la sessione ffmpeg con un `-ss` lato server nel punto corretto — gli altri motori non sono interessati.

## v1.13.66 — Agosto 2026

### Remux FFmpeg: la durata visualizzata restava bloccata a 0:02 nonostante la riproduzione fosse corretta

- **Causa radice confermata in diretta**: il `<video>` nativo legge un MP4 frammentato con `empty_moov` — la durata totale non è mai nota in anticipo per costruzione (non è un vero flusso live, solo un contenitore che non la espone), quindi `.duration` restava bloccata sulla piccolissima porzione già ricevuta al caricamento invece di riflettere la durata reale del film.
- **Corretto**: la durata reale (già nota lato server tramite i metadati Plex) viene ora restituita da `/api/stream/[ratingKey]/info` ed è preferita a `.duration` specificamente per la leg ffmpeg — gli altri motori non sono interessati.

## v1.13.65 — Agosto 2026

### Remux FFmpeg: l'audio AC-3 copiato non era decodificabile dal browser — riproduzione muta

- **Causa radice confermata**: la whitelist di copia audio del remux includeva `ac3`/`ac-3` (rispecchiando quella del transcode Plex) — ma il contesto è diverso: lato transcode Plex, l'AC-3 copiato viene transmuxato da hls.js in fMP4 per MSE (decodificato da Chrome con il pacchetto Dolby); lato remux, il flusso viene letto dal decodificatore NATIVO del `<video>` in MP4 progressivo, e Chrome/Edge non decodificano l'AC-3 in questo contesto → immagine perfetta, zero audio, senza alcun errore HTTP.
- **Corretto**: la whitelist di copia audio del remux è ora limitata ai codec universalmente decodificabili (`aac`/`mp4a`/`mp3`) — tutto il resto (AC-3, EC-3, DTS, TrueHD…) viene transcodificato in AAC 192 kbit/s, la garanzia sonora del remux locale. La whitelist del transcode Plex resta invariata (il suo contesto la giustifica).
- **Corretto**: race condition in `FfmpegRemuxEngine.seek()` — il DELETE della vecchia sessione partiva in fire-and-forget; se il GET della nuova sessione arrivava al server per primo, `stopAllForRatingKey` uccideva la sessione appena creata e il seek ricadeva su HLS. Il DELETE viene ora atteso prima del caricamento.

### L'Hero mostrava sempre gli stessi titoli in evidenza

- **Corretto**: i pool senza un ordine naturale (suggerimenti personalizzati, scoperta, mai visti) vengono ora mescolati con un seed deterministico per giorno e per utente — rotazione ogni 24 ore invece degli stessi 2-3 titoli fissati indefinitamente; i pool cronologici (recentlyAdded, upcoming, recentActivity) non sono interessati.

## v1.13.64 — Agosto 2026

### Il crash del server durante il remux ffmpeg si ripresentava ancora — la v1.13.62 aveva corretto il listener sbagliato

- **Causa radice confermata in diretta** (Ace Ventura in Africa 500751, crash riprodotto più volte di seguito dopo il deployment della v1.13.62): il correttivo precedente aggiungeva un gestore `'error'` sul flusso ffmpeg, ma `Readable.toWeb()` registra SEMPRE il proprio gestore interno in aggiunta — il nostro non ne impediva l'esecuzione. Lo scenario reale: quando il client (il lettore video) abbandona per primo la riproduzione, il suo flusso web è già distrutto — il codice segnalava comunque un'altra volta un errore su quello stesso flusso già morto, e l'adattatore interno di Node andava in crash tentando di chiudere un flusso già chiuso (`uncaughtException: Controller is already closed`), facendo cadere l'intero server in un 503 generalizzato, esattamente come prima.
- **Corretto**: il flusso non viene più rimarcato come errato se è già distrutto — proprio il caso che si verifica ad ogni abbandono del client durante un fallimento ffmpeg.

### La veglia del silenzio interrompeva la riproduzione ffmpeg ~6 secondi dopo l'avvio, su un flusso che riproduceva normalmente

- **Causa radice confermata in diretta** (Ace Ventura in Africa 500751): gli orari del server mostravano un crash quasi esattamente 6 secondi dopo ogni `[remux] start` — la finestra predefinita della veglia del silenzio, armata sul percorso ffmpeg per precauzione. A differenza del motore MSE (dove il browser deve decodificare un codec il cui supporto è solo sondato, mai garantito), l'audio ffmpeg è o una copia bit-esatta di una traccia già whitelisted decodificabile, o transcodificato in AAC — nessuna incertezza da coprire. La veglia si attivava quindi erroneamente, distruggeva il motore e interrompeva la connessione, innescando a sua volta il crash del server descritto sopra.
- **Corretto**: la veglia del silenzio non è più armata sul percorso ffmpeg.

## v1.13.63 — Agosto 2026

### Una serie con un solo episodio "in arrivo" veniva mostrata come mancante — la card della serie ignorava lo stato "upcoming"

- **Causa radice confermata**: `LibrarySeriesCard` calcolava la completezza di una serie con `available === monitored.length`, contando gli episodi non ancora trasmessi ("in arrivo") come se dovessero già essere disponibili — una serie interamente scaricata con un solo episodio non ancora trasmesso ricadeva quindi sul badge ambra "mancante", mentre `SeasonAccordion`, `TitleContent` e la pagina Libreria trattano già correttamente "disponibile OPPURE in arrivo" come completo.
- **Corretto**: la card della serie applica ora la stessa regola usata ovunque altrove nell'app.

### "Cerca e sostituisci" proponeva di sostituire un file con un file quasi identico quando la lingua attuale era sconosciuta

- **Causa radice confermata in diretta**: quando la lingua del file posseduto non è nota (non rilevata), qualsiasi release in cache nella lingua target (VF) veniva proposta come "miglioramento", senza mai verificare se apportasse davvero qualcosa — la stessa risoluzione, lo stesso codec (x264≈H.264, x265≈HEVC mostrati in modo diverso ma identici) e una dimensione quasi identica attivavano comunque una proposta di sostituzione. La protezione esistente (`isMeaningfulUpgrade`, scarto di dimensione ≥ 10%) veniva esplicitamente aggirata per questo caso specifico; lato serie, questa protezione semplicemente non esisteva.
- **Corretto**: le proposte basate sulla lingua richiedono ora lo stesso scarto di dimensione minimo (10%) degli altri tipi di miglioramento, sia lato film che lato episodi — i suggerimenti di risoluzione/codec reali non sono interessati.

## v1.13.62 — Agosto 2026

### Remux FFmpeg: un ffmpeg fallito durante un abbandono del client faceva crashare l'intero server — non più solo la riproduzione in corso

- **Causa radice confermata in diretta** (Ace Ventura in Africa 500751, due occorrenze nella stessa notte): quando ffmpeg usciva in errore (`exit anormal code=255`, spesso provocato da un client che interrompe la connessione), il codice forzava un errore sul flusso Node sottostante per segnalarlo lato HTTP — ma questo flusso non aveva alcun gestore di errore collegato. Node rilancia quindi l'errore come eccezione non catturata (`uncaughtException: Controller is already closed`), che ha fatto crashare l'intero processo server: nessuna rotta rispondeva più (503 generalizzato, anche su pagine non correlate alla riproduzione), fino al riavvio manuale del container.
- **Corretto**: gestore di errore collegato al flusso ffmpeg prima della sua messa in pipe — l'errore resta correttamente segnalato al lettore video, senza più risalire in crash del server.

## v1.13.61 — Agosto 2026

### Remux FFmpeg: il muxer MP4 falliva silenziosamente sull'audio AC-3 — `delay_moov`

- **Causa radice confermata in diretta** (Ace Ventura in Africa 500751): `-movflags empty_moov` non può scrivere l'header MP4 prima di aver visto almeno un pacchetto audio quando la traccia viene copiata in AC-3 (dimensione del frame sconosciuta in anticipo) — ffmpeg falliva con `Cannot write moov atom before AC3 packets`, subito dopo aver scritto `ftyp`+`moov` (pochi KB). Lato client, questo non era visibile come alcun errore HTTP: solo un flusso anormalmente corto che termina in modo pulito, una trappola silenziosa.
- **Corretto**: aggiunto il flag `delay_moov` (`frag_keyframe+empty_moov+delay_moov+default_base_moof+omit_tfhd_offset`). Testato in diretta contro il file reale: copia video+audio a 4-11× la velocità in tempo reale (contro 0,1-0,9× lato transcodifica Plex).

## v1.13.60 — Agosto 2026

### Nuovo motore di riproduzione: remux ffmpeg locale — aggira definitivamente il rifiuto di Plex di copiare il bitstream HEVC

- **Causa radice confermata e definitivamente chiusa**: 12+ richieste dirette contro l'API Plex (`/video/:/transcode/universal/decision`), variando bitrate, codec target, profilo client, protocollo, traccia audio, sottotitoli — tutte restituiscono esattamente lo stesso risultato: rieencodifica H.264 forzata, indipendentemente dal parametro inviato. Verificate anche le impostazioni server (limite di banda remoto, reti LAN): nessuna spiega il rifiuto. È un'euristica interna a Plex Media Server, non documentata e non influenzabile dall'esterno — nessun ulteriore tentativo di correzione lato parametri client su questo punto.
- **Nuovo**: invece di chiedere a Plex di decidere, Movviz può ora recuperare il file sorgente grezzo direttamente da Plex (`/library/parts/{id}/file`, aggirando completamente `/video/:/transcode/universal`) e remuxarlo esso stesso con un ffmpeg locale (`-c:v copy` sempre, `-c:a copy` o `-c:a aac` a seconda della traccia) — copia video a costo CPU nullo, audio garantito decodificabile dal browser, zero dipendenza dalla decisione di Plex. Nuovo motore `FfmpegRemuxEngine` inserito nella catena di fallback del lettore beta tra il motore MSE esistente (solo MP4 progressivo) e il fallback transcodifica Plex — subentra esattamente dove il parser MP4 fatto in casa si arrende (MKV in particolare, la maggior parte della libreria). Disponibilità del binario verificata lato server; fallback silenzioso e automatico al comportamento attuale se ffmpeg è assente.
- **Corretto**: corretta una race condition nel motore MSE (`resetBuffers` non attendeva il completamento delle operazioni `SourceBuffer.remove()` in corso prima di avviarne di nuove, con rischio di `InvalidStateError` durante un seek).
- **Corretto**: decisione di transcodifica audio proattiva prima della riproduzione (ispirata al profilo dispositivo di Jellyfin) — evita una transcodifica audio inutile quando il browser può effettivamente decodificare la traccia copiata, mantenendo comunque la veglia di silenzio come rete di sicurezza per i casi in cui il rilevamento sbaglia.

## v1.13.57 — Agosto 2026

### DASH: manifest senza BaseURL — i segmenti di inizializzazione puntavano a una rotta inesistente, riproduzione impossibile

- **Causa radice confermata e corretta**: cattura di rete dal vivo su una vera sessione "Transcodé (audio)" — il manifest MPD restituito da Plex per questo account NON ha alcun tag `<BaseURL>`; `initialization`/`media` del `SegmentTemplate` sono percorsi relativi (`session/{id}/0/header`). `rewriteMpd()` riscriveva solo i `<BaseURL>` e gli URL assoluti, lasciando intatti i percorsi relativi presumendo che si risolvessero rispetto a una `<BaseURL>` già proxata — tranne che qui non ce n'è: il browser li risolveva rispetto all'URL del manifest stesso (`/api/stream/{ratingKey}/transcode?...`), ottenendo una rotta inesistente → 404 sistematico su OGNI segmento di inizializzazione (video e audio), ancor prima del primo byte di media. DASH non poteva avviarsi in nessuna modalità (auto, video, audio), indipendentemente dal codec sorgente.
- **Corretto**: `rewriteMpd()` rileva l'assenza di `<BaseURL>` e ancora quindi i percorsi relativi `initialization`/`media` al vero percorso di transcodifica universale Plex (`/api/stream/plex-proxy/video/:/transcode/universal/...`); il caso in cui Plex fornisce una `<BaseURL>` resta invariato.

## v1.13.54 — Agosto 2026

### L'identità del client deve essere coerente — MDE legge anche la query string

- **Corretto**: la query string di `start.m3u8` dichiarava ancora `X-Plex-Product=Movviz` + `X-Plex-Device=Web` mentre gli header HTTP impersonavano "Plex Web" — MDE legge i campi `X-Plex-*` da ENTRAMBE le fonti, quindi l'identità "Movviz" nell'URL poteva sovrascrivere il profilo "Plex Web" appaiato dagli header e rifiutare di nuovo la copia HEVC. La query string ora porta esattamente la stessa identità Plex Web degli header (product, device Windows, version 4.100.0, model).

## v1.13.53 — Agosto 2026

### La vera causa del lag è lato Plex: il video viene ri-codificato nelle sessioni transcode — il profilo client ora dichiara HEVC/AV1 per forzare la copia

- **Corretto**: i log di Plex hanno rivelato la prova — in una sessione "solo audio" (`ta=1`), Plex produce segmenti da 2,4-2,8 MB ogni ~22 secondi: non un problema di consegna, ma di ri-codifica. MDE onora `videoCodec=copy` per HEVC in direct-stream ma **lo rifiuta in una sessione transcode** finché il profilo client associato non dichiara HEVC come codec target di transcode per HLS. La rotta transcode ora invia `X-Plex-Client-Profile-Extra: append-transcode-target-codec(type=videoProfile&context=streaming&videoCodec=hevc,av1,h264&audioCodec=aac,ac3,mp3&protocol=hls)` (estensione profilo ufficiale Plex) insieme all'impersonificazione "Plex Web" — MDE può quindi onorare la copia bitstream HEVC/AV1 durante i transcode solo-audio.
- **Diagnostica**: il corpo della risposta `/decision` viene ora registrato integralmente (troncato a 600 caratteri, nascondeva il `transcodeDecisionText` di primo livello — la ragione esatta di MDE), con il testo della decisione estratto nel proprio campo leggibile.

## v1.13.52 — Agosto 2026

### La verità è nel flusso stesso — il primo segmento TS viene analizzato per i suoi stream type reali

- **Nuovo**: poiché le sessioni di riproduzione Movviz non compaiono nella dashboard/analisi di riproduzione di Plex, e la playlist master HLS omette il suo attributo `CODECS`, la rotta transcode ora analizza il segmento MPEG-TS reale dopo l'avvio della sessione (fire-and-forget, zero latenza aggiunta all'avvio della riproduzione): legge le tabelle PAT/PMT e registra gli stream type realmente serviti al browser (`plex-segments`). 0x24 = HEVC copiato in bitstream (copia onorata, log ✓), 0x1b = H.264 (video ri-codificato nonostante `tv=0` → warn + errore console), 0x0f = AAC, 0x81 = AC3 copiato, 0x87 = E-AC3... La sonda gestisce il warm-up del transcode con nuovi tentativi e resta sempre best-effort.
- **Corretto**: la sonda registra anche `réel` per le sessioni direct-stream dove `videoDecision` non è applicabile.

## v1.13.51 — Agosto 2026

### Le sonde transcode non sono più mute — ogni esito viene registrato

- **Corretto**: la sonda `/status/sessions` poteva terminare senza lasciare una sola riga di log (sessione non trovata, errore HTTP o errore di rete tutti ignorati silenziosamente) — una diagnostica invisibile non è una diagnostica. Ora registra sempre un esito: i codec reali del job quando viene trovato, "trovata senza TranscodeSession" per le sessioni direct-stream pure, "non trovata" con l'elenco delle sessioni attive quando il job non è ancora apparso, lo stato HTTP in caso di errore e il messaggio di errore catturato.
- **Modificato**: quando `/decision` di Plex risponde con campi di codice di decisione invece di un array `Media[]`, ora viene registrato il corpo completo della risposta (600 caratteri) invece di un estratto di 200 caratteri, così una decisione rifiutata mostra la sua struttura completa.

## v1.13.50 — Agosto 2026

### La sessione transcode in corso viene ispezionata — i codec che Plex produce DAVVERO vengono registrati

- **Nuovo**: subito dopo l'avvio della sessione, la rotta transcode interroga `/status/sessions` e registra l'output reale del job (`plex-session`: codec video/audio con le loro decisioni effettive, codec sorgente, risoluzione di output e velocità del job). Questo chiude il cerchio per il caso "transcodifica solo audio che lagga ancora": la copia video è ora confermata onorata (le sessioni remux sono fluide), e se una sessione ri-codifica il video nonostante `tv=0`, viene emesso un avviso `warn` più un errore console. Due tentativi a 400 ms di distanza per dare al job il tempo di apparire nell'elenco delle sessioni.
- **Modificato**: la sonda non blocca mai la riproduzione — è best-effort e silenziosa in caso di errore.

## v1.13.49 — Agosto 2026

### La chiamata di decisione MDE non fallisce più in silenzio — i suoi errori HTTP vengono registrati

- **Corretto**: la sonda `/decision` aggiunta in 1.13.48 inghiottiva gli errori silenziosamente — in caso di stato di errore o corpo inatteso non appariva nulla nei log, rendendola inutile come diagnostica. Ora registra lo stato HTTP e il corpo della risposta in caso di errore (e il messaggio di errore catturato), quindi un server Plex che rifiuta mostra esattamente perché.

## v1.13.48 — Agosto 2026

### La rotta transcode chiede a Plex cosa HA INTENZIONE di fare — la decisione dell'MDE viene registrata prima dell'avvio della sessione

- **Nuovo**: prima di avviare la sessione, la rotta transcode chiama l'endpoint `/video/:/transcode/universal/decision` di Plex con esattamente gli stessi parametri e registra il piano del motore di decisione (`plex-decision`: `Decision=transcode/copy`, codec video/audio, contenitore). La playlist master HLS omette l'attributo `CODECS` nelle sessioni direct-stream, quindi è l'unico modo affidabile per sapere se il video verrà davvero copiato in bitstream o silenziosamente ri-codificato — il caso "transcodifica solo audio che lagga ancora" ora mostra il suo verdetto (voce `warn` + messaggio console quando l'MDE ignora `tv=0`).
- **Corretto**: `videoResolution` è restituito da Plex come stringa e non è sempre numerico ("4k", "8k", "uhd") — `Number("4k")` = NaN, che azzerava silenziosamente il tetto al bitrate video al valore 1080p (8000) per le sorgenti 4K che transcodano. Le etichette di risoluzione sono ora normalizzate prima della scelta del bitrate.

## v1.13.47 — Agosto 2026

### La copia bitstream HEVC ora è davvero rispettata da Plex — il player dichiara il profilo client Plex Web per le sessioni transcode

- **Corretto**: il motore di decisione di Plex sceglie il profilo client dagli header `X-Plex-*` e rifiuta la copia bitstream video (`videoCodec=copy`) per i codec non dichiarati dal profilo individuato. Il player si annunciava come prodotto sconosciuto ("Movviz"), il cui profilo predefinito non conosce HEVC — le sorgenti HEVC/H.265 (remux 4K/1080p, 10-bit HDR) venivano quindi silenziosamente ri-codificate in H.264 anche quando la modalità "transcodifica solo audio" richiedeva una copia video: quella transcodifica video completa con tetto al bitrate era il lag. La richiesta di avvio transcode ora dichiara il profilo integrato "Plex Web" (HEVC su HLS supportato), facendo rispettare la copia al motore di decisione: il video HEVC viene copiato in bitstream e solo l'audio viene ri-codificato — l'operazione leggera che avrebbe dovuto essere. Il nome del dispositivo resta "Movviz" e l'attribuzione della sessione (`X-Plex-Session-Identifier`) è invariata.
- **Modificato**: l'impersonificazione è limitata alla sola richiesta di avvio transcode — lì avviene la decisione di sessione; metadati, recupero segmenti e rotte di riproduzione/stop mantengono i loro header normali.

## v1.13.46 — Agosto 2026

### I log transcode rivelano ciò che Plex fa DAVVERO — la ri-codifica completa silenziosa non è più invisibile

- **Nuovo**: la rotta transcode ora legge l'attributo `CODECS=` dalla playlist master restituita da Plex e lo confronta con ciò che è stato richiesto. Quando viene chiesta una copia bitstream (`tv=0`) ma Plex ri-codifica comunque il video (sorgenti HEVC/AV1 10-bit o HDR che Plex rifiuta di copiare in HLS-TS, o sottotitoli PGS/ASS bruciati nell'immagine), viene scritto un avviso `plex-copy-refused` con la causa nei log di Impostazioni → Diagnostica e stampato nella console — è esattamente il caso "transcodifica solo audio che lagga comunque".
- **Modificato**: le voci di log ora includono i codec realmente prodotti da Plex (`plex-codecs`), il pannello colora gli avvisi in ambra (vs verde/rosso), e la risposta master porta i codec reali nell'header `x-movviz-plex-codecs`.

## v1.13.45 — Agosto 2026

### L'opzione "transcodifica solo audio" in realtà ri-codificava il video — i due modi erano invertiti

- **Corretto, confermato dal vivo**: nel menu transcode del player beta, "Transcodificato (audio)" e "Transcodificato (video)" erano invertiti. Scegliendo "Transcodificato (audio)" veniva inviato `tv=1&ta=0` a Plex — il video veniva ri-codificato in H.264 (l'operazione costosa che causa lag, con tetto al bitrate) mentre la traccia audio veniva copiata invariata; "Transcodificato (video)" faceva l'opposto. Selezionare il solo audio ora invia `tv=0&ta=1`: il video viene copiato in bitstream e solo l'audio viene ri-codificato in AAC — l'operazione leggera e senza latenza che Plex stesso esegue per la stessa impostazione.
- **Modificato**: la correzione copre entrambi i costruttori di URL (avvio iniziale e ricarica al cambio di traccia audio/sottotitoli), quindi il modo scelto corrisponde sempre a ciò che Plex fa davvero.

## v1.13.44 — Agosto 2026

### Lettore beta: un errore passeggero sul primo segmento HLS non faceva più escalation immediata verso una vera transcodifica, e il pulsante "Test diretto" non faceva più nulla

- **Corretto**: un fallimento passeggero sul primissimo segmento HLS (un `503` breve durante l'avvio della transcodifica lato Plex, confermato persino sul client Plex stesso) ottiene ora un vero nuovo tentativo prima che il lettore abbandoni la copia audio senza perdita e passi a una vera ricodifica — in precedenza faceva escalation al primo intoppo.
- **Corretto**: il pulsante manuale "Test diretto" non faceva nulla quando la riproduzione diretta era già il motore attivo — riassegnava al `<video>` esattamente l'URL che aveva già, cosa che il browser tratta correttamente come un no-op (nessun ricaricamento, nessuna richiesta). Il pulsante ora forza un vero ricaricamento ogni volta.

---

## v1.13.40 — Agosto 2026

### Lettore beta: la riproduzione diretta poteva servire un MKV grezzo di cui il browser non decodificava mai la traccia audio

- **Corretto**: confermato dal vivo — un MKV grezzo trasmesso così com'è da Plex al browser poteva riprodurre l'immagine perfettamente mentre `webkitAudioDecodedByteCount` restava a zero per tutta la riproduzione, senza alcun errore, solo silenzio. Quando la riproduzione diretta passa al ripiego HLS per una traccia che hls.js sa davvero demultiplexare da MPEG-TS (AAC/MP3/AC-3), il lettore ora richiede una copia audio senza perdita — lo stesso reincapsulamento che ottiene il client Plex stesso, senza costo aggiuntivo per il server — e verifica con l'energia audio effettivamente decodificata, passando a una vera ricodifica solo se questa copia resta davvero silenziosa. Il test di supporto codec del browser da cui dipendeva questa decisione è stato rimosso; produceva falsi negativi che forzavano ricodifiche inutili. L'E-AC-3/DTS/TrueHD passano ancora direttamente a una vera transcodifica — il demultiplexer MPEG-TS di hls.js semplicemente non ha alcun parser per questi formati, un vero limite della libreria, non una supposizione.
- **Corretto**: Movviz non inviava mai l'header `X-Plex-Session-Identifier` su nessuna richiesta Plex, a differenza di un vero client Plex — aggiunto lungo tutto il percorso delle richieste di streaming/transcodifica.

## v1.13.39 — Agosto 2026

### Aggiunta un'impostazione per attivare la ricerca YouTube dei trailer — disattivata di default, il motivo per cui restavano in inglese

- **Aggiunto**: il ripiego tramite ricerca YouTube per i trailer (usato quando TMDb non ne ha uno nella tua lingua) è scraping di pagina, non un'API ufficiale — dipende dal fatto che YouTube non blocchi l'IP del server, e un solo fallimento silenzioso resta in cache per 24 ore. Per questo era disattivato di default. Questa impostazione predefinita è il motivo per cui i trailer restavano in inglese, pur essendo il meccanismo esistente e funzionante correttamente quando testato direttamente. Un nuovo interruttore in Impostazioni → Dashboard ("Trailer") permette di attivarlo — sempre disattivato di default, ma ora una scelta esplicita e visibile anziché silenziosa.

## v1.13.38 — Agosto 2026

### Annullato il cambiamento Dolby Digital+ della v1.13.35 — peggiorava il silenzio, non il contrario

- **Annullato**: escludere l'AC-3/E-AC-3 dalla rete di sicurezza anti-silenzio partiva dal presupposto che la riproduzione diretta avesse sempre un audio reale su questi codec — confermato dal vivo che questo non è vero su tutte le macchine. Chromium non integra un proprio decoder AC-3/E-AC-3; dipende da un decoder registrato a livello di sistema operativo, assente su alcune installazioni Windows (varia in base alla macchina, non a Movviz). Rimuovere la rete di sicurezza significava che una macchina priva di questo decoder si ritrovava in silenzio totale senza alcun ripiego, invece del passaggio automatico a un flusso transcodificato (quindi udibile) di cui disponeva prima. La rete di sicurezza è tornata esattamente come prima — un vero correttivo che distingua un fallimento di decodifica reale dal punto cieco della rete su questi codec richiede più cura di quanta ne avesse questo tentativo, ora annullato.

## v1.13.37 — Agosto 2026

### I titoli bloccati in "ricerca" facevano salire il riquadro "In download" senza nulla che lo spiegasse

- **Aggiunto**: invece di limitarsi a non contare più gli elementi in "ricerca" come download (versione precedente), ora hanno un proprio riquadro dedicato "Ricerca in corso" sulla dashboard — questo numero non sparisce, va semplicemente dove ha davvero senso che stia.

## v1.13.36 — Agosto 2026

### Il riquadro "In download" della dashboard poteva mostrare un numero anche se in realtà non stava scaricando nulla

- **Corretto**: il riquadro contava anche gli episodi/film in stato "ricerca" (alla ricerca attiva di una release, senza ancora aver recuperato un torrent) come se fossero in download. Confermato dal vivo: un'intera stagione bloccata in "ricerca" senza alcun torrent attivo faceva salire il contatore a 9 anche se nessun download era realmente in corso. Il riquadro ora conta solo gli elementi con un download effettivamente attivo.

### Il pulsante di riproduzione di un titolo poteva sparire del tutto senza spiegazione

- **Corretto**: il pulsante di riproduzione di una pagina titolo dipendeva interamente dal fatto che Plex avesse già collegato il file — un file già pronto lato Movviz ma che Plex non ha ancora scansionato nella propria libreria (un normale ritardo asincrono) non mostrava alcun pulsante invece di qualcosa che spiegasse l'attesa. Ora mostra un segnaposto chiaramente disattivato con un tooltip anziché sparire.

### Due pulsanti non correlati della pagina titolo condividevano esattamente la stessa icona

- **Corretto**: "gestisci versioni" e "vedi la saga/collezione" usavano entrambi la stessa icona a pila, creando confusione su un titolo che ha entrambi. Il link alla collezione ora usa un'icona visivamente distinta.

## v1.13.35 — Agosto 2026

### Lettore beta: la riproduzione diretta in Dolby Digital+ aveva perso l'audio dopo un aggiornamento recente

- **Corretto**: la rete di sicurezza anti-silenzio (che monitora l'energia audio effettivamente decodificata per alcuni secondi all'inizio della riproduzione diretta, e passa a un transcoding se resta silenzio) capta l'audio tramite un grafo Web Audio collegato all'elemento video — se non che l'AC-3/E-AC-3 (Dolby Digital/Digital+) viene decodificato al di fuori del motore di rendering, quindi questo grafo non può semplicemente mai osservare quell'audio. La rete di sicurezza scattava quindi sistematicamente a torto su questi due codec, forzando un transcoding audio mentre la riproduzione diretta aveva in realtà l'audio fin dall'inizio. Una versione recente ha unificato il pulsante "riavvia in diretta" manuale sullo stesso percorso di codice del primo tentativo automatico, il che ha fatto passare questo caso limite, prima raro, a sistematico. Le tracce AC-3/E-AC-3 sono ora completamente esentate da questa rete di sicurezza — la riproduzione diretta resta diretta, con audio reale, esattamente come prima.

## v1.13.34 — Agosto 2026

### La stessa notifica poteva continuare a comparire per un contenuto disponibile da giorni

- **Corretto**: le notifiche non venivano mai deduplicate — un'attività pianificata che rianalizza un contenuto che non riesce a ripulire completamente dopo l'importazione poteva far scattare di nuovo esattamente la stessa notifica "ora disponibile" a ogni passaggio, confermato dal vivo con una notifica di stagione disponibile che si ripeteva ogni ~30 minuti per un titolo disponibile ormai da una settimana. La stessa notifica con gli stessi dettagli ora scatta solo una volta per finestra di un'ora; una vera ripetizione più avanti (ad esempio giorni dopo) passa comunque normalmente.

### La modalità "Classica" della dashboard è stata rifatta per riprendere "Cinema" senza l'hero

- **Modificato**: la modalità Classica ora riprende tutto ciò che offre la modalità Cinema — le pillole di statistiche compatte e il layout completo a righe (Tendenze, Suggerimenti su misura, Aggiunti di recente, ecc.) — semplicemente senza il grande banner hero in alto, in base al tuo riscontro. In precedenza ricadeva su una semplice griglia di riquadri statistici e un elenco piatto "aggiunti di recente" senza nessuna delle righe di Cinema.

## v1.13.33 — Agosto 2026

### Aggiunto un pulsante per mettere manualmente in seed i download completati

- **Aggiunto**: un download completato nella coda ora dispone di un pulsante dedicato per avviare o interrompere il proprio seed, indipendente dai controlli pausa/ripristino riservati ai download attivi. Disattivarlo interrompe davvero l'attività di invio, non solo uno stato visualizzato — per il motore di download predefinito, questo stacca completamente il torrent dai peer; riattivarlo lo ripristina, ricostruendo se necessario la struttura di file originale nel caso i file siano già stati spostati nella libreria, senza mai toccare né riscaricare la copia nella libreria.

### I titoli delle righe di locandine non erano centrati sotto le schede

- **Modificato**: il titolo sotto ogni locandina nelle righe della dashboard (Tendenze, Suggerimenti, Aggiunti di recente) è ora centrato sotto la locandina, in base al tuo riscontro — in precedenza poteva risultare disallineato, soprattutto nella riga classificata Top 10.

## v1.13.32 — Agosto 2026

### I download non mostravano mai il tempo rimanente

- **Corretto**: il campo "tempo rimanente" della coda veniva calcolato solo da due dei tre motori di download — il motore predefinito (quello effettivamente usato nella pratica quotidiana) non trasmetteva mai un valore `timeRemaining`, quindi il campo restava sempre vuoto nella coda. Ora viene calcolato allo stesso modo in cui lo fanno già gli altri motori (byte rimanenti divisi per la velocità attuale), quindi un download in corso mostra una stima reale.

## v1.13.31 — Agosto 2026

### Un percorso file valido poteva essere sovrascritto silenziosamente dalla visione di Plex del file system

- **Corretto**: a ogni sincronizzazione con Plex, un percorso file già corretto e funzionante per un film o un episodio poteva essere sovrascritto dal percorso così come lo riporta Plex stesso. Quando Plex e Movviz girano in container separati con punti di montaggio diversi per gli stessi file fisici, il percorso riportato da Plex non esiste dal punto di vista del file system di Movviz — un percorso perfettamente funzionante diventava quindi silenziosamente rotto, inondando "Ripara i percorsi" di falsi positivi per titoli che in realtà non avevano mai avuto alcun problema. Movviz ora apprende automaticamente la corrispondenza tra il modo in cui Plex vede i percorsi e il proprio — confrontando, per un titolo già tracciato correttamente, il proprio percorso verificato funzionante con ciò che Plex riporta per quello stesso identico titolo — e traduce i futuri rapporti di Plex attraverso questa mappatura appresa invece di fidarsi ciecamente. Nessuna schermata di impostazioni, nessuna configurazione manuale: Movviz deduce da solo la corrispondenza a partire da dati che già conosce con certezza. Un percorso viene scritto solo se verificato presente su disco in anticipo — una mappatura errata o obsoleta può nella peggiore delle ipotesi produrre una falsa segnalazione "mancante" (recuperabile a mano), mai una perdita silenziosa del riferimento a un file reale.

## v1.13.30 — Agosto 2026

### "Ripara i percorsi" poteva suggerire centinaia di file totalmente scorrelati come candidati

- **Corretto**: quando un file di episodio danneggiato non veniva trovato tramite il suo nome file esatto registrato, il meccanismo di ripiego di ultima istanza lo confrontava con TUTTI i file video dell'intera libreria che condividevano lo stesso numero di stagione/episodio — indipendentemente dalla serie a cui appartenevano davvero. Confermato dal vivo: un solo episodio danneggiato poteva restituire oltre 500 "candidati" che in realtà erano semplicemente l'episodio 1, l'episodio 2, ecc. di tutte le altre serie. Questo ripiego ora propone solo file che appartengono plausibilmente alla vera serie (per nome file o nome cartella), quindi l'elenco dei suggerimenti torna a essere breve e pertinente. Presente sin dalla v1.12.86 — non qualcosa che è cambiato in questo recente gruppo di correzioni, e nessun altro percorso di corrispondenza (nome esatto, percorso previsto, o l'avviso di conflitto duplicato) è stato toccato.

### I numeri della Top 10 nella riga Tendenze coprivano troppo il poster

- **Modificato**: il numero di classifica dietro ogni scheda della Top 10 nella riga "Tendenze" restava troppo nascosto sotto il poster, lasciando visibile solo un sottile filo a sinistra. Ora copre molto meno la scheda — la maggior parte del numero è visibile a sinistra, con solo il bordo posteriore infilato dietro, in base al tuo riscontro.
- **Modificato**: la riga "Tendenze" ora appare per prima nella dashboard, sopra "Aggiunti di recente", in base al tuo riscontro.

### "Scarica i mancanti" su una collezione poteva recuperare il titolo sbagliato invece di quello davvero mancante

- **Corretto**: due bug che si sommavano, entrambi confermati dal vivo su più collezioni. Anzitutto, il pulsante calcolava i titoli mancanti a partire da un'istantanea di libreria/collezione messa in cache e condivisa in tutta l'app, che poteva essere obsoleta senza nulla di visibilmente sbagliato a schermo — ora sia la libreria sia l'elenco delle parti della collezione vengono riverificati da zero appena prima di scaricare. In secondo luogo, e questo era il problema più grave: un controllo anti-doppione pensato per rilevare il caso in cui TMDb elenca lo stesso film già uscito sotto due identificativi diversi usava una corrispondenza di titolo approssimativa senza una vera richiesta sull'anno — poteva silenziosamente riutilizzare una voce già posseduta e senza alcun legame per una scheda provvisoria di franchise non confermata, oppure confondere un vero film con una featurette della stessa saga sfalsata di un anno e con un suffisso aggiuntivo nel titolo. Questo controllo ora richiede un titolo normalizzato esattamente corrispondente E un anno di uscita confermato esattamente corrispondente su entrambi i lati prima di fidarsi di una corrispondenza.

### Gli account amici ricevevano tutti la cronologia di visione del proprietario del server

- **Corretto**: ogni account amico collegato aveva effettivamente un'identità e un token Plex realmente distinti — eppure tutti sincronizzavano esattamente gli stessi numeri dell'account proprietario del server. Causa radice confermata dal comportamento documentato di Plex stesso: gli endpoint usati per sincronizzare lo stato di visione restituiscono il `viewCount` dal punto di vista del proprietario del server soltanto, indipendentemente da quale token di account valido effettui la richiesta — nessuna intestazione di richiesta può cambiarlo. La sincronizzazione dello stato di visione ora usa l'endpoint della cronologia di sessione di Plex, interrogato con il token admin e filtrato per l'id Plex proprio di ciascun account — il modo in cui Plex traccia realmente la visione per account — e funziona ora allo stesso modo per gli account amici e per i profili gestiti dell'Home, invece di due percorsi separati.

## v1.13.22 — Agosto 2026

### "Per te" torna a essere strettamente individuale, e un errore di sincronizzazione Plex non sembra più "non ha guardato nulla"

- **Modificato**: passo indietro sul mix "nucleo familiare" della v1.13.21 — dopo altri riscontri, "Per te" torna a basarsi ESCLUSIVAMENTE sulla cronologia Plex del singolo account, senza alcun segnale dagli altri account, nemmeno minimo. Un account con solo un paio di titoli visti ottiene ora una riga personalizzata basata unicamente su quelli, invece di richiedere un minimo prima di mostrare qualcosa.
- **Corretto**: la sincronizzazione dello stato di visione Plex ingoiava silenziosamente ogni errore (interruzione di rete, token scaduto, sezione irraggiungibile) e salvava comunque un risultato vuoto — indistinguibile da "questo account non ha davvero guardato nulla", e capace di cancellare silenziosamente una cronologia reale in caso di errore temporaneo. Ora lascia intatti i dati esistenti quando una sincronizzazione non riesce a raggiungere alcuna sezione, e ogni tentativo — riuscito o fallito, e per quale account — viene registrato in Impostazioni → Log, così un account che fallisce silenziosamente diventa finalmente visibile invece di sembrare semplicemente vuoto.

## v1.13.21 — Agosto 2026

### "Per te" può ora basarsi sulla cronologia Plex di tutto il nucleo familiare, non solo sulla tua

- **Nuovo**: quando la cronologia Plex propria di un account è scarsa o vuota, la sua riga "Per te" ora mescola anche ciò che gli altri account della stessa istanza hanno guardato (con un peso inferiore rispetto alla cronologia propria dell'account) — così un account senza collegamento Plex può comunque avere una vera riga personalizzata invece del generico ripiego "più votati". Questo scatta solo a partire dal momento in cui almeno altri due account hanno dati di visione reali — i gusti di un solo altro account non vengono mai usati come segnale "nucleo familiare" sostitutivo, per evitare di clonare silenziosamente le scelte di una persona su qualcun altro. La riga di ogni account resta esattamente personale come prima; questo aggiunge solo un segnale più ampio in più, senza mai sostituire la cronologia propria dell'account quando esiste già.

## v1.13.20 — Agosto 2026

### I titoli e i riassunti degli episodi venivano sempre restituiti in francese, indipendentemente dalla lingua dell'interfaccia

- **Corretto**: la chiamata dati stagione/episodio (miniature, titoli, riassunti — aggiunta in v1.13.12, estesa alle serie possedute in v1.13.19) non indicava mai a TMDb in quale lingua rispondere, quindi ricadeva silenziosamente sul francese per tutti, anche con l'italiano (o un'altra lingua) selezionato come lingua dell'interfaccia. Era esattamente lo stesso bug già corretto una volta per le pagine di dettaglio — mai applicato a questa chiamata specifica. Ora segue la lingua scelta nell'app, come ovunque altrove.

## v1.13.19 — Agosto 2026

### Miniature e riassunti degli episodi visibili ovunque, non solo per le serie non ancora possedute

- **Corretto**: la v1.13.12 aveva aggiunto una miniatura e un breve riassunto a ogni riga di episodio, ma solo per le serie non ancora presenti nella tua libreria — gli episodi delle serie già possedute venivano mostrati come semplici righe di testo, senza anteprima. Le due viste ora attingono agli stessi dati TMDb in diretta, quindi un episodio scaricato/disponibile mostra esattamente la stessa anteprima di uno non ancora recuperato — senza che alcun badge di qualità, indicatore "visto", pallino di stato o pulsante di ricerca esistente scompaia.
- **Corretto**: le date di trasmissione in questa stessa lista venivano mostrate secondo il formato della locale del browser, indipendentemente dalla lingua scelta in Movviz (ad esempio l'ordine mese/giorno statunitense anche con l'italiano selezionato) — ora seguono coerentemente la lingua dell'app, come tutte le altre date di Movviz.

## v1.13.18 — Agosto 2026

### La ripresa di un pack di stagione parzialmente importato poteva tentare di rinominare il suo .nfo residuo come file di episodio

- **Corretto**: una volta che tutti i file video reali di un pack di stagione erano già stati abbinati e spostati in un passaggio precedente, un tentativo di ripresa non trovava più alcun file video e ripiegava sul primo file rimasto — incluso il `.nfo` della release — trattandolo come "l'episodio da importare", tentando di rinominarlo in qualcosa come `S03E02.nfo` e fallendo non appena non corrispondeva a ciò che era realmente presente sul disco. I file `.nfo`/`.txt`/immagini/checksum residui non sono mai contenuto di episodio e vengono già ripuliti automaticamente al termine dell'import — ora sono esclusi da questo abbinamento invece di causare un errore di import visibile all'utente.

## v1.13.17 — Agosto 2026

### I log di rallentamento annunciati ora compaiono davvero in Impostazioni → Log

- **Corretto**: il registro diagnostico di ricerca poteva riempire il suo buffer di 2000 righe in pochi minuti durante le pesanti passate in background (ogni ricerca di episodio scrive ~10 righe, molte in debug), spingendo fuori silenziosamente le righe info importanti — incluse le nuove righe di rallentamento del background. Il buffer ora contiene 4000 righe, quindi le voci `priority.yield` sopravvivono al rumore.
- **Nuovo**: il pannello dei log in Impostazioni → Log si aggiorna ora in tempo reale — ogni 5 secondi finché la scheda è visibile, le righe scritte dal background appaiono man mano invece di attendere un aggiornamento manuale. Nessun re-render se non è cambiato nulla.
- **Corretto**: tutte le fonti di log sono ora raccolte in un unico posto — il pannello dei log transcode è stato spostato dalla scheda Diagnostica a Impostazioni → Log, che ora mostra insieme log di ricerca/diagnostica, motore, resolver e transcode.
- **Modificato**: le righe di rallentamento del background hanno ora un colore dedicato nel pannello, così le voci "Arrière-plan bridé [bulk manquants]…" si notano a colpo d'occhio.

## v1.13.16 — Agosto 2026

### I rallentamenti dello sfondo ora sono visibili nei log — con l'utente responsabile

- **Nuovo**: il lavoro in background (il bulk manuale "Cerca tutto ciò che manca", il matching RSS pianificato, gli upgrade di qualità, i nuovi tentativi per le uscite mancanti) ora si mette in pausa quando usi attivamente l'app e riprende pochi secondi dopo che ti fermi — non lo senti mai. Ogni volta che un rallentamento avviene davvero, il log diagnostico di ricerca lo registra in una riga pulita e leggibile: quale attività in background è stata limitata, quale utente era attivo (nome + id) e quanto è durata l'attesa (es. "Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Corretto**: il polling silenzioso del frontend non conta più come attività utente. I sondaggi di stato (torrent del motore ogni 500 ms, job ogni 2 s, metriche perf ogni 5 s, attività Plex ogni 5 s, avanzamento della riproduzione ogni 10 s…) mantenevano l'app marcata come "attiva" per sempre appena una singola pagina restava aperta — quindi il background non riprendeva mai davvero. Ora contano solo le interazioni reali (navigazione, ricerche, clic): lascia l'app aperta e il background riprende pochi secondi dopo il tuo ultimo clic.
- **Modificato**: la ricerca bulk manuale ora gira nella corsia di background come le attività pianificate — eredita la quota indexer ridotta (le tue ricerche restano prioritarie) e cede la mano tra un elemento e l'altro.

## v1.13.15 — Agosto 2026

### La barra di navigazione restava opaca dopo essere tornati in cima alla pagina

- **Corretto**: la barra di navigazione trasparente-poi-opaca aggiunta nella v1.13.12 diventava correttamente opaca scorrendo verso il basso, ma non tornava mai trasparente risalendo fino in cima. Passaggio a un metodo di rilevamento più affidabile affinché rifletta correttamente la posizione di scorrimento in entrambe le direzioni.

## v1.13.14 — Agosto 2026

### Le righe della dashboard ora possono aprire una griglia completa — "Vedi tutto" non era mai stato davvero collegato

- **Corretto**: i caroselli della dashboard ("Per te", "Aggiunti di recente", "In arrivo", "Tendenze") avevano un'affordance "Vedi tutto" integrata nel componente riga stesso, ma nessuna riga della dashboard le aveva mai passato una destinazione — quindi non è mai comparsa silenziosamente, su nessuna riga, da quando questa parte della dashboard è stata costruita per la prima volta. Le righe restano esattamente come strisce orizzontali compatte; "Vedi tutto" ora apre l'intero insieme come una vera griglia filtrabile (Scopri per le righe di raccomandazione/tendenze, la tua Libreria — pre-filtrata di conseguenza — per le righe tratte da ciò che già possiedi).

## v1.13.13 — Agosto 2026

### Il player Beta è ora una scelta personale per account, disattivato di default

- **Modificato**: in precedenza il player Beta aveva un unico interruttore on/off per l'intera istanza — un admin che lo attivava cambiava silenziosamente il comportamento di riproduzione per ogni account. Ora ci sono due livelli: un interruttore admin in Impostazioni che si limita a rendere la funzione disponibile in generale, e un interruttore personale nella pagina Profilo di ciascun utente che la attiva effettivamente per il proprio account — disattivato di default, indipendentemente da cosa ha impostato l'admin.

## v1.13.12 — Agosto 2026

### Sei miglioramenti alla navigazione, scelti da una revisione di design

- **Nuovo**: le righe ora mostrano un sottile indicatore di posizione di scorrimento e frecce ai bordi che appaiono al passaggio del mouse, e scorrono di una pagina intera invece che con trascinamento libero.
- **Nuovo**: la riga "Tendenze" ora evidenzia la sua top 10 con un trattamento di classifica numerata, usando lo stesso ordine di popolarità reale in base al quale la riga era già ordinata.
- **Nuovo**: passando il mouse su una locandina (desktop) ora vengono mostrati brevemente anno, durata e generi quando disponibili, invece di niente.
- **Modificato**: la barra di navigazione superiore ora è trasparente in cima alla pagina e diventa solida non appena si scorre.
- **Modificato**: l'elenco episodi per un titolo non ancora presente nella libreria ora mostra una miniatura e una breve descrizione per episodio, non più una semplice riga vuota. (Gli episodi dei titoli già presenti in libreria non hanno ancora questo trattamento — richiede nuovi dati raccolti al momento dell'importazione, tracciato separatamente.)
- **Nuovo**: su mobile, l'hero della dashboard ora usa un'illustrazione dedicata in verticale invece di una versione ritagliata del banner desktop.

## v1.13.11 — Agosto 2026

### La personalizzazione della visualizzazione ora segue il tuo account, non solo il browser

- **Modificato**: il profilo prestazioni GPU, le animazioni, il tema (chiaro/scuro/automatico), la lingua dell'interfaccia e la densità della vista libreria venivano salvati solo nel browser — cambiando dispositivo o browser tutto tornava ai valori predefiniti. Ora vengono salvati sul tuo account e ti seguono ovunque tu effettui l'accesso, pur continuando ad applicarsi istantaneamente sul dispositivo in uso.
- **Spostato**: l'interruttore "Animazioni" ora si trova in Impostazioni → Prestazioni GPU, accanto al profilo su cui agisce realmente, invece che sotto Dashboard.

## v1.13.10 — Agosto 2026

### I pulsanti della barra di navigazione inferiore su mobile funzionavano solo toccando sopra l'icona

- **Corretto, confermato in produzione**: su mobile, toccare direttamente i pulsanti delle schede Calendario/Richieste/Altro spesso non faceva nulla — ma toccare appena sopra di essi funzionava. Causa individuata: il contenitore delle notifiche toast è montato ovunque e resta presente nella pagina in ogni momento, anche con zero notifiche visibili. Il suo livello mobile copre l'intera larghezza dello schermo, si trova esattamente sopra la barra delle schede inferiore, ed è invisibile — ma un elemento invisibile blocca comunque i clic sottostanti a meno che non gli venga esplicitamente detto di non farlo. I tocchi che finivano in quella zona di sovrapposizione colpivano silenziosamente il nulla invece di raggiungere il pulsante della scheda.
- Il contenitore invisibile ora non blocca più nulla sotto di sé; solo una notifica realmente visibile (rara e breve) resta toccabile/richiudibile, esattamente come prima.

## v1.13.09 — Agosto 2026

### La correzione del matching per Blood+ della v1.13.06 non aveva mai avuto effetto — trovata la vera causa

- **Corretto, confermato in produzione**: la v1.13.06 aveva corretto la funzione di corrispondenza dei titoli per trattare "+" come la parola "plus" (in modo che "Blood+" non venisse confuso con show non correlati). Ma la ricerca manuale continuava a mostrare "Blood Of Zeus", "Dexter New Blood", "Blood-C" e altri come candidati validi per "Blood+" — perché un passaggio completamente diverso e precedente (quello che trasforma una query digitata nel campo di ricerca nel testo effettivo inviato agli indexer) rimuoveva il "+" prima ancora che la funzione di corrispondenza corretta potesse vederlo, annullando silenziosamente quella correzione per ogni ricerca reale. Una ricerca per "Blood+" arrivava al matcher come la semplice parola "Blood", che ovviamente corrisponde a quasi tutto ciò che contiene "Blood" nel titolo.
- Quel passaggio precedente ora preserva anche "+" e "&" come parole, allo stesso modo in cui la funzione di corrispondenza già faceva — chiudendo la lacuna reale, non solo quella della funzione che sembrava essere la fonte del problema.

## v1.12.79 — Agosto 2026

### Irrobustita la correzione precedente dopo una revisione indipendente

- Una revisione indipendente della correzione al recupero introdotta nella v1.12.78 ha individuato due lacune reali prima che potessero causare problemi: la nuova risoluzione "fidati del record del download originale" avrebbe potuto far sovrascrivere un numero di stagione esplicito e discordante presente nel nome stesso del file — il che significa che una release etichettata male avrebbe potuto essere silenziosamente archiviata nella cartella di stagione sbagliata. Ora completa solo una stagione/episodio che il nome del file stesso non forniva già, senza mai sovrascrivere uno che invece forniva. Inoltre, un caso rimanente (un film incluso in un pacchetto di categoria serie) era ancora sul vecchio percorso basato solo su deduzione mentre ogni altro caso era già stato aggiornato — ora è coerente in tutti i casi.

## v1.12.78 — Agosto 2026

### Causa profonda per cui anche il recupero dei download non riusciva a ricollegare — il recupero scartava informazioni che possedeva già

- **Corretto, confermato in produzione**: analizzato un caso specifico (Wakfu) in cui lo strumento di recupero dei download non riusciva a trovare una corrispondenza per i file completati, anche se lo show era già correttamente presente nella libreria. Causa profonda: il recupero rideduceva lo show di ogni file basandosi esclusivamente sul nome del file e sul percorso della cartella, anche per i file il cui download originale sapeva già — con certezza, fin dal momento in cui era stato agganciato — esattamente a quale serie e stagione appartenesse. Questa informazione autorevole veniva scartata prima che venisse eseguita la corrispondenza per singolo file, costringendo ogni file a passare invece attraverso una deduzione approssimativa basata sul nome file. Per uno show organizzato come `NomeShow/Saison 01/episodio.avi`, con un file di episodio il cui nome non porta alcun indicatore di stagione riconoscibile, quella deduzione ripiegava sulla lettura della cartella della stagione stessa ("Saison 01") come titolo dello show — che non condivide alcuna parola con il nome reale, quindi non corrispondeva mai.
- Il recupero ora risolve lo show/la stagione di un file direttamente dal record del suo download originale quando disponibile, invece di indovinare — e quando deve comunque ripiegare sulla lettura dei nomi delle cartelle, ora controlla un livello più in alto ogni volta che la cartella più vicina risulta essere un semplice indicatore di stagione senza un titolo reale al suo interno, invece di fermarsi alla prima cartella indipendentemente dal suo contenuto effettivo. Entrambe le correzioni sono generiche — si applicano a qualsiasi show organizzato in questo modo, non solo a quello che ha fatto emergere il bug.

## v1.12.77 — Agosto 2026

### La Modalità Cinema lasciava trasparire visibilmente la pagina sottostante

- **Corretto, confermato in produzione**: la correzione precedente aveva reso trasparente lo sfondo del player stesso in modo che l'atmosfera cromatica potesse trasparire — ma nulla dietro di esso era in realtà completamente opaco (il livello di oscuramento della pagina è solo circa all'80% nero attraverso una sfocatura, e i livelli di colore stessi sommano diversi effetti a opacità parziale senza alcuna base solida). La pagina reale della libreria finiva per essere visibilmente leggibile attraverso le fasce nere — peggio del nero piatto che sostituiva. Aggiunto un livello di base permanente e completamente opaco sotto a tutto il resto, così la pagina non può più trasparire, con o senza la locandina di un titolo disponibile per l'estrazione del colore.

## v1.12.76 — Agosto 2026

### Lo sfondo adattivo dei contenuti in Modalità Cinema era invisibile — corretto, e ribilanciato per un vero impatto visivo

- **Corretto, confermato in produzione**: l'atmosfera cromatica estratta dalla locandina di ogni titolo era strutturalmente nascosta — lo sfondo del player video stesso era completamente opaco, disegnato sopra il livello dell'atmosfera, quindi il colore appariva solo per un istante durante l'animazione di apertura per poi sparire completamente per tutto il resto della visione. In più, il livello dell'atmosfera portava a sua volta una seconda velatura nera quasi opaca sovrapposta direttamente al gradiente di colore, schiacciando a quasi nulla quel poco che filtrava durante quell'istante. Effetto netto: nero piatto indipendentemente dalla locandina del titolo.
- Lo sfondo del player è ora trasparente dove deve lasciar trasparire lo sfondo, e l'equilibrio tra velatura e gradiente è stato rivisto in modo che il colore estratto sia effettivamente visibile nelle aree a fasce nere attorno al video — un poster luminoso e colorato ora tinge visibilmente la sala, uno scuro resta cupo, invece di apparire tutti identici.

## v1.12.75 — Agosto 2026

### Causa profonda di un download di pacchetto stagione completato che non è mai comparso nella libreria

- **Corretto, confermato in produzione**: analizzato un caso specifico (un anime i cui pacchetti stagione erano stati scaricati completamente — la coda li mostrava come "completati" — ma nessuno degli episodi è mai diventato disponibile). La causa profonda: alcune release in pacchetto stagione nominano i file degli episodi in base al titolo dello show in una forma fortemente abbreviata o non standard che l'analizzatore dei titoli non riesce a riconoscere (nel caso confermato, un acronimo che non condivide alcuna parola con il titolo reale) — così quando i file del download completato non riuscivano a corrispondere a nessun episodio monitorato, correttamente non venivano eliminati, ma la passe di recupero pensata apposta per intercettare questo caso registrava il mancato abbinamento solo in un valore che nessuno leggeva mai, lasciando i file lì indefinitamente senza alcuna visibilità.
- La passe di recupero ora li registra allo stesso modo in cui lo fa già un download manuale realmente non collegato: compaiono in Activité → Non liés, dove possono essere ricollegati manualmente al titolo corretto — in modo generico, per qualsiasi release il cui nome l'analizzatore non riesce a mappare con sicurezza, non solo per lo show specifico che ha fatto emergere il problema.

## v1.12.74 — Agosto 2026

### Bug di corrispondenza che poteva agganciare la serie sbagliata, e un blocco della coda di lavoro che poteva bloccare silenziosamente tutte le ricerche in background

- **Corretto, confermato in produzione**: il punteggio di corrispondenza dei titoli considerava due titoli quasi identici basandosi solo sulla distanza tra i caratteri, anche quando differivano per una parola completamente diversa — confermato dal vivo con "How I Met Your Father" (uno spin-off non correlato) che otteneva un punteggio di somiglianza di circa il 91% rispetto a una ricerca per "How I Met Your Mother" e veniva agganciato al suo posto. Il sistema di punteggio ora controlla anche parola per parola: una parola completamente diversa (non una variante di ortografia) squalifica la corrispondenza indipendentemente da quanto vicino appaia il conteggio complessivo dei caratteri.
- **Corretto, confermato in produzione**: un singolo task in background bloccato (in questo caso una sincronizzazione Plex lenta) poteva occupare indefinitamente uno slot della coda di lavoro, bloccando silenziosamente tutti gli altri job in coda dietro di esso — incluse le ricerche pianificate e manuali — per tutto il tempo in cui restava bloccato, senza alcun errore o indicazione che qualcosa non andasse. Questo è ciò che poteva lasciare un titolo monitorato e correttamente aggiunto senza che venisse mai effettivamente cercato. La coda ora libera lo slot di un job dopo 10 minuti se non è terminato, così un singolo task bloccato non può più affamare tutto ciò che sta dietro di lui.

## v1.12.73 — Agosto 2026

### Player Beta — la riproduzione diretta ora parte come ha sempre funzionato il "fulmine" del riprova manuale

- **Corretto**: il player decideva se tentare la riproduzione diretta pre-verificando il supporto dei codec con API del browser note per "mentire" in casi comuni (AC-3/E-AC-3 segnalati sempre come "non supportati" su Chrome/Edge, alcuni contenitori che segnalano come non supportato un video perfettamente decodificabile) — instradando molti file verso un transcoding o un fallback WebCodecs che la riproduzione diretta avrebbe in realtà gestito senza problemi. Confermato dal vivo: il pulsante di riprova manuale, che tentava sempre la riproduzione diretta senza condizioni e senza questa pre-verifica, funzionava sensibilmente meglio.
- La riproduzione diretta è ora il primo tentativo incondizionato su ogni video, esattamente come già faceva il riprova manuale — i due sono ora letteralmente lo stesso percorso di codice, con lo stesso recupero automatico (passaggio all'altra modalità di riproduzione in caso di errore di riproduzione reale o di audio genuinamente silenzioso, invariato rispetto a prima).
- Anche il pulsante di riprova manuale ora beneficia dello stesso recupero automatico, e riprende dalla posizione corrente invece di ripartire da zero.
- Rimosso il percorso di riproduzione WebCodecs ormai completamente inutilizzato in cui instradava questa pre-verifica — era semplicemente una versione peggiore e ridondante di ciò che riproduzione diretta + la catena di fallback esistente già coprono.

## v1.12.72 — Agosto 2026

### Modalità Teatro — un vero player immersivo, non un video in una modale

- **Nuovo**: il player Beta ora si apre in una vera "Modalità Teatro" a schermo intero — la pagina corrente resta esattamente dov'era dietro di esso (posizione di scorrimento, stato, tutto), il player si espande dal pulsante su cui hai cliccato con una transizione geometrica autentica (non una dissolvenza), e la pagina sottostante si oscura e sfoca progressivamente invece di semplicemente sparire.
- Qualsiasi trailer o anteprima ambientale in riproduzione ovunque sullo schermo si interrompe nell'istante in cui il player vero si apre — mai due video in riproduzione contemporaneamente.
- Lo sfondo del player ora assume una sottile atmosfera cromatica estratta dalla locandina del titolo stesso (toni dominanti, sensibile alla luminosità) invece di essere nero piatto — analizzato una sola volta per titolo e messo in cache, mai durante la riproduzione.
- "Guarda su Plex" ora diventa "Riproduci" ovunque il player Beta gestisca realmente la riproduzione, e resta "Guarda su Plex" ovunque si tratti di un vero e proprio passaggio di consegne a Plex — coerente su ogni scheda titolo, la pagina del titolo, la pagina dell'episodio e l'hero della dashboard (che in precedenza non aveva alcuna integrazione con il player Beta).
- Le tre copie separate di questa logica di attivazione sparse nell'app sono ora un'unica implementazione condivisa, chiudendo il rischio che una futura correzione venga applicata in un solo punto e dimenticata negli altri.

## v1.12.71 — Agosto 2026

### La finestra "novità" ora segue la lingua dell'interfaccia

- Le note di rilascio sono ora localizzate in base alla lingua dell'interfaccia (con ripiego sull'inglese per ciò che non è ancora tradotto), invece di un unico file in una lingua fissa.
- **Corretto**: le note di rilascio mancavano silenziosamente sia nella build Docker che in quella Windows — il file da cui vengono lette non era in realtà mai incluso in nessuna delle due build pacchettizzate, quindi la finestra "novità" non aveva nulla da mostrare.

## v1.12.70 — Agosto 2026

### Motore di download — causa radice dei download permanentemente scollegati

- **Corretto, confermato in produzione**: rimuovere un torrent dal motore di download segnalava un successo e cancellava il proprio tracciamento (incluso a quale titolo della libreria apparteneva) anche quando il client di download sottostante non riusciva silenziosamente a rimuoverlo davvero — il torrent continuava a essere eseguito e a fare seed senza essere toccato, ma il motore non ne aveva più alcuna traccia. Questo è ciò che produceva download che non potevano mai essere ricollegati a un titolo, indipendentemente da quante volte venisse eseguita una scansione di recupero. Ora il motore cancella la propria contabilità interna solo dopo che la rimozione è stata confermata in modo indipendente; in caso contrario il torrent resta tracciato e può essere ritentato invece di trasformarsi in un orfano permanente.

## v1.12.51 – v1.12.69 — Agosto 2026

Passata di precisione sul matching e affidabilità del motore: rilevamento dei pack serie complete (termini di intervallo stagionale, protezioni contro i falsi positivi), recupero dei download bloccati reso più robusto con spostamenti atomici senza sovrascrittura e un callback di importazione affidabile, blocco in scrittura per serie/film per chiudere una race condition che poteva far perdere lo stato di un episodio completato, e riconciliazione dei download duplicati in modo che un file riscaricato non lasci più la libreria bloccata sullo stato sbagliato. Guida utente aggiornata per coprire le funzionalità rilasciate di recente (modifica del titolo, versioni dei film, collegamento dei download scollegati, impostazioni anime).

## v1.12.24 – v1.12.50 — Agosto 2026

Ricerca dei pack serie complete (query singola, con consapevolezza degli intervalli stagionali), affidabilità del recupero dei download (scansione delle cartelle, corrispondenza dei file orfani, pulizia dei duplicati), eliminazione sicura dei duplicati, e una piccola suite di test automatizzati per il nucleo di matching delle release.

## v1.10.90 – v1.12.23 — Luglio–Agosto 2026

Flusso di aggiornamento qualità (Ottimizza / Ignora, rilevamento di upgrade significativi), un sistema di badge risoluzione/codec ridisegnato, profili di prestazione GPU/animazioni, e stabilizzazione del motore su tutti i backend di download intercambiabili (correzioni di crash, regola anti-stallo, blocco della ricerca per serie).

## v1.10.39 – v1.10.89 — Luglio 2026

Riscrittura del motore di download con backend intercambiabili (nativo/aria2, WebTorrent, libtorrent), uno strumento di manutenzione "recupera download" per i file orfani, un sistema di notifiche toast premium, badge dei codec audio, e miglioramenti beta alla riproduzione in-app (riproduzione diretta, log del transcoding).

## v1.10.12 – v1.10.17 — Luglio 2026

Passata di precisione sul rilevamento della lingua: lingua della traccia audio letta da Plex, tag delle varianti francesi (VF/VFQ/VFF/TRUEFRENCH) che soddisfano correttamente i profili di qualità, pulizia degli episodi duplicati, e una correzione per l'abbandono prematuro dei torrent.

## v1.10.1 – v1.10.6 — Luglio 2026

Decision Guard (applicazione della blocklist prima del grab), rilevamento di franchise/collezioni, una coda di download e una dashboard diagnostica ridisegnate, e miglioramenti a trailer/calendario.

## v1.8.0 – v1.9.9 — Luglio 2026

Pannello titolo unificato (un unico componente per le viste a scorrimento laterale e a pagina intera), una rete di sicurezza cestino/ripristino per i titoli rimossi, passata di responsività mobile, e una correzione per una perdita di memoria nella cache dei metadati.

## v1.4.5 – v1.7.9 — Luglio 2026

Rafforzamento della sicurezza (path traversal, protezioni del database, alert CodeQL), le protezioni finali del sistema cestino, un player in-app dal vivo, aggiornamenti in tempo reale in tutta l'interfaccia, monitoraggio dell'attività Plex, e supporto alle collezioni.

## v1.1.67 – v1.4.4 — Luglio 2026

Player in-app con fallback automatico al transcode Plex, importazione delle richieste da Overseerr (Seerr), build Docker multi-architettura, e una riduzione della navigazione delle impostazioni da 26 a 18 schede.

## v1.1.50 – v1.1.66 — Luglio 2026

Rilascio pubblico iniziale: scoperta TMDb, ricerca su indexer Torznab/Newznab, libreria unificata film/serie, richieste multi-utente, il motore BitTorrent integrato, e sincronizzazione Plex — oltre a correzioni iniziali di stabilità e sicurezza (gestione delle sessioni, deduplicazione della libreria, aggiornamenti delle dipendenze).
