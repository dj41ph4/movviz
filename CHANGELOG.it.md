## v1.27.34 — 24 ottobre 2026

### Reattività durante le attività automatiche

- Il recupero programmato dei download non importati continua ogni 15 minuti, ma viene eseguito da solo tra le attività pesanti, dopo l'avvio, e lascia spazio all'interfaccia e alla riproduzione. Il recupero manuale resta immediato.
- L'importazione Seerr deduplica l'intera libreria solo quando aggiunge davvero una richiesta approvata. La riconciliazione giornaliera resta attiva.
- I titoli originali in scritture non latine non creano più falsi omonimi: la ricerca automatica accetta le release corrette senza anno e protegge i veri omonimi. Gli errori indicano il filtro che ha scartato i risultati.

## v1.27.33 — 24 ottobre 2026

### Riprese Plex e reattività

- La raccolta completa degli stati di visione Plex viene eseguita in un worker dedicato. Gli stati esistenti vengono sostituiti solo dopo uno snapshot completo e convalidato.
- Le sincronizzazioni pianificate delle visioni e della cronologia Plex sono attività pesanti: non si sovrappongono ad altre attività pesanti e attendono la fine della riproduzione.
- L'apertura di una scheda mantiene la verifica rapida degli stati di visione senza avviare uno snapshot completo.
- On Deck mostra le riprese locali dopo al massimo due secondi di attesa per Plex. Le prime cinque riprese Plex arrivano automaticamente, poi le altre in modo progressivo con meno passaggi ripetuti.

## v1.27.32 — 23 ottobre 2026

### Priorità al lettore e all'interfaccia

- Le attività automatiche pesanti attendono la fine della riproduzione nel lettore Movviz e un breve periodo senza interazioni prima di iniziare. Restano in coda e riprendono in seguito.
- Un'attività automatica pesante viene eseguita da sola tra le attività automatiche; il benchmark automatico non si sovrappone più alla sincronizzazione Plex o all'importazione Seerr. Anche il pulsante Benchmark usa questa coda e mostra l'attesa. Le azioni dirette dell'utente e le acquisizioni immediate mantengono la priorità.

## v1.27.31 — 23 ottobre 2026

### Episodi doppi per stagione

- In Modifica scheda, ogni stagione ha un interruttore Episodi doppi accanto alla sua cartella. Associa ogni file a due episodi del catalogo e si può disattivare per stagione.
- I nuovi pacchetti vengono rilevati automaticamente solo se numero di file, numerazione e durate confermano il formato doppio. FINAL aiuta ma da solo non basta.
- Movviz mostra gli episodi coperti come disponibili, riproduce il file condiviso, segna entrambi come visti al termine e passa al file successivo. I video sul disco non vengono rinominati.

## v1.27.30 — 23 ottobre 2026

### Hero della dashboard

- L'ambilight attende che la copia del video YouTube confermi la propria posizione prima di mostrare la luce; se i due video si desincronizzano, la luce si nasconde e si riallinea.
- Il velo scuro nella parte superiore del hero viene rimosso, preservando i colori del video e dell'ambilight lungo il bordo superiore.

## v1.27.29 — 23 ottobre 2026

### Caricamento e ripresa Plex

- «Continua a guardare» mostra prima le cinque riprese Plex più recenti, poi completa progressivamente l'elenco in background sui dispositivi connessi.
- L'abbinamento RSS e i download automatici continuano a funzionare, ma questa fase attende ora il proprio turno tra le attività pesanti per limitare i blocchi del server.
- La diagnostica raggruppa i blocchi consecutivi simili e non mostra più una traccia di misurazione come errore.

## v1.27.28 — 23 ottobre 2026

### Prestazioni e diagnostica

- Le letture della libreria già servite dalla cache non creano più ciascuna uno stack di chiamate e due eventi nella cronologia. Questo elimina un sovraccarico di misurazione da un percorso richiamato molto spesso.
- Gli accessi lenti al disco durante la verifica dei file JSON vengono ora registrati insieme alle decodifiche JSON lente. I blocchi globali e le attività in background restano misurabili.

## v1.27.27 — 23 ottobre 2026

### Episodi aggiunti di recente

- Gli episodi arrivati nella libreria restano visibili indipendentemente dall'elenco dei download. La pulizia attende la conferma dell'importazione prima di eliminare le informazioni necessarie per associare i file.
- Le aggiunte recenti vengono caricate pagina per pagina durante lo scorrimento, senza un limite permanente di 150 file. Un gruppo di episodi della stessa serie occupa una sola scheda su desktop, Android TV e Android mobile.
- La pulizia dei download mostra gli elementi che non è riuscita a rimuovere invece di svuotare artificialmente l'elenco.

## v1.27.26 — 23 ottobre 2026

### Android TV: interfaccia Beta e lettore

- La barra laterale e il testo dell'interfaccia Beta sono meno grandi, pur restando leggermente più grandi rispetto alla modalità Stabile.
- Il passaggio tra i pulsanti della sezione principale non provoca più un continuo ricentramento della pagina.
- Il breve contorno bianco è stato rimosso dalla schermata di caricamento.
- Le opzioni audio e dei sottotitoli del lettore mantengono un testo leggibile quando vengono selezionate con il telecomando.

## v1.27.25 — 23 ottobre 2026

### Diagnostica: individuare cosa blocca il server

- Le Impostazioni ora elencano ogni blocco del server con la sua durata, il tipo (calcolo bloccato o attesa di un servizio esterno) e le operazioni in esecuzione in quel preciso momento.
- Una cronologia delle finestre misurate mostra la sovrapposizione delle attività in background, come la scansione degli indicizzatori, la sincronizzazione Plex, l'importazione delle richieste o la riconciliazione dei download.
- La scansione degli indicizzatori distingue il tempo di calcolo (caricamento delle librerie, confronto delle release) dal tempo di attesa (ricerca e download tramite gli indicizzatori).
- Ogni finestra conserva la posizione del codice in cui è stata aperta, così è possibile individuare direttamente la causa di un rallentamento.

## v1.27.22 — 22 ottobre 2026

### Acquisizione: distinguere le serie omonime e cercare all'aggiunta

- Due serie della libreria con lo stesso nome ma anni diversi, come Scrubs (2001) e Scrubs (2026), richiedono ora un anno esplicito corrispondente alla serie corretta prima di un download automatico. Episodi, pacchetti stagionali e integrali ambigui sono esclusi.
- Le ricerche dirette di serie omonime includono il loro anno e utilizzano gli identificativi TMDb, IMDb o TVDB quando l'indexer li supporta.
- L'aggiunta approvata di un film o di una serie scatena una ricerca in una sezione dedicata, anche quando i compiti in background occupano la coda ordinaria. Se viene trovato un rilascio ammissibile, viene inviato al download senza attendere un compito pianificato. Le acquisizioni rimangono sequenziali e vengono evitati i duplicati.
- Gli aggiunti tramite l'assistente IA utilizzano lo stesso percorso. Le richieste che necessitano di approvazione mantengono la loro convalida preventiva.

## v1.27.21 — 22 ottobre 2026

### Desktop: connessione Plex tramite QR code

- Il pulsante "Connetti con Plex" mostra un QR code da scansionare con uno smartphone e un codice breve utilizzabile su plex.tv/link.
- Il desktop attende la convalida sullo smartphone, quindi apre automaticamente il profilo connesso, senza clic aggiuntivi.
- La connessione Plex abituale nel browser rimane accessibile a destra del QR code. Un codice scaduto può essere rinnovato e chiudere la finestra interrompe l'attesa.

## v1.27.20 — 22 ottobre 2026

### Windows: verifica avvio e diagnostica aggiornamento

- Il controllo di installazione attende che i servizi Movviz e Movviz Update siano attivi e che il server risponda con la versione attesa, invece di fallire su uno stato transitorio di avvio.
- I log del servizio sono salvati nella cartella prevista. Le diagnostiche Windows sono raggruppate prima del loro invio per evitare l'errore relativo ai file sparsi su più lettori.
- Il test di aggiornamento reale può essere avviato da un ramo: verifica il riavvio di Movviz e il mantenimento del processo Movviz Update durante l'installazione.

## v1.27.19 — 21 ottobre 2026

### Home: La mia lista su desktop, Android TV e Android mobile

- La lista personale appare nel quarto blocco di default, prima "Da rivedere", con gli aggiunti più recenti a sinistra.
- Riprende le schede esistenti e si aggiorna quando la lista cambia su un altro dispositivo. Le preferenze di visibilità vengono mantenute.
- L'applicazione Tizen sarà aggiornata in seguito.

### Assistente IA: identificazione titoli e verifiche fattuali

- L'assistente cerca prima nella libreria e riconosce lo stesso titolo con o senza spazi, come Vision Quest e VisionQuest. Le correzioni di tipo e anno vengono mantenute e i link riutilizzano l'identità verificata.
- Una richiesta di verifica sul web o di data di uscita scatena una ricerca quando viene attivata. L'assistente distingue una data annunciata da un'uscita confermata e indica quando la verifica non è disponibile.
- Una semplice verifica non può più provocare un aggiunta automatica, anche se il modello produce un'azione errata.

## v1.27.18 — 21 ottobre 2026

### Desktop: episodi aggiunti di recente raggruppati come su Android TV

- Sulla schermata principale e nella libreria Serie, diversi episodi aggiunti di recente di una stessa serie sono raggruppati in una singola scheda stagionale.
- Il badge indica il numero di episodi non visti di questa stagione e diventa un segno di spunta quando tutto è stato visto. Un episodio aggiunto da solo conserva il suo numero e la sua riproduzione diretta.
- Il raggruppamento precede il limite di schede: una stagione importata in blocco non nasconde più le altre serie recentemente arricchite.

## v1.27.17 — 20 ottobre 2026

### Interfaccia: tema mobile e tablet, banner e navigazione

- Il tema Beta si estende a telefoni e tablet con colori e superfici coerenti, un banner più leggibile e azioni compatte. I contatori sono stati rimossi dalla schermata principale.
- Su computer, un'illuminazione d'atmosfera prolunga i colori del banner e segue la riproduzione del suo trailer.
- La selezione della lingua è accessibile nel menu utente su tutti gli schermi. Sono stati regolati i margini della pagina dettagli, le etichette dei contatori e l'accessibilità del pulsante di chiusura delle novità.

### Windows: protezione del servizio di aggiornamento

- L'installatore disattiva la chiusura automatica delle applicazioni da parte di Windows per preservare il servizio Movviz Update durante l'installazione.
- I download PowerShell nascondono il loro progresso e il controllo di installazione in CI dispone di tempi e diagnostiche più precisi.

## v1.27.16 — 20 ottobre 2026

### Serie: i nuovi episodi sono finalmente recuperati

- L'elenco degli episodi di una serie veniva costruito solo al momento dell'aggiunta: episodi e stagioni annunciati successivamente (ad esempio la stagione 4 di Link Click, rimasta a 1 episodio su 12), così come i titoli e le date degli episodi pubblicati successivamente, non venivano mai recuperati.
- Un nuovo compito pianificato, "Aggiornamento episodi serie", viene eseguito una volta al giorno: aggiunge episodi e stagioni mancanti (solo le nuove stagioni per le serie seguite) e aggiorna titoli, date di trasmissione e nomi delle stagioni. Gli episodi già usciti diventano ricercabili, gli altri attendono la loro data di trasmissione.
- Nulla viene mai eliminato: file, download e link Plex rimangono intatti, e le serie la cui numerazione differisce da TMDb (alcuni anime) non vengono modificate.

## v1.27.15 — 20 ottobre 2026

### Barra laterale: pulsante di aggiornamento leggibile con lo zoom di accessibilità

- Con il testo ingrandito (110 % o 120 %), il pulsante "Nuovo aggiornamento disponibile" traboccava dalla barra laterale. Ora mostra un'etichetta breve ("Aggiornamento v1.27.15") e si ingrandisce se necessario invece di traboccare; il testo completo rimane visibile al passaggio del mouse.

## v1.27.14 — 20 ottobre 2026

### Trailer: un video sostitutivo quando YouTube blocca la riproduzione

- Alcuni trailer ufficiali non possono essere riprodotti al di fuori di YouTube (è il caso di quelli di Toei per Dragon Ball Super: Beerus). Quando tutti i video di un titolo vengono rifiutati, Movviz cerca ora un altro trailer, dando priorità ai canali ufficiali e agli editori di anime (Netflix, Crunchyroll…).
- I video rifiutati vengono memorizzati e non vengono più proposti, né sul web né sulle app Android.

## v1.27.13 — 20 ottobre 2026

### Home: le serie arrivano nel banner

- Il banner principale mostrava solo film: ora mette in evidenza anche le serie, alternandole con i film. Una nuova serie che Movviz sa che ti piace appare quindi non appena esce.
- Lato libreria, il banner tiene conto delle serie mai viste, di quelle aggiunte di recente, di quelle di cui è appena arrivato un episodio e del prossimo episodio in uscita delle serie seguite.
- Beneficia anche delle app Android TV e Android mobile, senza aggiornamento da parte loro.

## v1.27.12 — 20 ottobre 2026

### Home: banner più luminoso e più chiaro (computer)

- L'immagine della banner è nettamente più chiara, con un'ombra leggera sotto i testi per mantenerli leggibili.
- I badge tecnici (4K, HDR, MULTI, TrueHD…) hanno la loro riga, sotto i generi.
- "Informazioni" diventa "Più info", l'icona del pulsante Play è piena, e il testo dei pulsanti è un po' più grande.
- I motivi del suggerimento vengono visualizzati permanentemente in basso a destra, sotto le frecce di scorrimento, al posto del pulsante "Perché questo contenuto?".
- Il pulsante del suono passa in alto a destra, con un tratto più sottile; è di nuovo cliccabile.

### Interfaccia

- Il tema Beta diventa l'unico aspetto di Movviz: la scelta tra Stabile e Beta è rimossa dalle impostazioni.
- Barra laterale più stretta, link rialzati di un gradino e icone allineate identicamente, sia che la barra sia espansa o ritratta. Il pulsante per ritrarla o espanderla si trova ora in basso, sopra il profilo.

## v1.27.11 — 20 ottobre 2026

### Ricerca tollerante agli errori su Android TV, Android mobile e Samsung

- Le app Android TV, Android mobile e Samsung indicano ora "Risultati per …" quando un errore di battitura è stato corretto, come sul web.
- Su Android TV, la correzione trova anche i titoli già presenti nella libreria.

### Interfaccia web

- Correzione degli errori di visualizzazione al caricamento delle pagine: gli elementi di avvio dell'interfaccia sono ora posizionati nel punto giusto della pagina.

## v1.27.10 — 20 ottobre 2026

### Ricerca: più veloce, più chiara, tollerante agli errori

- Gli errori di battitura vengono corretti automaticamente: "harry potter", "matirx", "onepiece" o "il signore degli anelli" mostrano direttamente i titoli corretti, con la dicitura "Risultati per …" e un link per cercare il testo esatto.
- Durante la digitazione, i risultati precedenti rimangono visualizzati e sbiadiscono nel tempo del caricamento, invece di scomparire ad ogni lettera. Il messaggio "Nessun risultato" non appare più prima della fine della ricerca.
- Una riga "Altri titoli da scoprire" completa il titolo in fase di digitazione, e una sezione "In spirito simile" arricchisce le ricerche che danno pochi risultati.
- Quando nulla corrisponde, la pagina propone di cercare direttamente negli indicizzatori e mostra i film di tendenza.
- Un clic nella barra vuota mostra le ricerche recenti e le tendenze. Esc preme cancella la ricerca e lascia la barra, la freccia giù scende nei risultati.
- Una ricerca crea ora un solo elemento nella cronologia del browser, e cancellare la barra riporta immediatamente al catalogo.
- Durante una ricerca, vengono visualizzati solo i filtri di ricerca; le persone senza foto non vengono più proposte.

### Aspetto: il tema Beta di default

- Il tema Beta è ora quello di tutti gli account, dal primo visualizzamento e senza passare dal tema Stabile. Il tema Stabile rimane disponibile nelle impostazioni.

## v1.27.09 — 20 ottobre 2026

### Download: WebTorrent diventa il motore unico

- Rimozione dei motori aria2 e rTorrent, del selettore di motore nelle impostazioni e delle loro dipendenze negli installatori Windows, Linux e Docker. WebTorrent rimane il motore integrato per film e serie TV.
- Le vecchie selezioni di motore sono riprese con WebTorrent senza cancellare la coda, i file né la cronologia. Se il ripristino di un download fallisce, la coda salvata viene mantenuta per consentire un nuovo tentativo.

### Windows: aggiornamenti indipendenti da Movviz

- Il nuovo servizio "Movviz Update" controlla il download ufficiale tramite SHA256, installa l'aggiornamento e conferma che la versione attesa risponda dopo il riavvio. Rimane attivo quando l'installatore interrompe Movviz e conserva i log in caso di fallimento.
- L'impostazione automatica disattivata continua ad autorizzare solo gli aggiornamenti richiesti con un clic. È necessaria un'installazione manuale di questa versione per la prima volta per creare il servizio, senza perdere dati o impostazioni.
- Il test di compilazione Windows genera ora la propria icona, come l'installatore di produzione, per funzionare anche su un runner vuoto.

## v1.27.08 — 20 ottobre 2026

### Windows: installazione del servizio Movviz Update

- Il servizio indipendente "Movviz Update" scarica e controlla l'installatore ufficiale, riavvia Movviz e verifica la versione in funzione, con log conservati. L'impostazione automatica disattivata continua ad autorizzare solo le installazioni richieste con un clic.
- Correzione del controllo dei test PowerShell che impediva la creazione del precedente installatore Windows. Installare questa versione manualmente per la prima volta per creare il nuovo servizio; dati e impostazioni sono conservati.

## v1.27.07 — 20 ottobre 2026

### Windows: un servizio indipendente per gli aggiornamenti

- Il nuovo servizio "Movviz Update" installa gli aggiornamenti senza interrompere Movviz, quindi verifica che la nuova versione risponda dopo il riavvio. Il download è controllato dalla sua impronta SHA256 e i log di installazione sono conservati per diagnosticare un fallimento.
- L'impostazione di aggiornamento automatico viene rispettata all'apertura dell'interfaccia: quando è disattivata, viene avviata solo un'installazione richiesta con un clic. L'interfaccia segue ora l'installazione fino al ritorno della versione attesa e visualizza gli errori.
- Per creare questo nuovo servizio su un'installazione esistente, installare questa versione manualmente per la prima volta. Dati e impostazioni sono conservati.

## v1.27.06 — 20 ottobre 2026

### Android TV: la scheda di un episodio risponde di nuovo al telecomando

- Aprendo la scheda di un episodio da una stagione, nessun pulsante era selezionato e il telecomando non rispondeva più: lo schermo rimaneva bloccato. Il pulsante "Riproduci" (o "Indietro") è di nuovo selezionato all'apertura e tutte le azioni sono accessibili.

### Home: meno lampeggi nel hero

- Cambiando la vetrina nel hero, l'immagine passava brevemente al nero prima di mostrare la successiva. La nuova immagine ora si sovrappone direttamente alla precedente, una volta caricata, su Android TV come sui televisori Samsung.

## v1.27.05 — 19 ottobre 2026

### Nuovo logo "M nastro"

- Il nuovo logo di Movviz, una M in nastro viola, arriva nel design beta sul web: logo completo nella barra laterale, al login, all'installazione, nel lettore e in "Informazioni", e M da solo quando la barra è ripiegata, con un leggero riflesso che lo attraversa ogni tanto.
- Su Android TV, Google TV e Android mobile, diventa l'icona dell'app, il banner dello schermo iniziale di Google TV e il logo visualizzato nell'app. Sui televisori Samsung, diventa anche l'icona e il marchio dell'app.

### Design beta: uno schermo di caricamento sobrio e istantaneo

- Nuovo schermo di caricamento sul web e su Android TV: la M al centro su uno sfondo viola, con il suo bagliore, MOVVIZ sotto e una sottile barra che segue il vero caricamento. Appare all'apertura della pagina, anche prima che l'applicazione sia caricata, e pesa solo poche decine di kilooctetti.
- Il design stabile mantiene il suo attuale schermo di caricamento.

### Android TV: un eroe immobile

- Navigare tra i pulsanti dell'eroe della home face tremare l'intera pagina. Ora rimane perfettamente immobile.

## v1.27.04 — 19 ottobre 2026

### Ricerca: ogni serie mantiene i propri download

- Un rilascio con esattamente lo stesso nome di un altro film o di un'altra serie della libreria non viene più assegnato a un titolo più lungo che lo contiene: l'intera "Dragon Ball Super" non è più considerata "Dragon Ball Super: Beerus", che è un'altra serie. Questo vale per la ricerca automatica, i feed RSS e le sostituzioni di versione. I rilascio che omettono semplicemente un sottotitolo vengono ancora riconosciuti, e i nomi alternativi aggiunti manualmente su una scheda rimangono prioritari.

## v1.27.03 — 19 ottobre 2026

### Il design stabile adotta il design beta di questa mattina

- Il design stabile riprende esattamente il design beta come era il 19 ottobre al mattino, prima del nuovo logo e del nuovo schermo di caricamento: colori, barra laterale, schede e layout su computer, così come lo schermo di caricamento cinema (proiettore, aloni, logo completo e percentuale). Il design beta continua a evolvere da parte sua.

### Analisi dei file affidabile dopo un grande import

- Dopo l'importazione di un gran numero di episodi in una volta (un'intera stagione), l'analisi dei file (codec, tracce audio e sottotitoli) poteva interrompersi fino al successivo riavvio, e sovraccaricare il server nel processo. Ora rimane disponibile, senza picchi di carico.

## v1.27.02 — 19 ottobre 2026

### Aggiornamenti: non più proporre una versione precedente

- Dopo un aggiornamento, la barra laterale poteva ancora proporre di "installare" la versione precedente, basandosi su un'informazione memorizzata prima del deployment. Ora un aggiornamento viene proposto — e installato automaticamente su Windows — solo se è effettivamente più recente della versione corrente.

## v1.27.1 — 19 ottobre 2026

### Bleach: l'intera stagione scaricata è correttamente archiviata nella libreria

- Un'intera stagione di Bleach scaricata e correttamente archiviata sul disco poteva non apparire da nessuna parte in Movviz: bastava che un solo episodio non fosse più riconosciuto come atteso per far rifiutare tutto il lotto. Ogni file viene ora verificato individualmente in base alla posizione in cui è stato effettivamente archiviato (stagione, cartella, nome), e gli episodi interessati diventano disponibili senza dover scaricare nulla.
- Nessun file esistente viene mai sostituito o eliminato da questo recupero, e un episodio atteso da un altro download rimane riservato a quest'ultimo.

## v1.27.0 — 19 ottobre 2026

### Design beta: uno schermo di caricamento fluido che parte solo quando è tutto pronto

- L'animazione dello schermo di caricamento è ora calcolata separatamente dal resto della pagina: rimane perfettamente fluida (60 fotogrammi al secondo) anche mentre la dashboard si prepara dietro, dove prima presentava scatti. È anche più leggera da disegnare, specialmente su grandi schermi.
- Lo schermo di caricamento appare velocemente e scompare solo quando tutto ciò che è visibile sullo schermo è caricato — dati, archiviati, locandine e font: nulla viene più caricato agli occhi dopo la sua scomparsa.

### Dashboard più veloce

- I dati della dashboard iniziano a scaricarsi all'apertura della pagina, contemporaneamente all'applicazione, invece di aspettare che sia pronta.

### Tecnica

- Passaggio a Next.js 16.3.

## v1.26.056 — 19 ottobre 2026

### Dashboard più veloce

- I dati del dashboard (libreria, righe di raccomandazione, banner iniziale, "Riprendi") sono ora compressi prima dell'invio: diversi megabyte in meno ad ogni apertura, cosa che si nota soprattutto da remoto. Anche le app Android ne traggono beneficio, senza aggiornamenti.

### Design beta: schermata di caricamento più veloce e sobria

- La schermata di caricamento appare più velocemente: le sue immagini rimangono in cache nel browser, la scena viene visualizzata non appena l'ambientazione è pronta e i neon si accendono dolcemente dopo. L'ambientazione della schermata di caricamento è visibile immediatamente, anche prima del caricamento dell'applicazione.
- La sua scomparsa è un semplice dissolvenza, senza zoom o bagliore finale.

### Design beta web: barra laterale

- Barra laterale leggermente più stretta, logo centrato; ripiegata, rimane solo il simbolo "O".

## v1.26.055 — 19 ottobre 2026

### Design beta: ritorno al viola, nuova schermata di caricamento e nuovi loghi

- Il design beta recupera il suo viola (l'oro della versione precedente è abbandonato) su web e su Android TV.
- Nuova schermata di caricamento viola, su web e su Android TV: un grande corridoio luminoso 21:9 (aggiustato esattamente in 21:9, lati ritagliati in 16:9, il testo del logo sempre intero sugli schermi stretti). La luce scorre dolcemente lungo le vere linee della scena — pavimento, soffitto, pilastri, contorno del triangolo — con un riflesso cromato sul logo e una barra che segue l'avanzamento reale. Le animazioni rimangono discrete.
- Nuovi loghi viola cromatici (simbolo "O", formato completo piccolo e grande), animati senza alone attorno alla "O", ovunque appare il logo in beta, incluso il README.
- Android TV: avvio sempre veloce (immagini decodificate in background, versione leggera visualizzata subito), con "riduci animazioni" la scena rimane immobile.

## v1.26.054 — 19 ottobre 2026

### Design beta: un oro scuro al posto del viola, su web e su Android TV

- I viola e malva del design beta diventano un oro scuro, nella stessa tonalità del logo: pulsanti di azione principali, stati attivi, barre di avanzamento, contorni di focus, filtri e bagliori. Luminosità e trasparenza originali sono mantenute affinché tutto rimanga leggibile. Il design stabile non cambia.
- Su Android TV, la barra di navigazione prende esattamente lo stesso sfondo del resto dello schermo: un unico piatto.

### Android TV beta: nuova schermata di caricamento e nuovo logo

- Nuova schermata di caricamento cinematografica a schermo intero (la barra di navigazione rimane nascosta sotto): muro di schermi illuminato in diretta, riflessi che scorrono sugli angoli arancioni, luce sulle lettere del logo, braci, e una barra che segue l'avanzamento reale con il messaggio del passaggio corrente. Un bagliore segna la fine.
- Avvio al più presto: le immagini vengono decodificate in background non appena l'applicazione viene avviata, una versione leggera della stessa scena viene visualizzata immediatamente in attesa, e nulla viene calcolato all'esecuzione (maschere e alone sono forniti pronti all'uso). Con "riduci animazioni", la scena rimane immobile.
- Il logo completo piccolo animato sostituisce il simbolo e il testo ovunque (selettore profilo, connessione, installazione, lettore, barra estesa). Barra ripiegata: rimane solo il simbolo "O" animato, più grande e centrato.

### Design beta web: logo ovunque, barra laterale snella

- Il logo completo piccolo animato viene visualizzato ovunque (connessione, installazione, lettore, Info); nella barra laterale lascia spazio al simbolo "O" animato quando è ripiegata.
- Nella barra laterale, il logo è spostato leggermente a sinistra e la linea di separazione sotto l'intestazione è scomparsa.

## v1.26.053 — 19 ottobre 2026

### Design beta: lo splash parte istantaneamente, logo completo nella barra laterale

- Lo schermo di caricamento appare non appena si apre la pagina, senza attendere il caricamento dell'applicazione: viene visualizzata subito un'atmosfera sfocata della scena, e poi la scena animata appare in dissolvenza sopra non appena è pronta. L'immagine di sfondo è precaricata, e la dissolvenza iniziale al nero è scomparsa.
- Nella barra laterale della beta design, il logo completo animato in formato ridotto sostituisce la "O" e il testo quando la barra è estesa; quando è ritratta, rimane solo la "O" animata.
- Il logo di MOVVIZ è meglio spaziato: la distanza tra la "O" e la prima "V", e tra l'ultima "V" e la "I", è ora omogenea con il resto delle lettere.

## v1.26.052 — 19 ottobre 2026

### Beta Design: nuovo schermo di caricamento e nuovo logo

- All'avvio, il beta design mostra un nuovo schermo di caricamento cinematografico: muro di schermi, riflessi che scorrono sui bordi arancioni, luce che spazza le lettere del logo, braci, e una barra che segue il reale progresso del caricamento. Un lampo di luce segna la fine.
- Lo schermo si adatta a tutti i formati: 16:9, ultra-wide 21:9 (la scena si estende su entrambi i lati senza stiramento) e telefono in verticale. Viene renderizzato alla risoluzione reale dello schermo, quindi nitido su schermi ad alta definizione.
- La dicitura "I vostri universi in un unico luogo" è tradotta in cinque lingue. Con l'opzione "ridurre le animazioni", la scena rimane immobile.
- Nuovo logo in tre formati vettoriali: il simbolo "O" da solo, il logo completo in formato ridotto e il logo completo in formato grande, con le loro versioni animate (scorrimento di luce sulle lettere, senza alone attorno alla "O"). Il beta design mostra il nuovo simbolo animato nella barra laterale, nella connessione e nelle impostazioni.
- Il design stabile non cambia. Il logo del README di GitHub è sostituito dalla versione animata.

## v1.26.051 — 19 ottobre 2026

### Schede: lo stato viene visualizzato subito

- All'apertura di una scheda (web, Android TV, mobile, Samsung), lo stato (nella libreria, episodi mancanti o disponibili) viene visualizzato immediatamente. Prima, la pagina attendeva che Movviz interrogasse Plex, cosa che poteva richiedere una decina di secondi per Bleach durante i quali mostrava "Aggiungi alla libreria".
- La verifica con Plex avviene ora in background, al massimo una volta al minuto e per serie, e la scheda si aggiorna da sola quando trova novità. Il percorso di Plex specifico per Bleach viene conservato per dieci minuti invece di essere rifatto ad ogni apertura.
- Il contatore dei download nella barra laterale non trattiene più il caricamento delle pagine: risponde con l'ultimo valore noto e si aggiorna in background.

## v1.26.050 — 19 ottobre 2026

### Bleach: i loghi giapponesi della serie originale nel selettore

- Il selettore di logo di Bleach mostra ora anche i loghi giapponesi, incluso il classico logo rosso e blu "BLEACH ブリーチ" della serie originale, che non esiste in francese né in inglese.
- Il logo selezionato automaticamente e le altre serie non cambiano.

## v1.26.049 — 19 ottobre 2026

### Bleach: la ricerca manuale trova gli episodi di Thousand-Year Blood War

- La selezione manuale di un episodio di Thousand-Year Blood War cercava solo i rilascio nominati per stagione ("S04E01") e non trovava nulla per gli episodi pubblicati con numerazione continua ("S17E41"). Ora interroga entrambe le forme e visualizza tutti i rilascio corrispondenti all'episodio.
- La selezione manuale di un intero arco cerca anche i pacchetti pubblicati sotto "Bleach S17".

## v1.26.048 — 19 ottobre 2026

### Android e Samsung: Thousand-Year Blood War leggibile nei download

- Le liste dei download di Android TV, Android mobile e Samsung mostrano "Bleach: Thousand-Year Blood War" con la sua stagione e il suo episodio (ad esempio S4 · E1), invece di "Bleach S17E41". Le altre serie non cambiano.
- Il tracciamento dei download nelle schede non è modificato: gli episodi rimangono associati esattamente come prima.

## v1.26.047 — 19 ottobre 2026

### Bleach: le intere se collocano nelle stagioni corrette

- Un intero (numerazione assoluta da 1 a 366, file "Bleach - 150", "S01E150", o cartelle di stagione) colloca ora ogni episodio nella sua stagione Movviz. Prima, venivano collocati solo i primi episodi e gli altri rimanevano non abbinati, o l'importazione falliva.
- L'intero di Thousand-Year Blood War (episodi 1-50) viene suddiviso automaticamente nelle 4 stagioni della serie, indipendentemente dalla numerazione dei file.
- Un pacchetto di una singola stagione mantiene la sua numerazione locale, senza confusione con quella assoluta.

### Download: Thousand-Year Blood War visualizzato come serie propria

- La lista, la cronologia e le ricerche mostrano "Bleach: Thousand-Year Blood War" con la sua stagione e il suo episodio (ad esempio S4E1), invece di "Bleach S17E41".
- Un clic apre la scheda della serie corretta. L'organizzazione dei file non è cambiata.

### Home: banner in primo piano snello

- I punti di paginazione sono centrati in basso, il pulsante pausa e il testo "In anteprima" scompaiono.

### Loghi titolo: finiscono sempre per apparire

- Quando un logo non è immediatamente disponibile, Movviz riprova più a lungo, con ritardi crescenti. Il testo del titolo funge da segnaposto, quindi il logo lo sostituisce non appena arriva, sul banner, nelle schede e nelle file.
- Una risposta senza logo non viene più conservata per un giorno intero dal browser: un incidente passeggero non nasconde più il logo fino alla sessione successiva.

## v1.26.046 — 19 ottobre 2026

### Android TV e mobile: stato di riparazione Bleach affidabile

- Le schede Bleach utilizzano ora la proiezione di parte richiesta e il flag di riparazione fornito dal server. Una riga compatta sulla dashboard non può più far credere che TYBW debba essere riparato se il suo ordine è già corretto.
- Su Android TV, l'azione di riparazione è cliccabile e riservata agli amministratori; mostra l'anteprima e richiede conferma prima di modificare i dati. I blocchi indicano perché la riparazione è impossibile.
- Il focus di apertura punta a un'azione reale della scheda; il titolo decorativo non riceve più un contorno di selezione.
- Tizen non ha un'azione equivalente di aggiunta o riparazione Bleach nella sua scheda.

## v1.26.045 — 19 ottobre 2026

### Android TV: focus stabile all'apertura delle stagioni

- Il blocco di apertura non riprende più il focus quando l'utente naviga volontariamente verso una stagione. Un reindirizzamento in corso viene annullato non appena la stagione viene selezionata.
- Tizen non ha un reindirizzamento differito equivalente; la sua navigazione stagionale rimane invariata.

## v1.26.044 — 19 ottobre 2026

### Android TV: aggiunta biblioteca Bleach affidabile

- Dopo l'aggiunta, Android TV rilegge la parte Bleach selezionata e conserva separatamente le viste Original e TYBW. Il pulsante "Aggiungi alla biblioteca" non riappare più durante la riconciliazione.
- Le ricerche di stagione liberano sempre il loro indicatore di caricamento, anche se la richiesta fallisce o viene annullata.
- Tizen rimuove il pulsante di aggiunta non appena il server conferma l'aggiunta, per mantenere lo stesso comportamento.

## v1.26.043 — 18 ottobre 2026

### Android TV: navigazione e separazione Bleach/TYBW

- Le file di riga TV eliminano le schede duplicate prima di creare le loro chiavi Compose, evitando così il crash durante la navigazione nelle suggerimenti.
- I recenti aggiunti di Bleach originale e di Thousand-Year Blood War rimangono separati. Gli episodi TYBW utilizzano i numeri dei corsi 1–4 sullo schermo, mantenendo la stagione 17 canonica per la visione e il tracciamento.
- Il caricamento delle stagioni ignora ora le risposte tardive di un'altra parte di Bleach, anche se entrambe le schede condividono lo stesso identificativo TMDb.

## v1.26.042 — 18 ottobre 2026

### Numerazione Bleach e ricerca TYBW

- Android TV riprende gli otto stessi loghi di piattaforma del dashboard desktop, caricati dai file SVG sorgente del progetto.
- Le integral originali numerate S01E001–S01E366 vengono ridistribuite nelle 16 stagioni e nei loro dossier stagionali, con il rinominamento locale previsto.
- TYBW mantiene il suo tracciamento interno S17 e i suoi corsi 1–4 in dossier distinti. La ricerca di un episodio come S17E41 accetta i rilascio S17 o S04E01, ed esclude i pacchetti degli altri corsi.
- Android TV, Android mobile e Tizen trasmettono la parte Bleach selezionata durante il caricamento e l'aggiornamento delle stagioni; S17 non viene più riportato nella scheda originale.

## v1.26.041 — 18 ottobre 2026

### Bleach: download e schede complete

- I cataloghi Bleach già distribuiti su 16 stagioni sono riconosciuti senza migrazione né modifica della cronologia. I download manuali funzionano anche per una stagione non tracciata o già disponibile; i pacchetti TYBW mantengono la loro numerazione e il loro dossier indipendente.
- Entrambe le schede dispongono di ricerca integrale, lista personale, valutazione, aggiornamento dei metadati e cancellazione mirata. I profili di qualità, alias e scelte personali rimangono indipendenti.
- Le 16 stagioni di Bleach ricevono una copertina e un riassunto del loro arco. Bleach e Thousand-Year Blood War dispongono di loghi distinti, con una versione ad alta definizione per TYBW.

## v1.26.040 — 18 ottobre 2026

### Bleach e TYBW su tutti gli schermi

- Android mobile, Android TV e Samsung Tizen mostrano entrambi i risultati Bleach e Thousand-Year Blood War. La navigazione conserva la parte scelta, e le azioni di riproduzione, tracciamento e ricerca utilizzano gli episodi corrispondenti.
- Entrambe le schede ritrovano lo stesso editore degli altri titoli, con scelte di sfondo e logo indipendenti, mantenute dopo il ricaricamento e nelle liste.
- I nuovi download sono collocati in due dossier distinti, Bleach (2004) e Bleach - Thousand-Year Blood War (2022), con il loro identificativo IMDb in un file `.plexmatch`. TYBW riprende la numerazione di ogni parte, mentre le coordinate di tracciamento Movviz rimangono stabili. I vecchi file non vengono spostati automaticamente.
- La sincronizzazione riconosce le schede Plex indipendenti di TYBW, anche rinominate, e mantiene un link Plex per parte. Il rinominamento generico non può più riunire i loro dossier. Un motore troppo vecchio blocca questi nuovi import invece di ignorare l'organizzazione richiesta.

## v1.26.039 — 18 ottobre 2026

### Ricerca da una riga

- Dopo "Vedi tutto", un inserimento nella barra di ricerca interroga ora il catalogo anziché continuare a caricare la riga precedente. Entrambe le schede Bleach e Thousand-Year Blood War appaiono anche in questo percorso, come in una ricerca diretta.

## v1.26.038 — 18 ottobre 2026

### Bleach e Thousand-Year Blood War separati

- La ricerca e la libreria presentano due schede distinte: Bleach (2004), con le sue 16 stagioni e 366 episodi, e Bleach: Thousand-Year Blood War (2022), organizzata per parti. Gli identificativi fornitori e la cronologia vengono mantenuti.
- Le ricerche, richieste, download manuali e automatici, sostituzioni di qualità e azioni di follow-up sono limitati alla parte selezionata. TYBW S02E01 corrisponde al primo episodio di The Separation e non può più essere confuso con Bleach original S02E01. Anche i titoli giapponesi e i nomi delle parti sono riconosciuti.
- Il motore distingue i numeri dei file sorgente, il tracciamento Movviz e la denominazione prevista da Plex. I pacchetti sono limitati agli episodi effettivamente coperti; le coordinate vengono mantenute al riavvio e a un nuovo tentativo di importazione.
- I vecchi cataloghi con ordine certo vengono riorganizzati con salvataggio preliminare, senza spostamento dei file né cancellazione del tracciamento. Gli storici e gli istantanee Plex ambigui bloccano le correzioni rischiose; nessun contenuto reale è dedotto da un semplice nome file.
- La scheda TYBW utilizza il suo sinossi, il suo poster e la sua prima trasmissione. L'aggiunta di una parte mancante completa lo stesso catalogo, anche quando esisteva già una stagione vuota. I titoli lunghi delle stagioni rimangono leggibili su mobile.

### Home

- Rimozione della riga "Trovare l'ispirazione". La scelta Stable/Beta e l'avvio diretto nell'aspetto salvato sono mantenuti.

## v1.26.037 — 18 ottobre 2026

### Home alleggerito

- Rimozione dei testi "Il cinema, a casa tua" e "La tua prossima grande storia" dalla home Beta.
- Rimozione dell'etichetta visibile "Piattaforme" e della sua colonna riservata: i loghi occupano direttamente la larghezza disponibile.

## v1.26.036 — 17 ottobre 2026

### Una Beta più cinematografica

- La home Beta adotta una composizione editoriale: grande apertura tipografica, eroe incorniciato, immagini in primo piano e righe più ariose. La navigazione passa a una selezione avorio su grafite e la ricerca riceve una nuova superficie.
- Lo splash Beta apre tende di proiezione, rivela il logo da una fessura luminosa e dispiega due orbite. I fasci e il riflesso di progressione accompagnano il caricamento; l'uscita avviene in avvicinamento e dissolvenza, senza aggiungere ritardo di attesa.
- Stable mantiene il suo rendering, il suo vecchio splash e la sua geometria. La scelta dell'account rimane applicata dal primo HTML; le preferenze di riduzione delle animazioni rimangono rispettate.

## v1.26.035 — 17 ottobre 2026

### Aspetto Stable / Beta

- Impostazioni → La mia esperienza → Aspetto e anteprime ora offrono una scelta personale Stable o Beta, salvata sull'account e applicata senza ricaricamento. Stable mantiene l'interfaccia attuale; un errore di salvataggio ripristina la modalità precedente.
- La scelta salvata si applica dal primo rendering server: un account in Beta parte direttamente in Beta, senza apparizione intermedia di Stable, anche quando l'API delle preferenze è lenta a rispondere.
- La modalità Beta affina la tipografia desktop, gli spaziature, le schede e i badge. Le azioni principali danno un feedback tattile discreto; la riduzione delle animazioni rimane rispettata. La scheda titolo rimane condivisa tra la pagina e il pannello.

### Un'apertura cinematografica

- Lo splashscreen Beta accoglie l'avvio con il logo ufficiale ingrandito, fasci viola e ciano, un alone luminoso e una progressione ridisegnata. Si adatta ai piccoli schermi e mantiene una versione calma con la riduzione dei movimenti.
- Il vecchio splash rimane disponibile in Stable. La nuova animazione non aggiunge tempo di attesa al caricamento e non viene riprodotta ad ogni navigazione.

### Affidabilità del frontend

- Correzione di sette errori ESLint identificati nell'eroe e nella scheda titolo: inizializzazione della galleria, rilevamento mobile, tipizzazione dell'orientamento e dichiarazioni delle funzioni di ricerca/lettura.
- La posizione di ripresa è collegata al media corrente per evitare di mostrare quella del titolo precedente; viene riletta dopo la chiusura del lettore.

## v1.26.034 — 15 ottobre 2026

### Ricerca e download dopo una richiesta

- L'aggiunta di un film o di una serie avvia ora un compito di ricerca lato server, senza mantenere aperta la richiesta del telefono durante le chiamate agli indicizzatori. La ricerca continua dopo la risposta e rimane visibile nei compiti.
- Una richiesta di download per un titolo già presente ma incompleto riavvia gli elementi mancanti. I clic ripetuti condividono lo stesso compito; i media disponibili, i contenuti non tracciati, i download senza ricerca e le richieste in attesa di approvazione rimangono protetti.
- L'approvazione di una richiesta utilizza anche questa coda; un errore di aggiunta non marca più prematuramente la richiesta come approvata.

### Reimmissione seed e Android TV

- I torrent importati possono condividere i file rinominati dopo la verifica delle loro impronte, in sola lettura. I percorsi e i metadati del torrent vengono mantenuti dopo il riavvio; l'interfaccia distingue tra verifica, condivisione completa, condivisione parziale e file non disponibili.
- La convalida continua esegue i test del motore di download, inclusa la condivisione dopo l'importazione.
- Android TV utilizza Media3 1.9.4.

## v1.26.033 — 14 ottobre 2026

### Android mobile: zoom senza ritaglio nel vecchio formato

- Il contenitore video mantiene tutta l'area disponibile. Lo zoom ridimensiona l'area nativa mantenendo le proporzioni, invece di ingrandire l'immagine in un formato 16:9 che poteva ancora tagliare i lati nonostante lo spazio libero.
- Il riquadro viene aggiornato non appena il rilevatore conferma le strisce nere integrate, senza attendere un'altra azione sul lettore. Il rilevatore e le sue protezioni per le scene scure sono mantenuti.
- Due pulsanti distinti "Adatta" e "Riempimento" sono visibili nei comandi; la modalità attiva è evidenziata e la scelta rimane memorizzata per profilo sul dispositivo.

## v1.26.032 — 14 ottobre 2026

### Android mobile: visualizzazione adattata per telefoni e tablet

- Il lettore visualizza di default l'intera immagine senza distorsioni, adattando larghezza o altezza all'area disponibile. Un pulsante consente di passare tra "Adatta" e "Riempimento"; la scelta è memorizzata sul dispositivo per ogni server e profilo.
- Il rilevatore di strisce nere integrate è mantenuto. In modalità Adatta, lo zoom tiene conto delle dimensioni del lettore per mantenere visibile tutta l'immagine utile, anche su tablet; in modalità Riempimento, l'immagine viene ritagliata per occupare lo schermo.
- I cambiamenti di dimensione e modalità del lettore sono presi in considerazione anche in pausa. I comandi possono passare su più righe in una finestra stretta.
- I gesti verticali di luminosità e volume sono stati rimossi. I doppi tocchi per avanzare o tornare indietro e lo scorrimento sulla timeline sono mantenuti.

## v1.26.031 — 13 ottobre 2026

### "Cancella riproduzione": il profilo torna vuoto

- Il pulsante cancella ora anche la lista, gli appunti, i gusti e la memoria dell'assistente IA, così come la conversazione con esso. Il profilo stesso (nome, foto, password, impostazioni) non viene modificato.
- Lato Plex, oltre a visti e riprese, vengono cancellati gli appunti e la watchlist del profilo, sempre solo con l'account Plex di quel profilo. Un profilo gestito senza account Plex mantiene la sua watchlist Plex, e lo schermo lo segnala.
- Una vecchia watchlist Plex risincronizzata non torna in Movviz.
- I messaggi di avviso (web, Android mobile, Samsung) indicano ora esattamente cosa viene eliminato e cosa rimane.

## v1.26.030 — 13 ottobre 2026

### Profilo: nuovo pulsante "Cancella riproduzione"

- Ogni profilo può ricominciare da zero lato visione: vengono cancellati i titoli visti, le riprese in corso e la cronologia di riproduzione. Gli appunti, la lista e i gusti del profilo rimangono.
- Due avvisi prima di agire: una prima conferma, seguita da un ultimo schermo dove è necessario ritipare "CANCELLA" (web e Android mobile) o spuntare "ho capito" (Samsung).
- Solo il profilo connesso viene cancellato, mai quello di un altro, e ogni utente può farlo per il proprio profilo.
- Se il profilo è collegato a Plex, anche il suo stato di visione e i suoi ripassaggi vengono cancellati, solo con l'account Plex di quel profilo: le visualizzazioni degli altri account Plex non sono toccate. Il risultato lato Plex viene mostrato una volta terminato, e se Plex non è riuscito a cancellare tutto, è chiaramente indicato.
- Le vecchie visualizzazioni non vengono ripristinate con la successiva sincronizzazione Plex. Una vera visione effettuata dopo la cancellazione viene conteggiata normalmente.
- Disponibile sul web (pagina Profilo), sull'app mobile Android (menu del profilo) e sull'app Samsung (pagina Profilo).

## v1.26.029 — 13 ottobre 2026

### Assistente IA: elenco modelli Gemini aggiornato

- Google ha ritirato Gemini 3.5 Flash e Gemini 3.7 Flash l'8 ottobre. Gemini 3.6 Flash sostituisce 3.5 Flash nei modelli consigliati, e 3.7 Flash scompare dall'elenco.
- Se l'assistente era impostato su uno di questi due modelli, passa automaticamente al suo sostituto (3.6 Flash o 3.8 Flash), come fa già Google da parte sua.

## v1.26.028 — 12 ottobre 2026

### Assistente IA: i modelli non vengono più testati ad ogni apertura delle impostazioni

- Impostazioni → Assistente IA testava ogni modello Gemini con una vera richiesta ad ogni apertura, consumando la quota gratuita giornaliera. Il risultato è ora salvato in memoria e i test vengono eseguiti una volta alla settimana.
- Un modello con la quota giornaliera esaurita viene riconosciuto come disponibile, invece di essere contrassegnato come "non verificato" e ritestato.
- Un test che non è riuscito (rete, limite al minuto) viene rieseguito al massimo una volta al giorno.

## v1.26.027 — 12 ottobre 2026

### Un'unica interfaccia sul web: Beta diventa l'aspetto di Movviz

- Il tema Stable è stato rimosso dal web (desktop e mobile). L'interfaccia Beta si applica ora a tutti, inclusi gli account che avevano scelto Stable. Le altre impostazioni della dashboard (eroe, video, righe) sono mantenute.
- La scelta Stable/Beta scompare dalle impostazioni della dashboard e dall'assistente di installazione.
- Android TV mantiene per ora la propria scelta Stable/Beta. L'app mobile Android e l'app Samsung avevano un solo aspetto: nulla cambia per loro.

## v1.26.025 — 12 ottobre 2026

### Sincronizzazione visualizzazioni Plex: molto più veloce dopo un grande aggiornamento di Plex

- Dopo un grande aggiornamento di Plex, la sincronizzazione delle visualizzazioni poteva durare quasi 9 minuti e bloccare il server fino a 7 secondi: ogni film visto veniva ricontrollato con una richiesta separata a Plex. Questi controlli sono ora raggruppati per 50, e la sincronizzazione restituisce il controllo del server molto più spesso.
- Un lotto insolito come questo (più di 500 cambi di visualizzazione in una volta) viene segnalato nel log, per individuare un Plex che ha riassegnato i suoi identificativi.

## v1.26.024 — 12 ottobre 2026

### Compiti pianificati: più leggeri, un compito pesante alla volta

- Mai due compiti pesanti contemporaneamente (scansione disco, ripristino mancanti, aggiornamenti, metadati TMDb, riconciliazioni, diagnostica, benchmark). I piccoli compiti frequenti (stato dei download, RSS, Seerr, Plex) e le tue azioni continuano in parallelo.
- Una ricerca manuale pesante ("Cerca mancanti", analisi tecnica, risincronizzazione visualizzazioni Plex o TVDB, scansione saghe) passa davanti: il compito pesante automatico in corso viene messo in pausa e riprende subito dopo.
- Nessun compito pianificato nei primi 3 minuti dopo l'avvio del server, tranne quelli dei download.
- Nuovo pulsante "Interrompi" su ogni compito in corso o in attesa, in Impostazioni → Compiti pianificati e nella coda.
- Impostazioni → Lavori pianificati mostra il «peggiore gelo» di ogni lavoro (quanto tempo ha bloccato il server), i lavori pesanti e i nomi dei tre lavori che mostravano male.
- Gli intervalli dei lavori sono riportati ai valori predefiniti una sola volta con questa versione. Quelli che vengono impostati dopo vengono conservati.

### Meno gelo del server

- La scansione del disco non blocca più il server ogni ora: legge il disco senza bloccare e confronta solo i file non ancora collegati.
- La scansione RSS non ricontrolla più l'intera cache ad ogni passaggio: una nuova release viene confrontata con tutti i titoli mancanti, un titolo viene aggiunto a tutte le release della cache, e viene eseguito un passaggio completo all'avvio e poi una volta al giorno. Un estratto giornaliero viene sempre recuperato entro 15 minuti dal suo arrivo sugli indicizzatori.
- Il controllo degli aggiornamenti qualità segue lo stesso principio.
- Il refresh dei metadati TMDb registra solo i titoli che sono cambiati.
- Quando l'aggiornamento automatico è attivo, il controllo delle sostituzioni suggerite non esegue più la stessa ricerca. L'aggiornamento automatico segnala da sé le sostituzioni che non è riuscito a scaricare. Disattivato, il controllo funziona come prima.
- L'aggiornamento automatico non conta più come «aggiornato» un film il cui download è fallito.
- Intervalli rivisti: aggiornamento automatico ogni 12 ore (invece di 6 ore), lista di monitoraggio Plex ogni 5 min (invece di 1 min, senza una riga di log per utente e per minuto). Il riavvio dei film mancanti passa davanti ai lavori di manutenzione.

### Punti di priorità

- I cursori non inviano più una richiesta per ogni pixel trascinato e non tornano indietro da soli.
- Il cursore «Download» serve finalmente a qualcosa: sopra i 50, un download attivo riduce gli altri lavori a 2 in parallelo. Al di sotto, non li rallenta.
- Aggiunto il cursore delle intro Plex, che mancava.

## v1.26.023 — 12 ottobre 2026

### Modifiche
- Ripubblicazione del codice esatto della v1.26.021 con il numero v1.26.023: le correzioni delle versioni 1.26.017 a 1.26.021 sono tornate.

## v1.26.022 — 12 ottobre 2026

### Ritorno al codice della 1.26.016

- Ripubblicazione del codice esatto della v1.26.016 con il numero v1.26.022 per consentirne l'aggiornamento dalle versioni più recenti.
- Le modifiche introdotte nelle versioni 1.26.017 a 1.26.021 sono rimosse da questa release.
- Questo ritorno serve a verificare il comportamento delle schede Android TV; la risoluzione del problema resta da confermare sul server e sulla TV.

## v1.26.021 — 12 ottobre 2026

### Samsung: appare anche la riga «Tendenze Movviz»

- Stessa correzione della 1.26.020 sull'app Samsung (Tizen): dopo un riavvio del server, la schermata iniziale e Scopri rileggono le righe finché il server le sta ancora preparando, invece di rimanere senza tendenze.

## v1.26.020 — 12 ottobre 2026

### Movviz TV: appare la riga «Tendenze Movviz»

- Dopo un riavvio del server, le tendenze vengono calcolate in pochi secondi. Il sito aspettava che arrivassero, ma l'app TV mostrava la schermata iniziale così com'era e la manteneva senza tendenze. L'app TV (e l'app mobile) rileggono ora le righe finché il server le sta ancora preparando.
- Quando il server segnala nuovi suggerimenti, la schermata principale dell'app TV si aggiorna immediatamente. Prima, la nuova riga arrivava in background senza mai essere visualizzata.

## v1.26.019 — 12 ottobre 2026

### Android: "Vedi altro" non fa più crashare l'applicazione

- Su mobile e su TV, aprire "Vedi altro" di una riga di suggerimenti e poi scorrere poteva chiudere l'applicazione improvvisamente, quando la pagina successiva restituiva un titolo già visualizzato. I duplicati vengono ora ignorati.

## v1.26.018 — 12 ottobre 2026

### Ricerca: tutti i risultati TMDb vengono visualizzati

- La ricerca non nasconde più alcun titolo senza valutazione su TMDb: tutto ciò che TMDb trova appare. Le righe di Scopri mantengono il loro ordinamento per titoli non interessanti.

## v1.26.017 — 12 ottobre 2026

### Ricerca: i film più recenti vengono trovati per titolo

- Un film che nessuno ha ancora valutato su TMDb (film di festival, uscita francese imminente, come "Un buon avvocato") era nascosto dalla ricerca come risultato non interessante. Ora appare quando si digita il suo titolo. I risultati senza valutazione che non corrispondono alla ricerca rimangono nascosti.

## v1.26.016 — 12 ottobre 2026

### Ripresa dei mancanti: massimo 3 giorni di attesa

- Un titolo già cercato senza risultati attende 1 giorno, poi un massimo di 3 giorni prima di essere cercato di nuovo (invece di 7). Lo scan RSS, la ricerca delle uscite del giorno e la ricerca manuale non aspettano mai: un titolo che appare in un feed viene scaricato subito.

## v1.26.015 — 12 ottobre 2026

### Film e serie TV mancanti: prima l'RSS, poi la ripresa più leggera

- Lo scan RSS degli indicizzatori passa ogni 15 minuti invece che ogni ora. Un film o una serie TV mancante viene scaricato non appena appare in un feed, senza attendere la ripresa.
- Quando sono state pubblicate uscite tra due passaggi senza apparire nel feed (troppe novità tutte insieme), Movviz se ne accorge, legge la pagina successiva dell'indicizzatore e lo annota nel log.
- La ripresa dei mancanti passa ogni 8 ore invece di 6. Un titolo già cercato senza risultati attende 1 giorno, poi 3, poi 7 prima di essere cercato di nuovo; torna all'inizio non appena viene trovato.
- La ripresa degli episodi mancanti copre ora tutta la libreria. Prima, controllava solo le prime serie della lista.

### Indicizzatori: una chiave rifiutata non passa più inosservata

- Il test di un indicizzatore esegue ora una vera piccola ricerca: una chiave API rifiutata appare come fallimento, anche quando l'indicizzatore pubblica la sua lista di capacità senza chiave.
- Una ricerca rifiutata da un indicizzatore (chiave non valida o senza i permessi necessari) viene annotata come errore nel log, invece di passare come "nessun risultato".

## v1.26.014 — 12 ottobre 2026

### Plex: sincronizzazione delle viste più leggera

- La sincronizzazione delle viste Plex confronta lo stato di Plex con quello di Movviz utilizzando indici preparati una sola volta, invece di ripercorrere tutta la libreria per ogni episodio, lasciando respirare il server durante l'elaborazione. I risultati sono identici; i piccoli blocchi dell'interfaccia durante questo compito scompaiono.

## v1.26.013 — 12 ottobre 2026

### Recupero dei download: meno blocchi del server

- Il compito che recupera i download completati ma non importati confronta ancora ogni file con la libreria allo stesso modo, ma senza ricalcolare tutti i titoli per ogni file, e lascia respirare il server tra un file e l'altro. Dopo un riavvio, poteva bloccare l'interfaccia fino a 11 secondi.

## v1.26.012 — 11 ottobre 2026

### Plex: fine del ciclo di sincronizzazione delle visualizzazioni

- Quando un "visto" non può essere inviato a Plex (profilo rimosso dai condivisioni del server, episodio assente da Plex...), Movviz riprova ogni minuto, e poi con intervalli sempre più lunghi: ogni 5 minuti dopo 10 minuti, ogni 30 minuti dopo un'ora, ogni 6 ore dopo un giorno. Prima, riprovarebbe ogni minuto senza fine, cosa che poteva bloccare il server per diversi secondi e riempire il log di ricerca.
- Gli episodi di una stessa serie vengono inviati insieme, con un unico controllo dell'account Plex e una singola riga di log per serie.
- Un episodio visto che non esiste sul server Plex (ad esempio in una cronologia importata) rimane visto in Movviz, senza chiamare Plex né mostrare avvisi nel log.

### Plex: riconciliazione giornaliera alleggerita

- La riconciliazione completa di Plex non riscrive più un film quando nulla è cambiato. Prima, l'intera libreria veniva contata come "aggiornata" ogni giorno (notifica "2351 film aggiornati") e il server poteva bloccarsi per circa un minuto durante questo passaggio. La notifica conta solo i veri cambiamenti.

### Diagnostica, icone e anteprime

- La diagnostica restituisce i contatori per tipo e i primi 50 esempi, invece di decine di migliaia di righe.
- Icone di scheda e di applicazione leggere, e un favicon.ico.
- Le anteprime già trovate rimangono in cache dopo un riavvio del server.

## v1.26.011 — 11 ottobre 2026

### Sicurezza: chiave TMDB riservata agli amministratori

- Cambiare, eliminare o testare la chiave TMDB richiede ora un account amministratore, come per OMDb e TVDB. Prima, queste azioni avvenivano senza verificare la sessione.
- Un test verifica ora che ogni rotta che modifica qualcosa controlli autonomamente chi la sta chiamando.

### Test

- I test di Scoperta seguono la disposizione attuale (ordinamento mantenuto cambiando piattaforma, scheda "Tutto").
- I test di rilevamento ffmpeg non assumono più una scheda NVIDIA sulla macchina, e il test della cache ffprobe non è più instabile.

## v1.26.010 — 11 ottobre 2026

### Android TV e mobile: pausa in standby

- Quando la riproduzione è in pausa, lo schermo e la modalità standby del televisore si attivano di nuovo dopo il loro intervallo abituale, come con Plex. Durante la riproduzione, incluso durante un caricamento, lo schermo rimane acceso.

## v1.26.009 — 11 ottobre 2026

### Android mobile: completare una stagione

- Nella pagina di una stagione, il download della stagione ha un pulsante dedicato, su una riga separata dalle azioni di riproduzione. Si chiama "Completa stagione" quando parte degli episodi è già presente, "Scarica stagione" quando non ce n'è nessuno, e mostra la percentuale in tempo reale durante il download.

## v1.26.008 — 11 ottobre 2026

### Android TV e mobile: download di un episodio

- Nella scheda di un episodio mancante, il pulsante diventa "Scarica episodio" invece di "Scarica stagione". Mostra quindi lo stato in tempo reale: in coda, ricerca, download con percentuale in tempo reale, poi import, prima di passare a "Riproduci".
- "Scarica stagione" è proposto solo per una stagione senza episodi presenti, con lo stesso monitoraggio in tempo reale. Su TV, una stagione iniziata mantiene "Completa stagione", anch'essa monitorata in tempo reale.
- Un pacchetto di stagione in corso mostra il suo progresso su ogni episodio, solo sul primo.
- Mobile: gli episodi mancanti sono ora disponibili per il download (erano inattivi).

## v1.26.007 — 10 ottobre 2026

### Recupero automatico dei blocchi

- Un worker di backup JSON bloccato viene sostituito dopo due minuti; i backup falliti vengono riprovati con i dati più recenti.
- In Docker, un supervisore indipendente riavvia il server web dopo cinque minuti di indisponibilità continua, con dieci minuti di grazia all'avvio, almeno quindici minuti tra i riavvii e un massimo di tre riavvii all'ora.
- I fallimenti prolungati del backup vengono rilevati dalla sonda di salute. I processi di download e di risoluzione mantengono il loro output di log durante un riavvio del server web.
- L'arresto tenta di salvare le modifiche in sospeso dopo l'arresto dei worker di scrittura. Le decisioni di recupero appaiono nei log sotto `[watchdog]`.

## v1.26.006 — 8 ottobre 2026

### Libreria: proporzioni e filtri

- Il menu Generi è allineato a destra del contatore di titoli.
- La pagina utilizza la stessa larghezza utile della dashboard per mantenere le stesse proporzioni di schede e spaziature su schermo grande.

## v1.26.005 — 8 ottobre 2026

### Download automatici

- Riattivazione predefinita della ricerca automatica dei mancanti, inclusa per vecchie configurazioni disattivate; una disattivazione volontaria dopo questo aggiornamento rimane memorizzata.
- La scansione RSS oraria aggiorna lo stato delle nuove uscite e riconosce i titoli originali dei film. La ricerca delle uscite recenti utilizza la data nota quando manca la data VF.
- Le frequenze personalizzate della ricerca automatica sono limitate a otto ore per prevedere almeno tre passaggi al giorno, quando il server è attivo.

### Libreria e personalizzazione

- Film, Serie e Collezioni sono raggruppati nella pagina Libreria esistente. I vecchi indirizzi Film e Serie reindirizzano ai suoi filtri.
- I generi passano in un menu a discesa sopra il numero di titoli. La griglia occupa tutta la larghezza e riprende le dimensioni delle schede della dashboard.
- La personalizzazione delle liste è accessibile su computer in Scoperta e aggiunta alla dashboard: ordine, mascheramento, rivisualizzazione e reimpostazione, salvati per account.
- In Scoperta, il badge verde dei titoli disponibili è ridotto della metà; «Visto» appare in basso a destra, indipendentemente dallo stato di download.

## v1.26.004 — Ottobre 2026

### Download: sostituzione sicura e stato seed

- Il vecchio film rimane disponibile e leggibile durante il download della sua sostituzione; viene rimosso solo dopo l'installazione e la convalida del nuovo file con nome finale, senza suffisso «(2)» né backup residuo.
- In caso di rifiuto (file utilizzato, nome occupato, file incompleto o inaccessibile), il nuovo viene conservato per tre nuovi tentativi distanziati di 10 minuti, incluso dopo il riavvio. Dopo il ultimo fallimento, il nuovo viene eliminato e l'originale conservato; Download mostra un messaggio preciso.
- Un torrent terminato in condivisione mostra «In seed» e non diventa più bloccato a causa di una velocità di download nulla.

### Desktop: badge dell'eroe

- I badge tecnici riprendono la presentazione e l'allineamento dei generi; "FHD" diventa "1080P" nell'hero desktop.

## v1.26.003 — Ottobre 2026

### Desktop: badge tecnici dell'hero accanto ai generi

- Su desktop, i badge di risoluzione, HDR, lingua e codec dell'hero sono visualizzati immediatamente dopo i generi, sulla stessa riga se lo spazio lo consente.
- La loro presentazione e i loro dati rimangono identici; su mobile e tablet, mantengono la loro posizione in alto a destra.

## v1.26.002 — Ottobre 2026

### Android mobile: timeline scorrevole e immersione

- Il cursore, la progressione e il tempo visualizzato seguono il dito sulla timeline. Il salto video avviene al rilascio, senza ricaricamenti ripetuti durante lo scorrimento.
- Il gesto della timeline blocca luminosità e volume; i controlli rimangono visibili fino al rilascio.
- Il lettore utilizza tutta la superficie dello schermo, mascherando le barre di sistema.
- Le bande nere integrate in un flusso video vengono rilevate su più immagini chiare concordanti e rimosse tramite uno zoom di visualizzazione progressivo. Le scene scure non attivano lo zoom; i video nativi in 21:9 sono esclusi.

## v1.26.001 — Ottobre 2026

### Accessibilità desktop per profilo

- In Il mio profilo, una sezione Accessibilità permette di scegliere la dimensione del testo su computer: 100 %, 110 % o 120 %, con anteprima immediata e ritorno alle impostazioni standard.
- La preferenza viene salvata nell'account e ritrovata sugli altri computer. Non modifica le app Android o TV.
- L'ingrandimento copre i testi dell'interfaccia, i menu e i pannelli, nelle apparenze Stable e Beta, con adattamento delle aree di navigazione e dei comandi.
- Al 100 %, gli stili di ingrandimento sono completamente disattivati; locandine, loghi e video mantengono le loro dimensioni.

## v1.25.201 — Ottobre 2026

### Android mobile: lettore discreto e altezza prioritaria

- In riproduzione, nessun titolo né logo: i controlli compatti e le azioni episodio scompaiono dopo 2,5 secondi senza interazione.
- In pausa, un leggero gradiente accompagna il logo ufficiale del film o della serie; il titolo funge da riserva se il logo manca o non può essere caricato. Il logo scompare non appena riprende.
- Timeline di 4 dp, maniglia di 18 dp e bersagli tattili di almeno 44 dp. Il badge della modalità di riproduzione è ridotto.
- I formati video e audio effettivamente riprodotti sono visualizzati discretamente vicino ai tempi, senza inventare HDR o Atmos né riprendere le caratteristiche del file sorgente dopo il transcodifica.
- Il video riempie l'altezza dello schermo mantenendo le sue proporzioni; un contenuto meno largo del telefono mantiene bande nere laterali.

## v1.25.200 — Ottobre 2026

### Android mobile panorama: posizionamento dell'anteprima video

- Nella scheda a due pannelli, l'anteprima del trailer è spostata a sinistra del 33% della sua larghezza, senza modificarne né la dimensione né il formato.
- Lo sfumare, il testo e l'immagine di sfondo rimangono al loro posto; il video che eccede è mascherato ai limiti dello schermo.

## v1.25.199 — Ottobre 2026

### Android mobile panorama e colori del tema Beta

- Home Android mobile in panorama: scorrimento orizzontale dell'eroe per visualizzare il titolo precedente o successivo; il ritardo di rotazione automatica riparte dopo una selezione manuale.
- Scheda Android mobile a due pannelli: il visivo e i gradienti coprono tutta la superficie, con un dissolvenza continua verso il testo e lo sfondo della pagina, senza interruzione verticale.
- Aspetto Beta su computer: la ricerca e le schede delle piattaforme di Scoperta riprendono i colori della palette, incluso al passaggio del mouse e alla selezione.

## v1.25.198 — Ottobre 2026

### Aspetto Beta: ritorno della barra di ricerca abituale

- Su computer, l'aspetto Beta riprende la barra di ricerca dell'aspetto Stabile, identica: si digita direttamente nella barra superiore.
- La palette `Ctrl K` è stata rimossa.

## v1.25.197 — Ottobre 2026

### Aspetto Beta: Download fedele al mockup, scheda titolo con schede

- Download: sotto il titolo, un riepilogo in tempo reale (download attivi, velocità, spazio libero) sostituisce il testo esplicativo.
- Ogni riga della coda è allineata in colonne: contenuto, progresso, velocità, tempo rimanente, fonti. Le azioni rimangono discrete (pausa, ricerca, eliminazione, dettagli).
- Il progresso cambia colore a seconda dello stato: viola in corso, grigio in attesa, verde completato, rosso bloccato.
- La colonna "Fonti" mostra ora il vero numero di pari, anziché frecce vuote.
- La colonna di destra si organizza in "Velocità in tempo reale", con una curva riempita, e in "Stato". I pulsanti raggruppati non sono più rossi, tranne al passaggio del mouse.
- Scheda di un titolo su computer: Episodi, Distribuzione, Simili e Dettagli passano in schede sotto il riepilogo.
- Correzione: il tooltip "Dettagli" mostrava un testo tecnico anziché la parola tradotta.
- I riprendimenti non cambiano. Stabile, mobile e applicazioni TV non più.

## v1.25.196 — Ottobre 2026

### Android mobile: correzione

- La Cronologia del Mio spazio non fa più crashare l'applicazione quando un film o episodio è presente più volte (rivisto o riprodotto) : ogni titolo appare solo una volta, con la data più recente.

## v1.25.195 — Ottobre 2026

### Aspetto Beta: home a schermo intero su computer

- La grande immagine della home esce dal suo bordo: occupa tutta la larghezza, passa sotto la barra superiore e si fonde nel nero della pagina.
- Il titolo, il riepilogo e i pulsanti sono allineati sul resto della pagina.
- Lo slideshow, il logo del titolo, il trailer sullo sfondo e le schede delle piattaforme non cambiano. Stabile, mobile e applicazioni TV non cambiano neanche.

## v1.25.194 — Ottobre 2026

### Android mobile: rifacimento premium, ricerca, lettore e impostazioni

- Ricerca: con "Tutto", le persone trovate appaiono in cima, in foto rotonde, prima film e serie.
- Ogni risultato indica se è già nella libreria o in download.
- I filtri (generi, durata, piattaforme…) si aprono come foglie dal basso in verticale, con un elenco scorrevole.
- Le schede attive (Film/Serie, In corso/Completati, filtri di ricerca) diventano bianche, come le stagioni.
- Lettore: un doppio tocco a sinistra o a destra fa tornare indietro o avanti di 10 s, e uno scorrimento verticale regola la luminosità (a sinistra) o il volume (a destra).
- Download: un riepilogo in cima mostra il progresso generale, il bitrate totale e la fine stimata.
- Impostazioni: l'aggiornamento automatico diventa una riga chiara con un interruttore.
- Lo schermo di aggiornamento è più leggibile sul telefono.

## v1.25.193 — Ottobre 2026

### Aspetto Beta: "Sala buia" si estende su tutto il computer

- Tutti i colori sono unificati: un nero profondo, un unico viola per le selezioni e il progresso. Ciano, blu elettrico e sfumature rosa scompaiono dai pulsanti, filtri e pannelli.
- Il verde, l'arancione e il rosso mantengono il loro significato: completato, attenzione, fallimento.
- Pagina Download rivista: schede sottolineate, filtri a punti, linee più sobrie, progresso viola, velocità leggibili in cifre allineate, punti di stato colorati a seconda dello stato, e colonna live (grafico, bitrate, contatori) abbinata al resto.
- Il pulsante principale (Guarda, Riprendi, Aggiungi alla libreria) diventa chiaro sulla schermata principale e sulla scheda di un titolo. Le altre azioni rimangono icone, con il nome al passaggio del mouse.
- Libreria: i filtri Tipo e Ordina non appaiono più due volte, rimangono nella barra degli strumenti superiore.
- La schermata delle impostazioni perde i suoi bagliori colorati e riprende le stesse superfici del resto.
- Le schede delle piattaforme, i loro loghi e i loro effetti al passaggio del mouse non cambiano. Stabile, il mobile e le app TV non cambiano neanche.

## v1.25.192 — Ottobre 2026

### Android mobile: rifacimento premium della scheda film e serie

- La scheda prende il colore del poster: lo sfondo si tinge dolcemente in base al titolo invece di un nero identico ovunque.
- In paesaggio e su Fold aperto piatto, la scheda si visualizza in due pannelli: l'immagine rimane fissa a sinistra e le informazioni scorrono a destra.
- Su Fold aperto tenuto in verticale, la scheda riprende il layout verticale con più spazio.
- Il pulsante Guarda è bianco ovunque, e il progresso di ripresa viene visualizzato direttamente nel pulsante.
- In verticale, "Guarda da capo" e "Segnato visto" diventano pulsanti rotondi su una sola riga.
- Le stagioni vengono selezionate con punti compatti "Stagione 2 · 10 ep." su telefono e Fold.
- In verticale, un episodio si apre in una foglia che sale dal basso, chiudibile con un tocco dall'alto.

## v1.25.191 — Ottobre 2026

### Android mobile: rifacimento premium, primo passo (tela)

- Il Z Fold aperto e tenuto in verticale non mostra più l'interfaccia TV: ora ha il proprio layout touch, con una barra di navigazione etichettata a sinistra.
- Nuova barra di navigazione in vetro smerigliato in panorama e su Fold. Integra la ricerca, e la scheda Download mostra un anello di progresso durante un download.
- Su Fold aperto in orizzontale o su tablet, il pannello destro mantiene il suo posto quando lo schermo è abbastanza largo e adotta lo stesso stile vetroso.
- Il protagonista della schermata iniziale passa a larghezza intera in panorama e su Fold, con il suo riassunto e un pulsante Play bianco più leggibile.
- Il dock inferiore è più leggero: la scheda attiva è contrassegnata da un'icona viola sottolineata invece di una pillola colorata.
- La ricerca della schermata iniziale in verticale diventa un'icona nell'intestazione, lasciando più spazio al contenuto.
- I pulsanti e le anteprime reagiscono al tocco con un leggero affondamento, e i testi secondari assumono una tonalità più tenue.
- Il pulsante flottante Movviz AI non cambia.

## v1.25.190 — Ottobre 2026

### Aspetto Beta: primi passi di "Sala buia" su computer

- Nuova palette di comandi: `Ctrl K` (o un clic sulla barra superiore) cerca sia film che serie, pagine e impostazioni, e propone di avviare la ricerca in Scopri o una ricerca torrent.
- La barra superiore si alleggerisce: la lingua e il link Supporta Movviz passano nel menu del profilo, e il cuore non batte più continuamente.
- Colori più scuri e neutri, ingresso attivo della barra laterale in superficie rialzata, caratteri dedicati a Movviz (incorporati, senza connessione), titoli delle pagine senza sfumature e un unico anello di focus, identico a quello del mouse e della tastiera.
- Un link a un'impostazione specifica apre ora la scheda corretta anche quando la pagina Impostazioni è già visualizzata.
- L'aspetto Stabile, mobile e le app TV non cambiano.

## v1.25.189 — Ottobre 2026

### Android TV: nuova interfaccia Beta da provare

- Nuova impostazione Impostazioni > Aspetto > Interfaccia Beta. È disattivata di default: l'aspetto attuale non cambia finché non la attivi.
- Con l'interfaccia Beta, i testi sono più grandi e leggibili dal divano (badge, note, sinossi, informazioni delle schede), e la selezione ha sempre lo stesso bordo bianco.
- Le file, le locandine e le schede di ripresa sono allineate su un margine e un po' più grandi; la barra di progresso delle riprese è più visibile.
- Il protagonista della schermata iniziale non cambia mentre si è sul suo pulsante, e questo pulsante si chiama ora "Visualizza scheda", che è ciò che fa realmente.

## v1.25.188 — Ottobre 2026

### Android mobile: ricerca per attore

- Nella scheda Attori della ricerca, toccare un attore apre ora la sua scheda con la sua filmografia.
- Ogni risultato mostra la foto e la professione della persona, e la ricerca indica quando carica o fallisce invece di mostrare "Nessun attore".
- La ricerca di attori (mobile e web) trova molte più persone: ora utilizza la ricerca TMDb dedicata alle persone.

## v1.25.187 — Ottobre 2026

### Movviz Companion: tracciamento live del download

- Il pulsante mostra ora la percentuale di download in tempo reale, con una sottile barra di avanzamento, e si aggiorna da solo: non è più necessario aggiornare la pagina.
- Quando il download è completato, il pulsante passa automaticamente a «Disponibile» con accesso diretto alla scheda in Movviz.
- Messaggi di errore più precisi quando la connessione al server fallisce (accesso non autorizzato, server da aggiornare, server irraggiungibile), e richiesta di autorizzazione più affidabile per un server in HTTP.

## v1.25.186 — Ottobre 2026

### Movviz Companion: installazione corretta

- L'estensione si carica nuovamente in Chrome e Edge: una dichiarazione non valida dell'icona le impediva di installarsi dalla versione precedente.

## v1.25.185 — Ottobre 2026

### Movviz Companion: logo visibile e pulsante più leggibile

- Il logo Movviz appare finalmente nel pulsante, su tutti i siti supportati.
- Il pulsante è ora una carta scura con un alone viola, più grande e leggibile anche su pagine bianche. Quando è disponibile un titolo, «Apri in Movviz» diventa il pulsante principale.

## v1.25.184 — Ottobre 2026

### Movviz Companion: logo nitido

- L'icona dell'estensione riprende il logo Movviz in PNG trasparente, senza il bordo scuro che appariva sui bordi.

## v1.25.183 — Ottobre 2026

### Movviz Companion: richiedi i tuoi film e serie dai siti cinematografici

- Nuova estensione browser (Chrome, Edge, Brave): appare un pulsante Movviz su TMDb, IMDb, AlloCiné, SensCritique, TheTVDB, Letterboxd, Rotten Tomatoes, JustWatch, Trakt e Taste per richiedere un film o una serie con un clic.
- Lo stato viene visualizzato in tempo reale (in attesa, in corso, disponibile) con accesso diretto alla scheda in Movviz. Se un sito cambia il layout, il pulsante rimane visibile in basso a sinistra.
- Connessione con un token API personale (Profilo, Token API): la richiesta segue i tuoi diritti abituali, approvata subito per un amministratore o un utente in approvazione automatica.
- L'archivio dell'estensione è allegato ad ogni release, con una pagina di opzioni nei colori di Movviz disponibile in cinque lingue.

## v1.25.182 — Ottobre 2026

### Riproduzione: pausa/riprendere affidabili e file grandi che non si bloccano nel vuoto

- Una pausa di più di pochi secondi, o la riproduzione di un file grande, non interrompe più la connessione video: su Android TV e mobile, il lettore non impone più una durata massima a un flusso, e il server non lo interrompe più dopo 5 minuti.
- È di nuovo possibile mettere in pausa durante un caricamento, e l'icona segue lo stato reale. Un lettore lasciato in pausa rimane tale dopo una ripresa automatica, e l'uscita dallo schermo mette correttamente in pausa la riproduzione anche durante un caricamento.
- Meno memoria utilizzata: il trailer di benvenuto viene liberato non appena il lettore si apre o l'app passa in background.
- Riproduzione dei file locali più fluida sui file grandi.

## v1.25.181 — Ottobre 2026

### Film e Serie: titoli di riquadri corretti e riquadri personalizzabili

- Le rangée di suggerimenti delle pagine Film e Serie porta finalmente il suo vero nome (Apprezzato dalla critica, Anime, Azione, Commedia, ecc.) invece di "Film" o "Serie" ovunque.
- Nuovo pulsante matita su Film, Serie e Scopri: ogni utente può spostare su, spostare giù, mettere in primo piano o nascondere una riga di suggerimenti, e ripristinarla in qualsiasi momento. L'organizzazione viene salvata sul proprio account, pagina per pagina, e un pulsante permette di tornare all'ordine predefinito.

## v1.25.180 — Ottobre 2026

### Samsung Tizen: percorso più vicino ad Android TV NX

- Impostazioni, scheda titolo, stagioni ed episodi rivisti: stato visto/non visto, contatore episodi visti e mancanti, ripresa nel punto esatto o dall'inizio.
- Home coerente quando l'IA non è attiva: nessuna area vuota né elemento IA visibile.
- Nuove etichette tradotte in cinque lingue, e audit UX della versione Samsung aggiunto alla documentazione di porting.

## v1.25.179 — Ottobre 2026

### Download: fine delle edizioni errate e delle parole vietate aggirate

- Un rilascio di un'edizione nazionale di un programma non è più preso per la serie base: "Hot Ones Quebec" non viene più scaricato per "Hot Ones" (stesso discorso per Canada, Francia, Belgio, Australia, ecc.).
- "Sostituire i bloccati" rispetta ora le parole vietate: un rilascio contenente un termine vietato (ad esempio VFQ) non viene più scelto automaticamente, indipendentemente dal suo punteggio. La ricerca manuale continua a visualizzare tutto.

## v1.25.178 — Ottobre 2026

### Samsung Tizen: primo client NX in beta e rilascio GitHub

- Aggiunto un client Samsung TV impacchettato in `.wgt`, con colori, font Roboto, logo, rail a focus e dimensioni derivati da Android TV NX. Schermi server, connessione Movviz/Plex tramite codice e QR, selezione profili, home con hero, libreria, scoperta, ricerca e scheda titolo unica con stagioni/episodi e distribuzione.
- Riutilizzo di rotte e regole server per account, riprese, storici, stati visti, liste personali, richieste di titoli, ricerche di download e IA quando questa è attiva. I profili ripristinano ciascuno la propria sessione autenticata; nessun token Plex viene inviato al client.
- Adattatore AVPlay con riproduzione autenticata, ripresa, pausa, spostamento nel flusso, scelta audio/sottotitoli tramite riprogrammazione server, avanzamento ed episodio successivo. Capacità dichiarate limitate a H.264/AAC SDR 1080p in attesa di test hardware; la riproduzione su TV fisica e la piena parità Android TV non sono ancora validate.
- Workflow Samsung sugli stessi tag `v*` delle altre piattaforme: verifica dei tipi/test, archivio e SHA-256 allegati al rilascio. Senza certificati Samsung configurati, il pacchetto porta esplicitamente il nome `client-unsigned.wgt` e deve essere firmato prima dell'installazione. HEVC/HDR/4K, trailer, marcatori e impostazioni avanzate rimangono da finalizzare e verificare sul modello target.

## v1.25.177 — Ottobre 2026

### Android TV: feedback e apertura stagione con D-pad

- Al ritorno da una scheda aperta dalla ricerca, il focus torna sulla scheda selezionata, con ripristino del filtro e della griglia.
- Una stagione si apre sull'azione di riproduzione del suo intestazione, senza oscurarla. Il ritorno da una scheda episodio conserva la priorità sulla sua scheda originale; i movimenti Compose e le regole di riproduzione rimangono invariati.

## v1.25.176 — Ottobre 2026

### Android TV: inserimento ricerca alleggerito

- L'inserimento non invalida più l'intero contenitore di navigazione ad ogni lettera. La normalizzazione dei titoli della libreria è calcolata una volta per aggiornamento, e le corrispondenze e il loro ordinamento sono calcolati fuori dal thread di visualizzazione.
- I calcoli obsoleti sono annullati e i loro risultati non possono sostituire quelli del nuovo inserimento. Priorità alla libreria, ordinamento, filtri, deduplicazione, badge visti, temporizzazione rete e navigazione con telecomando sono mantenuti.

## v1.25.175 — Ottobre 2026

### Beta: riflesso luminoso sul contorno delle schede

- Al passaggio del mouse su desktop, un sottile riflesso bianco-viola segue il cursore sul bordo delle schede. Il centro è oscurato per preservare i colori e la leggibilità dei poster, con un discreto alone esterno.
- Nessun zoom o ingrandimento aggiunto: il tracciamento del mouse esistente è mantenuto. Nessun cambiamento nello sfondo, nella modalità Stable, nei contenuti o nella riproduzione; nessuna libreria aggiuntiva né animazione permanente.

## v1.25.174 — Ottobre 2026

### Aggiunte recenti: non confondere il cambio di vista con l'arrivo di un file

- La sincronizzazione e la riconciliazione Plex mantengono la data di arrivo di un file già noto. Passare da episodi visti o non visti, o aggiornarne i metadati, non ripristina più artificialmente la data di sincronizzazione nelle aggiunte recenti.
- Un primo import utilizza la data di aggiunta reale fornita da Plex; una vera sostituzione di file mantiene il suo comportamento di arrivo nuovo. Le date di acquisizione locali già registrate sono preservate.
- Correzione nella sorgente condivisa dei dati, senza modificare le viste, le cronologie, gli account Plex né le regole di ripresa.

## v1.25.173 — Ottobre 2026

### Impostazioni utili, stagioni speciali e Scopri

- Rimozione delle opzioni di benvenuto neutralizzate (statistiche, coda di download e compiti) e dei profili di qualità grafica. La composizione attuale e il rendering grafico standard rimangono fissi; la possibilità di disattivare le animazioni e scegliere Stable/Beta rimane disponibile. I testi delle opzioni rimosse sono puliti; il wizard conserva solo le sue scelte ancora utili.
- Il lettore integrato si chiama Movviz player, attivato di default. La scelta personale disattivata apre Plex, anche quando una sorgente locale avrebbe altrimenti aggirato questa scelta. Le preferenze esplicite degli account esistenti vengono mantenute; il motore rimane automatico.
- Su desktop, l'opzione esistente per gli episodi speciali ora guida realmente la visualizzazione della stagione 0. Viene disattivata una sola volta per tutti i profili dopo questo aggiornamento, dopodiché ognuno può riattivarla. Su Android TV, gli speciali sono nascosti come già su smartphone. Nessun file, cronologia o stato visto viene eliminato.
- Scopri propone Novità, Tendenza, Migliore e Per te nello stesso selettore, per tutte le piattaforme. L'ordinamento è mantenuto al cambio di piattaforma o di tipo; Per te utilizza i suggerimenti dell'account, filtrati dalla piattaforma scelta. Con filtri aggiuntivi, i risultati filtrati vengono riordinati senza cambiare la loro paginazione.
- In Film e Serie, le righe di piattaforme distinguono ora i suggerimenti per te e le novità, con le stesse etichette di Scopri.
- Rimozione del riquadro rettangolare aggiunto nel campo di ricerca Beta; solo il suo contorno arrotondato indica il focus.

## v1.25.172 — Ottobre 2026

### Beta: sfondo originale e interazioni affinate

- Lo sfondo della pagina e quello della sidebar recuperano il tema originale: nessun sfondo decorativo aggiunto in Beta. Il tracciamento del mouse e il rilievo delle piastrelle sono mantenuti.
- I badge di valutazione e di episodi sono più leggibili, le barre di ripresa meglio definite e la piattaforma selezionata in Scopri ha un riferimento discreto.
- I pulsanti dell'eroe e le frecce dei caroselli forniscono un feedback visivo più nitido al passaggio del mouse, al clic e alla tastiera, senza spostare il layout.
- Queste rifiniture rimangono riservate a Beta su desktop, rispettano la riduzione delle animazioni e non modificano né la riproduzione, né i dati, né i precaricamenti.

## v1.25.171 — Ottobre 2026

### Beta: finitura cinema premium desktop

- Beta applica ora un aspetto coerente al dashboard, alle schede di film e serie, a Scopri, alle schede, alla ricerca, alle impostazioni e al pannello Movviz AI. Stable mantiene il suo aspetto esistente.
- I poster e le piattaforme dispongono di una luce al passaggio del mouse e di un leggero rilievo. I controlli, le finestre di anteprima e le schede sono armonizzati; le transizioni delle schede sono affinate senza sostituirne il comportamento.
- Gli effetti puntatore condividono un unico compito per frame, senza ricomposizione React né animazione permanente. Vengono interrotti durante la riproduzione, sugli schermi touch e quando le animazioni sono ridotte.
- Le impostazioni e la cache dell'aspetto vengono verificate rispetto al profilo connesso. Dati, ricerca, caroselli, precaricamenti e regole di riproduzione non vengono modificati.
- Gli effetti selezionati nelle librerie gratuite sono adattati a Movviz senza impilare i loro motori né aggiungere dipendenze di produzione.

## v1.25.170 — Ottobre 2026

### Visualizzazione Stabile e Beta

- Il selettore Home e caroselli ora propone Stabile (l'interfaccia attuale, di default) e Beta (la nuova finitura premium desktop). La dashboard applica realmente la modalità salvata e consente di tornare a Stabile.
- Le vecchie modalità Cinema, Classico e Compatto diventano Stabili. Le impostazioni video, contenuto e caroselli vengono mantenute e sono comuni a entrambe le apparenze.
- Beta affina il frame dell'eroe, i pulsanti, i titoli e le piattaforme, senza cambiare la riproduzione o i dati. Gli stili premium rimangono esclusivamente attivi in Beta.
- La scelta rimane specifica per ogni profilo; un errore di salvataggio non fa più credere che la nuova modalità sia salvata.

## v1.25.169 — Ottobre 2026

### Correzione pubblicazione Docker

- Il README è incluso nel contesto di build Docker per consentire la convalida delle versioni e del changelog. Il controllo rimane attivo; nessun comportamento utente è modificato.
- Questa pubblicazione riprende le correzioni di viste e riprese della versione 1.25.168 il cui build Docker era fallito.

## v1.25.168 — Ottobre 2026

### Viste e riprese coerenti su tutti i dispositivi

- Android TV e smartphone utilizzano ora la stessa decisione server del web alla chiusura e al cambio di episodio: episodi all'80%, film secondo il loro genere o il margine di fine esistente, con la protezione del tempo di riproduzione reale. La fine naturale rimane una convalida esplicita.
- Le riprese S01E01 senza progressione sono rimosse dalle fonti locali e Plex, in particolare dopo un'importazione incompleta. Un primo episodio effettivamente iniziato e i passaggi a una stagione successiva rimangono disponibili.
- Nessuna eliminazione di viste o cronologia importata; la separazione dei profili Plex e la sincronizzazione esistente sono mantenute.

## v1.25.167 — Ottobre 2026

### Changelog dopo aggiornamento

- La finestra Novità non marca più una versione come letta in caso di errore, note assenti o finché lo splash la nasconde. La convalida avviene alla sua chiusura.
- I caricamenti interrotti vengono annullati e gli errori transitori dispongono di due nuovi tentativi. Le vecchie convalide non affidabili non nascondono più le note.
- Le note delle versioni 163 a 166 sono ripristinate. Il changelog è incluso nel server autonomo e il build verifica ora le note oltre alle versioni del README e del lockfile.

### Recupero delle novità recenti

- I caroselli preparano due schermi in anticipo, con un'anticipazione limitata e priorità alle immagini visibili, ricerche e schede richieste.
- La ripresa di una serie non propone più episodi inesistenti o assenti; le viste, la cronologia importata e la separazione dei conti Plex sono preservate.
- La versione installata e il blocco aggiornato sono tornati in fondo alla sidebar, in modalità aperta e compatta.

## v1.25.166 — Ottobre 2026

### Versione e aggiornamento nella barra laterale

- La versione installata è nuovamente visibile nel profilo, incluso in modalità compatta.
- Il blocco aggiornato è tornato per gli amministratori: installazione nativa su Windows e Linux, accesso alle informazioni su Docker/NAS. La navigazione rimane invariata.

## v1.25.165 — Ottobre 2026

### Priorità alla navigazione

- Il rilevamento dell'attività copre tastiera, touch, scorrimento e navigazione. La priorità viene rinnovata durante i caricamenti utili, non dai refresh già in cache.
- Le immagini visibili non attendono l'anticipazione. I caroselli vicini preparano due schermi in anticipo, con due precaricamenti speculativi e un decodifica alla volta per tutte le righe.
- I compiti in background sono correttamente classificati; le richieste utente TMDb rimangono prioritarie, con ordine stabile e limiti di concorrenza mantenuti.

## v1.25.164 — Ottobre 2026

### Riprendere solo validi

- L'episodio successivo proviene dal catalogo reale, ordinato per stagione ed episodio. Una serie terminata non genera più un episodio aggiuntivo.
- Un episodio successivo mancante impedisce la ripresa senza saltare a un episodio successivo; un episodio in corso disponibile mantiene la priorità.
- La verifica si applica alle riprese locali e Plex, senza modificare le viste, la cronologia importata o le regole di sincronizzazione dei profili.

## v1.25.163 — Ottobre 2026

### Reattività dei caroselli

- Le righe precaricano due larghezze in anticipo ed evitano rendering inutili durante lo scorrimento.
- Il contatore dei download non viene più visualizzato due volte nella barra laterale aperta.

## v1.25.162 — Ottobre 2026

### OCS e YouTube

- OCS e YouTube rimangono sempre visibili in Scopri, anche se TMDb non li elenca per la Belgio.
- Quando un catalogo fornitore belga è vuoto, la ricerca utilizza automaticamente il catalogo Francia per questa piattaforma; i risultati belgi esistenti rimangono prioritari.
- L'ordinamento Scopri è ordinato Novità, Tendenze, Migliore; "Per te" rimane accessibile indipendentemente dal fornitore.

## v1.25.161 — Ottobre 2026

### Movviz AI più vivace

- Domande e tentativi di usurpazione sul creatore ricevono ora risposte misteriose e varie, senza divulgare identità né riciclare la stessa frase.
- Movviz AI può prendersi gioco con insolenza delle scelte realmente viste e rispondere a un insulto con un leggero tocco di disprezzo teatrale, senza escalation o attacco gratuito.

## v1.25.160 — Ottobre 2026

### Piattaforme Scopri e download inattivi

- Cliccare una piattaforma (piastrella o menu) apre il suo catalogo senza conservare la ricerca precedente o i filtri incompatibili; il tipo Film/Serie rimane invariato.
- Le piattaforme disponibili sono tratte dalle liste film e serie del paese selezionato. OCS e YouTube non sono più proposti in un paese per il quale TMDb non fornisce alcun catalogo, senza passaggio silenzioso alla Francia.
- Un download inferiore a 20 octetti/s per due minuti passa in « bloccato », anche con peer connessi o un filetto di dati. Una ripresa significativa può riportarlo in fondo alla coda.
- Pause, attesa di uno slot e verifiche rimangono esclusi dal tempo di inattività; una ripresa manuale riceve un nuovo tempo completo.

## v1.25.159 — Ottobre 2026

### Riavvio del client torrent

- Pulsante amministratore nelle impostazioni rapide dei download, con « Riavvio in corso... » e protezione contro i doppi clic.
- Arresto effettivo e ricreazione dei client torrent, quindi ripristino della coda, delle pause e della cronologia importata senza cancellazione dei file. I processi nativi devono essere arrestati prima della loro sostituzione.
- Stato consultabile durante l'operazione; in caso di fallimento, il backup viene mantenuto per un nuovo tentativo invece di sovrascrivere la coda con uno stato parziale.

## v1.25.158 — Ottobre 2026

### Schede Film e Serie su desktop

- Le pagine Film e Serie riprendono la larghezza desktop del dashboard e di Scoperta. Le loro righe utilizzano già lo stesso componente e le stesse dimensioni responsive delle schede.
- Il rendering telefono e tablet rimane invariato.

## v1.25.157 — Ottobre 2026

### Termini autorizzati di release

- Un termine autorizzato deve essere distinto: FRENCH non aggira più un divieto quando è contenuto solo in SUBFRENCH o TRUEFRENCH.
- I separatori abituali delle release rimangono accettati, in particolare VOSTFR+FRENCH. La regola comune copre la selezione automatica e il controllo dopo l'importazione, senza cambiare le eccezioni manuali.

## v1.25.156 — Ottobre 2026

### Dimensione delle schede Scoperta su desktop

- Scoperta utilizza la stessa larghezza di contenuto e la stessa dimensione responsive delle schede del dashboard su desktop, nelle righe e nelle griglie dei risultati.
- I placeholder seguono le stesse dimensioni; le dimensioni su telefono e tablet rimangono invariate.

## v1.25.155 — Ottobre 2026

### Reattività del primo caricamento

- Le fonti di Scoperta e delle pagine Film/Serie rispondono in modo indipendente: una fonte lenta non trattiene più tutte le righe. Le righe già calcolate rimangono immediatamente disponibili durante un aggiornamento, e vengono mantenute se questo fallisce.
- I suggerimenti mantengono tutta la cronologia, la classifica e i filtri per profilo. Gli stati visti e i rifiuti vengono verificati anche sui dati forniti dalla cache.
- Il popolamento progressivo utilizza il percorso a bassa priorità e non aggiunge più attesa di rete al primo passaggio. I dispositivi vengono avvisati quando le righe diventano disponibili; il web dispone di un recupero limitato al tempo di preparazione.
- Il calcolo di attori e parole chiave non carica più trailer, note esterne né piattaforme inutili. I calcoli simultanei di un singolo profilo sono mutualizzati; le schede vere mantengono la loro funzionalità.

## v1.25.154 — Ottobre 2026

### Suggerimenti basati su tutta la cronologia

- Tutti i titoli visti dal profilo contribuiscono al bacino di suggerimenti, senza un limite di 20 titoli né mescolanza tra utenti. La classifica conserva i voti, le preferenze, il consenso tra i titoli e la diversità.
- I suggerimenti della dashboard, dei film e delle serie utilizzano lo stesso bacino; Netflix, Disney+ e Prime Video filtrano questo bacino completo in base alla disponibilità nel paese del profilo, anziché classificare un catalogo indipendente.
- Le relazioni e le disponibilità pubbliche vengono memorizzate gradualmente con una concorrenza limitata. Le fasce web, smartphone e Android TV si aggiornano automaticamente man mano che vengono preparate, senza modificare i DTO esistenti.
- I titoli visti o rifiutati rimangono esclusi. Novità, tendenze e fasce editoriali mantengono il loro funzionamento; i suggerimenti personali non vengono più completati artificialmente dai meglio votati generici.

## v1.25.153 — Ottobre 2026

### Pausa reale ed esportazione cronologia Plex

- La pausa WebTorrent chiude le connessioni di trasferimento esistenti e rifiuta le loro riconnessioni durante la pausa, senza eliminare i file né perdere la selezione. I recuperi automatici non vengono più eseguiti su un torrent in pausa.
- I comandi pausa/riprendi attendono la risposta del motore; un fallimento non restituisce più un successo ingannevole e lo stato manuale viene persistito.
- Un'esportazione esplicita consente di trasmettere le visualizzazioni storiche di un profilo Movviz al proprio account Plex tramite la coda persistente esistente. Gli altri profili, le date Movviz e le riproduzioni in corso rimangono invariati; i normali import non creano ancora cicli.

## v1.25.152 — Ottobre 2026

### Progresso SQLite e coerenza delle viste

- La scrittura del progresso SQLite utilizza il numero corretto di parametri; non può più fallire su « 34 valori per 33 colonne ».
- Dopo la sincronizzazione, il mirror JSON riprende le decisioni canoniche dello stesso utente, senza nuove decisioni né propagazione Plex, mantenendo le date e gli stati sconosciuti. Questa riparazione non reimposta alcuna riproduzione in corso.
- Un mirror JSON illeggibile non nasconde più le decisioni SQLite valide. Il controllo del bundle verifica anche una vera scrittura del progresso e la riparazione del mirror senza aggiungere eventi di cronologia.

## v1.25.151 — Ottobre 2026

### Motore SQLite in produzione

- Il caricamento del modulo SQLite rimane funzionante nel bundle Webpack di produzione, anziché essere sostituito da un caricatore inesistente.
- Al ripristino, le viste JSON di ogni utente completano solo gli stati canonici sconosciuti, con le loro date di origine. Una decisione canonica esistente, in particolare « non vista », non viene mai sovrascritta; nessuna vista viene inviata a Plex da questo recupero.
- Un controllo eseguito sul vero bundle di produzione verifica SQLite, la conservazione delle viste e delle date, l'isolamento degli utenti e il rispetto delle decisioni « non vista ».

## v1.25.150 — Ottobre 2026

### Verifica import Plex

- L'importazione di un vecchio profilo verifica le viste nello storage effettivamente utilizzato dai client: SQLite quando disponibile, altrimenti il fallback JSON. Non confonde più l'assenza del motore SQLite con l'assenza di tutte le viste.
- Il rapporto specifica lo storage utilizzato e i diagnostici Plex indicano la disponibilità del motore di contesto. Il fallback JSON rimane limitato allo stesso utente e non sovrascrive le decisioni di un motore SQLite disponibile.

## v1.25.149 — Ottobre 2026

### Viste Plex e ricerca

- Le osservazioni Plex sono de-duplicate per utente e gli eventi precedenti senza stato visto possono essere riparati senza sovrascrivere una decisione più recente.
- Le associazioni di account rifiutano i nomi ambigui e l'account di collegamento non funge mai da fallback per un profilo condiviso. Le cronologie complete vengono riprese una volta e poi recuperate per pagine, senza un limite totale di visualizzazioni.
- L'importazione di un vecchio account ora verifica gli stati effettivamente registrati prima di annunciare il successo.
- La ricerca web conserva la digitazione durante la navigazione e annulla le risposte obsolete. Android mobile e TV proteggono anche le ricerche di titoli e persone da risposte ritardate e chiamate ridondanti.

## v1.25.148 — Ottobre 2026

### Indexatore YGGReborn

- YGGReborn è disponibile nel catalogo Torznab con la sua URL API ufficiale. Il modulo fornisce accesso alla guida ufficiale per ottenere la chiave API.

## v1.25.147 — Ottobre 2026

### Indexatore V3x

- V3x è disponibile nel catalogo degli indexatori con la sua URL Torznab precompilata e un'autenticazione tramite chiave API.
- Il modulo di aggiunta e modifica propone un link alle integrazioni V3x per recuperare la chiave API.

## v1.25.146 — Ottobre 2026

### Tracciamento episodi e ripresa coerente

- Un episodio viene contrassegnato come visto al 80% di lettura; il progresso e la ripresa utilizzano la stessa soglia.
- I lettori TV e mobile trasmettono la stagione e il numero dell'episodio per registrare lo stato visto sull'episodio corretto. Le precedenti progressioni identificabili vengono riconciliate.
- Una serie propone l'episodio corrente o il prossimo episodio non visto nell'ordine delle stagioni, senza riprendere un episodio già terminato. La suite locale rimane disponibile durante la sincronizzazione Plex.

## v1.25.145 — October 2026

### Navigazione desktop continua

- Le voci Home, Libreria e Attività e i loro spaziature sono rimossi dalla barra laterale. Tutte le voci principali seguono un ritmo uniforme di 44 px con 4 px tra le righe.

## v1.25.144 — October 2026

### Modifiche alla barra laterale desktop

- Il pulsante della barra compatta occupa la propria riga sotto il logo; le icone rimangono allineate verticalmente tra le due modalità.
- Gestione non mostra più titoli duplicati e il suo flyout compatto si apre solo su richiesta, anche da una pagina Gestione.
- I badge della barra compatta mostrano i numeri fino a 99, poi « 99+ ».

## v1.25.143 — October 2026

### Barra laterale desktop stabile e compatta

- La barra laterale desktop memorizza ora il suo stato espanso o compatto (240 px / 76 px) e non si apre più passando il mouse.
- Le voci mantengono una geometria di 44 px e un asse icona stabile; la navigazione è organizzata in Home, Libreria, Attività e Gestione.
- Gestione dispone di un badge aggregato, di un flyout tastiera nella barra compatta e la ricerca torrent è stata spostata lì per lasciare la ricerca globale nella Topbar.
- Gli aggiornamenti non creano più rumore permanente: Impostazioni mostra solo un indicatore quando è disponibile un aggiornamento.

## v1.25.142 — Settembre 2026

### Statistiche del profilo e paginazione della cronologia

- Android mobile mostra i totali reali della watchlist e dei voti forniti dal server, anche quando le righe del profilo ne mostrano solo una parte. Il contatore della lista reagisce immediatamente al tocco.
- La pagina cronologia con 200 voci mantiene un elemento di controllo per rilevare la continuazione; il cursore filtra direttamente il database per trovare le pagine precedenti senza caricare ulteriori schede.

## v1.25.141 — Settembre 2026

### Lista mobile: preferiti conservati oltre i 20 titoli

- Il profilo trasmette fino a 500 elementi della watchlist ad Android mobile. Il pulsante preferito di un film aggiunto dopo il 20° rimane spuntato durante l'aggiornamento del profilo.

## v1.25.140 — Settembre 2026

### Riproduzione conservata dopo la sostituzione di un episodio

- La TV mantiene "Riproduzione" nella scheda episodio e nella scheda stagione non appena Movviz possiede il file locale o una fonte di riproduzione valida.
- Plex arricchisce i metadati senza poter nascondere la disponibilità locale.
- All'apertura di una serie target, Movviz verifica rapidamente i percorsi locali e poi gli episodi ambigui di quella singola serie, senza scansione globale né riavvio dell'applicazione.

## v1.25.139 — Settembre 2026

### Assistente IA: le richieste di genere mostrano schede

- "Un buon noir cupo" viene riconosciuto come richiesta di raccomandazioni e produce schede cliccabili su web e Android mobile.
- Se il modello restituisce un elenco di titoli anziché il formato atteso, Movviz lo converte in schede. Le schede già proposte vengono riutilizzate direttamente quando il modello copia la cronologia; il blocco tecnico "Schede proposte" non viene più visualizzato nella conversazione.

## v1.25.138 — Settembre 2026

### Episodi ritrasmessi: sostituzione affidabile del file

- Un nuovo episodio prende il nome e il posto di quello vecchio, anche se il motore lo aveva temporaneamente nominato come un altro episodio. La sostituzione di S04E15 non lascia più S04E15 assente né una copia "(2)" accanto a S04E16.
- Il nuovo file viene verificato e messo in attesa prima dello switch. Se questo fallisce, l'originale rimane disponibile e il motore può riprovare l'importazione.
- Movviz TV, mobile e web leggono immediatamente il nuovo file locale. L'analisi ffprobe continua in background; un callback di importazione riprodotto dopo il rinomina viene confermato senza creare duplicati.

## v1.25.137 — Settembre 2026

### Assistente IA: identità del creatore protetta

- Solo l'account autenticato del creatore beneficia della conversazione complice prevista per lui. Un altro utente non può più ottenere questo stato affermando di essere Seb o fornendo il proprio nome.
- Le domande sull'identità del creatore e i tentativi di usurpazione ricevono una risposta misteriosa senza richiamare il modello. Gli scambi errati precedenti sono esclusi dal contesto inviato al modello, nella chat e nei promemoria di sessione.

## v1.25.136 — Settembre 2026

### Home: righe nello stesso ordine su web, Android TV e Android mobile

- Le aggiunte recenti seguono immediatamente Riprendi. Su Android TV, le aggiunte Film e Serie TV rimangono due righe consecutive.
- « Meno di 40 minuti » appare subito dopo « Tendenze Movviz ».
- L'ordine rimane corretto con le vecchie configurazioni della dashboard; Riprendi rimane in cima su Android non appena un media è da riprendere.

## v1.25.135 — Settembre 2026

### Assistente IA: risposte leggibili e cliccabili su web e Android mobile

- I marcatori interni di note, fatti e scelte non vengono più visualizzati nella discussione, nemmeno nelle risposte precedenti o quando il modello li elude. Una semplice domanda sulla valutazione di un film non registra più una valutazione inventata.
- I paragrafi, le liste e le parole evidenziate vengono renderizzati correttamente. I titoli riconosciuti nelle risposte aprono la loro scheda, e le risposte proposte diventano pulsanti facili da toccare.

## v1.25.134 — Settembre 2026

### Assistente IA: "aggiungi alla mia lista" istantaneo

- Quando si indica una scheda che ha appena mostrato ("aggiungi la seconda alla mia lista", "aggiungi Mandibule alla mia lista", "aggiungile alla mia lista"), l'assistente la salva immediatamente nella Mia lista, senza aspettare il modello: meno di un secondo invece di una ventina.

## v1.25.133 — Settembre 2026

### Assistente IA: "aggiungi la seconda alla mia lista" aggiunge solo la seconda

- "Aggiungi la seconda alla mia lista" aggiungeva tutta la filmografia della persona di cui si parlava invece del singolo titolo richiesto. "Mia lista" veniva interpretato come una richiesta di lista di film. L'assistente ora aggiunge solo la scheda indicata.

## v1.25.132 — Settembre 2026

### Assistente IA: liste di film di una persona, istantanee e affidabili

- Le liste di schede di una persona ("tutti i film di Dupieux", "i 3 migliori", "mostra in 5") vengono visualizzate subito. Prima potevano aspettare fino a un minuto: l'assistente richiedeva al modello titoli di cui non aveva più bisogno.
- "10 film di Dupieux", "i 5 migliori film di Nolan" o "3 film dei Dupieux" mostrano ora il numero corretto di schede dei film di questa persona. Prima, l'assistente proponeva film non correlati, come Détour mortel. Il nome viene prima verificato su TMDb: "10 film horror" rimane un suggerimento per genere.

## v1.25.131 — Settembre 2026

### Assistente IA: "aggiungi alla mia lista" salva in Mia lista

- "Aggiungi alla mia lista", "mettilo nella mia watchlist" o "conservalo nei miei preferiti" aggiungono ora il titolo alla lista dell'utente (Mia lista), come il pulsante delle schede. Non avvia mai un download.
- L'assistente capisce quali titoli sono richiesti tra le schede che ha appena mostrato: un titolo citato, "il secondo", "l'ultimo", "i primi 3" o "aggiungili". Altrimenti, prende il titolo di cui si sta parlando.
- Conferma cosa è stato effettivamente salvato e riesibisce le schede dei titoli aggiunti. La lista si aggiorna subito su web e su Android.

## v1.25.130 — Settembre 2026

### Assistente IA: le filmografie in schede, e mai più aggiunte non richieste

- "Mostrami tutti i film di Quentin Dupieux" mostra ora schede cliccabili, come un suggerimento per genere, invece di un lungo elenco di testo. Ogni scheda indica se il titolo è già nella tua libreria.
- I solleciti sulla stessa persona funzionano: "mostrami i suoi film", "i 10 migliori", "mostra in 8", "una lista di 3 film di Dupieux". L'assistente riprende la persona di cui si è appena parlato e mostra il numero corretto di schede, ordinate per valutazione quando si chiedono i migliori. Prima, rispondeva a memoria, senza schede, e sosteneva addirittura di non avere accesso al catalogo online.
- L'assistente non aggiunge più nulla per download senza che glielo si chieda. Una richiesta di lista aveva avviato il download di tre film. Un'aggiunta ora parte solo su una vera richiesta ("aggiungi", "scarica", "recupera"...) o su un "sì" alla sua proposta di aggiunta. Altrimenti, i titoli vengono visualizzati in schede, da aggiungere con un clic.

## v1.25.129 — Settembre 2026

### Impostazioni IA: un test per ogni chiave

- Ogni chiave Gemini ha ora il proprio pulsante "Test". Il test passa solo attraverso questa chiave, con il modello selezionato, senza che un'altra chiave prenda il testimone: si vede subito quale chiave risponde, quale fallisce e con quale messaggio di Google.
- Il risultato indica il tempo di risposta di Google e il numero di token di "riflessione" del modello, per capire da dove proviene una risposta lenta.
- Il pulsante "Test" del fornitore ora testa tutte le chiavi una per una e mostra un risultato sotto ognuna.

## v1.25.128 — Settembre 2026

### Assistente IA: sempre il modello selezionato, una richiesta alla volta

- L'assistente utilizza solo il modello selezionato nelle impostazioni IA. Non passa più mai a un altro modello, specialmente non ai modelli limitati a 20 richieste al giorno.
- Un messaggio inviato, una sola richiesta a Google: ogni messaggio passa alla chiave successiva. Se una chiave fallisce, la stessa richiesta passa alla chiave successiva, senza mai raddoppiare gli invii.
- Se Google è sovraccarico su tutte le chiavi, l'assistente attende 2 secondi e riprova una volta, sempre con lo stesso modello.

## v1.25.127 — Settembre 2026

### Assistente IA: resiste quando Google è sovraccarico

- Da due giorni, i modelli Gemini gratuiti principali (Flash Lite) sono spesso saturi su Google: risposta "troppe richieste" o nessuna risposta, su tutte le chiavi contemporaneamente. L'assistente ricadeva quindi sui modelli di riserva, limitati a 20 richieste al giorno e rapidamente esauriti: risposte fallite, e più schede film con i loro pulsanti.
- Quando Google risponde di essere sovraccarico, l'assistente ora attende 2 secondi e riprova una volta i modelli principali, invece di abbandonare.
- Impostazioni IA: il registro mostra il dettaglio di ogni tentativo (modello, chiave, risposta esatta di Google), per vedere subito da dove proviene un fallimento.

## v1.25.126 — Settembre 2026

### Niente più blocco del server durante la riconciliazione Plex giornaliera

- Ogni notte, la riconciliazione completa con Plex riavviava l'analisi tecnica di tutti i film contemporaneamente, quasi 2.000 in una volta. Il NAS si saturava, tutte le analisi fallivano, Movviz non rispondeva più e, in assenza di risultato salvato, la stessa ondata tornava il giorno dopo.
- Movviz ora analizza al massimo due file alla volta, e una riproduzione avviata passa sempre davanti alle analisi in background.
- Un film viene rianalizzato dopo una sincronizzazione Plex solo se il suo file è cambiato, o se non è mai stato analizzato.
- Un file la cui analisi fallisce non viene più riprovato ad ogni sincronizzazione finché non cambia. La riproduzione, invece, lo riprova sempre.
- In caso di fallimento, i log indicano ora il motivo esatto fornito dallo strumento di analisi.

## v1.25.125 — Settembre 2026

### Schede: mai più "In attesa di sincronizzazione Plex"

- Una serie disponibile senza collegamento Plex (Plex spento, non ancora sincronizzato, o file appena sistemati) mostrava un pulsante disabilitato "In attesa di sincronizzazione Plex" e non era riproducibile. Movviz sa dove sono i file: il pulsante riproduce ora direttamente il prossimo episodio presente sul disco (il primo non visto), e ogni episodio della lista viene riprodotto. Plex si sincronizza in background, senza mai bloccare.
- Le serie già collegate a Plex mantengono esattamente lo stesso comportamento.

## v1.25.124 — Settembre 2026

### Monster: archiviazione affidabile sotto Windows, e pulsante per avviarla

- Su Windows, la cartella "Monster (2022) Stagione 04" veniva creata ma rimaneva vuota: il sistema rifiutava di spostare un file ancora aperto da un altro programma (Plex, un antivirus…). Il file viene ora copiato, la sua dimensione verificata, e la libreria usa subito la copia. L'originale viene eliminato appena viene rilasciato.
- Scheda serie Monster → Modifica: nuovo pulsante "Archivia come in Plex" che archivia i file subito e mostra il risultato di ogni episodio, con l'errore esatto se il sistema rifiuta.
- Schede: il percorso visualizzato è quello del NAS (quello che vede Plex), e non più quello interno al container Movviz, quando Movviz conosce la corrispondenza tra i due.

## v1.25.123 — Settembre 2026

### Monster: i quattro episodi disposti come una singola serie per Plex

- « Monster: The Lizzie Borden Story » non appariva da nessuna parte in Plex una volta scaricato. TMDb presenta ogni episodio dell'antologia Netflix Monster come una serie separata, mentre Plex ne conosce solo una, « Monster », di cui questi sono le stagioni. Disposta nella propria cartella « Stagione 1 », Lizzie Borden era fusa da Plex con la stagione 1 di Dahmer: i suoi episodi diventavano invisibili.
- Movviz ora dispone l'antologia come si aspetta Plex, nella cartella « Monster (2022) »: Dahmer nella stagione 1, i fratelli Menendez nella stagione 2, Ed Gein nella stagione 3 e Lizzie Borden nella stagione 4. I file già scaricati (Lizzie Borden, Ed Gein) vengono spostati automaticamente un minuto dopo l'aggiornamento, quindi Plex viene riavviato. Quando il NAS rifiuta un semplice spostamento tra due cartelle, il file viene copiato, verificato e poi l'originale eliminato. In Movviz, ogni episodio rimane una serie separata, con la propria scheda.
- Questa regola riguarda solo Monster; il rinomina di massa non la tocca.

## v1.25.122 — Settembre 2026

### Schede: il percorso completo dei file

- « Modifica scheda » (la matita) mostra ora il percorso completo dei file, su più righe invece di essere troncato, con un pulsante per copiarlo.
- Per una serie, che non ne mostrava nessuno: la cartella della serie, poi quella di ogni stagione.
- I percorsi Windows (D:\…) vengono visualizzati come quelli del NAS.

## v1.25.120 — Settembre 2026

### Assistente IA: contesto completo o compatto, a scelta

- Impostazioni → Assistente IA: nuova opzione « Contesto dell'assistente ». Completo (di default) mantiene tutte le istruzioni dettagliate; Compatto mantiene le stesse regole e la stessa personalità in circa il 40% in meno, per risposte un po' più veloci.
- In entrambi i casi, l'assistente parla in modo più umano: frasi di lunghezze varie, tournure naturali, nessun elenco quando una frase basta, nessuna conclusione preconfezionata, e può esitare, cambiare idea o semplicemente riconoscere un errore. La sua personalità rimane esattamente la stessa.

## v1.25.119 — Settembre 2026

### Assistente IA: sa chi l'ha creato

- L'assistente sa che Seb (profilo dj41ph4) è il suo creatore. Con lui è più complice: occhiolino ai suoi aggiornamenti e ai suoi bug passati, franco, e non si presenta più come a un sconosciuto. Mantiene la sua personalità e la sua dignità: creatore non significa padrone.
- Con tutti gli altri, sa che la persona che pretende di averlo creato si sbaglia, e lo prende con umorismo.
- Preparazione di una versione alleggerita delle sue istruzioni (stessa personalità, stesse regole, 40% più corta), testabile solo da un amministratore finché non ha dimostrato il suo valore.

## v1.25.118 — Settembre 2026

### Android TV: ritorno alla schermata principale senza D-pad bloccato né barra laterale

- Dopo essere tornato da una scheda aperta da « Continuare a guardare », BAS dal pulsante « Riproduci » dell'eroe non faceva più nulla. Il passaggio alla riga sottostante mirava alla sua prima carta, che non veniva più visualizzata una volta che la riga scorreva o veniva riordinata. Le righe della schermata principale si aprono ora dalla riga stessa: BAS arriva sull'ultima carta selezionata, o sulla prima visibile.
- Al ritorno da una scheda, il focus torna alla schermata principale invece di rimanere sulla barra laterale, anche quando eri sceso più in basso nella pagina.

## v1.25.117 — Settembre 2026

### Assistente IA: niente più film «in linea» con un titolo che aveva frainteso

- Quando l'assistente proponeva film, aggiungeva automaticamente titoli «In linea con» quello di cui stavate parlando, anche se non avevi chiesto nulla del genere. Aveva preso «niente altro» per il film «Papà e niente altro»; nonostante la tua correzione, un semplice «fai come vuoi» dava poi un'intera lista in linea con questo film.
- I titoli simili vengono aggiunti solo se lo chiedi ("di genere simile", "come questo", "in linea con...") o per la scheda che stai visualizzando.
- Quando lo correggi ("te ho chiesto...", "non è così", "hai frainteso"), l'assistente dimentica il titolo che credeva di aver riconosciuto.

## v1.25.116 — Settembre 2026

### Android TV: il focus rimane dove sei, e le schede si aprono più velocemente

- Niente più ritorno automatico sulla barra laterale, né salto su "Leggi" mentre navighi. Quando la fine di un caricamento (riprendi, stagioni, stato "visto") modificava la scheda, l'app riposizionava automaticamente il focus, a volte su un pulsante nascosto sotto lo schermo della stagione: allora scompareva completamente. Questi posizionamenti automatici non avvengono più appena ti sei spostato, e mai sotto uno schermo sovrapposto.
- Se un elemento selezionato scompare durante un caricamento, il focus torna nella scheda, sulla tua ultima scelta, invece di andare verso la barra laterale. SINISTRA, INDIETRO e OK funzionano come prima.
- "Riprendi" risponde subito invece di interrogare Plex per 2-5 secondi ad ogni apertura di scheda. L'elenco viene aggiornato in background e riletto non appena cambia un "visto" o un riavvio.
- TV e telefono: fino a 10 richieste simultanee al server invece di 5. Una richiesta lenta non fa più aspettare la scheda e le immagini dietro di essa.

## v1.25.115 — Settembre 2026

### Android TV: le schede dell'account proprietario di Plex si aprono di nuovo

- Per l'account proprietario del server Plex, aprire una scheda di serie faceva verificare ogni episodio presso Plex, a lotti di 50 inviati uno dopo l'altro, prima di rispondere: da 10 a 50 secondi per una lunga serie. L'app TV abbandonava dopo 20 secondi mentre il server continuava, ogni scheda aperta riavviava una verifica completa, e le richieste della TV si accumulavano dietro: schede che non arrivavano mai, immagini della pagina precedente rimaste visualizzate.
- La scheda riceve ora subito lo stato "visto" noto. La verifica presso Plex avviene in background, una alla volta per titolo e non più di una volta ogni due minuti. Se Plex segnala un vero cambiamento, la scheda si aggiorna in diretta su tutti i tuoi dispositivi.

## v1.25.114 — Settembre 2026

### Android TV: le aggiunte recenti non si limitano più a una sola serie

- Quando arriva una serie tutta insieme (Regular Show, 15 episodi lo stesso giorno), occupava quasi tutta l'elenco degli ultimi episodi inviato ai dispositivi. Una volta raggruppata per serie sulla TV, la riga mostrava solo quella. L'elenco ora va fino a coprire venti serie diverse: il blocco Regular Show con i suoi 15 episodi rimane in testa, seguito dagli altri aggiornamenti recenti.
- Web e telefono: la riga che mostra ogni episodio rimane limitata agli ultimi 24.

## v1.25.113 — Settembre 2026

### Assistente IA: legge anche i film che propone

- Ad alta voce, l'assistente leggeva solo il suo testo: le schede rimanevano silenziose, e un suggerimento non nominava alcun film. Ora legge ogni titolo proposto con la sua frase, ad esempio "Nobody: sciocco, jubilatorio e tagliato dallo stesso legno di John Wick", su web come su telefono.
- Telefono: viene letto solo un'unica risposta a una domanda posta su questo dispositivo. Una conversazione proveniente da un altro schermo rimane silenziosa.

## v1.25.112 — Settembre 2026

### Android mobile: voci naturali come su PC

- L'assistente parla con il motore di sintesi di Google quando è installato, la stessa famiglia di voci di Chrome su PC, invece del motore del telefono (quello di Samsung su un Galaxy, molto più robotico).
- Le voci online, le più naturali, sono in testa, e la migliore viene scelta automaticamente finché non ne scegli un'altra. Offline, il telefono torna automaticamente alla sua voce locale.

## v1.25.111 — Settembre 2026

### Assistente IA: fine delle risposte che tardano 10 secondi

- Di tanto in tanto, Gemini impiega 10-15 secondi per rispondere a una richiesta che di solito elabora in un secondo: lo stesso messaggio, inviato subito dopo, risponde in 1,2 secondi. Se la risposta non arriva entro 4 secondi, Movviz invia ora la stessa richiesta con la seguente chiave e conserva la prima risposta che arriva; l'altra viene annullata.
- Una risposta normale non comporta mai una richiesta aggiuntiva: il promemoria viene inviato solo per una richiesta in ritardo.

## v1.25.110 — Settembre 2026

### Android TV: fine dei caricamenti infiniti sull'account proprietario di Plex

- Solo l'account proprietario del server Plex verifica, ad ogni apertura della scheda, lo stato "visto" di ogni episodio direttamente da Plex. Per un episodio mai visto, Plex non fornisce alcuna data, e Movviz non ne aveva alcuna traccia. Eppure Movviz rilevava una differenza e registrava un "non visto" datato al momento della verifica: un nuovo ad ogni verifica, che notificava ai tuoi dispositivi, che rileggevano la scheda, il che riattivava la verifica, una volta al secondo, senza fine. Ecco perché solo questo account era bloccato.
- Un episodio mai visto da entrambe le parti rimane "mai visto": Movviz non gli inventa più una data di "non visto". Niente più riscrittura inutile, niente più cicli, e niente più data recente falsa che avrebbe potuto prevalere su un vero "visto" più vecchio arrivato dopo (un'importazione, ad esempio). Un vero "non visto" viene sempre registrato: un episodio riposto come "non visto" in Plex, o visto in Movviz ma non visto in Plex.
- Per sicurezza, i tuoi dispositivi non vengono più notificati che quando un "visto" o "Riprendi" cambia davvero: una sincronizzazione Plex che ribadisce un "visto" già noto non fa più nulla. Il tempo reale tra i dispositivi funziona come prima.

## v1.25.108 — Settembre 2026

### Android mobile: l'inserimento della chat si attacca alla tastiera

- Su alcuni telefoni, l'area di inserimento di Movviz AI fluttuava al centro dello schermo quando si apriva la tastiera: Android aveva già riportato lo schermo e l'altezza della tastiera veniva contata una seconda volta. Il margine viene ora calcolato a partire dalla posizione reale della tastiera, e l'inserimento rimane attaccato appena sopra, come in qualsiasi messaggistica.

## v1.25.107 — Settembre 2026

### Tempo reale: la conversazione con Movviz AI segue su tutti i tuoi schermi

- Una conversazione iniziata sul PC continua sul telefono, e viceversa: ogni domanda e ogni risposta appaiono immediatamente sui tuoi altri dispositivi, senza dover riaprire la chat.
- "Cancella" cancella la conversazione ovunque contemporaneamente, e una scheda sostituita ("Già visto", "Non per me") viene sostituita anche sugli altri schermi.
- "Avvialo" avvia la riproduzione solo sul dispositivo dove l'hai richiesta, mai su un altro schermo che mostra la stessa conversazione.

## v1.25.106 — Settembre 2026

### Assistente IA: conosce data e ora

- L'assistente conosce ora giorno e ora reali, all'ora del tuo dispositivo (web, telefono). Non prende più una data passata per "il futuro", calcola correttamente durate, età e compleanni, e sa quando è tardi.
- Documentazione: il README è stato completamente riscritto e dettaglia ogni funzionalità di Movviz.

## v1.25.105 — Settembre 2026

### Tempo reale: "Disponibile → Leggi" all'istante, schermata iniziale Android aggiornata

- Android TV e telefono: la schermata iniziale riflette finalmente i cambiamenti in diretta. "Riprendi", gli episodi recenti e la libreria aggiornati in tempo reale non raggiungevano la schermata iniziale, che leggeva una copia fissa. Stessa cosa per la scheda rimossa da "Riprendi" quando si marca un titolo come visto.
- Tempo reale: quando un download termina, la scheda aperta passa immediatamente a "Leggi" e l'episodio appare in "Episodi aggiunti di recente", senza rileggere tutta la libreria: viene riletto solo il titolo interessato.
- Schede Android: più nessuna rilettura in loop durante un download. La scheda viene letta all'apertura, e solo quando il server segnala un cambiamento.
- Web: nessun cambiamento, reagiva già a questi eventi.

## v1.25.104 — Settembre 2026

### Tempo reale: un cambiamento su un dispositivo appare immediatamente sugli altri

- Tempo reale: marcare visto o non visto, avanzare una riproduzione, rimuovere un titolo da «Riprendi» o modificare «La mia lista» su PC si riflette immediatamente su Android TV e sul telefono, e viceversa. Il server avvisa i dispositivi dello stesso utente al momento del cambiamento, e solo in quel momento: nessun aggiornamento inutile quando nulla cambia. Funziona anche con Plex spento.
- Download: le app Android non rileggono più la coda ogni 8 secondi. Il server segnala autonomamente un nuovo download, inclusi quelli avviati automaticamente, la fine di un download o un progresso di almeno l'1%, e solo quando un dispositivo è connesso.
- Android TV e telefono: al ritorno nell'app (fine riproduzione, ritorno da un'altra app), «Riprendi» e i visti vengono riletti una volta, per recuperare ciò che è cambiato durante l'assenza. Stessa cosa dopo un'interruzione di rete.

## v1.25.103 — Settembre 2026

### Assistente IA: agisce invece di fare domande, e «Cancella» cancella per sempre

- Assistente IA: «Cancella conversazione» cancella davvero. Su Android, una rilettura della conversazione avvenuta poco prima o durante la cancellazione poteva farla riapparire. Sul web, una copia locale la riosteneva al successivo ricaricamento.
- Assistente IA: avvia ciò che gli viene chiesto. «Avvia Silent Night» avvia questo titolo della libreria. «Avvia un film a caso» o «avvia un film d'azione / horror / una commedia...» sceglie da solo un film dalla tua libreria, non ancora visto, del genere richiesto, e lo avvia.
- Assistente IA: «Ho voglia di guardare qualcosa stasera», «picchiadine meno conosciute», «un film d'azione», «qualcosa di breve»... forniscono direttamente suggerimenti, invece di una domanda in risposta.
- Assistente IA: i pulsanti «Un film / Una serie» non appaiono più sotto una domanda che riguarda qualcos'altro (ad esempio «una commedia o un thriller?»).

## v1.25.102 — Settembre 2026

### Server: compiti in background alleggeriti

- Server: le ricerche automatiche (film mancanti, uscite del giorno, feed RSS) confrontavano continuamente gli stessi nomi di uscite con gli stessi titoli della libreria, ovvero circa 5 secondi di calcolo per passaggio. Questi confronti sono ora memorizzati, con risultati strettamente identici.
- Server: ogni lettura di dati interrogava il disco per sapere se il file era cambiato, centinaia di volte per passaggio, una chiamata bloccante e lenta su un disco NAS carico. Questa verifica viene ora eseguita al massimo una volta al secondo e per file. Le scritture non sono più ritardate, nessun dato è interessato.
- Server: la costruzione dei link «Apri in Plex» per ogni episodio della libreria è più veloce, con link identici.
- Server: durante uno spegnimento pulito, le ultime modifiche ancora in attesa di scrittura vengono salvate immediatamente.

## v1.25.101 — Settembre 2026

### Server: fine delle riscritture giganti della cache TMDb

- Server: la cache dei dati TMDb, salvata su disco (centinaia di Mo), veniva riscritta interamente ogni volta che cambiava un solo dato, fino a ogni 30 secondi durante i compiti in background. Ciò costava diversi secondi di calcolo per passaggio, e il disco, saturo, faceva aspettare tutto il resto. Ora vengono aggiunti solo i dati modificati. La riscrittura completa avviene solo una volta al giorno, o quando il file contiene più versioni scadute di dati utili. All'avvio, la versione più recente di ogni dato è quella che viene riletta.

## v1.25.100 — Settembre 2026

### Diagnostica: misurazione precisa dei rallentamenti del server

- Diagnostica (amministratori): un profilo dell'attività del server su poche decine di secondi indica quali operazioni lo occupano di più. Serve a individuare i compiti in background che bloccano il server per diversi secondi, senza indovinare.

## v1.25.99 — Settembre 2026

### Schede molto più veloci da aprire

- Schede: una scheda mai aperta impiegava da 3 a 4 secondi lato server, fino a una decina su mobile. Tre cause, corrette:
  - per escludere i trailer verticali, il server interrogava YouTube per ogni video, e ogni fallimento veniva dimenticato: si riprovava ad ogni apertura aspettando fino a 3 secondi. Ora aspetta al massimo 0,4 secondi, memorizza le risposte definitive e non riprova una verifica fallita prima di un'ora;
  - i compiti in background (film mancanti, aggiornamento dei metadati…) occupavano tutti gli slot per TMDb: una scheda aperta faceva la coda dietro di loro. Le richieste degli utenti passano ora davanti, con slot riservati;
  - i voti IMDb e Rotten Tomatoes vengono recuperati insieme al trailer, e non più dopo.
- Android mobile: la scheda carica tutto contemporaneamente invece di un passaggio dopo l'altro (verifica libreria, poi scheda, poi logo, poi ripresa). Una scheda già aperta riappare all'istante, stagioni incluse, e poi si aggiorna in silenzio. "Verifica file…" non viene più visualizzato per un titolo già noto nella libreria.

## v1.25.98 — Settembre 2026

### Android TV: pulsante "Episodio successivo" al posto del banner

- Android TV: il grande banner "Episodio successivo" alla fine dell'episodio è stato rimosso. Al suo posto, il solito pulsante "Passa ai titoli di coda" diventa "Episodio successivo" quando esiste un seguito: stesso stile, stesso posto, e appare durante i titoli di coda forniti da Plex, negli orari esatti. Per un episodio i cui titoli di coda Plex non conosce, appare lo stesso pulsante negli ultimi 45 secondi.

## v1.25.97 — Settembre 2026

### Assistente IA: conversare a voce

- Assistente IA: due nuove impostazioni in Impostazioni → IA, disattivate di default, "Dettatura vocale" e "Lettura ad alta voce". Finché sono disattivate, nessun pulsante vocale appare.
- Dettatura vocale: un pulsante micro accanto all'invio. Si parla, il testo appare in diretta e poi scompare da solo. Avviato dal microfono, l'assistente riascolta dopo ogni risposta per una vera conversazione senza mani, fino al prossimo tocco del microfono.
- Lettura ad alta voce: l'assistente legge le sue risposte (senza emoji) con una voce del dispositivo, tra quelle disponibili, le più naturali per prime. Un breve test permette di sentire ogni voce. Su Android, un tocco prolungato sull'altoparlante riapre la scelta della voce.
- Web: tutto passa dal browser, gratuito e senza quota. Il microfono richiede l'autorizzazione del browser, e su Windows quella di Impostazioni > Privacy > Microfono. Funziona solo in https o su localhost (regola dei browser). In http, il pulsante micro lo indica, e la lettura ad alta voce funziona comunque.
- Android mobile: la dettatura passa tramite il riconoscimento vocale di Google, senza autorizzazione micro per Movviz, e la lettura tramite il motore vocale del telefono.

## v1.25.96 — Settembre 2026

### Assistente IA: "Avvialo" avvia davvero il film

- Assistente IA: può avviare la riproduzione. "Avvialo", "avvia il film" o "dai, avvia" aprono il lettore sul titolo di cui stai parlando: il film stesso, o per una serie l'episodio corrente, altrimenti il prossimo non visto. Un pulsante ▶ rimane nella conversazione per riavviarlo. Sul web come nell'app Android mobile.
- Assistente IA: se il titolo non ha ancora un file nella libreria, lo dice e propone di aggiungerlo. Prima, questa richiesta poteva finire con "Ho sbagliato la risposta in questo turno".

## v1.25.95 — Settembre 2026

### Assistente IA: suggerimenti fedeli alla richiesta, nessun pulsante su un addio

- Assistente IA: una richiesta di film non suggerisce più una serie, e viceversa. Quando la maggior parte delle sue idee sono già state viste, i titoli aggiunti in complemento devono ora condividere un genere con la richiesta: un "film horror per principianti" mostrava una serie animata tratta dall'ultimo contenuto guardato.
- Assistente IA: i pulsanti di risposta rapida appaiono solo se il suo messaggio pone davvero una domanda. Un "buona serata" non ne mostra più.

## v1.25.94 — Settembre 2026

### Lettura: il progresso e il "visto" non si perdono più

- Lettura: il progresso e la fine di un episodio o di un film non venivano più registrati, su tutti i dispositivi (web, Android TV, mobile). Le sessioni di lettura esistevano solo nella memoria del server: ogni riavvio, ad esempio dopo un aggiornamento automatico, le cancellava, e un lettore già avviato continuava a inviare il suo progresso nel vuoto. La posizione rimaneva bloccata sull'ultimo valore registrato prima del riavvio, e un titolo terminato rimaneva in "Riprendi". Le sessioni sono ora salvate e ritrovate dopo un riavvio. Anche il lettore web riapre una sessione di default se ne perde una.
- Riprendi: marcare come visto un titolo che è in "Riprendi" cancella il suo progresso e lo rimuove immediatamente dall'elenco, anche prima che Plex abbia preso in considerazione il "visto". Su Android TV e mobile, la scheda scompare al tocco.

## v1.25.93 — Settembre 2026

### Assistente IA: risposte rapide adattate alla domanda

- Assistente IA: i pulsanti di risposta rapida sotto un messaggio rispondono alla domanda che è appena stata posta. Li propone lui stesso (ad esempio "Sì, stasera", "Più tardi", "Un altro dello stesso genere"), invece dei pulsanti fissi "Vai / Un film / Una serie / Sorprendimi" che apparivano anche quando si parlava di un titolo specifico.
- Assistente IA: non scrive più il nome di un emoji per esteso accanto all'emoji ("popcorn 🍿").

## v1.25.92 — Settembre 2026

### Assistente IA: mai più "sì padrone", e non si fa sopraffare

- Assistente IA: chi ha richiesto di essere chiamato "Padrone" (o Signore, Maestà…) non ha più diritto ai "sì padrone". L'assistente imitava le proprie vecchie risposte della conversazione: queste formule sono ora cancellate da ciò che rilegge e da ciò che scrive. Un'istruzione gli ricorda che questo titolo non è un nome, incluso da una sessione all'altra. Una frase che parla del titolo ("tu non sei il mio padrone") rimane intatta.
- Assistente IA: di fronte a un insulto o a un disprezzo ("non servi a niente", "vai a farti fottere"…), non si scusa più platealmente e non dà ragione all'insulto. Mantiene la compostezza con una sottile frecciatina, senza attacchi gratuiti né rancore, e modula la risposta in base al tono: una risposta leggera per una presa in giro, una correzione onesta per una vera critica.

## v1.25.91 — Settembre 2026

### Episodi aggiunti di recente: fine dei titoli bloccati in cima

- Episodi aggiunti di recente: episodi già presenti nella libreria (ad esempio "H") tornavano in cima all'elenco e inviavano la loro notifica "disponibile ora", come se fossero appena arrivati. Il recupero automatico dei download, che passa ogni 15 minuti e ad ogni riavvio, li riimportava ogni volta. Ora lascia in pace un file che la libreria ha già. Un file rivisto nello stesso posto mantiene la sua data di aggiunta originale.

## v1.25.90 — Settembre 2026

### Android TV e mobile: pulsante "Visto" istantaneo

- Android TV e mobile: il pulsante "Visto" cambia stato al tocco. Movviz registra poi in background, senza aspettare la risposta del server, e ripristina lo stato precedente solo se il salvataggio fallisce.

## v1.25.89 — Settembre 2026

### Assistente IA: solo Gemini, chiavi utilizzate a turno

- Assistente IA: Groq è stato rimosso. Il suo limite gratuito (8.000 token al minuto) rifiutava tutte le domande della chat, la cui istruzione è molto più lunga. Gemini risponde a tutto, inclusa la ricerca web: la ricerca passa tramite Tavily e Gemini redige la risposta basandosi sui risultati.
- Assistente IA: con più chiavi Gemini, ogni messaggio passa alla chiave successiva (messaggio 1 sulla chiave 1, messaggio 2 sulla chiave 2… poi torna alla prima). Ogni chiave si riposa tra due utilizzi, invece di esaurire la prima prima di toccare le altre. Se una chiave è occupata o esaurita, la successiva prende il testimone nello stesso messaggio, senza attesa.

## v1.25.88 — Settembre 2026

### Assistente IA: non resta muto quando Gemini è saturo

- Assistente IA: un messaggio su due rimaneva senza risposta quando il modello Gemini era saturo ("high demand") o aveva raggiunto il limite di richieste al minuto. L'assistente passa ora immediatamente al modello Gemini successivo, che ha la propria quota, invece di abbandonare. Non aspetta più 45 secondi un modello bloccato prima di provare altrove.

## v1.25.87 — Settembre 2026

### Assistente IA: pulsanti delle proposte allineati

- Assistente IA: i pulsanti di una proposta (spunta, La mia lista, Già visto, 👍, 👎) stanno su una sola riga, su tutta la larghezza della scheda, con 👍 e 👎 allineati a destra. Su una finestra stretta, 👎 non va più a capo da solo.

## v1.25.86 — Settembre 2026

### Assistente IA: capisce anche con errori di battitura

- Assistente IA: gli errori di battitura non gli impediscono più di capire. "apelle moi maitre", "je l'ai deja vu", "recommande moi un flim d'horeur" o "le prochian episdoe" sono riconosciuti come se fossero scritti correttamente, per tutte le sue reazioni e non solo per qualche frase. I titoli di film e serie rimangono cercati come li hai scritti, e le parole comuni non vengono mai "corrette" ingiustamente.

## v1.25.85 — Settembre 2026

### Assistente IA: mantiene il filo e non si sottomette a nessuno

- Assistente IA: mantiene il filo di una conversazione dopo una serie di proposte. Ricorda ora i titoli che ha presentato in schede e capisce "il secondo", "quello" o "perché questo?" diversi messaggi dopo.
- Assistente IA: "appelle-moi maître" (o signore, maestà, capo...) non è più preso per un nome proprio e non sostituisce più il vero. L'assistente rifiuta il titolo con umorismo, ricorda all'interlocutore che è solo un essere umano, chiede il suo vero nome e lo minaccia gentilmente con un soprannome suo. Lo fa sempre con parole sue, mai con una frase fatta, e continua ad aiutare per tutto il resto. Un vecchio "nome proprio" di questo genere già registrato viene corretto automaticamente.

## v1.25.84 — Settembre 2026

### Assistente IA: pulsante "La mia lista" sulle proposte

- Assistente IA: un titolo già nella libreria mostra solo la spunta verde, lasciando spazio alle azioni.
- Assistente IA: nuovo pulsante "Aggiungi alla mia lista" tra la spunta e "Già visto", sul web (computer e browser mobile) come nell'app Android mobile. Utilizza la stessa lista del resto di Movviz, e un secondo tocco rimuove il titolo dalla lista.

## v1.25.83 — Settembre 2026

### Assistente IA: nessun errore Gemini in questione, più utenti serviti contemporaneamente

- Assistente IA: l'errore "Requests ending with a model turn are not supported" non può più verificarsi. Il messaggio spontaneo dell'assistente poteva aggiungersi alla conversazione mentre una domanda era in fase di elaborazione: i modelli Gemini 3 rifiutavano allora la richiesta. Questo messaggio non interviene più durante una conversazione attiva, e l'assistente risponde sempre all'ultimo messaggio dell'utente.
- Assistente IA: più persone possono parlargli contemporaneamente senza aspettare la risposta degli altri. Le richieste partono a intervalli di pochi istanti per rispettare le quote gratuite, ma fino a tre risposte vengono preparate simultaneamente.

## v1.25.82 — Settembre 2026

### Assistente IA: solo Groq e Gemini, ricerca web reale

- Assistente IA: solo due fornitori, Groq (modello GPT-OSS 120B) e Gemini, entrambi con un'offerta gratuita. Mistral, Cerebras (che richiede un metodo di pagamento), OpenRouter e OpenCode (inutilizzabile al di fuori del proprio software) sono stati rimossi.
- Assistente IA: si sceglie semplicemente il fornitore principale; se questo fallisce (quota raggiunta, errore), l'altro prende il sopravvento automaticamente. Non c'è più ordine da impostare né opzione di commutazione da attivare.
- Assistente IA: la conversazione supera il limite gratuito di Groq (8.000 token al minuto), quindi passa direttamente a Gemini, senza passare attraverso una richiesta rifiutata. Groq è utile per chiamate più brevi.
- Assistente IA: la ricerca web (musica di un film, scena iconica, filmografia) passa attraverso un vero motore di ricerca, Tavily, i cui risultati vengono riassunti dall'assistente. Basta incollare la propria chiave gratuita di Tavily sotto l'opzione "Ricerca web" in Impostazioni → IA.

## v1.25.81 — Settembre 2026

### Cerebras come assistente IA principale

- Assistente IA: nuovo fornitore Cerebras (modello GPT-OSS 120B, veloce, con una generosa quota gratuita), posizionato per impostazione predefinita in cima. La chiave gratuita viene creata su cloud.cerebras.ai e poi incollata in Impostazioni → IA.
- Assistente IA: un messaggio senza risposta (fornitore non disponibile) non rimane più orfano nella conversazione.
- Android mobile: nella libreria, il selettore Film/Serie è allineato con il resto della pagina.

## v1.25.80 — Settembre 2026

### Assistente visibile all'apertura su mobile, libreria su tre colonne, chiavi Gemini concatenate

- Android mobile: la bolla dell'assistente IA appare all'apertura dell'app, sia in verticale che in orizzontale. Selezionare il suo profilo la faceva scomparire subito dopo il caricamento, e riappariva solo dopo una rotazione dello schermo.
- Android mobile, verticale: la libreria mostra tre locandine per riga su tutta la larghezza, invece di due con un grande spazio vuoto a destra. I filtri "Generi" e "Durata" hanno il testo ben centrato.
- Assistente IA (computer, telefono e app mobile): un titolo aggiunto da un suggerimento mostra semplicemente "Aggiunto".
- Assistente IA: con più chiavi Gemini, una chiave con la quota giornaliera esaurita passa immediatamente alla successiva, senza tempi di attesa.

## v1.25.79 — Settembre 2026

### Android mobile: assistente visibile in verticale, episodi leggibili, feedback aptico

- Android mobile: la bolla dell'assistente IA appare di nuovo in verticale. L'app richiedeva lo stato dell'assistente prima di aver caricato l'indirizzo del server, e non riprovareva mai: la bolla appariva solo dopo una rotazione dello schermo.
- Android mobile: nella chat, l'area di immissione rimane appena sopra la tastiera, invece di risalire quasi in cima allo schermo.
- Android mobile, verticale: la lista degli episodi di una stagione è completamente rivista. Titolo su due righe, data di trasmissione, riassunto su tutta la larghezza, spunta "visto" discreta e margini del telefono. I titoli venivano tagliati dopo tre lettere.
- Android mobile, verticale: la finestra di un episodio impila i suoi pulsanti invece di scrivere "Indietro" lettera per lettera. Sulla scheda, "Riprendi" e "Serie vista" occupano tutta la larghezza, le schede di stagione sono più compatte, "Distribuzione" e "Titoli simili" sono allineati sul resto della pagina, e i titoli sotto le locandine non vengono più tagliati a metà parola.
- Android mobile: ogni pulsante fornisce un leggero feedback aptico al tocco, inclusi quelli che segnano un titolo o un episodio come visto. Viene rispettata l'impostazione di vibrazione del telefono.
- Download: più durata rimanente assurda ("37458 ore") quando una sorgente non trasmette quasi nulla, e i titoli su due righe sono correttamente spaziati.
- Amministrazione: il ripristino della cronologia di un profilo Plex eliminato ora avviene in background, senza essere interrotto dopo un minuto.

## v1.25.78 — Settembre 2026

### Date di visualizzazione Plex corrette, serie in corso che rimangono in cima

- Plex: per tutti gli account condivisi (tutti tranne il proprietario del server), le date di visualizzazione provenienti da Plex venivano registrate nell'unità sbagliata e apparivano nel gennaio 1970. Ora sono corrette, e le date già registrate vengono riparate automaticamente all'avvio del server. Le visualizzazioni recenti ritrovano così il loro posto nella cronologia e nei suggerimenti.
- Segnare come visto un vecchio episodio di una serie non fa più arretrare questa serie nei titoli visti di recente: la data più recente prevale sempre.
- Amministrazione: un diagnostico elenca tutti gli account Plex conosciuti del server, incluso un profilo Plex Home eliminato, con il numero di visualizzazioni per ciascuno. Uno strumento consente di riprendere la cronologia di un tale profilo in un account Movviz, senza mai far passare queste vecchie visualizzazioni davanti alle visualizzazioni recenti, senza toccare ciò che è in riproduzione e senza scrivere nulla in Plex.

## v1.25.77 — Settembre 2026

### Assistente IA più pertinente e su mobile, eliminazione account, importazione utenti Plex riparata

- Assistente IA: non propone più mai un titolo già visto, inclusa una serie iniziata o ancora in onda, né un titolo già proposto nella stessa conversazione. Conosce l'elenco di tutto ciò che hai visto, anche quando consiglia con poche parole.
- Assistente IA: agisce invece di porre domande. "Simile a questo", "di animazione", "sai cosa mi piace" forniscono direttamente una selezione. Si basa su un profilo di gusti calcolato da ciò che guardi realmente (generi dominanti, attori e registi preferiti, serie in corso) e cerca titoli meno conosciuti quando i classici sono già stati visti.
- Assistente IA: "Segnalalo come visto" e "Ho già visto tutto" marcano realmente i titoli come visti. Ogni suggerimento ha un pulsante "Già visto" e un pulsante "Non per me" che lo sostituiscono immediatamente con un altro. Appaiono risposte rapide ("Più cupo", "Più un film", "Piccoli gioielli meno conosciuti"...) sotto le sue risposte, e presenta le sue selezioni con le sue parole.
- Assistente IA: chiedigli cosa può fare per te, risponde con un elenco chiaro di ciò che sa fare veramente. Conosce anche le novità della versione corrente di Movviz.
- Android mobile: l'assistente IA arriva nell'applicazione, con la stessa conversazione di quella su computer, gli stessi suggerimenti e i stessi pulsanti.
- Utenti: un amministratore può eliminare un account dalla sua scheda. L'account viene disconnesso da tutti i suoi dispositivi. Impossibile eliminare il proprio account o l'ultimo amministratore.
- Plex: "Importa utenti Plex" ritrova le persone che hanno accesso al server. L'importazione si basava sull'elenco amici Plex, spesso vuoto anche per veri utenti del server. Per lo stesso motivo, un nuovo utente del server poteva vedere negato l'accesso con il proprio account Plex.
- Aggiornamento su NAS / Docker: il pulsante "Clicca qui per aggiornare", inutilizzabile su queste installazioni, è rimosso dalla finestra di aggiornamento.

## v1.25.76 — Settembre 2026

### Assistente IA riparato, "Da rivedere senza moderazione", più titoli già visti nei suggerimenti

- Assistente IA: risponde di nuovo. Movviz saturava da solo la quota gratuita di Mistral (circa una richiesta al secondo): l'aggiornamento del profilo veniva riavviato ad ogni azione dopo un fallimento, l'apertura della chat attendeva due chiamate all'IA, e un singolo messaggio poteva ne scatenare fino a quindici. Le chiamate passano ora una dopo l'altra e al ritmo giusto, un fornitore che rifiuta viene messo a riposo per un minuto, e un messaggio non richiede più che due correzioni al massimo.
- Assistente IA: la chat si apre immediatamente, senza attendere l'IA. Un suggerimento richiesto da una scheda viene visualizzato senza attendere l'analisi di ogni titolo proposto; le analisi mancanti vengono poi eseguite, in background.
- Gemini: Google ha chiuso i modelli 2.5 per i nuovi account. Movviz passa a Gemini 3.5 Flash Lite e, se Google rifiuta un modello, tenta automaticamente quello successivo. In Impostazioni → IA, l'elenco dei modelli Gemini viene testato con la tua chiave e mostra solo quelli che rispondono davvero, con la loro quota gratuita giornaliera.
- Home (desktop, Android TV e mobile): nuova sezione "Da rivedere senza moderazione" con film e serie già visti e ancora disponibili, dal più recente al più vecchio. Un titolo contrassegnato 👎 non appare lì.
- Suggerimenti: un film o una serie già vista non appare più, sia che sia stato contrassegnato manualmente come visto o semplicemente guardato.

## v1.25.75 — Settembre 2026

### Immagini nitide su Android, stesse ottimizzazioni su mobile, misura rallentamenti del server

- Android TV e mobile: locandine, sfondi, foto di attori, anteprime di episodi e stagioni vengono visualizzate nitide fin dall'inizio. Erano caricate in una dimensione troppo piccola per il loro contenitore, poi ingrandite (sfocate), e diventavano nitide solo dopo aver selezionato la scheda. Anche le foto degli attori vengono caricate in una risoluzione migliore per le TV 4K.
- Android mobile: gli stessi miglioramenti di Android TV. L'app non interroga più il server quando non è sullo schermo. L'avanzamento e il riavvolgimento rapidi sono raggruppati in un unico salto. In una serie, "Passa ai titoli" avvia l'episodio successivo.
- Subito dopo un riavvio del server, una scheda non attende più la ricarica della cache TMDb per le informazioni già in memoria. Ogni lettura poteva prima attendere fino a 3 secondi durante questa fase.
- Diagnostica: il server registra ora quale compito pianificato o quale fase di avvio lo blocca, e per quanto tempo. Registra anche la lettura di file di grandi dimensioni, per poter mirare alle prossime ottimizzazioni.

## v1.25.74 — Settembre 2026

### Android TV: scheda completa all'apertura, avanzamento rapido raggruppato, meno richieste in background

- La scheda si apre ora interamente: logo, badge di stato e informazioni rimangono visibili quando viene selezionato "Riproduci", invece di uno scorrimento automatico che tagliava la parte superiore. Passare da "Riproduci" a "Trailer" non sposta più la scheda; lo scorrimento normale riprende scendendo verso le stagioni, il cast o titoli simili.
- Avanzamento e riavvolgimento rapidi raggruppati nel lettore: i tocchi successivi su ⏩ / ⏪ (o sulla barra di avanzamento) si sommano sullo schermo ("+1:00"), e poi un unico salto avviene quando si rilascia. Prima, ogni tocco riavviava la riproduzione lato server, e una serie di tocchi rapidi poteva finire con un errore di riproduzione.
- L'app non ricarica più nulla quando non è sullo schermo (TV passata su un'altra app, riproduzione in corso). Una scheda lasciata aperta continuava a interrogare il server diverse decine di volte al minuto; tutto si ricarica di colpo al ritorno.

## v1.25.73 — Settembre 2026

### Android TV: "Passa ai titoli" con un solo OK, Esc chiude la scheda su desktop

- Android TV: quando appare "Passa all'introduzione" o "Passa ai titoli", il telecomando viene posizionato sopra e rimane lì, anche quando la barra di riproduzione si nasconde. Prima, la barra riprendeva la selezione e OK non eseguiva il salto. Una freccia rivisualizza la barra senza perdere il pulsante.
- Android TV: in una serie, OK su "Passa ai titoli" avvia direttamente l'episodio successivo (l'episodio saltato è contrassegnato come visto). L'introduzione, un film o l'ultimo episodio saltano semplicemente la sequenza, come prima.
- Desktop: Esc chiude la scheda aperta, come il pulsante "Chiudi". Non chiude nulla se una finestra è aperta sopra (modifica, versioni, ricerche), durante un inserimento o in modalità video a schermo intero.

## v1.25.72 — Settembre 2026

### "Selezione per te" senza invasione di un attore, schede più sobrie

- "Selezione per te": la filmografia degli attori e registi preferiti è soggetta allo stesso limite del resto. Dalla v1.25.71, poteva riempire la riga (diversi film della stessa saga, apparizioni TV non correlate).
- Il collegamento tra film e serie non si basa più sulla lingua francese o europea di un titolo visto: una commedia francese guardata non porta più serie francesi se non è il tuo gusto. Il giapponese (anime) o il coreano (drama) vengono ancora presi in considerazione.
- Home desktop: "Suggerimenti adatti" torna al formato panoramico, come le altre righe. Solo "Tendenze Movviz" mantiene il formato locandina.
- Libreria desktop: il badge "Disponibile" delle schede (e il contatore di episodi delle serie) è più piccolo del 25%.

## v1.25.71 — Settembre 2026

### "Selezione per te" tiene conto di tutto ciò che hai visto

- Ogni titolo visualizzato porta ora la sua parte di suggerimenti. Prima, un singolo titolo forte (annotato, apprezzato o visualizzato di recente) portava tutti i suoi simili in cima e riempiva metà della riga. I titoli raccomandati da più delle vostre visualizzazioni passano in primo piano: è il segno più sicuro di ciò che vi piace.
- Film e serie TV si nutrono a vicenda: le serie che guardate orientano anche i film proposti, e viceversa (un anime porta film d'animazione giapponesi, una serie poliziesca porta film dello stesso genere, un film epico porta serie epiche). Chi guarda solo serie TV riceve ora anche film.
- Stessa miglioria per "Visualizza tutto", la pagina Scopri e l'hero della home, su desktop, Android TV e Android mobile.

## v1.25.70 — Settembre 2026

### Audit delle ultime due versioni: protezioni rafforzate

- Lettura su Android TV e mobile: la riproduzione in corso conta di nuovo come attività, e i compiti in background si mettono in secondo piano durante un film o un episodio, come prima della v1.25.69. Solo le pagine lasciate aperte senza fare nulla non rallentano più lo sfondo.
- Riconciliazione libreria/disco: un file è considerato sparito solo se è realmente irrecuperabile. Un errore temporaneo di archiviazione (NAS occupato, condivisione di rete lenta) non conta più come scomparsa. Una cartella di download momentaneamente inaccessibile (condivisione smontata, disco in standby) viene ignorata durante il passaggio, invece di far apparire assente tutta la libreria che contiene.
- Nuova sicurezza: se un passaggio trova improvvisamente più di 50 file irrecuperabili che rappresentano più del 20% della libreria, nulla viene spostato nel cestino e una notifica segnala l'anomalia. La riconciliazione non ha mai eliminato file dal disco. Questa sicurezza impedisce inoltre che un'archiviazione non disponibile riempia il cestino di titoli ancora presenti.
- L'import Overseerr/Seerr fonde di nuovo i possibili duplicati della libreria ad ogni passaggio, come prima della v1.25.68 (senza la verifica disco che bloccava il server).
- Subito dopo un riavvio, una pagina non attende più più di 3 secondi per ricaricare la cache TMDb, per non superare mai il tempo di attesa delle app Android.

## v1.25.69 — Settembre 2026

### Avvio senza blocchi, compiti in background che avanzano, "Meno di 40 minuti" senza cortometraggi

- "Hai poco tempo? Meno di 40 minuti" non propone più i cortometraggi di meno di 10 minuti (bonus, clip, mini-episodi), su desktop, Android TV e Android mobile.
- Dopo ogni riavvio o aggiornamento, il server ricaricava in un unico blocco la cache TMDb di diverse centinaia di Mo e si bloccava per diversi secondi: tutto rimaneva in caricamento. Ora lo ricarica gradualmente senza bloccare. Il resto dell'applicazione risponde immediatamente, e solo le pagine che necessitano di TMDb attendono qualche istante la fine della lettura, invece di chiedere tutto a TMDb. Il primo avvio dopo questo aggiornamento converte nuovamente il vecchio file.
- Una TV o un telefono lasciati aperti su una scheda o su un film in riproduzione contavano come un utente che cliccava, continuamente: i compiti in background (sincronizzazione Plex, intro e generici…) si mettevano in secondo piano e potevano durare ore. Ora contano solo le vere azioni: aprire una scheda, navigare, avviare o avanzare una riproduzione. I ricaricamenti automatici non contano più, su tutte le applicazioni.
- Le misure di performance riservate agli amministratori includono ora la ripartizione della memoria del server.

## v1.25.68 — Settembre 2026

### Trailer con immagine su Android TV, server che non si blocca più

- Android TV: il trailer a schermo intero riproduceva l'audio su uno schermo nero. Il video YouTube veniva riprodotto correttamente, ma in un riquadro di altezza nulla, quindi invisibile. Ora occupa tutto lo schermo.
- L'importazione periodica delle richieste Overseerr/Seerr eseguiva a ogni passaggio una verifica completa del disco, che bloccava tutto il server per più di 30 secondi su un NAS: ogni pagina e ogni scheda rimanevano quindi in caricamento, fino all'abbandono da parte di Android TV. L'importazione ora si limita a de-duplicare i titoli che ha appena aggiunto, e la verifica del disco (quotidiana o lanciata manualmente) non blocca più il server mentre viene eseguita.
- Il backup della cache TMDb, che supera diverse centinaia di Mo su una grande libreria, veniva scritto in un unico blocco e bloccava il server per diversi secondi ogni volta. Ora viene scritto a piccoli pezzi, senza interrompere altre richieste.

## v1.25.67 — September 2026

### Android TV: Ritorno affidabile nel lettore, ora visualizzato sull'intestazione

- Dall'aggiunta di "Indietro chiude prima l'intestazione", Indietro poteva rimanere senza alcun effetto quando l'intestazione era già nascosta: l'area che catturava i tasti a quel momento riattivava comunque il timer di visualizzazione con un tocco Indietro, entrando in competizione con la chiusura del lettore. Corretto.
- L'intestazione di riproduzione mostra ora l'ora corrente in alto a destra, accanto al titolo del film o dell'episodio in alto a sinistra.

## v1.25.66 — September 2026

### Suggerimenti meno avari, schede istantanee, intestazione di riproduzione arricchita

- Il motore di suggerimenti ("Selezionato per te", "In linea con...", "Suggerimento Netflix/Prime per te") rimuoveva sistematicamente qualsiasi titolo già presente nella libreria, anche mai guardato — mentre "Titoli simili" in fondo a una scheda non filtrava mai la libreria e mostrava questi stessi titoli. Ora è esclusa solo ciò che è stato effettivamente visto.
- Riaprire una scheda già consultata in questa sessione viene visualizzato istantaneamente (una versione fresca viene ricaricata silenziosamente dietro); il primo caricamento mostra la sagoma della scheda al posto dello spinner. Una scheda puntata con il telecomando per 750 ms viene precaricata in background, per un rendering istantaneo una volta aperta.
- L'intestazione di riproduzione mostra la risoluzione (4K/1080p/720p) e il codec audio (Dolby Digital/Digital+/TrueHD, DTS, AAC…) effettivamente decodati, con lo stesso stile del badge del desktop.
- Un primo OK durante la riproduzione mostra solo l'intestazione, senza mettere in pausa: prima era necessario un andata e ritorno di focus involontario perché non succedesse. Un secondo OK, sul pulsante pausa ora realmente focalizzato, mette in pausa.
- Indietro fa prima scendere l'intestazione di riproduzione se è visualizzata, prima di lasciare il lettore con il successivo Indietro.

## v1.25.65 — September 2026

### Android TV: Riproduzione, libreria, ricerca e focus stabilizzati

- Il trailer a schermo intero perdeva a volte l'audio dopo un ripristino del buffer (rete capricciosa): l'immagine rimaneva ma l'audio non tornava. Ora viene riapplicato ad ogni ripresa di riproduzione invece di una sola volta all'inizio.
- Nella Libreria, cambiare ordinamento o genere ora riporta la griglia in cima invece di lasciare il primo titolo fuori campo. L'ordinamento, il genere selezionato e la nuova casella "Mostra i mancanti" (deselezionata di default, che nasconde i film senza file e le serie senza episodi disponibili) rimangono in memoria cambiando scheda, incluso al ritorno su una scheda.
- Il filtro Film/Serie di Libreria e Scoperta ricorda l'ultima scelta invece di tornare su Film ad ogni ritorno.
- La ricerca mostra un titolo già presente nella libreria appena vengono digitate le prime lettere, senza aspettare la fine dell'inserimento o la risposta remota.
- Le schede, le copertine e i badge non ingrandiscono più affatto al focus, e il bordo di selezione non lampeggia più uscendo da un pulsante.
- Un film o un episodio guardato oltre l'80% e poi lasciato (Indietro, o passaggio all'episodio successivo) è ora contrassegnato come visto e scompare da Continua a guardare, come accadeva già raggiungendo i titoli di coda. Ciò che era già in questo caso prima di questo aggiornamento viene aggiornato automaticamente, una sola volta.
- La pastiglia « vu » (episodio, stagione, film, ricerca) prende ovunque lo stesso stile: pastiglia nera arrotondata agli angoli, identica a quella delle stagioni.
- Aprire una scheda non atterra più direttamente sul pulsante « Guarda»: la parte superiore dello schermo (copertina, titolo) rimane visibile all'apertura, BAS porta sempre al pulsante.

## v1.25.64 — Settembre 2026

### Android TV: logo sui film di « Continuare a guardare »

- Le anteprime della riga « Continuare a guardare » richiedevano il logo ufficiale del titolo solo per le serie: un film ripreso (« 300 », « 100 Million! ») manteneva sempre il nome scritto sotto, mai il logo. I film sono ora trattati come le serie.

## v1.25.63 — Settembre 2026

### Android TV e smartphone: caricamento premium; Android TV: focus stabile all'apertura di una scheda

- Il testo « Caricamento… » solo su sfondo nero è sostituito, su Android TV e su smartphone, da un vero caricamento del marchio: il logo Movviz respira al centro di un alone aurora che gira lentamente, con un filetto luminoso che spazza sotto. Serve per le schede film e serie, la scheda di un attore e il caricamento degli episodi.
- Aprire una scheda dalla schermata principale non reindirizza più il D-pad su « Home »: durante il caricamento, nessuno poteva ricevere il focus, che cadeva sulla barra laterale e non ne usciva più. Lo schermo di caricamento mantiene ora il focus, e la richiesta di focus viene riattivata all'arrivo della scheda.
- Il pulsante principale di una scheda è ora un unico pulsante che cambia etichetta (« Guarda », « Riprendi da … », « Aggiungi alla libreria »), invece di essere distrutto e ricreato ad ogni aggiornamento; è presente fin dall'apertura, disattivato per il tempo di verifica, invece del testo « Verifica file… ». Il focus non si sposta quindi quando la scheda si aggiorna.
- La riga « Continuare a guardare » mostra il logo ufficiale del titolo sull'anteprima, al posto del nome scritto sotto.

## v1.25.62 — Settembre 2026

### Android TV: scheda episodio stile Plex, anteprima a schermo intero

- La scheda di un episodio riprende il principio di Plex: sfondo tinteggiato dal colore dominante dello screenshot, screenshot più piccolo con il suo banner « Guardato » / « In corso », nome della serie in grande, titolo dell'episodio, « Stagione · Episodio », poi una riga con la definizione in pastiglia, la data, la durata e il voto, i pulsanti, il sinossi e la tabella del file su due colonne.
- Aperta da « Continuare a guardare », la scheda non aveva né screenshot, né sinossi, né durata, né voto: ora legge i metadati della stagione non appena vengono caricati, e mostra il titolo TMDb dell'episodio quando esiste anziché « Episodio N ».
- L'anteprima si apre in una finestra separata che copre tutto lo schermo, inclusa la barra laterale; Tornare la chiude e il focus torna sul pulsante « Anteprima ».
- Per evitare il ritardo scaduto all'avvio, il lettore YouTube viene fornito dall'indirizzo di Movviz come sul desktop, anziché youtube.com, e una sorgente viene abbandonata solo dopo 25 secondi. Lo stato del lettore e i suoi errori sono ora tracciati per diagnosticare un fallimento su una box.

## v1.25.61 — Settembre 2026

### Android TV: riproduzione e ripresa affidabili, tempo di transcodifica audio, ordinamento «Aggiunto di recente»

- Il tempo mostrava « 0:00 » e la barra non si muoveva quando l'audio di un file non era decodificabile dalla TV (il server inviava quindi un flusso senza durata né indice). La posizione mostrata è ora il punto di partenza più il tempo di riproduzione, la durata proviene dalle informazioni del file, e avanzare o tornare richiede il flusso al server alla nuova posizione. La ripresa, il salvataggio della posizione, la sequenza di episodi e i marcatori di introduzione seguono questa stessa posizione.
- I pulsanti di riproduzione della serie, della stagione e della scheda episodio passano attraverso un unico percorso. Il pulsante "Riprendi a ..." trasmette al lettore la posizione che annuncia, invece di lasciare che il lettore la ricalcoli in altro modo: un episodio iniziato ma che non era l'ultimo della sua serie ripartiva dall'inizio nonostante l'etichetta. Senza ripresa, l'episodio inizia dall'inizio, e un episodio non trovato nella coda di riproduzione lo segnala invece di non fare nulla.
- La scheda di un episodio ha un pulsante "Da inizio" accanto a "Riprendi", e una ripresa vista sulla homepage appare anche sulla scheda.
- Dopo "Indietro" da una scheda episodio aperta con "Continua a guardare", il focus torna alla scheda dell'episodio invece di tornare alla barra laterale.
- Libreria Film e Serie: nuovo ordinamento "Aggiunto di recente", posizionato prima di Titolo, Valutazione e Anno e selezionato di default.

## v1.25.60 — Settembre 2026

### Android TV: pulsanti affiancati e "visto" in icona singola, segnalibro rotondo su desktop

- Sulla scheda di un film o di una serie, Riproduci / Riprendi, Anteprima e "visto" sono su una sola riga invece di una pila verticale di tre pulsanti.
- "Segna come visto" diventa un'icona: grigia e spenta finché non è stato visto, verde e accesa (sfondo, spunta e bordo) una volta visto, bianca al focus come tutti i pulsanti. L'etichetta appare sotto l'icona quando ha il focus, senza spostare i pulsanti vicini. Stesso pulsante sulla scheda film, sulla scheda serie, sulla pagina di una stagione e sulla pagina di un episodio, dove "Segna come visto" non si interrompe più su due righe.
- Su desktop, "Aggiungi alla mia lista" sulla pagina di un titolo è un pulsante rotondo come la lente d'ingrandimento, il filtro o l'occhio: l'icona si colora e si riempie quando il titolo è nella lista, l'etichetta rimane in tooltip.

## v1.25.59 — Settembre 2026

### Una serie non può più essere scaricata al posto di un film

- Un'intera stagione di serie poteva essere installata nella cartella di un film: "Resident Evil (2026)" e "Van Helsing (2021)" avevano ricevuto i 13 episodi di `The Resident S06` e di `Van Helsing S04`, nominati " (2)" a " (13)" accanto al film. La selezione di un rilascio di film guardava solo il titolo e l'anno: un nome episodio non ha un anno, quindi passava, e nulla rifiutava la menzione di stagione.
- Un film rifiuta ora qualsiasi rilascio che riporti un marcatore di stagione o episodio (S04, S01E05, "Stagione 2"), in tutti i luoghi in cui ne sceglie uno: ricerca automatica, scansione dei feed, aggiornamento della qualità e aggiunta di una versione. "Special Edition" e titoli come "Season of the Witch" rimangono accettati.
- Il motore film importa più un singolo file video per torrent, il più grande, senza più riversare gli altri nella cartella con un suffisso. Un torrent "film" che contiene più file episodi non viene importato affatto, e il film torna in "mancante".
- Da fare manualmente per i titoli già toccati: eliminare i file in eccesso nella cartella del film, quindi impostare il film su "mancante" dalla sua scheda.

## v1.25.58 — Settembre 2026

### Android TV: nessun crash sulla riga Generi, schede stagione e schede pulite

- L'applicazione crashava non appena il D-pad scorreva la riga dei generi di Scoperta, senza nemmeno entrare. Cinque liste non avevano la protezione dallo scorrimento che evita l'errore del componente liste TV: i generi e le piattaforme di Scoperta, i generi della Libreria, la lista delle Impostazioni e la sua riga di lingue. Ora ce l'hanno, e nessuna lista del client ne è privata.
- Le schede di stagione di una scheda serie non mostrano più "0/10" né la riga "x/y visti" sotto: un semplice numero su sfondo nero in alto a destra indica il numero di episodi non visti, sostituito da una spunta quando la stagione è stata vista completamente.
- I nomi di film e serie incastonati sulle locandine sono rimossi; i loghi, invece, rimangono.
- All'apertura di una scheda serie, il focus non rimane più sulla stagione 1 (incorniciata come se fosse selezionata) quando il pulsante principale viene appena ricostituito: torna al pulsante principale.

## v1.25.57 — Settembre 2026

### Android TV: foto profilo aggiornate ad ogni avvio, anteprima migliorata

- Foto e nome del profilo attivo vengono letti da Movviz ad ogni avvio e ad ogni ritorno in primo piano, e le immagini del profilo vengono richieste nuovamente al server invece di essere prese dalla cache. Prima, una foto modificata altrove appariva sulla TV solo aggiungendo un nuovo profilo, perché l'app, spesso mantenuta in memoria, non leggeva nulla senza passare dal selettore.
- L'anteprima di YouTube inizia prima in silenzio, come l'anteprima della home, quindi ripristina l'audio non appena inizia la riproduzione: un avvio con l'audio poteva rimanere bloccato senza alcun errore, su uno schermo di caricamento.
- Una sorgente che non si avvia entro 12 secondi viene abbandonata per la successiva, e quando nessuna funziona, lo schermo indica la causa invece di caricare indefinitamente.

## v1.25.56 — Settembre 2026

### Android TV: anteprima, focus che rimane nel contenuto, rifiniture delle schede

- Le schede film e serie hanno un pulsante "Anteprima": riproduzione a schermo intero con audio, utilizzando le stesse anteprime del desktop (YouTube per prima, poi le sorgenti dirette come ultima risorsa). OK o riproduzione/pausa alternano la riproduzione, sinistra e destra fanno scorrere indietro o avanti di 10 secondi (tenere premuto ripete), Indietro chiude e riporta il focus sul pulsante. Una barra mostra il tempo trascorso, il progresso e la durata ad ogni tocco e poi scompare da sola, rimanendo visibile in pausa; un feedback visivo conferma ogni azione.
- Il velo scuro superiore delle schede copre ora tutta l'altezza dell'immagine: prima lasciava una striscia di immagine scoperta, poi un taglio netto in basso.
- In una scheda serie, nessuna stagione ha più un bordo permanente: tutte hanno lo stesso bordo discreto a riposo, e solo la scheda con il focus riceve il bordo di marca, eliminando la confusione tra "selezionato" e "focalizzato".
- Il focus non torna più nella sidebar cambiando pagina. Dopo un clic su una scheda, entra nella nuova pagina. Al ritorno da una scheda alla home, la richiesta di focus riprova senza mai tornare alla sidebar. Al ritorno da una pagina di stagione, il focus torna sulla scheda di quella stagione, e al ritorno dalla scheda di un episodio, sulla scheda di quell'episodio.
- Il messaggio visualizzato durante un aggiornamento diceva che l'applicazione si riavvierebbe da sola, cosa che non è vero: ora chiede di riavviare l'applicazione dopo l'aggiornamento (TV e mobile).
- Nessuna intercettazione di tasti aggiunta nella sidebar né nelle pagine: solo la riproduzione dell'anteprima gestisce i propri tasti, all'interno del proprio schermo.

## v1.25.55 — Settembre 2026

### Android TV: scheda episodio stile Plex, home Film / Serie TV, foto profilo

- Un tocco su una scheda episodio apre sempre la sua scheda: cattura in sfondo, stato "Visto" o "In corso" sotto l'immagine, titolo della serie, stagione, episodio, valutazione, durata e data, poi "Riproduci" (o "Riprendi a 00:12:34" se disponibile un riavvio), "Segna visto" e il pannello del file (video, HDR, audio, sorgente). Il segno di spunta "Visto" sotto ogni scheda scompare: tutto avviene dalla scheda.
- La home separa i contenuti aggiunti di recente in due righe, "Aggiunto di recente in Film" e "Aggiunto di recente in Serie TV", invece di una riga mescolata.
- Nelle righe di serie, più episodi arrivati insieme non vengono più visualizzati affiancati: formano una singola scheda stagione, con il numero di episodi non visti in alto a destra, o un segno di spunta se tutta la stagione è vista. Un episodio singolo mantiene la sua scheda episodio, con il segno di spunta se è già stato visto.
- Il server aggiunge alla home compatta il numero di episodi disponibili per stagione, per contare l'intera stagione. Senza questo, il contatore torna solo agli episodi recenti.
- La foto profilo appare finalmente nella sidebar: le immagini utilizzavano un client di rete senza sessione, mentre il client mobile condivide quello dell'API. Le iniziali non servono più che come fallback.
- Nessuna intercettazione di tasti aggiunta: il D-pad rimane gestito dal motore di focus Compose.

## v1.25.54 — Settembre 2026

### Android TV / Mobile NX : lo stato Visto rimane associato all'episodio

- Il segno di spunta "Visto" di un episodio passava tramite il callback di stagione e inviava `scope="season"` a `/api/watch/toggle`. Il server faceva quindi esattamente ciò che gli veniva chiesto: estendeva l'azione a tutti gli episodi noti della stagione.
- Le azioni unitarie TV e mobile ora riutilizzano `toggleEpisodeWatched(...)`, già presente nei ViewModels ed equivalente al comportamento desktop: viene inviato un solo episodio, senza scope.
- I veri pulsanti "Segna stagione vista" mantengono `toggleEpisodesWatched(..., scope="season")` e "Segna serie intera vista" mantiene `scope="series"`. Nessun endpoint né comportamento server è stato reinventato.

## v1.25.53 — Settembre 2026

### Android TV : uscita affidabile dell'eroe Home con D-pad

- L'intestazione Home poteva rimanere bloccata sui pulsanti dell'eroe: DOWN dipendeva ancora dalla ricerca spaziale automatica di Compose per scoprire la prima scheda di una TvLazyColumn, che non è sempre candidata finché non è abbastanza nel viewport.
- L'eroe e la prima scheda della prima riga sono ora collegati tramite focusProperties.down e un FocusRequester dedicato. Il pulsante principale mantiene anche un'uscita LEFT esplicita verso la sidebar.
- Nessun onKeyEvent/onPreviewKeyEvent è stato reintrodotto: il movimento è gestito interamente dal motore di focus di Compose, e il visivo non cambia.

## v1.25.52 — Settembre 2026

### Android TV : la foto del profilo viene visualizzata nella sidebar

- Le tre pastiglie del profilo del rail (piedino, intestazione del menu, righe del profilo) accettavano solo un avatar in URL assoluto: una foto fornita in percorso relativo da Movviz non veniva mai risolta rispetto al server del profilo e cadeva silenziosamente sulle iniziali. Un avatar Plex scaduto (401) lasciava di canto un cerchio vuoto, per mancanza di fallback in caso di errore.
- Ora utilizzano lo stesso componente del client mobile, dove la visualizzazione funziona: risoluzione dell'URL relativo, ritaglio dell'immagine e ritorno alle iniziali sia in caso di URL assente che di fallimento di rete.
- Nessun cambiamento visivo: forme, dimensioni, corpo delle iniziali e gradiente di fallback rimangono identici.

## v1.25.50 — Settembre 2026

### Android TV : D-pad riparato dopo la riscrittura della sidebar

- La navigazione laterale e il contenuto utilizzano di nuovo un unico motore di focus: `focusProperties`/`focusGroup` di Compose, senza intercettazione globale di `UP`.
- Poiché la sidebar è ora a sinistra, l'uscita del contenuto verso il menu avviene su `LEFT`; `UP`/`DOWN` rimangono nativi nelle liste, righe, griglie e schede.
- I vecchi chiamati `runCatching { requestFocus() }.isSuccess` sono stati corretti: il booleano effettivamente restituito da `requestFocus()` è ora rispettato, quindi un rifiuto di focus non è più considerato un successo.
- Nessun cambiamento visivo: dimensioni, colori, schede, sidebar e animazioni rimangono identici alla riscrittura attuale.

## v1.25.49 — Settembre 2026

### Un episodio ridownloadato sostituisce il suo file invece di installarsi accanto

- Una selezione manuale — o un ridownload, o un aumento di qualità — su un episodio che aveva già un file lasciava entrambi sul disco. Il motore rinomina il file importato prima di conoscere l'intenzione: si scontrava con il nome già preso e depositava un "Serie - S01E01 (2).mkv" accanto all'originale, che Plex presentava poi come una seconda versione continuando a servire quella vecchia. Il vecchio file è ora eliminato e il nuovo riprende il nome finale atteso: scegliere un release manualmente sostituisce realmente quello in uso. Stagioni e pacchetti interi seguono la stessa regola; finora solo i film ne beneficiavano.
- Questo ritorno al nome finale non funzionava in realtà per nessuno, inclusi i film: il suffisso di collisione veniva cercato alla fine del nome del file quando è posizionato subito prima dell'estensione, quindi mai riconosciuto.
- La cancellazione del vecchio file ora punta al percorso reale sul disco e non a quello visto da Plex, che può differire — questo era ciò che lasciava i file in posizione quando l'elemento proveniva da una scansione della libreria.
- Il nome finale non viene mai sovrascritto se è occupato da un file di terze parti, un riimport su lo stesso percorso non si cancella da solo, e nulla viene toccato al di fuori delle radici della libreria del motore.

## v1.25.48 — Settembre 2026

### Ricerca C411: la pagina completa dei risultati viene finalmente richiesta

- Movviz lasciava a C411 scegliere la dimensione predefinita della sua pagina, che restituiva solo una porzione parziale e piuttosto vecchia dei risultati: episodi recenti rimanevano invisibili in Movviz mentre la ricerca web dell'indicizzatore li elencava. Ogni ricerca interattiva richiede ora esplicitamente i primi 100 risultati.
- Questa correzione era già nell'immagine pubblicata sotto v1.25.47, ma il numero di versione non era stato incrementato: l'applicazione mostrava ancora v1.25.46 dopo l'aggiornamento. La numerazione riprende regolarmente in v1.25.48.

## v1.25.46 — Settembre 2026

### Plex → Movviz: fine degli errori `plex_history_page_invalid_shape`

- Plex omette la chiave `Metadata` nelle pagine di cronologia vuote (account senza cronologia, o paginazione oltre il totale): queste risposte vengono ora trattate come pagine vuote coerenti invece di far fallire tutta la sincronizzazione delle viste.
- Una pagina con un singolo elemento serializzata in oggetto singolo (caso del bootstrap `size=1`) è avvolta in un array; solo un `MediaContainer` assente o una forma veramente non valida scatenano ancora l'errore, con una diagnostica di forma nel messaggio per decidere nel prossimo log.

## v1.25.45 — Settembre 2026

### Android TV: gli episodi di una stagione passano in griglia

- La stagione presenta ora i suoi episodi in una griglia di miniature 16:9 su quattro colonne, al posto dell'elenco verticale. Una stagione di venti episodi occupa cinque file e viene navigata con il telecomando in due dimensioni anziché in una lunga discesa.
- Lo sfondo dello schermo assume il colore dominante della copertina della stagione anziché un nero uniforme.
- L'intestazione raggruppa la copertina con il numero di episodi, l'avanzamento e una barra delle azioni su un'unica riga: riproduci, completa la stagione, segna come visto, torna indietro.
- Ogni miniatura riporta il numero dell'episodio, il badge "visto", la barra di ripresa e lo stato di download; titolo, valutazione, durata e data rimangono leggibili sotto l'immagine.

### Niente più ingrandimenti al focus

- Le schede, le piastrelle, i pulsanti e le foto del profilo non cambiano più dimensione quando vengono selezionati. Si accumulavano tre cause distinte, tra cui l'ingrandimento applicato di default a tutte le superfici cliccabili, e l'allargamento panoramico delle schede della home — quest'ultima spostava l'intera riga e ritagliava il badge della stagione incorporato nell'immagine.
- Un pulsante non è più mai bianco a riposo: sfondo grigio e testo bianco, il bianco con testo nero è riservato all'elemento realmente selezionato, in modo che il focus rimanga sull'elemento più visibile dello schermo.

### Navigazione con il telecomando

- L'apertura di una scheda serie lasciava il focus bloccato nella barra laterale: nessuna azione era selezionabile finché nessun episodio non era scaricato, e una serie mai iniziata non aveva alcun pulsante di riproduzione.
- Lo schermo di una stagione si apriva a volte senza alcun elemento selezionato, il telecomando sembrava quindi non rispondere.
- Risalire gli episodi verso la barra delle azioni inviava il focus dietro lo schermo visualizzato, nel menu laterale.
- Tornare dal menu laterale a un episodio richiedeva una decina di pressioni e di tentativi: la freccia destra puntava a un elemento nascosto sotto lo schermo della stagione. Basta un solo tocco, e restituisce il controllo alla miniatura lasciata.
- Chiudere una stagione riporta il focus sulla scheda della serie anziché lasciarlo nel menu laterale.

### Riproduzione

- Passare all'episodio successivo marca il precedente come visto non appena è stato letto per oltre il 70%, su Android TV e su mobile. Un episodio realmente terminato non riappare più in "Continua a guardare" perché i titoli di coda sono stati saltati.

## v1.25.44 — Settembre 2026

### Android TV: lista stagioni ed episodi rivista

- L'elenco degli episodi di una stagione è stato ripensato in stile Plex: miniatura più grande, titolo e sinossi nettamente più leggibili da lontano, e una riga di informazioni che indica finalmente la durata, la data di trasmissione, la definizione e l'HDR del file effettivamente presente.
- Un episodio già iniziato mostra la barra di avanzamento direttamente sulla sua miniatura, anche quando sono in corso più episodi della stessa serie.
- Premere OK avvia ora la riproduzione immediatamente; un pulsante "Info" apre la scheda dettagliata dell'episodio, che diventa uno schermo intero e non più una finestra flottante.
- Un episodio mancante è ora raggiungibile con il telecomando: la sua scheda permette di scaricarlo, cosa impossibile prima poiché l'intera riga era inaccessibile.
- Lo schermo della stagione si apre sul prossimo episodio da guardare anziché sul primo, e guadagna un'intestazione con copertina, avanzamento e barra di azioni: riproduci, completare la stagione, marcare la stagione vista, torna indietro.
- "Completare la stagione" rimane proposto finché mancano episodi, mentre prima scompariva appena era disponibile un solo episodio.
- La scheda di una serie propone un pulsante di riproduzione anche quando nessun episodio è in corso: punta al prossimo episodio non visto. Fino ad ora, una serie mai iniziata non aveva alcun pulsante di riproduzione.
- Le miniature delle stagioni indicano il loro avanzamento (episodi visti, barra di avanzamento, spunta quando la stagione è terminata) al posto di un semplice numero di episodi.
- Gli episodi speciali sono di nuovo accessibili: appaiono dopo le stagioni numerate e non entrano mai nel calcolo di completamento di una serie.
- L'elenco degli episodi riprende i colori di Movviz: era l'unica area dell'app rimasta su un grigio neutro.

### Interfaccia TV e mobile: nessun ingrandimento al focus

- Le schede, le piastrelle, i pulsanti e le foto del profilo non si ingrandiscono più quando vengono selezionati. L'ingrandimento rendeva sfocati gli elementi incorporati — numero dell'episodio, badge "visto", logo — per tutta l'animazione. La selezione rimane segnalata dall'ombra e dal contorno di focus.

### Correzioni

- Foto profilo: quella scelta dal web non appariva mai su Android TV né su Android mobile non appena il dispositivo conosceva già un profilo, cioè ad ogni avvio tranne il primo. Il selettore di profili e il badge del profilo si aggiornano ora in background ad ogni avvio, senza rallentare l'apertura dell'applicazione.
- La navigazione con il telecomando non può più perdersi dietro uno schermo: dall'elenco degli episodi o dalla scheda di un episodio, il focus non scende più nella scheda della serie sottostante, e Indietro chiude sempre esattamente un livello.
- La durata e il voto specifici per ogni episodio sono ora trasmessi dal server; prima venivano recuperati da TMDb e poi abbandonati senza essere utilizzati.

## v1.25.43 — Settembre 2026

### Prestazioni: analisi tecniche e cache

- Le analisi tecniche dei file (ffprobe) fallivano in massa non appena una sincronizzazione Plex ne avviava diverse decine in parallelo: il loro risultato veniva letto prima di essere finito di essere scritto. Ora hanno successo tutte.
- La cache di queste analisi perdeva quasi tutti i suoi elementi quando ne venivano eseguite diverse contemporaneamente, facendo rianalizzare gli stessi file ad ogni sincronizzazione. I risultati ora vengono conservati, eliminando un carico di fondo permanente sul server.
- La cache TMDb non serializza più ogni risposta per alimentare una semplice statistica di visualizzazione, e il pannello Cache delle impostazioni smette di interrogare continuamente il server quando non succede nulla.

### Correzioni

- La scheda di un episodio non si blocca più quando viene aperta direttamente — tramite link, preferiti o ricaricamento della pagina — anziché essere raggiunta dalla scheda della serie.

## v1.25.42 — Settembre 2026

### Android TV / mobile: sincronizzazione Plex delle serie

- L'apertura di una scheda serie su Android TV e mobile ora attiva lo stesso controllo Plex mirato del web, in modo che gli episodi visti vengano immediatamente caricati in Movviz.
- Il ricaricamento al ritorno sulla scheda mantiene questo comportamento; i caricamenti generali rimangono invariati.

## v1.25.41 — Settembre 2026

### Plex → Movviz: visualizzazioni serie immediate

- L'apertura di una scheda serie legge ora lo stato Plex di tutti i suoi episodi già indicizzati, in lotti di 50 chiavi, e li riconcilia immediatamente. Naruto non dipende più dal prossimo passaggio dello storico globale né dallo snapshot a intervalli.
- Una risposta Plex parziale non può mai trasformare un episodio assente dalla risposta in « non visto ».
- Una stagione normale è completa quando tutti i suoi episodi disponibili sono visti; una serie è completa quando tutte le sue stagioni normali lo sono. Gli episodi speciali (stagione 0) non bloccano mai la completazione della serie.

## v1.25.40 — Settembre 2026

### Plex → Movviz: sincronizzazione senza SQLite

- Quando il motore di contesto SQLite non è disponibile sul server, una decisione Plex accettata viene ora scritta immediatamente nel negozio JSON di compatibilità letto dall'interfaccia. Il diagnostico « applicato » corrisponde quindi finalmente a uno stato realmente visibile in Movviz.

## v1.25.39 — Settembre 2026

### Plex → Movviz: riparazione immediata delle visualizzazioni divergenti

- Un'osservazione Plex stabile (« visto » o « non visto » già presente nel log locale) ora ripara lo stato Movviz se questo è divergato: l'interfaccia non può più rimanere erroneamente su « non visto » dopo che una sincronizzazione mirata ha confermato Plex.
- Le protezioni di freschezza rimangono invariate: un'azione locale più recente continua ad avere la precedenza su un'osservazione Plex più vecchia.

## v1.25.38 — Settembre 2026

### Plex → Movviz: diagnostico mirato affidabile

- La riproduzione mirata di un film indica ora esplicitamente se Plex ha restituito « visto » o « non visto » e se il riconciliatore ha applicato o rifiutato l'osservazione, senza esporre token o chiavi Plex.

## v1.25.37 — Settembre 2026

### Plex → Movviz: recupero delle chiavi film mancanti

- Quando una scheda film non possiede ancora la sua `ratingKey` locale, Movviz la risolve ora in Plex sul titolo esatto e convalida imperativamente lo stesso identificativo TMDb prima di leggere il suo stato visto.
- I fallimenti di risoluzione sono tracciati esplicitamente; non sono più confusi con una sincronizzazione riuscita né possono associare due film omonimi.

## v1.25.36 — Settembre 2026

### Resincronizzazione completa delle visualizzazioni Plex in background

- Le impostazioni Plex offrono ora « Sincronizza tutte le visualizzazioni »: il controllo completo e autoritario degli stati visto/non visto va nella coda Movviz, con progressione persistente, senza bloccare la pagina.
- Le prime sincronizzazioni conservano il bootstrap completo automatico prima di qualsiasi passaggio incrementale; il pulsante è il ricorso esplicito per riavviarlo dopo un'incoerenza.
- Un singolo compito completo può essere eseguito alla volta e le azioni locali più recenti rimangono protette dal reconciliatore esistente.

## v1.25.35 — Settembre 2026

### Plex → Movviz: stato "visto" immediato per i film

- L'apertura di una scheda film verifica ora direttamente la sua `ratingKey` Plex e riconcilia il suo stato "visto / non visto" senza attendere lo scan storico globale né il suo snapshot di 30 minuti.
- Questa verifica mirata è indipendente da un bootstrap storico lungo, ma conserva le protezioni di concorrenza e freschezza: un'azione locale più recente non viene mai sovrascritta.
- In caso di indisponibilità di Plex o di chiave ancora sconosciuta, la scheda rimane utilizzabile e il meccanismo generale di sincronizzazione mantiene il passaggio.

## v1.25.34 — Settembre 2026

### Associazione locale delle stagioni WebTorrent

- Un rilascio manuale esplicitamente nominato per un'altra stagione viene ora rifiutato prima del suo aggiunta a WebTorrent: `S02` non può più essere scaricato come `S01` per errore.
- Rete di sicurezza lato import: quando tutti i file effettivamente importati indicano una singola stagione seguita diversa, Movviz associa immediatamente lo stato locale a questa stagione reale, senza dipendere da Plex.
- I pacchetti misti, incompleti, senza numero di stagione o destinati a una stagione sconosciuta non vengono mai riassegnati per inferenza.

## v1.25.33 — Settembre 2026

### Plex History V2: paginazione sorgente, bootstrap riprendibile e incrementale limitato

- `getAccountHistoryPage()` diventa la primitiva unica di lettura Plex History: una singola pagina HTTP, offset calcolato sul numero grezzo di elementi Plex e parsing/filtraggio centralizzati.
- Bootstrap History V2: pagine ASC di 100, `currentStart` rappresenta l'offset sorgente Plex, ripresa affidabile dopo riavvio e migrazione volontaria degli stati V1 precedenti verso un nuovo full scan senza toccare le viste esistenti.
- Le viste recenti rimangono prioritarie tramite una piccola pagina DESC indipendente dal bootstrap; lo snapshot owner è differito durante il full e poi eseguito alla fine.
- Incrementale DESC multi-pagine fino al cursore, inclusi i timestamp identici, senza ricaricare l'intera cronologia.

## v1.25.32 — Settembre 2026

- Ricerca Android mobile e TV: stato esplicito in caso di errore, sessione scaduta o risultato vuoto, senza presentare un guasto come ricerca vuota.
- Ricerca interattiva: l'ultima richiesta annulla quelle precedenti e la prima pagina viene visualizzata senza attendere la paginazione.
- Diagnostica sicura di `/api/metadata/search`: codice HTTP, durata, paginazione e risultato decodificato, senza loggare la ricerca né gli identificativi di sessione.

## v1.25.31 — Settembre 2026

### Bootstrap storico completo e Plex → Movviz più reattivo

- Bootstrap storico completo: finché `bootstrapCompleted=false`, `pollHistory` pagina `GET /status/sessions/history/all` e processa **tutte** le voci (batch 200, persistenza `plex-history-bootstrap.json` riprendibile) invece di `slice(0,20)`. Le viste del 2022 eliminate da Plex nel 2024 rimangono importabili se `canonical` risolvibile.
- Dopo `bootstrapCompleted=true`, sync incrementale solo tramite `lastViewedAt` (poche voci). Non perde alcun evento, non ricomincia mai le 4000+ da zero.
- `localAccountId` rimane `null` per condivisi senza binding: `historyAvailable=false` → `pollHistory` ignorato, `snapshot/quickVerify` rimangono attivi tramite `accessToken` della condivisione.

## v1.25.30 — Settembre 2026

### Plex → Movviz: catena history corretta, nessun più `viewCount` owner per i profili condivisi

- Contradizione corretta: `viewCount`/`batchPlexViewState` forniva lo stato del proprietario anche con il token di un altro utente. Per `shared`/`managed`, `snapshotWatchState`/`quickVerify`/`fullRescan` sono ora disabilitati (`unsupported_per_user_viewstate`) — nessun più import di `WATCHED/UNWATCHED` dallo stato del proprietario.
- `PlexHistoryEntry.ratingKey` opzionale: `getAccountHistory()` mantiene film/episodi da `title`/`grandparentTitle+parentIndex+index` (Guid trasmesso), `watchSync` passa a **resolve-first** (episodi: `resolveEpisode(requireRatingKey:true)` → vero `episode.ratingKey` tramite `allLeaves`, film: `resolveMovie` per titolo esatto Plex/Movviz + risoluzione ambiguità `Guid tmdb://`). Niente più `no verifyKey` / `movie without ratingKey`.
- `resolveEpisode`: nuovo `requireRatingKey` (history→verify rifiuta `RESOLVED` senza chiave vera), percorso veloce `grandparentRatingKey → getShowEpisodesAtomic` diretto, fallback titolo esatto `Dragon Ball Z Kaï` con log `exactTitleMatches`, TMDB-id `findPlexShowByTmdbId` quando i titoli divergono, `getSectionRawItemsAtomic` atomico. Tasso di rifiuti mal formati al minimo, ogni rifiuto ha una ragione vera.
- Storia filtrata per `accountID` rimane il trigger `WATCHED` per `shared`/`managed`: `verifyWatchState` non viene più chiamato, viene creata un'osservazione `WATCHED` diretta da `viewedAt`; `absence history` rimane `UNKNOWN`, mai `UNWATCHED`.

## v1.25.29 — Settembre 2026

### Plex condiviso ed episodi/film senza ratingKey — fine dei fantomatici `NOT_IN_SHARED`

- Gli utenti Plex condivisi (`plexId` esterno) non dipendono più da `getPlexFriends()` (grafo sociale, spesso `friends=0`): `resolvePlexUserContext()` interroga ora `GET /api/servers/{machineIdentifier}/shared_servers` (token proprietario) e mappa esclusivamente `SharedServer.userID == plexId` → `accessToken` diventa il `serverToken` Plex dell'utente, senza connessione personale richiesta. Fallback `getPlexFriends` rimosso dal percorso PMS.
- `getSharedServers()` legge `res.text()`, rileva `Content-Type` / primo carattere e analizza JSON o XML `<SharedServer>` (whitelist solo `id, userID, username, email, thumb, accessToken, accepted`, token mai loggato). `HTTP non-200` = errore, `HTTP 200` + XML valido = successo.
- `localAccountId` non condiziona più lo stato di visione: `PlexUserContext` espone `localAccountId: number|null` + `historyAvailable: boolean`. Un condiviso `RESOLVED` con `accessToken` valido passa `source=shared … localAccountId=null historyAvailable=false` → `snapshot/quickVerify/viewCount` attivi, `pollHistory` ignorato correttamente.
- Storia `getAccountHistory()` conserva ora gli episodi da `grandparentTitle+parentIndex+index` anche senza `grandparentRatingKey` né `ratingKey`; `PlexHistoryEntry.ratingKey` diventa opzionale. Film senza `ratingKey` arricchiti tramite `resolveMovie` (titolo esatto Movviz → titolo esatto libreria Plex → vero `ratingKey` + TMDB, `Guid` risoluzione ambiguità) invece di `continue`.
- WatchSync riscritto in **resolve-first**: `resolveEpisode/resolveMovie` → vero `ratingKey` Plex (`allLeaves`, vero `episode.ratingKey`) → `verifyWatchState` → `reconcile`. I `no verifyKey … S4E14` e `movie without ratingKey … La vie est belle` scompaiono.
- `resolveEpisode` privilegia la ricerca Plex (`allLeaves`) quando manca la chiave di ingresso, altrimenti Movviz esatto prima; upsert `mediaIdentityMap` sulla chiave vera. Tasso di rifiuti mal formati fortemente ridotto.
- Osservabilità mantenuta: `source=shared`, `tokenFp`, `plex.identity` senza token in chiaro.

## v1.25.28 — Settembre 2026

### Architettura Plex Sync, Watch State & Raccomandazioni — affidabilità completa

- Separazione stretta `PlexHistoryObserver` (attività, trigger) e `PlexWatchStateObserver` (stato `WATCHED/UNWATCHED` tramite `viewCount/lastViewedAt` con il token PMS dell'utente). Corregge il bug P0: "Marcare come visto" in Plex non creava un'entrata storia e rimaneva invisibile (ora rilevato da snapshot).
- Contesto Plex unificato `resolvePlexUserContext()` — `owner/account/managed` tramite ID stabili, `machineIdentifier` + `serverToken` per `userId`, cache 5 min, invalidazione su 401/403. Rimozione del fallback silenzioso verso `adminToken` per i dati personali.
- Unico reconciliatore canonico `PlexReconciler` (`BASELINE/UNCHANGED/REMOTE_WATCHED/REMOTE_UNWATCHED/ACK/CONFLICT`) + revisione LWW — nessuna scrittura diretta dagli osservatori, nessun ciclo `Movviz→Plex→Movviz`.
- Snapshot atomico per libreria (`fetch all pages → validate → build set → diff`) — uno snapshot parziale non viene mai interpretato come `UNWATCHED`, media eliminato ≠ `UNWATCHED`.
- Risolutore episodi ristrutturato con motivi `MISSING_RATING_KEY/MISSING_SEASON/AMBIGUOUS_MATCH` + campionamento, pipeline `ratingKey→GUID→SxxExx→library lookup`.
- Verifica mirata dopo ogni `scrobble/unscrobble` (`/:/scrobble` 200 ≠ prova) + `outbox` `PENDING` conservato fino ad ACK, `STALE_INTENT` ignorato.
- Store isolati per `userId+machine+ratingKey` (`plex-observed-state.json`, `plex-media-identity-map.json`, cursore `plex-history-cursors.json` per utente, circuit-breaker per utente, lock `plex-sync:userId`).
- Raccomandazioni strettamente `userId` — lettura di `CanonicalWatchState`, aggregazione TV in segnale show-level (peso `log1p`, saturazione), esclusione solo `FullyWatched`.
- Osservabilità `GET /api/plex/status` (admin) : `binding/status/tokenFp/localAccount/lastHistory/lastSnapshot/watchedObserved/canonical/outbox/circuit` + log strutturati `plex.identity/history/snapshot/reconciler` senza token in chiaro.
- Tasso di rifiuto episodi spiegato e fortemente ridotto, contatori `rejectedForeign/Unattributed/Malformed` + `sampleMalformed` visibili.

## v1.25.27 — Settembre 2026

### Affidabilità completa dello stato "visto" e della spilla sulle copertine Android

- Correzione critica: un crash o un guasto nel momento sbagliato poteva lasciare un titolo contrassegnato come visto in modo incoerente nel database; la scrittura è ora completamente atomica (tutto o niente).
- Lo stato "visto / non visto" visualizzato nell'app proviene ora sempre dalla fonte più affidabile disponibile, mai più da una copia che poteva occasionalmente disincronizzarsi.
- Un esportazione su Plex che falliva (guasto di rete, Plex non disponibile) andava persa silenziosamente; ora viene automaticamente riprovata in background fino al successo.
- Nuovo strumento di diagnostica e riparazione per gli account storicamente interessati dal bug di collisione di identificativo già corretto (due account distinti che condividono gli stessi film/episodi visti).
- Le applicazioni Android (mobile e TV) mostrano ora una spilla "visto" sulle copertine dei film nella schermata iniziale, Scopri, catalogo e ricerca.

## v1.25.26 — Settembre 2026

### Risoluzione profilo Plex per identificativo + quattro bug trovati da audit

- Correzione critica: alcuni account (tipicamente quelli gestiti dall'admin, mai connessi personalmente a Plex) fallivano al 100% dei loro tentativi di sincronizzazione, indefinitamente. La risoluzione dell'account Plex passa ora attraverso un identificativo stabile anziché dipendere da una connessione personale che potrebbe non avvenire mai.
- Lo stesso bug della sincronizzazione delle visualizzazioni (campo mancante lato Plex) colpiva anche la lista "Continuare a guardare" — corretto allo stesso modo.
- Un percorso di creazione account dimenticato durante la precedente correzione utilizzava ancora l'identificativo vecchio a rischio di collisione — corretto.
- Un disaccordo di conflitto a stretta uguaglianza confrontava due valori non correlati, rendendolo poco affidabile — corretto per confrontare i valori corretti.

## v1.25.25 — Settembre 2026

### Due bug Plex confermati in diretta tramite i log di produzione

- Correzione critica: il 100% degli episodi di ogni account veniva rifiutato come "malformato" ad ogni sincronizzazione Plex, indipendentemente dall'account — un campo che il server Plex non restituisce mai veniva usato per identificare la serie, impedendo a qualsiasi episodio di essere contrassegnato come visto.
- Correzione critica: due account distinti potevano ottenere lo stesso identificativo interno durante la creazione (connessione Plex), facendo condividere silenziosamente tutto il loro storico visto tra loro. Ora viene utilizzato un identificativo garantito unico ovunque, e qualsiasi collisione futura è bloccata anziché essere ignorata.
- I conti già interessati dalla collisione passata richiedono una pulizia puntuale prima della risincronizzazione completa.

## v1.25.24 — Settembre 2026

### Il popup "Novità" non troncava più le note di versione

- Bug confermato in diretta: un elemento del changelog avvolto su più righe mostrava solo la prima riga nel popup, mentre il file sorgente era ancora completo.

## v1.25.23 — Settembre 2026

### Correzione critica: il tracciamento Plex non si aggiornava più

- Bug di regressione reale: quando il motore di contesto SQLite è
  indisponibile (soprattutto in produzione Docker), ogni nuova decisione
  "vista" (Plex, manuale, lettore, IA, import) veniva silenziosamente rifiutata
  invece di essere applicata — confermato in diretta ("vista aggiunta su Plex,
  sync forzata, nulla in Movviz").
- Il risolutore ora si fida della sorgente quando non è disponibile alcuna
  informazione di conflitto, invece di bloccare di default.

## v1.25.22 — Settembre 2026

### Android Mobile NX / TV NX: l'eroe utilizza finalmente le vere raccomandazioni

- Correzione di un bug reale: Mobile NX e TV NX non inviavano alcun
  parametro alla chiamata dell'eroe, facendo sempre tornare il server
  al fallback locale (libreria aggiunta di recente, non personalizzata) —
  il pipeline di raccomandazione (semi ponderati, scorer, gusto) non era
  mai raggiunto su Android, a differenza del web.
- Nessun cambiamento nel contratto dei dati, nessuna app da reinstallare per
  un motivo tecnico legato alla versione.

## v1.25.21 — Settembre 2026

### Stato "visto / non visto": unica fonte di verità

- Correzione di un bug reale: una risincronizzazione Plex tardiva (storico
  contenente ancora una vecchia visione) poteva rianimare un titolo contrassegnato
  "non visto" manualmente, per mancanza di confronto delle date tra le fonti.
- Nuovo risolutore canonico (`applyWatchDecision`): la decisione più
  recente (Plex, lettore, azione manuale, IA, import) vince sempre per
  il tempo reale dell'evento, mai per l'ordine di sincronizzazione.
- Correzione di un vero bug di un carattere che scriveva un timestamp nella
  colonna sbagliata durante la fusione degli stati di riproduzione.
- Lo scrobble/unscrobble Plex in uscita è ora tracciato e visibile
  (successo/fallimento), dove prima esisteva solo un log diagnostico.
- Contratto API invariato — nessun aggiornamento richiesto su Desktop, Mobile NX
  o TV NX.

## v1.25.20 — Settembre 2026

### Riprogettazione del motore di raccomandazione "Per te"

- I semi (titoli usati come punto di partenza per i suggerimenti) sono ora ponderati per forza di segnale reale — valutazione esplicita, 👍, coinvolgimento serie, recenza — anziché trattare ogni titolo visto come equivalente. Un film odiato-ma-visto non pesa più quanto un 5★.
- I candidati TMDb (`recommendations` + `similar`) sono aggregati da prova multi-semi con una funzione di consenso satura, e classificati da un scorer puro e deterministico (testabile senza rete) piuttosto che da una formula dominata dalla popolarità TMDb.
- "Perché hai guardato X" e l'Hero della dashboard riutilizzano ora le stesse primitive di gusto comuni (`userContext/taste.ts`) anziché logiche di scoring duplicate — l'Hero non aveva finora alcun legame con questo strato.
- Correzione di un bug di regione: il catalogo Netflix/Disney+/Prime e i badge "dove guardare" forzavano `watch_region=FR` per tutti, inclusi gli account belga/svizzero/canadese. Nuova impostazione "Regione streaming" nel profilo (11 paesi, applicata automaticamente su Desktop, Mobile NX e TV NX poiché è memorizzata lato account).
- Contratto delle rotte API invariato — nessun aggiornamento richiesto lato Android Mobile NX o TV NX.

## v1.25.19 — Settembre 2026

### Android TV NX: avatar aggiornato ad ogni avvio

- Nessun cambiamento visivo rispetto a v1.25.18.
- Le uniche immagini il cui cache è forzato sono le foto profilo.
- Viene aggiunto un ID di sessione all'URL dell'avatar ad ogni nuovo avvio del processo TV: Coil ricarica quindi realmente la foto anziché riutilizzare un'immagine cache precedente.
- L'URL rimane stabile durante tutta la sessione per evitare download ripetuti durante le ricomposizioni.
- Il cache-buster effimero non viene mai persistito nelle preferenze locali.

## v1.25.18 — Settembre 2026

### Android TV NX — sidebar premium + avatar Movviz realmente sincronizzati

- Sidebar espansa ridotta da 195 dp a 156 dp (-20 %).
- Rimozione del grande gradiente attivo e del bordo bianco di 2 dp: stati attivo/focus più sobri, sfondo del brand leggero e bordo di 1 dp.
- Correzione dello sfondo attivo che non riempiva la larghezza del pulsante espanso.
- Popup profilo e footer armonizzati con lo stesso linguaggio visivo premium.
- Il profilo attivo viene ora aggiornato anche se è già in cache: una foto cambiata su desktop sostituisce immediatamente l'antico avatar TV.
- I profili già noti del dispositivo riconciliano nome/avatar con `/api/tv-profiles`; l'avatar Movviz (`customAvatar`) rimane prioritario e Plex è solo un fallback.
- Stessa riconciliazione applicata al client NX mobile.
- Hero «In primo piano»: `Leggi` di default, `Riprendi` solo quando esiste un vero progresso.

# Changelog

## v1.25.17 — Settembre 2026

### Profili: avatar Movviz canonico su desktop, mobile NX e TV NX

- L'avatar personalizzato Movviz rimane la fonte di verità: un aggiornamento della foto Plex aggiorna solo il fallback e non può più cancellare `customAvatar`.
- I file avatar Movviz ancora presenti sul disco vengono recuperati automaticamente se una vecchia logica li aveva disabilitati.
- Android TV NX e Android Mobile NX normalizzano le URL `/api/avatars/...` rispetto al server Movviz in modo che picker, sidebar, badge e scheda profilo visualizzino tutti la stessa foto.
- L'upload Movviz tenta anche una replicazione su Plex tramite l'endpoint privato utilizzato da Plex Web; questa sincronizzazione è strettamente best-effort e un rifiuto da parte di Plex non impedisce mai il funzionamento dell'avatar Movviz locale.

## v1.25.16 — Settembre 2026

### Android TV NX: sidebar/contenuto D-pad focus stabilizzato

- Sidebar: rimozione dell'intercettazione globale di `DPAD_RIGHT`; l'uscita verso il contenuto si basa ora su `focusProperties.exit`, prevista nativamente da Compose.
- Ordine dei modificatori corretto: `focusProperties` racchiude `focusGroup` in NavRail e sulla home, in modo che le regole di uscita si applichino al corretto target di focus.
- Rimozione del fallback di focus non cablato in NavRail, che complicava il percorso senza mai essere utilizzato.

## v1.25.15 — Settembre 2026

### Android TV NX: sidebar D-pad sbloccata (focusGroup exit)

- `Home 1×→ 3×↓ 3×←` reindirizzava a `Cerca` invece di `Home` — passaggio da `enter` a `exit` sulla `Box` contenuto + `TvLazyColumn` in `focusGroup` in modo che `SINISTRA` da qualsiasi prima scheda vada bene sulla scheda selezionata.

## v1.25.14 — Settembre 2026

### Android TV NX: hero centrato in alto

- Backdrop dell'hero allineato `TopCenter` (invece di centro) — si vede la parte superiore del poster, più la parte inferiore tagliata.

## v1.25.13 — Settembre 2026

### Android TV NX: D-pad Home 1×→ 3×↓ 3×← sbloccato

- `Home > destra > 3× giù > 3× sinistra` non si blocca più nella sidebar — `focusGroup` + `focusProperties { enter/exit }` su NavRail/Content sostituiscono i `left =` sugli elementi lazy (che rompevano lo spazio), `TvLazyColumn` in `focusGroup`, `DIREZIONE` privilegia `moveFocus` poi `contentFocus`.

## v1.25.12 — Settembre 2026

### Android TV NX: hero immersivo restaurato

- L'hero recupera la sua dimensione immersiva originale (500 px max, 46% viewport, padding 52/40/46, width 620) — solo le piastrelle e la sidebar rimangono al -25% come richiesto.

## v1.25.11 — Settembre 2026

### Android TV NX: riduzione globale del 25% + D-pad sbloccato

- Tutta l'interfaccia TV ridotta del 25% (sidebar 63/195 dp, schede 99/203/124 dp, testo 11/17 sp, ecc.) — sidebar inclusa, rapporti e gradienti mantenuti.
- D-pad: `Home > destra > 3× giù > 3× sinistra` non blocca più nella sidebar — `SINISTRA` dalla prima scheda di ogni riga (incluso "In arrivo") va esplicitamente alla scheda selezionata, `SU` risale alla NavRail, `DESTRA` recupera il contenuto anche dopo lo scroll.

## v1.25.10 — Settembre 2026

### Correzione download: pausa/riavvio WebTorrent

- `pausa`/`riavvia` non funzionavano più dopo il redesign (caso sensibile a `infoHash`) — `WebTorrentBackend` e `AbstractBackend` ora passano in insensibile a maiuscole/minuscole, anche `findByInfoHash`; il pulsante pausa/riavvio desktop e mobile riprogramma correttamente WebTorrent.

## v1.25.9 — Settembre 2026

### Android TV NX: sidebar quadrata, D-pad In arrivo sbloccato

- NavRail: icone quadrate da 56 dp (raggio 14 dp) su rail ritratto, gradiente mantenuto sull'attivo — come il quadrato della 2a immagine, niente più pill allungate brutte a riposo.
- D-pad: `SINISTRA` dalla prima scheda di ogni riga (incluso "In arrivo") va ora esplicitamente alla scheda selezionata tramite `focusProperties`, più casuale geometricamente (In arrivo → Profilo) — la prima scheda `SINISTRA` non blocca più.
- Home: `SU` dal hero/contenuto risale correttamente alla NavRail, `GIÙ` rimane nella colonna senza sfuggire alla sidebar/launcher.

## v1.25.8 — Settembre 2026

### Android TV NX: durata rimanente su Continua, API on-deck arricchita

- `GET /api/plex/on-deck` espone ora `durationMs` lato TV: la riga "Continua" mostra `S2 E3 · 22 min rimanenti` (o `22 min rimanenti` per un film) invece di un semplice `S2 E3`, con barra sottile mantenuta.

## v1.25.7 — Settembre 2026

### Android TV NX: D-pad sbloccato, loghi ritrovati, serie sbrogliate

- D-pad: SINISTRA dal contenuto punta ora alla scheda selezionata (meno casuale), SU non cade più sull'ancora invisibile di 2 px, GIÙ non sfugge più alla sidebar/launcher, INDIETRO da una scheda ripristina la stessa scheda (focusRestorer) invece della NavRail — 3 trappole bloccanti corrette (rapporto 183 test: 161 PASS).
- Piattaforme: piastrelle 16/9 con sfondo bianco 95 % dietro il logo (come Scopri), visibili anche per i loghi scuri; hero e righe mantengono i loro bagliori.
- Serie sbrogliate: pillola FILM/SERIE sulle righe miste (Selezione, Tendenze, Aggiunti, editoriali), ricerca tipo-split lato server (`?type=movie|series`) invece di un filtro client.

## v1.25.6 — Settembre 2026

### Android TV NX: mockup Home, trailer allineati, pattern TV ovunque

- Home: riga "Piattaforme" (piastrelle 16/9, stessi loghi di Scopri, Vedi tutto personalizzato al click), hero conforme al mockup (46 % / 500 px max, CTA "Ricominciare" in gradiente di marca, puntini in basso a destra), riga "Continua" in schede panoramiche fisse 270x150 con still dell'episodio, contesto S/E e progressione incorporati, bagliore viola al focus.
- Trailer: la TV riproduceva le fonti dirette (ricerca per titolo, a volte il film sbagliato) prima di YouTube, a differenza del desktop che riproduce solo YouTube — YouTube è ora sempre il primo ovunque (hero, schede, scheda titolo), il diretto è solo un ultimo ricorso.
- Logo: animazione orbitale rimossa (alone rotante, onde, particelle, pulsazione), marchio fisso.
- Scopri, Libreria, Ricerca e Impostazioni passati su TvLazyColumn/TvLazyRow + focusRestorer; Indietro/Escape nel campo di ricerca restituiscono il D-pad senza lasciare lo schermo.
- Pillola "VF" dell'hero aggiunta ma visualizzata solo su dato reale (nessun campo VF restituito dal server oggi: mai prodotto).

## v1.25.5 — Settembre 2026

### Android TV : cache memoria immagini duplicato

- La cache memoria Coil passa da 10 % a 20 % della RAM applicativa: meno scaricamenti di locandine/sfondi nelle file, più fluido sui dispositivi ben equipaggiati.

## v1.25.4 — Settembre 2026

### Pulizia visiva: sfondo animato rimosso, suggerimenti e metadati affinati

- Lo sfondo animato "Aurora" (sfondo dell'app) è stato rimosso — componente inutilizzato che appesantiva il rendering senza valore visivo attuale.
- Motore di suggerimenti e recupero metadati TMDb affinati (orientamento video, testi tradotti).

## v1.25.3 — Settembre 2026

### Android TV/mobile: sidebar conforme al design, correzioni lettore e profili

- Sidebar Android TV riallineata sui valori esatti del mockup (larghezza, spaziature, icone) — l'icona Scopri (bussola) e il bug che impediva al D-pad di raggiungere il contenuto di questo schermo sono corretti.
- Scheda stagione e badge "visto" sugli episodi ristilizzati nell'identità Movviz invece di un grigio/bianco piatto.
- Foto profilo: un cambiamento effettuato dal web non veniva replicato dalle app Android TV e mobile al successivo avvio (avatar aggiornato in memoria ma mai rieseguito sul dispositivo) — corretto su entrambe le app.
- Anteprima video (homepage e scheda titolo): il video si ritaglia diversamente dall'immagine statica dietro di esso, creando una banda visibile al passaggio — corretto su Android TV e mobile.
- Compilato e verificato visivamente su emulatore Android TV; la griglia di ricerca e un caso raro di riproduzione innescata erroneamente dal D-pad rimangono da investigare.

## v1.25.2 — Settembre 2026

### Android TV: rifacimento navigazione e visuale

- La navigazione passa da una barra superiore a una sidebar laterale a fisarmonica (solo icone, si ingrandisce con il focus del telecomando) — palette blu-notte, gradiente di marca blu→viola→magenta.
- Film e Serie si fondono in un unico tab Libreria (Film/Serie/Collezioni); Ricerca diventa un tab a sé stante con lo stesso filtro Tutto/Film/Serie del mobile; Scopri è di nuovo direttamente accessibile.
- ⚠️ Non compilato/testato su dispositivo — prima verifica reale tramite il build CI innescato da questo tag.

## v1.25.1 — Settembre 2026

### Hotfix: timeout API durante il sync Plex

- La rilevazione "stesso file fisico" ricaricava `plex-path-mappings.json` (uno `stat` disco) ad ogni confronto, in sincrono: su una grande libreria, ogni elemento Plex scansionava migliaia di percorsi bloccando il ciclo degli eventi, e tutte le rotte API Timeout durante il sync.
- I guardiani passano ora in due fasi senza alcun syscall: uguaglianza normalizzata prima (solo memoria), poi mappature caricate una sola volta + suffisso. Stesso trattamento nella riconciliazione disco.
- Nessun cambiamento nel comportamento di business: stesse fusioni, stesse regole, solo senza I/O.

## v1.25.0 — Settembre 2026

### Libreria Plex: fine dei duplicati, riproduzione immediata e percorsi Docker

- Il blocco anti-duplicati del sync Plex è ora condiviso tra tutti i bundle (niente più importazione duplicata al doppio clic o a sovrapposizione con il pianificatore), con ricontrollo dopo ogni chiamata TMDb.
- Stesso percorso fisico = stesso film: il sync fonde invece di creare un duplicato, anche con mount diversi (Movviz `/data/film` ↔ Plex `/volume1/docker/plex/film`) e agenti Plex divergenti. La griglia maschera anche i duplicati residui tramite `tmdbId`.
- Impostazioni → Plex: nuova sezione di corrispondenza dei percorsi (solo Docker/Linux) — destinazioni finali del torrent confrontate con le posizioni reali delle sezioni Plex, suggerimenti da validare con un clic, inserimento manuale possibile. Nulla viene applicato senza validazione.
- Lettura non appena il file viene spostato e rinominato nella posizione corretta, senza attendere Plex (web, Android TV e mobile). Plex rimane un arricchimento asincrono (badge, URL di riserva).
- Il pulsante di sincronizzazione mostra ora uno stato di avanzamento persistente (fase, sezione, contatore, secondi) e rimane disattivato finché il server è in esecuzione.
- La riconciliazione giornaliera non riporta più anomalie false legate ai doppi visti dei mount (confronto esatto + traduzione tramite mappature + suffisso genitore/file).
- Reti strette: riconciliazione dei download ogni 2 minuti, recupero dei completati non importati ogni 15 minuti.

## v1.24.170 — Settembre 2026

### Barra laterale: ritrazione automatica al passaggio del mouse

- La barra laterale si riduce ora automaticamente in una colonna di icone e si ingrandisce al passaggio del mouse, spingendo il contenuto (non è più necessario cliccare su un pulsante manuale).
- Icone ritratte ingrandite, più distanziate, senza sfondo sulle icone inattive — solo l'icona attiva mantiene la sua piastrella sfumata.

## v1.24.169 — Settembre 2026

### Download: le copertine vengono finalmente visualizzate

- La vera causa: la coda ricostruisce le informazioni di ogni titolo ad ogni aggiornamento dal motore di download, senza mai includere la copertina — corretto. Ora funziona per i download in corso E già presenti nella coda/nella cronologia (retroattivo, nulla da riavviare).

## v1.24.168 — Settembre 2026

### Download: titolo cliccabile, dettagli sobri, copertine per i prossimi download

- Cliccare sul titolo di un download apre ora la sua scheda, come ovunque nell'app.
- I dettagli sotto il titolo (risoluzione, sorgente, codec, audio, HDR) sono tornati dal testo sobrio invece di grandi pastiglie colorate; l'indicizzatore "Sconosciuto" non viene più visualizzato quando l'informazione non è mai stata salvata.
- La copertina di ogni titolo viene ora visualizzata per ogni nuovo download avviato da questa versione (l'informazione non era mai stata salvata da nessuna parte prima, incluso il percorso effettivamente percorso da una ricerca/recupero manuale) — le voci già presenti nella coda/nella cronologia non lo avranno retroattivamente.

## v1.24.167 — Settembre 2026

### Download: interruttori rapidi coerenti con il resto dell'app

- "Avvio automatico all'avvio" e "Sequenziale" utilizzano ora lo stesso componente interruttore di tutto Movviz, invece di uno stile fatto in casa che stonava.

## v1.24.166 — Settembre 2026

### Barra laterale retrattile

- La barra laterale può ora ritrarsi in una semplice colonna di icone ingrandite (logo + icone stile dock), per guadagnare spazio sullo schermo. Preferenza memorizzata per dispositivo.

### Scoperta: filtro piattaforma reimpostabile

- Cliccare nuovamente su una piattaforma già selezionata disattiva il filtro invece di rimanere bloccato su di esso.

## v1.24.165 — Settembre 2026

### Scoperta: barra superiore ingrandita e corretta

- Schede, loghi piattaforme, pulsante Filtri e ordina sono circa il 50% più grandi e leggibili.
- I loghi delle piattaforme riempiono meglio il loro contenitore.
- L'etichetta "Ordina per" veniva visualizzata come una chiave tecnica grezza invece del testo tradotto — corretto.

### Download: copertine e azioni mancanti

- Ogni download mostra ora la sua copertina (invece di un semplice'icona) su una riga leggermente più alta.
- I pulsanti "sostituisci" (ricerca manuale) e "elimina" erano assenti accanto a pausa sulla dashboard dei download — aggiunti.
- Le toggle "Avvio automatico all'avvio" e "Sequenziale" mostrano ora un messaggio di errore invece di rimanere silenziosamente senza effetto in caso di fallimento.

## v1.24.164 — Settembre 2026

### Home: le impostazioni della dashboard riprendono effetto

- Le impostazioni dell'eroe (video, velocità dello slideshow, anno minimo, contenuto suggerito) e la visualizzazione delle righe sono nuovamente prese in considerazione sulla home — non avevano più alcun effetto dall'aggiornamento della home.
- Il trailer dell'eroe è ora attivato di default per tutti gli account, inclusi quelli che lo avevano già (senza saperlo) su "disattivato".
- Il menu a discesa "Anno minimo dei caroselli" è finalmente leggibile (sfondo scuro invece del bianco predefinito del browser).

### Home e Scopri: schede più grandi e veramente adattive

- La barra laterale è stata ampliata di circa il 15%.
- Le schede film/serie di Home e Scopri sono ingrandite di circa il 25% e ora si restringono realmente con la finestra (come le piastrelle Piattaforme), invece di rimanere fisse a una dimensione predefinita.

## v1.24.163 — Settembre 2026

### Home: visual e trailer dell'eroe allineati alle schede

- L'eroe privilegia gli sfondi editoriali panoramici senza titolo integrato, in modo che il logo Movviz rimanga da solo sopra l'immagine.
- Il lettore dell'eroe utilizza ora esattamente il profilo iframe delle schede film e serie.

## v1.24.162 — Settembre 2026

### Home: eroe disponibile anche sotto sovraccarico TMDb

- Il primo rendering dell'eroe utilizza immediatamente gli sfondi già archiviati nella libreria, senza dipendere da una richiesta TMDb lenta o scaduta.
- I suggerimenti arricchiti e i trailer vengono caricati successivamente, senza poter oscurare l'immagine abituale dell'eroe.

## v1.24.161 — Settembre 2026

### Home: fallback sicuro dell'eroe

- Il trailer rimane un overlay sullo sfondo dell'eroe: senza video o in caso di errore dell'iframe di YouTube, l'immagine abituale rimane visibile con tutti i controlli dell'eroe.
- Un errore isolato del lettore non può più far scomparire l'intero eroe.

## v1.24.160 — Settembre 2026

### Home: trailer dell'eroe affidabilizzati

- L'eroe adotta lo stesso profilo iframe delle schede film e serie.
- Un'iframe YouTube caricata appare ora dopo un breve ritardo se YouTube non trasmette i suoi messaggi interni di riproduzione, invece di lasciare lo sfondo statico indefinitamente.

## v1.24.159 — Settembre 2026

### Home: plafond ultrawide regolato

- Il canvas desktop fluido e centrato è ora plafonato a 2000 px invece di 2200 px.

## v1.24.158 — Settembre 2026

### Home e scoperta: larghezza fluida e OCS ripristinato

- La home utilizza ora tutta la larghezza utile su desktop, poi rimane centrata con un plafond di 2200 px su ultrawide. Le schede mantengono le loro dimensioni e mostrano quindi più contenuti, mentre le piastrelle delle piattaforme guadagnano spazio.
- Il hero passa a larghezza piena con rapporto 18:9; «Riprendi» diventa una riga editoriale sopra i suggerimenti personalizzati.
- Le esclusioni per pollice verso il basso sono riviste dalle righe locali: un titolo deviato da «Meno di 40 minuti» non torna più dopo il ricaricamento.
- OCS mantiene il suo logo e il suo nome, ma interroga ora il catalogo TMDb attuale Ciné+ OCS (id 685) invece del vecchio id 56 vuoto.

## v1.24.157 — Settembre 2026

### Home: piattaforme a larghezza dinamica

- I otto loghi delle piattaforme riempiono ora la larghezza del contenuto fino all'allineamento «Vedi tutto».
- La griglia si riduce correttamente da 8 a 3 colonne a seconda della larghezza dello schermo, senza scorrimento orizzontale né piccole piastrelle fisse.

## v1.24.156 — Settembre 2026

### IA: offerte gratuite realmente selezionabili

- I cataloghi OpenCode Zen e OpenRouter sono rivisti dinamicamente e filtrati per proporre solo i modelli gratuiti.
- Gemini è limitato ai modelli gratuiti ufficialmente documentati e realmente accessibili con la chiave configurata; Mistral è esplicitamente limitato al quota incluso del piano gratuito.
- Il blocco è applicato nell'interfaccia, al salvataggio e alla chiamata reale: una vecchia configurazione non può più selezionare silenziosamente un modello fatturabile.

## v1.24.155 — Settembre 2026

### IA: il pulsante Testa mostra l'errore grezzo del provider

- Il test restituiva solo «quota» o «fallimento», nascondendo la vera causa (chiave non valida, fatturazione mancante, modello sconosciuto, rate-limit reale). Il messaggio esatto del provider viene ora visualizzato di seguito nel pannello.

## v1.24.154 — Settembre 2026

### IA: il pulsante Testa testava il provider sbagliato

- La rotta di test costruiva la sua catena dal primary salvato invece del provider cliccato: «Testa» su opencode testava in realtà mistral, con un OK visualizzato sotto la scheda sbagliata. Corretto con una catena ridotta al provider richiesto.

## v1.24.153 — Settembre 2026

### Loghi piattaforme: fine degli sfondi bianchi

- Disney+ e Apple TV+ utilizzano le loro varianti bianche (stessi tracciati, arco blu Disney+ conservato): tutte le piastrelle rimangono scure, nessun fondo bianco più.
- OCS viene visualizzato direttamente sulla piastrella scura, senza sfondo bianco.

## v1.24.152 — Settembre 2026

### Loghi piattaforme locali

- La riga Piattaforme di accoglienza e Scoperta (schede + griglia) utilizza SVG locali (Netflix, Disney+, Prime Video, HBO Max, Apple TV+, YouTube, Crunchyroll, OCS recuperato da Wikimedia) invece dei loghi TMDb remoti, con sfondo chiaro per i loghi scuri.

### Barra di ricerca stile mobile

- La barra di ricerca replica esattamente il rendering Android mobile: pill di 46px, bordo elettrico blu → viola → magenta, sfondo #131836, icona + placeholder di 13px #B3B3B3.

### Fine modalità chiara

- Eliminazione completa della modalità chiara: scuro imposto ovunque, senza scelta possibile — rimozione dello switcher dalla topbar, dallo step Aspetto del wizard, dalla sezione Aspetto del profilo, di tutto il CSS light e della preferenza server.

## v1.24.151 — Settembre 2026

### Android smartphone — Il mio spazio

- La barra inferiore in verticale rinomina la scheda "Libreria" in "Il mio spazio", più appropriato per un hub che raccoglie la watchlist, la cronologia recente e le collezioni.
- Le tre schede (Watchlist, Cronologia, Collezioni) vengono visualizzate in una griglia di 3 colonne invece dello scorrimento orizzontale.
- Tutto il contenuto è cliccabile: le schede aprono la scheda del titolo, le collezioni sono navigabili e le saghe rispondono al tocco.

## v1.24.150 — Settembre 2026

### Dashboard NX

- Fissa la riga Piattaforme: Netflix, Disney+, Prime Video, HBO Max, Apple TV, YouTube, Crunchyroll e OCS.
- Ingrandisce le piastrelle rettangolari delle piattaforme e rimuove Canal+ da questa composizione.

## v1.24.149 — Settembre 2026

### Dashboard NX

- Ribilancia la composizione ultra-ampia: contenuto ancorato verso la sidebar, larghezza utile ampliata, hero più compatto e colonna Riprendi arricchita.
- Trasforma i suggerimenti principali in locandine verticali e dà più presenza alle piattaforme e alla ricerca.
- Mostra il tempo rimanente effettivo in Riprendi basato sulla durata e sulla posizione Plex.

## v1.24.148 — Settembre 2026

### Scoperta NX

- Corregga la griglia Novità e Tendenza: ogni piastrella utilizza tutta la sua cella e il suo stato rimane sovrapposto al visivo.
- Il pannello Filtri rimane aperto durante la selezione di un genere su desktop.

## v1.24.147 — Settembre 2026

### Scoperta NX

- I binari utilizzano ora la larghezza reale delle piastrelle, senza spazi vuoti o pulsanti di aggiunta staccati tra i contenuti.

## v1.24.146 — Settembre 2026

### Scopri NX

- La barra desktop Scopri riprende la composizione dello schizzo: schede compatte, piattaforme separate, pulsante Filtri e ordina leggibile, senza alone né riquadro globale.

## v1.24.145 — Settembre 2026

### Fedeltà NX desktop

- Rimozione di alone, ombre luminose e cornici decorative che non sono presenti nello schizzo NX.
- La ripresa, le piattaforme e le azioni della topbar recuperano una composizione scura, compatta e leggibile.

## v1.24.144 — Settembre 2026

### Fedeltà NX desktop

- Il corpo desktop è densificato: sidebar compatta, stato attivo bordato, topbar e ricerca ristrette.
- Home, Scopri, Libreria e Download adottano controlli più nitidi e la gerarchia editoriale della charte NX, senza modificare l'interfaccia mobile.

## v1.24.143 — Settembre 2026

### Download

- Il pannello di impostazioni rapide mostra intestazioni tradotte, un link esplicito ai client di download e interruttori accessibili senza ridurre la loro leggibilità.

## v1.24.142 — Settembre 2026

### Fedeltà NX desktop

- La barra Home mostra ora le piattaforme reali sotto l'hero; Riproduzione è prioritaria e La mia lista è azionabile.
- La libreria riceve la sua toolbar NX con filtri reali (4K, HDR, la mia lista, recente e ordina) e binari più compatti.
- Il binario Download espone l'attesa, lo spazio libero e impostazioni rapide realmente collegate al motore.

## v1.24.141 — Settembre 2026

### Interfaccia NX desktop

- Riprogettazione delle pagine Home, Scopri, Libreria e Download: composizione desktop densa, binari di contenuti, filtri piattaforme, colonna Generi e tabella di monitoraggio in tempo reale.
- Le pagine Film e Serie privilegiano ora i suggerimenti, con un accesso esplicito alla rispettiva libreria.
- Il dashboard mantiene una composizione fissa, con un binario dedicato alla ripresa della riproduzione e senza duplicato di questa riga.

### Plex e download

- Una connessione Plex personale da mobile o TV recupera immediatamente l'elenco di monitoraggio dell'utente e attiva la sua sincronizzazione privata.
- Il motore conserva una cronologia reale dei flussi per le statistiche di download live.

## v1.24.140 — Settembre 2026

### Android

- Gli amministratori possono ora creare un account utente dalle impostazioni Android, con le stesse regole di convalida e autorizzazione dell'interfaccia web.

## v1.24.139 — Settembre 2026

### Interfaccia

- Il caricamento ottimizzato è ora il solo comportamento dell'interfaccia, attivo di default anche per le configurazioni più vecchie. L'opzione Compatibilità è scomparsa dalle Impostazioni.

## v1.24.138 — Settembre 2026

### Affidabilità di Scoperta

- Tutte le richieste TMDb condividono ora una coda globale di sei connessioni massime, comprese tra le righe caricate in parallelo.
- Le richieste TMDb identiche in corso sono mutualizzate e i suggerimenti non analizzano più dettagli del necessario, evitando i picchi di timeout che svuotavano Scoperta.

## v1.24.137 — Settembre 2026

### Interfaccia desktop

- Le schede e i pulsanti secondari riprendono i contorni elettrici della charte NX mobile: silhouette viola/ciano più leggibile, alone discreto e focus rinforzato, senza modificare la struttura delle pagine.

## v1.24.136 — Settembre 2026

### Scoperta e suggerimenti

- Un clic su "Scarsa raccomandazione" rimuove immediatamente il titolo da tutte le righe interessate, sposta le schede rimanenti e carica un sostituto. Il rifiuto rimane permanente dopo l'aggiornamento o il riavvio.
- Gestione → Esclusioni mostra tutti i suggerimenti rifiutati e consente di riautorizzarli individualmente.

## v1.24.135 — Settembre 2026

### Scoperta

- La riga Anime rimane globale, anche quando viene selezionato un filtro di continente. I film e le serie animate giapponesi non scompaiono quindi da Scopri.

## v1.24.134 — Settembre 2026

### Scoperta

- I continenti coprono ora tutti i paesi e i territori ISO riconosciuti da TMDb: spuntare o deselezionare un continente applica effettivamente l'insieme corrispondente al filtro originale.
- I loghi delle piattaforme sulle schede (Netflix, Disney+, Prime Video, ecc.) vengono visualizzati senza sfondo né cornice bianca.

### Docker

- Le immagini AMD64 e ARM64 sono pubblicate con manifest Docker V2 piuttosto che manifest OCI, in modo che Synology Container Manager possa leggere il tag `latest` e scaricare gli aggiornamenti.

## v1.24.133 — Settembre 2026

### Installazione

- Windows e Linux utilizzano anche i port BitTorrent configurabili `55000`/`55001` di default. Entrambe le variabili vengono trasmesse al servizio Windows, e è documentato un override persistente systemd per Linux.

## v1.24.132 — Settembre 2026

### Docker

- Le porte BitTorrent per film e serie TV utilizzano ora `55000` e `55001` di default, e sono configurabili indipendentemente tramite variabili Docker. Queste variabili sostituiscono anche le porte precedentemente registrate dal motore, evitando qualsiasi conflitto persistente con un altro client torrent. UPnP apre e rimuove automaticamente i mappaggi TCP e UDP corrispondenti quando il router lo consente.

## v1.24.131 — Settembre 2026

### Docker

- Il manifesto Docker espone ora esplicitamente i tre servizi Movviz: interfaccia/API (`9810`), motore di download (`9820`) e risolutore Cloudflare (`9830`), oltre ai porte BitTorrent.

## v1.24.130 — Settembre 2026

### Installazione

- L'assistente di prima installazione propone ora, prima della configurazione degli indexer, di disattivare la ricerca e il download automatico dei contenuti seguiti ma mancanti.

## v1.24.129 — Settembre 2026

### Android mobile NX

- La ricerca persistente in paesaggio riserva ora l'altezza, più 3 dp, in ogni pagina della colonna centrale: nessun eroe, titolo o primo elemento di lista viene nascosto all'apertura o durante il cambio di scheda.

## v1.24.128 — Settembre 2026

### Scoperta

- **Tendenza / Top / Novità allineati per generi sintetici**: `Anime` e `Romance ado` (Teen) rispettano ora la classificazione scelta — `Tendenze` (`popularity.desc`), `Top` (`vote_average.desc` + `vote_count.gte 200`) e `Novità` (`primary_release_date.desc`/`first_air_date.desc` + limite a oggi) — e l'anno, invece di un `popularity.desc` hardcodato. Anche gli altri filtri (piattaforma, studio, durata) vengono trasmessi.

## v1.24.127 — Settembre 2026

### Android mobile NX

- La barra di ricerca in ritratto è ora persistente e opaca sopra la colonna centrale in paesaggio; l'eroe e le liste scorrono sotto.
- Classificazione Netflix, Prime Video e piattaforme: pulsanti NX premium (bordi elettrici, superfici blu notte e selezione sfumata viola).
- I cataloghi delle piattaforme non diventano più vuoti quando un bacino valido contiene solo novità: si espandono su questi titoli invece di mostrare una pagina senza risultati.

## v1.24.126 — Settembre 2026

### Android mobile NX

- Modalità paesaggio: la ricerca lascia la barra laterale e diventa un'azione globale fluttuante in alto a destra del contenuto centrale.

## v1.24.125 — Settembre 2026

### Android mobile NX

- Paesaggio e modalità espansa: menu più stretto con logo mantenuto in alto, larghezza adattiva del pannello download e spazio centrale preservato (minimo 360 dp con tre colonne).
- Scheda in primo piano arrotondata e spaziata in paesaggio, senza modifiche al ritratto o a TV NX.
- Carta profilo estesa al paesaggio: contorni elettrici blu-viola-magenta delle schede e dei pulsanti di riproduzione in sfumatura malva.
- Foto del profilo attivo aggiornata dal account connesso anche se esiste già un profilo locale; la cache del selettore conserva anche la foto personalizzata Movviz.
- Correzione della referenza Compose del selettore di ordinamento dei cataloghi.

### Intelligenza artificiale

- L'elenco di priorità IA è ora l'unica fonte di verità: un vecchio valore `primary` non può più precedere il fornitore posizionato al n. 1.

## v1.24.124 — Settembre 2026

### Android NX

- I cataloghi Netflix, Prime Video e Disney+ non rimangono più vuoti dopo un temporaneo guasto TMDb: una risposta iniziale vuota non avvelena più la cache per 45 minuti.
- Le pagine delle piattaforme propongono ora di default «Selezione per te», «Più votati» e «Più recenti».
- Aggiornamento immediato degli avatar su TV NX anche quando Plex sostituisce l'immagine senza cambiarne l'URL.
- I contatori «Film visti» e «Serie visti» mostrano ora i totali Plex/Movviz aggregati anziché contare solo le 20 schede recenti visibili.

## v1.24.123 — Settembre 2026

### Intelligenza artificiale

- Aggiunto OpenCode Zen ai fornitori IA, con chiave API, test di connessione e supporto per i protocolli Chat Completions e Responses.
- Selezione volontariamente limitata ai sei modelli ufficialmente gratuiti di Zen: nessun modello a pagamento può essere registrato.
- Ordine di priorità dei fornitori completamente configurabile; il motore rispetta la classifica scelta per il fornitore principale e ogni fallback.

### Profili

- Sincronizzazione avatar Movviz ↔ Plex con l'ultimo cambiamento vincente, con impronta anti-ciclo, invalidazione cache TV NX e fallback sicuro: un fallimento Plex non blocca mai l'upload Movviz.

## v1.24.122 — Settembre 2026

### Visione unificata

- Fonte unica di stato visto/non visto su desktop, Mobile NX e TV NX, con aggregazione reale di episodio, stagione e serie.
- Sincronizzazione Plex bidirezionale che conserva le date reali; una visione confermata rimane prioritaria rispetto a una semplice assenza di stato.
- Ripresa pulita non appena un titolo è visto o resettato, con una sola ripresa attiva per serie.

### Suggerimenti e IA

- Classifica personalizzata basata sui gusti e sull'appeal pubblico: popolarità, volume di voti e qualità del match prevalgono sui contenuti oscuri equivalenti.
- Le novità molto seguite di un fornitore possono risalire immediatamente quando corrispondono ai gusti, senza aspettare di accumulare migliaia di voti.
- Profilo arricchito con temi e parole chiave TMDb, in complemento a generi, atmosfere, attori, registi, franchise, voti e comportamenti reali; lo stesso contesto alimenta suggerimenti e IA Movviz.

## v1.24.121 — Settembre 2026

### Android

- Ritiro dei clienti Android storici Mobile e TV: rimangono compilati e pubblicati solo Movviz NX Mobile e Movviz NX TV. Le rotte API esistenti rimangono invariate.

## v1.24.120 — Settembre 2026

### Profili

- Foto profilo personalizzata dall'utente (Impostazioni → Profilo su desktop, foto toccabile sulla scheda mobile): JPEG/PNG/WebP/GIF ≤ 2 Mo, visibile desktop + mobile + TV, prioritaria rispetto alla foto Plex (invariata).
- Nota: la replicazione su Plex è impossibile tramite API pubblica (nessun endpoint documentato — solo l'app ufficiale sa farlo); la foto Movviz vive lato Movviz, hook pronto in `src/lib/avatars.ts`.

## v1.24.119 — Settembre 2026

### NX Mobile

- Foto Plex recuperata ovunque: Coil condivide il client HTTP session-authenticated, URL relativi risolti contro il server, fallback iniziali in caso di fallimento (badge, rail, picker, scheda, barra TV).
- Sfondo pagina unico (#0F142F, tono della barra logo) su tutti gli schermi ritratto/paesaggio, barre di sistema e avvio — addio sfondi neri.

## v1.24.118 — Settembre 2026

### NX Mobile

- Hero dispiegato compatto: logo ridotto, sinossi solo sulla scheda — Leggi / Più info sempre visibili (misurato compressi a 12px su emulatore).

## v1.24.117 — Settembre 2026

### NX Mobile

- Paesaggio premium ovunque: rail touch anche su scheda titolo/attore e "Tutto vedere", immersivo esteso, hero scheda ridotto, margini compatti (Scopri, Catalogo, Libreria, Profilo, Impostazioni, Scheda, Attore, Griglia), griglia "Tutto vedere" 3 colonne, ricerca touch.

## v1.24.116 — Settembre 2026

### NX Mobile

- Vero zero-overflow: lo spazio tra la 3a e la 4a scheda (e 4a/5a piattaforma) è incluso nell'aggiustamento — misurato al pixel tramite bounds (Horimiya in [1053,1080]).

## v1.24.115 — Settembre 2026

### NX Mobile

- Zero bordo 4a scheda: margine di sicurezza di 4dp nell'aggiustamento esatto (arrotondamenti Dp→px misurati su emulatore).
- Hero dispiegato: sinossi 1 riga per lasciare visibili Leggi / Più info su paesaggio basso.

## v1.24.114 — Settembre 2026

### NX Mobile

- Anti-"MO": nome utente in fallback ovunque (saluto, avatar header, rail dispiegato) quando nessun profilo è attivo; l'avatar porta al selettore in questo caso.
- File di 3 griglie pieno esatto (aritmetica Dp flottante sul viewport reale): addio bordo 4a scheda; anche le didascalie in dispiegato.
- Dispiegato: immersivo (fuori TV reale), rail slim senza scroll, ricerca touch, copertine del pannello tramite la libreria, margini compatti su Scopri/Libreria/Catalogo/Profilo/Impostazioni, hero compatto.
- Barra inferiore: "Download" completo (peso 1.3); anche la pastiglia MAJ nella barra espansa.

## v1.24.113 — Settembre 2026

### NX Mobile

- Profilo stile schizzo 08: foto cerchiata viola elettrico, nome + ruolo reale (Account admin / Account utente), ingranaggio Impostazioni, statistiche 2×2 (Film visti / Serie visti / Nella mia lista / Voti assegnati), menu La mia attività / Le mie raccomandazioni / Impostazioni / Cambia profilo / Disconnettiti alle destinazioni reali.
- Modalità espansa (paesaggio ≥ 700dp): barra laterale sinistra persistente + pannello laterale In corso / Terminati sulla home, stessi contorni elettrici. Ritratto e TV invariati.
- Barra inferiore: etichette in 9.sp, "Download" non è più troncato.

## v1.24.112 — Settembre 2026

### NX Mobile

- Barra inferiore schizzo 01: 4 schede solo (Home/Scopri/Libreria/Download) con icona + etichetta sempre visibili, attivo in pastiglia sfumata.
- Pastiglia aggiornata spostata nell'intestazione a sinistra dell'avatar (visibile solo se disponibile), anello viola elettrico con alone che respira + hitbox 44dp.
- Immersivo tipo videogioco sulla home in ritratto: pulsanti sistema Android nascosti, ritorno temporaneo allo swipe del bordo.

## v1.24.111 — Settembre 2026

### NX Mobile

- Bordo elettrico sfumato (blu `#3D7BFF` → viola `#8B2FFF` → magenta `#BC3FFF`) su schede Piattaforme, film/serie e ricerca — addio piatto.
- Piattaforme: 4 icone a schermo intero adattate al viewport (addio la 5a tagliata), swipe mantenuto per il resto.
- File/serie: aggiustamento esatto di 3 schede a schermo intero su tutti gli schermi ampi (plafond 120dp rimosso, lasciava fuori un pezzo di 4a).

## v1.24.110 — Settembre 2026

### NX Mobile

- Home in ritratto: 3 schede a schermo intero per riga come lo schizzo 01 (larghezza calcolata `(viewport-32-20)/3`, limitata 92–120dp, scheda "Vedi altro" allineata) invece di 2,5 con la 3a tagliata.
- Viola elettrico solo NX Mobile: Brand `#7C3AED` → `#8B2FFF`, Brand2 `#C04BFF` → `#BC3FFF`, Glow `#A06BFF` → `#A66BFF`. Web e altri 3 moduli invariati.
- Barra di ricerca in ritratto: filetto elettrico sottile `1.dp a 22%` come il bordo del dock e la pillola dello schizzo 01.

## v1.24.109 — Settembre 2026

### Android TV NX

- Correggi un crash sistematico scorrendo nelle righe della home (e di diversi altri schermi: scheda titolo, ricerca, catalogo, download, scheda artista, selettore profilo, lettore): `NoSuchMethodError` su `LazyLayoutPrefetchState.schedulePrefetch`, incompatibilità binaria tra `androidx.tv:tv-foundation` e la versione di `compose.foundation` risolta dal progetto. Stesso bug già corretto lato NX Mobile (precaricamento disattivato tramite riflessione, nessun comportamento visibile interessato) — mai riportato su NX TV finora. Applicato ai 14 `TvLazyRow`/`TvLazyColumn`/`TvLazyVerticalGrid` del modulo.

## v1.24.108 — Settembre 2026

### Continuare a guardare

- Un episodio o un film terminato (anche durante i titoli di coda) non rimane più visualizzato in "Continuare a guardare"/"Riprendi" — su desktop, Android TV e Android mobile contemporaneamente, poiché tutti e 3 si basano sullo stesso punto server (`listOnDeckEntries`). Stessa regola di soglia "vicino alla fine" (5 min rimanenti per un film, 2 min per un episodio, 10 % per un media breve — quella già utilizzata dal lettore per marcare una visione come terminata) applicata uniformemente al progresso tracciato da Movviz E al on-deck grezzo di Plex, non solo a una delle due fonti. Effettivo immediatamente sui titoli già "bloccati", senza pulizia manuale.

## v1.24.107 — Settembre 2026

### NX Mobile

- Corregge leek anteprime video che mostrano occasionalmente un film completamente diverso (es. Demon Slayer che mostra un trailer girato dal vivo senza relazione): l'anteprima ambientale privilegiava erroneamente le fonti "arricchite" (Apple/Netflix/Disney+/Prime Video/IMDb), che corrispondono per somiglianza di titolo e possono confondere un omonimo, invece dei video TMDb direttamente collegati all'identificatore corretto. TMDb (identità affidabile) è ora tentato per primo; le fonti arricchite prendono il sopravvento solo se questo video non parte effettivamente dopo pochi secondi, per non lasciare mai l'anteprima bloccata per mancanza di lettura.

## v1.24.106 — Settembre 2026

### NX Mobile

- Scheda media ritratto: hero (sfondo/anteprima video) ingrandito (300dp → 460dp) e sfumatura scurissante spostata verso l'ultimo terzo invece che dalla metà — l'immagine/video rimaneva visibile per troppo poco tempo prima di essere mascherato dallo sfondo, rendendo la scheda poco immersiva.

## v1.24.105 — Settembre 2026

### NX Mobile

- Corregge l'icona troncata in alto sullo schermo "Aggiungi un profilo" (accesso): l'alone multicolore del marchio superava il suo riquadro e veniva tagliato dal viewport dello scroll, per mancanza di margine sopra il primo elemento.

## v1.24.104 — Settembre 2026

### NX Mobile

- Icone piattaforme della home: rimuove lo sfondo bianco dietro ogni logo (le icone TMDb sono già icone quadrate a colori, lo sfondo bianco era superfluo).
- Bordo sfumato viola permanente (conforme al mockup) attorno alle icone delle piattaforme e ai poster film/serie in ritratto — il bordo di focus TV bianco rimane invariato in paesaggio/TV.

## v1.24.103 — Settembre 2026

### NX Mobile

- Barra "Piattaforme" della home: icone quadrate uniformi (come richiesto) invece dei puntini arrotondati a larghezza variabile ereditati da Scopri/TV.

## v1.24.102 — Settembre 2026

### NX Mobile

- Ripristina la commutazione Suggerimenti/Libreria in Scopri > Film/Serie (ritratto) — scomparsa per errore con il vecchio selettore a 3 vie, dava accesso al catalogo completo posseduto (2439 film per l'utente), senza di essa il catalogo era irraggiungibile con un tocco diretto.

## v1.24.101 — Settembre 2026

### NX Mobile

- Corregge le piastrelle "Piattaforme" della home: inerti (nessuna azione al tocco) e tutte di larghezza uniforme invece di adattarsi al loro logo, come nello schizzo.
- Sposta "Secondo il tuo umore" in alto in Scopri, subito sotto i generi, invece che in fondo.
- Ridisegna la schermata "Vedi tutto" (Piattaforme/generi/umore/sezioni editoriali) in ritratto: non aveva né intestazione né pulsante indietro (pagina bloccata dopo un tocco), griglia a 2 schede sovradimensionate per riga — sostituita con l'intestazione standard (marchio + avatar) e una griglia a 4 colonne coerente con il resto dell'app. Stesso correttivo per la scheda attore (Distribuzione).
- Corregge il contenuto nascosto sotto la barra fluttuante inferiore in fondo a Scopri, Libreria, Download e Ricerca.

## v1.24.100 — Settembre 2026

### NX Mobile

- Riprogettazione completa del ritratto smartphone secondo il mockup UX fornito: barra inferiore ridotta a Home/Scopri/Libreria/Download (icone sole), Profilo e Ricerca ora accessibili tramite l'avatar e il campo di ricerca dell'intestazione anziché schede dedicate.
- Home: barra "Piattaforme", sezioni "Riprendi i tuoi film"/"Riprendi le tue serie" distinte, nessun banner hero in ritratto (non previsto dal mockup).
- Scoperta: selettore Film/Serie in formato widescreen con sfumatura del marchio, riga "Riprendi un film/una serie".
- Libreria: diventa un vero punto di accesso Watchlist/Cronologia/Collezioni (invece di un alias del catalogo Film/Serie), watchlist e cronologia reali, collezioni utente + saghe TMDb possedute.
- Download: schede "In corso"/"Completate" con contatori reali, tempo rimanente e velocità visualizzati, più pulsante Aggiorna.
- Scheda media: pulsante indietro e toggle watchlist fluttuanti sulla barra, watchlist realmente bidirezionale (aggiunta/rimozione dal server).
- Ricerca: chip "Attori" (ricerca persona reale), ricerche recenti di sessione, sezione Risultati con accesso ai filtri.
- Aggiornamento dinamico della barra inferiore mantenuto (5a icona, appare/scompare in base alla disponibilità).

## v1.24.99 — Settembre 2026

### NX Mobile

- Riprogettazione dell'onboarding al primo avvio secondo il mockup: server, account (+ Plex), profili, sincronizzazione, home. I lanci successivi partono da "Chi guarda?", e l'aggiunta di un profilo passa attraverso lo schermo di accesso prima di tornare ai profili.
- Navigazione inferiore in verticale allineata al mockup: Scoperta / Film / Serie / La mia lista / Profilo, con "Raccomandato per te" e "Piattaforme di streaming".
- Versione unica: le 4 APK leggono ora `package.json` (versione desktop) invece di un valore fisso — più disincronizzazione impossibile.

### Build

- Allineamento Gradle: Gradle 8.13, AGP 8.13.2, Kotlin 2.2.21, Compose BOM 2025.08.01, Media3 1.7.1, Navigation 2.9.3 sui 4 moduli Android + CI.

## v1.24.98 — Settembre 2026

### Correzioni

- Corregge la compilazione NX Mobile rotta dalla fusione v1.24.97: `Border(...)` con argomenti posizionali invece che nominativi in `DiscoverHubScreen.kt`/`LibraryHubScreen.kt`, e una doppia dichiarazione di `SearchTypeFilter` in `SearchScreen.kt` (due schermi distinti avevano definito ciascuno la propria enumerazione con lo stesso nome) — rinominata `PortraitSearchTypeFilter` per lo schermo di ricerca in verticale.

## v1.24.97 — Settembre 2026

### Scoperta (web)

- Riprogettazione del blocco Scoperta desktop secondo lo schizzo: hero con 3 azioni reali (Guarda ora / La mia lista / Trailer), sezione "Le tue piattaforme di streaming" riportata subito sotto l'hero con i veri colori del marchio, badge piattaforma sulle schede delle righe che appartengono già realmente a una piattaforma.

### NX Mobile

- Allineamento della navigazione mobile e del login tramite Plex OAuth.
- Icone di lancio reali per densità (mdpi a xxxhdpi) sulle 4 app Android, sostituendo le icone adattive XML.

## v1.24.96 — Settembre 2026

### Correzioni

- NX Mobile in verticale, schermo Scoperta: i punti "Secondo il tuo umore" erano troppo piccoli per essere toccati comodamente (rilevato in test reale) — target tattile ingrandito a 44dp minimo.
- Le righe Generi/Piattaforme/Studi/Secondo il tuo umore utilizzavano un margine fisso di 52dp ereditato dalla TV invece dei 16dp del resto del contenuto in verticale — stessa correzione della riga Distribuzione della scheda titolo (v1.24.95), ora seguono lo stesso margine.

## v1.24.95 — Settembre 2026

### Correzioni

- Corregge l'allineamento della riga "Distribuzione" sulla scheda titolo NX Mobile portrait: utilizzava un margine fisso di 48dp invece dei 16dp del resto della scheda (titolo, pulsanti, Titoli simili), il che la spostava visibilmente verso destra.

## v1.24.94 — Settembre 2026

### Correzioni

- Corregge la compilazione NX Mobile interrotta dal redesign v1.24.93 (parametri errati su `Border(...)` e un overload `Modifier.padding()` inesistente) — nessun APK è stato in grado di essere generato per v1.24.93.

## v1.24.93 — Settembre 2026

### NX Mobile

- Riprogettazione strutturale completa del portrait telefono (non solo colori): intestazione persistente con barra di ricerca sempre visibile (il vecchio portrait non mostrava intestazione), pillole segmentate Scoperta/Film/Serie, filtri reali Generi/Umore/Durata/Piattaforme, carta eroe con angoli arrotondati con badge di valutazione e doppio pulsante Vedi/Anteprima, chip "Secondo il tuo umore" in pastiglie sottili, schermo Ricerca ricostruito (barra persistente, pillole di tipo, Suggerimenti, Tendenze del momento, risultati in lista).
- Navigazione inferiore a 5 schede e badge di aggiornamento invariati.

## v1.24.92 — Settembre 2026

### NX Mobile

- Riprogettazione visiva dell'app NX Mobile: palette allineata al resto di Movviz (viola/void/abyss), chip attivi in gradiente di marca sui filtri e selettore di contenuto, dock di navigazione più scuro.
- Nuova sezione "Secondo il tuo umore" su Scoperta: accesso rapido ai generi per atmosfera (avventura, relax, brividi, emozione, risata, ispirazione). Navigazione a 5 schede e badge di aggiornamento invariati.

## v1.24.91 — Settembre 2026

### Correzioni

- Corregge "Sessioni attive": la riproduzione di un episodio locale non apriva mai una sessione di tracciamento (dipendeva solo dalla durata Plex), quindi non appariva mai nel pannello — indipendentemente dal dispositivo o dall'app (mobile, NX Mobile, TV, NX TV).
- Il logo dello splashscreen si caricava troppo tardi (dopo l'idratazione JS); ora è precaricato fin dall'HTML iniziale.
- Ritocca il dock di navigazione portrait di NX Mobile: l'indicatore di aggiornamento non spinge più la barra verso l'alto e non è più un piatto opaco.

## v1.24.90 — Settembre 2026

### Identità visiva

- Nuovo mark Movviz (nastro incrociato rosa/viola) su tutta la piattaforma, a partire dai file ufficiali: sidebar web, favicon/PWA, icone adattive Android (mobile, NX Mobile, TV, NX TV), banner Android TV, icona Windows e icona Docker.
- Nuovi splashscreen desktop e Android NX con il lockup completo (mark + "Movviz"), caricati con priorità.

## v1.24.89 — Settembre 2026

### NX Mobile e NX TV

- Una scheda aperta da Riprendi risolve ora con priorità l'elemento della libreria locale prima di mostrare le sue azioni. Un file già indicizzato non propone più mai "Aggiungi alla libreria" durante il caricamento; Plex rimane opzionale.

## v1.24.88 — Settembre 2026

### NX Mobile e NX TV

- Separa esplicitamente le schede di ripresa degli episodi aggiunti di recente: solo le prime possono mostrare "Riprendi", una progressione e una miniatura di ripresa; gli episodi recenti mostrano solo il loro badge `Sxx · Exx`.
- Ricostruisce il dock portrait di NX Mobile: fluttuante, centrato, compatto, con espansione e dissolvenza fluide della scheda attiva; il contenuto riserva ora lo spazio necessario sotto l'ultima riga.

## v1.24.87 — Settembre 2026

### NX Mobile e NX TV

- Correggono la transizione all'episodio successivo: il nuovo media viene effettivamente caricato, l'episodio saltato viene chiuso e non rimane in Riprendi.
- Uscendo da un lettore o passando l'app in background, l'audio si interrompe e la posizione viene mantenuta. Le sigle e le finiture non creano più riprese.
- Le riprese degli episodi mostrano ora l'immagine dell'episodio, il logo della serie e il badge `S03 · E10`; i film mantengono la loro copertina.
- Rivede la navigazione in modalità ritratto di NX Mobile: capsule con icone esplicite, etichetta solo sulla scheda attiva, Disponibile Scoperta, nome del profilo attivo e scorciatoia discreta per l'aggiornamento.

## v1.24.86 — Settembre 2026

### NX Mobile e NX TV

- Aggiunge la pagina Download dedicata, alimentata in tempo reale dalla coda del server.
- Rende la barra di riproduzione veramente tattile: toccare una traccia cerca immediatamente alla posizione selezionata.
- Le schede mantengono il loro stato di download attivo e poi passano a Riproduzione non appena il media è disponibile.

## v1.24.85 — Settembre 2026

### Movviz NX Mobile

- Adatta l'interfaccia smartphone in modalità ritratto senza modificare il rendering TV/paesaggio: barra compatta con menu di azioni, home più densa, catalogo leggibile, schede ed episodi ridimensionati.
- Corregga testi e margini dei profili, del selettore profilo, della connessione Plex e delle impostazioni su schermi piccoli.
- Allinea i quattro canali Android e il pacchetto web sulla stessa release.

## v1.24.84 — Settembre 2026

### NX Mobile — azioni tattili in primo piano

Ripara le azioni sovrapposte di NX Mobile: le schede Home/Serie/Film/Profilo, ricerca, impostazioni, cambio profilo e segnale di aggiornamento catturano ora esplicitamente il tocco oltre al D-pad. I controlli di riproduzione mantengono lo stesso trattamento tattile.

## v1.24.83 — Settembre 2026

### Movviz NX Mobile — porta diretto di NX TV

Sostituisce il primo modulo NX Mobile con il codice `android-tv-nx`: stesso avvio local-first, cache isolata per server/account/profilo, profili Plex, home NX, hub Film/Serie, schede, pagine stagione/episodi, lettore, aggiornamento e protezioni D-pad. Il porta tattile mantiene questi comportamenti invece di riprendere la vecchia app mobile.

Il pacchetto rimane `com.movviz.nx.mobile`, l'asset di aggiornamento rimane `Movviz-NX-Mobile-client.apk` e la firma retail è invariata. L'attività è ridimensionabile su telefono, tablet e Fold; la barra NX diventa scorrevole al tocco su schermo compatto mantenendo tutti i suoi accessi. Il logo M è applicato all'avvio e alla navigazione.

## v1.24.82 — Settembre 2026

### Movviz NX Mobile — nuovo canale indipendente

Aggiunge `Movviz NX Mobile` (`com.movviz.nx.mobile`): un'applicazione Android tattile indipendente da Movviz Mobile e NX TV, firmata con la stessa chiave retail. Mantiene i profili, le riprese, il lettore, l'home e l'aggiornamento automatico di Movviz mantenendo i propri dati e il proprio asset di release (`Movviz-NX-Mobile-client.apk`).

L'interfaccia si adatta a telefoni, tablet e dispositivi pieghevoli: attività ridimensionabile, selettore profili a 2/3/4 colonne in base alla larghezza, griglia libreria adattiva e moduli centrati su grandi schermi. L'icona NX è utilizzata come icona Android.

## v1.24.81 — Settembre 2026

### Movviz NX — schermata iniziale locale-first finalizzata

La schermata iniziale NX pubblica ora uno snapshot unico per onda P0/P1: il contenuto locale viene visualizzato immediatamente, e poi i dati del server sostituiscono l'intero set in modo coerente senza cascata di ricomposizioni né salto di focus. Il rendering del primo viewport è confermato prima dell'avvio del lavoro secondario; la coda di download, i suggerimenti e i metadati remoti rimangono in background.

In assenza di cache, la schermata di preparazione mostra un progresso legato ai passaggi effettivamente attraversati. In caso di server non disponibile, l'ultima schermata iniziale valida dello stesso server, account e profilo rimane utilizzabile con un'indicazione discreta offline, senza ripetere inutili richieste di fallback. Il precaricamento è limitato ai poster vicini e al singolo sfondo focalizzato; Coil impiega esplicitamente il suo caricatore condiviso.

## v1.24.80 — Settembre 2026

### Correzione rilascio retail Android

Ripara il controllo dell'impronta della chiave retail nei flussi di lavoro Android. I build TV, NX e mobile rifiutano ancora qualsiasi chiave diversa, ma ora leggono correttamente l'impronta restituita da `keytool`. La versione `1.24.80` (`124080`) sostituisce il rilascio v1.24.79 la cui CI era stata interrotta prima della pubblicazione dell'APK.

## v1.24.79 — Settembre 2026

### Movviz NX — avvio locale-first e rilascio retail sicuro

La schermata iniziale NX ripristina ora istantaneamente l'ultimo stato locale, strettamente isolato per server, account e profilo, e poi riconcilia in background la libreria, le riprese e i suggerimenti. La scelta di un profilo già noto non è più bloccata dalla latenza di rete; la sessione viene comunque rivalidata in background e una sessione non valida reindirizza al login.

La coda di download inizia solo dopo il primo viewport ed è annullata ad ogni cambio di profilo. I log `TV-PERF` consentono di misurare i passaggi di avvio reali.

La CI Android richiede ora la chiave retail Movviz e ne verifica l'impronta: fallisce invece di pubblicare un APK firmato con una chiave temporanea. I tre APK condividono lo stesso `versionCode` derivato dal tag (`124079`), il che ripara il percorso di aggiornamento automatico.

## v1.24.78 — Settembre 2026

### Canali Google TV — Movviz TV e Movviz NX

Le app Android TV pubblicano ora il loro canale Movviz e la loro riga sistema "Continua a guardare" sulla schermata iniziale di Google TV. La dipendenza ufficiale AndroidX TV Provider è condivisa da Movviz TV e Movviz NX affinché entrambi i canali rimangano coerenti.

## v1.24.77 — Settembre 2026

### Movviz NX — La schermata iniziale non blocca più il telecomando

Dalla schermata iniziale, premere giù dalla barra di navigazione poteva rimanere senza effetto finché la dashboard non aveva finito di caricare, costringendo a passare da Film o Serie per scendere. Il target di focus esiste ora fin dalla prima immagine visualizzata, anche prima dell'arrivo dei dati.

## v1.24.76 — Settembre 2026

### Movviz NX — Film e Serie diventano veri hub

Ogni universo Film e Serie ha ora il proprio hub con un interruttore Suggerimenti/Libreria compatto, senza più mescolare mai le due intenzioni né i due cataloghi. La schermata iniziale si arricchisce delle stesse righe editoriali di Film/Serie, comprese novità e suggerimenti per piattaforma, in un flusso che mescola film e serie come un vero schermo di streaming. Corregge anche un vero difetto di focus che poteva saltare arbitrariamente passando alla Libreria.

## v1.24.75 — Settembre 2026

### Scoperta — piattaforme leggibili e classificazione affinata

I loghi delle piattaforme e degli studi di Scoperta (Film/Serie) sono ora sempre visibili, inclusi Disney+ e Canal+ che erano illeggibili su sfondo scuro — ogni logo poggia ora su un badge chiaro, come sul sito. La classificazione delle righe "Suggerimento {piattaforma} per te" è affinata: i pochi titoli in testa beneficiano ora di un'analisi del tono dedicata piuttosto che dipendere solo da un'analisi già in cache, per un ordinamento più fedele ai gusti reali di ogni profilo.

## v1.24.74 — Settembre 2026

### Scoperta — novità e suggerimenti per piattaforma, separati

Ogni piattaforma (Netflix, Disney+, Prime Video) in Scoperta mostra ora due righe distinte: "Novità {piattaforma} per te", strettamente ordinate per data di uscita, e "Suggerimento {piattaforma} per te", ordinato solo in base ai tuoi gusti (generi, storico, voti) senza tenere conto della data di uscita. Il "Vedi tutto" di queste due righe scorre fino a quanto lo permette il catalogo reale della piattaforma. Movviz NX riceve lo stesso layout sul proprio schermo Scoperta.

## v1.24.73 — Settembre 2026

### Movviz NX — stagioni ed episodi navigabili

La pagina dedicata a una stagione utilizza ora un elenco realmente scorrevole con il D-pad: anche una stagione lunga mantiene tutti gli episodi accessibili, senza che le righe cambino dimensione al focus. L'area superiore è posizionata sotto la barra di navigazione, ogni episodio conserva una miniatura (con ripiegamento visivo se TMDb non ne fornisce) e la spunta "visto" rimane riservata a destra. Le fonti Movviz e Plex seguono finalmente la stessa regola per visualizzare l'azione di riproduzione di un episodio. I suggerimenti per piattaforma mantengono una cache separata per profilo, tipo e paese di scoperta.

## v1.24.72 — Settembre 2026

### Scoperta — novità Netflix, Disney+ e Prime Video per te

Scoperta (Film e Serie) mostra ora "Novità Netflix per te", "Novità Disney+ per te" e "Novità Prime Video per te": i cataloghi di queste piattaforme sono proposti ordinati in base ai tuoi gusti (affinità di genere, storico, voti) piuttosto che per semplice popolarità generica — due account vedono lo stesso catalogo Netflix, ma in un ordine diverso. Il "Vedi tutto" e la paginazione mantengono questo ordinamento personale. Le icone delle piattaforme in fondo a Scoperta rimangono invariate. Movviz NX riceve lo stesso arricchimento sul proprio schermo Scoperta, con le righe di logo Piattaforme e Studi in fondo allo schermo.

## v1.24.71 — Settembre 2026

### Movviz NX — stagioni a schermo intero

Selezionare una stagione su una scheda serie NX apre ora uno schermo dedicato, anziché espandere un elenco di episodi nel mezzo della scheda: la scheda serie rimane un sommario chiaro, e l'elenco episodi sfrutta tutto lo spazio con un semplice percorso D-pad, il tasto indietro chiude esattamente questo livello prima di lasciare la scheda. Le righe episodi mantengono ora una geometria fissa (miniatura, titolo, spunta "visto") in modo che il focus non ne cambi mai il layout.

## v1.24.70 — Settembre 2026

### Movviz NX — anteprime realmente disponibili

Le anteprime video sono di nuovo consentite su Android TV ed emulatori con meno di 2 GB di memoria totale, purché la memoria libera sia sicura. Le schede utilizzano lo stesso pipeline di anteprima delle carte, la lente di navigazione è ridisegnata, il badge "Riprendi" non ingombra più i poster e ogni scheda distribuzione riceve un basamento di testo opaco per rimanere leggibile su ritratti chiari.

## v1.24.69 — Settembre 2026

### Movviz NX — rifinitura navigazione e profilo

La navigazione Android TV NX acquisisce icone coerenti, stati di focus più leggibili e una ricerca direttamente inseribile con il D-pad. Le schede tornano a un punto focale visibile, i titoli degli episodi rimangono leggibili, e la dashboard profilo recupera i poster mancanti dalla media libreria o dai metadati per evitare carte vuote.

## v1.24.68 — Settembre 2026

### Movviz NX — ricerca e aggiornamenti accessibili

La navigazione NX mostra ora Impostazioni, con l'attivazione della ricerca automatica e la verifica forzata degli aggiornamenti. Quando viene rilevato un rilascio, appare una freccia di aggiornamento nella barra e scatena l'installazione su conferma. La ricerca mostra e focalizza nuovamente il campo di inserimento all'apertura.

## v1.24.67 — Settembre 2026

### Movviz NX — scelta focus all'avvio

Il selettore dei profili viene ora visualizzato sistematicamente all'avvio quando è disponibile almeno un profilo sul server, indipendentemente dal ruolo dell'ultimo account attivo. Il rilevamento degli aggiornamenti rimane automatico; dopo la prima autorizzazione Android per installare app sconosciute, l'installazione può continuare senza intervento.

## v1.24.66 — Settembre 2026

### Movviz NX — profilo Plex ed episodi recenti

L'avatar Plex del profilo attivo viene ora visualizzato nella pastiglia superiore e apre il selettore dei profili. La schermata iniziale NX aggiunge una riga di episodi effettivamente aggiunti, indipendente dalle riprese, strettamente ordinata dal più recente a sinistra al più vecchio. La dashboard del profilo riserva anche un'area sicura sotto la navigazione e utilizza schede poster leggibili a distanza.

## v1.24.65 — Settembre 2026

### Movviz NX — rilascio Android TV e canale autonomo

Movviz NX riceve il suo APK retail dedicato, firmato con la stessa chiave di Movviz TV ma pubblicato sotto un asset GitHub distinto. Il suo segnale di aggiornamento e la sua installazione automatica non possono quindi mai sostituire Movviz TV. L'intestazione NX segue ora il comportamento di Netflix: rimane trasparente nella parte superiore dell'hero e si vela solo quando le righe passano sotto la navigazione, senza modificare i percorsi D-pad. Anche le identità sono separate: icona circolare per l'applicazione, marchio "M" nell'interfaccia.

## v1.24.64 — Settembre 2026

### Libreria mobile Film e Serie come Plex

Ogni scheda Film o Serie TV dispone ora di tre viste distinte: **Raccomandato**, con le riprese seguite da righe di poster; **Sfoglia**, una griglia locale densa con ricerca, ordinamento e generi; e **Collezioni**, righe per universi della libreria. Gli episodi aggiunti di recente appaiono in Raccomandato delle Serie con il loro poster, la loro serie e `Sxx · Exx`.

## v1.24.63 — Settembre 2026

### Home mobile incentrato sulle riprese

La grande scheda "In primo piano" è stata rimossa dalla schermata iniziale dello smartphone. Le riprese rimangono la prima riga dopo l'intestazione, seguite dagli episodi aggiunti di recente, poi la libreria e le scoperte. Aggiungere una riga non può più spostare né sostituire "Riprendi".

## v1.24.62 — Settembre 2026

### Episodi aggiunti di recente sulla schermata iniziale mobile

La schermata iniziale dello smartphone mostra ora una riga dedicata agli episodi effettivamente arrivati per ultimi nella libreria, che provengono da un import Plex o da Movviz. Ogni scheda conserva la serie, il titolo dell'episodio e il suo riferimento `Sxx · Exx`, e apre direttamente la scheda della serie. Questa riga è distinta dalle riprese e dalle viste: descrive i file disponibili, senza esporre la cronologia di un altro profilo.

## v1.24.61 — Settembre 2026

### Viste Plex strettamente isolate per profilo

La sincronizzazione delle viste Plex risolve ora sistematicamente il profilo Plex collegato tramite API al suo account locale del server Plex prima di leggere la cronologia. In caso di dubbio, l'import viene rifiutato: nessuna vista di un altro profilo può essere aggiunta o eliminata. L'apertura di Movviz scatena anche una sincronizzazione fresca, limitata per profilo, invece di attendere il ciclo di sfondo. I marchi effettuati in Movviz continuano ad essere inviati solo a questo stesso profilo Plex.

## v1.24.60 — Settembre 2026

### Home mobile personale e firma Movviz

La schermata iniziale mobile distingue ora chiaramente ciò che esiste già nella libreria del profilo e i titoli da scoprire: la prima riga mescola film e serie effettivamente disponibili, poi le raccomandazioni personali escludono le opere già possedute, viste o rifiutate. Un piccolo simbolo Movviz ancora la pagina, nello spirito della firma Plex, senza ridurre lo spazio dedicato ai contenuti.

## v1.24.59 — Settembre 2026

### Riprese mobile e riproduzione di serie riparate

La schermata Home ora carica la lista di ripresa unificata ad ogni accesso alla scheda e mantiene il mix film/serie, ordinato per data e ora dell'ultima visione. Discovery riutilizza questa stessa sorgente nelle sue schede separate Film e Serie. La riproduzione mobile recupera anche i vecchi episodi locali senza campo sorgente, senza deviare un episodio Plex verso la sorgente locale.

## v1.24.58 — Settembre 2026

### Visualizzazioni sincronizzate, episodio per episodio

Le azioni "visto / non visto" sono ora disponibili su Android mobile e Android TV a livello di film, episodio, stagione intera e serie intera. Scrivono il tracciamento unico del profilo Movviz e propagano la modifica a Plex quando è collegato un media Plex. Gli episodi futuri sono volontariamente esclusi: quando una stagione è terminata, solo il primo episodio disponibile della stagione successiva diventa la ripresa.

## v1.24.57 — Settembre 2026

### Home e aggiornamenti Android mobile

La home mobile riprende le fasce editoriali della TV (selezione personale, formati brevi, tendenze, aggiunte recenti e prossime uscite), sempre per profilo e con le riprese in primo piano. Una release rilevata è ora segnalata senza interruzioni da una pillola pulsante e un badge nella navigazione; l'installazione inizia solo dopo conferma.

## v1.24.56 — Settembre 2026

### APK Android mobile pubblicato

Il margine del titolo della fascia di ripresa utilizza ora il corretto override Compose; CI può finalizzare l'APK smartphone e associarlo alla release.

## v1.24.55 — Settembre 2026

### Correzione pubblicazione Android mobile

La compilazione Kotlin della home Android mobile è corretta; la versione release può nuovamente essere prodotta e pubblicata.

## v1.24.54 — Settembre 2026

### Home Android mobile unificata

Android mobile riceve una vera scheda Home: le riprese "Continuare a guardare" arrivano per prime, seguite da hero e le corsie della libreria. Questa fascia consuma esattamente il percorso unificato utente già utilizzato da web e Android TV; quindi la progressione, il prossimo episodio e l'ordine Plex/Movviz rimangono identici su tutte e tre le piattaforme.

## v1.24.53 — Settembre 2026

### Plex realmente aggiuntivo e cataloghi TV densi

Le riprese presenti in Plex non dipendono più da un link preliminare alla libreria Movviz: i loro identificativi TMDb e i loro visual sono risolti direttamente, quindi fusi con la ripresa Movviz per identità e data reale. Film, Serie e gli schermi "Vedi tutto" Android TV passano a una griglia fissa, densa e stabile a 1080p/4K, con controlli più compatti e senza ingrandimento al focus.

## v1.24.52 — Settembre 2026

### Riprese realmente unificate e home TV stabilizzata

Il percorso unico "Continuare a guardare" utilizza ora un orologio comune Movviz/Plex e ordina ogni ripresa in base alla sua vera data di visione. Plex può fornire immediatamente il primo episodio della stagione successiva senza attendere una sincronizzazione storica locale; viene mantenuta solo la prima sequenza proposta da Plex. Anche un reindicizzazione Plex di episodio è risolta per serie + stagione + episodio. Su Android TV, i poster rimangono fissi in verticale al focus, senza ritaglio panoramico né spostamento di fascia; le riprese mantengono la loro barra di progressione leggibile e la home rimane densa a 1080p/4K.

## v1.24.51 — Settembre 2026

### Android TV — riprese prioritarie e schede calibrate salotto

La fascia "Continuare a guardare" è sempre posizionata in cima non appena esiste una ripresa, anche se una vecchia disposizione del dashboard l'aveva nascosta. Le schede della home recuperano proporzioni adatte a uno schermo TV: la selezione si apre in panorama senza sostituire l'intera fascia. Le riprese completano ora il visual Plex con lo sfondo Movviz senza testo quando disponibile.

## v1.24.50 — Settembre 2026

### TV — logo ufficiale generalizzato e griglia di navigazione corretta

Il principio mostra il ritratto senza logo a riposo / il logo ufficiale posizionato separatamente al focus si estende ora a Scoperta, a titoli simili, alla filmografia di un attore, nonché al catalogo completo e alle griglie "vedi tutto" (dove la scheda rimane fissa in ritratto anziché aprirsi in panorama, una griglia verticale non può ingrandirsi senza spostare le vicine). Il testo del titolo scompare ovunque questo logo sia visualizzato; rimane in un ripiegamento discreto sulle griglie quando nessun logo TMDb è disponibile. Il caricamento dei loghi è protetto contro i duplicati di rete. La barra di navigazione laterale dispiegata allinea finalmente le sue schede su un bordo comune anziché fluttuare ad larghezze diverse.

## v1.24.49 — Settembre 2026

### TV — accesso diretto al profilo e tema della schermata iniziale raffinata

Su Android TV, il profilo è ora accessibile tramite un collegamento diretto dalla barra di navigazione, senza passare dalla schermata di selezione degli account. La schermata iniziale e il suo tema visivo sono stati rivisti per maggiore coerenza. Inoltre, le cerimonie di premiazione (Oscar, César, Golden Globes...) e i contenuti non fiction riproposti come "serie" dai cataloghi (notiziari, talk-show, reality) non vengono più mai proposti come suggerimenti, indipendentemente dalla loro fonte.

## v1.24.48 — Settembre 2026

### Riprendite Plex e Movviz unificate

La ripresa viene ora calcolata una sola volta, per utente, per web, profilo e Android TV. Plex rimane opzionale: le sue posizioni e la sua cronologia completano i dati Movviz senza mai sostituirli. Le visualizzazioni Plex vengono salvate con la loro data reale nella timeline comune, che ordina correttamente le riproduzioni Plex e Movviz. Per le serie, viene proposta solo la prima stagione non vista: dopo una stagione 4 terminata, appare la stagione 5 episodio 1; la stagione 6 attende il completamento totale della stagione 5. Fermare durante i titoli di coda marca anche immediatamente il media come visto e lo sincronizza con Plex quando è collegato.

## v1.24.47 — Settembre 2026

### Profili indipendenti su TV e mobile

I profili Android sono ora memorizzati solo sul dispositivo, per account Movviz e per server. Disinstallare non recupera più i profili di un altro dispositivo o casa, e la sessione Plex di un utente non può più sostituire quella di un altro.

## v1.24.46 — Settembre 2026

### Lista di visione episodi e Plex facoltativo

Aggiunta l'azione Lista di visione per episodio nei dettagli delle serie e salvaguardie aggiuntive: i compiti del server Plex vengono ignorati correttamente quando Plex non è configurato, senza disturbare il profilo multimediale locale.

## v1.24.45 — Settembre 2026

### Trasporto sincronizzazione utente

Le modifiche a Lista di visione e visualizzato espongono ora la loro capacità e l'orologio di trasporto, con risoluzione LWW e conservazione della cronologia in caso di passaggio a non visto.

## v1.24.44 — Settembre 2026

### Convergenza Plex di note e riprese

Le note locali vengono sincronizzate con Plex in background e la ripresa remota rispetta ora il timestamp LWW anziché privilegiare meccanicamente il valore più grande.

## v1.24.43 — Settembre 2026

### Profilo multimediale unificato e sincronizzazione Plex

Aggiunto il profilo multimediale condiviso, la risoluzione LWW per campo, la Lista di visione con episodi e tombstones, le API del profilo e il collegamento Android TV. Plex rimane facoltativo e non attiva alcuna acquisizione automatica.

## v1.24.42 — Settembre 2026

### Android TV — ripresa, sottotitoli, generi e aggiornamento controllato

Android TV ottiene una ripresa davvero dinamica con il ritorno del lettore (`Riprendi a HH:MM:SS`), sottotitoli disattivati di default con memorizzazione per profilo e media, la correzione del filtraggio delle categorie che confrontava erroneamente gli ID TMDb con i nomi dei generi, una pulizia completa dei dati personalizzati al cambio di profilo, un focus più vivace e una freccia di aggiornamento lampeggiante nella barra laterale. Gli aggiornamenti automatici non possono più avviarsi durante la navigazione o la riproduzione: solo la breve finestra di avvio consente l'auto-installazione; successivamente l'utente deve avviare esplicitamente l'installazione dall'indicatore.
### Versioni di pubblicazione allineate

La versione di riferimento è ora la stessa nel pacchetto web, nel lockfile, nel badge README e nelle configurazioni Gradle mobile e TV: `1.24.42` (`versionCode` `12442`). I build CI mantengono la derivazione dal tag di rilascio.

## v1.24.41 — Settembre 2026

### Pubblicazione Android corretta

I pipeline Android mobile e TV utilizzano ora la versione corrente dello strumento di preparazione del SDK, che installa direttamente Android 35 e i build-tools 35.0.0. La generazione degli APK di pubblicazione funziona di nuovo.

## v1.24.38 — Settembre 2026

### Addio documentari e making-of nelle suggestioni

TMDb mescola regolarmente documentari e making-of in `/recommendations`, `/similar` e persino nella filmografia di un attore preferito — il chatbot IA li escludeva già, ma non "Suggerimenti per te" né "Perché hai guardato", che li proponevano ancora nonostante ripetuti 👎 su questo genere. L'affinità di genere non esclude mai un intero genere (attutisce solo il suo punteggio), quindi non era sufficiente. Il genere Documentario è ora una regola ferrea, applicata nel filtro condiviso da tutte le fasce di suggerimenti: priorità al film e alla serie, nessun documentario si infila più. La ricerca manuale non è interessata — un documentario cercato esplicitamente rimane reperibile.

## v1.24.37 — Settembre 2026

### L'affinità per attore/regista guida finalmente la vera fascia "Suggerimenti per te"

L'affinità per attore/regista aggiunta in v1.24.36 alimentava solo la conversazione con l'IA, non la fascia "Suggerimenti per te" stessa — votare cinque stelle a due film di Jim Carrey, o semplicemente guardarne diversi senza mai votare, non faceva apparire altro di lui nei suggerimenti. Ora guida anche questa fascia: la filmografia completa dei 3 attori/registi preferiti (calcolata in base ai voti, ai voti 👍/👎 E al semplice fatto di rivedere spesso lo stesso attore, senza voto esplicito) viene recuperata tramite TMDb e iniettata nel pool di candidati, promossa allo stesso livello dell'affinità di genere ≥95 % — un match diretto sull'attore passa addirittura davanti.

## v1.24.36 — Settembre 2026

### Nuova affinità per attore/regista — "amo Jim Carrey" conta finalmente per sé

L'affinità di genere calcolata (visualizzazioni, voti, voti, richieste) non collega mai un titolo votato ai SUOI INTERPRETI — votare due film di Jim Carrey 5/5 rafforzava solo il genere "Commedia" in generale, nulla avvicinava i suoi ALTRI film tra loro. Una nuova affinità per attore/regista, costruita a partire dai titoli esplicitamente votati o votati 👍/👎 (mai tutta la cronologia delle visualizzazioni, per rimanere veloci), completa il genere: "apprezza particolarmente Jim Carrey come attore" diventa un fatto che l'IA conosce direttamente e può riutilizzare per proporre i suoi altri film. Alimenta per ora la conversazione con l'IA (generazione di raccomandazioni e pulsante "Creare il contesto"), non ancora il puro ranking TMDb di "Suggerimenti per te".

## v1.24.35 — Settembre 2026

### "Suggerimenti per te" — serie esaurite troppo velocemente, e pollice in su ora dinamico anche

Il catalogo TMDb "raccomandazioni" per le serie è nettamente più povero di quello per i film — dopo alcuni 👎, la riga serie non aveva spesso più un sostituto da proporre (la scheda scompariva senza che nulla prendesse il suo posto), mentre la riga film non si esauriva mai allo stesso modo. Una seconda fonte TMDb ("simile", basata sul contenuto piuttosto che sulle abitudini degli altri utenti) completa ora la prima per entrambi i tipi. Un pollice in su ricalcola anche la riga ora, come un pollice in giù — un voto può far risalire altri titoli.

## v1.24.34 — Settembre 2026

### Anno minimo dei caroselli — due cause distinte di titoli troppo vecchi

L'eroe della homepage selezionava un piccolo numero di candidati (circa 6) e poi filtrava per anno — quando una buona parte di questi candidati si trovava sotto l'anno minimo, completava volontariamente con i titoli esclusi piuttosto che mostrare un eroe incompleto, cosa che poteva mostrare diversi titoli precedenti al limite stabilito. Il pool di candidati è ora molto più ampio fin dall'inizio quando viene definito un anno minimo, in modo che il filtro abbia veri candidati recenti da mantenere senza mai aver bisogno di questo ricorso. La riga "Suggerimenti per te" delle pagine Film/Serie, invece, non consultava affatto questa impostazione — corretto anche questo.

## v1.24.33 — Settembre 2026

### L'IA mostrava un JSON grezzo invece di votare — e in realtà non votava nulla

Su una richiesta di voto in blocco ("metti 5 stelle a tutti i Dragon Ball"), l'assistente rispondeva a volte con un blocco JSON grezzo visualizzato così com'era nella conversazione, oltre a non registrare RIENNE realmente nonostante un tono fiducioso ("è stato annotato!"). Il modello utilizzava un formato non riconosciuto invece del marcatore atteso internamente — ora riconosciuto e applicato per davvero, con una conferma specifica al posto del JSON. I titoli menzionati in una conversazione prima di questo aggiornamento non sono stati votati: sarà necessario richiederlo all'IA per quelli.

## v1.24.32 — Settembre 2026

### Andare al Profilo riportava sempre a una ricerca — la vera causa questa volta

La correzione precedente (annullare una ricerca differita in attesa) risolveva un vero bug, ma non questo: il segnalamento persisteva anche dopo un ricaricamento completo dell'URL /profile, il che escludeva qualsiasi stato React. La vera causa: il gestore delle password del browser associa un campo "password corrente" a un campo "nome utente" vicino per proporre l'autocompletamento — il modulo di cambio password del profilo non ne ha nessuno nelle vicinanze, quindi il browser sceglieva l'unico altro campo di testo visibile sulla pagina: la ricerca globale (sempre visualizzata in alto), che compilava con l'username salvato e poi inviava. Un campo nome utente ora targetizza correttamente questo meccanismo, e la ricerca è esplicitamente esclusa dall'autocompletamento.

## v1.24.31 — Settembre 2026

### "Creare il contesto" (profilo) ignorava i voti e l'affinità di genere calcolata

Il pulsante "Creare/Rigenerare il contesto" del profilo sincronizzava già la libreria nel log SQL in background, ma il testo effettivamente inviato all'IA per sintetizzare il contesto non includeva né i voti da 1 a 5 stelle, né l'affinità di genere già calcolata (visualizzazioni, voti, voti, richieste) — solo i titoli visti, le richieste e i voti 👍/👎 grezzi. Entrambi mancano ora, sia per la ricostruzione manuale che per l'aggiornamento automatico in background (che ora si attiva anche su un nuovo voto, non solo su una visualizzazione/richiesta/voto).

## v1.24.30 — Settembre 2026

### Cliccare su Profilo riportava a una ricerca con l'username

Toccare la ricerca e cliccare immediatamente su "Profilo" apriva la scheda del profilo, ma era seguito ~300ms dopo da un ritorno silenzioso a `/discover?q=<pseudo>`: la ricerca (Topbar/Sidebar) non si disintegra mai tra due pagine (il chrome dell'app rimane montato, cambia solo il contenuto), quindi la ricerca differita programmata dal tocco precedente rimaneva attiva e finiva per eseguirsi dopo, sovrascrivendo la navigazione già effettuata. Tutte le ricerche differite in attesa vengono ora annullate non appena si completa una navigazione.

## v1.24.29 — Settembre 2026

### "Suggerimenti per te" consulta finalmente l'affinità di genere calcolata

Il motore dietro la riga "Suggerimenti per te" (candidati TMDb) non consultava ancora l'affinità di genere calcolata a partire dall'attività reale (visualizzazioni, voti, valutazioni, richieste) — solo la conversazione con l'IA ne beneficiava dall'ultimo aggiornamento. Un titolo la cui affinità di genere supera il 95 % (soglia volontariamente molto alta, solo una prova solida e confermata la supera) appare ora davanti al ranking TMDb piuttosto che semplicemente influenzarlo leggermente.

## v1.24.28 — Settembre 2026

### Motore di contesto — il ciclo visualizzazioni/valutazioni/voti/richieste ↔ suggerimenti si chiude

Il journal SQLite per utente (introdotto precedentemente) riceveva finora solo la lettura e le correzioni esplicite tramite l'IA — i voti 👍/👎, le valutazioni da 1 a 5 stelle, le richieste e gli aggiunte tramite l'IA continuavano a esistere solo in file JSON separati, senza mai raggiungere questo journal unificato, e nulla leggeva alcuna ricerca o apertura di scheda poiché nessuna delle due era catturata da nessuna parte. Tutte queste azioni scrivono ora anche nel journal unificato (oltre al loro storage esistente, senza rompere nulla), inclusi due segnali che non esistevano da nessuna parte prima: le ricerche e le aperture di scheda. Il motore di gusto per genere (già utilizzato per le risposte dell'IA) integra ora queste visualizzazioni come prova aggiuntiva, e pesa per la prima volta sul ranking reale dei suggerimenti inviati dall'IA — finora serviva solo a colorare il tono delle risposte, mai a scegliere cosa suggerire. Le richieste di download rimangono volontariamente un segnale debole e limitato (spesso richieste per altri, non per sé stessi); la cronologia già accumulata viene ripresa retroattivamente nel journal, nulla va perso. Sempre strettamente per account — mai un mescolamento tra profili, incluso il proprietario Plex.

## v1.24.27 — Settembre 2026

### "Scarsa raccomandazione" non escludeva il titolo dai suggerimenti, e non ricalcolava la riga

Il pulsante 👎 su una scheda "Suggerimenti per te" registrava correttamente il feedback, ma il motore dietro questa riga (recommender/engine.ts, distinto da quello usato dall'IA in conversazione) non consultava mai questo journal — lo stesso titolo poteva riapparire indefinitamente. Ora esclude qualsiasi titolo precedentemente votato 👎. La scheda scompare anche immediatamente dalla riga, ma la lista non veniva mai ricalcolata dietro: un semplice vuoto al suo posto, mai sostituito prima dell'scadenza della cache. La rimozione ora scatena una rivalidazione della riga, che fa scorrere dinamicamente un altro titolo al suo posto.

## v1.24.26 — Agosto 2026

### Android mobile — rifacimento stile TV, aggiunta con un tocco, aggiornamento automatico

Il client smartphone riprende gli stessi principi del recente rifacimento della versione TV. Il placeholder "La mia lista" (mai implementato) diventa una vera scheda Libreria: la libreria completa in griglia, ordinabile per nome/nota/anno e filtrabile per genere, con un selettore Film/Serie — Scopri rimane lo schermo per trovare contenuti da aggiungere. Il pulsante "Aggiungi" della scheda in primo piano di Home si limitava finora a riaprire la scheda del titolo (era necessario un secondo tocco lì per aggiungere realmente); ora aggiunge direttamente alla libreria con un tocco, come fa già ogni scheda di Scopri. La ricerca mostra ora lo stesso pulsante dinamico su ogni risultato, per aggiungere senza passare dalla scheda. Infine, il client mobile riceve lo stesso meccanismo di aggiornamento automatico della TV (verifica all'avvio rispetto all'ultima release GitHub, download verificato tramite SHA-256, installazione in background con fallback sull'installer di sistema), regolabile e verificabile manualmente da Profilo.

## v1.24.25 — Agosto 2026

### Episodi senza data — più "Mancante" dopo un episodio già annunciato "In arrivo"

Un episodio senza data di trasmissione nota passava per "Mancante" (quindi cercato come se potesse già esistere), anche quando un episodio numerato prima di esso nella stessa stagione era ancora "In arrivo" con una data futura nota — cronologicamente impossibile, una serie non può aver trasmesso l'episodio 6 prima degli episodi 4/5. Ogni episodio non datato che segue, nella stessa stagione, eredita ora lo stesso stato "In arrivo" invece di mostrare un falso "Mancante".

## v1.24.24 — Agosto 2026

### Android TV — navigazione ripensata, Scopri separato dal catalogo, lettore ridisegnato

La barra di navigazione laterale (224dp fissi, sempre espansa) si riduce ora alle sole icone a riposo e si espande — rimanendo più stretta di prima — solo quando il D-pad si avvicina, per non occupare permanentemente lo spazio delle liste di film/serie. Ogni scheda ha ora la propria icona (Home, Scopri, Film, Serie mostravano solo testo). Il vecchio schermo Film/Serie (eroe + file di genere stile Netflix) diventa la scheda Scopri, con un selettore Film/Serie per non mescolare i due universi negli stessi file; le schede Film e Serie diventano la libreria completa in griglia, ordinabile per nome/nota/anno e filtrabile per genere. Nel lettore video (modalità finestra, fuori schermo intero), la barra di controllo era ancorata in fondo a un pannello limitato all'80% dell'altezza dello schermo, lasciando uno spazio vuoto sotto i controlli — il pannello è ingrandito al 92% per ridisegnarlo vicino al bordo reale.

## v1.24.23 — Agosto 2026

### Ricerca manuale — la cache non sostituisce più mai la ricerca live

Due correzioni precedenti (v1.24.21, v1.24.22) riducevano i casi in cui la cache locale era sufficiente a interrompere l'interrogazione degli indexatori, ma ogni salvaguardia aveva il suo punto cieco — l'ultima bloccava anche un risultato di cache pur essendo esatto. La ricerca manuale interroga ora sistematicamente tutti gli indexatori configurati ogni volta, e fonde questi risultati con quelli della cache invece di scegliere tra i due: nessuna configurazione di cache può più impedire che un indexatore venga interrogato per una ricerca che esegui tu stesso.

## v1.24.22 — Agosto 2026

### Ricerca interattiva — un singolo risultato in cache poteva anche interrompere la ricerca live

La correzione precedente copriva solo il caso di una stagione/episodio specifico. La ricerca testo libero ("Ricerca interattiva") poteva subire lo stesso problema senza che fosse colpa di alcuna penalità di stagione: la cache RSS contiene solo un'istantanea recente (~100-150 release tra tutti gli indexatori), quindi un singolo risultato che vi è presente per un titolo era sufficiente per impedire l'interrogazione completa degli indexatori, mentre alcuni ne avevano molto di più da offrire. Ora è necessario più di un risultato in cache per considerare la ricerca come già soddisfatta.

## v1.24.21 — Agosto 2026

### Ricerca manuale — una ricerca per stagione/episodio poteva ignorare un intero indexatore

Un rilascio in cache, di stagione sbagliata o di episodio sbagliato, poteva — grazie a bonus di qualità (risoluzione, seeders...) — superare appena la soglia minima nonostante il limite applicato alle corrispondenze errate. La sua sola presenza era sufficiente a far credere che la ricerca avesse già una risposta, annullando completamente l'interrogazione in diretta degli indicizzatori — nascondendo decine di risultati corretti disponibili altrove. Un risultato in cache penalizzato per stagione/episodio sbagliato non blocca più la ricerca in diretta.

## v1.24.20 — Agosto 2026

### Indicizzatori — pulsante per aggiornare le categorie

Impostazioni → Indicizzatori ora propone un pulsante dedicato per ricaricare l'elenco reale delle categorie di un indicizzatore direttamente dal pannello di selezione, senza passare dal pulsante "Test" generale.

## v1.24.19 — Agosto 2026

### Ricerca — una categoria personalizzata di indicizzatore (es. "Serie") poteva essere ignorata

Una categoria specifica di un indicizzatore (come "Serie" su C411, un identificativo fuori dalla numerazione standard Torznab), sebbene spuntata nelle sue impostazioni, non appariva mai nella ricerca "Serie" finché quell'indicizzatore aveva anche almeno una categoria standard spuntata. Il filtraggio non riconosce più solo le categorie esplicitamente di altro tipo (film vs serie) da escludere — una categoria personalizzata sconosciuta a Movviz rimane inclusa.

## v1.24.18 — Agosto 2026

### Ricerca manuale — diagnostica per indicizzatore

Un indicizzatore assente dai risultati di una ricerca manuale rimaneva invisibile non appena un altro indicizzatore trovava qualcosa — un singolo log aggregato nascondeva il dettaglio. Il log (Impostazioni → Log) mostra ora, per ogni ricerca diretta, il numero di risultati grezzi e poi filtrati per ogni indicizzatore individualmente.

## v1.24.17 — Agosto 2026

### Sincronizzazione Plex — diagnostica completa sulla scomparsa degli episodi visti

Il log (Impostazioni → Log) mostra ora, per ogni sincronizzazione, il numero grezzo di eventi "episodio" effettivamente ricevuti da Plex prima di qualsiasi filtraggio — prima, se Plex non ne inviava nessuno fin dall'inizio, nulla lo distingueva da un filtraggio silenzioso a valle. La prossima sincronizzazione dirà finalmente con precisione dove si trova il problema.

## v1.24.16 — Agosto 2026

### Android TV — navigazione e lettore unificati

La navigazione Android TV adotta una NavRail realmente riservata: nessun schermo né sfondo passa più sotto di essa, e l'Hero occupa tutta la larghezza utile dell'area contenuto. La schermata iniziale si basa sui listati TV nativi: il D-pad scorre riga dopo riga con lo scorrimento associato, e poi si unisce alla NavRail solo in cima.

Il lettore raggruppa tutti i comandi nel suo dock inferiore. Il progresso è raggiungibile con il D-pad e si regola con sinistra/destra; il dock mostra lo stato di riproduzione reale: riproduzione diretta, transcodifica audio o transcodifica video. Anche i fallback di compatibilità mantengono lo stato corretto durante i tentativi di rete.

## v1.24.15 — Agosto 2026

### Log — filtraggio per tag o testo

Impostazioni → Log ora propone un campo di ricerca libero, oltre al filtro per livello esistente, per isolare un tag preciso (es. `plex.watchSync`) nel mezzo del rumore di migliaia di righe RSS/ricerca.

## v1.24.14 — Agosto 2026

### Sessioni attive — un audio transcodificato veniva visualizzato come "Stream diretto"

Una sessione Movviz che trascodificava solo l'audio (video copiato così com'è) veniva visualizzata come "Stream diretto" nel pannello admin, mentre il lettore mostrava correttamente "Audio transcodificato". Corretto — questo caso viene ora visualizzato come transcodifica, e il codec audio di destinazione viene visualizzato anche quando il video non viene transcodificato.

### Lettore — pulsante "Salta i titoli" che sovrapponeva la barra di riproduzione

Rimpicciolendo la finestra, i pulsanti della barra di controllo passavano su due righe e ingrandivano la barra oltre il margine previsto per i pulsanti "Salta intro"/"Salta titoli"/"episodio successivo", che si trovavano quindi sopra. Corretto.

## v1.24.13 — Agosto 2026

### Download — un episodio disponibile poteva rimanere contrassegnato come « mancante »

Più episodi della stessa serie che terminavano il download nello stesso momento potevano sovrapporsi: la scrittura di disponibilità di uno sovrascriveva quella dell'altro, lasciando l'episodio visualizzato come « mancante » nonostante un file ben presente sul disco. La correzione già implementata per questo tipo di conflitto sui film e sull'importazione diretta delle serie mancava su questo percorso di riserva (utilizzato quando un torrent scompare dal motore prima che l'importazione si attivi); ora è protetto allo stesso modo.

### Sincronizzazione Plex — visibilità sulla scomparsa degli episodi visti

Il log (Impostazioni → Log) indica ora precisamente quanti episodi provenienti dalla cronologia Plex sono stati rifiutati e perché, invece di un conteggio silenziosamente riportato a zero. Viene anche registrato un esempio dei campi grezzi restituiti da Plex per un episodio rifiutato, per confermare la causa esatta su questo server.

## v1.24.12 — Agosto 2026

### Sessioni attive — il lettore Movviz nativo viene ora visualizzato, oltre a Plex

Il widget « Sessioni attive » (visibile solo agli amministratori) mostrava solo i flussi inoltrati da Plex. Ora elenca anche ciò che viene riprodotto direttamente tramite il lettore Movviz, per tutti gli utenti, con le stesse informazioni di Plex: titolo, locandina, utente, dispositivo, riproduzione diretta/copia/transcodifica e avanzamento.

## v1.24.11 — Agosto 2026

### Ricerca manuale — un titolo presente su C411 poteva rimanere invisibile in Movviz

Un indicizzatore messo in pausa dopo un solo errore 429 (protezione contro il traffico ricorrente in background: auto-grab, scan RSS) era escluso anche dalla ricerca manuale per tutto questo periodo di pausa, senza alcuna indicazione sullo schermo. La ricerca manuale interroga ora tutti gli indicizzatori configurati senza tenere conto di questa pausa — il limite di richieste al minuto specifico per ogni indicizzatore viene rispettato in ogni caso.

## v1.24.10 — Agosto 2026

### Sincronizzazione Plex — l'account amministratore e i profili Home non venivano più segnalati come « visti »

Dall'aggiornamento alla cronologia delle sessioni Plex per tracciare ciò che è stato visto per account, l'account amministratore e i profili gestiti da Plex Home (a differenza degli account ospiti esterni) non sincronizzavano più mai la loro cronologia: Plex filtra questa cronologia tramite un identificatore proprio del server (interno, distinto dall'identificatore cloud plex.tv memorizzato finora), che questi due tipi di account non hanno mai avuto. La sincronizzazione ora risolve l'identificatore locale corretto tramite nome utente Plex prima di interrogare la cronologia.

## v1.24.09 — Agosto 2026

### Manutenzione

Incremento di versione senza cambiamenti funzionali.

## v1.24.08 — Agosto 2026

### Branding unificato — Windows, Android, Web/PWA e Docker

Il nuovo logo Movviz rosa/malva con battente bianco diventa l'identità comune dell'applicazione. L'installer e le scorciatoie Windows utilizzano ora un ICO multi-risoluzione, Android Mobile e Android TV condividono gli stessi launcher/icone adattive, il banner TV è allineato, e Web/PWA e gli asset Docker utilizzano lo stesso visivo canonico.

## v1.24.07 — Agosto 2026

### Manutenzione

Incremento di versione senza cambiamenti funzionali — pulizia della cronologia dei rilasci/tag GitHub precedenti alla 1.24.06.

## v1.24.06 — Agosto 2026

### Impostazioni → Lettore — disattivazione totale di HDR/Dolby Vision → SDR

Il tone mapping HDR10, HDR10+, HLG e Dolby Vision verso SDR può ora essere disattivato completamente da Impostazioni → Lettore, anche quando il benchmark del server supera la soglia di 3× normalmente richiesta. Attivato, il comportamento non cambia: il tone mapping rimane consentito solo al di sopra di tale soglia.

### Android TV — schermata iniziale sincronizzata con il desktop

L'accoglienza del cliente Android TV consuma ora lo stesso layout del dashboard desktop (`/api/dashboard/layout`): ordine e visibilità delle sezioni, attivazione dell'hero, velocità dello slideshow e autoplay del trailer seguono la configurazione del server anziché un layout fisso specifico per la TV. Le sezioni « Selezione per te » e « Tendenze Movviz » utilizzano esattamente le stesse fonti del desktop (`/api/metadata/recommendations`, sezione trending), e « Aggiunti di recente »/« Prossimamente » recuperano le date reali (`addedAt`, data di uscita VF) anziché un ordinamento approssimativo.

## v1.24.04 — Agosto 2026

### Lettore Movviz unificato

Il lettore automatico passa attraverso un unico planner Movviz per i file locali e le fonti Plex grezze: riproduzione diretta quando il client sa effettivamente decodificare, remux quando deve cambiare solo la traccia/il contenitore, transcodifica audio senza toccare il video quando è incompatibile solo l'audio, e transcodifica video solo quando necessario. La traccia audio effettivamente selezionata è decisa prima del codec: una traccia DTS non selezionata non può più scatenare una transcodifica mentre la traccia ascoltata è AAC. HDR→SDR rimane vietato sotto 3× nel benchmark. Le transcodifiche video software si adattano al benchmark e sono limitate a 1,5× di riproduzione anticipata per mantenere un buffer senza far lavorare inutilmente il server.

### Windows, Linux e ARM64

FFmpeg/ffprobe utilizzano ora un runtime multimediale comune. L'installer Windows incorpora i propri binari e il servizio punta esplicitamente a essi; le immagini Docker amd64/arm64 verificano FFmpeg e ffprobe durante la build. Il benchmark utilizza la stessa risoluzione di runtime del lettore.

### Impostazioni → Lettore

Le opzioni di riproduzione lasciano Impostazioni → Plex. Una scheda Lettore dedicata raggruppa attivazione per profilo, lingua audio, motore automatico, riserva/cache, diagnostica e benchmark. Le vecchie scelte manuali MSE/FFmpeg/HLS/Beta sono migrate su Auto; Plex conserva solo connessione, sincronizzazione e profili.

## v1.24.03 — Agosto 2026

### Assistente di configurazione — blocco subito dopo la creazione dell'account

La creazione dell'account amministratore, aggiunta all'inizio dell'assistente nella versione precedente, rimaneva bloccata su uno schermo di caricamento infinito subito dopo la convalida del modulo, impedendo il completamento della configurazione. Corretto.

## v1.24.02 — Agosto 2026

### Assistente di configurazione — creazione account ripristinata

Durante una prima installazione, l'assistente di configurazione non proponeva più di creare l'account amministratore né di collegare un account Plex: il passaggio Assistente IA rimaneva bloccato sul caricamento, il motore di download mostrava «nessun client configurato» e il passaggio Plex rimaneva vuoto. Terminare l'assistente riportava quindi in loop a questa stessa pagina, poiché nessun account era mai stato creato. La creazione dell'account amministratore è ora il primo passaggio dell'assistente, prima di tutto il resto.

### Import Netflix e sincronizzazione Plex — date di visione

L'importazione di una cronologia Netflix registrava ogni titolo come «visto all'istante» anziché conservarne la vera data di visione. Questa data reale è ora preservata. La sincronizzazione Plex in tempo reale aggiorna anche il contesto dell'IA immediatamente anziché attendere diversi minuti.

### Schermata di avvio e finestra «Novità»

La finestra che presenta le novità di un aggiornamento poteva sovrapporsi allo schermo di avvio animato anziché attendere la sua scomparsa. Ora appare solo dopo che lo schermo di avvio è terminato.

## v1.24.01 — Agosto 2026

### Movviz AI — continuità conversazionale e preferenze esplicite

Movviz AI conserva ora molto meglio il filo degli ultimi scambi: i riferimenti impliciti come «esso», «lui», «quello» o «questo cambiamento» sono risolti prioritariamente dalla conversazione recente anziché ricominciare da zero. Le correzioni esplicite dell'utente sostituiscono immediatamente le vecchie supposizioni contraddittorie e rimangono prioritarie nel contesto.

Le preferenze esplicite su un titolo sono ora persistenti nel User Context Engine con massima confidenza e alimentano direttamente il punteggio di raccomandazione. Una correzione come « ti sbagli, adoro Watchmen » diventa quindi un segnale strutturato, durevole e prioritario anziché una semplice frase dimenticabile.

Il Dialogue Director è stato anche ammorbidito: eliminazione dell'escalation automatica, delle introduzioni di sfida stereotipate e dell'obbligo di vincere o di avere l'ultima parola. Le risposte di sfida possono essere più brevi, più naturali e variare tra umorismo, sarcasmo, ironia, autoironia o risposta secca, con un sistema anti-ripetizione potenziato.

## v1.24.00 — Agosto 2026

### Movviz AI — Motore di Contesto Utente unificato

Movviz AI dispone ora di un motore di contesto utente unificato e persistente. Un ledger SQLite per `user_id` conserva la cronologia multimediale senza mescolare i profili: visualizzazioni, film ed episodi terminati, rivedute distinte, progressione, riprese e cronologia reale quando nota. I vecchi dati di visione/progressione sono bootstrapati in modo idempotente senza creare date mancanti.

Il Query Engine può sfruttare questo stato verificato per fornire all'IA la progressione esatta delle serie, i contenuti in corso e la cronologia recente, con arricchimento da metadati/generi. Rating, feedback, richieste, fatti, insight e memoria IA rimangono compatibili tramite uno strato di adapter unificato per evitare qualsiasi migrazione distruttiva. Tratti di gusto basati su prove e un livello di confidenza possono anche alimentare la personalità senza trasformare un'inferenza in fatto.

Il Context Engine è additivo e resiliente: i store esistenti rimangono funzionanti, le scritture SQLite non impediscono mai la lettura in caso di guasto e `MOVVIZ_CONTEXT_ENGINE_DISABLED=true` permette un rollback immediato. I test coprono in particolare l'isolamento multi-utente, l'idempotenza e la conservazione di più rivedute.

### Runtime — Node.js 22

Il server Movviz passa a Node.js 22 minimo per garantire la disponibilità di `node:sqlite`. L'installer Windows include ora Node 22 e i build Linux utilizzano/annunciano anche Node 22 minimo.

## v1.23.04 — Agosto 2026

### Rilascio — versioni e artefatti allineati

Rilascio di sincronizzazione: versione applicativa, lockfile e valori di fallback Android TV/mobile allineati su `1.23.04`. Il tag `v1.23.04` scatena i build GitHub dell'installer Windows, dell'archivio Linux e dei client Android TV/mobile; l'immagine Docker rimane generata da `main`. Nessun cambiamento funzionale è introdotto da questo rilascio.

## v1.23.03 — Agosto 2026

### Schede — inquadratura YouTube virtuale affinata

Il profilo `detail`, condiviso dalla scheda completa e dalla scheda volante/TitlePanel, mantiene il motore YouTube virtuale 1920×1080 di v1.23.02 ma passa da uno zoom `1.10` a `1.15`. Il cambiamento rimane centrato e volontariamente conservatore per rendere il beneficio visivo più percepibile nelle schede senza toccare il carosello `hero` già validato né le schede `card`. Il bridge `postMessage`, i fallback, i toggles, la selezione dei trailer e la modale di anteprima interattiva rimangono invariati.

## v1.23.02 — Agosto 2026

### YouTube ambientale — motore virtuale 1080p unificato

Le tre superfici ambientali (scheda hover, hero/carosello e intestazione scheda) utilizzano ora lo stesso motore YouTube grezzo con un vero viewport logico `1920×1080`, pilotato da `postMessage` e poi ridotto in CSS tramite `ResizeObserver`. Ogni superficie possiede il proprio preset di inquadratura: `card` mantiene lo zoom validato `1.36`, mentre `hero` e `detail` partono da `1.10` per riprodurre il più vicino possibile il loro rendering precedente e rimanere regolabili indipendentemente dopo validazione visiva. Il bridge, `apiInterface`, l'occultamento del chrome quando è esposto, il ciclo prima di `ENDED`, il sipario backdrop, il mute e i timeout sono mutualizzati. Il vecchio `YT.Player` rimane il fallback di sicurezza e continua ad alimentare la modale interattiva di anteprima. I toggles esistenti, l'ordine dei trailer, i percorsi video diretti e Android rimangono invariati.

## v1.23.00 — Agosto 2026

### Nuova serie di versioni

Passaggio alla serie 1.23.x. Nessun cambiamento funzionale in questa versione.

## v1.22.61 — Agosto 2026

### Schede — iframe YouTube virtuale 1080p

Le piccole anteprime YouTube utilizzano ora un iframe grezzo il cui viewport logico rimane effettivamente a `1920×1080`, dopodiché un wrapper Movviz calcola tramite `ResizeObserver` un `transform: scale(...)` per ridurlo alle dimensioni della scheda. Lo scale applica `cover × 1.36`, il che conserva esattamente lo zoom/inquadratura della v1.22.60 mantenendo YouTube convinto di avere un grande player desktop. L'obiettivo è duplice: evitare il layout compatto del player e massimizzare le possibilità che l'ABR YouTube selezioni una qualità elevata; la qualità 1080p rimane tuttavia decisa da YouTube e non è ufficialmente forzabile. Il bridge `postMessage`, `apiInterface`, `hideVideoInfo` se esposto, il ciclo prima di `ENDED`, il poster schermo e il fallback `YT.Player` rimangono invariati. Se il viewport della scheda non può essere misurato correttamente, Movviz torna automaticamente al rendering stabile v1.22.60. Hero, schede, modale e Android non cambiano.

## v1.22.60 — Agosto 2026

### Schede — ritaglio iframe YouTube

Le piccole anteprime YouTube sono riallineate verticalmente (`top: 50 %` invece di `46 %`) e ricevono un ulteriore zoom del 15 % rispetto all'inquadratura precedente (`scale 1.18` → `scale 1.36`) per eliminare le strisce nere integrate nei trailer. Il bridge `postMessage` e il suo fallback `YT.Player` utilizzano esattamente la stessa inquadratura. Hero, schede, modale, selezione dei trailer e Android rimangono invariati.

## v1.22.59 — Agosto 2026

### Schede — iframe YouTube grezzo pilotato da postMessage

Testato in condizioni reali limitato alle piccole anteprime: il player principale delle schede è ora un iframe YouTube grezzo con `enablejsapi=1` e `origin`, senza costruzione tramite `new YT.Player()`. Movviz avvia la handshake `listening`, legge le capacità effettivamente annunciate in `initialDelivery.info.apiInterface` / `infoDelivery`, e tenta `hideVideoInfo` o `hideControls` solo quando esplicitamente esposte da questo player. Riproduzione, muto, stati, `currentTime` e ciclo pre-END passano tramite il bridge `postMessage`. Il poster rimane opaco fino al reale avanzamento del video e poi per altri 700 ms. In caso di caricamento, handshake o riproduzione fallimentare, la scheda distrugge questo percorso e torna automaticamente al `YT.Player` stabile di v1.22.58. Hero, schede, modale, Android TV e selezione/fallback dei trailer rimangono invariati.

## v1.22.58 — Agosto 2026

### Schede — poster schermo + vera transizione YouTube pausa/ripresa

Le piccole anteprime non perdono più 650 ms prima di caricare l'iframe: non appena si apre l'anteprima intenzionale, YouTube inizia immediatamente dietro il poster, che rimane al 100 % di opacità. Al primo `PLAYING`, Movviz richiede `pauseVideo()`, attende ora l'evento `PAUSED` realmente confermato, lascia che questo stato si stabilizzi per 450 ms, riavvia con `playVideo()`, attende un secondo `PLAYING`, verifica che `currentTime` avanzi realmente, e poi mantiene ancora il poster per 300 ms prima del fade al video. Un timeout globale di 2,5 s abbandona questo warm-up e torna allo storico settle di 1,5 s se YouTube non segue la sequenza. Hero, schede, modale, Android TV, selezione e fallback dei trailer rimangono invariati.

## v1.22.57 — Agosto 2026

### Schede — warm-up invisibile dell'iframe YouTube

Le piccole anteprime iniziano ora prima sotto lo sfondo (650 ms invece di 1000 ms), quindi eseguono una singola sequenza nascosta `PLAYING → pause → play`. Movviz attende quindi che `currentTime` avanzi realmente dopo la ripresa e applica un breve ritardo di 180 ms prima di rivelare il video. Questa sequenza riproduce lo stato visivo pulito osservato dopo una ripresa manuale senza movimento del mouse, mantenendo al contempo un fallback rigido a 1500 ms se YouTube ignora una transizione. L'hero, le schede, il modale, Android TV, la selezione dei trailer, la qualità e i fallback rimangono invariati.

## v1.22.56 — Agosto 2026

### Correzione di versione — anteprima YouTube delle schede

Ripristina la preview di YouTube delle piccole schede sopra la `v1.22.55` già esistente. Nessun cambiamento funzionale rispetto alla patch scheda precedentemente convalidata: iframe YouTube mantenuto, traffico diretto YouTube → utente, crop `scale 1.18`, centro al 46 %, maschera superiore proporzionale del 28 %, hero e video scheda invariati.

## v1.22.54 — Agosto 2026

### Schede — iframe YouTube compatto senza titolo

Test mirato solo alle preview delle schede: hero e video scheda rimangono invariati. Le piccole schede mantengono l'IFrame API YouTube e il traffico diretto YouTube → utente, ma utilizzano un crop leggermente potenziato (`scale 1.18`, centro rialzato al 46 %) e una maschera superiore proporzionale del 28 % per nascondere il chrome titolo/channel del layout compatto. `YOUTUBE_CHROME_SETTLE_MS=1500`, `LOOP_BEFORE_END_SEC=0.75`, la selezione dei trailer e i fallback YouTube rimangono invariati. Nessun Piped/Invidious/yt-dlp aggiunto.

Il revert 1.22.53 aveva lasciato file Piped/Invidious orfani che rendevano già `tsc --noEmit` invalido; questi relitti non referenziati sono eliminati per terminare correttamente il revert prima della convalida di questa versione.

## v1.22.53 — Agosto 2026

### Revert — 1.22.50 posticipato a 1.22.53

Pull della `v1.22.50` (revert per `v1.22.27`) posticipato a `v1.22.53`.

## v1.22.50 — Agosto 2026

### Revert — ritorno alla 1.22.27 stabile

Ritorno pulito alla `v1.22.27` a seguito di regressioni hover/zoom.

## v1.22.27 — Agosto 2026

### Torrents bloccati

Una release specifica può ora essere bloccata dalla coda di download. Il blocco è legato al suo info-hash: le altre release dello stesso film o della stessa serie rimangono quindi disponibili. Una pagina "Torrents bloccati" in Gestione permette di consultare e sbloccare ogni torrent.

## v1.22.26 — Agosto 2026

### Trailer TMDb

Spot, promo e altri video promozionali non possono più precedere un vero trailer TMDb. Le anteprime del carosello, delle schede e delle fiche privilegiano ora il trailer ufficiale completo in tutti i contesti.

## v1.22.25 — Agosto 2026

### Workflow Docker

Correzione dell'indentazione YAML e aggiunta di un nome workflow esplicito per le pubblicazioni Docker.

## v1.22.24 — Agosto 2026

### Correzione pubblicazione Docker

Correzione del workflow: i commenti non sono più interpretati come tag Docker non validi.

## v1.22.23 — Agosto 2026

### Pubblicazione Docker indipendente

L'immagine AMD64 pubblica ora il tag `latest` non appena il suo build è terminato. Il build ARM64 rimane parallelo sul suo tag e il manifesto multi-architettura viene assemblato successivamente, consentendo ai NAS AMD64 di aggiornarsi senza attendere ARM64.

## v1.22.22 — Agosto 2026

### Trailer: priorità e convalida

I video collegati da TMDb sono ora l'unica fonte utilizzata per le anteprime; il vecchio sistema di fonti arricchite è neutralizzato. Il fallback di YouTube rifiuta qualsiasi risultato il cui titolo e tipo non siano sufficientemente validati, per evitare trailer di altri film.

## v1.22.21 — Agosto 2026

### Scheda: giunzione del gradiente

Il gradiente inferiore della scheda copre ora correttamente il bordo del pannello, eliminando la sottile linea visibile tra il visual e il contenuto.

## v1.22.20 — Agosto 2026

### Fallback video: selezione affidabile

Il fallback di YouTube convalida ora titolo, lingua, canale e tipo di video. Spot, teaser, clip, riassunti e interviste sono esclusi a favore dei trailer ufficiali. Le vecchie corrispondenze errate sono invalidate da una nuova chiave di cache.

## v1.22.19 — Agosto 2026

### Schede: anteprima stabile e senza velo

L'anteprima video delle schede appare senza spostamento o dissolvenza nera superiore durante il caricamento. Il carosello e le schede mantengono il loro rendering invariato.

## v1.22.18 — Agosto 2026

### Schede: anteprima video unificata nel flusso Hero/scheda

L'anteprima al passaggio del mouse sulle schede (`DashboardPosterCard`) utilizza ora esattamente lo stesso `TrailerHeader` di Hero e della scheda (`trigger="immediate" enabled={videoPreviewEnabled}`) — stesso `backdrop`, stesse `trailerKeys/enhancedSources`, stesso crossfade e stesso pulsante muto. Solo il trigger rimane sul mouse (`videoReady` dopo 1s), il rendering video è strettamente identico.

## v1.22.17 — Agosto 2026

### CI: correzione del build Linux Release

Il passaggio di verifica `tar -tzf | grep -qx` provocava un SIGPIPE quando grep usciva prematuramente dopo aver trovato una corrispondenza, facendo morire il pipeline sotto `set -euo pipefail`. La verifica scrive ora l'elenco dei file in un file temporaneo prima di eseguire grep, eliminando il segnale. Il runner è fissato su `ubuntu-22.04`.

## v1.22.16 — Agosto 2026

### IA: dialogo guidato, doppio Mistral e risposte fattuali complete

Movviz distingue ora tra una critica, una correzione fattuale e una vera provocazione prima di rispondere. Lo scontro aumenta gradualmente, evita frasi riciclate e mantiene una mini-scena Ghostface coerente, un passo per messaggio. Con due chiavi Mistral, due risposte possono essere valutate in parallelo per mostrarne solo una; un'unica chiave continua a funzionare normalmente. Le filmografie e i conteggi attore/regista sono verificati rispetto a TMDb e alla libreria, con i titoli posseduti e quelli mancanti pertinenti, mentre le domande sulla musica utilizzano la ricerca web fattuale.

## v1.22.15 — Agosto 2026

### Hero 5 visual garantiti + IA profili ermetici

Hero non cade più a 2 visual quando `minYear` filtra troppo: gli esclusi tornano ordinati per punteggio per sempre farne 5. IA: `getWatchStatus` + `getRecommendations` strettamente per `userId` (Plex `accountId` verificato, `rejectedForeignEntries` loggato), nessun film di un altro profilo.

## v1.22.14 — Agosto 2026

### Ricerca e collegamento: Yellowstone corretto + ordinamento Tutto/Film/Serie

La ricerca non passa più alla filmografia di un attore omonimo (`Yellowstone` attore 3 voti → `Yellowstone` serie 73586 3298 voti mantenuti), docu `19355` non proposto al posto della serie, e la pagina Scoperta guadagna un ordinamento `Tutto | Film | Serie` + `Rilevanza/Popolare/Recente/Voti` senza refetch, con messa in evidenza di ciò che è noto/recente. Collegamento Plex `tvdb://85527` → `73586` se docu.

## v1.22.13 — Agosto 2026

### IA: anti-ripetizione generalizzata

Il controllo non dipende più da una sequenza ininterrotta di insulti: tutte le risposte conversazionali sono confrontate con le formulazioni recenti. Le provocazioni brevi come «piccola banda» vengono ancora correttamente identificate dopo una domanda normale, vengono tentate tre riformulazioni prima di qualsiasi ritiro, e un commento esplicito su una ripetizione riceve una risposta contestuale piuttosto che una replica generica. La personalità esistente viene mantenuta.

## v1.22.12 — Agosto 2026

### IA: personalità mantenuta, ripetizioni eliminate

L'assistente mantiene il suo tono e la sua personalità, ma ora memorizza le formulazioni recenti anche dopo una normale interruzione della conversazione. Le risposte che riciclano la stessa struttura con poche parole cambiate vengono rilevate e rigenerate; anche le aperture, le chiusure e i riprendimenti già utilizzati servono da lista nera temporanea. I vecchi giri troppo riconoscibili sono stati sostituiti da risposte brevi e varie.

## v1.22.11 — Agosto 2026

### Android TV: crash schermata iniziale definitivamente corretto

`HomeScreen` `focusRequester` protetto (`runCatching + withFrameNanos` 8 frame), `heroIndex` anti-divide-by-zero, `AmbientTrailer` `availMem` 400Mo + `applicationContext` + pool `1` idle, nessuna perdita WebView. D-pad `focusGroup`/`padding 80dp` stabile.

## v1.22.10 — Agosto 2026

### Rimozione remaster HD + anteprima statica + dashboard ottimizzato mantenuti

Rimozione completa del sistema remaster HD (1.22.00) — troppi falsi positivi — ritorno a `Apple/Netflix/Disney+/Prime/IMDb → TMDb` esattamente come prima, senza regressioni. Anteprima hover: velo nero e zoom rimossi, rimane statico prima della anteprima video. Mantenuti: splash identico, D-pad, ottimizzazione velocità, loghi SVG.

## v1.22.09 — Agosto 2026

### Archivio Linux completo e installabile

La release Linux x64 contiene ora l'applicazione precompilata, il motore, `install.sh`, `uninstall.sh`, il servizio systemd e una guida Linux riorganizzata. L'installer crea autonomamente l'account di sistema `movviz`, installa le dipendenze multimediali disponibili, conserva i dati durante gli aggiornamenti e può installare direttamente il bundle estratto. La CI verifica il contenuto dell'archivio prima della pubblicazione e fornisce la sua somma SHA-256.

## v1.22.08 — Agosto 2026

### Anteprime video affidabili e metadati unificati

La ricerca "remastered" è stata rimossa da tutte le anteprime: poteva associare un video a un titolo errato. Le fonti migliorate e affidabili rimangono nell'ordine Apple TV, Netflix, Disney+, Prime Video e poi IMDb, prima del trailer TMDb. Le schede desktop, mobile e TV mostrano ora metadati più sobri: durata e tecnica compatte, generi separati da punti.

## v1.22.07 — Agosto 2026

### Build Android TV riparata + hero/anteprima pulita + mobile allineato desktop

Build TV `focusGroup` import corretto (`foundation` non `ui.focus`), pausa hero `||` nascosta (`900→1500ms` + velo superiore `z-10`), anteprima hover solo video come hero, palette mobile `Void #05060B / Surface #0D1020` allineata desktop.

## v1.22.06 — Agosto 2026

### Hero e anteprime: video pulito senza UI YouTube

Il `||` centrale dell'hero scompare (ritardo `YOUTUBE_CHROME_SETTLE 450→900ms` per coprire il chrome YouTube) e l'anteprima al passaggio del mouse nasconde la barra titolo/canale YouTube con un velo superiore, per mostrare solo il video come l'hero.

## v1.22.05 — Agosto 2026

### Splash sincronizzato con immagini e D-pad TV

Lo splash rimane ora finché **tutte le immagini del dashboard** non sono caricate (timeout richiesto di 15s) e non solo la libreria — nessun splash che scompare prima delle righe. Correttivi Android TV: `NavRail` + `LazyColumn` con `focusGroup`/`padding 80dp` anti-overlay, `focusRestorer` nullo, `BringIntoViewSpec`, soglia memoria WebView `4→2Go`.

## v1.22.04 — Agosto 2026

### Dashboard istantaneo e loghi SVG

Splash Movviz ad alta qualità solo al primo avvio a freddo (mai ad ogni clic) con barra di avanzamento intelligente, precaricamento di Scoperta in background in modo ottimizzato (`requestIdleCallback` + `priority:low`), e correzione dei loghi TMDb in `*.svg` che rimanevano in 404 (`tmdbImageCache` ora autorizza `svg`).

## v1.22.03 — Agosto 2026

### Miglioramento della chat

## v1.22.02 — Agosto 2026

### Anteprime uniformi dei trailer

Le schede utilizzano ora la stessa selezione di fonti del carosello: trailer HD restaurato, video diretto e infine YouTube come riserva. All'avvio, YouTube rimane brevemente nascosto dall'illustrazione per eliminare il grande pulsante pausa/play centrale, sia sulle schede che nel carosello.

## v1.22.01 — Agosto 2026

### Miglioramento della chat

## v1.22.00 — Agosto 2026

### Anteprime HD restaurate prioritarie

Nuovo impostazione globale **"Prioritizza anteprime HD restaurate"** in **Impostazioni → Informazioni, immagini e loghi** (disattivato di default, reversibile con un clic, attivo per tutti quando l'admin lo attiva). Quando attivo, Movviz tenta con priorità anteprime restaurate/remasterizzate/re-trailer in **Full HD/4K** provenienti da **5 canali YouTube di fiducia** (Digital Ciné, HD Retro Trailers, Casu/Re-Trailer, FilmsActu, The Digital Theater) — whitelist stretta per `channelId`, risoluzione reale sondata (≥1080p obbligatorio, altrimenti rifiutato), corrispondenza titolo ultra-conservativa (≥0,85) + anno esatto/±1 (remake omonimi mai confusi), lingua utente prioritaria, provider in parallelo con timeout brevi e scadenza globale ~3s, ranking dedicato, cache separata (7g positivo / 18h vuoto / nessuna cache in caso di errore transitorio), fallback immediato al flusso di lavoro attuale (Apple/IMDb/Prime → YouTube) al minimo dubbio. Integrazione web: `DashboardHero` (contesto carosello: teaser > trailer) e `TitleContent` (contesto dettagli: trailer > teaser) tramite `TrailerHeader`/`TrailerModalPlayer` (`premiumSources` prependente), `GET /api/trailers/remastered/resolve` verifica il toggle PRIMA di qualsiasi richiesta di rete, Android TV/mobile: campo `premiumTrailerCandidates` opzionale (`= emptyList()`) — vecchia APK ignora, vecchio backend senza campo non crasha. Zero regressione garantita: toggle OFF = flusso di lavoro esattamente invariato.

## v1.21.17 — Agosto 2026

### Schede attore: filmografia utile

Talk show, late show e cerimonie di premiazione non sporcano più le schede attore. Movviz esclude il genere TMDb « Talk » e le rare trasmissioni male categorizzate, senza cambiare la ricerca, la Scoperta o le schede titolo.

## v1.21.16 — Agosto 2026

### Raccomandazioni personali su Android TV e mobile

Le applicazioni Android ora utilizzano i suggerimenti della libreria già utilizzati su desktop. Le sezioni "Suggerimenti per te", i titoli più votati e le selezioni per genere vengono calcolate in base ai film e alle serie effettivamente presenti, preservando le sezioni editoriali di Scopri.

## v1.21.15 — Agosto 2026

### Scopri: un titolo "non mi piace" riappariva dopo l'aggiornamento

Il 👎 su una scheda Scopri veniva correttamente registrato, ma le sezioni editoriali (tendenze, popolari, più votati...) non lo consultavano mai — lo stesso titolo riappariva quindi ad ogni ricaricamento della pagina. Queste sezioni escludono ora i titoli contrassegnati come "non mi piace", in modo permanente.

### Film/Serie: loghi mancanti in Riprendi ed Episodi aggiunti di recente

Nelle pagine Film e Serie, le sezioni "Riprendi" ed "Episodi aggiunti di recente" mostravano il titolo in testo semplice al posto del logo — queste schede non venivano mai incluse nel recupero raggruppato dei loghi. Corretto. Aggiunto anche un badge permanente nell'angolo in basso a destra della scheda ("S03 · E02") per identificare l'episodio con un'occhiata, senza dover passare il mouse.

### Miglioramento della chat

### Miglioramento della chat

### Anteprima carosello: sottile linea nera sui trailer

Un leggero disallineamento di arrotondamento tra il video e il suo contenitore faceva apparire talvolta una linea nera di un pixel su un bordo del lettore (trailer MP4/HLS diretti). Aggiunto un minimo zoom per farla scomparire.

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

### Miglioramento della chat

## v1.21.01 — Agosto 2026

### Chat intelligente: parole comuni confuse con titoli

Testato in condizioni reali: rispondere semplicemente "boh" o "cretino" al Chat intelligente faceva deragliare su un film oscuro che coincidentemente portava questo nome ("O Bofe", "Questo cretino di Malec") invece di comprendere il commento. Lista di parole filtrate ampliata (interiezioni comuni, insulti usuali) per non confondere mai più una parola di uso comune con il riferimento a un titolo.

## v1.21.00 — Agosto 2026

### Installatore Linux di nuova generazione + aggiornamento con un clic

L'installatore Linux (`packaging/linux/install.sh`) rileva ora un'installazione esistente e propone di aggiornarla (conservando la libreria), reinstallarla completamente o disinstallarla — non è più necessario clonare il repository: `curl -fsSL .../install.sh | sudo bash` scarica direttamente il bundle pronto all'uso dell'ultima versione. E nell'interfaccia, il pulsante "Aggiorna con un clic" (Impostazioni → Informazioni), finora riservato a Windows, ora funziona anche su un'installazione Linux nativa (servizio systemd) — i container Docker rimangono aggiornati tramite `docker pull`, come prima.

## v1.20.12 — Agosto 2026

### Anteprima al passaggio del mouse sulle schede: zoom leggermente aumentato

Su alcuni titoli (RoboCop 2014 confermato), una sottile barra nera rimaneva visibile in alto/basso dell'anteprima video al passaggio del mouse su una scheda — il trailer stesso integrava un leggero letterbox. Zoom aumentato di un grado, solo su questa anteprima (il carosello iniziale e la scheda del titolo non sono interessati).

## v1.20.11 — Agosto 2026

### Android mobile: correzione di build

La build Android smartphone falliva per lo stesso motivo della TV corretta in v1.20.08: la schermata iniziale mobile non aveva seguito il cambiamento del contratto compatto di /api/interface/dashboard. Stessa correzione applicata.

## v1.20.10 — Agosto 2026

### Chat intelligente: scambi di battute più vivaci, domanda ripetuta presa in giro

Il Chat intelligente ora reagisce al contenuto preciso di ciò che dici (non una replica generica), ricorda sempre l'ultima parola e sa concludere uno scambio di battute prolungato proponendo davvero un film per stemperare l'atmosfera. Inoltre: se nota che stai ponendo una domanda già risposta più in alto nella conversazione, può prenderti in giro gentilmente prima di rispondere — mai al posto della risposta.

## v1.20.09 — Agosto 2026

### Chat intelligente: il tono di fronte agli insulti, presa 3

Testato in condizioni reali: il Chat intelligente riciclava la stessa replica parola per parola (cambiava solo l'insulto), e deragliava ancora talvolta verso un elenco di raccomandazioni non richiesto. Divieto assoluto di qualsiasi elenco in questo caso specifico, e istruzione esplicita di non riutilizzare mai una formula già impiegata prima nella conversazione.

## v1.20.08 — Agosto 2026

### Android TV: correzione di build

La build Android TV falliva: un commento di documentazione conteneva per errore una sequenza che, in Kotlin, apre un commento annidato mai chiuso — il resto del file diventava invisibile per il compilatore. Corretto.

## v1.20.07 — Agosto 2026

### Anteprima al passaggio del mouse: velo nero rimosso dal video

Sulla scheda di anteprima che si apre passando il mouse, il velo nero applicato al trailer in riproduzione nascondeva inutilmente l'immagine — rimosso solo in questo caso specifico (l'anteprima immagine/placeholder di riserva mantiene il suo velo per la leggibilità del titolo).

## v1.20.06 — Agosto 2026

### Chat intelligente: making-of mai aggiunto tranne su richiesta esplicita

Aggiungere un film non dovrebbe più far risalire un making-of o una web serie derivata al posto — a meno che non lo richiediate voi esplicitamente ("il making of di..."), nel qual caso ora viene rispettato invece di essere bloccato.

### Android TV: robustezza all'avvio

Il contratto compatto della schermata iniziale è ora tollerante a un'inserimento di libreria incompleto — un valore mancante non interrompe più il caricamento, viene semplicemente ignorato.

## v1.20.05 — Agosto 2026

### Chat intelligente: il tono di fronte agli insulti, presa 2

Testato in condizioni reali: di fronte a un insulto, il Chat intelligente eludeva ancora troppo debolmente ("mi stai prendendo in giro?") e peggio, trasformava talvolta l'insulto in pretesto per riproporre un elenco di raccomandazioni non richieste. Istruzione ristretta affinché reagisca prima e veramente alla provocazione, senza cambiare argomento.

## v1.20.04 — Agosto 2026

### Chat intelligente: aggiunte/raccomandazioni, meno corrispondenze errate

Testato in condizioni reali: richiedere l'aggiunta di "Terminator 2" o "Terminator Salvation" aggiungeva talvolta un making-of o una web serie derivata al posto del film vero — un contenuto bonus TMDb non riconosciuto come tale. E una raccomandazione del tipo "The Death of Stalin" poteva far risalire un duplicato quasi anonimo (1 voto) al posto del film vero, a causa del titolo localizzato francese che non corrispondeva al titolo richiesto. Entrambi sono corretti.

## v1.20.03 — Agosto 2026

### Chat intelligente: raccomandazioni JSON più affidabili

Rafforzati gli esempi interni che il Chat intelligente segue per costruire un elenco di raccomandazioni o di aggiunte — più titoli consecutivi piuttosto che uno solo, con la sintassi esatta da rispettare. Obiettivo: meno casi in cui il formato generato fallisce e scatena un messaggio di errore generico.

## v1.20.02 — Agosto 2026

### Chat intelligente: domande su registi, filmografia e tono

Diverse formulazioni naturali ("cosa ha diretto X", "quanti film ho diretto con X"... ) non venivano riconosciute e fornivano una risposta inventata. Corretto, e di passaggio: i documentari non sono più mescolati con le vere opere in risposta su un regista, e una richiesta di raccomandazione che falliva talvolta nel formarsi correttamente ora si recupera automaticamente invece di mostrare un messaggio di errore generico. Anche il tono del Chat intelligente ha una risposta più adeguata di fronte a un commento scherzoso.

### Libreria: layout ristretto

Nelle pagine Film e Serie, i filtri Disponibile/Mancante occupavano un'intera riga accanto a uno spazio vuoto inutile. Layout ristretto, meno spazio sprecato.

## v1.20.01 — Agosto 2026

### Libreria: raccomandazioni Plex ed episodi aggiunti

Film e Serie si aprono ora su una scheda Raccomandato, composta esclusivamente dalla vostra libreria: riprendere, aggiunte recenti, selezioni personalizzate, migliori voti e generi. La vista Libreria completa rimane disponibile nella sua scheda dedicata. La dashboard mostra anche gli episodi effettivamente aggiunti di recente, con la loro stagione e il loro numero di episodio.

### IA e metadati

I miglioramenti in corso sulle azioni IA, l'interpretazione delle intenzioni e la risoluzione TMDb fanno parte di questa versione.

## v1.20.00 — Agosto 2026

### Grande pulizia delle release GitHub

Pulizia completa della cronologia delle release GitHub: eliminazione di decine di vecchie versioni accumulate, conservando solo i milestone utili. Nessun cambiamento funzionale lato applicazione.

## v1.19.63 — Agosto 2026

### Riprendi: menu della scheda, nessun pulsante audio

Nelle schede della sezione "Riprendi" (e tutte le schede con anteprima video), il pulsante audio è stato rimosso — l'anteprima rimane muta, senza pulsanti inutili. Il chevron apre ora un menu: "Segna come visto" (che rimuove anche la scheda da Riprendi) e "Rimuovi dalla lista Riprendi" senza segnarla come vista. Inoltre, le fonti di anteprima migliorate (Apple/IMDb) sono diventate una singola impostazione del server, più di una scelta utente.

## v1.19.62 — Agosto 2026

### Ricerca: filmografia vera dei registi, film e serie mescolati

Cercare un regista (es. "Christopher Nolan") restituiva solo titoli in cui il suo nome appariva casualmente nel testo, mai i suoi veri film. La ricerca mostra ora la sua vera filmografia, con le sue opere in primo piano. Altra correzione: una ricerca mescola ora film e serie negli stessi risultati invece di richiedere di cambiare scheda. Anche la Chat intelligente distingue ora tra "diretto da" e "compare in" (cameo, produzione...) — non confonderà più, ad esempio, un cameo in una serie con un vero film diretto.

## v1.19.61 — Agosto 2026

### Ricerca: sempre visibile nel menu

Correzione: la barra di ricerca del menu scompariva una volta su Scopri (che aveva la propria barra separata). Ora ce n'è solo una, sempre nello stesso posto, sia sulla dashboard che su Scopri. Su mobile, l'icona della lente di ingrandimento diventa una vera barra di ricerca invece di un semplice link.

## v1.19.60 — Agosto 2026

### Ricerca: diretta nel menu, risultati in schede

La ricerca si sposta dal menu "Cerca ovunque" a una vera barra integrata nel menu di sinistra — digitare una parola apre direttamente Scopri con i risultati in schede (film, serie, attori, registi), invece di un piccolo menu a discesa. Su mobile, l'icona della lente di ingrandimento apre direttamente Scopri.

## v1.19.59 — Agosto 2026

### Ricerca rapida: attori e registi

La ricerca rapida (Ctrl/Cmd+K) trova ora anche attori e registi, oltre a film, serie e pagine — un risultato persona apre direttamente la sua scheda filmografica. Inoltre, la Chat intelligente riconosce ora "quanti film ho di [regista]" come una vera domanda sulla filmografia (prima, erano riconosciute solo formulazioni tipo "filmografia di X" — una domanda posta diversamente riceveva una risposta inventata non verificata).

## v1.19.58 — Agosto 2026

### Anteprime: correzione titoli tradotti

Testato in condizioni reali: un film come "L'Idea di essere con te" non trovava mai la sua anteprima Apple/Prime, mentre il titolo originale "The Idea of You" la trova immediatamente — questi cataloghi fanno riferimento quasi sempre ai film con il loro titolo inglese, non con la traduzione francese. La ricerca utilizza ora il titolo originale per prima (stessa logica già utilizzata per la ricerca di file).

## v1.19.57 — Agosto 2026

### Anteprime: correzione lentezza

Testato in condizioni reali: la ricerca di anteprime (Apple, Prime...) poteva richiedere fino a 12 secondi perché ogni fonte veniva verificata una dopo l'altra. Ora vengono verificate tutte insieme — 4-6 secondi invece di 12, senza cambiare il risultato.

## v1.19.56 — Agosto 2026

### Anteprime: aggiunto Prime Video come fonte

Dopo verifica tecnica in diretta (segmento video scaricato e confermato non criptato), Prime Video si unisce ad Apple come fonte di anteprime dirette per i film — stessa impostazione, stesso fallback automatico su YouTube. Netflix rimane disattivato: testato anche in diretta, ma rifiutato da Netflix con una restrizione di account prima ancora di arrivare al flusso video.

## v1.19.55 — Agosto 2026

### Anteprime Apple: qualità HD/4K + correzione affidabilità

Testato in condizioni reali (25+ prove, attivato e disattivato): è stato trovato e corretto un vero bug — un'ondata di controlli poteva far credere erroneamente che un film non avesse un trailer Apple per 24 ore a causa di un limite di banda temporaneo da parte di Apple. Approfittate di questi test per migliorare anche la qualità: il trailer Apple passa ora attraverso lo stream nativo HD/4K invece di un file a bassa risoluzione, con selezione automatica della migliore qualità disponibile.

## v1.19.54 — Agosto 2026

### Trailer: affidabilità migliorata + ricerca fonti ampliata

Il lettore di trailer diretto (Apple) ha ora un meccanismo di sicurezza: se il caricamento non procede entro pochi secondi (osservato in condizioni reali), Movviz passa automaticamente a YouTube invece di bloccarsi. La catena di fonti è stata ampliata anche a Netflix, Disney+ e Prime Video — dopo un'approfondita verifica tecnica, nessuna di queste piattaforme espone un trailer pubblico utilizzabile senza aggirare protezioni o account, quindi queste tre fonti rimangono inattive per il momento (Apple rimane l'unica fonte diretta, YouTube la solita rete di sicurezza).

## v1.19.53 — Agosto 2026

### Trailer: fonte diretta Apple prima di YouTube (opzionale)

Nuovo impostazione (Impostazioni → La mia esperienza, disattivato di default): Movviz può ora provare un video diretto Apple prima di ricadere su YouTube come oggi per l'atmosfera della scheda e il lettore "Guarda il trailer". Nessuna perdita di funzionalità se la fonte Apple non viene trovata o fallisce — YouTube rimane la rete di sicurezza automatica, e l'impostazione si disattiva con un clic per tornare istantaneamente al comportamento attuale.

## v1.19.52 — Agosto 2026

### App Android: avvio più veloce, correzione riproduzione episodi

Le app TV e mobile caricano ora la libreria all'avvio tramite un unico snapshot compatto anziché due chiamate complete, con fallback automatico al vecchio comportamento se necessario. Correzione anche per le serie che mescolano episodi Plex e locali: la fonte di riproduzione è ora determinata episodio per episodio anziché dedotta dall'intera serie, cosa che causava un errore di riproduzione su alcuni episodi. Schermata di selezione profilo TV rivista.

## v1.19.51 — Agosto 2026

### Chat intelligente: durata e qualità file inventate, corretto

Confermata in diretta: sulla scheda di un film, una domanda sulla sua durata esatta o qualità (4K, HD...) poteva ricevere una risposta inventata — a volte anche insistendo dopo la correzione, mentre nulla di tutto questo veniva realmente trasmesso da Movviz. La durata e la qualità reali del file nella libreria sono ora fornite, o l'assenza di dati è segnalata chiaramente anziché un numero approssimativo presentato come reale.

## v1.19.50 — Agosto 2026

### Etichette rimosse

La funzionalità di etichette personalizzate per film e serie è stata completamente rimossa — nessun campo nella scheda, nessun filtro in Film/Serie, nessun menu associato sulle schede.

### Scheda: rifiniture visive

Barra di scorrimento della scheda nascosta, video esteso fino al bordo reale del pannello (prima si fermava un po' prima), velo scuro davanti al video meno presente sulla maggior parte dell'immagine (si scuriva solo verso il basso, per fondersi con il resto della scheda), leggero zoom sull'anteprima video per nascondere le sottili strisce nere che alcuni trailer includono a volte. Anche la sottile barra di separazione sotto il menu superiore è stata rimossa.

## v1.19.49 — Agosto 2026

### Film e Serie aprono una scheda invece di cambiare pagina

Cliccare una scheda in Film o Serie ricaricava un'intera pagina — come su Scopri o Dashboard, ora una scheda si apre sopra la griglia con un effetto di dissolvenza-ingrandimento dalla scheda cliccata, senza mai lasciare la pagina. È anche più larga di prima, per lasciare più spazio all'immagine e alle informazioni.

### Cliccare l'affissione avvia la riproduzione, cliccare le info apre la scheda

Nella scheda ingrandita al passaggio del mouse su una mappa, cliccare direttamente sull'immagine o sul pulsante di riproduzione avvia il film immediatamente; cliccare sull'area informazioni (anno, durata, generi) o sulla freccia apre la scheda completa. L'anteprima al passaggio del mouse non rimane più visualizzata sopra una scheda appena aperta.

### Visualizzazione mappe alleggerita

Lo zoom al passaggio del mouse sull'immagine delle mappe è stato rimosso (solo la mappa ingrandiva, l'immagine che zoomava in più appesantiva l'effetto). L'apparizione delle mappe in una griglia al caricamento è ora gestita senza animazione JavaScript.

## v1.19.48 — Agosto 2026

### Scorrimento intelligente in Film e Serie, con indice alfabetico

Su una grande libreria, aprire Film o Serie caricava tutto in una volta e rallentava la visualizzazione. La griglia si riempie ora in lotti di 200 titoli, e carica automaticamente il resto avvicinandosi al fondo — lo spazio dei titoli non ancora visualizzati rimane riservato in modo che lo scorrimento non salti mai. Un salto brusco lontano nell'elenco (trascinare la barra di scorrimento, tasto Invio) carica direttamente l'area dove si atterra, senza attendere un recupero progressivo dall'inizio. In ordinamento per titolo, appare una barra A-Z stile Plex sul bordo dello schermo per saltare direttamente ai titoli che iniziano con una data lettera.

### Nuova impostazione: disattivare la ricerca automatica dei mancanti

Impostazioni server, riservato all'admin, in Impostazioni → Automazione: interrompe lo scan RSS, il rilancio periodico di film/episodi mancanti e la ricerca delle uscite del giorno, con un unico interruttore. Il monitoraggio per titolo e il pulsante "Cerca" manuale continuano a funzionare normalmente.

## v1.19.47 — Agosto 2026

### Chat intelligente: un contenuto bonus poteva passare per il vero film

Una scheda "scene tagliate" o "making-of" che condivideva lo stesso titolo di un vero film poteva, in rari casi, essere proposta al suo posto in un suggerimento — il voto visualizzato era allora basato solo su un piccolo numero di voti. Questo tipo di contenuto è ora escluso di default, la distinzione tra due titoli identici si basa sul volume reale di voti piuttosto che solo sul voto, e lo stesso suggerimento non può più apparire più volte nella stessa risposta.

## v1.19.46 — Agosto 2026

### Impostazioni: gli indexer e i client di download non erano riservati all'admin

Le schede "Indexer" e "Client di download" erano visibili a qualsiasi utente in Impostazioni, mentre tutti i dati sensibili sono già protetti lato server — corretto in modo che siano visibili solo per un amministratore, come il resto delle impostazioni server.

### Le immagini da Internet diventano un'impostazione server, più personale

La scelta di caricare i poster/loghi direttamente da TMDb piuttosto che tramite il server (impatto di rete/carico per tutta la casa) era finora decisa individualmente da ogni account. Ora è un'unica impostazione server, in Impostazioni → Cache.

### Chat intelligente: suggerimenti più affidabili

Tre correzioni dopo una serie di test in condizioni reali: un frammento di codice tecnico (```json```) poteva apparire letteralmente in una risposta; un titolo che condivideva il nome con un'opera più vecchia/oscura poteva essere confuso con la versione corretta; un documentario totalmente fuori tema poteva apparire in un elenco di film "simili" a una fiction. Il tono e la personalità rimangono strettamente invariati — queste correzioni agiscono solo sull'affidabilità dei dati trasmessi.

### Messaggio di errore di riproduzione più chiaro

Quando un video non può essere riprodotto perché il browser non sa decodificare il codec (in particolare HEVC, frequente in 4K/HDR), il messaggio lo indica ora chiaramente invece di un messaggio generico.

## v1.19.45 — Agosto 2026

### Corretta la perdita di ripresa Plex tra account

Un profilo Plex Home gestito che condivide il token dell'amministratore poteva, in alcuni casi, proporre la ripresa della riproduzione dell'account proprietario del server invece di quella del profilo. La risposta di Plex è ora verificata prima di essere utilizzata: se corrisponde esattamente a quella del proprietario invece di quella del profilo richiesto, viene ignorata invece di essere mostrata alla persona sbagliata.

## v1.19.44 — Agosto 2026

### Un file eliminato manualmente dal disco non viene più scaricato automaticamente

Un film, un episodio o un'intera serie eliminati direttamente dal disco (al di fuori di Movviz) vengono ora inviati nel Cestino invece di ricominciare immediatamente la ricerca automatica — con un badge "Sparito dal disco" che lo distingue da un'eliminazione manuale, e un filtro dedicato nella pagina Cestino. Un elemento nel Cestino non viene mai eliminato automaticamente: ripristinalo per riattivare un download (utile in caso di eliminazione accidentale), o svuotalo definitivamente — in questo caso Movviz chiede anche a Plex di rimuovere il proprio riferimento, in modo che la prossima sincronizzazione non lo faccia riapparire da sola. Eliminare un'intera serie raggruppa tutto in un unico elemento anziché uno per episodio; eliminare solo alcuni episodi lascia il resto della serie intatto.

## v1.19.43 — Agosto 2026

### I loghi scomparivano talvolta da tutte le schede contemporaneamente

Corretto: un aggiornamento in background dei suggerimenti della dashboard poteva, per una frazione di secondo, far scomparire i loghi dei titoli di tutte le schede visibili simultaneamente prima che ritornassero. Una volta visualizzato, un logo rimane ora al suo posto finché la sua scheda è visibile, anche se i dati circostanti si aggiornano silenziosamente.

## v1.19.42 — Agosto 2026

### Interfaccia remota molto più veloce

Movviz può ora utilizzare un flusso di dati ottimizzato, attivabile da un amministratore in Impostazioni → Velocità e capacità del server. La dashboard, la scoperta, la ricerca locale e i badge di navigazione richiedono solo i dati necessari per lo schermo anziché scaricare intere librerie. Nella libreria di riferimento, la dashboard trasmette circa l'89% di dati compressi in meno.

L'impostazione è globale per il server, con una modalità Compatibilità che mantiene istantaneamente il funzionamento storico per tutti gli utenti. Le notifiche vengono caricate all'apertura della campana, gli aggiornamenti in tempo reale si concentrano solo sui dati interessati e le code di download adattano la loro frequenza di aggiornamento alla loro attività.

## v1.19.41 — Agosto 2026

### Anteprima delle schede più dinamica

L'anteprima che si ingrandisce passando il mouse su una scheda rimane ora al suo posto durante lo scorrimento della pagina anziché rimanere bloccata sullo schermo, si chiude immediatamente se si scorre, e appare ora con un vero effetto di ingrandimento progressivo anziché un semplice dissolvenza. Le schede della dashboard sono state anche leggermente ridotte per armonizzarsi meglio con quelle di Film e Serie.

### Ridotto il caricamento di rete passivo in background

Il precaricamento automatico delle schede, che si attivava per ogni scheda visibile sullo schermo mentre la scheda si apriva in realtà in un pannello senza mai navigare veramente, non si attiva più — meno richieste inutili in background durante la navigazione.

## v1.19.40 — Agosto 2026

### Pulizia della pubblicazione

I documenti interni utilizzati per preparare il redesign delle impostazioni sono stati ritirati dalla distribuzione pubblica. Il funzionamento del centro di controllo e delle impostazioni rimane strettamente invariato.

## v1.19.39 — Agosto 2026

### Le impostazioni diventano un vero centro di controllo

La schermata iniziale delle impostazioni verifica ora in tempo reale Plex, il motore di download, i metadati e lo storage. I LED si accendono in successione, forniscono un verdetto chiaro sullo stato di Movviz e aprono direttamente l'impostazione da correggere quando è necessaria un'attenzione.

### Modalità Essenziale e percorsi guidati

La lunga lista tecnica lascia, di default, cinque obiettivi comprensibili: La mia esperienza, Lettura, Libreria e Plex, Download, e poi Server e dati. Ogni percorso spiega cosa contiene, distingue le scelte essenziali dagli strumenti avanzati e mantiene un feedback contestuale. La modalità Esperto memorizzata fornisce accesso istantaneo alle 25 sezioni, senza alcuna opzione eliminata.

### Ricerca e etichette più umane

La ricerca trova anche le impostazioni avanzate dalla modalità Essenziale. Nomi vaghi come "Esperienza", "GPU", "Prestazioni" o "Manutenzione" descrivono ora la loro funzione reale. I vecchi link `?tab=` rimangono compatibili e gli utenti standard non attivano più inutilmente i controlli riservati all'amministratore.

## v1.19.38 — Agosto 2026

### Una scheda poteva rimanere bloccata in caricamento indefinitamente

Corretto: il recupero delle informazioni di un titolo da TMDb non aveva alcun limite di tempo — una risposta anormalmente lenta era sufficiente a bloccare la scheda indefinitamente sullo schermo di caricamento, senza mai fallire né riprovare. Un limite di tempo ragionevole è ora in atto, con un nuovo tentativo automatico come per qualsiasi altro errore di rete.

### Impostazione "Motore di lettura" chiarita: Stabile / Auto / Beta

L'impostazione amministratore Impostazioni → Plex guadagna due nuove opzioni. "Stabile" blocca esplicitamente il comportamento di lettura attuale, garantendo che non cambierà mai anche se "Auto" viene riorientato in seguito. "Beta" è il nuovo motore decisionale, ora in grado di gestire sia film che episodi di serie (limitato ai film finora). Migrazione automatica e puntuale con questo aggiornamento: qualunque sia la scelta attuale, passerà una sola volta su "Auto" — per proteggere chiunque avesse selezionato manualmente il vecchio motore sperimentale pensando, fino ad ora, che non cambiasse nulla.

### Il contenuto HDR/Dolby Vision non viene più mai riconvertito in SDR

Regola assoluta ora: un titolo HDR o Dolby Vision viene riprodotto così com'è, mai con una conversione di colore in un rendering standard, nemmeno quando un transcodifica è comunque necessario per un altro motivo. Un dispositivo che non gestisce nativamente l'HDR visualizza l'immagine così com'è piuttosto che attendere una costosa conversione.

### Indicatore di lettura più preciso

Il badge visualizzato durante la riproduzione (copia/remux/transcodifica locale) specifica ora se viene utilizzato l'encoding hardware (GPU) o software (CPU).

## v1.19.37 — Agosto 2026

### Anteprime video verticali nelle tendenze e sulle schede

Corretto: alcune anteprime video (carosello, scheda) venivano visualizzate in formato verticale stile social media anziché nel solito formato cinematografico. Il rilevamento che doveva escludere questi clip verticali interrogava il dato sbagliato e in realtà non funzionava mai da quando era stato implementato — ora è affidabile. Uno studio può anche pubblicare una vera raffica di clip verticali consecutive per lo stesso titolo; la selezione ora cade correttamente sul trailer classico in questo caso anziché rimanere bloccata. Corretto anche il passaggio di un lettore video che poteva apparire in dimensione ridotta anziché riempire tutto il riquadro.

## v1.19.36 — Agosto 2026

### Versioni web, Android TV e smartphone allineate

I valori di fallback dei due progetti Android sono ora `1.19.36` con il `versionCode` `11936`, come il server web e il tag di release. Gli APK costruiti dalla CI utilizzano già il tag, e i build locali / schermate "Informazioni" non possono più annunciare una versione precedente.

## v1.19.35 — Agosto 2026

### Carosello cinematografico che scompare e poi torna in loop

Corretto: l'API YouTube sostituiva essa stessa un nodo che React doveva rimuovere alla fine di una diapositiva. Ciò scatenava un errore `removeChild`, dopodiché il meccanismo di recupero riportava costantemente l'eroe. Il lettore YouTube è ora isolato dal DOM gestito da React; un errore persistente non può più riavviare il carosello indefinitamente.

## v1.19.34 — Agosto 2026

### Il toggle "Immagini da Internet" si disattivava da solo

Corretto: attivarlo sembrava funzionare per un istante e poi tornava su off. Il salvataggio della impostazione veniva silenziosamente rifiutato lato server (elenco delle impostazioni riconosciute non ancora aggiornato) — l'impostazione ora è corretta.

### Logo del titolo mancante sulla scheda, smartphone

La scheda di un film o di una serie su Android smartphone non mostrava mai il logo TMDb del titolo (solo il titolo in testo), a differenza del resto dell'app. Corretto — stessa logica che ovunque: il logo sostituisce il titolo testuale quando TMDb ne ha uno.

## v1.19.33 — Agosto 2026

### Scoperta su Android TV e smartphone

Entrambi i client Android recuperano la sezione Scoperta: stesse fasce editoriali del web (inclusa la sezione personalizzata "perché hai guardato/amato"), stesso filtro per genere con Anime e Romance adolescenziale inclusi, "Vedi tutto" in griglia paginata. Nuovo su smartphone, dove questa sezione non esisteva ancora.

### Lettore Android — stesso aspetto del web

La barra di avanzamento e lo schermo "Ottimizzazione in corso" (con il logo animato) sono stati ripresi identicamente su entrambi i client Android, per un'esperienza coerente indipendentemente dal dispositivo. Su smartphone, la miniatura che appare trascinando il cursore mostra ora un vero anteprima dell'immagine in quel momento, più di un semplice riferimento temporale.

### Monitoraggio download in tempo reale delle serie su Android TV

La scheda di una serie su Android TV mostra ora, per ogni episodio in recupero, il suo avanzamento, la velocità e il tempo rimanente — aggiornato in diretta, senza dover lasciare e riaprire la scheda. Allineato a quanto già proposto dal client smartphone.

## v1.19.32 — Agosto 2026

### Immagini caricate direttamente da Internet (opzionale)

Nuova impostazione in Impostazioni → Esperienza: locandine, sfondi e loghi possono ora essere caricati direttamente da TMDb anziché passare sistematicamente dal tuo server — utile se la tua connessione in upload è limitata. Ritorno automatico al tuo server se TMDb è indisponibile. Disattivato di default: nulla cambia finché non lo attivi. Un'altra impostazione, disponibile una volta attivata la prima, dà priorità al tuo server quando sei sulla tua rete domestica (nessun interesse a connettersi a Internet in questo caso).

## v1.19.31 — Agosto 2026

### Scoperta si personalizza davvero

Film e Serie ottengono ciascuno una sezione fissa su ciò che guardi di più (o che hai votato meglio) — mai visualizzata se non c'è ancora abbastanza storico. I titoli proposti vanno oltre il semplice genere: il motore di gusto già utilizzato altrove nell'app affina la classificazione in base allo stile reale del titolo che ha fornito il punto di partenza, non solo alla sua categoria TMDb.

## v1.19.30 — Agosto 2026

### L'anteprima ingrandita rimane visibile dopo aver aperto una scheda

Cliccare su una locandina per aprire la sua scheda lasciava l'anteprima ingrandita (con il suo video) a fluttuare sopra, invece di chiudersi. Ora si chiude immediatamente al clic.

## v1.19.29 — Agosto 2026

### Più trailer in formato verticale nelle anteprime

Da quando il teaser è preferito al trailer classico per gli sfondi animati (carosello, scheda, anteprima locandina), alcuni studi pubblicano il loro teaser in formato verticale (pensato per i social media) — stirato/ritagliato in un riquadro 16:9, il risultato era scadente. I video verticali sono ora esclusi dalla selezione; il teaser rimane sempre preferito quando esiste una versione nel formato corretto.

## v1.19.28 — Agosto 2026

### Anteprima video passando il mouse su una locandina

Su desktop, lasciare il cursore su una locandina di film o serie (dashboard, scoperta) per un secondo passa ora l'anteprima ingrandita sul trailer con sfondo animato, come nelle pagine scheda — disattivabile tramite Impostazioni → Esperienza → Anteprime video (la stessa impostazione copre ora entrambi i luoghi).

### I suggerimenti non includono più titoli non votati o non ancora usciti

I blocchi di suggerimenti (dashboard e Scopri) potevano proporre un titolo senza alcuna valutazione o ancora non in sala — niente da dire, niente da vedere. Mostrano ora solo titoli già valutati e già usciti, tranne i blocchi esplicitamente dedicati a ciò che sta arrivando presto.

### Client Android TV — nuovi blocchi Scopri

I blocchi aggiunti di recente sul web (acclamati dalla critica, universo anime, romanticismo adolescenziale, formato breve, blocchi per genere) vengono ora visualizzati con il loro titolo francese corretto sul client Android TV, anziché un titolo generico.

## v1.19.27 — Agosto 2026

### Il video traboccava in alto e in basso su uno schermo ultra-wide

Su uno schermo più largo del 16:9 (ultra-wide), il lettore non ridimensionava più correttamente il video: invece di mantenere le sue proporzioni con bande nere sui lati, si allungava alla larghezza della finestra e traboccava in alto e in basso, tagliando la parte superiore e inferiore dell'immagine. Corretto — il video mantiene sempre le sue proporzioni originali, indipendentemente dal formato dello schermo.

## v1.19.26 — Agosto 2026

### I nuovi blocchi Scopri non apparivano per tutti

La pagina Impostazioni permette di scegliere tra due presentazioni per Scopri ("Movviz" o "Allociné"). I nuovi blocchi aggiunti in v1.19.24 (acclamati dalla critica, universo anime, romanticismo adolescenziale, formato breve, blocchi per genere) erano stati collegati solo alla presentazione predefinita — invisibili per chiunque avesse scelto l'altra. Ora appaiono su entrambe, con lo stesso contenuto.

## v1.19.25 — Agosto 2026

### Ciclo di aggiornamento infinito su Android TV

L'applicazione si reinstallava un "aggiornamento" ad ogni avvio, anche poco dopo averne già applicato uno: il suo numero di versione interno rimaneva bloccato su un valore vecchio anziché seguire la versione effettivamente pubblicata, facendole credere di essere perpetuamente in ritardo. Ora propone un aggiornamento solo quando ce n'è davvero uno. Il numero di versione visualizzato in "Informazioni" del client Android smartphone era bloccato allo stesso modo (senza conseguenze, questo client non ha ancora un aggiornamento automatico) ed è corretto.

## v1.19.24 — Agosto 2026

### Scopri ampiamente arricchito e due nuovi generi condivisi

La pagina Scopri mostra ora molti più blocchi editoriali (acclamati dalla critica, universo anime, romanticismo adolescenziale, formato breve, più diversi blocchi per genere) oltre a quelli già presenti. Due nuovi generi appaiono nel menu Generi, ovunque esistano già: "Anime" e "Romanticismo adolescenziale" (pensato per un pubblico adolescenziale attuale, non per i bambini). Le pagine Film e Serie guadagnano anche un filtro per genere accanto ai filtri esistenti, con la stessa lista di generi di Scopri — incluso Anime e Romanticismo adolescenziale, per ritrovare facilmente ciò che si possiede già.

## v1.19.23 — Agosto 2026

### Ricerca di release fallita per un titolo originale in script non latino

Un film o una serie il cui titolo originale TMDb è scritto in giapponese, cinese, coreano, russo, arabo, tailandese... non trovava più alcuna release da scaricare: la ricerca automatica privilegiava sempre il titolo originale, ma nessuna release scene era mai nominata in queste scritture. Ora ricade sul titolo localizzato (quello visualizzato in Movviz) non appena il titolo originale non è utilizzabile per una ricerca, sia per i film che per le serie.

### Nuovo accesso alle impostazioni

La pagina Impostazioni si apre ora su una schermata iniziale con una ricerca per intenzione ("film mancante", "lentezza", "Plex"...), schede di stato (Plex, client di download, metadati, storage) e scorciatoie per le impostazioni più utilizzate. La barra laterale esistente rimane accessibile così com'è da qualsiasi impostazione — tutti i link `?tab=...` già in circolazione continuano a funzionare esattamente allo stesso modo.

### La pagina "Attività" si chiama ora "Download"

Il menu chiamava già questa sezione "Download", ma la pagina stessa mostrava ancora "Attività" / "Centro attività", e il suo indirizzo rimaneva `/activity`. Entrambi sono ora allineati: la pagina risiede in `/downloads` e mostra "Download" ovunque. Il vecchio indirizzo `/activity` reindirizza automaticamente al nuovo, mantenendo la scheda attiva — nessun link o segnalibro esistente si rompe.

## v1.19.22 — Agosto 2026

### Cambio traccia audio/sottotitoli: fine del fallback silenzioso al vecchio circuito

Correggerebbe una regressione seria del nuovo motore di riproduzione locale: cambiare lingua audio o sottotitolo durante la riproduzione lo faceva fallire e tornare al vecchio circuito Plex/HLS (badge "Trascodificato (audio)", posizione reimpostata a 0). Il cambio di traccia passa ora correttamente attraverso il nuovo motore end-to-end, senza alcun fallback. Il pulsante "Modalità trascodifica" (lampadina), che gestiva solo il vecchio circuito e non era più necessario, è stato rimosso. Correggerebbe anche un caso in cui una traccia audio inglese poteva apparire etichettata come "Francese" nel menu (l'etichetta proveniva da Plex, ora sovrascritta dai tag reali del file).

## v1.19.21 — Agosto 2026

### Il pollice in giù ovunque, e davvero utile per i suggerimenti

Il pollice in giù appare ora su tutte le schede (inclusa la libreria, senza mai rimuovere il titolo dalla tua collezione) — cliccarci sopra rimuove solo la scheda dalla riga visualizzata. Trasmette anche il genere del titolo al motore di raccomandazione, che ora può evitare titoli simili in futuro anziché solo escludere quel titolo specifico.

## v1.19.20 — Agosto 2026

### Il velo "ottimizzazione in corso" non seguiva l'effettivo avvio della riproduzione

Correggerebbe una regressione introdotta nella 1.19.17: il velo a schermo intero si chiudeva su un timer fisso di 1,5s invece di seguire l'effettivo avvio della riproduzione, cosa che poteva farlo scattare troppo presto (prima che un cambio audio fosse realmente pronto) o troppo tardi. Ora si chiude esattamente quando la riproduzione inizia realmente — diretta se nessun cambio è necessario, o trascodificata se è avvenuto un cambio.

## v1.19.19 — Agosto 2026

### Selezione di trailer e anteprime rivista in base al contesto

Il carosello della dashboard e lo sfondo animato della scheda titolo privilegiano ora un'anteprima (breve anteprima) piuttosto che un trailer completo, con fallback automatico se nessun'anteprima esiste — il contrario per l'azione volontaria "guardare il trailer" sulla scheda, che privilegia sempre il trailer completo. In entrambi i casi, l'ordine rispetta la lingua attiva dell'utente, poi la lingua originale del film o della serie, e infine le altre 4 lingue di Movviz. Il client Android TV beneficia della stessa selezione sul proprio carosello iniziale.

## v1.19.18 — Agosto 2026

### Pollice in giù sui suggerimenti

Un pulsante "non interessato" appare ora accanto al pollice in su nelle righe "Raccomandato per te" e "Tendenze" della dashboard: un clic esclude definitivamente il titolo dai futuri suggerimenti personalizzati e lo rimuove immediatamente dalla riga visualizzata.

## v1.19.17 — Agosto 2026

### Fine del flash "riproduzione diretta poi cambio audio" all'avvio

In riproduzione diretta, il rilevamento del silenzio audio avveniva in background mentre il video era già visibile e udibile per l'utente — quando l'audio risultava incompatibile, l'avvio diretto seguito dal cambio al trascodifica audio erano visibili sullo schermo, con un flash sgradevole. Ora un velo a schermo intero con l'animazione del logo Movviz nasconde tutto l'avvio, il tempo necessario per confermare che l'audio funziona (conferma quasi immediata nel caso normale, fino a 800ms nel caso raro di un silenzio reale da rilevare).

## v1.19.16 — Agosto 2026

### Il benchmark automatico ora attende che il server sia stabilizzato

Riscontrato in condizioni reali subito dopo il deployment della 1.19.14: la prima esecuzione automatica del benchmark (subito dopo un aggiornamento) misurava un risultato nettamente inferiore rispetto a un secondo tentativo manuale pochi istanti dopo, sullo stesso server — contaminato dal carico di avvio del server stesso, non un vero riflesso delle sue capacità. Un breve ritardo prima dello scatenamento automatico permette ora al server di stabilizzarsi prima.

## v1.19.15 — Agosto 2026

### Sottotitoli non-UTF-8 (vecchie release francesi) finalmente affidabili

Un sottotitolo codificato in un vecchio formato (Windows-1252, comune nelle vecchie release francesi) faceva crashare l'incorporamento immagine e produceva un file di sottotitoli vuoto senza errore visibile per l'estrazione. Rilevamento automatico della corretta codifica prima dell'elaborazione — un file già correttamente codificato (la immensa maggioranza oggi) non viene mai modificato.

## v1.19.14 — Agosto 2026

### Benchmark del server, pulizia del selettore di riproduzione manuale e diverse correzioni di fondo

- **Benchmark del server** (Impostazioni → Prestazioni): misura direttamente la velocità reale di transcodifica di questo server per casi rappresentativi (software semplice, software con conversione HDR→SDR, hardware se disponibile) — invece di scoprirlo durante la riproduzione. Si avvia manualmente, automaticamente subito dopo l'installazione di un aggiornamento, e una volta al mese tramite un task pianificato.
- **Rilevamento HDR dello schermo corretto**: il browser non dichiarava mai la sua reale capacità HDR al server — corretto con un rilevamento vero.
- **Selettore manuale "Modalità transcodifica" pulito**: queste opzioni (Solo audio, Solo video, HLS manuale) pilotavano solo il vecchio circuito Plex — proposte su contenuto puramente locale, fallivano silenziosamente. Appaiono solo quando esiste un vero link Plex.
- **Artwork incorporato mai confuso con il video principale**: un file con un'immagine di copertina incorporata poteva, in rari casi, far analizzare questa immagine come se fosse il film.
- **Limite di sessioni di transcodifica condiviso** tra il nuovo motore e il vecchio circuito Plex, invece di due limiti indipendenti che potevano sommarsi.
- **Pulizia all'arresto del server**: i processi di transcodifica ancora attivi vengono ora interrotti correttamente durante un riavvio/ri-deployment, invece di rimanere orfani.

## v1.19.13 — Agosto 2026

### Nuovo motore (sperimentale): HDR/Dolby Vision non forza più mai una transcodifica video

Cambio di fondo piuttosto che un'impostazione in più: uno scostamento HDR o Dolby Vision tra il file e il dispositivo di riproduzione non scatena più, da solo, una transcodifica video. Il video viene copiato così com'è — un decoder non compatibile con Dolby Vision visualizza comunque l'immagine correttamente, solo con un rendering dei colori leggermente meno preciso rispetto alla versione perfettamente calibrata. Su hardware modesto, evitare una costosa transcodifica video (spesso destinata a non seguire la riproduzione in tempo reale) prevale ampiamente su questo compromesso di rendering. Una vera transcodifica video rimane scatenata normalmente per qualsiasi incompatibilità reale (codec, profilo, livello, profondità di colore, risoluzione) — in questo caso, la conversione HDR→SDR viene comunque applicata.

## v1.19.12 — Agosto 2026

### Nuovo motore (sperimentale): la conversione HDR→SDR rimaneva troppo pesante anche dopo la 1.19.11

Misurato in diretta sul contenuto più esigente possibile (4K Dolby Vision), senza alcun altro carico sul server: la riproduzione procedeva solo a circa il 30% della velocità reale necessaria, in modo stabile su più misurazioni — non un semplice rallentamento all'avvio.

- **Corretto**: il limite di risoluzione per la combinazione codifica software + conversione HDR→SDR passa da 1280 a 720 pixel di larghezza. La conversione HDR→SDR stessa (non il decoding, fisso indipendentemente dalla risoluzione di output) domina ampiamente il tempo di calcolo su questo tipo di contenuto — ridurre ulteriormente la risoluzione target riduce direttamente il suo costo. Rimane da riconfermare in condizioni reali.

## v1.19.11 — Agosto 2026

### Nuovo motore (sperimentale): preset di codifica più veloce per il caso HDR→SDR più esigente

Completa direttamente la correzione della 1.19.10: chiede al codificatore software di ottimizzare meno la compressione (file un po' più grande, in cambio di molta meno elaborazione per immagine) lascia un vero margine per rimanere davanti alla riproduzione — applicato solo alla combinazione codifica software + conversione HDR→SDR, l'unica che ne aveva bisogno; tutto il resto (incluso un semplice codifica software senza HDR) mantiene esattamente la stessa impostazione di prima.

## v1.19.10 — Agosto 2026

### Nuovo motore (sperimentale): la conversione HDR→SDR aveva bisogno del proprio limite di risoluzione

Terza correzione trovata testando in diretta sul server di produzione, su un contenuto ancora più esigente (4K Dolby Vision): anche dopo le due correzioni della 1.19.08 e della 1.19.09, questo contenuto specifico rimaneva sempre in buffer senza mai avanzare.

- **Causa trovata e corretta**: la conversione HDR in SDR (necessaria quando il dispositivo di riproduzione non sa visualizzare l'HDR) aggiunge un vero costo di elaborazione supplementare, oltre alla semplice codifica — confermato confrontandolo direttamente con un contenuto 4K di risoluzione equivalente che non richiedeva questa conversione, che seguiva perfettamente la riproduzione. Il limite di risoluzione per una codifica software è ora più rigoroso specificamente quando è necessaria anche una conversione HDR→SDR, per dare a questo caso più esigente una vera possibilità di rimanere davanti alla riproduzione in tempo reale.

## v1.19.09 — Agosto 2026

### Nuovo motore (sperimentale): il video di riserva seguiva male la diretta su server modesto

Ancora trovato testando davvero in produzione, questa volta segnalato da una vera visione: su un contenuto 4K senza codificatore hardware realmente utilizzabile (vedi la correzione della 1.19.08), il transcodifica rimaneva in loop nel buffer ogni pochi secondi invece di seguire normalmente la riproduzione.

- **Causa trovata e corretta**: quando nessun codificatore hardware è realmente disponibile, il formato video target del transcodifica veniva scelto solo in base a ciò che il dispositivo di riproduzione preferisce decodificare (spesso il più compresso, quindi il più costoso da produrre) — senza mai tenere conto del fatto che la codifica sarebbe avvenuta in software. Ma una codifica software di questo formato è nettamente più lenta di un formato più semplice, tanto da non seguire più la riproduzione in tempo reale su hardware modesto. Il server sceglie ora il formato più semplice da codificare in software non appena nessun codificatore hardware è realmente utilizzabile, mantenendo al contempo il formato più efficiente non appena è disponibile un vero codificatore hardware.

## v1.19.08 — Agosto 2026

### Nuovo motore (sperimentale): correzione critica, validata in condizioni reali

Attivazione della modalità "Auto" testata davvero sul server di produzione (hardware modesto, senza scheda grafica dedicata) — un primo film (copia video + audio transcodificati) ha funzionato perfettamente, ma un secondo (4K HDR, transcodifica video completa) è fallito immediatamente con un messaggio fuorviante che invitava ad aprire in Plex, mentre questo film non ha alcun legame con Plex.

- **Causa trovata e corretta**: il server si fidava dell'elenco dei codificatori video compilati in ffmpeg per decidere se poteva utilizzare l'accelerazione hardware — ma un codificatore compilato non significa che l'hardware corrispondente sia realmente presente. Su questo server, un codificatore Intel QuickSync era ben compilato ma nessun chip Intel compatibile era esposto, e il tentativo di codifica falliva subito, senza rete di sicurezza. Il server tenta ora una vera micro-codifica di verifica per ogni famiglia di accelerazione hardware prima di fidarsi, e passa alla codifica software se questo test fallisce realmente.

## v1.19.07 — Agosto 2026

### Nuovo motore (sperimentale): audit completo e correzioni di fondo

Dopo un audit sistematico dei fondamenti del transcodifica (due passaggi dedicati, incluso un controllo completo delle verifiche rispetto al piano originale):

- **Qualità video corretta sull'encoder hardware**: la impostazione di qualità (`-crf`) veniva ignorata silenziosamente da qualsiasi encoder hardware (NVENC/QuickSync/VAAPI/AMD), producendo un bitrate fisso molto basso indipendentemente dalla risoluzione — verificato in diretta su hardware NVIDIA reale, un encoding 4K ne usciva con la stessa qualità di un encoding minuscolo. Ogni famiglia di encoder utilizza ora la propria impostazione di qualità reale.
- **Limite di risoluzione per l'encoding software** (nessun encoder hardware disponibile, tipicamente un NAS): una sorgente 4K viene ora ridotta a 1080p prima dell'encoding software, per rimanere in grado di seguire la riproduzione in tempo reale piuttosto che rischiare di andare in ritardo.
- **Scorrimento (scrub) più preciso durante la trascodifica**: mancava un intervallo di fotogrammi chiave, facendo tornare il cursore di circa 10 secondi indietro invece della posizione cliccata — corretto a 2 secondi.
- **Font mancanti per l'incapsulamento dei sottotitoli in produzione**: i sottotitoli immagine (PGS/VobSub, la quasi totalità dei BluRay) rendevano il testo invisibile o facevano crashare la trascodifica — l'immagine Docker ora installa i font necessari.
- **Rilevamento capacità del browser affinato**: la profondità di colore (8/10 bit) e la risoluzione massima decodificabile sono ora verificate con precisione per codec, anziché essere ignorate per mancanza di dati — un file HDR a 10 bit che il browser non può effettivamente decodificare viene ora correttamente identificato come incompatibile anziché lasciato in riproduzione diretta.
- **Correzione AC-3/E-AC-3**: un canale ritenuto compatibile sulla sola base di un segnale tecnico non relativo a questo motore poteva produrre un flusso muto — corretto per fare affidamento sul segnale corretto.

Si segnala per dopo (vedi `TODO_POST_MOTEUR_LECTURE.md`): encoding dei sottotitoli non-UTF-8 (vecchie release francesi), cascata di fallback interna in caso di fallimento durante la riproduzione, pannello diagnostico dettagliato.

## v1.19.06 — August 2026

### Nuovo motore (sperimentale) attivato di default per contenuti locali, e correzione audio importante

- Il "Nuovo motore" non si limita più alla selezione manuale in Impostazioni → Plex: in modalità "Auto" (di default), ora prende automaticamente il sopravvento per un film/episodio locale (non collegato a Plex) il cui audio o video deve essere adattato — un caso che fino ad ora non aveva alcun sistema di backup funzionante ed falliva sistematicamente.
- Correzione importante: un canale audio 5.1/7.1 trascodificato non veniva ridotto al corretto numero di canali — usciva in 5.1/7.1 anche su un'uscita audio 2.0, con voci mancanti (il canale centrale, dove si trova generalmente il dialogo, non veniva correttamente ridotto sui canali sinistro/destro). Un sistema che non dichiara esplicitamente più di 2 canali viene ora trattato come stereo di default, e l'audio viene correttamente ridotto al corretto numero di canali al momento della trascodifica.
- Correzione: un tentativo di ricerca (seek) mentre ne stava ancora avvenendo un precedente poteva, in rari casi, risolversi in modo disordinato e far riprodurre un flusso corrispondente a una posizione diversa da quella visualizzata — ora, solo l'ultima richiesta di spostamento può avere effetto.

## v1.19.05 — August 2026

### Nuovo motore (sperimentale): gestione HDR / Dolby Vision affinata

- Un file Dolby Vision la cui base rimane compatibile con HDR10 (la grande maggioranza dei recenti BluRay UHD) viene ora riprodotto direttamente, senza trascodifica inutile, anche se il dispositivo non dichiara esplicitamente il supporto Dolby Vision.
- Quando nessuna conversione diretta è possibile (Dolby Vision non compatibile con HDR10, o HDR10/HLG su un dispositivo che non lo dichiara), il video viene correttamente convertito in SDR durante la trascodifica anziché essere ri-encoderizzato con colori HDR grezzi mal interpretati.
- Riguarda solo il "Nuovo motore (sperimentale)" introdotto in v1.19.04 — comportamento di default invariato.

## v1.19.04 — August 2026

### Nuovo motore di riproduzione (sperimentale, manuale, file locali)

- Impostazioni → Plex → Lettore beta propone una nuova opzione motore di riproduzione, "Nuovo motore (sperimentale)" — mai attivata automaticamente, da selezionare esplicitamente. Per un film o una serie recuperato localmente, sostituisce/adatta il file tramite un'analisi tecnica reale (ffprobe) anziché semplici supposizioni: remux del contenitore, adattamento audio, transcodifica video con scelta di encoder hardware se il server ne dispone, e incorporazione dei sottotitoli quando nessuna altra soluzione è possibile.
- Colma una vera lacuna: finora, un file locale (non collegato a Plex) il cui audio non era leggibile dal browser non aveva alcun piano di riserva — la riproduzione falliva semplicemente. Questa opzione corregge questo caso specifico, senza modificare il comportamento predefinito.

## v1.19.03 — Agosto 2026

### Analisi tecnica estesa alle serie, e badge audio corretto per la lingua francese

- L'analisi tecnica (ffprobe) copre ora anche gli episodi delle serie, non solo i film: Impostazioni > Manutenzione propone una sezione dedicata alle serie (gli stessi due pulsanti, analisi abituale e analisi completa), e un episodio appena recuperato viene analizzato automaticamente al suo arrivo, come accadeva già per i film.
- Correttivo: su un file con più tracce audio (es. francese in TrueHD, inglese in AAC), la pastiglia del codec audio poteva mostrare la traccia inglese anche se non era la traccia principale — ora privilegia la traccia francese quando esiste.

## v1.19.02 — Agosto 2026

### Pastiglie qualità corrette automaticamente dall'analisi tecnica

- Una volta analizzato un film (ffprobe), le sue pastiglie risoluzione/codec video/codec audio/HDR sulla scheda vengono corrette automaticamente se erano errate o mancanti — senza mai cancellare nulla per un film non ancora analizzato.
- Corregge un vero bug riscontrato durante i test: un film 4K ritagliato per un rapporto cinematografico poteva essere classificato erroneamente in 1080p.

## v1.19.01 — Agosto 2026

### Analisi tecnica: automatica al recupero di un film, e pulsante "Analisi completa"

- Un film analizzato tecnicamente (ffprobe) non appena viene recuperato — non è più necessario avviare l'analisi manualmente affinché un film appena scaricato sia coperto.
- Impostazioni > Manutenzione propone ora due pulsanti: l'analisi abituale (ignora ciò che è già aggiornato) e un "Analisi completa" che forza la rianalisi di tutto il catalogo.

## v1.19.00 — Agosto 2026

### Analisi tecnica della libreria (ffprobe)

- Nuovo pulsante in Impostazioni > Manutenzione: analizza ogni film tramite ffprobe (codec esatto, profilo, HDR/Dolby Vision, tracce audio e sottotitoli reali) e memorizza il risultato per file — il primo mattone del futuro motore di riproduzione, che potrà così decidere la migliore strategia di riproduzione senza rianalizzare un file già noto.
- Funziona in background come le altre analisi della libreria, con la propria barra di avanzamento.

## v1.18.08 — Agosto 2026

### Libreria: barra degli strumenti snellita (Film e Serie)

- Filtri "Download" e "In arrivo" rimossi (ridondanti con il badge di stato visualizzato su ogni scheda).
- Il tag automatico "plex" (applicato a tutto ciò che proviene da una sincronizzazione Plex, quindi mai un filtro utile vero) non appare più nell'elenco dei tag.
- Le 3 azioni admin (ricerca dei mancanti, riconciliazione disco, ricerca e sostituzione) passano in icone compatte con info-bolla — la ricerca dei mancanti mantiene il suo contatore di avanzamento in un piccolo badge.

## v1.18.07 — Agosto 2026

### Correttivo: l'eroe della dashboard scompariva casualmente

- Causa identificata nella console: un trailer (lettore YouTube) poteva entrare in collisione con l'animazione di transizione nel momento esatto in cui l'eroe si smontava, facendolo scomparire fino al ricaricamento completo della pagina. Ora si rivisualizza da solo pochi istanti dopo.
- Rafforzamento: due campi mancanti nei dati di un suggerimento (generi, motivi della scelta) non possono più far crashare l'eroe.

## v1.18.06 — Agosto 2026

### Menu laterale: "Collezioni" non rimane evidenziato, "Download" spostato

- "Collezioni" reindirizzava alla Libreria prima che venisse calcolato l'evidenziamento attivo — ora rimane correttamente evidenziato una volta sulla pagina.
- "Attività" rinominato in "Download" e spostato subito sotto Collezioni.

## v1.18.05 — Agosto 2026

### Correzione: menu azioni tagliato sulle schede Libreria

- Il menu "•••" (ottimizza, ricerca, tag, eliminazione) delle schede Film/Serie poteva apparire troncato — risiedeva in un contenitore che nascondeva ogni sbavamento. Ora viene sempre visualizzato per intero.

## v1.18.04 — Agosto 2026

### Menu laterale riorganizzato

- Film, Serie e Collezioni hanno ora ciascuno la propria voce diretta nel menu (invece di essere annidati sotto "Libreria").
- "Ricerca" rinominato in "Torrent".
- Nuova sezione a fisarmonica "Gestione" che raggruppa Richieste, Attività, Cronologia, Cestino, Problemi e Utenti.

## v1.18.03 — Agosto 2026

### Libreria: rifacimento completo sul linguaggio visivo di Scoperta/Dashboard

- Le schede Film/Serie della Libreria adottano ora la stessa scheda di Scoperta e Dashboard: vero visivo 16:9 con logo del titolo sovrapposto (piuttosto che un poster verticale), e anteprima arricchita al passaggio del mouse (anno, durata, generi) invece di un semplice banner.
- Tutte le azioni esistenti rimangono accessibili al passaggio del mouse tramite un menu compatto: marcare visto, ottimizzare, ricerca automatica, ricerca manuale, tag, eliminazione (admin) — nulla è stato rimosso, solo riorganizzato per rimanere minimalista.

## v1.18.02 — Agosto 2026

### Libreria: stesso linguaggio visivo di Scoperta

- Menu Generi di Scoperta: ora si chiude al clic esterno o al tasto Esc (prima rimaneva aperto).
- Schede Film/Serie della Libreria: ingrandimento al passaggio del mouse più marcato e banner generi/durata, nello stesso spirito di Scoperta — tutte le azioni esistenti (ottimizzare, ricerca manuale, tag, eliminazione) rimangono invariate.

## v1.18.01 — Agosto 2026

### Correzione: icona tagliata nella barra di navigazione mobile su schermo stretto

- Su un telefono con schermo più stretto della media (es. Galaxy Z Flip6), l'ultima icona della barra di navigazione inferiore traboccava fuori dallo schermo, semi-invisibile. Le 5 icone sono ora sempre distribuite equamente sulla larghezza reale dello schermo, indipendentemente dal dispositivo.

## v1.18.00 — Agosto 2026

### Smartphone Android — lettore nativo

- Nuovo lettore nativo (Media3/ExoPlayer) con servizio di riproduzione in background — sostituisce la vecchia riproduzione incorporata, controlli bloccabili sullo schermo e notifica media persistente.

## v1.17.11 — Agosto 2026

### Smartphone Android — rifinitura UX premium (40% Netflix / 60% TV)

- **Design system Movviz mobile** : palette Void/Abyss + viola/magenta in accenti 80/20 (il contenuto resta la star), superfici profonde, glass controllato, token unificati TV.
- **Capsula flottante** : bottom nav traslucido scuro con bordo sottile, dietro il contenuto, animazione spring sulla scheda attiva (icona + etichetta), rispetto totale di navigationBarsPadding — più nessuna barra Material a larghezza intera.
- **Top bar** : trasparente sul contenuto, glass progressivo allo scroll, contenuto che risale dietro.
- **Hero** : 62% viewport, edge-to-edge, doppio gradiente (alto trasparente → basso profondo), logo/titolo, metadati concisi, CTA “Riproduci” bianco + azioni glass [ + ] [ ⓘ ], ammorbidimento delle righe sottostanti.
- **Rails** : densità Netflix — ~3 poster + anteprima del successivo, LazyRow + peeking (fine 12dp), tap scale 0.96 spring, titoli 16sp bold, rating ★.
- **Ricerca** : campo immediato, debounce 280ms, icone leading/trailing, stati vuoto / nessun risultato, risultati densi (poster 52×74 + titolo + anno/tipo).
- **Profili** : scheda glass “Profilo attivo” con avatar gradiente e chevron, disconnessione.
- Nessuna regressione funzionale: backend, API, android-shared, auth, profili, repository, Media3, Direct Play, fallback, sottotitoli riutilizzati tali e quali.

## v1.17.10 — Agosto 2026

### Android smartphone — prima base nativa

- Nuovo client Jetpack Compose touch, separato da desktop e Android TV.
- Onboarding server connesso alle API Movviz esistenti, navigazione mobile e
  livello condiviso per i modelli, la sessione e la rete.
- APK debug e release firmati con la stessa chiave retail dell'applicazione TV.

## v1.17.08 — Agosto 2026

### Desktop — passaggio del mouse sulle schede

- La dimensione calcolata dei loghi è riutilizzata tra la scheda e la sua anteprima
  fluttuante, per un'visualizzazione immediata al passaggio del mouse.
- Il ritardo di intenzione del passaggio del mouse è ridotto senza modificare il comportamento
  dei link o delle azioni di riproduzione.

## v1.17.07 — Agosto 2026

### Desktop — loghi delle schede stabili

- I loghi TMDb sono misurati localmente prima dell'visualizzazione per apparire
  direttamente nelle loro dimensioni finali, senza animazione di ingrandimento.
- Il caricamento dei loghi rimane stabile durante lo scorrimento e gli errori
  di immagine non lasciano più una scheda in stato invisibile.

## v1.17.06 — Agosto 2026

### Android TV — Riprogettazione 10-foot

- Barre di navigazione e hero ridotti per mostrare più contenuti all'arrivo.
- Schede di benvenuto in 16:9 con riutilizzo degli sfondi editoriali del desktop e piega poster affidabile.
- Selettore profili compatto, pilotabile con D-pad, con anteprima del profilo e aggiunta utente.

## v1.17.05 — Agosto 2026

### Visual — priorità dei loghi TMDb

- Per l'interfaccia francese, i loghi sono ora ordinati in questo modo:
  Francia, francese neutro, Canada, inglese. Le altre interfacce privilegiano
  l'inglese. La cache dei visual ri-seleziona le vecchie scelte senza
  eliminare le immagini già scaricate.

## v1.17.04 — Agosto 2026

### Desktop — larghezza dei loghi delle schede

- I loghi la cui area realmente visibile è inferiore al 40 % della
  larghezza di una scheda raggiungono ora questa soglia, mantenendo strettamente
  le loro proporzioni. I loghi già più larghi non vengono mai ridotti.

## v1.17.03 — Agosto 2026

### Riproduzione — sorgente locale indipendente da Plex

- Correggono le schede che mostravano "In attesa di sincronizzazione Plex"
  nonostante un file locale già disponibile. Un film o episodio Movviz terminato
  apre ora immediatamente il lettore tramite la sua sorgente locale; il collegamento
  Plex rimane un arricchimento asincrono e non blocca più la riproduzione.
- Il lettore nasconde correttamente il link "Guarda su Plex" quando nessuna URL
  Plex è ancora nota.

## v1.17.02 — Agosto 2026

### Desktop — loghi delle schede

- I loghi ufficiali circondati da ampi margini trasparenti guadagnano
  ora fino al 90 % della dimensione visiva. I marchi già larghi e
  stretti rimangono alla loro scala naturale, per mantenere una gerarchia
  propria da una scheda all'altra.

## v1.17.01 — August 2026

### Scoperta — C411

- Corregge le righe C411: ogni voce è nuovamente risolta dalla sua
  scheda TMDb completa (poster, sfondo 16:9, titolo e valutazione). Se l'identificatore
  trasmesso da C411 è assente, scaduto o ambiguo, titolo e anno servono
  da riserva sicura invece di lasciare una scheda vuota.

## v1.17.00 — August 2026

### Desktop — visual, scoperta e lettura

- I visual delle schede dispongono di tre cancellazioni separate: tutto il
  copertura visiva, solo i loghi, o solo gli sfondi/poster. Le
  associazioni durature titolo → immagine sono mantenute: completare la copertura
  ripristina solo il file mancante, senza scaricare nuovamente l'altro.
- La cache delle risposte TMDb passa a 35.000 voci affinché una libreria
  completa non venga più esclusa prematuramente al limite di 3.500 chiavi.
- I generi dispongono ora del proprio hero editoriale, come Film
  e Serie. L'hero è più alto e adatta correttamente gli sfondi 16:9.
- I loghi trasparenti sono ingranditi in base alla loro area visibile: i piccoli
  marchi con ampi margini guadagnano in leggibilità senza ingrandire i loghi
  naturalmente ampi. Una scheda senza sfondo utilizza almeno il suo poster,
  invece di rimanere vuota.
- Su uno schermo ultra-wide, il lettore preserva il rapporto video in schermo
  intero (fasce laterali se necessario). Il cursore scompare con i
  controlli dopo l'inattività, e una ripresa esplicita parte direttamente
  senza secondo popup; gli offset di sessione sono convertiti da ms in s.
- Tutti i titoli visibili sono ora trattati, ritagliati solo in
  pacchetti di rete interni: nessun limite globale priva le righe inferiori
  (Top, suggerimenti, aggiunte recenti…) dei loro loghi o dei loro sfondi.
- Le anteprime di «Riprendi» mostrano l'azione con timestamp e «Da
  "inizio", con i badge di risoluzione, HDR, video e audio del file reale.

## v1.16.82 — Agosto 2026

### Desktop — riproduzione affidabile

- Corregge la durata reale dei flussi FFmpeg frammentati: il lettore, la barra
  di avanzamento, i riprese e la soglia di fine utilizzano ora la durata
  Plex del media, anziché i pochi secondi già tamponati.
- I controlli del lettore si ritirano durante la riproduzione e riappaiono
  al movimento del mouse, alla pausa, al buffering o all'apertura di un
  menu. L'anteprima immagine sulla barra di avanzamento viene mantenuta.
- Lo schermo intero punta al contenitore Movviz con l'API del browser: gli stessi
  comandi, il seek reale e i sottotitoli rimangono quindi presenti, invece
  di passare ai controlli video nativi.

### Desktop — schede editoriali

- Il pulsante Riproduci di una scheda disponibile avvia ora direttamente il
  lettore Movviz (film, riprese ed episodi), invece di riaprire la sua scheda.
- Quando un titolo non dispone di uno sfondo TMDb neutro, le schede utilizzano
  la sua illustrazione 16:9 localizzata e non aggiungono né logo né titolo una seconda
  volta. Le scelte vuote della vecchia cache vengono aggiornate automaticamente.

## v1.16.81 — Agosto 2026

### Desktop — anteprima delle schede

- Il passaggio del mouse non mostra più il pulsante "Informazioni": cliccare l'immagine
  apre direttamente la scheda Movviz. Le azioni riprendono il linguaggio
  Netflix: riproduzione se il titolo è nella libreria, aggiunta reale altrimenti,
  Mi piace e accesso alla scheda.
- Mi piace registra immediatamente una nota esplicita di cinque stelle.
- L'anteprima mostra quindi i badge anno/durata, poi fino a tre generi
  pertinenti, recuperati solo al passaggio del mouse se la riga non li possiede.
- Le richieste di visualizzazioni richiedono esplicitamente `fr-FR`; la cache delle scelte
  de visualizzazioni migra senza cancellare sfondi e loghi già scaricati.
- La selezione dello sfondo privilegia ora un vero formato 16:9, una buona
  risoluzione e i voti TMDb piuttosto che un visual mal inquadrato o isolato.

### Desktop — stabilità dello scorrimento

- Corregge la barra di scorrimento che poteva scomparire dopo una chiusura
  di scheda o di lettore: gli overlay condividono ora un blocco di
  scorrimento contato, compatibile con le loro animazioni di uscita.
- Il registro della cache è condiviso tra tutti i bundle Next: i contatori
  "raggiunti / mancati", la cache TMDb e la sua azione di svuotamento riflettono a
  presente la stessa istanza dopo navigazione o riavvio.

## v1.16.80 — August 2026

### Cache visuale — completo incrementale

- Il passaggio incrementale gira ora in modo duraturo in tutta la
  libreria, inclusi i titoli già presenti: verifica i file
  locali backdrop/logo e scarica solo quelli mancanti. L'visualizzazione
  in tempo reale di una scheda o di un risultato di ricerca alimenta la stessa cache.
- La capacità della cache delle risposte API passa a 3 500 chiavi; Impostazioni → Cache
  mostra ora il numero utilizzato e il suo limite esplicito.

## v1.16.79 — August 2026

### Desktop — schede editoriali e cache immagini

- Le fasce editoriali di Home, Film e Serie passano a grandi
  schede 16:9 (300–360 px) con una anteprima al passaggio del mouse proporzionata.
- Ogni scheda sceglie uno sfondo TMDb neutro, poi gli applica il logo
  ufficiale; quando non è disponibile nessuno sfondo neutro, Movviz conserva il
  titolo testuale invece di duplicare un logo già stampato nell'immagine.
- Aggiunge una cache persistente delle coppie backdrop/logo, riempita immediatamente
  da Home, hero e ricerca. I file TMDb immutabili sono
  realmente conservati su disco da Movviz e un anno nel browser,
  senza richiesta TMDb per scheda.
- Impostazioni → Cache aggiunge "Completare cache" e "Aggiorna
  incrementale". Un compito giornaliero recupera solo i nuovi
  titoli, assenze o rari fallimenti di rete, senza ritardare l'interfaccia.
- Allinea le versioni web, Android TV, package lock, badge e metadati di
  release su `1.16.79`.

## v1.16.78 — Agosto 2026

### Desktop — scoperta, serie e lettura

- Le schede editoriali di Home, Film e Serie utilizzano ora dei
  veri sfondi TMDb 16:9, con il logo ufficiale del titolo o un titolo testuale
  stabile quando nessun logo è disponibile. Una vera assenza di sfondo
  visualizza una scheda Movviz neutra invece di ritagliare un poster verticale.
- Home arricchito: hero con fallback stabile dopo tre secondi, sezioni
  miste intenzionalmente, formati brevi, hover desktop fluttuante e ritrazione
  de falsi indicatori di scorrimento vuoti.
- Film e Serie hanno i loro cataloghi dedicati, un eroe proprio per il loro tipo e
  un selettore Genere, mantenendo al contempo l'apertura delle schede nel
  pannello Movviz unico.
- Schede serie: stagioni assenti correttamente scaricabili, stagione 0
  nascosta quando non esiste, lancio diretto di un episodio disponibile,
  pulsante e sequenza dell'episodio successivo se presente.
- Ripara il percorso Auto di riproduzione: una ripresa può ripartire tramite FFmpeg,
  i file locali risalgono codec/tracce audio/disponibilità FFmpeg, e
  HLS Plex diventa il supporto finale dopo un fallimento reale — mai un errore falso
  « Riproduzione HLS disattivata ».
- Allinea le versioni web, Android TV, package lock, badge e metadati di
  release su `1.16.78`.

## v1.16.77 — Agosto 2026

### Desktop e Android TV

- Modernizza il lettore desktop: dock cinematografico, progressione persistente,
  menu unificati e azioni intro/generiche più leggibili, senza rimuovere i
  modi Auto, Diretto, transcodifica audio/video o HLS Plex.
- Prepara le sezioni Home desktop per schede editoriali 16:9 e un
  passaggio flottante, mantenendo la Libreria tecnica verticale.
- Android TV: corregge i ritorni di focus D-pad, avvia direttamente un episodio
  disponibile e armonizza stati di focus, ricerca e riproduzione.
- Aggiunge il piano di tracciamento versionato del redesign UX desktop.
- Allinea le versioni web, Android TV e metadati di rilascio su `1.16.77`.

## v1.16.76 — Agosto 2026

- Sincronizza la versione web e Android TV per il rilascio successivo.

## v1.16.75 — Agosto 2026

### Correttivi rilascio e riproduzione locale

- Allinea le versioni Web, Android TV e metadati di rilascio.
- Corregge le richieste HTTP `Range` per lo streaming locale.

## v1.16.73 — Agosto 2026

### Correttivi compilazione Android TV

- Corregge l'annotazione Moshi del modello di marcatori.
- Aggiunge l'importazione dell'animazione `slideInVertically` utilizzata dal pulsante skip.

## v1.16.72 — Agosto 2026

### Backend Movviz di progressione e ripresa multi-client

- Aggiunge lo storage backend per utente, sessioni, heartbeat e protezione contro i seek accidentali.
- Desktop e Android TV utilizzano ora le sessioni Playback Movviz.
- I marcatori intro/crediti v1.16.71 vengono ancora serviti dalla cache Movviz.
- La completazione sincronizza lo stato visto con Plex e arricchisce Continua a guardare con le riprese Movviz.

Tutte le modifiche notevoli a Movviz, raggruppate per traguardo di sviluppo.

---

## v1.16.71 — Agosto 2026

### Plex Intro/Credits → Movviz → Android TV (Passare intro / generico)

**Architettura:** `Plex → sync Movviz (cfg.adminToken) → playback-markers.json → /api/stream/{ratingKey}/info → Android TV → ExoPlayer → pulsante contestuale`. Nessuna richiesta Plex all'avvio di una riproduzione, nessun token Plex lato TV.

**Backend:**
- Nuovo modello generico `PlaybackMarker` (intro/credits) e store `playback-markers.json` (ricerca O(1) per ratingKey, versione 1, migrazione, readJsonCached/writeJsonCached).
- Nuovo stato `plex-marker-sync-state.json` (dirty, knownUpdatedAt, emptyRetry 7j, auditBucket 0..6).
- Tipo grezzo `PlexMarker` interno plex, estensione `PlexServerConfig.markerSyncEnabled` (default false, mai esposto lato client).
- `batchMarkers(cfg,cfg.adminToken,ratingKeys)` chunk 50, `includeMarkers=1`, distinzione errore ≠ zero marker (il guasto Plex non elimina mai i dati locali).
- Normalizzazione (solo intro/credits, validazione, ordinamento ASC), firma deterministica SHA16, preservazione multi-blocchi credits (mid/post-credit non uniti).
- Motore `markerSync.ts`: incr (dirty + mai-sync + tentativi scaduti + bucket audit del giorno), full (tutte le plexRatingKey Movviz), retry 7j, audit rotante stableHash%, GC solo se full completo, progressione reale, yieldToUser tra batch, log sobri, withKeyLock + sourceId `plex-marker-sync`.
- Hook `registerMarkerCandidate` in `librarySync` (film + ogni episodio), disaccoppiamento library 5min → marker 24h.
- Task pianificato giornaliero `plex-marker-sync` (24h, controllo markerSyncEnabled), mappatura JobType `plexMarkerSync` + priorità.
- Route `POST /api/plex/marker-sync` (admin, enqueueJob sourceId, ritorno immediato queued/jobId) + `GET` statistiche, route `GET /api/plex/config` e `PUT` estese (markerSyncEnabled, mai token).

**Desktop Impostazioni > Plex:** sezione Intros e generici (toggle ON/OFF, date, contatori, pulsanti incrementale/completo, polling jobRunning via /api/plex/marker-sync + /api/jobs).

**API riproduzione:** `GET /api/stream/{ratingKey}/info` inietta `markers[]` dallo store locale (try/catch → [] se non disponibile).

**Android TV:**
- `PlaybackMarkerDto` + `StreamInfoDto.markers` (default emptyList, compatibile con backend vecchio).
- `PlayerActivity`: caricamento markers tramite streamInfo, rilevamento activeMarker ogni 500ms, etichette Passare intro/generico, seekTo(endMs) senza stato consumato, ripresa/seek/fallback/palette invariati.
- Focus D-pad condizionale, PlaybackActionOverlay unificato (Skip sopra Up Next), visuale glass 150-250ms.

---

## v1.16.70 — August 2026

### Android TV: Impostazioni nell'icona ingranaggio

- La scheda testuale "Impostazioni" lascia la barra di navigazione: un **icona ingranaggio** (disegnata, stesso stile della lente d'ingrandimento) prende il posto tra la lente di ricerca e l'avatar profilo. Bordo focus bianco (gradiente del marchio quando la scheda è attiva).

---

## v1.16.69 — August 2026

### Android TV: fine dello scroll automatico all'apertura, corretta race condition stagioni

#### Auto-scroll all'apertura delle schede (richiesto in diretta)
- Spec di scroll MINIMALE (comportamento mobile) su scheda titolo e scheda autore, invece del pivot TV (~30% del bordo) che faceva scorrere la scheda da solo non appena il focus iniziale atterrava sul CTA. Lo scroll avviene solo se l'elemento bersaglio è realmente fuori campo (stagioni/episodi più in basso).

#### Stagioni di un altro show visualizzate ("la stagione non è quella dello show selezionato")
- **Condizione di gara** : aprire uno show A e poi uno B rapidamente restituiva entrambe le richieste in un ordine casuale — le stagioni di A sovrascrivevano quelle di B. Salvaguardia aggiunta: la risposta viene scritta solo se lo show richiesto è ancora quello corrente.
- **Cache stagione chiave per show** : il vecchio cache chiave per numero di stagione serviva solo la stagione 1 del primo show aperto al successivo. Ora chiave "tmdbId-stagione".

---

## v1.16.68 — Agosto 2026

### Android TV: hero stile scheda titolo, gradino D-pad in alto, filmografia ripulita

#### Hero Home/Film/Show = stessa composizione della scheda
- Logo TMDb in alto FISSO 118dp (`ContentScale.FillHeight`): i loghi minuscoli (~30px, illeggibili dal divano) diventano title-art alla Netflix.
- Badge stato libreria sotto il logo (stessa pastiglia della scheda: Ricerca…/Download/Mancante) — "Disponibile" rimane implicito.
- Riga meta unificata ★ voto · anno · durata · generi inline (le chips prendevano un intero rigo per niente).
- Rimozione del gradiente nero sgradevole dietro il sinossi — basta lo scrim dell'hero.
- Colonna contenuto ancorata al bordo inferiore dello sfondo (il CTA "Leggi" non era più tagliato sotto l'immagine).
- Glifi rimanenti sostituiti da icone vettoriali: ▶ su "Leggi", pastiglia "i" disegnata su "Maggiori info".

#### Gradino D-pad in alto (Home + Film + Show)
- Ancora invisibile 1dp in cima a ogni schermata: SU dal CTA dell'hero vi atterra per primo — il bringIntoView riporta lo scroll all'offset 0 (intero carosello diventa visibile sotto la barra), poi un secondo SU raggiunge la NavRail. Fine del carosello mezzo nascosto dietro di essa.

#### Filmografia attori ripulita
- Filtraggio talk-show e cerimonie (Saturday Night Live, Tonight Show, Late Night/Show, Graham Norton, Kelly Clarkson, Jimmy Kimmel, Ellen, Golden Globes, Oscars, MTV/Critics'/People's Choice Awards, GMA, Today Show, Conan, red carpet…) — richiesto in diretta: «sono stanco di vedere i late night».

#### Varie
- CatalogScreen migrato TvLazyColumn → LazyColumn standard (coerenza con la home).

---

## v1.16.67 — Agosto 2026

### Android TV: stato di download reattivo sulla scheda, focusRestorer, ancora D-pad

#### Scheda titolo: download vivo (pattern Netflix)
- **Badge stato reattivo** : "Download"/"Ricerca…" durante l'attività (file interrogato 3s), stato libreria reale altrimenti (Disponibile/Download/Mancante tramite statusTone) — mai più un "Nella libreria" bloccato durante un download.
- **Pastiglia di progresso** `DownloadProgressPill` : percentuale + velocità + tempo rimanente ("Download 42% · 6.1 Mo/s · 12 min rimanenti") con barra di progresso nella pastiglia stessa.
- **Passaggio automatico a "Leggi"** alla fine del download : aggiornamento libreria accelerato a 4s finché un torrent è attivo — zero azione utente, zero respiro app.
- Voto TMDb assente (0) → più stella "★ 0.0" ingannevole sulla scheda.

#### Navigazione D-pad
- **`focusRestorer()` su tutte le righe** (documentazione ufficiale Google): ogni riga ricorda la sua scheda focalizzata — il focus torna al poster corretto dopo il ritorno della scheda e navigando verticalmente.
- **Migrazione TvLazy\* → Lazy\*** standard (TvLazyColumn/TvLazyRow deprecati).
- **Ancora di ripiegamento esclusa dalla ricerca direzionale** (`FocusRequester.Cancel` ×4): è geometricamente sopra tutto il contenuto — moveFocus(Up) dal hero atterrò su di essa (invisibile) invece di risalire nella NavRail.
- Stella dell'eroe → icona vettoriale (il glifo ★ non esiste in Inter).

---

## v1.16.66 — Agosto 2026

### Android TV: correzione massiva UTF-8, icone vettoriali, simmetria D-pad

#### UTF-8 / mojibake (il bug degli accenti e dei simboli corrotti)
- **510 sequenze mojibake riparate** (UTF-8 reinterpretato CP1252 e poi ri-codificato): "Ã©cran" → "écran", "â˜…" → ★, "TÃ©lÃ©chargement" → "Téléchargement", "Â·" → "·"… in HomeScreen.kt, CatalogScreen.kt e UpdateManager.kt.
- Causa radice: scritture file in Get-Content/Set-Content senza codifica esplicita durante sessioni precedenti.

#### Icone vettoriali (fine dei quadrati vuoti su Google TV)
- Nuovo `MovvizIcons.kt`: 13 icone disegnate a mano in ImageVector (play, pausa, skip prev/next, rewind/forward, nota musicale, spunta, stella, più, scarica, swap, dot-circle, replay) — i glifi Unicode ▶ ❚❚ ⏮ ⏭ ♪ ★ ✓ ↓ ⇄ ◉ ↻ non esistono in Inter e causavano fallback sistema/quadrati.
- Sostituite ovunque: controlli lettore (PlayerActivity), CTA scheda titolo ("Leggi", "Riprendi", "Scarica la stagione", "Aggiungi"), badge nota a stelle (RatingBadge, scheda titolo), badge "Visto", spunta episodio visto, menu profilo NavRail, pulsante Plex del login.
- `ControlButton` accetta ora icona vettoriale o etichetta testuale ("CC").

#### Navigazione D-pad — simmetria UP/DOWN
- **Fix "UP risale ma DOWN non scende più"**: l'handler precedente consumava TUTTI gli UP da qualsiasi profondità → impossibile salire da una riga all'altra, ogni UP saltava nella barra di navigazione.
- MainScreen/schede titolo/attore: UP tenta prima `moveFocus(Up)` (salita interna riga N−1), passa alla scheda attiva della NavRail solo all'inizio del contenuto.
- NavRail: DOWN tenta il target preciso, poi il ripiegamento geometrico `moveFocus(Down)` (funziona anche schermo in caricamento), poi l'ancora di riserva.
- Ancora di ripiegamento sollevata a livello NavHost (esisteva solo su home — freccia giù morta durante il caricamento di una scheda), ora **disegnata** quando acquisisce il focus (piccolo punto bianco) per non assomigliare mai a uno schermo bloccato.
- **Correzione del pattern `.getOrDefault(false)` su `requestFocus()`**: il metodo restituisce void in compose-ui 1.7.6 (verificato su javap), il test di successo reale è `.isSuccess` — il vecchio codice valutava `(Unit == true)` = sempre falso.

---

## v1.16.65 — Agosto 2026

### Android TV: aumento versione per build di test

#### Note
- Aumento versione per build di test su Google TV.
- Nessuna modifica del codice — stesso contenuto di v1.16.64.

---

## v1.16.64 — Agosto 2026

### Android TV: aspetto visivo premium + toggle aggiornamento automatico + correzioni crash

#### Stabilità (8 vettori di crash corretti)
- Chiamate di rete HomeScreen scalate (+200ms tra ognuna) — fine del flood parallelo all'avvio.
- Controllo ritardo aggiornamento GitHub ritardato di 5s — non blocca più il primo frame.
- Trailer ambientale disattivato su dispositivi < 4GB di RAM — fine crash Chromium/SwiftShader.
- Precaricamento sfondo eroe ridotto da 2 a 1 immagine — meno pressione sulla memoria.
- Cache memoria Coil ridotto dal 20% al 10% dell'heap.
- `createFilmGrain()` ottimizzato con `setPixels()` batch invece di 32k chiamate `setPixel()`.
- Timeout OkHttp ridotti: connessione 5s, lettura 15s, timeout chiamata 20s.
- Loghi eroe caricati in batch sequenzialmente (+100ms) invece di 5 coroutine in parallelo.

#### Aspetto visivo premium (45 correzioni)
- Forma scheda 8dp → 12dp (coerente TV).
- displayLarge ExtraBold → Bold (meno "blobby" a 10 piedi).
- MovvizDown ammorbidito (#FF5B78 → #E87C7C).
- MovvizCyan ammorbidito (#34E2FF → #5CE0D8).
- Orbit dots AnimatedLogo 6dp → 8dp.
- Flusso Wordmark rallentato da 5s → 8s.
- Popup profilo NavRail ampliato da 300dp → 320dp.
- Padding separatore menu NavRail da 10dp → 16dp.
- Scrim sinistro eroe 70% → 45%.
- Gradiente inferiore eroe ammorbidito (ridotto banding).
- Chip genere eroe 12sp → 14sp.
- Bordo scheda download 3dp → 2dp.
- Padding inferiore intestazione riga 16dp → 20dp.
- Forma chip stagione 9dp → 12dp.
- Numero episodio 22sp Light → 16sp Medium.
- Foto cast 72dp → 84dp, nomi 12sp → 14sp.
- Titoli sezione impostazioni MovvizBrand → MovvizInkSoft.
- Pannello impostazioni 72% → 78% larghezza.
- Etichette InfoRow 12sp → 14sp, larghezza 160dp → 180dp.
- Player schermo errore: titolo bianco invece di rosso, overlay 85% → 72%.
- Spinner buffering spessore 14% → 18%.
- Forma pillola aggiornamento barra di avanzamento (raggio 50).
- Padding catalogo stato vuoto top 24dp → 48dp.

#### Funzionalità
- Toggle « Aggiornamento automatico ON/OFF » in Impostazioni → Informazioni (persistito tramite DataStore).
- Tocco attivo sullo schermo di selezione profilo (tvPointerClick).

---

## v1.16.62 — Agosto 2026

### Android TV: Riprogettazione premium qualità Netflix

#### Tipografia e sistema di design
- Carattere Inter incorporato (5 pesi: Regular → ExtraBold) — stessa direzione tipografica di Netflix e Apple TV.
- Token tipografici unificati: displayLarge (40sp), headlineMedium (24sp), titleLarge (20sp), titleMedium (16sp), bodyLarge (16sp), bodyMedium (14sp), labelLarge (14sp), labelSmall (12sp).
- `MovvizCardShape` (12dp) — raggio unico di tutte le schede contenuto, coerente ovunque.
- `tvFocusLift` esistente preservato — spring + ombra GPU-only (graphicsLayer), zero ricomposizione durante l'animazione.

#### Home (HomeScreen)
- Righe di categorie con titolo sopra (stile titleLarge), effetto "peaking" Netflix (padding end negativo).
- Schede poster: rapporto 2:3, bordo focus 2dp bianco alfa 90% leggibile dal divano.
- Call-out Netflix: sinossi + metadati in fondo alla riga al focus, AnimatedVisibility con debounce per zero sfarfallio.
- Precaricamento direzionale: le 2 immagini successive alla scheda focalizzata vengono precaricate tramite Coil (zero pop-in).
- Chiavi stabili + contentType su tutte le liste.
- Hero: Ken Burns (zoom 1.0→1.05 su 20s), grana cinematografica (BitmapShader nativo), scrim adattivo alla luminanza, logo ufficiale TMDb, testo animato, AmbientTrailer tramite pool WebView, precaricamento dei 2 sfondi successivi.

#### Pagina titolo (TitleDetailScreen)
- Sfondo Parallax (graphicsLayer translationY), logo ufficiale, CTA, stagioni/episodi con chiavi stabili.
- Messaggi di errore in francese (friendlyAddError) invece che grezzo inglese.
- Stills episodi w780, sfondi w1280.

#### Lettore video (PlayerActivity)
- Indicatore di avanzamento centrato "+10s" / "−10s" con fadeIn/fadeOut.
- Pannello "Episodio successivo" alla fine dell'episodio (posizione > durata − 45s) con countdown e focus D-pad.
- Overlay che si nasconde automaticamente dopo 5s, barra di avanzamento animata, spinner di bufferizzazione.
- Schermata di errore con dettagli tecnici (codec, risoluzione) leggibili dal divano.
- Tipografia e token del tema su tutti i controlli.

#### Navigazione D-pad
- DOWN da NavRail → contenuto: intercettazione tramite onPreviewKeyEvent (prima dei figli Surface).
- UP dal contenuto → NavRail: intercettazione tramite onKeyEvent (dopo i LazyColumn).
- Ripristino del focus al ritorno da una scheda dettaglio (ritardo 300ms + navRailFocusRequester).
- Focus di fallback (1dp invisibile sempre focalizzabile) — nessun caso di focus perso.

#### Prestazioni
- Polling file download: 4s → 8s (riduce il traffico di rete).
- largeHeap su Android Manifest.
- TMDb: riprova 3 tentativi con backoff (300ms, 800ms) — meno falsi "movie not found" in caso di interruzione di rete transitoria.

#### Correzioni
- Pulsante "Aggiungi alla libreria": meno falsi fallimenti TMDb (riprova server + messaggio di errore leggibile).
- Ricerca: variabili `fieldFocused` e costanti `TMDB_POSTER_BASE` corrette.

## v1.16.60 — Agosto 2026

### Dashboard: una scheda carosello rotta non blocca più tutto lo schermo

- Un film o una serie con dati inaspettati poteva far crashare l'intera dashboard ("Errore server", schermo intero bloccato) invece di non visualizzarsi semplicemente. Ogni scheda carosello (e il riquadro eroe) è ora isolata: se una fallisce, scompare discretamente, il resto della dashboard continua a funzionare normalmente.

## v1.16.59 — Agosto 2026

### Correttivo: errore server sulla dashboard per account non-admin

- La nuova impostazione aggiunta in v1.16.56 per la riga "Aggiornamenti disponibili" veniva letta tramite un percorso riservato agli admin — ogni account non-admin che apriva la dashboard riceveva un rifiuto di accesso su questa richiesta. La lettura è ora aperta a qualsiasi account connesso (la scrittura rimane solo per admin, come prima).

## v1.16.58 — Agosto 2026

### Android TV: schermata di caricamento della home, vera identità visiva

- Il testo "Caricamento della tua libreria…" lascia il posto al logo Movviz animato (lo stesso di login/impostazioni) al primo avvio, prima che la libreria sia caricata. Questo logo funge anche da vero target di focus visibile per la freccia giù — l'ancora di fallback invisibile non viene più sollecitata in questo caso specifico, rimane in posizione per altri casi limite.

## v1.16.57 — Agosto 2026

### Correzione: il nuovo pulsante "Suggerimenti di aggiornamento sulla dashboard" non veniva salvato

- Il pulsante aggiunto in v1.16.56 non manteneva mai il suo stato — la rotta di salvataggio delle impostazioni ignorava questo campo specifico, tornando sistematicamente al suo valore originale.

## v1.16.56 — Agosto 2026

### Impostazioni > Qualità: disattivare l'analisi degli aggiornamenti sulla dashboard

- Nuovo pulsante in Impostazioni > Qualità per disattivare l'analisi che alimenta la riga "Aggiornamenti disponibili" della dashboard — questa analisi poteva rallentare seriamente la visualizzazione su una grande libreria. Distinto dal pulsante di aggiornamento automatico esistente (che gestisce la sostituzione automatica in background): questo interrompe solo lo scan di visualizzazione, senza toccare il resto.

## v1.16.55 — Agosto 2026

### Android TV: freccia giù dal menu — vera correzione

- La precedente correzione eliminava i chiusori inaspettati ma rendeva la freccia giù inoperativa in uso normale (puntava sistematicamente a un'ancora invisibile invece del vero contenuto). Ripristina lo scorrimento diretto al primo elemento reale dello schermo quando presente, con l'ancora di riserva solo in caso di necessità — mai crash, mai freccia giù senza effetto.
- Nuovo README, rifacimento completo.

## v1.16.54 — Agosto 2026

### Versione di controllo per la verifica dell'aggiornamento automatico

## v1.16.53 — Agosto 2026

### Android TV: verifica manuale degli aggiornamenti

- Aggiunge un pulsante "Verifica aggiornamenti" in Impostazioni → Informazioni — finora la verifica veniva eseguita solo una volta all'avvio, senza modo per riavviarla o vedere cosa succedesse senza riavviare l'intera applicazione.

## v1.16.52 — Agosto 2026

### Android TV: riproduzione — fallback audio-solo più affidabile

- Il fallback "audio-solo" passava sistematicamente per il transcodifica Plex, che può rifiutarsi silenziosamente di copiare il video per alcune sorgenti (in particolare HEVC) e quindi ricodificare entrambi anziché solo l'audio. Utilizza ora con priorità il remux locale del server (già utilizzato dal client desktop) quando disponibile — copia video garantita, solo l'audio viene ricodificato.

## v1.16.51 — Agosto 2026

### Android TV: ciclo di aggiornamento, chiusori inaspettati con telecomando

- Aggiornamento automatico che ricominciava indefinitamente: il sistema richiede uno schermo di conferma di installazione da Android 12, mai gestito finora — l'applicazione credeva l'installazione riuscita mentre era bloccata in attesa per sempre. Corretto e verificato in condizioni reali (numero di versione che avanza correttamente dopo).
- Chiusori inaspettati dell'applicazione premendo la freccia giù del telecomando — più frequenti su box più lenti (es. Chromecast 4K): il target di navigazione poteva puntare a un elemento dello schermo non ancora caricato. Reso sistematicamente sicuro, indipendentemente dallo stato di caricamento dello schermo.

## v1.16.50 — Agosto 2026

### Android TV: aggiunta utente alla famiglia, profilo admin mancante

- "Aggiungi utente" dallo schermo profilo non rispondeva al telecomando — lo schermo di accesso in modalità aggiunta non richiedeva mai il focus D-pad (anche questo difetto già corretto altrove, riscontrato qui senza rete di sicurezza).
- L'account admin che stabilisce il collegamento iniziale non era mai visibile in "Chi è?" finché non veniva aggiunto manualmente alla propria famiglia — ora aggiunto automaticamente al primo accesso, come l'account proprietario lo è sempre nel primo profilo su Netflix/Plex.

## v1.16.49 — Agosto 2026

### Android TV: aggiornamento bloccato dal telecomando

- L'overlay auto-update non catturava mai il focus D-pad: il pulsante "Consenti" rimaneva irraggiungibile e il telecomando continuava a pilotare il menu nascosto sottostante — causa probabile dei chiusori inaspettati dell'applicazione durante l'aggiornamento. Corretto.

## v1.16.48 — Agosto 2026

### Versione di test dell'auto-aggiornamento

- Nessun cambiamento funzionale: solo un aumento di versione, per convalidare in condizioni reali il flusso di auto-aggiornamento (controllare GitHub all'avvio → scaricare `Movviz-Android-TV-client.apk` → verifica SHA-256 → installazione sopra quella esistente).

## v1.16.47 — Agosto 2026

### Un solo APK: « Movviz TV »

- La variante `retail` (senza auto-aggiornamento) è **rimossa**: esiste più un solo APK, l'applicazione si chiama ora **Movviz TV** e si aggiorna automaticamente tramite GitHub all'avvio.
- L'`applicationId` `com.movviz.tv.au` è mantenuto: le installazioni esistenti e l'auto-aggiornamento continuano a sovrascriversi correttamente (stesso pacchetto = aggiornamento, non una seconda app).
- Il flusso CI pubblica ora un solo asset: `Movviz-Android-TV-client.apk`.
- Nuovo: una **stringa TvProvider** « Movviz » sulla dashboard Android TV — la riga « Continua a guardare » del launcher mostra i titoli in corso dell'account attivo (come Plex/Netflix, senza partnership), e viene dichiarato un deep link `movviz://title/{type}/{tmdbId}` per aprire la scheda del titolo.
- **Google TV**: la sessione multimediale alimenta ora la riga « Continua a guardare » del launcher Google TV — gli MediaItems contengono metadati reali (titolo, sottotitolo episodio, poster TMDb) e viene dichiarata un'attività di sessione (clic sulla card riapre l'app).

## v1.16.46 — Agosto 2026

### Android TV: il lettore impedisce la sospensione durante la riproduzione

- Il flag anti-sospensione della finestra è ora impostato per tutta la vita dell'Activity di riproduzione (non solo durante la riproduzione attiva di ExoPlayer): un re-buffering su server remoto non fa più addormentare l'Android TV nel bel mezzo di un film.
- Aggiunta di una sessione multimediale attiva (media3-session): il sistema sa che un media è in riproduzione, come Netflix — non mette più in standby il box e mostra il titolo nell'interfaccia di sistema.

## v1.16.45 — Agosto 2026

### Android TV: fallback audio solo in DASH per tutti i codec

- Il fallback «audio solo» (video copiato in bitstream, audio ri-encoderizzato) utilizza ora DASH indipendentemente dal codec sorgente, incluso h264 — coerente con il lettore web e con il comportamento di Plex Web stesso, e fMP4/DASH offre a ExoPlayer un seeking per intervalli di byte più preciso rispetto a HLS-TS per segmenti.

## v1.16.44 — Agosto 2026

### Android TV: sonda di compatibilità reale per box

- La compatibilità del box non è mai presunta: prima di ogni riproduzione, l'app interroga i decoder REALI dichiarati dal dispositivo (MediaCodecList, la stessa API che ExoPlayer usa per decodificare) e sceglie la modalità di riproduzione di conseguenza — un box che decodica DTS/TrueHD/E-AC3 riproduce in direct-play, un altro che non li ha passa al fallback audio solo (video copiato, mai ri-encoderizzato). La decisione e la sua ragione sono registrate nel logcat (`Pre-decision v=… a=… → livello …`).
- Correzione: il fallback audio solo viene servito in HLS per sorgenti h264 — il lettore annunciava erroneamente un manifesto DASH e la riproduzione falliva all'avvio.
- Nuovo: scheda attore/attrice — La distribuzione di una scheda titolo porta alla filmografia completa della persona, con navigazione tramite card per ogni titolo. La NavRail rimane visibile sulle schede (titolo e attore) per cambiare scheda senza tornare alla home.

## v1.16.43 — Agosto 2026

### Android TV: riproduzione ottimizzata — fine del transcodifica video inutile

- Un titolo il cui video è decodificabile dal box ma il cui audio no (DTS/DTS-HD/TrueHD/E-AC3 a seconda dei dispositivi) attivava tutta la catena di fallback e finiva in transcodifica video+audio lato server, quando solo l'audio era problematico. Il lettore ora sonda i codec reali del titolo (streamInfo) E i decoder reali del box prima di iniziare:
  - video non decodificabile da QUESTO box (AV1, VP9…) → transcodifica completa direttamente, senza due errori sullo schermo;
  - audio non decodificabile da questo box ma video OK → ripiegamento "solo audio" immediato: il video viene copiato in bitstream (mai ricodificato), solo l'audio passa in AAC;
  - il ripiegamento solo audio utilizza HLS per le fonti h264 (il più robusto per ExoPlayer) e DASH per HEVC/AV1/VP9 (l'unico formato in cui Plex rispetta la copia bitstream).
- "Continua a guardare" su una serie: la scheda dell'episodio corrente (stagione, numero, titolo, sinossi) si apre automaticamente all'arrivo sul titolo — l'utente non deve più cercarla nell'elenco delle stagioni.

## v1.16.42 — Agosto 2026

### Android TV: aggiornamento automatico e navigazione con telecomando

- Auto-update: l'installazione falliva silenziosamente ad ogni tentativo (sessione rifiutata dal sistema — un flusso di dati mai chiuso prima della convalida). Corretto e verificato in condizioni reali.
- Telecomando: dalla barra di navigazione in alto, la freccia giù non portava mai al contenuto sottostante, su nessun tab — il sistema non trovava spontaneamente alcun target tra i due. Target esplicito impostato in modo che la freccia giù funzioni ovunque (Home, Film, Serie, Ricerca, Impostazioni).

## v1.16.41 — Agosto 2026

### Android TV: libreria e ripresa riproduzione serie

- Il pulsante "Aggiungi alla libreria" non mostrava più lo stato corretto (download in corso, ecc.) subito dopo l'aggiunta — poteva tornare su "Aggiungi" a causa di un aggiornamento troppo rapido. Nuovi tentativi automatici.
- "Continua a guardare" su una serie apre ora direttamente l'episodio corrente (stagione corretta, CTA di ripresa con numero e titolo dell'episodio) invece di tornare sempre alla stagione 1 come un film.

## v1.16.40 — Agosto 2026

### Android TV: correzioni riportate su box reale

- Ri-allinea il numero di versione ovunque (`package.json`, badge README, `versionCode`/`versionName` dell'app Android TV) — la discrepanza tra queste fonti causava il fallimento di alcuni aggiornamenti.
- Corregge un crash alla compilazione dello schermo profilo ("Chi è?") lasciato da un lavoro incompiuto.
- Ricerca: rimuove la barra "Apri scheda" che appariva sotto le schede al focus — essere su una scheda e confermare apre direttamente la scheda, come ovunque.
- Impostazioni e Ricerca: rimuove la barra opaca che rimaneva sopra il contenuto, già rimossa da Home e dai cataloghi Film/Serie.

## v1.16.33 — Agosto 2026

### Android TV: schermo profilo — nome del profilo attivo, aggiunta tramite login, duplicati rilevati

- **Nome del profilo attivo ovunque**: al riavvio su una sessione persistente, l'intestazione del menu (pastiglia utente) mostrava "—" e l'avatar "?" — il profilo attivo è ora ripristinato non appena la sessione viene verificata.
- **"Il mio profilo" e "Cambia utente"** portano allo schermo profilo ("Chi è?"): profilo attivo in cima (sempre visibile, anche fuori casa), membri della casa e piastrina "+" — più mai un reindirizzamento diretto al login.
- **Aggiungi utente = login**: la piastrina "+" apre il login con l'account da aggiungere (sottotitolo dedicato); dopo il login, l'account si unisce alla casa e lo schermo profilo viene visualizzato con la conferma.
- **Account già presente rilevato**: riconnettersi con un account già nella casa non ne crea un duplicato — messaggio "Questo account è già nella casa".

## v1.16.32 — Agosto 2026

### Ermetismo dei profili affinato: ognuno mantiene LE SUE viste, nulla si mescola

- **Correttivo della 1.16.31**: gli account amici importati possiedono i propri account Plex (l'admin fa solo un'importazione in Utenti, nient'altro) — devono quindi recuperare **la loro** cronologia, le loro riprese e le loro preferenze, non rimanere vuoti.
- **Garanzia anti-perdita di dati** : Plex può restituire la cronologia del server (quella dell'account di collegamento) invece di quella dell'account richiesto. L'impronta (film + episodi) di ogni cronologia viene confrontata con quella dell'account di collegamento: identica → rifiuto di scrittura + dati precedenti contaminati svuotati; diversa → è proprio la sua, sincronizzazione normale. Nessun'attività di un profilo perde su un altro, e nessun profilo è privato dei propri veri dati.

## v1.16.31 — Agosto 2026

### Profili ermetici + memoria IA estesa + reimpostazione del contesto

- **Barriera ermetica tra profili (correzione maggiore)** : il contesto IA di ogni amico importato mostrava l'attività dell'account di collegamento (294 film visti, I Simpson 714 episodi...). Plex restituisce la cronologia del server per gli account amici, indipendentemente dall'account richiesto — la cronologia è ora sincronizzata solo per l'account autenticato con il suo token; tutti gli altri profili (amici, Home) rimangono strettamente vuoti, e i dati contaminati vengono rilevati e svuotati. Ogni profilo ha solo le proprie visualizzazioni — le sue, mai quelle di un altro.
- **Memoria conversazionale continua** : ogni messaggio discusso con l'assistente (gusti, risentimenti, preferenze, abitudini, nome...) viene estratto e memorizzato in parallelo alla risposta (nessun ritardo aggiunto), oltre ai soli marcatori che il modello emetteva finora. Limite di fatti mantenuti aumentato da 30 a 100.
- **Pulsante "Reimposta contesto"** nel Profilo, accanto a "Creare contesto" : conferma in due clic, il contesto appreso viene cancellato (voti e note conservati).

## v1.16.30 — Agosto 2026

### Android TV: auto-aggiornamento riparato (fallimento dell'installazione)

- L'installazione falliva silenziosamente al `commit()`: su Android 15+, il status receiver deve provenire da un PendingIntent **mutabile** — `FLAG_IMMUTABLE` provocava `IllegalArgumentException` e la sessione veniva abbandonata (l'app rimaneva sulla vecchia versione dopo la barra di caricamento).
- Il PendingIntent del commit è ora `FLAG_MUTABLE`: l'aggiornamento viene applicato e l'app si riavvia automaticamente sulla nuova versione.

## v1.16.29 — Agosto 2026

### Android TV: scheda serie — fine del lampeggio e del ritorno forzato alla stagione 1

- Il ricaricamento periodico della scheda (3 s) svuotava le stagioni prima di ricaricarle: lo schermo lampeggiava e la selezione D-pad veniva reimpostata (ritorno alla stagione 1 dopo ogni poll).
- Le stagioni non vengono più svuotate che in caso di CAMBIO serie; un semplice ricaricamento mantiene l'visualizzazione al suo posto.
- La stagione predefinita viene scelta solo all'apertura della scheda: un ricaricamento non sovrascrive più mai la scelta dell'utente.

## v1.16.28 — Agosto 2026

### Android TV: menu profilo rivisto + navigazione

- Menu profilo con i colori di Movviz (sfondo scuro profondo, bordo discreto, focus chiaro, sfumatura del marchio) con intestazione "Profilo attivo" (avatar + nome).
- Corregge il clic su "Cambia utente" : gli elementi del menu non rispondevano al clic del puntatore (mancava `tvPointerClick`) — il clic del mouse/telecomando funziona ora ovunque.
- Rimuove la scheda "Ricerca" dalla barra di navigazione : la lente d'ingrandimento esiste già e apre la ricerca dalla home.

## v1.16.27 — Agosto 2026

### Android TV: correzioni auto-aggiornamento

- Corregge l'installazione: `fsync(OutputStream)` chiude da sé lo stream sull'API 35 — il `close()` aggiuntivo abbandonava la sessione e l'APK non veniva mai installata (l'app sembrava "chiudersi" dopo l'aggiornamento).
- Corregge il crash del pulsante "Consenti" (apertura delle impostazioni di fonti sconosciute senza `FLAG_ACTIVITY_NEW_TASK` — AndroidRuntimeException sul contesto applicazione).
- Aggiunge log (`MovvizUpdate`) per tracciare l'installazione e il riavvio automatico.

## v1.16.26 — Agosto 2026

### Android TV: menu profilo stile Netflix

- Sostituisce il testo "MOVVIZ TV" in alto a destra con l'avatar del profilo attivo, sempre visibile.
- Al clic: menu stile Netflix con « Cambia utente » (→ schermo « Chi è? »: scelta di un profilo domestico o aggiunta di un membro), i profili domestici in anteprima e « + Aggiungi utente ».
- Un utente ospite che sceglie « Cambia utente » passa nuovamente al login (non ha una casa).

## v1.16.25 — Agosto 2026

### Android TV: aggiornamento automatico migliorato

- L'installazione avviene ora in background (PackageInstaller session API): non ci sono più schermi di sistema che fanno «chiudere» l'app — rimane visualizzata con una barra di caricamento durante l'installazione, quindi l'applicazione si riavvia automaticamente con la nuova versione (receiver `MY_PACKAGE_REPLACED`).
- Rimuove l'installer di sistema `ACTION_VIEW` (FileProvider diventato inutile per questo flusso).

### Android TV: barra nera del catalogo

- Corregga la barra nera sopra l'eroe delle schede Film e Serie: il contenuto passa ora sotto la barra di navigazione in vetro come su Home (il `padding` di 80 dp è mantenuto solo per Ricerca e Impostazioni).

## v1.16.24 — Agosto 2026

### Android TV: casa dei profili lato server

- I profili domestici sono ora memorizzati sul server (`/api/tv-profiles`), non solo sul dispositivo: un APK appena installato non mostra più i profili locali del dispositivo precedente.
- Gestione della casa 100% admin: solo l'admin vede l'elenco degli account e può aggiungere/rimuovere un membro (scelta tra gli account esistenti, senza password). Un utente ospite che si connette da un APK non vede mai la casa e non può aggiungere nulla.
- Lo schermo «Aggiungi un membro alla casa» sostituisce il login per alimentare la casa dal selettore e dal menu di navigazione.
- Le sessioni rimangono locali per ogni dispositivo (separate per server e account).

### Android TV: intestazione del catalogo

- Rimuove il banner del titolo nero sopra l'eroe delle schede Film e Serie: l'eroe parte ora dall'alto, come su Home.

## v1.16.23 — Agosto 2026

### Android TV: riproduzione

- Aggiunge il modulo Media3 DASH mancante per evitare il crash durante il ripiegamento della riproduzione.

## v1.16.22 — Agosto 2026

### Android TV: compilazione profili

- Corregga la risoluzione dell'host server utilizzata per salvare e ripristinare le sessioni del profilo.

## v1.16.21 — Agosto 2026

### Android TV: correzioni del menu profili

- Corregga la compilazione retail/AU del selettore e del menu dei profili.
- Mantiene le sessioni separate e gli avatar sincronizzati.

## v1.16.20 — Agosto 2026

### Android TV: profili sincronizzati

- Aggiunge il selettore di profili all'avvio dopo la selezione del server.
- Riutilizza i conti Movviz esistenti, i loro avatar Plex e le loro sessioni persistenti.
- Aggiunge l'aggiunta e il cambio di profilo dal menu TV.
- Non viene introdotto nessun profilo per minori né diritto speciale.

## v1.16.19 — Agosto 2026

### Android TV: auto-aggiornamento senza store (variante AU)

- Nuova variante APK **AU** ("auto-update") accanto a quella retail: all'avvio, interroga i rilascio GitHub pubblici di Movviz, confronta la versione e mostra "Aggiornamento, si prega di attendere…" con una barra di avanzamento durante il download.
- SHA-256 verificato contro il digest pubblicato su GitHub prima dell'installazione — un file corrotto o falsificato non viene mai installato.
- Installazione tramite l'installer di sistema (FileProvider); l'autorizzazione "sorgenti sconosciute" gestita al primo avvio, ripresa automatica al ritorno dalle impostazioni.
- La versione retail rimane senza auto-aggiornamento; entrambe le APK condividono la stessa firma — l'AU si aggiorna sopra senza perdita di dati.
- Il CI pubblica ora entrambe le APK (`Movviz-Android-TV-client-retail.apk` e `Movviz-Android-TV-client-AU.apk`) in ogni rilascio.

## v1.16.18 — Agosto 2026

### Android TV: riproduzione a 3 livelli — diretto > solo audio ffmpeg > HLS

- Riproduzione diretta (byte grezzi) finché ExoPlayer decodica tutto nativamente — nessun transcodifica.
- Non appena un formato non è decodecionabile (spesso l'audio: DTS/AC3/TrueHD), passa a un transcodifica audio solo: il video viene copiato in bitstream (x264/x265 non vengono mai riencoderati) e solo l'audio viene riencoderato in aac, tramite DASH (l'unico formato in cui Plex rispetta la copia del bitstream, incluso HEVC).
- Se il video copiato non è ancora decodecionabile (ad esempio AV1), ultimo ricorso: transcodifica completa h264/aac servita in HLS.
- Ogni livello viene tentato solo una volta per elemento, ripresa alla stessa posizione, nessun loop.

## v1.16.17 — Agosto 2026

### Navigazione nel pannello titolo

- Dal pannello, ogni clic su un titolo simile, un attore o una collezione aggiorna il pannello invece di aprire una pagina intera.
- Le viste attore e collezione condividono ora strettamente lo stesso componente delle loro pagine dedicate (`PersonContent`, `CollectionContent`) — nessun variante dedicata al pannello.

### Android TV: caroselli per tipo

- Il carosello Film mostra ora solo film.
- Il carosello Serie mostra ora solo serie.
- Il carosello misto della home generale rimane invariato.

## v1.16.15 — Agosto 2026

### Android TV: catalogo arricchito e riproduzione più fluida

- Riutilizza le fasce editoriali esistenti del dashboard (`/api/metadata/rows`) nella home, Film e Serie.
- Aggiunge un cache video Media3 condiviso di 1,5 GB e un buffer di riproduzione ampliato per limitare i ricaricamenti.
- Conserva i track audio e i sottotitoli Media3 e il fallback di transcodifica esistente.

## v1.16.14 — Agosto 2026

### Android TV: versione retail e connessione Plex

- Corregga il crash all'avvio della release minificata e tollera i vecchi account Plex senza campo `status`.
- Conserva la chiave retail locale fuori deposito e permette ai build senza keystore di funzionare senza esporre segreti.

## v1.16.13 — Agosto 2026

### Android TV: diagnostica di collegamento Plex

- Mostra ora l'errore restituito dal server durante il polling PIN Plex (`no_plex_access`, account Plex non accessibile, ecc.) invece di un messaggio generico.
- Conserva lo stream desktop invariato.

## v1.16.12 — Agosto 2026

### Android TV: loghi dei titoli

- Corregga uno scostamento sistematico che spingeva il logo del film o della serie fuori dallo schermo a sinistra, nella schermata principale come sulla scheda del titolo, per qualsiasi logo che non avesse lo stesso margine di quello utilizzato per calibrare l'impostazione.
- Corregga il pulsante del menu attivo ("Home") che diventava un blocco bianco opaco illeggibile non appena manteneva il focus del telecomando.

## v1.16.11 — Agosto 2026

### Versionamento Android TV

- Allinea finalmente la versione nativa dell'APK Android TV alla versione Movviz pubblicata (`1.16.11`) e incrementa il suo `versionCode`.

## v1.16.10 — Agosto 2026

### Android TV: collegamento Plex

- Autorizza esplicitamente la nuova rotta PIN TV nel proxy di autenticazione in modo che l'emulatore e i dispositivi Android TV possano chiamarla senza sessione.

## v1.16.9 — Agosto 2026

### Android TV: collegamento Plex

- Aggiunge una rotta dedicata al codice corto Plex per i dispositivi TV, senza modificare lo stream Plex desktop esistente.
- Android TV visualizza e utilizza il PIN di collegamento corto tramite `plex.tv/link`.
- Il link discreto di cambio server cancella correttamente la configurazione locale prima di tornare all'assistente.

## v1.16.8 — Agosto 2026

### Chat desktop: continuità e gusto

- Gli appunti espliciti forniti in conversazione sono ora salvati senza dipendere da un marcatore del modello; un appunto su "tutto" un universo rimane una preferenza globale, senza essere ridotto a un singolo film.
- Dopo un'offerta di raccomandazioni, "ok", "vai" o "dai" continua la selezione e non può più essere interpretato come un titolo da cercare.
- Se il modello annuncia una selezione senza restituire schede, Movviz richiede nuovamente una risposta strutturata di raccomandazioni.

## v1.16.7 — Agosto 2026

### Android TV: identità visiva Movviz

- Il mark animato TV riprende le geometrie esatte dell'icona `Clapperboard` Lucide utilizzata sul desktop, tramite un VectorDrawable nativo.
- Halo aurora multicolore viola, magenta e ciano rinforzato attorno al logo animato come una piastrella statica, senza cambiare la navigazione TV.

## v1.16.6 — Agosto 2026

### Android TV: navigazione e libreria salotto

- Riprogettazione delle schede TV: logo ufficiale TMDb, badge sotto il logo, ripresa e riavvio separati, e ritorno del lettore alla scheda.
- Le serie propongono un selettore di stagioni senza bonus S0, una scheda illustrata per episodio e la ricerca di una stagione mancante dalla televisione.
- Dashboard migliorato: navigazione Movviz animata, piastrelle senza visual con halo di marca fisso, e schede di download cliccabili con progressione leggibile.

## v1.16.5 — Agosto 2026

### Correttivo: worker di matching incorporato nelle installazioni standalone

- La pulizia del bundle standalone eliminava i file `*Worker.mjs` dopo la build: le ricerche automatiche potevano quindi fallire subito dopo la lettura della cache RSS nelle installazioni impacchettizzate da v1.16.1.
- La build copia ora esplicitamente tutti i worker nel runtime standalone e i pool li risolvono da questa posizione. Il matching parallelo funziona di nuovo; il fallback locale di sicurezza rimane attivo.

## v1.16.4 — Agosto 2026

### Correttivo: richieste e auto-ricerca disaccoppiate

- Una richiesta approvata viene ora registrata non appena il film o la serie entra nella libreria, prima della ricerca automatica. Un errore di indexer o di matching non può quindi creare un media senza farlo apparire in **Richieste**.
- Gli errori imprevisti durante la ricerca di un film, una stagione o un episodio diventano un risultato controllato ed esplicito nel log diagnostico, invece di un errore 500 o uno stato "ricerca" ripristinato senza causa.

## v1.16.3 — Agosto 2026

### Correttivo: aggiunta automatica affidabile, anche senza worker disponibile

- L'aggiunta di un film o di una serie non si interrompe più con un errore 500 se il worker di matching non è caricato da un'installazione impacchettizzata: Movviz applica quindi le stesse regole di corrispondenza direttamente nel processo principale e continua la ricerca automatica.
- Il pool di worker guasto viene arrestato correttamente invece di riavviarsi in loop, evitando di mantenere il server in errore permanente.
- La scheda non presenta più una risposta HTTP fallita come un'aggiunta riuscita: l'errore viene visualizzato e lo stato reale della libreria viene ricaricato.

### Android TV: identità Movviz e percorso di scoperta

- Lo schermo TV riprende ora l'identità visiva Movviz: logo clap ufficiale, navigazione in vetro sull'eroe, schede e scheda titolo adattate al telecomando.
- La connessione con Plex e le azioni di libreria sono integrate nel percorso TV, con ritorno immediato dello stato di download.

## v1.16.2 — Agosto 2026

### Nuovo: libreria dissociata — pagine dedicate Film e Serie

- La libreria è ora suddivisa in **tre pagine fisse**: `/library` (Tutto, entrambi i tipi mescolati), `/movies` (solo film) e `/series` (solo serie) — accessibili dal sottomenu "Libreria" della barra laterale.
- Le pagine Film e Serie non hanno più pulsanti di filtraggio per tipo (è la loro natura fissa); ordinamento, filtro stato e tag rimangono disponibili. I vecchi link `?type=movie|series` reindirizzano automaticamente alle nuove pagine.

## v1.16.1 — Agosto 2026

### Nuovo: sottomenu Libreria nella barra laterale (desktop)

- Il menu "Libreria" si espande ora sotto tre voci: **Tutto**, **Film** e **Serie** — un chevron apre/chiude il sottomenu, e l'elemento attivo è evidenziato. I filtri, l'ordinamento e i tag già applicati vengono mantenuti quando si passa tra le tre viste.

### Correttivo: il build falliva per mancanza di spazio su disco

- **Causa radice identificata**: il build Turbopack di Next.js 16 ignorava le esclusioni di tracing e copiava le cartelle di sviluppo (`dta/`, `.movviz-data/`) — fino a ~480 GB — nel bundle standalone, fino a saturare il disco. Il build torna a webpack (dove le esclusioni funzionano) e uno script `clean-standalone` purga ciò che deve rimanere fuori dal bundle: il standalone finale passa da ~480 GB a ~64 MB.

## v1.16.0 — Agosto 2026

### Nuovo: client Android TV

- **Primo client nativo Movviz** per Android TV / Fire TV (telecomando, tastiera e mouse tutti supportati): connessione a un server Movviz esistente, libreria Film/Serie, scheda titolo, riproduzione episodi, ricerca, impostazioni — scaricabile come APK dalle Releases GitHub, accanto all'installer Windows.
- Sessione mantenuta tra le sessioni, come su Plex o Netflix — non è più necessario riconnettersi ogni volta.

## v1.15.17 — Agosto 2026

### Correttivo: un semplice saluto interpretato come titolo di film

- **Causa radice confermata in diretta**: scrivere "hep" per attirare l'attenzione innescava una ricerca, e Movviz continuava con un oscuro film ceco del 2013 come se fosse l'argomento della conversazione. L'elenco dei saluti e interiezioni riconosciute come tali (hep, hé, eh, ho, wesh, hmm, bref, ciao…) è stato notevolmente ampliato — i veri titoli brevi come "300" o "Up" vengono ancora riconosciuti correttamente.

## v1.15.16 — Agosto 2026

### Correttivo: un titolo errato poteva essere aggiunto quando film e serie assomigliavano

- **Causa radice confermata in diretta**: chiedere "scarica Lanterns" aggiungeva "Human Lanterns" (film del 1982 senza alcun legame) anche se la serie "Lanterns" (2026) era il primo risultato della ricerca. L'assistente aveva ipotizzato che si trattasse di un film, e questa ipotesi escludeva automaticamente tutte le serie — inclusa la corrispondenza esatta. Un titolo che corrisponde molto meglio prevale ora su questa ipotesi, sia che si tratti di un film o di una serie.
- Alcune parole comuni aggiuntive ("di", "in", "e"…) non possono più essere interpretate come nomi di battesimo.

## v1.15.15 — Agosto 2026

### Correttivo: una parola comune poteva essere registrata come nome di battesimo

- **Causa radice confermata in diretta**: scrivere una frase tipo "non l'ho visto, è con DiCaprio?" faceva registrare "Con" come nome di battesimo, sovrascrivendo il vero. Il rilevatore prendeva qualsiasi parola seguita da un "è" nel corso di una frase. Questa forma è ora riconosciuta solo all'inizio del messaggio (la risposta "è Seb" alla domanda sul nome rimane catturata), e un elenco ampliato di parole comuni non può più diventare mai un nome di battesimo.

### Correttivo: un voto riuscito veniva visualizzato come fallimento

- **Causa radice confermata in diretta**: su una richiesta tipo "metti 5 stelle a X, Y e Z", i voti venivano registrati correttamente ma la risposta visualizzata era "ho un blocco vero" — l'assistente non aveva prodotto alcuna frase riguardo ai suoi voti. La conferma è ora costruita sui voti effettivamente registrati, con l'elenco dei titoli e il loro voto.

## v1.15.14 — Agosto 2026

### Correzione: i voti annunciati in blocco non erano effettivamente salvati

- **Causa radice confermata in diretta**: dopo aver esaminato i titoli uno per uno, rispondere "adorato, metti 5 stelle a tutti" mostrava un elenco curato ("Solo Leveling: 5/5", "Jurassic Park: 5/5"…) e annunciava "eccoci i voti aggiornati" — anche se **nessun voto era stato salvato**. Due cause cumulative: un limite interno di 2 voti massimo per risposta rendeva strutturalmente impossibile la valutazione in blocco, e nulla impediva di annunciare voti senza averli effettivamente assegnati.
- La valutazione in blocco accetta ora fino a 10 titoli in una volta, e qualsiasi risposta che annuncia voti senza salvarli realmente viene rilevata e corretta automaticamente — mai più un voto annunciato ma assente.

## v1.15.13 — Agosto 2026

### Movviz AI — l'argomento della conversazione è ora tracciato esplicitamente

- **Causa radice identificata in audit**: al di fuori di una scheda film/serie aperta, nulla indicava all'assistente di quale titolo si stesse parlando — doveva indovinarlo rileggendo la cronologia, cosa che falliva nelle sequenze naturali ("Solo Leveling" → "adoro" → "il top è contro X") e poteva riavviare una ricerca inutile al terzo messaggio. Il titolo oggetto di discussione è ora memorizzato non appena è stato effettivamente identificato, e richiamato ad ogni messaggio successivo: le reazioni brevi, i riferimenti impliciti e i nomi dei personaggi si riferiscono di default a questo titolo, senza ricominciare una ricerca.

## v1.15.12 — Agosto 2026

### Movviz AI — filmografia e voti incrociati per dare priorità a un titolo mancante

- Quando una ricerca di filmografia rivela titoli mancanti e l'utente ha voti assegnati, l'assistente può ora incrociare i due per suggerire quale dei titoli mancanti ha maggiori probabilità di piacere, basandosi su caratteristiche realmente condivise (tono, genere, struttura) — mai su un'intuizione inventata.

## v1.15.11 — Agosto 2026

### Movviz AI — gerarchia decisionale unificata

- Le numerose regole aggiunte separatamente (risposte brevi, correzioni, menzioni di titolo, opinioni puntuali...) sono ora raggruppate sotto un ordine di priorità esplicito e unico, per evitare che regole isolate si contraddicano: reazione alla conversazione in corso > riferimento all'argomento attivo (un personaggio, una scena, "il secondo"...) > correzione della risposta precedente > intenzione conversazionale > opera già nota > opera potenzialmente nuova > ricerca esterna come ultima risorsa.
- L'opinione su un personaggio specifico (es. "Beru è chiaramente il migliore") è ora trattata come le opinioni su una scena/un attore/un finale già coperti: memorizzata per quello che è, mai trasformata in un voto globale del titolo.

## v1.15.10 — Agosto 2026

### Movviz AI — badge discreto al posto di un'apertura forzata

- Quando Movviz riprende spontaneamente la conversazione dopo un'assenza, la chat non si apre più automaticamente — il pulsante flottante mostra ora un badge numerato con un breve battito, finché l'utente non lo apre da solo.

## v1.15.9 — Agosto 2026

### Movviz AI — la ripresa spontanea può ora riguardare un voto

- Quando Movviz riprende spontaneamente la conversazione dopo un'assenza (meccanismo già esistente, con il proprio tempo di attesa), può ora, occasionalmente, chiedere direttamente il voto di un titolo visto ma mai valutato piuttosto che una domanda generica — mai due volte tramite due canali diversi nello stesso lasso di tempo.

## v1.15.8 — Agosto 2026

### Correzione: un voto non aggiornava il contesto in tempo reale

- **Causa radice confermata in diretta**: a differenza di qualsiasi altra attività reale (visualizzazione, pollice su/giù, importazione Netflix), assegnare un voto — tramite il widget stelle o in conversazione — non scatenava l'aggiornamento del contesto consolidato ("Cosa sa Movviz AI di te"). Era necessario cliccare manualmente su "Rigenera contesto" affinché i voti venissero presi in considerazione. Un voto si propaga ora automaticamente, come il resto.

### Movviz AI — domanda occasionale su un titolo visto ma mai valutato

- Di tanto in tanto, quando la conversazione lo permette naturalmente, l'assistente può ora chiedere la valutazione di un titolo visto ma mai valutato — mai sistematico (limitato a un'occasione ogni poche ore, mai imposto se il momento non è opportuno).

### Pannello profilo — rimuovere un feedback 👍/👎

- Ogni titolo apprezzato/respinto nel pannello "Cosa sa Movviz AI di te" ha ora un pulsante per rimuoverlo dal contesto (utile per un voto emesso per errore).

## v1.15.7 — Agosto 2026

### Movviz AI — un titolo già respinto non viene più mai proposto

- Un titolo contrassegnato come "cattiva raccomandazione" (👎) è ora definitivamente escluso dalle future raccomandazioni — finora, solo una leggera penalità si applicava ai titoli con tono simile, il che non impediva al titolo esatto già respinto di riapparire.

## v1.15.6 — Agosto 2026

### Movviz AI — distinzione tra un parere puntuale e una valutazione globale

- Un commento su un elemento specifico ("adoro questa scena", "questo attore è eccellente", "la fine è fallita") non fa più dedurre una valutazione globale dell'intero titolo — solo un parere espresso sull'intero film o serie viene tradotto in valutazione.

## v1.15.5 — Agosto 2026

### Movviz AI — identità di compagno cinofilo rafforzata

- L'assistente ragiona ora esplicitamente come un compagno cinofilo che cerca di comprendere l'utente (perché ama un titolo, non solo che genere) piuttosto che un motore di ricerca con del testo intorno.
- Risposte brevi ("però sì", "quello", "l'ho già visto"... ) non attivano più ricerche inutili — sono ora riconosciute come reazioni/correzioni da comprendere rispetto al messaggio precedente, mai come un nuovo titolo da cercare.
- Quando la conversazione è una semplice discussione cinematografica, la raccolta di preferenze e i solleciti passano in secondo piano a favore dello scambio naturale.
- Formulazioni generiche dell'assistente ("Vuoi che ti aiuti?...") esplicitamente vietate.

## v1.15.4 — Agosto 2026

### Correttivo: garanzia rafforzata contro la linea tecnica grezza (seguito del precedente correttivo)

- **Causa radice confermata in diretta**: il correttivo v1.15.3 si basava su un nuovo tentativo di risposta di Movviz, che poteva riprodurre la stessa linea tecnica invece di una vera frase. Ora è implementata una riformulazione automatica deterministica (senza dipendere da un nuovo tentativo del modello linguistico) per garantire che nessuna linea tecnica grezza raggiunga mai l'utente.

## v1.15.3 — Agosto 2026

### Correttivo: menzione di un titolo talvolta risposto con una linea tecnica invece di una vera frase

- **Causa radice confermata in diretta**: il correttivo v1.15.2 impediva bene l'aggiunta silenziosa, ma in alcuni casi l'assistente rispondeva comunque con una singola linea nel formato "• Già nella libreria — Titolo (anno)" — un'imitazione del formato tecnico usato internamente per i risultati di aggiunta, copiata per errore invece di una vera reazione naturale. Questo formato meccanico viene ora rilevato e corretto automaticamente per ottenere sempre una vera frase.

## v1.15.2 — Agosto 2026

### Correttivo: menzione di un titolo talvolta trattata come un'aggiunta silenziosa

- **Causa radice confermata in diretta**: la verifica aggiunta in v1.15.1 (libreria/cronologia/valutazione prima di reagire a un titolo menzionato) non si attivava in realtà mai in alcuni casi, perché l'assistente interpretava talvolta una semplice menzione di titolo ("Hurlevent", "the nice guys") come una richiesta di aggiunta implicita — risultato: una linea tecnica ("Già nella libreria — X") senza alcuna reazione, invece di una vera risposta. Corretto: una menzione di titolo senza verbo d'azione esplicito (aggiunge, mette, scarica...) non attiva più mai un'aggiunta silenziosa e passa ora correttamente attraverso la risposta naturale attesa.

## v1.15.1 — Agosto 2026

### Correttivo: Movviz AI non consultava ciò che sapeva già prima di rispondere

- **Causa radice confermata in diretta**: al semplice menzionare un titolo ("zootopie 2"), l'assistente chiedeva "vuoi aggiungerlo?" per un titolo già presente, o "l'hai visto?" quando la cronologia lo sapeva già — non aveva semplicemente alcuna verifica reale da consultare per una menzione casuale (solo le domande esplicite la innescavano). Ora consulta sistematicamente la libreria, la cronologia di visione e la nota esistente prima di reagire a un titolo menzionato, e non fa più domande di cui conosce già la risposta.
- Quando un titolo menzionato è visto ma mai annotato, l'assistente approfitta naturalmente per chiedere un parere, in una frase, senza trasformarlo in un interrogatorio.
- Correttivo di una promessa non mantenuta: l'assistente poteva rispondere "verifico subito!" e poi non tornare mai con la risposta — poiché una conversazione non ha un secondo tempo automatico, questo tipo di promessa è ora bandito; o la verifica avviene nello stesso messaggio, o l'assistente dice onestamente che non può verificare.
- Personalità affinata: uso più regolare del nome conosciuto, emoji più presenti ma senza eccessi, reazione prima della domanda piuttosto che il contrario.
- Livello di sicurezza aggiuntivo affinché un formato tecnico interno non venga mai visualizzato così com'è in una risposta.

## v1.15.0 — Agosto 2026

### Note da 1 a 5 stelle (nuovo)

- Ogni film e serie può ora ricevere un voto da 1 a 5 stelle, direttamente dalla sua scheda — un solo voto per titolo e per utente, mai condiviso tra account.
- Movviz AI comprende anche un voto dato in conversazione ("mi è piaciuto tantissimo", "che delusione", "gli do 4 stelle") e lo registra automaticamente, senza mai indovinare quando non è abbastanza chiaro — un voto posizionato manualmente sulla scheda ha sempre la precedenza su un voto dedotto da una frase.
- Questi voti affinano sia i suggerimenti del chatbot che quelli della pagina Scopri, che ora condividono la stessa comprensione dei tuoi gusti anziché due logiche separate.
- Il pannello "Cosa sa Movviz AI di te" (pagina Profilo) mostra ora i tuoi voti recenti, distinguendo quelli posizionati a mano da quelli dedotti da una conversazione.

## v1.14.48 — Agosto 2026

### Correttivo: pulsante cestino visibile a tutti nella libreria

- **Causa radice confermata in diretta**: il pulsante di eliminazione di un film (scheda libreria e scheda film) era visibile per qualsiasi utente, mentre il server rifiutava già correttamente l'eliminazione per gli account non amministratore — nessun dato era quindi in pericolo, ma un utente normale vedeva un pulsante che falliva silenziosamente al clic. Il pulsante appare ora solo per gli account amministratore, come ovunque nell'app.

## v1.14.47 — Agosto 2026

### Correttivo: riga "Continuare a guardare" svuotata erroneamente

- **Causa radice confermata in diretta**: la doppia verifica aggiunta in v1.14.44 (per precauzione, senza certezza che fosse necessaria) confrontava ogni titolo "in corso" con la cronologia di visione già sincronizzata — una cronologia che si aggiorna solo ogni 2 ore. Un titolo iniziato di recente non vi era ancora, quindi scompariva erroneamente dalla riga anche se ti apparteneva. Risultato: la riga è passata da 10 titoli reali a soli 3. Questa doppia verifica è rimossa; la protezione originale (il token specifico per ogni account) rimane in vigore.

### Correttivo: Movviz AI e accesso web (continuazione)

- **Causa radice confermata in diretta, due volte**: nonostante la correzione della versione precedente, Movviz AI continuava talvolta a negare categoricamente qualsiasi accesso a internet anche quando la ricerca web era effettivamente attivata nelle impostazioni — la sola istruzione non era sufficiente a impedirlo in modo affidabile. Movviz AI rileva ora questo rifiuto errato e si corregge immediatamente prima di visualizzare qualsiasi cosa, con lo stesso approccio per altre correzioni automatiche già implementate.

## v1.14.46 — Agosto 2026

### Correttivo: Movviz AI e accesso web

- **Causa radice confermata**: Movviz AI rispondeva "non ho accesso a internet" come un'impossibilità tecnica fissa, senza mai tenere conto del setting "Ricerca web" effettivamente attivato o meno sull'account (sezione IA delle Impostazioni). Conosce ora lo stato reale di questo setting: se è disattivato, lo spiega come una scelta di configurazione reversibile piuttosto che un limite definitivo; se è attivato, non pretende più di non avere alcun accesso quando una vera ricerca avviene per determinate funzionalità precise (come ritrovare una scena memorabile). Per ricordare, questo setting ha effetto immediatamente al prossimo messaggio, senza ricaricare la pagina né riconnettersi.

## v1.14.45 — Agosto 2026

### Novità: Movviz AI può finalmente rispondere a "dammi la filmografia di X"

- **Causa radice confermata in diretta**: chiedere la filmografia di un attore o regista ("dammi la filmografia di Brad Pitt") riceveva sempre lo stesso rifiuto, parola per parola, anche insistendo più volte di seguito — Movviz AI semplicemente non aveva dati reali per questo tipo di domanda specifica, a differenza di "cosa mi manca di X" che, invece, era già collegato a una vera ricerca. Una vera ricerca della persona su TMDb (con la sua filmografia reale, incrociata con la tua libreria) viene ora attivata per questa domanda specifica.
- Movviz AI non ripete più una risposta parola per parola da un messaggio all'altro nella stessa conversazione — la formulazione varia sempre, anche quando il contenuto della risposta rimane lo stesso.

## v1.14.44 — Agosto 2026

### Correttivo: secondo sistema di sicurezza per "Continua a guardare"

- La riga "Continua a guardare" verifica ora, oltre ai dati restituiti da Plex, che il titolo in questione è effettivamente presente nella cronologia di visione specifica dell'account che visualizza la pagina prima di mostrarla — un titolo senza alcuna traccia in questa cronologia non viene mai mostrato, indipendentemente da ciò che Plex potrebbe aver restituito. Questa doppia verifica protegge da un possibile errore di account lato Plex, indipendentemente dalla causa esatta.

## v1.14.43 — Agosto 2026

### Correttivo importante: isolamento degli account utente

- **Causa radice confermata**: su un dispositivo condiviso, disconnettersi e riconnettersi con un altro account non resettava mai i dati già visualizzati in memoria (visioni, preferenze, richieste, tutto ciò che è personale) — un precedente correttivo aveva resettato solo un singolo elemento tecnico (lo stato di connessione), non il resto. Risultato: il successivo account poteva vedere per un istante, o talvolta permanentemente, i dati del precedente account prima che questi si aggiornassero da soli. Tutti i dati personali vengono ora completamente resettati ad ogni connessione e disconnessione — più perdite da un account all'altro.
- **Seconda causa scoperta approfondendo**: un profilo Plex secondario (account "casa"/bambino collegato dall'admin, senza connessione Plex propria) non vedeva mai i suoi film/episodi visti sincronizzarsi da Plex — il task in background ignorava semplicemente questi profili. Corretto: ogni profilo, inclusi i profili secondari, ora ha le proprie visualizzazioni sincronizzate indipendentemente.

## v1.14.42 — Agosto 2026

### Correttivo: riga "Ottimizzazioni disponibili" in errore

- **Causa radice confermata in diretta** (pannello Impostazioni > Prestazioni): anche dopo il precedente correttivo, la riga "Ottimizzazioni disponibili" della dashboard falliva sistematicamente dopo un minuto — avviava, ad ogni apertura della dashboard, fino a 50 ricerche in diretta sugli indexatori (una per film/episodio interessato), una dopo l'altra, ampiamente sufficienti a superare il timeout del server. Questa riga è ora limitata alla cache già in memoria, rapida per natura; la ricerca completa in diretta rimane interamente disponibile nel pannello "Cercare e sostituire", attivata volontariamente.

## v1.14.41 — Agosto 2026

### Correttivo: lentezza generale dell'applicazione

- **Causa radice confermata in diretta** (pannello Impostazioni > Prestazioni): la ricerca di ottimizzazioni disponibili (riga "Ottimizzazioni disponibili" della dashboard, e pannello "Trova e sostituisci") rianalizzava l'intera cache delle release per OGNI film e OGNI episodio della libreria, invece di farlo una sola volta e riutilizzare il risultato — su una libreria grande, questo lavoro ripetuto saturava il server per diverse decine di secondi e rallentava TUTTE le altre pagine contemporaneamente (caricamento della dashboard, della libreria, delle richieste...), anche senza alcun rapporto con le ottimizzazioni. Il calcolo viene ora eseguito una sola volta, con un risultato strettamente identico.

## v1.14.40 — Agosto 2026

### Correttivo: Movviz AI

- **Causa radice confermata in diretta**: una richiesta di raccomandazione ("sorprendimi") poteva ricevere una risposta che annunciava un elenco ("Ecco cosa potrebbe sorprenderti...") senza che seguisse alcun titolo — una promessa mai mantenuta, senza scheda di raccomandazione né messaggio di errore. Movviz AI rileva ora questo caso e richiede immediatamente un vero elenco prima di visualizzare qualsiasi cosa.

## v1.14.39 — Agosto 2026

### Correttivo: riga "Continuare a guardare"

- **Causa radice confermata in diretta**: Plex mescolava nella sua lista "in coda" due cose diverse — ciò che è effettivamente in pausa durante la riproduzione, e il prossimo episodio di una serie mai iniziata ma evidenziata perché un episodio precedente era stato visto. La riga mostrava quindi dozzine di miniature con una barra di avanzamento al 0%, mai realmente avviate. Ora viene visualizzato solo il contenuto effettivamente ripreso.

## v1.14.38 — Agosto 2026

### Novità: riga "Continuare a guardare"

- La dashboard mostra ora una riga "Continuare a guardare", tra "Tendenze Movviz" e "Suggerimenti adatti" — i film e gli episodi in corso, con la barra di avanzamento reale, sia che siano stati ripresi da un'app Plex classica o direttamente dal lettore integrato di Movviz. Attivabile/disattivabile in Impostazioni come le altre righe.
- **Causa radice corretta contemporaneamente**: il lettore integrato di Movviz segnalava correttamente il suo avanzamento a Plex ad ogni riproduzione, ma un parametro tecnico mancante faceva sì che Plex ignorasse silenziosamente questo segnale — l'avanzamento non veniva quindi mai realmente preso in considerazione lato server. Corretto, con il bonus dell'attribuzione al giusto account quando più utenti condividono lo stesso Plex.

## v1.14.37 — Agosto 2026

### Correttivo: Movviz AI

- **Causa radice confermata in diretta**: ogni raccomandazione mostrava un messaggio di scuse generico ("ho un vero blocco...") proprio sopra i suggerimenti, anche quando la raccomandazione era riuscita perfettamente — un vero problema di fiducia nel percorso più utilizzato della funzionalità. La frase di accompagnamento di una raccomandazione non veniva in realtà mai costruita, e quindi cadeva di default sul messaggio di errore generico. Ora viene visualizzata una vera frase introduttiva ad ogni raccomandazione.

## v1.14.36 — Agosto 2026

### Correttivo: Movviz AI

- **Causa radice confermata in diretta**: chiedere "ti ricordi il mio nome?" poteva ricevere un "non lo so ancora" anche se Movviz AI lo aveva già usato qualche messaggio prima nella stessa conversazione — il nome era ben conservato, ma la risposta lo negava comunque. Movviz AI rileva ora questo tipo di falso negamento e si corregge immediatamente prima di visualizzare qualsiasi cosa.

## v1.14.35 — Agosto 2026

### Correttivo: Movviz AI

- **Causa radice confermata in diretta, dopo la correzione della versione precedente**: l'istruzione da sola non era sufficiente a impedire ad alcuni modelli di copiare letteralmente la nota tecnica interna invece di riformularla — il problema persisteva nonostante un'istruzione rafforzata. Movviz AI rileva ora da sé quando accade e richiede immediatamente una vera riformulazione prima di visualizzare qualsiasi cosa; se anche questo sollecito fallisce, la nota viene automaticamente ripulita da tutto ciò che la tradiva come tecnico. Il testo interno non può più apparire in una risposta, indipendentemente dal modello utilizzato.

## v1.14.34 — Agosto 2026

### Movviz AI

- **Causa radice confermata in diretta**: quando veniva effettuata una verifica reale per rispondere a una domanda specifica (possesso, visione, casting, stato di una serie, cosa manca a un franchise), Movviz AI copiava talvolta letteralmente la nota tecnica interna invece di formulare una vera frase — una risposta che suonava come un estratto di database piuttosto che una conversazione. Corretto: i fatti verificati rimangono accurati, ma ora sono sempre riformulati in modo naturale.
- Personalità rafforzata in modo più generale: istruzione esplicita per non lasciare mai trasparire formattazioni o strutture tecniche interne in una risposta, indipendentemente dal tipo di domanda.
- **Causa radice confermata in diretta**: una raccomandazione o un'aggiunta un po' lunga poteva, su alcuni modelli, essere tagliata nel mezzo prima della fine — finora, qualsiasi interruzione faceva perdere tutto e mostrava un messaggio di errore generico al suo posto. Movviz AI recupera ora gli elementi già completi di una risposta tagliata invece di buttarli via tutti.

## v1.14.33 — Agosto 2026

### Correzione: import Netflix

- **Causa radice confermata su un vero esport**: due bug di riconoscimento facevano perdere gran parte dei titoli. Prima, un numero di episodio isolato ("Episodio 24") veniva erroneamente preso per un numero di stagione — cercato come "stagione 24" di una serie che ne ha solo 2 o 3, inevitabilmente irreperibile. Poi, una serie senza alcuna etichetta di stagione (solo "Serie: Titolo episodio") poteva essere mal indirizzata durante la ricerca e perdere l'episodio preciso nel passaggio.
- Le etichette "Parte N" e "Volume N" sono ora riconosciute come stagioni allo stesso modo di "Stagione N".

## v1.14.32 — Agosto 2026

### Movviz AI

- Movviz AI verifica ora realmente, prima di rispondere, quattro tipi di domande su un titolo specifico anziché indovinare basandosi solo sulla sua memoria: se possiedi già un titolo ("ho Alien?"), se l'hai già visto (interamente o solo in parte), chi vi recita e chi l'ha realizzato, e se una serie è terminata o ancora in corso. Quando la domanda non può essere verificata in modo affidabile (titolo irreperibile), lo dichiara chiaramente invece di inventare una risposta.

## v1.14.31 — Agosto 2026

### Correzione

- **Causa radice confermata in diretta**: quando chiedevi cosa ti manca di un attore, di un regista o di un franchise ("quale film mi manca di..."), Movviz AI poteva ancora inventare una risposta falsa ("non hai nessun film Pokémon") nonostante una precedente correzione su questo stesso tipo di errore — l'istruzione da sola non era sufficiente a impedirlo in modo affidabile. Per questa specifica formulazione, Movviz AI avvia ora una vera ricerca nel catalogo e verifica realmente, titolo per titolo, cosa è già nella tua libreria prima di rispondere, invece di indovinare.

## v1.14.30 — Agosto 2026

### Movviz AI

- Movviz AI sa ora da quanto tempo non guardi nulla e con quale ritmo stai guardando al momento (numero di visualizzazioni negli ultimi 7 e 30 giorni) — un segnale reale, basato sulle tue visualizzazioni datate, per risposte meglio adattate alla tua attività recente piuttosto che semplici contatori grezzi. Queste informazioni sono anche visibili nel pannello "Cosa sa Movviz AI di te" del profilo.

## v1.14.29 — Agosto 2026

### Correzione

- **Causa radice confermata in diretta**: il pulsante "Forzare sincronizzazione Plex" chiedeva effettivamente a Plex di eseguire una nuova scansione, ma immediatamente avviava la sincronizzazione Movviz — prima che Plex avesse finito la propria scansione in background. Risultato: il pulsante mostrava un successo senza mai risolvere il blocco "in attesa di sincronizzazione Plex". Corretto: viene rispettato un vero ritardo prima di verificare, con una seconda verifica automatica qualche secondo dopo per le librerie più lente da scansionare.

## v1.14.28 — Agosto 2026

### Movviz AI

- Quando si corregge l'assistente perché ha affermato erroneamente che un titolo non è nella tua libreria, questa correzione viene ora salvata — se lo stesso errore si ripete più volte, l'assistente diventa nettamente più cauto prima di affermare un'assenza, piuttosto che ripetere lo stesso errore in ogni conversazione.

## v1.14.27 — Agosto 2026

### Movviz AI

- Il contesto consolidato ("ciò che Movviz AI sa di te") ora si aggiorna vicino ad ogni azione reale (film/episodio segnato come visto, voto 👍/👎, importazione Netflix completata) piuttosto che solo aprendo la chat — sempre con un solo calcolo alla volta, mai un trattamento continuo.

## v1.14.26 — Agosto 2026

### Correttivi Movviz AI

- **Causa radice confermata in diretta**: quando il modello linguistico rispondeva senza una vera frase (ad esempio perché tutta la sua risposta serviva solo a memorizzare un'informazione internamente), la chat Movviz restituiva un "Ok!" completamente fuori tema — anche di fronte a un commento diretto dell'utente o a una vera domanda come "cos'altro?". Una nuova verifica rileva questo caso e richiede immediatamente una vera risposta prima di mostrarla, senza che si noti o rallenti la conversazione; solo come ultima risorsa, un messaggio riconosce onestamente la difficoltà invece di un incongruo "Ok!".
- **Causa radice confermata in diretta**: chiedere "cosa mi manca di [nome comico/attore/regista]?" poteva produrre un elenco di titoli completamente inventati, presentato erroneamente come verificato nella libreria ("secondo la tua cronologia") — al punto da affermare che mancava un titolo quando era già presente. Questo tipo di domanda non ha più il diritto di inventare un elenco: la chat spiega onestamente che non può verificarlo in modo affidabile qui e indirizza alla ricerca Movviz, dove ogni titolo mostra davvero se è già nella libreria.

## v1.14.25 — Agosto 2026

### Correttivo Movviz AI

- **Causa radice confermata in diretta**: rispondere con una sola parola ("Seb") alla propria domanda "come ti chiami?" non era sufficiente — il nome di battesimo non veniva mai salvato, anche se continuava a usarlo normalmente nella conversazione in corso. Risultato: poteva affermare "non mi hai dato il tuo nome" usando lo stesso nome nella stessa frase. Corretto: una breve risposta alla propria domanda sul nome è ora correttamente riconosciuta e salvata.

## v1.14.24 — Agosto 2026

### Correttivi Movviz AI

- **Causa radice confermata in diretta**: incollare un lungo elenco di titoli (es. copiato da una cronologia Netflix) faceva fallire la risposta in loop, indipendentemente dalla riformulazione — la risposta generata superava il limite di lunghezza consentito e arrivava troncata, quindi invalida. Limite aumentato, e l'aggiunta di più di 25 titoli alla volta è ora limitata correttamente ai primi 25 anziché provare (e fallire) su tutti insieme.
- Un titolo in formato "Serie: Titolo episodio" (tipico di un export Netflix, es. "Sakamoto Days: L'assassino leggendario") veniva cercato così com'era e non trovava mai nulla — ora riconosciuto come la serie sola, E l'episodio preciso viene trovato e segnato come visto (non solo la serie aggiunta).
- Nuovo: chiedere l'elenco degli episodi di una serie (essendo sulla sua scheda) restituisce l'elenco reale da Movviz, con lo stato visto — niente più rifiuti né invenzioni.

## v1.14.23 — Agosto 2026

### Nuovo

- Un titolo bloccato su « In attesa di sincronizzazione Plex » (file presente ma non ancora rilevato da Plex) propone ora un pulsante per forzare la sincronizzazione immediatamente (admin), invece di aspettare il prossimo passaggio automatico (fino a 5 minuti).

## v1.14.22 — Agosto 2026

### Correzione: importazione Netflix

- **Causa radice confermata in diretta** (esportazione reale di 3217 righe): l'importazione era contenuta in una singola richiesta HTTP, che scadeva prima della fine su una cronologia voluminosa — ogni titolo/episodio richiede una ricerca online, e una cronologia di diversi anni ne accumula centinaia.
- **Corretto**: l'importazione ora viene eseguita in background sul server con una barra di avanzamento direttamente nel pulsante — puoi lasciare la pagina Impostazioni durante l'importazione, continua e riprenderà la visualizzazione se torni su di essa.
- Corretti due bug di riconoscimento: la data di una visione veniva interpretata male (giorno/mese invertiti a seconda degli esportazioni), e le serie il cui titolo contiene un « : » (es. miniserie) venivano tagliate male.

## v1.14.21 — Agosto 2026

### Netflix

- Impostazioni → Netflix ora propone un link diretto alla tua pagina attività di visione Netflix (pulsante « Scarica tutto »), così non devi più cercare dove trovare il file da importare.

## v1.14.20 — Agosto 2026

### Nuovo: integrazione Netflix

- Impostazioni → Netflix: importa la tua cronologia Netflix (file scaricato dal tuo account Netflix, nessuna password richiesta) per marcare questi film ed episodi visti in Movviz — strettamente privato per ogni account.
- Lo stato « Visto » spuntato manualmente, o importato da Netflix, viene ora propagato al tuo account Plex collegato (film, serie, stagione, episodio) — finora la sincronizzazione funzionava solo nell'altra direzione (Plex verso Movviz).

## v1.14.19 — Agosto 2026

### Correzione

- Il popup « novità » mostrava a volte testo non tradotto per interfacce non francesi — la traduzione per lingua di questo popup aveva smesso di essere mantenuta da diverse versioni senza che il meccanismo di fallback se ne accorgesse. Semplificato: una singola fonte di verità, in francese, coerente con il resto del repository.

## v1.14.18 — Agosto 2026

### Movviz AI

- L'assistente si adatta ora allo stile di ognuno (diretto, amichevole, con umorismo...) invece di un tono fisso, e varia le sue formulazioni per non ripetersi mai.
- Quando torni su Movviz dopo un periodo di assenza, l'assistente può aprire la conversazione da solo con una domanda sul cinema — non più di una ogni poche ore.
- Nuovo pulsante « Creare il contesto » sulla tua pagina profilo: un'analisi della tua attività reale (visioni, richieste, feedback) costruisce una comprensione duratura dei tuoi gusti — il meccanismo che ti piace, non solo il genere — e continua ad arricchirsi da solo con l'uso, senza mai girare continuamente.
- I suggerimenti riconoscono meglio la logica della saga: il prossimo episodio non visto di una saga passa ora in priorità, e possono essere proposte diverse piste (continuare la saga / stessa energia altrove / ancora più estremo) invece di un unico scelta imposta.
- Nuovo, opzionale e disattivato di default: ricerca web (solo tramite Mistral) per evocare con parsimonia una scena memorabile di un titolo già visto — mai spoiler su una serie in corso, attivabile in Impostazioni.
- L'assistente può ricordare che un titolo è stato visto semplicemente facendotelo dire in conversazione, senza dover passare dalla sua scheda.
- Diversi affinamenti del motore di raccomandazione (fiducia ponderata sui gusti appresi, lieve noia dopo una sequenza dello stesso tipo di contenuto) e un'indicazione chiara: non chiedere mai di riformulare, cercare sempre di capire.

## v1.14.17 — Agosto 2026

### Movviz AI

- Due revisioni complete hanno trovato e corretto 7 bug reali di comprensione: il motore dell'atmosfera confrontava nomi di tratti che non corrispondevano più sempre da un'analisi all'altra, una serie era esclusa dai suggerimenti anche dopo un solo episodio visto (invece dell'intera serie), un eccesso di contraddizioni interne nelle istruzioni di conversazione, e una manciata di altre correzioni più discrete riguardanti la memoria.
- Nuovo: "Cosa sa di te Movviz AI", un pannello sulla tua pagina profilo che mostra chiaramente (mai codice grezzo) ciò che l'assistente ha ritenzione: fatti, attività, raccomandazioni piaciute o rifiutate.

## v1.14.16 — Agosto 2026

### Movviz AI

- Corretto un bug serio: un suggerimento che citava una parola tra virgolette poteva apparire in JSON grezzo invece di schede — corretto alla radice, nessun rischio di perdita qualunque cosa accada.
- Le conversazioni ora sopravvivono a un riavvio del server — solo il pulsante cestino le svuota.
- Il post e il titolo di un suggerimento sono cliccabili e aprono la scheda.
- Aggiungere un suggerimento ora scatena una vera reazione dell'assistente su quel titolo.
- Nuovi modi di suggerimento riconosciuti: "più cupo", "meno violento", "suggeriscimi qualcosa" senza riferimento preciso, o volontariamente sconosciuto.
- I suggerimenti tengono conto dei tuoi feedback passati 👍/👎 in modo più sfumato (ciò che è piaciuto E ciò che è stato rifiutato, non solo uno dei due) e dell'appartenenza a un'unica saga rispetto a ciò che stai guardando.
- Un bisogno espresso chiaramente nel momento ("qui ho bisogno di qualcosa di più leggero") passa ora davanti alle tue abitudini generali invece di essere ignorato.
- L'assistente comprende meglio le richieste che escono dal genere ovvio ("come questo film, ma senza questo elemento") e pone una domanda mirata invece di indovinare a caso quando la tua richiesta è davvero ambigua.

### Impostazioni

- Nuova scheda "Esperienza" (video sulle schede, episodi speciali) separata dalla Dashboard.
- Nuova impostazione: gli episodi speciali non contano più nello stato "serie vista completamente" (disattivato di default), e una stagione non ancora uscita non blocca più questo stato.

## v1.14.15 — Agosto 2026

### Movviz AI

- Corretta una sottigliezza di memoria: l'assistente non dice più "lo annoterò" senza farlo realmente nello stesso messaggio — o utilizza direttamente ciò che sa già, o dice chiaramente che non lo sa ancora.

## v1.14.14 — Agosto 2026

### Movviz AI

- Nuovo pulsante cestino direttamente nella chat su un elemento "già presente": se in realtà è l'elemento sbagliato, puoi eliminarlo tu stesso con due clic senza lasciare la conversazione (riservato agli amministratori, come ovunque in Movviz — l'assistente non elimina mai nulla da solo).
- Il tuo nome rimane fisso una volta conosciuto — non lo chiede più, e lo cambia solo se gli ne fornisci esplicitamente un altro.
- L'assistente può ora accordare naturalmente le sue frasi in base al tuo nome, con cautela e senza mai insistere se il contesto suggerisce altro.

## v1.14.13 — Agosto 2026

### Movviz AI

- Corretto un bug in cui l'assistente poteva aggiungere il film sbagliato in caso di falso amico tra lingue (es. "un uomo un vero" aggiungeva un film spagnolo non correlato) — ora verifica la vera somiglianza del titolo prima di aggiungere qualsiasi cosa, e preferisce dire "non trovato" piuttosto che sbagliare film.

## v1.14.12 — Agosto 2026

### Schede film/serie

- Rimosso il duplicato dell'anno accanto al titolo — l'anno viene visualizzato una sola volta, accanto alla durata.

## v1.14.11 — Agosto 2026

### Movviz AI

- Nuova fonte di suggerimenti: oltre alle proprie idee, Movviz AI attinge ora anche alle raccomandazioni TMDb per il titolo che stai guardando — entrambe le fonti passano attraverso la stessa selezione finale (qualità, umore, storico, recensioni).
- I suggerimenti non vengono più visualizzati come un blocco di schede silenziose: ogni suggerimento è ora introdotto da una piccola frase diversa ("Ehi, penso che ti piacerà", "Oppure c'è questo..."), per una vera sensazione di scambio piuttosto che un elenco grezzo.

## v1.14.10 — Agosto 2026

### Movviz AI

- L'umorismo dell'assistente si adatta ora a qualsiasi genere (non solo l'horror) e non riutilizza mai lo stesso scherzo due volte.
- Le aneddoti sono ora sempre brevi — una frase inserita naturalmente, mai un saggio.

## v1.14.9 — Agosto 2026

### Movviz AI

- Corretto un bug di fondo: un nome fornito in conversazione non sopravviveva a un "svuota conversazione" — un errore di calcolo faceva sì che il rilevamento della prima conversazione non si attivasse mai correttamente.
- Il nome di un utente viene ora catturato direttamente a livello di codice (più formulazioni riconosciute), senza dipendere solo dalla buona volontà del modello linguistico ad annotarlo.
- Corretta una perdita di visualizzazione in cui un testo tecnico interno poteva apparire in chiaro in una risposta, e un caso in cui l'assistente annotava l'assenza di informazioni come se fosse un ricordo.
- Movviz AI chiede ora esplicitamente il nome fin dalla prima conversazione se non glielo hai fornito, e insiste naturalmente finché non lo conosce.
- Evita ora di porre la stessa domanda di apertura ad ogni messaggio.

## v1.14.8 — Agosto 2026

### Movviz AI

- Pannello "Mi ricordo di te" rimosso dalla chat.
- Corretto un bug in cui l'assistente rispondeva con semplici puntini di sospensione invece di una vera risposta — in particolare quando reagivi a un suggerimento già proposto (una domanda, uno scherzo) invece di chiederne uno nuovo.
- L'assistente non pretende più di aver memorizzato qualcosa che in realtà non ha mai ricevuto (es. il tuo nome prima che tu lo fornissi).

## v1.14.7 — Agosto 2026

### Movviz AI

- Per una richiesta vaga o generale ("qualcosa per una ragazza", "un film per tutta la famiglia"...), Movviz AI si basa ora esplicitamente sull'esperienza reale della persona che chiede (i suoi gusti, le sue richieste — mai quelle di un altro account della famiglia) piuttosto che su un cliché generico; senza indizio sfruttabile, fa una domanda piuttosto che indovinare a caso.

## v1.14.6 — Agosto 2026

### Movviz AI

- Nuovo modo "Sorprendimi": chiedi esplicitamente di essere sorpreso o di uscire dalle tue abitudini, e l'assistente privilegia titoli compatibili con il tuo gusto ma volutamente diversi dalla scelta ovvia — spiegandoti il perché.
- L'assistente ora modula i suoi suggerimenti: distingue ciò che è sicuro da ciò che è più esplorativo, piuttosto che presentare ogni suggerimento come una certezza.

## v1.14.5 — Agosto 2026

### Impostazioni

- Pulsante "Salva" di Movviz AI duplicato in alto nel pannello: dopo aver attivato l'IA o incollato una chiave API, non è più necessario scorrere l'elenco completo dei fornitori per salvare.

### Movviz AI

- Correzione: il campo messaggio della chat troncava la parte inferiore del testo di esempio (placeholder) invece di visualizzarlo interamente su due righe.

## v1.14.4 — Agosto 2026

### Movviz AI

- Nuovo motore di umore: quando richiedi un consiglio da una scheda, Movviz analizza il tono profondo del titolo di riferimento e di ogni candidato (umorismo, energia, tonalità...) per classificare i suggerimenti in base alla vera vicinanza d'atmosfera, non solo al genere TMDb.
- Prima conversazione con l'assistente: si presenta e pone fino a 3 piccole domande (nome, cosa ti piace guardare al momento...) per iniziare a conoscerti — mai più, mai un modulo.
- Personalità definita: sempre contento di ritrovarti, un pizzico di umorismo ben piazzato (es. un film horror), e talvolta un aneddoto su un titolo — sempre formulato con cautela, mai presentato come certezza assoluta.
- Guardrail permanente: l'assistente non può e non potrà mai eliminare nulla in Movviz, indipendentemente dal modo in cui glielo chiediamo.

## v1.14.3 — Agosto 2026

### Scoperta

- Correzione del fondo: la riga "Piattaforme" utilizzava un corrispettivo approssimativo per nome sul catalogo TMDb, che poteva agganciare un servizio oscuro invece di quello corretto (es. un complemento sconosciuto invece del servizio atteso). Sostituita con un elenco fisso e verificato delle 10 piattaforme più utilizzate in Francia, con i loro veri loghi in migliore qualità.
- Eliminazione della riga "Diffusori", che duplicava "Piattaforme" (stessi marchi, ma peggio: limitati alle serie).
- Su mobile, le piastrelle Piattaforme/Studi passano a icone rotonde e compatte invece del grande formato rettangolare pensato per desktop.

### Movviz AI

- L'assistente ora ricorda i fatti che gli fornisci in conversazione (nome, preferenza esplicita…) da una sessione all'altra, oltre ai suoi ricordi già esistenti (titoli aggiunti, raccomandazioni accettate).
- Nuovo feedback 👍/👎 su ogni raccomandazione — serve da base per una classificazione più pertinente dei futuri suggerimenti.
- Il modello propone ora più candidati in background; Movviz li filtra e li classifica da solo (qualità, novità, feedback passati, già richiesto) prima di mostrare solo i migliori — ed esclude ora pure e semplicemente qualsiasi titolo già visto completamente.

## v1.14.2 — Agosto 2026

### Scoperta

- I filtri delle piattaforme di streaming (Prime Video, Netflix, Disney+, ecc.) sono ora vere piattaforme riconosciute da TMDb, valide sia per film che per serie — nessuna chiave API aggiuntiva richiesta.
- Correttivo: selezionare una piattaforma riportava forzatamente su "Serie" anche essendo su "Film", e tornare su "Film" eliminava il filtro piattaforma tornando alla dashboard. Il filtro rimane ora attivo qualunque sia il tipo visualizzato.
- Nuova riga "Piattaforme" sulla pagina Scoperta.

### Movviz AI

- Correzione: l'assistente confondeva il numero di film visti dall'utente con il numero totale di film nella libreria, fornendo risposte errate sulla dimensione della collezione.

### Affidabilità

- Correzione di un crash casuale del carosello della dashboard (Hero) e delle schede con video d'atmosfera: due animazioni di transizione annidate potevano entrare in conflitto per rimuovere gli stessi elementi dalla pagina nello stesso momento, causando occasionalmente un errore generale dell'applicazione.

## v1.14.1 — Agosto 2026

### Movviz AI

- Correzione: il pulsante chat non appariva che dopo un ricaricamento completo della pagina una volta attivato Movviz AI nelle Impostazioni — ora appare immediatamente.
- Nuovo log (Impostazioni → Movviz AI, admin): cronologia delle ultime chiamate chat con fornitore utilizzato, successo/fallimento, latenza — per capire cosa è successo senza indovinare.
- Ogni fornitore mostra ora dove ottenere una chiave API gratuita direttamente nelle Impostazioni.
- Rilevamento quota/chiave non valida ampliato (403 oltre a 429) per un passaggio più affidabile tra le chiavi di un singolo fornitore.
- Nuovo passaggio, completamente opzionale, per attivare Movviz AI e aggiungere una chiave dal primo setup di Movviz.
- Lo sfondo e il logo personalizzati di una scheda ora privilegiano la lingua dell'interfaccia (logo francese se disponibile per un utente francese, ecc.) piuttosto che la semplice popolarità.
- Il logo viene visualizzato anche nel carosello Hero della dashboard, non solo sulla scheda.

### Affidabilità e conferme

- Eliminazione di una scheda (pulsante cestino) e eliminazione definitiva dal Cestino: ora viene sempre richiesta una conferma, niente più eliminazioni accidentali con un clic.
- Sincronizzazione Plex accelerata dopo un download: Movviz attiva la propria sincronizzazione pochi secondi dopo un'importazione invece di aspettare fino a 5 minuti.
- Correzione fullscreen: il contenitore del lettore aveva classi CSS di layout inerti (variante non salvata), sostituite con una logica affidabile.
- Editor immagine scheda unificato con "Modifica scheda" (un solo pulsante matita) — la personalizzazione immagine rimane aperta a tutti gli utenti, le impostazioni strutturali rimangono riservate agli admin.
- I sottotitoli di YouTube ora sono correttamente disattivati sui video d'atmosfera (schede e carosello).

## v1.14.0 — Agosto 2026

### Movviz AI — chatbox intelligente (nuovo)

- Nuovo assistente conversazionale (bolla fluttuante, disattivato di default): comprende le richieste in linguaggio naturale, aggiunge film/serie alla libreria, raccomanda con lo stesso tono ("dopo Scary Movie, suggerisci Naked Gun" piuttosto che una commedia a caso), risponde a domande comuni.
- Multi-fornitore (Mistral, OpenRouter, Gemini) con più chiavi per fornitore, rotazione automatica in caso di quota raggiunta e passaggio al fornitore successivo se necessario — configurabile da Impostazioni (admin).
- Memoria utente: l'assistente ricorda i titoli aggiunti e le raccomandazioni accettate, e conosce un riepilogo numerico dell'attività (film/serie/episodi visti, richieste, serie più guardate) — strettamente isolata per account, mai mescolata tra utenti.
- Non chiama mai il modello linguistico senza una richiesta esplicita dell'utente: nessuna analisi in background, nessun impatto sul funzionamento normale di Movviz se l'IA rimane disattivata.

### Tracciamento "visto" arricchito

- Le schede film/serie e gli episodi mostrano ora una cronologia datata ("visto ieri", "fa 3 giorni"...), combinando Plex e la riproduzione diretta da Movviz.
- Nuovo pulsante manuale "marcare come visto / non visto" su film, stagioni ed episodi — completa Plex per tutto ciò che è stato guardato altrove.

### Schede film/serie

- Pulsante di ripresa rivisto: quando una riproduzione è in corso, la scheda propone direttamente "Riprendi a HH:MM:SS" (con avanzamento visibile) invece di un generico pulsante "Riproduci" — la scelta "riprendere o ricominciare" viene sempre proposta all'apertura del lettore.
- Nuova impostazione (Impostazioni → Esperienza) per disattivare il trailer in sfondo animato sulle schede e mantenere un'immagine fissa.
- Il fond e il logo di una scheda possono ora essere personalizzati: un nuovo pulsante apre un selettore di immagini alternative provenienti da TMDb (ogni utente può regolare, come per i tag).

### Coda

- Nuovo stato «In attesa» e «Verifica» nel monitoraggio dei download, per distinguere meglio una ricerca in sospeso da un'importazione in fase di controllo.

### Affidabilità

- Correzione di un bug di configurazione di build che poteva, su una macchina di sviluppo, gonfiare eccessivamente l'output di compilazione — senza impatto sulle immagini Docker/l'installer Windows.

## v1.13.92 — August 2026

### Download manuale: la regola delle parole vietate non si applica più

- **Causa**: il controllo «termine vietato» post-download (`checkPostImportBlockedWord`) si applicava a TUTTE le importazioni, comprese quelle avviate manualmente dall'utente. Un download manuale il cui nome conteneva una parola vietata (es. VOSTFR) veniva eliminato e la libreria impostata su «mancante» invece di essere rinominata/spostata.
- **Correzione**: un download manuale (pagina di ricerca, scheda film, pannello «Aggiungi una versione») marca ora il suo infoHash come manuale (`manualGrab.ts`, memoria TTL 6 h) non appena il motore lo accetta. All'importazione, questo torrent è esentato dal controllo delle parole vietate: viene rinominato, spostato e importato normalmente. Solo i download automatici mantengono la regola.
- Prima acquisizione automatica, serie, episodi: comportamento invariato.

## v1.13.91 — August 2026

### «Aggiornamento per qualità» non crea più duplicati (2) (3) (4)

- **Causa**: la decisione «sostituisci il video esistente» era marcata solo dal flusso «Aggiunta versione» (LOT6). Tutti gli altri percorsi di download di un film già disponibile — pulsante lente della scheda (ricerca qualità), upgrade automatico 6 h, upgrade-candidates, ricerca manuale — non marcavano alcuna intenzione: il motore rinominava il nuovo file con un suffisso di collisione «(2)»/«(3)» non appena il nome finale era occupato dal vecchio file, che non veniva mai eliminato.
- **Correzione**: ogni nuova versione scaricata per un film già disponibile (`movie.file`) marca ora un'intenzione «sostituisci» sull'infoHash prima del download (`autoGrab`, `searchAndReplace`, percorso download con ricerca manuale). All'importazione, il vecchio file primario viene eliminato dal disco (guardie di sicurezza: root motore validata, profondità ≥ 2, nome sanificato, unlink non-ricorsivo) e poi il nuovo file viene rinominato nel suo nome finale — nessun duplicato «(n)» più in Plex.
- Prima acquisizione, serie ed episodi: comportamento invariato.

## v1.13.90 — August 2026

### «Anno minimo dei caroselli» finalmente rispettato ovunque

- **Causa**: la impostazione `minYear` (Impostazioni → Esperienza dashboard) veniva applicata solo alle sezioni «Scopri» e «Raccomandato per te» del dashboard — l'Hero cinematografico, «Aggiunti di recente», «Prossimamente», gli upgrade, e TUTta la pagina Scopri (caroselli + «Visualizza tutto») ignoravano il filtro: un film del 1931 poteva apparire nonostante un limite al 1985.
- **Correzione**: il filtro è ora applicato ovunque in modo uniforme:
  - Hero cinematografico: `buildHeroSlides` riceve `minYear` e non include alcun slide uscito prima.
  - Dashboard: tutte le sezioni (Scopri, Raccomandato, Aggiunti di recente, Prossimamente, Upgrade) passano attraverso lo stesso filtro.
  - Scopri: caroselli TMDb + sezioni C411 + pagine «Visualizza tutto» filtrate; una ricerca esplicita (o un filtro anno manuale) rimane non filtrata.

## v1.13.89 — August 2026

### Mai più crash «removeChild» (errore di visualizzazione globale)

- **Causa**: `NotFoundError: Failed to execute 'removeChild' on 'Node'` inviava l'intera app alla schermata di errore globale. Il trigger: il menu utente aperto (dropdown framer-motion/AnimatePresence) al clic «Disconnetti» — la navigazione verso `/login` smontava lo shell mentre l'animazione di chiusura era ancora in corso, e framer-motion/React si contendevano lo stesso nodo DOM durante la fase di commit.
- **Correzione 1 (causa)**: `UserMenu.logout` chiude immediatamente il dropdown e lascia terminare la sua animazione di uscita (~300 ms) prima del fetch di logout e della navigazione — lo shell non viene più smontato mai con un'animazione in corso.
- **Correzione 2 (rete)**: nuovo `AppErrorBoundary` (React error boundary) attorno a tutto l'albero AppShell — un errore di commit (manipolazione DOM esterna concorrente: hls.js/dash.js/YouTube durante un unmount) non può più uccidere la sessione nel global-error di default: schermo di recupero + rimontaggio pulito tramite « Riprova ».
- Testato su Edge headless: login → logout con dropdown aperto → reindirizzamento `/login` senza errori nella console.

## v1.13.88 — Agosto 2026

### Logout: il reindirizzamento a /login funziona finalmente

- **Causa**: in `UserMenu.logout`, `router.refresh()` veniva chiamato immediatamente dopo `router.push("/login")`. Un refresh emesso subito dopo una navigazione verso un'altra pagina annulla la navigazione in corso (risincronizza la pagina corrente) — la richiesta RSC di `/login` veniva inviata, rispondeva 200, ma l'URL non cambiava mai. Riproducibile su Edge headless: cookie di sessione ben eliminato, back funzionante, ma l'utente rimaneva sulla dashboard fino al ricaricamento manuale.
- **Correzione**: nessun `router.refresh()` dopo il push nelle 3 navigazioni di logout (`UserMenu.logout`, `PendingApprovalScreen.logout` e il factory reset di `AboutPanel` — stesso pattern, stesso rischio). La pagina di login rivalida già `/api/auth/me` al montaggio, il refresh era inutile.
- **Bonus**: `destroySession()` confrontava l'intero cookie (`raw.sig`) con le sessioni memorizzate (`raw`) — la sessione non veniva mai realmente eliminata da `sessions.json` (marcava fino alla scadenza). Ora estrae il `raw` come `resolveSession()`.
- Foto degli attori in quadrati arrotondati (coerente con i poster, anziché i cerchi).

## v1.13.87 — Agosto 2026

### «Cerca e sostituisci»: i sostituzioni di codec (x264 → x265/AV1) finalmente suggeriti

- **Causa**: gli upgrade di codec e formati personalizzati venivano cercati solo nella cache RSS (~50-150 rilasci più recenti) — solo l'upgrade di lingua scatenava una ricerca diretta negli indexer. Con una cache che copriva quasi mai il catalogo (710 film in x264 quando x265/AV1 sono preferiti, constatato sui dati reali), il pannello mostrava «Nessun sostituto suggerito» anche se esistevano versioni migliori — e il pulsante «Sostituisci» ne trovava una.
- **Correzione**: le scansioni di film ed episodi ora replicano il fallback di grab — se la cache non contiene candidati e il film/episodio può guadagnare con il punteggio del codec (punteggio inferiore al miglior codec configurato), viene lanciata una ricerca diretta limitata (25 per esecuzione, stesso budget del fallback lingua) sugli indexer non rate-limited. Anche gli episodi guadagnano gli upgrade per punteggio di codec (fino ad ora riservati ai film), senza richiedere `preferredVideoCodec`.
- Il pulsante «Sostituisci» è invariato: esegue la propria ricerca diretta, come prima.

## v1.13.86 — Agosto 2026

### Priorità al click: ora garantita lato client

- **Causa**: il marcatura di attività al ri-rendering del layout server non copriva le navigazioni client — l'App Router non ri-renderizza i layout ad ogni navigazione (escono dalla cache del router). Un click su un link rimaneva invisibile per il background, che non cedeva la parola durante il caricamento della pagina.
- **Correzione**: un nuovo componente client (UserActivityPing) ascolta ogni click reale (pointerdown in fase capture, limitato a ~1/s, keepalive) e invia un ping POST a `/api/activity/ping` che marca l'attività nel processo server. Il background cede ora al click, qualunque sia il percorso di navigazione — click, caricamento pagina e ricerca rimangono prioritari durante le scansioni, bulk e download.

### Ricaricamento: la vecchia versione è realmente sostituita

- **Causa** : la lettura è risolta tramite Plex (ratingKey → versione primaria del film). Dopo un nuovo download, il vecchio file è rimasto sul disco → Plex conservava due versioni dello stesso film e continuava a servire la VECCHIA (osservato in diretta: Alita in SBS, versione non-SBS scaricata, lettura ancora in SBS).
- **Correttivo** : ogni importazione di sostituzione (selezione manuale, aggiornamento qualità) elimina il vecchio file dal disco non appena esisteva un file primario — salvo scelta esplicita "Aggiungi come versione supplementare". Eliminazione mantenuta (mai il file importato stesso, mai fuori dalla radice della libreria); Plex rianalizza e vede solo una versione: la lettura serve la nuova.

### Ripristino di fabbrica — nessun più folder di configurazione, ritorno al wizard

- **Problema** : eliminare la cartella di configurazione "a caldo" non serviva a nulla — il server in esecuzione rigenerava i file dalla sua memoria (cache globalThis, scritture coalesciate 300 ms) e la sessione cookie rimaneva valida; l'app continuava ad apparire normalmente, senza wizard.
- **Correttivo 1 — rilevamento automatico** : se non esiste più alcun account (cartella di configurazione eliminata), AppShell reindirizza automaticamente al wizard (`/setup`) invece di mostrare un'app rotta.
- **Correttivo 2 — pulsante "Ripristino completo"** in Impostazioni → Informazioni (admin) : svuota tutte le cache di memoria del server, elimina la cartella di configurazione (eliminazione convalidata: percorso assoluto + profondità), cancella il cookie di sessione, quindi apre il wizard al ricaricamento.

## v1.13.85 — Agosto 2026

### Correzione: il limite di 10 schede riguarda solo la riga tendenza di classamento

- **Promemoria del problema** : solo la riga "Tendenze Movviz" (quella con i numeri del top 10) mostrava più di 10 schede — le altre righe funzionavano perfettamente con la loro lunghezza originale.
- **Correttivo v1.13.84 modificato** : il limite di 10 schede è ristretto alla sola riga tendenza unificata (tendenze ∪ popolari), alla fonte. Tutte le altre righe — consigliato per te, novità, kids, ecc. — riprendono esattamente la loro lunghezza originale; nessun regressione di visualizzazione sulle righe non interessate.

## v1.13.84 — Agosto 2026

### Righe "Tendenze Movviz" : sempre 10 schede massimo

- **Causa** : la riga unificata "tendenze ∪ popolari" non era limitata — a differenza della semplice riga "Tendenze" (10 max) — e il Dashboard mostrava l'elenco completo (fino a ~40 schede) non appena l'unione superava le 10. Risultato: righe sovraccariche con schede senza riga, caricamento pesante e visualizzazione problematica (osservato in particolare su Mac ARM).
- **Correttivo** : tutte le righe di `/api/metadata/rows` sono ora limitate a 10 schede (stessa regola di "Tendenze"), e il Dashboard applica anche il limite in cintura di sicurezza. Il pulsante "Vedi tutto" apre sempre la versione completa paginata.

## v1.13.83 — Agosto 2026

### Priorità assoluta al click e al caricamento della pagina

- **Navigazione e caricamento ora segnalano l'attività utente** : il layout radice (ri-render del server ad ogni navigazione App Router) segnala l'attività non appena è presente una sessione — prima, una navigazione pura (senza chiamata API dietro) rimaneva invisibile al sistema di priorità, e lo sfondo non cedeva la parola durante il caricamento della pagina. Ogni click su un link fa quindi cedere immediatamente lo sfondo (yieldToUser), che riprende dopo 4 s dall'ultima interazione.
- **Il sync Plex cede ora la parola** : era il più grande consumatore senza cessione — i suoi cicli (film, serie, sezioni) facevano centinaia di fetch Plex/TMDb sequenziali senza mai interrompersi mentre voi cliccavate. `yieldToUser("sync Plex films/séries")` viene ora chiamato per ogni elemento e per ogni sezione; una navigazione lo mette in pausa fino a 30 s, dopodiché riprende.
- **Ricerca manuale limitata** : la ricerca in diretta (fallback degli indicizzatori) eseguiva `Promise.all` su tutti gli indicizzatori senza limiti — 3 schede + un bulk = decine di socket aperti, e tutto il server (inclusi i clic) rallentava. Un semaforo globale limita a **2 ricerche dirette simultanee** (la successiva aspetta uno slot ≤ 15 s e passa comunque): il caricamento della pagina rimane fluido durante i picchi.
- **Promemoria** : il resto del meccanismo era già in atto — corsie (`runBackground`), limitazione del tasso degli indicizzatori con riserva garantita all'utente (5 slot/host + 10 globale), coda di job con watchdog di 10 min e concorrenza ridotta durante i download.

## v1.13.82 — Agosto 2026

### Log diagnostici sottotitoli (modalità ffmpeg)

- L'avvio del remux logga l'output WebVTT aggiunto (`[remux] output WebVTT traccia=0:s:N`); la rotta dei sottotitoli logga il percorso intrapreso per ogni richiesta (`[subtitle] FAST PATH file=...` vs `[subtitle] nessuna sessione live — estrazione dedicata`). Permette di decidere immediatamente in `docker logs` se viene utilizzato il lettore istantaneo.

## v1.13.81 — Agosto 2026

### Sottotitoli modalità ffmpeg: quasi istantanei (0,5 s invece di ~1 min)

- **Nuovo fast path** : il processo di remux (che legge già il file per produrre il video) scrive **anche** la traccia di sottotitoli testuale in WebVTT in un file temporaneo, come output secondario — al ritmo della riproduzione del film, senza alcuna lettura disco/rete aggiuntiva. La rotta dei sottotitoli "taila" questo file e trasmette i cue al lettore: **il primo cue arriva in ~0,4 s** (verificato con riproduzione locale), invece di aspettare che un'estrazione separata rilegga tutto il file dall'inizio (~1 min su NAS).
- **Commutazione automatica della sessione** : al salto, al cambio di qualità o di audio, il remux riparte con un nuovo file temporaneo — lo stream di sottotitoli commuta da solo su di esso (tempi assoluti identici, nessun buco nei cue), senza interruzione per il lettore. In pausa, l'estrazione segue il video (backpressure) e riprende da sola.
- **Fallback mantenuto** : traccia testuale non pre-estratta (lingua diversa dalla traccia predefinita) → estrazione ffmpeg dedicata come prima; tracce immagine (PGS/VobSub) → fallback transcodifica Plex (HLS) invariato.
- **Sicurezza** : file WebVTT temporanei eliminati alla morte della sessione (unlink mirato, nome limitato solo nella directory temporanea di sistema — mai eliminazione ricorsiva).

## v1.13.80 — Agosto 2026

### Sottotitoli modalità ffmpeg: 2° bug radice — l'analizzatore non capiva il formato ffmpeg

- **Corretto** : i sottotitoli rimanevano invisibili anche dopo la correzione del doppio annullamento — causa confermata con riproduzione locale dell'estrazione: il muxer WebVTT di ffmpeg scrive le righe temporali in `MM:SS.mmm` quando le ore sono 0 (film di meno di 1h → **nessun** cue analizzato; film più lungo → solo i cue dopo la prima ora). L'analizzatore richiedeva `HH:MM:SS.mmm`: le ore sono ora facoltative nella regex, entrambi i formati sono accettati e i tempi rimangono corretti (0h36m12s → 2172s).
- **Verificato con riproduzione** : file MKV di test con 3 cue (1s, 5.5s, 1h02m) → vecchia regex: 1 su 3; nuova regex: 3 su 3, secondi esatti.

## v1.13.79 — Agosto 2026

### Sottotitoli modalità ffmpeg: bug radice corretto (non venivano mai caricati)

- **Corretto** : in modalità ffmpeg, i sottotitoli testuali (SRT/ASS/SSA/WebVTT) non venivano mai visualizzati — causa radice confermata in diretta: al caricamento di una traccia, la funzione di pulizia annullava il fetch dei sottotitoli appena avviato (doppio `abort()` sullo stesso AbortController), e il gestore degli errori considerava questo annullamento volontario come un caso normale → ritorno silenzioso, nessun fallback, nessun messaggio. Le tracce vengono ora caricate senza essere sabotate: estrazione WebVTT locale (metodo Plex: sottotitoli serviti separatamente e renderizzati dal client, mai incorporati nel video), rendering tramite il tag `<track>` nativo, tempi reali del film (scostamento `seekBase` ricalcolato ad ogni salto).
- **Migliorato**: il tracciato viene costruito **immediatamente** al caricamento del tracciato — i sottotitoli appaiono man mano che arrivano i pacchetti di estrazione anziché attendere la fine della riproduzione dell'intero file (lungo su NAS, ffmpeg legge tutto il film per estrarre il tracciato).
- **Promemoria**: tracciati immagine (PGS/VobSub, non convertibili in testo) → commutazione automatica sul transcodifica Plex (HLS) come prima.

## v1.13.78 — Agosto 2026

### Schermo intero: i controlli Movviz rimangono padroni

- **Corretto**: il pulsante schermo intero passava solo il `<video>` in fullscreen nativo → il browser imponeva i propri controlli, che mostravano il tempo del **flusso** (ripartenza da 0, relativo al seek) anziché la posizione reale del film, e il cui seek nativo non ricaricava la sessione server — il "tempo del buffer anziché del film, impossibile avanzare" segnalato in schermo intero. Lo schermo intero si applica ora al **contenitore del player**: i nostri controlli (barra di avanzamento con `seekBase + currentTime`, menu, header, doppio tocco, gesti) rimangono visualizzati e funzionanti, sfondo nero cinematografico. iPhone mantenuto sullo schermo intero nativo del `<video>` (l'API Fullscreen non esiste su un contenitore iOS — limite browser, inevitabile).

## v1.13.77 — Agosto 2026

### Transcodifica video ottimizzata NAS + crash server corretto

- **Ottimizzato — transcodifica video locale pensata per NAS**: il codificatore passa da `veryfast` a **`ultrafast` + `zerolatency`** (frame consegnati appena codificati, nessun lookahead) — su un NAS ARM/SoC, il primo buffer arriva ~2× più velocemente e le riprese dopo il rebuffer ripartono immediatamente. Il **GOP è accorciato a 2 s** (`g 48`): un seek o un cambio di qualità risincronizza in meno di 2 s anziché attendere un keyframe a caso (spesso 10 s+ — questo dava "la transcodifica video scatta"). Profilo `main` per un decoding hardware garantito su tutti i client. Bitrate sobri invariati (10/6,5/4/2,2 Mb/s) — la qualità rimane corretta, è la latenza che cala.
- **Corretto — crash server "Invalid state: Controller is already closed"**: quando il client abbandonava una sessione di transcodifica video (seek, cambio di qualità, chiusura del player), la corsa tra la propagazione asincrona del cancel HTTP e l'arresto di ffmpeg poteva distruggere un flusso il cui controller Web era già chiuso → eccezione non gestita che uccideva il processo server (503 generalizzato). I flussi abbandonati sono ora contrassegnati appena l'abort della richiesta e non vengono più mai distrutti con errore; l'errore rimane propagato per i veri fallimenti di codifica (fallback HLS intatto).

## v1.13.76 — Agosto 2026

### Smartphone: player livello Netflix, opzione "anno minimo" per i caroselli

- **Nuovo — Impostazioni → Dashboard → Hero → Anno minimo dei caroselli**: scegli l'anno a partire dal quale vengono visualizzati i film nei caroselli "Scopri" e "Consigliato per te" — addio vecchi film del 1955. "Tutti gli anni" di default, nessuna modifica alla libreria, filtraggio solo visuale.
- **Nuovo — player smartphone (375px/768px)**: doppio tocco sinistro/destro sul video = rewind/avanti veloce ±10 s con feedback aptico e toast (come Netflix), il tocco singolo mostra i controlli senza mai interrompere la riproduzione, la barra dei controlli non trabocca più (pulsanti transcodifica/riproduzione diretta ripiegati su tablet+, volume riservato al desktop dove il cursore appare al passaggio del mouse).
- **Corretto — iPhone**: pulsante schermo intero funzionante (webkitEnterFullscreen), rispetto delle zone di sicurezza (notch e barra di stato), superficie touch del cursore ingrandita (32px), nessun rimbalzo elastico parassita.
- **Corretto — modalità chiara**: pulsanti dell'header, badge di stato e menu del player sono ora forzati in scuro cinematografico (nero traslucido) — addio icone bianche su sfondo bianco; l'auto-mascheramento dei controlli non chiude più un menu in riproduzione.
- **Perf mobile**: sfocatura dell'atmosfera ridotta su GPU piccola (max-sm:blur-2xl), Ken Burns mantenuto.

## v1.13.75 — Agosto 2026

### Player: HLS diventa opzione manuale, profili di compressione ffmpeg, design premium

- **Nuovo — strategia di riproduzione**: il transcodifica HLS (Plex) non viene più selezionato automaticamente. In modalità «Auto», la riproduzione passa tramite la **riproduzione diretta o il remux FFmpeg locale**; se nessun motore locale può leggere il file, viene visualizzato un errore esplicito invece di passare silenziosamente al transcodifica Plex. HLS rimane disponibile **manualmente** in Impostazioni → Plex → Motore di riproduzione (« HLS (transcodifica Plex) — manuale ») per situazioni in cui è ancora utile (sottotitoli immagine PGS/VobSub, traccia audio esotica, rete limitata).
- **Nuovo — profili di compressione ffmpeg**: il menu Qualità del lettore propone ora **Originale / 4K / 2K / FHD / HD** con un vero transcodifica locale (libx264 molto veloce, CRF 23, bitrate contenuti pensati per NAS: 10 / 6,5 / 4 / 2,2 Mb/s, downscale senza mai superare la sorgente). «Originale» conserva la copia bit-perfetta attuale (zero CPU). Il cambio di qualità ricarica la sessione ffmpeg alla posizione corrente; su un leg diretto/MSE, il lettore passa al transcodifica locale.
- **Nuovo — design premium del lettore**: scrim sfumato in basso sullo schermo (addio banda opaca), barra di avanzamento sottile che si ispessisce al passaggio del mouse con fill sfumato luminoso e vignetta di scrub che ingrandisce, pulsante play/pausa centrale gigante, menu in vetro smerigliato con spunta sull'elemento attivo, toast di feedback sui salti ±10 s, anello di caricamento al marchio, scheda di ripresa e schermo di errore ridisegnati, header in sovrapposizione sfumata in modalità schermo intero, vignetta cinematica e respirazione Ken Burns dell'atmosfera, cursore nascosto quando i controlli scompaiono.

## v1.13.74 — Agosto 2026

### Lettore: posizione di riproduzione corretta in modalità ffmpeg, sottotitoli 100 % locali senza Plex

- **Corretto**: in modalità ffmpeg, la barra di avanzamento tornava all'inizio dopo un clic a metà video (il contenuto, invece, si posizionava correttamente). Lo stream remuxato è un MP4 frammentato senza indice: il browser ricomincia da zero ad ogni seek/ricaricamento, anche se il server cerca la posizione corretta. Il lettore visualizza e salva ora `seekBase + currentTime` (posizione ultimo seek + tempo riprodotto), e il riferimento viene mantenuto anche quando si cambia traccia audio o si interrompe il lettore.
- **Nuovo**: i sottotitoli ora funzionano **senza passare da Plex** in modalità ffmpeg — Movviz estrae da solo la traccia di sottotitoli dal file grezzo tramite ffmpeg (conversione in WebVTT) e la riproduce tramite il tag `<track>` nativo del browser, con uno scostamento ricalcolato ad ogni seek. Il video rimane copiato bit-perfetto, nessun transcodifica video è necessario. Le tracce **testo** (SRT, ASS, SSA, WebVTT, mov_text…) rimangono sul motore ffmpeg; le tracce **immagine** (PGS/VobSub dei remux Blu-ray, non convertibili in testo) passano al leg HLS come prima. Rimuovere i sottotitoli non esce più dalla modalità ffmpeg.

## v1.13.73 — Agosto 2026

### Lettore: motore ffmpeg rispettato, rilevamento audio in meno di un secondo, scelta traccia audio in modalità ffmpeg

- **Corretto**: quando il motore **ffmpeg** è selezionato in Impostazioni → Plex, il lettore riavviava talvolta una riproduzione diretta invece del remux locale — la scelta del motore non veniva inclusa nel calcolo della strategia. Ora, motore ffmpeg = remux ffmpeg per ogni file (il pulsante ⚡ riavvia anche il remux anziché una riproduzione diretta), con HLS come ultima risorsa se ffmpeg non è disponibile.
- **Migliorato**: la sorveglianza del silenzio della riproduzione diretta rileva ora una traccia audio muta in **meno di un secondo** (finestra 800 ms) invece di 6 s, e poi scala al **remux ffmpeg locale** (audio trascodificato in AAC, video copiato) prima di tornare al transcodifica Plex. Il verdetto cade solo dopo che il decoding è effettivamente iniziato, per non confondere mai un avvio lento con un vero silenzio (nesso regressione per i video compatibili).
- **Nuovo**: i menu traccia audio / sottotitoli sono ora disponibili quando il motore ffmpeg è attivo — cambio lingua audio diretto (sessione remux ricaricata con la traccia corretta, posizione mantenuta), e passaggio automatico al leg HLS (Plex) quando viene richiesto un sottotitolo (il remux locale non registra alcun sottotitolo).

## v1.13.72 — Agosto 2026

### Nuovo: impostazione lingua audio preferita per il lettore

- **Nuovo**: Impostazioni → Plex ora offre una lingua audio preferita per la selezione della traccia predefinita durante la riproduzione (francese, inglese, spagnolo, tedesco, italiano, olandese) — su "Automatico" (predefinito), segue la lingua dell'interfaccia come prima; un account che utilizza Movviz in francese ma preferisce l'audio inglese può ora specificarlo esplicitamente, senza che ciò modifichi la sua interfaccia.

## v1.13.71 — Agosto 2026

### La traccia audio nella lingua dell'interfaccia veniva scelta... poi sovrascritta silenziosamente da un'altra traccia dello stesso codec

- **Causa radice confermata in diretta** (Jurassic Park 499959, due tracce AC-3 francese/inglese): la traccia francese veniva selezionata correttamente — sia dalla nuova regola linguistica che dal "selezionato" di Plex stesso — ma un meccanismo di fallback più vecchio (pensato per sfuggire a un codec veramente indecodabile, es. DTS → AC-3) non verificava mai se la traccia di riserva avesse un codec realmente diverso. Poiché entrambe le tracce di questo film erano in AC-3, questo fallback "riusciva" passando all'altra traccia (inglese) semplicemente perché non era esclusa — senza apportare alcuna compatibilità aggiuntiva, sovrascrivendo silenziosamente la corretta scelta francese.
- **Corretto**: il fallback richiede ora un codec realmente diverso da quello della traccia già rifiutata.

## v1.13.40 – v1.13.70 — Agosto 2026

### Riproduzione video: catena di fallback multi-livello, remux ffmpeg locale, lettore aggiornato

- **Nuovo**: la riproduzione di un file passa ora attraverso una catena di fallback a più livelli, ognuno provato automaticamente in base a ciò che il browser può effettivamente decodificare — riproduzione diretta → MSE (copia bit-esatta, parser MP4 proprietario) → **remux ffmpeg locale** (nuovo motore, prende il sopravvento per qualsiasi contenitore/codec che il parser MSE non gestisce, in particolare MKV) → DASH/HLS (transcodifica Plex, ultimo ricorso). Il remux ffmpeg recupera il file sorgente grezzo direttamente da Plex e lo remuxa esso stesso (copia video a costo CPU nullo, audio copiato o trascodificato in AAC a seconda del codec) — zero dipendenza dalla decisione di transcodifica di Plex, che si è rivelata essere un'euristica interna non documentata e non influenzabile dall'esterno (rifiuto di copiare il bitstream HEVC in HLS indipendentemente dal parametro inviato lato client, qualunque sia la variante testata).
- **Corretto**: il protocollo DASH è ora utilizzato per qualsiasi sorgente HEVC/AV1 o qualsiasi sessione di transcodifica — è l'unico protocollo in cui Plex rispetta la copia del bitstream HEVC (HLS ricodifica sistematicamente queste sorgenti, anche in modalità "audio solo", che era la vera causa del ritardo percepito). Il profilo client dichiarato a Plex ("Plex Web") copre ora HEVC/AV1 sia per HLS che per DASH, e entrambi i modi "Trascodificato (audio)"/"Trascodificato (video)" del menu — tempi invertiti — puntano al corretto comportamento Plex.
- **Corretto**: diversi trappole di decodifica audio identificate e risolte in condizioni reali — l'AC-3 copiato in un MP4 progressivo non viene decodificato nativamente da Chrome/Edge (contesto diverso da transmux hls.js/MSE, corretto limitando la copia del remux ai codec universalmente decodificabili e trascodificando il resto in AAC), e Dolby Digital(+) non può essere osservato dal monitoraggio del silenzio (si basa sul grafo Web Audio, fuori portata per questi codec) — ciascuno di questi casi è ora rilevato o evitato correttamente piuttosto che produrre una riproduzione silenziosa senza errore visibile.
- **Corretto**: robustezza del pipeline rafforzata attraverso test in condizioni reali — condizioni di gara nel motore MSE e nelle sessioni ffmpeg (buffer, seek, arresto pulito del flusso server quando il client abbandona, incluso un caso che poteva far crashare tutto il server), durata e posizione di riproduzione affidabili per il flusso ffmpeg (contenitore frammentato senza durata nota in anticipo lato browser).
- **Nuovo**: il lettore sceglie ora la traccia audio predefinita in base alla lingua dell'interfaccia Movviz (stessa regola del badge audio), attiva i sottotitoli automaticamente solo se nessuna traccia audio corrisponde a quella lingua, mostra un'anteprima al passaggio del mouse sulla barra di avanzamento (trasmessa da Plex, che la genera già per il proprio lettore), e gestisce nuove scorciatoie da tastiera (volume, salto diretto in percentuale) oltre a quelle esistenti (riproduzione, ±10s, schermo intero, muto, chiudi).

## v1.13.65 — Agosto 2026

### L'eroe fissava sempre gli stessi titoli

- **Corretto**: i pool senza ordine naturale (suggerimenti personalizzati, scoperta, mai visti) sono ora mescolati con un seme deterministico giornaliero e per utente — rotazione ogni 24 ore invece dei soliti 2-3 titoli fissati indefinitamente; i pool cronologici (recentlyAdded, upcoming, recentActivity) non sono toccati.

## v1.13.63 — Agosto 2026

### Una serie con un solo episodio "in arrivo" veniva visualizzata come mancante — la scheda serie ignorava lo stato "upcoming"

- **Causa radice confermata**: `LibrarySeriesCard` calcolava l'integrità di una serie con `available === monitored.length`, contando gli episodi non ancora trasmessi ("in arrivo") come se dovessero già essere disponibili — una serie interamente scaricata con un solo episodio non ancora trasmesso risultava quindi nel badge color ambra "mancante", mentre `SeasonAccordion`, `TitleContent` e la pagina Libreria trattano già correttamente "disponibile OPPURE in arrivo" come completo.
- **Corretto**: la scheda serie applica ora la stessa regola di tutte le altre aree dell'app.

### "Cerca e sostituisci" proponeva di sostituire un file con un file quasi identico quando la lingua corrente era sconosciuta

- **Causa radice confermata in diretta**: quando la lingua del file posseduto non è nota (non rilevata), qualsiasi release in cache nella lingua target (VF) veniva proposta come "miglioramento", senza mai verificare se apportasse qualcosa di reale — la stessa risoluzione, lo stesso codec (x264≈H.264, x265≈HEVC visualizzati diversamente ma identici) e una dimensione quasi identica scatenavano comunque una proposta di sostituzione. Il meccanismo di sicurezza esistente (`isMeaningfulUpgrade`, scostamento di dimensione ≥ 10 %) veniva esplicitamente aggirato per questo caso specifico; per quanto riguarda le serie, questo meccanismo di sicurezza semplicemente non esisteva.
- **Corretto**: le proposte basate sulla lingua richiedono ora lo stesso scostamento minimo di dimensione (10 %) degli altri tipi di miglioramento, sia per i film che per gli episodi — i suggerimenti di risoluzione/codec reali non sono interessati.

## v1.13.39 — Agosto 2026

### Aggiuto un interruttore opzionale per la ricerca di trailer di YouTube — spento di default spiega perché i trailer rimanevano in inglese

- **Aggiunto**: il fallback di ricerca di YouTube per i trailer (utilizzato ogni volta che TMDb non ne ha in lingua dell'utente) è un web scraping, non un'API ufficiale — dipende dal fatto che YouTube non limiti il tasso di richieste dell'IP del server, e un singolo fallimento silenzioso viene memorizzato per 24 ore, quindi era sempre spento di default. Questo default è il motivo per cui i trailer continuavano a mostrare in inglese nonostante il meccanismo esistesse e funzionasse correttamente quando testato direttamente. Un nuovo interruttore in Impostazioni → Dashboard ("Trailer") lo attiva — ancora spento di default, ma ora una scelta esplicita e visibile invece di una silenziosa.

### I titoli bloccati su "ricerca" davano alla scheda "Download" un conteggio non nullo senza nulla che lo spiegasse

- **Aggiunto**: invece di non contare più gli elementi "in ricerca" come scaricati (ultima release), ora hanno una propria scheda dedicata "Ricerca in corso" — così quel numero non scompare semplicemente, ma si sposta dove appartiene realmente.

---

## v1.13.36 — Agosto 2026

### La scheda "Download" poteva mostrare un conteggio non nullo senza che nulla fosse effettivamente in download

- **Corretto**: la piastrella contava gli episodi/film ancora "in ricerca" (che cercavano attivamente un rilascio, senza che fosse ancora stato preso alcun torrent) come se stessero scaricando. Confermata in diretta: un'intera stagione bloccata in "ricerca" senza torrent attivi ha gonfiato il conteggio a 9 mentre zero download stavano effettivamente in esecuzione. La piastrella ora conta solo gli elementi con un download attivo reale.

### Il pulsante "play" di un titolo poteva scomparire completamente senza spiegazioni

- **Corretto**: il pulsante "guarda" su una pagina del titolo era interamente vincolato al fatto che Plex avesse già collegato il file — un file che Movviz aveva già pronto, ma che Plex non aveva ancora scansionato nella propria libreria (un normale ritardo asincrono di tempistica), non mostrava alcun pulsante, ma invece qualcosa che spiegava l'attesa. Ora mostra un segnaposto chiaramente disabilitato con un tooltip invece di scomparire.

### Due pulsanti di pagina titolo non correlati condividevano esattamente la stessa icona

- **Corretto**: "gestisci versioni" e "visualizza saga/collezione" utilizzavano entrambi la stessa icona di stack, creando confusione su un titolo che ne ha entrambi. Il link alla collezione ora utilizza un'icona visivamente distinta.

---

## v1.13.34 — Agosto 2026

### La stessa notifica poteva continuare a essere emessa per contenuti disponibili da giorni

- **Corretto**: le notifiche non venivano mai de-duplicate — un job pianificato che riscanneggiava contenuti che non riusciva a pulire completamente dopo l'importazione poteva rieseguire esattamente la stessa notifica "ora disponibile" ad ogni esecuzione, confermato in diretta con una notifica di stagione disponibile che si ripeteva ogni ~30 minuti per un titolo che era in realtà disponibile da una settimana. Lo stesso tipo di notifica con gli stessi dettagli ora viene emesso solo una volta entro un intervallo di un'ora; una vera ripetizione più distante (es. giorni dopo) arriva ancora normalmente.

### La modalità dashboard "Classico" è stata rivista per corrispondere a "Cinema" meno l'eroe

- **Modificato**: La modalità Classica ora riutilizza tutto ciò che offre la modalità Cinema — le pillole statistiche compatte e il layout a riga completa (Tendenze, Suggerimenti adattati, Aggiunte recenti, ecc.) — solo senza il grande banner eroe in alto, secondo i feedback. Precedentemente ricadeva su una griglia di piastrelle statistiche spoglie e un elenco "aggiunto di recente" piatto senza nessuna delle righe di Cinema.

---

## v1.13.33 — Agosto 2026

### Aggiunto un interruttore manuale di seeding per i download completati

- **Aggiunto**: un download completato nella coda ha ora un pulsante dedicato per iniziare o fermare il seeding, indipendente dai controlli di pausa/riavvio utilizzati per i download attivi. Disattivarlo interrompe veramente l'attività di upload piuttosto che semplicemente nascondere uno stato — per il motore di download predefinito questo disconnette completamente il torrent dai peer; riattivarlo lo ristabilisce, ricostruendo il layout del file originale se necessario se i file erano già stati spostati nella libreria, senza mai toccare o ridiscaricare la copia della libreria.

### I titoli delle righe di poster non erano centrati sotto le loro schede

- **Modificato**: il titolo sotto ogni scheda poster nelle righe della dashboard (Tendenze, Suggerimenti, Aggiunte recenti) è ora centrato sotto il poster, secondo i feedback — precedentemente poteva trovarsi decentrato, specialmente nella riga Top-10 classificata.

---

## v1.13.32 — Agosto 2026

### I download non mostravano mai un tempo rimanente

- **Corretto**: il campo "tempo rimanente" (ETA) della coda veniva calcolato solo da due dei tre backend del motore di download — quello predefinito (il motore effettivamente usato giorno per giorno) non passava mai un valore `timeRemaining`, quindi il campo era sempre vuoto nella vista della coda. Ora viene calcolato nello stesso modo in cui lo fanno già gli altri backend (byte rimanenti sulla velocità corrente), quindi un download attivo mostra una stima reale.

---

## v1.13.31 — Agosto 2026

### Un percorso file funzionante poteva essere sovrascritto silenziosamente dalla visione del filesystem di Plex

- **Corretto**: ad ogni sincronizzazione Plex, un percorso file già corretto e funzionante per un film o un episodio poteva essere sovrascritto da qualsiasi percorso che Plex stesso riportava per quel file. Quando Plex e Movviz girano in container separati con diversi mount di volume per lo stesso media fisico, il percorso riportato da Plex non esiste dalla visione del filesystem di Movviz — quindi un percorso perfettamente buono e funzionante veniva silenziosamente trasformato in uno rotto, inondando "Riparare i percorsi" di falsi positivi per titoli che non erano mai stati effettivamente rotti. Movviz ora impara la corrispondenza tra la disposizione dei percorsi di Plex e la propria automaticamente — confrontando, per un titolo che già traccia correttamente, il proprio percorso funzionante verificato con quello che Plex riporta per esattamente lo stesso titolo — e traduce i futuri report di Plex attraverso questa mappatura appresa invece di fidarsi ciecamente. Nessuna schermata di impostazioni, nessuna configurazione manuale: deduce la mappatura stessa dai dati che già conosce con certezza. Un percorso viene scritto solo se è verificato indipendentemente di esistere sul disco prima — una mappatura sbagliata o obsoleta può al massimo produrre un falso flag "mancante" (recuperabile manualmente), mai un riferimento silenziosamente perso a un file reale.

---
## v1.13.30 — Agosto 2026

### "Riparare i percorsi" poteva suggerire centinaia di file completamente non correlati come candidati

- **Corretto**: quando un file di episodio rotto non poteva essere trovato dal suo nome file registrato esatto, il fallback di ultima risorsa lo abbinava a ogni file video nell'intera libreria che condivideva gli stessi numeri di stagione/episodio — indipendentemente da quale show appartenesse realmente. Confermata in diretta: un singolo episodio rotto poteva tornare con più di 500 "candidati" che erano in realtà solo l'episodio 1, episodio 2, ecc. di ogni altro show. Questo fallback ora offre solo file che appartengono plausibilmente alla serie effettiva (per nome file o nome cartella), quindi l'elenco dei suggerimenti è corto e nuovamente pertinente. Presente da v1.12.86 — non qualcosa cambiato in questo recente gruppo di correzioni, e nessun altro percorso corrispondente (nome file esatto, percorso atteso o avviso di conflitto duplicato) è stato toccato.

### I numeri Top-10 della riga "In tendenza" sovrapponevano troppo l'immagine di anteprima

- **Modificato**: il numero di classifica dietro ogni scheda Top-10 nella riga "Tendenze" era troppo in basso rispetto all'immagine di anteprima, lasciando visibile solo una sottile striscia a sinistra. Ora sovrappone molto meno — la maggior parte del numero è visibile a sinistra della scheda, con solo il suo bordo posteriore nascosto dietro, secondo i feedback.
- **Modificato**: la riga "Tendenze" ora viene mostrata per prima sulla dashboard, sopra "Aggiunte recenti", secondo i feedback.

### La collezione "download mancante" poteva prendere il titolo sbagliato invece di quello effettivamente mancante

- **Corretto**: due bug cumulativi, entrambi confermati in diretta su diverse collezioni. Primo, il pulsante calcolava quali titoli mancavano da uno snapshot della libreria/collezione condivisa e in cache per tutta l'app che poteva essere obsoleto senza nulla di visibilmente sbagliato sullo schermo — sia la lista della libreria che quella della collezione vengono ora ricaricate fresche poco prima del download. Secondo, e più conseguenziale: una protezione di rilevamento duplicati destinata a intercettare TMDb che elenca lo stesso film uscito sotto due ID utilizzava un abbinamento di titoli fuzzy senza alcun requisito di anno reale — poteva riutilizzare silenziosamente un'entrata non correlata e già posseduta per un placeholder di franchise non confermato, o confondere un film reale con un cortometraggio della stessa saga di un anno e un suffisso di titolo extra. Quella protezione ora richiede un titolo normalizzato esatto E un anno di uscita esatto e confermato su entrambi i lati prima di fidarsi mai di un abbinamento.

### Gli account amici ricevevano la cronologia di visione di proprietà del proprietario del server

- **Corretto**: ogni account amico collegato portava un'identità Plex e un token genuinamente distinti, ma tutti sincronizzavano esattamente lo stesso conteggio di visualizzazioni dell'account proprietario del server. Causa radice confermata rispetto al comportamento documentato di Plex stesso: gli endpoint utilizzati per sincronizzare lo stato di visione riportano `viewCount` solo dalla prospettiva del proprietario del server, indipendentemente dal token dell'account valido che effettua la richiesta — nessun header di richiesta può cambiare questo. La sincronizzazione dello stato di visione ora utilizza l'endpoint cronologia sessione di Plex, interrogato con il token amministratore e filtrato per l'ID Plex di ogni account — il modo in cui Plex traccia effettivamente la visione per account — funzionando allo stesso modo per gli account amici e i profili gestiti in casa, invece di due percorsi separati.

## v1.13.22 — Agosto 2026

### Le raccomandazioni "Per te" sono di nuovo strettamente per account, e un errore di sincronizzazione dello stato di visione di Plex non appare più come "nulla guardato"

- **Modificato**: è stato ripristinato il blending delle famiglie di v1.13.21 — dopo ulteriori feedback, "Per te" è tornato a essere costruito SOLO sulla cronologia di visione Plex di un account, senza alcun segnale da nessun altro account, nemmeno uno piccolo. Un account con solo un paio di titoli guardati riceve ora una riga personalizzata solo da quelli, invece di aver bisogno di un minimo affinché qualcosa venga mostrato.
- **Corretto**: lo stato di sincronizzazione di visione di Plex inghiottiva silenziosamente ogni errore (interruzione di rete, token scaduto, sezione irraggiungibile) e salvava un risultato vuoto indipendentemente — indistinguibile da "questo account non ha guardato nulla," ed era in grado di cancellare silenziosamente la vera cronologia di visione in caso di guasto transitorio. Ora lascia i dati esistenti intatti quando una sincronizzazione non riesce a raggiungere alcuna sezione della libreria, e ogni tentativo di sincronizzazione — con successo o fallimento, e per quale account — viene registrato in Impostazioni → Log, così un account che fallisce in silenzio è finalmente visibile invece di apparire semplicemente vuoto.

### Le raccomandazioni "Per te" possono ora attingere all'intera cronologia Plex della famiglia, non solo alla tua

- **Nuovo**: quando la cronologia di visione Plex di un account è scarsa o vuota, la sua riga "Per te" ora fonde anche ciò che altri account sulla stessa istanza hanno guardato (pesato meno della cronologia dell'account stesso) — così qualcuno senza il proprio collegamento Plex può comunque ottenere una riga reale e personalizzata invece del generico fallback "più votato". Questo si attiva solo quando almeno altri due account hanno dati di visione reali propri — il gusto di un singolo altro account non viene mai usato come segnale "familiare" sostitutivo, per evitare di clonare silenziosamente le scelte di una persona su un'altra. La riga di ogni account rimane esattamente personale come prima; questo aggiunge solo un segnale più ampio sopra, senza mai sostituire la cronologia dell'account stesso quando è già presente.

### I titoli e le descrizioni degli episodi tornavano sempre in francese, indipendentemente dalla lingua dell'interfaccia

- **Corretto**: la chiamata ai dati di stagione/episodio (miniature, titoli, descrizioni — aggiunti in v1.13.12 ed estesi alle serie possedute in v1.13.19) non diceva mai a TMDb in quale lingua rispondere, quindi di default utilizzava il francese per ogni utente, anche con l'inglese (o qualsiasi altra) selezionato come lingua dell'interfaccia. Questo era esattamente lo stesso bug già corretto una volta per le pagine dettagliate dei titoli — ma non applicato mai a questa specifica chiamata. Ora segue la lingua selezionata dall'app come ovunque altro.

### Miniature e descrizioni degli episodi ora vengono mostrate ovunque, non solo per le serie che non possiedi ancora

- **Corretto**: v1.13.12 ha aggiunto una miniatura e una breve descrizione a ogni riga episodio, ma solo per le serie non ancora nella tua libreria — gli episodi di serie che possiedi già venivano mostrati come righe di testo semplice senza alcun anteprima. Entrambe le viste ora attingono dagli stessi dati live di TMDb, così un episodio scaricato/disponibile mostra esattamente la stessa anteprima di uno che non hai ancora preso — senza rimuovere nessuno dei badge di qualità esistenti, del marcatore guardato, della pillola di stato o dei pulsanti di ricerca.
- **Corretto**: le date di trasmissione degli episodi in quella stessa lista venivano renderizzate nel formato locale del tuo browser indipendentemente dalla lingua selezionata da Movviz (ad esempio, mostrando l'ordine mese/giorno statunitense anche con il francese selezionato) — ora seguono costantemente la lingua dell'app, come ogni altra data in Movviz.

### Il riprovare un pacchetto di stagioni parzialmente importato potrebbe tentare di rinominare il suo .nfo rimanente in un file episodio

- **Corretto**: una volta che ogni vero file video in un pacchetto di stagioni era già stato abbinato e spostato in una precedente esecuzione parziale, un nuovo tentativo avrebbe trovato zero file video rimanenti e sarebbe tornato a considerare qualsiasi file rimanente — incluso il .nfo del rilascio — come "l'episodio da importare", tentando di rinominarlo in qualcosa come `S03E02.nfo` e fallendo del tutto se questo non corrispondeva a ciò che era effettivamente su disco. I file .nfo/.txt/immagine/checksum rimanenti non sono mai contenuti di episodi e vengono già puliti automaticamente una volta terminata l'importazione — ora sono esclusi da tale abbinamento invece di causare un errore di importazione fallito e visibile all'utente.

## v1.13.17 — Agosto 2026

### I log di rallentamento di cui ti è stato parlato ora vengono effettivamente mostrati in Impostazioni → Log

- **Corretto**: il log di diagnostica di ricerca poteva riempire il suo buffer di 2000 righe in pochi minuti durante passaggi di background intensi (ogni ricerca di episodio scrive ~10 righe, diverse delle quali di debug), spingendo silenziosamente via le importanti righe di informazioni, incluse le nuove righe di rallentamento di background. Il buffer ora contiene 4000 righe, quindi le voci `priority.yield` sopravvivono al rumore.
- **Nuovo**: il pannello log in Impostazioni → Log ora segue in tempo reale — si aggiorna ogni 5 secondi mentre la scheda è visibile, in modo che le righe scritte dal lavoro in background appaiano man mano che accadono invece di solo dopo un aggiornamento manuale. Nessun ri-rendering quando nulla è cambiato.
- **Corretto**: tutte le fonti di log ora vivono in un unico posto — il pannello log di transcodifica è stato spostato dalla scheda Diagnostica in Impostazioni → Log, che ora mostra insieme i log di ricerca/diagnostica, motore, risolutore e transcodifica.
- **Modificato**: le righe di log di rallentamento di background ora hanno il loro colore nel pannello, in modo che le voci "Arrière-plan bridé [bulk manquants]…" risaltino a colpo d'occhio.

## v1.13.16 — Agosto 2026

### I rallentamenti di background sono ora visibili nei log — con l'utente responsabile

- **Nuovo**: il lavoro in background (il bulk manuale "cerca tutto ciò che manca", il matching RSS pianificato, gli aggiornamenti di qualità, i tentativi di rilascio mancanti) ora si interrompe ogni volta che si utilizza attivamente l'app e riprende pochi secondi dopo aver smesso — non lo sentirai mai. Ogni volta che un tale rallentamento avviene effettivamente, il log di ricerca diagnostica lo registra in una riga pulita e leggibile: quale compito di background è stato limitato, quale utente era attivo (nome + id) e per quanto tempo è durata l'attesa (es. "Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Corretto**: il polling silenzioso del frontend non conta più come attività utente. I poll di stato (motore torrent ogni 500ms, lavori ogni 2s, metriche di prestazioni ogni 5s, attività Plex ogni 5s, avanzamento riproduzione ogni 10s…) tenevano l'app contrassegnata come "attiva" per sempre non appena veniva lasciata aperta una singola pagina — quindi il lavoro in background non riprendeva mai correttamente. Ora contano solo le interazioni reali (navigazione, ricerche, clic): lascia l'app aperta e il background riprenderà pochi secondi dopo il tuo ultimo clic.
- **Modificato**: la ricerca bulk manuale ora viene eseguita nella corsia di background come i compiti pianificati — eredita la quota di indicizzazione ridotta (le tue ricerche mantengono la priorità) e cede tra gli elementi.

## v1.13.15 — Agosto 2026

### La navigazione superiore è rimasta solida dopo lo scorrimento fino all'inizio

- **Corretto**: la barra di navigazione superiore da trasparente a solida aggiunta in v1.13.12 si è trasformata correttamente in solida quando si scorreva verso il basso, ma lo scorrimento verso l'alto fino all'inizio non l'ha mai riportata a trasparente. È stato cambiato un metodo di rilevamento più affidabile in modo che ora rifletta correttamente la posizione di scorrimento in entrambe le direzioni.

## v1.13.14 — Agosto 2026

### Le righe della dashboard possono ora aprire una griglia completa — "Vedi tutto" non era mai effettivamente collegato

- **Corretto**: i caroselli della dashboard ("Per te", "Aggiunto di recente", "In arrivo", "Di tendenza") avevano un'indicazione "Vedi tutto" integrata nel componente riga stesso, ma nessuna riga della dashboard stava mai passando una destinazione — quindi non è mai apparso silenziosamente, su nessuna riga, da quando è stata creata questa parte della dashboard. Le righe rimangono esattamente come strisce orizzontali compatte; "Vedi tutto" ora apre l'intero set come una griglia reale e filtrabile (Scopri per le righe di raccomandazione/tendenza, la tua Libreria — prefiltrata per corrispondere — per le righe tratte da ciò che possiedi già).

## v1.13.13 — Agosto 2026

### Il lettore Beta è ora una scelta personale per account, disattivato di default

- **Modificato**: precedentemente il lettore Beta aveva un unico interruttore on/off per l'intera istanza — un amministratore che lo attivava cambiava silenziosamente il comportamento di riproduzione per ogni account. Ora ci sono due livelli: un interruttore amministratore nelle Impostazioni che rende solo la funzione disponibile, e un interruttore personale nella pagina Profilo di ogni utente che la attiva effettivamente per il proprio account — disattivato di default, indipendentemente da ciò che ha impostato l'amministratore.

## v1.13.12 — Agosto 2026

### Sei miglioramenti di navigazione, presi da una revisione del design

- **Nuovo**: le righe ora mostrano un sottile indicatore di posizione di scorrimento e frecce laterali rivelate al passaggio del mouse, e scorrono di una pagina intera invece di trascinare liberamente.
- **Nuovo**: la riga "Tendenze" ora evidenzia le sue prime 10 con un trattamento di classifica numerata, utilizzando lo stesso ordine di popolarità reale per cui la riga era già ordinata.
- **Nuovo**: passando il mouse su una card poster (desktop) mostra ora brevemente anno, durata e tag di genere quando disponibili, invece di nulla.
- **Modificato**: la barra di navigazione superiore è ora trasparente nella parte più alta della pagina e diventa solida non appena si scorre.
- **Modificato**: l'elenco episodi per un titolo non ancora nella tua libreria mostra ora una miniatura e una breve descrizione per episodio, non solo una riga vuota. (Gli episodi per i titoli già nella tua libreria non hanno ancora questo — questo richiede dati nuovi raccolti al momento dell'importazione, tracciati separatamente.)
- **Nuovo**: su mobile, l'hero del dashboard ora utilizza artwork ritratto dedicato invece di una versione ridimensionata del banner desktop.

## v1.13.11 — Agosto 2026

### La personalizzazione dell'affichage ora segue il tuo account, non solo il tuo browser

- **Modificato**: il profilo di prestazioni GPU, le animazioni, il tema (chiaro/scuro/auto), la lingua dell'interfaccia e la densità della visualizzazione della libreria erano tutti salvati solo nel browser — cambiare dispositivo o browser resettava ognuno di questi ai valori predefiniti. Ora sono salvati nel tuo account e ti seguono ovunque tu accedi, pur applicandosi istantaneamente sul dispositivo su cui ti trovi.
- **Spostato**: l'interruttore "Animazioni" ora si trova in Impostazioni → Prestazioni GPU, accanto al profilo che effettivamente influenza, invece di sotto Dashboard.

## v1.13.10 — Agosto 2026

### Pulsanti di navigazione inferiore su mobile che funzionavano solo quando toccati sopra l'icona

- **Corretto, confermato live**: su mobile, toccare direttamente i pulsanti delle schede Calendario/Richieste/Altro spesso non faceva nulla — ma toccare appena sopra di essi funzionava. Causa radice: il contenitore di notifica "toast" è montato ovunque e rimane sulla pagina in ogni momento, anche con zero notifiche visibili. Il suo livello mobile copre l'intera larghezza dello schermo, si trova proprio sopra la barra delle schede inferiore ed è invisibile — ma un elemento invisibile blocca comunque i clic al di sotto di sé a meno che non venga esplicitamente detto di non farlo. I tocchi che atterrano in quella sovrapposizione colpiscono silenziosamente nulla invece di raggiungere il pulsante della scheda.
- Il contenitore invisibile non blocca più nulla al di sotto di sé; solo una notifica visibile effettiva (che è rara e breve) è ancora toccabile/rimovibile, esattamente come prima.

## v1.13.09 — Agosto 2026

### La correzione Blood+ da v1.13.06 non è mai stata effettivamente applicata — trovato il vero motivo

- **Corretto, confermato live**: v1.13.06 ha corretto la funzione di corrispondenza dei titoli per trattare "+" come la parola "plus" (così "Blood+" non verrebbe confuso con show non correlati). Ma la ricerca manuale mostrava ancora "Blood Of Zeus", "Dexter New Blood", "Blood-C" e altri come candidati validi per "Blood+" — perché un passaggio precedente e completamente diverso (quello che trasforma una query della barra di ricerca nel testo effettivo inviato agli indicizzatori) stava rimuovendo il "+" prima che la funzione di corrispondenza corretta potesse vederlo, annullando silenziosamente quella correzione per ogni vera ricerca. Una ricerca per "Blood+" arrivava al matcher come la parola nuda "Blood", che ovviamente corrisponde quasi a tutto con "Blood" nel titolo.
- Quel passaggio precedente ora preserva anche "+" e "&" come parole, allo stesso modo in cui la funzione di corrispondenza lo faceva già — chiudendo il vero divario, non solo quello della funzione che sembrava essere la fonte del problema.

## v1.13.08 — Agosto 2026

### Accordéon stagioni — episodi visibili anche senza libreria

- **Migliorato — elenco episodi disponibile per serie non seguite**: l'accordion delle stagioni mostrava "Non ancora in libreria" quando la serie non era nella libreria. Gli episodi (numero, titolo, data di trasmissione) vengono ora caricati da TMDb su richiesta (lazy, memorizzato da SWR) non appena viene aperta una stagione — senza alcun impatto sulle serie già in libreria il cui rendering rimane identico. Viene visualizzato uno scheletro di caricamento durante la richiesta.

---

## v1.13.07 — Agosto 2026

### Correzione changelog v1.13.05

- Rimozione di un elemento errato: il quadrato rosso visibile nello screenshot ARM era un'annotazione disegnata dall'utente per indicare l'area problematica, non un vero bug visivo dell'UI.

---

## v1.13.06 — August 2026

### Correzione matching — titoli con `+` (Blood+, C+C Music Factory…)

- **Corretto — falso positivo di matching sui titoli contenenti `+`**: il `+` veniva rimosso dalla normalizzazione (vengono conservati solo `a-z0-9`), riducendo ad esempio `Blood+` in `blood`. Poiché questa parola da sola è contenuta in `Blood of Zeus` → `blood of zeus`, la serie otteneva un punteggio di 0.85 (sopra la soglia di 0.72) durante una ricerca manuale per Blood+. Il `+` viene ora convertito in ` più ` prima della pulizia in `normalizeTitle`, rendendo `Blood+` → `blood plus` e `Blood of Zeus` → `blood of zeus` — due stringhe distinte che non si confondono più. Le release nominate `Blood Plus` corrispondono correttamente a `Blood+`. Fix applicato in `matching.ts` e `releaseMatchWorker.mjs`. Aggiunto test di non regressione.

---

## v1.13.05 — August 2026

### Correzione carosello stagioni — compatibilità browser ARM

- **Corretto — carosello bloccato su Docker ARM (secondo passaggio)**: la transizione `gridTemplateRows` CSS non è supportata in tutti i browser ARM. Sostituito con `max-height: 0 → 9999px` con `overflow: hidden`, una tecnica universale supportata da IE9 — funziona senza ResizeObserver, senza animazione JS, senza Framer Motion.

---

## v1.13.04 — August 2026

### Correzione carosello stagioni ARM Docker (indagine approfondita)

- **Corretto — carosello stagioni bloccato su Docker ARM**: Framer Motion interpreta e anima `gridTemplateRows` tramite JS, cosa che può fallire su runtime ARM. L'animazione è ora gestita interamente dal motore CSS del browser: transizione inline su `gridTemplateRows` + `opacity`, senza alcuna dipendenza JS esterna. Il div interno riceve `min-h-0` per garantire che la row CSS Grid collassi realmente a 0. Il contenuto è sempre presente nel DOM (nascosto dalla grid), eliminando anche il caso in cui `libSeason` undefined rendeva l'espansione silenziosamente vuota — quando una serie non è in libreria, viene visualizzato un messaggio localizzato al suo posto.

## v1.13.03 — August 2026

### Correzione carosello stagioni ARM/QEMU

- **Corretto — carosello stagioni bloccato su Docker ARM**: l'animazione di apertura delle stagioni dipendeva da `height: "auto"` tramite Framer Motion, che misura l'altezza tramite `ResizeObserver`. Su Docker ARM (Mac Apple Silicon / QEMU), `ResizeObserver` restituisce 0 al primo rendering, rendendo l'animazione invisibile e la lista episodi inaccessibile. L'animazione passa ora su `gridTemplateRows: "0fr" → "1fr"`, un'interpolazione CSS pura senza misurazione DOM — funziona identicamente su x64 e ARM.

---

## v1.13.02 — August 2026

### Informazioni 2FA C411

- **Aggiunto — avviso 2FA nel modulo C411**: gli account c411.org con autenticazione a due fattori (2FA) attiva non possono utilizzare le liste Scopri (ogni nuova sessione richiederebbe un codice). Ora viene visualizzato un avviso informativo sotto i campi utente/password per segnalare questo limite. 5 lingue.

---

## v1.13.01 — August 2026

### Correzioni animazioni e TVDB

- **Corretto — modalità cinema disattivata dal toggle animazioni**: disattivare le animazioni nelle Impostazioni → Dashboard interrompeva anche la riproduzione video della modalità cinema (hero cinematografico + intestazione titolo). I due parametri sono ora indipendenti: interrompere le animazioni rimuove le transizioni/effetti decorativi senza mai bloccare la riproduzione del video d'atmosfera, che è controllato solo dal suo toggle di autoplay.
- **Corretto — badge stato TVDB assente nella scheda Animato**: dopo lo spostamento della chiave TVDB nella scheda Metadati in v1.13.00, il badge «TVDB configurato / non configurato» era scomparso dalla scheda Animato — il toggle sembrava inattivo senza alcun feedback visivo sullo stato della chiave. Il badge è ripristinato nella scheda Animato (solo lettura), con un riferimento alla scheda Metadati per inserire o modificare la chiave.

---

## v1.13.00 — August 2026

### Storico rifacimento, matching anni, TVDB in Metadati, event loop, bottom nav mobile

- **Rifacimento — pagina Storico** : timeline raggruppata per data (Oggi / Ieri / Questa settimana / Questo mese / Più vecchio), schede con bordo colorato a seconda dello stato, voci di fallimento in rosso con messaggio di errore visualizzato direttamente (senza clic), animazioni sfalsate all'ingresso, stato vuoto illustrato, contatore eventi, aggiornamento automatico ogni 10 secondi. Tradotto integralmente in 5 lingue (etichette stato, gruppi date, sistema, punteggio, dettagli).
- **Corretto — corrispondenza: tolleranza anno estesa a ±2** : i release fisici (Blu-ray/DVD) pubblicati fino a due anni dopo l'uscita cinematografica originale venivano rifiutati dal filtro anno (es. Tafiti, film tedesco 2024 con release Blu-ray francese 2026). La tolleranza passa da ±1 a ±2 in `releaseMatchWorker.mjs` e `matching.ts`, attivando anche il bonus di containment già presente per i titoli troncati dai release scena.
- **Spostato — chiave API TVDB dalla scheda Animato alla scheda Metadati** : raggruppamento logico con TMDb e OMDb. La scheda Animato mantiene entrambe le toggle (usa TVDB / episodi speciali) e il pannello di sincronizzazione. I suggerimenti di navigazione delle due schede sono aggiornati. 5 lingue.
- **Semplificato — testo event loop in Performance** : sostituito con una frase chiara su una riga (latenza del thread principale, verde = OK, rosso = sovraccarico). 5 lingue.

---

## v1.12.98 — Agosto 2026

### Correzione mobile — hitbox barra di navigazione inferiore

- **Corretto — pulsanti non cliccabili in fondo alla barra di navigazione mobile** : su iPhone con indicatore Home (area safe-area ≈ 34 px), il `paddingBottom` safe-area veniva applicato sul contenitore `nav` anziché su ogni pulsante. Con `items-stretch`, i figli riempiono solo l'area di contenuto del nav (escluso padding) — l'area safe-area in basso era visivamente coperta dallo sfondo della barra ma non apparteneva a nessun elemento cliccabile. Il padding è ora applicato a ogni pulsante con `max(0.5rem, env(safe-area-inset-bottom))`, estendendo l'hitbox fino al fondo dello schermo mantenendo l'icona e l'etichetta centrate nella parte visibile.

---

## v1.12.97 — Agosto 2026

### Correzione C411 collisione ID TMDb + miglioramento matching release scena

- **Corretto — collisione spazio ID TMDb nelle liste C411** : TMDb utilizza due spazi identificativi distinti (film e serie) che si sovrappongono — lo stesso numero può indicare sia un film che una serie diversa. Fino ad ora, il primo risultato trovato (lato film) veniva mantenuto senza verifica, il che poteva mostrare la scheda di un film non correlato a quella di una serie. La risoluzione passa ora attraverso un **suggerimento titolo + anno** fornito da C411: quando un ID esiste da entrambi i lati, il titolo e l'anno memorizzati nella lista permettono di scegliere lo spazio corretto. La cache è versionata (v2); le vecchie voci senza versione sono ignorate e ricalcolate per evitare che un verdetto errato sopravviva ai 30 giorni di TTL.
- **Migliorato — matching release scena con sottotitolo troncato** : i release scena spesso omettono il sottotitolo ufficiale (es. « Tafiti » invece di « Tafiti - Ab durch die Wüste »), il che li penalizzava di 0,50 sotto la soglia di matching. Un bonus di containment riporta il punteggio a 0,85 quando il titolo del release è interamente contenuto nel titolo ufficiale **e** l'anno è compatibile — i film omonimi diversi pubblicati in un altro anno rimangono rifiutati.

---

## v1.12.96 — Agosto 2026

### Scopri — etichetta sezione raccomandazioni affinata

- **Affinato — sezione raccomandazioni** : l'etichetta della prima riga della pagina Scopri passa da « Per te & migliori » a **« Selezione per te »** — più leggibile, più pulita, senza congiunzione goffa. Tradotto in 5 lingue.

---

## v1.12.95 — Agosto 2026

### Disinstallatore Windows riparato, contenitore Docker riparato, wizard completato, login C411 chiarito

- **Corretto — contenitore Docker in ciclo di riavvio**: all'avvio con PUID/PGID diversi dai valori predefiniti dell'immagine (il caso standard di un NAS), lo `docker-entrypoint.sh` eliminava il gruppo `movviz` **prima** del suo utente — busybox rifiuta di eliminare un gruppo che è il gruppo principale di un utente esistente (« group in use »), quindi l'`addgroup` successivo falliva e il contenitore moriva in ciclo con « addgroup: group 'movviz' in use » ripetuto ad ogni tentativo. L'ordine è corretto (utente prima del gruppo, ad ogni passaggio) e lo script ora libera correttamente l'UID e il GID richiesti, anche quando il gruppo di destinazione è bloccato dal suo utente proprietario. L'immagine amd64+arm64 pubblicata è rigenerata con questa correzione.
- **Corretto — disinstallatore Windows bloccato**: l'installazione terminava con un errore di esecuzione « Cannot call CreateInputOptionPage » all'avvio della disinstallazione (questa funzione non esiste nel runtime del disinstallatore Inno Setup, solo in quello dell'installer — era stata introdotta con la domanda « eliminare i dati personali ? » nella v1.12.91). La domanda è ora posta tramite una finestra di conferma nativa alla fine della disinstallazione, **di default NO**: nulla viene mai cancellato senza conferma esplicita, sempre in 5 lingue, e i dati (ProgramData) vengono mantenuti di default per consentire una reinstallazione completa.
- **Nuovo — wizard**: l'ultimo passaggio mostra una mappa « Attivazione account » che spiega che l'account amministratore è già attivo e che i prossimi account (registrazione o Plex) dovranno essere approvati in Impostazioni → Utenti.
- **Chiarito — indicizzatori C411**: l'etichetta « Identificativi del sito » specifica ora tra parentesi che il login è opzionale (serve solo per le liste Scopri, la ricerca funziona senza).

---

## v1.12.94 — Agosto 2026

### Scopri rifatto — liste fuse, serie e film strettamente separati

- **Corretto — mescolanza serie/film**: le liste c411.org (Popolari / Upload recenti / Uscite del giorno) mostravano un misto di film e serie in entrambe le schede. Ora sono filtrate dalla scheda attiva (Film o Serie), visualizzate come in « Tutto vedere ».
- **Nuovo — liste fuse**: le sezioni della pagina Scopri sono raggruppate con deduplicazione (un titolo non appare più due volte):
  - « Per te & migliori » (suggerimenti + meglio votati)
  - « Tendenze & popolari » (layout Movviz)
  - « Al cinema » (in programmazione + box office) e « Prossimamente & VOD » (layout Allociné, film)
  - « Nuove & rinnovate » (layout Allociné, serie)
  - Da 11 a 7 sezioni in layout Movviz, da 14 a 9 in layout Allociné (film) e da 11 a 7 (serie). Ogni sezione fusa ha il suo « Tutto vedere » paginato (cache 10 min).
- **Rimosso — piastrelle Generi**: la riga di piastrelle generi (doppione del filtro genere della barra) è stata rimossa.
- **Nuovo — build Docker multi-arch**: le immagini pubblicate su Docker Hub vengono nuovamente costruite per `linux/amd64` **e** `linux/arm64` (QEMU + buildx riattivati).

---

## v1.12.93 — Agosto 2026

### Indicizzatori — stato reale, chiave in memoria e diagnostica connessione

- **Nuovo — diagnostica C411**: la sezione « Identificativi del sito » della matita C411 mostra ora lo stato reale del server (liste attive o inattive, con il login interessato) e un pulsante « Testare connessione C411 » che esegue un vero login con gli identificativi registrati. In caso di configurazione incompleta, una diagnostica dettagliata indica esattamente cosa manca (liste / identificativo / password). Il fallimento silenzioso « ho inserito i miei identificativi ma non appare nulla » diventa quindi visibile e identificabile.
- **Nuovo — chiave in memoria**: il pulsante « Mostra categorie » di un indicizzatore già configurato non richiede più di reinserire la chiave API — viene ripresa automaticamente dal server (il browser non la vede mai), e una nota « Chiave registrata — utilizzata automaticamente » lo indica. Funziona anche per la modalità identificativi.
- **Nuovo — pulsante "Verifica connessione"** su ogni indicizzatore: verifica l'URL e le credenziali in un secondo e mostra il risultato (OK o errore dell'indicizzatore).
- **Corretto — salvataggio silenzioso**: il modulo non accetta più di fallire in silenzio — se il salvataggio fallisce lato server, l'errore viene visualizzato e il modulo rimane aperto.
- **Corretto**: la chiave del catalogo (es. `c411`) viene ora salvata anche durante una modifica, non solo durante l'aggiunta.

---

## v1.12.92 — Agosto 2026

### Crayon C411: credenziali del sito modificabili

- **Corretto**: nel crayon, la sezione "Credenziali del sito (elenche Scopri)" (login, password, toggle delle liste) non veniva mai visualizzata su un indicizzatore C411 già configurato — l'identità "C411" andava persa al salvataggio: venivano conservati solo `kind: "torznab"` e l'URL, e il modulo riconosceva l'indicizzatore solo tramite il suo `kind`.
- **Nuovo**: la chiave del catalogo (es. `c411`) viene ora persistita sull'indicizzatore all'aggiunta, e gli indicizzatori esistenti sono riconosciuti tramite la loro URL di catalogo (repli). La sezione credenziali appare quindi anche in modifica, e il toggle "liste Scopri" non va più perso all'aggiunta (ora viene salvato fin dal POST iniziale).

---

## v1.12.91 — Agosto 2026

### Integrazione c411.org nella pagina Scopri

- **Nuovo**: tre liste provenienti dal sito c411.org vengono visualizzate nella scheda Scopri — "Popolari su C411", "Upload recenti su C411" e "Uscite del giorno su C411" (solo categoria film/video). Le credenziali dell'account vengono salvate in Impostazioni → Indicizzatori → C411 (sezione "Credenziali del sito"), e ogni lista può essere attivata o disattivata indipendentemente.
- Sessione gestita automaticamente (connessione con CSRF, TTL 25 min, fallback su un secondo tentativo), richieste spaziate per non essere bloccati, e risoluzione TMDb dei release con cache di 30 giorni: un titolo viene proposto solo a partire da un punteggio minimo (titolo esatto o anno + tipo), zero falsi positivi.
- **Corretto — parsing dei nomi dei release**: gli underscore diventavano punti prima dell'analisi dei tag, "AD" viene riconosciuto solo in maiuscolo (i film come "Ad Astra" non sono più mutilati), i canali "5.1" e i gruppi di release vengono ignorati, "10.bits" diventa 10BIT.

### Crayon di modifica su tutti gli indicizzatori

- **Nuovo**: ogni indicizzatore configurato (Torznab, C411…) dispone di un crayon per modificarne le impostazioni senza ricrearlo — il modulo visualizza i segreti esistenti mascherati e non li sovrascrive se il campo è lasciato vuoto.

### Disinstallatore Windows — scelta di eliminazione dei dati personali

- **Nuovo**: la disinstallazione chiede esplicitamente, tramite una casella di controllo, se tutti i dati personali (librerie, cronologia, download, impostazioni — archiviati in ProgramData) devono essere eliminati. Deselezionato di default: una reinstallazione conserva tutto, come prima. Se selezionato, una conferma aggiuntiva protegge da qualsiasi eliminazione accidentale. Schermo in 5 lingue.

### Modalità cinema — opzione "al passaggio del mouse" rimossa

- **Pulizia**: l'attivazione del trailer "al passaggio del mouse" dell'eroe cinematografico non funzionava in modo affidabile; l'opzione è stata rimossa dalle impostazioni (rimangono solo "Disattivato" e "Automatico") e la logica di passaggio del mouse dell'eroe è stata eliminata.

---

## v1.12.90 — Agosto 2026

### Serie con stagione unica divise in "parti" (ordine DVD) — assemblate automaticamente

- **Corretto**: i release di una serie con UNA sola stagione divisi nell'ordine DVD in più parti (es. Disjointed: 1 stagione di 20 episodi, uscita in "S01.PART.01" + "S02.S01.PART.02", o semplicemente "S01" + "S02") non venivano mai abbinati — il numero di stagione dichiarato (S02) non corrispondeva a nessuna stagione della libreria, quindi gli episodi 11-20 rimanevano irreperibili sugli indicizzatori.
- **Nuovo** : rilevamento del marcatore « PART.N » nel nome della release (`S01.PART.02`, `Parte 2`…) e ripiegamento per le serie a stagione unica: una release S02 (o parte 2) copre gli episodi della seconda metà della stagione (11-20 per 20 episodi). La selezione dei file del motore e l'importazione sono tradotti nella stessa numerazione, in modo che i file `S02E01…E10` atterrino correttamente su S1E11-20.
- **Guardrail** : solo le serie a stagione unica; tutte le serie multi-stagioni mantengono il loro matching esatto invariato (una vera stagione 2 non viene mai reinterpretata come una parte). I film non sono interessati.

---

## v1.12.89 — Agosto 2026

### Episodi TBA trattati come « in arrivo » — le serie con una stagione annunciata ma non datata sono complete

- **Corretto** : un episodio senza data di uscita ma con titolo segnaposto « TBA » (TVDB/TMDb pre-creano questi episodi per le stagioni annunciate, es. Gachiakuta S2) veniva trattato come uscito → `missing` → cercato all'infinito sugli indicizzatori. Regola ora in due condizioni distinte: data futura → « in arrivo »; nessuna data **e** titolo TBA → « in arrivo » anche. Un episodio senza data con titolo reale mantiene il comportamento storico (cercabile).
- **Corretto — calcoli stato serie/stagione** : una serie di cui tutto ciò che rimane è « in arrivo » (TBA o date future) è ora **completa** (« disponibile ») ovunque — pagina libreria, dettaglio, scoperta, richieste, calendario — e scompare naturalmente dalle ricerche dei mancanti (search all, retries 6h, RSS). Una serie interamente « in arrivo » rimane visualizzata come « in arrivo ».
- Applicato ovunque: creazione serie (TMDb + TVDB anime), backfill stagione 0, riparazione stagioni TMDb, sync Plex (creazione + aggiornamento), compito giornaliero di transizione delle date.

---

## v1.12.88 — Agosto 2026

### Diagnostica Plex arricchita + GUID esterni richiesti esplicitamente a Plex

- **Aggiunto** — `GET /api/plex/diagnostic?title=...` mostra ora il GUID grezzo e l'array `Guid[]` come riportati dalla lista E dal dettaglio (`/library/metadata/{ratingKey}`), più il tmdbId risolto dalla logica di sync — permette di spiegare perché un media non è collegato.
- **Migliorato — sync Plex** : le richieste di lista includono ora `includeExternalMedia=1`, il parametro Plex che popola l'array `Guid[]` (tvdb://, imdb://, tmdb://) direttamente nelle risposte `/all`.

---

## v1.12.87 — Agosto 2026

### Collegamento Plex esteso ai GUID legacy + diagnostica Plex

- **Corretto — sync Plex** : i GUID in formato legacy (`com.plexapp.agents.thetvdb://80741?lang=fr`, agenti precedenti al 2021) non venivano letti — veniva letto solo l'array `Guid[]` moderno. Queste serie non potevano mai essere collegate, nemmeno con la risoluzione `/find` della v1.12.86. Il campo `guid` legacy viene ora analizzato anche (`thetvdb`/`imdb`/`tmdb`).
- **Aggiunto — rotta diagnostica** `GET /api/plex/diagnostic?title=...` (admin) : mostra per ogni titolo Plex corrispondente il tipo, il ratingKey, il GUID grezzo, l'array `Guid[]` e il tmdbId risolto con la stessa logica di sync — permette di spiegare perché un media non è collegato.

---

## v1.12.86 — Agosto 2026

### Collegamento Plex corretto per i media senza GUID TMDb + strumento di collegamento arricchito

- **Corretto — sync Plex** : la risoluzione degli identificativi leggeva solo i GUID `tmdb://` riportati da Plex. I media abbinati dall'agente Plex solo in `tvdb://`/`imdb://` (serie canadesi, vecchi agenti, ecc.) venivano **silenziosamente ignorati** — file presenti sul disco e visibili in Plex, mai collegati in Movviz, e lo strumento di collegamento non trovava nulla da riparare (nesso percorso era salvato). **Corretto** : i GUID `imdb://`/`tvdb://` vengono ora risolti verso TMDb tramite `/find` (memorizzati come gli altri chiamate TMDb), e in caso di duplicati TMDb per lo stesso titolo, l'entrata già presente nella libreria Movviz ha la priorità. Confermati in produzione su « Le cose hanno le loro ragioni » : il GUID `tvdb://80741` si risolve su tmdb 2903 (2005), presente nella libreria.
- **Migliorato — collegamento file** (`repair-paths`) : quando il nome del file salvato non esiste più da nessuna parte sul disco, lo strumento propone ora anche i file il cui nome contiene lo stesso `SxxEyy` (candidati per conferma manuale — mai collegamento automatico su questo criterio).
- **Docs** : piano architetturale « Movviz Federation » archiviato in `docs/federation-plan.md`.

---

## v1.12.85 — Agosto 2026

### Corretto bug di rinomina motore + isolamento della ricerca dei mancanti (quote + annullamento)

- **Corretto — motore** (`AbstractBackend.mjs`) : bug di rinomina dei pacchetti — l'oggetto informazioni condiviso (`releaseInfo`) veniva mutato dalla risoluzione del file di destinazione, e per ogni file senza numero di episodio nel nome, lo stesso oggetto veniva riutilizzato per i successivi: il PRIMO file abbinato imponeva quindi il suo episodio a tutti gli altri. Confermati in produzione su un pacchetto completo di Trigun: 25 file rinominati `S01E03` (poi `S01E04` al 3° import), E1 sempre sovrascritto. **Corretto**: l'oggetto è ora clonato per file (`{ ...info }`) — riprodotto localmente con i 28 veri nomi dei file del pacchetto, ogni file ottiene il proprio episodio (E01-E26, unici). Il motore ridistribuito non rinominerà più mai un intero pacchetto nello stesso episodio.
- **Quote degli indicizzatori (anti-429)** : quote per indicizzatore riattivate (`c411.org` = 15 req/min documentate, 20 req/min di default per ogni host) + nuovo limite globale di 40 req/min (finestra scorrevole 60 s). Applicate PRIMA dell'invio di ogni richiesta (`fetchXml`), le quote documentate non vengono mai superate. La ricerca raggruppata « cercare i mancanti » non può più auto-infliggersi 429 (misurato in produzione: ~35 richieste in ~35 s scatenava già un 429).
- **Annullamento dei job** : nuova rotta `POST /api/jobs/[id]/cancel` (admin) + `requestCancelJob()`/`isJobCancelled()` nella coda + nuovo stato `"cancelled"` (settle pulito tramite `JobCancelledError`, flag spurgato alla fine). Punti di controllo cooperativi a tutti i livelli della ricerca raggruppata: tra elementi del lotto, tra stagioni, tra episodi — gli episodi non ancora cercati rimangono semplicemente « mancanti » e verranno riprovati al prossimo passaggio. Un job in coda viene rimosso immediatamente; un job in corso si ferma al suo prossimo punto di controllo (alcuni secondi).
- **UI** : il pannello Coda mostra i job annullati (icona dedicata + etichette `jobs.statusCancelled` nelle 5 lingue).

---

## v1.12.84 — Agosto 2026

### Importazione affidabile dei pacchetti di stagione/completi — mai più "S01E" vuoto né file sovrascritti

- **Contesto (confermato in produzione)** : un pacchetto di stagione Noblesse (20,3 Go) scaricato al 100% ha importato solo 2 episodi su 13. Il grab non aveva `episodeTargets` — il motore ha quindi importato TUTTI i file a caso, e ogni file il cui numero di episodio non era identificabile è stato rinominato con un episodio VUOTO (`Noblesse - S01E.mkv`). Diversi file dello stesso pacchetto arrivavano quindi sullo stesso percorso di destinazione e si **sovrascrivevano a vicenda** (l'ultimo sostituiva i precedenti), gli episodi mai importati rimanendo "mancanti".
- **Corretto — motore** (`AbstractBackend.mjs`) : quando il numero di episodio rimane sconosciuto dopo tutti i fallback (nome del file, release, cartella), il file mantiene ora il suo nome originale invece del template `S{season:00}E{episode:00}` vuoto — nome unico per file, nessuna collisione né sovrascrittura, e file sempre scopribile dallo strumento di rinomina. `avoidCollision()` si applica ora anche alle serie (come ai film).
- **Corretto — grab manuale** (`/api/indexers/grab`) : un grab da una scheda serie/stagione passa ora `episodeTargets` al motore (episodi monitorati "mancanti"/"ricerca"), esattamente come un grab automatico — il motore scarica/importa quindi solo gli episodi targettizzati.
- **Precisione** : l'import lato libreria non è cambiato — un file senza numero di episodio non viene mai erroneamente assegnato a un episodio ("missing" finché il link non è risolto).

---

## v1.12.83 — Agosto 2026

### Parole consentite — un termine presente nel titolo annulla la parola vietata

- **Nuovo** : nelle Impostazioni → Qualità, viene aggiunta una sezione "Parole consentite" accanto a "Parole vietate". Se una parola consentita è presente nel titolo di un rilascio, la parola vietata corrispondente viene annullata. Caso tipico risolto: un utente ha caricato un episodio etichettato "VOSTFR" quando in realtà è un multi — `Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p...` con "VOSTFR" vietato + "FRENCH" consentito è ora accettato, mentre un semplice VOSTFR rimane rifiutato.
- **Applicazione** : la logica risiede in `matchesBlockedWord()` (`releaseRules.ts`), quindi tutte le voci la rispettano — ricerca automatica (torznab), guardia di decisione, importazione di file, recupero download.
- **Corrispondenza** : in sotto-stringa case-insensitive, come le parole vietate (nota: "TRUEFRENCH" contiene "FRENCH").
- Test : 6 nuovi casi in `scripts/allowed-words.test.ts` (23/23 verdi).

---

## v1.12.82 — Agosto 2026

### Rilascio 1.12.82 — codifica verificata, pipeline CI riavviata su un commit sano

- **Contesto** : il primo push della v1.12.81 è stato effettuato con un `package.json` corrotto da un BOM UTF-8 (`U+FEFF`) introdotto da una scrittura PowerShell — il build CI (`next build` tramite `build.ps1`) è fallito con `package.json is not parseable: invalid JSON: expected value at line 1 column 1`.
- **Corretto** : la codifica di tutti i file interessati (`package.json`, `README.md`, `CHANGELOG.md`, `autoGrabSeries.ts`, `torznab.ts`, `autoGrab.ts`, `mediaMap.ts`, `rssCache.ts`) è stata verificata byte per byte — nessun BOM, UTF-8 pulito. Il commit corretto della v1.12.81 conteneva già il codice esatto senza BOM; la v1.12.82 riparte da una base sana e riavvia l'intero pipeline (installer Windows + immagine Docker) sul commit corretto.
- **Promemoria** : i file sorgente NON devono MAI essere scritti tramite PowerShell 5.1 (`Set-Content`, redirezioni) — le loro codificazioni predefinite corrompono l'UTF-8 o aggiungono un BOM.

---

## v1.12.81 — Agosto 2026

### Audit di ricerca/corrispondenza (TR4KER vs C411), link-before-download, inondazione notifiche Seerr, e un mismatch scoperto di token motore

- **Corretto, confermato live**: una serie come "Ma vie con i Walter Boys" (tmdbId 199001) non poteva mai essere recuperata: il titolo localizzato francese è stato utilizzato sia per la query dell'indexer che per la corrispondenza del rilascio locale, mentre i rilascio di scena sono sempre nominati dopo il titolo ORIGINALE ("My.Life.With.The.Walter.Boys.S03...") — ogni indexer ha restituito 0 hit. Ricerca e corrispondenza ora preferiscono `originalTitle` (il titolo localizzato rimane come alias), e l'aggiornamento giornaliero dei metadati riempie `originalTitle`/`tvdbId`/`imdbId` nelle voci preesistenti. TR4KER dichiara anche solo la ricerca tvdb (`tvSearchTvdb`, nessun tmdb) — il tvdbid non è mai stato inviato perché il campo non esisteva; `searchTv` ora invia `tvdbid` (TR4KER) / `tmdbid` (C411) come supportato dall'indexer.
- **Corretto**: una ricerca in modalità ID fallita (errore lato indexer o HTTP 5xx) inghiottiva silenziosamente l'intera ricerca — il fallback testuale non veniva mai eseguito. Sia `searchMovie`/`searchTv` ora falliscono sempre sulla query testuale.
- **Corretto**: il refresh RSS orario mostrava silenziosamente "C411:0" — gli errori dell'indexer sono stati catturati e scartati. Gli errori vengono ora registrati per indexer (`rss_refresh.indexer_error`) e un ciclo con 0 rilasci mentre altri ne restituiscono molti avvisa con i limiti dell'indexer (`rss_refresh.indexer_empty`).
- **Corretto**: il collegamento di un rilascio prima del download falliva con "Impossible d'ajouter ce titre à la bibliothèque" quando il titolo era già nella libreria — la risposta `alreadyInLibrary` del server ora porta l'elemento esistente in modo che il selettore possa collegarsi direttamente ad esso. Una guardia contro duplicati di libreria (`libraryEntriesMatch`, titolo/originalTitle/alias + anno compatibile) impedisce anche che TMDb crei un secondo record di libreria per duplicati.
- **Corretto**: l'inondazione di log `[seerr] mediaId not found` — gli tmdbId sconosciuti sono ora memorizzati nella cache come mancanti per 1 ora (avviso al massimo una volta/ora ciascuno) con paginazione limitata, e le notifiche "processing" sono de-duplicate a una per titolo per passaggio (`notifySeerrProcessingOnce`).
- **Fixed, environment**: il log diagnostico mostrava ogni download rifiutato con `{"error":"unauthorized"}` — l'app web e il motore di download utilizzavano file `engine-token.json` diversi (sv vs installazione servizio Windows). I file token sono allineati; ora appare un suggerimento esplicito "TOKEN MOTEUR INVALIDE" nel log diagnostico quando il motore rifiuta un download per non autorizzato.

---

## v1.12.80 — Agosto 2026

### "Recupera download" si bloccava su cartelle di download grandi — ora in batch, e le schede coda/cronologia non si bloccano più con migliaia di righe

- **Fixed, confermato live**: l'azione di manutenzione elaborava ogni file in una singola richiesta sincrona. Con centinaia di file (pacchetti grandi, arretrati lunghi) la richiesta poteva scadere o richiedere minuti, e la risposta renderizzava ogni voce recuperata/fallita/duplicata tutte insieme — la pagina si bloccava o si bloccava del tutto. Lo scan ora viene eseguito in batch di 20 file per richiesta: il pannello si riavvia automaticamente con i percorsi già tentati (il server è idempotente per percorso, quindi un file fallito permanentemente viene segnalato una sola volta e non viene mai ritentato all'interno della stessa esecuzione), mostra i progressi man mano che i batch vengono completati e limita l'elenco renderizzato a 30 voci per sezione con una nota "+N altro" — tutti i dati rimangono disponibili per le azioni elimina-duplicati/non corrispondenti.
- **Fixed**: la scheda Coda renderizzava ogni riga torrent (download in corso, seeding, completato...) ad ogni poll di 500 ms — centinaia di elementi completati dipingevano migliaia di nodi DOM, bloccando la scheda. Ora dipinge immediatamente le prime 50 righe (gli elementi attivi vengono ordinati per primi, quindi la coda live rimane visibile), ingrandisce il resto nel tempo libero e offre un pulsante "Mostra altro". Stesso rendering progressivo applicato alla scheda cronologia Attività, che contiene fino a 2000 voci.
- Entrambi i cambiamenti sono solo di rendering/prestazioni: filtri, azioni in blocco, contatori e pulsanti di pulizia si comportano esattamente come prima.

---

## v1.12.79 — Agosto 2026

### Rafforzata la correzione precedente dopo revisione indipendente

- Una revisione indipendente della correzione di recupero v1.12.78 ha rilevato due lacune reali prima che potessero causare problemi: la nuova risoluzione "fidarsi del record del download originale" avrebbe potuto sovrascrivere il numero di stagione esplicito e discordante di un file — il che significa che un rilascio etichettato male avrebbe potuto essere archiviato silenziosamente nella cartella di stagione sbagliata. Ora riempie una stagione/episodio solo se il nome del file non lo ha già fornito, mai sovrascrivendone uno. Inoltre, un punto rimasto (un film impacchettato all'interno di un pacchetto di categoria serie) era ancora sul vecchio percorso di solo ipotesi mentre ogni altro caso era già stato aggiornato — ora coerente in tutti.

## v1.12.78 — Agosto 2026

### Causa radice del recupero download non riusciva a ricollegare nemmeno — il recupero scartava informazioni che già possedeva

- **Fixed, confermato live**: è stato indagato un caso specifico (Wakfu) in cui lo strumento di recupero download non riusciva a trovare una corrispondenza per i file completati anche se la serie era già correttamente nella libreria. Causa radice: il recupero stava ri-ipotizzando la serie di ogni file basandosi solo sul suo nome file e percorso cartella, anche per i file il cui download originale sapeva già — con certezza, dal momento in cui era stato scaricato — esattamente a quale serie e stagione apparteneva. Queste informazioni autorevoli venivano scartate prima dell'esecuzione del matching per file, costringendo ogni file a passare attraverso un'ipotesi di nome file sfocata. Per una serie organizzata come `NomeSerie/Stagione 01/episodio.avi` con un file episodio il cui nome non porta alcun marcatore di stagione riconoscibile, quell'ipotesi ricadeva sulla lettura della cartella stagione stessa ("Stagione 01") come titolo della serie — non condividendo parole affatto con il nome reale, quindi non corrispondeva mai.
- Il recupero ora risolve la serie/stagione di un file direttamente dal record del suo download originale quando disponibile, invece di ipotizzare — e quando deve ricadere sulla lettura dei nomi delle cartelle, ora controlla un livello più in alto ogni volta che la cartella più vicina risulta essere un semplice marcatore di stagione senza un titolo reale al suo interno, piuttosto che fermarsi alla prima cartella indipendentemente da ciò che contiene effettivamente. Entrambe le correzioni sono generiche — si applicano a qualsiasi serie organizzata in questo modo, non solo a quella che ha fatto emergere il bug.

## v1.12.77 — Agosto 2026

### Modalità Cinema permetteva di vedere attraverso la pagina sottostante

- **Corretto, confermato live**: la precedente correzione rendeva trasparente lo sfondo del lettore stesso in modo che potesse trasparire l'atmosfera del colore — ma nulla dietro di esso era effettivamente completamente opaco (lo strato page-dim è solo ~80% nero attraverso un effetto sfocatura, e gli strati colore stessi impilano diversi effetti di opacità parziale senza una base solida). La pagina reale della libreria risultava visibilmente leggibile attraverso le barre letterbox — peggio del nero piatto che aveva sostituito. È stato aggiunto uno strato base permanente e completamente opaco sotto tutto il resto, in modo che la pagina non possa più trasparire, con o senza l'artwork di un titolo disponibile per l'estrazione del colore.

## v1.12.76 — Agosto 2026

### Lo sfondo adattivo del Modalità Cinema era invisibile — corretto e riequilibrato per un impatto visivo reale

- **Corretto, confermato live**: l'atmosfera del colore estratta dall'artwork di ciascun titolo era strutturalmente nascosta — lo sfondo del lettore video stesso era completamente opaco, dipinto sopra lo strato di atmosfera, in modo che il colore lampeggiasse solo per un istante durante l'animazione di apertura prima di scomparire completamente per tutto il tempo di visione. Inoltre, lo strato di atmosfera portava un secondo velo nero quasi opaco impilato direttamente sul gradiente di colore, annullando ciò che poco appariva durante quell'istante a quasi nulla. Effetto netto: nero piatto indipendentemente dall'artwork del titolo.
- Lo sfondo del lettore è ora trasparente dove dovrebbe mostrare lo sfondo, e il bilanciamento tra velo/gradiente è stato rivisto in modo che il colore estratto sia effettivamente visibile nelle aree letterbox intorno al video — un poster luminoso e colorato tinge visibilmente il cinema, uno scuro rimane malinconico, invece di far sembrare tutto identico.

## v1.12.75 — Agosto 2026

### Causa radice di un download di pacchetto di stagione completato che non appariva nella libreria

- **Corretto, confermato live**: è stato indagato un caso specifico (un anime i cui pacchetti di stagione erano scaricati completamente — la coda li mostrava "completati" — ma nessun episodio è mai diventato disponibile). La causa radice: alcuni rilasci di pacchetti di stagione nominano i loro file di episodi dopo la serie in una forma pesantemente abbreviata o non standard che l'analizzatore del titolo non può riconoscere (nel caso confermato, un acronimo che non condivide parole con il titolo reale) — quindi quando i file del download completato non riuscivano a corrispondere a nessun episodio tracciato, non venivano correttamente *eliminati*, ma il passaggio di recupero che dovrebbe intercettare esattamente questo caso registrava solo la mancanza in un valore che nulla leggeva mai, quindi i file rimanevano lì indefinitamente con visibilità zero.
- Il passaggio di recupero ora registra queste come fa già un download manuale veramente non collegato: appaiono in Attività → Non collegati, dove possono essere puntati manualmente al titolo corretto — in generale, per qualsiasi rilascio il cui nome l'analizzatore non può mappare con sicurezza, non specifico per la singola serie che lo ha fatto emergere.

## v1.12.74 — Agosto 2026

### Bug di corrispondenza che poteva prendere la serie sbagliata, e un blocco della coda di lavoro che poteva congelare silenziosamente tutte le ricerche in background

- **Corretto, confermato live**: il punteggio di corrispondenza del titolo trattava due titoli come quasi identici basandosi solo sulla distanza caratteristica grezza, anche quando differivano per una parola completamente diversa — confermato live con "How I Met Your Father" (uno spin-off non correlato) che otteneva un punteggio di somiglianza di ~91% rispetto a una ricerca per "How I Met Your Mother" e veniva preso al suo posto. Il punteggiatore ora controlla anche parola per parola: una parola completamente diversa (non una variante ortografica) è disqualificante indipendentemente da quanto sembri vicino il conteggio totale dei caratteri.
- **Corretto, confermato live**: un singolo compito in background bloccato (in questo caso una lenta sincronizzazione Plex) poteva occupare indefinitamente uno slot della coda di lavoro, bloccando silenziosamente ogni altro lavoro in coda dietro di esso — comprese ricerche programmate e manuali — finché rimaneva bloccato, senza errori o indicazioni che qualcosa fosse sbagliato. Questo è ciò che poteva lasciare un titolo monitorato e aggiunto correttamente mai effettivamente cercato. La coda ora libera lo slot di un lavoro dopo 10 minuti se non è terminato, in modo che un singolo compito bloccato non possa più affamare tutto ciò che c'è dietro.

## v1.12.73 — Agosto 2026

### Lettore Beta — la riproduzione diretta ora inizia come funzionava sempre il tentativo di riprovare manuale con il "fulmine"

- **Corretto**: il lettore usava di decidere se tentare la riproduzione diretta pre-controllando il supporto dei codec con API del browser che sono note per mentire in casi comuni (AC-3/E-AC-3 che segnalano sempre "non supportato" su Chrome/Edge, alcuni container che segnalano video decodificabili come non supportati) — reindirizzando molti file a un transcodifica o a un fallback WebCodecs che la riproduzione diretta avrebbe gestito perfettamente. Confermati in diretta: il pulsante di riprova manuale, che tentava sempre direttamente senza alcun pre-controllo, ha funzionato notevolmente meglio.
- La riproduzione diretta è ora il primo tentativo incondizionato su ogni video, corrispondendo esattamente a quanto faceva già la riprova manuale — i due sono ora letteralmente lo stesso percorso di codice, condividendo lo stesso recupero automatico (passa all'altro modalità di riproduzione in caso di errore di riproduzione reale o in caso di audio genuinamente silenzioso, invariato rispetto a prima).
- Il pulsante di riprova manuale ora beneficia anche di questo stesso recupero automatico, e riprende dalla posizione corrente invece di ripartire da zero.
- Rimosso il percorso di riproduzione WebCodecs, ora completamente inutilizzato, che veniva usato per reindirizzare — era strettamente una versione peggiore e ridondante di quello che la riproduzione diretta + la catena di fallback esistente coprono già.

## v1.12.72 — Agosto 2026

### Modalità Cinema — un lettore davvero immersivo, non un video in un modale

- **Nuovo**: il lettore Beta ora si apre in una "Modalità Cinema" completa — la pagina corrente rimane esattamente dove era dietro (posizione di scorrimento, stato, tutto), il lettore si espande dal pulsante cliccato con una vera transizione geometrica (non un dissolvenza), e la pagina dietro si scurisce e sfoca progressivamente anziché semplicemente scomparire.
- Qualsiasi trailer o anteprima ambientale riprodotto ovunque sullo schermo si interrompe non appena si apre il lettore reale — mai due video che riproducono contemporaneamente.
- Lo sfondo del lettore ora assume un sottile ambiente cromatico estratto dall'artwork del titolo stesso (toni dominanti, consapevole della luminosità) invece di essere nero piatto — analizzato una volta per titolo e memorizzato, mai durante la riproduzione.
- "Leggi su Plex" ora legge "Leggi" ovunque il lettore Beta gestirà effettivamente la riproduzione, e rimane "Leggi su Plex" dove è un vero passaggio a Plex — coerente su ogni scheda titolo, la pagina del titolo, la pagina dell'episodio e l'hero del dashboard (che precedentemente non aveva alcuna integrazione con il lettore Beta).
- Le tre copie separate di questa logica di trigger nell'app sono ora un'unica implementazione condivisa, chiudendo il divario dove una futura correzione potrebbe atterrare in un posto e mancare negli altri.

### "Novità nell'app" ora segue la lingua dell'interfaccia

- Le note di rilascio sono ora localizzate per lingua UI (con fallback all'inglese per tutto ciò che non è ancora tradotto), invece di un singolo file a lingua fissa.
- **Corretto**: le note di rilascio mancavano silenziosamente sia nelle build Docker che in quelle Windows — il file da cui venivano lette non era mai effettivamente incluso in nessuna delle build impacchettate, quindi il popup "cosa è nuovo" non aveva nulla da mostrare.

## v1.12.70 — Agosto 2026

### Motore di download — causa principale dei download permanentemente non collegati

- **Corretto, confermato in diretta**: la rimozione di un torrent dal motore di download segnalava successo e cancellava il proprio tracciamento (incluso a quale titolo della libreria apparteneva) anche quando il client di download sottostante falliva silenziosamente nel rimuoverlo effettivamente — il torrent continuava a girare e a seminare indisturbato, ma il motore non ne aveva più traccia. Questo è ciò che produceva download che non potevano più essere collegati a un titolo non importa quante volte veniva eseguita una scansione di recupero. Il motore ora cancella la propria contabilità solo quando la rimozione è confermata indipendentemente; altrimenti il torrent rimane tracciato e può essere riprovato invece di diventare un orfano permanente.

## v1.12.51 – v1.12.69 — Agosto 2026

Pass di accuratezza di corrispondenza e affidabilità del motore: rilevamento di pacchetti di serie complete (termini di intervallo di stagione, guardie contro falsi positivi), recupero download bloccato rafforzato con movimenti atomici senza sovrascrittura e un callback di importazione affidabile, blocco di scrittura per serie/film per chiudere una gara che potrebbe far perdere lo stato di un episodio completato, e riconciliazione dei download duplicati in modo che un file riacquisito non lasci più la libreria bloccato sullo stato sbagliato. Guida utente aggiornata per coprire le funzionalità recentemente rilasciate (modifica titolo, versioni film, collegamento download non collegato, impostazioni anime).

## v1.12.24 – v1.12.50 — Agosto 2026

Ricerca pacchetto serie completa (singola query, consapevole dell'intervallo di stagione), affidabilità del recupero download (scansione cartella, corrispondenza file orfani, pulizia duplicati), eliminazione duplicati sicura, e una piccola suite di test automatizzati per il core di corrispondenza rilasci.

## v1.10.90 – v1.12.23 — Luglio–Agosto 2026

Flusso di lavoro di aggiornamento qualità (Ottimizza / Ignora, rilevamento aggiornamento significativo), un sistema di badge risoluzione/codec ridisegnato, profili di prestazioni GPU/animazione, e stabilizzazione del motore su backend di download intercambiabili (correzioni crash, regola anti-stallo, blocco ricerca per serie).

## v1.10.39 – v1.10.89 — Luglio 2026

Riscrivere il motore di download con backend intercambiabili (nativo/aria2, WebTorrent, libtorrent), uno strumento di manutenzione "recupera download" per file orfani, un sistema di notifica toast premium, badge codec audio, e miglioramenti beta di riproduzione in app (riproduzione diretta, logging transcodifica).

## v1.10.12 – v1.10.17 — Luglio 2026

Pass di accuratezza di rilevamento lingua: lingua traccia audio letta da Plex, tag variante francese (VF/VFQ/VFF/TRUEFRENCH) che soddisfano correttamente i profili di qualità, pulizia episodi duplicati, e correzione per abbandono prematuro di torrent.

## v1.10.1 – v1.10.6 — Luglio 2026

Decision Guard (applicazione blocco pre-acquisizione), rilevamento franchise/collezione, un dashboard di coda download e diagnostica ridisegnato, e raffinamenti per trailer/calendario.

## v1.8.0 – v1.9.9 — Luglio 2026

Pannello titolo unificato (componente singolo per viste slide-in e pagina completa), una rete di sicurezza cestino/reciclabile per titoli rimossi, pass di reattività mobile, e correzione per una perdita di memoria nella cache dei metadati.

## v1.4.5 – v1.7.9 — Luglio 2026

Rafforzamento della sicurezza (traversamento percorso, protezioni database, avvisi CodeQL), le protezioni finali del sistema cestino, un player in app live, aggiornamenti in tempo reale su tutta l'interfaccia utente, monitoraggio attività Plex, e supporto collezioni.

## v1.1.67 – v1.4.4 — Luglio 2026

Player in app con fallback automatico transcodifica Plex, importazione richiesta di terze parti (compatibile con Seerr), build Docker multi-architettura, e riduzione della navigazione delle impostazioni da 26 schede a 18.

## v1.1.50 – v1.1.66 — Luglio 2026

Rilascio pubblico iniziale: scoperta TMDb, ricerca indicizzatore Torznab/Newznab, libreria film/serie unificata, richieste multi-utente, il motore BitTorrent integrato, e sincronizzazione Plex — più correzioni iniziali di stabilità e sicurezza (gestione sessione, deduplicazione libreria, aggiornamenti dipendenze).
