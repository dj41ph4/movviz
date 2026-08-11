# Changelog

Tutte le modifiche rilevanti a Movviz, raggruppate per tappa di sviluppo.

---

## v1.13.27 — Agosto 2026

### Trovata la vera causa del bug "scarica i mancanti" — un controllo anti-doppione, non la cache

- **Corretto**: la vera causa radice del bug delle ultime due versioni non era in realtà mai legata alla cache. L'aggiunta di un film davvero nuovo richiedeva già correttamente il titolo giusto — ma un controllo anti-doppione (pensato per rilevare il caso in cui TMDb elenca lo stesso film già uscito sotto due identificativi diversi) trattava silenziosamente una scheda non confermata, non ancora uscita (ad esempio una scheda provvisoria "Untitled [Franchise] Sequel" senza anno) come una corrispondenza di titolo con una voce precedente della stessa saga già posseduta ma senza alcun legame, e riutilizzava silenziosamente quella voce esistente invece di aggiungere quella nuova — confermato dal vivo: un'aggiunta reale di un film diventava silenziosamente un no-op sul titolo esistente sbagliato, con una risposta di successo che mascherava il problema. Questo controllo ora richiede un vero anno di uscita confermato su entrambi i lati prima di fidarsi di una corrispondenza di titolo, invece di trattare "nessun anno ancora" come "abbastanza vicino".

## v1.13.26 — Agosto 2026

### Il correttivo della v1.13.25 per "scarica i mancanti" non era sufficiente — anche l'elenco delle parti della collezione poteva essere altrettanto obsoleto

- **Corretto**: riverificato dal vivo, il correttivo precedente non reggeva del tutto — riverificare solo l'istantanea della libreria prima di scaricare non bastava, perché anche l'elenco delle parti della collezione (proveniente dalla stessa cache condivisa a livello di app) poteva essere altrettanto obsoleto. Ora entrambi vengono riverificati da zero insieme, subito prima del ciclo di download, invece di un solo lato del confronto.

## v1.13.25 — Agosto 2026

### "Scarica i mancanti" in una pagina di collezione poteva recuperare un titolo già posseduto invece di quello davvero mancante

- **Corretto**: il pulsante "Scarica N mancante/i" di una pagina di collezione calcolava i titoli mancanti a partire da un'istantanea della tua libreria condivisa e messa in cache in tutta l'app — un'istantanea che può comparire istantaneamente a partire dai dati di una pagina precedente invece dello stato reale attuale, senza nulla di visibilmente sbagliato a schermo. Confermato dal vivo su più collezioni: il pulsante poteva aggiungere un titolo già posseduto mentre quello effettivamente mancante restava intoccato, silenziosamente. Ora riverifica la tua libreria da zero, appena prima di scaricare, invece di fidarsi di quell'istantanea.

## v1.13.24 — Agosto 2026

### Gli account amici ricevevano tutti la cronologia di visione del proprietario del server — trovata e corretta la vera causa nell'API Plex

- **Corretto**: il dettaglio diagnostico della v1.13.23 aveva dimostrato che ogni account amico collegato aveva effettivamente un'identità e un token Plex realmente distinti — eppure tutti sincronizzavano esattamente gli stessi numeri di visione dell'account proprietario del server. Causa radice confermata dal comportamento documentato di Plex stesso: gli endpoint usati per sincronizzare lo stato di visione restituiscono il `viewCount` dal punto di vista del proprietario del server soltanto, indipendentemente da quale token di account valido effettui la richiesta — nessuna intestazione di richiesta può cambiarlo. La sincronizzazione dello stato di visione ora usa l'endpoint della cronologia di sessione di Plex, interrogato con il token admin e filtrato per l'id Plex proprio di ciascun account — il modo in cui Plex traccia realmente la visione per account. Funziona ora allo stesso modo per gli account amici e per i profili gestiti dell'Home, invece di due percorsi separati.

## v1.13.23 — Agosto 2026

### Più dettaglio nel log di sincronizzazione Plex, per stanare un vero sospetto

- **Modificato**: dopo che la v1.13.22 ha aggiunto la registrazione per account, un primo passaggio reale ha mostrato che tutti gli account amici collegati riportavano esattamente gli stessi numeri di visione — da verificare piuttosto che dare per scontato. La riga di log ora mostra anche l'ID dell'account Plex e una breve impronta non sensibile del token per account, per confermare se si tratta davvero di identità Plex distinte prima di seguire una pista sbagliata.

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
