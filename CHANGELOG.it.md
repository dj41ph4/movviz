# Changelog

Tutte le modifiche rilevanti a Movviz, raggruppate per tappa di sviluppo.

---

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
