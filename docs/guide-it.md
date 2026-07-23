# Guida Utente di Movviz

## 1. Panoramica

Movviz è un centro di comando multimediale unificato. Riunisce scoperta (TMDb), ricerca su indexer Torznab/Newznab, una libreria di film e serie, gestione richieste multi-utente, un motore BitTorrent integrato, integrazione Plex e molto altro — tutto in un'unica interfaccia premium dal look cinematografico.

**Concetti chiave:**

- **Libreria** — Film e serie che aggiungi per il monitoraggio. Ogni titolo ha uno stato (Disponibile, In download, Mancante, Ricerca in corso) e può essere taggato, monitorato e cercato automaticamente tramite gli indexer.
- **Indexer** — Servizi Torznab/Newznab che indicizzano le release. Movviz li interroga per trovare download disponibili per i tuoi contenuti monitorati.
- **Motore** — Il client BitTorrent integrato. Ogni categoria (film/serie) esegue la propria istanza del motore con percorsi di download, limiti di velocità e rapporti di seed indipendenti.
- **Richieste** — Gli utenti possono richiedere titoli non ancora presenti in libreria. Gli admin approvano o rifiutano le richieste, che poi attivano la ricerca automatica.
- **Plex** — Integrazione opzionale per la sincronizzazione della libreria (importazione di ciò che Plex possiede), sincronizzazione watchlist (richiesta automatica delle aggiunte alla watchlist Plex) e tracciamento dello stato di visione per profilo utente.

**Stack tecnico:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion, SWR e un motore BitTorrent ESM dedicato in esecuzione su una porta separata.

**Porte (predefinite):** Interfaccia web sulla 9810, Motore BitTorrent sulla 9820, Risolutore Cloudflare sulla 9830, peer-to-peer sulla 51413/51414.

---

## 2. Per Iniziare

### Primo avvio — Configurazione guidata

La prima volta che accedi a Movviz (o se non esiste alcun account admin), vieni guidato attraverso una configurazione guidata in 6 passaggi su `/setup`:

1. **Lingua** — Scegli la lingua dell'interfaccia tra 5 opzioni disponibili: français (fr), English (en), Italiano (it), Nederlands (nl), Deutsch (de).
2. **Chiave API TMDb** — The Movie Database (TMDb) alimenta tutta la scoperta, i metadati, i poster e la ricerca. Puoi usare la chiave predefinita integrata o inserire la tua da [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. **Chiave API TVDB** — TheTVDB fornisce metadati supplementari, specialmente per gli anime. Ottieni una chiave su [thetvdb.com/api-information](https://thetvdb.com/api-information).
4. **Indexer** — Aggiungi uno o più indexer Torznab o Newznab. Queste sono le fonti che Movviz interroga quando cerca release. Puoi aggiungerli da un catalogo o configurare un endpoint generico manualmente.
5. **Client di download** — Configura le istanze del motore BitTorrent integrato (una per i film, una per le serie). Imposta cartelle libreria, percorsi di download, limiti di velocità, rapporti di seed e comportamento di avvio automatico.
6. **Plex** — Collega opzionalmente un Plex Media Server per la sincronizzazione della libreria, la sincronizzazione della watchlist e l'autenticazione Plex.

Ogni passaggio può essere saltato e configurato successivamente dalle Impostazioni.

### Creazione account / accesso

Dopo la configurazione, raggiungi la pagina di login su `/login`. Movviz supporta due metodi di autenticazione:

- **Account locale** — Registrati con nome utente e password. Il primo account (creato durante la configurazione) è un admin. Le registrazioni successive creano utenti in attesa che devono essere approvati da un admin.
- **Autenticazione Plex** — Clicca "Accedi con Plex" per autenticarti tramite il tuo account Plex. Si apre un popup per l'autorizzazione Plex; una volta completata, l'accesso avviene automaticamente.

Se hai già un account, usa direttamente il modulo di login. Usa il link "Non hai ancora un account?" per passare alla modalità di registrazione.

---

## 3. Dashboard (/)

La dashboard è la tua pagina principale — statistiche a colpo d'occhio e attività recente.

### Widget personalizzabili

La sezione superiore mostra riquadri con i conteggi di:
- **Film** — Film totali in libreria
- **Serie** — Serie totali in libreria
- **Episodi** — Episodi monitorati totali
- **Episodi mancanti** — Episodi monitorati non ancora disponibili
- **Disponibili** — Film + episodi disponibili
- **In download** — Film + episodi attualmente in download o in ricerca
- **Mancanti** — Film in stato mancante
- **Episodi disponibili** — Episodi monitorati disponibili

**Modalità modifica:** Clicca l'icona della matita per entrare in modalità modifica. In modalità modifica puoi:
- **Riordinare** i riquadri tramite trascinamento (riordino Framer Motion)
- **Rimuovere** i riquadri usando il pulsante X su ciascun riquadro
- **Aggiungere** riquadri nascosti dal menu a discesa "Aggiungi widget"

Clicca il segno di spunta per uscire dalla modalità modifica e salvare il layout.

### Coda di download

Sotto i riquadri delle statistiche, la **coda di download** mostra i torrent attivi e in coda dal motore, con aggiornamenti di progresso in tempo reale.

### Aggiunti di recente

La sezione inferiore mostra i 12 film aggiunti più di recente in una griglia progressiva. Ogni carta mostra il poster, il titolo e il progresso di download se il film è attualmente in fase di download.

---

## 4. Scopri (/discover)

La pagina Scopri è il tuo punto di partenza per trovare nuovi contenuti da aggiungere alla libreria.

### Selettore tipo di contenuto

In alto, scegli tra **Film** e **Serie** per navigare i contenuti specifici per ciascun tipo. I generi, le righe e i risultati di ricerca si aggiornano di conseguenza.

### Righe dinamiche (vista home)

Quando nessun filtro è attivo, la pagina Scopri mostra righe orizzontali curate di contenuti:
- **Di tendenza ora** — Cosa è popolare in questo momento
- **Popolari** — Titoli più popolari
- **Più votati** — Titoli con le valutazioni più alte
- **Prossimamente** — Uscite future
- **Ora al cinema / In onda ora** — Attualmente al cinema o in televisione
- **Botteghino** — Film con i maggiori incassi
- **Bambini** — Contenuti per famiglie
- **Nuove uscite** — Aggiunti di recente in streaming
- **Nuove serie / Rinnovate** — Serie TV nuove o rinnovate di recente

Ogni riga è un carosello scorrevole orizzontale. Cliccando una carta si naviga alla pagina dei dettagli del titolo. Cliccando "Vedi tutti" si passa a una vista a griglia con paginazione filtrata per quella categoria.

**Classifiche:** Alcune righe (es. Più votati, Botteghino) vengono visualizzate come classifiche numerate invece che come caroselli.

### Pulsanti studi e reti

Sotto le righe di contenuti, troverai pulsanti per **studi** (case di produzione) e **reti** (reti televisive). Cliccando uno studio si filtrano i film di quella compagnia; cliccando una rete si filtrano le serie di quella rete.

### Riquadri dei generi

Vengono mostrati riquadri con gradienti colorati per ogni genere. Cliccandone uno si filtrano i risultati per quel genere.

### Filtri

Quando attivi un filtro o effettui una ricerca, la pagina passa dal layout home a una griglia di navigazione con paginazione e questi controlli:

- **Campo di ricerca** — Digita per cercare per titolo (debounced a 350ms)
- **Menu a discesa Genere** — Filtra per genere
- **Input Anno** — Filtra per anno di uscita
- **Menu a discesa Ordina** — Ordina per Trending (popolarità), Più votati (media voti) o Più recenti (data di uscita)
- **Chip filtri attivi** — Mostrano i filtri attivi (genere, anno, studio, rete, categoria riga) con una X per cancellarli
- **Pulsante Reimposta** — Cancella tutti i filtri in una volta

### Risultati infiniti

La griglia di navigazione carica i risultati in pagine. Mentre scorri verso il basso, vengono caricati più risultati automaticamente tramite un IntersectionObserver. Un pulsante "Carica altri" appare anche in fondo come alternativa.

### Aggiungi alla libreria

Ogni carta nella vista navigazione ha un pulsante sovrapposto per **Aggiungere alla Libreria**. Quando cliccato, Movviz aggiunge il titolo alla tua libreria e inizia automaticamente a cercare una release. La carta mostra lo stato corrente (Disponibile, In download, Mancante) se il titolo è già nella tua libreria.

---

## 5. Libreria (/library)

La pagina Libreria ha tre schede: Libreria, Calendario e Ricercati.

### 5.1. Scheda Libreria

La vista principale della libreria mostra tutti i tuoi film e serie in una griglia progressiva responsive.

**Filtri:**
- **Tipo** — Tutti, Solo film o Solo serie
- **Stato** — Tutti, Disponibile, In download o Mancante
- **Tag** — Se dei tag sono assegnati ai titoli, appaiono dei pulsanti tag per filtrare
- **Ordina** — Per Titolo (alfabetico) o Recenti (aggiunti più di recente)

**Rendering progressivo:** Le prime 100 carte vengono renderizzate immediatamente; il resto viene caricato in lotti usando `requestIdleCallback` in modo che la pagina rimanga reattiva anche con migliaia di titoli.

**Carte:** Le carte dei film mostrano il poster (con una barra di progresso durante il download), titolo, anno e badge di stato. Le carte delle serie mostrano informazioni simili per lo stato complessivo della serie.

**Riconciliazione:** L'admin può attivare una riconciliazione della libreria per rilevare file mancanti o file non tracciati sul disco. I problemi vengono segnalati in linea.

### 5.2. Calendario

Mostra le prossime uscite di film e le date di messa in onda degli episodi raggruppate per data. Le voci di oggi sono evidenziate. Ogni voce mostra la miniatura del poster, il titolo, il badge della lingua (VF/VO) e i collegamenti alla pagina dei dettagli del titolo.

### 5.3. Ricercati

Elenca tutti gli elementi monitorati mancanti — film in stato mancante ed episodi monitorati ma non ancora disponibili.

Funzionalità:
- **Pulsante "Scarica tutto"** — Cerca tutti gli elementi mancanti in batch (limite di 5 ricerche simultanee), con un contatore di progresso
- **Ricerca per elemento** — Ogni film o episodio mancante ha un pulsante di ricerca per attivare una ricerca immediata sull'indexer per quell'elemento specifico

Gli elementi vengono mostrati con il loro titolo, data di uscita/messa in onda e da quanto tempo sono stati aggiunti.

---

## 6. Collezioni (/collections)

### 6.1. Saghe (Franchise TMDb)

Le collezioni franchise TMDb rilevate automaticamente (es. "Star Wars", "Harry Potter") vengono mostrate in questa sezione.

- **Progresso** — Ogni saga mostra un conteggio posseduti/totali (es. 4/11) e una barra di progresso
- **Analizza libreria** — L'admin può attivare una scansione delle saghe per rilevare nuove collezioni dalla libreria
- **Modalità di visualizzazione** — Griglia grande, griglia piccola o elenco (salvata in localStorage)

Cliccando una saga si accede alla sua pagina dei dettagli che mostra tutte le voci della collezione.

### 6.2. Collezioni personalizzate

Collezioni create dall'utente per organizzare la tua libreria come preferisci.

- **Creazione** — Clicca il pulsante "Nuova collezione" per creare una collezione personalizzata
- **Modalità di visualizzazione** — Come per le saghe: griglia grande, griglia piccola o elenco

---

## 7. Attività (/activity)

La pagina Attività tiene traccia delle operazioni di download, degli eventi e dei fallimenti.

### 7.1. Download (Coda)

Mostra la coda di download in tempo reale dal motore BitTorrent.

**Stati visibili:**
- **Metadati** — Download dei metadati/info torrent
- **In download** — Download in corso
- **In seeding** — Completato, ora in seed
- **In pausa** — Messo in pausa dall'utente o dal sistema
- **Bloccato** — Nessun peer/attività
- **Completato** — Download terminato

**Azioni per elemento:**
- Metti in pausa / Riprendi
- Riavvia
- Rimuovi dalla coda
- Rimuovi + elimina file scaricati

**Aggiunta manuale:** Puoi aggiungere torrent manualmente tramite magnet link o caricando un file `.torrent`.

**Filtri di stato** — Filtra la coda per stato per concentrarti su stati specifici.

### 7.2. Cronologia

Un registro cronologico degli eventi relativi ai tuoi contenuti:
- **Recuperato** — Una release è stata recuperata da un indexer
- **Importato** — Un download è stato importato nella libreria
- **Aggiornato** — Un file esistente è stato sostituito con una qualità migliore
- **Fallito** — Un download o un'importazione è fallita
- **Bloccato** — Una release è stata bloccata dalla blocklist

### 7.3. Ricercati

Uguale alla scheda Ricercati della Libreria — elementi monitorati mancanti che possono essere cercati individualmente.

### 7.4. Errori

Una vista filtrata della cronologia che mostra solo gli eventi falliti per un debug rapido.

---

## 8. Ricerca Indexer (/search)

La pagina di ricerca ti permette di interrogare direttamente i tuoi indexer configurati.

**Barra di ricerca** — Inserisci una query e premi Invio o clicca il pulsante di avvio.

**Alternanza Film/Serie** — Limita la ricerca alle categorie film o serie sui tuoi indexer.

**Tabella risultati ordinabili** — I risultati vengono visualizzati in una tabella responsive con colonne ordinabili:
- **Titolo** — Nome della release (monospace)
- **Punteggio** — Punteggio di qualità (colorato: verde ≥ 90, ambra ≥ 75)
- **Indexer** — Quale indexer ha restituito la release
- **Età** — Da quanto tempo è stata pubblicata
- **Dimensione** — Dimensione del file
- **Peer** — Conteggio dei seeder (colorato)
- **Azione** — Pulsante di recupero per scaricare manualmente

**Punteggio di qualità:** Ogni release viene valutata in base ai tuoi profili di rilascio e formati personalizzati. Punteggi più alti indicano corrispondenze migliori per le tue preferenze.

**Pulsante Recupera** — Scarica manualmente una release specifica. Il pulsante si trasforma in un segno di spunta una volta recuperata.

**Release recenti** — Quando non viene inserita alcuna query di ricerca, la pagina mostra le release recenti dai tuoi indexer per la categoria selezionata.

**Errori per indexer** — Se un indexer restituisce un errore (chiave errata, limite di velocità, ecc.), viene mostrato in un banner di avviso in modo che tu sappia perché alcuni indexer non hanno restituito risultati.

---

## 9. Richieste (/requests)

Gli utenti possono richiedere film o serie che non sono ancora in libreria.

**Effettuare una richiesta:** Dalla pagina dei dettagli di un titolo, clicca "Aggiungi alla libreria." Se l'elemento non è in libreria, viene creata una richiesta (a seconda dei permessi dell'utente).

**Elenco richieste:** Mostra tutte le richieste con poster, titolo, valutazione, anno, descrizione, chi l'ha richiesta e quando.

**Richieste in attesa:** Le nuove richieste appaiono con un badge "In attesa".

**Azioni admin:**
- **Approva** — Approva la richiesta e attiva una ricerca automatica
- **Rifiuta** — Respinge la richiesta

**Stato richiesta approvata:** Dopo l'approvazione, il badge di stato si aggiorna per riflettere lo stato reale della libreria (Ricerca in corso, In download, Mancante, Disponibile).

**Schede:** In attesa (predefinita) mostra solo le richieste non gestite; Tutte mostra ogni richiesta. Il badge nella barra laterale mostra il conteggio delle richieste in attesa.

---

## 10. Cronologia (/history)

Un registro completo degli eventi separato dalla pagina Attività.

**Filtri:**
- **Tipo** — Tutti, Film o Serie
- **Tipo evento** — Tutti, Recuperato, Importato, Aggiornato o Fallito

**Tabella eventi:** Ogni voce mostra il titolo del contenuto, il tipo di evento (con icona), dimensione, timestamp, indexer/attore e punteggio di qualità. Cliccando un titolo si naviga alla sua pagina dei dettagli.

---

## 11. Problemi (/issues)

Gli utenti possono segnalare problemi con gli elementi multimediali.

**Segnalare un problema:** Nella pagina dei dettagli di un titolo presente in libreria, clicca "Segnala un problema." Scegli il tipo di problema:
- **Video** — Problemi con la qualità video o la riproduzione
- **Audio** — Problemi con le tracce audio
- **Sottotitoli** — Sottotitoli mancanti o errati
- **Altro** — Qualsiasi altro problema

**Elenco problemi:** Mostra tutti i problemi segnalati con poster, titolo, badge del tipo di problema, stato, descrizione, segnalatore e ora.

**Commenti:** Ogni problema ha un sistema di commenti in thread. Clicca il pulsante del conteggio commenti per espandere la conversazione. Aggiungi commenti tramite il campo di input in basso.

**Azioni admin:**
- **Risolvi** — Segna un problema come risolto
- **Riapri** — Riapre un problema precedentemente risolto

**Schede:** Aperti (predefinita) mostra i problemi non risolti; Tutti mostra ogni problema.

---

## 12. Utenti (/users)

Gestione utenti per admin. Mostra un elenco di tutti gli utenti.

**Utenti in attesa:**
- Gli utenti che si sono registrati ma non sono ancora stati approvati appaiono in una sezione evidenziata
- **Approva** — Attiva l'account utente
- **Rifiuta** — Elimina l'utente in attesa

**Utenti attivi:**
Ogni riga utente mostra:
- Nome utente con badge di autenticazione (Locale o Plex)
- Ruolo (Utente o Admin) con attivazione/disattivazione in linea
- Attivazione **Approvazione automatica** — Quando attivata, le richieste di questo utente vengono approvate automaticamente
- Collegamento alla pagina dei dettagli dell'utente

**Crea utente locale:** Apre un modale per creare direttamente un nuovo utente locale (nome utente + password).

**Importa utenti Plex:** Se Plex è connesso, importa gli utenti del server Plex come utenti Movviz.

### Dettaglio Utente (/users/:id)

Cliccando un utente si mostra la sua pagina dei dettagli con tre schede:

**Generale:**
- **Scopri per continente** — Imposta quali continenti appaiono nella pagina Scopri dell'utente
- **Limiti di richiesta** — Limiti per utente per richieste di film e serie (con casella Illimitato)
- **Approvazione automatica** — Attivazione per l'approvazione automatica delle richieste
- **Sincronizzazione watchlist Plex** — Se l'utente ha un token Plex, può richiedere automaticamente le aggiunte alla watchlist Plex

**Permessi:**
- **Ruolo** — Utente o Admin (un admin non può declassarsi da solo)
- **Può gestire le richieste** — Delega la gestione delle richieste a utenti non admin

**Password:** Per gli utenti non Plex, gli admin possono reimpostare la password.

---

## 13. Profilo (/profile)

La pagina del profilo di ogni utente per le impostazioni personali.

### Password

Cambia la tua password inserendo la password corrente e una nuova (minimo 8 caratteri).

### Token API

Crea e gestisci token di accesso API personali per l'accesso programmatico.

- **Crea token** — Dagli un nome, poi copia il token generato (mostrato una volta)
- **Elenco token** — Mostra tutti i token con data di creazione e ultimo utilizzo
- **Revoca** — Elimina un token per invalidarlo

### Scopri per Continente

Seleziona quali continenti vuoi prioritizzare nella scoperta. Questo filtra i film e le serie mostrati sulla tua pagina Scopri in base ai paesi di produzione.

### Watchlist

La tua watchlist personale — titoli che hai segnalato per dopo.

Ogni elemento della watchlist mostra il poster, la valutazione e le azioni al passaggio del mouse:
- **Aggiungi alla libreria** — Aggiunge il titolo alla libreria e lo rimuove dalla watchlist
- **Rimuovi** — Rimuove dalla watchlist senza aggiungere

Puoi aggiungere titoli alla tua watchlist da qualsiasi pagina dei dettagli del titolo usando il pulsante segnalibro.

---

## 14. Impostazioni (/settings)

Le Impostazioni sono organizzate in 5 gruppi con una barra laterale comprimibile su desktop e una navigazione a fondo pagina su mobile. Tutte le schede delle Impostazioni (tranne Info) sono accessibili solo agli admin.

### 14.1. Download

**Client:** Due istanze integrate del motore BitTorrent — una per i film, una per le serie. Ogni istanza mostra:
- Indicatore di stato (online/offline)
- Protocollo (Torrent)
- Associazione categoria (Film/Serie)
- Riepilogo della configurazione corrente

Durante la modifica, puoi configurare:
- **Cartella libreria** — Dove sono memorizzati i file multimediali per Plex
- **Cartella di download** — Dove vanno i download incompleti
- **Cartella dei completati** — Dove vengono spostati i download completati
- **Download attivi massimi** — Limite di download concorrenti
- **Rapporto di seed** — Rapporto target prima di interrompere il seed
- **Peer massimi** — Numero massimo di connessioni peer per torrent
- **Slot di upload** — Slot di upload per torrent
- **Limite di velocità download** — Limite globale di download (KB/s; "Illimitato" se vuoto)
- **Limite di velocità upload** — Limite globale di upload
- **Avvio automatico** — Se l'istanza si avvia con il motore

**Editor di cartelle:** Se il motore è in esecuzione sulla stessa macchina, un browser di cartelle integrato ti permette di navigare e selezionare i percorsi visivamente. Per configurazioni remote/Docker, inserisci il percorso manualmente.

**Pulsante Riavvia motore** — Se il motore è offline, appare un pulsante di riavvio.

**Indexer:** Configura gli indexer Torznab/Newznab per la ricerca delle release.

Ogni indexer mostra:
- Protocollo (Torrent/Usenet) con icona
- Nome e URL base
- Stato connessione (OK/Fail/Non testato) con dettaglio dell'ultimo test
- Indicatori di autenticazione (chiave API o credenziali)
- Attivazione/disattivazione
- Impostazione priorità

**Impostazioni per indexer:**
- **Categorie** — Quali categorie di contenuti cercare (pannello espandibile)
- **Filtri** — Dimensione min/max (MB) e età massima (giorni)
- **Risolutore Cloudflare** — Attiva il risolutore Cloudflare per indexer protetti da Cloudflare
- **Pulsante Test** — Testa la connessione in tempo reale
- **Elimina** — Rimuovi l'indexer

**Aggiungi indexer:** Flusso in due passaggi:
1. Scegli da un catalogo di indexer predefiniti (Torznab/Newznab)
2. Inserisci URL, autenticazione (chiave API o nome utente/password) e categorie

**URL risolutore:** Configura l'URL di FlareSolverr (predefinito: `http://localhost:9830`) usato dal risolutore Cloudflare.

**Qualità:** Regole di punteggio e filtro per le release, che combinano profili di release e formati personalizzati in un'unica scheda.

- **Parole bloccate** — Un elenco di parole che, se presenti nel titolo di una release, la fanno rifiutare. Aggiungi parole singolarmente; rimuovi con il pulsante X.
- **Dimensioni massime** — Dimensioni massime consentite per film (GB), episodi (GB) e stagioni (GB). Le release che le superano vengono rifiutate.
- **Punteggi codec** — Punteggi per i codec video: x264, x265 e AV1. Punteggi più alti rendono le release con quel codec più probabili da scegliere.
- **Formati personalizzati** — Regole di punteggio basate su regex applicate ai titoli delle release. Ogni formato ha un nome, un punteggio (positivo o negativo) e termini regex. Creane per prioritizzare o deprioritizzare pattern come "HDR", "Dolby Vision", "Remux", ecc.

### 14.2. Libreria

**Metadati:** Configurazione delle fonti dati esterne.

- **TMDb** — La chiave API di The Movie Database. Puoi usare la chiave predefinita integrata o fornire la tua. Testa la chiave per verificare che funzioni. Opzione per ripristinare la chiave predefinita disponibile.
- **TVDB** — La chiave API di TheTVDB per metadati supplementari. Include un'interruttore per usare TVDB specificamente per i titoli **anime**.
- **OMDb** — La chiave API di The Open Movie Database per punteggi Rotten Tomatoes e valutazioni Metacritic. Testa per verificare.
- **Layout Scopri** — Scegli tra il layout standard **Movviz** (caroselli di poster + classifiche) o il layout **Allociné**, che modifica lo stile della pagina Scopri.

**Plex:** Integrazione con Plex Media Server.

- **Connessione:**
  - **Hostname** — Nome host o IP del server Plex
  - **Porta** — Predefinita 32400
  - **SSL** — Attiva per usare HTTPS
  - **Collega/Riconnetti** — Autenticati con il tuo account Plex tramite popup del browser
  - **Test** — Verifica la connettività
- **Sincronizzazione libreria:**
  - Attiva per abilitare la sincronizzazione automatica delle librerie Plex in Movviz
  - **Sincronizza ora** — Attiva una sincronizzazione immediata
  - **Nuova scansione completa** — Forza una ri-scansione completa invece che incrementale
  - I risultati mostrano quanti film/serie sono stati aggiunti e confrontati
- **Sincronizzazione watchlist:**
  - Attiva per abilitare la sincronizzazione globale della watchlist Plex
  - Quando attivata, gli utenti che accedono con Plex possono vedere la loro watchlist Plex trasformata automaticamente in richieste
- **Profili Plex (Mappatura utenti):**
   - Mappa ogni utente Movviz a un Plex Managed User (profilo) specifico in modo che lo stato di visione rifletta la cronologia di quel profilo

**Denominazione:** Modelli per la denominazione di file e cartelle con inserimento interattivo di token.

Modelli per:
- **Cartella film** — es. `{title} ({year})`
- **File film** — es. `{title} ({year}) [{quality}]`
- **Cartella serie** — es. `{title} ({year})`
- **Cartella stagione** — es. `Stagione {season:00}`
- **File episodio** — es. `{series} - S{season:00}E{episode:00} - {title}`

**Token interattivi:** Clicca su un campo, poi clicca su un pulsante token per inserirlo alla posizione del cursore. Token disponibili: `{title}`, `{year}`, `{quality}`, `{season}`, `{episode}`, `{series}` e altri.

**Punti o spazi:** Scegli se i separatori usano punti o spazi.

**Anteprima live:** Mentre modifichi i modelli, un'anteprima mostra come appariranno i percorsi dei file risultanti per un film e un episodio di esempio.

**Importazioni:** Watchlist esterne che possono essere sincronizzate e aggiunte automaticamente alla libreria (nella scheda "Importazioni").

Fonti supportate:
- **Trakt** — Liste utente Trakt
- **IMDb** — Liste IMDb
- **Letterboxd** — Watchlist Letterboxd

Per ogni lista configura:
- **Nome** — Un'etichetta descrittiva
- **Tipo** — Trakt, IMDb o Letterboxd
- **URL** — L'URL della lista
- **Approvazione automatica** — Se abilitato, gli elementi di questa lista vengono approvati automaticamente
- **Pulsante Sincronizza** — Avvia manualmente una sincronizzazione

**Importazione Seerr:** Importa richieste da un'istanza Overseerr esistente.

- **URL** — L'URL del tuo server Seerr
- **Chiave API** — Chiave API per l'autenticazione
- **Test** — Verifica la connessione
- **Importa ora** — Avvia il processo di importazione

**Blocchi:** Titoli che non dovrebbero mai essere aggiunti alla libreria.

- **Aggiungi titolo bloccato** — Cerca un titolo su TMDb, selezionalo, aggiungi opzionalmente un motivo e conferma
- **Blocchi** — Mostra tutti i titoli bloccati con tipo, titolo, anno, motivo, chi lo ha bloccato e quando
- **Sblocca** — Rimuovi un titolo dai blocchi

### 14.3. Disco

**Indicizzazione:** Scansiona le cartelle principali della libreria per file orfani — file multimediali sul disco che non sono tracciati nella libreria Movviz. Una singola scheda con un selettore Film/Serie.

- Seleziona la cartella principale da scansionare
- Le corrispondenze vengono presentate con una ricerca TMDb integrata per l'abbinamento manuale
- Importazione con un clic per aggiungere i file abbinati alla libreria

**Rinomina:** Rinomina cartelle e file secondo i tuoi modelli di nomenclatura.

Flusso:
1. **Analizza** — Scansiona la tua libreria e genera un elenco di candidati alla rinomina con percorsi attuali vs. previsti
2. **Seleziona** — Scegli quali elementi rinominare (Tutti, Solo film, Solo serie o selezione individuale)
3. **Anteprima** — Rivedi le modifiche
4. **Esegui** — Applica le rinomine con progresso in tempo reale e log

Impostazioni:
- **Lingua** — Scegli la lingua TMDb per i titoli tradotti (influisce sui nomi di cartelle/file)
- **"Elimina cartelle vuote"** — Dopo la rinomina, rimuovi automaticamente le directory ora vuote
- **Progresso + log in tempo reale** — Tieni traccia dell'operazione in tempo reale

**Manutenzione:** Raggruppa le operazioni di manutenzione del disco in una singola scheda.

**Ripara percorsi:** Rileva le voci della libreria i cui file sono stati spostati o mancano.

1. **Analizza** — Confronta i record della libreria con il filesystem effettivo
2. I risultati sono categorizzati:
   - **Certe** — Una corrispondenza univoca (autoselezionata)
   - **Ambigue** — Possibili corrispondenze multiple (richiede scelta umana)
   - **Conflitto** — Un file che corrisponde a più voci della libreria
3. **Browser file** — Per la correzione manuale, apri un browser file per navigare e selezionare il percorso corretto
4. **Applica** — Ricollega le voci selezionate

**Cartelle vuote:** Scansiona le cartelle principali configurate per directory vuote.

- Scansiona ricorsivamente tutte le cartelle principali della libreria configurate
- Ignora i file di sistema comuni (`.DS_Store`, `Thumbs.db`, `Desktop.ini`, ecc.)
- **Elimina** — Rimuovi le directory vuote selezionate
- **Pulizia ricorsiva dei genitori** — Dopo l'eliminazione, le directory genitore ora vuote vengono anch'esse rimosse ricorsivamente

**Cestino:** Rete di sicurezza per i contenuti eliminati.

Quando un film o una serie viene rimosso da Movviz con i suoi file, i file possono essere spostati in una cartella cestino invece di essere eliminati definitivamente.

- **Cartella film** — Percorso dove vanno i file dei film eliminati
- **Cartella serie** — Percorso dove vanno i file delle serie eliminate
- **Conservazione** — Giorni prima che i file nel cestino vengano eliminati definitivamente (configurabile)
- **Conteggio elementi** — Mostra quanti elementi sono attualmente nel cestino

### 14.4. Notifiche

Configura le notifiche push per gli eventi multimediali (recuperato, importato, fallito, ecc.). Questa singola scheda raggruppa trasporti, webhook e opzioni di attività.

**Trasporti:**
- **Discord** — URL Webhook
- **Telegram** — Token del bot + Chat ID
- **Gotify** — URL del server + App token
- **Slack** — URL Webhook
- **Pushbullet** — Token API

Ogni trasporto:
- Attivazione/disattivazione
- Campi di configurazione (le password sono mascherate)
- **Pulsante Test** — Invia una notifica di prova per verificare la configurazione

**Webhook:** Invia notifiche HTTP POST a un URL personalizzato.

- **Attiva** interruttore
- **URL** — L'endpoint del webhook
- **Pulsante Test** — Invia un payload di prova

**Aggiornamenti qualità:** Attiva/disattiva la ricerca e il download automatici di versioni di qualità superiore dei contenuti già disponibili.

### 14.5. Sistema

**Diagnostica:** Panoramica dello stato del sistema in tempo reale.

- **Motore** — Motore BitTorrent online/offline
- **TMDb** — Connettività API TMDb
- **Indexer** — Stato connessione per indexer
- **Processi:**
  - **Web** — Processo interfaccia web: % CPU, RAM, uptime
  - **Motore** — Processo motore: % CPU, RAM, uptime
- **Spazio su disco** — Spazio totale, libero e utilizzato sui percorsi configurati
- **Statistiche libreria** — Conteggio totale film, serie, episodi
- **Prestazioni** — Conteggi e latenze delle chiamate API
- **Log del motore** — Live tail dell'output del motore
- **Log del risolutore** — Live tail dell'output del risolutore Cloudflare

**Attività pianificate:** Elenco di tutte le attività ricorrenti in background.

Ogni attività mostra:
- **Nome** — Cosa fa l'attività
- **Intervallo** — Ogni quanto viene eseguita
- **Ultima esecuzione** — Quando è stata eseguita l'ultima volta
- **Prossima esecuzione** — Quando verrà eseguita la prossima volta
- **Pulsante "Esegui ora"** — Attiva manualmente l'attività

**Coda delle attività:** Attività in background attive e recenti.

- Mostra i lavori attualmente in esecuzione con stato e progresso
- Cronologia dei lavori completati di recente
- **Priorità** — Cursore (0–100) per tipo di lavoro per controllare la priorità di esecuzione
- I lavori con priorità più alta vengono eseguiti per primi quando più lavori sono in coda

**Cache:** Statistiche e gestione per cache.

Ogni voce cache mostra:
- **Nome** — Identificatore cache
- **Hit** — Ricerche cache riuscite
- **Miss** — Ricerche cache non riuscite
- **Chiavi** — Numero di voci in cache
- **Dimensione** — Utilizzo memoria stimato

Azioni:
- **Riempi** — Pre-carica una cache
- **Svuota** — Invalida tutte le voci in una cache

**Backup:** Esporta e importa la configurazione JSON.

- **Esporta** — Scarica tutte le impostazioni, i metadati della libreria e la configurazione come file JSON
- **Importa** — Carica un file JSON esportato in precedenza per ripristinare la configurazione

**Informazioni:** Informazioni sull'applicazione.

- **Versione** — Numero di versione corrente di Movviz
- **Licenza** — GNU General Public License v3.0
- **Supporta il progetto** — Link per supportare lo sviluppo
- **Aggiornamenti:**
  - **Pulsante Verifica aggiornamenti**
  - Su **Windows**: Pulsante di installazione con un clic che scarica e applica l'aggiornamento automaticamente
  - Su **Docker/altre piattaforme**: Mostra un link alla pagina delle release GitHub con le istruzioni

**Zona Pericolo:** Azioni irreversibili in fondo al gruppo, visivamente separate.

Ogni azione richiede di digitare una parola di conferma prima di poter essere eseguita:
- **Cancella tutti i film** — Rimuove tutti i film dalla libreria
- **Cancella tutte le serie** — Rimuove tutte le serie dalla libreria
- **Cancella cronologia attività** — Elimina tutta la cronologia delle attività
- **Cancella notifiche** — Elimina tutte le configurazioni delle notifiche
- **Cancella richieste** — Elimina tutte le richieste degli utenti
- **Cancella problemi segnalati** — Rimuove tutti i problemi segnalati
- **Reimposta stato sincronizzazione Plex** — Reimposta il tracciamento della sincronizzazione Plex

---

## 15. Dettaglio Titolo (/title/:type/:id)

Una pagina di dettaglio completa per film e serie, che mostra tutto su un titolo.

### Sezioni di contenuto

- **Sfondo** — Immagine hero a larghezza intera in alto
- **Poster** — Poster verticale con gradiente sovrapposto
- **Titolo** — Nome del film o della serie
- **Valutazioni** — Punteggi TMDb, IMDb, Rotten Tomatoes (da OMDb) e Metacritic
- **Anno, Durata, Stagioni** (per le serie), **Generi**
- **Tagline** — La tagline del film o della serie (se disponibile)
- **Trama** — Riepilogo completo / riassunto della trama
- **Budget / Incassi** — Per i film, dati finanziari da TMDb

### Pulsanti di azione

- **Aggiungi alla libreria** — Se non già in libreria, aggiunge il titolo e attiva la ricerca
- **Guarda su Plex** — Se disponibile in libreria e Plex è connesso, apre direttamente il lettore web Plex
- **Cerca** — Se l'elemento esiste in libreria, attiva una nuova ricerca sull'indexer (usato anche per aggiornamenti di qualità)
- **Scelta manuale** — Apre la pagina di ricerca indexer pre-compilata per la selezione manuale della release
- **Segnalibro / Rimuovi segnalibro** — Aggiungi o rimuovi dalla tua watchlist personale
- **Trailer** — Apre un modale con il trailer di YouTube
- **Saga** — Per i film, collega alla pagina della collezione/saga TMDb

### Badge stato libreria

Mostra lo stato corrente del titolo nella tua libreria: Disponibile, In download, Ricerca in corso o Mancante.

### Cast e Troupe

- **Cast** — Riga scorrevole orizzontale di ritratti degli attori con nomi dei personaggi; clicca per visualizzare i dettagli della persona
- **Troupe** — Griglia dei membri della troupe per mansione (Regista, Sceneggiatore, ecc.) con espansione "Mostra di più"

### Stagioni (Serie)

Per le serie, un pannello delle stagioni mostra ogni stagione con i suoi episodi. Ogni episodio mostra:
- Numero episodio e titolo
- Data di messa in onda
- Attivazione monitoraggio
- Badge di stato
- Pulsante di ricerca per stagione

### Parole chiave

Tag/parole chiave da TMDb visualizzate come pillole.

### Consigliati

Titoli simili da TMDb mostrati come una griglia di poster.

### Informazioni barra laterale

- Titolo originale
- Stato (Rilasciato, Conclusa, Serie in corso, ecc.)
- Data di uscita / Prima messa in onda
- Budget e incassi (film)
- Lingua originale
- Paesi di origine
- Studi / Case di produzione
- **Piattaforme di streaming** — Loghi dei provider di streaming disponibili (es. Netflix, Disney+, ecc.)
- **Link esterni** — Icone Plex, TMDb, IMDb, Rotten Tomatoes, Letterboxd

### Modali di richiesta

Se il titolo non è ancora in libreria, cliccando "Aggiungi alla libreria" si apre un modale di richiesta specifico per il tipo (film o serie) con opzioni per l'utente.

### Modale Scelta manuale

Apre la pagina di ricerca indexer (`/search`) in un contesto modale/dialogo, pre-compilata con i metadati del titolo e il corretto riferimento di libreria per l'importazione automatica dopo il recupero.

---

## 16. Scorciatoie da Tastiera

- **Cmd+K / Ctrl+K** — Apre la palette di comandi universale per navigazione e ricerca rapida
- **Navigazione barra laterale** — Tutte le sezioni principali sono accessibili dalla barra laterale: Dashboard, Scopri, Libreria, Collezioni, Ricerca, Richieste, Attività, Cronologia, Problemi, Utenti (admin), Impostazioni (admin)

---

## 17. Risoluzione dei Problemi

### Motore offline

**Sintomi:** I download non partono, l'attività non mostra code, indicatore rosso "offline" in Impostazioni > Download > Client.

**Soluzioni:**
- Verifica che il processo del motore sia in esecuzione (`npm run engine` o il servizio Windows)
- Verifica che la porta 9820 non sia bloccata da un firewall
- In Impostazioni > Download > Client, clicca "Riavvia motore"
- Controlla i log del motore in Impostazioni > Sistema > Diagnostica > Log del motore
- Verifica che il file di stato del motore non sia danneggiato

### Errori indexer

**Sintomi:** I risultati di ricerca sono vuoti, o indexer specifici mostrano stato "fail".

**Soluzioni:**
- Controlla il risultato del test di ogni indexer in Impostazioni > Download > Indexer
- Verifica che le tue chiavi API siano ancora valide
- Per gli indexer protetti da Cloudflare, attiva il "Risolutore Cloudflare" e assicurati che FlareSolverr sia in esecuzione
- Controlla i filtri dimensione min/max e età massima — potrebbero essere troppo restrittivi
- Cerca i messaggi di errore per indexer nel banner di avviso della pagina di ricerca

### Percorsi interrotti (bind mount Docker)

**Sintomi:** I file esistono sul disco ma la libreria mostra stato "mancante". La scansione Ripara percorsi mostra candidati con percorsi errati.

**Soluzioni:**
- Esegui una scansione Ripara percorsi in Impostazioni > Disco > Manutenzione > Ripara percorsi
- Per i bind mount Docker, Movviz tenta l'auto-ricollegamento silenzioso — verifica che abbia funzionato
- Se l'auto-ricollegamento non ha funzionato, usa il browser di file manuale per correggere i percorsi
- Assicurati che i tuoi mount volume Docker siano coerenti tra i riavvii

### Sessioni scadute

**Sintomi:** Errori 401 sulle chiamate API, reindirizzamento al login inaspettato.

**Soluzioni:**
- Esci e riaccedi
- Se usi l'autenticazione Plex, riconnetti il tuo account Plex
- I cookie di sessione sono gestiti dal server — se il server si riavvia, le sessioni potrebbero essere invalidate
- Controlla che l'orologio di sistema sia accurato (la validazione del token di sessione è sensibile al tempo)
