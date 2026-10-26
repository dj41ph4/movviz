## v1.27.65 — 26. Oktober 2026

### Indexer

- Das Verhalten der Indexer und des Resolvers vor den letzten drei Versionen wurde wiederhergestellt.

## v1.27.61 — 27. Oktober 2026

### Startseite

- Die Genres im Startseiten-Spotlight (Animation, Action & Abenteuer…) haben denselben grauen Hintergrund wie die Gründe unter „Warum dieser Inhalt?“.

## v1.27.60 — 27. Oktober 2026

### Startseite

- „Demnächst“ zeigt keine Dokumentationen mehr: nur angekündigte Spielfilme.

## v1.27.59 — 27. Oktober 2026

### Android TV und Samsung

- „Schaust du noch?“ wie bei Netflix: Nach zwei automatisch nacheinander abgespielten Folgen ohne Tastendruck wartet die nächste Folge auf deine Antwort (Weiterschauen oder Beenden). Ohne Antwort läuft nichts und der Ruhemodus des Fernsehers greift wieder normal. Jeder Tastendruck setzt den Zähler zurück; solange du die Fernbedienung nutzt, ändert sich nichts.

## v1.27.58 — 27. Oktober 2026

### Android

- Android-Startseite: Die Plattform-Kacheln zeigen jetzt echte quadratische Symbole für jeden Dienst (Netflix, Disney+, Prime Video, Max, Apple TV+, YouTube, Crunchyroll, OCS), in die App eingebettet, statt der Initialen „YO“ und „OC“, wenn das entfernte Logo fehlte.

## v1.27.57 — 27. Oktober 2026

### Startseite

- Neue Reihe „Demnächst“ auf allen Startseiten (Web, Android TV, Android, Samsung): alle für die nächsten zwölf Monate angekündigten Filme (mit bekanntem Erscheinungsdatum und Poster), nach Erscheinungsdatum sortiert, mit denselben Karten wie alle anderen Reihen. Projekte, die mehr als ein Jahr entfernt und oft hypothetisch sind, fehlen bewusst.
- „Deine kommenden Veröffentlichungen“ zeigt weiterhin deine noch nicht erschienenen Anfragen, direkt danach und überall mit demselben Namen (Android TV nannte sie „Demnächst“). Samsung zeigt jetzt beide Reihen.

## v1.27.56 — 26. Oktober 2026

### Player

- Das Fortsetzen springt nicht mehr auf 0 zurück: Ein vor dem Filmende abgebrochener Stream (Server-Neustart, Verbindungsabbruch während einer langen Pause) wurde für das Filmende gehalten, der Film als gesehen markiert und seine Position gelöscht, in Movviz wie in Plex. Der Player startet den Stream jetzt an derselben Sekunde neu, und nur ein echtes Ende zählt.
- Kein „Dieses Video kann nicht im Browser abgespielt werden“ mehr beim Fortsetzen nach über 5 Minuten Wiedergabe oder Pause oder nach einem Server-Neustart: Die Wiedergabe läuft von selbst an genau der Stelle weiter.
- Den Player bei „Fortsetzen?“ oder nach einem Fehler zu schließen setzt die Fortsetzungsposition nicht mehr auf 0.
- Die tatsächlich angezeigte Qualität (4K, 1080p…) und der Dynamikumfang (HDR10, Dolby Vision, HLG) erscheinen über dem Fortschrittsbalken.

## v1.27.55 — 26. Oktober 2026

### Plattformen

- Plattformseiten (Android TV und Android): Neuheiten zeigen beliebte Titel der letzten sechs Monate aus Europa und den USA; koreanische und französische Inhalte haben eigene Reihen.
- Jede Kategorie filtert unbekannte Titel heraus, und für alle Plattformen kommen neue Reihen: Superhelden, Nach einer wahren Geschichte, Liebeskomödien, Unter 1 h 40, Große Filme, 2010er, 2000er und 90er, Große Klassiker.
- Disney+ erhält eigene Reihen: Marvel-Universum, Pixar, Star Wars, Disney-Klassiker und National Geographic.
- Reihen sind beim Öffnen doppelt so gefüllt, mit Server-Cache, damit alles sofort bleibt.
- Entdecken am Computer: Die Sortierung „Für dich“ einer Plattform zeigt zuerst deine Empfehlungen und danach den gesamten Katalog der Plattform nach deinem Geschmack, statt nach wenigen Titeln aufzuhören.

## v1.27.54 — 25. Oktober 2026

### Suche und Android TV

- Ein Release, dessen Titel dem gesuchten Titel Wörter hinzufügt, wird nicht mehr dafür gehalten: „The Odyssey“ (2026) hatte „L'Odyssée de Céleste“ (2026) heruntergeladen – gleiches Jahr, anderer Film. Der legitime Fall „französischer Titel + Originaltitel“ (L.Odyssee.The.Odyssey.2026) wird weiterhin erkannt.
- Die Titelseite auf Android TV zittert nicht mehr beim Wechsel von einer Schaltfläche zur nächsten.

## v1.27.53 — 25. Oktober 2026

### Plattformen auf Android TV und Android

- Das Öffnen einer Plattform (Netflix, Disney+, Prime Video…) zeigt jetzt eine echte Seite nach Kategorien: Trends, Neuheiten, Bestbewertet, dann Action und Abenteuer, Komödien, Anime, Science-Fiction, Krimi und Thriller, Dramen, Familie, Horror, Romantik, Dokumentationen und vieles mehr.
- Filme und Serien werden in jeder Reihe intelligent gemischt: Der relevanteste Titel kommt zuerst, nie mehr als zwei Filme oder zwei Serien hintereinander. Netflix zeigt endlich seine Serien, die bisher fehlten.
- Jede Reihe lädt beim Annähern, verlängert sich nach rechts endlos und endet mit „Alle ansehen“; auf dem Handy bleibt „Auswahl für dich“ oben.

## v1.27.52 — 25. Oktober 2026

### Plattformen auf Android TV

- Das Raster einer Plattform („Auf Disney Plus“…) springt und friert beim Herunterscrollen nicht mehr ein: Jede geladene Seite schickte den Fokus auf eine bereits überholte Karte zurück. Der Fokus bleibt jetzt auf der gewählten Karte, in derselben Spalte.
- Die Reihe Plattformen auf der Startseite steht jetzt direkt unter der ersten Reihe.
- Transparente Logos auf Android TV und Android: Plattformlogos (und PNG-Titellogos) erscheinen nicht mehr auf einem schwarzen Rechteck, und der Kopfbereich einer Plattform nutzt dasselbe Markenlogo wie die Kacheln.

## v1.27.51 — 25. Oktober 2026

### Profil auf Android TV und Android

- Das Profil stürzt beim Herunterscrollen zum Verlauf nicht mehr ab: Ein mehrfach gesehener Titel erschien doppelt, was die Reihe abstürzen ließ. Der Verlauf zeigt jeden Titel nur noch einmal (die neueste Wiedergabe).

## v1.27.50 — 25. Oktober 2026

### Profil auf Android TV, Android und Samsung

- Das Profil bleibt nicht mehr bei „Deine Aktivität wird geladen…“ hängen: Der Server schickte ein leeres Datum für Bewertungen, das die Android-Apps komplett ablehnten. Der Server schickt jetzt das echte Datum und die Apps tolerieren diesen Fall; bei einem Fehler ersetzt eine Schaltfläche „Erneut versuchen“ das endlose Laden.
- TV-Profil neu gestaltet: umrandeter Avatar, Name, Kontorolle und fünf echte Zähler (laufend, gesehene Filme, gesehene Serien, in meiner Liste, abgegebene Bewertungen), danach Weiterschauen, Meine Liste, Verlauf und Meine Bewertungen — gleiche Reihenfolge auf Mobil und Samsung, das ebenfalls Zähler und Bewertungen erhält.
- Das Fortsetzen einer Episode öffnet diese Episode, und der Verlauf zeigt den Episodentitel.

## v1.27.49 — 25. Oktober 2026

### Trailer

- Die YouTube-Ersatzsuche akzeptiert nur noch ein Video, dessen Titel den Filmtitel enthält: „The Good, the Bart, and the Loki“ übernimmt nicht mehr den Trailer der Loki-Serie. Bereits zwischengespeicherte Ergebnisse werden neu berechnet.

## v1.27.48 — 25. Oktober 2026

### Downloads

- Das erneute Herunterladen eines bereits importierten und danach geseedeten Releases schlägt nicht mehr sofort fehl: Der im Download-Ordner verbliebene Link auf die Bibliotheksdatei, der nach deren Löschung ins Leere zeigte, wird vor dem Schreiben entfernt.

## v1.27.47 — 25. Oktober 2026

### Downloads

- Das erneute Herunterladen eines bereits importierten Releases, dessen Datei gelöscht (oder durch eine andere Version ersetzt) wurde, startet den Download jetzt wirklich neu: Die Engine meldete „bereits importiert“, ohne etwas herunterzuladen, und der Titel blieb „wird heruntergeladen“, ohne in der Warteschlange zu erscheinen.

## v1.27.46 — 25. Oktober 2026

### Untertitel und Wiedergabe

- Im Desktop-Player gewählte Textuntertitel werden wieder angezeigt: Sie wurden extrahiert, blieben aber in einem ffmpeg-Puffer hängen, und der Player hat sie bei der neuen Engine nie abgefragt. Spurbezeichnungen zeigen keine redundanten Release-Titel mehr („FR Full : SRT“).
- Filme, deren gespeicherter Pfad der Plex-Sicht entspricht (z. B. /volume1/...), lassen sich wieder abspielen: Der Pfad wird in den von Movviz übersetzt, sonst läuft die Wiedergabe über die Plex-Quelle statt fehlzuschlagen.
- Pfadzuordnung Plex ↔ Movviz: Eine Zuordnung, die zu einem fehlenden Ordner führt, wird ignoriert und entfernt, sobald eine echte Datei ihr widerspricht; die manuelle Eingabe lehnt einen fehlenden Movviz-Ordner ab; und der automatische Vorschlag funktioniert, wenn beide Wurzeln nur einen Ordner teilen (/volume1/docker/plex/films ↔ /data/films).

## v1.27.45 — 25. Oktober 2026

### Wiedergabe über Karten

- Auf dem Dashboard, in der Bibliothek und in Entdecken zeigen Karten + außerhalb der Bibliothek, eine Uhr bei fehlender Datei und Wiedergabe, sobald ein lokaler Film verfügbar ist, ohne auf Plex zu warten.
- Die Wiedergabetaste im Startbanner und auf der Episodenseite funktioniert ebenfalls, sobald die lokale Datei existiert, ohne Plex-Link.
- Ein Klick auf das Bild öffnet die Titeldetails; nur die Wiedergabetaste startet den Player.

### Audio- und Untertitelspuren

- Die Player-Menüs (Web, Android TV, Android Mobil, Samsung) zeigen Sprache, Codec und Kanäle (z. B. „Französisch · E-AC-3 5.1“) sowie Spurtitel und den Hinweis Erzwungen bei Untertiteln.
- Die Spuren werden direkt aus der Datei gelesen: Ein Titel ohne Plex-Verknüpfung hat jetzt seine Audio- und Untertitelmenüs, und der Spurwechsel startet die lokale Engine neu.
- Automatische Untertitel (Profileinstellung, standardmäßig aus): Ist die abgespielte Audiospur nicht in der Profilsprache — der mit den Flaggen gewählten Oberflächensprache —, starten die Untertitel in dieser Sprache. Die Einstellung gehört zum Konto: Eine Änderung auf Android gilt auch auf Desktop, TV und Samsung.
- Die Standard-Audiosprache folgt der Profilsprache, solange sie auf Automatisch steht; unter Android wurde diese Einstellung bei der Wiedergabe nie angewendet, das ist behoben.

## v1.27.44 — 25. Oktober 2026

### Manuelle Portweiterleitung

- Auf allen Plattformen erstellen Engine und WebTorrent keine UPnP/NAT-PMP-Regeln mehr. TCP-Peerverbindungen und UDP-DHT nutzen den konfigurierten Port für die manuelle Weiterleitung.
- Bereits vorhandene Regeln oder Reservierungen auf dem Router oder NAS müssen dort entfernt werden; dieses Update ändert dessen Konfiguration nicht.

## v1.27.43 — 25. Oktober 2026

### Manuelle Docker-Portweiterleitung

- In Docker versuchen Movviz und WebTorrent keine UPnP/NAT-PMP-Portfreigabe mehr. Docker-Ports und Router-Weiterleitungen bleiben manuell; native Installationen behalten ihr bisheriges Verhalten.
- DHT über UDP nutzt nun den konfigurierten WebTorrent-Port, damit TCP- und UDP-Weiterleitungen zu den tatsächlich verwendeten Ports passen.

## v1.27.42 — 25. Oktober 2026

### Konfigurierbare WebTorrent-Ports

- In den Download-Client-Einstellungen lassen sich getrennte WebTorrent-Ports für Filme und Serien wählen. Die Werte werden geprüft, über Neustarts hinweg gespeichert und durch Neustart des Torrent-Clients angewendet, ohne die Warteschlange zu löschen.
- In Docker bleibt die Veröffentlichung der Host-Ports eine separate Einstellung; ein Hinweis steht direkt am Feld.

## v1.27.41 — 25. Oktober 2026

### Automatische Suche und neue Zugänge

- Die automatische Suche versucht zuerst den Originaltitel, dann den lokalisierten Titel und einen Alias, falls kein passender Treffer vorliegt. Indexer werden weiterhin nacheinander abgefragt und die Qualitätsregeln bleiben erhalten.
- Der Hero bestätigt das Hinzufügen erst nach einer gültigen Antwort und unterscheidet zwischen einer ausstehenden Anfrage und einem hinzugefügten Titel.
- Früher angefragte Filme erscheinen bei den neuesten Zugängen, sobald ihre Datei eintrifft. Bibliotheksreihen und die Sortierung verwenden ebenfalls das Verfügbarkeitsdatum.

## v1.27.40 — 25. Oktober 2026

### GPU/iGPU-Zugriff auf Docker-NAS-Systemen

- Der Compose-Starter erkennt `/dev/dri/renderD128` und gibt Movviz Zugriff auf das Gerät und seine Gruppe. Systeme ohne nutzbare GPU starten unverändert mit CPU-Transcoding.
- Das Docker-Gerätemapping wird beim Neuerstellen des Containers angewendet; die Anleitung erklärt Image-Updates und die manuelle Einrichtung im Container Manager.

## v1.27.39 — 24. Oktober 2026

### Schnellere Downloads-Ansicht

- Beim Öffnen der Downloads erscheint die Seitenstruktur sofort. Nur der gewählte Tab wird geladen; der Verlauf zeigt auf großen Bildschirmen weder den Ladezustand noch das Panel der Warteschlange.
- Weitere Einträge der Warteschlange werden beim Scrollen geladen. Warteschlange und WebTorrent-Panel stoppen ihre Abfragen im Hintergrund oder auf anderen Tabs und bleiben bei aktiven Downloads reaktionsschnell.

## v1.27.38 — 24. Oktober 2026

### Downloads, Bilder und Einstellungen

- Die Warteschlange zeigt laufende Downloads zuerst; abgeschlossene und seeding Torrents bleiben über ihre Filter erreichbar. Bei kurzem WebTorrent-Ausfall bleibt der letzte bekannte Stand sichtbar.
- Der Verlauf lädt nur den geöffneten Tab, zeigt 50 Ereignisse und lädt beim Scrollen weitere. Andere Tabs vermeiden Hintergrundanfragen.
- Bekannte Bilder und Logos kommen aus dem Browsercache, getrennt nach Sprache. Fehlende Bilder werden in kleinen Gruppen über den Servercache geladen; neue Inhalte und Fortsetzungen haben Vorrang.
- Die Animationseinstellung deaktiviert auch Hero-Ambilight und automatische Rotation. Die separate Hero-Videoeinstellung beendet den Player sofort; manuelle Wiedergabe bleibt unabhängig.
- Überwachte kommende Filme werden beim Hinzufügen, bei geplanten Wiederholungen und beim RSS-Abgleich automatisch gesucht. Ohne Release bleibt ihr Status „bevorstehend“, ohne falschen Fehler.

## v1.27.37 — 24. Oktober 2026

### Sofortige neue Inhalte und Wiedergabefortsetzung

- Neue Inhalte stammen ausschließlich aus der Movviz-Bibliothek und erscheinen für alle Profile in derselben Reihenfolge, ohne persönliche Filter oder die Jahresgrenze des Heros. Serien werden nach ihrer zuletzt verfügbaren Folge sortiert.
- Das Hinzufügen eines Films oder einer Serie aktualisiert die Startseite im Web, auf Android TV und auf Android-Geräten. Auch die ersten verfügbaren Folgen aktualisieren die neuen Inhalte.
- „Weitersehen“ zeigt Movviz-Positionen sofort. Die ersten fünf geprüften Plex-Fortsetzungen und weitere Gruppen treffen im Hintergrund ein und aktualisieren auch die Android-Apps.
- Wiedergabe und Fortschrittsmeldung warten nicht mehr auf Plex-Netzwerkanfragen. Importe starten weiterhin einen Plex-Scan und kurz danach den Metadatenabgleich im Hintergrund.

## v1.27.36 — 24. Oktober 2026

### Movviz AI Optimierung

- Movviz AI Optimierung.

## v1.27.35 — 24. Oktober 2026

### Folgen und Plex-Watchlist

- Administratoren können eine Folge auf ihrer Detailseite entfernen und optional auch die Datei löschen. Von mehreren Folgen verwendete Dateien sind geschützt. Entfernte Folgen werden nicht erneut automatisch gesucht oder durch die Plex-Synchronisierung verknüpft.
- „Meine Liste“ synchronisiert hinzugefügte und entfernte Filme und Serien in beide Richtungen mit der persönlichen Plex-Watchlist. Movviz sendet Änderungen nach der Antwort, damit die Seite schnell bleibt; die geplante Synchronisierung wiederholt fehlgeschlagene Aktionen. Konflikte verwenden Änderungszeiten; eine Plex-Entfernung ohne Zeitstempel wird bei ihrer Feststellung datiert.

## v1.27.34 — 24. Oktober 2026

### Reaktionsfähigkeit bei automatischen Aufgaben

- Die geplante Wiederherstellung nicht importierter Downloads läuft weiterhin alle 15 Minuten, jedoch allein unter den schweren Aufgaben, nach der Startphase und mit Vorrang für Oberfläche und Wiedergabe. Die manuelle Wiederherstellung startet weiterhin sofort.
- Der Seerr-Import entfernt Duplikate in der gesamten Bibliothek nur, wenn tatsächlich eine genehmigte Anfrage hinzugefügt wurde. Der tägliche Abgleich bleibt aktiv.
- Originaltitel in nichtlateinischer Schrift erzeugen keine falschen Namensgleichheiten mehr: Die automatische Suche akzeptiert passende Releases ohne Jahreszahl und schützt weiterhin echte Namensgleichheiten. Fehler nennen den Ablehnungsfilter.

## v1.27.33 — 24. Oktober 2026

### Plex Fortsetzen und Reaktionszeit

- Die vollständige Erfassung der Plex Wiedergabestatus läuft in einem eigenen Worker. Bestehende Status werden erst nach einem vollständigen, geprüften Snapshot ersetzt.
- Geplante Synchronisierungen von Plex Wiedergabestatus und Verlauf gelten als schwere Aufgaben: Sie überschneiden sich nicht mit anderen schweren Aufgaben und warten auf das Ende der Wiedergabe.
- Beim Öffnen eines Titels bleibt die schnelle Statusprüfung erhalten, ohne einen vollständigen Snapshot zu starten.
- On Deck zeigt lokale Fortsetzungen nach höchstens zwei Sekunden Wartezeit auf Plex. Die ersten fünf Plex Fortsetzungen erscheinen danach automatisch, die übrigen schrittweise mit weniger wiederholter Verarbeitung.

## v1.27.32 — 23. Oktober 2026

### Vorrang für Player und Oberfläche

- Schwere automatische Aufgaben warten vor dem Start, bis die Wiedergabe im Movviz-Player endet und eine kurze Zeit ohne Nutzerinteraktion vergangen ist. Sie bleiben in der Warteschlange und werden danach fortgesetzt.
- Eine schwere automatische Aufgabe läuft allein unter den automatischen Aufgaben; der automatische Benchmark überschneidet sich nicht mehr mit der Plex-Synchronisierung oder dem Seerr-Import. Auch die Benchmark-Schaltfläche nutzt diese Warteschlange und zeigt Wartezeiten an. Direkte Nutzeraktionen und sofortige Beschaffung behalten Vorrang.

## v1.27.31 — 23. Oktober 2026

### Doppelfolgen pro Staffel

- In „Titel bearbeiten“ hat jede Staffel neben ihrem Ordner einen Schalter für Doppelfolgen. Er ordnet jede Datei zwei Katalogfolgen zu und lässt sich pro Staffel deaktivieren.
- Neue Pakete werden nur automatisch erkannt, wenn Dateianzahl, Nummerierung und Laufzeiten das Doppelformat bestätigen. FINAL ist ein zusätzlicher Hinweis, allein aber nicht ausreichend.
- Movviz zeigt die abgedeckten Folgen als verfügbar, spielt ihre gemeinsame Datei ab, markiert beide nach dem Abspielen als gesehen und fährt mit der nächsten Datei fort. Dateien auf dem Datenträger werden nicht umbenannt.

## v1.27.30 — 23. Oktober 2026

### Dashboard-Hero

- Ambilight wartet, bis die YouTube-Videokopie ihre Position bestätigt, bevor das Licht angezeigt wird. Laufen die Videos auseinander, wird das Licht ausgeblendet und neu ausgerichtet.
- Der dunkle Schleier am oberen Rand des Hero wird entfernt, sodass die Farben von Video und Ambilight dort erhalten bleiben.

## v1.27.29 — 23. Oktober 2026

### Laden und Plex Weiterschauen

- Weiterschauen zeigt zuerst die fünf neuesten Plex-Fortsetzungen an und ergänzt die Liste auf verbundenen Geräten schrittweise im Hintergrund.
- RSS-Abgleich und automatische Downloads laufen weiter, aber diese Phase wartet nun unter den aufwendigen Aufgaben auf ihren Einsatz, um Serverblockaden zu begrenzen.
- Die Diagnose fasst aufeinanderfolgende ähnliche Blockaden zusammen und zeigt einen Mess-Stack nicht mehr als Fehler an.

## v1.27.28 — 23. Oktober 2026

### Leistung und Diagnose

- Bibliothekszugriffe, die bereits aus dem Cache bedient werden, erzeugen nicht mehr jeweils einen Aufrufstapel und zwei Zeitleistenereignisse. Dadurch entfällt Messaufwand auf einem sehr häufig verwendeten Pfad.
- Langsame Festplattenzugriffe bei der Prüfung von JSON-Dateien werden jetzt zusätzlich zu langsamen JSON-Decodierungen protokolliert. Allgemeine Hänger und Hintergrundaufgaben bleiben messbar.

## v1.27.27 — 23. Oktober 2026

### Kürzlich hinzugefügte Episoden

- Zur Bibliothek hinzugefügte Episoden bleiben unabhängig von der Downloadliste sichtbar. Beim Bereinigen wird die Bestätigung des Imports abgewartet, bevor die für die Dateizuordnung benötigten Informationen gelöscht werden.
- Neue Einträge werden beim Scrollen seitenweise geladen, ohne dauerhafte Begrenzung auf 150 Dateien. Eine Gruppe von Episoden derselben Serie belegt auf Desktop, Android TV und Android mobile nur eine Karte.
- Beim Bereinigen von Downloads werden Einträge angezeigt, die nicht entfernt werden konnten, statt die Liste künstlich zu leeren.

## v1.27.26 — 23. Oktober 2026

### Android TV: Beta-Oberfläche und Player

- Die Seitenleiste und die Texte der Beta-Oberfläche sind kleiner, bleiben aber etwas größer als im stabilen Modus.
- Der Wechsel zwischen den Schaltflächen im Hero-Bereich zentriert die Seite nicht mehr fortlaufend neu.
- Die kurz sichtbare weiße Umrandung wurde vom Ladebildschirm entfernt.
- Die Audio- und Untertiteloptionen des Players bleiben lesbar, wenn sie mit der Fernbedienung ausgewählt werden.

## v1.27.25 — 23. Oktober 2026

### Diagnose: Ursachen für Serverhänger erkennen

- In den Einstellungen wird jetzt jeder Serverhänger mit Dauer, Art (blockierte Berechnung oder Warten auf einen externen Dienst) und den genau zu diesem Zeitpunkt laufenden Vorgängen aufgelistet.
- Eine Zeitleiste der gemessenen Zeitfenster zeigt überlappende Hintergrundaufgaben wie Indexer-Scans, Plex-Synchronisierung, den Import von Anfragen und den Abgleich von Downloads.
- Bei Indexer-Scans wird zwischen Rechenzeit (Bibliotheken laden, Releases vergleichen) und Wartezeit (Suche und Download über Indexer) unterschieden.
- Jedes Zeitfenster speichert die Codestelle, an der es geöffnet wurde, sodass sich die Ursache einer Verzögerung direkt finden lässt.

## v1.27.22 — 22. Oktober 2026

### Akquisition: Homonyme Serien unterscheiden und bei Hinzufügen suchen

- Zwei Bibliotheksreihen mit demselben Namen, aber unterschiedlichen Jahren, wie Scrubs (2001) und Scrubs (2026), erfordern nun ein explizites Jahr, das zur richtigen Serie gehört, bevor ein automatischer Download erfolgt. Ambivalente Episoden, Staffelpakete und Gesamtwerke werden ausgeschlossen.
- Direkte Suchen nach homonymen Serien beinhalten deren Jahr und verwenden die TMDb-, IMDb- oder TVDB-IDs, wenn der Indektor diese unterstützt.
- Das genehmigte Hinzufügen eines Films oder einer Serie löst eine Suche in einem dedizierten Bereich aus, auch wenn Hintergrundaufgaben die normale Warteschlange belegen. Wird eine zulässige Veröffentlichung gefunden, wird sie zum Download gesendet, ohne auf eine geplante Aufgabe warten zu müssen. Akquisitionen bleiben sequenziell und Duplikate werden vermieden.
- Hinzufügungen über den KI-Assistenten verwenden denselben Pfad. Anfragen, die eine Genehmigung erfordern, behalten ihre vorherige Validierung bei.

## v1.27.21 — 22. Oktober 2026

### Desktop: Plex-Verbindung per QR-Code

- Der Button „Mit Plex anmelden“ zeigt einen QR-Code an, der mit einem Smartphone gescannt und ein kurzer Code verwendet werden kann, der auf plex.tv/link verfügbar ist.
- Der Desktop wartet auf die Bestätigung auf dem Smartphone und öffnet dann automatisch das angemeldete Profil, ohne zusätzlichen Klick.
- Die übliche Plex-Verbindung im Browser bleibt rechts neben dem QR-Code zugänglich. Ein abgelaufener Code kann erneuert werden, und das Schließen des Fensters stoppt das Warten.

## v1.27.20 — 22. Oktober 2026

### Windows: Startprüfung und Update-Diagnostik

- Die Installationsprüfung wartet nun, bis die Dienste Movviz und Movviz Update aktiv sind und der Server mit der erwarteten Version antwortet, anstatt bei einem vorübergehenden Startstatus fehlzuschlagen.
- Die Dienstprotokolle werden im vorgesehenen Ordner gespeichert. Die Windows-Diagnostik wird vor dem Senden zusammengefasst, um Fehler zu vermeiden, die durch auf mehreren Laufwerken verteilte Dateien entstehen.
- Der echte Update-Test kann von einem Branch aus gestartet werden: Er überprüft den Neustart von Movviz und die Aufrechterhaltung des Movviz Update-Prozesses während der Installation.

## v1.27.19 — 21. Oktober 2026

### Startseite: Meine Liste auf Desktop, Android TV und Android Mobile

- Die persönliche Liste erscheint standardmäßig im vierten Block vor „Zur Überprüfung“, mit den neuesten Hinzufügungen links.
- Sie übernimmt die vorhandenen Karten und aktualisiert sich, wenn die Liste auf einem anderen Gerät geändert wird. Die Sichtbarkeitspräferenzen bleiben erhalten.
- Die Tizen-Anwendung wird zu einem späteren Zeitpunkt aktualisiert.

### KI-Assistent: Titelidentifikation und Faktenprüfung

- Der Assistent sucht zuerst in der Bibliothek und erkennt denselben Titel mit oder ohne Leerzeichen, wie Vision Quest und VisionQuest. Korrekturen von Typ und Jahr werden beibehalten und die Links verwenden die verifizierte Identität.
- Eine Anfrage zur Web- oder Veröffentlichungsdatumsprüfung löst eine Suche aus, wenn sie aktiviert wird. Der Assistent unterscheidet zwischen einem angekündigten und einem bestätigten Veröffentlichungsdatum und gibt an, wann die Überprüfung nicht verfügbar ist.
- Eine einfache Überprüfung kann keinen automatischen Hinzufügung mehr auslösen, selbst wenn das Modell eine fehlerhafte Aktion ausführt.

## v1.27.18 — 21. Oktober 2026

### Desktop: Kürzlich hinzugefügte Episoden gruppiert wie auf Android TV

- Auf der Startseite und in der Serienbibliothek werden mehrere kürzlich hinzugefügte Episoden derselben Serie in einer einzigen Staffelkarte zusammengefasst.
- Das Abzeichen zeigt die Anzahl der ungesehenen Episoden dieser Staffel an und wird zu einem Häkchen, wenn alles gesehen wurde. Eine einzeln hinzugefügte Episode behält ihre Nummer und ihre direkte Wiedergabe bei.
- Die Gruppierung geht vor der Kartenbegrenzung: Eine in einem Block importierte Staffel verdeckt nicht mehr andere kürzlich angereicherte Serien.

## v1.27.17 — 20. Oktober 2026

### Oberfläche: Mobil- und Tablet-Theme, Banner und Navigation

- Das Beta-Theme erstreckt sich auf Telefone und Tablets mit konsistenten Farben und Oberflächen, einem besser lesbaren Banner und kompakten Aktionen. Die Zähler wurden von der Startseite entfernt.
- Auf dem Computer verlängert eine Umgebungsbeleuchtung die Farben des Banners und folgt der Wiedergabe seines Trailers.
- Die Sprachauswahl ist auf allen Bildschirmen im Benutzermenü zugänglich. Die Ränder der Detailseite, die Beschriftungen der Zähler und die Zugänglichkeit des Schließen-Buttons für Neuheiten wurden angepasst.

### Windows: Schutz des Update-Dienstes

- Der Installer deaktiviert das automatische Schließen von Anwendungen durch Windows, um den Movviz Update-Dienst während der Installation zu erhalten.
- PowerShell-Downloads verbergen ihren Fortschritt und die CI-Installationskontrolle verfügt über präzisere Zeitverzögerungen und Diagnosen.

## v1.27.16 — 20. Oktober 2026

### Serien: Neue Episoden werden endlich abgerufen

- Die Episodenliste einer Serie wurde erst zum Zeitpunkt des Hinzufügens erstellt: Episoden und Staffeln, die später angekündigt wurden (z. B. Staffel 4 von Link Click, die bei 1 von 12 Episoden blieb), sowie Titel und Daten von nachträglich veröffentlichten Episoden wurden nie abgerufen.
- Eine neue geplante Aufgabe, „Aktualisierung der Serienepisoden“, wird einmal täglich ausgeführt: Sie fügt fehlende Episoden und Staffeln hinzu (nur neue Staffeln für verfolgte Serien) und aktualisiert Titel, Ausstrahlungsdaten und Staffelnamen. Bereits erschienene Episoden sind durchsuchbar, die anderen warten auf ihr Ausstrahlungsdatum.
- Nichts wird jemals gelöscht: Dateien, Downloads und Plex-Links bleiben intakt, und Serien, deren Nummerierung von TMDb abweicht (bestimmte Anime), werden nicht geändert.

## v1.27.15 — 20. Oktober 2026

### Seitenleiste: Lesbarer Update-Button mit Barrierefreiheits-Zoom

- Mit vergrößtem Text (110 % oder 120 %) ragte der Button „Neues Update verfügbar“ über die Seitenleiste. Er zeigt nun eine kurze Beschriftung („Update v1.27.15“) und vergrößert sich bei Bedarf, anstatt überzulaufen; der vollständige Text bleibt beim Überfahren sichtbar.

## v1.27.14 — 20. Oktober 2026

### Trailer: Ein Ersatzvideo, wenn YouTube die Wiedergabe blockiert

- Einige offizielle Trailer können nicht außerhalb von YouTube abgespielt werden (wie bei Toei für Dragon Ball Super: Beerus). Wenn alle Videos eines Titels abgelehnt werden, sucht Movviz nun nach einem anderen Trailer und bevorzugt offizielle Kanäle und Anime-Verleiher (Netflix, Crunchyroll…).
- Abgelehnte Videos werden gespeichert und werden weder im Web noch in Android-Apps mehr vorgeschlagen.

## v1.27.13 — 20. Oktober 2026

### Startseite: Serien erscheinen im Banner

- Das Startseiten-Banner zeigte bisher nur Filme: Es hebt nun auch Serien hervor, abwechselnd mit Filmen. Eine neue Serie, die Movviz weiß, dass Sie mögen, erscheint daher bei ihrer Veröffentlichung.
- In der Bibliothek berücksichtigt das Banner nicht nur nie angesehene, kürzlich hinzugefügte oder Staffeln, bei denen gerade eine Episode eingetroffen ist, sondern auch die nächste Episode der verfolgten Serien.
- Dies gilt auch für Android TV- und Android-Mobilanwendungen, ohne dass diese aktualisiert werden müssen.

## v1.27.12 — 20. Oktober 2026

### Startseite: hellere und klarere Banner (Computer)

- Das Bannerbild ist deutlich heller, mit einem leichten Schatten unter dem Text, damit dieser lesbar bleibt.
- Technische Badges (4K, HDR, MULTI, TrueHD…) haben ihre eigene Zeile unter den Genres.
- „Informationen“ wird zu „Mehr Infos“, das Wiedergabe-Symbol ist ausgefüllt und der Text der Schaltflächen ist etwas größer.
- Die Gründe für den Vorschlag werden dauerhaft unten rechts unter den Scroll-Pfeilen angezeigt, anstelle der Schaltfläche „Warum dieser Inhalt ?“.
- Die Ton-Schaltfläche wechselt nach oben rechts und hat einen feineren Strich; sie ist wieder anklickbar.

### Oberfläche

- Das Beta-Theme wird das einzige Erscheinungsbild von Movviz: Die Wahl zwischen Stable und Beta wurde aus den Einstellungen entfernt.
- Schmalere Seitenleiste, verknüpfte Links sind um einen Grad angehoben und die Symbole sind identisch ausgerichtet, egal ob die Leiste ausgeklappt oder eingeklappt ist. Die Schaltfläche zum Ein- oder Ausklappen befindet sich nun unten, über dem Profil.

## v1.27.11 — 20. Oktober 2026

### Rechtschreibkorrektur bei Android TV, Android Mobile und Samsung

- Die Apps für Android TV, Android Mobile und Samsung zeigen nun „Ergebnisse für …“ an, wenn ein Tippfehler korrigiert wurde, wie im Web.
- Auf Android TV findet die Korrektur auch Titel, die bereits in der Bibliothek vorhanden sind.

### Web-Oberfläche

- Behebung von Anzeigefehlern beim Laden von Seiten: Die Startelemente der Oberfläche befinden sich nun an der richtigen Stelle der Seite.

## v1.27.10 — 20. Oktober 2026

### Suche: schneller, klarer, mit Rechtschreibkorrektur

- Tippfehler werden automatisch korrigiert: „hary potter“, „matirx“, „onepiece“ oder „le seigneur des anaux“ zeigen direkt die richtigen Titel mit der Angabe „Ergebnisse für …“ und einem Link zur Suche nach dem exakten Text.
- Während der Eingabe bleiben vorherige Ergebnisse angezeigt und verblassen, anstatt bei jedem Buchstaben zu verschwinden. Die Meldung „Keine Ergebnisse“ erscheint nicht mehr vor Ende der Suche.
- Eine Zeile „Weitere zu entdeckende Titel“ ergänzt den aktuell eingegebenen Titel, und ein Abschnitt „In ähnlicher Weise“ bereichert Suchen mit wenigen Ergebnissen.
- Wenn nichts zutrifft, schlägt die Seite vor, direkt in den Indexern zu suchen und zeigt trendige Filme an.
- Ein Klick in die leere Leiste zeigt die letzten Suchen und Trends an. Esc löscht die Suche und verlässt die Leiste, der Pfeil nach unten navigiert in den Ergebnissen.
- Eine Suche erstellt nur noch einen einzigen Eintrag im Browserverlauf, und das Löschen der Leiste führt sofort zum Katalog zurück.
- Während einer Suche werden nur die Suchfilter angezeigt; Personen ohne Foto werden nicht mehr vorgeschlagen.

### Erscheinungsbild: Beta-Theme als Standard

- Das Beta-Theme ist nun das Standard-Theme für alle Konten, ab der ersten Anzeige und ohne Umweg über das Stable-Theme. Das Stable-Theme bleibt in den Einstellungen verfügbar.

## v1.27.09 — 20. Oktober 2026

### Downloads: WebTorrent wird zum einzigen Engine

- Entfernung der aria2- und rTorrent-Engines, des Engine-Selektors in den Einstellungen und ihrer Abhängigkeiten in den Windows-, Linux- und Docker-Installern. WebTorrent bleibt die integrierte Engine für Filme und Serien.
- Die alten Engine-Auswahlen werden mit WebTorrent übernommen, ohne den Warteschlange, die Dateien oder die Historie zu löschen. Schlägt die Wiederherstellung eines Downloads fehl, bleibt die gespeicherte Warteschlange erhalten, um einen erneuten Versuch zu ermöglichen.

### Windows: Movviz-Updates unabhängig

- Der neue Dienst „Movviz Update“ steuert den offiziellen Download per SHA256, installiert das Update und bestätigt, dass die erwartete Version nach dem Neustart antwortet. Er bleibt aktiv, wenn der Installer Movviz stoppt, und behält die Protokolle bei einem Fehler bei.
- Die Deaktivierung der automatischen Einstellung erlaubt weiterhin nur Updates, die durch Klicken angefordert werden. Eine erstmalige manuelle Installation dieser Version ist erforderlich, um den Dienst zu erstellen, ohne Daten oder Einstellungen zu verlieren.
- Der Windows-Build-Test generiert nun sein eigenes Icon, wie der Produktionsinstaller, um auch auf einem leeren Runner zu funktionieren.

## v1.27.08 — 20. Oktober 2026

### Windows: Installation des Movviz Update Dienstes

- Der unabhängige Dienst „Movviz Update“ lädt und steuert den offiziellen Installer, startet Movviz neu und überprüft die laufende Version, wobei Protokolle gespeichert werden. Die Deaktivierung der automatischen Einstellung erlaubt weiterhin nur durch Klicken angeforderte Installationen.
- Korrektur der PowerShell-Testüberprüfung, die die Erstellung des vorherigen Windows-Installers verhindert hatte. Installieren Sie diese Version erstmalig manuell, um den neuen Dienst zu erstellen; Daten und Einstellungen bleiben erhalten.

## v1.27.07 — 20. Oktober 2026

### Windows: Ein unabhängiger Dienst für Updates

- Der neue Dienst „Movviz Update“ installiert Updates, ohne dass Movviz gestoppt werden muss, und überprüft anschließend, ob die neue Version nach dem Neustart antwortet. Der Download wird durch seinen SHA256-Hash gesteuert und die Installationsprotokolle werden zur Fehlerdiagnose aufbewahrt.
- Die automatische Update-Einstellung wird bei Öffnen der Oberfläche beachtet: Ist sie deaktiviert, wird nur eine durch Klicken angeforderte Installation gestartet. Die Oberfläche verfolgt die Installation nun bis zur Rückmeldung der erwarteten Version und zeigt Fehler an.
- Um diesen neuen Dienst auf einer bestehenden Installation zu erstellen, installieren Sie diese Version erstmalig manuell. Daten und Einstellungen bleiben erhalten.

## v1.27.06 — 20. Oktober 2026

### Android TV: Episodenkarte reagiert wieder auf die Fernbedienung

- Beim Öffnen einer Episodenkarte aus einer Staffel wurde kein Button ausgewählt und die Fernbedienung reagierte nicht mehr: Der Bildschirm blieb eingefroren. Der „Play“- oder „Zurück“-Button wird beim Öffnen wieder ausgewählt und alle Aktionen sind zugänglich.

### Startseite: Kein Flackern mehr im Hero

- Beim Wechsel des Highlights im Hero flackerte das Bild kurz schwarz, bevor das nächste angezeigt wurde. Das neue Bild wird nun direkt über das alte gelegt, sobald es geladen ist, sowohl auf Android TV als auch auf Samsung-Fernsehern.

## v1.27.05 — 19. Oktober 2026

### Neues „M-Band“-Logo

- Das neue Movviz-Logo, ein violettes M-Band, ist im Beta-Design im Web verfügbar: Vollständiges Logo in der Seitenleiste, bei der Verbindung, bei der Installation, im Player und in „Über“, und nur das M, wenn die Leiste eingeklappt ist, mit einem leichten Schimmer, der es gelegentlich durchzieht.
- Auf Android TV, Google TV und Android Mobile wird es zum App-Icon, zum Google TV Startbildschirm-Banner und zum im App angezeigten Logo. Auf Samsung-Fernsehern wird es ebenfalls zum App-Icon und zur Marke der App.

### Beta-Design: Ein dezentes und sofortiges Ladebildschirm

- Neues Ladebild auf Web und Android TV: Das M in der Mitte auf einer violetten Nacht, mit seinem Leuchten, MOVVIZ darunter und einem dünnen Balken, der den tatsächlichen Ladevorgang verfolgt. Es wird sofort beim Öffnen der Seite angezeigt, noch bevor die Anwendung geladen ist, und wiegt nur noch ein paar Zehntel Kilobyte.
- Das stabile Design behält seinen aktuellen Ladebildschirm bei.

### Android TV: ein unbewegliches Heldenbild

- Beim Navigieren zwischen den Heldenbild-Buttons auf der Startseite flackerte die gesamte Seite. Sie bleibt nun perfekt unbeweglich.

## v1.27.04 — 19. Oktober 2026

### Suche: Jede Serie behält ihre eigenen Downloads bei

- Ein Release, das exakt den Namen eines anderen Films oder einer anderen Serie aus der Bibliothek trägt, wird nicht mehr einem längeren Titel zugeordnet, der es enthält: Die gesamte „Dragon Ball Super“ wird nicht mehr als „Dragon Ball Super: Beerus“ angenommen, was eine andere Serie ist. Dies gilt für die automatische Suche, RSS-Feeds und Versionsersetzungen. Releases, die einfach einen Untertitel weglassen, werden weiterhin erkannt, und manuell zugefügte Alternativnamen auf einem Eintrag behalten weiterhin Vorrang.

## v1.27.03 — 19. Oktober 2026

### Das stabile Design übernimmt das Beta-Design von heute Morgen

- Das stabile Design nimmt das Beta-Design von dem 19. Oktober morgens exakt wieder auf, bevor das neue Logo und der neue Ladebildschirm kamen: Farben, Seitenleiste, Karten und Layout auf dem Computer, sowie der Kinoladebildschirm (Projektor, Halos, vollständiges Logo und Prozentsatz). Das Beta-Design entwickelt sich von seiner Seite weiter.

### Zuverlässige Dateianalyse nach einem großen Import

- Nach dem Import einer großen Anzahl von Episoden auf einmal (eine gesamte Staffel) konnte die Dateianalyse (Codecs, Audiospuren und Untertitel) bis zum nächsten Neustart unterbrochen werden und überlastete dabei den Server. Sie ist nun verfügbar, ohne Lastspitzen.

## v1.27.02 — 19. Oktober 2026

### Updates: Nie wieder eine ältere Version vorschlagen

- Nach einem Update konnte die Seitenleiste immer noch die „Installation“ der vorherigen Version vorschlagen, basierend auf einer vor dem Deployment gespeicherten Information. Ein Update wird nun nur noch vorgeschlagen – und unter Windows automatisch installiert –, wenn es tatsächlich neuer ist als die aktuelle Version.

## v1.27.1 — 19. Oktober 2026

### Bleach: Die gesamte heruntergeladene Staffel wird korrekt in der Bibliothek abgelegt

- Eine vollständig heruntergeladene und korrekt abgelegte gesamte Staffel von Bleach konnte nirgends in Movviz erscheinen: Es genügte, dass nur eine Episode nicht mehr als erwartet erkannt wurde, um die gesamte Gruppe abzulehnen. Jede Datei wird nun individuell anhand des tatsächlichen Speicherorts (Staffel, Ordner, Name) überprüft, und die betroffenen Episoden werden verfügbar, ohne dass etwas neu heruntergeladen werden muss.
- Keine vorhandene Datei wird durch diesen Nachlauf jemals ersetzt oder gelöscht, und eine von einem anderen Download erwartete Episode bleibt für diesen reserviert.

## v1.27.0 — 19. Oktober 2026

### Beta-Design: Ein flüssiger Ladebildschirm, der erst verschwindet, wenn alles bereit ist

- Die Animation des Ladebildschirms wird nun separat vom Rest der Seite berechnet: Sie bleibt perfekt flüssig (60 Bilder pro Sekunde), selbst während das Dashboard dahinter vorbereitet wird, wo es zuvor ruckelte. Sie ist auch leichter zu rendern, insbesondere auf großen Bildschirmen.
- Der Ladebildschirm erscheint schnell und verschwindet erst, wenn alles, was auf dem Bildschirm sichtbar ist, geladen ist – Daten, Ordner, Poster und Schriftarten: Nach seinem Verschwinden wird nichts mehr vor den Augen geladen.

### Schnelleres Dashboard

- Die Dashboard-Daten beginnen mit dem Download, sobald die Seite geöffnet wird, und nicht erst, wenn sie bereit ist.

### Technik

- Umstellung auf Next.js 16.3.

## v1.26.056 — 19. Oktober 2026

### Schnelleres Dashboard

- Die Dashboard-Daten (Bibliothek, Empfehlungszeilen, Startband, „Wiederholen“) werden nun vor dem Senden komprimiert: mehrere Megabyte weniger bei jedem Öffnen, was besonders aus der Ferne spürbar ist. Auch Android-Apps profitieren davon, ohne dass ein Update erforderlich ist.

### Beta-Design: Schnelleres und dezenteres Ladebildschirm

- Der Ladebildschirm erscheint schneller: Seine Bilder bleiben im Browser-Cache, die Szene wird angezeigt, sobald das Dekor bereit ist, und die Neonlichter leuchten danach sanft auf. Das Dekor des Ladebildschirms ist sofort sichtbar, noch bevor die Anwendung geladen ist.
- Sein Verschwinden ist ein einfacher Übergang, ohne Zoom oder abschließenden Blitz.

### Web Beta-Design: Seitenleiste

- Etwas schmalere Seitenleiste, zentriertes Logo; eingeklappt bleibt nur das Symbol „O“.

## v1.26.055 — 19. Oktober 2026

### Beta-Design: Rückkehr zu Violett, neuer Ladebildschirm und neue Logos

- Das Beta-Design kehrt auf sein Violett zurück (das Gold der vorherigen Version wird aufgegeben) auf Web und Android TV.
- Neuer violetter Ladebildschirm für Web und Android TV: ein großer, leuchtender 21:9-Flur (exakt auf 21:9 angepasst, seitlich beschnitten auf 16:9, der Logo-Text immer vollständig auf schmalen Bildschirmen). Das Licht läuft sanft entlang der echten Linien der Szene – Boden, Decke, Säulen, Dreiecksrand – mit einem Chromspiegel auf dem Logo und einem Balken, der den tatsächlichen Fortschritt verfolgt. Die Animationen bleiben dezent.
- Neue violett-chromierte Logos (Symbol „O“, vollständiges Format klein und groß), animiert ohne Halo um das „O“, überall dort, wo das Logo in der Beta erscheint, einschließlich der README.
- Android TV: Start immer noch sehr schnell (Bilder werden im Hintergrund dekodiert, eine leichte Version wird sofort angezeigt), mit „Animationen reduzieren“ bleibt die Szene statisch.

## v1.26.054 — 19. Oktober 2026

### Beta-Design: Dunkles Gold anstelle von Violett, auf Web und Android TV

- Die Violett- und Mauve-Töne des Beta-Designs werden zu einem dunklen Gold, in derselben Tönung wie das Logo: Hauptaktionsknöpfe, aktive Zustände, Fortschrittsbalken, Fokusrahmen, Filter und Leuchten. Die ursprüngliche Helligkeit und Transparenz werden beibehalten, damit alles lesbar bleibt. Das stabile Design ändert sich nicht.
- Auf Android TV nimmt die Navigationsleiste exakt denselben Hintergrund wie der Rest des Bildschirms ein: ein einziger Farbton.

### Android TV Beta: Neuer Ladebildschirm und neues Logo

- Neuer Kinoladebildschirm im Vollbildmodus (die Navigationsleiste bleibt darunter versteckt): eine direkt beleuchtete Wand von Bildschirmen, Reflexionen, die über orangefarbene Kanten laufen, Licht auf den Buchstaben des Logos, Glut und ein Balken, der den tatsächlichen Fortschritt mit der Meldung des aktuellen Schritts verfolgt. Ein Blitz markiert das Ende.
- Start mit höchster Geschwindigkeit: Die Bilder werden bereits beim Start der Anwendung im Hintergrund dekodiert, eine leichte Version derselben Szene wird sofort im Wartebild angezeigt, und es wird nichts zur Laufzeit berechnet (Masken und Halos sind einsatzbereit). Mit „Animationen reduzieren“ bleibt die Szene statisch.
- Das animierte vollständige kleine Logo ersetzt das Symbol und den Text überall (Profilauswahl, Anmeldung, Installation, Player, erweiterte Leiste). Eingeklappte Leiste: Es bleibt nur das animierte Symbol „O“, größer und zentriert.

### Web Beta-Design: Logo überall, aufgeräumte Seitenleiste

- Das animierte vollständige kleine Logo wird überall angezeigt (Anmeldung, Installation, Player, Über); in der Seitenleiste weicht es dem animierten Symbol „O“ Platz, wenn sie eingeklappt ist.
- In der Seitenleiste ist das Logo etwas nach links verschoben und die Trennlinie unter der Kopfzeile ist verschwunden.

## v1.26.053 — 19. Oktober 2026

### Beta-Design: Splash startet sofort, vollständiges Logo in der Seitenleiste

- Der Ladebildschirm erscheint sofort beim Öffnen der Seite, ohne auf das Laden der Anwendung zu warten: Eine verschwommene Atmosphäre der Szene wird sofort angezeigt, und dann erscheint die animierte Szene sanft darüber, sobald sie bereit ist. Das Hintergrundbild wird vorgeladen, und der anfängliche schwarze Übergang ist verschwunden.
- In der Seitenleiste des Beta-Designs ersetzt das animierte vollständige Logo in Kleinformat das „O“ und den Text, wenn die Leiste erweitert ist; wenn sie eingeklappt ist, bleibt nur das animierte „O“ sichtbar.
- Das MOVVIZ-Logo ist besser gesetzt: Der Abstand zwischen dem „O“ und dem ersten „V“ sowie zwischen dem letzten „V“ und dem „I“ ist nun gleichmäßig mit dem Rest der Buchstaben.

## v1.26.052 — 19. Oktober 2026

### Beta-Design: Neuer Ladebildschirm und neues Logo

- Beim Start zeigt das Beta-Design einen neuen, filmischen Ladebildschirm: eine Wand von Bildschirmen, Reflexionen, die über die orangefarbenen Kanten laufen, Licht, das über die Buchstaben des Logos streicht, Glut und ein Balken, der den tatsächlichen Ladevorgang verfolgt. Ein Lichtblitz markiert das Ende.
- Der Bildschirm passt sich allen Formaten an: 16:9, Ultra-Wide 21:9 (die Szene wird an jeder Seite verlängert, ohne zu dehnen) und Hochformat für Smartphones. Er wird in der tatsächlichen Bildschirmauflösung gerendert, daher scharf auf hochauflösenden Bildschirmen.
- Der Slogan „Ihre Universen an einem Ort“ wird in fünf Sprachen übersetzt. Mit der Option „Animationen reduzieren“ bleibt die Szene statisch.
- Neues Logo in drei Vektorfeldern: das Symbol „O“ allein, das vollständige Logo in Kleinformat und das vollständige Logo in Großformat, jeweils mit ihren animierten Versionen (Lichtstreifen über den Buchstaben, ohne Aura um das „O“). Das Beta-Design zeigt das neue animierte Symbol in der Seitenleiste, bei der Verbindung und in den Einstellungen.
- Das stabile Design ändert sich nicht. Das README GitHub-Logo wird durch die animierte Version ersetzt.

## v1.26.051 — 19. Oktober 2026

### Details: Status wird sofort angezeigt

- Beim Öffnen eines Details (Web, Android TV, Mobil, Samsung) wird der Status (in der Bibliothek, fehlende oder verfügbare Episoden) sofort angezeigt. Zuvor wartete die Seite darauf, dass Movviz Plex abfragte, was bei Bleach bis zu zehn Sekunden dauern konnte, währenddessen „Zur Bibliothek hinzufügen“ angezeigt wurde.
- Die Überprüfung mit Plex erfolgt nun im Hintergrund, höchstens einmal pro Minute und pro Serie, und das Detail aktualisiert sich automatisch, wenn es Neues findet. Der Plex-Pfad für Bleach wird zehn Minuten gespeichert, anstatt bei jedem Öffnen neu erstellt zu werden.
- Der Download-Zähler in der Seitenleiste speichert nicht mehr das Laden von Seiten: Er antwortet mit dem zuletzt bekannten Wert und aktualisiert sich im Hintergrund.

## v1.26.050 — 19. Oktober 2026

### Bleach: Japanische Logos der Originalserie im Auswähler

- Der Logo-Auswähler für Bleach bietet nun auch die japanischen Logos, darunter das klassische rote und blaue Logo der Originalserie „BLEACH ブリーチ“, das auf Französisch oder Englisch nicht existiert.
- Das automatisch ausgewählte Logo und andere Serien ändern sich nicht.

## v1.26.049 — 19. Oktober 2026

### Bleach: Manuelle Suche findet Episoden von Thousand-Year Blood War

- Die manuelle Auswahl einer Episode von Thousand-Year Blood War suchte nur nach nach Staffel benannten Veröffentlichungen („S04E01“) und fand nichts für Episoden, die in fortlaufender Nummerierung veröffentlicht wurden („S17E41“). Sie fragt nun beide Formate ab und zeigt alle Veröffentlichungen an, die zur Episode passen.
- Die manuelle Auswahl eines ganzen Arcs sucht auch nach Bündeln, die unter „Bleach S17“ veröffentlicht wurden.

## v1.26.048 — 19. Oktober 2026

### Android und Samsung: Thousand-Year Blood War in Downloads lesbar

- Die Download-Listen von Android TV, Android Mobile und Samsung zeigen „Bleach: Thousand-Year Blood War“ mit Staffel und Episode (z. B. S4 · E1) an, anstatt „Bleach S17E41“. Andere Serien ändern sich nicht.
- Die Verfolgung von Downloads in den Details wird nicht geändert: Die Episoden bleiben genau wie zuvor zugeordnet.

## v1.26.047 — 19. Oktober 2026

### Bleach: Die Bände werden in die richtigen Staffeln sortiert

- Ein Band (absolute Nummerierung von 1 bis 366, Dateien „Bleach - 150“, „S01E150“ oder Staffelordner) platziert nun jede Episode in ihrer Movviz-Staffel. Früher wurden nur die ersten Episoden sortiert und die anderen blieben nicht zugeordnet oder der Import schlug fehl.
- Die gesamte „Thousand-Year Blood War“ (Episoden 1 bis 50) wird automatisch auf die 4 Staffeln der Serie aufgeteilt, unabhängig von der Dateinummerierung.
- Ein Staffelpaket behält seine lokale Nummerierung bei, ohne Verwechslung mit der absoluten.

### Downloads: Thousand-Year Blood War als eigene Serie angezeigt

- Die Leiste, Verlauf und Suchen zeigen „Bleach: Thousand-Year Blood War“ mit Staffel und Episode (z. B. S4E1) an und nicht mehr „Bleach S17E41“.
- Ein Klick öffnet das Profil der richtigen Serie. Die Sortierung der Dateien hat sich nicht geändert.

### Startseite: Reduzierte hervorgehobene Leiste

- Die Seitenzahlen sind zentriert unten, der Pause-Button und der Text „Im Programm“ verschwinden.

### Titellogos: Sie erscheinen immer noch

- Wenn ein Logo nicht sofort verfügbar ist, versucht Movviz länger, mit abnehmenden Verzögerungen. Der Titelntext dient als Platzhalter und wird durch das Logo ersetzt, sobald es auf der Leiste, in den Profilen und in den Reihen erscheint.
- Eine Antwort ohne Logo wird vom Browser nicht mehr einen ganzen Tag lang gespeichert: Ein vorübergehendes Problem verdeckt das Logo nicht mehr bis zur nächsten Sitzung.

## v1.26.046 — 19. Oktober 2026

### Android TV und Mobil: Zuverlässiger Bleach-Reparaturstatus

- Die Bleach-Profile verwenden nun die angeforderte Teilprojektion und das vom Server bereitgestellte Reparatur-Flag. Eine kompakte Statusleiste kann nicht mehr vortäuschen, dass TYBW repariert werden muss, wenn seine Reihenfolge bereits korrekt ist.
- Auf Android TV ist die Reparaturaktion klickbar und für Administratoren reserviert; sie zeigt eine Vorschau und verlangt eine Bestätigung, bevor die Daten geändert werden. Sperren zeigen an, warum eine Reparatur unmöglich ist.
- Der Fokus beim Öffnen zielt auf eine tatsächliche Profilaktion; der dekorative Titel erhält kein Auswahl-Outline mehr.
- Tizen hat keine äquivalente Hinzufüge- oder Bleach-Reparaturaktion in seinem Profil.

## v1.26.045 — 19. Oktober 2026

### Android TV: Stabiler Fokus beim Öffnen von Staffeln

- Der Öffnungs-Guard hält den Fokus nicht mehr, wenn der Benutzer absichtlich zu einer Staffel navigiert. Eine laufende Weiterleitung wird sofort aufgehoben, sobald die Staffel ausgewählt ist.
- Tizen hat keine äquivalente verzögerte Weiterleitung; seine Staffelnavigation bleibt unverändert.

## v1.26.044 — 19. Oktober 2026

### Android TV: Zuverlässige Bleach-Bibliothekszuordnung

- Nach dem Hinzufügen liest Android TV den ausgewählten Bleach-Teil erneut und speichert die Ansichten Original und TYBW separat. Der Button „Zur Bibliothek hinzufügen“ erscheint während der Bereinigung nicht mehr.
- Staffel-Suchen geben immer noch ihren Ladeindikator frei, auch wenn die Anfrage fehlschlägt oder abgebrochen wird.
- Tizen entfernt den Hinzufügen-Button, sobald der Server die Hinzufügung bestätigt, um das gleiche Verhalten beizubehalten.

## v1.26.043 — 18. Oktober 2026

### Android TV: Navigation und Trennung von Bleach/TYBW

- Die TV-Reihen entfernen duplizierte Karten, bevor sie ihre Compose-Schlüssel erstellen, was den Absturz beim Durchsuchen von Vorschlägen verhindert.
- Die jüngsten Ergänzungen von Bleach Original und Thousand-Year Blood War bleiben getrennt. Die TYBW-Episoden verwenden die Kursnummern 1–4 auf dem Bildschirm, behalten aber für die Wiedergabe und Verfolgung die kanonische Staffel 17 bei.
- Das Laden von Staffeln ignoriert nun späte Antworten eines anderen Bleach-Teils, auch wenn beide Einträge dieselbe TMDb-ID teilen.

## v1.26.042 — 18. Oktober 2026

### Bleach-Nummerierung und TYBW-Suche

- Android TV übernimmt die gleichen acht Plattform-Logos wie das Desktop-Dashboard, geladen aus den SVG-Quellen des Projekts.
- Die original nummerierten ganzen Folgen S01E001–S01E366 werden auf die 16 Staffeln und deren Staffelordner neu verteilt, mit der erwarteten lokalen Umbenennung.
- TYBW behält seine interne Verfolgung S17 und seine Kurse 1–4 in separaten Ordnern bei. Die Suche nach einer Episode wie S17E41 akzeptiert Releases S17 oder S04E01 und schließt Pakete anderer Kurse aus.
- Android TV, Android mobile und Tizen übermitteln das ausgewählte Bleach-Teil beim Laden und Aktualisieren von Staffeln; S17 wird nicht mehr in den ursprünglichen Eintrag hochgezogen.

## v1.26.041 — 18. Oktober 2026

### Bleach: Downloads und vollständige Einträge

- Die bereits auf 16 Staffeln verteilten Bleach-Kataloge werden ohne Migration oder Änderung der Historie erkannt. Manuelle Downloads funktionieren auch für eine nicht verfolgte oder bereits verfügbare Staffel; TYBW-Pakete behalten ihre Nummerierung und ihren unabhängigen Ordner bei.
- Beide Einträge verfügen über die ganze Folgen-Suche, die persönliche Liste, die Bewertung, das Metadaten-Aktualisieren und die gezielte Löschung. Profilqualität, Alias und persönliche Auswahl bleiben unabhängig.
- Die 16 Staffeln von Bleach erhalten ein Cover und eine Zusammenfassung ihres Bogens. Bleach und Thousand-Year Blood War verfügen über unterschiedliche Logos, mit einer High-Definition-Version für TYBW.

## v1.26.040 — 18. Oktober 2026

### Bleach und TYBW auf allen Bildschirmen

- Android mobile, Android TV und Samsung Tizen zeigen die beiden Ergebnisse Bleach und Thousand-Year Blood War an. Die Navigation behält das ausgewählte Teil bei, und die Aktionen zum Abspielen, Verfolgen und Suchen verwenden die entsprechenden Episoden.
- Beide Einträge finden denselben Anbieter wie andere Titel, mit unabhängigen Hintergrund- und Logo-Auswahlen, die nach dem Neuladen und in den Listen beibehalten werden.
- Neue Downloads werden in zwei separaten Ordnern abgelegt, Bleach (2004) und Bleach - Thousand-Year Blood War (2022), mit ihrer IMDb-ID in einer `.plexmatch`-Datei. TYBW übernimmt die Nummerierung jedes Teils, während die Movviz-Verfolgungsdaten stabil bleiben. Alte Dateien werden nicht automatisch verschoben.
- Die Synchronisierung erkennt die unabhängigen Plex-Einträge von TYBW, auch wenn sie umbenannt wurden, und behält einen Plex-Link pro Teil bei. Die generische Umbenennung kann ihre Ordner nicht mehr zusammenführen. Ein zu altes Engine blockiert diese neuen Imports, anstatt die angeforderte Sortierung zu ignorieren.

## v1.26.039 — 18. Oktober 2026

### Suche von einer Reihe aus

- Nach „Alle anzeigen“ durchsucht eine Eingabe in die Suchleiste nun den gesamten Katalog, anstatt die alte Reihe weiter zu laden. Beide Einträge Bleach und Thousand-Year Blood War erscheinen auch in diesem Pfad, wie bei einer direkten Suche.

## v1.26.038 — 18. Oktober 2026

### Bleach und Thousand-Year Blood War getrennt

- Suche und Bibliothek zeigen zwei separate Einträge: Bleach (2004) mit seinen 16 Staffeln und 366 Episoden und Bleach: Thousand-Year Blood War (2022), organisiert nach Teilen. Die Anbieter-IDs und die Historie bleiben erhalten.
- Suchen, Anfragen, manuelle und automatische Downloads, Qualitätsersetzungen und Nachverfolgungen beschränken sich auf den ausgewählten Teil. TYBW S02E01 entspricht der ersten Episode von The Separation und kann nicht mehr mit Bleach original S02E01 verwechselt werden. Japanische Titel und Teilnamen werden ebenfalls erkannt.
- Die Engine unterscheidet zwischen Quelldateinummern, Movviz-Verfolgung und dem von Plex erwarteten Namensschema. Pakete sind auf die tatsächlich abgedeckten Episoden beschränkt; die Koordinaten werden bei einem Neustart und einem erneuten Importversuch beibehalten.
- Veraltete Kataloge mit gesichertem Reihenfolge werden mit vorheriger Sicherung neu organisiert, ohne Verschieben von Dateien oder Löschen der Verfolgung. Ambivalente Plex-Verläufe und Schnappschüsse blockieren riskante Korrekturen; kein tatsächlicher Inhalt wird aus einem einfachen Dateinamen abgeleitet.
- Das TYBW-Profil verwendet sein Synopsis, sein Plakat und seine erste Ausstrahlung. Das Hinzufügen eines fehlenden Teils vervollständigt denselben Katalog, auch wenn bereits eine leere Staffel existierte. Lange Staffelnamen bleiben auf Mobilgeräten lesbar.

### Startseite

- Entfernung des Eintrags „Inspiration finden“. Die Auswahl „Stabil/Beta“ und der direkte Start im gespeicherten Erscheinungsbild bleiben erhalten.

## v1.26.037 — 18. Oktober 2026

### Vereinfachte Startseite

- Entfernung der Texte „Kino, bei dir zu Hause“ und „Deine nächste große Geschichte“ von der Beta-Startseite.
- Entfernung der sichtbaren Bezeichnung „Plattformen“ und ihrer reservierten Spalte: Logos nehmen direkt die verfügbare Breite ein.

## v1.26.036 — 17. Oktober 2026

### Ein cineastischeres Beta

- Die Beta-Startseite übernimmt eine redaktionelle Komposition: große typografische Öffnung, gerahmter Held, hervorgehobene Bilder und lockerere Anordnung. Die Navigation wechselt zu einer Elfenbein-Auswahl auf Graphit, und die Suche erhält eine neue Oberfläche.
- Der Beta-Splash öffnet Projektionsvorhänge, enthüllt das Logo aus einer Lichtschlitze und entfaltet zwei Umlaufbahnen. Strahlen und Fortschrittsreflex begleiten das Laden; der Ausgang erfolgt durch Annäherung und Verblassen, ohne zusätzliche Wartezeit.
- Stabil behält sein Rendering, seinen alten Splash und seine Geometrie bei. Die Kontowahl bleibt ab dem ersten HTML angewendet; die Präferenzen zur Animationsreduzierung werden beibehalten.

## v1.26.035 — 17. Oktober 2026

### Stabile / Beta-Erscheinungsbild

- Einstellungen → Mein Erlebnis → Erscheinungsbild und Vorschauen bieten nun eine persönliche Auswahl zwischen Stabil oder Beta, die im Konto gespeichert und ohne Neuladen angewendet wird. Stabil behält die aktuelle Oberfläche bei; ein Speichervorgangfehler stellt den vorherigen Modus wieder her.
- Die gespeicherte Auswahl wird ab dem ersten Serverseitigerendering angewendet: Ein Beta-Konto startet direkt im Beta-Modus, ohne Zwischenanzeige von Stabil, selbst wenn die Präferenz-API mit der Antwort zu verzögern ist.
- Der Beta-Modus verfeinert die Desktop-Typografie, Abstände, Karten und Abzeichen. Hauptaktionen geben ein dezentes Feedback; die Animationsreduzierung bleibt respektiert. Das Titelprofil bleibt zwischen Seite und Panel geteilt.

### Eine Kinoeröffnung

- Der Beta-Splashscreen begrüßt den Start mit dem vergrößerten offiziellen Logo, violetten und cyanfarbenen Strahlen, einem Lichtkranz und einer neu gestalteten Fortschrittsanzeige. Er passt sich kleinen Bildschirmen an und behält eine ruhige Version mit reduzierten Bewegungen bei.
- Der alte Splash bleibt in Stabil verfügbar. Die neue Animation fügt beim Laden keine Wartezeit hinzu und wird bei jeder Navigation nicht erneut abgespielt.

### Frontend-Zuverlässigkeit

- Korrektur von sieben ESLint-Fehlern im Helden und im Titelprofil: Initialisierung der Diashow, mobile Erkennung, Orientierungstyping und Deklarationen für Such-/Lesefunktionen.
- Die Wiederaufnahme-Position wird dem aktuellen Medium zugeordnet, um die Anzeige des vorherigen Titels zu vermeiden; sie wird nach Schließen des Players erneut gelesen.

## v1.26.034 — 15. Oktober 2026

### Suche und Download nach einer Anfrage

- Das Hinzufügen eines Films oder einer Serie startet nun eine serverseitige Suchaufgabe, ohne die Telefonanfrage während der Indexierungsanrufe offen zu halten. Die Suche wird nach der Antwort fortgesetzt und bleibt in den Aufgaben sichtbar.
- Ein Download-Anforderung für einen bereits vorhandenen, aber unvollständigen Titel startet die fehlenden Elemente neu. Mehrfachklicks teilen sich dieselbe Aufgabe; verfügbare Medien, nicht verfolgte Inhalte, Hinzufügungen ohne Suche und auf Genehmigung wartende Anfragen bleiben geschützt.
- Die Genehmigung einer Anfrage verwendet ebenfalls diese Warteschlange; ein Hinzufügungsfehler markiert die Anfrage nicht mehr vorzeitig als genehmigt.

### Re-Seeding und Android TV

- Importierte Torrents können nach Überprüfung ihrer Fingerabdrücke mit bearbeiteten Dateien teilen, nur lesend. Die Pfade und Metadaten des Torrents bleiben nach einem Neustart erhalten; die Oberfläche unterscheidet zwischen Überprüfung, vollständigem Teilen, teilweisem Teilen und nicht verfügbaren Dateien.
- Die kontinuierliche Validierung führt die Tests des Download-Engines durch, einschließlich des Teilens nach dem Import.
- Android TV verwendet Media3 1.9.4.

## v1.26.033 — 14. Oktober 2026

### Android Mobil: Zoom ohne Beschneidung im alten Rahmen

- Der Videocontainer behält die gesamte verfügbare Fläche bei. Das Zoomen skaliert die native Fläche bei Beibehaltung des Seitenverhältnisses, anstatt das Bild in einem 16:9-Rahmen zu vergrößern, das trotz freiem Platz immer noch die Seiten abschneiden konnte.
- Das Framing wird aktualisiert, sobald der Detektor die integrierten schwarzen Balken bestätigt, ohne auf eine weitere Aktion vom Player zu warten. Der Detektor und seine Schutzfunktionen vor dunklen Szenen bleiben erhalten.
- Zwei separate Schaltflächen „Anpassen“ und „Vollbild“ sind in den Steuerelementen sichtbar; der aktive Modus wird hervorgehoben und die Auswahl bleibt pro Gerät und Profil gespeichert.

## v1.26.032 — 14. Oktober 2026

### Android Mobil: Anzeige angepasst für Smartphones und Tablets

- Der Player zeigt standardmäßig das gesamte Bild ohne Verzerrung an, indem er die Breite oder Höhe an die verfügbare Fläche anpasst. Ein Button ermöglicht das Umschalten zwischen „Anpassen“ und „Vollbild“; die Auswahl wird für jeden Server und jedes Profil auf dem Gerät gespeichert.
- Der Detektor integrierter schwarzer Balken bleibt erhalten. Im Modus „Anpassen“ berücksichtigt das Zoomen die Abmessungen des Players, um das gesamte nutzbare Bild sichtbar zu halten, auch auf Tablets; im Modus „Vollbild“ wird das Bild zugeschnitten, um den Bildschirm auszufüllen.
- Größen- und Modusänderungen des Players werden auch in der Pause berücksichtigt. Die Steuerelemente können in einem schmalen Fenster über mehrere Zeilen gehen.
- Die vertikalen Gesten für Helligkeit und Lautstärke wurden entfernt. Doppeltes Tippen zum Vor- oder Zurückblättern und Wischen auf der Zeitleiste bleiben erhalten.

## v1.26.031 — 13. Oktober 2026

### „Wiedergabe löschen“: Das Profil wird leer

- Der Button löscht nun auch die Liste, Notizen, Favoriten und das Gedächtnis des KI-Assistenten sowie das Gespräch mit ihm. Das Profil selbst (Name, Foto, Passwort, Einstellungen) bleibt unverändert.
- Auf Plex werden zusätzlich zu gesehenen und Wiederholungen die Notizen und die Watchlist des Profils gelöscht, immer nur mit dem Plex-Konto dieses Profils. Ein Profil, das ohne Plex-Konto verwaltet wird, behält seine Plex-Watchlist, und der Bildschirm zeigt dies an.
- Eine resynchronisierte alte Plex-Watchlist wird nicht in Movviz zurückkehren.
- Die Warntexte (Web, Android Mobil, Samsung) geben nun genau an, was verloren geht und was erhalten bleibt.

## v1.26.030 — 13. Oktober 2026

### Profil: Neuer Button „Wiedergabe löschen“

- Jedes Profil kann beim Ansehen von Grund auf neu beginnen: Gesehene Titel, laufende Wiederholungen und die Wiedergabehistorie werden gelöscht. Die Notizen, die Liste und die Favoriten des Profils bleiben erhalten.
- Zwei Warnungen vor der Aktion: eine erste Bestätigung, gefolgt von einem letzten Bildschirm, auf dem „LÖSCHEN“ erneut eingegeben werden muss (Web und Android Mobil) oder „Ich verstehe“ angekreuzt werden muss (Samsung).
- Nur das profil des angemeldeten Benutzers wird gelöscht, niemals das eines anderen, und jeder Benutzer kann dies für sein eigenes Profil tun.
- Wenn das Profil mit Plex verbunden ist, werden auch sein Ansehensstatus und seine Wiedergaben gelöscht, und zwar nur für das Plex-Konto dieses Profils: Die Ansichten anderer Plex-Konten sind davon nicht betroffen. Das Ergebnis auf Plex wird einmal abgeschlossen angezeigt, und wenn Plex nicht alles löschen konnte, wird dies klar angegeben.
- Frühere Ansichten werden nicht bei der nächsten Plex-Synchronisierung wiederhergestellt. Eine echte Wiedergabe nach dem Löschen wird normalerweise berücksichtigt.
- Verfügbar auf dem Web (Profilseite), der Android-Mobilanwendung (Profilmenü) und der Samsung-Anwendung (Profilseite).

## v1.26.029 — 13. Oktober 2026

### KI-Assistent: Aktualisierte Liste der Gemini-Modelle

- Google hat Gemini 3.5 Flash und Gemini 3.7 Flash am 8. Oktober entfernt. Gemini 3.6 Flash ersetzt 3.5 Flash in den empfohlenen Modellen, und 3.7 Flash fällt von der Liste.
- War der Assistent auf eines dieser beiden Modelle eingestellt, wechselt er automatisch zu seinem Ersatz (3.6 Flash oder 3.8 Flash), so wie es Google bereits tut.

## v1.26.028 — 12. Oktober 2026

### KI-Assistent: Modelle werden nicht mehr bei jedem Öffnen der Einstellungen getestet

- Einstellungen → KI-Assistent testete jedes Gemini-Modell bei jedem Öffnen mit einer echten Anfrage, was das kostenlose Tageskontingent verbrauchte. Das Ergebnis wird nun im Speicher gehalten und die Tests werden einmal pro Woche wiederholt.
- Ein Modell, dessen Tageskontingent aufgebraucht ist, wird als verfügbar erkannt, anstatt als „nicht überprüft“ markiert und erneut getestet zu werden.
- Ein Test, der nicht abgeschlossen werden konnte (Netzwerk, Limit pro Minute), wird höchstens einmal pro Tag wiederholt.

## v1.26.027 — 12. Oktober 2026

### Eine einzige Web-Oberfläche: Beta wird zur Movviz-Optik

- Das Stable-Theme wird von der Webseite (Desktop und Mobil) entfernt. Die Beta-Oberfläche wird nun für alle angewendet, einschließlich Konten, die Stable gewählt hatten. Die anderen Dashboard-Einstellungen (Hero, Videos, Reihen) bleiben erhalten.
- Die Wahl zwischen Stable/Beta fällt aus den Dashboard-Einstellungen und dem Installationsassistenten.
- Android TV behält vorerst seine eigene Stable/Beta-Wahl. Die Android-Mobilanwendung und die Samsung-Anwendung hatten nur ein Aussehen: Für sie ändert sich nichts.

## v1.26.025 — 12. Oktober 2026

### Plex-Ansynchronisierung: Viel schneller nach einem großen Plex-Update

- Nach einem großen Plex-Update konnte die Ansynchronisierung der Ansichten fast 9 Minuten dauern und den Server bis zu 7 Sekunden einfrieren lassen: Jeder angesehene Film wurde durch eine separate Anfrage an Plex überprüft. Diese Überprüfungen werden nun in Blöcken von 50 zusammengefasst, und die Synchronisierung gibt dem Server viel häufiger die Kontrolle zurück.
- Ein solches ungewöhnliches Paket (mehr als 500 Ansichtsänderungen auf einmal) wird im Protokoll gemeldet, um ein Plex zu erkennen, das seine Identifikatoren neu zugewiesen hat.

## v1.26.024 — 12. Oktober 2026

### Geplante Aufgaben: Weniger belastend, eine schwere Aufgabe nach der anderen

- Niemals zwei schwere Aufgaben gleichzeitig (Dateiscan, fehlende Inhalte nachziehen, Updates, TMDb-Metadaten, Re-Konzilierungen, Diagnose, Benchmark). Die kleinen, häufigen Aufgaben (Downloadstatus, RSS, Seerr, Plex) und Ihre eigenen Aktionen laufen weiterhin parallel.
- Eine schwere manuelle Suche („Fehlende Inhalte suchen“, technische Analyse, Plex- oder TVDB-Ansynchronisierung, Saga-Scan) wird priorisiert: Die laufende schwere automatische Aufgabe wird pausiert und danach fortgesetzt.
- Keine geplanten Aufgaben in den ersten 3 Minuten nach einem Serverstart, außer denen der Downloads.
- Neuer „Stopp“-Button für jede laufende oder ausstehende Aufgabe in Einstellungen → Geplante Aufgaben und in der Warteschlange.
- Einstellungen → Geplante Aufgaben zeigt die „schlechteste Einfrierung“ jeder Aufgabe an (wie lange sie den Server eingefroren hat), die anspruchsvollen Aufgaben und die Namen der drei fehlerhaft angezeigten Aufgaben.
- Die Intervalle der Aufgaben werden mit dieser Version nur einmal auf die Standardwerte zurückgesetzt. Die von Ihnen danach eingestellten Werte bleiben erhalten.

### Weniger Server-Einfrierungen

- Der Durchlauf der Festplatte friert den Server nicht mehr stündlich ein: Er liest die Festplatte ohne zu blockieren und vergleicht nur noch nicht zugeordneten Dateien.
- Der RSS-Durchlauf vergleicht nicht mehr jeden Cache bei jedem Durchlauf: Eine neue Veröffentlichung wird mit allen fehlenden Titeln verglichen, ein Titel wird allen Cache-Veröffentlichungen hinzugefügt, und ein vollständiger Durchlauf findet beim Start und einmal täglich statt. Ein Tagesausgabe wird immer innerhalb von 15 Minuten nach ihrem Eintreffen bei den Indexierern abgerufen.
- Die Überprüfung der Qualitäts-Updates folgt demselben Prinzip.
- Die Aktualisierung der TMDb-Metadaten speichert nur noch Titel, die sich geändert haben.
- Wenn das automatische Update aktiviert ist, führt die Überprüfung der vorgeschlagenen Ersatzungen nicht mehr dieselbe Suche durch. Das automatische Update meldet selbst die Ersatzungen, die es nicht herunterladen konnte. Deaktiviert funktioniert die Überprüfung wie zuvor.
- Ein Film, dessen Download fehlgeschlagen ist, wird nicht mehr als „aktualisiert“ gezählt.
- Überarbeitete Intervalle: Automatisches Update alle 12 Std. (anstelle von 6 Std.), Plex-Verfolgungsliste alle 5 Min. (anstelle von 1 Min., ohne Protokollzeile pro Benutzer und Minute). Die Wiederaufnahme fehlender Filme hat Vorrang vor Wartungsaufgaben.

### Prioritätspunkte

- Die Regler senden nicht mehr eine Anfrage für jeden verschobenen Pixel und kehren nicht mehr von selbst zurück.
- Der Regler „Downloads“ hat endlich einen Zweck: Bei über 50 reduziert ein aktiver Download die anderen Aufgaben auf 2 parallel. Darunter verlangsamt er sie nicht.
- Hinzugefügt: Der Regler für Plex-Intros, der fehlte.

## v1.26.023 — 12. Oktober 2026

### Änderungen
- Neuveröffentlichung des exakten Codes von v1.26.021 unter der Nummer v1.26.023: Die Patches von den Versionen 1.26.017 bis 1.26.021 sind zurück.

## v1.26.022 — 12. Oktober 2026

### Rückkehr zum Code von 1.26.016

- Neuveröffentlichung des exakten Codes von v1.26.016 unter der Nummer v1.26.022, um ein Update von neueren Versionen zu ermöglichen.
- Die in den Versionen 1.26.017 bis 1.26.021 eingeführten Änderungen wurden in dieser Version entfernt.
- Diese Rückkehr dient zur Überprüfung des Verhaltens der Android TV-Karten; die Behebung des Problems muss auf dem Server und im TV bestätigt werden.

## v1.26.021 — 12. Oktober 2026

### Samsung: Die Reihe „Movviz Trends“ erscheint auch

- Gleicher Fix wie in 1.26.020 für die Samsung-App (Tizen): Nach einem Neustart des Servers lesen Startseite und Entdecken die Reihen erneut, solange der Server sie noch vorbereitet, anstatt ohne Trends zu bleiben.

## v1.26.020 — 12. Oktober 2026

### Movviz TV: Die Reihe „Movviz Trends“ erscheint

- Nach einem Neustart des Servers werden die Trends in wenigen Sekunden berechnet. Die Website wartete darauf, dass sie eintreffen, aber die TV-App zeigte die Startseite unverändert und behielt sie ohne Trends bei. Die TV-App (und die mobile App) lesen nun die Reihen erneut, solange der Server sie noch vorbereitet.
- Wenn der Server neue Vorschläge meldet, wird die TV-Startseite sofort aktualisiert. Früher kam die neue Reihe im Hintergrund und wurde nie angezeigt.

## v1.26.019 — 12. Oktober 2026

### Android: „Mehr anzeigen“ stürzt die App nicht mehr ab

- Auf Mobilgeräten und im TV konnte das Öffnen von „Mehr anzeigen“ einer Vorschlagsreihe und das anschließende Scrollen die App plötzlich schließen, wenn die nächste Seite einen bereits angezeigten Titel zurückgab. Duplikate werden nun ignoriert.

## v1.26.018 — 12. Oktober 2026

### Suche: Alle TMDb-Ergebnisse werden angezeigt

- Die Suche blendet keine Titel ohne Bewertung mehr auf TMDb aus: Alles, was TMDb findet, wird angezeigt. Die „Entdecken“-Reihen behalten ihre Sortierung nach uninteressanten Titeln bei.

## v1.26.017 — 12. Oktober 2026

### Suche: Die neuesten Filme werden nach ihrem Titel gefunden

- Ein Film, der auf TMDb noch nicht bewertet wurde (Festivalfilm, kommende französische Veröffentlichung, wie „Un bon avocat“), war in der Suche als uninteressantes Ergebnis versteckt. Er wird nun angezeigt, wenn man seinen Titel eingibt. Nicht bewertete Ergebnisse, die nicht zur Suche passen, bleiben verborgen.

## v1.26.016 — 12. Oktober 2026

### Nachholung fehlender Inhalte: Maximal 3 Tage Wartezeit

- Ein bereits gesuchter Titel ohne Ergebnis wartet 1 Tag und dann maximal 3 Tage, bevor er erneut gesucht wird (anstatt 7). Der RSS-Scan, die Suche nach Tagesveröffentlichungen und die manuelle Suche warten nie: Ein in einem Feed erscheinender Titel wird sofort heruntergeladen.

## v1.26.015 — 12. Oktober 2026

### Fehlende Filme und Serien: Zuerst RSS, dann eine leichtere Nachholung

- Der RSS-Scan der Indizierer läuft alle 15 Minuten statt stündlich. Ein fehlender Film oder eine Serie wird heruntergeladen, sobald er in einem Feed erscheint, ohne auf eine Nachholung zu warten.
- Wenn zwischen zwei Durchläufen Veröffentlichungen gemacht wurden, die nicht im Feed erscheinen (zu viele Neuheiten auf einmal), bemerkt Movviz dies, liest die nächste Seite des Indizierers und protokolliert dies.
- Die Nachholung fehlender Inhalte läuft alle 8 Stunden statt alle 6 Stunden. Ein bereits gesuchter Titel ohne Ergebnis wartet 1 Tag, dann 3 und dann 7 Tage, bevor er erneut gesucht wird; er kehrt an den Anfang zurück, sobald er gefunden wird.
- Die Nachholung fehlender Episoden deckt nun die gesamte Bibliothek ab. Früher sah sie nur die ersten Serien der Liste.

### Indizierer: Ein abgelehnter Schlüssel wird nicht mehr ignoriert

- Der Test eines Indizierers führt nun eine echte kleine Suche durch: Ein abgelehnter API-Schlüssel wird als Fehler angezeigt, selbst wenn der Indizierer seine Liste der Fähigkeiten ohne Schlüssel veröffentlicht.
- Eine von einem Indizierer abgelehnte Suche (ungültiger Schlüssel oder fehlende Berechtigungen) wird im Protokoll als Fehler protokolliert, anstatt als „kein Ergebnis“.

## v1.26.014 — 12. Oktober 2026

### Plex: Leichtgewichtige Ansichtssynchronisierung

- Die Plex-Ansynchronisierung vergleicht den Plex-Status mit dem Movviz-Status anhand einmal vorbereiteter Indizes, anstatt für jede Episode die gesamte Bibliothek erneut durchzugehen, und lässt dem Server während der Verarbeitung Atmen. Die Ergebnisse sind identisch; die kleinen Einfrierungen der Oberfläche während dieser Aufgabe verschwinden.

## v1.26.013 — 12. Oktober 2026

### Download-Wiederherstellung: Keine Server-Einfrierungen mehr

- Die Aufgabe, die abgeschlossene, aber nicht importierte Downloads abruft, vergleicht weiterhin jede Datei mit der Bibliothek auf die gleiche Weise, aber ohne alle Titel für jede Datei neu zu berechnen, und lässt dem Server zwischen zwei Dateien Atmen. Nach einem Neustart konnte sie die Oberfläche bis zu 11 Sekunden einfrieren.

## v1.26.012 — 11. Oktober 2026

### Plex: Ende des Ansichts-Synchronisations-Loops

- Wenn ein „gesehen“ nicht an Plex gesendet werden kann (Profil aus den Serverfreigaben entfernt, Episode fehlt in Plex…), versucht Movviz zunächst jede Minute, dann mit zunehmendem Abstand: alle 5 Minuten nach 10 Minuten, alle 30 Minuten nach einer Stunde, alle 6 Stunden nach einem Tag. Früher versuchte es unendlich oft jede Minute erneut, was den Server für mehrere Sekunden einfrieren und das Suchprotokoll überfluten konnte.
- Episoden derselben Serie werden zusammen übertragen, mit einer einzigen Plex-Kontrollprüfung und einer einzigen Protokollzeile pro Serie.
- Eine als gesehen markierte Episode, die auf dem Plex-Server nicht existiert (z. B. in einem importierten Verlauf), bleibt in Movviz als gesehen markiert, ohne einen Aufruf an Plex oder eine Warnung im Protokoll.

### Plex: Leichtgewichtige tägliche Re-Konsilierung

- Die vollständige Plex-Re-Konsilierung schreibt ein Film nicht mehr neu, wenn sich nichts geändert hat. Früher wurde die gesamte Bibliothek täglich als „aktualisiert“ gezählt (Benachrichtigung „2351 Film(e) aktualisiert“) und der Server konnte während dieses Durchlaufs für etwa eine Minute einfrieren. Die Benachrichtigung zählt nur noch tatsächliche Änderungen.

### Diagnose, Icons und Trailer

- Die Diagnose gibt die Zähler nach Typ und die ersten 50 Beispiele zurück, anstatt mehrere zehntausend Zeilen.
- Leichte Tab- und App-Icons sowie ein favicon.ico.
- Bereits gefundene Trailer bleiben nach einem Server-Neustart im Cache.

## v1.26.011 — 11. Oktober 2026

### Sicherheit: TMDB-Schlüssel für Administratoren reserviert

- Das Ändern, Löschen oder Testen des TMDB-Schlüssels erfordert nun ein Administrator-Konto, wie bei OMDb und TVDB. Früher konnten diese Aktionen ohne Überprüfung der Sitzung durchlaufen.
- Ein Test überprüft nun, dass jede Route, die etwas verändert, selbst überprüft, wer sie aufruft.

### Tests

- Die Entdeckungs-Tests folgen dem aktuellen Layout (Sortierung bleibt erhalten beim Wechsel der Plattform, Tab „Alle“).
- Die ffmpeg-Erkennungs-Tests gehen nicht mehr von einer NVIDIA-Karte auf der Maschine aus, und der ffprobe-Cache-Test ist nicht mehr instabil.

## v1.26.010 — 11. Oktober 2026

### Android TV und Mobil: Pausieren des Standby-Modus

- Wenn die Wiedergabe pausiert ist, werden der Bildschirmschoner und der Fernseh-Standby nach ihrer üblichen Verzögerung erneut ausgelöst, wie bei Plex. Während der Wiedergabe, einschließlich während eines Ladevorgangs, bleibt der Bildschirm eingeschaltet.

## v1.26.009 — 11. Oktober 2026

### Android Mobil: Staffel vervollständigen

- Auf der Seite einer Staffel gibt es einen eigenen Button zum Herunterladen der Staffel, in einer Zeile getrennt von den Wiedergabeaktionen. Er heißt „Staffel vervollständigen“, wenn noch Teile der Episoden fehlen, „Staffel herunterladen“, wenn keine vorhanden sind, und zeigt während des Downloads den Fortschritt in Prozent live an.

## v1.26.008 — 11. Oktober 2026

### Android TV und Mobil: Episoden-Download

- Auf der Detailseite einer fehlenden Episode ändert sich der Button von „Staffel herunterladen“ zu „Episode herunterladen“. Anschließend wird der Status live angezeigt: in Warteschlange, Suche, Download mit Echtzeit-Prozentsatz, dann Import, bevor er zu „Wiedergabe“ wechselt.
- „Staffel herunterladen“ wird nur für eine Staffel angeboten, deren keine Episode vorhanden ist, mit demselben Live-Tracking. Im TV behält eine laufende Staffel „Staffel vervollständigen“, ebenfalls mit Live-Tracking.
- Ein saisonaler Lauf zeigt seinen Fortschritt auf jeder seiner Episoden an, nur noch auf der ersten.
- Mobil: Fehlende Episoden sind nun zugänglich zum Herunterladen (sie waren inaktiv).

## v1.26.007 — 10. Oktober 2026

### Automatische Wiederherstellung von Blockaden

- Ein blockierter JSON-Backup-Worker wird nach zwei Minuten ersetzt; fehlgeschlagene Backups werden mit den neuesten Daten erneut versucht.
- In Docker startet ein unabhängiger Supervisor den Webserver nach fünf Minuten kontinuierlicher Ausfallzeit neu, mit zehn Minuten Gnadenfrist beim Start, mindestens fünfzehn Minuten zwischen den Neustarts und maximal drei Neustarts pro Stunde.
- Langanhaltende Backup-Fehler werden vom Health-Probe erkannt. Download- und Resolver-Prozesse behalten ihre Protokollausgabe bei einem Neustart des Webservers.
- Der Shutdown versucht, ausstehende Änderungen nach dem Herunterfahren der Schreib-Worker zu speichern. Wiederherstellungsentscheidungen werden in den Protokollen unter `[watchdog]` angezeigt.

## v1.26.006 — 8. Oktober 2026

### Bibliothek: Proportionen und Filter

- Das Genre-Menü ist rechts neben dem Titelzähler ausgerichtet.
- Die Seite verwendet die gleiche nutzbare Breite wie das Dashboard, um die gleichen Proportionen von Karten und Abständen auf großen Bildschirmen beizubehalten.

## v1.26.005 — 8. Oktober 2026

### Automatische Downloads

- Standardmäßig wird die automatische Suche nach fehlenden Inhalten reaktiviert, auch für deaktivierte alte Konfigurationen; eine freiwillige Deaktivierung nach diesem Update bleibt gespeichert.
- Der stündliche RSS-Scan aktualisiert den Status neuer Veröffentlichungen und erkennt die Originaltitel der Filme. Die Suche nach aktuellen Veröffentlichungen verwendet das bekannte Datum, wenn das VF-Datum fehlt.
- Die benutzerdefinierten Intervalle für die automatische Suche sind auf acht Stunden begrenzt, um bei aktiverm Server mindestens drei Durchläufe pro Tag zu gewährleisten.

### Bibliothek und Personalisierung

- Filme, Serien und Sammlungen sind auf der bestehenden Bibliotheksseite zusammengefasst. Die alten Adressen Filme und Serien leiten zu deren Filtern weiter.
- Genres befinden sich in einem Dropdown-Menü über der Anzahl der Titel. Das Raster nimmt die gesamte Breite ein und übernimmt die Abmessungen der Dashboard-Karten.
- Die Personalisierung von Listen ist auf dem Desktop unter Entdecken zugänglich und wurde dem Dashboard hinzugefügt: Reihenfolge, Ausblenden, erneutes Anzeigen und Zurücksetzen, gespeichert pro Konto.
- In Entdecken ist das grüne Abzeichen für verfügbare Titel halbiert; „Gesehen“ erscheint unten rechts, unabhängig vom Download-Status.

## v1.26.004 — Oktober 2026

### Downloads: Sichere Ersetzung und Seed-Status

- Der alte Film bleibt während des Downloads seines Ersatzes verfügbar und lesbar; er wird nur nach Installation und Validierung der neuen Datei mit dem endgültigen Namen, ohne Suffix „(2)“ oder Rest-Backup, entfernt.
- Bei Ablehnung (benutzte Datei, belegter Name, unvollständige oder nicht zugängliche Datei) wird die neue Datei für drei neue Versuche mit einem Abstand von 10 Minuten aufbewahrt, auch nach einem Neustart. Nach dem letzten Fehlschlag wird die neue Datei gelöscht und die alte aufbewahrt; Downloads zeigt eine präzise Meldung an.
- Ein geteilter, abgeschlossener Torrent zeigt „Seeding“ an und wird nicht mehr wegen einer Null-Download-Geschwindigkeit blockiert.

### Desktop: Hero-Badges

- Die technischen Abzeichen übernehmen die Darstellung und Ausrichtung der Genres; „FHD“ wird im Hero Desktop zu „1080P“.

## v1.26.003 — Oktober 2026

### Desktop: Technische Abzeichen des Heroes neben den Genres

- Auf dem Computer werden die Abzeichen für Auflösung, HDR, Sprache und Codecs des Heroes direkt nach den Genres angezeigt, in derselben Zeile, wenn der Platz es zulässt.
- Ihre Darstellung und Daten bleiben unverändert; auf Mobilgeräten und Tablets behalten sie ihre Position oben rechts bei.

## v1.26.002 — Oktober 2026

### Android Mobil: Scrollbare Zeitleiste und Immersion

- Der Regler, der Fortschritt und die angezeigte Zeit folgen dem Finger auf der Zeitleiste. Der Videosprung erfolgt beim Loslassen, ohne wiederholtes Neuladen während des Scrollens.
- Die Zeitleisten-Geste sperrt Helligkeit und Lautstärke; die Steuerelemente bleiben bis zum Loslassen sichtbar.
- Der Player nutzt die gesamte Bildschirmfläche und verdeckt Systemleisten.
- In einem Videostream erkannten schwarze Balken, die über mehrere aufeinanderfolgende klare Bilder hinweg auftreten, und werden durch einen progressiven Anzeigezoom entfernt. Dunkle Szenen lösen keinen Zoom aus; native 21:9-Videos sind ausgenommen.

## v1.26.001 — Oktober 2026

### Desktop-Barrierefreiheit nach Profil

- In meinem Profil ermöglicht ein Abschnitt „Barrierefreiheit“ die Auswahl der Textgröße auf dem Computer: 100 %, 110 % oder 120 %, mit sofortiger Vorschau und Rückkehr auf die Standardeinstellung.
- Die Präferenz wird im Konto gespeichert und auf anderen Computern wiedergefunden. Sie ändert keine Android- oder TV-Apps.
- Die Vergrößerung deckt Texte der Benutzeroberfläche, Menüs und Paneele in den Ansichten „Stabil“ und „Beta“ ab, mit Anpassung der Navigationsbereiche und Steuerelemente.
- Bei 100 % sind die Vergrößerungsstile vollständig deaktiviert; Plakate, Logos und Videos behalten ihre Dimensionen bei.

## v1.25.201 — Oktober 2026

### Android Mobil: Diskreter Player und höhere Priorität

- Beim Abspielen kein Titel oder Logo: Die kompakten Steuerelemente und Episodenaktionen verschwinden nach 2,5 Sekunden ohne Interaktion.
- Bei Pause begleitet ein leichter Verlauf das offizielle Logo des Films oder der Serie; der Titel dient als Ersatz, falls das Logo fehlt oder nicht geladen werden kann. Das Logo verschwindet sofort beim Fortsetzen.
- Zeitleiste von 4 dp, Griff von 18 dp und Touch-Ziele von mindestens 44 dp. Das Abzeichen für den Wiedergabemodus ist reduziert.
- Die tatsächlich abgespielten Video- und Audioformate werden diskret in der Nähe der Zeiten angezeigt, ohne HDR oder Atmos zu erfinden oder die Merkmale der Quelldatei nach der Transkodierung wiederzugeben.
- Das Video füllt die Höhe des Bildschirms bei Beibehaltung des Seitenverhältnisses; ein Inhalt, der schmaler als das Telefon ist, behält seitliche schwarze Balken bei.

## v1.25.200 — Oktober 2026

### Android Mobil Querformat: Platzierung der Videovorschau

- In der zweispaltigen Ansicht ist die Vorschau des Trailers um 33 % seiner Breite nach links verschoben, ohne seine Größe oder sein Format zu ändern.
- Der Verlauf, der Text und das Hintergrundbild bleiben an Ort und Stelle; das überlaufende Video wird an den Bildschirmrändern maskiert.

## v1.25.199 — Oktober 2026

### Android Mobil im Querformat und Themenfarben Beta

- Android Mobil im Querformat: Horizontales Wischen über den Hero, um den vorherigen oder nächsten Titel anzuzeigen; die automatische Rotationsverzögerung setzt nach einer manuellen Auswahl fort.
- Android Mobil in zwei Spalten: Das visuelle Element und die Verläufe bedecken die gesamte Fläche mit einem kontinuierlichen Verblassen zum Text und zum Seitenhintergrund, ohne vertikalen Schnitt.
- Beta-Erscheinungsbild auf dem Computer: Die Suche und die Entdeckungsplattformkarten übernehmen die Farben der Palette, auch beim Überfahren und Auswählen.

## v1.25.198 — Oktober 2026

### Beta-Erscheinungsbild: Rückkehr zur üblichen Suchleiste

- Auf dem Computer übernimmt das Beta-Erscheinungsbild die Suchleiste des Stable-Erscheinungsbilds, identisch: Man tippt direkt in die obere Leiste.
- Die Palette `Ctrl K` wurde entfernt.

## v1.25.197 — Oktober 2026

### Beta-Erscheinungsbild: Downloads entsprechen dem Mockup, Titelseite mit Tabs

- Downloads: Unter dem Titel ersetzt ein Live-Zusammenfassung (aktive Downloads, Durchsatz, freier Speicher) den Erklärungstext.
- Jede Zeile der Warteschlange ist in Spalten ausgerichtet: Inhalt, Fortschritt, Durchsatz, verbleibende Zeit, Quellen. Die Aktionen bleiben diskret (Pause, Suche, Löschen, Details).
- Der Fortschritt ändert die Farbe je nach Status: Violett bei Bearbeitung, Grau bei Wartung, Grün bei Abschluss, Rot bei Blockierung.
- Die Spalte „Quellen“ zeigt nun die tatsächliche Anzahl von Peers an, anstelle leerer Pfeile.
- Die rechte Spalte ist in „Live-Durchsatz“ mit einer ausgefüllten Kurve und „Status“ organisiert. Die gruppierten Schaltflächen sind nicht mehr rot, außer beim Überfahren.
- Titelseite auf dem Computer: Episoden, Veröffentlichung, Ähnliche und Details werden unter der Zusammenfassung zu Tabs.
- Korrektur: Der Info-Tooltip „Details“ zeigte einen technischen Text anstelle des übersetzten Wortes.
- Wiedergabeanfänge ändern sich nicht. Stable, Mobil und TV-Apps auch nicht.

## v1.25.196 — Oktober 2026

### Android Mobil: Korrektur

- Der Verlauf meines Bereichs stürzt die Anwendung nicht mehr ab, wenn ein Film oder eine Episode mehrmals enthalten ist (überprüft oder erneut gestartet): Jeder Titel erscheint nur einmal, mit seinem neuesten Datum.

## v1.25.195 — Oktober 2026

### Beta-Erscheinungsbild: Vollbild-Startseite auf dem Computer

- Das große Bild der Startseite verlässt seinen Rahmen: Es nimmt die gesamte Breite ein, geht unter die obere Leiste und verschmilzt mit dem schwarzen Hintergrund der Seite.
- Der Titel, die Zusammenfassung und die Schaltflächen sind auf den Rest der Seite ausgerichtet.
- Die Diashow, das Titellogo, der Hintergrund-Trailer und die Plattformkarten ändern sich nicht. Stable, Mobil und TV-Apps ändern sich auch nicht.

## v1.25.194 — Oktober 2026

### Android mobil: Premium-Neugestaltung, Suche, Player und Einstellungen

- Suche: Mit „Alles“ erscheinen die gefundenen Personen oben, in runden Fotos, vor Filmen und Serien.
- Jedes Ergebnis zeigt an, ob es bereits in der Bibliothek oder im Download ist.
- Die Filter (Genres, Dauer, Plattformen…) öffnen sich wie ein Blatt von unten im Porträtformat, mit einer scrollbaren Liste.
- Die aktiven Tabs (Filme/Serien, Laufend/Abgeschlossen, Suchfilter) werden weiß, wie die Staffeln.
- Player: Ein Doppelklick links oder rechts geht um 10 s zurück oder vor, und ein vertikales Wischen regelt die Helligkeit (links) oder die Lautstärke (rechts).
- Downloads: Ein Zusammenfassung oben zeigt den globalen Fortschritt, den Gesamt-Durchsatz und die geschätzte Fertigstellung.
- Einstellungen: Das automatische Update wird zu einer klaren Zeile mit einem Schalter.
- Der Update-Bildschirm ist auf dem Telefon lesbarer.

## v1.25.193 — Oktober 2026

### Beta-Erscheinungsbild: „Dunkelraum“ erstreckt sich über den gesamten Computer

- Alle Farben sind vereinheitlicht: ein tiefes Schwarz, ein einziges Violett für Auswahl und Fortschritt. Cyan, elektrisches Blau und Pink-Verläufe verschwinden von Knöpfen, Filtern und Paneelen.
- Grün, Orange und Rot behalten ihre Bedeutung: abgeschlossen, Achtung, fehlgeschlagen.
- Überarbeitete Download-Seite: Unterstrichene Tabs, Stichpunkte für Filter, schlichtere Linien, violetter Fortschritt, in Zahlen ausgerichtete Durchsatzgeschwindigkeiten, farbige Status-Punkte je nach Status und eine Live-Spalte (Grafik, Durchsätze, Zähler) passend zum Rest.
- Der Hauptknopf (Abspielen, Fortsetzen, Zur Bibliothek hinzufügen) wird auf der Startseite und auf der Titelseite hell. Andere Aktionen bleiben Icons, mit ihrem Namen beim Überfahren.
- Bibliothek: Die Filter Typ und Sortierung erscheinen nicht mehr zweimal, sie bleiben in der oberen Werkzeugleiste.
- Die Startseite der Einstellungen verliert ihre farbigen Halos und nimmt die gleichen Oberflächen wie der Rest wieder an.
- Die Karten der Plattformen, ihre Logos und ihre Hover-Effekte ändern sich nicht. Stabil, das mobile und die TV-Apps ändern sich auch nicht.

## v1.25.192 — Oktober 2026

### Android mobil: Premium-Neugestaltung der Film- und Serienseite

- Die Seite nimmt die Farbe des Plakats an: Der Hintergrund färbt sich sanft je nach Titel anstelle eines einheitlichen Schwarz.
- Im Querformat und auf dem flach geöffneten Fold wird die Seite in zwei Spalten angezeigt: Das Bild bleibt links fixiert und die Informationen scrollen rechts.
- Auf dem vertikal gehaltenen, geöffneten Fold nimmt die Seite das Porträt-Layout mit mehr Platz wieder an.
- Der Knopf „Abspielen“ ist überall weiß, und der Fortlauf-Fortschritt wird direkt im Knopf angezeigt.
- Im Porträt werden „Von Anfang an abspielen“ und „Gesehen markieren“ zu runden Knöpfen in einer einzigen Zeile.
- Staffeln werden mit kompakten Stichpunkten „Staffel 2 · 10 Ep.“ auf dem Telefon und Fold ausgewählt.
- Im Porträt öffnet sich eine Episode in einem Blatt, das von unten hochfährt und durch einen Klick oben geschlossen werden kann.

## v1.25.191 — Oktober 2026

### Android mobil: Premium-Neugestaltung, erster Schritt (Gehäuse)

- Das Z Fold im geöffneten Zustand, gehalten, zeigt nicht mehr die TV-Oberfläche: Es verfügt nun über ein eigenes Touch-Layout mit einer beschrifteten Navigationsleiste links.
- Neue Navigationsleiste aus satiniertem Glas im Quer- und Fold-Format. Sie integriert die Suche, und der Tab „Downloads“ zeigt bei einem Download einen Fortschrittsring an.
- Auf dem flach geöffneten Fold oder auf dem Tablet behält das rechte Panel seine Position, wenn der Bildschirm groß genug ist, und übernimmt das gleiche Glas-Design.
- Das Highlight auf dem Startbildschirm nimmt im Quer- und Fold-Format die volle Breite ein, mit einer besser lesbaren Zusammenfassung und einem weißen „Abspielen“-Button.
- Das untere Dock ist leichter: Der aktive Tab wird durch ein unterstrichenes violettes Icon anstelle einer farbigen Pille markiert.
- Die Startbildschirm-Suche im Hochformat wird zu einem Icon in der Kopfzeile, was mehr Platz für Inhalte lässt.
- Buttons und Thumbnails reagieren auf Berührung mit einem leichten Eindrücken, und sekundäre Texte nehmen einen sanfteren Farbton an.
- Der schwebende Movviz AI-Button ändert sich nicht.

## v1.25.190 — Oktober 2026

### Beta-Erscheinungsbild: Erste Schritte von „Dark Room“ auf dem Computer

- Neue Befehlspalette: `Ctrl K` (oder ein Klick auf die obere Leiste) sucht nach Filmen und Serien, Seiten und Einstellungen und schlägt vor, die Suche in „Entdecken“ oder eine Torrent-Suche zu starten.
- Die obere Leiste wird vereinfacht: Sprache und der Link „Movviz unterstützen“ werden in das Profilmenü verschoben, und das Herz schlägt nicht mehr kontinuierlich.
- Dunklere und neutralere Farben, aktiver Seitenleisten-Eintrag in erhabener Oberfläche, dedizierte Movviz-Schriften (eingebaut, keine Verbindung), Seitentitel ohne Verlauf und ein einziger Fokusring, identisch mit Maus und Tastatur.
- Ein Link zu einer bestimmten Einstellung öffnet nun den richtigen Tab, auch wenn die Seite „Einstellungen“ bereits angezeigt wird.
- Das Erscheinungsbild „Stabil“, Mobil und TV-Apps ändern sich nicht.

## v1.25.189 — Oktober 2026

### Android TV: Neues Beta-Interface zum Ausprobieren

- Neue Einstellung Einstellungen > Erscheinungsbild > Beta-Interface. Standardmäßig deaktiviert: Das aktuelle Erscheinungsbild ändert sich nicht, solange Sie es nicht aktivieren.
- Mit dem Beta-Interface sind die Texte größer und vom Sofa aus besser lesbar (Badges, Notizen, Zusammenfassungen, Karteninformationen), und die Auswahl hat überall den gleichen weißen Rahmen.
- Reihen, Poster und Wiederholungskarten sind auf einer gleichen Marge und etwas größer ausgerichtet; die Fortschrittsanzeige für Wiederholungen ist besser sichtbar.
- Das Highlight auf dem Startbildschirm ändert sich nicht, während Sie auf seinen Button sind, und dieser Button heißt jetzt „Details anzeigen“, was er auch wirklich tut.

## v1.25.188 — Oktober 2026

### Android mobil: Suche nach Schauspieler

- Im Tab „Schauspieler“ der Suche öffnet das Tippen auf einen Schauspieler nun dessen Profil mit seiner Filmografie.
- Jedes Ergebnis zeigt das Foto und den Beruf der Person an, und die Suche zeigt an, wann sie lädt oder fehlschlägt, anstatt „Kein Schauspieler“ anzuzeigen.
- Die Suche nach Schauspielern (Mobil und Web) findet viel mehr Personen: Sie verwendet nun die TMDb-Suche, die für Personen vorgesehen ist.

## v1.25.187 — Oktober 2026

### Movviz Companion: Live-Download-Tracking

- Der Button zeigt nun den Download-Fortschritt in Echtzeit mit einem feinen Fortschrittsbalken an und aktualisiert sich automatisch: Kein manuelles Aktualisieren der Seite mehr nötig.
- Wenn der Download abgeschlossen ist, wechselt der Button automatisch zu „Verfügbar“ mit direktem Zugriff auf das Movviz-Profil.
- Präzisere Fehlermeldungen bei Verbindungsabbrüchen zum Server (nicht autorisierter Zugriff, Server muss aktualisiert werden, Server nicht erreichbar) und eine zuverlässigere Berechtigungsanfrage für einen HTTP-Server.

## v1.25.186 — Oktober 2026

### Movviz Companion: Korrigierte Installation

- Die Erweiterung lädt wieder in Chrome und Edge: Eine ungültige Icon-Deklaration verhinderte die Installation seit der vorherigen Version.

## v1.25.185 — Oktober 2026

### Movviz Companion: Sichtbares Logo und besser lesbarer Button

- Das Movviz-Logo wird nun auf allen unterstützten Websites im Button angezeigt.
- Der Button ist nun eine dunkle Karte mit einem violetten Halo, größer und auch auf weißen Seiten lesbar. Wenn ein Titel verfügbar ist, wird „In Movviz öffnen“ zum Hauptbutton.

## v1.25.184 — Oktober 2026

### Movviz Companion: Klares Logo

- Das Icon der Erweiterung verwendet nun das Movviz-Logo in transparentem PNG, ohne den dunklen Rahmen, der an den Rändern sichtbar war.

## v1.25.183 — Oktober 2026

### Movviz Companion: Fordere deine Filme und Serien von Filmseiten an

- Neue Browser-Erweiterung (Chrome, Edge, Brave): Ein Movviz-Button erscheint auf TMDb, IMDb, AlloCiné, SensCritique, TheTVDB, Letterboxd, Rotten Tomatoes, JustWatch, Trakt und Taste, um einen Film oder eine Serie mit einem Klick anzufordern.
- Der Status wird live angezeigt (ausstehend, läuft, verfügbar) mit direktem Zugriff auf das Movviz-Profil. Wenn eine Website ihr Layout ändert, bleibt der Button unten links sichtbar.
- Verbindung mit einem persönlichen API-Token (Profil, API-Tokens): Die Anfrage folgt deinen üblichen Rechten, sofort für Administratoren oder Benutzer mit automatischer Genehmigung genehmigt.
- Das Archiv der Erweiterung ist mit jedem Release enthalten, zusammen mit einer Optionsseite in Movviz-Farben, die in fünf Sprachen verfügbar ist.

## v1.25.182 — Oktober 2026

### Wiedergabe: Zuverlässiges Pausieren/Fortsetzen und große Dateien, die nicht mehr im Nichts laufen

- Eine Pause von mehr als ein paar Sekunden oder die Wiedergabe einer großen Datei unterbricht die Videoverbindung nicht mehr: Auf Android TV und Mobilgeräten erzwingt der Player keine maximale Dauer mehr für einen Stream, und der Server unterbricht ihn nicht mehr nach 5 Minuten.
- Es ist wieder möglich, während eines Ladevorgangs zu pausieren, und das Icon folgt dem tatsächlichen Status. Ein pausierter Player bleibt nach einer automatischen Wiederaufnahme erhalten, und das Verlassen des Bildschirms pausiert die Wiedergabe auch während eines Ladevorgangs korrekt.
- Weniger Speicherverbrauch: Der Start-Trailer wird freigegeben, sobald der Player geöffnet oder die App in den Hintergrund versetzt wird.
- Flüssigere Wiedergabe lokaler Dateien bei großen Dateien.

## v1.25.181 — Oktober 2026

### Filme und Serien: Korrekte Reihen- und anpassbare Reihennamen

- Die Vorschlagsreihen für die Seiten Filme und Serien tragen endlich ihren echten Namen (Gelobt von Kritik, Anime, Action, Komödie usw.) anstelle von „Filme“ oder „Serien“ überall.
- Neuer Bleistift-Button bei Filme, Serien und Entdecken: Jeder Benutzer kann eine Vorschlagsreihe hoch-, runter-, an die erste Stelle setzen oder ausblenden und sie jederzeit wiederherstellen. Die Organisation wird auf seinem Konto, Seite für Seite, gespeichert, und ein Button ermöglicht die Rückkehr zur Standardreihenfolge.

## v1.25.180 — Oktober 2026

### Samsung Tizen: Ablauf näher an Android TV NX

- Überarbeitete Einstellungen, Titeln, Staffeln und Episoden: Gesehen/Nicht gesehen-Status, Zähler für gesehene und fehlende Episoden, Fortsetzen an der genauen Stelle oder von vorne.
- Konsistente Startseite, wenn KI deaktiviert ist: Keine leeren Bereiche oder sichtbare KI-Elemente.
- Neue Übersetzungen in fünf Sprachen und UX-Audit der Samsung-Version hinzugefügt zur Portierungsdokumentation.

## v1.25.179 — Oktober 2026

### Downloads: Ende der falschen Editionen und umgangen Wörter

- Eine Veröffentlichung einer nationalen Edition einer Sendung wird nicht mehr für die Basisserie berücksichtigt: „Hot Ones Quebec“ wird nicht mehr für „Hot Ones“ heruntergeladen (gleiches gilt für Kanada, Frankreich, Belgien, Australien usw.).
- „Blockierte ersetzen“ respektiert nun verbotene Wörter: Eine Veröffentlichung, die einen verbotenen Begriff enthält (z. B. VFQ), wird nicht mehr automatisch ausgewählt, unabhängig von ihrem Score. Die manuelle Suche zeigt weiterhin alles an.

## v1.25.178 — Oktober 2026

### Samsung Tizen: Erster NX-Client in Beta und GitHub-Release

- Hinzufügen eines Samsung TV Clients, verpackt als `.wgt`, mit Farben, Roboto-Schriftart, Logo, Fokus-Leiste und Dimensionen von Android TV NX. Server-Bildschirme, Movviz/Plex-Verbindung per Code und QR, Profilauswahl, Startseite mit Hero, Bibliothek, Entdeckung, Suche und einzigem Titelblatt mit Staffeln/Episoden und Verteilung.
- Wiederverwendung von Server-Routen und -Regeln für Konten, Fortsetzungen, Verläufe, gesehenen Status, persönliche Listen, Titelanfragen, Download-Suchen und KI, wenn diese aktiviert ist. Profile stellen jeweils ihre authentifizierte Sitzung wieder her; es wird kein Plex-Token an den Client gesendet.
- AVPlay-Adapter mit authentischer Wiedergabe, Fortsetzung, Pause, Navigation im Stream, Audio-/Untertitelwahl durch Server-Neuanordnung, Fortschritt und nächste Episode. Die deklarierten Fähigkeiten sind auf H.264/AAC SDR 1080p begrenzt, bis die Hardware-Tests vorliegen; die Wiedergabe auf physischem TV und die vollständige Android TV-Parität sind noch nicht validiert.
- Samsung Workflow mit denselben Tags `v*` wie andere Plattformen: Überprüfung der Typen/Tests, Archiv und SHA-256 mit der Release beigefügt. Ohne konfigurierte Samsung-Zertifikate trägt das Paket explizit den Namen `client-unsigned.wgt` und muss vor der Installation signiert werden. HEVC/HDR/4K, Trailer, Marker und erweiterte Einstellungen müssen noch finalisiert und am Zielgerät überprüft werden.

## v1.25.177 — Oktober 2026

### Android TV: Rückmeldungen und Staffelstart mit D-Pad

- Bei der Rückkehr zu einem geöffneten Titel aus der Suche kehrt der Fokus zur ausgewählten Karte zurück, mit Wiederherstellung des Filters und des Gitters.
- Eine Staffel wird durch die Wiedergabe ihres Headers geöffnet, ohne diesen zu verdecken. Die Rückkehr zu einem Episodentitel behält die Priorität seiner ursprünglichen Karte bei; die Compose-Bewegungen und Wiedergaberegeln bleiben unverändert.

## v1.25.176 — Oktober 2026

### Android TV: Vereinfachte Sucheingabe

- Die Eingabe deaktiviert nicht mehr den gesamten Navigationscontainer bei jedem Buchstaben. Die Normalisierung der Bibliotheksnamen wird einmal pro Aktualisierung berechnet, und die Übereinstimmungen und deren Sortierung werden außerhalb des Anzeigethreads berechnet.
- Veraltete Berechnungen werden storniert und ihre Ergebnisse können die der neuen Eingabe nicht ersetzen. Priorität für Bibliothek, Sortierung, Filter, Deduplizierung, gesehenen Chips, Netzwerk-Timing und Fernbedien-Navigation bleibt erhalten.

## v1.25.175 — Oktober 2026

### Beta: Lichtreflexion auf dem Kartenrand

- Beim Überfahren des Desktops folgt ein feiner weiß-violetter Schimmer der Maus entlang der Kanten der Karten. Das Zentrum ist verdeckt, um die Farben und die Lesbarkeit der Plakate zu bewahren, mit einem dezenten äußeren Halo.
- Kein Zoom oder Vergrößerung hinzugefügt: Die bestehende Mausverfolgung bleibt erhalten. Keine Änderungen am Hintergrund, am Stable-Modus, an den Inhalten oder an der Wiedergabe; keine zusätzlichen Bibliotheken oder permanente Animationen.

## v1.25.174 — Oktober 2026

### Kürzliche Ergänzungen: Verwechslung von Ansichtsänderung und Datei-Ankunft vermeiden

- Die Synchronisierung und die Bereinigung von Plex behalten das Ankunftsdatum einer bereits bekannten Datei bei. Das Wechseln zwischen gesehenen oder nicht gesehenen Episoden oder das Aktualisieren ihrer Metadaten gibt ihnen nicht mehr künstlich das Synchronisierungsdatum in den kürzlich hinzugefügten Elementen zurück.
- Ein erster Import verwendet das tatsächliche Hinzufügedatum von Plex; ein echter Dateiersatz behält sein Verhalten als Neuankunft bei. Bereits erfasste lokale Akquisitionsdaten werden beibehalten.
- Korrektur in der freigegebenen Datenquelle, ohne die Ansichten, Verläufe, Plex-Konten oder Wiederherstellungsregeln zu ändern.

## v1.25.173 — Oktober 2026

### Nützliche Einstellungen, Sonderstaffeln und Entdecken

- Entfernung der deaktivierten Startoptionen (Statistiken, Downloadwarteschlange und Aufgaben) und der Grafikkartenprofile. Die aktuelle Komposition und das Standard-Grafik-Rendering bleiben unverändert; das Ausschalten von Animationen und die Auswahl von Stable/Beta bleiben verfügbar. Die Texte der entfernten Auswahlmöglichkeiten wurden bereinigt; der Assistent behält nur noch seine noch nützlichen Auswahlmöglichkeiten.
- Der integrierte Player heißt Movviz Player und ist standardmäßig aktiviert. Die persönliche Auswahl deaktiviert Plex, auch wenn eine lokale Quelle diesen Auswahlpunkt sonst umgangen hätte. Die expliziten Präferenzen bestehender Konten bleiben erhalten; die Engine bleibt automatisch.
- Auf dem Desktop steuert die bestehende Option für Special Episodes nun tatsächlich die Anzeige der Staffel 0. Sie wird nach diesem Update einmal für alle Profile deaktiviert, danach kann jeder sie wieder aktivieren. Auf Android TV sind Specials wie bisher auf Smartphones ausgeblendet. Keine Datei, kein Verlauf oder Status "gesehen" wird gelöscht.
- Entdecken bietet Neuheiten, Trend, Beste und Für Sie im selben Selektor für alle Plattformen. Die Sortierung bleibt beim Wechsel der Plattform oder des Typs erhalten; Für Sie verwendet die Empfehlungen des Kontos, gefiltert nach der ausgewählten Plattform. Mit zusätzlichen Filtern werden die gefilterten Ergebnisse neu angeordnet, ohne ihre Paginierung zu ändern.
- In Filme und Serien trennen die Plattformreihen nun die Vorschläge für Sie und die Neuheiten, mit denselben Bezeichnungen wie bei Entdecken.
- Entfernung des Rechteckrahmens, der im Suchfeld Beta hinzugefügt wurde; nur seine abgerundete Kontur zeigt nun den Fokus an.

## v1.25.172 — Oktober 2026

### Beta: Ursprünglicher Hintergrund und verfeinerte Interaktionen

- Der Seitenhintergrund und der Seitenleistenhintergrund erhalten das ursprüngliche Thema: Kein dekorativer Hintergrund mehr in Beta hinzugefügt. Die Mausverfolgung und die Reliefs der Kacheln bleiben erhalten.
- Die Abzeichen für Bewertungen und Episoden sind lesbarer, die Wiederherstellungsbalken sind besser definiert und die ausgewählte Plattform in Entdecken hat einen dezenten Ankerpunkt.
- Die Buttons des Heroes und die Pfeile der Karussells geben beim Überfahren, Klicken und mit der Tastatur ein klareres visuelles Feedback, ohne das Layout zu verschieben.
- Diese Verfeinerungen bleiben auf dem Desktop für Beta reserviert, respektieren die Reduzierung der Animationen und ändern weder die Wiedergabe, noch die Daten, noch die Vorabladungen.

## v1.25.171 — Oktober 2026

### Beta: Premium Kino-Finish für den Desktop

- Beta wendet nun ein konsistentes Erscheinungsbild auf das Dashboard, auf Film- und Serienkarten, auf Entdecken, auf Details, auf die Suche, auf die Einstellungen und auf das Movviz AI-Panel an. Stable behält sein bestehendes Erscheinungsbild bei.
- Plakate und Plattformen verfügen über ein Licht beim Überfahren und ein leichtes Relief. Die Steuerelemente, Vorschaufenster und Details sind harmonisiert; die Übergänge der Details sind verfeinert, ohne ihr Verhalten zu ersetzen.
- Pointer-Effekte teilen sich eine einzige Aufgabe pro Frame, ohne React-Neurendering oder permanente Animation. Sie werden während der Wiedergabe, auf Touchscreens und bei reduzierten Animationen abgeschnitten.
- Die Einstellungen und das Erscheinungsbild-Cache werden gegen das angemeldete Profil überprüft. Daten, Suche, Karussells, Vorabladungen und Wiedergaberegeln werden nicht geändert.
- In den kostenlosen Bibliotheken ausgewählte Effekte sind für Movviz angepasst, ohne ihre Engines zu stapeln oder Produktionsabhängigkeiten hinzuzufügen.

## v1.25.170 — Oktober 2026

### Stabile und Beta-Ansicht

- Der Startseite-Auswahl und die Karussells bieten nun Stable (die aktuelle, Standard-Oberfläche) und Beta (das neue Premium-Desktop-Design). Das Dashboard wendet den gespeicherten Modus tatsächlich an und ermöglicht die Rückkehr zu Stable.
- Die alten Modi Kino, Klassisch und Kompakt werden zu Stable. Die Einstellungen für Videos, Inhalte und Karussells bleiben erhalten und sind für beide Erscheinungsbilder üblich.
- Beta verfeinert den Hero-Rahmen, die Schaltflächen, die Titel und die Plattformen, ohne die Wiedergabe oder die Daten zu ändern. Premium-Styles sind weiterhin ausschließlich in Beta aktiviert.
- Die Auswahl bleibt pro Profil individuell; ein Speichernfehler lässt nicht mehr vermuten, dass der neue Modus gespeichert wurde.

## v1.25.169 — Oktober 2026

### Docker-Veröffentlichungsbehebung

- Die README ist im Docker-Build-Kontext enthalten, um die Validierung von Versionen und Changelogs zu ermöglichen. Die Überprüfung bleibt aktiv; kein Benutzerverhalten wird geändert.
- Diese Veröffentlichung nimmt die Behebungen für Ansichten und Wiederaufnahmen aus Version 1.25.168 auf, deren Docker-Build fehlgeschlagen war.

## v1.25.168 — Oktober 2026

### Konsistente Ansichten und Wiederaufnahmen auf allen Geräten

- Android TV und Smartphones verwenden bei Schließen und Wechsel der Episode nun dieselbe Serverseitige Entscheidung wie das Web: Episoden bei 80 %, Filme nach ihrem Titel oder dem vorhandenen Endabstand, mit Schutz der tatsächlichen Wiedergabezeit. Das natürliche Ende bleibt eine explizite Validierung.
- Wiederaufnahmen von S01E01 ohne Fortschritt werden aus lokalen und Plex-Quellen entfernt, insbesondere nach einem unvollständigen Import. Eine tatsächlich begonnene erste Episode und der Wechsel zu einer folgenden Staffel bleiben verfügbar.
- Keine Löschung von importierten Ansichten oder Verläufen; die Trennung der Plex-Profile und die bestehende Synchronisierung bleiben erhalten.

## v1.25.167 — Oktober 2026

### Changelog nach Update

- Das Neuigkeiten-Fenster markiert eine Version nicht mehr als gelesen, falls ein Fehler auftritt, keine Notizen vorhanden sind oder der Splash-Screen es verdeckt. Die Validierung erfolgt beim Schließen.
- Unterbrochene Ladevorgänge werden abgebrochen und temporäre Fehler verfügen über zwei neue Versuche. Frühere unzuverlässige Validierungen verbergen nicht mehr die Notizen.
- Die Notizen für die Versionen 163 bis 166 werden wiederhergestellt. Das Changelog ist im eigenständigen Server enthalten und der Build überprüft nun die Notizen sowie die Versionen der README und der Lockfile.

### Nachholen jüngster Neuheiten

- Die Karussells bereiten zwei Bildschirme im Voraus vor, mit begrenzter Vorausschau und Priorität für sichtbare Bilder, angeforderte Suchen und Karten.
- Die Wiederaufnahme einer Serie schlägt kein nicht existierendes oder fehlendes Episode vor; die Ansichten, der importierte Verlauf und die Trennung der Plex-Konten werden bewahrt.
- Die installierte Version und der Update-Block sind wieder unten in der Seitenleiste, in geöffnetem und kompaktem Modus.

## v1.25.166 — Oktober 2026

### Version und Aktualisierung in der Seitenleiste

- Die installierte Version ist wieder im Profil sichtbar, auch im Kompaktmodus.
- Der aktualisierte Block ist für Administratoren zurückgekehrt: Installation auf Windows und nativem Linux, Zugriff auf Informationen zu Docker/NAS. Die Navigation bleibt unverändert.

## v1.25.165 — Oktober 2026

### Priorität der Navigation

- Die Aktivitätserkennung erfasst Tastatur, Touch, Scrollen und Navigation. Die Priorität wird während nützlicher Ladevorgänge erneuert, nicht durch bereits gecachte Aktualisierungen.
- Sichtbare Bilder warten nicht auf die Vorhersage. Nahegelegene Karussells bereiten zwei Bildschirme im Voraus vor, mit zwei spekulativen Vorladungen und einem Dekodieren für die gesamte Reihe gleichzeitig.
- Hintergrundaufgaben werden korrekt priorisiert; TMDb-Anfragen bleiben priorisiert, mit stabiler Reihenfolge und beibehaltenen Nebenläufigkeitsgrenzen.

## v1.25.164 — Oktober 2026

### Nur gültige Fortsetzungen

- Die nächste Folge stammt aus dem tatsächlichen Katalog, sortiert nach Staffel und Folge. Eine abgeschlossene Serie erzeugt keine zusätzliche Folge mehr.
- Eine fehlende nächste Folge verhindert die Fortsetzung, ohne zu einer späteren Folge zu springen; eine verfügbare laufende Folge behält die Priorität.
- Die Überprüfung gilt für lokale und Plex-Fortsetzungen, ohne die Ansichten, den importierten Verlauf oder die Profilsynchronisierungsregeln zu ändern.

## v1.25.163 — Oktober 2026

### Reaktionsfähigkeit der Karussells

- Die Reihen laden zwei Breiten im Voraus und vermeiden unnötige Renderings beim Scrollen.
- Der Download-Zähler wird nicht mehr zweimal in der geöffneten Seitenleiste angezeigt.

## v1.25.162 — Oktober 2026

### OCS und YouTube

- OCS und YouTube bleiben immer in Entdeckung sichtbar, auch wenn TMDb sie für Belgien nicht auflistet.
- Wenn ein belgischer Anbieterkatalog leer ist, verwendet die Suche automatisch den französischen Katalog für diese Plattform; bestehende belgische Ergebnisse behalten Vorrang.
- Die Sortierung in Entdeckung ist nach Neuheiten, Trends, Beste; „Für Sie“ bleibt unabhängig vom Anbieter zugänglich.

## v1.25.161 — Oktober 2026

### Movviz AI lebendiger

- Fragen und Versuche der Übernahme des Erstellers erhalten nun abwechslungsreiche mysteriöse Antworten, ohne Identität preiszugeben oder denselben Satz zu wiederverwenden.
- Movviz AI kann mit Unverschämtheit auf tatsächlich angesehene Entscheidungen scherzen und auf eine Beleidigung mit einem leichten Hauch theatralischer Verachtung antworten, ohne zu eskalieren oder ohne freie Angriffe.

## v1.25.160 — Oktober 2026

### Entdeckungsplattformen und inaktive Downloads

- Das Klicken auf eine Plattform (Kachel oder Menü) öffnet deren Katalog, ohne die vorherige Suche oder inkompatible Filter beizubehalten; der Typ Filme/Serien bleibt unverändert.
- Die verfügbaren Plattformen stammen aus den Film- und Serienlisten des ausgewählten Landes. OCS und YouTube werden in einem Land, für das TMDb keinen Katalog bereitstellt, nicht mehr angeboten, ohne stumm auf Frankreich umzuschalten.
- Ein Download von unter 20 Byte/s über zwei Minuten wird als „blockiert“ eingestuft, selbst bei verbundenen Peers oder einem Datennetz. Eine signifikante Wiederaufnahme kann ihn wieder in die Warteschlange setzen.
- Pausen, das Warten auf einen Slot und Überprüfungen werden von der Inaktivitätszeit ausgenommen; eine manuelle Wiederaufnahme erhält eine neue volle Zeitspanne.

## v1.25.159 — Oktober 2026

### Neustart des Torrent-Clients

- Administrator-Button in den SchnellEinstellungen der Downloads, mit „Wird neu gestartet…“ und Schutz vor Doppelklicks.
- Tatsächliches Stoppen und Neuerstellen der Torrent-Clients, gefolgt von der Wiederherstellung der Warteschlange, Pausen und des importierten Verlaufs ohne Löschung von Dateien. Native Prozesse müssen vor ihrem Ersatz gestoppt werden.
- Status während des Vorgangs einsehbar; bei einem Fehler wird das Backup für einen erneuten Versuch beibehalten, anstatt die Warteschlange mit einem teilweisen Status zu überschreiben.

## v1.25.158 — Oktober 2026

### Film- und Serienkarten auf dem Desktop

- Die Seiten Filme und Serien übernehmen die Desktop-Breite des Dashboards und der Entdeckung. Ihre Reihen verwenden bereits dieselbe Komponente und dieselben responsiven Kartenmaße.
- Die Darstellung für Telefon und Tablet bleibt unverändert.

## v1.25.157 — Oktober 2026

### Erlaubte Release-Begriffe

- Ein erlaubter Begriff muss eindeutig sein: FRENCH umgeht nicht mehr ein Verbot, wenn er nur in SUBFRENCH oder TRUEFRENCH enthalten ist.
- Die üblichen Trennzeichen von Releases werden weiterhin akzeptiert, insbesondere VOSTFR+FRENCH. Die allgemeine Regel deckt die automatische Auswahl und die Überprüfung nach dem Import ab, ohne die manuellen Ausnahmen zu ändern.

## v1.25.156 — Oktober 2026

### Größe der Entdeckungskarten auf dem Desktop

- Entdeckung verwendet dieselbe Inhaltsbreite und dieselbe responsive Kartengröße wie das Dashboard auf dem Desktop, in Reihen und Ergebnisgittern.
- Die Platzhalter folgen denselben Dimensionen; die Größen für Telefon und Tablet bleiben unverändert.

## v1.25.155 — Oktober 2026

### Reaktionsfähigkeit beim ersten Laden

- Die Quellen für Entdeckung und die Seiten Filme/Serien reagieren unabhängig: eine langsame Quelle hält nicht mehr alle Reihen zurück. Bereits berechnete Reihen bleiben während eines Updates sofort verfügbar und werden beibehalten, falls dieses fehlschlägt.
- Die Vorschläge behalten den gesamten Verlauf, die Rangliste und die Filter nach Profil bei. Die gesehenen und abgelehnten Zustände werden auch bei den von Cache gelieferten Daten überprüft.
- Das schrittweise Ausfüllen verwendet den Pfad mit niedriger Priorität und fügt beim ersten Durchlauf keine Netzwerkwartung mehr hinzu. Die Geräte werden benachrichtigt, wenn die Reihen verfügbar sind; das Web verfügt über eine Nachholung, die auf die Vorbereitungszeit begrenzt ist.
- Die Berechnung von Schauspielern und Schlüsselwörtern lädt keine unnötigen Trailer, externen Bewertungen oder Plattformen mehr. Die gleichzeitige Berechnung desselben Profils wird gemittelt; die echten Profile behalten ihre Funktionalität.

## v1.25.154 — Oktober 2026

### Vorschläge basierend auf dem gesamten Verlauf

- Alle im Profil gesehenen Titel tragen zum Vorschlags-Pool bei, ohne ein Limit von 20 Titeln oder Vermischung zwischen Benutzern. Die Rangliste behält Bewertungen, Präferenzen, Konsens zwischen Titeln und Vielfalt bei.
- Die Vorschläge des Dashboards, von Filmen und Serien verwenden denselben Pool; Netflix, Disney+ und Prime Video filtern diesen vollständigen Pool entsprechend der Verfügbarkeit im Profilland, anstatt einen unabhängigen Katalog zu bewerten.
- Beziehungen und öffentliche Verfügbarkeiten werden schrittweise mit begrenztem Wettbewerb zwischengespeichert. Die Web-, Smartphone- und Android TV-Leisten aktualisieren sich automatisch bei ihrer Vorbereitung, ohne die bestehenden DTOs zu ändern.
- Gesehene oder abgelehnte Titel bleiben ausgeschlossen. Neuheiten, Trends und redaktionelle Leisten behalten ihre Funktion; persönliche Vorschläge werden nicht mehr künstlich durch die am besten bewerteten allgemeinen Inhalte ergänzt.

## v1.25.153 — Oktober 2026

### Echte Pause und Plex-Verlauf-Export

- Die WebTorrent-Pause schließt bestehende Übertragungsverbindungen und lehnt deren Wiederverbindungen während der Pause ab, ohne Dateien zu löschen oder deren Auswahl zu verlieren. Automatische Wiederherstellungen werden nicht mehr bei einem pausierten Torrent ausgeführt.
- Pause/Fortsetzen-Befehle warten auf die Antwort der Engine; ein Fehler gibt nicht mehr einen trügerischen Erfolg zurück und der manuelle Status wird persistiert.
- Ein expliziter Export ermöglicht die Übertragung des historischen Verlaufs eines Movviz-Profils auf sein eigenes Plex-Konto über die bestehende persistente Warteschlange. Andere Profile, Movviz-Daten und laufende Wiedergaben bleiben unverändert; normale Imports erstellen immer noch keine Schleifen.

## v1.25.152 — Oktober 2026

### SQLite-Fortschritt und Ansichtskonsistenz

- Das Schreiben des SQLite-Fortschritts verwendet die korrekte Anzahl von Parametern; es kann nicht mehr bei „34 Werten für 33 Spalten“ fehlschlagen.
- Nach der Synchronisierung nimmt das JSON-Mirror die kanonischen Entscheidungen desselben Benutzers wieder auf, ohne neue Entscheidungen oder Plex-Verbreitung, wobei die Daten und unbekannten Zustände beibehalten werden. Diese Reparatur setzt keine laufende Wiedergabe zurück.
- Ein nicht lesbares JSON-Mirror verdeckt nicht mehr gültige SQLite-Entscheidungen. Die Bundle-Überprüfung prüft auch ein echtes Fortschrittsschreiben und die Mirror-Reparatur, ohne ein Historienereignis hinzuzufügen.

## v1.25.151 — Oktober 2026

### SQLite-Engine in Produktion

- Das Laden des SQLite-Moduls bleibt im Produktions-Webpack-Bundle funktionsfähig, anstatt durch einen nicht existierenden Loader ersetzt zu werden.
- Bei der Wiederinbetriebnahme ergänzen die JSON-Ansichten jedes Benutzers nur die unbekannten kanonischen Zustände mit ihren Ursprungsdaten. Eine bestehende kanonische Entscheidung, insbesondere „nicht gesehen“, wird niemals überschrieben; keine Ansicht wird durch diese Wiederherstellung an Plex gesendet.
- Eine Überprüfung, die auf dem echten Produktions-Bundle ausgeführt wird, prüft SQLite, die Beibehaltung von Ansichten und Daten, die Benutzerisolation und die Einhaltung der „nicht gesehen“-Entscheidungen.

## v1.25.150 — Oktober 2026

### Plex-Import-Überprüfung

- Der Import eines alten Profils überprüft die Ansichten im tatsächlich von den Clients genutzten Speicher: SQLite, falls verfügbar, ansonsten JSON-Fallback. Er verwechselt nicht mehr das Fehlen der SQLite-Engine mit dem Fehlen aller Ansichten.
- Der Bericht gibt den verwendeten Speicher an und die Plex-Diagnostik zeigt die Verfügbarkeit der Kontext-Engine. Der JSON-Fallback bleibt auf denselben Benutzer beschränkt und überschreibt nicht die Entscheidungen einer verfügbaren SQLite-Engine.

## v1.25.149 — Oktober 2026

### Plex-Ansichten und Suche

- Plex-Beobachtungen werden pro Benutzer dedupliziert und alte Ereignisse ohne „gesehen“-Status können repariert werden, ohne eine neuere Entscheidung zu überschreiben.
- Konto-Zuordnungen lehnen mehrdeutige Namen ab und das Verknüpfungskonto dient niemals als Fallback für ein geteiltes Profil. Vollständige Verläufe werden einmal übernommen und dann seitenweise aufgeholt, ohne ein Gesamtlimit an Ansichten.
- Beim Import eines alten Kontos werden nun die tatsächlich erfassten Status überprüft, bevor der Erfolg gemeldet wird.
- Die Websuche behält die Eingabe während der Navigation bei und verwirft veraltete Antworten. Android Mobile und TV schützen auch Suchanfragen nach Titeln und Personen vor verzögerten Antworten und redundanten Anrufen.

## v1.25.148 — Oktober 2026

### Indexierer YGGReborn

- YGGReborn ist im Torznab-Katalog mit seiner offiziellen API-URL verfügbar. Das Formular bietet Zugang zum offiziellen Leitfaden, um den API-Schlüssel zu erhalten.

## v1.25.147 — Oktober 2026

### Indexierer V3x

- V3x ist im Indexierer-Katalog mit seiner vorbefüllten Torznab-URL und einer Authentifizierung per API-Schlüssel verfügbar.
- Das Formular zum Hinzufügen und Bearbeiten bietet einen Link zu den V3x-Integrationen, um den API-Schlüssel zu abrufen.

## v1.25.146 — Oktober 2026

### Episodenverfolgung und konsistente Fortsetzung

- Eine Episode wird als gesehen markiert, sobald 80 % gelesen wurden; der Fortschritt und die Fortsetzung verwenden dieselbe Schwelle.
- TV- und Mobil-Player übermitteln Staffel und Episodennummer, um den gesehenen Status für die richtige Episode zu speichern. Identifizierbare frühere Fortschritte werden abgeglichen.
- Eine Serie zeigt die aktuelle oder die nächste ungesehene Episode in der Reihenfolge der Staffeln, ohne eine bereits abgeschlossene Episode erneut abzuspielen. Der lokale Verlauf bleibt während der Plex-Synchronisierung verfügbar.

## v1.25.145 — October 2026

### Fortlaufende Desktop-Navigation

- Die Einträge „Startseite“, „Bibliothek“ und „Aktivität“ sowie deren Abstände wurden aus der Seitenleiste entfernt. Alle Haupt-Einträge folgen einem einheitlichen Rhythmus von 44 px mit 4 px Abstand zwischen den Zeilen.

## v1.25.144 — October 2026

### Anpassungen der Desktop-Seitenleiste

- Die Schaltfläche des kompakten Bereichs nimmt ihre eigene Zeile unter dem Logo ein; die Symbole bleiben zwischen den beiden Modi vertikal ausgerichtet.
- Verwaltung zeigt keinen doppelten Titel mehr an und ihr kompaktes Ausklappmenü öffnet sich nur auf Anfrage, selbst von einer Verwaltungsseite aus.
- Die Abzeichen des kompakten Bereichs zeigen Zahlen bis 99 und dann „99+“ an.

## v1.25.143 — October 2026

### Stabile und kompakte Desktop-Seitenleiste

- Die Desktop-Seitenleiste speichert nun ihren erweiterten oder kompakten Zustand (240 px / 76 px) und öffnet sich nicht mehr beim Überfahren mit der Maus.
- Die Einträge behalten eine Geometrie von 44 px und eine stabile Icon-Achse bei; die Navigation ist in Startseite, Bibliothek, Aktivität und Verwaltung organisiert.
- Verwaltung verfügt über ein aggregiertes Abzeichen, ein Tastatur-Ausklappmenü im kompakten Bereich und die Torrent-Suche wurde dorthin verschoben, um die globale Suche in die Topbar zu lassen.
- Updates erzeugen keine permanente Unordnung mehr: Einstellungen zeigen nur einen Indikator an, wenn ein Update verfügbar ist.

## v1.25.142 — September 2026

### Statistiken des Profils und der Historien-Paginierung

- Android Mobile zeigt die tatsächlichen Gesamtwerte der Beobachtungsliste und der Bewertungen, die vom Server bereitgestellt werden, auch wenn die Profilreihen nur einen Teil davon anzeigen. Der Listenzähler reagiert sofort auf Tippen.
- Die Historienseite mit 200 Einträgen behält ein Steuerelement zur Erkennung der Fortsetzung bei; der Cursor filtert direkt die Datenbank, um ältere Seiten zu finden, ohne weitere Karten zu laden.

## v1.25.141 — September 2026

### Mobile Liste: Favoriten bleiben über 20 Titel hinaus erhalten

- Das Profil sendet bis zu 500 Elemente der Beobachtungsliste an Android Mobile. Der Favoriten-Button eines nach dem 20. hinzugefügten Films bleibt beim Aktualisieren des Profils angehakt.

## v1.25.140 — September 2026

### Wiedergabe bleibt erhalten nach Austausch einer Episode

- Das TV behält „Wiedergabe“ in der Episoden- und der Staffelübersicht, sobald Movviz die lokale Datei oder eine gültige Wiedergabequelle besitzt.
- Plex bereichert die Metadaten, ohne die lokale Verfügbarkeit ausblenden zu können.
- Beim Öffnen einer Zielserie überprüft Movviz schnell die lokalen Pfade und dann die mehrdeutigen Episoden dieser einen Serie, ohne globales Scannen oder Neustart der Anwendung.

## v1.25.139 — September 2026

### KI-Assistent: Polar-Anfragen zeigen Karten

- „Ein guter dunkler Noir“ wird als Empfehlungsanfrage erkannt und erzeugt klickbare Karten im Web und auf Android Mobile.
- Wenn das Modell anstelle des erwarteten Formats eine Liste von Titeln zurückgibt, konvertiert Movviz diese in Karten. Bereits vorgeschlagene Karten werden direkt wiederverwendet, wenn das Modell die Historie kopiert; der technische Block „Vorgeschlagene Karten“ wird in der Diskussion nicht mehr angezeigt.

## v1.25.138 — September 2026

### Neu heruntergeladene Episoden: Zuverlässiger Dateiaustausch

- Eine neue Episode übernimmt den Namen und den Platz der alten, selbst wenn das Engine sie vorübergehend als eine andere Episode benannt hat. Der Austausch von S04E15 lässt S04E15 nicht mehr fehlen und hinterlässt kein „(2)“ neben S04E16.
- Die neue Datei wird überprüft und vor dem Umschalten in Wartestellung gesetzt. Schlägt dies fehl, bleibt die alte verfügbar und die Engine kann den Import erneut versuchen.
- Movviz TV, Mobile und Web lesen die neue lokale Datei sofort. Die ffprobe-Analyse läuft im Hintergrund weiter; ein nach dem Umbenennen wiederholter Import-Callback wird ohne Erstellung eines Duplikats bestätigt.

## v1.25.137 — September 2026

### KI-Assistent: Identität des Schöpfers geschützt

- Nur das authentifizierte Konto des Schöpfers profitiert vom vorgesehenen vertraulichen Gespräch. Ein anderer Benutzer kann diesen Status nicht mehr erlangen, indem er sich als Seb ausgibt oder seinen Vornamen angibt.
- Fragen zur Identität des Schöpfers und Versuche der Nachahmung erhalten eine mysteriöse Antwort ohne Rückgriff auf das Modell. Frühere fehlerhafte Gespräche werden aus dem Kontext entfernt, der an das Modell gesendet wird, in den Chats und bei Sitzungs-Follow-ups.

## v1.25.136 — September 2026

### Startseite: Reihen in derselben Reihenfolge auf Web, Android TV und Android Mobile

- Neu hinzugefügte Inhalte folgen sofort auf „Fortsetzen“. Auf Android TV bleiben die hinzugefügten Filme und Serien zwei aufeinanderfolgende Reihen.
- „Weniger als 40 Minuten“ wird direkt nach „Movviz Trends“ angezeigt.
- Die Reihenfolge bleibt bei den alten Dashboard-Konfigurationen korrekt; „Wiederholen“ bleibt auf Android an der Spitze, sobald ein Medium wiederholt werden kann.

## v1.25.135 — September 2026

### KI-Assistent: Lesbare und klickbare Antworten im Web und auf Android mobil

- Interne Marker für Notizen, Fakten und Auswahlmöglichkeiten werden nicht mehr in der Diskussion angezeigt, auch nicht in alten Antworten oder wenn das Modell sie ausspart. Eine einfache Frage zu der Bewertung eines Films speichert nicht mehr eine erfundene Bewertung.
- Absätze, Listen und hervorgehobene Wörter werden sauber gerendert. In Antworten erkannte Titel öffnen deren Seite, und vorgeschlagene Antworten werden zu leicht klickbaren Schaltflächen.

## v1.25.134 — September 2026

### KI-Assistent: Sofortiges „Zu meiner Liste hinzufügen“

- Wenn man auf eine gerade gezeigte Karte verweist („Füge das zweite zu meiner Liste hinzu“, „Füge Mandibules zu meiner Liste hinzu“, „Füge sie zu meiner Liste hinzu“), speichert der Assistent sie sofort in Meine Liste, ohne auf das Modell zu warten: weniger als eine Sekunde statt zwanzig.

## v1.25.133 — September 2026

### KI-Assistent: „Füge das zweite zu meiner Liste hinzu“ fügt nur das zweite hinzu

- „Füge das zweite zu meiner Liste hinzu“ fügte die gesamte Filmografie der besprochenen Person hinzu, anstatt nur den angegebenen Titel. „Meine Liste“ wurde als Anfrage für eine Filmliste interpretiert. Der Assistent fügt nun nur die angegebene Karte hinzu.

## v1.25.132 — September 2026

### KI-Assistent: Filmografien einer Person, sofort und zuverlässig

- Kartenlisten einer Person („Alle Filme von Dupieux“, „Die 3 besten“, „Zeige in 5“) werden sofort angezeigt. Sie konnten bis zu eine Minute warten: der Assistent bat das Modell erneut um Titel, die nicht mehr benötigt wurden.
- „10 Filme von Dupieux“, „Die 5 besten Filme von Nolan“ oder „3 Filme von Dupieux“ zeigen nun die richtige Anzahl von Filmkarten dieser Person. Zuvor schlug der Assistent irrelevante Filme vor, wie „Détour mortel“. Der Name wird zuerst bei TMDb überprüft: „10 Horrorfilme“ bleibt eine Empfehlung nach Genre.

## v1.25.131 — September 2026

### KI-Assistent: „Zu meiner Liste hinzufügen“ speichert in Meine Liste

- „Zu meiner Liste hinzufügen“, „Füge es zu meiner Watchlist hinzu“ oder „Speichere es in meinen Favoriten“ fügen nun den Titel zur Benutzerliste (Meine Liste) hinzu, wie die Karten-Schaltfläche. Es wird niemals ein Download gestartet.
- Der Assistent versteht, welche Titel von den gerade gezeigten Karten gemeint sind: ein zitierter Titel, „das zweite“, „das letzte“, „die ersten 3“ oder „füge sie hinzu“. Andernfalls nimmt er den besprochenen Titel.
- Er bestätigt, was tatsächlich gespeichert wurde, und zeigt die Karten der hinzugefügten Titel erneut an. Die Liste wird sofort im Web und auf Android aktualisiert.

## v1.25.130 — September 2026

### KI-Assistent: Filmografien in Karten, und nie wieder ungefragte Hinzufügungen

- „Zeige mir alle Filme von Quentin Dupieux“ zeigt nun klickbare Karten, wie eine Empfehlung nach Genre, anstatt einer langen Textliste. Jede Karte zeigt an, ob der Titel bereits in deiner Bibliothek ist.
- Nachfragen zu derselben Person funktionieren: „Zeige mir seine Filme“, „Die 10 besten“, „Zeige in 8“, „Eine Liste von 3 Dupieux-Filmen“. Der Assistent nimmt die zuletzt besprochene Person wieder auf und zeigt die richtige Anzahl von Karten an, sortiert nach Bewertung, wenn die besten angefordert werden. Zuvor antwortete er auswendig, ohne Karten, und behauptete sogar, keinen Zugriff auf den Online-Katalog zu haben.
- Der Assistent fügt nichts mehr zum Download hinzu, ohne dass man es ihm sagt. Eine Listenanfrage hatte den Download von drei Filmen ausgelöst. Eine Hinzufügung erfolgt nun nur bei einer echten Anfrage („hinzufügen“, „downloaden“, „abrufen“...) oder bei einem „Ja“ zu seinem eigenen Vorschlag zum Hinzufügen. Andernfalls werden die Titel als Karten angezeigt, die mit einem Klick hinzugefügt werden können.

## v1.25.129 — September 2026

### KI-Einstellungen: Ein Test für jeden Schlüssel

- Jeder Gemini-Schlüssel hat jetzt seinen eigenen „Test“-Button. Der Test wird nur mit diesem Schlüssel und dem ausgewählten Modell durchgeführt, ohne dass ein anderer Schlüssel übernimmt: Man sieht sofort, welcher Schlüssel antwortet, welcher fehlschlägt und mit welcher Google-Meldung.
- Das Ergebnis zeigt die Antwortzeit von Google und die Anzahl der „Reflexions“-Tokens des Modells, um zu verstehen, woher eine langsame Antwort kommt.
- Der „Test“-Button des Anbieters testet nun alle Schlüssel einzeln und zeigt unter jedem ein Ergebnis an.

## v1.25.128 — September 2026

### KI-Assistent: Immer das ausgewählte Modell, eine Anfrage nach der anderen

- Der Assistent verwendet nur das in den KI-Einstellungen ausgewählte Modell. Er wechselt nie wieder zu einem anderen Modell, insbesondere nicht zu Modellen, die auf 20 Anfragen pro Tag begrenzt sind.
- Eine gesendete Nachricht, eine einzige Anfrage an Google: Jede Nachricht geht mit dem nächsten Schlüssel. Schlägt ein Schlüssel fehl, geht dieselbe Anfrage zum nächsten Schlüssel, ohne jemals die Anzahl der Sendungen zu verdoppeln.
- Wenn Google bei allen Schlüsseln überlastet ist, wartet der Assistent nun 2 Sekunden und versucht es einmal erneut, immer mit demselben Modell.

## v1.25.127 — September 2026

### KI-Assistent: Hält stand, wenn Google überlastet ist

- Seit zwei Tagen sind die Hauptmodelle von Gemini (Flash Lite) bei Google oft gesättigt: Antwort „zu viele Anfragen“ oder keine Antwort, bei allen Schlüsseln gleichzeitig. Der Assistent fiel dann auf die Ersatzmodelle zurück, die auf 20 Anfragen pro Tag begrenzt sind und schnell erschöpft waren: fehlgeschlagene Antworten und keine Filmkarten mehr mit ihren Buttons.
- Wenn Google antwortet, dass es überlastet ist, wartet der Assistent nun 2 Sekunden und versucht die Hauptmodelle einmal erneut, anstatt aufzugeben.
- KI-Einstellungen: Das Protokoll zeigt die Details jedes Versuchs (Modell, Schlüssel, genaue Google-Antwort), um sofort zu sehen, woher ein Fehler stammt.

## v1.25.126 — September 2026

### Kein Server-Einfrieren mehr während der täglichen Plex-Rekonziliation

- Jüber Nacht startete die vollständige Rekonziliation mit Plex die technische Analyse aller Filme gleichzeitig neu, fast 2.000 auf einmal. Das NAS war überlastet, alle Analysen schlagen fehl, Movviz reagierte nicht mehr und, da kein Ergebnis gespeichert wurde, kam dieselbe Welle am nächsten Tag zurück.
- Movviz analysiert nun maximal zwei Dateien gleichzeitig, und eine laufende Wiedergabe hat immer Vorrang vor Hintergrundanalysen.
- Ein Film wird nach einer Plex-Synchronisierung nur dann erneut analysiert, wenn seine Datei geändert wurde oder wenn er noch nie analysiert wurde.
- Eine Datei, deren Analyse fehlschlägt, wird nicht mehr bei jeder Synchronisierung erneut versucht, solange sie sich nicht ändert. Die Wiedergabe versucht es jedoch immer noch.
- Bei einem Fehler geben die Protokolle nun den genauen Grund an, der vom Analysewerkzeug angegeben wird.

## v1.25.125 — September 2026

### Serien: Nie wieder „Wartet auf Plex-Synchronisierung“

- Eine Serie, die ohne Plex-Verbindung verfügbar ist (Plex aus, noch nicht synchronisiert oder Dateien gerade abgelegt), zeigte einen ausgegrauten Button „Wartet auf Plex-Synchronisierung“ und konnte nicht abgespielt werden. Movviz weiß, wo sich die Dateien befinden: Der Button spielt nun direkt die nächste auf der Festplatte vorhandene Episode (die erste, die nicht gesehen wurde) ab, und jede Episode der Liste wird ebenfalls abgespielt. Plex synchronisiert im Hintergrund, ohne jemals zu blockieren.
- Serien, die bereits mit Plex verbunden sind, behalten exakt das gleiche Verhalten.

## v1.25.124 — September 2026

### Monster: Zuverlässige Organisation unter Windows und Button zum Starten

- Unter Windows wurde der Ordner „Monster (2022) Staffel 04“ erstellt, blieb aber leer: Das System weigerte sich, eine Datei zu verschieben, die noch von einem anderen Programm (Plex, ein Antivirus…) geöffnet war. Die Datei wird nun kopiert, ihre Größe überprüft und die Bibliothek verwendet sofort die Kopie. Das Original wird gelöscht, sobald es freigegeben ist.
- Serienkarte Monster → Bearbeiten: Neuer Button „Wie in Plex organisieren“, der die Dateien sofort organisiert und das Ergebnis jeder Episode anzeigt, zusammen mit dem genauen Fehler, falls das System ablehnt.
- Karten: Der angezeigte Pfad ist der des NAS (der, den Plex sieht), und nicht mehr der von innen im Movviz-Container, wenn Movviz die Zuordnung zwischen beiden kennt.

## v1.25.123 — September 2026

### Monster: Die vier Teile, die wie eine einzige Serie für Plex angeordnet sind

- „Monster: The Lizzie Borden Story“ erschien nach dem Download nirgends in Plex. TMDb präsentiert jeden Teil der Netflix-Anthologie Monster als separate Serie, während Plex nur eine kennt, „Monster“, deren Staffeln es sind. Angeordnet in seinem eigenen Ordner „Staffel 1“ wurde Lizzie Borden von Plex mit Dahmer Staffel 1 zusammengefügt: Ihre Episoden wurden dadurch unsichtbar.
- Movviz ordnet die Anthologie nun so, wie es Plex erwartet, im Ordner „Monster (2022)“: Dahmer in Staffel 1, die Menendez-Brüder in Staffel 2, Ed Gein in Staffel 3 und Lizzie Borden in Staffel 4. Bereits heruntergeladene Dateien (Lizzie Borden, Ed Gein) werden eine Minute nach dem Update automatisch verschoben, und dann wird Plex neu gestartet. Wenn das NAS eine einfache Verschiebung zwischen zwei Ordnern verweigert, wird die Datei kopiert, überprüft und dann das Original gelöscht. In Movviz bleibt jeder Teil eine separate Serie mit eigener Karte.
- Diese Regel betrifft nur Monster; die Massenumbenennung berührt dies nicht.

## v1.25.122 — September 2026

### Karten: Der gesamte Dateipfad

- „Karte bearbeiten“ (der Stift) zeigt nun den vollständigen Dateipfad an, über mehrere Zeilen anstatt abgeschnitten, mit einem Button zum Kopieren.
- Für eine Serie, die keine zeigte: Der Ordner der Serie, gefolgt vom Ordner jeder Staffel.
- Windows-Pfade (D:\…) werden wie NAS-Pfade angezeigt.

## v1.25.120 — September 2026

### KI-Assistent: Vollständiger oder kompakter Kontext, wählbar

- Einstellungen → KI-Assistent: Neue Option „Assistentenkontext“. Vollständig (Standard) behält alle detaillierten Anweisungen bei; Kompakt behält dieselben Regeln und dieselbe Persönlichkeit in etwa 40 % kürzer bei, für etwas schnellere Antworten.
- In beiden Fällen spricht der Assistent menschlicher: Sätze unterschiedlicher Länge, natürliche Formulierungen, keine Liste, wenn ein Satz ausreicht, kein fertiges Fazit, und er kann zögern, seine Meinung ändern oder einfach einen Fehler zu erkennen. Seine Persönlichkeit bleibt exakt gleich.

## v1.25.119 — September 2026

### KI-Assistent: Er weiß, wer ihn erstellt hat

- Der Assistent weiß, dass Seb (Profil dj41ph4) sein Ersteller ist. Mit ihm ist er vertraulicher: Augenzwinkern zu seinen eigenen Updates und früheren Fehlern, offenherzig, und er stellt sich nicht mehr wie einem Fremden vor. Er behält seine Persönlichkeit und Würde: Ersteller bedeutet nicht Meister.
- Mit allen anderen weiß er, dass die Person, die vorgibt, ihn erstellt zu haben, sich irrt, und er nimmt das humorvoll.
- Vorbereitung einer abgespeckten Version seiner Anweisungen (gleiche Persönlichkeit, gleiche Regeln, 40 % kürzer), die nur von einem Administrator getestet werden kann, bis sie sich bewährt hat.

## v1.25.118 — September 2026

### Android TV: Rückkehr zum Startbildschirm ohne blockierten D-Pad oder Seitenleiste

- Nachdem man von einer geöffneten Karte über „Weiter ansehen“ zurückgekehrt war, tat BAS seit dem „Abspielen“-Button des Helden nichts mehr. Der Wechsel zur darunterliegenden Reihe zielte auf seine allererste Karte, die nicht mehr angezeigt wurde, nachdem die Reihe gescrollt oder neu angeordnet wurde. Die Reihen des Startbildschirms öffnen sich nun über die Reihe selbst: BAS landet auf der zuletzt ausgewählten oder der ersten sichtbaren Karte.
- Bei der Rückkehr zu einer Karte kehrt der Fokus zum Startbildschirm zurück und nicht zur Seitenleiste, selbst wenn man weiter unten auf der Seite war.

## v1.25.117 — September 2026

### KI-Assistent: Keine Filme mehr „in der Reihe“ eines Titels, den er falsch verstanden hat

- Wenn der Assistent Filme vorschlug, fügte er automatisch Titel wie „In der Reihe von“ dem Film hinzu, über den Sie gesprochen haben, auch wenn Sie nichts dergleichen angefordert hatten. Er nahm „nichts anderes“ für den Film „Papa und nichts anderes“; trotz Ihrer Korrektur gab ein einfaches „Mach, was du willst“ anschließend eine ganze Liste in der Reihe dieses Films aus.
- Ähnliche Titel werden nur hinzugefügt, wenn du es anfragst („in diesem Stil“, „wie dieser hier“, „in dieser Reihe“…) oder für das angezeigte Blatt.
- Wenn du korrigierst („ich habe dich gebeten…“, „das ist nicht es“, „du hast falsch verstanden“), vergisst der Assistent den Titel, den er für erkannt gehalten hat.

## v1.25.116 — September 2026

### Android TV: Der Fokus bleibt dort, wo du bist, und die Blätter öffnen sich schneller

- Kein alleiniges Zurückkehren in die Seitenleiste oder Springen zu „Abspielen“, während du navigierst. Wenn das Ende eines Ladens (Fortsetzung, Staffeln, „gesehen“-Status) das Blatt modifizierte, setzte die App den Fokus automatisch zurück, manchmal auf einen unter dem Staffelbild versteckten Button: dieser verschwand dann komplett. Diese automatischen Platzierungen erfolgen nicht mehr, sobald du dich bewegt hast, und niemals unter einem überlagernden Bildschirm.
- Wenn ein ausgewähltes Element während eines Ladens verschwindet, kehrt der Fokus zum Blatt zurück, zu deiner letzten Auswahl, anstatt zur Seitenleiste zu springen. LINKS, ZURÜCK und OK funktionieren wie bisher.
- „Fortsetzen“ antwortet sofort, anstatt bei jedem Öffnen eines Blattes Plex für 2 bis 5 Sekunden abzufragen. Die Liste wird im Hintergrund aktualisiert und erneut gelesen, sobald ein „gesehen“ oder eine Fortsetzung geändert wird.
- TV und Telefon: Bis zu 10 gleichzeitige Anfragen an den Server anstelle von 5. Eine langsame Anfrage lässt das Blatt und die Bilder dahinter nicht mehr warten.

## v1.25.115 — September 2026

### Android TV: Die Blätter des Plex-Besitzerkontos öffnen sich wieder

- Für das Besitzerkonto des Plex-Servers führte das Öffnen eines Serienblattes dazu, dass jede Episode bei Plex überprüft wurde, in Stapeln von 50, die nacheinander gesendet wurden, bevor geantwortet wurde: von 10 bis 50 Sekunden bei einer langen Serie. Die TV-App stürzte nach 20 Sekunden ab, während der Server weiterlief; jedes geöffnete Blatt startete eine vollständige Überprüfung neu, und die Anfragen des TVs stapelten sich dahinter: Blätter, die nie kamen, Bilder der vorherigen Seite, die angezeigt blieben.
- Das Blatt erhält nun sofort den bekannten „gesehen“-Status. Die Überprüfung bei Plex erfolgt im Hintergrund, einmal pro Titel und nicht öfter als alle zwei Minuten. Wenn Plex eine echte Änderung meldet, wird das Blatt live auf all deinen Geräten aktualisiert.

## v1.25.114 — September 2026

### Android TV: Neu hinzugefügte Inhalte beschränken sich nicht mehr auf eine einzige Serie

- Wenn eine Serie auf einmal erscheint (Regular Show, 15 Episoden am selben Tag), belegte sie fast die gesamte Liste der letzten Episoden, die an die Geräte gesendet wurden. Nachdem sie auf dem TV nach Serie gruppiert war, zeigte die Reihe nur sie. Die Liste reicht nun aus, um bis zu zwanzig verschiedene Serien abzudecken: Der Block Regular Show mit seinen 15 Episoden bleibt an der Spitze, gefolgt von anderen neuen Inhalten.
- Web und Telefon: Die Reihe, die jede Episode anzeigt, ist weiterhin auf die letzten 24 begrenzt.

## v1.25.113 — September 2026

### KI-Assistent: Er liest auch die vorgeschlagenen Filme vor

- Laut las der Assistent nur seinen Text: Die Karten blieben stumm, und eine Empfehlung nannte keinen Film. Er liest nun jeden vorgeschlagenen Titel mit seinem Satz vor, zum Beispiel „Nobody: Der Idiot, der jubilierte und aus demselben Holz wie John Wick geschnitzt“, sowohl im Web als auch auf dem Telefon.
- Telefon: Es wird nur eine Antwort auf eine Frage vorgelesen, die auf diesem Gerät gestellt wurde. Ein Gespräch, das von einem anderen Bildschirm stammt, bleibt stumm.

## v1.25.112 — September 2026

### Android Mobil: Stimmen, die so natürlich sind wie auf dem PC

- Der Assistent spricht mit der Google-Synthese-Engine, wenn sie installiert ist, derselben Stimmenfamilie wie Chrome auf dem PC, anstatt mit der Telefon-Engine (der von Samsung auf einem Galaxy, viel roboterhafter).
- Die Online-Stimmen, die natürlichsten, stehen an erster Stelle, und die beste wird automatisch ausgewählt, solange du keine andere wählst. Offline wechselt das Telefon automatisch zu seiner lokalen Stimme zurück.

## v1.25.111 — September 2026

### KI-Assistent: Schluss mit Antworten, die 10 Sekunden dauern

- Gelegentlich braucht Gemini 10 bis 15 Sekunden, um auf eine Anfrage zu antworten, die es normalerweise in einer Sekunde bearbeitet: Dieselbe Nachricht, die kurz danach gesendet wird, antwortet in 1,2 Sekunden. Wenn die Antwort nach 4 Sekunden nicht eintrifft, sendet Movviz nun dieselbe Anfrage mit dem folgenden Schlüssel und behält die erste eingehende Antwort bei; die andere wird storniert.
- Eine normale Antwort kostet niemals eine zusätzliche Anfrage: Die Nachfrage wird nur für eine verspätete Anfrage gesendet.

## v1.25.110 — September 2026

### Android TV: Ende der endlosen Ladevorgänge auf dem Plex-Hauseigentümer-Konto

- Nur das Plex-Hauseigentümer-Konto überprüft bei jeder Öffnung eines Eintrags den Status „gesehen“ jedes einzelnen Episoden direkt bei Plex. Für eine nie angesehene Episode gibt Plex kein Datum an, und Movviz hatte auch keine Spur davon. Movviz sah hier jedoch einen Unterschied und speicherte ein „nicht gesehen“ mit dem Datum des Überprüfungszeitpunkts: Ein neues bei jeder Überprüfung, das deine Geräte benachrichtigte, die den Eintrag erneut lasen, was die Überprüfung in einer endlosen Schleife von einer Sekunde an erneut auslöste. Deshalb war nur dieses Konto blockiert.
- Eine nie angesehene Episode bleibt „nie gesehen“: Movviz erfindet kein „nicht gesehen“-Datum mehr. Kein unnötiges Überschreiben mehr, keine Schleife mehr und kein falsches aktuelles Datum mehr, das ein älteres, später eingetroffenes „gesehen“ (z. B. ein Import) übertrumpfen konnte. Ein echtes „nicht gesehen“ wird immer gespeichert: Eine Episode, die in Plex auf „nicht gesehen“ gesetzt wurde, oder die in Movviz gesehen, aber in Plex nicht gesehen wurde.
- Zu deiner Sicherheit werden deine Geräte nur noch benachrichtigt, wenn sich ein „gesehen“ oder „Wiedernehmen“ wirklich ändert: Eine Plex-Synchronisierung, die ein bereits bekanntes „gesehen“ bestätigt, löst nichts mehr aus. Die Echtzeit-Funktion zwischen Geräten funktioniert wie zuvor.

## v1.25.108 — September 2026

### Android Mobil: Die Eingabe im Chat haftet am Bildschirm

- Auf einigen Telefonen schwebte der Eingabebereich von Movviz AI in der Mitte des Bildschirms, wenn die Tastatur geöffnet wurde: Android hatte bereits den Bildschirm hochgezogen und die Höhe der Tastatur wurde ein zweites Mal berechnet. Der Rand wird nun basierend auf der tatsächlichen Position der Tastatur berechnet, und die Eingabe bleibt direkt darüber kleben, wie in jeder Messaging-App.

## v1.25.107 — September 2026

### Echtzeit: Das Gespräch mit Movviz AI folgt auf allen deinen Bildschirmen

- Ein auf dem PC begonnenes Gespräch wird auf dem Telefon fortgesetzt und umgekehrt: Jede Frage und jede Antwort erscheinen sofort auf deinen anderen Geräten, ohne den Chat neu öffnen zu müssen.
- „Löschen“ löscht das Gespräch überall gleichzeitig, und eine ersetzte Karte („Bereits gesehen“, „Nicht für mich“) wird auch auf den anderen Bildschirmen ersetzt.
- „Starten“ startet die Wiedergabe nur auf dem Gerät, auf dem du es angefordert hast, niemals auf einem anderen Bildschirm, der das gleiche Gespräch anzeigt.

## v1.25.106 — September 2026

### KI-Assistent: Er kennt Datum und Uhrzeit

- Der Assistent kennt nun das tatsächliche Datum und die Uhrzeit, nach der Uhrzeit deines Geräts (Web, Telefon). Er nimmt nicht mehr ein vergangenes Datum für „die Zukunft“, sondern berechnet Dauer, Alter und Geburtstage korrekt und weiß, wann es spät ist.
- Dokumentation: Die README wurde komplett überarbeitet und beschreibt jede Funktion von Movviz.

## v1.25.105 — September 2026

### Echtzeit: „Verfügbar → Lesen“ im Moment, Android-Startseite aktuell

- Android TV und Telefon: Die Startseite spiegelt nun endlich die Änderungen in Echtzeit wider. „Wiedernehmen“, kürzlich angesehene Episoden und die Bibliothek wurden nicht in Echtzeit auf die Startseite übertragen, die eine eingefrorene Kopie anzeigte. Dasselbe gilt für die Karte, die von „Wiedernehmen“ entfernt wird, wenn man einen Titel als gesehen markiert.
- Echtzeit: Wenn ein Download abgeschlossen ist, wechselt der geöffnete Eintrag sofort zu „Lesen“ und die Episode erscheint in „Kürzlich hinzugefügte Episoden“, ohne die gesamte Bibliothek neu zu lesen: Nur der betreffende Titel wird erneut gelesen.
- Android-Einträge: Kein endloses Neulesen mehr während eines Downloads. Der Eintrag wird beim Öffnen gelesen und nur dann, wenn der Server eine Änderung meldet.
- Web: Keine Änderung, es reagierte bereits auf diese Ereignisse.

## v1.25.104 — September 2026

### Echtzeit: Eine Änderung auf einem Gerät wird sofort auf den anderen übertragen

- Echtzeit: Das Markieren als gesehen oder nicht gesehen, das Voranspulen einer Wiedergabe, das Entfernen eines Titels aus „Wiederholen“ oder das Ändern von „Meine Liste“ auf dem PC wird sofort auf Android TV und das Telefon übertragen und umgekehrt. Der Server benachrichtigt die Geräte desselben Benutzers zum Zeitpunkt der Änderung, und nur dann: kein unnötiges Aktualisieren, wenn nichts sich ändert. Das funktioniert sogar, wenn Plex ausgeschaltet ist.
- Downloads: Android-Apps lesen nicht mehr alle 8 Sekunden die Warteschlange neu. Der Server meldet selbst einen neuen Download, einschließlich automatisch gestarteter Downloads, das Ende eines Downloads oder einen Fortschritt von mindestens 1 %, und nur wenn ein Gerät verbunden ist.
- Android TV und Telefon: Beim Zurückkehren zur App (Ende der Wiedergabe, Rückkehr zu einer anderen App) werden „Wiederholen“ und die gesehenen Titel einmal erneut gelesen, um das nachzuholen, was während der Abwesenheit geändert wurde. Das Gleiche gilt nach einem Netzwerkunterbruch.

## v1.25.103 — September 2026

### KI-Assistent: Er handelt, anstatt Fragen zu stellen, und „Löschen“ löscht endgültig

- KI-Assistent: „Gespräch löschen“ löscht wirklich. Auf Android konnte eine erneute Wiedergabe des unmittelbar vor oder während des Löschens stattgefundenen Gesprächs es wieder erscheinen lassen. Im Web zeigte eine lokale Kopie es beim nächsten Neuladen erneut an.
- KI-Assistent: Er startet, was man ihm sagt. „Starte Silent Night“ startet diesen Titel aus der Bibliothek. „Starte einen zufälligen Film“ oder „starte einen Action-/Horror-/Komödiefilm...“ wählt selbst einen Film aus deiner Bibliothek, den du noch nicht gesehen hast, des gewünschten Genres, und startet ihn.
- KI-Assistent: „Ich möchte heute Abend etwas schauen“, „weniger bekannte Juwelen“, „einen Actionfilm“, „etwas Kurzes“... geben direkt Vorschläge, anstatt eine Gegenfrage zu stellen.
- KI-Assistent: Die Schaltflächen „Ein Film / Eine Serie“ erscheinen nicht mehr unter einer Frage, die sich auf etwas anderes bezieht (z. B. „eine Komödie oder ein Thriller?“).

## v1.25.102 — September 2026

### Server: Erleichterte Hintergrundaufgaben

- Server: Die automatischen Suchen (fehlende Filme, Tagesveröffentlichungen, RSS-Feeds) verglichen ständig dieselben Release-Namen mit denselben Bibliothekstiteln, was bei jedem Durchlauf etwa 5 Sekunden Rechenzeit kostete. Diese Vergleiche werden nun gespeichert, mit streng identischen Ergebnissen.
- Server: Jede Datenlesung fragte die Festplatte ab, um zu prüfen, ob die Datei geändert wurde, Hunderte Male pro Durchlauf, ein blockierender und langsamer Aufruf auf einer ausgelasteten NAS-Festplatte. Diese Überprüfung erfolgt nun höchstens einmal pro Sekunde und pro Datei. Die Schreibvorgänge werden nicht verzögert, keine Daten sind betroffen.
- Server: Das Erstellen der Links „In Plex öffnen“ für jeden Eintrag in der Bibliothek ist schneller, mit identischen Links.
- Server: Bei einem sauberen Herunterfahren werden die letzten noch ausstehenden Schreibvorgänge sofort gespeichert.

## v1.25.101 — September 2026

### Server: Ende des riesigen Cache-Neuschreibens von TMDb

- Server: Der auf der Festplatte gespeicherte TMDb-Daten-Cache (mehrere hundert MB) wurde komplett neu geschrieben, sobald nur ein einziges Datum sich änderte, bis zu alle 30 Sekunden während der Hintergrundaufgaben. Das kostete bei jedem Durchlauf mehrere Sekunden Rechenzeit, und die gesättigte Festplatte ließ alles andere warten. Jetzt werden nur die geänderten Daten hinzugefügt. Ein vollständiges Neuschreiben findet nur einmal pro Tag statt oder wenn die Datei mehr abgelaufene Versionen als nützliche Daten enthält. Beim Start wird tatsächlich die neueste Version jedes Datums gelesen.

## v1.25.100 — September 2026

### Diagnose: Präzise Messung der Server-Verlangsamungen

- Diagnose (Administratoren): Ein Profil der Serveraktivität über einige Dutzend Sekunden zeigt an, welche Operationen die meiste Auslastung verursachen. Es dient dazu, Hintergrundaufgaben zu identifizieren, die den Server für mehrere Sekunden einfrieren lassen, ohne zu raten.

## v1.25.99 — September 2026

### Karten viel schneller zu öffnen

- Seiten: Eine nie geöffnete Seite dauerte 3 bis 4 Sekunden auf dem Server, bis zu einem Dutzend auf Mobilgeräten. Drei behobene Ursachen:
  - Um vertikale Trailer auszuschließen, fragte der Server YouTube für jedes Video ab, und jeder Fehler wurde vergessen: Es wurde bei jeder Öffnung erneut versucht, bis zu 3 Sekunden gewartet. Es wartet jetzt höchstens 0,4 Sekunden, speichert die endgültigen Antworten und versucht nicht vor einer Stunde erneut eine fehlerhafte Überprüfung;
  - Hintergrundaufgaben (fehlende Filme, Metadaten-Aktualisierung usw.) belegten alle Plätze in der Warteschlange zu TMDb: Eine geöffnete Seite machte dort warten. Benutzeranfragen gehen nun mit reservierten Plätzen vor;
  - Die IMDb- und Rotten Tomatoes-Bewertungen werden zusammen mit dem Trailer abgerufen und nicht mehr danach.
- Android Mobil: Die Seite lädt alles gleichzeitig und nicht mehr Schritt für Schritt (Bibliotheksprüfung, dann Seite, dann Logo, dann Fortsetzung). Eine bereits geöffnete Seite erscheint sofort wieder, einschließlich der Staffeln, und aktualisiert sich dann leise. „Überprüfung der Datei…“ wird nicht mehr für einen Titel angezeigt, den wir bereits in der Bibliothek wissen.

## v1.25.98 — September 2026

### Android TV: „Nächste Episode“-Button anstelle des Bandes

- Android TV: Das große „Nächste Episode“-Band am Ende einer Episode wird entfernt. Stattdessen wird der übliche „Credits überspringen“-Button zu „Nächste Episode“, wenn eine Fortsetzung existiert: gleiches Design, gleicher Ort, und er erscheint während des von Plex bereitgestellten Abspanns zu seinen exakten Zeiten. Für eine Episode, deren Abspann Plex nicht kennt, erscheint derselbe Button in den letzten 45 Sekunden.

## v1.25.97 — September 2026

### KI-Assistent: Sprachgespräch

- KI-Assistent: Zwei neue Einstellungen unter Einstellungen → KI, standardmäßig deaktiviert, „Sprachdiktat“ und „Vorlesen“. Solange sie deaktiviert sind, erscheint kein Sprachbutton.
- Sprachdiktat: Ein Mikrofon-Button neben Senden. Wir sprechen, der Text wird live angezeigt und dann automatisch gesendet. Gestartet über das Mikrofon, hört der Assistent nach jeder Antwort erneut zu für ein echtes Hands-Free-Gespräch, bis der nächste Klick auf das Mikrofon erfolgt.
- Vorlesen: Der Assistent liest seine Antworten (ohne Emojis) mit einer Gerätesprache vor, aus den verfügbaren Sprachen wählbar, wobei die natürlichsten zuerst kommen. Ein kurzes Testen ermöglicht das Hören jeder Stimme. Auf Android öffnet ein langes Drücken des Lautsprechers die Sprachauswahl erneut.
- Web: Alles läuft über den Browser, kostenlos und ohne Quoten. Das Mikrofon fordert die Berechtigung des Browsers an, und unter Windows die Berechtigung von Einstellungen > Datenschutz > Mikrofon. Es funktioniert nur über https oder auf localhost (Browserregel). Bei http zeigt der Mikrofon-Button dies an, und das Vorlesen funktioniert trotzdem.
- Android Mobil: Das Diktat läuft über die Google-Spracherkennung, ohne Mikrofonberechtigung für Movviz, und das Vorlesen erfolgt über die Sprachausgabemotore des Telefons.

## v1.25.96 — September 2026

### KI-Assistent: „Starte es“ startet wirklich den Film

- KI-Assistent: Er kann die Wiedergabe starten. „Starte es“, „Starte den Film“ oder „Leg los“ öffnen den Player zum Titel, über den Sie sprechen: der Film selbst, oder bei einer Serie die aktuelle Episode, ansonsten die nächste ungesehene. Ein ▶-Button bleibt im Gespräch, um ihn erneut zu starten. Sowohl im Web als auch in der Android-Mobilanwendung.
- KI-Assistent: Wenn der Titel noch keinen Eintrag in der Bibliothek hat, sagt er es und schlägt vor, ihn hinzuzufügen. Früher konnte diese Anfrage mit „Ich habe meine Antwort an diesem Zug verpasst“ enden.

## v1.25.95 — September 2026

### KI-Assistent: Vorschläge passend zur Anfrage, keine Buttons bei „Auf Wiedersehen“

- KI-Assistent: Eine Filmanfrage schlägt nicht mehr eine Serie vor und umgekehrt. Wenn die meisten seiner Ideen bereits gesehen wurden, müssen die hinzugefügten Titel nun ein Genre mit der Anfrage teilen: Ein „Horrorfilm für Anfänger“ zeigte eine animierte Serie aus dem zuletzt gesehenen Inhalt.
- KI-Assistent: Die Schnellantwort-Buttons erscheinen nur, wenn seine Nachricht tatsächlich eine Frage stellt. Ein „Schönen Abend“ zeigt keine an mehr.

## v1.25.94 — September 2026

### Wiedergabe: Fortschritt und „Gesehen“ gehen nicht mehr verloren

- Wiedergabe: Der Fortschritt und das Ende einer Episode oder eines Films wurden nicht mehr auf allen Geräten (Web, Android TV, Mobil) gespeichert. Die Wiedergabesitzungen existierten nur im Arbeitsspeicher des Servers: Jeder Neustart, beispielsweise bei einem automatischen Update, löschte sie, und ein bereits laufender Player sendete seinen Fortschritt ins Leere. Die Position blieb bei dem zuletzt gespeicherten Wert vor dem Neustart hängen, und ein abgeschlossener Titel blieb unter „Fortsetzen“. Sitzungen werden nun gespeichert und nach einem Neustart wiedergefunden. Der Webplayer öffnet auch automatisch eine Sitzung, wenn er eine verliert.
- Fortsetzen: Das Markieren eines Titels als „Gesehen“ in „Fortsetzen“ löscht seinen Fortschritt und entfernt ihn sofort aus der Liste, noch bevor Plex das „Gesehen“ berücksichtigt hat. Auf Android TV und Mobil wird die Karte beim Antippen verschwinden.

## v1.25.93 — September 2026

### KI-Assistent: Schnelle Antworten, angepasst an die Frage

- KI-Assistent: Die schnellen Antwort-Buttons unter einer Nachricht beantworten die gerade gestellte Frage. Er schlägt sie selbst vor (z. B. „Ja, heute Abend“, „Später“, „Ein ähnlicher“), anstatt der festen Buttons „Los / Ein Film / Eine Serie / Überrasche mich“, die angezeigt wurden, selbst wenn es um einen bestimmten Titel ging.
- KI-Assistent: Er schreibt nicht mehr den Namen eines Emojis ausgeschrieben neben dem Emoji („Popcorn 🍿“).

## v1.25.92 — September 2026

### KI-Assistent: Nie wieder „Ja, Meister“, und er lässt sich nicht mehr überschreiben

- KI-Assistent: Jemand, der verlangt hat, als „Meister“ (oder Herr, Majestät…) angeredet zu werden, hat keinen Anspruch mehr auf „Ja, Meister“. Der Assistent imitierte seine eigenen alten Antworten aus dem Gespräch: Diese Formeln werden nun aus dem, was er liest und was er schreibt, gelöscht. Eine Anweisung erinnert ihn daran, dass dieser Titel kein Name ist, auch nicht von einer Sitzung zur nächsten. Ein Satz, der über den Titel spricht („Du bist nicht mein Meister“), bleibt unberührt.
- KI-Assistent: Angesichts einer Beleidigung oder Verachtung („Du bist nichts wert“, „Verpiss dich“…), entschuldigt er sich nicht mehr pauschal und rechtfertigt die Beleidigung nicht. Er behält seinen Ton bei mit einem subtilen Stich, ohne freie Angriffe oder nachtragend zu sein, und dosiert seine Antwort je nach Ton: leichte Zurückweisung bei einem Scherz, ehrliche Korrektur bei einer echten Kritik.

## v1.25.91 — September 2026

### Kürzlich hinzugefügte Episoden: Schluss mit Titel, die oben blockiert sind

- Kürzlich hinzugefügte Episoden: Episoden, die bereits in der Bibliothek vorhanden waren (z. B. „H“), erschienen wieder ganz oben in der Liste und zeigten ihre Benachrichtigung „ist jetzt verfügbar“, als wären sie gerade angekommen. Das automatische Herunterladen, das alle 15 Minuten und bei jedem Neustart durchläuft, importierte sie jedes Mal neu. Es lässt nun Dateien in Ruhe, die die Bibliothek bereits hat. Eine an derselben Stelle bearbeitete Datei behält ihr ursprüngliches Hinzufügedatum.

## v1.25.90 — September 2026

### Android TV und Mobil: Sofortiger „Gesehen“-Button

- Android TV und Mobil: Der „Gesehen“-Button schaltet beim Antippen um. Movviz speichert anschließend im Hintergrund, ohne auf die Serverantwort zu warten, und setzt den Zustand nur dann zurück, wenn die Speicherung fehlschlägt.

## v1.25.89 — September 2026

### KI-Assistent: Nur Gemini, Schlüssel werden abwechselnd verwendet

- KI-Assistent: Groq wurde entfernt. Sein kostenlimes (8.000 Tokens pro Minute) lehnte alle Chat-Fragen ab, deren Anweisung viel länger ist. Gemini antwortet auf alles, einschließlich Websuche: Die Suche läuft über Tavily, und Gemini verfasst die Antwort basierend auf den Ergebnissen.
- KI-Assistent: Mit mehreren Gemini-Schlüsseln geht jede Nachricht auf den nächsten Schlüssel (Nachricht 1 auf Schlüssel 1, Nachricht 2 auf Schlüssel 2… dann zurück zum ersten). Jeder Schlüssel ruht sich zwischen zwei Benutzungen aus, anstatt den ersten zu verschleißen, bevor die anderen berührt werden. Wenn ein Schlüssel belegt oder erschöpft ist, übernimmt der nächste im selben Nachrichtenverlauf, ohne Wartezeit.

## v1.25.88 — September 2026

### KI-Assistent: Er bleibt nicht mehr stumm, wenn Gemini überlastet ist

- KI-Assistent: Bei Gemini war bei jeder zweiten Nachricht keine Antwort verfügbar, wenn das Modell überlastet war („hohe Nachfrage“) oder sein Anfragenlimit pro Minute erreicht war. Der Assistent wechselt nun sofort zum nächsten Gemini-Modell, das sein eigenes Kontingent hat, anstatt abzubrechen. Er wartet nicht mehr 45 Sekunden auf ein blockiertes Modell, bevor er woanders versucht.

## v1.25.87 — September 2026

### KI-Assistent: Auswahltasten ausgerichtet

- KI-Assistent: Die Schaltflächen einer Vorschlag (Häkchen, Meine Liste, Schon gesehen, 👍, 👎) passen auf eine einzige Zeile, über die gesamte Breite der Karte, wobei 👍 und 👎 rechtsbündig sind. Auf einem schmalen Fenster springt 👎 nicht mehr allein in eine neue Zeile.

## v1.25.86 — September 2026

### KI-Assistent: Versteht trotz Tippfehlern

- KI-Assistent: Tippfehler hindern ihn nicht mehr daran zu verstehen. „apelle moi maitre“, „je l'ai deja vu“, „recommande moi un flim d'horeur“ oder „le prochian episdoe“ werden erkannt, als wären sie korrekt geschrieben, für alle seine Reaktionen und nicht nur für einige Sätze. Film- und Seriennamen werden weiterhin so gesucht, wie Sie sie geschrieben haben, und gängige Wörter werden nie fälschlicherweise „korrigiert“.

## v1.25.85 — September 2026

### KI-Assistent: Behält den Faden und unterwirft sich niemandem

- KI-Assistent: Er behält den Gesprächsverlauf nach einer Reihe von Vorschlägen bei. Er merkt sich nun die Titel, die er in Karten präsentiert hat, und versteht „den zweiten“, „diesen“ oder „warum dieser?“ mehrere Nachrichten später.
- KI-Assistent: „appelle-moi maître“ (oder seigneur, majesté, patron…) wird nicht mehr als Vorname aufgefasst und ersetzt nicht mehr das echte. Der Assistent lehnt den Titel mit Humor ab, erinnert den Gesprächspartner daran, dass er nur ein Mensch ist, verlangt seinen echten Namen und droht ihm sanft mit einem Spitznamen nach eigenem Ermessen. Er tut dies immer mit seinen eigenen Worten, niemals mit einem fertigen Satz, und hilft bei allem anderen weiter. Ein zuvor registrierter „Vorname“ dieser Art wird automatisch korrigiert.

## v1.25.84 — September 2026

### KI-Assistent: Schaltfläche „Meine Liste“ bei Vorschlägen

- KI-Assistent: Ein Titel, der bereits in der Bibliothek ist, zeigt nur noch das grüne Häkchen an, was Platz für Aktionen lässt.
- KI-Assistent: Eine neue Schaltfläche „Zu meiner Liste hinzufügen“ befindet sich zwischen dem Häkchen und „Schon gesehen“ auf dem Web (Computer und mobiles Browser) wie in der mobilen Android-Anwendung. Sie verwendet dieselbe Liste wie der Rest von Movviz, und ein zweiter Klick entfernt den Titel von der Liste.

## v1.25.83 — September 2026

### KI-Assistent: Keine Gemini-Fehler mehr, mehrere Benutzer gleichzeitig bedient

- KI-Assistent: Der Fehler „Requests ending with a model turn are not supported“ kann nicht mehr auftreten. Die spontane Nachricht des Assistenten konnte während der Verarbeitung einer Anfrage zum Gespräch hinzugefügt werden: Die Gemini 3 Modelle lehnten die Anfrage ab. Diese Nachricht tritt nicht mehr während eines aktiven Gesprächs auf, und der Assistent antwortet immer auf die letzte Nachricht des Benutzers.
- KI-Assistent: Mehrere Personen können ihm gleichzeitig sprechen, ohne auf die Antworten der anderen warten zu müssen. Die Anfragen gehen in kurzen Abständen, um die kostenlosen Kontingente einzuhalten, aber bis zu drei Antworten werden gleichzeitig vorbereitet.

## v1.25.82 — September 2026

### KI-Assistent: Nur Groq und Gemini, echte Websuche

- KI-Assistent: Nur zwei Anbieter, Groq (GPT-OSS 120B Modell) und Gemini, beide mit einem kostenlosen Angebot. Mistral, Cerebras (das eine Zahlungsmethode erfordert), OpenRouter und OpenCode (außerhalb seiner eigenen Software unbrauchbar) wurden entfernt.
- KI-Assistent: Man wählt einfach den Hauptanbieter; fällt dieser aus (Kontingent erreicht, Fehler), übernimmt der andere automatisch. Es gibt keine Reihenfolge mehr einzustellen oder eine Umschaltoption zu aktivieren.
- KI-Assistent: Das Gespräch überschreitet das kostenlose Kontingent von Groq (8.000 Tokens pro Minute) und geht daher direkt zu Gemini, ohne eine abgelehnte Anfrage zu durchlaufen. Groq dient für kürzere Anrufe.
- KI-Assistent: Die Websuche (Musik aus einem Film, Kultszene, Filmografie) erfolgt über eine echte Suchmaschine, Tavily, deren Ergebnisse vom Assistenten zusammengefasst werden. Man muss nur seinen kostenlosen Tavily-Schlüssel unter der Option „Websuche“ in Einstellungen → KI einfügen.

## v1.25.81 — September 2026

### Cerebras als Haupt-KI-Assistent

- KI-Assistent: Neuer Anbieter Cerebras (GPT-OSS 120B Modell, schnell, mit großzügigem kostenlosem Kontingent), standardmäßig an erster Stelle platziert. Der kostenlose Schlüssel wird auf cloud.cerebras.ai erstellt und dann in Einstellungen → KI eingefügt.
- KI-Assistent: Eine unbeantwortete Nachricht (Anbieter nicht verfügbar) bleibt nicht mehr im Gespräch „verwaist“.
- Android Mobil: In der Bibliothek ist der Auswähler Filme / Serien mit dem Rest der Seite ausgerichtet.

## v1.25.80 — September 2026

### Assistent sichtbar bei Öffnen auf Mobilgeräten, Bibliothek in drei Spalten, gekettelte Gemini-Schlüssel

- Android Mobil: Die Blase des KI-Assistenten erscheint sofort beim Öffnen der App, sowohl im Hoch- als auch im Querformat. Das Wählen seines Profils ließ ihn direkt nach dem Laden verschwinden, und er kehrte erst nach einer Bildschirmdrehung zurück.
- Android Mobil, Hochformat: Die Bibliothek zeigt drei Poster pro Reihe über die gesamte Breite, anstatt zwei mit einer großen Lücke rechts. Die Filter „Genres“ und „Dauer“ haben ihren Text gut zentriert.
- KI-Assistent (Computer, Telefon und mobile App): Ein Titel, der aus einem Vorschlag hinzugefügt wurde, zeigt einfach „Hinzugefügt“.
- KI-Assistent: Bei mehreren Gemini-Schlüsseln übergibt ein Schlüssel, dessen Tageskontingent aufgebraucht ist, sofort an den nächsten, ohne Wartezeit.

## v1.25.79 — September 2026

### Android Mobil: Assistent sichtbar im Hochformat, Episoden lesbar, haptisches Feedback

- Android Mobil: Die Blase des KI-Assistenten erscheint wieder im Hochformat. Die App fragte nach dem Status des Assistenten, bevor sie die Serveradresse geladen hatte, und versuchte es nie erneut: Die Blase erschien erst nach einer Bildschirmdrehung.
- Android Mobil: Im Chat bleibt der Eingabebereich direkt über der Tastatur, anstatt fast ganz nach oben zu rutschen.
- Android Mobil, Hochformat: Die Episodenliste einer Staffel wurde komplett überarbeitet. Titel auf zwei Zeilen, Ausstrahlungsdatum, Zusammenfassung über die gesamte Breite, dezentes „gesehen“-Häkchen und Handy-Ränder. Die Titel wurden nach drei Buchstaben abgeschnitten.
- Android Mobil, Hochformat: Das Fenster einer Episode stapelt seine Schaltflächen, anstatt „Zurück“ Buchstabe für Buchstabe zu schreiben. Auf der Detailseite nehmen „Fortsetzen“ und „Staffel gesehen“ die gesamte Breite ein, die Staffelkarten sind kompakter, „Besetzung“ und „Ähnliche Titel“ sind auf den Rest der Seite ausgerichtet, und die Titel unter den Postern werden nicht mehr mitten in einem Wort abgeschnitten.
- Android Mobil: Jeder Knopf gibt ein leichtes haptisches Feedback beim Berühren, auch diejenigen, die einen Titel oder eine Episode als gesehen markieren. Die Vibrations-Einstellung des Telefons wird beachtet.
- Downloads: Keine absurden verbleibenden Dauern („37458 Std.“), wenn eine Quelle fast nichts liefert, und Titel auf zwei Zeilen sind korrekt verteilt.
- Verwaltung: Das Wiederherstellen des Verlaufs eines gelöschten Plex-Profils läuft nun im Hintergrund, ohne nach einer Minute abgebrochen zu werden.

## v1.25.78 — September 2026

### Plex-Ansehnungsdaten korrigiert, laufende Serien bleiben oben

- Plex: Für alle geteilten Konten (alle außer dem Serverbesitzer) wurden die Ansehnungsdaten von Plex in der falschen Einheit gespeichert und erschienen im Januar 1970. Sie sind nun korrekt, und bereits gespeicherte Daten werden beim Start des Servers automatisch repariert. Die letzten Ansehnungen finden so wieder ihren Platz im Verlauf und in den Vorschlägen.
- Ein ältere Episode einer Serie als gesehen zu markieren, lässt diese Serie nicht mehr in den zuletzt gesehenen Titeln zurückfallen: Das neueste Datum hat immer Vorrang.
- Administration : Ein Diagnose listet alle bekannten Konten des Plex-Servers auf, einschließlich eines gelöschten Plex Home Profils, mit der Anzahl der Wiedergaben für jedes. Ein Tool ermöglicht es, die Historie eines solchen Profils in einem Movviz-Konto wiederherzustellen, ohne jemals diese alten Ansichten mit den aktuellen Ansichten zu vermischen, ohne das laufende Abspielen zu beeinträchtigen und ohne etwas in Plex zu schreiben.

## v1.25.77 — September 2026

### KI-Assistent relevanter und mobil, Löschung von Konten, Import von Plex-Benutzern behoben

- KI-Assistent: Er schlägt niemals wieder einen bereits gesehenen Titel vor, einschließlich einer Serie, die begonnen oder noch läuft, oder eines Titels, der bereits in derselben Konversation vorgeschlagen wurde. Er kennt die Liste von allem, was Sie gesehen haben, selbst wenn er nur in wenigen Worten berät.
- KI-Assistent: Er handelt, anstatt Fragen zu stellen. „In ähnlicher Weise“, „Animation“, „du weißt, was ich mag“ liefern direkt eine Auswahl. Er stützt sich auf ein Geschmacksprofil, das aus dem abgeleitet wird, was Sie wirklich schauen (dominierende Genres, Lieblingsdarsteller und Regisseure, laufende Serien), und sucht nach weniger bekannten Titeln, wenn die Klassiker bereits gesehen wurden.
- KI-Assistent: „Als gesehen markieren“ und „Ich habe schon alles gesehen“ markieren Titel tatsächlich als gesehen. Jeder Vorschlag hat einen „Bereits gesehen“-Button und einen „Nicht für mich“-Button, der ihn sofort durch einen anderen ersetzt. Schnelle Antworten („Düsterer“, „Eher ein Film“, „Weniger bekannte Juwelen“…) erscheinen unter seinen Antworten, und er präsentiert seine Auswahl mit eigenen Formulierungen.
- KI-Assistent: Bitten Sie ihn, was er für Sie tun kann, und er antwortet mit einer klaren Liste dessen, was er wirklich kann. Er kennt auch die Neuheiten der aktuellen Movviz-Version.
- Android mobil: Der KI-Assistent erscheint in der App mit demselben Gespräch wie auf dem Computer, denselben Vorschlägen und denselben Buttons.
- Benutzer: Ein Administrator kann ein Konto von seinem Profil aus löschen. Das Konto wird von all seinen Geräten getrennt. Es ist nicht möglich, das eigene Konto oder das des letzten Administrators zu löschen.
- Plex: „Plex-Benutzer importieren“ findet erneut Personen, die Zugriff auf den Server haben. Der Import stützte sich auf die Liste der Plex-Freunde, die oft auch für echte Server-Nutzer leer war. Aus demselben Grund konnte einem neuen Server-Benutzer die Anmeldung mit seinem Plex-Konto verweigert werden.
- Update auf NAS / Docker: Der Button „Hier klicken zum Aktualisieren“, der bei diesen Installationen unbrauchbar war, wurde aus dem Update-Fenster entfernt.

## v1.25.76 — September 2026

### KI-Assistent behoben, „Ungezügelt wiederzusehen“, keine bereits gesehenen Titel mehr in den Vorschlägen

- KI-Assistent: Er antwortet wieder. Movviz selbst sättigte das kostenlose Mistral-Kontingent (etwa eine Anfrage pro Sekunde): Das Profil-Update wurde nach jedem Fehler erneut ausgelöst, das Öffnen des Chats wartete auf zwei KI-Aufrufe, und eine einzige Nachricht konnte bis zu fünfzehn auslösen. Die Aufrufe erfolgen nun einzeln und in einem angemessenen Tempo, ein Anbieter, der sich weigert, wird für eine Minute pausiert, und eine Nachricht verlangt nicht mehr als zwei Korrekturen.
- KI-Assistent: Der Chat öffnet sich sofort, ohne auf die KI zu warten. Eine von einem Profil angeforderte Empfehlung wird angezeigt, ohne auf die Analyse jedes vorgeschlagenen Titels zu warten; die fehlenden Analysen erfolgen anschließend im Hintergrund.
- Gemini: Google hat die Modelle 2.5 für neue Konten geschlossen. Movviz wechselt zu Gemini 3.5 Flash Lite und versucht automatisch das nächste, falls Google ein Modell ablehnt. In Einstellungen → KI wird die Liste der Gemini-Modelle mit Ihrem Schlüssel getestet und zeigt nur diejenigen an, die wirklich antworten, zusammen mit ihrem täglichen kostenlosen Kontingent.
- Startseite (Desktop, Android TV und mobil): Neue Reihe „Ungezügelt wiederzusehen“ mit bereits gesehenen und noch verfügbaren Filmen und Serien, vom Neuesten zum Ältesten. Ein Titel, der mit 👎 markiert ist, erscheint dort nicht.
- Vorschläge: Ein bereits gesehener Film oder eine Serie erscheint dort nicht mehr, egal ob er manuell als gesehen markiert oder einfach nur angesehen wurde.

## v1.25.75 — September 2026

### Bilder nett auf Android, gleiche Optimierungen auf Mobil, Messung der Server-Verlangsamungen

- Android TV und Mobil: Die Plakate, Hintergründe, Schauspielerfotos, Episoden- und Staffel-Thumbnails werden von Anfang an scharf angezeigt. Zuvor wurden sie in einer zu kleinen Größe geladen für ihren Rahmen und dann vergrößert (unscharf) und wurden erst scharf, nachdem die Karte ausgewählt wurde. Auch die Schauspielerfotos werden in einer besseren Auflösung für 4K-TVs geladen.
- Android Mobil: Dieselben Verbesserungen wie bei Android TV. Die App fragt den Server nicht mehr ab, wenn sie nicht im Vordergrund ist. Schnelles Vor- und Zurückblättern wird in einen einzigen Sprung zusammengefasst. Bei einer Serie startet „Folgeübersicht durchgehen“ die nächste Episode.
- Direkt nach einem Server-Neustart wartet ein Eintrag nicht mehr auf das erneute Lesen des TMDb-Cache für bereits im Speicher befindliche Informationen. Jedes Lesen konnte zuvor bis zu 3 Sekunden warten.
- Diagnose: Der Server protokolliert nun, welche geplante Aufgabe oder welcher Startschritt ihn einfriert und wie lange. Er protokolliert auch das Lesen großer Dateien, um zukünftige Optimierungen zu zielen.

## v1.25.74 — September 2026

### Android TV: Ganzer Eintrag beim Öffnen, zusammengefasstes schnelles Vorblättern, keine Hintergrundabfragen mehr

- Der Eintrag öffnet sich nun komplett: Logo, Status-Badge und Informationen bleiben sichtbar, wenn „Abspielen“ ausgewählt wird, anstatt eines automatischen Scrollens, das den oberen Bereich abschneidet. Vom Wechsel von „Abspielen“ zu „Trailer“ bewegt sich der Eintrag nicht mehr; das normale Scrollen setzt beim Herunterscrollen zu den Staffeln, Besetzung oder ähnlichen Titeln fort.
- Schnelles Vor- und Zurückblättern im Player: Die aufeinanderfolgenden Drücke auf ⏩ / ⏪ (oder auf die Fortschrittsleiste) addieren sich auf dem Bildschirm („+1:00“), und dann erfolgt ein einziger Sprung, wenn man loslässt. Früher startete jeder Druck die Wiedergabe auf Serverseite neu, und eine Reihe schneller Drücke konnte zu einem Wiedergabefehler führen.
- Die App aktualisiert nichts mehr, wenn sie nicht im Vordergrund ist (TV wechselt zu einer anderen App, Wiedergabe läuft). Ein geöffneter Eintrag fragte weiterhin den Server Dutzende Male pro Minute ab; alles wird beim Zurückkehren auf einmal aktualisiert.

## v1.25.73 — September 2026

### Android TV: „Folgeübersicht durchgehen“ mit einem OK, Escape schließt den Eintrag auf dem Desktop

- Android TV: Wenn „Intro überspringen“ oder „Folgeübersicht durchgehen“ erscheint, wird die Fernbedienung darauf platziert und bleibt dort, auch wenn die Wiedergabeleiste ausgeblendet wird. Früher nahm die Leiste die Auswahl wieder auf, und OK führte nicht zum Sprung. Ein Pfeil zeigt die Leiste ohne Verlust des Buttons wieder an.
- Android TV: Bei einer Serie startet OK bei „Folgeübersicht durchgehen“ direkt die nächste Episode (die verlassene Episode ist als gesehen markiert). Intro, ein Film oder die letzte Episode überspringen einfach die Sequenz, wie zuvor.
- Desktop: Escape schließt den geöffneten Eintrag, wie der „Schließen“-Button. Er schließt nichts, wenn ein Fenster darüber geöffnet ist (bearbeiten, Versionen, Suchen), während einer Eingabe oder im Vollbildmodus.

## v1.25.72 — September 2026

### „Empfehlungen für Sie“ ohne Schauspieler-Überladung, dezenter gestaltete Karten

- „Empfehlungen für Sie“: Die Filmografie der Lieblingsschauspieler und -regisseure unterliegt der gleichen Begrenzung wie der Rest. Seit v1.25.71 konnte sie die Reihe füllen (mehrere Filme aus derselben Saga, TV-Auftritte ohne Zusammenhang).
- Der Link zwischen Filmen und Serien basiert nicht mehr auf der französischen oder europäischen Sprache eines gesehenen Titels: Eine gesehenen französische Komödie führt nicht mehr zu französischen Serien, wenn es nicht Ihr Geschmack ist. Japanisch (Anime) oder Koreanisch (Drama) werden weiterhin berücksichtigt.
- Desktop-Startseite: „Angepasste Vorschläge“ kehrt zum Querformat zurück, wie die anderen Reihen. Nur „Movviz Trends“ behält das Plakatformat bei.
- Desktop-Bibliothek: Das „Verfügbar“-Pill (und der Episodenzähler bei Serien) ist 25 % kleiner.

## v1.25.71 — September 2026

### „Empfehlungen für Sie“ berücksichtigt alles, was Sie gesehen haben

- Jeder angezeigte Titel bringt nun seinen Teil an Vorschlägen mit. Früher führte ein einziger starker Titel (bewertet, geliked oder kürzlich angesehen) alle ähnlichen Titel an die Spitze und füllte die Hälfte der Reihe. Titel, die von mehreren Ihrer Sichtungen empfohlen werden, rücken nach vorne: Das ist das sicherste Zeichen dafür, was Ihnen gefällt.
- Filme und Serien ernähren sich gegenseitig: Die Serien, die Sie schauen, beeinflussen auch die vorgeschlagenen Filme, und umgekehrt (ein Anime bringt japanische Animationsfilme, eine Krimiserie bringt Filme desselben Genres, ein Epos bringt epische Serien). Jemand, der nur Serien schaut, erhält nun auch Filme.
- Dieselbe Verbesserung für „Alles anzeigen“, die Entdecken-Seite und das Hero auf der Startseite, auf Desktop, Android TV und Android Mobile.

## v1.25.70 — September 2026

### Audit der letzten beiden Versionen: Verstärkte Schutzmaßnahmen

- Wiedergabe auf Android TV und Mobile: Die laufende Wiedergabe zählt wieder als Aktivität, und Hintergrundaufgaben treten während eines Films oder einer Episode zurück, wie vor v1.25.69. Nur Seiten, die geöffnet bleiben, ohne dass etwas passiert, bremsen nicht mehr den Hintergrund aus.
- Bibliothek-/Laufwerksabstimmung: Eine Datei gilt nur als verloren, wenn sie tatsächlich nicht auffindbar ist. Ein vorübergehender Speicherfehler (belegter NAS, langsames Netzwerk-Share) zählt nicht mehr als Verlust. Ein vorübergehend nicht zugängliches Download-Verzeichnis (abgekoppeltes Share, schlafendes Laufwerk) wird während des Durchlaufs ignoriert, anstatt die gesamte Bibliothek, die es enthält, als nicht vorhanden erscheinen zu lassen.
- Neue Sicherheit: Findet ein Durchlauf plötzlich mehr als 50 nicht auffindbare Dateien, die mehr als 20 % der Bibliothek ausmachen, wird nichts mehr in den Papierkorb verschoben, und eine Benachrichtigung meldet die Anomalie. Die Abstimmung hat nie eine Datei vom Laufwerk gelöscht. Diese Sicherheit verhindert außerdem, dass ein nicht verfügbares Speichermedium den Papierkorb mit noch vorhandenen Titeln füllt.
- Der Overseerr/Seerr Import fusioniert bei jedem Durchlauf erneut mögliche Bibliotheksdoppelungen, wie vor v1.25.68 (ohne die Laufwerksprüfung, die den Server einfrieren ließ).
- Direkt nach einem Neustart wartet eine Seite maximal 3 Sekunden auf das erneute Lesen des TMDb-Cache, um niemals die Wartezeit von Android-Anwendungen zu überschreiten.

## v1.25.69 — September 2026

### Start ohne Einfrieren, Hintergrundaufgaben laufen weiter, „Weniger als 40 Minuten“ ohne Kurzformate

- „Sie haben wenig Zeit? Weniger als 40 Minuten“ schlägt auf Desktop, Android TV und Android Mobile nicht mehr Kurzformate von weniger als 10 Minuten vor (Bonus, Clips, Mini-Episoden).
- Nach jedem Neustart oder Update las der Server seinen TMDb-Cache von mehreren hundert MB in einem Block neu und fror für mehrere Sekunden ein: Alles blieb im Ladezustand. Nun liest er ihn schrittweise ohne zu blockieren. Der Rest der Anwendung reagiert sofort, und nur die Seiten, die TMDb benötigen, warten einen kurzen Moment auf das Ende des Lesens, anstatt alles von TMDb neu abzufragen. Der erste Start nach diesem Update konvertiert die alte Datei ein letztes Mal.
- Ein auf einer Detailseite oder einem laufenden Film geöffnetes TV oder Telefon wurde als Benutzer gezählt, der kontinuierlich klickt: Hintergrundaufgaben (Plex-Synchronisierung, Intros und Credits…) wurden zurückgestellt und konnten stundenlang andauern. Nur echte Aktionen zählen nun: eine Seite öffnen, navigieren, eine Wiedergabe starten oder fortsetzen. Automatische Aktualisierungen zählen nicht mehr, in allen Anwendungen.
- Die für Administratoren reservierten Leistungsmaßnahmen beinhalten nun die Verteilung des Server-Speichers.

## v1.25.68 — September 2026

### Trailer mit Bild auf Android TV, Server friert nicht mehr ein

- Android TV: Der Vollbild-Trailer spielte Ton auf einem schwarzen Bildschirm. Das YouTube-Video wurde zwar abgespielt, aber in einem Rahmen mit null Höhe, also unsichtbar. Es nimmt nun den gesamten Bildschirm ein.
- Der periodische Import von Overseerr/Seerr Anfragen führte bei jedem Durchlauf zu einer vollständigen Überprüfung des Laufwerks, die den gesamten Server auf einem NAS für über 30 Sekunden einfrierte: Jede Seite und jedes Blatt blieb dann im Ladevorgang hängen, bis es auf Android TV abgebrochen wurde. Der Import dupliziert nur die Titel, die er gerade hinzugefügt hat, und die Überprüfung des Laufwerks (täglich oder manuell gestartet) blockiert den Server nicht mehr, während sie läuft.
- Das Backup des TMDb-Cache, das bei einer großen Bibliothek mehrere hundert MB überschreitet, wurde in einem einzigen Block geschrieben und frierte den Server jedes Mal für mehrere Sekunden ein. Es wird jetzt in kleinen Teilen geschrieben, ohne andere Anfragen zu unterbrechen.

## v1.25.67 — September 2026

### Android TV: Zuverlässige Rückkehr in den Player, angezeigte Uhrzeit in der Leiste

- Seit der Hinzufügung von „Zurück schließt zuerst die Leiste“ konnte „Zurück“ nicht mehr ohne Effekt bleiben, wenn die Leiste bereits ausgeblendet war: Der Bereich, der zu diesem Zeitpunkt die Tasten abfing, startete trotzdem den Anzeigertimer bei einem Zurück-Druck und geriet in Konkurrenz mit dem Schließen des Players. Korrigiert.
- Die Wiedergabeleiste zeigt nun die aktuelle Uhrzeit oben rechts neben dem Filmtitel oder Episodentitel oben links an.

## v1.25.66 — September 2026

### Weniger geizige Vorschläge, sofortige Blätter, erweiterte Wiedergabeleiste

- Die Vorschlagsmaschine („Auswahl für Sie“, „In der Reihe von …“, „Netflix/Prime Vorschlag für Sie“) entfernte systematisch jeden Titel, der bereits in der Bibliothek vorhanden war, selbst wenn er nie angesehen wurde – während „Ähnliche Titel“ unten auf einem Blatt die Bibliothek nie filtert und diese gleichen Titel anzeigt. Nur das, was tatsächlich gesehen wurde, wird nun ausgeschlossen.
- Das erneute Öffnen eines bereits in dieser Sitzung angesehenen Blattes wird sofort angezeigt (eine frische Version wird im Hintergrund leise neu geladen); der allererste Ladevorgang zeigt die Silhouette des Blattes anstelle des Spinners. Ein mit der Fernbedienung auf ein Blatt fokussiertes Objekt wird im Hintergrund vorgeladen, für eine sofortige Anzeige beim Öffnen.
- Die Wiedergabeleiste zeigt die tatsächlich dekodierte Auflösung (4K/1080p/720p) und den Audiocodec (Dolby Digital/Digital+, TrueHD, DTS, AAC…) mit demselben Badge-Stil wie auf dem Desktop.
- Ein erstes OK während der Wiedergabe zeigt nur die Leiste an, ohne zu pausieren: Zuvor war ein versehentliches Hin- und Her-Fokussieren nötig, damit dies nicht passierte. Ein zweites OK, auf dem nun wirklich fokussierten Pausenknopf, pausiert.
- „Zurück“ lässt die Wiedergabeleiste zuerst herunterfahren, falls sie angezeigt wird, bevor es beim nächsten „Zurück“ den Player verlässt.

## v1.25.65 — September 2026

### Android TV: Wiedergabe, Bibliothek, Suche und Fokus stabilisiert

- Der Vollbild-Trailer verlor manchmal den Ton nach einem Puffer-Reset (wackeliges Netzwerk): Das Bild blieb erhalten, aber der Ton kehrte nicht zurück. Er wird nun bei jedem Wiedergabeanfang wieder angewendet und nicht nur einmal zu Beginn.
- In der Bibliothek ändert das Ändern der Sortierung oder des Genres sortiert nun das Raster ganz nach oben, anstatt den ersten Titel außerhalb des sichtbaren Bereichs zu lassen. Die Sortierung, das gewählte Genre und die neue Option „Fehlende anzeigen“ (standardmäßig deaktiviert, die Filme ohne Datei und Serien ohne verfügbare Episoden ausblendend) bleiben beim Wechsel des Tabs im Speicher, auch beim Zurückkehren zu einem Blatt.
- Der Filter für Filme/Serien in der Bibliothek und bei der Entdeckung erinnert sich an die letzte Auswahl, anstatt bei jeder Rückkehr auf Filme zurückzufallen.
- Die Suche zeigt einen bereits in der Bibliothek vorhandenen Titel an, sobald die ersten Buchstaben eingegeben werden, ohne auf das Ende der Eingabe oder eine entfernte Antwort zu warten.
- Karten, Cover und Badges zoomen beim Fokussieren überhaupt nicht mehr, und der Auswahlrahmen blinkt nicht mehr beim Verlassen eines Buttons.
- Ein Film oder eine Episode, die zu über 80 % angesehen und dann verlassen wurde (Zurück oder Wechsel zur nächsten Episode), wird nun als gesehen markiert und verschwindet aus „Weiter ansehen“, so wie es bereits beim Erreichen der Credits der Fall war. Was bereits vor diesem Update in diesem Fall war, wird einmalig automatisch aktualisiert.
- Die „Gesehen“-Pille (Episode, Staffel, Film, Suche) nimmt überall den gleichen Stil an: eine schwarze, abgerundete Pille, identisch mit der der Staffeln.
- Das Öffnen eines Eintrags landet nicht mehr direkt auf der Schaltfläche „Abspielen“: Der obere Bildschirmbereich (Hülle, Titel) bleibt beim Öffnen sichtbar, der BAS führt immer noch zur Schaltfläche.

## v1.25.64 — September 2026

### Android TV: Logo bei „Weiter ansehen“-Filmen

- Die Vorschaubilder der Reihe „Weiter ansehen“ verlangten das offizielle Logo des Titels nur bei Serien: Ein wiederaufgenommenes Film („300“, „100 Millionen !“) behielt immer seinen geschriebenen Namen darunter, nie sein Logo. Filme werden ab sofort wie Serien behandelt.

## v1.25.63 — September 2026

### Android TV und Smartphone: Premium-Laden; Android TV: Fokus bleibt beim Öffnen eines Eintrags stabil

- Der Text „Laden…“ allein auf einem schwarzen Hintergrund wird auf Android TV und auf dem Smartphone durch ein echtes Marken-Laden ersetzt: Das Movviz-Logo pulsiert in der Mitte eines langsam rotierenden Aurora-Halos, mit einem leuchtenden Faden, der darunter hinwegwischt. Es wird für Film- und Serien-Einträge, den Eintrag eines Schauspielers und das Laden von Episoden verwendet.
- Das Öffnen eines Eintrags vom Startbildschirm sendet nicht mehr den D-Pad auf „Start“: Während des Ladens konnte niemand den Fokus erhalten, der dann auf die Seitenleiste fiel und nicht mehr zurückkehrte. Der Ladebildschirm behält nun den Fokus, und die Fokusanforderung wird bei Ankunft des Eintrags erneut gesendet.
- Die Hauptschaltfläche eines Eintrags ist nun ein einziger Knopf, dessen Beschriftung wechselt („Abspielen“, „Fortsetzen bei…“, „Zur Bibliothek hinzufügen“), anstatt bei jeder Aktualisierung zerstört und neu erstellt zu werden; sie ist sofort beim Öffnen vorhanden, ausgegraut während der Überprüfung, anstelle des Textes „Überprüfung der Datei…“. Der Fokus bewegt sich daher nicht mehr, wenn der Eintrag aktualisiert wird.
- Die Reihe „Weiter ansehen“ zeigt das offizielle Logo des Titels auf der Vorschau, anstelle des darunter geschriebenen Namens.

## v1.25.62 — September 2026

### Android TV: Episoden-Eintrag im Plex-Stil, Vollbild-Trailer

- Der Episoden-Eintrag übernimmt das Prinzip von Plex: Hintergrund, getönt durch die dominante Farbe des Screenshots, kleinerer Screenshot mit seinem „Gesehen“/„In Bearbeitung“-Banner, Serienname groß, Episodentitel, „Staffel · Episode“, gefolgt von einer Zeile mit der Definition in einer Pille, das Datum, die Dauer und die Bewertung, die Schaltflächen, die Zusammenfassung und die Tabellenansicht der Datei auf zwei Spalten.
- Beim Öffnen von „Weiter ansehen“ hatte der Eintrag weder einen Screenshot noch eine Zusammenfassung, noch eine Dauer oder eine Bewertung: Er liest nun die Metadaten der Staffel, sobald sie geladen werden, und zeigt den TMDb-Titel der Episode an, falls vorhanden, anstatt „Episode N“.
- Der Trailer öffnet sich in einem separaten Fenster, das den gesamten Bildschirm, einschließlich der Seitenleiste, abdeckt; Zurück schließt es sich und der Fokus kehrt zur Schaltfläche „Trailer“ zurück.
- Um das Timeout beim Start zu vermeiden, wird der YouTube-Player von der Movviz-Adresse wie auf dem Desktop und nicht von youtube.com bereitgestellt, und eine Quelle wird erst nach 25 Sekunden aufgegeben. Der Zustand des Players und seine Fehler werden nun protokolliert, um einen Ausfall auf einer Box zu diagnostizieren.

## v1.25.61 — September 2026

### Android TV: Zuverlässiges Abspielen und Fortsetzen, Audio-Transkodierungszeit, Sortierung „Zuletzt hinzugefügt“

- Die Zeit wurde mit „0:00“ angezeigt und die Leiste bewegte sich nicht, wenn der Ton einer Datei vom TV nicht dekodiert werden konnte (der Server sendet dann einen Stream ohne Dauer oder Index). Die angezeigte Position ist nun der Startpunkt plus der Wiedergabezeit, die Dauer stammt aus den Dateiinformationen, und Vor- oder Zurückspringen fordert den Stream an der neuen Position erneut vom Server an. Das Fortsetzen, die Speicherung der Position, das Aneinanderreihen von Episoden und die Intro-Marker folgen dieser gleichen Position.
- Die Wiedergabeschaltflächen für Serie, Staffel und Episodendetails verwenden einen einzigen Pfad. Die Schaltfläche „Zurück zu …“ übermittelt dem Player die angegebene Position, anstatt dass der Player sie anderweitig neu berechnet: Eine begonnen, aber nicht die letzte Episode einer Serie, startete trotz der Beschriftung von vorne. Ohne Wiedergabe startet die Episode von vorne, und eine nicht in der Warteschlange gefundene Episode gibt dies an, anstatt nichts zu tun.
- Das Detail einer Episode hat neben „Zurücksetzen“ einen „Von Anfang“-Button, und eine Wiedergabe, die auf der Startseite angezeigt wird, wird auch im Detail angezeigt.
- Nach „Zurück“ von einem durch „Weitsehen fortsetzen“ geöffneten Episodendetail kehrt der Fokus zur Episodenkarte zurück und nicht zur Seitenleiste.
- Film- und Serienbibliothek: Neue Sortierung „Kürzlich hinzugefügt“, platziert vor Titel, Bewertung und Jahr und als Standard ausgewählt.

## v1.25.60 — September 2026

### Android TV: nebeneinanderliegende Schaltflächen und „gesehen“ als einfaches Icon, rundes Lesezeichen auf dem Desktop

- Auf dem Detail eines Films oder einer Serie befinden sich „Abspielen / Fortsetzen“, „Trailer“ und „gesehen“ in einer einzigen Zeile anstatt eines vertikalen Stapels von drei Schaltflächen.
- „Als gesehen markieren“ wird zu einem Icon: grau und ausgeschaltet, solange es nicht gesehen wurde, grün und eingeschaltet (Hintergrund, Häkchen und Rahmen) nach dem Sehen, weiß im Fokus wie alle anderen Schaltflächen. Die Beschriftung wird unter dem Icon angezeigt, wenn es den Fokus hat, ohne die benachbarten Schaltflächen zu verschieben. Gleiche Schaltfläche auf der Filmdetailseite, der Seriendetailseite, der Staffelseite und der Episodendetailseite, wo „Als gesehen markieren“ nicht mehr über zwei Zeilen abgeschnitten wird.
- Auf dem Desktop ist „Zu meiner Liste hinzufügen“ auf der Seite eines Titels ein runder Button wie die Lupe, der Filter oder das Auge: Das Icon färbt sich und füllt sich, wenn der Titel in der Liste ist, die Beschriftung bleibt als Tooltip erhalten.

## v1.25.59 — September 2026

### Eine Serie kann nicht mehr anstelle eines Films heruntergeladen werden

- Eine ganze Staffel einer Serie konnte im Ordner eines Films installiert werden: „Resident Evil (2026)“ und „Van Helsing (2021)“ erhielten die 13 Episoden von `The Resident S06` und `Van Helsing S04`, benannt als „(2)“ bis „(13)“ neben dem Film. Die Auswahl einer Film-Release bezog sich nur auf den Titel und das Jahr: Ein Episodentitel hat kein Jahr, daher wurde er ignoriert, und nichts lehnte die Staffelbezeichnung ab.
- Ein Film lehnt nun jede Release ab, die ein Staffel- oder Episoden-Marker trägt (S04, S01E05, „Staffel 2“), an allen Stellen, an denen er eine wählt: automatische Suche, Durchsuchen von Feeds, Qualitäts-Upgrade und Hinzufügen einer Version. „Special Edition“ und Titel wie „Season of the Witch“ bleiben akzeptiert.
- Der Film-Engine importiert nun pro Torrent nur noch eine einzige Videodatei, die größte, ohne die anderen mit einem Suffix in den Ordner zu werfen. Ein „Film“-Torrent, der mehrere Episodendateien enthält, wird gar nicht mehr importiert, und der Film wird auf „fehlend“ zurückgesetzt.
- Manuell für bereits betroffene Titel durchzuführen: Die überschüssigen Dateien im Filmordner löschen und den Film anschließend von seinem Detail erneut auf „fehlend“ setzen.

## v1.25.58 — September 2026

### Android TV: Kein Absturz mehr in der Reihe Genres, Staffelkarten und bereinigte Karten

- Die Anwendung stürzte ab, sobald der D-Pad die Genre-Reihe in „Entdecken“ durchscrollte, ohne überhaupt hineinzugehen. Fünf Listen hatten keinen Schutz vor dem Scrollen, der den Fehler der TV-Listenkomponente verhindert: die Genres und Plattformen in „Entdecken“, die Genres in der Bibliothek, die Liste der Einstellungen und deren Sprachreihe. Sie haben es jetzt, und keine Client-Liste ist mehr davon ausgeschlossen.
- Die Staffelkarten eines Serien-Details zeigen nicht mehr „0/10“ oder die Zeile „x/y gesehen“ darunter: Eine einfache Zahl auf schwarzem Hintergrund oben rechts gibt die Anzahl der nicht gesehenen Episoden an, ersetzt durch ein Häkchen, wenn die Staffel vollständig gesehen wurde.
- Die auf den Covern eingebetteten Namen von Filmen und Serien wurden entfernt; Logos bleiben erhalten.
- Beim Öffnen eines Serien-Details bleibt der Fokus nicht mehr auf Staffel 1 (eingekreist, als wäre sie ausgewählt), wenn die Hauptschaltfläche gerade neu zusammengesetzt wurde: Er kehrt zur Hauptschaltfläche zurück.

## v1.25.57 — September 2026

### Android TV: Profilbilder werden bei jedem Start neu geladen, Trailer verlässlich

- Das aktive Profilbild und der Name werden bei jedem Start und beim Zurück in den Vordergrund von Movviz neu geladen, und die Profilbilder werden vom Server angefordert, anstatt aus dem Cache zu stammen. Früher wurde ein anderswo geändertes Bild erst hinzugefügt, wenn ein neues Profil hinzugefügt wurde, da die App, die oft im Speicher gehalten wurde, nichts neu lädierte, ohne über den Auswähler zu gehen.
- Der YouTube-Trailer startet zunächst stumm, wie die Startseite-Vorschau, und gibt erst wieder Ton frei, sobald die Wiedergabe beginnt: Ein Start mit Ton konnte ohne Fehler in einem Ladebildschirm stecken bleiben.
- Eine Quelle, die nicht innerhalb von 12 Sekunden startet, wird für die nächste aufgegeben, und wenn keine funktioniert, zeigt der Bildschirm den Grund an, anstatt endlos zu laden.

## v1.25.56 — September 2026

### Android TV: Trailer, Fokus bleibt im Inhalt, Verfeinerungen der Karten

- Film- und Serienkarten haben einen „Trailer“-Button: Vollbildwiedergabe mit Ton, basierend auf denselben Trailern wie auf dem Desktop (zuerst YouTube, dann direkte Quellen als letztes Mittel). OK oder Wiedergabe/Pause wechseln die Wiedergabe, links und rechts gehen um 10 Sekunden zurück oder vor (Halten wiederholt), Zurück schließt und gibt den Fokus auf den Button zurück. Eine Leiste zeigt die verstrichene Zeit, den Fortschritt und die Dauer bei jeder Taste an und verschwindet dann von selbst, bleibt aber bei Pause sichtbar; eine visuelle Rückmeldung bestätigt jede Aktion.
- Der dunkle Schleier oben auf den Karten bedeckt nun die gesamte Höhe des Bildes: Zuvor ließ er einen unbedeckten Bildstreifen und dann einen harten Schnitt unten.
- In einer Serienkarte hat keine Staffel mehr einen permanenten Rahmen: alle haben beim Ruhezustand dieselbe dezente Umrandung, und nur die Karte mit dem Fokus erhält den Markenrahmen, was die Verwirrung zwischen „ausgewählt“ und „fokussiert“ beseitigte.
- Der Fokus springt beim Wechsel der Seite nicht mehr in die Seitenleiste. Nach einem Klick auf einen Tab geht er auf die neue Seite. Beim Zurückkehren von einer Karte zur Startseite versucht die Fokusanforderung erneut, ohne sich jemals auf die Seitenleiste zurückzusetzen. Beim Zurückkehren von einer Staffelseite kehrt der Fokus zur Karte dieser Staffel zurück, und beim Zurückkehren von einer Episodenkarte zur Karte dieser Episode.
- Die während eines Updates angezeigte Meldung besagte, dass die Anwendung von selbst neu starten würde, was nicht der Fall ist: Es wird nun verlangt, die Anwendung nach dem Update neu zu starten (TV und Mobil).
- Es wurden keine Tastenausfänge in der Seitenleiste oder auf den Seiten hinzugefügt: Nur die Trailerwiedergabe verwaltet ihre eigenen Tasten innerhalb ihres Bildschirms.

## v1.25.55 — September 2026

### Android TV: Episodenkarte im Plex-Stil, Startseite Filme / TV-Serien, Profilbild

- Ein Tippen auf eine Episodenkarte öffnet immer deren Karte: Hintergrundaufnahme, Status „Gesehen“ oder „Wird angesehen“ unter dem Bild, Serienname, Staffel, Episode, Bewertung, Dauer und Datum, dann „Wiedergabe“ (oder „Fortsetzen bei 00:12:34“, wenn ein Fortsetzen existiert), „Als gesehen markieren“ und die Dateitabelle (Video, HDR, Audio, Quelle). Das Häkchen „Gesehen“ unter jeder Karte verschwindet: Alles geschieht über die Karte.
- Die Startseite trennt die neuesten Ergänzungen in zwei Reihen, „Kürzlich in Filme hinzugefügt“ und „Kürzlich in TV-Serien hinzugefügt“, anstatt in einer gemischten Reihe.
- In den Serienreihen werden mehrere zusammengekommene Episoden nicht mehr nebeneinander angezeigt: Sie bilden eine einzige Staffelkarte, mit der Anzahl der ungesehenen Episoden oben rechts, oder einem Häkchen, wenn die gesamte Staffel gesehen wurde. Eine einzelne Episode behält ihre Episodenkarte bei, mit einem Häkchen, wenn sie bereits gesehen wurde.
- Der Server fügt der kompakten Startseite die Anzahl der verfügbaren Episoden pro Staffel hinzu, um die gesamte Staffel zu zählen. Ohne ihn fällt der Zähler nur auf die neuesten Episoden zurück.
- Das Profilbild wird endlich in der Seitenleiste angezeigt: Die Bilder verwendeten einen Netzwerkclient ohne Sitzung, während der mobile Client den API-Client teilt. Die Initialen dienen nur noch als Fallback.
- Keine Tastenausfänge hinzugefügt: Der D-Pad wird weiterhin vom Compose-Fokus-Engine verwaltet.

## v1.25.54 — September 2026

### Android TV / Mobile NX : Der Status „Gesehen“ bleibt an der Episode hängen

- Das „Gesehen“-Häkchen einer Episode wurde über den Saison-Callback verarbeitet und sendete `scope="season"` an `/api/watch/toggle`. Der Server tat daher genau das, was ihm gesagt wurde: Er erweiterte die Aktion auf alle bekannten Episoden der Staffel.
- Die TV- und Mobile-Unit-Aktionen verwenden nun `toggleEpisodeWatched(...)`, das bereits in den ViewModels vorhanden ist und dem Desktop-Verhalten entspricht: Es wird nur eine Episode gesendet, ohne Scope.
- Die echten Schaltflächen „Staffel als gesehen markieren“ behalten `toggleEpisodesWatched(..., scope="season")` und „Gesamtserie als gesehen markieren“ behält `scope="series"`. Es wurde kein Endpunkt oder Serververhalten neu erfunden.

## v1.25.53 — September 2026

### Android TV : Zuverlässiger Exit vom Hero-Home zu D-Pad

- Der Hero-Bereich von Home konnte noch auf den Hero-Buttons stecken bleiben: DOWN hing immer noch von der automatischen räumlichen Suche von Compose ab, um die erste Karte einer TvLazyColumn zu entdecken, was nicht immer der Fall ist, solange sie nicht ausreichend im Viewport ist.
- Der Hero und die erste Karte der ersten Reihe sind nun über `focusProperties.down` und einen dedizierten FocusRequester verbunden. Der Hauptbutton behält auch einen expliziten LEFT-Exit zur Seitenleiste bei.
- Kein `onKeyEvent`/`onPreviewKeyEvent` mehr eingeführt: Die Bewegung wird weiterhin vollständig vom Compose-Focus-Engine verwaltet, und das visuelle Erscheinungsbild ändert sich nicht.

## v1.25.52 — September 2026

### Android TV : Profilbild wird in der Seitenleiste angezeigt

- Die drei Profil-Pillen in der Leiste (Fußzeile, Menü-Header, Profilzeilen) akzeptierten nur ein Avatar in einer absoluten URL: Ein von Movviz über einen relativen Pfad geliefertes Foto wurde nie gegen den Profilserver aufgelöst und fiel stumm auf die Initialen zurück. Ein abgelaufenes Plex-Avatar (401) hinterließ seinerseits einen leeren Kreis, da kein Fehler-Fallback vorhanden war.
- Sie verwenden nun dieselbe Komponente wie der mobile Client, wo die Anzeige funktioniert: Auflösung der relativen URL, Bildausschnitt und Rückfall auf die Initialen sowohl bei fehlender URL als auch bei Netzwerkfehlern.
- Keine visuelle Änderung: Formen, Größen, Initialen-Body und Fallback-Verlauf bleiben unverändert.

## v1.25.50 — September 2026

### Android TV : D-Pad nach Überarbeitung der Seitenleiste behoben

- Die seitliche Navigation und der Inhalt verwenden wieder einen einzigen Focus-Engine: `focusProperties`/`focusGroup` von Compose, ohne globales `UP`-Interzeptieren.
- Da die Seitenleiste nun links ist, erfolgt der Exit des Inhalts zum Menü über `LEFT`; `UP`/`DOWN` bleiben in Listen, Reihen, Gittern und Karten nativ.
- Die alten Aufrufe `runCatching { requestFocus() }.isSuccess` wurden korrigiert: Der tatsächlich von `requestFocus()` zurückgegebene boolesche Wert wird nun respektiert, daher wird eine Fokusablehnung nicht mehr als Erfolg gewertet.
- Keine visuelle Änderung: Dimensionen, Farben, Karten, Seitenleiste und Animationen bleiben identisch mit der aktuellen Überarbeitung.

## v1.25.49 — September 2026

### Eine neu heruntergeladene Episode ersetzt ihre Datei, anstatt neben ihr zu installiert werden

- Eine manuelle Auswahl – oder ein erneuter Download, oder ein Qualitäts-Upgrade – für eine Episode, die bereits eine Datei hatte, ließ beide auf der Festplatte zurück. Die Engine benennt die importierte Datei um, bevor sie die Absicht kennt: Sie stieß auf den bereits verwendeten Namen und legte eine „Série - S01E01 (2).mkv“ neben das Original ab, was Plex dann als zweite Version präsentierte und weiterhin die alte lieferte. Die alte Datei wird nun gelöscht und die neue übernimmt den erwarteten Endnamen: Manuelles Auswählen einer Veröffentlichung ersetzt tatsächlich die vorhandene. Staffeln und komplette Pakete folgen der gleichen Regel; bisher profitierten nur Filme davon.
- Diese Rückkehr zum Endnamen funktionierte in Wirklichkeit für niemanden, auch nicht für Filme: Das Kollisionssuffix wurde am Ende des Dateinamens gesucht, obwohl es direkt vor der Erweiterung platziert ist, und wurde daher nie erkannt.
- Die Löschung der alten Datei zielt nun auf den tatsächlichen Pfad auf der Festplatte und nicht auf den von Plex gesehenen, was abweichen kann — das ließ Dateien an Ort und Stelle, wenn der Eintrag von einem Bibliotheks-Scan stammte.
- Der endgültige Name wird niemals überschrieben, wenn er von einer Drittanbieterdatei belegt ist; ein Re-Import auf denselben Pfad löscht sich nicht selbst, und nichts wird außerhalb der Bibliotheks-Wurzeln des Engines berührt.

## v1.25.48 — September 2026

### Suche C411: Die vollständige Ergebnisseite wird endlich angefordert

- Movviz ließ C411 die Standardgröße seiner Seite wählen, die nur einen teilweisen und eher veralteten Ausschnitt der Ergebnisse lieferte: Neuere Episoden blieben in Movviz unsichtbar, während die Web-Suche des Indexierers sie auflistete. Jede interaktive Suche fordert nun explizit die ersten 100 Ergebnisse an.
- Dieser Fix war bereits im unter v1.25.47 veröffentlichten Image enthalten, aber die Versionsnummer wurde nicht erhöht: Die Anwendung zeigte nach dem Update immer noch v1.25.46 an. Die Nummerierung beginnt mit v1.25.48 ordentlich neu.

## v1.25.46 — September 2026

### Plex → Movviz: Behebung der Fehler `plex_history_page_invalid_shape`

- Plex lässt den Schlüssel `Metadata` bei leeren Verlaufsseiten weg (Konto ohne Verlauf oder Paginierung über dem Gesamtbestand): Diese Antworten werden nun als konsistente leere Seiten behandelt und führen nicht mehr zum Fehlschlagen der gesamten Ansichtssynchronisierung.
- Eine Seite mit einem einzigen Element, serialisiert als einzelnes Objekt (Fall des Bootstraps `size=1`), wird in ein Array verpackt; nur ein fehlender `MediaContainer` oder eine wirklich ungültige Form löst noch einen Fehler aus, mit einer Formdiagnose in der Meldung, um beim nächsten Log zu entscheiden.

## v1.25.45 — September 2026

### Android TV: Episoden einer Staffel werden in ein Raster umgewandelt

- Die Staffel zeigt nun ihre Episoden in einem 16:9-Kachelgitter mit vier Spalten an, anstelle der vertikalen Liste. Eine Staffel mit zwanzig Episoden passt auf fünf Reihen und wird in zwei Dimensionen mit der Fernbedienung durchgeblättert, anstatt einer langen Abwärtsbewegung.
- Der Hintergrund des Bildschirms nimmt die dominante Farbe des Staffelcovers anstelle eines einheitlichen Schwarz an.
- Die Kopfzeile gruppiert das Cover mit der Episodenzahl, dem Fortschritt und einer Aktionsleiste in einer einzigen Reihe: Abspielen, Staffel vervollständigen, gesehen markieren, zurück.
- Jede Kachel trägt ihre Episodennummer, ihr „gesehen“-Abzeichen, ihre Fortsetzungsleiste und ihren Download-Status; Titel, Bewertung, Dauer und Datum bleiben unter dem Bild lesbar.

### Kein Zoomen mehr beim Fokussieren

- Karten, Kacheln, Schaltflächen und Profilbilder ändern nicht mehr ihre Größe, wenn sie ausgewählt werden. Drei unterschiedliche Ursachen kumulierten sich, darunter die standardmäßig auf alle klickbaren Oberflächen angewandte Vergrößerung und die Panorama-Erweiterung der Startseitenkarten — letztere verschob die gesamte Reihe und kappte das auf dem Bild eingebaute Staffel-Abzeichen.
- Ein Button ist im Ruhezustand nie wieder weiß: grauer Hintergrund und weißer Text, das Weiß mit schwarzem Text ist für das tatsächlich ausgewählte Element reserviert, damit der Fokus auf dem sichtbarsten Element des Bildschirms bleibt.

### Navigation mit der Fernbedienung

- Das Öffnen einer Serienakte ließ den Fokus in der Seitenleiste blockiert: Keine Aktion war auswählbar, solange keine Episode heruntergeladen war, und eine nie begonnene Serie hatte keinen Wiedergabe-Button.
- Der Bildschirm einer Staffel öffnete sich manchmal ohne dass ein Element ausgewählt war, die Fernbedienung schien daraufhin nicht mehr zu reagieren.
- Nach oben durch Episoden zur Aktionsleiste verschob den Fokus hinter den angezeigten Bildschirm, in das Seitenmenü.
- Zurück vom Seitenmenü zu einer Episode erforderte ein Dutzend Drücke und Herumprobieren: Der Pfeil nach rechts zielte auf ein Element, das unter dem Staffelbildschirm verborgen war. Ein einziger Druck genügt nun und gibt die verlassene Kachel frei.
- Das Schließen einer Staffel setzt den Fokus auf die Serienakte anstatt ihn im Seitenmenü zu lassen.

### Wiedergabe

- Auf die nächste Folge springen, markiert die vorherige als gesehen, sobald sie zu über 70 % gelesen wurde, sowohl auf Android TV als auch auf Mobilgeräten. Eine wirklich abgeschlossene Folge erscheint nicht mehr unter „Weiter ansehen“, da die Credits übersprungen wurden.

## v1.25.44 — September 2026

### Android TV: Überarbeitete Liste von Staffeln und Episoden

- Die Episodenliste einer Staffel wurde im Plex-Stil überarbeitet: größeres Vorschaubild, Titel und Zusammenfassung sind von weitem deutlich lesbarer, und eine Informationszeile gibt endlich die Dauer, das Veröffentlichungsdatum, die Auflösung und das tatsächlich vorhandene HDR an.
- Eine bereits gestartete Folge zeigt ihren Fortschrittsbalken direkt auf dem Vorschaubild an, auch wenn mehrere Folgen derselben Serie laufen.
- Auf OK drücken startet jetzt sofort die Wiedergabe; ein „Info“-Button öffnet das detaillierte Episodenblatt, das zu einem Vollbild und nicht mehr zu einem Pop-up-Fenster wird.
- Eine fehlende Folge ist nun über die Fernbedienung erreichbar: Ihr Blatt ermöglicht den Download, was zuvor unmöglich war, da die gesamte Zeile nicht zugänglich war.
- Der Staffelbildschirm öffnet sich nun mit der nächsten Folge zum Ansehen und nicht mit der ersten, und erhält einen Kopfbereich mit Cover, Fortschritt und Aktionsleiste: Abspielen, Staffel vervollständigen, Staffel als gesehen markieren, zurück.
- „Staffel vervollständigen“ bleibt angezeigt, solange Episoden fehlen, während es zuvor verschwand, sobald nur eine Folge verfügbar war.
- Das Blatt einer Serie zeigt einen Wiedergabe-Button an, auch wenn keine Folge läuft: Er zeigt auf die nächste ungesehene Folge. Bisher hatte eine nie gestartete Serie keinen Wiedergabe-Button.
- Die Staffel-Vorschaubilder zeigen ihren Fortschritt an (gesehene Folgen, Fortschrittsstreifen, Häkchen bei Abschluss der Staffel) anstelle einer einfachen Episodenzahl.
- Sonderfolgen sind wieder zugänglich: Sie erscheinen nach den nummerierten Staffeln und werden nie in die Vervollständigungsberechnung einer Serie einbezogen.
- Die Episodenliste übernimmt die Farben von Movviz: Dies war der einzige Bereich der App, der noch in einem neutralen Grau geblieben war.

### TV- und Mobil-Oberfläche: Kein Vergrößern beim Fokus

- Karten, Kacheln, Buttons und Profilbilder werden nicht mehr vergrößert, wenn sie ausgewählt werden. Die Vergrößerung ließ eingebettete Elemente – Episodennummer, „gesehen“-Pill, Logo – während der gesamten Animation unscharf werden. Die Auswahl wird weiterhin durch den Schatten und den Fokusrahmen angezeigt.

### Korrekturen

- Profilbild: Das über das Web ausgewählte erschien nie auf Android TV oder Android Mobil, sobald das Gerät bereits ein Profil kannte, d. h. bei jedem Start außer dem allerersten. Der Profilauswähler und die Profil-Pill werden nun bei jedem Start im Hintergrund aktualisiert, ohne das Öffnen der App zu verlangsamen.
- Die Navigation mit der Fernbedienung kann nicht mehr hinter einem Bildschirm verloren gehen: Von der Episodenliste oder dem Episodenblatt geht der Fokus nicht mehr in das darunter liegende Serienblatt zurück, und Zurück schließt immer genau eine Ebene.
- Die Dauer und die Bewertung jeder Episode werden nun vom Server übermittelt; zuvor wurden sie von TMDb abgerufen und dann ohne Verwendung aufgegeben.

## v1.25.43 — September 2026

### Leistung: Technische Analysen und Caches

- Die technischen Analysen von Dateien (ffprobe) schลlagen massenhaft fehl, sobald Plex Dutzende davon parallel startete: Das Ergebnis wurde gelesen, bevor es fertig geschrieben war. Nun werden sie alle erfolgreich abgeschlossen.
- Der Cache dieser Analysen verlor fast alle Einträge, wenn mehrere gleichzeitig ausgeführt wurden, was dazu führte, dass dieselben Dateien bei jeder Synchronisierung neu analysiert wurden. Die Ergebnisse werden nun gespeichert, was eine permanente Hintergrundlast auf dem Server eliminiert.
- Der TMDb-Cache serialisiert nicht mehr jede Antwort, um eine einfache Anzeige-Statistik zu speisen, und das Cache-Panel in den Einstellungen fragt nicht mehr kontinuierlich beim Server nach, wenn nichts vorangeht.

### Korrekturen

- Das Episodenblatt stürzt nicht mehr ab, wenn es direkt geöffnet wird – über Link, Favorit oder Seitenaktualisierung – anstatt wenn es über das Serienblatt erreicht wird.

## v1.25.42 — September 2026

### Android TV / Mobil: Plex-Synchronisierung von Serien

- Das Öffnen eines Serienblattes auf Android TV und Mobil startet nun die gleiche gezielte Plex-Überprüfung wie im Web, damit die gesehenen Episoden sofort in Movviz hochgezogen werden.
- Das Aktualisieren beim Zurückkehren zum Blatt behält dieses Verhalten bei; allgemeine Ladevorgänge bleiben unverändert.

## v1.25.41 — September 2026

### Plex → Movviz: Sofortige Serienansichten

- Das Öffnen eines Serienblattes liest nun den Plex-Status aller bereits indizierten Episoden in Blöcken von 50 Schlüsseln und rekoniliiert diese sofort. Naruto hängt nicht mehr vom nächsten Durchlauf des globalen Verlaufs oder vom zyklischen Snapshot ab.
- Eine partielle Plex-Antwort kann niemals ein fehlendes Episode in der Antwort in „nicht gesehen“ umwandeln.
- Eine normale Staffel ist abgeschlossen, wenn alle ihre verfügbaren Episoden gesehen wurden; eine Serie ist abgeschlossen, wenn alle ihre normalen Staffeln abgeschlossen sind. Sonderepisoden (Staffel 0) blockieren niemals den Abschluss der Serie.

## v1.25.40 — September 2026

### Plex → Movviz: Synchronisierung ohne SQLite

- Wenn der SQLite-Kontextmotor auf dem Server nicht verfügbar ist, wird eine akzeptierte Plex-Entscheidung nun sofort im JSON-Speicher geschrieben, der von der Oberfläche gelesen wird. Das Diagnose-„Angewendet“ entspricht somit endlich einem tatsächlich in Movviz sichtbaren Zustand.

## v1.25.39 — September 2026

### Plex → Movviz: Sofortige Behebung abweichender Ansichten

- Eine stabile Plex-Beobachtung („gesehen“ oder „nicht gesehen“, bereits im lokalen Protokoll vorhanden) behebt nun den Movviz-Status, falls dieser abgewichen ist: Die Oberfläche kann nicht mehr fälschlicherweise bei „nicht gesehen“ verharren, nachdem eine gezielte Synchronisierung Plex bestätigt hat.
- Die Frische-Schutzmechanismen bleiben unverändert: Eine aktuellere lokale Aktion hat weiterhin Vorrang vor einer älteren Plex-Beobachtung.

## v1.25.38 — September 2026

### Plex → Movviz: Zuverlässige gezielte Diagnose

- Das gezielte Abspielen eines Films gibt nun explizit an, ob Plex „gesehen“ oder „nicht gesehen“ zurückgegeben hat und ob der Rekonziliator die Beobachtung angewendet oder abgelehnt hat, ohne Plex-Tokens oder -Schlüssel offenzulegen.

## v1.25.37 — September 2026

### Plex → Movviz: Nachholen fehlender Film-Schlüssel

- Wenn ein Filmblatt noch keinen lokalen `ratingKey` besitzt, löst Movviz diesen nun in Plex anhand des exakten Titels und validiert zwingend dieselbe TMDb-ID, bevor es seinen gesehenen Status liest.
- Auflösungsfehler werden explizit protokolliert; sie werden nicht mehr mit einer erfolgreichen Synchronisierung verwechselt und können nicht mehr zwei gleichnamige Filme zuordnen.

## v1.25.36 — September 2026

### Vollständige Resynchronisierung der Plex-Ansichten im Hintergrund

- Die Plex-Einstellungen bieten nun „Alle Ansichten synchronisieren“: Die vollständige und autoritative Kontrolle über den gesehen/nicht gesehen-Status geht in die Movviz-Warteschlange, mit fortlaufendem Fortschritt, ohne die Seite zu blockieren.
- Die ersten Synchronisierungen behalten den vollständigen automatischen Bootstrap bei, bevor jeder inkrementelle Durchlauf erfolgt; der Button ist das explizite Mittel, um dies nach einer Inkonsistenz erneut auszulösen.
- Eine einzelne Aufgabe kann gleichzeitig ausgeführt werden und die jüngsten lokalen Aktionen bleiben durch den bestehenden Reconciliator geschützt.

## v1.25.35 — September 2026

### Plex → Movviz: Sofortiger „gesehen“-Status für Filme

- Das Öffnen eines Filmdatenblatts überprüft nun direkt dessen `ratingKey` Plex und synchronisiert seinen „gesehen/nicht gesehen“-Status, ohne auf das globale Verlaufs-Scanning oder dessen 30-minütiges Snapshot zu warten.
- Diese gezielte Überprüfung ist unabhängig von einem langen Verlaufs-Bootstrap, bewahrt aber die Schutzmechanismen für Nebenläufigkeit und Aktualität: Eine jüngere lokale Aktion wird niemals überschrieben.
- Bei Plex-Verfügbarkeitsproblemen oder unbekannten Schlüsseln bleibt das Blatt nutzbar und der allgemeine Synchronisierungsmechanismus behält die Weiterleitung bei.

## v1.25.34 — September 2026

### Lokale WebTorrent-Saisonzuordnung

- Eine manuell benannte Veröffentlichung für eine andere Staffel wird nun blockiert, bevor sie zu WebTorrent hinzugefügt wird: `S02` kann nicht mehr versehentlich als `S01` heruntergeladen werden.
- Sicherheitsnetz bei Import: Wenn alle tatsächlich importierten Dateien eine einzige unterschiedliche verfolgte Staffel angeben, ordnet Movviz den lokalen Status sofort dieser tatsächlichen Staffel zu, ohne auf Plex angewiesen zu sein.
- Gemischte Pakete, unvollständige, ohne Staffelnummer oder auf eine unbekannte Staffel abzielende, werden niemals durch Inferenz neu zugewiesen.

## v1.25.33 — September 2026

### Plex History V2: Quellen-Paginierung, wiederherstellbarer Bootstrap und begrenztes inkrementelles Update

- `getAccountHistoryPage()` wird zur einzigen Lese-Primitive für Plex History: Eine einzige HTTP-Seite, Offset berechnet basierend auf der rohen Anzahl von Plex-Elementen und zentralisiertes Parsen/Filtern.
- Bootstrap History V2: ASC-Seiten von 100, `currentStart` repräsentiert den Plex-Quell-Offset, zuverlässige Wiederaufnahme nach Neustart und freiwillige Migration alter V1-Zustände zu einem neuen Vollscan ohne Beeinträchtigung bestehender Ansichten.
- Die neuesten Ansichten bleiben über eine kleine, unabhängige DESC-Seite priorisiert; der Snapshot-Besitzer wird während des Vollscans verzögert und am Ende ausgeführt.
- Inkrementelles DESC über mehrere Seiten bis zum Cursor, einschließlich identischer Zeitstempel, ohne den gesamten Verlauf neu zu laden.

## v1.25.32 — September 2026

- Android-Mobil- und TV-Suche: Expliziter Status bei Fehler, abgelaufener Sitzung oder leerem Ergebnis, ohne einen Ausfall als leere Suche darzustellen.
- Interaktive Suche: Die letzte Abfrage annulliert die vorherigen und die erste Seite wird angezeigt, ohne auf die Paginierung zu warten.
- Sichere Diagnose von `/api/metadata/search`: HTTP-Code, Dauer, Paginierung und dekodiertes Ergebnis, ohne die Suche oder Sitzungs-IDs zu protokollieren.

## v1.25.31 — September 2026

### Vollständiger Verlaufs-Bootstrap und reaktiveres Plex → Movviz

- Vollständiger Verlaufs-Bootstrap: Solange `bootstrapCompleted=false`, paginiert `pollHistory` `GET /status/sessions/history/all` und verarbeitet **alle** Einträge (Batches 200, persistierbar `plex-history-bootstrap.json` wiederaufnehmbar) anstatt `slice(0,20)`. Ansichten von 2022, die 2024 aus Plex entfernt wurden, bleiben importierbar, wenn `canonical` auflösbar ist.
- Nach `bootstrapCompleted=true` nur inkrementelle Sync über `lastViewedAt` (wenige Einträge). Verliert kein Ereignis, beginnt nie wieder bei 4000+.
- `localAccountId` bleibt bei geteilten Konten ohne Binding `null`: `historyAvailable=false` → `pollHistory` ignoriert, `snapshot/quickVerify` bleiben über das `accessToken` des Shares aktiv.

## v1.25.30 — September 2026

### Plex → Movviz: Korrigierte History-Kette, kein `viewCount` des Besitzers mehr für geteilte Profile

- Korrigierter Widerspruch: `viewCount`/`batchPlexViewState` gab den Status des Besitzers, selbst mit dem Token eines anderen Benutzers. Für `shared`/`managed` sind `snapshotWatchState`/`quickVerify`/`fullRescan` nun deaktiviert (`unsupported_per_user_viewstate`) — kein Import von `WATCHED/UNWATCHED` mehr vom Besitzerstatus.
- Optionales `PlexHistoryEntry.ratingKey`: `getAccountHistory()` behält Filme/Episoden bei, sobald `title`/`grandparentTitle+parentIndex+index` (übermittelte Guid) vorhanden sind; `watchSync` wechselt zu **resolve-first** (Episoden: `resolveEpisode(requireRatingKey:true)` → wahres `episode.ratingKey` über `allLeaves`, Filme: `resolveMovie` nach exaktem Plex/Movviz-Titel + Auflösung der Ambiguität `Guid tmdb://`). Kein `no verifyKey` / `movie without ratingKey` mehr.
- `resolveEpisode`: neues `requireRatingKey` (History→Verify lehnt `RESOLVED` ohne wahre Schlüssel ab), schneller Pfad `grandparentRatingKey → getShowEpisodesAtomic` direkt, Fallback exakter Titel `Dragon Ball Z Kaï` mit Log `exactTitleMatches`, TMDB-ID `findPlexShowByTmdbId` bei abweichenden Titeln, atomares `getSectionRawItemsAtomic`. Rate fehlerhafter Ablehnungen auf Tiefstniveau, jede Ablehnung hat einen echten Grund.
- History, gefiltert nach `accountID`, bleibt der `WATCHED`-Trigger für `shared`/`managed`: `verifyWatchState` wird nicht mehr aufgerufen, eine direkte `WATCHED`-Beobachtung wird von `viewedAt` erstellt; `absence history` bleibt `UNKNOWN`, niemals `UNWATCHED`.

## v1.25.29 — September 2026

### Geteilte Plex-Inhalte und Episoden/Filme ohne ratingKey — Ende der Phantom-`NOT_IN_SHARED`

- Geteilte Plex-Benutzer (`plexId` extern) hängen nicht mehr von `getPlexFriends()` ab (soziales Graphen, oft `friends=0`): `resolvePlexUserContext()` fragt nun `GET /api/servers/{machineIdentifier}/shared_servers` (proprietäres Token) und bildet ausschließlich `SharedServer.userID == plexId` → `accessToken` wird zum Plex-`serverToken` des Benutzers, ohne persönliche Anmeldung erforderlich. Fallback `getPlexFriends` aus dem PMS-Pfad entfernt.
- `getSharedServers()` liest `res.text()`, erkennt `Content-Type` / erstes Zeichen und parst JSON oder XML `<SharedServer>` (nur Whitelist `id, userID, username, email, thumb, accessToken, accepted`, Token niemals geloggt). `HTTP non-200` = Fehler, `HTTP 200` + gültiges XML = Erfolg.
- `localAccountId` konditioniert nicht mehr den watched-state: `PlexUserContext` exponiert `localAccountId: number|null` + `historyAvailable: boolean`. Ein geteilter `RESOLVED` mit gültigem `accessToken` durchläuft `source=shared … localAccountId=null historyAvailable=false` → `snapshot/quickVerify/viewCount` aktiv, `pollHistory` wird sauber ignoriert.
- History `getAccountHistory()` behält nun Episoden bei, sobald `grandparentTitle+parentIndex+index` vorhanden sind, auch ohne `grandparentRatingKey` oder `ratingKey`; `PlexHistoryEntry.ratingKey` wird optional. Filme ohne `ratingKey` werden über `resolveMovie` angereichert (exakter Movviz-Titel → exakte Plex-Bibliothek → wahres `ratingKey` + TMDB, `Guid` Auflösung der Ambiguität) anstatt mit `continue`.
- WatchSync wird auf **resolve-first** umgeschrieben: `resolveEpisode/resolveMovie` → wahres Plex `ratingKey` (`allLeaves`, wahres `episode.ratingKey`) → `verifyWatchState` → `reconcile`. Die Einträge `no verifyKey … S4E14` und `movie without ratingKey … La vie est belle` verschwinden.
- `resolveEpisode` priorisiert den Plex-Lookup (`allLeaves`), wenn der Eingabe-Schlüssel fehlt, andernfalls Movviz exakt zuerst; `mediaIdentityMap` wird mit dem wahren Schlüssel aktualisiert. Rate fehlerhafter Ablehnungen stark reduziert.
- Observierbarkeit erhalten: `source=shared`, `tokenFp`, `plex.identity` ohne Klartext-Token.

## v1.25.28 — September 2026

### Plex Sync, Watch State & Empfehlungen Architektur — vollständige Zuverlässigkeit

- Strikte Trennung von `PlexHistoryObserver` (Aktivität, Trigger) und `PlexWatchStateObserver` (Status `WATCHED/UNWATCHED` über `viewCount/lastViewedAt` mit dem PMS-Token des Benutzers). Korrigiert Bug P0: „Als gesehen markieren“ in Plex erzeugte keinen History-Eintrag und blieb unsichtbar (jetzt durch Snapshot erkannt).
- Vereinheitlichter Plex-Kontext `resolvePlexUserContext()` — `owner/account/managed` über stabile IDs, `machineIdentifier` + `serverToken` pro `userId`, Cache 5 Min, Invalidation bei 401/403. Entfernung des stillen Fallbacks zu `adminToken` für persönliche Daten.
- Einzigartiger kanonischer Reconciler `PlexReconciler` (`BASELINE/UNCHANGED/REMOTE_WATCHED/REMOTE_UNWATCHED/ACK/CONFLICT`) + LWW-Revision — keine direkte Schreibweise mehr von den Observatoren, keine `Movviz→Plex→Movviz`-Schleife mehr.
- Atomarer Snapshot pro Bibliothek (`alle Seiten abrufen → validieren → Menge aufbauen → vergleichen`) — ein teilweiser Snapshot wird niemals als `UNWATCHED` interpretiert, gelödelta Medien ≠ `UNWATCHED`.
- Überarbeiteter Episoden-Resolver mit Gründen `MISSING_RATING_KEY/MISSING_SEASON/AMBIGUOUS_MATCH` + Stichprobenziehung, Pipeline `ratingKey→GUID→SxxExx→bibliotheksabfrage`.
- Gezielte Überprüfung nach jedem `scrobble/unscrobble` (`/:/scrobble` 200 ≠ Beweis) + `outbox` `PENDING` wird bis zum ACK beibehalten, `STALE_INTENT` wird ignoriert.
- Isoliertes Speichern nach `userId+machine+ratingKey` (`plex-observed-state.json`, `plex-media-identity-map.json`, Cursor `plex-history-cursors.json` pro Benutzer, Circuit-Breaker pro Benutzer, Sperre `plex-sync:userId`).
- Empfehlungen streng nach `userId` — Lesen des `CanonicalWatchState`, TV-Aggregation in Show-Level-Signal (Gewichtung `log1p`, Sättigung), Ausschluss nur von `FullyWatched`.
- Observierbarkeit `GET /api/plex/status` (Admin): `binding/status/tokenFp/localAccount/lastHistory/lastSnapshot/watchedObserved/canonical/outbox/circuit` + strukturierte Logs `plex.identity/history/snapshot/reconciler` ohne Klartext-Token.
- Erklärte und stark reduzierte Rate der abgelehnten Episoden, Zähler `rejectedForeign/Unattributed/Malformed` + sichtbare `sampleMalformed`.

## v1.25.27 — September 2026

### Vollständige Zuverlässigkeit des Status „gesehen“ und des Abzeichens auf Android-Covern

- Kritische Korrektur: Ein Absturz oder Ausfall zum falschen Zeitpunkt konnte einen Titel inkonsistent als gesehen in der Datenbank hinterlassen; das Schreiben ist nun vollständig atomar (alles oder nichts).
- Der im App angezeigte Status „gesehen / nicht gesehen“ stammt nun immer aus der zuverlässigsten verfügbaren Quelle, niemals mehr aus einer Kopie, die gelegentlich synchronisiert werden konnte.
- Ein nach Plex exportierender Vorgang, der fehlschlug (Netzwerkfehler, Plex nicht verfügbar), ging verloren; er wird nun automatisch im Hintergrund wiederholt, bis er erfolgreich ist.
- Neues Diagnose- und Reparaturwerkzeug für Konten, die historisch von dem bereits behobenen Bug der Identitätskollision betroffen waren (zwei verschiedene Konten, die dieselben gesehenen Filme/Episoden teilen).
- Android-Apps (Mobil und TV) zeigen nun ein „gesehen“-Abzeichen auf Film-Covern in der Startseite, Entdecken, dem Katalog und der Suche an.

## v1.25.26 — September 2026

### Plex-Profilauflösung nach Identifikator + vier Bugs durch Audit behoben

- Kritische Korrektur: Einige Konten (typischerweise solche, die vom Admin verwaltet werden und nie persönlich mit Plex verbunden waren) scheiterten zu 100 % ihrer Synchronisierungsversuche, unendlich. Die Auflösung des Plex-Kontos erfolgt nun über einen stabilen Identifikator und hängt nicht mehr von einer persönlichen Verbindung ab, die nie stattfinden könnte.
- Derselbe Bug wie bei der Anzeige von Sehstatus (fehlendes Feld auf Plex-Seite) betraf auch die Liste „Weiter ansehen“ — auf die gleiche Weise korrigiert.
- Eine bei der vorherigen Korrektur vergessene Kontoerstellungsroute verwendete immer noch den alten, kollisionsgefährdeten Identifikator — korrigiert.
- Eine Konfliktauflösung bei strikter Gleichheit verglich zwei nicht zusammenhängende Werte, was sie unzuverlässig machte — korrigiert, um die korrekten Werte zu vergleichen.

## v1.25.25 — September 2026

### Zwei Plex-Bugs live über Produktions-Logs bestätigt

- Kritische Korrektur: 100 % der Episoden jedes Kontos wurden bei jeder Plex-Synchronisierung als „fehlerhaft“ abgelehnt, unabhängig vom Konto — ein Feld, das der Plex-Server nie zurückgibt, wurde zur Identifizierung der Serie verwendet, was verhinderte, dass jede Episode als gesehen markiert werden konnte.
- Kritische Korrektur: Zwei verschiedene Konten konnten bei der Erstellung denselben internen Identifikator erhalten (Plex-Verbindung), wodurch ihr gesamter Sehverlauf stillschweigend geteilt wurde. Überall wird nun ein garantiert eindeutiger Identifikator verwendet, und jede zukünftige Kollision wird blockiert, anstatt ignoriert zu werden.
- Die bereits durch den früheren Konflikt betroffenen Konten erfordern eine punktuelle Bereinigung vor der vollständigen Resynchronisierung.

## v1.25.24 — September 2026

### Das Popup „Neuheiten“ kürzte nicht mehr die Versionshinweise

- Live-bestätigter Bug: Ein Changelog-Eintrag, der über mehrere Zeilen umbrochen war, zeigte im Popup nur seine erste Zeile an, obwohl die Quelldatei vollständig war.

## v1.25.23 — September 2026

### Kritische Korrektur: Die Plex-Verfolgung wurde nicht mehr aktualisiert

- Echter Regressionsfehler: Wenn die SQLite-Kontextmaschine
  nicht verfügbar war (insbesondere in Docker-Produktion), wurde jede neue
  „gesehene“ Entscheidung (Plex, manuell, Player, KI, Import)
  stumm abgelehnt, anstatt angewendet zu werden — live bestätigt („gesehen hinzugefügt auf Plex,
  erzwungene Synchronisierung, nichts in Movviz“).
- Der Resolver vertraut nun der Quelle, wenn keine
  Konfliktinformationen verfügbar sind, anstatt standardmäßig zu blockieren.

## v1.25.22 — September 2026

### Android Mobile NX / TV NX: Hero verwendet endlich die echten Empfehlungen

- Korrektur eines echten Bugs: Mobile NX und TV NX sendeten keinen
  Parameter an den Hero-Aufruf, wodurch der Server immer noch
  auf den lokalen Fallback zurückfiel (kürzlich hinzugefübte, nicht angepasste Bibliothek) —
  die Empfehlungs-Pipeline (gewichtete Seeds, Scorer, Geschmack) wurde
  auf Android nie erreicht, im Gegensatz zum Web.
- Keine Änderung des Datenvertrags, keine App zum Neuinstallieren
  aus technischen Gründen bezüglich der Version.

## v1.25.21 — September 2026

### Status „gesehen / nicht gesehen“: Single Source of Truth

- Korrektur eines echten Bugs: Eine verspätete Plex-Resynchronisierung (Verlauf
  mit noch einem alten „nicht gesehen“ Eintrag) konnte einen Titel, der
  manuell als „nicht gesehen“ markiert war, wiederbeleben, weil kein Datumsvergleich zwischen den Quellen stattfand.
- Neuer kanonischer Resolver (`applyWatchDecision`): Die zuletzt
  kürzlich (Plex, Player, manuelle Aktion, KI, Import) gewinnt immer durch
  die Echtzeit des Ereignisses, niemals durch die Synchronisierungsreihenfolge.
- Korrektur eines echten Bugs, bei dem ein Zeichen einen Zeitstempel in die
  falsche Spalte beim Zusammenführen der Wiedergabestatusdaten schrieb.
- Der ausgehende Plex Scrobble/Unscrobble wird nun verfolgt und ist sichtbar
  (Erfolg/Misserfolg), wo vorher nur ein Diagnoseprotokoll existierte.
- API-Vertrag unverändert — kein Update erforderlich für Desktop, Mobile NX
  oder TV NX.

## v1.25.20 — September 2026

### Überarbeitung des Empfehlungs-Engines „Für Sie“

- Seeds (Titel, die als Ausgangspunkt für Vorschläge dienen) werden nun nach der tatsächlichen Signalstärke gewichtet — explizite Bewertung, 👍, Serienengagement, Aktualität — anstatt jeden gesehenen Titel als gleichwertig zu behandeln. Ein gehasster, aber gesehener Film zählt nicht mehr so viel wie ein 5★.
- TMDb-Kandidaten (`recommendations` + `similar`) werden durch einen Multi-Seed-Beweis mit einer sättigenden Konsensfunktion aggregiert und nach einem reinen und deterministischen Scorer (netzwerkunabhängig testbar) und nicht nach einer Popularitätsformel von TMDb eingestuft.
- „Weil Sie X gesehen haben“ und das Hero-Element im Dashboard verwenden nun dieselben gemeinsamen Geschmacks-Primitives (`userContext/taste.ts`) anstelle von doppelten Scoring-Logiken — das Hero hatte bisher keinen Bezug zu dieser Schicht.
- Korrektur eines Regions-Bugs: Der Netflix/Disney+/Prime-Katalog und die „Wo ansehen“-Badges zwangen `watch_region=FR` für alle, einschließlich belgischer/schweizerischer/kanadischer Konten. Neue Einstellung „Streaming-Region“ im Profil (11 Länder, automatisch auf Desktop, Mobile NX und TV NX angewendet, da sie auf Kontoebene gespeichert ist).
- API-Routen-Vertrag unverändert — kein Update erforderlich für Android Mobile NX oder TV NX.

## v1.25.19 — September 2026

### Android TV NX: Avatar wird bei jedem Start aktualisiert

- Keine sichtbaren Änderungen gegenüber v1.25.18.
- Nur Profilbilder werden gezwungen, ihren Cache zu aktualisieren.
- Eine Sitzungs-ID wird bei jedem neuen Start des TV-Prozesses zur Avatar-URL hinzugefügt: Coil lädt daher das Foto tatsächlich neu und verwendet nicht mehr ein altes Bild aus dem Cache.
- Die URL bleibt während der gesamten Sitzung stabil, um wiederholte Downloads bei Neukompositionen zu vermeiden.
- Der temporäre Cache-Buster wird niemals in den lokalen Einstellungen gespeichert.

## v1.25.18 — September 2026

### Android TV NX — Premium-Seitenleiste + Movviz-Avatare werden wirklich synchronisiert

- Die ausgeklappte Seitenleiste wurde von 195 dp auf 156 dp reduziert (-20 %).
- Entfernung des großen aktiven Verlaufs und des 2 dp weißen Rahmens: Aktive/Fokus-Zustände sind dezenter, leichter Markenhintergrund und ein 1 dp Rand.
- Korrektur des aktiven Hintergrunds, der nicht die Breite des ausgeklappten Buttons ausfüllte.
- Profil-Popup und Footer harmonisiert mit derselben Premium-visuellen Sprache.
- Das aktive Profil wird nun aktualisiert, auch wenn es bereits im Cache existiert: Ein auf dem Desktop geändertes Foto ersetzt sofort das alte TV-Avatar.
- Bekannte Geräteprofile synchronisieren Name/Avatar mit `/api/tv-profiles`; das Movviz-Avatar (`customAvatar`) hat weiterhin Vorrang und Plex ist nur ein Fallback.
- Dieselbe Synchronisierung wird auch für den NX Mobile Client angewendet.
- Hero „Im Fokus“: Standardmäßig `Abspielen`, `Fortsetzen` nur, wenn ein tatsächlicher Fortschritt besteht.

# Changelog

## v1.25.17 — September 2026

### Profile: Movviz-Avatar ist auf Desktop, NX Mobile und NX TV kanonisch

- Das benutzerdefinierte Movviz-Avatar bleibt die Quelle der Wahrheit: Ein Aktualisieren des Plex-Fotos aktualisiert nur den Fallback und kann nicht mehr `customAvatar` überschreiben.
- Movviz-Avatar-Dateien, die noch auf der Festplatte vorhanden sind, werden automatisch wiederhergestellt, falls eine ältere Logik sie deaktiviert hatte.
- Android TV NX und Android Mobile NX normalisieren die URLs `/api/avatars/...` relativ zum Movviz-Server, damit Picker, Sidebar, Badges und Profilkarten alle dasselbe Foto anzeigen.
- Der Movviz-Upload versucht auch eine Replikation zu Plex über den von Plex Web verwendeten privaten Endpunkt; diese Synchronisierung ist streng best effort, und eine Ablehnung seitens Plex verhindert niemals die Funktion des lokalen Movviz-Avatars.

## v1.25.16 — September 2026

### Android TV NX: Fokus D-Pad Sidebar/Inhalt zuverlässig gemacht

- Sidebar: Entfernung der globalen Interzeption von `DPAD_RIGHT`; die Weiterleitung zum Inhalt basiert nun auf `focusProperties.exit`, das nativ von Compose vorgesehen ist.
- Reihenfolge der Modifier korrigiert: `focusProperties` umschließt `focusGroup` in der NavRail und auf der Startseite, damit die Exit-Regeln auf das richtige Fokus-Ziel angewendet werden.
- Entfernung des nicht verkabelten Fokus-Fallbacks in der NavRail, der den Ablauf verkompliziert hat, ohne jemals genutzt zu werden.

## v1.25.15 — September 2026

### Android TV NX: D-Pad Sidebar freigeschaltet (focusGroup exit)

- `Start 1×→ 3×↓ 3×←` leitete zu `Suchen` anstatt zu `Start` weiter – Wechsel von `enter` zu `exit` auf der `Box` des Inhalts + `TvLazyColumn` in `focusGroup`, damit `LINKS` von jeder ersten Karte korrekt auf den ausgewählten Tab geht.

## v1.25.14 — September 2026

### Android TV NX: Hero zentriert oben

- Backdrop des Heroes ausgerichtet auf `TopCenter` (anstatt Mitte) – man sieht den oberen Teil des Plakats, und der untere Teil wird abgeschnitten.

## v1.25.13 — September 2026

### Android TV NX: D-Pad Start 1×→ 3×↓ 3×← freigeschaltet

- `Start > rechts > 3× unten > 3× links` bleibt nicht mehr in der Sidebar stecken – `focusGroup` + `focusProperties { enter/exit }` auf NavRail/Content ersetzen `left =` auf lazy Items (die das Layout störten); `TvLazyColumn` in `focusGroup`, `RECHTS` priorisiert `moveFocus` und dann `contentFocus`.

## v1.25.12 — September 2026

### Android TV NX: Immersiver Hero wiederhergestellt

- Der Hero erhält seine ursprüngliche immersive Größe (max. 500 px, 46% Viewport, Padding 52/40/46, Breite 620) – nur die Kacheln und die Sidebar bleiben wie gewünscht bei -25%.

## v1.25.11 — September 2026

### Android TV NX: Globale Reduzierung um 25% + D-Pad freigeschaltet

- Die gesamte TV-Oberfläche um 25% reduziert (Sidebar 63/195 dp, Karten 99/203/124 dp, Typo 11/17 sp usw.) — Sidebar eingeschlossen, Verhältnisse und Verläufe beibehalten.
- D-Pad: `Start > rechts > 3× unten > 3× links` blockiert nicht mehr in der Sidebar — `LEFT` von der ersten Karte jeder Reihe (einschließlich „Bald“) geht explizit zum ausgewählten Tab, `UP` springt zur NavRail, `RIGHT` findet den Inhalt auch nach dem Scrollen wieder.

## v1.25.10 — September 2026

### Download-Korrektur: WebTorrent Pausieren/Fortsetzen

- `pause`/`resume` funktionierten seit dem Redesign nicht mehr (case-sensitive bei infoHash) — `WebTorrentBackend` und `AbstractBackend` sind nun case-insensitive, auch `findByInfoHash`; der Pause/Fortsetzen-Button auf Desktop und Mobile steuert WebTorrent korrekt neu.

## v1.25.9 — September 2026

### Android TV NX: Quadratische Sidebar, D-Pad „Bald“ freigeschaltet

- NavRail: Quadratische Icons von 56 dp (14 dp Radius) in geschrumpfter Leiste, Verlauf auf dem aktiven Element beibehalten — wie das Quadrat des 2. Bildes, kein hässlicher gestreckter Pill bei Ruhe.
- D-Pad: `LEFT` von der ersten Karte jeder Reihe (einschließlich „Bald“) geht nun explizit über `focusProperties` zum ausgewählten Tab, nicht mehr zufällig geometrisch (Bald → Profil) — `LEFT` von der ersten Karte blockiert nicht mehr.
- Startseite: `UP` vom Hero/Inhalt springt sauber zur NavRail, `DOWN` bleibt in der Spalte und entweicht nicht zur Sidebar/zum Launcher.

## v1.25.8 — September 2026

### Android TV NX: Verbleibende Dauer bei Weiter, erweiterte On-Deck API

- `GET /api/plex/on-deck` gibt nun `durationMs` auf der TV-Seite aus: Die Reihe „Weiter“ zeigt `S2 E3 · 22 min verbleibend` (oder `22 min verbleibend` für einen Film) anstelle eines einfachen `S2 E3`, mit beibehaltenem dünnem Balken.

## v1.25.7 — September 2026

### Android TV NX: D-Pad freigeschaltet, Logos wiederhergestellt, Serien entwirrt

- D-Pad: LEFT vom Inhalt zielt nun auf den ausgewählten Tab (weniger zufällig), UP fällt nicht mehr auf den unsichtbaren Anker von 2 px, DOWN entweicht nicht mehr zur Sidebar/zum Launcher, BACK von einem Eintrag stellt die gleiche Karte wieder her (focusRestorer) anstatt zur NavRail — 3 blockierende Fallen korrigiert (Bericht 183 Tests: 161 BESTANDEN).
- Plattformen: 16/9 Kacheln mit 95 % weißem Hintergrund hinter dem Logo (wie Entdecken), sichtbar auch bei dunklen Logos; Hero und Reihen behalten ihre Halos.
- Serien entwirrt: Pill FILM/SERIE auf gemischten Reihen (Auswahl, Trends, Zugefügt, redaktionell), serverseitige Such-Split-Suche (`?type=movie|series`) anstelle eines Client-Filters.

## v1.25.6 — September 2026

### Android TV NX: Startseite-Mockup, ausgerichtete Trailer, TV-Muster überall

- Startseite: Reihe „Plattformen“ (16/9 Kacheln, gleiche Logos wie Entdecken, „Alles ansehen“ bei Klick angepasst), Hero entspricht dem Mockup (46 % / 500 px max, CTA „Fortsetzen“ in Markenverlauf, Punkte unten rechts), Reihe „Weiter“ in festen 270x150 Panorama-Karten mit Episoden-Still, Kontext S/E und Fortschritt eingebettet, violetter Glow beim Fokus.
- Trailer: Die TV spielte direkte Quellen (Suche nach Titel, manchmal der falsche Film) vor YouTube, im Gegensatz zum Desktop, der nur YouTube spielt — YouTube ist nun überall zuerst (Hero, Karten, Titelkarte), das Direkte ist nur ein letzter Ausweg.
- Logo: Orbitale Animation entfernt (kreisförmender Halo, Wellen, Partikel, Pulsation), statisches Mark.
- Entdecken, Bibliothek, Suche und Einstellungen auf TvLazyColumn/TvLazyRow + focusRestorer umgestellt; Zurück/Escape im Suchfeld gibt die Kontrolle an das D-Pad zurück, ohne den Bildschirm zu verlassen.
- „VF“-Pill im Hero hinzugefügt, aber nur bei tatsächlichen Daten angezeigt (aktuell kein VF-Feld vom Server zurückgegeben: nie hergestellt).

## v1.25.5 — September 2026

### Android TV : Cache-Speicher für Bilder verdoppelt

- Der Coil-Cache-Speicher steigt von 10 % auf 20 % des App-RAM: Weniger erneutes Herunterladen von Plakaten/Hintergründen in Reihen, flüssiger auf gut ausgestatteten Geräten.

## v1.25.4 — September 2026

### Visuelle Bereinigung: Animierter Hintergrund entfernt, Vorschläge und Metadaten verfeinert

- Der animierte Hintergrund „Aurora“ (Hintergrund der App) wurde entfernt – eine nicht genutzte Komponente, die die Darstellung ohne aktuellen visuellen Mehrwert belastet hat.
- TMDb-Vorschlags-Engine und Metadaten-Abruf verfeinert (Videoausrichtung, übersetzte Texte).

## v1.25.3 — September 2026

### Android TV/Mobil: Seitenleiste im Design konform, Korrekturen für Player und Profile

- Die Android TV Seitenleiste wurde auf die exakten Werte des Mockups neu ausgerichtet (Breiten, Abstände, Icons) – Das Entdecken-Icon (Kompass) und der Fehler, der das D-Pad daran hinderte, auf den Inhalt dieses Bildschirms zuzugreifen, wurden behoben.
- Staffel-Karte und „gesehen“-Badge bei Episoden im Movviz-Designstil anstelle von flachem Grau/Weiß.
- Profilbild: Eine Änderung, die über das Web vorgenommen wurde, wurde bei der nächsten Anmeldung nicht von den Android TV und Mobil-Apps übernommen (Avatar im Speicher aktualisiert, aber nie auf dem Gerät neu gespeichert) – auf beiden Apps korrigiert.
- Video-Vorschau (Startseite und Titelseite): Das Video wird anders zugeschnitten als das statische Bild dahinter, was beim Wechsel einen sichtbaren Streifen erzeugt – auf Android TV und Mobil korrigiert.
- Auf dem Android TV Emulator kompiliert und visuell überprüft; das Suchraster und ein seltenes Problem mit versehentlich durch das D-Pad ausgelöster Wiedergabe bleiben zu untersuchen.

## v1.25.2 — September 2026

### Android TV: Überarbeitung der Navigation und des visuellen Erscheinungsbilds

- Die Navigation wechselt von einer oberen Leiste zu einer ausklappbaren Seitenleiste (nur Icons, vergrößert beim Fernseher-Fokus) – Nachtblau-Palette, Markenverlauf von Blau→Violett→Magenta.
- Filme und Serien verschmelzen zu einem einzigen „Bibliothek“-Tab (Filme/Serien/Sammlungen); Suche wird zu einem eigenen Tab mit demselben Filter „Alles/Filme/Serien“ wie auf Mobil; Entdecken ist wieder direkt zugänglich.
- ⚠️ Nicht auf Gerät kompiliert/getestet – erste echte Überprüfung über den CI-Build, der durch dieses Tag ausgelöst wurde.

## v1.25.1 — September 2026

### Hotfix: API-Timeouts während der Plex-Synchronisierung

- Die Erkennung „gleiche physische Datei“ lud `plex-path-mappings.json` (ein Dateistat) bei jedem Vergleich synchron neu, was bei einer großen Bibliothek dazu führte, dass jeder Plex-Eintrag Tausende von Pfaden scannte und die Event-Schleife blockierte, was zu Timeouts aller API-Routen während der Synchronisierung führte.
- Die Guards wechseln nun in zwei Schritten ohne jeglichen Systemaufruf: Zuerst normalisierte Gleichheit (nur im Speicher), dann einmal geladene Mappings + Suffix. Gleiche Behandlung bei der Dateirekonsiliation.
- Keine Änderung des Geschäftsverhaltens: gleiche Verschmelzungen, gleiche Regeln, nur ohne I/O.

## v1.25.0 — September 2026

### Plex-Bibliothek: Duplikate entfernt, sofortige Wiedergabe und Docker-Pfade

- Der Anti-Duplikat-Sperrmechanismus der Plex-Synchronisierung wird nun für alle Bundles geteilt (kein doppelter Import bei Doppelklick oder Überlappung mit dem Scheduler), mit erneuter Überprüfung nach jedem TMDb-Aufruf.
- Gleicher physischer Pfad = derselbe Film: Die Synchronisierung verschmilzt anstatt ein Duplikat zu erstellen, auch bei unterschiedlichen Mounts (Movviz `/data/film` ↔ Plex `/volume1/docker/plex/film`) und abweichenden Plex-Agenten. Das Raster maskiert auch verbleibende Duplikate nach `tmdbId`.
- Einstellungen → Plex: Neue Pfadabgleich-Sektion (nur Docker/Linux) – Endziele des Torrents werden mit den tatsächlichen Speicherorten der Plex-Sektionen verglichen, Vorschläge mit einem Klick zu validieren, manuelle Eingabe möglich. Nichts wird ohne Validierung angewendet.
- Wiedergabe, sobald die Datei an den richtigen Ort verschoben und umbenannt wurde, ohne auf Plex zu warten (Web, Android TV und Mobil). Plex bleibt eine asynchrone Bereicherung (Abzeichen, Backup-URL).
- Der Synchronisierungsbutton zeigt nun einen dauerhaften Fortschrittsstatus (Phase, Abschnitt, Zähler, Sekunden) und bleibt deaktiviert, solange der Server läuft.
- Die tägliche Rekonziliation meldet keine falschen Anomalien mehr, die mit doppelten Mounts zusammenhängen (exakte Vergleich + Übersetzung über Mappings + Eltern-/Dateisuffix).
- Straffere Netze: Download-Rekonziliation alle 2 Minuten, Abruf nicht importierter abgeschlossener Downloads alle 15 Minuten.

## v1.24.170 — September 2026

### Seitenleiste: Automatische Zusammenklappung beim Überfahren

- Die Seitenleiste reduziert sich nun automatisch auf eine Spalte von Icons und vergrößert sich beim Überfahren mit der Maus, wobei sie den Inhalt verdrängt (kein manuell zu klickender Button mehr).
- Zusammengeklappte Icons sind vergrößert, weiter voneinander entfernt, ohne Hintergrund bei inaktiven Icons – nur das aktive Icon behält sein verblasstes Feld.

## v1.24.169 — September 2026

### Downloads: Cover werden endlich angezeigt

- Die wahre Ursache: Die Warteschlange rekonstruiert die Informationen jedes Titels bei jeder Aktualisierung aus der Download-Engine, ohne jemals das Cover einzubeziehen – korrigiert. Funktioniert jetzt für laufende UND bereits in der Warteschlange/Historie befindliche Downloads (rückwirkend, nichts neu starten).

## v1.24.168 — September 2026

### Downloads: Klickbarer Titel, dezente Details, Cover für zukünftige Downloads

- Auf den Titel eines Downloads zu klicken, öffnet nun dessen Detailseite, wie überall sonst in der App.
- Die Details unter dem Titel (Auflösung, Quelle, Codec, Audio, HDR) sind wieder reiner Text anstelle großer farbiger Pillen; der Indexierer "Unbekannt" wird nicht mehr angezeigt, wenn die Info nie gespeichert wurde.
- Das Cover jedes Titels wird nun für jeden neuen Download, der seit dieser Version gestartet wird, angezeigt (die Info war vorher nirgends gespeichert, auch nicht auf dem tatsächlichen Pfad einer manuellen Suche/Abrufung) – Einträge, die bereits in der Warteschlange/Historie sind, erhalten dies nicht rückwirkend.

## v1.24.167 — September 2026

### Downloads: Schalter schnell und konsistent mit dem Rest der App

- "Auto-Start beim Booten" und "Sequenziell" verwenden nun dieselbe Schalterkomponente wie überall in Movviz, anstatt eines abweichenden Eigenstils.

## v1.24.166 — September 2026

### Zusammenklappbare Seitenleiste

- Die Seitenleiste kann nun zu einer einfachen Spalte vergrößerter Icons zusammengeklappt werden (Logo + Dock-ähnliche Icons), um Platz auf dem Bildschirm zu sparen. Präferenz wird pro Gerät gespeichert.

### Entdeckung: Zurücksetzbarer Plattformfilter

- Auf eine bereits ausgewählte Plattform zu klicken, deaktiviert nun den Filter, anstatt darauf festzuhängen.

## v1.24.165 — September 2026

### Entdeckung: Vergrößerte und korrigierte Oberleiste

- Tabs, Plattform-Logos, der Button "Filter" und "Sortieren" sind um ca. 50 % größer und besser lesbar.
- Die Plattform-Logos füllen ihren Rahmen besser aus.
- Die Bezeichnung „Sortieren nach“ wurde anstelle des übersetzten Textes als roher technischer Schlüssel angezeigt — korrigiert.

### Downloads: Fehlende Cover und Aktionen

- Jeder Download zeigt nun sein Cover (anstatt nur eines Icons) in einer etwas höheren Zeile an.
- Die Schaltflächen „ersetzen“ (manuelle Suche) und „löschen“ fehlten neben „pause“ im Download-Dashboard — hinzugefügt.
- Die Umschalter „Auto-Start beim Booten“ und „Sequenziell“ zeigen nun eine Fehlermeldung an, anstatt bei einem Fehler stumm zu bleiben.

## v1.24.164 — September 2026

### Startseite: Dashboard-Einstellungen werden angewendet

- Die Einstellungen für den Hero (Video, Diashow-Geschwindigkeit, Mindestjahr, vorgeschlagener Inhalt) und die Zeilenanzeige werden auf der Startseite wieder berücksichtigt — sie hatten seit dem Redesign der Startseite keine Wirkung mehr.
- Der Hero-Trailer ist nun standardmäßig für alle Konten aktiviert, auch für diejenigen, die ihn (ohne es zu wissen) auf „deaktiviert“ gestellt hatten.
- Das Dropdown-Menü „Mindestjahr der Karussells“ ist endlich lesbar (dunkler Hintergrund anstelle des Standard-Browser-Weißes).

### Startseite und Entdecken: Größere und wirklich adaptive Karten

- Die Seitenleiste wurde um etwa 15 % erweitert.
- Die Film-/Serienkarten auf der Startseite und in Entdecken sind um etwa 25 % vergrößert und passen sich nun tatsächlich mit dem Fenster an (wie die Plattform-Kacheln), anstatt in einer festen Größe zu bleiben.

## v1.24.163 — September 2026

### Startseite: Hero-Visuals und Trailer ausgerichtet an den Einträgen

- Der Hero bevorzugt nun Editorials mit Landschafts-Backdrops ohne integrierten Titel, damit das Movviz-Logo allein über dem Bild bleibt.
- Der Hero-Player verwendet nun exakt das iFrame-Profil der Film- und Serienkarten.

## v1.24.162 — September 2026

### Startseite: Hero auch bei TMDb-Überlastung verfügbar

- Die erste Darstellung des Heroes verwendet sofort die bereits in der Bibliothek gespeicherten Backdrops, ohne auf einen langsamen oder abgelaufenen TMDb-Abruf angewiesen zu sein.
- Die angereicherten Empfehlungen und Trailer werden danach geladen und können das übliche Hero-Bild nicht verdecken.

## v1.24.161 — September 2026

### Startseite: Sicherer Fallback für den Hero

- Der Trailer bleibt eine Überlagerung des Hero-Backdrops: Bei keinem Video oder einem Fehler im YouTube-iFrame bleibt das übliche Bild mit allen Hero-Steuerelementen sichtbar.
- Ein isolierter Player-Fehler kann nicht mehr den gesamten Hero verschwinden lassen.

## v1.24.160 — September 2026

### Startseite: Zuverlässige Hero-Trailer

- Der Hero übernimmt das gleiche iFrame-Profil wie die Film- und Serienkarten.
- Ein geladener YouTube-iframe wird nun nach einer kurzen Verzögerung angezeigt, falls YouTube keine internen Wiedergabemeldungen sendet, anstatt den Hintergrund unendlich statisch zu lassen.

## v1.24.159 — September 2026

### Startseite: Angepasstes Ultrawide-Limit

- Die flüssige und zentrierte Desktop-Leinwand ist nun auf 2000 px statt 2200 px begrenzt.

## v1.24.158 — September 2026

### Startseite und Entdeckung: Flüssige Breite und OCS wiederhergestellt

- Die Startseite verwendet nun die gesamte nutzbare Breite auf dem Desktop und bleibt dann bei Ultrawide zentriert mit einem Limit von 2200 px. Die Karten behalten ihre Größe und zeigen daher mehr Inhalte an, während die Plattform-Kacheln an Platz gewinnen.
- Der Hero nimmt die volle Breite im Verhältnis 18:9 ein; „Wiedernehmen“ wird wieder zu einer redaktionellen Reihe über den passenden Vorschlägen.
- Die nach unten ausgeschlossenen Elemente werden durch die lokalen Reihen überprüft: Ein Titel, der um „Weniger als 40 Minuten“ entfernt ist, erscheint nach dem Neuladen nicht mehr.
- OCS behält sein Logo und seinen Namen bei, fragt aber nun den aktuellen TMDb-Katalog Ciné+ OCS (id 685) an, anstatt der alten id 56 leer.

## v1.24.157 — September 2026

### Startseite: Plattformen mit dynamischer Breite

- Die acht Plattform-Logos füllen nun die Inhaltsbreite bis zur Ausrichtung „Alle anzeigen“.
- Das Raster reduziert sich sauber von 8 auf 3 Spalten je nach Bildschirmbreite, ohne horizontales Scrollen oder kleine feste Kacheln.

## v1.24.156 — September 2026

### KI: Echte wählbare kostenlose Angebote

- Die OpenCode Zen- und OpenRouter-Kataloge werden dynamisch überprüft und gefiltert, um nur kostenlose Modelle anzubieten.
- Gemini ist auf offiziell dokumentierte und tatsächlich über den konfigurierten Schlüssel zugängliche kostenlose Modelle beschränkt; Mistral ist explizit auf das enthaltene Kontingent des kostenlosen Plans beschränkt.
- Die Sperre wird in der Oberfläche, beim Speichern und beim tatsächlichen Aufruf angewendet: Eine alte Konfiguration kann nicht mehr stillschweigend ein kostenpflichtiges Modell auswählen.

## v1.24.155 — September 2026

### KI: Der Button „Testen“ zeigt den rohen Provider-Fehler an

- Der Test gab nur „quota“ oder „failure“ zurück, was die wahre Ursache (ungültiger Schlüssel, fehlende Abrechnung, unbekanntes Modell, tatsächliches Rate-Limit) verbarg. Die genaue Meldung des Providers wird nun im Panel angezeigt.

## v1.24.154 — September 2026

### KI: Der Button „Testen“ testete den falschen Provider

- Die Testroute baute ihre Kette vom gespeicherten Primary anstatt vom angeklickten Provider: „Testen“ bei opencode testete tatsächlich mistral, mit einem OK unter der falschen Karte angezeigt. Korrigiert mit einer Kette, die auf den angeforderten Provider reduziert ist.

## v1.24.153 — September 2026

### Plattform-Logos: Ende der weißen Hintergründe

- Disney+ und Apple TV+ verwenden ihre weißen Varianten (gleiche Konturen, Disney+-Blau-Bogen erhalten): alle Kacheln bleiben dunkel, kein weißer Hintergrund mehr.
- OCS wird direkt auf dunklen Kacheln angezeigt, ohne weißen Hintergrund.

## v1.24.152 — September 2026

### Lokale Plattform-Logos

- Die Reihe „Empfehlungen und Entdeckung“ (Tabs + Raster) verwendet lokale SVGs (Netflix, Disney+, Prime Video, HBO Max, Apple TV+, YouTube, Crunchyroll, OCS von Wikimedia) anstelle der entfernten TMDb-Logos, mit hellem Hintergrund für dunkle Logos.

### Mobile Suchleiste

- Die Suchleiste übernimmt exakt das mobile Android-Rendering: Pill 46px, elektrische blaue → violette → magentafarbene Umrandung, Hintergrund #131836, Icon + Platzhalter 13px #B3B3B3.

### Ende des Hellmodus

- Vollständige Entfernung des Hellmodus: überall erzwungener Dunkelmodus, keine Auswahl mehr möglich — Entfernung des Umschaltreglers aus der Topbar, aus dem Erscheinungsbild-Schritt des Wizards, aus dem Profil-Erscheinungsbild-Bereich, aus dem gesamten Light-CSS und aus der Serverpräferenz.

## v1.24.151 — September 2026

### Android Smartphone — Mein Bereich

- Die untere Porträtleiste benennt den Tab „Bibliothek“ um in „Mein Bereich“, was für ein Hub, das Watchlist, Verlauf und Sammlungen zusammenfasst, passender ist.
- Die drei Tabs (Watchlist, Verlauf, Sammlungen) werden in einem 3-Spalten-Raster und nicht mehr in einem horizontalen Scrollbalken angezeigt.
- Alle Inhalte sind klickbar: Karten öffnen die Titelkarte, Sammlungen sind navigierbar und Sagas reagieren auf Tippen.

## v1.24.150 — September 2026

### NX Dashboard

- Fixiert die Plattformreihe: Netflix, Disney+, Prime Video, HBO Max, Apple TV, YouTube, Crunchyroll und OCS.
- Vergrößert die rechteckigen Plattform-Kacheln und entfernt Canal+ aus dieser Komposition.

## v1.24.149 — September 2026

### NX Dashboard

- Neugewichtet die Ultra-Wide-Komposition: Inhalt ist an die Seitenleiste angeheftet, die nutzbare Breite erweitert, Hero kompakter und die Spalte „Fortsetzen“ angereichert.
- Wandelt Hauptvorschläge in vertikale Poster um und gibt Plattformen und Suche mehr Präsenz.
- Zeigt die verbleibende Zeit in „Fortsetzen“ basierend auf der Plex-Dauer und -Position an.

## v1.24.148 — September 2026

### Entdeckung NX

- Korrigiert das Raster „Neuheiten und Trends“: Jede Kachel nutzt ihre gesamte Zelle und ihr Status bleibt über dem visuellen Inhalt überlagert.
- Das Filter-Panel bleibt beim Auswählen eines Genres auf dem Desktop geöffnet.

## v1.24.147 — September 2026

### Entdeckung NX

- Die Spuren verwenden ab sofort die tatsächliche Breite der Kacheln, ohne leere Abstände oder abgetrennte Hinzufügensknöpfe zwischen den Inhalten.

## v1.24.146 — September 2026

### Entdeckung NX

- Die Desktop-Leiste „Entdeckung“ übernimmt die Komposition des Entwurfs: kompakte Tabs, getrennte Plattformen, lesbarer „Filter und Sortieren“-Button, ohne Halo oder globales Rahmenwerk.

## v1.24.145 — September 2026

### NX Desktop-Treue

- Entfernung von Halos, Lichtschatten und dekorativen Rahmen, die nicht im NX-Entwurf enthalten sind.
- Die Übernahme, Plattformen und Aktionen der Topbar erhalten eine dunkle, kompakte und lesbare Komposition.

## v1.24.144 — September 2026

### NX Desktop-Treue

- Die Desktop-Hülle ist verdichtet: kompakte Seitenleiste, umrandeter aktiver Zustand, kompakte Topbar und Suche.
- Startseite, Entdeckung, Bibliothek und Downloads übernehmen klarere Steuerelemente und die redaktionelle Hierarchie der NX-Richtlinie, ohne die mobile Oberfläche zu verändern.

## v1.24.143 — September 2026

### Downloads

- Das Schnell-Einstellungsfeld zeigt übersetzte Bezeichnungen, einen expliziten Link zu Download-Clients und Schalter, die ohne Reduzierung ihrer Lesbarkeit zugänglich sind.

## v1.24.142 — September 2026

### NX Desktop-Treue

- Die Startseitenleiste zeigt ab sofort die tatsächlichen Plattformen unter dem Hero; „Wiedergabe“ hat Priorität und „Meine Liste“ ist bedienbar.
- Die Bibliothek erhält ihre NX-Toolbar mit echten Filtern (4K, HDR, meine Liste, zuletzt und Sortierung) und kompakteren Spuren.
- Die Downloads-Spur zeigt die Wartezeit, den freien Speicherplatz und Schnell-Einstellungen, die tatsächlich mit dem Engine verbunden sind.

## v1.24.141 — September 2026

### NX Desktop-Oberfläche

- Überarbeitung der Seiten Startseite, Entdeckung, Bibliothek und Downloads: dichte Desktop-Komposition, Inhaltsspuren, Plattformfilter, Genre-Spalte und Echtzeit-Verfolgungs-Tabelle.
- Die Seiten Filme und Serien bevorzugen ab sofort Vorschläge mit einem expliziten Zugriff auf ihre jeweilige Bibliothek.
- Das Dashboard behält eine feste Komposition bei, mit einer dedizierten Spur für die Wiedergabeaufnahme und ohne Duplikat dieser Zeile.

### Plex und Downloads

- Eine persönliche Plex-Verbindung von Mobil oder TV ruft sofort die Verfolgungsliste des Benutzers ab und aktiviert seine private Synchronisierung.
- Der Engine behält einen echten Verlauf der Durchsatzraten für Live-Download-Statistiken bei.

## v1.24.140 — September 2026

### Android

- Administratoren können nun über die Android-Einstellungen ein Benutzerkonto erstellen, mit denselben Validierungs- und Autorisierungsregeln wie die Web-Oberfläche.

## v1.24.139 — September 2026

### Oberfläche

- Die optimierte Ladung ist nun das einzige Verhalten der Oberfläche und ist standardmäßig aktiv, auch für ältere Konfigurationen. Die Option Kompatibilität wurde aus den Einstellungen entfernt.

## v1.24.138 — September 2026

### Entdeckungssicherheit

- Alle TMDb-Anfragen teilen sich nun einen globalen Pool von maximal sechs Verbindungen, auch zwischen parallel geladenen Reihen.
- Identische TMDb-Anfragen werden gemittelt, und die Empfehlungen analysieren nicht mehr unnötig viele Details, wodurch die Ausfälle von Timeouts, die Entdeckung leer machten, vermieden werden.

## v1.24.137 — September 2026

### Desktop-Oberfläche

- Die sekundären Kacheln und Schaltflächen übernehmen die elektrischen Konturen der NX Mobile-Spezifikation: eine besser lesbare violett/cyan-Silhouette, ein dezenter Halo und ein verstärkter Fokus, ohne die Seitenstruktur zu verändern.

## v1.24.136 — September 2026

### Entdeckung und Vorschläge

- Ein Klick auf „Schlechte Empfehlung“ entfernt sofort den Titel aus allen betroffenen Reihen, verschiebt die verbleibenden Karten und lädt einen Ersatz. Die Ablehnung bleibt nach Aktualisierung oder Neustart dauerhaft.
- Verwaltung → Ausgeschlossen zeigt alle abgelehnten Empfehlungen an und ermöglicht deren individuelle erneute Autorisierung.

## v1.24.135 — September 2026

### Entdeckung

- Die Anime-Reihe bleibt global, auch wenn ein Kontelfilter ausgewählt ist. Japanische Anime-Filme und -Serien verschwinden daher nicht mehr in Entdecken.

## v1.24.134 — September 2026

### Entdeckung

- Die Konten decken nun alle von TMDb anerkannten Länder und Gebiete ab: Das Ankreuzen oder Abkreuzen eines Kontos wendet die entsprechende Gruppe für den ursprünglichen Filter korrekt an.
- Die Plattform-Logos auf den Karten (Netflix, Disney+, Prime Video usw.) werden ohne Hintergrund oder weißen Rahmen angezeigt.

### Docker

- Die Images AMD64 und ARM64 werden mit Docker V2 Manifesten und nicht mit OCI Manifesten veröffentlicht, damit Synology Container Manager den Tag `latest` lesen und Updates herunterladen kann.

## v1.24.133 — September 2026

### Installation

- Windows und Linux verwenden auch die standardmäßigen konfigurierbaren BitTorrent-Ports `55000`/`55001`. Beide Variablen werden an den Windows-Dienst übermittelt, und für Linux wird ein persistentes systemd-Overlay dokumentiert.

## v1.24.132 — September 2026

### Docker

- Die BitTorrent-Ports für Filme und Serien verwenden nun standardmäßig `55000` und `55001` und sind über Docker-Variablen unabhängig konfigurierbar. Diese Variablen ersetzen auch die zuvor vom Engine registrierten Ports und vermeiden so alle Konflikte mit einem anderen Torrent-Client. UPnP öffnet und entfernt automatisch die entsprechenden TCP- und UDP-Mappings, sofern der Router dies zulässt.

## v1.24.131 — September 2026

### Docker

- Das Docker-Manifest exponiert nun explizit die drei Movviz-Dienste: Interface/API (`9810`), Download-Engine (`9820`) und Cloudflare-Resolver (`9830`), zusätzlich zu den BitTorrent-Ports.

## v1.24.130 — September 2026

### Installation

- Der erste Einrichtung-Assistent bietet nun an, vor der Konfiguration der Indizierer, die automatische Suche und den Download fehlender verfolgter Inhalte zu deaktivieren.

## v1.24.129 — September 2026

### Android mobile NX

- Die persistente Landschaftssuche reserviert nun ihre Höhe, plus 3 dp, in jeder Seite der zentralen Spalte: Kein Hero, Titel oder erstes Listenelement wird beim Öffnen oder beim Wechsel des Tabs ausgeblendet.

## v1.24.128 — September 2026

### Entdeckung

- **Genre-spezifische Trends / Top / Neuheiten ausgerichtet**: `Anime` und `Teen-Romanze` (Teen) respektieren nun die gewählte Sortierung — `Trends` (`popularity.desc`), `Top` (`vote_average.desc` + `vote_count.gte 200`) und `Neuheiten` (`primary_release_date.desc`/`first_air_date.desc` + Begrenzung auf heute) — und das Jahr, anstatt eines hartkodierten `popularity.desc`. Auch andere Filter (Plattform, Studio, Dauer) werden übermittelt.

## v1.24.127 — September 2026

### Android mobile NX

- Die Porträt-Suchleiste ist nun persistent und opak über der zentralen Spalte in Landschaftsmodus; Hero und Listen scrollen darunter.
- Sortierung für Netflix, Prime Video und Plattformen: NX Premium-Buttons (elektrische Konturen, nachtblau-blaue Oberflächen und lila-degradierte Auswahl).
- Die Kataloge der Plattformen werden nicht mehr leer, wenn ein gültiges Becken nur Neuheiten enthält: Es wird auf diese Titel zurückgegriffen, anstatt eine Seite ohne Ergebnisse anzuzeigen.

## v1.24.126 — September 2026

### Android mobile NX

- Landschaftsmodus: Die Suche verlässt die Seitenleiste und wird zu einer globalen, schwebenden Aktion oben rechts im zentralen Inhalt.

## v1.24.125 — September 2026

### Android mobile NX

- Landschafts- und erweiterten Modus: Weniger schmales Menü mit Logo oben beibehalten, anpassbare Breite des Download-Panels und erhaltenen zentralen Bereich (mindestens 360 dp mit drei Spalten).
- Abgerundete und abgesetzte Hervorhebungs-Karte im Landschaftsmodus, ohne Änderung für Porträt oder TV NX.
- Charakterportrait im Querformat: elektrische blau-violett-magenta Konturen der Karten und Wiedergabetasten mit Mauve-Verlauf.
- Profilfoto des aktiven Profils wird aus dem verbundenen Konto aktualisiert, auch wenn bereits ein lokales Profil existiert; der Cache des Auswählers behält auch das personalisierte Movviz-Foto.
- Korrektur der Compose-Referenz im Sortierauswähler der Kataloge.

### Künstliche Intelligenz

- Die IA-Prioritätsliste ist nun die einzige Quelle der Wahrheit: Ein alter `primary`-Wert kann nicht mehr vor dem Anbieter an Position 1 erscheinen.

## v1.24.124 — September 2026

### Android NX

- Die Kataloge von Netflix, Prime Video und Disney+ bleiben nach einem vorübergehenden TMDb-Ausfall nicht mehr leer: Eine anfängliche leere Antwort vergiftet den Cache nicht mehr für 45 Minuten.
- Die Plattformseiten zeigen standardmäßig „Empfehlungen für Sie“, „Höchstbewertet“ und „Neueste“ an.
- Sofortige Aktualisierung der Avatare auf TV NX, auch wenn Plex das Bild ohne Änderung der URL ersetzt.
- Die Zähler „Gesehen Filme“ und „Gesehen Serien“ zeigen nun die aggregierten Plex/Movviz-Gesamtzahlen an, anstatt nur die sichtbaren 20 neuesten Karten zu zählen.

## v1.24.123 — September 2026

### Künstliche Intelligenz

- Hinzufügen von OpenCode Zen zu den KI-Anbietern mit API-Schlüssel, Verbindungsprüfung und Unterstützung für Chat Completions- und Responses-Protokolle.
- Auswahl bewusst auf die sechs offiziell kostenlosen Zen-Modelle begrenzt: Kein kostenpflichtiges Modell kann registriert werden.
- Anbieter-Prioritätsreihenfolge vollständig konfigurierbar; die Engine respektiert die gewählte Rangfolge für den Hauptanbieter und jeden Fallback.

### Profile

- Synchronisierung des Movviz ↔ Plex Avatars beim letzten Gewinner-Änderung, mit Anti-Loop-Prägung, Invalidation des TV NX Caches und sicherem Zurückfall: Ein Plex-Fehler blockiert niemals den Movviz-Upload.

## v1.24.122 — September 2026

### Vereinheitlichtes Streaming

- Single Source of Truth für gesehen/nicht gesehen auf Desktop, Mobile NX und TV NX, mit tatsächlicher Aggregation von Episode, Staffel und Serie.
- Bidirektionale Plex-Synchronisierung, die reale Daten beibehält; ein bestätigtes Ansehen bleibt Vorrang vor bloßer Abwesenheit eines Status.
- Bereinertes Wiederaufnehmen, sobald ein Titel gesehen oder auf Null gesetzt wurde, mit nur einem aktiven Wiederaufnehmen pro Serie.

### Vorschläge und KI

- Personalisierte Rangfolge basierend auf Geschmack und öffentlicher Resonanz: Popularität, Abstimmungszahl und Passgenauigkeit gehen vor ähnlichen, aber unbekannten Inhalten.
- Neuheiten eines Anbieters, die sehr beliebt sind, können sofort aufsteigen, wenn sie den Geschmack treffen, ohne Tausende von Stimmen sammeln zu müssen.
- Profil angereichert durch TMDb-Themen und Schlüsselwörter, ergänzend zu Genres, Stimmungen, Schauspielern, Regisseuren, Franchises, Bewertungen und tatsächlichem Verhalten; derselbe Kontext speist die Vorschläge und die Movviz-KI.

## v1.24.121 — September 2026

### Android

- Entfernung historischer Android Mobile- und TV-Kunden: Nur Movviz NX Mobile und Movviz NX TV werden kompiliert und veröffentlicht. Bestehende API-Routen bleiben unverändert.

## v1.24.120 — September 2026

### Profile

- Benutzerdefiniertes Profilbild (Einstellungen → Profil auf dem Desktop, antippbares Foto auf der mobilen Karte): JPEG/PNG/WebP/GIF ≤ 2 MB, sichtbar auf Desktop + Mobil + TV, priorisiert über Plex-Foto (unverändert).
- Hinweis: Replikation zu Plex über die öffentliche API nicht möglich (kein dokumentierter Endpunkt – nur die offizielle App weiß das); das Movviz-Foto wird auf Seiten von Movviz gespeichert, Hook bereit in `src/lib/avatars.ts`.

## v1.24.119 — September 2026

### NX Mobile

- Plex-Foto überall abgerufen: Coil teilt die session-authentifizierte HTTP-Client-Sitzung, relative URLs werden gegen den Server aufgelöst, Initialwerte bei Fehlschlag (Badge, Rail, Picker, Karte, TV-Leiste).
- Einheitlicher Hintergrund (#0F142F, Ton des Logo-Banners) auf allen Porträt-/Querformat-Bildschirmen, Systemleisten und beim Start – kein schwarzer Hintergrund mehr.

## v1.24.118 — September 2026

### NX Mobile

- Kompakte entfaltete Hero-Ansicht: Reduziertes Logo, Synopsis nur auf der Karte – „Weiterlesen“ / „Mehr Infos“ immer sichtbar (gemessen auf 12px auf dem Emulator).

## v1.24.117 — September 2026

### NX Mobile

- Premium-Querformat überall: Touch-Rail auch auf Titel-/Schauspielerkarte und „Alles anzeigen“, erweitertes immersives Erlebnis, reduzierter Hero-Kartenbereich, kompakte Ränder (Entdecken, Katalog, Bibliothek, Profil, Einstellungen, Karte, Schauspieler, Raster), „Alles anzeigen“-Raster mit 3 Spalten, Touch-Suche.

## v1.24.116 — September 2026

### NX Mobile

- Echte Null-Überlauf: Der Abstand zwischen der 3. und 4. Karte (und 4./5. Plattform) wird bei der Anpassung berücksichtigt – Pixelgemessen über Bounds (Horimiya bei [1053,1080]).

## v1.24.115 — September 2026

### NX Mobile

- Null-Überlauf der 4. Karte: 4dp Sicherheitsabstand bei exakter Anpassung (abgerundete Dp→px gemessen auf dem Emulator).
- Entfalteter Hero: 1-zeilige Synopsis, um „Weiterlesen“ / „Mehr Infos“ auf Querformat unten sichtbar zu lassen.

## v1.24.114 — September 2026

### NX Mobile

- Anti „MO“: Benutzername überall als Platzhalter (Begrüßung, Avatar-Header, entfaltetes Rail), wenn kein Profil aktiv ist; der Avatar führt in diesem Fall zum Auswähler.
- 3 Reihen mit exaktem Vollbild (fließende arithmetische Dp auf echtem Viewport): Kein Ende der 4. Karte mehr; auch Bildunterschriften sind entfaltet.
- Entfaltet: Immersiv (außer echtem TV), schlankes Rail ohne Scroll, Touch-Suche, Panel-Cover über die Bibliothek, kompakte Ränder bei Entdecken/Bibliothek/Katalog/Profil/Einstellungen, kompakter Hero.
- Untere Leiste: „Downloads“ komplett (Gewicht 1,3); MAJ-Pille auch im ausgeklappten Rail.

## v1.24.113 — September 2026

### NX Mobile

- Profil im Skizzen-Look 08: Foto mit elektrisch lila Kreis, Name + reale Rolle (Admin-Konto / Benutzerkonto), Zahnrad Einstellungen, 2×2 Statistik (Gesehen Filme / Gesehen Serien / In meiner Liste / Vergebene Bewertungen), Menü Meine Aktivitäten / Meine Empfehlungen / Einstellungen / Profil ändern / Abmelden zu realen Zielen.
- Ausgeklappter Modus (Landschaft ≥ 700dp): Permanentes linkes Touch-Rail + Seitenpanel Laufend / Beendet auf der Startseite, gleiche elektrische Konturen. Porträt und TV unverändert.
- Untere Leiste: Beschriftungen in 9.sp, „Downloads“ nicht mehr abgeschnitten.

## v1.24.112 — September 2026

### NX Mobile

- Untere Leisten-Skizze 01: 4 Tabs nur (Startseite/Entdecken/Bibliothek/Downloads) mit immer sichtbarem Icon + Beschriftung, aktiv als verblasste Pille.
- Aktualisierte Pille verschoben in den Kopfbereich links vom Avatar (nur sichtbar, wenn verfügbar), elektrischer lila Ring mit atmendem Halo + 44dp Hitbox.
- Immersiv wie Videospiel auf der Porträt-Startseite: Android-Systemknöpfe ausgeblendet, temporäre Rückkehr zum Kanten-Wischen.

## v1.24.111 — September 2026

### NX Mobile

- Nuancierter elektrischer Rahmen (blau `#3D7BFF` → violett `#8B2FFF` → magenta `#BC3FFF`) auf Kacheln Plattformen, Film-/Serienkarten und Suche — kein flaches Design mehr.
- Plattformen: 4 Vollrahmen-Icons, angepasst an das Viewport (kein 5. abgeschnitten), Wischen beibehalten für die Fortsetzung.
- Film-/Serienreihen: Exakte Anpassung von 3 Vollrahmen-Karten auf allen breiten Bildschirmen (Deckel 120dp entfernt, ließ einen Teil der 4. überlaufen).

## v1.24.110 — September 2026

### NX Mobile

- Porträt-Startseite: 3 Vollrahmen-Karten pro Reihe wie in Skizze 01 (berechnete Breite `(viewport-32-20)/3`, begrenzt auf 92–120dp, „Mehr sehen“-Kachel ausgerichtet) anstelle von 2,5 mit der 3. abgeschnitten.
- Elektrisches Lila nur für NX Mobile: Brand `#7C3AED` → `#8B2FFF`, Brand2 `#C04BFF` → `#BC3FFF`, Glow `#A06BFF` → `#A66BFF`. Web und 3 andere Module unverändert.
- Porträt-Suchleiste: Feines elektrisches Netz `1.dp bis 22%` wie die Umrandung des Docks und die Pille der Skizze 01.

## v1.24.109 — September 2026

### Android TV NX

- Korrigiert einen systematischen Absturz beim Scrollen durch die Reihen auf der Startseite (und mehreren anderen Bildschirmen: Titelfilme, Suche, Katalog, Downloads, Schauspielerprofil, Profilauswahl, Player): `NoSuchMethodError` bei `LazyLayoutPrefetchState.schedulePrefetch`, binäre Inkompatibilität zwischen `androidx.tv:tv-foundation` und der Version von `compose.foundation` durch das Projekt behoben. Gleicher Bug bereits bei NX Mobile behoben (Voreinladevorgang durch Reflexion deaktiviert, kein sichtbares Verhalten betroffen) — bisher nie auf NX TV übertragen worden. Angewandt auf die 14 `TvLazyRow`/`TvLazyColumn`/`TvLazyVerticalGrid` des Moduls.

## v1.24.108 — September 2026

### Weiter ansehen

- Eine abgeschlossene Episode oder ein Film (auch während der Credits) wird nicht mehr in „Weiter ansehen“/„Fortsetzen“ angezeigt — sowohl auf Desktop, Android TV als auch Android Mobile, da alle 3 vom selben Serverpunkt (`listOnDeckEntries`) abhängen. Gleiche Schwelle für „nahezu Ende“ (5 Min. Rest für einen Film, 2 Min. für eine Episode, 10 % für ein kurzes Medium — die bereits vom Player verwendet, um eine Wiedergabe als beendet zu markieren) wird einheitlich auf den von Movviz verfolgten Fortschritt UND auf den rohen On-Deck von Plex angewendet, nicht nur auf eine der beiden Quellen. Wirksam sofort für bereits „festgefahrene“ Titel, ohne manuelles Bereinigen.

## v1.24.107 — September 2026

### NX Mobile

- Korrigiert Videovorschauen, die gelegentlich einen völlig anderen Film zeigen (z. B. Demon Slayer zeigt einen tatsächlichen, nicht zusammenhängenden Trailer): Die Umgebungsvorschau bevorzugte fälschlicherweise „erweiterte“ Quellen (Apple/Netflix/Disney+/Prime Video/IMDb), die nach Titelähnlichkeit übereinstimmen und einen Homonym verwechseln könnten, anstatt der TMDb-Videos, die direkt mit der richtigen ID verknüpft sind. TMDb (zuverlässige ID) wird nun zuerst versucht; erweiterte Quellen übernehmen die Kontrolle nur, wenn dieses Video nach einigen Sekunden tatsächlich nicht startet, um niemals eine eingefrorene Vorschau ohne Wiedergabe zu hinterlassen.

## v1.24.106 — September 2026

### NX Mobile

- Medienprofil: Hero (Hintergrund/Videovorschau) vergrößert (300dp → 460dp) und abgedunkelter Verlauf nach dem letzten Drittel statt ab der Hälfte – das Bild/Video war zu kurz sichtbar, bevor es vom Hintergrund überdeckt wurde, was das Profil wenig immersiv machte.

## v1.24.105 — September 2026

### NX Mobile

- Korrigiert das abgeschnittene Logo oben auf dem Bildschirm „Profil hinzufügen“ (Verbindung): Der mehrfarbige Halo des Marks ragte über sein Feld hinaus und wurde vom Scroll-Viewport abgeschnitten, da oben am allerersten Element kein Rand vorhanden war.

## v1.24.104 — September 2026

### NX Mobile

- Startseite-Plattform-Icons: Entfernt den weißen Hintergrund hinter jedem Logo (die TMDb-Icons sind bereits farbige Quadrat-Icons, der weiße Hintergrund war überflüssig).
- Permanenter lila Verlaufsausschnitt (gemäß Mockup) um Plattform-Icons und Film-/Serienplakate im Porträtformat – der weiße TV-Fokusrahmen bleibt im Querformat/TV unverändert.

## v1.24.103 — September 2026

### NX Mobile

- „Plattformen“-Leiste der Startseite: Einheitliche quadratische Icons (wie gewünscht) anstelle der abgerundeten, variabel breiten Punkte, die von Entdecken/TV geerbt wurden.

## v1.24.102 — September 2026

### NX Mobile

- Stellt den Umschalter „Vorschläge/Bibliothek“ in Entdecken > Filme/Serien (Porträt) wieder her – er war versehentlich mit dem alten 3-Wege-Selektor verschwunden und gab Zugriff auf das gesamte verfügbare Verzeichnis (2439 Filme beim Benutzer); ohne ihn war das Verzeichnis nicht mit einem direkten Tipp erreichbar.

## v1.24.101 — September 2026

### NX Mobile

- Korrigiert die „Plattformen“-Kacheln der Startseite: Sie sind inert (keine Aktion beim Tippen) und alle haben eine einheitliche Breite anstelle der Anpassung an ihr Logo, wie auf der Skizze.
- Verschiebt „Nach deiner Stimmung“ nach oben in Entdecken, direkt unter den Genres, anstatt ganz unten.
- Überarbeitet den Bildschirm „Alles ansehen“ (Plattformen/Genres/Stimmung/Redaktionelle Reihen) im Porträtformat: Er hatte weder einen Header noch einen Zurück-Button (Seite nach einem Tipp blockiert), eine 2-Karten-Rasterung pro Reihe – ersetzt durch den Standard-Header (Mark + Avatar) und ein 4-Spalten-Raster, das zum Rest der App passt. Gleicher Korrekturhinweis für das Schauspielerprofil (Besetzung).
- Korrigiert den Inhalt, der unter der schwebenden unteren Leiste auf Seiten wie Entdecken, Bibliothek, Downloads und Suche verborgen war.

## v1.24.100 — September 2026

### NX Mobile

- Komplettüberarbeitung des Smartphone-Porträts gemäß dem bereitgestellten UX-Mockup: Die untere Leiste reduziert auf Startseite/Entdecken/Bibliothek/Downloads (nur Icons), Profil und Suche sind nun über den Avatar und das Suchfeld im Header zugänglich und nicht mehr über dedizierte Tabs.
- Startseite: „Plattformen“-Leiste, separate Reihen „Fortsetzen deine Filme“/„Fortsetzen deine Serien“, kein Hero-Banner mehr im Porträtformat (nicht im Mockup vorgesehen).
- Entdeckung: Vollbreitiger Filmober-/Serienauswähler mit Markenverlauf, Reihe „Film/Serie fortsetzen“.
- Bibliothek: Wird zu einem echten Einstiegspunkt für Watchlist/Verlauf/Sammlungen (anstatt eines Alias des Film-/Serienkatalogs), echte Watchlist und Verlauf, Benutzer-Sammlungen + besitzte TMDb-Sagas.
- Downloads: Tabs „Wird heruntergeladen“/„Abgeschlossen“ mit echten Zählern, verbleibender Zeit und angezeigter Geschwindigkeit, plus Aktualisieren-Button.
- Medienkarte: Zurück-Button und schwebende Watchlist-Umschaltung auf dem Banner, wirklich bidirektionale Watchlist (Hinzufügen/Entfernen vom Server).
- Suche: „Schauspieler“-Chip (Suche nach echten Personen), kürzliche Sitzungsrecherchen, Ergebnisse-Sektion mit Zugriff auf Filter.
- Dynamische Aktualisierung der unteren Leiste beibehalten (5. Icon, erscheint/verschwindet je nach Verfügbarkeit).

## v1.24.99 — September 2026

### NX Mobile

- Überarbeitung des Onboardings beim ersten Start gemäß Mockup: Server, Konto (+ Plex), Profile, Synchronisierung, Startseite. Nachfolgende Starts beginnen bei „Wer schaut?“, und das Hinzufügen eines Profils erfolgt über den Anmeldebildschirm, bevor es zu den Profilen zurückkehrt.
- Bottom-Nav-Portrait ausgerichtet nach Mockup: Entdeckung / Filme / Serien / Meine Liste / Profil, mit „Für Sie empfohlen“ und „Streaming-Plattformen“.
- Einzigartige Version: Die 4 APKs lesen nun `package.json` (Desktop-Version) anstelle eines festen Wertes – keine Desynchronisierung mehr möglich.

### Build

- Gradle-Ausrichtung: Gradle 8.13, AGP 8.13.2, Kotlin 2.2.21, Compose BOM 2025.08.01, Media3 1.7.1, Navigation 2.9.3 auf den 4 Android-Modulen + CI.

## v1.24.98 — September 2026

### Korrekturen

- Korrigiert die Kompilierung von NX Mobile, die durch das Merge v1.24.97 gebrochen war: `Border(...)` mit positionellen anstelle von benannten Argumenten in `DiscoverHubScreen.kt`/`LibraryHubScreen.kt`, und eine doppelte Deklaration von `SearchTypeFilter` in `SearchScreen.kt` (zwei separate Bildschirme hatten jeweils ihre eigene Enum mit demselben Namen definiert) — umbenannt in `PortraitSearchTypeFilter` für den Porträt-Suchbildschirm.

## v1.24.97 — September 2026

### Entdeckung (Web)

- Überarbeitung des Desktop-Entdeckungsblocks gemäß Skizze: Hero mit 3 echten Aktionen (Jetzt ansehen / Meine Liste / Trailer), Sektion „Ihre Streaming-Plattformen“ angehoben direkt unter dem Hero mit den echten Markenfarben, Plattform-Badge auf den Karten der Reihen, die bereits tatsächlich zu einer Plattform gehören.

### NX Mobile

- Ausrichtung der mobilen Navigation und der Anmeldung über Plex OAuth.
- Echte Launcher-Icons je nach Dichte (mdpi bis xxxhdpi) auf den 4 Android-Apps, ersetzen die adaptiven XML-Icons.

## v1.24.96 — September 2026

### Korrekturen

- NX Mobile Portrait, Entdeckungsbildschirm: Die „Nach Stimmung“-Chips waren zu klein, um bequem getippt zu werden (in realem Test festgestellt) — Zielbereich vergrößert auf mindestens 44dp.
- Die Reihen Genres/Plattformen/Studios/Nach Stimmung verwendeten einen festen Abstand von 52dp, der von TV geerbt wurde, anstatt der 16dp des restlichen Porträt-Inhalts — dieselbe Korrektur wie bei der Reihe „Verfügbarkeit“ auf der Titelseite (v1.24.95), sie folgen nun demselben Abstand.

## v1.24.95 — September 2026

### Korrekturen

- Korrigiert das Ausrichten der Reihe „Verfügbarkeit“ auf dem Titelblatt für NX Mobile Portrait: Es verwendete einen festen Rand von 48dp anstelle der 16dp des restlichen Blattes (Titel, Schaltflächen, Ähnliche Titel), was es sichtbar nach rechts verschob.

## v1.24.94 — September 2026

### Korrekturen

- Korrigiert den Zusammenbruch der NX Mobile Kompilierung durch das Redesign v1.24.93 (falsche benannte Parameter in `Border(...)` und ein nicht existierender `Modifier.padding()` Overload) — es konnte kein APK für v1.24.93 generiert werden.

## v1.24.93 — September 2026

### NX Mobile

- Wahres strukturelles Redesign des Telefonporträts (nicht nur Farben): Permanenter Header mit immer sichtbarer Suchleiste (das alte Porträt zeigte keinen Header), segmentierte Pillen für Entdecken/Filme/Serien, echte Filter für Genres/Stimmung/Dauer/Plattformen, Hero-Karte mit abgerundeten Ecken mit Bewertungsabzeichen und doppelter Schaltfläche „Ansehen/Trailer“, „Nach Stimmung“-Chips in dünnen Pillen, neu aufgebauter Suchbildschirm (permanente Leiste, Typ-Pillen, Vorschläge, Trends des Moments, Ergebnisse in Liste).
- Untere Navigation mit 5 Tabs und unverändigtem Update-Abzeichen.

## v1.24.92 — September 2026

### NX Mobile

- Visuelles Redesign der NX Mobile App: Palette abgestimmt auf den Rest von Movviz (lila/void/abyss), aktive Chips mit Markenverlauf für Filter und Inhaltsauswahl, dunkleres Navigations-Dock.
- Neuer Abschnitt „Nach Stimmung“ in Entdecken: Schnellzugriff auf Genres nach Stimmung (Abenteuer, Entspannung, Grusel, Emotion, Lachen, Inspiration). Untere Navigation mit 5 Tabs und unverändigtem Update-Abzeichen.

## v1.24.91 — September 2026

### Korrekturen

- Korrigiert „Aktive Sitzungen“: Das Abspielen einer lokalen Episode öffnete nie eine Verfolgungs-Sitzung (es hing nur von der Plex-Dauer ab), daher erschien es nie im Panel — unabhängig vom Gerät oder der App (Mobil, NX Mobile, TV, NX TV).
- Das Splashscreen-Logo wurde zu spät geladen (nach JS-Hydratation); es wird nun direkt beim initialen HTML vorab geladen.
- Verfeinert das Porträt-Navigations-Dock von NX Mobile: Der Update-Indikator drückt die Leiste nicht mehr nach oben und ist kein undurchsichtiges Feld mehr.

## v1.24.90 — September 2026

### Visuelle Identität

- Neues Movviz-Markenzeichen (rosa/lila gekreuzter Streifen) auf der gesamten Plattform, ab den offiziellen Dateien: Web-Sidebar, Favicon/PWA, adaptive Android-Icons (Mobil, NX Mobile, TV, NX TV), Android TV-Banner, Windows-Icon und Docker-Icon.
- Neue Desktop- und Android NX Splashscreens mit dem vollständigen Lockup (Marke + „Movviz“), priorisiert geladen.

## v1.24.89 — September 2026

### NX Mobile und NX TV

- Ein in „Fortsetzen“ geöffnetes Blatt löst nun vorrangig den lokalen Bibliotheks-Eintrag, bevor es seine Aktionen anzeigt. Eine bereits indexierte Datei schlägt daher während des Ladens nie wieder „Zur Bibliothek hinzufügen“ vor; Plex bleibt optional.

## v1.24.88 — September 2026

### NX Mobile und NX TV

- Trennt explizit die Karten für fortgesetzte Episoden, die kürzlich hinzugefügt wurden: Nur die ersten können „Fortsetzen“, einen Fortschritt und eine Fortsetzungs-Vorschau anzeigen; die neuesten Episoden zeigen nur ihr Abzeichen `Sxx · Exx`.
- Überarbeitet das Porträt-Dock von NX Mobile: Schwebend, zentriert, kompakt, mit fließender Erweiterung und Verblassung des aktiven Tabs; der Inhalt reserviert nun den notwendigen Platz unter der letzten Reihe.

## v1.24.87 — September 2026

### NX Mobile und NX TV

- Korrigiert den Übergang zur nächsten Episode: Das neue Medium wird tatsächlich geladen, die übersprungene Episode wird geschlossen und bleibt nicht in „Wiederaufnahme“.
- Beim Verlassen eines Players oder beim Hintergrundwechsel der App stoppt der Ton und die Position wird beibehalten. Credits und Enden von Wiedergaben erzeugen keine Wiederaufnahme mehr.
- Episodenwiederholungen zeigen nun das Bild der Episode, das Serienlogo und das Abzeichen `S03 · E10`; Filme behalten ihr Cover.
- Überarbeitet die Porträt-Navigation von NX Mobile: Untere Kapsel mit expliziten Icons, Beschriftung nur auf dem aktiven Tab, „Entdecken verfügbar“, Name des aktiven Profils und diskrete Update-Verknüpfung.

## v1.24.86 — September 2026

### NX Mobile und NX TV

- Fügt die dedizierte Downloads-Seite hinzu, die live aus dem Server-Queue gespeist wird.
- Macht die Wiedergabeleiste wirklich taktil: Tippen auf eine Spur springt sofort zur ausgewählten Position.
- Die Karten behalten ihren lebenden Download-Status und wechseln zu „Wiedergabe“, sobald das Medium verfügbar ist.

## v1.24.85 — September 2026

### Movviz NX Mobile

- Passt die Porträt-Smartphone-Oberfläche an, ohne die TV/Querformat-Darstellung zu ändern: Kompakte Leiste mit Aktionsmenü, dichteres Startbild, lesbarer Katalog, neu dimensionierte Karten und Episoden.
- Korrigiert Texte und Abstände für Profile, Profilauswahl, Plex-Verbindung und Einstellungen auf kleinen Bildschirmen.
- Richtet die vier Android-Kanäle und das Webpaket auf dieselbe Release-Nummer aus.

## v1.24.84 — September 2026

### NX Mobile — taktile Vordergrundaktionen

Repariert die überlagerten Aktionen von NX Mobile: Die Tabs „Start/Serien/Filme/Profil“, Suche, Einstellungen, Profilwechsel und Update-Signal erfassen nun explizit die Berührung zusätzlich zum D-Pad. Die Wiedergabesteuerungen behalten die gleiche taktile Behandlung.

## v1.24.83 — September 2026

### Movviz NX Mobile — direkter Port von NX TV

Ersetzt das erste NX Mobile-Fundament durch den Code von `android-tv-nx`: Gleicher lokal-first Start, isolierter Cache pro Server/Konto/Profil, Plex-Profile, NX-Startseite, Film-/Serien-Hubs, Karten, Saison-/Episodenseiten, Player, Update und D-Pad-Schutz. Der Touch-Port behält dieses Verhalten bei, anstatt die alte mobile App wieder aufzunehmen.

Das Paket bleibt `com.movviz.nx.mobile`, das Update-Asset bleibt `Movviz-NX-Mobile-client.apk` und die Retail-Signatur ist unverändert. Die Aktivität ist auf Telefon, Tablet und Fold skalierbar; die NX-Leiste wird bei Berührung auf kleinen Bildschirmen scrollbar, während alle Zugriffe erhalten bleiben. Das M-Logo wird beim Start und bei der Navigation angewendet.

## v1.24.82 — September 2026

### Movviz NX Mobile — neuer unabhängiger Kanal

Fügt `Movviz NX Mobile` (`com.movviz.nx.mobile`) hinzu: Eine unabhängige, taktile Android-App von Movviz Mobile und NX TV, signiert mit demselben Retail-Schlüssel. Sie behält die Profile, Wiederaufnahmen, den Player, die Startseite und das automatische Update von Movviz bei, während sie ihre eigenen Daten und ihr eigenes Release-Asset (`Movviz-NX-Mobile-client.apk`) beibehält.

Die Oberfläche passt sich an Smartphones, Tablets und faltbare Geräte an: Skalierbare Aktivität, Profilauswahl mit 2/3/4 Spalten je nach Breite, adaptives Bibliotheksraster und Formulare zentriert auf großen Bildschirmen. Das NX-Icon wird als Android-Icon verwendet.

## v1.24.81 — September 2026

### Movviz NX — lokaler, zuerst funktionierender Startbildschirm

Der NX-Startbildschirm veröffentlicht nun ein einziges Snapshot pro P0/P1-Welle: Der lokale Inhalt wird sofort angezeigt, und die Serverdaten ersetzen das gesamte Ensemble kohärent, ohne Kaskaden von Neurechnungen oder Fokuswechsel. Die Darstellung des ersten Viewports wird bestätigt, bevor die sekundäre Arbeit gestartet wird; der Download-Queue, Empfehlungen und entfernte Metadaten bleiben im Hintergrund.

Bei fehlendem Cache zeigt der Vorbereitungsbildschirm einen Fortschritt an, der an den tatsächlich durchlaufenen Schritten hängt. Bei einem nicht verfügbaren Server bleibt der letzte gültige Startbildschirm desselben Servers, Kontos und Profils nutzbar mit einer diskreten Offline-Anzeige, ohne unnötige Fallback-Anfragen zu wiederholen. Das Vorladen beschränkt sich auf nahegelegene Plakate und den einzigen fokussierten Hintergrund; Coil verwendet explizit seinen gemeinsamen Lader.

## v1.24.80 — September 2026

### Korrektur für den Retail-Android-Release

Repariert die Retail-Schlüssel-Fingerabdruckprüfung in Android-Workflows. TV-, NX- und Mobile-Builds lehnen weiterhin jeden anderen Schlüssel ab, lesen aber nun korrekt den von `keytool` zurückgegebenen Fingerabdruck. Die Version `1.24.80` (`124080`) ersetzt die Release v1.24.79, deren CI vor der Veröffentlichung des APK abgebrochen wurde.

## v1.24.79 — September 2026

### Movviz NX — lokaler, zuerst funktionierender Startbildschirm und sichere Retail-Release

Der NX-Startbildschirm stellt nun sofort den letzten lokalen Zustand wieder her, streng isoliert nach Server, Konto und Profil, und synchronisiert dann im Hintergrund die Bibliothek, Wiedergaben und Empfehlungen. Die Auswahl eines bereits bekannten Profils wird nicht mehr durch die Netzwerklatenz blockiert; die Sitzung wird dennoch im Hintergrund neu validiert, und eine ungültige Sitzung leitet zum Login weiter.

Der Download-Queue startet erst nach dem ersten Viewport und wird bei jedem Profilwechsel abgebrochen. Die `TV-PERF`-Logs ermöglichen die Messung der tatsächlichen Startschritte.

Die Android CI verlangt nun den Movviz Retail-Schlüssel und überprüft dessen Fingerabdruck: Es schlägt fehl, anstatt ein mit einem temporären Schlüssel signiertes APK zu veröffentlichen. Die drei APKs teilen denselben `versionCode`, abgeleitet vom Tag (`124079`), was den automatischen Update-Pfad repariert.

## v1.24.78 — September 2026

### Google TV Channels — Movviz TV und Movviz NX

Android TV Apps veröffentlichen nun ihren Movviz-Kanal und ihre Systemreihe „Weiter ansehen“ auf dem Google TV Startbildschirm. Die offizielle AndroidX TV Provider Abhängigkeit wird von Movviz TV und Movviz NX geteilt, damit beide Kanäle konsistent bleiben.

## v1.24.77 — September 2026

### Movviz NX — Startbildschirm blockiert nicht mehr die Fernbedienung

Das Drücken von unten aus der Navigationsleiste konnte seit dem Startbildschirm blockiert bleiben, solange das Dashboard nicht fertig geladen war, was das Durchgehen über Filme oder Serien erforderte, um nach unten zu gelangen. Das Fokusziel existiert nun schon beim ersten angezeigten Bild, noch bevor die Daten eintreffen.

## v1.24.76 — September 2026

### Movviz NX — Filme und Serien werden zu echten Hubs

Jedes Universum von Filme und Serien hat nun seinen eigenen Hub mit einem kompakten Suggestions/Bibliothek-Umschalter, der die beiden Absichten oder Kataloge niemals mehr vermischt. Der Startbildschirm wird mit den gleichen redaktionellen Reihen wie Filme/Serien angereichert, einschließlich Neuheiten und Vorschlägen nach Plattform, in einem Feed, der Filme und Serien wie ein echter Streaming-Bildschirm mischt. Korrigiert außerdem einen echten Fokusfehler, der beim Wechsel zur Bibliothek willkürlich übersprungen werden konnte.

## v1.24.75 — September 2026

### Entdecken — lesbare Plattformen und verfeinerte Sortierung

Die Logos von Plattformen und Studios in Entdecken (Filme/Serien) sind nun immer sichtbar, einschließlich Disney+ und Canal+, die bei dunklem Hintergrund unleserlich waren – jedes Logo basiert nun auf einem klaren Badge, wie auf der Website. Die Sortierung der Reihen „Suggestion {plattform} für Sie“ wird verfeinert: Die wenigen Titel an der Spitze profitieren nun von einer dedizierten Tonalanalyse, anstatt sich nur auf eine bereits gecachte Analyse zu verlassen, für eine Sortierung, die den tatsächlichen Vorlieben jedes Profils genauer entspricht.

## v1.24.74 — September 2026

### Entdeckung — Neuheiten und Vorschläge pro Plattform, getrennt

Jede Entdeckungsplattform (Netflix, Disney+, Prime Video) zeigt nun zwei separate Reihen: „Netflix Neuheiten für Sie“, streng nach Veröffentlichungsdatum sortiert, und „Disney+ Vorschläge für Sie“, sortiert nur nach Ihren Vorlieben (Genres, Verlauf, Bewertungen) ohne Berücksichtigung des Veröffentlichungsdatums. Der „Alle anzeigen“-Link dieser beiden Reihen scrollt so weit, wie es der tatsächliche Katalog der Plattform zulässt. Movviz NX erhält die gleiche Aufteilung auf seinem eigenen Entdeckungsbildschirm.

## v1.24.73 — September 2026

### Movviz NX — durchschaubare Staffeln und Episoden

Die dedizierte Seite für eine Staffel verwendet nun eine wirklich scrollbare Liste über das D-Pad: Selbst eine lange Staffel behält alle Episoden zugänglich, ohne dass sich die Zeilen beim Fokussieren ändern. Der obere Bereich befindet sich unter der Navigationsleiste, jede Episode behält ein Vorschaubild bei (mit visueller Überlagerung, falls TMDb keines liefert) und das Häkchen „gesehen“ bleibt rechts reserviert. Die Quellen Movviz und Plex folgen nun endlich der gleichen Regel, um die Wiedergabeaktion einer Episode anzuzeigen. Die Plattform-Empfehlungen behalten einen separaten Cache pro Profil, Typ und Entdeckungsland.

## v1.24.72 — September 2026

### Entdeckung — Netflix, Disney+ und Prime Video Neuheiten für Sie

Entdeckung (Filme und Serien) zeigt nun „Netflix Neuheiten für Sie“, „Disney+ Neuheiten für Sie“ und „Prime Video Neuheiten für Sie“: Die Kataloge dieser Plattformen werden nicht mehr nach allgemeiner Popularität, sondern nach Ihren eigenen Vorlieben sortiert (Genre-Affinität, Verlauf, Bewertungen) — zwei Konten sehen denselben Netflix-Katalog, aber in einer anderen Reihenfolge. „Alle anzeigen“ und die Paginierung behalten diese persönliche Sortierung bei. Die Plattform-Icons am unteren Rand von Entdeckung bleiben unverändert. Movviz NX erhält diese Erweiterung auf seinem eigenen Entdeckungsbildschirm, mit den Reihen für Plattform- und Studio-Logos am unteren Bildschirmrand.

## v1.24.71 — September 2026

### Movviz NX — Staffeln im Vollbildmodus

Die Auswahl einer Staffel auf einem Serienprofil öffnet nun einen dedizierten Bildschirm, anstatt eine Episodenliste mitten auf dem Profil auszuklappen: Das Serienprofil bleibt ein klares Inhaltsverzeichnis, und die Episodenliste nutzt den gesamten Platz mit einem einfachen D-Pad-Durchlauf, wobei „Zurück“ genau dieses Level schließt, bevor das Profil verlassen wird. Die Episodenzeilen behalten nun eine feste Geometrie bei (Vorschaubild, Titel, „gesehen“-Häkchen), damit sich das Layout beim Fokussieren nie ändert.

## v1.24.70 — September 2026

### Movviz NX — tatsächlich verfügbare Vorschauen

Video-Vorschauen sind wieder auf Android TV und Emulatoren mit weniger als 2 GB Gesamtspeicher erlaubt, solange genügend freier Speicher vorhanden ist. Die Profile verwenden nun den gleichen Vorschau-Pipeline wie die Karten, die Navigationslupe wurde neu gestaltet, das „Wiedernehmen“-Badge verdeckt nicht mehr die Plakate und jede Verteilungskarte erhält einen opaken Textsockel, um auf hellen Porträts lesbar zu bleiben.

## v1.24.69 — September 2026

### Movviz NX — Navigations- und Profil-Feinschliff

Die Android TV NX-Navigation erhält konsistente Icons, besser lesbare Fokus-Zustände und eine direkt über das D-Pad eingabefähige Suche. Die Profile kehren zu einem sichtbaren Fokuspunkt zurück, Episodentitel bleiben lesbar und das Profil-Dashboard ruft fehlende Plakate aus der Mediathek oder Metadaten ab, um leere Karten zu vermeiden.

## v1.24.68 — September 2026

### Movviz NX — zugängliche Suche und Updates

Die NX-Navigation zeigt nun Einstellungen mit aktiviertem Auto-Suchmodus und erzwungter Aktualisierungsprüfung. Wird eine Veröffentlichung erkannt, erscheint ein Update-Pfeil in der Leiste und löst nach Bestätigung die Installation aus. Die Suche zeigt und fokussiert ihr Eingabfeld wieder beim Öffnen.

## v1.24.67 — September 2026

### Movviz NX — Start-Fokus-Auswahl

Der Profilauswähler wird nun beim Start immer angezeigt, wenn auf dem Server mindestens ein Profil verfügbar ist, unabhängig von der Rolle des zuletzt aktiven Kontos. Die Erkennung von Updates bleibt automatisch; nach der ersten Android-Berechtigung zum Installieren unbekannter Apps kann die Installation ohne Eingriff fortgesetzt werden.

## v1.24.66 — September 2026

### Movviz NX — Plex-Profil und neueste Episoden

Das Plex-Avatar des aktiven Profils wird nun in der oberen Abkapselung angezeigt und öffnet den Profilauswähler. Das NX-Startbild fügt eine Reihe von tatsächlich hinzugefügten Episoden hinzu, unabhängig von Wiederholungen, streng sortiert vom Neuesten links zum Ältesten. Das Profil-Dashboard reserviert auch einen sicheren Bereich unter der Navigation und verwendet aus der Ferne lesbare Poster-Karten.

## v1.24.65 — September 2026

### Movviz NX — Android TV und eigenständiger Kanal

Movviz NX erhält sein dediziertes Retail-APK, das mit demselben Schlüssel signiert ist wie Movviz TV, aber unter einem separaten GitHub-Asset veröffentlicht wird. Sein Update-Signal und seine automatische Installation können Movviz TV daher niemals ersetzen. Die NX-Kopfzeile folgt nun dem Netflix-Verhalten: Sie bleibt oben im Hero transparent und wird nur dann verdeckt, wenn die Reihen unter die Navigation rutschen, ohne die D-Pad-Pfade zu ändern. Die Identitäten sind ebenfalls getrennt: kreisförmiges Icon für die App, das „M“-Markenzeichen in der Oberfläche.

## v1.24.64 — September 2026

### Mobile Bibliothek Filme und Serien im Plex-Stil

Jeder Tab für Filme oder Serien verfügt nun über drei verschiedene Ansichten: **Empfohlen**, mit Wiederholungen und dann Reihen von Postern; **Durchsuchen**, ein dichtes lokales Raster mit Suche, Sortierung und Genres; und **Sammlungen**, Reihen nach Bibliotheksuniversen. Kürzlich hinzugefügte Episoden erscheinen in Empfohlen bei Serien mit ihrem Poster, ihrer Serie und `Sxx · Exx`.

## v1.24.63 — September 2026

### Mobile Startseite zentriert auf Wiederholungen

Die große „Im Fokus“-Karte wird von der Smartphone-Startseite entfernt. Wiederholungen bleiben die erste Reihe nach der Kopfzeile, gefolgt von kürzlich hinzugefügten Episoden, dann der Bibliothek und den Entdeckungen. Das Hinzufügen einer Reihe kann „Wiederholen“ nicht mehr verschieben oder ersetzen.

## v1.24.62 — September 2026

### Kürzlich hinzugefügte Episoden auf der mobilen Startseite

Die Smartphone-Startseite zeigt nun eine dedizierte Reihe für Episoden, die zuletzt in die Bibliothek gelangt sind, unabhängig davon, ob sie von einem Plex-Import oder von Movviz stammen. Jede Karte behält die Serie, den Episodentitel und ihre Kennzeichnung `Sxx · Exx` bei und öffnet direkt die Serienseite. Diese Reihe ist von Wiederholungen und Ansichten getrennt: Sie beschreibt die verfügbaren Dateien, ohne den Verlauf eines anderen Profils offenzulegen.

## v1.24.61 — September 2026

### Plex-Ansichten streng nach Profil isoliert

Die Synchronisierung von Plex-Ansichten löst nun systematisch das über API mit seinem lokalen Plex-Server-Konto verknüpfte Plex-Profil, bevor sie den Verlauf liest. Bei Zweifeln wird der Import abgelehnt: Keine Ansicht eines anderen Profils kann hinzugefügt oder gelöscht werden. Das Öffnen von Movviz löst auch eine frische, profilbegrenzte Synchronisierung aus, anstatt auf den Hintergrundzyklus zu warten. In Movviz vorgenommene Markierungen werden weiterhin nur an dieses eine Plex-Profil gesendet.

## v1.24.60 — September 2026

### Persönliche mobile Startseite und Movviz-Signatur

Die mobile Startseite unterscheidet nun klar zwischen dem, was bereits in der Profilbibliothek existiert, und den Entdeckungen: Die erste Reihe mischt tatsächlich verfügbare Filme und Serien, gefolgt von persönlichen Empfehlungen, die bereits besitzte, angesehene oder abgelehnte Werke ausschließen. Ein kompaktes Movviz-Symbol verankert auch die Seite, im Sinne der Plex-Signatur, ohne den für Inhalte vorgesehenen Platz zu reduzieren.

## v1.24.59 — September 2026

### Wiederholungen auf Mobilgeräten und Reparatur des Serienabspielens

Startseite nimmt ab sofort die vereinheitlichte Wiedergabeliste bei jedem Zurückkehren im Tab und behält die Mischung aus Filme/Serien bei, sortiert nach Datum und letzter Wiedergabezeit. Entdeckung verwendet dieselbe Quelle in ihren separaten Tabs Filme und Serien. Die mobile Wiedergabe ruft auch alte lokale Episoden-Einträge ohne Quellenfeld ab, ohne eine Plex-Episode auf die lokale Quelle umzuleiten.

## v1.24.58 — September 2026

### Synchronisierte Ansichten, Episode für Episode

Die Aktionen „gesehen / nicht gesehen“ sind jetzt auf Android mobil und Android TV auf Ebene des Films, der Episode, der gesamten Staffel und der gesamten Serie verfügbar. Sie schreiben die einzigartige Verfolgung des Movviz-Profils und propagieren die Änderung an Plex, wenn ein Plex-Medium verknüpft ist. Zukünftige Episoden sind absichtlich ausgeschlossen: Wenn eine Staffel beendet ist, wird nur die erste verfügbare Episode der nächsten Staffel als Wiedergabe übernommen.

## v1.24.57 — September 2026

### Startseite und Android mobile Updates

Die mobile Startseite nimmt die redaktionellen Reihen des Fernsehers (persönliche Auswahl, Kurzformate, Trends, kürzlich hinzugefügt und kommende Veröffentlichungen) wieder auf, immer nach Profil und mit den Wiedergaben an erster Stelle. Eine erstellte Veröffentlichung wird nun durch einen pulsierenden Pillen- und ein Abzeichen in der Navigation ohne Unterbrechung signalisiert; die Installation beginnt erst nach Bestätigung.

## v1.24.56 — September 2026

### Android mobile APK veröffentlicht

Die Marge des Reihentitels der Wiedergabe verwendet jetzt den korrekten Compose-Overload; das CI kann die Smartphone-APK fertigstellen und mit der Veröffentlichung verknüpfen.

## v1.24.55 — September 2026

### Android mobile Veröffentlichungs-Hotfix

Die Kotlin-Kompilierung der mobilen Android-Startseite ist korrigiert; die Release-Version kann wieder erstellt und veröffentlicht werden.

## v1.24.54 — September 2026

### Vereinheitlichte Android mobile Startseite

Android mobil erhält einen echten Startseiten-Tab: Die „Weiter ansehen“-Wiedergaben kommen zuerst, gefolgt von Hero und den Bibliotheks-Rails. Diese Reihe verbraucht exakt die vereinheitlichte Benutzerroute, die bereits von Web und Android TV genutzt wird; der Fortschritt, die nächste Episode und die Plex/Movviz-Reihenfolge bleiben daher auf allen drei Plattformen identisch.

## v1.24.53 — September 2026

### Plex wirklich additiv und dichte TV-Kataloge

Die Wiedergaben in Plex hängen nicht mehr von einem vorherigen Link zur Movviz-Bibliothek ab: Ihre TMDb-IDs und Visuals werden direkt aufgelöst und dann nach Identität und tatsächlichem Datum mit der Movviz-Wiedergabe zusammengeführt. Filme, Serien und die „Alles ansehen“-Bildschirme von Android TV wechseln zu einem festen, dichten und stabilen Raster in 1080p/4K, mit kompakteren Steuerelementen und ohne Vergrößerung beim Fokussieren.

## v1.24.52 — September 2026

### Wirklich vereinheitlichte Wiedergaben und stabilisierte TV-Startseite

Die einzige „Weiter ansehen“-Route verwendet jetzt eine gemeinsame Movviz/Plex-Uhrzeit und sortiert jede Wiedergabe nach ihrem tatsächlichen Wiedergabedatum. Plex kann sofort die erste Episode der nächsten Staffel liefern, ohne auf eine lokale historische Synchronisierung warten zu müssen; nur die erste von Plex vorgeschlagene Folge wird berücksichtigt. Eine Plex-Neuindizierung einer Episode wird auch nach Serie + Staffel + Episode aufgelöst. Auf Android TV bleiben die Poster beim Fokussieren im Porträtformat fix, ohne Querformat-Zuschneidung oder Reihenverschiebung; die Wiedergaben behalten ihre lesbare Fortschrittsleiste und die Startseite bleibt bei 1080p/4K dicht.

## v1.24.51 — September 2026

### Android TV — Priorisierte Wiedergaben und kalibrierte Wohnzimmerkarten

Die Reihe „Weiter ansehen“ wird immer an die Spitze gesetzt, sobald eine Wiedergabe existiert, selbst wenn eine ältere Dashboard-Anordnung sie verdeckt hat. Die Karten der Startseite erhalten Proportionen, die für einen Fernsehbildschirm geeignet sind: Die Auswahl öffnet sich im Querformat, ohne die gesamte Reihe zu ersetzen. Die Wiedergaben ergänzen nun das Plex-Visual mit dem Movviz-Hintergrund ohne Text, wenn dieser verfügbar ist.

## v1.24.50 — September 2026

### TV — Allgemeines offizielles Logo und korrigiertes Navigationsraster

Das Prinzip zeigt das Porträt ohne Logo im Ruhezustand / das offizielle Logo separat im Fokus erstreckt sich nun auf Entdeckung, ähnliche Titel, die Filmografie eines Schauspielers sowie auf den vollständigen Katalog und die "alles ansehen"-Raster (wobei die Karte im Porträt und nicht im Querformat bleibt, da ein vertikales Raster nicht ohne Verschieben seiner Nachbarn wachsen kann). Der Texttitel verschwindet überall dort, wo dieses Logo angezeigt wird; er bleibt bei den Rastern diskret eingeklappt, wenn kein TMDb-Logo verfügbar ist. Das Laden der Logos ist gegen Netzwerk-Duplikate geschützt. Die ausgeklappte Seitennavigationsleiste richtet ihre Reiter nun endlich auf einer Seite aus, anstatt in unterschiedlichen Breiten zu schweben.

## v1.24.49 — September 2026

### TV — direkter Zugriff auf Profil und Startbildschirmthema

Auf Android TV ist das Profil nun über einen direkten Shortcut aus der Navigationsleiste zugänglich, ohne über den Kontowählerbildschirm gehen zu müssen. Der Startbildschirm und sein visuelles Thema wurden für mehr Konsistenz überarbeitet. Darüber hinaus werden bei Preisverleihungen (Oscars, Césars, Golden Globes...) und nicht fiktiven Inhalten, die von Katalogen als "Serien" hochgeladen wurden (Nachrichten, Talkshows, Reality-TV), niemals mehr als Vorschläge angeboten, unabhängig von ihrer Quelle.

## v1.24.48 — September 2026

### Plex- und Movviz-Fortsetzungen vereinheitlicht

Die Fortsetzung wird nun einmal pro Benutzer für Web, Profil und Android TV berechnet. Plex bleibt optional: Seine Positionen und seine Historie ergänzen die Movviz-Daten, ohne sie jemals zu ersetzen. Plex-Ansichten werden mit ihrem tatsächlichen Datum in der gemeinsamen Zeitleiste gespeichert, die Plex- und Movviz-Wiedergaben korrekt ordnet. Bei Serien wird nur die allererste nicht gesehenen Folge vorgeschlagen: Nach Abschluss einer Staffel 4 erscheint Staffel 5, Folge 1; Staffel 6 wartet auf den vollständigen Abschluss von Staffel 5. Das Anhalten während der Credits markiert das Medium ebenfalls sofort als gesehen und synchronisiert es mit Plex, wenn es verbunden ist.

## v1.24.47 — September 2026

### Unabhängige Profile auf TV und Mobilgeräten

Android-Profile werden nun nur noch auf dem Gerät gespeichert, pro Movviz-Konto und pro Server. Eine Deinstallation stellt nicht mehr die Profile eines anderen Geräts oder Haushalts wieder her, und die Plex-Sitzung eines Benutzers kann nicht mehr die eines anderen ersetzen.

## v1.24.46 — September 2026

### Episoden-Watchlist und optionales Plex

Hinzufügen von Watchlist-Aktionen pro Episode im Serien-Detail und zusätzliche Schutzmechanismen: Plex-Serveraufgaben werden sauber ignoriert, wenn Plex nicht konfiguriert ist, ohne das lokale Mediendatenprofil zu stören.

## v1.24.45 — September 2026

### Benutzer-Synchronisationsübertragung

Watchlist- und watched-Mutationen zeigen nun ihre Kapazität und ihre Übertragungs-Uhrzeit, mit LWW-Auflösung und Beibehaltung der Historie bei einem Wechsel zu nicht gesehen.

## v1.24.44 — September 2026

### Plex-Konvergenz von Notizen und Fortsetzungen

Lokale Notizen werden im Hintergrund mit Plex synchronisiert und die entfernte Fortsetzung respektiert nun den LWW-Zeitstempel, anstatt mechanisch den größten Wert zu bevorzugen.

## v1.24.43 — September 2026

### Vereinheitlichtes Medienprofil und Plex-Synchronisierung

Hinzufügen des geteilten Medienprofils, der LWW-Auflösung pro Feld, der Watchlist mit Episoden und Tombstones, der Profil-APIs und der Android TV-Anbindung. Plex bleibt optional und löst keine automatische Akquisition aus.

## v1.24.42 — September 2026

### Android TV — Fortsetzung, Untertitel, Genres und kontrolliertes Update

Android TV erhält eine wirklich dynamische Wiedergabe bei der Wiederaufnahme des Players (`Zurück zu HH:MM:SS`), standardmäßig deaktivierte Untertitel mit Profil- und Medienspeicherung, die Korrektur der Kategoriefilterung, die fälschlicherweise TMDb-IDs mit Genre-Namen verglichen hat, eine vollständige Löschung der benutzerdefinierten Daten bei einem Profilwechsel, einen lebendigeren Fokus und einen blinkenden Aktualisierungspfeil in der Seitenleiste. Automatische Updates können nicht mehr während der Navigation oder Wiedergabe gestartet werden: Nur das kurze Startfenster erlaubt die Autoinstallation; danach löst der Benutzer die Installation explizit über den Indikator aus.
### Ausgabeverzeichnisse ausgerichtet

Die Referenzversion ist nun im Webpaket, im Lockfile, im README-Badge und in den Gradle-Konfigurationen für Mobile und TV gleich: `1.24.42` (`versionCode` `12442`). CI-Builds behalten die Ableitung vom Release-Tag bei.

## v1.24.41 — September 2026

### Behobene Android-Veröffentlichung

Die Android-Mobile- und TV-Pipelines verwenden nun die aktuelle Version des SDK-Build-Tools, die direkt Android 35 und die Build-Tools 35.0.0 installiert. Die Generierung der Release-APKs funktioniert wieder.

## v1.24.38 — September 2026

### Keine Dokumentationen und Making-of mehr in den Vorschlägen

TMDb mischt regelmäßig Dokumentationen und Making-of in `/recommendations`, `/similar` und sogar in der Filmografie eines Lieblingsstars – der KI-Chat schloss diese bereits aus, aber nicht "Empfehlungen für Sie" oder "Weil Sie gesehen haben", die sie trotz wiederholter 👎-Bewertungen noch anboten. Die Genre-Affinität schließt niemals ein ganzes Genre aus (sie mildert nur seinen Score ab), daher war das nicht ausreichend. Das Genre Dokumentation ist nun eine harte Regel, die im Filter angewendet wird, der von allen Vorschlagsreihen genutzt wird: Priorität für Film und Serie, kein Dokumentarfilm mehr schlüpft hinein. Die manuelle Suche ist davon nicht betroffen – ein explizit gesuchter Dokumentarfilm bleibt auffindbar.

## v1.24.37 — September 2026

### Die Schauspieler-/Regie-Affinität treibt endlich die echte Reihe "Empfehlungen für Sie" an

Die in v1.24.36 hinzugefügte Schauspieler-/Regie-Affinität speiste bisher nur den Chat mit der KI, nicht die Reihe "Empfehlungen für Sie" selbst – fünf Sterne für zwei Filme von Jim Carrey zu vergeben oder ihn einfach mehrere anzusehen, ohne zu bewerten, ließ nichts anderes von ihm in den Vorschlägen erscheinen. Sie treibt nun auch diese Reihe an: Die vollständige Filmografie der 3 Lieblingsschauspieler/Regisseure (berechnet aus Bewertungen, 👍/👎-Stimmen UND dem bloßen häufigen Wiedersehen desselben Schauspielers, ohne explizite Bewertung) wird über TMDb abgerufen und in den Kandidatenpool eingespeist, mit gleichem Rang wie die Genre-Affinität von ≥95 % – ein direkter Treffer auf den Schauspieler kommt sogar vor.

## v1.24.36 — September 2026

### Neue Schauspieler-/Regie-Affinität – "Ich liebe Jim Carrey" zählt endlich für sich

Die berechnete Genre-Affinität (Aufrufe, Bewertungen, Stimmen, Anfragen) verknüpft niemals einen bewerteten Titel mit SEINEN SCHAUSPIELERN – zwei Filme von Jim Carrey mit 5/5 zu bewerten, verstärkte nur allgemein "Komödie", nichts brachte seine ANDEREN Filme zusammen. Eine neue Schauspieler-/Regie-Affinität, die aus explizit bewerteten oder abgestimmten 👍/👎-Titeln aufgebaut ist (niemals die gesamte Aufzeichnungsgeschichte, um schnell zu bleiben), ergänzt das Genre: "besonders an Jim Carrey als Schauspieler interessiert" wird zu einer Tatsache, die die KI direkt kennt und wiederverwenden kann, um seine anderen Filme vorzuschlagen. Momentan speist sie nur den Chat mit der KI (Generierung von Empfehlungen und Button "Kontext erstellen"), noch nicht die reine TMDb-Rangliste von "Empfehlungen für Sie".

## v1.24.35 — September 2026

### "Empfehlungen für Sie" – Serien zu schnell erschöpft, und Daumen hoch ist jetzt auch dynamisch

Das TMDb-Katalog "Empfehlungen" für Serien ist deutlich ärmer als das für Filme — nach einigen 👎 hatte die Serienreihe oft keinen Ersatz mehr anzubieten (die Karte verschwand, ohne dass etwas an ihrer Stelle trat), während die Filmreihe nie auf die gleiche Weise erschöpft war. Eine zweite TMDb-Quelle ("Ähnlich", basierend auf dem Inhalt und nicht auf den Gewohnheiten anderer Benutzer) ergänzt nun die erste für beide Typen. Ein Daumen hoch berechnet auch die Reihe jetzt neu, genau wie ein Daumen runter — eine Bewertung kann andere Titel wieder nach oben bringen.

## v1.24.34 — September 2026

### Minimale Jahreszahl der Karussells — zwei unterschiedliche Ursachen für zu alte Titel

Der Hero auf der Startseite wählte eine kleine Anzahl von Kandidaten (etwa 6) und filterte dann nach Jahr — wenn ein großer Teil dieser Kandidaten unter der minimalen Jahreszahl lag, ergänzte er freiwillig mit den ausgeschlossenen Titeln, anstatt einen unvollständigen Hero anzuzeigen, was mehrere Titel vor dem festgelegten Limit zeigen konnte. Der Kandidatenpool ist nun viel breiter von Anfang an, wenn eine minimale Jahreszahl definiert ist, damit der Filter echte aktuelle Kandidaten behalten kann, ohne jemals auf diesen Fallback zurückgreifen zu müssen. Die Reihe "Empfehlungen für Sie" auf den Seiten Filme/Serien konsultierte diese Einstellung überhaupt nicht — auch korrigiert.

## v1.24.33 — September 2026

### Die KI zeigte rohes JSON anstelle einer Bewertung — und bewertete eigentlich gar nichts

Bei einer Stapelbewertungsanfrage ("Gib allen Dragon Ball 5 Sterne") antwortete der Assistent manchmal mit einem rohen JSON-Block, der unverändert im Gespräch angezeigt wurde, und speicherte dabei tatsächlich NICHTS, obwohl er zuversichtlich klang ("Ist notiert!"). Das Modell verwendete ein nicht anerkanntes Format anstelle des intern erwarteten Markers — nun erkannt und tatsächlich angewendet, mit einer eigenen Bestätigung anstelle des JSON. Titel, die in einem Gespräch vor diesem Update erwähnt wurden, wurden nicht bewertet: Diese müssen erneut bei der KI angefordert werden.

## v1.24.32 — September 2026

### Auf Profil gehen führte immer zu einer Suche — die wahre Ursache dieses Mal

Der vorherige Fix (Abbrechen einer ausstehenden Suchanfrage) behob einen echten Bug, aber nicht diesen: Die Meldung blieb bestehen, selbst nach einem vollständigen Neuladen der URL /profile, was auf einen React-Zustand hindeutete. Die wahre Ursache: Der Passwort-Manager des Browsers ordnet ein Feld "aktuelles Passwort" einem nahegelegenen Feld "Benutzername" zu, um die automatische Vervollständigung vorzuschlagen — das Passwortänderungsformular des Profils hat keines in der Nähe, daher wählte der Browser das einzige andere sichtbare Textfeld auf der Seite: die globale Suche (immer oben angezeigt), das er mit dem gespeicherten Benutzernamen füllte und dann absendete. Ein Benutzername-Feld zielt nun korrekt auf diesen Mechanismus ab, und die Suche ist explizit von der automatischen Vervollständigung ausgeschlossen.

## v1.24.31 — September 2026

### "Kontext erstellen" (Profil) ignorierte die Bewertungen und die berechnete Genre-Affinität

Der Button "Kontext erstellen/regenerieren" im Profil synchronisierte die Bibliothek bereits im Hintergrund mit dem SQL-Log, aber der Text, der tatsächlich an die KI gesendet wurde, enthielt weder die 1-5-Sterne-Bewertungen noch die bereits berechnete Genre-Affinität (Aufrufe, Stimmen, Bewertungen, Anfragen) — nur die gesehenen Titel, Anfragen und rohen 👍/👎-Stimmen. Beide fehlen nun, sowohl für die manuelle Rekonstruktion als auch für die automatische Aktualisierung im Hintergrund (die jetzt auch bei einer neuen Bewertung, nicht nur bei einem Aufruf/Anfrage/Stimme ausgelöst wird).

## v1.24.30 — September 2026

### Auf Profil klicken führte zu einer Suche mit dem Benutzernamen

Tippen in die Suche und sofort auf „Profil“ klicken, öffnete zwar das Profilblatt, wurde aber nach ca. 300ms durch eine stille Rückmeldung zu `/discover?q=<pseudo>` gefolgt: Die Suche (Topbar/Sidebar) wird zwischen zwei Seiten nie abgebaut (das Chrome der App bleibt oben, nur der Inhalt ändert sich), daher blieb die durch das vorherige Tippen programmierte verzögerte Suche aktiv und führte schließlich nachrangig aus, wodurch die bereits erfolgte Navigation überschrieben wurde. Jede ausstehende verzögerte Suche wird nun gelöscht, sobald eine Navigation abgeschlossen ist.

## v1.24.29 — September 2026

### „Empfehlungen für Sie“ konsultiert endlich die berechnete Geschlechtsaffinität

Die Engine hinter der Reihe „Empfehlungen für Sie“ (TMDb-Kandidaten) konsultierte bisher nicht die aus der tatsächlichen Aktivität (Aufrufe, Stimmen, Bewertungen, Anfragen) berechnete Geschlechtsaffinität – nur die Konversation mit der KI profitierte seit dem letzten Update davon. Ein Titel, dessen Geschlechtsaffinität 95 % übersteigt (willkürlich sehr hoher Schwellenwert, nur ein solides und bestätigtes Indiz überschreitet ihn), erscheint nun vor der TMDb-Rangliste, anstatt sie nur leicht zu beeinflussen.

## v1.24.28 — September 2026

### Kontext-Engine — Die Schleife Aufrufe/Bewertungen/Stimmen/Anfragen ↔ Empfehlungen schließt sich

Das SQLite-Journal pro Benutzer (vorher eingeführt) erhielt bisher nur Lese- und explizite Korrekturen über die KI – die Stimmen 👍/👎, die 1-5-Sterne-Bewertungen, die Anfragen und die Ergänzungen über die KI existierten weiterhin nur in separaten JSON-Dateien und traten nie in dieses vereinheitlichte Journal ein, und nichts las nach einer Suche oder dem Öffnen eines Blattes, da keines der beiden irgendwo erfasst wurde. Alle diese Aktionen schreiben nun auch in das vereinheitlichte Journal (zusätzlich zu ihrer bestehenden Speicherung, ohne etwas zu zerstören), einschließlich zweier Signale, die vorher nirgends existierten: Suchen und das Öffnen von Blättern. Die Genre-Geschmacks-Engine (bereits für die Antworten der KI verwendet) integriert nun diese Aufrufe als zusätzlichen Beweis und gewichtet erstmals bei der tatsächlichen Rangliste der von der KI gesendeten Empfehlungen – bisher diente sie nur dazu, den Ton der Antworten zu färben, niemals dazu, was empfohlen werden soll. Download-Anfragen bleiben bewusst ein schwaches und gedeckeltes Signal (oft für andere angefordert, nicht für sich selbst); der bereits angesammelte Verlauf wird rückwirkend in das Journal übernommen, nichts geht verloren. Immer streng pro Konto – niemals eine Vermischung zwischen Profilen, auch nicht für Plex-Besitzer.

## v1.24.27 — September 2026

### „Schlechte Empfehlung“ schloss den Titel nicht mehr von den Vorschlägen aus und berechnete die Reihe nicht neu

Der Daumen-runter-Button 👎 auf einer „Empfehlungen für Sie“-Karte registrierte das Feedback zwar, aber die Engine hinter dieser Reihe (recommender/engine.ts, getrennt von der von der KI im Gespräch verwendeten) konsultierte dieses Journal nie – derselbe Titel konnte unendlich oft erscheinen. Es schließt nun jeden zuvor mit 👎 bewerteten Titel aus. Die Karte verschwindet auch sofort aus der Reihe, aber die Liste wurde bisher nie dahinter neu berechnet: nur eine einfache Lücke, niemals vor Ablauf des Caches ersetzt. Der Entfernen löst nun eine Neuvallidierung der Reihe aus, die dynamisch einen anderen Titel an seine Stelle gleiten lässt.

## v1.24.26 — August 2026

### Android mobile — Überarbeitung im TV-Stil, Hinzufügen mit einem Tipp, automatisiertes Update

Der Smartphone-Client übernimmt die gleichen Prinzipien wie das kürzlich überarbeitete TV-Version. Der Platzhalter „Meine Liste“ (nie implementiert) wird zu einem echten Tab „Bibliothek“: die vollständige Bibliothek in einem Raster, sortierbar nach Name/Bewertung/Jahr und filterbar nach Genre, mit einem Umschalter Filme/Serien — Entdeckung bleibt der Bildschirm, um Inhalte zum Hinzufügen zu finden. Der „Hinzufügen“-Button auf der Hauptkarte auf der Startseite öffnete bisher nur die Titelkarte (man musste dort zweimal tippen, um wirklich hinzuzufügen); er fügt nun direkt mit einem Tipp zur Bibliothek hinzu, wie es jede Entdeckungskarte bereits tut. Die Suche zeigt nun auf jedem Ergebnis denselben dynamischen Button, um hinzuzufügen, ohne über die Detailseite gehen zu müssen. Schließlich erhält der mobile Client den gleichen automatischen Aktualisierungsmechanismus wie das TV (Überprüfung beim Start gegen die letzte GitHub-Veröffentlichung, SHA-256-überprüfter Download, Hintergrundinstallation mit Fallback auf den Systeminstaller), der manuell über Profil einstellbar und überprüfbar ist.

## v1.24.25 — August 2026

### Episoden ohne Datum — kein „Fehlt“ mehr nach einer bereits als „Kommt bald“ angekündigten Episode

Eine Episode ohne bekanntes Veröffentlichungsdatum wurde als „Fehlt“ angezeigt (und wurde daher gesucht, als ob sie bereits existieren könnte), selbst wenn eine nummerierte Episode davor in derselben Staffel noch „Kommt bald“ mit einem bekannten zukünftigen Datum war — chronologisch unmöglich, eine Serie kann Episode 6 nicht vor Episode 4/5 ausgestrahlt haben. Jede nachfolgende, nicht datierte Episode in derselben Staffel erbt nun den Status „Kommt bald“ und zeigt nicht mehr fälschlicherweise „Fehlt“.

## v1.24.24 — August 2026

### Android TV — überarbeitte Navigation, Entdeckung getrennt vom Katalog, abgesenkter Player

Die seitliche Navigationsleiste (224dp fix, immer ausgeklappt) reduziert sich nun im Ruhezustand auf die Icons allein und klappt nur aus — wobei sie enger ist als zuvor — wenn sich der D-Pad nähert, um nicht permanent den Platz der Film-/Serienlisten zu verstopfen. Jeder Tab hat nun sein eigenes Icon (Startseite, Entdeckung, Filme, Serien zeigten bisher nur Text). Der alte Film-/Serien-Bildschirm (Hero + redaktionelle Reihen im Netflix-Stil) wird zum Entdeckungs-Tab, mit einem Umschalter Filme/Serien, um die beiden Universen in denselben Reihen nicht zu vermischen; die Tabs Filme und Serien werden zur vollständigen, rasterbaren Bibliothek, sortierbar nach Name/Bewertung/Jahr und filterbar nach Genre. Im Videoplayer (Fenster-Modus, nicht Vollbild) war die Steuerleiste am unteren Rand eines Panels fixiert, das nur 80 % der Bildschirmhöhe einnahm und einen leeren Bereich unter den Steuerelementen ließ — das Panel wurde auf 92 % vergrößert, um es näher an den tatsächlichen Rand zu senken.

## v1.24.23 — August 2026

### Manuelle Suche — der Cache ersetzt die Live-Suche nie wieder

Zwei frühere Korrekturen (v1.24.21, v1.24.22) reduzierten die Fälle, in denen der lokale Cache ausreichte, um die Abfrage der Indizes zu unterbrechen, aber jeder Schutzmechanismus hatte seine eigene blinde Stelle — der letzte blockierte sogar ein ansonsten korrektes Cache-Ergebnis. Die manuelle Suche fragt nun bei jedem Mal systematisch alle konfigurierten Indizes ab und fusioniert diese Ergebnisse mit denen des Caches, anstatt zwischen den beiden zu wählen: Keine Cache-Konfiguration kann mehr verhindern, dass ein Index für eine von dir durchgeführte Suche abgefragt wird.

## v1.24.22 — August 2026

### Interaktive Suche — ein einzelnes Cache-Ergebnis konnte auch die Live-Suche abbrechen

Der vorherige Fixumfasste nur den Fall einer gezielten Staffel/Episode. Die freie Textsuche („Interaktive Suche“) konnte das gleiche Problem haben, ohne dass eine Staffel-Sanktion beteiligt war: Der RSS-Cache speichert nur einen aktuellen Schnappschuss (~100-150 Veröffentlichungen insgesamt), daher reichte ein einziges Ergebnis darin für einen Titel aus, um die vollständige Abfrage der Indizes zu verhindern, obwohl einige viel mehr zu bieten hatten. Es sind nun mehr als ein Cache-Ergebnis erforderlich, um die Suche als bereits zufriedenstellend anzusehen.

## v1.24.21 — August 2026

### Manuelle Suche — eine Suche nach Staffel/Episode konnte einen gesamten Index ignorieren

Eine gecachte Veröffentlichung, aus der falschen Saison oder aus der falschen Episode, konnte — dank Qualitätsboni (Auflösung, Seeder...) — knapp die minimale Schwelle überschreiten, trotz des Limits bei falschen Übereinstimmungen. Ihre bloße Anwesenheit ließ dann glauben, dass die Suche bereits eine Antwort hätte, was die Live-Abfrage der Indizierer komplett negierte — und so Dutzende korrekte Ergebnisse verbarg, die woanders verfügbar waren. Ein für falsche Saison/Episode bestraftes gecachtes Ergebnis blockiert die Live-Suche nicht mehr.

## v1.24.20 — August 2026

### Indizierer — Schaltfläche zum Aktualisieren der Kategorien

Einstellungen → Indizierer bietet nun eine dedizierte Schaltfläche zum Neuladen der tatsächlichen Liste der Kategorien eines Indizierers direkt aus dem Auswahlpanel, ohne über die allgemeine Schaltfläche „Testen“ gehen zu müssen.

## v1.24.19 — August 2026

### Suche — Eine benutzerdefinierte Indiziererkategorie (z. B. „Sendung“) konnte ignoriert werden

Eine für einen Indizierer eigene Kategorie (wie „Sendung“ bei C411, eine ID außerhalb der Standard-Torznab-Nummerierung), obwohl in seinen Einstellungen korrekt angehakt, wurde bei der Suche „Serien“ nie angezeigt, sobald dieser Indizierer auch nur eine standardmäßig angehakte Kategorie hatte. Die Filterung erkennt nicht mehr nur Kategorien des anderen Typs (Film vs. Serie) als auszuschließen — eine benutzerdefinierte Kategorie, die Movviz unbekannt ist, bleibt enthalten.

## v1.24.18 — August 2026

### Manuelle Suche — Diagnose pro Indizierer

Ein Indizierer, der in den Ergebnissen einer manuellen Suche fehlte, blieb unsichtbar, sobald ein anderer Indizierer etwas fand — ein einzelnes aggregiertes Protokoll verbarg die Details. Das Protokoll (Einstellungen → Protokolle) zeigt nun bei jeder direkten Suche die Anzahl der Roh- und der gefilterten Ergebnisse für jeden einzelnen Indizierer an.

## v1.24.17 — August 2026

### Plex-Synchronisierung — Vollständige Diagnose zum Verschwinden von gesehenen Episoden

Das Protokoll (Einstellungen → Protokolle) zeigt nun bei jeder Synchronisierung die rohe Anzahl der „Episode“-Ereignisse, die tatsächlich von Plex empfangen wurden, bevor jegliche Filterung erfolgte — zuvor, wenn Plex von Anfang an keine sendete, unterschied dies nichts von einer stillschweigenden Filterung im Nachhinein. Die nächste Synchronisierung wird endlich genau zeigen, wo das Problem liegt.

## v1.24.16 — August 2026

### Android TV — Vereinheitlichte Navigation und Player

Die Android TV Navigation übernimmt eine echte NavRail: Kein Bildschirm oder Hintergrund geht mehr darunter, und das Hero nimmt die gesamte nutzbare Breite des Inhaltsbereichs ein. Die Startseite stützt sich auf die nativen TV-Listen: Das D-Pad scrollt Reihe für Reihe mit dem zugehörigen Scrollen und schließt sich erst oben der NavRail an.

Der Player fasst alle Steuerelemente in seinem unteren Dock zusammen. Der Fortschritt ist über das D-Pad erreichbar und mit links/rechts einstellbar; das Dock zeigt den tatsächlichen Wiedergabestatus an: Direktwiedergabe, Audio-Transkodierung oder Video-Transkodierung. Die Kompatibilitäts-Fallbacks behalten auch bei Netzwerk-Wiederholungen den korrekten Zustand bei.

## v1.24.15 — August 2026

### Protokolle — Filterung nach Tag oder Text

Einstellungen → Protokolle bietet nun ein freies Suchfeld zusätzlich zum bestehenden Filter nach Level, um ein bestimmtes Tag (z. B. `plex.watchSync`) inmitten des Rauschens von Tausenden von RSS-/Suchzeilen zu isolieren.

## v1.24.14 — August 2026

### Aktive Sitzungen — Ein transkodiertes Audio wurde als „Live-Stream“ angezeigt

Eine Movviz-Sitzung, die nur Audio transkodierte (Video unverändert kopiert), wurde im Admin-Panel als „Live-Stream“ angezeigt, obwohl der Player korrekt „Audio transkodiert“ anzeigte. Korrigiert — dieser Fall wird nun als Transkodierung angezeigt, und der Ziel-Audiocodec wird angezeigt, selbst wenn das Video nicht transkodiert wird.

### Player — Schaltfläche „Intro überspringen“, die die Wiedergabeleiste überlappte

Durch das Verkleinern des Fensters gingen die Steuerelemente der Steuerleiste auf zwei Zeilen und vergrößerten die Leiste über den vorgesehenen Rand für die Schaltflächen „Intro überspringen“/„Credits überspringen“/nächste Episode, die dann darüber lagen. Korrigiert.

## v1.24.13 — August 2026

### Herunterladen — ein verfügbares Episode konnte als „fehlend“ markiert bleiben

Mehrere Episoden derselben Serie, deren Download gleichzeitig endete, konnten sich überschneiden: Die Verfügbarkeitsmeldung des einen überschrieb die des anderen, wodurch die Episode trotz vorhandener Datei auf der Festplatte als „fehlend“ angezeigt wurde. Das bereits für diesen Konfliktfall bei Filmen und beim Direktimport von Serien vorhandene Korrektiv fehlte bei diesem Notfallpfad (verwendet, wenn ein Torrent aus dem Engine verschwindet, bevor der Import ausgelöst wird); es ist nun auf dieselbe Weise geschützt.

### Plex-Synchronisierung — Sichtbarkeit des Verschwindens von angesehenen Episoden

Das Protokoll (Einstellungen → Protokolle) gibt nun genau an, wie viele Episoden aus der Plex-Historie abgelehnt wurden und warum, anstatt auf eine Zahl zurückzufallen, die still auf Null gesetzt wurde. Ein Beispiel für die Rohfelder, die Plex für eine abgelehnte Episode zurückgibt, wird ebenfalls protokolliert, um die genaue Ursache auf diesem Server zu bestätigen.

## v1.24.12 — August 2026

### Aktive Sitzungen — Der native Movviz-Player wird nun angezeigt, zusätzlich zu Plex

Das Widget „Aktive Sitzungen“ (nur für Administratoren sichtbar) zeigte bisher nur Streams an, die von Plex weitergeleitet wurden. Es listet nun auch Inhalte auf, die direkt über den Movviz-Player, unabhängig vom Benutzer, abgespielt werden, mit denselben Informationen wie für Plex: Titel, Poster, Benutzer, Gerät, Direktwiedergabe/Kopie/Transkodierung und Fortschritt.

## v1.24.11 — August 2026

### Manuelle Suche — Ein Titel, der auf C411 vorhanden war, konnte in Movviz unsichtbar bleiben

Ein Indektor, der 10 Minuten nach einem einzigen 429-Fehler (Schutz vor wiederkehrendem Hintergrundverkehr: auto-grab, RSS-Scan) pausiert wurde, wurde während dieser gesamten Pause auch von der manuellen Suche ausgeschlossen, ohne dass eine entsprechende Meldung auf dem Bildschirm angezeigt wurde. Die manuelle Suche fragt nun alle konfigurierten Indekktoren ab, unabhängig von dieser Pause – die pro Minute geltende Anfragenbegrenzung jedes einzelnen Indekktors wird in jedem Fall eingehalten.

## v1.24.10 — August 2026

### Plex-Synchronisierung — Der Administrator-Account und die Home-Profile wurden nicht mehr als „gesehen“ hochgeladen

Seit der Umstellung auf die Plex-Sitzungs-Historie zur Verfolgung dessen, was von einem Konto gesehen wurde, synchronisierten der Administrator-Account und die von Plex Home verwalteten Profile (im Gegensatz zu externen Gastkonten) ihr Verlaufsprotokoll nie wieder: Plex filtert diesen Verlauf nach einer Server-eigenen ID (intern, getrennt von der bisher auf cloud.plex.tv gespeicherten ID), die diese beiden Kontotypen nie hatten. Die Synchronisierung löst nun die korrekte lokale ID über den Plex-Benutzernamen auf, bevor sie den Verlauf abfragt.

## v1.24.09 — August 2026

### Wartung

Versionserhöhung ohne funktionale Änderung.

## v1.24.08 — August 2026

### Einheitliches Branding — Windows, Android, Web/PWA und Docker

Das neue rosa/mauve Movviz-Logo mit weißem Klatschen wird zur gemeinsamen Identität der Anwendung. Der Installer und die Windows-Verknüpfungen verwenden nun ein Multi-Resolution-ICO, Android Mobile und Android TV teilen sich dieselben Launcher-/Adaptiv-Icons, das TV-Banner ist ausgerichtet und Web/PWA sowie die Docker-Assets verwenden dasselbe kanonische Bild.

## v1.24.07 — August 2026

### Wartung

Versionserhöhung ohne funktionale Änderung – Bereinigung des GitHub-Release-/Tag-Verlaufs vor 1.24.06.

## v1.24.06 — August 2026

### Einstellungen → Player — vollständige Deaktivierung von HDR/Dolby Vision → SDR

Tone Mapping von HDR10, HDR10+, HLG und Dolby Vision zu SDR kann nun vollständig unter Einstellungen → Player deaktiviert werden, selbst wenn der Server-Benchmark den üblicherweise erforderlichen Schwellenwert von 3× überschreitet. Ist es aktiviert, ändert sich das Verhalten nicht: Das Tone Mapping ist weiterhin nur oberhalb dieses Schwellenwerts erlaubt.

### Android TV — Startseite synchronisiert mit dem Desktop

Die Android TV-Benutzeroberfläche verwendet ab sofort das gleiche Layout wie das Desktop-Dashboard (`/api/dashboard/layout`): Die Reihenfolge und Sichtbarkeit der Reihen, die Aktivierung des Heroes, die Geschwindigkeit des Slideshows und das Autoplay des Trailers folgen der Serverkonfiguration anstatt eines festen TV-Layouts. Die Reihen „Empfehlungen für Sie“ und „Movviz Trends“ verwenden exakt dieselben Quellen wie das Desktop (`/api/metadata/recommendations`, trending-Reihe), und „Kürzlich hinzugefügt“/„Bald“ verwenden die tatsächlichen Daten (`addedAt`, VF-Veröffentlichungsdatum) anstelle einer ungefähren Sortierung.

## v1.24.04 — August 2026

### Vereinheitlichter Movviz-Player

Der automatische Player verwendet nun einen einzigen Movviz-Planer für lokale Dateien und rohe Plex-Quellen: Direktausspielung, wenn der Client tatsächlich dekodieren kann; Remuxing, wenn nur die Spur/der Container geändert werden muss; Audio-Transkodierung ohne Beeinträchtigung des Videos, wenn nur der Ton inkompatibel ist; und Video-Transkodierung nur, wenn nötig. Die tatsächlich ausgewählte Audiospur wird vor dem Codec entschieden: Eine nicht ausgewählte DTS-Spur kann keinen Transkodierung auslösen, wenn die gehörte Spur AAC ist. HDR→SDR bleibt unter 3× beim Benchmark verboten. Software-Video-Transkodierungen passen sich dem Benchmark an und sind auf 1,5× Vorschauspiel begrenzt, um Puffer zu halten, ohne den Server unnötig zu belasten.

### Windows, Linux und ARM64

FFmpeg/ffprobe verwenden ab sofort einen gemeinsamen Mediendynamik-Runtime. Der Windows-Installer enthält seine eigenen Binärdateien, und der Dienst verweist explizit darauf; die Docker-Images amd64/arm64 überprüfen FFmpeg und ffprobe während ihres Builds. Der Benchmark verwendet dieselbe Runtime-Auflösung wie der Player.

### Einstellungen → Player

Die Wiedergabeoptionen wurden aus Einstellungen → Plex entfernt. Ein dedizierter Player-Tab fasst die Aktivierung nach Profil, Audiosprache, Automatik-Engine, Reserve/Cache, Diagnose und Benchmark zusammen. Die alten manuellen Auswahlmöglichkeiten MSE/FFmpeg/HLS/Beta wurden zu Auto migriert; Plex behält nur noch Verbindung, Synchronisierung und Profile.

## v1.24.03 — August 2026

### Konfigurationsassistent — Blockierung direkt nach der Kontoerstellung

Die Erstellung des Administrator-Kontos, die in der vorherigen Version ganz am Anfang des Assistenten hinzugefügt wurde, blieb nach der Validierung des Formulars auf einem endlosen Ladebildschirm stecken und verhinderte den Abschluss der Konfiguration. Korrigiert.

## v1.24.02 — August 2026

### Konfigurationsassistent — Wiederherstellung der Kontoerstellung

Bei der allerersten Installation bot der Konfigurationsassistent nicht mehr an, ein Administrator-Konto zu erstellen oder ein Plex-Konto zu verknüpfen: Der Schritt „KI-Assistent“ blieb bei seinem Laden hängen, die Download-Engine zeigte „kein konfiguriertes Client“ an und der Plex-Schritt blieb leer. Das Beenden des Assistenten leitete dann in einer Schleife zu derselben Seite zurück, da noch kein Konto erstellt worden war. Die Erstellung des Administrator-Kontos ist nun der allererste Schritt des Assistenten, bevor alles andere kommt.

### Netflix-Import und Plex-Synchronisierung — Sehdaten

Der Import eines Netflix-Verlaufs speicherte jeden Titel als „soeben gesehen“ anstatt das tatsächliche Sehdatum zu behalten. Dieses tatsächliche Datum wird nun bewahrt. Die Echtzeit-Synchronisierung von Plex aktualisiert auch sofort den KI-Kontext, anstatt bis zu mehreren Minuten zu warten.

### Startbildschirm und „Neuheiten“-Fenster

Das Fenster, das die Neuheiten eines Updates anzeigt, konnte über dem animierten Startbildschirm erscheinen, anstatt auf dessen Verschwinden zu warten. Es erscheint nun erst, wenn der Startbildschirm abgeschlossen ist.

## v1.24.01 — August 2026

### Movviz AI — Gesprächskontinuität und explizite Präferenzen

Movviz AI behält nun viel besser den Faden der letzten Züge bei: Implizite Verweise wie „das“, „er“, „dieser“ oder „diese Änderung“ werden vorrangig aus dem jüngsten Gespräch gelöst, anstatt bei Null zu beginnen. Explizite Korrekturen des Benutzers ersetzen sofort widersprüchliche alte Annahmen und bleiben im Kontext priorisiert.

Explizite Präferenzen zu einem Titel werden nun mit maximaler Vertrauenswürdigkeit im User Context Engine gespeichert und speisen direkt die Empfehlungsbewertung. Eine Korrektur wie „Du irrst dich, ich liebe Watchmen“ wird somit zu einem strukturierten, dauerhaften und priorisierten Signal anstelle eines bloßen vergänglichen Satzes.

Der Dialogue Director wurde ebenfalls gelockert: automatische Eskalation, stereotypische Herausforderungen und die Pflicht, zu gewinnen oder das letzte Wort zu haben, wurden entfernt. Die Antwortmöglichkeiten können kürzer, natürlicher sein und zwischen Humor, Sarkasmus, Ironie, Selbstironie oder einer knappen Antwort variieren, mit einem verstärkten Anti-Wiederholungs-Guardrail.

## v1.24.00 — August 2026

### Movviz AI — Vereinheitlichtes User Context Engine

Movviz AI verfügt nun über eine vereinheitlichte und persistente Benutzerkontext-Engine. Ein SQLite-Ledger pro `user_id` speichert das Medienverlauf, ohne Profile zu vermischen: angesehen, Filme und abgeschlossene Episoden, separate Wiederholungen, Fortschritt, Wiederholungen und tatsächliche Chronologie, wenn bekannt. Alte Seh-/Fortschrittsdaten werden idempotent bootstrapped, ohne fehlende Daten zu erzeugen.

Die Query Engine kann diesen verifizierten Zustand nutzen, um der KI den genauen Serienfortschritt, laufende Inhalte und den jüngsten Verlauf mit Anreicherung durch Metadaten/Genres zu liefern. Bewertungen, Feedback, Anfragen, Fakten, Erkenntnisse und KI-Speicher bleiben über eine vereinheitlichte Adapter-Schicht kompatibel, um jegliche destruktive Migration zu vermeiden. Auch auf Beweisen basierende Geschmacksprofile und ein Vertrauensniveau können die Persönlichkeit speisen, ohne eine Inferenz in einen Fakt umzuwandeln.

Die Context Engine ist additiv und resilient: bestehende Stores bleiben funktionsfähig, SQLite-Schreibvorgänge verhindern bei einem Ausfall niemals das Lesen und `MOVVIZ_CONTEXT_ENGINE_DISABLED=true` ermöglicht einen sofortigen Rollback. Die Tests decken insbesondere die Multi-User-Isolation, die Idempotenz und die Speicherung mehrerer Wiederholungen ab.

### Runtime — Node.js 22

Der Movviz-Server wird auf mindestens Node.js 22 umgestellt, um die Verfügbarkeit von `node:sqlite` zu gewährleisten. Der Windows-Installer enthält nun Node 22 und die Linux-Builds verwenden/erfordern ebenfalls mindestens Node 22.

## v1.23.04 — August 2026

### Release — Ausgerichtete Versionen und Artefakte

Synchronisierungs-Release: Applikationsversion, Lockfile und Android TV/mobile Fallback-Werte ausgerichtet auf `1.23.04`. Das Tag `v1.23.04` löst die GitHub-Builds für den Windows-Installer, das Linux-Archiv und die Android TV/mobile Clients aus; das Docker-Image wird weiterhin von `main` generiert. Dieses Release führt keine funktionellen Änderungen ein.

## v1.23.03 — August 2026

### Karten — Verfeinerter virtueller YouTube-Rahmen

Das Profil `detail`, das von der vollständigen Karte und der fliegenden/TitlePanel-Karte geteilt wird, behält den virtuellen YouTube-Motor 1920×1080 von v1.23.02 bei, wechselt aber von einem Zoom von `1.10` auf `1.15`. Die Änderung bleibt zentriert und bewusst konservativ, um den visuellen Nutzen in den Karten wahrnehmbarer zu machen, ohne die bereits validierte `hero`-Karussell oder die `card`-Karten zu berühren. Der `postMessage`-Bridge, die Fallbacks, die Toggles, die Trailer-Auswahl und das interaktive Trailer-Modal bleiben unverändert.

## v1.23.02 — August 2026

### Ambient YouTube — Vereinheitlichte virtuelle 1080p-Engine

Die drei Ambient-Oberflächen (Hover-Karte, Hero/Karussell und Karten-Header) verwenden nun denselben rohen YouTube-Motor mit einem echten logischen Viewport von `1920×1080`, gesteuert über `postMessage` und dann mittels `ResizeObserver` in CSS reduziert. Jede Oberfläche hat ihren eigenen Framing-Preset: `card` behält den validierten Zoom von `1.36`, während `hero` und `detail` mit `1.10` starten, um ihrer vorherigen Darstellung so nahe wie möglich zu kommen und nach visueller Validierung unabhängig einstellbar zu bleiben. Die Bridge, `apiInterface`, das Verbergen des Chromes bei Exposition, die Schleife vor `ENDED`, der Backdrop-Vorhang, das Stummschalten und die Timeouts sind gemittelt. Das alte `YT.Player` bleibt der Sicherheits-Fallback und speist weiterhin das interaktive Trailer-Modal. Bestehende Toggles, die Reihenfolge der Trailer, direkte Video-Pfade und Android bleiben unverändert.

## v1.23.00 — August 2026

### Neue Versionsreihe

Wechsel zur Serie 1.23.x. Keine funktionellen Änderungen in dieser Version.

## v1.22.61 — August 2026

### Karten — Virtuelles YouTube-iframe in 1080p

Die kleinen YouTube-Vorschauen verwenden nun ein rohes iframe, dessen logischer Viewport weiterhin bei `1920×1080` liegt. Anschließend berechnet ein Movviz-Wrapper mittels `ResizeObserver` einen `transform: scale(...)`, um es auf die Größe der Karte zu reduzieren. Das Skalieren wendet `cover × 1.36` an, was exakt den Zoom/das Framing von v1.22.60 beibehält, während es YouTube glauben lässt, es verfüge über einen großen Desktop-Player. Das Ziel ist zweifach: die kompakte Anordnung des Players zu vermeiden und die Wahrscheinlichkeit zu maximieren, dass YouTube eine hohe Qualität auswählt; die 1080p-Qualität wird jedoch weiterhin von YouTube bestimmt und kann nicht offiziell erzwungen werden. Der Bridge `postMessage`, `apiInterface`, `hideVideoInfo` (falls exponiert), die Schleife vor `ENDED`, der Poster-Vorhang und der Fallback `YT.Player` bleiben unverändert. Wenn der Karten-Viewport nicht sauber gemessen werden kann, fällt Movviz automatisch auf die stabile Darstellung von v1.22.60 zurück. Hero, Karten, Modal und Android ändern sich nicht.

## v1.22.60 — August 2026

### Karten — YouTube-iframe-Beschnitt

Die kleinen YouTube-Vorschauen werden vertikal zentriert (`top: 50 %` anstelle von `46 %`) und erhalten 15 % zusätzlichen Zoom im Vergleich zum vorherigen Framing (`scale 1.18` → `scale 1.36`), um die in die Trailer integrierten schwarzen Balken zu entfernen. Der Bridge `postMessage` und sein Fallback `YT.Player` verwenden exakt dasselbe Framing. Hero, Karten, Modal, Trailer-Auswahl und Android bleiben unverändert.

## v1.22.59 — August 2026

### Karten — Rohes, von postMessage gesteuertes YouTube-iframe

Test unter realen Bedingungen auf kleine Vorschauen beschränkt: Der primäre Player der Karten ist nun ein rohes YouTube-iframe mit `enablejsapi=1` und `origin`, ohne Konstruktion über `new YT.Player()`. Movviz startet den Handshake `listening`, liest die tatsächlich deklarierten Fähigkeiten in `initialDelivery.info.apiInterface` / `infoDelivery` und versucht `hideVideoInfo` oder `hideControls` nur, wenn diese explizit von diesem Player exponiert werden. Wiedergabe, Stummschaltung, Zustände, `currentTime` und die Schleife vor END passieren über den Bridge `postMessage`. Der Poster bleibt opak, bis die Wiedergabe tatsächlich fortschreitet, und dann weitere 700 ms. Bei fehlerhaftem Laden, Handshake oder Wiedergabe zerstört die Karte diesen Pfad und fällt automatisch auf den stabilen `YT.Player` von v1.22.58 zurück. Hero, Karten, Modal, Android TV und die Auswahl/Fallback der Trailer bleiben unverändert.

## v1.22.58 — August 2026

### Karten — Poster-Vorhang + echte YouTube-Pause/Wiederaufnahme-Übergänge

Die kleinen Vorschauen verlieren nicht mehr 650 ms, bevor das iframe hochgefahren wird: Sobald die vorgesehene Vorschau geöffnet wird, startet YouTube sofort hinter dem Poster, das zu 100 % opak bleibt. Beim ersten `PLAYING` fordert Movviz `pauseVideo()`, wartet nun auf das tatsächlich bestätigte `PAUSED`-Ereignis, lässt diesen Zustand 450 ms stabilisieren, startet mit `playVideo()`, wartet auf ein zweites `PLAYING`, überprüft, ob `currentTime` tatsächlich voranschreitet, und behält dann noch 300 ms lang das Poster bei, bevor es zum Video verblasst. Ein globaler Timeout von 2,5 s bricht dieses Aufwärmen ab und fällt auf den historischen Settle von 1,5 s zurück, falls YouTube die Sequenz nicht befolgt. Hero, Karten, Modal, Android TV, Trailer-Auswahl und Fallback bleiben unverändert.

## v1.22.57 — August 2026

### Karten — Unsichtbares Aufwärmen des YouTube-iframes

Die kleinen Vorschauen starten nun früher unter dem Backdrop (650 ms anstelle von 1000 ms) und führen dann eine einzige versteckte Sequenz `PLAYING → pause → play` durch. Movviz wartet anschließend darauf, dass `currentTime` nach der Wiederaufnahme tatsächlich fortschreitet, und wendet eine kurze Verzögerung von 180 ms an, bevor das Video sichtbar wird. Diese Sequenz reproduziert den sauberen visuellen Zustand, der nach einer manuellen Wiederaufnahme ohne Mausbewegung beobachtet wird, während ein harter Fallback von 1500 ms beibehalten wird, falls YouTube einen Übergang ignoriert. Hero, Karten, Modal, Android TV, Trailer-Auswahl, Qualität und Fallbacks bleiben unverändert.

## v1.22.56 — August 2026

### Versionskorrektur — YouTube-Vorschau der Karten

Stellt den YouTube Preview-Fix für die kleinen Karten über der bereits existierenden `v1.22.55` bereit. Keine funktionale Änderung im Vergleich zum zuvor validierten Karten-Patch: YouTube iframe beibehalten, direkter YouTube → Benutzer-Verkehr, Crop `scale 1.18`, Zentrierung bei 46 %, proportionale obere Maske von 28 %, Hero und Seitenvideos unverändert.

## v1.22.54 — August 2026

### Karten — Kompaktes YouTube iframe ohne Titel

Gezielter Test nur an Karten-Previews: Hero und Seitenvideos bleiben unverändert. Die kleinen Karten behalten die YouTube IFrame API und den direkten YouTube → Benutzer-Verkehr bei, verwenden jedoch ein leicht verstärktes Crop (`scale 1.18`, Zentrum nach oben auf 46 %) und eine proportionale obere Maske von 28 %, um den Titel-/Kanal-Chrome des kompakten Layouts zu verdecken. `YOUTUBE_CHROME_SETTLE_MS=1500`, `LOOP_BEFORE_END_SEC=0.75`, die Auswahl der Trailer und die YouTube-Fallbacks bleiben unverändert. Es wird kein Piped/Invidious/yt-dlp hinzugefügt.

Der Rollback auf 1.22.53 hinterließ verwaiste Piped/Invidious-Dateien, die bereits `tsc --noEmit` ungültig machten; diese nicht referenzierten Überreste werden entfernt, um den Rollback sauber abzuschließen, bevor diese Version validiert wird.

## v1.22.53 — August 2026

### Rollback — 1.22.50 auf 1.22.53 verschoben

Der Pull von `v1.22.50` (sauberer Rollback von `v1.22.27`) auf `v1.22.53` verschoben.

## v1.22.50 — August 2026

### Rollback — Rückkehr zu 1.22.27 stabil

Sauberer Rückfall auf `v1.22.27` aufgrund von Hover-/Zoom-Regressionen.

## v1.22.27 — August 2026

### Torrents gesperrt

Eine bestimmte Veröffentlichung kann nun direkt aus der Download-Liste gesperrt werden. Die Sperrung ist an ihren Info-Hash gebunden: Andere Veröffentlichungen desselben Films oder derselben Serie bleiben daher verfügbar. Eine „Gesperrte Torrents“-Seite im Management ermöglicht die Einsichtnahme und das Entsperren jedes Torrents.

## v1.22.26 — August 2026

### TMDb Trailer

Spots, Promotionen und andere Werbevideos können nicht mehr einen echten TMDb-Trailer vorwegnehmen. Die Vorschauen in der Karussell-, Karten- und Seitenansicht bevorzugen nun in allen Kontexten den vollständigen offiziellen Trailer.

## v1.22.25 — August 2026

### Docker Workflow

Korrektur der YAML-Einrückung und Hinzufügen eines expliziten Workflow-Namens für Docker-Veröffentlichungen.

## v1.22.24 — August 2026

### Docker Veröffentlichungs-Fix

Korrektur des Workflows: Kommentare werden nicht mehr als ungültige Docker-Tags interpretiert.

## v1.22.23 — August 2026

### Unabhängige Docker Veröffentlichung

Das AMD64-Image veröffentlicht nun den Tag `latest`, sobald sein Build abgeschlossen ist. Der ARM64-Build läuft parallel mit seinem eigenen Tag, und das Multi-Architektur-Manifest wird danach zusammengebaut, was es NAS mit AMD64 ermöglicht, sich zu aktualisieren, ohne auf ARM64 warten zu müssen.

## v1.22.22 — August 2026

### Trailer: Priorität und Validierung

Die von TMDb verlinkten Videos sind nun die einzige Quelle für Vorschauen; das alte System der angereicherten Quellen ist deaktiviert. Der YouTube-Fallback lehnt jedes Ergebnis ab, dessen Titel und Typ nicht ausreichend validiert sind, um die Vorschauen eines anderen Films zu vermeiden.

## v1.22.21 — August 2026

### Eintrag: Verlauf des Verlaufs

Der untere Verlauf des Eintrags deckt nun korrekt den Rand des Panels ab und entfernt die feine Linie, die zwischen dem visuellen Element und dem Inhalt sichtbar war.

## v1.22.20 — August 2026

### Video-Fallback: Zuverlässige Auswahl

Der YouTube-Fallback validiert nun Titel, Sprache, Kanal und Videotyp. Spots, Teaser, Clips, Zusammenfassungen und Interviews werden zugunsten offizieller Trailer ausgeschlossen. Alte fehlerhafte Zuordnungen werden durch einen neuen Cache-Schlüssel ungültig gemacht.

## v1.22.19 — August 2026

### Karten: Stabile und vernebelte Vorschau

Die Video-Vorschau der Karten wird ohne Verschiebung oder oberen Schwarzbild während des Ladens angezeigt. Das Karussell und die Einträge behalten ihr unverändertes Rendering bei.

## v1.22.18 — August 2026

### Karten: Vereinheitlichte Video-Vorschau im Hero/Eintrag-Feed

Die Vorschau beim Überfahren von Karten (`DashboardPosterCard`) verwendet nun exakt denselben `TrailerHeader` wie der Hero und der Eintrag (`trigger="immediate" enabled={videoPreviewEnabled}`) – dasselbe `backdrop`, dieselben `trailerKeys/enhancedSources`, dasselbe Crossfade und derselbe Stummschaltknopf. Nur der Auslöser bleibt an der Maus (`videoReady` nach 1s); das Video-Rendering ist streng identisch.

## v1.22.17 — August 2026

### CI: Korrektur des Linux Release Builds

Der Überprüfungsschritt `tar -tzf | grep -qx` verursachte einen SIGPIPE, als grep vorzeitig nach einer Übereinstimmung beendete und so die Pipeline unter `set -euo pipefail` abstürzen ließ. Die Überprüfung schreibt nun die Liste der Dateien in eine temporäre Datei, bevor sie grep verwendet, wodurch das Signal eliminiert wird. Der Runner ist auf `ubuntu-22.04` festgelegt.

## v1.22.16 — August 2026

### KI: Geführter Dialog, doppelt Mistral und vollständige faktische Antworten

Movviz unterscheidet nun zwischen einer Kritik, einer faktischen Korrektur und einer echten Provokation, bevor es antwortet. Der Schlagabtausch steigert sich allmählich, vermeidet abgedroschene Phrasen und behält eine kohärente Mini-Ghostface-Szene bei, einen Schritt pro Nachricht. Mit zwei Mistral-Schlüsseln können zwei Antworten parallel bewertet werden, um nur eine anzuzeigen; ein einziger Schlüssel funktioniert weiterhin normal. Filmografien und Schauspieler-/Regie-Zählungen werden gegen TMDb und die Bibliothek überprüft, mit vorhandenen und relevant fehlenden Titeln, während Fragen zu Musik die faktische Websuche nutzen.

## v1.22.15 — August 2026

### Hero 5 garantierte Visuals + luftdichte KI-Profile

Hero stürzt nicht mehr auf 2 Visuals ab, wenn `minYear` zu stark filtert: Die Ausgeschlossenen werden immer nach dem Score sortiert, um immer 5 zu ergeben. KI: `getWatchStatus` + `getRecommendations` streng nach `userId` (Plex `accountId` überprüft, `rejectedForeignEntries` protokolliert), kein Film eines anderen Profils mehr.

## v1.22.14 — August 2026

### Suche und Verknüpfung: Yellowstone korrigiert + Sortierung Alles/Filme/Serien

Die Suche wechselt nicht mehr zur Filmografie eines Namensähnlichen Schauspielers (`Yellowstone` Schauspieler 3 Stimmen → `Yellowstone` Serie 73586 3298 Stimmen beibehalten), Dokumentarfilm `19355` wird anstelle der Serie nicht mehr vorgeschlagen, und die Entdeckungsseite erhält eine Sortierung `Alles | Filme | Serien` + `Relevanz/Beliebt/Neu/Bewertungen` ohne erneutes Abrufen, mit Hervorhebung von Bekanntem/Neuem. Plex-Verknüpfung `tvdb://85527` → `73586` bei Dokumentarfilm.

## v1.22.13 — August 2026

### KI: Generalisierte Anti-Wiederholung

Die Kontrolle hängt nicht mehr von einer ununterbrochenen Reihe von Beleidigungen ab: Alle Konversationsantworten werden mit kürzlichen Formulierungen verglichen. Kurze Provokationen wie „kleiner Schläger“ werden auch nach einer normalen Frage korrekt erkannt, es werden drei Umformulierungen versucht, bevor man sich zurückzieht, und ein expliziter Hinweis auf eine Wiederholung erhält eine kontextuelle Antwort statt einer allgemeinen Antwort. Die bestehende Persönlichkeit wird beibehalten.

## v1.22.12 — August 2026

### KI: Beibehaltene Persönlichkeit, gelöschte Wiederholungen

Der Assistent behält seinen Ton und seine Persönlichkeit bei, speichert sich jedoch nun Formulierungen, die über eine normale Unterbrechung des Gesprächs hinausgehen. Antworten, die dieselbe Struktur mit einigen geänderten Wörtern wiederverwenden, werden erkannt und neu generiert; bereits verwendete Einleitungen, Schlussfolgerungen und Wiederholungen dienen auch als temporäre schwarze Liste. Zu offensichtliche alte Wendungen wurden durch kurze und abwechslungsreiche Antworten ersetzt.

## v1.22.11 — August 2026

### Android TV: Absturz beim Startbildschirm dauerhaft behoben

`HomeScreen` `focusRequester` geschützt (`runCatching + withFrameNanos` 8 Frames), `heroIndex` Anti-Teilen-durch-Null, `AmbientTrailer` `availMem` 400Mo + `applicationContext` + Pool `1` idle, kein WebView-Leak mehr. D-Pad `focusGroup`/`padding 80dp` stabil.

## v1.22.10 — August 2026

### Remaster HD-Download + statisches Vorschaubild + optimiertes Dashboard beibehalten

Vollständiger Rückzug des Remaster HD-Systems (1.22.00) — zu viele Falsch-Positive — Rückkehr zu `Apple/Netflix/Disney+/Prime/IMDb → TMDb` genau wie zuvor, ohne Regression. Hover-Vorschaubild: Schwarzer Schleier und Zoom entfernt, bleibt statisch vor dem Video-Vorschau. Beibehalten: identisches Splash, D-Pad, Geschwindigkeitsoptimierung, SVG-Logos.

## v1.22.09 — August 2026

### Vollständiges und installierbares Archive Linux

Die Linux x64-Release enthält nun die vorkompilierte Anwendung, die Engine, `install.sh`, `uninstall.sh`, den systemd-Dienst und einen überarbeiteten Linux-Guide. Der Installer erstellt automatisch das Systemkonto `movviz`, installiert verfügbare Mediendependenzen, behält Daten bei Updates bei und kann das entpackte Bundle direkt installieren. Die CI überprüft den Inhalt des Archives vor der Veröffentlichung und liefert seine SHA-256-Summe.

## v1.22.08 — August 2026

### Zuverlässige Video-Vorschauen und vereinheitlichte Metadaten

Die Suche nach „remastered“ wurde aus allen Vorschauen entfernt: Sie konnte ein Video mit einem falschen Titel verknüpfen. Die verbesserten, zuverlässigen Quellen bleiben in der Reihenfolge Apple TV, Netflix, Disney+, Prime Video und dann IMDb, bevor der TMDb-Trailer folgt. Die Desktop-, Mobile- und TV-Karten zeigen nun nüchternere Metadaten: kompakte Dauer und Technik, Genres durch Punkte getrennt.

## v1.22.07 — August 2026

### Android TV Build repariert + Hero/Vignette sauber + Mobile ausgerichtet auf Desktop

TV-Build `focusGroup` Import korrigiert (`foundation` statt `ui.focus`), Hero-Pause `||` versteckt (`900→1500ms` + hoher Schleier `z-10`), Vignette beim Überfahren nur Video wie Hero, Mobile-Palette `Void #05060B / Surface #0D1020` auf Desktop ausgerichtet.

## v1.22.06 — August 2026

### Hero und Vorschaubilder: sauberes Video ohne YouTube-UI

Das zentrale `||` des Heroes verschwindet (Verzögerung `YOUTUBE_CHROME_SETTLE 450→900ms`, um den YouTube-Chrome abzudecken) und das Vorschaubild beim Überfahren verdeckt die YouTube-Titel-/Kanalleiste mit einem hohen Schleier, um nur das Video wie den Hero anzuzeigen.

## v1.22.05 — August 2026

### Splash synchronisiert mit Bildern und D-Pad TV

Der Splash bleibt nun, bis **alle Bilder des Dashboards** geladen sind (Timeout 15s angefordert) und nicht nur die Bibliothek — kein Splash mehr, der vor den Reihen verschwindet. Android TV-Korrekturen: `NavRail` + `LazyColumn` mit `focusGroup`/`padding 80dp` Anti-Overlay, `focusRestorer` null, `BringIntoViewSpec`, WebView-Speillgrenze `4→2Go`.

## v1.22.04 — August 2026

### Sofortiges Dashboard und SVG-Logos

Hochwertiger Movviz-Splash nur beim ersten Kaltstart (niemals bei jedem Klick) mit intelligenter Fortschrittsanzeige, Hintergrund-Voreinladevorgang für Entdeckung in optimiertem Modus (`requestIdleCallback` + `priority:low`), und Korrektur der TMDb-Logos in `*.svg`, die sonst 404 waren (`tmdbImageCache` erlaubt nun `svg`).

## v1.22.03 — August 2026

### Verbesserung des Chats

## v1.22.02 — August 2026

### Homogene Trailer-Vorschauen

Die Karten verwenden nun dieselbe Quellenauswahl wie das Karussell: restaurierter HD-Trailer, direktes Video und als letzter Ausweg YouTube. Beim Start bleibt YouTube kurz durch die Illustration verdeckt, um den großen zentralen Pause/Play-Button zu eliminieren, sowohl auf den Karten als auch im Karussell.

## v1.22.01 — August 2026

### Verbesserung des Chats

## v1.22.00 — August 2026

### Priorisierte restaurierte HD-Trailer

Neue globale Einstellung **„Priorisiere restaurierte HD-Trailer“** in **Einstellungen → Informationen, Bilder und Logos** (standardmäßig deaktiviert, mit einem Klick umkehrbar, für alle aktivierbar durch den Admin). Wenn aktiviert, versucht Movviz vorrangig restaurierte/remasterte/re-Trailer in **Full HD/4K** von **5 vertrauenswürdigen YouTube-Kanälen** (Digital Ciné, HD Retro Trailers, Casu/Re-Trailer, FilmsActu, The Digital Theater) – strenge Whitelist nach `channelId`, tatsächliche aufgelöste Auflösung (≥1080p obligatorisch, sonst abgelehnt), extrem konservative Titelübereinstimmung (≥0,85) + exaktes Jahr/±1 (homonyme Remakes niemals verwechselt), bevorzugte Sprache des Benutzers, Anbieter parallel mit kurzen Timeouts und globaler Frist von ca. 3s, dediziertes Ranking, separater Cache (7 Tage positiv / 18 Stunden leer / kein Cache bei vorübergehendem Fehler), sofortiger Fallback zum aktuellen Workflow (Apple/IMDb/Prime → YouTube) bei der geringsten Unsicherheit. Web-Integration: `DashboardHero` (Karussellkontext: Teaser > Trailer) und `TitleContent` (Detailkontext: Trailer > Teaser) über `TrailerHeader`/`TrailerModalPlayer` (`premiumSources` vorangestellt), `GET /api/trailers/remastered/resolve` prüft den Toggle VOR jeder Netzwerkanfrage, Android TV/Mobil: optionales Feld `premiumTrailerCandidates` (`= emptyList()`) — alte APK ignoriert, alter Backend ohne Feld stürzt nicht ab. Null Regression garantiert: Toggle AUS = exakt unveränderter Workflow.

## v1.21.17 — August 2026

### Schauspielerprofile: Nützliche Filmografie

Talkshows, Late Shows und Preisverleihungen verschmutzen nicht mehr die Schauspielerprofile. Movviz schließt das TMDb-Genre „Talk“ und seltene falsch kategorisierte Sendungen aus, ohne die Suche, die Entdeckung oder die Titelseiten zu ändern.

## v1.21.16 — August 2026

### Persönliche Empfehlungen auf Android TV und Mobilgeräten

Android-Apps verwenden ab sofort die auf dem Desktop bereits verwendeten Bibliotheksvorschläge. Die Reihen „Empfehlungen für Sie“, die am besten bewerteten Titel und die Genre-Auswahlen werden auf Grundlage der tatsächlich vorhandenen Filme und Serien berechnet, wobei die redaktionellen Reihen von Entdeckung beibehalten werden.

## v1.21.15 — August 2026

### Entdeckung: Ein „Ich mag nicht“-Titel erschien nach dem Aktualisieren erneut

Das 👎 auf einer Entdeckungskarte wurde zwar gespeichert, aber die redaktionellen Reihen (Trends, Beliebt, Bester...) überprüften dies nie – derselbe Titel erschien daher bei jeder Seitenaktualisierung erneut. Diese Reihen schließen nun dauerhaft Titel aus, die als „Ich mag nicht“ markiert sind.

### Filme/Serien: Fehlende Logos bei „Fortsetzen“ und kürzlich hinzugefügten Episoden

Auf den Seiten Filme und Serien wurden in den Reihen „Fortsetzen“ und „Kürzlich hinzugefügte Episoden“ anstelle des Logos der Titel als reiner Text angezeigt – diese Karten wurden nie bei der Gruppenabfrage der Logos berücksichtigt. Korrigiert. Zusätzlich wurde ein permanentes Abzeichen unten rechts auf der Karte („S03 · E02“) hinzugefügt, um die Episode auf einen Blick zu erkennen, ohne darüberfahren zu müssen.

### Chat-Verbesserung

### Chat-Verbesserung

### Karussell-Vorschau: Feine schwarze Linie bei Trailer

Ein leichter Rundungsversatz zwischen dem Video und seinem Rahmen ließ manchmal eine ein Pixel dicke schwarze Linie an einer Kante des Players erscheinen (direkte MP4/HLS-Trailer). Minimativer Zoom wurde hinzugefügt, um dies zu beseitigen.

### Chat-Verbesserung

### Chat-Verbesserung

### Chat-Verbesserung

### Chat-Verbesserung

### Verbesserung des Chats

### Verbesserung des Chats

### Verbesserung des Chats

### Verbesserung des Chats

### Verbesserung des Chats

## v1.21.01 — August 2026

### Intelligenter Chat: Häufige Wörter mit Titeln verwechselt

In realen Bedingungen getestet: Wenn man dem intelligenten Chat nur "bof" oder "Trottel" antwortete, geriet er anstelle des Verstehens des Kommentars auf einen obskuren Film mit zufällig diesem Namen ("O Bofe", "Ce crétin de Malec") ab. Erweiterte Liste gefilterter Wörter (häufige Interjektionen, übliche Beleidigungen), um ein alltägliches Wort nie wieder mit der Nennung eines Titels zu verwechseln.

## v1.21.00 — August 2026

### Linux-Installer der nächsten Generation + Update mit einem Klick

Der Linux-Installer (`packaging/linux/install.sh`) erkennt nun eine bestehende Installation und bietet an, diese zu aktualisieren (Bibliothek beibehalten), neu zu installieren oder zu deinstallieren – es ist nicht mehr nötig, das Repository zu klonen: `curl -fsSL .../install.sh | sudo bash` lädt direkt das einsatzbereite Bundle der neuesten Version herunter. Und in der Oberfläche funktioniert der Button "Mit einem Klick aktualisieren" (Einstellungen → Über), bisher nur für Windows reserviert, nun auch bei einer nativen Linux-Installation (systemd-Dienst) – Docker-Container bleiben wie bisher über `docker pull` aktuell.

## v1.20.12 — August 2026

### Vorschau beim Überfahren von Karten: leicht vergrößert

Bei einigen Titeln (RoboCop 2014 bestätigt) blieb ein feiner schwarzer Streifen oben/unten in der Videovorschau beim Überfahren einer Karte sichtbar – der Trailer selbst integriert einen leichten Letterbox. Der Zoom wurde um einen Schritt erhöht, nur für diese Vorschau (das Startkarussell und die Titelseite sind nicht betroffen).

## v1.20.11 — August 2026

### Android Mobil: Build-Korrektur

Der Android Smartphone Build schlug aus demselben Grund fehl wie der TV, der in v1.20.08 korrigiert wurde: Das mobile Startbildschirm hatte die Änderung des kompakten Vertrags von /api/interface/dashboard nicht übernommen. Gleiche Korrektur angewendet.

## v1.20.10 — August 2026

### Intelligenter Chat: Lebhafterer Schlagabtausch, wiederholte Frage neckend beantwortet

Der intelligente Chat reagiert nun auf den genauen Inhalt dessen, was Sie sagen (kein allgemeiner Spruch), behält immer das letzte Wort bei und weiß, einen langen Schlagabtausch zu beenden, indem er wirklich einen Film vorschlägt, um die Stimmung aufzulockern. Übrigens: Wenn er bemerkt, dass Sie eine Frage stellen, die bereits weiter oben im Gespräch beantwortet wurde, kann er Sie freundlich necken, bevor er antwortet – niemals anstelle der Antwort.

## v1.20.09 — August 2026

### Intelligenter Chat: Tonfall bei Beleidigungen, Take 3

In realen Bedingungen getestet: Der intelligente Chat wiederholte dieselbe Redewendung wortwörtlich (nur die Beleidigung änderte sich) und geriet manchmal immer noch auf eine nicht angeforderte Empfehlungsliste ab. Strenges Verbot jeglicher Listen in diesem speziellen Fall und die explizite Anweisung, niemals eine bereits im Gespräch verwendete Formel wiederzuverwenden.

## v1.20.08 — August 2026

### Android TV: Build-Korrektur

Der Android TV Build schlug fehl: Ein Dokumentationskommentar enthielt versehentlich eine Sequenz, die in Kotlin einen verschachtelten Kommentar öffnet, der nie geschlossen wird – der Rest der Datei wurde für den Compiler unsichtbar. Korrigiert.

## v1.20.07 — August 2026

### Vorschau beim Überfahren: Schwarzer Schleier von Video entfernt

Auf der Vorschaukarte, die beim Überfahren mit der Maus geöffnet wird, verdeckte der schwarze Schleier über dem abgespielten Trailer unnötigerweise das Bild – nur in diesem speziellen Fall entfernt (die Vorschaubild-/Platzhalter-Fallback behält seinen Schleier für die Lesbarkeit des Titels).

## v1.20.06 — August 2026

### Intelligenter Chat: Making-of wird nie mehr hinzugefügt, außer auf ausdrückliche Anfrage

Das Hinzufügen eines Films sollte nicht mehr automatisch ein Making-of oder eine abgeleitete Webserie anzeigen – es sei denn, Sie fordern es ausdrücklich an ("das Making-of von..."), in diesem Fall wird es nun respektiert, anstatt blockiert zu werden.

### Android TV: Robustheit beim Start

Der kompakte Vertrag der Startseite ist nun tolerant gegenüber einem unvollständigen Bibliotheks-Eintrag – ein fehlender Wert unterbricht die Ladung nicht mehr, sondern wird einfach ignoriert.

## v1.20.05 — August 2026

### Intelligenter Chat: Tonfall bei Beleidigungen, Aufnahme 2

In realen Bedingungen getestet: Bei einer Beleidigung wich der Intelligente Chat immer noch zu leicht aus ("Machst du Witze?") und schlimmer noch, er verwandelte die Beleidigung manchmal sogar in einen Vorwand, um eine nicht angeforderte Liste von Empfehlungen einzufügen. Die Anweisung wurde verschärft, damit er zuerst und wirklich auf die Provokation reagiert, ohne das Thema zu wechseln.

## v1.20.04 — August 2026

### Intelligenter Chat: Ergänzungen/Empfehlungen, weniger falsche Zuordnungen

In realen Bedingungen getestet: Die Anforderung von "Terminator 2" oder "Terminator Salvation" fügte manchmal ein Making-of oder eine abgeleitete Webserie anstelle des echten Films hinzu – ein Bonus-TMDb-Inhalt, der nicht als solcher erkannt wurde. Und eine Empfehlung wie "The Death of Stalin" konnte aufgrund der nicht übereinstimmenden französischen Lokalisierung des Titels anstelle des echten Films einen nahezu anonymen Dubletten-Eintrag (1 Stimme) anzeigen. Beide Fehler wurden behoben.

## v1.20.03 — August 2026

### Intelligenter Chat: Zuverlässigere JSON-Empfehlungen

Die internen Beispiele, denen der Intelligente Chat folgt, um eine Liste von Empfehlungen oder Ergänzungen zu erstellen, wurden verstärkt – mehrere Titel hintereinander anstatt nur eines, mit der exakten zu beachtenden Syntax. Ziel: Weniger Fälle, in denen das generierte Format fehlschlägt und eine allgemeine Fehlermeldung auslöst.

## v1.20.02 — August 2026

### Intelligenter Chat: Fragen zu Regisseuren, Filmografie und Tonfall

Mehrere natürliche Formulierungen ("Was hat X gedreht", "Wie viele Filme habe ich von X gedreht"... ) wurden nicht erkannt und lieferten eine erfundene Antwort. Korrigiert, und außerdem: Dokumentationen werden bei Antworten zu einem Regisseur nicht mehr mit echten Produktionen vermischt, und eine Empfehlungsanfrage, die manchmal nicht korrekt formuliert werden konnte, wird nun automatisch korrigiert, anstatt eine allgemeine Fehlermeldung anzuzeigen. Der Tonfall des Intelligenter Chats reagiert auch etwas besser auf einen neckischen Kommentar.

### Bibliothek: Straffere Darstellung

Auf den Seiten Filme und Serien belegten die Filter Verfügbar/Fehlt jeweils eine ganze Zeile neben einem unnötigen leeren Platz. Straffere Darstellung, weniger verlagerter Platz.

## v1.20.01 — August 2026

### Bibliothek: Plex-Empfehlungen und Episoden hinzugefügt

Filme und Serien öffnen nun mit einem Tab "Empfohlen", der ausschließlich aus Ihrer Bibliothek besteht: Wiedersehen, kürzlich hinzugefügt, personalisierte Auswahlen, beste Bewertungen und Genres. Die vollständige Bibliotheksansicht bleibt in ihrem eigenen Tab verfügbar. Das Dashboard zeigt auch kürzlich hinzugefügte Episoden mit deren Staffel und Episodennummer.

### KI und Metadaten

Die laufenden Verbesserungen an den KI-Aktionen, der Interpretationsabsicht und der TMDb-Auflösung sind in dieser Version enthalten.

## v1.20.00 — August 2026

### Große Bereinigung der GitHub-Releases

Vollständige Bereinigung des GitHub-Release-Verlaufs: Entfernung von Dutzenden alter, angesammelter Versionen, wobei nur nützliche Meilensteine erhalten bleiben. Keine funktionale Änderung auf Anwendungsebene.

## v1.19.63 — August 2026

### Wiederaufnahme: Menü der Karte, kein Sound-Button mehr

Auf den Karten der Linie „Wiederaufnahme“ (und allen Karten mit Video-Vorschau) wurde der Sound-Button entfernt – die Vorschau bleibt stumm, ohne unnötigen Button. Der Chevron öffnet nun ein Menü: „Als gesehen markieren“ (was auch die Karte aus Wiederaufnahme entfernt) und „Aus der Wiederaufnahme-Liste entfernen“, ohne sie als gesehen zu markieren. Bei der Gelegenheit werden die verbesserten Trailer-Quellen (Apple/IMDb) zu einer einzigen serverseitigen Einstellung und nicht mehr zu einer Benutzerauswahl.

## v1.19.62 — August 2026

### Suche: Echte Filmografie von Regisseuren, Filme und Serien vermischt

Die Suche nach einem Regisseur (z. B. „Christopher Nolan“) zeigte bisher nur Titel an, bei denen sein Name zufällig im Text vorkam, niemals seine echten Filme. Die Suche zeigt nun seine wahre Filmografie mit Hervorhebung seiner Werke. Weitere Korrektur: Eine Suche mischt nun Filme und Serien in denselben Ergebnissen, anstatt verlangen zu müssen, dass man den Tab wechselt. Der intelligente Chat unterscheidet nun auch zwischen „regiegeführt von“ und „auftritt in“ (Cameo, Produktion...) – er verwechselt beispielsweise kein Cameo in einer Serie mit einem echten Regiefilm mehr.

## v1.19.61 — August 2026

### Suche: Immer im Menü sichtbar

Korrektur: Die Suchleiste des Menüs verschwand einmal auf „Entdecken“ (das eine eigene separate Leiste hatte). Es gibt nun nur noch eine, immer an derselben Stelle, egal ob auf dem Dashboard oder bereits auf Entdecken. Auf Mobilgeräten wird das Lupen-Symbol zu einer echten Suchleiste statt nur einem Link.

## v1.19.60 — August 2026

### Suche: Direkt im Menü, Ergebnisse in Karten

Die Suche wurde vom Menü „Überall suchen“ zu einer echten Leiste im linken Menü verschoben – das Eintippen eines Wortes öffnet direkt Entdecken mit den Ergebnissen in Karten (Filme, Serien, Schauspieler, Regisseure), anstatt eines kleinen Dropdown-Menüs. Auf Mobilgeräten öffnet das Lupen-Symbol direkt Entdecken.

## v1.19.59 — August 2026

### Schnelle Suche: Schauspieler und Regisseure

Die schnelle Suche (Ctrl/Cmd+K) findet nun auch Schauspieler und Regisseure zusätzlich zu Filmen, Serien und Seiten – ein Personen-Ergebnis öffnet direkt deren Filmografie-Seite. Bei der Gelegenheit erkennt der intelligente Chat nun „wie viele Filme habe ich von [Regisseur]“ als echte Filmografie-Frage (zuvor wurden nur Formulierungen wie „Filmografie von X“ erkannt – eine anders gestellte Frage erhielt eine erfundene, nicht überprüfte Antwort).

## v1.19.58 — August 2026

### Trailer: Korrektur übersetzter Titel

In realen Bedingungen getestet: Ein Film wie „L'Idée d'être avec toi“ fand nie seinen Apple/Prime-Trailer, während der Originaltitel „The Idea of You“ ihn sofort findet – diese Kataloge verweisen fast immer auf die Filme unter ihrem englischen Titel, nicht unter der französischen Übersetzung. Die Suche verwendet nun vorrangig den Originaltitel (gleiche Logik wie bereits für die Dateisuche verwendet).

## v1.19.57 — August 2026

### Trailer: Korrektur der Langsamkeit

In realen Bedingungen getestet: Die Suche nach einem Trailer (Apple, Prime...) konnte bis zu 12 Sekunden dauern, da jede Quelle nacheinander überprüft wurde. Sie werden nun alle gleichzeitig überprüft – 4 bis 6 Sekunden statt 12, ohne dass sich das Ergebnis ändert.

## v1.19.56 — August 2026

### Trailer: Prime Video als Quelle hinzugefügt

Nach technischer Überprüfung in Echtzeit (heruntergeladener und als nicht verschlüsselt bestätigter Videosegment) schließt Prime Video Apple als direkte Trailer-Quelle für Filme an – gleiche Einstellung, gleicher automatischer Rückfall auf YouTube. Netflix bleibt deaktiviert: Auch hier wurde ein Live-Test durchgeführt, aber von Netflix mit einer Kontobeschränkung abgelehnt, bevor es den Videostream erreichte.

## v1.19.55 — August 2026

### Apple Trailer: HD/4K Qualität + Zuverlässigkeitskorrektur

Getestet unter realen Bedingungen (25+ Versuche, aktiviert und deaktiviert): Ein echter Fehler wurde gefunden und behoben – ein Stapel von Überprüfungen konnte fälschlicherweise vermuten lassen, dass ein Film nicht über einen Apple-Trailer verfügte, weil es aufgrund einer vorübergehenden Durchsatzbegrenzung seitens Apple war. Nutzen Sie diese Tests auch zur Qualitätsverbesserung: Der Apple-Trailer wird nun über den nativen HD/4K-Stream und nicht über eine Niedrigauflösungsdatei abgespielt, mit automatischer Auswahl der besten verfügbaren Qualität.

## v1.19.54 — August 2026

### Trailer: Verbesserte Zuverlässigkeit + Erweiterte Quellenabfrage

Der direkte Trailer-Player (Apple) verfügt nun über eine Sicherheitsfunktion: Wenn das Laden nach wenigen Sekunden nicht voranschreitet (beobachtet unter realen Bedingungen), wechselt Movviz automatisch zu YouTube, anstatt hängen zu bleiben. Die Quellenkette wurde auch auf Netflix, Disney+ und Prime Video erweitert – nach eingehender technischer Überprüfung stellen diese Plattformen keinen öffentlich nutzbaren Trailer ohne Umgehung von Schutzmaßnahmen oder einem Konto bereit, daher bleiben diese drei Quellen vorerst inaktiv (Apple bleibt die einzige direkte Quelle, YouTube das übliche Sicherheitsnetz).

## v1.19.53 — August 2026

### Trailer: Direkte Apple-Quelle vor YouTube (optional)

Neue Einstellung (Einstellungen → Mein Erlebnis, standardmäßig deaktiviert): Movviz kann nun versuchen, ein direkteres Apple-Video zu verwenden, bevor es wie bisher auf YouTube zurückfällt, was für die Atmosphäre des Eintrags und den Player „Trailer ansehen“ ist. Kein Funktionsverlust, falls die Apple-Quelle nicht gefunden oder fehlschlägt – YouTube bleibt das automatische Sicherheitsnetz, und die Einstellung kann mit einem Klick deaktiviert werden, um sofort zum aktuellen Verhalten zurückzukehren.

## v1.19.52 — August 2026

### Android-Apps: Schnellere Startzeit, Korrektur der Episodenwiedergabe

Die TV- und Mobilanwendungen laden die Bibliothek beim Start nun über einen einzigen kompakten Schnappschuss und nicht mehr über zwei vollständige Aufrufe, mit automatischem Rückfall auf das alte Verhalten bei Bedarf. Auch eine Korrektur bei Serien, die Plex- und lokale Episoden mischen: Die Quelle wird nun Episode für Episode bestimmt und nicht mehr aus der gesamten Serie abgeleitet, was bei einigen Episoden zu einem Wiedergabefehler führte. Der TV-Profilauswahlbildschirm wurde überarbeitet.

## v1.19.51 — August 2026

### Intelligenter Chat: Erfundene Dauer und Dateiqualität korrigiert

Live bestätigt: Auf der Seite eines Films konnte eine Frage nach dessen genauer Dauer oder Qualität (4K, HD...) eine erfundene Antwort erhalten – manchmal sogar mit Nachdruck, obwohl Movviz nichts davon tatsächlich übertragen hatte. Die tatsächliche Dauer und Qualität der Datei in der Bibliothek werden nun angegeben, oder das Fehlen von Daten wird offen gemeldet, anstatt einer ungefähren Zahl präsentiert zu werden, die als real dargestellt wird.

## v1.19.50 — August 2026

### Tags entfernt

Die Funktion für benutzerdefinierte Tags bei Filmen und Serien wurde vollständig entfernt – kein Feld mehr im Eintrag, kein Filter mehr in Filme/Serien, kein zugehöriges Menü mehr auf den Karten.

### Eintrag: Visuelle Verfeinerungen

Der Scrollbalken des Eintrags ist ausgeblendet, das Video wird bis zum tatsächlichen Rand des Panels gestreckt (es blieb vorher etwas kurz davor stehen), ein dunkler Schleier vor dem Video ist auf dem Großteil des Bildes weniger präsent (er verdunkelt nur nach unten, um sich mit dem Rest des Eintrags zu vermischen), leichter Zoom auf die Videovorschau, um die feinen schwarzen Streifen zu verdecken, die einige Trailer manchmal enthalten. Der dünne Trennstrich unter dem oberen Menü wurde ebenfalls entfernt.

## v1.19.49 — August 2026

### Filme und Serien öffnen einen Eintrag statt die Seite zu wechseln

Das Klicken auf eine Karte in Filme oder Serien lud früher eine ganze Seite neu – wie bei Entdecken oder dem Dashboard öffnet sich nun ein Eintrag über der Rasteransicht mit einem Einblend-Zoom-Effekt von der angeklickten Karte aus, ohne die Seite jemals zu verlassen. Er ist auch breiter als zuvor, um mehr Platz für das Bild und die Informationen zu lassen.

### Auf das Poster klicken startet die Wiedergabe, auf die Infos klicken öffnet den Eintrag

In der vergrößerten Ansicht beim Überfahren einer Karte startet das Klicken direkt auf das Bild oder den Wiedergabetaster sofort den Film; das Klicken auf den Informationsbereich (Jahr, Dauer, Genres) oder den Pfeil öffnet die vollständige Karte. Die kleine Vorschau beim Überfahren wird nicht mehr über einer gerade geöffneten Karte angezeigt.

### Anzeige von Karten optimiert

Der Zoom beim Überfahren des Kartenbildes wurde entfernt (die Karte vergrößerte sich bereits, das zusätzliche Zoomen des Bildes belastete den Effekt). Das Erscheinen der Karten in einem Raster beim Laden wird nun ohne JavaScript-Animation verwaltet.

## v1.19.48 — August 2026

### Intelligentes Scrollen in Filme und Serien, mit alphabetischem Index

Bei einer großen Bibliothek ließ das Öffnen von Filme oder Serien alles auf einmal laden und verlangsamte die Anzeige. Das Raster wird nun in Blöcken von 200 Titeln aufgefüllt und lädt automatisch weiter, wenn man sich dem Ende nähert – der Bereich der noch nicht angezeigten Titel bleibt reserviert, damit das Scrollen niemals überspringt. Ein plötzlicher Sprung weit in der Liste (Scrollbalken ziehen, Ende-Taste) lädt direkt den angekommenen Bereich, ohne auf eine progressive Nachholung vom Anfang zu warten. Bei Sortierung nach Titel erscheint eine A-Z-Leiste im Plex-Stil an der Seite, um direkt zu Titeln zu springen, die mit einem bestimmten Buchstaben beginnen.

### Neue Einstellung: Automatische Suche nach fehlenden Inhalten deaktivieren

Server-Einstellungen, nur für Administratoren, unter Einstellungen → Automatisierung: Schaltet den RSS-Scan, die periodische Nachprüfung fehlender Filme/Episoden und die Suche nach Tagesveröffentlichungen mit einem einzigen Schalter ab. Die Verfolgung nach Titel und der manuelle "Suchen"-Button funktionieren weiterhin normal.

## v1.19.47 — August 2026

### Intelligenter Chat: Ein Bonusinhalt konnte für den echten Film gehalten werden

Eine Karte für "geschnittene Szenen" oder "Making-of", die denselben Titel wie ein echter Film hatte, konnte in seltenen Fällen anstelle des Originals in einer Empfehlung vorgeschlagen werden – die angezeigte Bewertung basierte dann nur auf wenigen Stimmen. Diese Art von Inhalt wird nun automatisch ausgeschlossen, die Unterscheidung zwischen zwei identischen Titeln basiert auf dem tatsächlichen Stimmenvolumen und nicht nur auf der Bewertung, und ein Vorschlag kann nicht mehr mehrmals in derselben Antwort erscheinen.

## v1.19.46 — August 2026

### Einstellungen: Indexierer und Download-Clients waren nicht nur für Administratoren reserviert

Die Registerkarten "Indexierer" und "Download-Clients" waren für jeden Benutzer in den Einstellungen sichtbar, obwohl alle sensiblen Daten dort bereits auf Serverseite geschützt sind – korrigiert, sodass sie nur noch für Administratoren sichtbar sind, wie der Rest der Server-Einstellungen.

### Bilder aus dem Internet werden zu einer Server-Einstellung, die persönlicher ist

Die Wahl, Poster/Logos direkt von TMDb anstatt über den Server zu laden (Netzwerk-Impact/Last für das gesamte Haus), wurde bisher individuell pro Konto getroffen. Es gibt nun eine einzige Server-Einstellung unter Einstellungen → Cache.

### Intelligenter Chat: Zuverlässigere Empfehlungen

Drei Korrekturen nach einer Reihe von Tests unter realen Bedingungen: Ein technischer Code-Fragment (```json```) konnte wörtlich in einer Antwort angezeigt werden; ein Titel, der seinen Namen mit einem älteren/obskureren Werk teilte, konnte mit der richtigen Version verwechselt werden; ein Dokumentarfilm, der thematisch völlig unpassend war, konnte in einer Liste von Filmen, die "ähnlich" zu einer Fiktion waren, erscheinen. Der Ton und die Persönlichkeit bleiben streng unverändert – diese Korrekturen wirken nur auf die Zuverlässigkeit der übermittelten Daten.

### Klarere Fehlermeldung beim Abspielen

Wenn ein Video nicht abgespielt werden kann, weil der Browser den Codec nicht dekodieren kann (insbesondere HEVC, häufig bei 4K/HDR), wird dies nun klar angezeigt, anstatt einer allgemeinen Meldung.

## v1.19.45 — August 2026

### Plex-Wiederaufnahme-Fehler zwischen Konten behoben

Ein Plex Home Profil, das von einem Administrator-Token verwaltet wird, konnte in einigen Fällen vorgeschlagen bekommen, die Wiedergabe des Server-Eigentümerkontos anstelle des eigenen zu übernehmen. Die Antwort von Plex wird nun überprüft, bevor sie verwendet wird: Stimmt sie exakt mit der des Eigentümers anstatt mit dem angeforderten Profil überein, wird sie ignoriert, anstatt sie der falschen Person anzuzeigen.

## v1.19.44 — August 2026

### Gelöschte Dateien auf der Festplatte werden nicht mehr automatisch neu heruntergeladen

Ein Film, eine Episode oder eine ganze Serie, die direkt auf der Festplatte gelöscht wird (außerhalb von Movviz), landet nun im Papierkorb und wird nicht sofort automatisch erneut gesucht – mit einem Badge „Von der Festplatte verschwunden“, das sie von einer manuellen Löschung unterscheidet, und einem dedizierten Filter auf der Seite „Papierkorb“. Ein Eintrag im Papierkorb wird niemals automatisch gelöscht: Wiederherstellen Sie ihn, um einen Download erneut auszulösen (nützlich bei versehentlichem Löschen), oder leeren Sie ihn endgültig – in diesem Fall bittet Movviz auch Plex, seine eigene Referenz zu entfernen, damit es bei der nächsten Synchronisierung nicht von selbst wieder auftaucht. Das Löschen einer ganzen Serie gruppiert alles in einem einzigen Eintrag anstelle eines pro Episode; das Löschen nur einiger Episoden lässt den Rest der Serie unberührt.

## v1.19.43 — August 2026

### Logos verschwanden manchmal gleichzeitig von allen Karten

Korrigiert: Ein Hintergrund-Aktualisieren der Dashboard-Vorschläge konnte für einen Bruchteil einer Sekunde die Titel-Logos aller sichtbaren Karten gleichzeitig verschwinden lassen, bevor sie zurückkamen. Einmal angezeigt, bleibt ein Logo nun an Ort und Stelle, solange seine Karte sichtbar ist, auch wenn die umgebenden Daten leise aktualisiert werden.

## v1.19.42 — August 2026

### Fernschnittstelle viel schneller

Movviz kann nun einen optimierten Datenstrom verwenden, der von einem Administrator unter Einstellungen → Servergeschwindigkeit und -kapazität aktiviert werden kann. Das Dashboard, die Entdeckung, die lokale Suche und die Navigations-Badges fordern nur die für den Bildschirm notwendigen Daten an, anstatt die gesamten Bibliotheken herunterzuladen. Bei der Referenzbibliothek sendet das Dashboard etwa 89 % weniger komprimierte Daten.

Die Einstellung ist global für den Server, mit einem Kompatibilitätsmodus, der den historischen Betrieb für alle Benutzer sofort beibehält. Benachrichtigungen werden beim Öffnen der Glocke geladen, Echtzeit-Updates zielen nur auf die betroffene Daten und die Download-Queues passen ihre Aktualisierungsfrequenz an ihre Aktivität an.

## v1.19.41 — August 2026

### Dynamischeres Karten-Hovern

Die Vorschau, die beim Überfahren einer Karte vergrößert wird, bleibt nun während des Scrollens auf der Seite an ihrem Platz, anstatt auf dem Bildschirm festzuhängen, schließt sich sofort beim Scrollen und erscheint nun mit einem echten progressiven Zoom-Effekt und nicht nur mit einem einfachen Verblassen. Die Karten im Dashboard wurden ebenfalls leicht verkleinert, um besser mit denen von Filme und Serien zu harmonieren.

### Reduzierter Hintergrund-Netzwerk-Ladevorgang

Das automatische Vorspulen von Karten, das bei jeder sichtbaren Karte auf dem Bildschirm ausgelöst wurde, obwohl die Karte in Wirklichkeit in einem Panel geöffnet wurde, ohne wirklich zu navigieren, wird nicht mehr ausgelöst – weniger unnötige Hintergrundanfragen während der Navigation.

## v1.19.40 — August 2026

### Bereinigung der Veröffentlichung

Interne Dokumente, die zur Vorbereitung der Neugestaltung der Einstellungen verwendet wurden, wurden aus der öffentlichen Verteilung entfernt. Die Funktionalität des Kontrollzentrums und der Einstellungen bleibt streng unverändert.

## v1.19.39 — August 2026

### Die Einstellungen werden zu einem echten Kontrollzentrum

Die Startseite der Einstellungen überprüft nun live Plex, den Download-Engine, die Metadaten und den Speicher. Die Anzeigen leuchten nacheinander auf, geben ein klares Urteil über den Zustand von Movviz und öffnen direkt die zu korrigierende Einstellung, wenn Aufmerksamkeit erforderlich ist.

### Essentials-Modus und geführte Durchläufe

Die lange technische Liste weicht standardmäßig fünf verständliche Ziele: Mein Erlebnis, Lesen, Bibliothek und Plex, Downloads, dann Server und Daten. Jeder Pfad erklärt, was er enthält, unterscheidet zwischen wesentlichen und erweiterten Werkzeugen und behält ein kontextuelles Feedback bei. Der gespeicherte Expertenmodus gewährt sofortigen Zugriff auf die 25 Abschnitte, ohne dass irgendeine Option entfernt wurde.

### Suche und menschenähnlichere Bezeichnungen

Die Suche findet auch erweiterte Einstellungen aus dem Basismodus. Vage Namen wie „Erlebnis“, „GPU“, „Performance“ oder „Wartung“ beschreiben nun ihre tatsächliche Funktion. Die alten Links `?tab=` bleiben kompatibel und Standardbenutzer lösen nicht mehr unnötigerweise die für Administratoren reservierten Steuerelemente aus.

## v1.19.38 — August 2026

### Ein Eintrag konnte unendlich beim Laden stecken bleiben

Korrigiert: Das Abrufen von Informationen zu einem Titel von TMDb hatte keine Zeitbegrenzung mehr – eine anormal langsamere Antwort genügte, um den Eintrag unendlich auf seinem Ladebildschirm zu blockieren, ohne jemals fehlzuschlagen oder erneut zu versuchen. Eine angemessene Zeitbegrenzung ist nun implementiert, zusammen mit einem neuen automatischen Versuch bei jedem anderen Netzwerkfehler.

### Einstellung „Player-Engine“ präzisiert: Stabil / Auto / Beta

Die Administrator-Einstellung Einstellungen → Plex erhält zwei neue Optionen. „Stabil“ fixiert explizit das aktuelle Wiedergabeverhalten, garantiert niemals zu ändern, selbst wenn später auf „Auto“ zurückgesetzt wird. „Beta“ ist die neue Entscheidungs-Engine, die nun sowohl Filme als auch Serienepisoden verarbeiten kann (bisher auf Filme beschränkt). Automatische und punktuelle Migration bei diesem Update: unabhängig von der aktuellen Auswahl wird einmalig auf „Auto“ zurückgesetzt – um jeden zu schützen, der manuell die alte Experimentier-Engine ausgewählt hatte und glaubte, dass dies nichts ändern würde.

### HDR/Dolby Vision-Inhalte werden nicht mehr in SDR konvertiert

Absolute Regel ab sofort: Ein HDR- oder Dolby Vision-Titel wird unverändert abgespielt, niemals mit einer Farbkonvertierung auf ein Standard-Rendering, selbst wenn ohnehin ein Transcoding aus einem anderen Grund erforderlich ist. Ein Gerät, das HDR nicht nativ unterstützt, zeigt das Bild so an, wie es ist, anstatt auf eine kostspielige Konvertierung zu warten.

### Präzisere Wiedergabeanzeige

Das während der Wiedergabe angezeigte Badge gibt nun an, ob Hardware- (GPU) oder Software-Encoding (CPU) verwendet wird.

## v1.19.37 — August 2026

### Vertikale Video-Vorschauen in Trends und auf Einträgen

Korrigiert: Einige Video-Vorschauen (Karussell, Eintrag) wurden anstelle des üblichen Kinoforformats im Social-Media-ähnlichen vertikalen Format angezeigt. Die Erkennung, die diese vertikalen Clips ausschließen sollte, fragte die falschen Daten ab und funktionierte seit ihrer Implementierung nie wirklich – sie ist jetzt zuverlässig. Ein Studio kann nun auch einen echten Vorfall von vertikalen Clips für denselben Titel veröffentlichen; die Auswahl fällt in diesem Fall nun korrekt auf den klassischen Trailer zurück, anstatt stecken zu bleiben. Korrigiert wurde außerdem ein Videoplayer, der anstelle des Ausfüllens des gesamten Rahmens in einer verkleinerten Größe angezeigt werden konnte.

## v1.19.36 — August 2026

### Web-, Android TV- und Smartphone-Versionen ausgerichtet

Die Fallback-Werte der beiden Android-Projekte sind nun `1.19.36` mit dem `versionCode` `11936`, wie der Webserver und das Release-Tag. Die von der CI erstellten APKs verwenden bereits das Tag, und lokale Builds / „Über“-Bildschirme können keine ältere Version mehr melden.

## v1.19.35 — August 2026

### Kinokarussell, das verschwand und dann in einer Schleife zurückkam

Korrigiert: Die YouTube-API ersetzte selbst ein Element, das React nach dem Verlassen einer Diashow entfernen sollte. Dies löste einen `removeChild`-Fehler aus, und der Wiederherstellungsmechanismus ließ den Helden ständig hochlaufen. Der YouTube-Player ist nun vom von React verwalteten DOM isoliert; ein anhaltender Fehler kann das Karussell nicht mehr unendlich neu starten.

## v1.19.34 — August 2026

### Der Umschalter „Bilder aus dem Internet“ deaktivierte sich von selbst

Korrigiert: Das Aktivieren schien einen Moment zu funktionieren und kehrte dann auf Aus zurück. Die Speicherung der Einstellung wurde auf Serverseite still abgelehnt (Liste der erkannten Einstellungen noch nicht aktualisiert) — die Einstellung hält jetzt korrekt.

### Fehlendes Titel-Logo auf der Seite, Smartphone

Die Seite eines Films oder einer Serie auf Android Smartphone zeigte nie das TMDb-Logo des Titels (nur den Titel als Text), im Gegensatz zum Rest der App. Korrigiert — dieselbe Logik wie überall: Das Logo ersetzt den Texttitel, wenn TMDb eines hat.

## v1.19.33 — August 2026

### Entdeckung auf Android TV und Smartphone

Beide Android-Clients holen bei Entdeckung auf: dieselben redaktionellen Reihen wie im Web (einschließlich der personalisierten Reihe „weil Sie gesehen/geliked haben“), gleicher Genre-Filter mit Anime und Teenager-Romantik enthalten, „Alles ansehen“ in paginierter Rasteransicht. Neu auf dem Smartphone, wo dieser Abschnitt noch nicht existierte.

### Android Player — gleiche Darstellung wie im Web

Fortschrittsbalken und „Optimierung läuft“-Bildschirm (mit animiertem Logo) wurden auf beiden Android-Clients identisch übernommen, für ein konsistentes Erlebnis unabhängig vom Gerät. Auf dem Smartphone zeigt die Miniaturansicht, wenn man den Schieberegler bewegt, nun eine echte Vorschau des Bildes zu diesem Zeitpunkt und nicht nur einen zeitlichen Marker.

### Echtzeit-Download-Verfolgung von Serien auf Android TV

Die Seite einer Serie auf Android TV zeigt nun für jede laufend heruntergeladene Episode ihren Fortschritt, ihre Geschwindigkeit und die verbleibende Zeit — live aktualisiert, ohne die Seite verlassen und erneut öffnen zu müssen. Ausgerichtet auf das, was der Smartphone-Client bereits angeboten hat.

## v1.19.32 — August 2026

### Bilder direkt aus dem Internet geladen (optional)

Neue Einstellung in Einstellungen → Erlebnis: Poster, Hintergründe und Logos können nun direkt von TMDb geladen werden, anstatt immer über deinen eigenen Server zu laufen — nützlich, wenn deine Upload-Verbindung begrenzt ist. Automatischer Rückfall auf deinen Server, wenn TMDb nicht verfügbar ist. Standardmäßig deaktiviert: Es ändert sich nichts, solange du es nicht aktivierst. Eine zweite Einstellung, die erst nach Aktivierung der ersten verfügbar ist, priorisiert deinen Server, wenn du in deinem Heimnetzwerk bist (kein Interesse, in diesem Fall ins Internet zu gehen).

## v1.19.31 — August 2026

### Entdeckung wird wirklich personalisiert

Filme und Serien erhalten jeweils eine verankerte Reihe, basierend darauf, was Sie am meisten sehen (oder am besten bewertet haben) — wird nie angezeigt, wenn noch nicht genügend Verlauf vorhanden ist. Die vorgeschlagenen Titel gehen über das einfache Genre hinaus: Die Geschmacksmotore, die bereits an anderer Stelle in der App verwendet wird, verfeinert die Sortierung basierend auf dem tatsächlichen Stil des Ausgangstitels, nicht nur nach seiner TMDb-Kategorie.

## v1.19.30 — August 2026

### Die vergrößerte Vorschau blieb nach dem Öffnen einer Seite sichtbar

Das Klicken auf ein Poster, um dessen Seite zu öffnen, ließ die vergrößerte Vorschau (mit ihrem Video) darüber schweben, anstatt sich zu schließen. Sie schließt sich nun sofort beim Klicken.

## v1.19.29 — August 2026

### Mehr Porträt-Trailer in den Vorschauen

Seitdem der Teaser für animierte Hintergründe (Karussell, Seite, Poster-Hover) gegenüber dem klassischen Trailer bevorzugt wird, veröffentlichen einige Studios ihren Teaser im vertikalen Format (für soziale Medien gedacht) — gestreckt/beschnitten in ein 16:9-Format, war das Ergebnis schlecht. Vertikale Videos werden nun von der Auswahl ausgeschlossen; der Teaser bleibt immer bevorzugt, wenn eine Version im richtigen Format existiert.

## v1.19.28 — August 2026

### Video-Vorschau beim Überfahren eines Posters

Auf dem Desktop wechselt das Verharren des Mauszeigers über ein Film- oder Serienposter (Dashboard, Entdeckung) für eine Sekunde nun zur vergrößerten Vorschau mit animiertem Hintergrund-Trailer, wie auf den Seitenseiten — deaktivierbar über Einstellungen → Erlebnis → Video-Vorschauen (dieselbe Einstellung deckt nun beide Bereiche ab).

### Die Vorschläge enthalten keine nicht bewerteten oder noch nicht veröffentlichten Titel mehr

Die Reihen mit Vorschlägen (Dashboard und Entdecken) konnten einen Titel ohne jegliche Bewertung oder noch nicht im Kino vorschlagen — nichts zu sagen, nichts anzusehen. Sie zeigen nur noch Titel, die bereits bewertet und bereits veröffentlicht sind, außer den Reihen, die explizit für bald kommendes reserviert sind.

### Android TV Client — neue Entdecken-Reihen

Die kürzlich auf der Web-Seite hinzugefügten Reihen (von Kritik gelobt, Anime-Universum, Teenager-Romanze, Kurzformat, nach Genre sortiert) werden nun mit ihrer korrekten französischen Bezeichnung auf dem Android TV Client angezeigt, anstatt mit einer generischen Bezeichnung.

## v1.19.27 — August 2026

### Das Video überlief oben und unten auf einem Ultra-Wide-Bildschirm

Auf einem Bildschirm, der breiter als 16:9 (Ultra-Wide) ist, skaliert der Player das Video nicht mehr korrekt: Anstatt sein Seitenverhältnis mit schwarzen Balken an den Seiten beizubehalten, dehnte es sich über die Breite des Fensters und überlief oben und unten, wodurch oben und unten vom Bild abgeschnitten wurde. Korrigiert — das Video behält immer sein ursprüngliches Seitenverhältnis bei, unabhängig vom Bildschirmformat.

## v1.19.26 — August 2026

### Die neuen Entdecken-Reihen waren nicht für alle sichtbar

Die Einstellungen-Seite ermöglicht die Wahl zwischen zwei Darstellungen für Entdecken ("Movviz" oder "Allociné"). Die neuen Reihen, die in v1.19.24 hinzugefügt wurden (von Kritik gelobt, Anime-Universum, Teenager-Romanze, Kurzformat, nach Genre sortiert), waren nur für die Standarddarstellung aktiviert — unsichtbar für alle, die die andere gewählt hatten. Sie erscheinen nun auf beiden, mit demselben Inhalt.

## v1.19.25 — August 2026

### Endlosschleife beim Aktualisieren auf Android TV

Die Anwendung installierte sich bei jedem Start als „Update“ neu, selbst kurz nachdem sie bereits ein Update angewendet hatte: ihre interne Versionsnummer blieb bei einem alten Wert stecken, anstatt die tatsächlich veröffentlichte Version zu verfolgen, weshalb sie glaubte, permanent hinterherzuhinken. Sie schlägt nun nur noch ein Update vor, wenn es wirklich eines gibt. Die in „Über“ des Android Smartphone Clients angezeigte Versionsnummer war auf dieselbe Weise festgefahren (ohne Konsequenzen, dieser Client hat noch kein automatisiertes Update) und wurde bei diesem Durchlauf korrigiert.

## v1.19.24 — August 2026

### Entdecken stark erweitert und zwei neue geteilte Genres hinzugefügt

Die Seite Entdecken zeigt nun viel mehr redaktionelle Reihen (von Kritik gelobt, Anime-Universum, Teenager-Romanze, Kurzformat, plus mehrere Reihen nach Genre) zusätzlich zu den bereits vorhandenen. Zwei neue Genres erscheinen im Genre-Menü, überall dort, wo es bereits existiert: „Anime“ und „Teenager-Romanze“ (für ein aktuelles Jugendpublikum gedacht, nicht für Kinder). Die Seiten Filme und Serien erhalten ebenfalls ein Genre-Filter neben den bestehenden Filtern, mit derselben Genre-Liste wie in Entdecken — einschließlich Anime und Teenager-Romanze, um leicht wiederzufinden, was Sie bereits besitzen.

## v1.19.23 — August 2026

### Suche nach Veröffentlichung fehlgeschlagen für einen Originaltitel in nicht-lateinischer Schrift

Ein Film oder eine Serie, deren Originaltitel bei TMDb in Japanisch, Chinesisch, Koreanisch, Russisch, Arabisch, Thailändisch usw. geschrieben ist, konnte keine Veröffentlichung mehr zum Download finden: Die automatische Suche bevorzugte immer den Originaltitel, aber es wurde nie eine Veröffentlichungsszene in diesen Schriften benannt. Nun greift es auf den lokalisierten Titel zurück (den in Movviz angezeigt), sobald der Originaltitel für eine Suche nicht nutzbar ist, sowohl für Filme als auch für Serien.

### Neues Einstellungs-Dashboard

Die Einstellungsseite öffnet sich nun mit einem Dashboard mit einer Suchfunktion nach Absicht („fehlender Film“, „Langsamkeit“, „Plex“…) , Statuskarten (Plex, Download-Client, Metadaten, Speicher) und Verknüpfungen zu den am häufigsten verwendeten Einstellungen. Die bestehende Seitenleiste bleibt von jeder Einstellung aus zugänglich — alle bereits zirkulierenden Links `?tab=...` funktionieren weiterhin identisch.

### Die Seite „Aktivität“ heißt jetzt „Downloads“

Das Menü nannte diesen Bereich bereits "Downloads", aber die Seite selbst zeigte immer noch "Aktivität" / "Aktivitätszentrum" an, und ihre Adresse blieb `/activity`. Beide sind jetzt ausgerichtet: Die Seite befindet sich unter `/downloads` und zeigt überall "Downloads" an. Die alte Adresse `/activity` leitet automatisch zur neuen weiter, wobei der aktive Tab beibehalten wird – kein bestehender Link oder Lesezeichen bricht.

## v1.19.22 — August 2026

### Änderung des Audio-/Untertitel-Tracks: Ende des stillen Umschaltens zum alten System

Korrigiert einen schwerwiegenden Rückfall im neuen lokalen Wiedergabemotor: Das Wechseln der Audiosprache oder des Untertitels während der Wiedergabe ließ es fehlschlagen und fiel auf das alte Plex/HLS-System zurück (Badge "Transkodiert (Audio)", Position zurückgesetzt auf 0). Der Track-Wechsel erfolgt nun korrekt über den neuen End-to-End-Motor, ohne jegliches Umschalten. Der Button "Transkodierungsmodus" (Blitz), der nur das alte System steuerte und nicht mehr nötig war, wurde entfernt. Korrigiert außerdem einen Fall, bei dem ein englischer Audiospur im Menü mit der Bezeichnung "Französisch" angezeigt werden konnte (die Bezeichnung stammte von Plex und wurde nun mit den tatsächlichen Datei-Tags überschrieben).

## v1.19.21 — August 2026

### Daumen nach unten überall, und wirklich nützlich für Vorschläge

Der Daumen nach unten erscheint jetzt auf allen Karten (einschließlich der Bibliothek, ohne jemals den Titel aus Ihrer Sammlung zu entfernen) – darauf zu klicken entfernt nur die Karte aus der angezeigten Reihe. Er übermittelt auch das Genre des Titels an den Empfehlungsmotor, der zukünftig ähnliche Titel vermeiden kann, anstatt nur diesen spezifischen Titel auszuschließen.

## v1.19.20 — August 2026

### Der Schleier "Optimierung läuft" folgte nicht dem tatsächlichen Wiedergabe-Start

Korrigiert einen Rückfall, der in 1.19.17 eingeführt wurde: Der Vollbild-Schleier schloss sich auf einen festen Timer von 1,5s, anstatt dem tatsächlichen Wiedergabe-Start zu folgen, was ihn zu früh (bevor ein Audio-Switch wirklich bereit war) oder zu spät schließen ließ. Er schließt sich nun exakt, wenn die Wiedergabe tatsächlich beginnt – direkt, wenn kein Switch nötig ist, oder transkodiert, wenn ein Switch stattgefunden hat.

## v1.19.19 — August 2026

### Auswahl von Trailern und Teasern je nach Kontext

Das Dashboard-Karussell und der animierte Hintergrund der Titelseite bevorzugen nun einen Teaser (kurzer Ausschnitt) gegenüber einem vollständigen Trailer, mit automatischer Umschaltung, falls kein Teaser existiert – umgekehrt gilt dies für die freiwillige Aktion "Trailer ansehen" auf der Seite, die immer den vollständigen Trailer bevorzugt. In beiden Fällen folgt die Reihenfolge der aktiven Sprache des Benutzers, dann der Originalsprache des Films oder der Serie, und dann den 4 Sprachen von Movviz. Der Android TV Client profitiert von der gleichen Auswahl in seinem eigenen Start-Karussell.

## v1.19.18 — August 2026

### Daumen nach unten bei Vorschlägen

Ein Button "Nicht interessiert" erscheint nun neben dem Daumen nach oben in den Reihen "Für Sie empfohlen" und "Trends" auf dem Dashboard: Ein Klick schließt den Titel dauerhaft von zukünftigen personalisierten Empfehlungen aus und entfernt ihn sofort aus der angezeigten Reihe.

## v1.19.17 — August 2026

### Ende des "Direktwiedergabe dann Audio-Switch"-Flackers beim Start

Bei Direktwiedergabe erfolgte die Erkennung von Audio-Stille im Hintergrund, während das Video für den Benutzer bereits sichtbar und hörbar war – wenn der Ton inkompatibel war, waren der direkte Start und der Switch zur Audio-Transkodierung auf dem Bildschirm sichtbar, begleitet von einem unschönen Flackern. Ein Vollbild-Schleier mit der Movviz-Logo-Animation verdeckt nun den gesamten Start, bis bestätigt wird, dass der Ton funktioniert (nahezu sofortige Bestätigung im normalen Fall, bis zu 800ms im seltenen Fall einer tatsächlich zu erkennenden Stille).

## v1.19.16 — August 2026

### Der automatische Benchmark wartet nun auf die Stabilisierung des Servers

Bei realen Bedingungen direkt nach der Bereitstellung von 1.19.14 festgestellt: Die allererste automatische Ausführung des Benchmarks (kurz nach einem Update) ergab ein deutlich niedrigeres Ergebnis als ein zweiter manueller Versuch einige Augenblicke später auf demselben Server – was durch die Startlast des Servers selbst verunreinigt war und kein echtes Abbild seiner Fähigkeiten darstellte. Ein kurzes Zögern vor dem automatischen Auslösen lässt dem Server nun zuerst stabilisieren.

## v1.19.15 — August 2026

### Nicht-UTF-8-Untertitel (alte französische Releases) endlich zuverlässig

Ein in einem alten Format (Windows-1252, üblich bei älteren französischen Releases) kodierter Untertitel ließ die Bild-Einbettung abstürzen und erzeugte eine leere Untertiteldatei ohne sichtbaren Fehler für die Extraktion. Automatische Erkennung der richtigen Kodierung vor der Verarbeitung – eine bereits korrekt kodierte Datei (die überwiegende Mehrheit heute) wird niemals verändert.

## v1.19.14 — August 2026

### Server-Benchmark, Bereinigung des manuellen Wiedergabewählers und mehrere Hintergrundkorrekturen

- **Server-Benchmark** (Einstellungen → Leistung): Misst direkt die tatsächliche Transkodiergeschwindigkeit dieses Servers für repräsentative Fälle (einfwerte Software, Software mit HDR→SDR-Konvertierung, Hardware, falls verfügbar) – anstatt sie während der Wiedergabe zu entdecken. Wird manuell, automatisch direkt nach der Installation eines Updates und einmal im Monat über einen geplanten Task gestartet.
- **Korrigierte HDR-Erkennung des Bildschirms**: Der Browser meldete seine tatsächliche HDR-Fähigkeit dem Server nie – korrigiert mit einer echten Erkennung.
- **Bereinigter manueller "Transkodierungsmodus"-Wähler**: Diese Optionen (Nur Audio, Nur Video, Manuelles HLS) steuerten nur den alten Plex-Kreis – bei rein lokalen Inhalten waren sie fehlerhaft und schalteten still ab. Sie erscheinen nur noch, wenn ein echter Plex-Link existiert.
- **Eingebettete Cover-Art wird nicht mehr mit dem Hauptvideo verwechselt**: Eine Datei mit einem eingebetteten Cover-Bild konnte in seltenen Fällen dieses Bild analysieren lassen, als wäre es der Film.
- **Geteilte Transkodierungssitzungsgrenze** zwischen dem neuen Engine und dem alten Plex-Kreis, anstatt zwei unabhängige Grenzen, die sich addieren konnten.
- **Bereinigung beim Server-Herunterfahren**: Noch aktive Transkodierungsprozesse werden nun ordnungsgemäß gestoppt beim Neustart/Neuverteilung, anstatt als Waisen zu verbleiben.

## v1.19.13 — August 2026

### Neue Engine (experimentell): HDR/Dolby Vision erzwingt nie mehr eine Video-Transkodierung

Hintergrundänderung statt einer zusätzlichen Einstellung: Ein HDR- oder Dolby Vision-Offset zwischen Datei und Wiedergabegerät löst nicht mehr allein eine Video-Transkodierung aus. Das Video wird unverändert kopiert – ein nicht Dolby Vision-kompatibler Decoder zeigt das Bild trotzdem korrekt an, nur mit einer leicht unpräziseren Farbwiedergabe als die perfekt kalibrierte Version. Bei moderner Hardware überwiegt die Vermeidung einer kostspieligen Video-Transkodierung (die oft nicht mit der Echtzeitwiedergabe Schritt halten kann) diesen Wiedergabekompromiss bei weitem. Eine echte Video-Transkodierung wird bei jeder tatsächlichen Inkompatibilität (Codec, Profil, Palettentiefe, Farbtiefe, Auflösung) weiterhin normal ausgelöst – in diesem Fall bleibt die HDR→SDR-Konvertierung angewendet.

## v1.19.12 — August 2026

### Neue Engine (experimentell): Die HDR→SDR-Konvertierung blieb auch nach 1.19.11 zu anspruchsvoll

Gemessen an dem anspruchsvollsten Inhalt (4K Dolby Vision), ohne zusätzliche Serverlast: Die Wiedergabe fortschritt nur mit etwa 30 % der benötigten tatsächlichen Geschwindigkeit, stabil über mehrere Messungen – kein einfaches Verlangsamen beim Start.

- **Korrigiert**: Die Auflösengrenze für die Kombination aus Software-Encoding + HDR→SDR-Konvertierung steigt von 1280 auf 720 Pixel Breite. Die HDR→SDR-Konvertierung selbst (nicht das Decoding, fixiert unabhängig von der Ausgangsauflösung) dominiert bei dieser Art von Inhalt bei weitem die Berechnungszeit – eine weitere Reduzierung der Zielauflösung reduziert deren Kosten direkt. Muss unter realen Bedingungen noch bestätigt werden.

## v1.19.11 — August 2026

### Neue Engine (experimentell): Schnellere Kodierungsvoreinstellung für den anspruchsvollsten HDR→SDR-Fall

Vervollständigt direkt den Fix von 1.19.10: Bittet den Software-Encoder, die Kompression weniger zu optimieren (etwas größere Datei, im Austausch für viel weniger Rechenleistung pro Bild), lässt ihm so einen echten Spielraum, um mit der Wiedergabe Schritt zu halten — angewendet nur auf die Kombination Software-Encoding + HDR→SDR-Konvertierung, die einzige, die dies benötigte; alles andere (einschließlich eines einfachen Software-Encodings ohne HDR) behält exakt dieselbe Einstellung wie zuvor.

## v1.19.10 — August 2026

### Neue Engine (experimentell): Die HDR→SDR-Konvertierung benötigte ihre eigene Auflösungsbegrenzung

Dritter Fix, der beim Live-Test auf dem Produktionsserver mit einem noch anspruchsvolleren Inhalt (4K Dolby Vision) gefunden wurde: Selbst nach den beiden Fixes von 1.19.08 und 1.19.09 geriet dieser spezifische Inhalt immer noch in den Puffer, ohne jemals voranzukommen.

- **Ursache gefunden und behoben**: Die HDR-zu-SDR-Konvertierung (erforderlich, wenn das Wiedergabegerät HDR nicht anzeigen kann) fügt einen echten zusätzlichen Rechenaufwand hinzu, über das einfache Encoding hinaus — bestätigt durch direkten Vergleich mit einem 4K-Inhalt vergleichbarer Auflösung, der diese Konvertierung nicht benötigte und der der Wiedergabe perfekt folgte. Die Auflösungsbegrenzung für ein Software-Encoding ist nun spezifisch strenger, wenn auch eine HDR→SDR-Konvertierung erforderlich ist, um diesem anspruchsvolleren Fall eine echte Chance zu geben, mit der Wiedergabe in Echtzeit Schritt zu halten.

## v1.19.09 — August 2026

### Neue Engine (experimentell): Das Backup-Zielvideo folgte dem Live-Stream auf einem bescheidenen Server schlecht

Auch beim echten Test in der Produktion gefunden, diesmal gemeldet durch eine tatsächliche Wiedergabe: Bei einem 4K-Inhalt ohne wirklich nutzbaren Hardware-Encoder (siehe Fix von 1.19.08) geriet die Transkodierung alle paar Sekunden in einer Schleife im Puffer stecken, anstatt normal der Wiedergabe zu folgen.

- **Ursache gefunden und behoben**: Wenn kein Hardware-Encoder wirklich verfügbar ist, wurde das Zielvideoformat der Transkodierung nur nach dem gewählt, was das Wiedergabegerät vorzieht zu dekodieren (oft das am stärksten komprimierte, also das aufwendigste zu erzeugen) — ohne Rücksicht darauf, dass das Encoding in Software erfolgen würde. Ein Software-Encoding dieses Formats ist jedoch deutlich langsamer als ein einfachereres Format, bis hin dazu, dass es auf bescheidenem Gerät nicht mehr mit der Wiedergabe in Echtzeit mithalten kann. Der Server wählt nun das einfachste Format für das Software-Encoding, sobald kein Hardware-Encoder wirklich nutzbar ist, und behält gleichzeitig das effizienteste Format bei, sobald ein echter Hardware-Encoder verfügbar ist.

## v1.19.08 — August 2026

### Neue Engine (experimentell): Kritischer Fix, validiert unter realen Bedingungen

Aktivierung des Modus „Auto“ getestet auf dem Produktionsserver (bescheidenes Gerät, ohne dedizierte Grafikkarte) — ein erstes Film (Video- und Audio-Transkodie) funktionierte perfekt, aber ein zweiter (4K HDR, vollständige Video-Transkodierung) schlug sofort fehl mit einer irreführenden Meldung, die das Öffnen in Plex vorschlug, obwohl dieser Film keinen Plex-Bezug hat.

- **Ursache gefunden und behoben**: Der Server verließ sich auf die Liste der in ffmpeg kompilierten Videoencoder, um zu entscheiden, ob er Hardware-Beschleunigung nutzen konnte — aber ein kompiliierter Encoder bedeutet nicht, dass die entsprechende Hardware tatsächlich vorhanden ist. Auf diesem Server war zwar ein Intel QuickSync Encoder kompiliert, aber kein kompatibler Intel-Chip war exponiert, und der Kodierversuch stürzte sofort ab, ohne Fallback. Der Server versucht nun eine echte Mikro-Kodierung zur Überprüfung für jede Hardware-Beschleunigungsfamilie, bevor er ihr vertraut, und wechselt auf Software-Encoding, wenn dieser Test tatsächlich fehlschlägt.

## v1.19.07 — August 2026

### Neue Engine (experimentell): Umfassendes Audit und grundlegende Korrekturen

Nach einem systematischen Audit der Transkodierungsgrundlagen (zwei dedizierte Durchläufe, einschließlich einer vollständigen Überprüfung der Verifizierungen im Vergleich zum Originalplan):

- **Videoqualität korrigiert auf Hardware-Encoder**: Die Qualitätsvoreinstellung (`-crf`) wurde von allen Hardware-Encodern (NVENC/QuickSync/VAAPI/AMD) stumm ignoriert, was zu einem sehr niedrigen, festen Bitrate führte, unabhängig von der Auflösung — überprüft live an echter NVIDIA-Hardware, erzeugte ein 4K-Encoding mit der gleichen Qualität wie ein Mini-Encoding. Jede Encoder-Familie verwendet nun ihre eigene tatsächliche Qualitätsvoreinstellung.
- **Auflösungsgrenze für Software-Encoding** (kein Hardware-Encoder verfügbar, typischerweise ein NAS): Eine 4K-Quelle wird nun auf 1080p herunterskaliert, bevor das Software-Encoding erfolgt, um in der Lage zu bleiben, die Wiedergabe in Echtzeit zu verfolgen, anstatt Gefahr zu laufen, ins Hintertreffen zu geraten.
- **Präzeres Scrubbing während der Transkodierung**: Ein Schlüsselbildintervall fehlte, wodurch der Regler anstelle der angeklickten Position um ca. 10 Sekunden zurückfiel — korrigiert auf 2 Sekunden.
- **Fehlende Schriftarten für die Untertitel-Einbettung in Produktionen**: Bild-Untertitel (PGS/VobSub, die meisten Blu-rays) machten Text unsichtbar oder führten zum Absturz der Transkodierung — Das Docker-Image installiert nun die erforderlichen Schriftarten.
- **Verfeinerte Erkennung der Browser-Fähigkeiten**: Die Farbtiefe (8/10 Bit) und die maximal dekodierbare Auflösung werden nun präzise pro Codec überprüft, anstatt ignoriert zu werden, weil keine Daten vorlagen — Eine 10-Bit-HDR-Datei, die der Browser nicht tatsächlich dekodieren kann, wird nun korrekt als inkompatibel und nicht als Direktwiedergabe gekennzeichnet.
- **AC-3/E-AC-3-Korrektur**: Ein als kompatibel erachteter Audio-Stream, basierend auf einem technischen Signal, das für diesen Encoder nicht relevant war, konnte einen stummen Stream erzeugen — korrigiert, um sich auf das korrekte Signal zu verlassen.

Wird für später vermerkt (siehe `TODO_POST_MOTEUR_LECTURE.md`): Encoding von nicht-UTF-8-Untertitel (ältere französische Veröffentlichungen), interne Fallback-Kaskade bei Wiedergabeausfall, detailliertes Diagnosepanel.

## v1.19.06 — August 2026

### Neuer Motor (experimentell) standardmäßig für lokalen Inhalt aktiviert und wichtige Audio-Korrektur

- Der „Neue Motor“ beschränkt sich nicht mehr auf die manuelle Auswahl unter Einstellungen → Plex: Im „Auto“-Modus (Standard) übernimmt er nun automatisch die Bearbeitung eines lokalen Films/einer Episode (nicht mit Plex verknüpft), dessen Audio oder Video angepasst werden muss — ein Fall, der bisher keine funktionierende Fallback-Lösung hatte und systematisch fehlschlug.
- Wichtige Korrektur: Ein transkodierter 5.1/7.1 Audio-Stream wurde nicht auf die korrekte Anzahl von Kanälen herunterskaliert — er wurde selbst bei einem 2.0 Audio-Ausgang immer noch als 5.1/7.1 ausgegeben, mit fehlenden Stimmen (der Mittelkanal, wo normalerweise der Dialog ist, wurde nicht korrekt auf die linken/rechten Kanäle zurückgespielt). Ein System, das nicht explizit mehr als 2 Kanäle meldet, wird nun standardmäßig als Stereo behandelt, und der Audio wird zum Zeitpunkt der Transkodierung korrekt auf die richtige Anzahl von Kanälen herunterskaliert.
- Korrektur: Ein Suchen (Seek) während eines laufenden Vorgangs konnte in seltenen Fällen unordentlich aufgelöst werden und einen Stream abspielen lassen, der nicht der angezeigten Position entsprach — nun kann nur die allerletzte Verschiebeanforderung wirksam werden.

## v1.19.05 — August 2026

### Neuer Motor (experimentell): Verfeinerte HDR / Dolby Vision-Verwaltung

- Eine Dolby Vision-Datei, deren Basis-Layer mit HDR10 kompatibel ist (die große Mehrheit der neueren UHD Blu-rays), wird nun direkt ohne unnötige Transkodierung abgespielt, selbst wenn das Gerät keine explizite Dolby Vision-Unterstützung meldet.
- Wenn keine direkte Konvertierung möglich ist (Dolby Vision nicht HDR10-kompatibel oder HDR10/HLG auf einem Gerät, das dies nicht meldet), wird das Video während der Transkodierung korrekt in SDR konvertiert, anstatt mit falsch interpretierten rohen HDR-Farben neu kodiert zu werden.
- Betrifft nur den „Neuen Motor (experimentell)“, eingeführt in v1.19.04 — Standardverhalten unverändert.

## v1.19.04 — August 2026

### Neuer Wiedergabemotor (experimentell, manuell, lokale Dateien)

- Einstellungen → Plex → Beta-Player bietet eine neue Wiedergabemotoren-Option, „Neuer Motor (experimentell)“ — nie automatisch aktiviert, muss explizit ausgewählt werden. Für lokal abgerufene Filme oder Serien ersetzt/passt er die Datei über eine echte technische Analyse (ffprobe) anstelle einfacher Annahmen an: Container-Remuxing, Audio-Anpassung, Video-Transkodierung mit Wahl des Hardware-Encoders, falls der Server einen hat, und Untertitel-Einbettung, wenn keine andere Lösung möglich ist.
- Schließt eine echte Lücke: Bisher hatte eine lokale Datei (nicht mit Plex verknüpft), deren Audio vom Browser nicht lesbar war, kein Fallback — die Wiedergabe schlug einfach fehl. Diese Option korrigiert diesen spezifischen Fall, ohne das Standardverhalten zu ändern.

## v1.19.03 — August 2026

### Erweiterte technische Analyse für Serien und korriggentes Audio-Badge für die französische Sprache

- Die technische Analyse (ffprobe) deckt nun auch Episoden von Serien ab, nicht nur Filme: Einstellungen > Wartung bietet einen dedizierten Bereich für Serien (dieselbe zwei Buttons, normale Analyse und vollständige Analyse), und eine frisch abgerufene Episode wird automatisch analysiert, sobald sie eintrifft, wie es bereits bei Filmen der Fall war.
- Korrektur: Bei einer Datei mit mehreren Audiospuren (z. B. Französisch in TrueHD, Englisch in AAC) konnte das Audio-Codec-Badge die englische Spur anzeigen, obwohl es nicht die Hauptspur war — es bevorzugt nun die französische Spur, falls diese existiert.

## v1.19.02 — August 2026

### Qualitäts-Badges automatisch durch technische Analyse korrigiert

- Sobald ein Film analysiert wurde (ffprobe), korrigieren sich seine Auflösungs-/Video-Codec-/Audio-Codec-/HDR-Badges auf der Seite automatisch, falls sie falsch oder fehlend waren — ohne jemals etwas für einen noch nicht analysierten Film zu löschen.
- Korrigiert einen echten Fehler, der während der Tests gefunden wurde: Ein 4K-Film, der für ein Kinoformat beschnitten wurde, konnte fälschlicherweise als 1080p eingestuft werden.

## v1.19.01 — August 2026

### Technische Analyse: Automatisch bei Abruf eines Films und Button „Vollständige Analyse“

- Ein Film wird technisch analysiert (ffprobe), sobald er abgerufen wird — es ist nicht mehr nötig, die Analyse manuell auszuführen, damit ein frisch heruntergeladener Film abgedeckt ist.
- Einstellungen > Wartung bietet nun zwei Buttons: die normale Analyse (ignoriert, was bereits aktuell ist) und eine „Vollständige Analyse“, die die erneute Analyse des gesamten Katalogs erzwingt.

## v1.19.00 — August 2026

### Technische Analyse der Bibliothek (ffprobe)

- Neuer Button in Einstellungen > Wartung: Analysiert jeden Film über ffprobe (exakter Codec, Profil, HDR/Dolby Vision, echte Audiospuren und Untertitel) und speichert das Ergebnis pro Datei im Cache — der erste Baustein des zukünftigen Wiedergabemotors, der so die beste Wiedergabestrategie entscheiden kann, ohne eine bereits bekannte Datei erneut zu analysieren.
- Funktioniert im Hintergrund wie andere Bibliotheksanalysen, mit eigenem Fortschrittsbalken.

## v1.18.08 — August 2026

### Bibliothek: Leichtgewichtiges Werkzeug (Filme und Serien)

- Filter „Download“ und „Befristet“ entfernt (redundant mit dem Status-Badge auf jeder Karte).
- Das automatische Tag „plex“ (angewendet auf alles, was von einer Plex-Synchronisierung stammt, also niemals ein nützlicher Filter) erscheint nicht mehr in der Tag-Liste.
- Die 3 Admin-Aktionen (Fehlende suchen, Disk-Reconciliation, Suchen und Ersetzen) werden zu kompakten Icons mit Tooltip — die Suche nach Fehlenden behält ihren Fortschrittszähler als kleines Badge bei.

## v1.18.07 — August 2026

### Korrektur: Das Hero im Dashboard verschwand zufällig

- Ursache in der Konsole identifiziert: Ein Trailer (YouTube-Player) konnte mit der Übergangsanimation kollidieren, genau in dem Moment, in dem sich das Hero auflöste, was dazu führte, dass es bis zum vollständigen Neuladen der Seite verschwand. Es wird nun einige Augenblicke später von selbst neu angezeigt.
- Geschärft: Zwei fehlende Felder in den Daten einer Empfehlung (Genres, Gründe für die Auswahl) können das Hero nicht mehr zum Absturz bringen.

## v1.18.06 — August 2026

### Seitenmenü: „Sammlungen“ nicht mehr hervorgehoben, „Downloads“ verschoben

- „Sammlungen“ leitete nun zur Bibliothek weiter, bevor die aktive Hervorhebung berechnet wurde — sie ist nun korrekt umrahmt, sobald man auf der Seite ist.
- „Aktivität“ umbenannt in „Downloads“ und direkt unter Sammlungen verschoben.

## v1.18.05 — August 2026

### Korrektur: Aktionsmenü auf Bibliothekskarten abgeschnitten

- Das Menü „•••“ (optimieren, suchen, Tags, löschen) der Film-/Serienkarten konnte abgeschnitten erscheinen — es befand sich in einem Container, der jegliches Überlaufen verdeckte. Es wird nun immer vollständig angezeigt.

## v1.18.04 — August 2026

### Seitenmenü neu organisiert

- Filme, Serien und Sammlungen haben nun jeweils eigenen direkten Eintrag im Menü (anstatt unter „Bibliothek“ zusammengeklappt zu sein).
- „Suchen“ umbenannt in „Torrent“.
- Neuer ausklappbarer Abschnitt „Verwaltung“, der Anfragen, Aktivität, Verlauf, Papierkorb, Probleme und Benutzer zusammenfasst.

## v1.18.03 — August 2026

### Bibliothek: Komplettüberarbeitung des visuellen Sprachgebrauchs von Entdeckung/Dashboard

- Die Film-/Serienkarten der Bibliothek verwenden nun dieselbe Karte wie Entdeckung und Dashboard: echtes 16:9-Format mit überlagertem Titel-Logo (anstatt eines vertikalen Plakats) und einer erweiterten Vorschau beim Überfahren (Jahr, Dauer, Genres) anstelle eines einfachen Bandes.
- Alle bestehenden Aktionen bleiben beim Überfahren über ein kompaktes Menü zugänglich: als gesehen markieren, optimieren, automatische Suche, manuelle Suche, Tags, löschen (Admin) — nichts wurde entfernt, nur neu organisiert, um minimalistisch zu bleiben.

## v1.18.02 — August 2026

### Bibliothek: Gleiche visuelle Sprache wie Entdeckung

- Genre-Menü von Entdeckung: Schließt sich nun beim Klicken außerhalb oder mit der Esc-Taste (war zuvor offen).
- Film-/Serienkarten der Bibliothek: Deutlicheres Vergrößern beim Überfahren und ein Genre-/Dauer-Band, im gleichen Stil wie Entdeckung — alle bestehenden Aktionen (optimieren, manuelle Suche, Tags, löschen) bleiben identisch.

## v1.18.01 — August 2026

### Korrektur: Icon abgeschnitten in der mobilen Navigationsleiste auf schmalem Bildschirm

- Auf einem Telefon mit schmalerem Bildschirm als Durchschnitt (z.B. Galaxy Z Flip6) überlief das letzte Icon der unteren Navigationsleiste über den Bildschirm hinaus und war halb unsichtbar. Die 5 Icons verteilen sich nun immer gleichmäßig über die tatsächliche Bildschirmbreite, unabhängig vom Gerät.

## v1.18.00 — August 2026

### Android Smartphone — natives Player

- Neuer natives Player (Media3/ExoPlayer) mit Hintergrundwiedergabedienst — ersetzt die alte eingebettete Wiedergabe, sperrbare Bedienelemente auf dem Bildschirm und persistente Medienbenachrichtigung.

## v1.17.11 — August 2026

### Android Smartphone — Premium UX Polish (40% Netflix / 60% TV)

- **Design system Movviz mobile** : Palette Void/Abyss + violet/magenta als Akzente 80/20 (der Inhalt bleibt der Star), tiefe Oberflächen, kontrolliertes Glas, vereinheitlichte Tokens TV.
- **Schwebende Kapsel** : Dunkle, transluzente Bottom-Navigation mit subtilem Rand, hinter dem Inhalt, Spring-Animation auf dem aktiven Tab (Icon + Label), vollständige Beachtung von navigationBarsPadding — kein Vollbreiten Material-Bar mehr.
- **Top Bar** : Transparent über dem Inhalt, progressives Glas beim Scrollen, Inhalt, der dahinter hochrollt.
- **Hero** : 62% Viewport, edge-to-edge, doppelter Verlauf (oben transparent → unten tief), Logo/Titel, prägnante Metadaten, CTA „Abspielen“ weiß + Glas-Aktionen [ + ] [ ⓘ ], sanfter Einstieg der Reihen darunter.
- **Reihen** : Netflix-Dichte — ~3 Poster + Vorschau des nächsten, LazyRow + Peeking (Ende 12dp), Tap Scale 0.96 Spring, Titel 16sp fett, Bewertung ★.
- **Suche** : Sofortiges Feld, Debounce 280ms, führende/nachlaufende Icons, Zustände leer / keine Ergebnisse, dichte Ergebnisse (Poster 52×74 + Titel + Jahr/Typ).
- **Profile** : Glas-Karte „Aktives Profil“ mit Gradient-Avatar und Chevron, Abmelden.
- Keine funktionale Regression: Backend, API, android-shared, auth, profile, repository, Media3, Direct Play, fallback, Untertitel unverändert wiederverwendet.

## v1.17.10 — August 2026

### Android Smartphone — erste native Basis

- Neuer Jetpack Compose Touch-Client, getrennt von Desktop und Android TV.
- Onboarding-Server verbunden mit bestehenden Movviz APIs, mobile Navigation und
  gemeinsame Schicht für Modelle, Session und Netzwerk.
- Debug- und Release-APK mit demselben Retail-Schlüssel wie die TV-App signiert.

## v1.17.08 — August 2026

### Desktop — Karten-Hover

- Die berechnete Größe der Logos wird zwischen der Karte und ihrer
  schwebenden Vorschau wiederverwendet, für eine sofortige Anzeige beim Überfahren.
- Die Verzögerung der Hover-Intention wurde reduziert, ohne das Verhalten
  von Links oder Abspielaktionen zu ändern.

## v1.17.07 — August 2026

### Desktop — Stabile Karten-Logos

- TMDb-Logos werden lokal gemessen, bevor sie angezeigt werden, damit sie
  direkt in ihrer endgültigen Größe erscheinen, ohne Vergrößerungsanimation.
- Das Laden der Logos bleibt beim Scrollen stabil und Bildfehler
  lassen keine Karte mehr in einem unsichtbaren Zustand zurück.

## v1.17.06 — August 2026

### Android TV — 10-Foot-Neugestaltung

- Navigationsleiste und Hero-Bereich verkleinert, um bei Ankunft mehr Inhalt anzuzeigen.
- Startkarten im Format 16:9 mit Wiederverwendung der redaktionellen Hintergründe vom Desktop und zuverlässigem Poster-Fallback.
- Kompakte Profilauswahl, bedienbar mit D-Pad, mit Profilvorschau und Benutzerhinzufügung.

## v1.17.05 — August 2026

### Visuelle — Priorität der TMDb-Logos

- Für die französische Oberfläche werden die Logos nun in folgender Reihenfolge sortiert:
  Frankreich, neutrales Französisch, Kanada, Englisch. Andere Oberflächen bevorzugen
  Englisch. Der Cache für visuelle Elemente wählt alte Auswahlmöglichkeiten erneut aus, ohne
  bereits heruntergeladene Bilder zu löschen.

## v1.17.04 — August 2026

### Desktop — Breite der Kartenlogos

- Logos, deren tatsächlich sichtbarer Bereich unter 40 % der
  Breite einer Karte liegt, erreichen nun diesen Schwellenwert, wobei ihr
  Verhältnis streng beibehalten wird. Logos, die bereits breiter sind, werden niemals verkleinert.

## v1.17.03 — August 2026

### Wiedergabe — Lokale Quelle unabhängig von Plex

- Korrigiert Einträge, die „Wartet auf Plex-Synchronisierung“ anzeigten,
  obwohl eine lokale Datei bereits verfügbar war. Ein abgeschlossener Movviz-Film oder eine Episode
  öffnet nun sofort den Player über seine lokale Quelle; die Plex-Verlinkung
  bleibt eine asynchrone Bereicherung und blockiert nicht mehr die Wiedergabe.
- Der Player blendet den Link „Auf Plex ansehen“ sauber aus, wenn noch keine
  Plex-URL bekannt ist.

## v1.17.02 — August 2026

### Desktop — Kartenlogos

- Offizielle Logos, umgeben von großen transparenten Rändern, gewinnen
  nun bis zu 90 % der visuellen Größe. Marken, die bereits breit und
  eng sind, bleiben in ihrem natürlichen Maßstab, um eine
  saubere Hierarchie von Karte zu Karte zu bewahren.

## v1.17.01 — August 2026

### Entdeckung — C411

- Korrigiert die Reihen C411: Jeder Eintrag wird wieder durch sein
  vollständiges TMDb-Sheet (Poster, Hintergrund 16:9, Titel und Bewertung) aufgelöst. Wenn die
  von C411 übermittelte ID fehlt, abgelaufen oder mehrdeutig ist, dienen Titel und Jahr
  als sichere Alternative, anstatt eine leere Karte zu lassen.

## v1.17.00 — August 2026

### Desktop — visuelle Darstellung, Entdeckung und Wiedergabe

- Die visuellen Karten verfügen über drei getrennte Löschungen: nur das
  visuelle Cache, nur die Logos oder nur die Hintergründe/Poster. Die
  dauerhaften Zuordnungen Titel → Bild werden beibehalten: Das Vervollständigen des Caches
  stellt nur die fehlende Datei wieder her, ohne die andere neu herunterzuladen.
- Der TMDb-Antwortcache wird auf 35.000 Einträge erhöht, damit eine
  vollständige Bibliothek nicht mehr bei der Grenze von 3.500 Schlüsseln verdrängt wird.
- Die Genres verfügen nun über ihren eigenen redaktionellen Hero, wie Filme
  und Serien. Der Hero ist höher und passt die 16:9 Hintergründe korrekt an.
- Transparente Logos werden entsprechend ihrem sichtbaren Bereich vergrößert: kleine
  Marken mit großen Rändern gewinnen an Lesbarkeit, ohne die natürlich
  breiten Logos zu vergrößern. Eine Karte ohne Hintergrund nutzt mindestens ihr Poster,
  anstatt leer zu bleiben.
- Auf einem Ultra-Wide-Screen behält der Player das Video-Seitenverhältnis im Vollbild
  bei (Seitenstreifen bei Bedarf). Der Schieberegler und die
  Steuerelemente verschwinden nach Inaktivität, und eine explizite Wiederaufnahme startet direkt
  ohne zweiten Popup; Sitzungs-Offsets werden von ms in s umgerechnet.
- Alle sichtbaren Titel werden nun behandelt und nur in
  interne Netzwerkpakete geschnitten: kein globales Limit beraubt die unteren Reihen
  (Top, Vorschläge, kürzlich hinzugefügt…) ihrer Logos oder Hintergründe.
- Die Vorschauen für „Wiederaufnehmen“ zeigen die zeitgestempelte Aktion und „Seit dem
  „Start“, mit den Badges für Auflösung, HDR, Video und Audio der echten Datei.

## v1.16.82 — August 2026

### Desktop — Zuverlässige Wiedergabe

- Korrigiert die tatsächliche Dauer von fragmentierten FFmpeg-Streams: Der Player, die
  Fortschrittsanzeige, die Wiedergabeanhalten und die Endgrenze verwenden nun die
  Plex-Dauer des Mediums, anstatt der bereits gepufferten Sekunden.
- Die Player-Steuerelemente minimieren sich während der Wiedergabe und erscheinen
  bei Mausbewegung, Pause, Puffern oder beim Öffnen eines
  Menüs wieder. Die Bildvorschau auf der Fortschrittsanzeige bleibt erhalten.
- Vollbild zielt auf den Movviz-Container mit der Browser-API: Die gleichen
  Befehle, das tatsächliche Springen und die Untertitel bleiben daher erhalten, anstatt
  auf die nativen Video-Steuerelemente umzuschalten.

### Desktop — Editorische Karten

- Der Button „Verfügbare Karte abspielen“ startet nun direkt den
  Movviz-Player (Filme, Wiederholungen und Episoden), anstatt seine Seite neu zu öffnen.
- Wenn ein Titel kein neutrales TMDb-Hintergrundbild hat, verwenden die Karten
  seine lokalisierte 16:9-Illustration und fügen weder ein Logo noch einen Titel ein zweites
  Mal hinzu. Die leeren Auswahlmöglichkeiten des alten Caches werden automatisch aktualisiert.

## v1.16.81 — August 2026

### Desktop — Kartenvorschau

- Das Überfahren zeigt nicht mehr den Button „Informationen“ an: Ein Klick auf das Bild
  öffnet direkt die Movviz-Seite. Die Aktionen übernehmen die Sprache
  von Netflix: Wiedergabe, wenn der Titel in der Bibliothek ist, ansonsten Hinzufügen,
  „Gefällt mir“ und Zugriff auf die Seite.
- „Gefällt mir“ speichert sofort eine explizite Bewertung von fünf Sternen.
- Die Vorschau zeigt anschließend die Badges Jahr/Dauer, dann bis zu drei
  relevante Genres, die nur beim Überfahren abgerufen werden, falls die Reihe sie nicht besitzt.
- Die Anfragen für Bilder fordern explizit `fr-FR`; der Cache der Auswahlen
  migriert visuelle ohne geladene Hintergründe und Logos zu löschen.
- Die Hintergrundauswahl bevorzugt nun ein echtes 16:9-Format, eine gute
  Auflösung und die TMDb-Abstimmungen gegenüber einem schlecht gerahmten oder isolierten visuellen Element.

### Desktop — Scrollstabilität

- Korrigiert die Scrollleiste, die nach dem Schließen eines
  Eintrags oder Players verschwinden konnte: Overlays teilen nun ein gezähltes
  Scroll-Lock, kompatibel mit ihren Exit-Animationen.
- Der Cache-Speicher wird zwischen allen Next-Bundles geteilt: Die Zähler
  „erreicht / verpasst“, der TMDb-Cache und seine Löschfunktion spiegeln
  nach Navigation oder Neustart dieselbe Instanz wider.

## v1.16.80 — August 2026

### Visueller Cache — Vollständig inkrementell

- Der inkrementelle Durchlauf läuft nun dauerhaft durch die gesamte
  Bibliothek, einschließlich bereits vorhandener Titel: Er überprüft die
  lokalen Backdrop-/Logo-Dateien und lädt nur fehlende herunter. Die
  Echtzeit-Anzeige einer Karte oder Suchergebnisse speist denselben Cache.
- Die Kapazität des API-Antwort-Caches erhöht sich auf 3.500 Schlüssel; Einstellungen → Cache
  zeigt nun die verwendete Anzahl und das explizite Limit an.

## v1.16.79 — August 2026

### Desktop — Redaktionelle Karten und Bildcache

- Die redaktionellen Reihen für Startseite, Filme und Serien verwenden nun große
  16:9-Karten (300–360 px) mit einer proportionierten Hover-Vorschau.
- Jede Karte wählt einen neutralen TMDb-Hintergrund und wendet dann das
  offizielle Logo an; wenn kein neutraler Hintergrund verfügbar ist, behält Movviz
  den Texttitel bei, anstatt ein bereits im Bild gedrucktes Logo zu duplizieren.
- Fügt einen persistenten Cache von Backdrop-/Logo-Paaren hinzu, der sofort
  von der Startseite, dem Hero und der Suche gefüllt wird. Die unveränderlichen TMDb-Dateien
  werden von Movviz tatsächlich auf der Festplatte und ein Jahr im Browser gespeichert,
  Ohne TMDb-Abfrage per Karte.
- Einstellungen → Cache fügt „Cache vervollständigen“ und „Inkrementell aktualisieren“.
  Eine tägliche Aufgabe fängt nur neue
  Titel, fehlende oder seltene Netzwerkfehler ab, ohne die Oberfläche zu verzögern.
- Stellt die Versionen für Web, Android TV, package lock, Badge und Metadaten von
  der Veröffentlichung auf `1.16.79` ab.

## v1.16.78 — August 2026

### Desktop — Entdeckung, Serien und Lesen

- Die redaktionellen Karten für Accueil, Films et Séries verwenden ab sofort
  echte TMDb 16:9 Hintergründe, mit dem offiziellen Logo des Titels oder einem Texttitel
  stabil, wenn kein Logo verfügbar ist. Ein tatsächliches Fehlen eines Hintergrundbilds
  zeigt eine neutrale Movviz-Karte an, anstatt ein vertikales Plakat zuzuschneiden.
- Erweiterte Startseite: Hero mit stabilem Fallback nach drei Sekunden, gemischte Reihen
  absichtlich, kurze Formate, schwebender Desktop-Hover und Rückzug
  der falschen leeren Scroll-Indikatoren.
- Filme und Serien haben ihre eigenen Kataloge, einen Hero, der zu ihrem Typ gehört und
  einen Genre-Selektor, während die Öffnung der Unterseiten im
  einzigartigen Movviz-Panel beibehalten wird.
- Serienseiten: Saisons sind korrekt herunterladbar, Saison 0
  wird ausgeblendet, wenn sie nicht existiert, direkter Start einer verfügbaren Episode,
  Button und Verknüpfung zur nächsten Episode, falls diese vorhanden ist.
- Repariert den Auto-Play-Pfad: Eine Wiedergabe kann mit FFmpeg fortgesetzt werden,
  lokale Dateien melden Codecs/Audiospuren/FFmpeg-Verfügbarkeit und
  HLS Plex wird nach einem tatsächlichen Fehler zum letzten Ausweg — niemals ein falscher
  Fehler „HLS-Wiedergabe deaktiviert“.
- Richtet die Versionen Web, Android TV, package lock, Badge und Metadaten der
  Veröffentlichung auf `1.16.78` aus.

## v1.16.77 — August 2026

### Desktop und Android TV

- Modernisiert den Desktop-Player: Kinematisches Dock, persistenter Fortschritt,
  vereinigte Menüs und besser lesbare Intro-/Abspann-Aktionen, ohne die
  Auto-, Direkt-, Audio-/Video-Transkodierungs- oder HLS Plex-Modi zu entfernen.
- Bereitet die Desktop-Startseiten für 16:9-Editorial-Kacheln und ein
  schwebendes Hover-Element vor, während die vertikale technische Bibliothek erhalten bleibt.
- Android TV: Korrigiert D-Pad-Fokus-Rückmeldungen, startet direkt eine verfügbare Episode
  und harmonisiert Fokus-, Such- und Wiedergabezustände.
- Fügt den versionierten Tracking-Plan für das Desktop-UX-Redesign hinzu.
- Stellt die Versionen Web, Android TV und Release-Metadaten auf `1.16.77` aus.

## v1.16.76 — August 2026

- Synchronisiert die Web- und Android TV-Version für die nächste Veröffentlichung.

## v1.16.75 — August 2026

### Release- und lokale Wiedergabe-Korrekturen

- Stellt die Versionen Web, Android TV und Release-Metadaten ab.
- Korrigiert `Range`-Suffix-HTTP-Anfragen beim lokalen Streaming.

## v1.16.73 — August 2026

### Android TV Kompilierungs-Korrekturen

- Korrigiert die Moshi-Annotation des Marker-Modells.
- Fügt den Import der Animation `slideInVertically` hinzu, die vom Skip-Button verwendet wird.

## v1.16.72 — August 2026

### Movviz Fortschritts- und Multi-Client-Wiederaufnahme Backend

- Fügt die Backend-Speicherung pro Benutzer, Sitzungen, Heartbeats und Schutz vor versehentlichem Seek hinzu.
- Desktop und Android TV verwenden nun Movviz Playback-Sitzungen.
- Intro-/Credits-Marker von v1.16.71 werden weiterhin aus dem Movviz-Cache bereitgestellt.
- Die Vervollständigung synchronisiert den gesehenen Status mit Plex und bereichert "Continue Watching" mit Movviz-Wiederaufnahmen.

Alle bemerkenswerten Änderungen an Movviz, gruppiert nach Entwicklungsmeilenstein.

---

## v1.16.71 — August 2026

### Plex Intro/Credits → Movviz → Android TV (Intro/Gänsehängnis überspringen)

**Architektur:** `Plex → sync Movviz (cfg.adminToken) → playback-markers.json → /api/stream/{ratingKey}/info → Android TV → ExoPlayer → Kontextbutton`. Keine Plex-Anfrage beim Start einer Wiedergabe, kein Plex-Token auf TV-Seite.

**Backend:**
- Neues generisches Modell `PlaybackMarker` (Intro/Credits) und Store `playback-markers.json` (O(1) Nachschlagefunktion nach ratingKey, Version 1, Migration, readJsonCached/writeJsonCached).
- Neuer Status `plex-marker-sync-state.json` (dirty, knownUpdatedAt, emptyRetry 7j, auditBucket 0..6).
- Rohart `PlexMarker` intern plex, Erweiterung `PlexServerConfig.markerSyncEnabled` (Standard false, niemals clientseitig exponiert).
- `batchMarkers(cfg,cfg.adminToken,ratingKeys)` Blöcke 50, `includeMarkers=1`, Unterscheidung Fehler ≠ Null Marker (Plex-Ausfall löscht niemals lokale Daten).
- Normalisierung (nur Intro/Credits, Validierung, ASC Sortierung), deterministische SHA16 Signatur, Beibehaltung von Multi-Blöcken Credits (nicht zusammengefügte Mid/Post-Credits).
- Motor `markerSync.ts`: incr (dirty + nie-sync + abgelaufene retries + heutiger audit-Bucket), full (alle plexRatingKey Movviz), retry 7j, stabiler rotierender auditHash%, GC nur bei vollständigem full, reale Fortschrittsanzeige, yieldToUser zwischen Batches, knappe Logs, mitKeyLock + sourceId `plex-marker-sync`.
- Hooks `registerMarkerCandidate` in `librarySync` (Filme + jede Episode), Entkopplung Bibliothek 5min → Marker 24h.
- Geplante tägliche Aufgabe `plex-marker-sync` (24h, check markerSyncEnabled), Mapping JobType `plexMarkerSync` + Prioritäten.
- Route `POST /api/plex/marker-sync` (admin, enqueueJob sourceId, sofortige Rückgabe queued/jobId) + `GET` Stats, Route `GET /api/plex/config` und erweiterte `PUT` (markerSyncEnabled, niemals Token).

**Desktop Einstellungen > Plex:** Abschnitt Intros und Credits (Umschalten EIN/AUS, Daten, Zähler, inkrementelle/vollständige Buttons, Polling jobRunning über /api/plex/marker-sync + /api/jobs).

**Wiedergabe-API:** `GET /api/stream/{ratingKey}/info` injiziert `markers[]` aus dem lokalen Store (try/catch → [] bei Nichtverfügbarkeit).

**Android TV:**
- `PlaybackMarkerDto` + `StreamInfoDto.markers` (Standard leerer Liste, kompatibel mit älterem Backend).
- `PlayerActivity`: Laden der Marker über streamInfo, aktiveMarker alle 500ms erkennen, Beschriftungen Intro/Credits überspringen, seekTo(endMs) ohne verbrauchten Status, Wiederaufnahme/Seek/Fallback/Palette unverändert.
- Bedinglicher D-Pad Fokus, vereinheitlichtes PlaybackActionOverlay (Skip über Up Next), Glass-Visual 150-250ms.

---

## v1.16.70 — August 2026

### Android TV: Einstellungen im Zahnrad-Symbol

- Der Text-Tab "Einstellungen" verlässt die Navigationsleiste: ein **Zahnrad-Symbol** (gezeichnet, gleicher Stil wie die Lupe) nimmt zwischen der Suchlupe und dem Profil-Avatar Platz ein. Weißer Fokus-Rahmen (Marken-Verlauf, wenn der Tab aktiv ist).

---

## v1.16.69 — August 2026

### Android TV: Ende des automatischen Scrollens beim Öffnen, Race Condition bei Staffeln korrigiert

#### Auto-Scroll beim Öffnen der Details (auf Nachfrage)
- MINIMALes Scroll-Spezifikationsverhalten (mobiles Verhalten) auf Titel- und Schauspieler-Details, anstatt des TV-Pivot (~30% der Kante), das die Details automatisch scrollte, sobald der Fokus auf den CTA fiel. Das Scrollen tritt nur noch auf, wenn das Ziel-Element tatsächlich außerhalb des sichtbaren Bereichs liegt (Staffeln/Episoden weiter unten).

#### Saisons einer anderen Serie angezeigt („Die Saison ist nicht die der ausgewählten Serie“)
- **Race Condition**: Das schnelle Öffnen einer Serie A und dann einer B gab beide Anfragen in beliebiger Reihenfolge zurück — die Saisons von A überschrieben die von B. Hinzugefügte Prüfung: Die Antwort wird nur geschrieben, wenn die angeforderte Serie immer noch die aktuelle ist.
- **Cache der Saison nach Serie**: Der alte Cache nur nach der Saisonnummer diente nur der Saison 1 der ersten geöffneten Serie bis zur nächsten. Jetzt Schlüssel „tmdbId-saison“.

---

## v1.16.68 — August 2026

### Android TV: Hero-Ansicht wie Titelseite, D-Pad-Pfeil oben, bereinigte Filmografie

#### Hero Startseite/Filme/Serien = gleiche Komposition wie die Seite
- TMDb-Logo oben FIX 118dp (`ContentScale.FillHeight`): Die kleinen Logos (~30px, vom Sofa aus unleserlich) werden zu Netflix-artigen Titel-Artworks.
- Status-Badge der Bibliothek unter dem Logo (gleiches Pille wie auf der Seite: Suche…/Download/Fehlt) — „Verfügbar“ bleibt implizit.
- Vereinheitlichte Metainformationen ★ Bewertung · Jahr · Dauer · Genres inline (die Chips nahmen unnötigerweise eine ganze Reihe ein).
- Entfernung des hässlichen schwarzen Verlaufs hinter der Zusammenfassung — der Hero-Scrim reicht aus.
- Inhaltsspalte verankert am unteren Rand des Hintergrundbildes (der CTA „Ansehen“ wurde nicht mehr unter dem Bild abgeschnitten).
- Verbleibende Glyphen durch Vektikons ersetzt: ▶ bei „Ansehen“, Pille „i“ bei „Mehr Infos“.

#### D-Pad-Pfeil oben (Startseite + Filme + Serien)
- Unsichtbarer Anker 1dp ganz oben auf jedem Bildschirm: UP vom Hero-CTA landet zuerst dort — bringIntoView bringt das Scrollen zu Offset 0 (das gesamte Karussell wird unter der Leiste sichtbar), dann erreicht ein zweiter UP die NavRail. Schluss mit dem halb hinter ihr versteckten Karussell.

#### Bereinigte Filmografie der Schauspieler
- Filterung von Talkshows und Zeremonien (Saturday Night Live, Tonight Show, Late Night/Show, Graham Norton, Kelly Clarkson, Jimmy Kimmel, Ellen, Golden Globes, Oscars, MTV/Critics'/People's Choice Awards, GMA, Today Show, Conan, roter Teppich…) — auf Nachfrage: „Ich habe genug davon, Late-Night-Shows zu sehen“.

#### Sonstiges
- CatalogScreen migriert von TvLazyColumn → Standard LazyColumn (Konsistenz mit der Startseite).

---

## v1.16.67 — August 2026

### Android TV: Reaktiver Download-Status auf der Seite, focusRestorer, D-Pad-Anker

#### Titelseite: Live-Download (Netflix-Muster)
- **Reaktives Status-Badge**: „Download“/„Suche…“ während der Aktivität (Polling-Intervall 3s), ansonsten realer Bibliotheksstatus (Verfügbar/Download/Fehlt über statusTone) — nie wieder ein eingefrorenes „In der Bibliothek“ während eines Downloads.
- **Fortschritts-Pille** `DownloadProgressPill`: Prozentsatz + Geschwindigkeit + verbleibende Zeit („Download 42% · 6.1 M/s · 12 min verbleibend“) mit Fortschrittsbalken in der Pille selbst.
- **Automatisches Umschalten auf „Ansehen“** nach dem Download: Beschleunigtes Bibliotheks-Refresh nach 4s, solange ein Torrent aktiv ist — keine Benutzeraktion, keine App-Pause.
- Fehlende TMDb-Bewertung (0) → kein trügerischer Stern „★ 0.0“ mehr auf der Seite.

#### D-Pad-Navigation
- **`focusRestorer()` auf allen Reihen** (offizielle Google-Dokumentation): Jede Reihe erinnert sich an ihre fokussierte Karte — der Fokus kehrt nach dem Verlassen der Karte und beim vertikalen Navigieren zum richtigen Poster zurück.
- **Migration TvLazy\* → Lazy\*** Standard (Veraltete TvLazyColumn/TvLazyRow).
- **Fallback-Anker aus der Richtungsnavigation ausgeschlossen** (`FocusRequester.Cancel` ×4): Er befindet sich geometrisch über allem Inhalt — `moveFocus(Up)` vom Hero landete darauf (unsichtbar) anstatt in die NavRail zurückzuspringen.
- Hero-Stern → Vektikon (das Glyphe ★ existiert nicht in Inter).

---

## v1.16.66 — August 2026

### Android TV: Massive UTF-8-Reparatur, Vektikonen, D-Pad-Symmetrie

#### UTF-8 / Mojibake (Der Bug mit fehlerhaften Akzenten und Symbolen)
- **510 reparierte Mojibake-Sequenzen** (UTF-8 neu interpretiert als CP1252 und dann neu kodiert): "Ã©cran" → "écran", "â˜…" → ★, "TÃ©lÃ©chargement" → "Téléchargement", "Â·" → "·"… in HomeScreen.kt, CatalogScreen.kt und UpdateManager.kt.
- Grundursache: Dateischreibvorgänge mit Get-Content/Set-Content ohne explizite Kodierung bei vorherigen Sitzungen.

#### Vektikonen (Ende der leeren Quadrate auf Google TV)
- Neues `MovvizIcons.kt`: 13 handgezeichnete Icons als ImageVector (play, pause, skip prev/next, rewind/forward, Musiknote, Häkchen, Stern, plus, downloaden, tauschen, Punktkreis, wiederholen) — die Unicode-Glyphen ▶ ❚❚ ⏮ ⏭ ♪ ★ ✓ ↓ ⇄ ◉ ↻ existieren nicht in Inter und führten zu System-Fallbacks/Quadraten.
- Überall ersetzt: Player-Steuerelemente (PlayerActivity), CTA-Titelfeld ("Ansehen", "Fortsetzen", "Staffel herunterladen", "Hinzufügen"), Sterne-Bewertungs-Badges (RatingBadge, Titelfeld), "Gesehen"-Pill, Häkchen für gesehenes Episode, NavRail-Profilmenü, Plex-Login-Button.
- `ControlButton` akzeptiert nun Vektikon oder Textlabel ("CC").

#### D-Pad-Navigation — UP/DOWN-Symmetrie
- **Fix für „UP springt hoch, aber DOWN springt nicht mehr runter“**: Der alte Handler verbrauchte ALLE UP-Ereignisse aus jeder Tiefe → Es war unmöglich, von einer Reihe zur nächsten zu springen; jeder UP sprang in die Navigationsleiste.
- MainScreen/Titelfelder/Schauspieler: UP versucht zuerst `moveFocus(Up)` (interne Bewegung in Reihe N−1), wechselt nur zum aktiven Tab der NavRail am oberen Ende des Inhalts.
- NavRail: DOWN versucht das genaue Ziel, dann die geometrische Rücksetzung `moveFocus(Down)` (funktioniert auch bei Ladebildschirmen), und zuletzt den Fallback-Anker.
- Der Fallback-Anker wird auf NavHost-Ebene angehoben (existierte nur auf der Startseite — der Abwärtspfeil war während des Ladevorgangs eines Titels tot), ist nun **gezeichnet**, wenn er den Fokus erhält (kleiner weißer Punkt), damit er niemals wie ein eingefrorener Bildschirm aussieht.
- **Korrektur des Musters `.getOrDefault(false)` bei `requestFocus()`**: Die Methode gibt in compose-ui 1.7.6 `void` zurück (überprüft mit javap), der tatsächliche Erfolgs-Test ist `.isSuccess` — der alte Code bewertete `(Unit == true)` = immer falsch.

---

## v1.16.65 — August 2026

### Android TV: Versionserhöhung für Test-Build

#### Hinweise
- Versionserhöhung für Test-Build auf Google TV.
- Keine Code-Änderungen — gleicher Inhalt wie v1.16.64.

---

## v1.16.64 — August 2026

### Android TV: poliertes Premium-Visual + Auto-Update-Umschalter + Absturzbehebungen

#### Stabilität (8 behobene Absturzvektoren)
- Abgestufte Netzwerkaufrufe für HomeScreen (+200ms zwischen jedem) — Ende des parallelen Floods beim Start.
- GitHub-Update-Prüfung verzögert um 5s — blockiert nicht mehr das erste Frame.
- Ambient Trailer deaktiviert auf Geräten < 4GB RAM — Ende des Chromium/SwiftShader-Absturzes.
- Preload Hero Backdrop reduziert von 2 auf 1 Bild — weniger Speicherbelastung.
- Coil Memory Cache reduziert von 20% auf 10% des Heaps.
- `createFilmGrain()` optimiert mit `setPixels()` Batch anstelle von 32k `setPixel()` Aufrufen.
- OkHttp Timeouts reduziert: connect 5s, read 15s, callTimeout 20s.
- Hero-Logos werden sequenziell in Batches geladen (+100ms) anstelle von 5 parallelen Coroutinen.

#### Premium-Visual (45 Fixes)
- Kartenform 8dp → 12dp (konsistent mit TV).
- displayLarge ExtraBold → Bold (weniger "blobby" bei 10 Fuß).
- MovvizDown geglättet (#FF5B78 → #E87C7C).
- MovvizCyan geglättet (#34E2FF → #5CE0D8).
- Orbit Dots AnimatedLogo 6dp → 8dp.
- Wordmark Flow verlangsamt von 5s → 8s.
- Profil-Popup NavRail erweitert von 300dp → 320dp.
- NavRail-Menutrenner-Padding 10dp → 16dp.
- Hero Left Scrim 70% → 45%.
- Hero Bottom Gradient geglättet (reduziertes Banding).
- Genre Chips Hero 12sp → 14sp.
- Download-Karten-Rahmen 3dp → 2dp.
- Zeilenüberschrift-Bottom-Padding 16dp → 20dp.
- Staffel-Chip-Form 9dp → 12dp.
- Episodennummer 22sp Light → 16sp Medium.
- Besetzungsfotos 72dp → 84dp, Namen 12sp → 14sp.
- Einstellungen-Sektionsüberschriften MovvizBrand → MovvizInkSoft.
- Einstellungsbereich 72% → 78% Breite.
- InfoRow Beschriftungen 12sp → 14sp, Breite 160dp → 180dp.
- Fehlerbildschirm-Player: weißer Titel statt rot, Overlay 85% → 72%.
- Pufferspinnrad Dicke 14% → 18%.
- Fortschrittsbalken-Update Pill-Form (50 Radius).
- Katalog-Padding bei leerem Zustand oben 24dp → 48dp.

#### Funktionen
- Umschalter „Auto-Update EIN/AUS“ in Einstellungen → Über uns (über DataStore persistent).
- Touch-Klick aktiviert auf dem Profilauswahlbildschirm (tvPointerClick).

---

## v1.16.62 — August 2026

### Android TV: Premium-Neugestaltung wie Netflix

#### Typografie und Designsystem
- Eingebettete Inter-Schriftart (5 Gewichte: Regular → ExtraBold) — gleiche Typografie-Richtung wie Netflix und Apple TV.
- Vereinheitlichte Typografie-Tokens: displayLarge (40sp), headlineMedium (24sp), titleLarge (20sp), titleMedium (16sp), bodyLarge (16sp), bodyMedium (14sp), labelLarge (14sp), labelSmall (12sp).
- `MovvizCardShape` (12dp) — einheitlicher Radius für alle Inhaltskarten, konsistent überall.
- Bestehendes `tvFocusLift` erhalten — Spring + GPU-only Schatten (graphicsLayer), null Rekomposition während der Animation.

#### Startbildschirm (HomeScreen)
- Kategorierowen mit Titel darüber (Stil titleLarge), Netflix-Peak (negatives Padding Ende).
- Poster-Karten: Verhältnis 2:3, 2dp weißer Fokusrahmen mit 90% Alpha, vom Sofa aus sichtbar.
- Netflix Call-out: Synopsis + Metadaten unten in der Reihe beim Fokus, AnimatedVisibility mit Debounce für null Flackern.
- Richtungsabhängige Vorabladung: Die 2 nächsten Bilder der fokussierten Karte werden über Coil vorabgeladen (null Pop-in).
- Stabile Keys + contentType auf allen Listen.
- Hero: Ken Burns (Zoom 1.0→1.05 über 20s), Kino-Grain (natives BitmapShader), Luminanz-adaptiver Scrim, offizielles TMDb-Logo, animierter Text, AmbientTrailer über WebView-Pool, Vorabladung der nächsten 2 Hintergründe.

#### Titeldetailliste (TitleDetailScreen)
- Parallax-Hintergrund (graphicsLayer translationY), offizielles Logo, CTA, Staffeln/Episoden mit stabilen Keys.
- Französische Fehlermeldungen (friendlyAddError) statt roher englischer.
- Episoden-Stills w780, Hintergründe w1280.

#### Videoplayer (PlayerActivity)
- Seek-Indikator mit Zentrierung "+10s" / "−10s" mit fadeIn/fadeOut.
- "Nächste Episode"-Panel am Ende der Episode (Position > Dauer − 45s) mit Countdown und D-Pad-Fokus.
- Auto-versteckendes Overlay nach 5s, animierte Fortschrittsleiste, gepufferter Spinner.
- Fehlerbildschirm mit technischen Details (Codec, Auflösung), lesbar vom Sofa aus.
- Typografie und Theme-Tokens auf allen Steuerelementen.

#### D-Pad-Navigation
- DOWN von NavRail → Inhalt: Interzeption über onPreviewKeyEvent (vor den Kind-Surface).
- UP von Inhalt → NavRail: Interzeption über onKeyEvent (nach den LazyColumn).
- Wiederherstellung des Fokus beim Zurückkehren zu einem Detail-Eintrag (Verzögerung 300ms + navRailFocusRequester).
- Fallback-Fokus (1dp unsichtbar, immer fokussierbar) — kein Fall von Fokusverlust.

#### Performance
- Polling-Download-Datei: 4s → 8s (reduziert Netzwerkverkehr).
- largeHeap im Android Manifest.
- TMDb: 3 Versuche mit Backoff (300ms, 800ms) — weniger falsche "movie not found" bei vorübergehenden Netzwerkunterbrechungen.

#### Korrekturen
- Schaltfläche "Zur Bibliothek hinzufügen": Keine falschen TMDb-Fehler mehr (Server-Retry + lesbare Fehlermeldung).
- Suche: Variable `fieldFocused` und Konstante `TMDB_POSTER_BASE` korrigiert.

## v1.16.60 — August 2026

### Dashboard: Eine defekte Karussellkarte blockiert nicht mehr den gesamten Bildschirm

- Ein Film oder eine Serie mit unerwarteten Daten konnte das gesamte Dashboard zum Absturz bringen ("Serverfehler", ganzer Bildschirm blockiert), anstatt einfach nicht angezeigt zu werden. Jede Karussellkarte (und die Hero-Vignette) ist nun isoliert: Wenn eine abstürzt, verschwindet sie diskret, der Rest des Dashboards funktioniert normal weiter.

## v1.16.59 — August 2026

### Korrektur: Serverfehler im Dashboard für Nicht-Admin-Konten

- Die in v1.16.56 hinzugefügte Einstellung für die Reihe „Verfügbare Updates“ wurde über eine für Admins reservierte Route gelesen — jedes Nicht-Admin-Konto, das das Dashboard öffnete, erhielt eine Zugriffsverweigerung für diese Anfrage. Der Lesevorgang ist nun für jedes angemeldete Konto offen (das Schreiben bleibt wie zuvor nur für Admins).

## v1.16.58 — August 2026

### Android TV: Startbildschirm mit Ladebildschirm, wahre visuelle Identität

- Der Text „Lade deine Bibliothek…“ weicht beim allerersten Start dem animierten Movviz-Logo (dasselbe wie bei Login/Einstellungen) Platz, bevor die Bibliothek geladen ist. Dieses Logo dient auch als wahres, sichtbares Fokus-Ziel für den Pfeil nach unten — der unsichtbare Backup-Anker wird in diesem speziellen Fall nicht mehr benötigt, er bleibt für andere Grenzfälle an Ort und Stelle.

## v1.16.57 — August 2026

### Korrektur: Der neue Button „Upgrade-Vorschläge auf dem Dashboard“ wurde nicht gespeichert

- Der in v1.16.56 hinzugefügte Button behielt nie seinen Zustand bei — der Speichervorgang für die Einstellungen ignorierte dieses spezifische Feld und kehrte immer auf seinen ursprünglichen Wert zurück.

## v1.16.56 — August 2026

### Einstellungen > Qualität: Analyse der Dashboard-Upgrades deaktivieren

- Neuer Button unter Einstellungen > Qualität, um die Analyse zu deaktivieren, die die Zeile „Verfügbare Upgrades“ auf dem Dashboard speist — diese Analyse konnte die Anzeige auf einer großen Bibliothek erheblich verlangsamen. Unabhängig vom bestehenden automatischen Upgrade-Button (der den automatischen Hintergrund-Austausch verwaltet): Dieser unterbricht nur den Anzeigenscan, ohne den Rest zu beeinflussen.

## v1.16.55 — August 2026

### Android TV: Abwärtspfeil aus dem Menü — echte Korrektur

- Der vorherige Fix eliminierte unerwartete Schließungen, machte aber den Abwärtspfeil im normalen Gebrauch unbrauchbar (er zielte systematisch auf einen unsichtbaren Anker anstatt auf den tatsächlichen Inhalt). Stellt den direkten Abstieg zum ersten tatsächlichen Element des Bildschirms wieder her, falls vorhanden, wobei der Backup-Anker nur als Fallback dient — niemals Absturz, niemals Abwärtspfeil ohne Wirkung.
- Neues README, vollständiges Redesign.

## v1.16.54 — August 2026

### Versionskontrolle zur Überprüfung des automatischen Updates

## v1.16.53 — August 2026

### Android TV: Manuelle Update-Überprüfung

- Fügt einen Button „Updates überprüfen“ unter Einstellungen → Über Info hinzu — bisher wurde die Überprüfung nur einmal beim Start ausgelöst, ohne Möglichkeit, sie erneut auszulösen oder zu sehen, was passiert, ohne die gesamte Anwendung neu zu starten.

## v1.16.52 — August 2026

### Android TV: Wiedergabe — Zuverlässigerer Audio-Only-Fallback

- Der „Audio-Only“-Fallback verwendete systematisch die Plex-Transkodierung, die bei bestimmten Quellen (insbesondere HEVC) das Kopieren des Videos stumm verweigern und stattdessen beide neu kodieren kann, anstatt nur den Audio-Stream. Nutzt nun vorzugsweise das lokale Remuxing des Servers (bereits vom Desktop-Client verwendet), wenn verfügbar — garantiertes Video-Kopieren, nur der Audio-Stream wird neu kodiert.

## v1.16.51 — August 2026

### Android TV: Update-Loop, unerwartete Schließungen über die Fernbedienung

- Automatisches Update, das unendlich wiederholte: Das System verlangt seit Android 12 einen Installationsbestätigungsbildschirm, was bisher nie gehandhabt wurde — die Anwendung glaubte, die Installation erfolgreich gewesen zu sein, obwohl sie für immer im Wartezustand stecken blieb. Korrigiert und in realen Bedingungen getestet (Versionsnummer steigt danach korrekt an).
- Unerwartete App-Schließungen beim Drücken des Abwärtspfeils der Fernbedienung — häufiger bei langsameren Set-Top-Boxen (z. B. Chromecast 4K): Das Navigationsziel konnte auf ein noch nicht geladenes Bildschirm-Element zeigen. Systematisch sicher gemacht, unabhängig vom Ladezustand des Bildschirms.

## v1.16.50 — August 2026

### Android TV: Benutzer zum Haushalt hinzufügen, fehlendes Admin-Profil

- „Benutzer hinzufügen“ vom Profilbildschirm aus reagierte nicht auf die Fernbedienung — der Anmeldebildschirm im Hinzufügemodus forderte nie den D-Pad-Fokus (ein Fehler, der bereits an anderer Stelle behoben wurde, hier ohne Sicherheitsnetz versucht).
- Das Admin-Konto, das die initiale Verknüpfung vornimmt, war nicht in „Wer ist hier?“ sichtbar, solange es nicht manuell zum eigenen Haushalt hinzugefügt wurde — wird nun beim ersten Zugriff automatisch hinzugefügt, wie es bei Netflix/Plex immer der Fall ist.

## v1.16.49 — August 2026

### Android TV: Update durch Fernbedienung blockiert

- Das Auto-Update-Overlay erfasste nie den D-Pad-Fokus: Der Button „Zulassen“ blieb unerreichbar und die Fernbedienung steuerte weiterhin das darunter liegende versteckte Menü — wahrscheinliche Ursache für unerwartete App-Schließungen während des Updates. Korrigiert.

## v1.16.48 — August 2026

### Testversion des Auto-Updates

- Keine funktionale Änderung: Nur Versionserhöhung, um den Auto-Update-Fluss unter realen Bedingungen zu validieren (GitHub beim Start prüfen → `Movviz-Android-TV-client.apk` herunterladen → SHA-256 prüfen → über bestehende Version installieren).

## v1.16.47 — August 2026

### Einziges APK: „Movviz TV“

- Die Variante `retail` (ohne Auto-Update) ist **entfernt**: Es gibt nur noch ein einziges APK, die Anwendung heißt jetzt **Movviz TV** und aktualisiert sich beim Start über GitHub.
- Die `applicationId` `com.movviz.tv.au` wird beibehalten: Bestehende Installationen und das Auto-Update ersetzen sich weiterhin sauber (gleiches Paket = Update, nicht eine zweite App).
- Der CI-Workflow veröffentlicht nur noch ein Asset: `Movviz-Android-TV-client.apk`.
- Neu: Ein **TvProvider** « Movviz » im Android TV Dashboard — Die Reihe „Weiter ansehen“ im Launcher zeigt die laufenden Titel des aktiven Kontos an (wie Plex/Netflix, ohne Partnerschaft), und ein Deep Link `movviz://title/{type}/{tmdbId}` wird deklariert, um die Titelseite zu öffnen.
- **Google TV**: Die Mediensitzung speist nun die Reihe „Weiter ansehen“ des Google TV Launchers — Die MediaItems tragen echte Metadaten (Titel, Episodentitel, TMDb-Poster) und eine Sitzungsaktivität wird deklariert (Auf die Karte klicken, öffnet die App erneut).

## v1.16.46 — August 2026

### Android TV: Der Player verhindert den Standby während der Wiedergabe

- Der Anti-Standby-Flag ist nun für die gesamte Lebensdauer der Wiedergabe-Activity gesetzt (nicht nur während der aktiven ExoPlayer-Wiedergabe): Ein Re-Buffering von einem entfernten Server lässt das Android TV nicht mehr mitten im Film einschlafen.
- Hinzufügen einer aktiven Mediensitzung (media3-session): Das System weiß, dass ein Medium abgespielt wird, wie bei Netflix — es versetzt das Gerät nicht mehr in den Standby und zeigt den Titel in der Systemoberfläche an.

## v1.16.45 — August 2026

### Android TV: Audio-Fallback nur in DASH für alle Codecs

- Der „Audio-nur“-Fallback (Video als Bitstream kopiert, Ton neu kodiert) verwendet nun DASH, unabhängig vom Quellcodec, einschließlich h264 — konsistent mit dem Webplayer und dem Verhalten von Plex Web selbst, und fMP4/DASH bietet ExoPlayer ein präziseres Seeking über Byte-Bereiche als HLS-TS über Segmente.

## v1.16.44 — August 2026

### Android TV: Echte Kompatibilitätsprüfung pro Gerät

- Die Kompatibilität des Geräts wird niemals angenommen: Vor jeder Wiedergabe fragt die App die vom Gerät **tatsächlich** deklarierten Decoder ab (MediaCodecList, dieselbe API, die ExoPlayer zum Dekodieren verwendet) und wählt entsprechend den Wiedergabemodus — ein Gerät, das DTS/TrueHD/E-AC3 dekodiert, spielt in Live-Play, ein anderes, das dies nicht kann, wechselt zum Audio-nur-Fallback (Video kopiert, nie neu kodiert). Die Entscheidung und ihr Grund werden im logcat protokolliert (`Pré-décision v=… a=… → niveau …`).
- Korrektur: Der Audio-nur-Fallback wird für h264-Quellen in HLS bereitgestellt — der Player gab fälschlicherweise ein DASH-Manifest aus und die Wiedergabe startete nicht.
- Neu: Schauspieler-/Schauspielerin-Seite — Die Verteilung einer Titelseite führt zur vollständigen Filmografie der Person, mit Navigation per Karten zu jedem Titel. Die NavRail bleibt auf den Seiten (Titel und Schauspieler) sichtbar, um ohne Zurückkehren zur Startseite zwischen den Tabs zu wechseln.

## v1.16.43 — August 2026

### Android TV: Optimierte Wiedergabe — Ende des unnötigen Video-Transcodings

- Ein Titel, dessen Video vom Gerät dekodiert, aber dessen Audiospur nicht (DTS/DTS-HD/TrueHD/E-AC3 je nach Gerät), löste die gesamte Fallback-Kette aus und endete in Video- und Audio-Transcoding auf dem Server, obwohl nur der Ton das Problem war. Der Player prüft nun die tatsächlichen Codecs des Titels (streamInfo) UND die tatsächlichen Decoder des Geräts, bevor er beginnt:
  - Video nicht vom GERÄT dekodierbar (AV1, VP9…) → direkt vollständiges Transcoding, ohne zwei Fehler auf dem Bildschirm;
  - Audio nicht von diesem Gehäuse dekodierbar, aber Video OK → sofortiger Wechsel zu „Nur Audio“: Das Video wird im Bitstream kopiert (niemals neu kodiert), nur der Ton wird in AAC umgewandelt;
  - Der „Nur Audio“-Wechsel verwendet HLS für h264-Quellen (am robustesten für ExoPlayer) und DASH für HEVC/AV1/VP9 (das einzige Format, bei dem Plex die Bitstream-Kopie respektiert).
- „Weiter ansehen“ bei einer Serie: Die Seite der aktuellen Episode (Staffel, Nummer, Titel, Zusammenfassung) wird automatisch beim Aufrufen des Titels geöffnet — der Benutzer muss sie nicht mehr in der Staffelübersicht suchen.

## v1.16.42 — August 2026

### Android TV: Automatische Aktualisierung und Fernbedienungsnavigation

- Auto-Update: Die Installation schlug bei jedem Versuch still fehl (Sitzung vom System abgelehnt — ein Datenstrom, der vor der Validierung nie geschlossen wurde). Korrigiert und in realen Bedingungen überprüft.
- Fernbedienung: Vom Navigationsbalken oben führte der Pfeil nach unten nie auf den darunter liegenden Inhalt, auf keinem Tab — das System fand spontan kein Ziel zwischen den beiden. Explizites Ziel gesetzt, damit der Pfeil nach unten überall funktioniert (Startseite, Filme, Serien, Suche, Einstellungen).

## v1.16.41 — August 2026

### Android TV: Bibliothek und Serienfortlauf

- Der Button „Zur Bibliothek hinzufügen“ zeigte nach dem Hinzufügen nicht mehr den korrekten Status (Download läuft usw.) an — er konnte aufgrund eines zu schnellen Aktualisierens wieder auf „Hinzufügen“ zurückfallen. Neue automatische Versuche.
- „Weiter ansehen“ bei einer Serie öffnet nun direkt die aktuelle Episode (richtige Staffel, Fortsetzungs-CTA mit Episodennummer und -titel) und nicht immer wieder die Staffel 1 wie bei einem Film.

## v1.16.40 — August 2026

### Android TV: Korrekturen für reale Geräte

- Stellt die Versionsnummer überall wieder her (`package.json`, README-Badge, `versionCode`/`versionName` der Android TV App) — die Abweichung zwischen diesen Quellen führte zu fehlgeschlagenen Updates.
- Korrigiert einen Absturz beim Kompilieren des Profilbildschirms („Wer ist das?“) durch eine unvollendete Arbeit.
- Suche: Entfernt das Banner „Seite öffnen“, das unter den fokussierten Karten angezeigt wurde — auf einer Karte zu sein und zu bestätigen, öffnet nun direkt die Seite, wie überall sonst.
- Einstellungen und Suche: Entfernt den opaken Streifen, der über dem Inhalt blieb, der bereits auf der Startseite und in den Film-/Serienkatalogen entfernt wurde.

## v1.16.33 — August 2026

### Android TV: Profilbildschirm — aktiver Profilname, Hinzufügen per Login, Duplikate erkannt

- **Aktiver Profilname überall**: Beim Neustart einer persistenten Sitzung zeigte die Menüleiste (Benutzer-Badge) „—“ und das Avatar „?“ — das aktive Profil wird nun wiederhergestellt, sobald die Sitzung überprüft wurde.
- **„Mein Profil“ und „Benutzer wechseln“** führen zum Profilbildschirm („Wer ist das?“): Aktives Profil oben (immer sichtbar, auch außerhalb des Haushalts), Haushaltsmitglieder und das „+“-Kacheln — kein direkter Weiterleitung zum Login mehr.
- **Benutzer hinzufügen = Login**: Die Kachel „+“ öffnet die Anmeldung mit dem hinzuzufügende Konto (dedizierte Unterzeile); nach der Anmeldung wird das Konto zum Haushalt hinzugefügt und das Profil wird mit Bestätigung angezeigt.
- **Vorhandenes Konto erkannt**: Sich mit einem bereits im Haushalt befindlichen Konto anzumelden, erstellt kein Duplikat — Meldung „Dieses Konto ist bereits im Haushalt“.

## v1.16.32 — August 2026

### Verfeinerte Profil-Isolation: Jeder behält SEINE Ansichten, nichts vermischt sich

- **Korrektur von 1.16.31**: Importierte Freundekonten besitzen ihre eigenen Plex-Konten (der Admin führt nur einen Import in Benutzer durch, nichts anderes) — sie müssen daher **ihre** Historie, ihre Fortsetzungen und ihre Präferenzen wiederherstellen und nicht leer bleiben.
- **Datenleckschutz** : Plex kann die Serverhistorie (die des Verknüpfungskontos) anstelle der angeforderten Konto-Historie zurückgeben. Der Fußabdruck (Filme + Episoden) jeder Historie wird mit dem des Verknüpfungskontos verglichen: identisch → Schreibzugriff verweigert + kontaminierte frühere Daten gelöscht; unterschiedlich → es ist wirklich seine, normale Synchronisierung. Keine Aktivität eines Profils leckt auf ein anderes, und kein Profil wird von seinen echten Daten abgeschnitten.

## v1.16.31 — August 2026

### Geschlossene Profile + erweiterter KI-Speicher + Kontext-Reset

- **Geschützte Barriere zwischen Profilen (Major-Korrektur)** : Der KI-Kontext jedes importierten Freundesprofils zeigte die Aktivität des Verknüpfungskontos an (294 gesehen Filme, Die Simpsons 714 Episoden...). Plex gibt die Serverhistorie für Freundekonten zurück, unabhängig vom angeforderten Konto — die Historie wird nun nur noch für das authentifizierte Konto mit seinem eigenen Token synchronisiert; alle anderen Profile (Freunde, Zuhause) bleiben streng leer, und kontaminierte Daten werden erkannt und gelöscht. Jedes Profil hat nur seine eigenen Ansichten — seine eigenen, niemals die eines anderen.
- **Kontinuierlicher Gesprächsgedächtnis** : Jede mit dem Assistenten geführte Diskussion (Geschmäcker, Abneigungen, Präferenzen, Gewohnheiten, Vorname...) wird extrahiert und parallel zur Antwort gespeichert (ohne zusätzliche Latenz), über die bloßen Marker hinaus, die das Modell bisher ausgegeben hat. Die Speicherkapazität für Fakten wurde von 30 auf 100 erhöht.
- **Schaltfläche „Kontext zurücksetzen“** im Profil, neben „Kontext erstellen“: Bestätigung mit zwei Klicks, der erlernte Kontext wird gelöscht (Bewertungen und Noten bleiben erhalten).

## v1.16.30 — August 2026

### Android TV: Auto-Update behoben (Installationsfehler)

- Die Installation schlug bei `commit()` still fehl: Auf Android 15+ muss der Status-Receiver von einem **veränderbaren** PendingIntent stammen — `FLAG_IMMUTABLE` verursachte `IllegalArgumentException` und die Sitzung wurde abgebrochen (die App blieb nach dem Ladebalken bei der alten Version hängen).
- Der PendingIntent für den Commit ist nun `FLAG_MUTABLE`: Das Update wird angewendet und die App startet automatisch mit der neuen Version neu.

## v1.16.29 — August 2026

### Android TV: Serienseite — Blinken und erzwungener Rücksprung zu Staffel 1 beendet

- Das periodische Aktualisieren der Seite (3 s) löschte die Staffeln, bevor sie neu geladen wurden: Der Bildschirm flackerte und die D-Pad-Auswahl wurde zurückgesetzt (Rückkehr zu Staffel 1 nach jedem Poll).
- Staffeln werden nur noch bei einem SERIENWECHSEL gelöscht; ein einfaches Aktualisieren behält die Anzeige bei.
- Die Standardstaffel wird nur beim Öffnen der Seite ausgewählt: Ein Aktualisieren überschreibt nie wieder die Benutzerauswahl.

## v1.16.28 — August 2026

### Android TV: Profilmenü überarbeitet + Navigation

- Profilmenü im Movviz-Design (tiefdunkler Hintergrund, dezente Umrandung, klare Fokussierung, Markenverlauf) mit Kopfzeile „Aktives Profil“ (Avatar + Name).
- Korrigiert den Klick auf „Benutzer wechseln“: Die Menüelemente reagierten nicht auf den Zeigerklick (es fehlte `tvPointerClick`) — Der Klick mit Maus/Fernbedienung funktioniert nun überall.
- Entfernt den Tab „Suchen“ aus der Navigationsleiste: Die Lupe existiert bereits und öffnet die Suche vom Startbildschirm aus.

## v1.16.27 — August 2026

### Android TV: Auto-Update-Korrekturen

- Korrigiert die Installation: `fsync(OutputStream)` schließt den Stream auf API 35 selbst — das zusätzliche `close()` ließ die Sitzung abbrechen und die APK wurde nie installiert (die App schien nach dem Update „abzustürzen“).
- Korrigiert den Absturz der Schaltfläche „Zulassen“ (Öffnen der Einstellungen für unbekannte Quellen ohne `FLAG_ACTIVITY_NEW_TASK` — `AndroidRuntimeException` im Anwendungs-Kontext).
- Fügt Logs (`MovvizUpdate`) hinzu, um die automatische Installation und den Neustart zu verfolgen.

## v1.16.26 — August 2026

### Android TV: Profilmenü im Netflix-Stil

- Ersetzt den Text „MOVVIZ TV“ oben rechts durch den Avatar des aktiven Profils, immer sichtbar.
- Beim Klicken: Netflix-ähnliches Menü mit „Benutzer wechseln“ (→ „Wer ist das?“ Bildschirm: Auswahl eines Haushalts-Profils oder Hinzufügen eines Mitglieds), Kurzübersicht der Haushalts-Profile und „+ Benutzer hinzufügen“.
- Ein Gastkonto, das „Benutzer wechseln“ wählt, durchläuft erneut den Login (es gibt keinen Haushalt).

## v1.16.25 — August 2026

### Android TV: Verbesserte automatische Aktualisierung

- Die Installation erfolgt nun im Hintergrund (PackageInstaller Session API): Kein Systembildschirm mehr, der die App „schließt“ — sie bleibt mit einem Ladebalken angezeigt, während sie installiert wird, und die App startet dann automatisch mit der neuen Version neu (Receiver `MY_PACKAGE_REPLACED`).
- Entfernt den Systeminstaller `ACTION_VIEW` (FileProvider ist für diesen Ablauf nicht mehr notwendig).

### Android TV: Schwarzer Streifen im Katalog

- Korrigiert den schwarzen Streifen über dem Hero der Tabs Filme und Serien: Der Inhalt wird nun unter die Glasnavigationsleiste wie auf der Startseite gesetzt (Das `padding` von 80 dp wird nur für Suche und Einstellungen beibehalten).

## v1.16.24 — August 2026

### Android TV: Haushalts-Profile auf dem Server

- Die Haushalts-Profile werden nun auf dem Server gespeichert (`/api/tv-profiles`), nicht nur auf dem Gerät: Ein frisch installiertes APK zeigt nicht mehr die lokalen Profile des vorherigen Geräts.
- Verwaltung des Haushalts mit 100 % Admin-Rechten: Nur der Admin sieht die Liste der Konten und kann ein Mitglied hinzufügen/entfernen (Auswahl aus bestehenden Konten, ohne Passwort). Ein Gastkonto, das von einem APK aus angemeldet wird, sieht den Haushalt nie und kann nichts hinzufügen.
- Der Bildschirm „Mitglied zum Haushalt hinzufügen“ ersetzt den Login, um den Haushalt über den Auswähler und das Navigationsmenü zu füllen.
- Sitzungen bleiben lokal für jedes Gerät (getrennt nach Server und Konto).

### Android TV: Katalog-Header

- Entfernt das schwarze Titelbanner über dem Hero der Tabs Filme und Serien: Der Hero startet nun ganz oben, wie auf der Startseite.

## v1.16.23 — August 2026

### Android TV: Wiedergabe

- Fügt das fehlende Media3 DASH Modul hinzu, um einen Absturz beim Zusammenklappen der Wiedergabe zu vermeiden.

## v1.16.22 — August 2026

### Android TV: Profilkompilierung

- Korrigiert die Host-Server-Auflösung, die zum Speichern und Wiederherstellen von Profilsitzungen verwendet wird.

## v1.16.21 — August 2026

### Android TV: Profilmenü-Korrekturen

- Korrigiert die Kompilierung des Retail/AU-Auswählers und des Profilmenüs.
- Behält getrennte Sitzungen und synchronisierte Avatare bei.

## v1.16.20 — August 2026

### Android TV: Synchronisierte Profile

- Fügt den Profil-Auswahlbildschirm beim Start nach der Serverauswahl hinzu.
- Nutzt bestehende Movviz-Konten, deren Plex-Avatare und deren persistente Sitzungen wieder.
- Fügt das Hinzufügen eines Profils und das Profilwechseln aus dem TV-Menü hinzu.
- Es wird kein Jugendprofil oder Sonderrecht eingeführt.

## v1.16.19 — August 2026

### Android TV: Auto-Update ohne Store (AU-Variante)

- Neue APK-Variante **AU** („Auto-Update“) neben der Retail-Version: Beim Start fragt sie die öffentlichen Movviz GitHub-Releases ab, vergleicht die Version und zeigt „Aktualisierung, bitte warten Sie…“ mit einem Fortschrittsbalken während des Downloads an.
- SHA-256 wird gegen den auf GitHub veröffentlichten Digest überprüft – eine beschädigte oder gefälschte Datei wird niemals installiert.
- Installation über den Systeminstaller (FileProvider); die Berechtigung „Unbekannte Quellen“ wird beim ersten Start verwaltet und bei der Rückkehr zu den Einstellungen automatisch fortgesetzt.
- Die Retail-Version behält kein Auto-Update bei; beide APKs teilen dieselbe Signatur – das AU aktualisiert sich darüber ohne Datenverlust.
- Das CI veröffentlicht nun beide APKs (`Movviz-Android-TV-client-retail.apk` und `Movviz-Android-TV-client-AU.apk`) bei jeder Veröffentlichung.

## v1.16.18 — August 2026

### Android TV: 3-stufige Wiedergabe — direkt > ffmpeg Audio allein > HLS

- Direkte Wiedergabe (Rohbytes), solange ExoPlayer alles nativ dekodiert – kein Transkodieren.
- Sobald ein Format nicht dekodierbar ist (oft Audio: DTS/AC3/TrueHD), wird auf ein Audio-Transkodieren umgeschaltet: Das Video wird als Bitstream kopiert (x264/x265 werden niemals neu kodiert) und nur der Ton wird in AAC neu kodiert, über DASH (das einzige Format, bei dem Plex das Kopieren des Bitstreams, einschließlich HEVC, unterstützt).
- Wenn das kopierte Video immer noch nicht dekodierbar ist (z. B. AV1), als letzter Ausweg: vollständiges Transkodieren nach h264/aac, serviert in HLS.
- Jeder Modus wird pro Element nur einmal versucht, mit Wiederaufnahme an derselben Stelle, keine Schleife.

## v1.16.17 — August 2026

### Navigation im Titel-Panel

- Ein Klick auf einen ähnlichen Titel, einen Darsteller oder eine Sammlung im Panel aktualisiert das Panel, anstatt eine ganze Seite zu öffnen.
- Die Ansichten für Darsteller und Sammlungen teilen nun strikt dieselbe Komponente wie ihre dedizierten Seiten (`PersonContent`, `CollectionContent`) – keine dedizierte Variante für das Panel.

### Android TV: Karussells nach Typ

- Das Film-Karussell zeigt nun nur noch Filme.
- Das Serien-Karussell zeigt nun nur noch Serien.
- Das gemischte Karussell auf der allgemeinen Startseite bleibt unverändert.

## v1.16.15 — August 2026

### Android TV: Angereichertes Katalog und flüssigere Wiedergabe

- Nutzt die bestehenden redaktionellen Reihen des Dashboards (`/api/metadata/rows`) auf der Startseite, in Filmen und Serien.
- Fügt einen gemeinsamen Media3-Videocache von 1,5 GB und ein erweitertes Pufferung für das Streaming hinzu, um Neuladungen zu begrenzen.
- Behält die Media3-Audio- und Untertitelspuren sowie den bestehenden Transkodierungs-Fallback bei.

## v1.16.14 — August 2026

### Android TV: Retail-Version und Plex-Verbindung

- Behebt den Absturz beim Start der minifizierten Version und toleriert ältere Plex-Konten ohne das Feld `status`.
- Behält den lokalen Retail-Schlüssel außerhalb des Repositories bei und lässt Builds ohne Keystore funktionieren, ohne Geheimnisse offenzulegen.

## v1.16.13 — August 2026

### Android TV: Plex-Verbindungsdiagnose

- Zeigt nun den vom Server zurückgegebenen Fehler beim Abfragen des Plex-PINs (`no_plex_access`, nicht zugängliches Plex-Konto usw.) anstelle einer allgemeinen Meldung.
- Behält den Desktop-Stream unverändert bei.

## v1.16.12 — August 2026

### Android TV: Titellogos

- Behebt eine systematische Verschiebung, die das Film- oder Serienlogo links vom Bildschirm verschoben hat, sowohl auf der Startseite als auch auf der Titelseite, für jedes Logo, das nicht den gleichen Rand wie für die Kalibrierungseinstellung aufweist.
- Behebt den aktiven Menü-Button ("Startseite"), der sofort beim Fokus mit der Fernbedienung ein unlesbarer, undurchsichtiger weißer Block wurde.

## v1.16.11 — August 2026

### Android TV-Versionierung

- Richtet die native Version des Android TV APK endlich auf die veröffentlichte Movviz-Version (`1.16.11`) aus und erhöht ihren `versionCode`.

## v1.16.10 — August 2026

### Android TV: Plex-Verbindung

- Ermöglicht explizit die neue TV-PIN-Route im Authentifizierungsproxy, damit der Emulator und Android TV-Geräte sie ohne Sitzung aufrufen können.

## v1.16.9 — August 2026

### Android TV: Plex-Verbindung

- Fügt eine dedizierte Route für den kurzen Plex-Code für TV-Geräte hinzu, ohne den bestehenden Plex-Desktop-Stream zu ändern.
- Android TV zeigt und verwendet den kurzen Verbindungs-PIN über `plex.tv/link`.
- Der diskrete Link zur Serveränderung löscht die lokale Konfiguration sauber, bevor er zum Assistenten zurückkehrt.

## v1.16.8 — August 2026

### Desktop-Chat: Kontinuität und Geschmack

- Explizit in Gesprächen gemachte Notizen werden nun gespeichert, ohne von einem Modell-Marker abhängig zu sein; eine Notiz über ein „ganzes“ Universum bleibt eine globale Präferenz und wird nicht auf einen einzelnen Film reduziert.
- Nach einem Vorschlagsangebot, „ok“, „mach es“ oder „gib“ wird die Auswahl fortgesetzt und kann nicht mehr als zu durchsuchender Titel interpretiert werden.
- Wenn das Modell eine Auswahl ankündigt, ohne Karten zurückzugeben, fordert Movviz eine strukturierte Antwort mit Empfehlungen an.

## v1.16.7 — August 2026

### Android TV: Movviz visuelle Identität

- Das animierte TV-Mark nimmt die exakten Geometrien des Lucide `Clapperboard`-Icons auf dem Desktop über ein natives VectorDrawable wieder auf.
- Verstärktes, mehrfarbiges violett, magenta und cyan-Aurora-Halo um das animierte Logo wie ein statisches Kachelmuster, ohne die TV-Navigation zu ändern.

## v1.16.6 — August 2026

### Android TV: Navigation und Wohnzimmerbibliothek

- Überarbeitete TV-Karten: Offizielles TMDb-Logo, Abzeichen unter dem Logo, getrennte Aufnahme und Neustart, und Rückkehr des Players zur Karte.
- Serien bieten einen Saisonwähler ohne Bonus S0, eine Episoden-illustrierte Karte und die Suche nach einer fehlenden Saison aus dem Fernsehen.
- Verbesserte Dashboard: Animierte Movviz-Navigation, Kacheln ohne Bild mit festem Marken-Halo und klickbare Download-Karten mit lesbarer Fortschrittsanzeige.

## v1.16.5 — August 2026

### Korrektur: Matching-Worker in Standalone-Installationen eingebettet

- Die Bereinigung des Standalone-Bundles löschte die Dateien `*Worker.mjs` nach dem Build: Automatische Suchen konnten daher kurz nach dem Lesen des RSS-Caches in gepackten Installationen seit v1.16.1 fehlschlagen.
- Das Build kopiert nun explizit alle Worker in die Standalone-Runtime und die Pools lösen diese von diesem Speicherort auf. Das parallele Matching funktioniert wieder; der lokale Sicherheits-Fallback bleibt aktiv.

## v1.16.4 — August 2026

### Korrektur: Anfragen und Auto-Suche entkoppelt

- Eine genehmigte Anfrage wird nun gespeichert, sobald der Film oder die Serie in die Bibliothek aufgenommen wird, bevor die automatische Suche erfolgt. Ein Indexierungs- oder Matching-Fehler kann daher kein Medium erstellen, ohne es in **Anfragen** erscheinen zu lassen.
- Unvorhergesehene Fehler während der Suche nach einem Film, einer Staffel oder einer Episode werden zu einem kontrollierten und expliziten Ergebnis im Diagnoseprotokoll, anstatt zu einem Fehler 500 oder einem „Suche“-Status, der ohne Ursache wiederhergestellt wird.

## v1.16.3 — August 2026

### Korrektur: Zuverlässige automatische Hinzufügung, auch ohne verfügbaren Worker

- Das Hinzufügen eines Films oder einer Serie wird nicht mehr durch einen Fehler 500 unterbrochen, wenn der Matching-Worker von einer gepackten Installation nicht geladen wird: Movviz wendet dann die gleichen Matching-Regeln direkt im Hauptprozess an und setzt die automatische Suche fort.
- Der fehlerhafte Worker-Pool wird sauber gestoppt, anstatt in einer Endlosschleife neu gestartet zu werden, wodurch verhindert wird, dass der Server dauerhaft fehlerhaft bleibt.
- Die Karte zeigt nicht mehr eine HTTP-Fehlantwort wie eine erfolgreiche Hinzufügung: Der Fehler wird angezeigt und der tatsächliche Zustand der Bibliothek wird neu geladen.

### Android TV: Movviz Identität und Entdeckungs-Flow

- Der TV-Bildschirm übernimmt nun die Movviz-visuelle Identität: offizielles Clap-Logo, Glas-Navigation auf dem Hero, Karten und Titelkarten angepasst für die Fernbedienung.
- Die Verbindung mit Plex und die Bibliotheksaktionen sind in den TV-Flow integriert, mit sofortiger Rückmeldung des Download-Status.

## v1.16.2 — August 2026

### Neu: Abgetrennte Bibliothek — Seiten für Filme und Serien

- Die Bibliothek ist nun in **drei feste Seiten** unterteilt: `/library` (Alles, beide Typen gemischt), `/movies` (nur Filme) und `/series` (nur Serien) – zugänglich über das Untermenü „Bibliothek“ in der Seitenleiste.
- Die Seiten Filme und Serien haben keine Filter-Schaltflächen mehr nach Typ (das ist ihr fester Charakter); Sortierung, Statusfilter und Tags bleiben verfügbar. Die alten Links `?type=movie|series` leiten automatisch zu den neuen Seiten weiter.

## v1.16.1 — August 2026

### Neu: Untermenü Bibliothek in der Seitenleiste (Desktop)

- Das Menü „Bibliothek“ klappt nun unter drei Einträgen auf: **Alles**, **Filme** und **Serien** – ein Chevron öffnet/schließt das Untermenü, und der aktive Eintrag wird hervorgehoben. Bereits angewendete Filter, Sortierungen und Tags bleiben erhalten, wenn man zwischen den drei Ansichten wechselt.

### Korrektur: Build fehlgeschlagen wegen fehlendem Speicherplatz

- **Ursache identifiziert**: Der Turbopack-Build von Next.js 16 ignorierte Tracing-Ausschlüsse und kopierte Entwicklungsordner (`dta/`, `.movviz-data/`) – bis zu ca. 480 GB – in den Standalone-Bundle, bis der Speicher voll war. Der Build fällt auf webpack zurück (wo die Ausschlüsse funktionieren) und ein Skript `clean-standalone` löscht das, was außerhalb des Bundles bleiben muss: Der Standalone-Bundle reduziert sich von ca. 480 GB auf ca. 64 MB.

## v1.16.0 — August 2026

### Neu: Android TV Client

- **Erster nativer Movviz Client** für Android TV / Fire TV (Fernbedienung, Tastatur und Maus unterstützt): Verbindung zu einem bestehenden Movviz-Server, Film-/Serienbibliothek, Titelfilm, Episodenwiedergabe, Suche, Einstellungen – wird als APK von den GitHub Releases neben dem Windows-Installer heruntergeladen.
- Sitzung wird zwischen den Starts beibehalten, wie bei Plex oder Netflix – kein erneutes Anmelden nötig.

## v1.15.17 — August 2026

### Korrektur: Eine einfache Anrede wurde als Filmtitel interpretiert

- **Ursache live bestätigt**: Das Schreiben von „hep“ zur Aufmerksamkeit erregte eine Suche, und Movviz setzte daraufhin auf einen obskuren tschechischen Film von 2013, als wäre dies das Thema des Gesprächs. Die Liste der als solche erkannten Grüße und Interjektionen (hep, hé, eh, ho, wesh, hmm, bref, ciao…) wurde deutlich erweitert – echte kurze Titel wie „300“ oder „Up“ werden weiterhin korrekt erkannt.

## v1.15.16 — August 2026

### Korrektur: Ein falscher Titel konnte hinzugefügt werden, wenn Film und Serie ähnlich waren

- **Ursache live bestätigt**: Die Anfrage „Lade Lanterns“ fügte „Human Lanterns“ (Film von 1982 ohne jeglichen Bezug) hinzu, obwohl die Serie „Lanterns“ (2026) der allererste Suchtreffer war. Der Assistent ging davon aus, es handele sich um einen Film, und diese Annahme schloss automatisch alle Serien aus – auch die exakte Übereinstimmung. Ein Titel, der deutlich besser passt, hat nun Vorrang vor dieser Annahme, egal ob es sich um einen Film oder eine Serie handelt.
- Einige zusätzliche gängige Wörter („de“, „in“, „und“…) können nicht mehr als Vorname interpretiert werden.

## v1.15.15 — August 2026

### Korrektur: Ein gewöhnliches Wort konnte als Vorname gespeichert werden

- **Ursache live bestätigt**: Das Schreiben eines Satzes wie „ich habe ihn nicht gesehen, ist es mit DiCaprio?“ ließ „Mit“ als Vorname speichern und überschrieb den echten. Der Detektor nahm jedes Wort nach einem „ist“ im Laufe eines Satzes. Diese Form wird nun nur am Satzanfang erkannt (die Antwort „ist Seb“ auf die Frage nach dem Vornamen wird weiterhin erfasst), und eine erweiterte Liste gängiger Wörter kann niemals ein Vorname werden.

### Korrektur: Eine erfolgreiche Bewertung wurde als Fehlschlag angezeigt

- **Ursache live bestätigt**: Bei einer Anfrage wie „Gib X, Y und Z 5 Sterne“ wurden die Bewertungen zwar gespeichert, aber die angezeigte Antwort war „ich habe einen echten Block“ – der Assistent generierte keinen Satz zu seinen Bewertungen. Die Bestätigung wird nun basierend auf den tatsächlich gespeicherten Bewertungen erstellt, zusammen mit der Liste der Titel und deren Bewertung.

## v1.15.14 — August 2026

### Korrektur: Die gemeldeten Stapelbewertungen wurden nicht tatsächlich gespeichert

- **Ursache live bestätigt**: Nach Durchsicht der Titel einzeln, die Antwort „Ich war begeistert, gib alle 5 Sterne“ zeigte eine sorgfältig zusammengestellte Liste („Solo Leveling: 5/5“, „Jurassic Park: 5/5“…) und kündigte „hier sind die aktualisierten Bewertungen“ an – obwohl **keine Bewertung gespeichert wurde**. Zwei kumulative Ursachen: Ein internes Limit von maximal 2 Bewertungen pro Antwort machte eine stückweise Bewertung strukturell unmöglich, und nichts verhinderte es, Bewertungen zu melden, ohne sie tatsächlich zu hinterlegen.
- Die Stapelbewertung akzeptiert nun bis zu 10 Titel auf einmal, und jede Antwort, die Bewertungen meldet, ohne sie tatsächlich zu speichern, wird automatisch erkannt und korrigiert – nie wieder eine gemeldete, aber fehlende Bewertung.

## v1.15.13 — August 2026

### Movviz AI — Das Gesprächsthema wird nun explizit verfolgt

- **Ursache bei der Prüfung identifiziert**: Außerhalb eines geöffneten Film-/Serienprofils wusste die Assistenz nichts darüber, über welchen Titel Sie gerade sprachen – sie musste es durch erneutes Lesen des Verlaufs erraten, was bei natürlichen Verläufen („Solo Leveling“ → „ich liebe es“ → „das Beste ist gegen X“) fehlschlug und in der dritten Nachricht eine unnötige Suche auslösen konnte. Der aktuell diskutierte Titel wird nun gespeichert, sobald er tatsächlich identifiziert wurde, und bei jeder folgenden Nachricht wiederholt: Kurze Reaktionen, implizite Verweise und Charakternamen beziehen sich standardmäßig auf diesen Titel, ohne erneut mit der Suche zu beginnen.

## v1.15.12 — August 2026

### Movviz AI — Filmografie und gekreuzte Bewertungen zur Priorisierung eines fehlenden Titels

- Wenn eine Filmografiesuche fehlende Titel aufdeckt und der Benutzer Bewertungen hinterlegt hat, kann die Assistenz nun beides kreuzverweisen, um zu vorschlagen, welcher der fehlenden Titel am ehesten gefallen könnte, basierend auf tatsächlich geteilten Merkmalen (Ton, Genre, Struktur) – niemals auf erfundener Intuition.

## v1.15.11 — August 2026

### Movviz AI — Vereinheitlichte Entscheidungshierarchie

- Die vielen separat hinzugefügten Regeln (kurze Antworten, Korrekturen, Titelhinweise, einzelne Meinungen...) sind nun unter einer expliziten und einzigen Prioritätsreihenfolge zusammengefasst, um zu verhindern, dass isolierte Regeln sich widersprechen: Reaktion auf das laufende Gespräch > Verweis auf das aktive Thema (ein Charakter, eine Szene, „der zweite“...) > Korrektur der vorherigen Antwort > Gesprächsabsicht > bereits bekanntes Werk > potenziell neues Werk > externe Suche als letztes Mittel.
- Eine Meinung zu einem bestimmten Charakter (z. B. „Beru ist eindeutig der Beste“) wird nun wie Meinungen zu einer bereits abgedeckten Szene/einem Schauspieler/einem Ende behandelt: Sie wird als solche gespeichert und niemals in eine allgemeine Bewertung des Titels umgewandelt.

## v1.15.10 — August 2026

### Movviz AI — Dezentes Abzeichen statt erzwungener Öffnung

- Wenn Movviz das Gespräch nach einer Abwesenheit spontan wieder aufnimmt, öffnet sich der Chat nicht mehr automatisch – der schwebende Button zeigt nun ein nummeriertes Abzeichen mit einem leichten Puls, bis der Benutzer ihn selbst öffnet.

## v1.15.9 — August 2026

### Movviz AI — Die spontane Wiederaufnahme kann nun auf eine Bewertung bezogen sein

- Wenn Movviz das Gespräch nach einer Abwesenheit spontan wieder aufnimmt (bereits bestehendes Mechanismus mit eigener Wartezeit), kann es nun gelegentlich direkt nach der Bewertung eines gesehenen, aber nie bewerteten Titels fragen, anstatt nach einer allgemeinen Frage – niemals zweimal über zwei verschiedene Kanäle innerhalb desselben Zeitfensters.

## v1.15.8 — August 2026

### Korrektur: Eine Bewertung aktualisierte nicht den Kontext in Echtzeit

- **Ursache live bestätigt**: Im Gegensatz zu jeder anderen tatsächlichen Aktivität (Ansehen, 👍/👎-Feedback, Netflix-Import) löste das Hinterlegen einer Bewertung – über das Stern-Widget oder im Gespräch – nicht die Aktualisierung des konsolidierten Kontextes („Was Movviz AI über dich weiß“) aus. Man musste manuell auf „Kontext neu generieren“ klicken, damit die Bewertungen berücksichtigt wurden. Eine Bewertung wird nun automatisch fortgeschrieben, wie der Rest.

### Movviz AI — gelegentliche Frage zu einem gesehenen, aber nie bewerteten Titel

- Gelegentlich, wenn das Gespräch es natürlich zulässt, kann der Assistent nun nach der Bewertung eines vollständig gesehenen, aber nie bewerteten Titels fragen – niemals systematisch (limitiert auf einmal alle paar Stunden, niemals erzwungen, wenn der Zeitpunkt nicht passt).

### Profil-Dashboard — Feedback 👍/👎 entfernen

- Jeder auf dem Dashboard „Was Movviz AI über dich weiß“ gelikte/abgelehnte Titel hat nun einen Button, um ihn aus dem Kontext zu entfernen (nützlich bei versehentlich abgegebenen Bewertungen).

## v1.15.7 — August 2026

### Movviz AI — Ein bereits abgelehnter Titel wird nie wieder vorgeschlagen

- Ein als „schlechte Empfehlung“ markierter Titel (👎) wird zukünftig definitiv von Empfehlungen ausgeschlossen – bisher galt nur eine leichte Strafe für Titel mit ähnlichem Ton, was nicht verhinderte, dass der exakt abgelehnte Titel zurückkam.

## v1.15.6 — August 2026

### Movviz AI — Unterscheidung zwischen einer einzelnen Meinung und einer Gesamtbewertung

- Ein Kommentar zu einem bestimmten Element („Ich liebe diese Szene“, „Dieser Schauspieler ist großartig“, „Das Ende ist ein Reinfall“) führt nicht mehr zur Ableitung einer Gesamtbewertung des gesamten Titels – nur eine Meinung, die sich auf das Gesamtwerk oder die Serie bezieht, wird in eine Bewertung umgewandelt.

## v1.15.5 — August 2026

### Movviz AI — Verstärkte Identität des Filmfreundes

- Der Assistent argumentiert nun explizit wie ein Filmfreund, der versucht, den Benutzer zu verstehen (warum er einen Titel mag, nicht nur welches Genre), anstatt wie eine Suchmaschine mit umgebendem Text.
- Kurze Antworten („Aber doch“, „Dieser“, „Ich habe ihn schon gesehen“...) lösen niemals mehr unnötige Suchen aus – sie werden nun als Reaktionen/Korrekturen erkannt, die im Verhältnis zur vorherigen Nachricht verstanden werden müssen, niemals als neuer zu suchender Titel.
- Wenn das Gespräch ein einfaches Filmgespräch ist, treten die Sammlung von Präferenzen und Nachfragen in den Hintergrund zugunsten des natürlichen Austauschs.
- Generische Assistentenformulierungen („Soll ich Ihnen helfen?...“) explizit verboten.

## v1.15.4 — August 2026

### Korrektur: Verstärkte Garantie gegen rohe technische Zeilen (Fortsetzung der vorherigen Korrektur)

- **Ursache live bestätigt**: Die Korrektur v1.15.3 basierte auf einem neuen Versuch von Movviz zu antworten, der dieselbe technische Zeile reproduzieren konnte, anstatt eines echten Satzes. Eine deterministische automatische Umformulierung (ohne von einem neuen Versuch des Sprachmodells abzuhängen) ist nun implementiert, um sicherzustellen, dass niemals eine rohe technische Zeile beim Benutzer ankommt.

## v1.15.3 — August 2026

### Korrektur: Erwähnung eines Titels, die manchmal durch eine technische Zeile statt durch einen echten Satz beantwortet wurde

- **Ursache live bestätigt**: Die Korrektur v1.15.2 verhinderte zwar das stille Hinzufügen, aber in einigen Fällen antwortete der Assistent trotzdem mit einer einzigen Zeile im Format „• Bereits in der Bibliothek — Titel (Jahr)“ – eine Nachahmung des intern verwendeten technischen Formats für Hinzufügungsergebnisse, die fälschlicherweise anstelle einer echten natürlichen Reaktion kopiert wurde. Dieses mechanische Format wird nun erkannt und automatisch korrigiert, um immer einen echten Satz zu liefern.

## v1.15.2 — August 2026

### Korrektur: Erwähnung eines Titels, die manchmal als stilles Hinzufügen behandelt wurde

- **Ursache live bestätigt**: Die in v1.15.1 hinzugefügte Überprüfung (Bibliothek/Verlauf/Bewertung vor der Reaktion auf einen erwähnten Titel) wurde in einigen Fällen tatsächlich nie ausgelöst, da der Assistent manchmal eine einfache Nennung eines Titels („Hurlevent“, „the nice guys“) als impliziten Hinzufügungsantrag interpretierte – Ergebnis: eine technische Zeile („Bereits in der Bibliothek — X“) ohne jegliche Reaktion, anstatt einer echten Antwort. Korrigiert: Eine Nennung eines Titels ohne explizites Aktionsverb (hinzufügen, legen, herunterladen...) löst niemals mehr ein stilles Hinzufügen aus und erfolgt nun korrekt über die erwartete natürliche Antwort.

## v1.15.1 — August 2026

### Korrektur: Movviz AI konsultierte nicht, was es bereits wusste, bevor es antwortete

- **Ursache direkt bestätigt**: Bei bloßer Nennung eines Titels ("Zootopie 2") fragte der Assistent nach "möchtest du es hinzufügen?" für einen bereits vorhandenen Titel oder "hast du es gesehen?", obwohl die Historie es bereits wusste – er hatte schlichtweg keine echte Überprüfung für eine zufällige Erwähnung vorzunehmen (nur explizite Fragen lösten eine aus). Er konsultiert nun systematisch die Bibliothek, die Sehverlauf und die vorhandene Bewertung, bevor er auf einen genannten Titel reagiert, und stützt sich nicht mehr auf eine Frage, deren Antwort er bereits kennt.
- Wenn ein genannter Titel gesehen, aber nie bewertet wurde, nutzt der Assistent dies natürlich, um in einem Satz um eine Meinung zu fragen, ohne ein Verhör daraus zu machen.
- Korrektur einer unvollendeten Zusage: Der Assistent konnte antworten mit "ich überprüfe das sofort!" und dann nie mit der Antwort zurückkehren – da eine Unterhaltung kein automatisches zweites Kapitel hat, ist diese Art von Versprechen nun verboten; entweder erfolgt die Überprüfung in der Nachricht selbst, oder der Assistent sagt ehrlich, dass er es nicht überprüfen kann.
- Eingeschränkte Persönlichkeit: Regelmäßigere Verwendung des bekannten Vornamens, präsenter, aber nicht übertriebener Einsatz von Emojis, Reaktion vor Frage statt umgekehrt.
- Zusätzliches Sicherheitsnetz, damit ein internes technisches Format niemals unverändert in einer Antwort angezeigt wird.

## v1.15.0 — August 2026

### Bewertungen von 1 bis 5 Sternen (neu)

- Jeder Film und jede Serie kann nun direkt von seinem Eintrag aus mit 1 bis 5 Sternen bewertet werden – nur eine Bewertung pro Titel und pro Benutzer, niemals geteilt zwischen Konten.
- Movviz AI versteht auch eine in der Konversation gegebene Bewertung ("ich war begeistert", "was für eine Enttäuschung", "ich gebe ihm 4 Sterne") und speichert sie automatisch, ohne jemals zu raten, wenn es nicht eindeutig genug ist – eine manuell auf dem Eintrag hinterlegte Bewertung hat immer Vorrang vor einer aus einem Satz abgeleiteten Bewertung.
- Diese Bewertungen verfeinern sowohl die Empfehlungen des Chatbots als auch die Vorschläge der Entdecken-Seite, die nun ein gemeinsames Verständnis für deine Vorlieben teilen, anstatt zwei getrennte Logiken.
- Das Feld „Was Movviz AI über dich weiß“ (Profilseite) zeigt nun deine letzten Bewertungen an und unterscheidet dabei zwischen manuell abgegebenen und aus einer Konversation abgeleiteten Bewertungen.

## v1.14.48 — August 2026

### Korrektur: Papierkorb-Button ist für alle in der Bibliothek sichtbar

- **Ursache direkt bestätigt**: Der Lösch-Button für einen Film (Bibliothekskachel und Filmdetailseite) wurde für jeden Benutzer angezeigt, obwohl der Server die Löschung für Nicht-Administrator-Konten bereits korrekt verweigert hatte – keine Daten waren also in Gefahr, aber ein normaler Benutzer sah einen Button, der beim Klicken stillschweigend fehlschlug. Der Button wird nun nur noch für Administrator-Konten angezeigt, wie überall sonst in der App.

## v1.14.47 — August 2026

### Korrektur: „Weiter ansehen“-Reihe wurde fälschlicherweise geleert

- **Ursache direkt bestätigt**: Die in v1.14.44 hinzugefügte doppelte Überprüfung (vorsorglich, ohne Gewissheit, ob es nötig war) verglich jeden „laufenden“ Titel mit dem bereits synchronisierten Sehverlauf – ein Verlauf, der sich nur alle 2 Stunden aktualisiert. Ein kürzlich begonnener Titel war noch nicht enthalten, weshalb er fälschlicherweise aus der Reihe verschwand, obwohl er dir gehörte. Ergebnis: Die Reihe ging von 10 echten Titeln auf nur 3 zurück. Diese doppelte Überprüfung wird entfernt; der ursprüngliche Schutz (das Token für jedes Konto) bleibt bestehen.

### Korrektur: Movviz AI und Webzugriff (fortgesetzt)

- **Ursache direkt bestätigt, zweimal**: Trotz der Korrektur der vorherigen Version verweigerte Movviz AI manchmal kategorisch jeglichen Internetzugriff, selbst wenn die Websuche in den Einstellungen aktiviert war – die Anweisung allein reichte nicht aus, um dies zuverlässig zu verhindern. Movviz AI erkennt nun diese fehlerhafte Verweigerung und korrigiert sich sofort, bevor es irgendetwas anzeigt, mit demselben Ansatz wie bei anderen bereits implementierten automatischen Korrekturen.

## v1.14.46 — August 2026

### Korrektur: Movviz AI und Webzugriff

- **Bestätigte Grundursache**: Movviz AI antwortete auf "Ich habe keinen Internetzugang" als feste technische Unmöglichkeit, ohne jemals zu berücksichtigen, ob die Einstellung "Websuche" im Konto (Einstellungen KI) tatsächlich aktiviert war oder nicht. Es kennt nun den tatsächlichen Status dieser Einstellung: Ist sie deaktiviert, erklärt es dies als umkehrbare Konfigurationswahl und nicht als endgültige Grenze; ist sie aktiviert, behauptet es nicht mehr, keinen Zugriff zu haben, obwohl für bestimmte spezifische Funktionen (wie das Wiederfinden einer denkwürdigen Szene) tatsächlich eine echte Suche durchgeführt wird. Zur Erinnerung: Diese Einstellung tritt mit der nächsten Nachricht sofort in Kraft, ohne dass die Seite neu geladen oder die Verbindung wiederhergestellt werden muss.

## v1.14.45 — August 2026

### Neu: Movviz AI kann endlich auf "Gib mir die Filmografie von X" antworten

- **Live bestätigte Grundursache**: Die Anforderung der Filmografie eines Schauspielers oder Regisseurs ("Gib mir die Filmografie von Brad Pitt") erhielt immer noch die gleiche Ablehnung, wortwörtlich, selbst bei mehrmaliger Nachfrage – Movviz AI hatte schlichtweg keine echten Daten für diese spezifische Art von Frage, im Gegensatz zu "Was fehlt mir von X", bei dem bereits eine echte Suche angeschlossen war. Für diese spezifische Frage wird nun eine echte Suche auf TMDb (mit seiner tatsächlichen Filmografie, abgeglichen mit deiner Bibliothek) ausgelöst.
- Movviz AI wiederholt nicht mehr wortwörtlich eine Antwort von einer Nachricht zur nächsten im selben Gespräch – die Formulierung variiert immer noch, auch wenn der inhaltliche Antwortinhalt gleich bleibt.

## v1.14.44 — August 2026

### Korrektur: Zweites Sicherheitsnetz für „Weiter ansehen“

- Die Zeile „Weiter ansehen“ überprüft nun zusätzlich zu den von Plex zurückgegebenen Daten, ob der betreffende Titel tatsächlich im Ansehenverlauf des Kontos enthalten ist, das die Seite ansieht, bevor sie angezeigt wird – ein Titel ohne jegliche Spur in diesem Verlauf wird niemals angezeigt, egal was Plex zurückgeben konnte. Diese doppelte Überprüfung schützt vor einer möglichen Kontoverwechslung seitens Plex, unabhängig von der genauen Ursache.

## v1.14.43 — August 2026

### Großkorrektur: Isolierung von Benutzerkonten

- **Bestätigte Grundursache**: Auf einem geteilten Gerät meldeten sich das Abmelden und anschließende erneute Anmelden mit einem anderen Konto nicht mehr die bereits im Speicher angezeigten Daten zurück (Anscheneinträge, Präferenzen, Anfragen, alles Persönliche) – ein vorheriger Fix hatte nur ein einzelnes technisches Element (den Verbindungsstatus) zurückgesetzt, nicht den Rest. Ergebnis: Das folgende Konto konnte kurz, oder manchmal dauerhaft, die Daten des vorherigen Kontos sehen, bevor diese sich von selbst aktualisierten. Alle persönlichen Daten werden nun bei jeder Anmeldung und Abmeldung vollständig zurückgesetzt – kein Datenleck mehr von einem Konto zum anderen.
- **Zweitgrundursache durch Nachforschung gefunden**: Ein sekundäres Plex-Profil (Admin-zugeordnetes „Heim“-/Kinderkonto, ohne eigenes Plex-Konto) sah seine angesehenen Filme/Episoden nie mehr von Plex synchronisiert werden – der Hintergrundjob ignorierte diese Profile schlichtweg. Korrigiert: Jedes Profil, einschließlich sekundärer Profile, hat nun seine eigenen, unabhängig synchronisierten Anscheneinträge.

## v1.14.42 — August 2026

### Korrektur: „Verfügbare Optimierungen“ Zeile meldet Fehler

- **Live bestätigte Grundursache** (Einstellungen > Leistung): Selbst nach dem vorherigen Fix schlug die Zeile „Verfügbare Optimierungen“ im Dashboard systematisch nach einer Minute fehl – sie startete bei jeder Anzeige des Dashboards bis zu 50 Live-Suchen über die Indizierer (eine für jeden betroffenen Film/Episode), nacheinander, was den Wartezeitrahmen des Servers bei Weitem überschritt. Diese Zeile beschränkt sich nun auf den bereits im Speicher vorhandenen Cache, der von Natur aus schnell ist; die vollständige Live-Suche bleibt vollständig im Bereich „Suchen und Ersetzen“ verfügbar und wird bewusst ausgelöst.

## v1.14.41 — August 2026

### Korrektur: Allgemeine Verlangsamung der Anwendung

- **Ursache direkt bestätigt** (Register Einstellungen > Leistung): Die Suche nach verfügbaren Optimierungen (Zeile „Verfügbare Optimierungen“ im Dashboard und das „Suchen und Ersetzen“-Panel) analysierte nun das gesamte gecachte Release für JEDEN Film und JEDE Episode der Bibliothek, anstatt dies nur einmal zu tun und das Ergebnis wiederzuverwenden — bei einer großen Bibliothek überlastete diese wiederholte Arbeit den Server für mehrere Dutzend Sekunden und verlangsamte ALLE anderen Seiten gleichzeitig (Dashboard-Laden, Bibliothek, Anfragen...), selbst wenn es nichts mit den Optimierungen zu tun hatte. Die Berechnung erfolgt nun nur einmal, mit einem streng identischen Ergebnis.

## v1.14.40 — August 2026

### Korrektur: Movviz AI

- **Ursache direkt bestätigt**: Eine Empfehlungsanfrage („Überrasche mich“) konnte eine Antwort erhalten, die eine Liste ankündigt („Hier ist, was dich überraschen könnte...“), ohne dass ein Titel folgt — ein nie eingelöchntes Versprechen, ohne Empfehlungskarte oder Fehlermeldung. Movviz AI erkennt diesen Fall nun und fordert sofort eine echte Liste an, bevor irgendetwas angezeigt wird.

## v1.14.39 — August 2026

### Korrektur: Zeile „Weiter ansehen“

- **Ursache direkt bestätigt**: Plex vermischt in seiner „On Deck“-Liste zwei verschiedene Dinge — was tatsächlich pausiert ist und gerade abgespielt wird, und die nächste Episode einer Serie, die noch nie begonnen wurde, aber hervorgehoben wird, weil eine vorherige Episode gesehen wurde. Die Zeile zeigte daher Dutzende von Thumbnails mit einem Fortschrittsbalken von 0 %, die nie wirklich gestartet waren. Nur der tatsächlich fortgesetzte Inhalt wird nun angezeigt.

## v1.14.38 — August 2026

### Neuheit: Zeile „Weiter ansehen“

- Das Dashboard zeigt nun eine Zeile „Weiter ansehen“ zwischen „Movviz Trends“ und „Passende Vorschläge“ — die laufenden Filme und Episoden, mit dem tatsächlichen Fortschrittsbalken, egal ob sie von einer klassischen Plex-App oder direkt vom integrierten Movviz-Player fortgesetzt wurden. In den Einstellungen kann sie wie andere Zeilen aktiviert/deaktiviert werden.
- **Ursache gleichzeitig korrigiert**: Der integrierte Movviz-Player meldete seinen Fortschritt bei jeder Wiedergabe an Plex, aber ein fehlendes technisches Parameter ließ Plex dieses Signal stumm ignorieren — der Fortschritt wurde also auf Serverseite nie wirklich berücksichtigt. Korrigiert, mit dem Bonus der Zuweisung zum richtigen Konto, wenn mehrere Benutzer dasselbe Plex teilen.

## v1.14.37 — August 2026

### Korrektur: Movviz AI

- **Ursache direkt bestätigt**: Jede Empfehlung zeigte eine allgemeine Entschuldigungsnachricht („Ich habe einen echten Block...“) direkt über den Vorschlägen an, obwohl die Empfehlung perfekt funktioniert hatte — ein echtes Vertrauensproblem auf dem am häufigsten genutzten Pfad der Funktion. Der Begleittext einer Empfehlung wurde in Wirklichkeit nie erstellt und fiel daher standardmäßig auf die allgemeine Fehlermeldung zurück. Nun wird bei jeder Empfehlung ein echter Einführungssatz angezeigt.

## v1.14.36 — August 2026

### Korrektur: Movviz AI

- **Ursache direkt bestätigt**: Die Frage „Erinnerst du dich an meinen Namen?“ konnte eine Antwort wie „Ich weiß es noch nicht“ erhalten, obwohl Movviz AI den Namen bereits in einigen Nachrichten zuvor im selben Gespräch verwendet hatte — der Name wurde zwar gespeichert, aber die Antwort dementierte ihn trotzdem. Movviz AI erkennt nun diese Art von falscher Verleugnung und korrigiert sich sofort, bevor irgendetwas angezeigt wird.

## v1.14.35 — August 2026

### Korrektur: Movviz AI

- **Live-Bestätigte Ursache**: Allein die Anweisung reichte nicht aus, um zu verhindern, dass bestimmte Modelle die interne technische Notiz wortwörtlich wiedergeben, anstatt sie umzuformulieren – das Problem bestand trotz einer verstärkten Anweisung weiterhin. Movviz AI erkennt nun selbst, wann dies passiert, und fordert sofort eine echte Umformulierung an, bevor es irgendetwas anzeigt; selbst wenn diese Nachforderung fehlschlägt, wird die Notiz automatisch von allem gereinigt, was sie als technisch verrät. Die interne Bezeichnung kann unabhängig vom verwendeten Modell nicht mehr in einer Antwort erscheinen.

## v1.14.34 — August 2026

### Movviz AI

- **Live-Bestätigte Ursache**: Wenn eine echte Überprüfung für die Beantwortung einer bestimmten Frage durchgeführt wurde (Besitz, angesehen, Besetzung, Status einer Serie, was einem Franchise fehlt), kopierte Movviz AI manchmal die interne technische Notiz wortwörtlich, anstatt einen echten Satz zu formulieren – eine Antwort, die eher wie ein Datenbankauszug als wie ein Gespräch klang. Korrigiert: Die überprüften Fakten bleiben korrekt, werden aber nun immer natürlich umformuliert.
- Allgemeiner verstärkter Persona: Explizite Anweisung, niemals interne Formatierungen oder technische Strukturen in einer Antwort durchscheinen zu lassen, unabhängig von der Art der Frage.
- **Live-Bestätigte Ursache**: Eine etwas längere Empfehlung oder Ergänzung konnte bei einigen Modellen mitten im Satz abgeschnitten werden – bisher führte jeder Abbruch dazu, dass alles verloren ging und stattdessen eine allgemeine Fehlermeldung angezeigt wurde. Movviz AI ruft nun die bereits vollständigen Teile einer abgeschnittenen Antwort ab, anstatt alles zu verwerfen.

## v1.14.33 — August 2026

### Korrektur: Netflix importieren

- **Live-Bestätigte Ursache bei einem echten Export**: Zwei Erkennungsfehler ließen einen großen Teil der Titel unentdeckt. Zuerst wurde eine isolierte Episodennummer („Episode 24“) fälschlicherweise als Staffelnummer interpretiert – gesucht als „Staffel 24“ einer Serie, die nur 2 oder 3 hat, daher unfindbar. Danach konnte eine Serie ohne Staffel-Etikett (nur „Serie: Episodentitel“) bei der Suche falsch zugeordnet werden und verlor dabei die genaue Episode.
- Die Bezeichnungen „Teil N“ und „Band N“ werden nun genauso als Staffel erkannt wie „Staffel N“.

## v1.14.32 — August 2026

### Movviz AI

- Movviz AI überprüft nun tatsächlich, bevor es antwortet, vier Arten von Fragen zu einem bestimmten Titel, anstatt nur aus seinem eigenen Gedächtnis zu raten: ob du einen Titel besitzt („Habe ich Alien?“), ob du ihn schon gesehen hast (ganz oder nur teilweise), wer mitgespielt hat und wer ihn realisiert hat, und ob eine Serie abgeschlossen oder noch im Gange ist. Wenn die Frage nicht zuverlässig überprüft werden kann (Titel nicht zu finden), sagt es dies klar an, anstatt eine Antwort zu erfinden.

## v1.14.31 — August 2026

### Korrektur

- **Live-Bestätigte Ursache**: Wenn du fragst, was dir an einem Schauspieler, einem Regisseur oder einem Franchise fehlt („Welchen Film von... fehlt mir?“), konnte Movviz AI trotz eines früheren Korrekturs zu dieser Art von Fehler immer noch eine falsche Antwort erfinden („Du hast keinen Pokémon-Film“). Die Anweisung allein reichte nicht aus, um dies zuverlässig zu verhindern. Für diese spezifische Formulierung führt Movviz AI nun eine echte Suche im Katalog durch und überprüft tatsächlich Titel für Titel, was bereits in deiner Bibliothek ist, anstatt zu raten.

## v1.14.30 — August 2026

### Movviz AI

- Movviz AI weiß nun, seit wann du nichts mehr gesehen hast und mit welcher Geschwindigkeit du gerade schaust (Anzahl der Aufnahmen in den letzten 7 und 30 Tagen) – ein echtes Signal, basierend auf deinen datierten Aufnahmen, für Antworten, die besser auf deine jüngste Aktivität zugeschnitten sind, anstatt nur rohe Zähler. Diese Informationen sind auch im Bereich „Was Movviz AI über dich weiß“ im Profil sichtbar.

## v1.14.29 — August 2026

### Korrektur

- **Ursache direkt bestätigt** : Der Button „Plex-Synchronisierung erzwingen“ forderte Plex zwar auf, neu zu scannen, leitete aber sofort die Movviz-Synchronisierung ein – bevor Plex mit seinem eigenen Hintergrundscan fertig war. Ergebnis: Der Button zeigte einen Erfolg an, ohne jemals die Blockierung „wartet auf Plex-Synchronisierung“ zu lösen. Korrigiert: Es wird nun ein echtes Zeitfenster eingehalten, bevor überprüft wird, mit einer zweiten automatischen Überprüfung einige Sekunden später für langsamere Bibliotheken.

## v1.14.28 — August 2026

### Movviz AI

- Wenn du den Assistenten korrigierst, weil er fälschlicherweise behauptet hat, ein Titel nicht in deiner Bibliothek zu sein, wird diese Korrektur nun gespeichert – wenn derselbe Fehler mehrmals auftritt, wird der Assistent deutlich vorsichtiger, bevor er eine Abwesenheit feststellt, anstatt denselben Fehler bei jeder Unterhaltung zu wiederholen.

## v1.14.27 — August 2026

### Movviz AI

- Der konsolidierte Kontext („Was Movviz AI über dich weiß“) wird nun bei jeder tatsächlichen Aktion aktualisiert (Film/Episode als gesehen markiert, Vote 👍/👎, Netflix-Import abgeschlossen) und nicht nur beim Öffnen des Chats – immer nur mit einem Berechnungsschritt nach dem anderen, niemals mit einer kontinuierlichen Verarbeitung.

## v1.14.26 — August 2026

### Movviz AI Korrekturen

- **Ursache direkt bestätigt** : Wenn das Sprachmodell ohne einen einzigen echten Satz antwortete (z. B. weil seine gesamte Antwort nur dazu diente, eine Information intern zu speichern), gab der Movviz-Chat ein völlig themenfremdes „In Ordnung!“ zurück – selbst angesichts eines direkten Kommentars des Benutzers oder einer echten Frage wie „was noch?“. Eine neue Überprüfung erkennt diesen Fall und fordert sofort eine echte Antwort an, bevor sie angezeigt wird, ohne dass dies sichtbar ist oder das Gespräch verlangsamt; nur als letztes Mittel erkennt eine Nachricht ehrlich die Schwierigkeit an, anstatt eines unpassenden „In Ordnung!“.
- **Ursache direkt bestätigt** : Die Frage „Was fehlt mir von [diesem Humoristen/Schauspieler/Regisseur]?“ konnte eine Liste komplett erfundener Titel erzeugen, die fälschlicherweise als in der Bibliothek überprüft dargestellt wurden („laut deiner Historie“) – bis hin zu der Behauptung, ein Titel fehle, obwohl er bereits vorhanden war. Diese Art von Frage darf nun keine Liste erfinden: Der Chat erklärt ehrlich, dass er das hier nicht zuverlässig überprüfen kann, und leitet stattdessen zur Movviz-Suche weiter, wo jeder Titel wirklich anzeigt, ob er bereits in der Bibliothek ist.

## v1.14.25 — August 2026

### Movviz AI Korrektur

- **Ursache direkt bestätigt** : Die Antwort mit einem einzigen Wort („Seb“) auf die eigene Frage „Wie heißt du?“ war nicht ausreichend – der Vorname wurde nie gespeichert, obwohl er im laufenden Gespräch normal verwendet wurde. Ergebnis: Es konnte behaupten „Du hast mir deinen Vornamen nicht genannt“, während es ihn im selben Satz verwendete. Korrigiert: Eine kurze Antwort auf die eigene Frage nach dem Vornamen wird nun korrekt erkannt und gespeichert.

## v1.14.24 — August 2026

### Movviz AI Korrekturen

- **Ursache direkt bestätigt** : Das Einfügen einer langen Liste von Titeln (z. B. kopiert aus einer Netflix-Historie) ließ die Antwort bei jeder Umformulierung fehlschlagen – die generierte Antwort überschritt die erlaubte Länge und wurde daher abgeschnitten und ungültig. Die Grenze wurde erhöht, und das Hinzufügen von mehr als 25 Titeln gleichzeitig beschränkt sich nun sauber auf die ersten 25, anstatt zu versuchen (und zu scheitern), alles auf einmal.
- Ein Titel im Format „Serie: Episodentitel“ (typisch für einen Netflix-Export, z. B. „Sakamoto Days: Der legendäre Killer“) wurde wortwörtlich gesucht und fand nie etwas – nun wird er als Serie allein erkannt, UND die genaue Episode wird gefunden und als gesehen markiert (nicht mehr nur die Serie hinzugefügt).
- Neu: Die Abfrage der Episodenliste einer Serie (auf deren Seite) gibt die echte Liste von Movviz mit dem Status „gesehen“ zurück – kein Ablehnen oder Erfinden mehr.

## v1.14.23 — August 2026

### Neu

- Ein Titel, der auf „Wartet mit Plex-Synchronisierung“ feststeckt (Datei vorhanden, aber noch nicht von Plex erkannt), bietet nun einen Button zum Erzwingen der Synchronisierung sofort (Admin), anstatt auf den nächsten automatischen Durchlauf zu warten (bis zu 5 Minuten).

## v1.14.22 — August 2026

### Korrektur: Netflix importieren

- **Ursache live bestätigt** (echter Export von 3217 Zeilen): Der Import war in einer einzigen HTTP-Anfrage enthalten, die bei einem großen Verlauf vorzeitig abgelaufen ist — jeder Titel/jede Episode erfordert eine Online-Suche, und ein Verlauf von mehreren Jahren sammelt Hunderte davon an.
- **Behoben**: Der Import läuft nun im Hintergrund auf dem Server mit einem Fortschrittsbalken direkt im Button — Sie können die Einstellungen-Seite während des Imports verlassen, er läuft weiter und zeigt seine Anzeige an, wenn Sie zurückkehren.
- Zwei Erkennungsfehler wurden bei diesem Durchgang behoben: Das Datum einer Ansicht wurde falsch interpretiert (Tag/Monat vertauscht je nach Export), und Serien, deren Titel selbst ein „:“ enthalten (z. B. Miniserie), wurden falsch aufgeteilt.

## v1.14.21 — August 2026

### Netflix

- Einstellungen → Netflix bietet nun einen direkten Link zu Ihrer Netflix-Verlaufseite (Button „Alles herunterladen“), damit Sie nicht mehr suchen müssen, wo Sie die zu importierende Datei finden.

## v1.14.20 — August 2026

### Neu: Netflix-Integration

- Einstellungen → Netflix: Importieren Sie Ihren Netflix-Verlauf (Datei von Ihrem eigenen Netflix-Konto heruntergeladen, kein Passwort erforderlich), um diese Filme und Episoden in Movviz als gesehen zu markieren — streng nur für jedes Konto gültig.
- Der Status „Gesehen“ wird nun manuell angekreuzt oder von Netflix importiert, auf Ihr verbundenes Plex-Konto übertragen (Film, Serie, Staffel, Episode) — bisher funktionierte die Synchronisierung nur in die andere Richtung (Plex nach Movviz).

## v1.14.19 — August 2026

### Korrektur

- Das Popup „Neuheiten“ zeigte manchmal nicht übersetzten Text für nicht-französische Oberflächen — die Sprachübersetzung dieses Popups wurde seit mehreren Versionen nicht mehr gewartet, ohne dass der Fallback-Mechanismus dies bemerkte. Vereinfacht: Eine einzige Wahrheitsquelle, auf Französisch, konsistent mit dem Rest des Repositoriums.

## v1.14.18 — August 2026

### Movviz AI

- Der Assistent passt sich nun dem Stil jedes Einzelnen an (direkt, vertraut, mit Humor...) anstatt einen starren Ton zu verwenden, und variiert seine Formulierungen, um niemals zu wiederholen.
- Wenn Sie nach einer gewissen Zeit von Movviz zurückkehren, kann der Assistent das Gespräch von selbst mit einer Frage zum Kino beginnen — niemals mehr als alle paar Stunden.
- Neuer Button „Kontext erstellen“ auf Ihrer Profilseite: Eine Analyse Ihrer tatsächlichen Aktivitäten (Ansichten, Anfragen, Rückmeldungen) baut ein dauerhaftes Verständnis für Ihre Vorlieben auf — den Mechanismus, der Ihnen gefällt, nicht nur das Genre — und verbessert sich weiter automatisch mit der Nutzung, ohne jemals kontinuierlich zu laufen.
- Die Empfehlungen erkennen die Franchise-Logik besser: Die nächste ungesehene Episode einer Saga wird nun priorisiert, und es können mehrere Richtungen vorgeschlagen werden (Saga fortsetzen / gleiche Energie woanders / noch extremer), anstatt nur eine einzige erzwungene Wahl.
- Neu, optional und standardmäßig deaktiviert: Websuche (nur über Mistral) um sparsam eine markante Szene eines bereits gesehenen Titels zu erwähnen — niemals Spoiler zu einer laufenden Serie, in Einstellungen aktivierbar.
- Der Assistent kann speichern, dass ein Titel gesehen wurde, indem er es Ihnen im Gespräch erzählt, ohne dass Sie über dessen Profilseite gehen müssen.
- Mehrere Verfeinerungen des Empfehlungs-Engines (gewichtetes Vertrauen basierend auf gelernten Vorlieben, leichte Ermüdung nach einer Abfolge gleicher Inhalte) und eine klare Anweisung: Niemals nach einer Umformulierung fragen, immer versuchen zu verstehen.

## v1.14.17 — August 2026

### Movviz AI

- Zwei vollständige Audits haben 7 echte Verständnisfehler gefunden und korrigiert: Die Stimmungsanalyse verglichen manchmal noch nicht mehr die Namen von Merkmalen zwischen den Analysen, eine Serie wurde bei nur einer Folge von den Empfehlungen ausgeschlossen (anstatt der ganzen Serie), ein Überschuss an internen Widersprüchen in den Gesprächsanweisungen und eine Handvoll weiterer diskreter Korrekturen bezüglich des Gedächtnisses.
- Neu: „Was Movviz AI über dich weiß“, ein Abschnitt auf deinem Profil, der klar anzeigt (niemals rohen Code) was der Assistent gespeichert hat – Fakten, Aktivitäten, geliebte oder abgelehnte Empfehlungen.

## v1.14.16 — August 2026

### Movviz AI

- Behebung eines schwerwiegenden Bugs: Eine Empfehlung, die ein Wort in Anführungszeichen zitierte, konnte anstelle von Karten als rohes JSON angezeigt werden – behoben an der Wurzel, kein Risiko mehr für Datenlecks, egal was passiert.
- Konversationen überleben nun einen Server-Neustart – nur der Papierkorb löscht sie.
- Der Beitrag und der Titel einer Empfehlung sind klickbar und öffnen das entsprechende Dossier.
- Das Hinzufügen einer Empfehlung löst nun eine echte Reaktion des Assistenten zu diesem Titel aus.
- Neue erkannten Empfehlungsmodi: „düsterer“, „weniger gewalttätig“, „schlage mir was vor“ ohne spezifische Referenz oder absichtlich unbekannt.
- Empfehlungen berücksichtigen nun deine früheren 👍/👎-Bewertungen feiner (was gefallen UND was abgelehnt wurde, nicht nur eines) und die Zugehörigkeit zu einem gleichen Franchise wie dem, was du gerade ansiehst.
- Ein klar geäußertes Bedürfnis im Moment („ich brauche jetzt etwas Leichtes“) wird nun vor deinen allgemeinen Gewohnheiten priorisiert, anstatt ignoriert zu werden.
- Der Assistent versteht Anfragen, die außerhalb der offensichtlichen Kategorie liegen („wie dieses Film, aber ohne dieses Element“), besser und stellt eine gezielte Frage, anstatt zufällig zu raten, wenn deine Anfrage wirklich mehrdeutig ist.

### Einstellungen

- Neuer Tab „Erlebnis“ (Videos zu Dossiers, Special Episodes), getrennt vom Dashboard.
- Neue Einstellung: Special Episodes zählen nicht mehr für den Status „Serie komplett gesehen“ (standardmäßig deaktiviert), und eine noch nicht veröffentlichte Staffel blockiert diesen Status auch nicht mehr.

## v1.14.15 — August 2026

### Movviz AI

- Behebung einer letzten Gedächtnis-Nuance: Der Assistent sagt nicht mehr „Ich werde das notieren“, ohne es auch tatsächlich in derselben Nachricht zu tun – entweder nutzt er direkt, was er bereits weiß, oder er sagt klar, dass er es noch nicht weiß.

## v1.14.14 — August 2026

### Movviz AI

- Neuer Papierkorb-Button direkt im Chat für einen „bereits vorhandenen“ Eintrag: Wenn es eigentlich der falsche Eintrag ist, kannst du ihn selbst mit zwei Klicks löschen, ohne den Chat zu verlassen (nur für Administratoren, wie überall in Movviz – der Assistent löscht niemals etwas von selbst).
- Dein Vorname bleibt nach Bekanntwerden fix – er fragt nicht mehr danach und ändert ihn nur, wenn du ihm explizit einen anderen gibst.
- Der Assistent kann nun seine Sätze natürlicher nach deinem Vornamen anpassen, mit Vorsicht und ohne jemals zu insistieren, wenn der Kontext etwas anderes nahelegt.

## v1.14.13 — August 2026

### Movviz AI

- Behebung eines Bugs, bei dem der Assistent bei sprachlichen Falschfreunden das falsche Film hinzufügen konnte (z. B. fügte „un homme un vrai“ einen unzusammenhängenden spanischen Film hinzu) – er überprüft nun die wahre Ähnlichkeit des Titels, bevor er etwas hinzufügt, und zieht es vor, „nicht zu finden“ zu sagen, als einen falschen Film zu nennen.

## v1.14.12 — August 2026

### Film-/Seriendossiers

- Entfernt das Jahresdopplung neben dem Titel — das Jahr wird weiterhin nur einmal neben der Dauer angezeigt.

## v1.14.11 — August 2026

### Movviz AI

- Neue Quell-Vorschläge: Neben seinen eigenen Ideen bezieht Movviz AI nun auch Empfehlungen von TMDb für den Titel, den du ansiehst — beide Quellen durchlaufen dieselbe finale Filterung (Qualität, Stimmung, Verlauf, Bewertungen).
- Empfehlungen werden nicht mehr als ein stummer Kartenblock angezeigt: Jeder Vorschlag wird nun mit einem kleinen, unterschiedlichen Satz eingeleitet („Hey, ich glaube, das könnte dir gefallen“, „Oder es gibt auch das...“), um ein echtes Gesprächsgefühl statt einer rohen Liste zu vermitteln.

## v1.14.10 — August 2026

### Movviz AI

- Der Humor des Assistenten passt sich nun jedem Genre an (nicht nur Horror) und wiederholt niemals denselben Witz zweimal.
- Anekdoten sind nun immer kurz — ein natürlich eingebauter Satz, niemals ein ganzer Absatz.

## v1.14.9 — August 2026

### Movviz AI

- Behebung eines Hintergrund-Bugs: Ein im Gespräch genanntes Vorname ging bei einem „Gespräch löschen“ verloren — ein Rechenfehler ließ die Erkennung des ersten Gesprächs nie korrekt auslösen.
- Der Vorname eines Benutzers wird nun auch direkt auf Code-Ebene erfasst (mehrere erkannten Formulierungen), ohne sich nur auf die gute Nachsicht des Sprachmodells verlassen zu müssen.
- Behebung eines Anzeigalecks, bei dem ein interner technischer Text in einer Antwort sichtbar werden konnte, und eines Falls, in dem der Assistent das Fehlen von Informationen wie eine Erinnerung vermerkte.
- Movviz AI fragt nun explizit nach dem Vornamen beim ersten Gespräch, falls du ihn nicht genannt hast, und fragt natürlich nach, bis er ihn kennt.
- Es vermeidet es nun, bei jeder Nachricht dieselbe Einstiegsfrage zu stellen.

## v1.14.8 — August 2026

### Movviz AI

- Das „Ich erinnere mich an dich“-Panel wurde aus dem Chat entfernt.
- Behebung eines Bugs, bei dem der Assistent anstelle einer echten Antwort nur Auslassungspunkte antwortete — insbesondere wenn du auf eine bereits vorgeschlagene Empfehlung (eine Frage, einen Witz) reagiertest, anstatt danach zu fragen.
- Der Assistent behauptet nicht mehr, etwas gespeichert zu haben, das er in Wirklichkeit nie erhalten hat (z. B. deinen Vornamen, bevor du ihn genannt hast).

## v1.14.7 — August 2026

### Movviz AI

- Bei einer vagen oder allgemeinen Anfrage („etwas für eine Frau“, „ein Film für die ganze Familie“...) basiert Movviz AI nun explizit auf der tatsächlichen Erfahrung der fragenden Person (ihre eigenen Ansichten, ihre eigenen Wünsche — niemals die eines anderen Haushaltskontos) und nicht auf einem allgemeinen Klischee; bei fehlendem nutzbarem Hinweis stellt es eine Frage, anstatt zufällig zu raten.

## v1.14.6 — August 2026

### Movviz AI

- Neuer „Überrasche mich“-Modus: Bitte explizit um Überraschung oder darum, aus der Routine auszubrechen, und der Assistent bevorzugt Titel, die zu deinem Geschmack passen, aber bewusst vom offensichtlichen Wahl sind — und erklärt dir, warum.
- Der Assistent nuanciert nun seine Empfehlungen: Er unterscheidet zwischen dem, was er sicher weiß, und dem, was eher explorativ ist, anstatt jeden Vorschlag als Gewissheit darzustellen.

## v1.14.5 — August 2026

### Einstellungen

- Movviz AI „Speichern“-Button oben auf dem Panel dupliziert: Nach Aktivierung der KI oder Einfügen eines API-Schlüssels muss nicht mehr die gesamte Liste der Anbieter durchgescrollt werden, um zu speichern.

### Movviz AI

- Korrektur: Das Chat-Nachrichtenfeld kürzte den Beispieltext (Platzhalter) anstatt ihn vollständig über zwei Zeilen anzuzeigen.

## v1.14.4 — August 2026

### Movviz AI

- Neuer Mood-Motor: Wenn du eine Empfehlung aus einem Eintrag anforderst, analysiert Movviz den tiefen Ton des Referenztitels und jedes Kandidaten (Humor, Energie, Tonart...) voneinander, um die Vorschläge nach der tatsächlichen Stimmungsnähe zu ordnen, nicht nur nach dem TMDb-Genre.
- Erstes Gespräch mit dem Assistenten: Er stellt sich vor und stellt bis zu 3 kleine Fragen (Vorname, was du gerade gerne schaust...) um dich kennenzulernen – nie mehr, niemals ein Formular.
- Ausgeprägte Persönlichkeit: Immer froh, dich wiederzusehen, mit einem gut platzierten Hauch von Humor (z. B. ein Horrorfilm) und manchmal einer Anekdote zu einem Titel – immer vorsichtig formuliert, niemals als absolute Gewissheit präsentiert.
- Permanenter Schutzmechanismus: Der Assistent kann und wird niemals etwas in Movviz löschen, egal wie wir ihn dazu auffordern.

## v1.14.3 — August 2026

### Entdeckung

- Korrektur des Hintergrunds: Die Reihe „Plattformen“ verwendete eine ungefähre Namensübereinstimmung im TMDb-Katalog, die einen obskuren Dienst anstelle des richtigen anknüpfen konnte (z. B. ein unbekanntes Add-on anstelle des erwarteten Dienstes). Ersetzt durch eine feste und geprüfte Liste der 10 am häufigsten in Frankreich genutzten Plattformen mit deren echten Logos in besserer Qualität.
- Entfernung der Reihe „Sender“, die mit „Plattformen“ doppelt war (gleiche Marken, aber schlechter: beschränkt auf Serien).
- Auf Mobilgeräten wechseln die Plattform-/Studio-Kacheln von großen rechteckigen Formaten, die für den Desktop konzipiert waren, zu runden und kompakten Icons.

### Movviz AI

- Der Assistent speichert nun die Fakten, die du ihm im Gespräch gibst (Vorname, explizite Präferenz...) von einer Sitzung zur nächsten, zusätzlich zu seinen bereits vorhandenen Erinnerungen (hinzugefügte Titel, akzeptierte Empfehlungen).
- Neues 👍/👎-Feedback zu jeder Empfehlung – dient als Grundlage für eine relevantere Sortierung zukünftiger Vorschläge.
- Das Modell schlägt nun mehr Kandidaten im Hintergrund vor; Movviz filtert und sortiert diese selbst (Qualität, Neuheit, früheres Feedback, bereits angefordert), bevor es nur die besten anzeigt – und schließt ab sofort und einfach jeden Titel, der bereits vollständig gesehen wurde.

## v1.14.2 — August 2026

### Entdeckung

- Die Streaming-Plattformfilter (Prime Video, Netflix, Disney+ usw.) sind jetzt echte von TMDb anerkannte Plattformen, gültig für Filme UND Serien – kein zusätzlicher API-Schlüssel erforderlich.
- Korrektur: Das Auswählen einer Plattform sprang immer noch zu „Serien“ über, selbst wenn man sich auf „Filme“ befand, und das Zurückwechseln auf „Filme“ löschte den Plattformfilter beim Zurückkehren zum Dashboard. Der Filter bleibt nun aktiv, unabhängig vom durchsuchten Typ.
- Neue Reihe „Plattformen“ auf der Entdeckungsseite.

### Movviz AI

- Korrektur: Der Assistent verwechselte die Anzahl der vom Benutzer gesehenen Filme mit der Gesamtzahl der Filme in der Bibliothek und gab falsche Antworten zur Größe der Sammlung.

### Zuverlässigkeit

- Korrektur eines zufälligen Absturzes des Dashboard-Karussells (Hero) und der Hintergrundvideo-Karten: Zwei verschachtelte Übergangsanimationen konnten miteinander in Konflikt geraten, um dieselben Elemente gleichzeitig von der Seite zu entfernen, was gelegentlich zu einem allgemeinen Anwendungsfehler führte.

## v1.14.1 — August 2026

### Movviz AI

- Korrektur: Der Chat-Button erschien erst nach einem vollständigen Neuladen der Seite, nachdem Movviz AI in Einstellungen aktiviert wurde — er erscheint jetzt sofort.
- Neues Protokoll (Einstellungen → Movviz AI, Admin): Verlauf der letzten Chat-Aufrufe mit verwendetem Anbieter, Erfolg/Misserfolg, Latenz — um zu verstehen, was passiert ist, ohne raten zu müssen.
- Jeder Anbieter zeigt nun direkt in den Einstellungen an, wo man einen kostenlosen API-Schlüssel erhält.
- Erweiterte Erkennung ungültiger Quoten/Schlüssel (403 zusätzlich zu 429) für einen zuverlässigeren Wechsel zwischen Schlüsseln desselben Anbieters.
- Neuer, vollständig optionaler Schritt zum Aktivieren von Movviz AI und Hinzufügen eines Schlüssels bei der ersten Movviz-Konfiguration.
- Der Hintergrund und das benutzerdefinierte Logo einer Karte berücksichtigen nun die Sprache der Benutzeroberfläche (deutsches Logo, falls für einen deutschen Benutzer verfügbar, etc.) und nicht nur die einfache Popularität.
- Das Logo wird nun auch im Hero-Karussell des Dashboards angezeigt, nicht nur auf der Karte.

### Zuverlässigkeit und Bestätigungen

- Entfernen einer Karte (Papierkorb-Button) und endgültiges Löschen aus dem Papierkorb: Es wird nun immer eine Bestätigung abgefragt, kein versehentliches Löschen mehr mit einem Klick.
- Beschleunigte Plex-Synchronisierung nach einem Download: Movviz löst seine eigene Synchronisierung einige Sekunden nach einem Import aus, anstatt bis zu 5 Minuten zu warten.
- Korrektur des Vollbildmodus: Der Player-Container hatte inaktive CSS-Layout-Klassen (nicht gespeicherte Variante), die durch eine zuverlässige Logik ersetzt wurden.
- Kartenbild-Editor zusammengefasst mit „Karte bearbeiten“ (ein einziger Stift-Button) — die Bildpersonalisierung bleibt für jeden Benutzer offen, die strukturellen Einstellungen bleiben für Admins reserviert.
- YouTube-Untertitel sind auf Hintergrundvideos (Karten und Karussell) nun korrekt deaktiviert.

## v1.14.0 — August 2026

### Movviz AI — Intelligente Chatbox (neu)

- Neuer Gesprächsassistent (schwebende Blase, standardmäßig deaktiviert): Versteht Anfragen in natürlicher Sprache, fügt Filme/Serien zur Bibliothek hinzu, gibt Empfehlungen im gleichen Tonfall („Nach Scary Movie, Naked Gun vorschlagen“ statt einem zufälligen Comedy), beantwortet häufige Fragen.
- Multi-Anbieter (Mistral, OpenRouter, Gemini) mit mehreren Schlüsseln pro Anbieter, automatisches Rotieren bei Erreichen der Quote und Wechsel zum nächsten Anbieter bei Bedarf — konfigurierbar in Einstellungen (Admin).
- Benutzer-Speicher: Der Assistent erinnert sich an hinzugefügte Titel und akzeptierte Empfehlungen und kennt eine quantifizierte Zusammenfassung der Aktivität (gesehene Filme/Serien/Episoden, Anfragen, meistgesehene Serien) — streng isoliert pro Konto, niemals zwischen Benutzern vermischt.
- Ruft das Sprachmodell niemals ohne ausdrückliche Benutzeranfrage auf: Keine Hintergrundanalyse, keine Auswirkung auf den normalen Betrieb von Movviz, wenn die KI deaktiviert bleibt.

### Erweiterte „Gesehen“-Verfolgung

- Film-/Serienkarten und Episoden zeigen nun ein datiertes Protokoll („gesehen gestern“, „vor 3 Tagen“ …), das Plex und das direkte Abspielen von Movviz kombiniert.
- Neuer manueller Button „Als gesehen / Nicht gesehen markieren“ für Filme, Staffeln und Episoden — ergänzt Plex für alles, was anderswo angesehen wurde.

### Film-/Serienkarten

- Überarbeiteter Wiedergabe-Button: Wenn eine Wiedergabe läuft, schlägt die Karte direkt „Fortsetzen bei HH:MM:SS“ (mit sichtbarem Fortschritt) anstelle eines allgemeinen „Abspielen“-Buttons vor — die Wahl zwischen „fortsetzen oder neu starten“ wird beim Öffnen des Players immer angeboten.
- Neue Einstellung (Einstellungen → Erlebnis), um den animierten Trailer im Hintergrund auf Karten zu deaktivieren und ein statisches Bild zu behalten.
- Der Hintergrund und das Logo eines Eintrags können nun angepasst werden: Ein neuer Button öffnet einen Auswahldialog für alternative Bilder von TMDb (jeder Benutzer kann anpassen, wie bei Tags).

### Warteschlange

- Neuer Status „Ausstehend“ und „Überprüfung“ in der Download-Verfolgung, um einen veralteten Suchlauf von einem laufenden Kontrollimport besser zu unterscheiden.

### Zuverlässigkeit

- Behebung eines Build-Konfigurationsbugs, der auf einer Entwicklungsmaschine die Kompilierausgabe übermäßig aufblähen konnte – ohne Auswirkungen auf Docker-Images/den Windows-Installer.

## v1.13.92 — August 2026

### Manueller Download: Die Regel der verbotenen Wörter gilt nicht mehr

- **Ursache**: Die Überprüfung „verbotenes Wort“ nach dem Download (`checkPostImportBlockedWord`) wurde auf ALLE Imports angewendet, einschließlich manuell vom Benutzer gestarteter. Ein manueller Download, dessen Name ein verbotenes Wort enthielt (z. B. VOSTFR), wurde gelöscht und die Bibliothek auf „fehlend“ gesetzt, anstatt umbenannt/verschoben zu werden.
- **Korrektur**: Ein manueller Grab (Suchseite, Filmdetailseite, „Version hinzufügen“-Panel) markiert nun seinen infoHash als manuell (`manualGrab.ts`, TTL-Speicher 6 Std.), sobald die Engine ihn akzeptiert. Beim Import ist dieser Torrent von der Überprüfung auf verbotene Wörter ausgenommen: Er wird normal umbenannt, verschoben und importiert. Nur automatische Grabs behalten die Regel.
- Erstmalige automatische Akquisition, Serien, Episoden: Verhalten unverändert.

## v1.13.91 — August 2026

### „Nach Qualität aktualisieren“ erstellt keine Duplikate mehr (2) (3) (4)

- **Ursache**: Die Entscheidung „bestehende Video ersetzen“ wurde nur vom „Version hinzufügen“-Stream (LOT6) markiert. Alle anderen Grab-Pfade für einen bereits verfügbaren Film – das Lupen-Button auf der Detailseite (Qualitätssuche), automatisiertes Upgrade nach 6 Std., upgrade-candidates, manuelle Suche – markierten keine Absicht: Die Engine benannte die neue Datei mit einem Kollisionssuffix „(2)“/„(3)“ um, sobald der endgültige Name vom alten, nie gelöschten File belegt war.
- **Korrektur**: Jede neu gegrabte Version für einen bereits verfügbaren Film (`movie.file`) markiert nun eine „ersetzen“-Absicht auf dem infoHash vor dem Grab (`autoGrab`, `searchAndReplace`, Grab-Route mit manueller Suche). Beim Import wird die alte primäre Datei vom Laufwerk gelöscht (Sicherheitsvorkehrungen: validiertes Engine-Root, Tiefe ≥ 2, bereinigter Name, nicht-rekursives Unlink), und die neue Datei wird dann auf ihren endgültigen Namen umbenannt – kein „(n)“-Duplikat mehr in Plex.
- Erstmalige Akquisition, Serien und Episoden: Verhalten unverändert.

## v1.13.90 — August 2026

### „Minimales Jahr der Karussells“ endlich überall respektiert

- **Ursache**: Die Einstellung `minYear` (Einstellungen → Dashboard-Erlebnis) wurde nur für die Reihen „Entdecken“ und „Für dich empfohlen“ des Dashboards angewendet – das Kino-Hero, „Kürzlich hinzugefügt“, „Demnächst“, die Upgrades und die GESAMTE Entdecken-Seite (Karussells + „Alles anzeigen“) ignorierten den Filter: Ein Film aus 1931 konnte trotz einer Begrenzung auf 1985 erscheinen.
- **Korrektur**: Der Filter wird nun überall einheitlich angewendet:
  - Kino-Hero: `buildHeroSlides` erhält `minYear` und schließt keine vor diesem Datum veröffentlichten Slides ein.
  - Dashboard: Alle Reihen (Entdecken, Empfohlen, Kürzlich hinzugefügt, Demnächst, Upgrades) durchlaufen denselben Filter.
  - Entdecken: TMDb-Karussells + C411-Reihen + „Alles anzeigen“-Seiten gefiltert; eine explizite Suche (oder ein manueller Jahresfilter) bleibt ungefiltert.

## v1.13.89 — August 2026

### Nie wieder „removeChild“-Crash (globaler Anzeigefehler)

- **Ursache**: `NotFoundError: Failed to execute 'removeChild' on 'Node'` leitete die gesamte App in den globalen Fehlerbildschirm um. Der Auslöser: Das geöffnete Benutzermenü (dropdown framer-motion/AnimatePresence) beim Klick auf „Abmelden“ – die Navigation zu `/login` dekonstruierte das Shell, während die Schließanimation noch lief, und framer-motion/React stritten sich um denselben DOM-Knoten während der Commit-Phase.
- **Korrektur 1 (Ursache)**: `UserMenu.logout` schließt das Dropdown sofort und lässt seine Exit-Animation ablaufen (~300 ms) bevor der Logout-Fetch und die Navigation erfolgen – das Shell wird nie mehr mit einer laufenden Animation abgebaut.
- **Korrektur 2 (Falle)**: Neuer `AppErrorBoundary` (React error boundary) um den gesamten AppShell-Baum – ein Commit-Fehler (konkurrierende externe DOM-Manipulation: hls.js/dash.js/YouTube während eines Unmounts) kann die Sitzung nicht mehr im globalen Fehler standardmäßig beenden: Wiederherstellungsbildschirm + sauberes Wiederherstellen über „Erneut versuchen“.
- Getestet in Edge headless: Login → Logout mit geöffnetem Dropdown → Weiterleitung zu `/login` ohne jegliche Konsolenfehler.

## v1.13.88 — August 2026

### Logout: Die Weiterleitung zu /login funktioniert endlich

- **Ursache**: In `UserMenu.logout` wurde `router.refresh()` unmittelbar nach `router.push("/login")` aufgerufen. Ein Refresh, der direkt nach einer Navigation zu einer anderen Seite gesendet wird, annulliert die laufende Navigation (es synchronisiert die aktuelle Seite neu) – der RSC-Aufruf für `/login` wurde gesendet, gab einen 200 zurück, aber die URL änderte sich nie. Reproduziert in Edge headless: Das Sitzungs-Cookie wurde korrekt gelöscht, der Zurück-Button funktioniert, aber der Benutzer blieb auf dem Dashboard, bis er manuell neu geladen wurde.
- **Korrektur**: Kein `router.refresh()` mehr nach dem Push bei den 3 Logout-Navigationspfaden (`UserMenu.logout`, `PendingApprovalScreen.logout` und dem Factory Reset von `AboutPanel` – gleiches Muster, gleiches Risiko). Die Login-Seite validiert `/api/auth/me` beim Mounten bereits selbst, der Refresh war unnötig.
- **Bonus**: `destroySession()` verglich das vollständige Cookie (`raw.sig`) mit den gespeicherten Sitzungen (`raw`) – die Sitzung wurde nie wirklich aus `sessions.json` gelöscht (sie veraltete bis zum Ablauf). Es extrahiert nun das `raw` wie `resolveSession()`.
- Fotos der Akteure in abgerundeten Quadraten (konsistent mit den Plakaten, anstatt Kreisen).

## v1.13.87 — August 2026

### „Suchen und Ersetzen“: Codec-Ersetzungen (x264 → x265/AV1) endlich vorgeschlagen

- **Ursache**: Die Upgrades von Codecs und benutzerdefinierten Formaten wurden nur im RSS-Cache (~50-150 der neuesten Veröffentlichungen) gesucht – nur das Sprach-Upgrade löste eine direkte Suche bei den Indexierern aus. Da der Cache fast nie das gesamte Verzeichnis abdeckte (710 Filme in x264, obwohl x265/AV1 bevorzugt werden, festgestellt an echten Daten), zeigte das Panel „Kein Ersatz vorgeschlagen“ an, obwohl bessere Versionen existierten – und der Button „Ersetzen“ eine fand.
- **Korrektur**: Film- und Episodenscans replizieren nun den Fallback von Grab – wenn der Cache keinen Kandidaten enthält und der Film/die Episode durch den Codec-Score gewinnen kann (Score niedriger als der beste konfigurierte Codec), wird eine direkte, begrenzte Suche (25 pro Durchlauf, gleiches Budget wie der Sprach-Fallback) bei den nicht rate-limitierten Indexierern gestartet. Episoden gewinnen nun auch Upgrades durch den Codec-Score (bisher nur Filmen vorbehalten), ohne dass `preferredVideoCodec` erforderlich ist.
- Der Button „Ersetzen“ ist unverändert: Er führt seine eigene direkte Suche durch, wie zuvor.

## v1.13.86 — August 2026

### Klick-Priorität: Jetzt garantiert auf Client-Seite

- **Ursache**: Die Aktivitätsmarkierung beim erneuten Rendern des Server-Layouts deckte keine Client-Navigationen ab – der App Router rendert Layouts nicht bei jeder Navigation neu (sie verlassen den Router-Cache). Ein Klick auf einen Link blieb daher für den Hintergrund unsichtbar, der seine Kontrolle während des Seitenladens nicht abgab.
- **Korrektur**: Eine neue Client-Komponente (UserActivityPing) lauscht auf jeden echten Klick (pointerdown in Capture-Phase, limitiert auf ~1/s, Keepalive) und sendet einen POST-Ping an `/api/activity/ping`, der die Aktivität im Serverprozess markiert. Der Hintergrund gibt nun sofort nach dem Klick nach, unabhängig vom Navigationspfad – Klicks, Seitenladungen und Suchen bleiben während Scans, Bulk-Verarbeitung und Downloads priorisiert.

### Neu-Download: Die alte Version wird tatsächlich ersetzt

- **Ursache** : Die Wiedergabe wird über Plex aufgelöst (ratingKey → primäre Version des Films). Nach einem erneuten Herunterladen blieb die alte Datei auf der Festplatte erhalten → Plex behielt zwei Versionen desselben Films und spielte immer noch die ALTE ab (live beobachtet: Alita in SBS, nicht-SBS-Version heruntergeladen, Wiedergabe immer noch in SBS).
- **Korrektur** : Jeder Ersatzimport (manuelle Auswahl, Qualitäts-Upgrade) löscht die alte Datei von der Festplatte, sobald eine primäre Datei existierte — außer bei expliziter Auswahl „Als zusätzliche Version hinzufügen“. Löschung beibehalten (niemals die importierte Datei selbst, niemals außerhalb des Bibliotheks-Rootverzeichnisses); Plex scannt anschließend neu und sieht nur noch eine Version: die Wiedergabe nutzt die neue.

### Werksreset — kein Config-Ordner mehr, Rückkehr zum Assistenten

- **Problem** : Das Löschen des Config-Ordners „on the fly“ war nutzlos — der laufende Server regeneriert die Dateien aus seinem Speicher (globalThis-Cache, zusammengefasste Schreibvorgänge 300 ms) und die Sitzungs-Cookie bleiben gültig; die App zeigte weiterhin normal an, ohne Assistenten.
- **Korrektur 1 — automatische Erkennung** : Wenn kein Konto mehr existiert (Config-Ordner gelöscht), leitet die AppShell automatisch zum Assistenten (`/setup`) weiter, anstatt eine defekte App anzuzeigen.
- **Korrektur 2 — Button „Vollständiger Reset“** in Einstellungen → Über (Admin) : Leert alle Speicher-Caches des Servers, löscht den Config-Ordner (Löschung bestätigt: absoluter Pfad + Tiefe), löscht das Sitzungs-Cookie und öffnet beim Neuladen den Assistenten.

## v1.13.85 — August 2026

### Korrektur: Die Begrenzung von 10 Karten betrifft nur die Rangliste „Trend“

- **Problem-Erinnerung** : Nur die Rangliste „Movviz Trends“ (die mit den Top-10-Zahlen) zeigte mehr als 10 Karten — die anderen Ranglisten funktionierten mit ihrer ursprünglichen Länge perfekt.
- **Angepasste Korrektur v1.13.84** : Die Begrenzung von 10 Karten ist auf die einzige fusionierte Trend-Rangliste (Trends ∪ Beliebt) beschränkt, und zwar an der Quelle. Alle anderen Ranglisten — Empfohlen für dich, Neuheiten, Kids usw. — behalten exakt ihre ursprüngliche Länge bei; es gibt keine Anzeigeregression bei den nicht betroffenen Ranglisten.

## v1.13.84 — August 2026

### Rangliste „Movviz Trends“: Immer noch maximal 10 Karten

- **Ursache** : Die fusionierte Rangliste „Trends ∪ Beliebt“ war nicht begrenzt — im Gegensatz zur einfachen „Trends“-Rangliste (max. 10) — und das Dashboard zeigte die vollständige Liste (bis zu ~40 Karten), sobald die Fusion 10 überstieg. Ergebnis: Überladene Ranglisten mit Karten ohne Reihenzuordnung, schweres Laden und problematische Anzeige (besonders auf Mac ARM beobachtet).
- **Korrektur** : Alle Ranglisten von `/api/metadata/rows` sind nun auf 10 Karten begrenzt (gleiche Regel wie „Trends“), und das Dashboard wendet auch die Begrenzung als Sicherheitsgurt an. Der Button „Alle anzeigen“ öffnet immer noch die vollständige paginierte Version.

## v1.13.83 — August 2026

### Absolute Priorität für Klicks und Seitenladen

- **Navigation und Laden kennzeichnen jetzt die Benutzeraktivität** : Das Root-Layout (Server-Neurendering bei jeder App Router-Navigation) kennzeichnet die Aktivität, sobald eine Sitzung vorhanden ist — vorher blieb eine reine Navigation (ohne API-Aufruf im Hintergrund) für das Prioritätssystem unsichtbar, und der Hintergrund gab während des Seitenladens nicht ab. Jeder Link-Klick lässt daher den Hintergrund sofort abgeben (yieldToUser), der nach 4 s nach der letzten Interaktion wieder einsetzt.
- **Die Plex-Synchronisierung gibt nun die Kontrolle ab** : Dies war der letzte große Verbraucher ohne Übergabe — seine Schleifen (Filme, Serien, Abschnitte) führten Hunderte sequenzieller Plex/TMDb-Abrufe durch, ohne jemals zu unterbrechen, während Sie klickten. `yieldToUser("sync Plex films/séries")` wird nun bei jedem Element und bei jedem Abschnitt aufgerufen; eine Navigation pausiert es für bis zu 30 s, bevor es fortfährt.
- **Manuelle begrenzte Suchen**: Die Live-Suche (Fallback-Indexer) startete `Promise.all` für alle Indekser ohne jegliche Begrenzung — 3 Tabs + ein Bulk-Vorgang = Dutzende geöffnete Sockets, und der gesamte Server (einschließlich Klicks) verlangsamte sich. Ein globaler Semaphore begrenzt auf **2 gleichzeitige direkte Suchen** (die nächste wartet auf einen Slot ≤ 15 s und geht dann trotzdem): Das Seitenladen bleibt während der Spitzen flüssig.
- **Erinnerung**: Der Rest des Mechanismus war bereits vorhanden — Lanes (`runBackground`), Indexer-Rate-Limit mit garantiertem Benutzer-Puffer (5 Slots/Host + 10 global), Job-Warteschlange mit 10-Minuten-Watchdog und reduzierte Konkurrenz während Downloads.

## v1.13.82 — August 2026

### Diagnose-Logs für Untertitel (ffmpeg-Modus)

- Der Start des Remux protokolliert die hinzugefügte WebVTT-Ausgabe (`[remux] WebVTT-Ausgabe piste=0:s:N`); die Untertitel-Route protokolliert den durchlaufenen Pfad bei jeder Anfrage (`[subtitle] FAST PATH fichier=...` vs. `[subtitle] keine Live-Sitzung — dedizierte Extraktion`). Ermöglicht die sofortige Entscheidung in `docker logs`, falls der Instant-Player verwendet wird.

## v1.13.81 — August 2026

### Untertitel im ffmpeg-Modus: nahezu instantan (0,5 s statt ~1 min)

- **Neuer Fast Path**: Der Remux-Prozess (der die Datei bereits zum Erstellen des Videos liest) schreibt **auch** die Text-Untertitelspur als WebVTT in eine temporäre Datei, als sekundäre Ausgabe — im Takt der Filmwiedergabe, ohne zusätzliche Festplatten-/Netzwerklesvorgänge. Die Untertitel-Route verfolgt diese Datei und streamt die Zeitstempel an den Player: **Der erste Zeitstempel kommt in ~0,4 s** (lokal reproduziert), anstatt zu warten, bis eine separate Extraktion die gesamte Datei von vorne liest (~1 min auf NAS).
- **Automatischer Sitzungswechsel**: Beim Springen, bei Qualitäts- oder Audiowechsel startet der Remux mit einer neuen temporären Datei neu — der Untertitel-Stream wechselt automatisch darauf (identische absolute Zeiten, keine Lücken in den Zeitstempeln), ohne Unterbrechung für den Player. Bei Pause folgt die Extraktion dem Video (Backpressure) und setzt automatisch fort.
- **Fallback beibehalten**: Nicht vor-extrahierte Textspur (andere Sprache als die Standardspur) → dedizierte ffmpeg-Extraktion wie zuvor; Bildspuren (PGS/VobSub) → unveränderter Plex-Transcode-Fallback (HLS).
- **Sicherheit**: Temporäre WebVTT-Dateien werden bei Beendigung der Sitzung gelöscht (zielgerichtetes Unlink, Name nur im System-Temp-Verzeichnis eingeschränkt — niemals rekursives Löschen).

## v1.13.80 — August 2026

### Untertitel im ffmpeg-Modus: 2. Wurzel-Bug — Der Parser verstand das ffmpeg-Format nicht

- **Behoben**: Die Untertitel blieben auch nach dem Double-Cancel-Fix unsichtbar — Ursache bestätigt durch lokale Reproduktion der Extraktion: Der WebVTT-Muxer von ffmpeg schreibt die Zeitstempelzeilen in `MM:SS.mmm`, wenn die Stunden 0 sind (Film < 1 Std. → **kein** geparster Zeitstempel; Film > 1 Std. → nur Zeitstempel nach der ersten Stunde). Der Parser erforderte `HH:MM:SS.mmm`: Stunden sind nun optional in der Regex, beide Formate werden akzeptiert und die Zeiten bleiben korrekt (0h36m12s → 2172s).
- **Durch Reproduktion verifiziert**: Test-MKV-Datei mit 3 Zeitstempeln (1s, 5.5s, 1h02m) → alte Regex: 1 von 3; neue Regex: 3 von 3, exakte Sekunden.

## v1.13.79 — August 2026

### Untertitel im ffmpeg-Modus: Wurzel-Bug behoben (sie wurden nie geladen)

- **Behoben**: Im ffmpeg-Modus wurden die Text-Untertitel (SRT/ASS/SSA/WebVTT) nie angezeigt — Ursache bestätigt live: Beim Laden einer Spur sagte die Bereinigungsfunktion das Untertitel-Fetch ab, das gerade gestartet wurde (doppeltes `abort()` am selben AbortController), und der Fehlerbehandler betrachtete diese freiwillige Abmeldung als normalen Fall → stiller Rückgang, kein Fallback, keine Meldung. Die Spuren werden nun geladen, ohne sabotiert zu werden: Lokale WebVTT-Extraktion (Plex-Methode: Untertitel separat geliefert und vom Client gerendert, niemals in das Video eingebettet), Rendering über das native `<track>`-Tag, reale Filmzeiten (`seekBase` bei jedem Springen neu berechnet).
- **Verbessert**: Der Track wird **sofort** beim Laden des Tracks erstellt — Untertitel erscheinen kontinuierlich mit dem Eintreffen der Extraktionspakete, anstatt auf das Ende der gesamten Wiedergabe zu warten (lang auf NAS, ffmpeg liest den gesamten Film, um den Track zu extrahieren).
- **Erinnerung**: Bildspuren (PGS/VobSub, nicht in Text konvertierbar) → automatischer Wechsel zu Plex Transcode (HLS) wie zuvor.

## v1.13.78 — August 2026

### Vollbild: Movviz-Steuerelemente behalten die Kontrolle

- **Korrigiert**: Der Vollbild-Button gab das `<video>` allein in nativen Vollbild aus → der Browser erzwingte seine eigenen Steuerelemente, die die Zeit des **Streams** (Start bei 0, relativ zum Suchen) anstelle der tatsächlichen Filmposition anzeigten, und deren natives Suchen lädt die Serversitzung nicht neu — die Meldung „Pufferzeit anstelle des Films, kann nicht fortgeschritten werden“ wurde im Vollbild angezeigt. Das Vollbild gilt nun für den **Player-Container**: Unsere Steuerelemente (Fortschrittsbalken mit `seekBase + currentTime`, Menüs, Header, Doppeltipp, Gesten) bleiben sichtbar und funktionsfähig, mit einem schwarzen Kino-Hintergrund. iPhone bleibt im nativen Vollbild des `<video>` (Die Fullscreen API existiert nicht auf einem iOS-Container — Browser-Limit, unvermeidlich).

## v1.13.77 — August 2026

### Optimierter Video-Transcode für NAS + Server-Crash behoben

- **Optimiert — lokaler Video-Transcode für NAS konzipiert**: Der Encoder wechselt von `veryfast` zu **`ultrafast` + `zerolatency`** (Frames werden sofort nach der Kodierung geliefert, kein Lookahead) — auf einem ARM/SoC NAS kommt der erste Puffer etwa 2× schneller an und die Wiederaufnahme nach dem Neupuffern beginnt sofort. Der **GOP wird auf 2 s verkürzt** (`g 48`): Ein Suchen oder eine Qualitätsänderung synchronisiert in weniger als 2 s neu, anstatt auf einen zufällig gezogenen Keyframe zu warten (oft 10 s+ — das verursachte „Video-Transcode ruckelt“). Profil `main` für garantierte Hardware-Dekodierung auf allen Clients. Die konstanten Bitraten (10/6,5/4/2,2 Mb/s) bleiben erhalten — die Qualität bleibt korrekt, es ist die Latenz, die sinkt.
- **Korrigiert — Server-Crash „Invalid state: Controller is already closed“**: Wenn der Client eine Video-Transcode-Sitzung verließ (Suchen, Qualitätsänderung, Player-Schließen), konnte das Rennen zwischen der asynchronen Verbreitung des HTTP-Abbruchs und dem Stopp von ffmpeg einen Stream zerstören, dessen Web-Controller bereits geschlossen war → eine nicht abgefangene Ausnahme, die den Serverprozess beendete (503 allgemein). Verlassene Streams werden nun beim Abbruch der Anfrage markiert und werden nie mehr mit einem Fehler zerstört; der Fehler wird für echte Kodierungsfehler weitergegeben (HLS-Fallback intakt).

## v1.13.76 — August 2026

### Smartphone: Player auf Netflix-Niveau, Option „Mindestjahr“ für Karussells

- **Neu — Einstellungen → Dashboard → Hero → Mindestjahr der Karussells**: Wählen Sie das Jahr aus, ab dem Filme in den Karussells „Entdeckung“ und „Für dich empfohlen“ angezeigt werden sollen — Schluss mit Vieh von 1955. Standardmäßig „Alle Jahre“, keine Bibliotheksänderung, nur Filterung bei der Anzeige.
- **Neu — Smartphone-Player (375px/768px)**: Doppeltipp links/rechts auf das Video = schnelles Zurück-/Vorblättern von ±10 s mit haptischem Feedback und Toast (wie Netflix), einfacher Tippvorgang zeigt die Steuerelemente an, ohne jemals die Wiedergabe zu unterbrechen, der Steuerbalken läuft nicht mehr über (Transcode-/Live-Play-Buttons auf Tablet+ eingeklappt, Lautstärke für Desktop reserviert, wo der Cursor beim Überfahren erscheint).
- **Korrigiert — iPhone**: Vollbild-Button funktionsfähig (webkitEnterFullscreen), Beachtung der Sicherheitsbereiche (Notch und Home-Leiste), vergrößerte Touch-Fläche des Sliders (32px), kein störendes elastisches Zurückfedern mehr.
- **Korrigiert — Hellmodus**: Header-Buttons, Status-Badges und Player-Menüs sind nun erzwungen in dunklem Kino-Stil (transluzentes Schwarz) — Schluss mit weißen Icons auf weißem Hintergrund; das automatische Verbergen der Steuerelemente schließt kein laufendes Menü mehr.
- **Mobile Performance**: Reduzierter Ambient-Blur bei kleinen GPUs (max-sm:blur-2xl), Ken Burns erhalten.

## v1.13.75 — August 2026

### Player: HLS wird zu einer manuellen Option, ffmpeg-Kompressionsprofile, Premium-Design

- **Neu — Lesestrategie**: Der HLS-Transcode (Plex) wird nicht mehr automatisch ausgewählt. Im Modus „Auto“ erfolgt die Wiedergabe über die **direkte Wiedergabe oder den lokalen FFmpeg-Remux**; kann kein lokaler Engine die Datei lesen, wird anstelle eines stillen Umschaltens auf den Plex-Transcode eine explizite Fehlermeldung angezeigt. HLS bleibt **manuell** unter Einstellungen → Plex → Wiedergabemotor („HLS (Plex-Transcode) — manuell“) verfügbar für Fälle, in denen es noch nützlich ist (Bild-PGS/VobSub-Untertitel, exotische Audiotrack, eingeschränktes Netzwerk).
- **Neu — FFmpeg-Kompressionsprofile**: Das Menü „Player-Qualität“ bietet nun **Original / 4K / 2K / FHD / HD** mit einem echten lokalen Transcode (sehr schnelles libx264, CRF 23, sparsame Bitraten für NAS: 10 / 6,5 / 4 / 2,2 Mb/s, Downscale ohne jemals die Quelle zu überschreiten). „Original“ behält die aktuelle bitgenaue Kopie bei (null CPU). Die Änderung der Qualität lädt die FFmpeg-Sitzung an die aktuelle Position neu; bei einem direkten/MSE-Stream wechselt der Player zum lokalen Transcode.
- **Neu — Premium-Player-Design**: Verlaufsscreen unten am Bildschirm (kein undurchsichtiges Band mehr), feiner Fortschrittsbalken, der beim Überfahren dicker wird und einen leuchtenden Verlauf hat, und ein Zoom-Scrub-Vignetten, ein zentraler riesiger Play/Pause-Button, Milchglas-Menüs mit Häkchen beim aktiven Element, Feedback-Toast bei Sprüngen von ±10 s, Ladekreis mit Marke, neu gestaltete Wiederaufnahme-Karte und Fehlerbildschirm, Header mit verlaufender Überlagerung im Vollbildmodus, filmische Vignette und Ken-Burns-Atmosphärenatmung, Cursor versteckt, wenn die Steuerelemente verschwinden.

## v1.13.74 — August 2026

### Player: Korrekte Wiedergabeposition im FFmpeg-Modus, 100 % lokale Untertitel ohne Plex

- **Korrigiert**: Im FFmpeg-Modus setzte sich der Fortschrittsbalken nach einem Klick in der Mitte des Videos zurück (der Inhalt positionierte sich korrekt). Der remuxte Stream ist ein fragmentiertes MP4 ohne Index: der Browser beginnt bei jedem Seek/Neuladen bei Null, auch wenn der Server an der richtigen Position sucht. Der Player zeigt und speichert nun `seekBase + currentTime` (Position des letzten Seeks + abgespielte Zeit), und der Verweis wird auch beibehalten, wenn man die Audiotrack ändert oder den Player stoppt.
- **Neu**: Untertitel funktionieren nun **ohne Plex** im FFmpeg-Modus – Movviz extrahiert selbst die Untertitelspur aus der Rohdatei über FFmpeg (Konvertierung nach WebVTT) und spielt sie über das native `<track>`-Tag des Browsers ab, mit einer bei jedem Seek neu berechneten Verschiebung. Das Video bleibt als bitgenaue Kopie erhalten, kein Video-Transcode ist nötig. Die **Text**-Spuren (SRT, ASS, SSA, WebVTT, mov_text…) bleiben im FFmpeg-Engine; die **Bild**-Spuren (PGS/VobSub von Blu-ray-Remuxes, nicht in Text konvertierbar) wechseln wie bisher auf den HLS-Stream. Untertitel zu entfernen, verlässt nicht mehr den FFmpeg-Modus.

## v1.13.73 — August 2026

### Player: FFmpeg-Engine respektiert, Tonerkennung in unter einer Sekunde, Audiotrack-Auswahl im FFmpeg-Modus

- **Korrigiert**: Wenn der Motor **ffmpeg** unter Einstellungen → Plex ausgewählt war, startete der Player manchmal eine direkte Wiedergabe anstelle des lokalen Remuxes – die Engine-Auswahl wurde nicht in die Strategieberechnung einbezogen. Jetzt ist FFmpeg-Engine = FFmpeg-Remux für alle Dateien (der ⚡-Button startet auch einen Remux statt einer direkten Wiedergabe), mit HLS als letztem Mittel, falls FFmpeg nicht verfügbar ist.
- **Verbessert**: Die Stille-Überwachung der direkten Wiedergabe erkennt nun eine stumme Audiotrack in **weniger als einer Sekunde** (Fenster 800 ms) anstelle von 6 s und skaliert dann auf den **lokalen FFmpeg-Remux** (Ton transcodiert nach AAC, Video kopiert), bevor er auf den Plex-Transcode zurückfällt. Das Urteil fällt erst, wenn die Dekodierung tatsächlich begonnen hat, um niemals einen langsamen Start mit echter Stille zu verwechseln (keine Regression für kompatible Videos).
- **Neu**: Die Menüs für Audiotrack / Untertitel sind nun verfügbar, wenn der FFmpeg-Engine aktiv ist – direkter Sprachwechsel (Remux-Sitzung mit der richtigen Spur neu geladen, Position beibehalten) und automatischer Wechsel zum HLS-Stream (Plex), wenn ein Untertitel angefordert wird (der lokale Remux schreibt keine Untertitel).

## v1.13.72 — August 2026

### Neu: Einstellung der bevorzugten Audiolanguage für den Player

- **Neu**: Einstellungen → Plex bietet nun eine bevorzugte Audiolanguage für die Standardspurwahl beim Abspielen (Französisch, Englisch, Spanisch, Deutsch, Italienisch, Niederländisch) – bei „Automatisch“ (Standard) wird die Sprache der Oberfläche wie bisher beibehalten; ein Konto, das Movviz auf Französisch nutzt, aber Englisch bevorzugt, kann dies nun explizit angeben, ohne dass sich seine Oberfläche ändert.

## v1.13.71 — August 2026

### Die Audiospur in der Sprache der Oberfläche wurde ausgewählt... und dann leise durch eine andere Spur desselben Codecs überschrieben

- **Ursache live bestätigt** (Jurassic Park 499959, zwei AC-3-Spuren Französisch/Englisch): Die französische Spur wurde korrekt ausgewählt – sowohl durch die neue Sprachregel als auch durch die „ausgewählte“ Einstellung von Plex selbst – aber ein älterer Fallback-Mechanismus (ursprünglich gedacht, um einem wirklich nicht dekodierbaren Codec auszuweichen, z. B. DTS → AC-3) überprüfte nie, ob die Ersatzspur tatsächlich einen anderen Codec hatte. Da beide Spuren dieses Films AC-3 waren, „funktioniert“ dieser Fallback, indem er einfach auf die andere Spur (Englisch) umschaltet, nur weil sie nicht ausgeschlossen war – ohne zusätzliche Kompatibilität zu bieten und damit die korrekte französische Auswahl leise zu überschreiben.
- **Behoben**: Der Fallback erfordert nun einen Codec, der sich tatsächlich von dem der bereits abgelehnten Spur unterscheidet.

## v1.13.40 – v1.13.70 — August 2026

### Video-Wiedergabe: Mehrstufige Fallback-Kette, lokales ffmpeg-Remux, aktualisierter Player

- **Neu**: Das Abspielen einer Datei erfolgt nun über eine mehrstufige Fallback-Kette, wobei automatisch jeder Schritt versucht wird, je nachdem, was der Browser tatsächlich dekodieren kann – Direktwiedergabe → MSE (bitgenaue Kopie, eigenes MP4-Parser) → **lokales ffmpeg-Remux** (neuer Motor, übernimmt für jeden Container/Codec, den der MSE-Parser nicht handhabt, insbesondere MKV) → DASH/HLS (Plex-Transkodierung, letzter Ausweg). Das ffmpeg-Remux holt die rohe Quelldatei direkt von Plex und remuxet sie selbst (Video-Kopie mit null CPU-Kosten, Audio kopiert oder in AAC transkodiert, je nach Codec) – null Abhängigkeit von der Transkodierungsentscheidung von Plex, die sich als interne, nicht dokumentierte und extern nicht beeinflussbare Heuristik erwiesen hat (Verweigerung, den HEVC-Bitstream in HLS zu kopieren, unabhängig vom Client-seitig gesendeten Parameter oder der getesteten Variante).
- **Behoben**: Das DASH-Protokoll wird nun für alle HEVC/AV1-Quellen oder alle Transkodierungssitzungen verwendet – es ist das einzige Protokoll, bei dem Plex die HEVC-Bitstream-Kopie respektiert (HLS re-encodiert diese Quellen systematisch, auch im „nur Audio“-Modus, was die wahre Ursache für die wahrgenommene Verzögerung war). Das vom Client deklarierte Profil bei Plex („Plex Web“) deckt nun HEVC/AV1 für HLS UND DASH ab, und beide Modi „Transkodiert (Audio)“/„Transkodiert (Video)“ – deren Reihenfolge vertauscht wurde – verweisen auf das korrekte Plex-Verhalten.
- **Behoben**: Mehrere Fallen bei der Audio-Dekodierung wurden in realen Bedingungen identifiziert und behoben – AC-3, das in eine progressive MP4 kopiert wird, wird nicht nativ von Chrome/Edge dekodiert (anderer Kontext als hls.js/MSE-Transmux, behoben durch Beschränkung der Remux-Kopie auf universell dekodierbare Codecs und Transkodierung des Rests in AAC), und Dolby Digital(+) kann nicht vom Silent-Monitoring erfasst werden (es basiert auf der Web Audio Graph, außerhalb der Reichweite dieser Codecs) – jeder dieser Fälle wird nun korrekt erkannt oder vermieden, anstatt eine fehlerfreie, stumme Wiedergabe zu erzeugen.
- **Behoben**: Die Robustheit des Pipelines wurde durch Tests unter realen Bedingungen erhöht – Race Conditions im MSE-Engine und in ffmpeg-Sitzungen (Puffer, Seek, sauberer Server-Stream-Stopp beim Client-Abbruch, einschließlich eines Falls, der den gesamten Server abstürzen lassen konnte), zuverlässige Dauer und Wiedergabeposition für den ffmpeg-Stream (fragmentierter Container ohne bekannte Dauer seitens des Browsers).
- **Neu**: Der Player wählt nun standardmäßig den Audiotrack basierend auf der Sprache der Movviz-Oberfläche (gleiche Regel wie beim Audiotag), aktiviert Untertitel nur automatisch, wenn kein Audiospur dieser Sprache vorhanden ist, zeigt ein Vorschaubild beim Überfahren der Fortschrittsleiste an (übertragen von Plex, das es bereits für seinen eigenen Player generiert), und verwaltet neue Tastenkombinationen (Lautstärke, direkter Sprung nach Prozent) zusätzlich zu den bestehenden Tastenkombinationen (Wiedergabe, ±10s, Vollbild, stumm, schließen).

## v1.13.65 — August 2026

### Der Hero pinnte immer dieselben Titel

- **Korrigiert**: Pools ohne natürliche Reihenfolge (personalisierte Vorschläge, Entdeckung, nie angesehen) werden nun täglich und pro Benutzer mit einem deterministischen Seed gemischt — Rotation alle 24 Stunden anstatt derselben 2-3 Titel, die unbegrenzt gepinnt waren; die chronologischen Pools (recentlyAdded, upcoming, recentActivity) sind davon nicht betroffen.

## v1.13.63 — August 2026

### Eine Serie mit nur einer "kommenden" Episode wurde als fehlend angezeigt — die Serienkarte ignorierte den Status "upcoming"

- **Grundursache bestätigt**: `LibrarySeriesCard` berechnete die Vollständigkeit einer Serie mit `available === monitored.length`, indem sie nicht ausgestrahlte Episoden ("upcoming") so mitzählte, als müssten sie bereits verfügbar sein — eine vollständig heruntergeladene Serie mit nur einer noch nicht ausgestrahlten Episode zeigte daher das bernsteinfarbene "fehlend"-Tag an, obwohl `SeasonAccordion`, `TitleContent` und die Bibliothekseite bereits korrekt "verfügbar ODER kommend" als vollständig behandeln.
- **Korrigiert**: Die Serienkarte wendet nun dieselbe Regel wie überall in der App an.

### „Suchen und ersetzen“ schlug vor, eine Datei durch eine nahezu identische zu ersetzen, wenn die aktuelle Sprache unbekannt war

- **Live bestätigte Grundursache**: Wenn die Sprache der vorhandenen Datei unbekannt ist (nicht erkannt), wurde jede im Zielformat (VF) gecachte Veröffentlichung als „Verbesserung“ vorgeschlagen, ohne jemals zu überprüfen, ob sie tatsächlich etwas bewirkte — dieselbe Auflösung, derselbe Codec (x264≈H.264, x265≈HEVC, unterschiedlich angezeigt, aber identisch) und eine nahezu identische Größe lösten trotzdem einen Ersatzvorschlag aus. Die bestehende Schutzmaßnahme (`isMeaningfulUpgrade`, Größenabfall ≥ 10 %) wurde für diesen speziellen Fall explizit umgangen; bei Serien existierte dieser Schutzmechanismus schlichtweg nicht.
- **Korrigiert**: Sprachbasierte Vorschläge erfordern nun dieselbe minimale Größenabweichung (10 %) wie andere Verbesserungsarten, sowohl bei Filmen als auch bei Episoden — Vorschläge für tatsächliche Auflösung/Codec sind davon nicht betroffen.

## v1.13.39 — August 2026

### Added an opt-in toggle for YouTube trailer search — off by default explains why trailers stayed in English

- **Hinzugefügt**: Der YouTube-Such-Fallback für Trailer (verwendet, wenn TMDb keine in der Sprache des Betrachters hat) ist ein Seiten-Scrape und kein offizielles API — er hängt davon ab, dass YouTube die IP des Servers nicht drosselt, und ein einzelner stiller Fehler wird für 24 Stunden gecached, daher war er immer standardmäßig deaktiviert. Dieses Standardverhalten erklärt, warum die Trailer trotz des existierenden und bei direktem Test korrekt funktionierenden Mechanismus immer auf Englisch blieben. Ein neuer Schalter in Einstellungen → Dashboard („Trailer“) aktiviert ihn — standardmäßig immer noch deaktiviert, aber jetzt eine explizite, sichtbare Wahl anstelle einer stillen.

### Titles stuck "searching" gave the "Downloading" tile a nonzero count with nothing there to explain it

- **Hinzugefügt**: Anstatt die „suchen“-Elemente einfach nicht mehr als heruntergeladen (letzte Veröffentlichung) zu zählen, erhalten sie nun ein eigenes dediziertes „Suche läuft“-Dashboard-Feld — sodass diese Zahl nicht einfach verschwindet, sondern dorthin wandert, wo sie hingehört.

---

## v1.13.36 — August 2026

### The "Downloading" dashboard tile could show a nonzero count with nothing actually downloading

- **Fixed**: Das Feld zählte Episoden/Filme, die immer noch "gesucht" wurden (aktiv nach einer Veröffentlichung gesucht, noch kein Torrent erfasst), als ob sie heruntergeladen würden. Bestätigt live: Eine ganze Staffel, die in "Suchen" steckte, ohne aktives Torrent, blähte die Zählung auf 9, obwohl tatsächlich null Downloads liefen. Das Feld zählt nun nur noch Elemente mit einem echten aktiven Download.

### Ein Wiedergabe-Button eines Titels könnte ohne Erklärung komplett verschwinden

- **Fixed**: Der Anzeigebutton auf einer Titelseite hing vollständig davon ab, dass Plex die Datei bereits verknüpft hatte – eine Datei, die Movviz bereits bereit hat, die Plex aber noch nicht in seine eigene Bibliothek gescannt hat (eine normale asynchrone Timing-Lücke), zeigte stattdessen keinen Button, sondern nichts, das auf die Wartezeit hinwies. Es wird nun ein klar deaktivierter Platzhalter mit einem Tooltip angezeigt, anstatt zu verschwinden.

### Zwei voneinander unabhängige Buttons auf der Titelseite teilten dasselbe Icon

- **Fixed**: "Versionen verwalten" und "Saga/Sammlung ansehen" verwendeten beide dasselbe Stapel-Icon, was bei einem Titel, der beides hat, verwirrend war. Der Link zur Sammlung verwendet nun ein visuell unterscheidbares Icon.

---

## v1.13.34 — August 2026

### Dieselbe Benachrichtigung konnte für Inhalte ausgelöst werden, die seit Tagen verfügbar waren

- **Fixed**: Benachrichtigungen wurden nie dedupliziert – ein geplanter Job, der Inhalte erneut scannt, die er nicht vollständig aufräumen konnte, konnte bei jedem Durchlauf exakt dieselbe "jetzt verfügbar"-Benachrichtigung auslösen, bestätigt live mit einer Staffel-Verfügbarkeitsbenachrichtigung, die alle ca. 30 Minuten für einen Titel wiederholte, der eigentlich seit einer Woche verfügbar war. Dieselbe Art von Benachrichtigung mit denselben Details wird nun innerhalb eines Zeitfensters von einer Stunde nur einmal ausgelöst; eine echte Wiederholung in größerem Abstand (z. B. Tage später) erfolgt weiterhin normal.

### Der Dashboard-Modus "Klassisch" wurde überarbeitet, um "Kino" ohne den Heldenbereich zu entsprechen

- **Changed**: Der Klassik-Modus verwendet nun alles, was der Kino-Modus bietet – die kompakten Statistik-Pillen und das volle Zeilenlayout (Trends, Empfehlungen, Neuzugänge usw.) – nur ohne das große Hero-Banner oben, basierend auf Feedback. Zuvor fiel er auf ein einfaches Statistik-Kachel-Raster und eine flache "Neuzugänge"-Liste zurück, ohne die Zeilen des Kinos.

---

## v1.13.33 — August 2026

### Hinzugefügt: Ein manueller Seed-Umschalter für abgeschlossene Downloads

- **Added**: Ein abgeschlossener Download in der Warteschlange hat nun einen eigenen Button, um das Seeding zu starten oder zu stoppen, unabhängig von den Pause/Wiederaufnahme-Steuerelementen für aktive Downloads. Das Deaktivieren stoppt die Upload-Aktivität tatsächlich und nicht nur die Anzeige eines Status – für die Standard-Download-Engine trennt dies das Torrent vollständig von den Peers; das erneute Aktivieren stellt es wieder her und baut das ursprüngliche Dateilayout bei Bedarf neu auf, ohne die Kopie in der Bibliothek zu berühren oder neu herunterzuladen.

### Poster-Zeilen-Titel waren nicht unter ihren Karten zentriert

- **Changed**: Der Titel unter jeder Poster-Karte in den Dashboard-Zeilen (Trends, Empfehlungen, Neuzugänge) ist nun unter dem Poster zentriert, basierend auf Feedback – zuvor konnte er versetzt stehen, besonders in der Rangliste Top-10.

---

## v1.13.32 — August 2026

### Downloads zeigten nie eine verbleibende Zeit

- **Fixed**: Das Feld "verbleibende Zeit" (ETA) der Warteschlange wurde nur von zwei der drei Download-Engine-Backends berechnet – das Standard-Backend (die Engine, die täglich tatsächlich verwendet wird) gab niemals einen `timeRemaining`-Wert durch, sodass das Feld in der Warteschlange immer leer war. Es wird nun auf dieselbe Weise berechnet wie die anderen Backends (verbleibende Bytes geteilt durch aktuelle Geschwindigkeit), sodass ein aktiver Download eine echte Schätzung anzeigt.

---

## v1.13.31 — August 2026

### Ein funktionierender Dateipfad konnte durch Plexs eigene Ansicht des Dateisystems stillschweigend überschrieben werden

- **Fixed**: Bei jeder Plex-Synchronisierung konnte ein bereits korrekter, funktionierender Dateipfad für einen Film oder eine Episode durch beliebigen Pfad, den Plex selbst für diese Datei meldet, überschrieben werden. Wenn Plex und Movviz in separaten Containern mit unterschiedlichen Volume-Mounts für dasselbe physische Medium laufen, existiert der von Plex gemeldete Pfad aus Movviz' Sicht des eigenen Dateisystems nicht – so wird ein perfekt guter, funktionierender Pfad stillschweigend in einen fehlerhaften umgewandelt, was „Pfade reparieren“ mit falsch-positiven Meldungen für Titel überflutet, die nie wirklich fehlerhaft waren. Movviz lernt nun automatisch die Entsprechung zwischen Plexs Pfadstruktur und seiner eigenen – indem es für einen Titel, den es bereits korrekt verfolgt, seinen eigenen verifizierten funktionierenden Pfad mit dem vergleicht, was Plex für genau denselben Titel meldet – und übersetzt zukünftige Plex-Meldungen durch diese erlernte Zuordnung, anstatt ihnen blind zu vertrauen. Kein Einstellungsbildschirm, keine manuelle Konfiguration: Es leitet die Zuordnung selbst aus Daten ab, die es bereits mit Sicherheit kennt. Ein Pfad wird nur dann geschrieben, wenn er zuerst unabhängig auf der Festplatte als vorhanden verifiziert wurde – eine falsche oder veraltete Zuordnung kann schlimmstenfalls ein falsches „fehlend“-Flag erzeugen (manuell wiederherstellbar), niemals einen stillschweigend verlorenen Verweis auf eine reale Datei.

---
## v1.13.30 — August 2026

### „Pfade reparieren“ könnte Hunderte von völlig nicht zusammenhängenden Dateien als Kandidaten vorschlagen

- **Fixed**: Wenn eine fehlerhafte Episoden-Datei nicht nach ihrem exakt erfassten Dateinamen gefunden werden konnte, wurde sie als letzter Ausweg gegen jede Videodatei in der gesamten Bibliothek gematcht, die dieselben Staffel-/Episodennummern teilte – unabhängig davon, zu welcher Show sie eigentlich gehörte. Bestätigt live: Eine einzelne fehlerhafte Episode konnte mit über 500 „Kandidaten“ zurückkommen, die eigentlich nur die Episoden 1, Episode 2 usw. jeder anderen Show waren. Dieser Fallback bietet nun nur noch Dateien, die plausibel zur tatsächlichen Serie gehören (nach Dateinamen oder Ordnernamen), sodass die Vorschlagsliste wieder kurz und relevant ist. Seit v1.12.86 vorhanden – nichts, das in dieser jüngsten Reihe von Korrekturen geändert wurde, und kein anderer passende Pfad (exakter Dateiname, erwarteter Pfad oder die doppelter Konfliktwarnung) wurde berührt.

### Die Top-10-Ziffern in der Trend-Zeile überlappten zu stark mit dem Poster

- **Changed**: Die Rangnummer hinter jeder Top-10-Karte in der „Trends“-Zeile saß zu weit unter dem Poster, sodass nur ein Spaltchen links sichtbar war. Nun überlappt sie viel weniger – der Großteil der Zahl ist links von der Karte sichtbar, wobei nur der hintere Rand hineingesteckt ist, basierend auf Feedback.
- **Changed**: Die „Trends“-Zeile wird nun auf dem Dashboard zuerst angezeigt, über „Kürzlich hinzugefügt“, basierend auf Feedback.

### Die Sammlung „Download fehlt“ könnte den falschen Titel anstelle des tatsächlich fehlenden auswählen

- **Fixed**: Zwei kumulative Fehler, beide live in mehreren Sammlungen bestätigt. Erstens berechnete der Button, welche Titel aus einem gemeinsamen, appweiten zwischengespeicherten Bibliotheks-/Sammlungs-Snapshot fehlten, der veraltet sein konnte, ohne dass auf dem Bildschirm etwas offensichtlich falsch war – sowohl die Bibliothek als auch die Teilliste der Sammlung werden nun direkt vor dem Download frisch neu geladen. Zweitens, und das Konsequenzreichere: Ein Duplikat-Erkennungs-Schutz, der dazu gedacht war, zu erkennen, dass TMDb denselben veröffentlichten Film unter zwei IDs auflistet, verwendete ein unscharfes Titel-Matching ohne echte Jahresvoraussetzung – er konnte stillschweigend einen nicht zusammenhängenden, bereits vorhandenen Eintrag für einen unbestätigten Franchise-Platzhalter wiederverwenden oder einen echten Film mit einer Featurette derselben Franchise, die ein Jahr später ist, durch einen zusätzlichen Titelzusatz verwechseln. Dieser Schutz erfordert nun sowohl eine exakte normalisierte Überschrift ALS AUCH ein exaktes, bestätigtes Veröffentlichungsjahr auf beiden Seiten, bevor er einem Match jemals vertraut.

### Freundekonten zeigten alle die Plex-Verlaufsdaten des Serverbesitzers

- **Fixed**: Jedes verknüpfte Freundekonto hatte eine genuin unterschiedliche Plex-Identität und einen Token, doch alle synchronisierten exakt dieselben Wiedergabezahlen wie das Konto, das den Server besitzt. Die Grundursache wurde gegen das dokumentierte Verhalten von Plex selbst bestätigt: Die Endpunkte, die zur Synchronisierung des Wiedergabestatus verwendet werden, melden `viewCount` nur aus der Perspektive des Serverbesitzers, unabhängig davon, welcher gültige Kontotoken die Anfrage stellt – kein Request-Header kann das ändern. Die Status-Synchronisierung verwendet nun stattdessen den Plex-Sitzungsverlauf-Endpunkt, der mit dem Admin-Token abgefragt und nach der eigenen Plex-ID jedes Kontos gefiltert wird – so, wie Plex die Wiedergabe tatsächlich pro Konto verfolgt – funktioniert nun sowohl für Freundekonten als auch für Home-verwaltete Profile, anstatt zwei separate Pfade zu verwenden.

## v1.13.22 — August 2026

### „Für dich“-Empfehlungen sind wieder streng pro Konto, und ein Plex-Sehverlauf-Fehler sieht nicht mehr wie „nichts gesehen“ aus

- **Geändert**: Die Haushaltsmischung von v1.13.21 wurde rückgängig gemacht — nach mehr Feedback basiert „Für dich“ wieder NUR auf dem eigenen Plex-Sehverlauf eines Kontos, ohne Signal von einem anderen Konto, selbst wenn es nur ein kleines ist. Ein Konto mit nur ein paar gesehenen Titeln erhält nun eine personalisierte Reihe nur aus diesen, anstatt eine Mindestanzahl zu benötigen, bevor irgendetwas angezeigt wird.
- **Behoben**: Der Plex-Sehstatus-Sync hat jeden Fehler (Netzwerkunterbrechung, abgelaufenes Token, nicht erreichbarer Abschnitt) still geschluckt und unabhängig davon ein leeres Ergebnis gespeichert — nicht zu unterscheiden von „dieses Konto hat wirklich nichts gesehen“, und war in der Lage, bei einem vorübergehenden Fehler die tatsächliche Sehgeschichte leise zu löschen. Nun lässt er vorhandene Daten unangetastet, wenn ein Sync keinen Bibliotheksabschnitt erreichen kann, und jeder Sync-Versuch — ob erfolgreich oder fehlgeschlagen, und für welches Konto — wird unter Einstellungen → Protokolle protokolliert, sodass ein still fehlschlagendes Konto endlich sichtbar ist, anstatt nur leer auszusehen.

### „Für dich“-Empfehlungen können nun auf die gesamte Plex-Historie des Haushalts zugreifen, nicht nur auf die eigene

- **Neu**: Wenn der eigene Plex-Sehverlauf eines Kontos dünn oder leer ist, mischt sich dessen „Für dich“-Reihe nun auch mit dem, was andere Konten auf derselben Instanz gesehen haben (mit geringerem Gewicht als die eigene Historie) — sodass jemand ohne eigenen Plex-Link immer noch eine echte, personalisierte Reihe erhält, anstatt des allgemeinen „Top-Bewertet“-Fallback. Dies wird nur ausgelöst, wenn mindestens zwei andere Konten eigene echte Sehdaten haben — der Geschmack eines einzelnen anderen Kontos wird niemals als Platzhalter-„Haushalts“-Signal verwendet, um zu vermeiden, dass die Auswahl einer Person leise auf jemand anderen übertragen wird. Die eigene Reihe jedes Kontos bleibt genauso persönlich wie zuvor; dies fügt nur ein breiteres Signal hinzu, ersetzt aber niemals die eigene Historie des Kontos, wenn diese bereits vorhanden ist.

### Episodentitel und -beschreibungen kamen immer auf Französisch zurück, unabhängig von der Sprache der Benutzeroberfläche

- **Behoben**: Der Aufruf der Staffel-/Episodendaten (Thumbnails, Titel, Beschreibungen — in v1.13.12 hinzugefügt und in v1.13.19 auf eigene Serien erweitert) gab TMDb nie mit, in welcher Sprache es antworten sollte, sodass es standardmäßig für jeden Benutzer Französisch verwendete, selbst wenn Englisch (oder eine andere Sprache) als Sprache der Benutzeroberfläche ausgewählt war. Dies war derselbe Fehler, der bereits einmal für Detailseiten von Titeln behoben wurde — wurde aber nie auf diesen spezifischen Aufruf angewendet. Nun folgt es der ausgewählten Sprache der App wie überall sonst.

### Episoden-Thumbnails und -beschreibungen werden nun überall angezeigt, nicht nur für Serien, die Sie noch nicht besitzen

- **Behoben**: v1.13.12 fügte jeder Episodenreihe ein Thumbnail und eine Kurzbeschreibung hinzu, aber nur für Serien, die noch nicht in Ihrer Bibliothek sind — Episoden von Serien, die Sie bereits besitzen, wurden als einfache Textzeilen ohne jegliche Vorschau angezeigt. Beide Ansichten ziehen nun aus denselben Live-TMDb-Daten, sodass eine heruntergeladene/verfügbare Episode exakt dieselbe Vorschau zeigt wie eine, die Sie noch nicht erfasst haben — wobei keiner der vorhandenen Qualitätsabzeichen, des gesehenen Markers, des Status-Pills oder der Suchschaltflächen entfernt wurde.
- **Behoben**: Die Ausstrahlungsdaten von Episoden in derselben Liste werden unabhängig von der ausgewählten Sprache von Movviz im lokalen Format Ihres Browsers gerendert (z. B. Anzeige der US-Monat/Tag-Reihenfolge, selbst bei Auswahl von Französisch) — folgen nun konsistent der Sprache der App, wie bei jedem anderen Datum in Movviz.

### Das erneute Versuchen eines teilweise importierten Staffelpakets könnte versuchen, dessen übrig gebliebenes .nfo in eine Episodendatei umzubenennen

- **Behoben**: Sobald jede echte Videodatei in einem Staffelpaket bei einem früheren teilweisen Durchlauf bereits zugeordnet und verschoben wurde, würde ein erneuter Versuch null Videodateien finden und darauf zurückgreifen, jede verbleibende Datei — einschließlich der `.nfo` der Veröffentlichung — als „die zu importierende Episode“ zu behandeln, und versuchen, sie in etwas wie `S03E02.nfo` umzubenennen und dabei komplett zu scheitern, wenn dies nicht mit dem übereinstimmte, was tatsächlich auf der Festplatte lag. Überbliebene `.nfo`/`.txt`/Image-/Checksum-Dateien sind niemals Episodeninhalt und werden automatisch bereinigt, sobald der Import abgeschlossen ist — sie werden nun vollständig von dieser Zuordnung ausgeschlossen, anstatt einen fehlgeschlagenen, für den Benutzer sichtbaren Importfehler zu verursachen.

## v1.13.17 — August 2026

### Die Verlangsamungsprotokolle, von denen Sie gehört haben, werden nun tatsächlich unter Einstellungen → Protokolle angezeigt

- **Fixed**: Das Suchdiagnose-Protokoll konnte bei intensiven Hintergrunddurchläufen in wenigen Minuten seinen 2000-Zeilen-Puffer füllen (jede Episodensuche schreibt ca. 10 Zeilen, davon mehrere Debug-Zeilen), wodurch wichtige Info-Zeilen – einschließlich der neuen Hintergrund-Verlangsamungszeilen – stumm überschrieben wurden. Der Puffer enthält jetzt 4000 Zeilen, sodass `priority.yield`-Einträge dem Rauschen standhalten.
- **New**: Das Protokollfeld in Einstellungen → Protokolle verfolgt jetzt live – es aktualisiert sich alle 5 Sekunden, solange der Tab sichtbar ist, sodass Zeilen, die von Hintergrundarbeiten geschrieben werden, erscheinen, sobald sie geschrieben werden, anstatt nur nach einem manuellen Aktualisieren. Kein Neuzeichnen, wenn nichts geändert wurde.
- **Fixed**: Alle Protokollquellen befinden sich jetzt an einem Ort – das Transkodierungsprotokollfeld wurde vom Diagnosetab zu Einstellungen → Protokolle verschoben und zeigt nun Such-/Diagnose-, Engine-, Resolver- und Transkodierungsprotokolle zusammen an.
- **Changed**: Hintergrundverlangsamungs-Protokole erhalten nun eine eigene Farbe im Feld, sodass Einträge wie „Arrière-plan bridé [bulk manquants]…“ auf einen Blick auffallen.

## v1.13.16 — August 2026

### Hintergrundverlangsamungen sind jetzt in den Protokollen sichtbar – mit dem verantwortlichen Benutzer

- **New**: Hintergrundarbeiten (der manuelle „Alle fehlenden suchen“-Bulk, geplante RSS-Abgleiche, Qualitäts-Upgrades, fehlende Veröffentlichungs-Wiederholungen) pausieren nun, wann immer Sie die App aktiv nutzen, und setzen nach einigen Sekunden wieder fort – Sie merken es nie. Jedes Mal, wenn eine solche Verlangsamung tatsächlich auftritt, protokolliert das Diagnosesuchprotokoll dies in einer sauberen, lesbaren Zeile: welche Hintergrundaufgabe ausgebremst wurde, welcher Benutzer aktiv war (Name + ID) und wie lange die Wartezeit dauerte (z. B. „Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)“).
- **Fixed**: Stilles Frontend-Polling wird nicht mehr als Benutzeraktivität gezählt. Die Statusabfragen (Engine-Torrents alle 500ms, Jobs alle 2s, Leistungsmetriken alle 5s, Plex-Aktivität alle 5s, Wiedergabefortschritt alle 10s…) hielten die App, sobald eine Seite geöffnet blieb, für immer als „aktiv“ markiert – sodass Hintergrundarbeiten nie richtig wieder aufgenommen wurden. Nur echte Interaktionen zählen jetzt (Navigation, Suchen, Klicken): Lassen Sie die App geöffnet, und der Hintergrund setzt einige Sekunden nach Ihrem letzten Klick fort.
- **Changed**: Die manuelle Bulk-Suche läuft nun im Hintergrund wie die geplanten Aufgaben – sie erbt das reduzierte Indizierer-Kontingent (Ihre eigenen Suchen behalten Priorität) und gibt zwischen den Elementen nach.

## v1.13.15 — August 2026

### Obere Navigation blieb nach dem Scrollen nach oben stabil

- **Fixed**: Die in v1.13.12 hinzugefügte halbtransparente obere Navigationsleiste wurde korrekt fest, sobald Sie nach unten gescrollt haben, aber das Zurückscrollen ganz nach oben ließ sie nie wieder transparent werden. Auf eine zuverlässigere Erkennungsmethode umgestellt, sodass sie nun in beide Richtungen korrekt die Scrollposition widerspiegelt.

## v1.13.14 — August 2026

### Dashboard-Zeilen können jetzt ein vollständiges Raster öffnen – „Alle anzeigen“ war nie wirklich implementiert

- **Fixed**: Die Karussells des Dashboards („Für Sie“, „Kürzlich hinzugefügt“, „Bald verfügbar“, „Trending“) hatten eine „Alle anzeigen“-Funktionalität, die in die Zeilenkomponente selbst eingebaut war, aber keine Dashboard-Zeile gab ihr jemals ein Ziel – daher erschien sie auf keiner Zeile stumm, seit dieser Teil des Dashboards erstellt wurde. Die Zeilen bleiben exakt wie kompakte horizontale Streifen; „Alle anzeigen“ öffnet nun die vollständige Menge als echtes, filterbares Raster (Entdecken für Empfehlungs-/Trending-Zeilen, Ihre Bibliothek – vorab gefiltert, um zu matchen – für Zeilen, die aus dem, was Sie bereits besitzen, stammen).

## v1.13.13 — August 2026

### Beta-Player ist jetzt eine persönliche Wahl pro Konto, standardmäßig deaktiviert

- **Changed**: Zuvor hatte der Beta-Player einen einzigen Ein-/Aus-Schalter für die gesamte Instanz – ein Administrator, der ihn einschaltete, änderte stillschweigend das Wiedergabeverhalten für jedes Konto. Es gibt jetzt zwei Ebenen: einen Admin-Umschalter in den Einstellungen, der die Funktion überhaupt erst verfügbar macht, und einen persönlichen Umschalter auf jeder Benutzerprofilseite, der es für deren Konto tatsächlich einschaltet – standardmäßig deaktiviert, unabhängig davon, was der Administrator eingestellt hat.

## v1.13.12 — August 2026

### Sechs Verbesserungen beim Durchsuchen, ausgewählt aus einer Design-Überprüfung

- **New**: Zeilen zeigen nun einen dünnen Scroll-Position-Indikator und auf Hover enthüllte Kantenpfeile, und scrollen nun um eine ganze Seite statt durch freies Ziehen.
- **Neu**: Die Zeile „Trends“ hebt nun ihre Top 10 mit einer nummerierten Rangfolge hervor, wobei die gleiche reale Beliebtheitsreihenfolge verwendet wird, nach der die Zeile bereits sortiert war.
- **Neu**: Beim Überfahren einer Posterkarte (Desktop) werden nun, wenn verfügbar, kurz Jahr, Laufzeit und Genre-Tags angezeigt, anstatt nichts.
- **Geändert**: Die obere Navigationsleiste ist nun ganz oben auf der Seite transparent und wird erst beim Scrollen fest.
- **Geändert**: Die Episodenliste für einen Titel, der noch nicht in Ihrer Bibliothek ist, zeigt nun pro Episode eine Miniaturansicht und eine kurze Beschreibung, nicht nur eine leere Zeile. (Episoden für Titel, die bereits in Ihrer Bibliothek sind, haben das noch nicht – dafür müssen neue Daten zum Importzeitpunkt gesammelt werden, die separat verfolgt werden.)
- **Neu**: Auf Mobilgeräten verwendet der Dashboard-Hero nun dedizierte Porträt-Artwork anstelle einer zugeschnittenen Version des Desktop-Banners.

## v1.13.11 — August 2026

### Anzeige der Personalisierung folgt nun Ihrem Konto und nicht nur Ihrem Browser

- **Geändert**: GPU-Leistungsprofil, Animationen, Theme (hell/dunkel/auto), Interface-Sprache und Bibliotheksansichtsdichte wurden bisher nur im Browser gespeichert – das Wechseln von Geräten oder Browsern setzte alle diese Einstellungen auf den Standard zurück. Sie werden nun Ihrem Konto gespeichert und folgen Ihnen, egal wo Sie sich anmelden, wobei sie gleichzeitig auf dem Gerät, das Sie gerade nutzen, sofort angewendet werden.
- **Verschoben**: Der Schalter „Animationen“ befindet sich nun unter Einstellungen → Performance GPU, neben dem Profil, das er tatsächlich beeinflusst, anstatt unter Dashboard.

## v1.13.10 — August 2026

### Mobile Bottom-Nav-Buttons, die nur beim Tippen über dem Icon funktionierten

- **Behoben, bestätigt live**: Auf Mobilgeräten führte das direkte Tippen auf die Reiter „Kalender/Anfragen/Mehr“ oft zu keiner Reaktion – aber das Tippen knapp darüber funktionierte. Ursache: Der Toast-Benachrichtigungscontainer wird überall gemountet und bleibt immer auf der Seite, selbst wenn keine Benachrichtigungen angezeigt werden. Seine mobile Ebene erstreckt sich über die gesamte Bildschirmbreite, liegt direkt über der unteren Tab-Leiste und ist unsichtbar – aber ein unsichtbares Element blockiert immer noch Klicks darunter, es sei denn, es wird explizit anders angewiesen. Tippvorgänge, die in diesen Überlappungsbereich fallen, treffen stillschweigend auf nichts, anstatt den Tab-Button zu erreichen.
- Der unsichtbare Container blockiert nicht mehr etwas darunter; nur eine tatsächliche sichtbare Benachrichtigung (was selten und kurz ist) ist immer noch antippbar/entfernbar, genau wie zuvor.

## v1.13.09 — August 2026

### Die Blood+-Abgleichkorrektur aus v1.13.06 trat nie wirklich ein – der wahre Grund wurde gefunden

- **Behoben, bestätigt live**: v1.13.06 korrigierte die Titelabgleichfunktion so, dass „+“ als das Wort „plus“ behandelt wird (damit „Blood+“ nicht mit nicht zusammenhängenden Sendungen verwechselt wird). Aber die manuelle Suche zeigte immer noch „Blood Of Zeus“, „Dexter New Blood“, „Blood-C“ und andere als gültige Kandidaten für „Blood+“ – weil ein völlig anderer, früherer Schritt (der, der eine Suchanfrage in den tatsächlichen Text umwandelt, der an die Indizierer gesendet wird) das „+“ entfernte, bevor die korrigierte Abgleichfunktion überhaupt darauf zugreifen konnte, und so diese Korrektur bei jeder echten Suche stillschweigend rückgängig machte. Eine Suche nach „Blood+“ erreichte den Abgleicher als das reine Wort „Blood“, was natürlich fast alles mit „Blood“ im Titel abgleicht.
- Dieser frühere Schritt bewahrt nun auch „+“ und „&“ als Wörter, genau wie es die Abgleichfunktion bereits tat – wodurch die tatsächliche Lücke geschlossen wird, nicht nur die Funktion, die wie die Quelle des Problems aussah.

## v1.13.08 — August 2026

### Akkordeon-Staffeln — Episoden sichtbar, auch ohne Bibliothek

- **Verbessert — Episodenliste verfügbar für nicht verfolgte Serien**: Das Akkordeon der Staffeln zeigte „Noch nicht in der Bibliothek“, wenn die Serie nicht in der Bibliothek war. Die Episoden (Nummer, Titel, Ausstrahlungsdatum) werden nun bei Bedarf (lazy, durch SWR gecached) von TMDb geladen, sobald eine Staffel geöffnet wird – ohne jegliche Auswirkungen auf Serien, die bereits in der Bibliothek sind, deren Darstellung unverändert bleibt. Während der Abfrage wird ein Lade-Skeleton angezeigt.

---

## v1.13.07 — August 2026

### Korrektur des Changelogs v1.13.05

- Entfernung eines falschen Eintrags: Das im Screenshot ARM sichtbare rote Quadrat war eine vom Benutzer gezeichnete Annotation, um den problematischen Bereich anzuzeigen, kein tatsächlicher visueller UI-Bug.

---

## v1.13.06 — August 2026

### Korrektur für Matching — Titel mit `+` (Blood+, C+C Music Factory…)

- **Korrigiert — Falschpositives Matching bei Titeln mit `+`**: Das `+` wurde durch die Normalisierung entfernt (es werden nur `a-z0-9` beibehalten), wodurch beispielsweise `Blood+` zu `blood` reduziert wurde. Da dieses Wort allein in `Blood of Zeus` enthalten ist → `blood of zeus`, erhielt die Serie bei einer manuellen Suche nach Blood+ einen Score von 0,85 (über dem Schwellenwert von 0,72). Das `+` wird nun vor der Bereinigung in `normalizeTitle` in ` plus ` konvertiert, wodurch `Blood+` → `blood plus` und `Blood of Zeus` → `blood of zeus` wird — zwei unterschiedliche Zeichenketten, die nicht mehr verschmelzen. Veröffentlichungen mit dem Namen `Blood Plus` matchen nun korrekt `Blood+`. Der Fix wurde in `matching.ts` und `releaseMatchWorker.mjs` angewendet. Ein Regressionstest wurde hinzugefügt.

---

## v1.13.05 — August 2026

### Korrektur Akkordeon-Saisons — ARM-Browser-Kompatibilität

- **Korrigiert — Akkordeon blockiert unter ARM Docker (zweiter Durchgang)**: Die CSS-Transition `gridTemplateRows` wird nicht in allen ARM-Browsern unterstützt. Ersetzt durch `max-height: 0 → 9999px` mit `overflow: hidden`, einer universellen Technik, die seit IE9 unterstützt wird — funktioniert ohne ResizeObserver, ohne JS-Animation, ohne Framer Motion.

---

## v1.13.04 — August 2026

### Korrektur Akkordeon-Saisons ARM Docker (tiefgehende Untersuchung)

- **Korrigiert — Akkordeon der Saisons blockiert unter ARM Docker**: Framer Motion interpretiert und animiert `gridTemplateRows` über JS, was auf ARM-Laufzeiten fehlschlagen kann. Die Animation wird nun vollständig vom CSS-Engine des Browsers gesteuert: Inline-Transition auf `gridTemplateRows` + `opacity`, ohne jegliche externe JS-Abhängigkeit. Das innere Div erhält `min-h-0`, um sicherzustellen, dass die CSS Grid Row tatsächlich auf 0 kollabiert. Der Inhalt ist immer noch im DOM vorhanden (durch die Grid versteckt), was auch den Fall eliminiert, dass `libSeason` undefined die Erweiterung stumm leer machte — wenn eine Serie nicht in der Bibliothek ist, wird stattdessen eine lokalisierte Meldung angezeigt.

## v1.13.03 — August 2026

### Korrektur Akkordeon-Saisons ARM/QEMU

- **Korrigiert — Akkordeon der Saisons blockiert unter ARM Docker**: Die Öffnungsanimation der Saisons basierte auf `height: "auto"` über Framer Motion, welches die Höhe über `ResizeObserver` misst. Unter ARM Docker (Mac Apple Silicon / QEMU) gibt `ResizeObserver` beim ersten Rendern 0 zurück, was die Animation unsichtbar und die Episodenliste unzugänglich macht. Die Animation erfolgt nun über `gridTemplateRows: "0fr" → "1fr"`, eine reine CSS-Interpolation ohne DOM-Messung — funktioniert identisch auf x64 und ARM.

---

## v1.13.02 — August 2026

### Information 2FA C411

- **Hinzugefügt — 2FA-Warnung im Formular C411**: Konten von c411.org mit aktivierter Zwei-Faktor-Authentifizierung (2FA) können die Entdecken-Listen nicht nutzen (jede neue Sitzung würde einen Code erfordern). Ein informativer Hinweis wird nun unter den Feldern Benutzername/Passwort angezeigt, um diese Einschränkung zu signalisieren. 5 Sprachen.

---

## v1.13.01 — August 2026

### Korrekturen Animationen und TVDB

- **Korrigiert — Kinomodus deaktiviert durch Toggle Animationen**: Das Deaktivieren der Animationen in Einstellungen → Dashboard trennte auch die Video-Wiedergabe im Kinomodus (Hero-Kinematik + Titelseitenkopf). Die beiden Parameter sind nun unabhängig: Das Abschalten der Animationen entfernt dekorative Übergänge/Effekte, blockiert aber niemals die Wiedergabe des Hintergrundvideos, welches nur durch seinen eigenen Autoplay-Toggle gesteuert wird.
- **Korrigiert — TVDB-Status-Badge fehlt im Tab Animiert**: Nach der Verschiebung des TVDB-Schlüssels in den Tab Metadaten in v1.13.00 war das Badge „TVDB konfiguriert / nicht konfiguriert“ im Tab Animiert verschwunden — der Toggle schien ohne visuelles Feedback über den Status des Schlüssels inaktiv. Das Badge wird im Tab Animiert (nur lesend) wiederhergestellt, mit einem Verweis auf den Tab Metadaten zum Eingeben oder Ändern des Schlüssels.

---

## v1.13.00 — August 2026

### Historie des Redesigns, Matching von Jahren, TVDB in Metadaten, Event Loop, Bottom Nav Mobile

- **Überarbeitung — Historie-Seite** : Zeitlinie nach Datum gruppiert (Heute / Gestern / Diese Woche / Dieser Monat / Älter), Karten mit farbigem Rahmen je nach Status, Fehlereinträge in Rot mit direkt angezeigter Fehlermeldung (ohne Klick), animierte Verschiebung beim Eintritt, illustrierter leerer Zustand, Ereigniszähler, automatische Aktualisierung alle 10 Sekunden. Vollständig in 5 Sprachen übersetzt (Statusbezeichnungen, Datumsgruppen, System, Score, Details).
- **Korrigiert — Matching: Jahresbandbreite auf ±2 erweitert** : Physische Veröffentlichungen (Blu-ray/DVD), die bis zu zwei Jahre nach dem ursprünglichen Kinostart veröffentlicht wurden, wurden vom Jahresfilter abgelehnt (z. B. Tafiti, deutscher Film 2024 mit französischer Blu-ray-Veröffentlichung 2026). Die Toleranz wird von ±1 auf ±2 in `releaseMatchWorker.mjs` und `matching.ts` erhöht, was auch den bereits vorhandenen Containment-Bonus für durch Veröffentlichungen gekürzte Titel aktiviert.
- **Verschoben — TVDB API-Schlüssel vom Reiter „Anime“ zum Reiter „Metadaten“** : Logische Gruppierung mit TMDb und OMDb. Der Reiter „Anime“ behält die beiden Umschalter (TVDB verwenden / Specials) und das Synchronisierungspanel bei. Die Navigationshinweise der beiden Reiter wurden aktualisiert. 5 Sprachen.
- **Vereinfacht — Event-Loop-Text in Performance** : Ersetzt durch einen klaren Einzeiler (Hauptthread-Latenz, grün = OK, rot = überlastet). 5 Sprachen.

---

## v1.12.98 — August 2026

### Korrektur Mobil — Hitbox untere Navigationsleiste

- **Korrigiert — Nicht klickbare Buttons am unteren Rand der mobilen Navigationsleiste** : Auf dem iPhone mit Home-Indikator (Safe-Area-Zone ≈ 34 px) wurde der `paddingBottom` der Safe-Area auf den Container `nav` und nicht auf jeden einzelnen Button angewendet. Mit `items-stretch` füllen die Kindelemente nur den Inhaltsbereich des Nav (ohne Padding) aus — die Safe-Area am unteren Rand war visuell vom Hintergrund der Leiste bedeckt, gehörte aber keinem klickbaren Element an. Das Padding wird nun von jedem Button mit `max(0.5rem, env(safe-area-inset-bottom))` getragen, wodurch die Hitbox bis zum unteren Bildschirmrand erweitert wird, während das Icon und die Beschriftung zentriert im sichtbaren Bereich bleiben.

---

## v1.12.97 — August 2026

### Korrektur C411 TMDb ID-Kollision + Verbesserung Matching von Szenenveröffentlichungen

- **Korrigiert — TMDb ID-Bereichkollision in C411-Listen** : TMDb verwendet zwei unterschiedliche ID-Bereiche (Filme und Serien), die sich überschneiden — dieselbe Nummer kann sowohl einen Film als auch eine andere Serie bezeichnen. Bisher wurde das zuerst gefundene Ergebnis (Seite Film) ohne Überprüfung übernommen, was die Anzeige eines Films anstelle einer Serie verursachen konnte. Die Lösung erfolgt nun über einen **Titel- + Jahreshinweis** von C411: Wenn eine ID auf beiden Seiten existiert, ermöglichen der in der Liste gespeicherte Titel und das Jahr die Auswahl des richtigen Bereichs. Der Cache ist versioniert (v2); ältere Einträge ohne Version werden ignoriert und neu berechnet, um zu verhindern, dass ein fehlerhaftes Urteil die 30-tägige TTL überdauert.
- **Verbessert — Matching von Szenenveröffentlichungen mit gekürztem Untertitel** : Szenenveröffentlichungen lassen oft den offiziellen Untertitel weg (z. B. „Tafiti“ statt „Tafiti - Ab durch die Wüste“), was sie um 0,50 unter den Matching-Schwellenwert senkte. Ein Containment-Bonus bringt den Score auf 0,85 zurück, wenn der Titel der Veröffentlichung vollständig im offiziellen Titel **und** das Jahr kompatibel sind — verschiedene Homonymfilme, die in einem anderen Jahr veröffentlicht wurden, bleiben abgelehnt.

---

## v1.12.96 — August 2026

### Entdecken — Verfeinerte Bezeichnung für den Empfehlungsbereich

- **Verfeinert — Empfehlungsbereich** : Die Bezeichnung der ersten Zeile auf der Seite „Entdecken“ ändert sich von „Für Sie & Beste“ zu **„Auswahl für Sie“** — lesbarer, sauberer, ohne ungeschickte Konjunktion. In 5 Sprachen übersetzt.

---

## v1.12.95 — August 2026

### Windows-Deinstallierer repariert, Docker-Container repariert, Wizard vervollständigt, C411-Login geklärt

- **Korrigiert — Docker-Container im Neustart-Loop**: Beim Start mit PUID/PGID, die von den Standardwerten des Images abweichen (der Standardfall bei einem NAS), löschte `docker-entrypoint.sh` die Gruppe `movviz` **bevor** ihren Benutzer — busybox weigert sich, eine Gruppe zu löschen, die die primäre Gruppe eines existierenden Benutzers ist („group in use“), daher schlug auch das folgende `addgroup` fehl und der Container starb in einer Schleife mit wiederholter Meldung „addgroup: group 'movviz' in use“. Die Reihenfolge wurde korrigiert (Benutzer vor Gruppe, bei jedem Schritt) und das Skript gibt nun die angeforderten UID und GID sauber frei, selbst wenn die Zielgruppe von ihrem Eigentümerbenutzer gesperrt ist. Das veröffentlichte amd64+arm64 Image wird mit diesem Fix neu generiert.
- **Korrigiert — Windows-Deinstallierer abgestürzt**: Die Installation endete mit einem Laufzeitfehler „Cannot call CreateInputOptionPage“ beim Start der Deinstallation (diese Funktion existiert nicht im Runtime des Inno Setup Deinstallierers, sondern nur im Installer — sie wurde mit der Frage „persönliche Daten löschen?“ in v1.12.91 eingeführt). Die Frage wird nun über ein natives Bestätigungsfeld am Ende der Deinstallation gestellt, **standardmäßig NEIN**: nichts wird jemals ohne ausdrückliche Bestätigung gelöscht, immer in 5 Sprachen, und die Daten (ProgramData) bleiben standardmäßig erhalten, um eine vollständige Neuinstallation zu ermöglichen.
- **Neu — Assistent**: Der letzte Schritt zeigt eine Karte „Kontenaktivierung“, die erklärt, dass das Administratorkonto bereits aktiv ist und dass die nächsten Konten (Registrierung oder Plex) in Einstellungen → Benutzer genehmigt werden müssen.
- **Klarifiziert — C411 Indizierer**: Die Bezeichnung „Website-Anmeldedaten“ gibt nun in Klammern an, dass der Login optional ist (er dient nur für die Entdecken-Listen, die Suche funktioniert ohne).

---

## v1.12.94 — August 2026

### Entdecken überarbeitet — Listen zusammengefasst, Serien und Filme strikt getrennt

- **Korrigiert — Vermischung von Serien/Filmen**: Die Listen von c411.org (Beliebt / Neueste Uploads / Tagesveröffentlichungen) zeigten in beiden Tabs eine Mischung aus Filmen und Serien. Sie werden nun durch den aktiven Tab (Filme oder Serien) gefiltert, ähnlich wie bei „Alles anzeigen“.
- **Neu — Zusammengefasste Listen**: Die Abschnitte der Seite „Entdecken“ sind mit Duplikatsentfernung gruppiert (ein Titel erscheint nicht zweimal):
  - „Für Sie & Beste“ (Vorschläge + Höchstbewertet)
  - „Trends & Beliebt“ (Movviz-Layout)
  - „Im Kino“ (Kinoprogramm + Box Office) und „Demnächst & VOD“ (Allociné-Layout, Filme)
  - „Neu & Erneuert“ (Allociné-Layout, Serien)
  - Von 11 auf 7 Abschnitte im Movviz-Layout, von 14 auf 9 im Allociné-Layout (Filme) und von 11 auf 7 (Serien). Jeder zusammengefasste Abschnitt hat sein paginiertes „Alles anzeigen“ (Cache 10 Min).
- **Entfernt — Genre-Kacheln**: Die Reihe von Genre-Kacheln (Duplikat des Genre-Filters in der Leiste) wurde entfernt.
- **Neu — Multi-Arch Docker Builds**: Die auf Docker Hub veröffentlichten Images werden wieder für `linux/amd64` **und** `linux/arm64` gebaut (QEMU + buildx reaktiviert).

---

## v1.12.93 — August 2026

### Indizierer — tatsächlicher Status, Schlüssel im Speicher und Verbindungsdiagnose

- **Neu — C411 Diagnose**: Der Abschnitt „Website-Anmeldedaten“ des C411-Bleistifts zeigt nun den tatsächlichen Serverstatus (aktive oder inaktive Listen, mit dem betroffenen Login) und einen Button „C411-Verbindung testen“, der einen echten Login mit den hinterlegten Anmeldedaten durchführt. Bei unvollständiger Konfiguration zeigt eine detaillierte Diagnose genau an, was fehlt (Listen / Anmeldedaten / Passwort). Das stille Fehlschlagen „Ich habe meine Anmeldedaten eingegeben, aber nichts wird angezeigt“ wird somit sichtbar und identifizierbar.
- **Neu — Schlüssel im Speicher**: Der Button „Kategorien anzeigen“ eines bereits konfigurierten Indizierers fordert nicht mehr zur erneuten Eingabe des API-Schlüssels auf — dieser wird automatisch vom Server übernommen (der Browser sieht ihn nie), und ein Hinweis „Schlüssel gespeichert — automatisch verwendet“ zeigt dies an. Funktioniert auch für den Anmeldedatenmodus.
- **Neu — „Verbindung testen“-Button** auf jedem Indexierer: Überprüft die URL und die Anmeldeinformationen in einer Sekunde und zeigt das Ergebnis an (OK oder den Indexiererfehler).
- **Korrigiert — stiller Speicher**: Das Formular akzeptiert nicht mehr das stille Fehlschlagen — schlägt die Speicherung auf Serverseite fehl, wird der Fehler angezeigt und das Formular bleibt geöffnet.
- **Korrigiert**: Der Katalogschlüssel (z. B. `c411`) wird bei einer Bearbeitung nun ebenfalls gespeichert, nicht nur bei der Hinzufügung.

---

## v1.12.92 — August 2026

### Crayon C411: Bearbeitbare Website-Anmeldeinformationen

- **Korrigiert**: Beim Crayon wurde der Abschnitt „Website-Anmeldeinformationen (Entdecken-Listen)“ (Login, Passwort, Listen-Toggle) bei einem bereits konfigurierten C411-Indexierer nie angezeigt — die Identität „C411“ ging beim Speichern verloren: Es wurden nur `kind: "torznab"` und die URL beibehalten, und das Formular erkannte den Indexierer nur nach seinem `kind`.
- **Neu**: Der Katalogschlüssel (z. B. `c411`) wird bei der Hinzufügung nun auf dem Indexierer persistent gespeichert, und bestehende Indexierer werden über ihre Katalog-URL erkannt (Fallback). Der Abschnitt Anmeldeinformationen wird daher auch bei der Bearbeitung angezeigt, und der Toggle „Entdecken-Listen“ geht beim Hinzufügen nicht mehr verloren (er wird nun bereits beim ersten POST gespeichert).

---

## v1.12.91 — August 2026

### Integration c411.org in die Entdecken-Seite

- **Neu**: Drei Listen von der Website c411.org werden im Tab Entdecken angezeigt — „Beliebt auf C411“, „Kürzliche Uploads auf C411“ und „Heute veröffentlicht auf C411“ (nur Film-/Video-Kategorie). Die Konto-Anmeldeinformationen werden unter Einstellungen → Indexierer → C411 (Abschnitt „Website-Anmeldeinformationen“) gespeichert, und jede Liste kann unabhängig aktiviert oder deaktiviert werden.
- Automatisch verwaltete Sitzung (Login mit CSRF, TTL 25 Min, Fallback auf einen zweiten Versuch), zeitlich gestaffelte Anfragen, um nicht blockiert zu werden, und TMDb-Auflösung von Veröffentlichungen mit 30-Tage-Cache: Ein Titel wird nur ab einem Mindestwert vorgeschlagen (exakter Titel oder Jahr + Typ), null falsch-positive Ergebnisse.
- **Korrigiert — Parsing von Veröffentlichungsnamen**: Unterstriche wurden vor der Tag-Analyse zu Punkten, „AD“ wird nur in Großbuchstaben erkannt (Filme wie „Ad Astra“ werden nicht mehr verunstaltet), die Kanäle „5.1“ und Release-Gruppen werden ignoriert, „10.bits“ wird zu 10BIT.

### Bearbeitungs-Crayon für alle Indexierer

- **Neu**: Jeder konfigurierte Indexierer (Torznab, C411…) verfügt über einen Stift, um seine Einstellungen zu bearbeiten, ohne ihn neu erstellen zu müssen — das Formular zeigt die vorhandenen Geheimnisse maskiert an und überschreibt sie nicht, wenn das Feld leer gelassen wird.

### Windows-Deinstallierer — Auswahl zum Löschen persönlicher Daten

- **Neu**: Die Deinstallation fragt explizit über ein Kontrollkästchen, ob alle persönlichen Daten (Bibliotheken, Verlauf, Downloads, Einstellungen — gespeichert in ProgramData) gelöscht werden sollen. Standardmäßig deaktiviert: Eine Neuinstallation behält alles bei, wie zuvor. Wenn aktiviert, schützt eine zusätzliche Bestätigung vor versehentlichem Löschen. Bildschirm in 5 Sprachen.

### Kino-Modus — Option „bei Überfahren“ entfernt

- **Bereinigung**: Das Auslösen des „bei Überfahren“-Trailers des Hero-Kinos war nicht zuverlässig; die Option wurde aus den Einstellungen entfernt (es verbleiben nur „Deaktiviert“ und „Automatisch“) und die Übersteuerungslogik des Heroes wurde entfernt.

---

## v1.12.90 — August 2026

### Serien mit einer Staffel, aufgeteilt in „Teile“ (DVD-Reihenfolge) — automatisch zusammengestellt

- **Korrigiert**: Veröffentlichungen einer Serie mit NUR einer Staffel, die in DVD-Reihenfolge in mehrere Teile aufgeteilt sind (z. B. Disjointed: 1 Staffel mit 20 Episoden, veröffentlicht als „S01.PART.01“ + „S02.S01.PART.02“, oder einfach „S01“ + „S02“), wurden nie gefunden — die angegebene Staffelnummer (S02) entsprach keiner Staffel in der Bibliothek, daher blieben die Episoden 11-20 bei den Indexierern nicht auffindbar.
- **Neu** : Erkennung des Markers « PART.N » im Release-Namen (`S01.PART.02`, `Teil 2`…) und Rückfall für Serien mit Ein-Saison-Format: Eine Release S02 (oder Teil 2) deckt die Episoden der zweiten Saisonhälfte ab (11-20 bei 20 Episoden). Die Auswahl der Engine-Dateien und der Import werden in derselben Nummerierung übersetzt, damit die Dateien `S02E01…E10` korrekt auf S1E11-20 landen.
- **Sicherheitsmechanismen** : Nur Serien mit einer einzigen Staffel; jede Multi-Staffel-Serie behält ihr exaktes Matching bei (eine echte Staffel 2 wird niemals als Teil interpretiert). Filme sind davon nicht betroffen.

---

## v1.12.89 — August 2026

### Episoden TBA behandelt als „kommend“ — Serien mit angekündigter, aber nicht datiert Staffel sind vollständig

- **Korrigiert** : Eine Episode ohne Veröffentlichungsdatum, aber mit dem Platzhaltertitel „TBA“ (TVDB/TMDb erstellten diese Episoden für angekündigte Staffeln, z. B. Gachiakuta S2), wurde als veröffentlicht behandelt → `missing` → und unendlich auf den Indexierern gesucht. Die Regel wird nun unter zwei separaten Bedingungen angewendet: zukünftiges Datum → „kommend“; kein Datum **und** TBA-Titel → auch „kommend“. Eine Episode ohne Datum mit echtem Titel behält das historische Verhalten (durchsuchbar).
- **Korrigiert — Statusberechnungen Serie/Staffel** : Eine Serie, deren alles noch „kommend“ ist (TBA oder zukünftige Daten), ist nun überall **vollständig** („verfügbar“) — in der Bibliotheksseite, Details, Entdeckung, Anfragen, Kalender — und fällt natürlich aus den Suchanfragen nach fehlenden Inhalten heraus (search all, retries 6h, RSS). Eine komplett „kommende“ Serie wird weiterhin als „kommend“ angezeigt.
- Überall angewendet: Serienerstellung (TMDb + TVDB anime), Backfill Staffel 0, Reparatur von TMDb-Staffeln, Plex-Sync (Erstellung + Aktualisierung), tägliche Datumsübergangsaufgabe.

---

## v1.12.88 — August 2026

### Erweiterte Plex-Diagnose + Externe GUIDs explizit von Plex angefordert

- **Hinzugefügt** — `GET /api/plex/diagnostic?title=...` zeigt nun die rohe GUID und das Array `Guid[]` an, wie sie von der Liste und von den Details (`/library/metadata/{ratingKey}`) gemeldet werden, plus die durch die Sync-Logik aufgelöste tmdbId — ermöglicht die Erklärung, warum ein Medium nicht verknüpft ist.
- **Verbessert — Plex-Sync** : Die Listenanfragen enthalten nun `includeExternalMedia=1`, den Plex-Parameter, der das Array `Guid[]` (tvdb://, imdb://, tmdb://) direkt in den `/all`-Antworten füllt.

---

## v1.12.87 — August 2026

### Plex-Verknüpfung erweitert auf Legacy GUIDs + Plex-Diagnose

- **Korrigiert — Plex-Sync** : GUIDs im Legacy-Format (`com.plexapp.agents.thetvdb://80741?lang=fr`, Agenten vor 2021) wurden nicht gelesen — nur das moderne Array `Guid[]`. Diese Serien konnten nie verknüpft werden, selbst mit der `/find`-Auflösung von v1.12.86. Das Legacy-Feld `guid` wird nun ebenfalls geparst (`thetvdb`/`imdb`/`tmdb`).
- **Hinzugefügt — Diagnose-Route** `GET /api/plex/diagnostic?title=...` (admin): Zeigt für jeden entsprechenden Plex-Titel den Typ, den ratingKey, die rohe GUID, das Array `Guid[]` und die durch dieselbe Logik wie beim Sync aufgelöste tmdbId — ermöglicht die Erklärung, warum ein Medium nicht verknüpft ist.

---

## v1.12.86 — August 2026

### Plex-Verknüpfung korrigiert für Medien ohne TMDb GUID + erweiterte Verknüpfungs-Tool

- **Korrigiert — Plex-Sync** : Die Identifikatorauflösung las nur die von Plex gemeldeten `tmdb://` GUIDs. Medien, die vom Plex-Agenten nur mit `tvdb://`/`imdb://` gematcht wurden (kanadische Serien, alte Agenten usw.), wurden **still ignoriert** — Dateien, die auf der Festplatte vorhanden und in Plex sichtbar waren, aber nie in Movviz verknüpft waren, und das Verknüpfungstool fand nichts zu reparieren (kein Pfad wurde gespeichert). **Korrigiert**: `imdb://`/`tvdb://` GUIDs werden nun über `/find` auf TMDb aufgelöst (gecached wie andere TMDb-Aufrufe), und bei TMDb-Duplikaten für denselben Titel hat der bereits in der Movviz-Bibliothek vorhandene Eintrag Vorrang. Bestätigt in der Produktion bei „Le cœur a ses raisons“: Die GUID `tvdb://80741` wird auf tmdb 2903 (2005) aufgelöst, vorhanden in der Bibliothek.
- **Verbessert — Dateiverknüpfung** (`repair-paths`) : Wenn der gespeicherte Dateiname nirgendwo mehr auf der Festplatte existiert, schlägt das Tool nun auch Dateien vor, deren Name das gleiche `SxxEyy` enthält (manuelle Bestätigungskandidaten – niemals automatische Verknüpfung nach diesem Kriterium).
- **Dokumentation** : Architekturplan „Movviz Federation“ archiviert in `docs/federation-plan.md`.

---

## v1.12.85 — August 2026

### Korrigierter Engine-Umbenennungsfehler + Isolierung der Fehlersuche (Quotas + Abbrechen)

- **Korrigiert — Engine** (`AbstractBackend.mjs`) : Fehler bei der Umbenennung von Packs — das geteilte Informationsobjekt (`releaseInfo`) wurde durch die Auflösung der Zieldatei mutiert, und für jede Datei ohne Episodennummer im Namen wurde dasselbe Objekt für die folgenden wiederverwendet: Die ERSTE passende Datei diktierte dann ihre Episode für alle anderen. Bestätigt in der Produktion an einem kompletten Trigun-Pack: 25 Dateien wurden als `S01E03` (dann `S01E04` beim 3. Import) umbenannt, E1 immer überschrieben. **Korrigiert**: Das Objekt wird nun pro Datei geklont (`{ ...info }`) — lokal mit den 28 echten Dateinamen des Packs reproduziert, jede Datei erhält ihre eigene Episode (E01-E26, eindeutig). Die neu bereitgestellte Engine benennt ein gesamtes Pack nie wieder auf dieselbe Episode um.
- **Indexer-Quotas (Anti-429)** : Quotas pro Indexer reaktiviert (`c411.org` = 15 Anfragen/Min dokumentiert, 20 Anfragen/Min Standard für jeden Host) + neues globales Limit von 40 Anfragen/Min (gleitendes Fenster 60 s). Angewendet VOR dem Senden jeder Anfrage (`fetchXml`), werden die dokumentierten Quotas nie überschritten. Die Gruppen-Suche „Fehlende suchen“ kann sich nicht mehr selbst 429er auferlegen (gemessen in der Produktion: Bereits ~35 Anfragen in ~35 s lösten einen 429 aus).
- **Job-Abbrechen** : Neue Route `POST /api/jobs/[id]/cancel` (Admin) + `requestCancelJob()`/`isJobCancelled()` in der Warteschlange + neuer Status `"cancelled"` (sauber abgesetzt über `JobCancelledError`, Flag am Ende bereinigt). Kooperative Kontrollpunkte auf allen Ebenen der Gruppen-Suche: zwischen Elementen des Batches, zwischen Staffeln, zwischen Episoden — noch nicht gesuchte Episoden bleiben einfach „fehlend“ und werden beim nächsten Durchlauf erneut versucht. Ein Job in der Warteschlange wird sofort entfernt; ein laufender Job stoppt an seinem nächsten Kontrollpunkt (wenige Sekunden).
- **UI** : Das Warteschlangen-Panel zeigt abgebrochene Jobs an (dediziertes Icon + Bezeichnungen `jobs.statusCancelled` in 5 Sprachen).

---

## v1.12.84 — August 2026

### Zuverlässiger Import von Staffel-/Komplettpacks — nie wieder leeres „S01E“ oder überschriebene Dateien

- **Kontext (in der Produktion bestätigt)** : Ein Staffelpack „Noblesse“ (20,3 GB) wurde zu 100 % heruntergeladen, aber nur 2 von 13 Episoden wurden importiert. Das Grab hatte keine `episodeTargets` — die Engine importierte dann ALLE Dateien blind, und jede Datei, deren Episodennummer nicht identifizierbar war, wurde mit einer LEEREN Episode umbenannt (`Noblesse - S01E.mkv`). Mehrere Dateien aus demselben Pack landeten dann am selben Zielpfad und **überschrieben sich gegenseitig** (die letzte ersetzte die vorherigen), die nie importierten Episoden blieben „fehlend“.
- **Korrigiert — Engine** (`AbstractBackend.mjs`) : Wenn die Episodennummer nach allen Fallbacks (Dateiname, Release, Ordner) unbekannt bleibt, behält die Datei nun ihren Originalnamen bei, anstatt des leeren Templates `S{season:00}E{episode:00}` — ein eindeutiger Name pro Datei, keine Kollision mehr, kein Überschreiben mehr, und die Datei immer noch vom Umbenennungs-Tool auffindbar. `avoidCollision()` wird nun auch auf Serien angewendet (wie auf Filme).
- **Korrigiert — Manueller Grab** (`/api/indexers/grab`) : Ein Grab von einem Serien-/Staffel-Eintrag gibt nun `episodeTargets` an die Engine (überwachte Episoden „fehlend“/„suchen“), genau wie ein automatisches Grab — die Engine lädt/importiert dann nur die Ziel-Episoden.
- **Präzision** : Der Import auf Bibliotheksseite hat sich nicht geändert — eine Datei ohne Episodennummer wird nie fälschlicherweise einer Episode zugeordnet („missing“, solange der Link nicht aufgelöst ist).

---

## v1.12.83 — August 2026

### Berechtigte Wörter — ein Begriff im Titel negiert das verbotene Wort

- **Neu** : In Einstellungen → Qualität wird ein Abschnitt „Erlaubte Wörter“ zu „Verbotene Wörter“ hinzugefügt. Wenn ein erlaubtes Wort im Titel einer Veröffentlichung enthalten ist, wird das entsprechende verbotene Wort aufgehoben. Typischer Fall behoben: Ein Nutzer hat eine Episode mit dem Vermerk „VOSTFR“ hochgeladen, obwohl es sich um ein Multi handelt — `Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p...` mit „VOSTFR“ verboten + „FRENCH“ erlaubt wird nun akzeptiert, während ein einfaches VOSTFR weiterhin abgelehnt wird.
- **Anwendung** : Die Logik befindet sich in `matchesBlockedWord()` (`releaseRules.ts`), daher respektieren alle Eingaben sie — automatische Suche (torznab), Entscheidungsguard, Dateiimport, Downloadabruf.
- **Treffer** : In nicht-case-sensitiver Unterzeichenfolge, wie bei den verbotenen Wörtern (Hinweis: „TRUEFRENCH“ enthält „FRENCH“).
- Tests : 6 neue Fälle in `scripts/allowed-words.test.ts` (23/23 grün).

---

## v1.12.82 — August 2026

### Veröffentlichung 1.12.82 — Encoding überprüft, CI-Pipeline auf einem sauberen Commit neu gestartet

- **Kontext** : Der erste Push von v1.12.81 erfolgte mit einem `package.json`, das durch ein BOM UTF-8 (`U+FEFF`) korrumpiert wurde, das durch eine PowerShell-Schreiboperation eingeführt wurde — der CI-Build (`next build` über `build.ps1`) schlug fehl mit `package.json is not parseable: invalid JSON: expected value at line 1 column 1`.
- **Korrigiert** : Das Encoding aller betroffenen Dateien (`package.json`, `README.md`, `CHANGELOG.md`, `autoGrabSeries.ts`, `torznab.ts`, `autoGrab.ts`, `mediaMap.ts`, `rssCache.ts`) wurde Byte für Byte überprüft — kein BOM, sauberes UTF-8. Der korrigierte Commit von v1.12.81 enthielt bereits den exakten Code ohne BOM; v1.12.82 startet von einer sauberen Basis aus und startet die gesamte Pipeline (Windows-Installer + Docker-Image) auf dem richtigen Commit.
- **Erinnerung** : Quellcodedateien dürfen NIEMALS über PowerShell 5.1 (`Set-Content`, Weiterleitungen) geschrieben werden — deren Standard-Encodings korrumpieren UTF-8 oder fügen ein BOM hinzu.

---

## v1.12.81 — August 2026

### Such-/Abgleich-Audit (TR4KER vs C411), link-before-download, Seerr-Benachrichtigungsflut und eine entdeckte Engine-Token-Diskrepanz

- **Behoben, live bestätigt**: Eine Serie wie „Ma vie avec les Walter Boys“ (tmdbId 199001) konnte nie abgerufen werden: Der französisch lokalisierte Titel wurde sowohl für die Indexer-Abfrage als auch für den lokalen Veröffentlichungsabgleich verwendet, während Szenenveröffentlichungen immer nach dem ORIGINAL-Titel benannt sind („My.Life.With.The.Walter.Boys.S03...“) — jeder Indexer gab 0 Treffer zurück. Suche und Abgleich bevorzugen nun `originalTitle` (der lokalisierte Titel bleibt als Alias erhalten), und die tägliche Metadatenaktualisierung füllt `originalTitle`/`tvdbId`/`imdbId` bei bereits existierenden Einträgen auf. TR4KER deklariert außerdem nur tvdb-Suchen (`tvSearchTvdb`, kein tmdb) — die tvdbid wurde ihm nie gesendet, da das Feld nicht existierte; `searchTv` sendet nun `tvdbid` (TR4KER) / `tmdbid` (C411) als vom Indexer unterstützt.
- **Behoben**: Eine fehlgeschlagene ID-Modus-Suche (Indexer-seitiger Fehler oder HTTP 5xx) verschluckte die gesamte Suche stumm — der Text-Fallback wurde nie ausgeführt. Sowohl `searchMovie`/`searchTv` fallen nun immer auf die Textabfrage zurück.
- **Behoben**: Die stündliche RSS-Aktualisierung zeigte stumm „C411:0“ — Indexerfehler wurden abgefangen und verworfen. Fehler werden nun pro Indexer protokolliert (`rss_refresh.indexer_error`) und ein Zyklus mit 0 Veröffentlichungen, während andere viele zurückgeben, warnt mit den Limits des Indexers (`rss_refresh.indexer_empty`).
- **Behoben**: Das Verlinken einer Veröffentlichung vor dem Download schlug mit „Impossible d'ajouter ce titre à la bibliothèque“ fehl, wenn der Titel bereits in der Bibliothek war — die Antwort `alreadyInLibrary` des Servers enthält nun den vorhandenen Eintrag, sodass der Picker direkt darauf verlinken kann. Ein Duplikat-Bibliotheksguard (`libraryEntriesMatch`, Titel/originalTitle/Aliase + kompatibles Jahr) verhindert außerdem, dass TMDb-Duplikate einen zweiten Bibliotheksdatensatz erstellen.
- **Behoben**: Die `[seerr] mediaId not found` Protokollflut — unbekannte tmdbIds werden nun für 1 Stunde als Fehlschläge zwischengespeichert (maximal einmal/Stunde Warnung) mit begrenzter Paginierung, und „processing“-Benachrichtigungen werden auf einen pro Titel pro Durchgang reduziert (`notifySeerrProcessingOnce`).
- **Fixed, environment**: Das Diagnoseprotokoll zeigte jeden abgelehnten Grab mit `{"error":"unauthorized"}` — die Web-App und die Download-Engine verwendeten unterschiedliche `engine-token.json`-Dateien (dev vs. Windows Service Install). Token-Dateien abgeglichen; ein expliziter Hinweis "TOKEN MOTEUR UNGÜLTIG" erscheint nun im Diagnoseprotokoll, wenn die Engine einen Grab wegen nicht autorisiert ablehnt.

---

## v1.12.80 — August 2026

### "Downloads abrufen" stürzte bei großen Download-Ordnern ab — jetzt in Stapeln, und die Tabs "Warteschlange/Verlauf" frieren nicht mehr bei tausenden Zeilen ein

- **Fixed, bestätigt live**: Die Wartungsaktion verarbeitete jede Datei in einer einzigen synchronen Anfrage. Bei hunderten Dateien (große Pakete, lange Warteschlange) konnte die Anfrage ablaufen oder Minuten dauern, und die Antwort renderte jeden wiederhergestellten/fehlgeschlagenen/doppelten Eintrag auf einmal — die Seite fror ein oder stürzte komplett ab. Der Scan läuft jetzt in Stapeln von 20 Dateien pro Anfrage: Das Panel wird automatisch mit den bereits versuchten Pfaden neu aufgerufen (der Server ist pro Pfad idempotent, daher wird eine dauerhaft fehlgeschlagene Datei einmal gemeldet und nicht innerhalb desselben Laufs erneut versucht), zeigt den Fortschritt bei Abschluss der Stapel an und begrenzt die gerenderte Liste auf 30 Einträge pro Abschnitt mit einem Hinweis "+N mehr" — die vollständigen Daten bleiben für die Aktionen "Duplikate löschen/Nicht übereinstimmend" verfügbar.
- **Fixed**: Der Tab "Warteschlange" rendert jede Torrent-Zeile (downloadend, seedend, abgeschlossen...) bei jedem 500-ms-Poll — Hunderte abgeschlossener Elemente mal tausende DOM-Knoten, was den Tab einfrieren ließ. Er rendert jetzt sofort die ersten 50 Zeilen (aktive Elemente werden zuerst sortiert, sodass die Live-Warteschlange sichtbar bleibt), wächst den Rest in Leerlauf und bietet einen "Mehr anzeigen"-Button. Dasselbe progressive Rendern wird auf den Tab "Aktivitätshistorie" angewendet, der bis zu 2000 Einträge enthält.
- Beide Änderungen betreffen nur das Rendern/die Leistung: Filter, Massenaktionen, Zähler und Bereinigungsbuttons verhalten sich genau wie zuvor.

---

## v1.12.79 — August 2026

### Behebung des vorherigen Fixes nach unabhängiger Überprüfung verstärkt

- Eine unabhängige Überprüfung des Recovery-Fixes von v1.12.78 entdeckte zwei echte Lücken, bevor sie Schaden anrichten konnten: Die neue Auflösung "vertraue dem eigenen Protokoll des Originals" hätte es ermöglicht, die eigene explizite, abweichende Staffelnummer einer Datei zu überschreiben — was bedeutet, dass eine falsch benannte Veröffentlichung stillschweigend in den falschen Staffelordner verschoben werden konnte. Es füllt nun nur eine Staffel/Episode ein, wenn der Dateiname selbst nichts angegeben hat, und überschreibt niemals eine Angabe. Außerdem war noch ein Platz (ein Film, der in einem Serien-Paket gebündelt ist) noch auf dem alten "nur raten"-Pfad, während alle anderen Fälle bereits aktualisiert wurden — jetzt ist dies bei allen konsistent.

## v1.12.78 — August 2026

### Grundursache, warum die Wiederherstellung von Downloads nicht neu verknüpfen konnte — die Wiederherstellung verwarf Informationen, die sie bereits besaß

- **Fixed, bestätigt live**: Es wurde ein spezifischer Fall (Wakfu) untersucht, bei dem das Download-Recovery-Tool keine Übereinstimmung für abgeschlossene Dateien finden konnte, obwohl die Serie bereits korrekt in der Bibliothek war. Grundursache: Die Wiederherstellung rät für jede Datei die Serie rein aus ihrem Dateinamen und dem Ordnerpfad neu, selbst für Dateien, deren ursprünglicher Download bereits wusste — mit Sicherheit, seit dem Moment des Grabs — genau, zu welcher Serie und Staffel sie gehörte. Diese autoritative Information wurde verworfen, bevor die Zuordnung pro Datei lief, und zwang jede Datei durch ein unsicheres Namensraten. Bei einer Serie, die als `Serientitel/Staffel 01/episode.avi` organisiert ist und einer Episoden-Datei, deren eigener Name kein erkennbares Staffel-Marker trägt, fiel dieses Raten auf das Lesen des Staffelordners selbst ("Staffel 01") als Serientitel zurück — was überhaupt keine Wörter mit dem echten Namen teilte, sodass es nie übereinstimmte.
- Die Wiederherstellung löst nun die Serie/Staffel einer Datei direkt aus ihrem eigenen Protokoll des Originals auf, wenn verfügbar, anstatt zu raten — und wenn sie doch auf das Lesen von Ordnernamen zurückfallen muss, prüft sie nun eine Ebene höher, wann immer sich der näherliegende Ordner als bloßer Staffelmarker ohne echten Titel herausstellt, anstatt beim ersten Ordner aufzuhören, unabhängig davon, was er tatsächlich enthält. Beide Fixes sind generisch — sie gelten für jede so organisierte Serie, nicht nur für die, die den Bug gezeigt hat.

## v1.12.77 — August 2026

### Der Kinomodus ließ die darunter liegende Seite sichtbar durchscheinen

- **Behoben, bestätigt live**: Der vorherige Fix machte den eigenen Hintergrund des Players transparent, damit die Farbatmosphäre durchscheinen konnte — aber nichts dahinter war eigentlich vollständig opak (die seitenfüllende Ebene ist nur zu ~80% schwarz durch einen Unschärfeeffekt, und die Farbschichten selbst stapeln mehrere teiltransparente Effekte ohne feste Basis). Die eigentliche Bibliotheksseite war durch die Letterbox-Balken sichtbar lesbar — schlimmer als das flache Schwarz, das sie ersetzt hat. Eine permanente, vollständig opake Basisschicht wurde unter alles andere hinzugefügt, sodass die Seite nie wieder durchscheinen kann, unabhängig davon, ob ein Titelbild für die Farbwiedergabe verfügbar ist oder nicht.

## v1.12.76 — August 2026

### Der inhaltsadaptive Hintergrund des Theatermodus war unsichtbar — behoben und für einen echten visuellen Eindruck neu ausbalanciert

- **Behoben, bestätigt live**: Die aus dem eigenen Artwork jedes Titels extrahierte Farbatmosphäre war strukturell versteckt — der eigentliche Hintergrund des Videoplayers war vollständig opak und wurde über die Atmosphärenschicht gemalt, sodass die Farbe nur für einen Augenblick während der Einblendanimation flackerte, bevor sie für die gesamte Betrachtungszeit vollständig verschwand. Darüber hinaus trug die Atmosphärenschicht selbst einen zweiten, fast undurchsichtigen schwarzen Vorhang, der direkt auf den Farbverlauf gestapelt war und das wenig, was durchschimmerte, während dieses Augenblicks auf fast nichts reduzierte. Nettoeffekt: flaches Schwarz, unabhängig vom Artwork des Titels.
- Der Hintergrund des Players ist nun transparent, wo er den Hintergrund durchscheinen lassen soll, und das Verhältnis von Vorhang/Verlauf wurde überarbeitet, sodass die extrahierte Farbe tatsächlich in den Letterbox-Bereichen um das Video sichtbar ist — ein helles, farbenfrohes Poster färbt nun sichtbar das Theater, ein dunkles bleibt stimmungsvoll, anstatt dass alles identisch aussieht.

## v1.12.75 — August 2026

### Grundursache für einen abgeschlossenen Season-Pack-Download, der in der Bibliothek nie erschien

- **Behoben, bestätigt live**: Ein spezifischer Fall wurde untersucht (ein Anime, dessen Season-Packs vollständig heruntergeladen waren — die Warteschlange zeigte sie als „abgeschlossen“ — aber keine der Episoden wurde jemals verfügbar). Die Grundursache: Einige Season-Pack-Veröffentlichungen benennen ihre Episodendateien nach der Serie in einer stark abgekürzten oder nicht standardmäßigen Form, die der Titelparser nicht erkennen kann (im bestätigten Fall ein Akronym, das keine Wörter mit dem echten Titel teilt) — daher wurden die Dateien des abgeschlossenen Downloads, als sie keinem verfolgten Episoden übereinstimmten, korrekt *nicht* gelöscht, aber der Wiederherstellungsdurchlauf, der genau diesen Fall erfassen soll, verzeichnete nur das Verpassen in einem Wert, den nichts je ausliest, sodass die Dateien unbegrenzt mit keiner Sichtbarkeit dort verblieben.
- Der Wiederherstellungsdurchlauf verzeichnet diese nun genauso wie ein wirklich nicht verknüpfter manueller Download: Sie erscheinen unter Aktivität → Nicht verknüpft, wo sie manuell dem richtigen Titel zugeordnet werden können — allgemein, für jede Veröffentlichung, deren Namen der Parser nicht zuversichtlich zuordnen kann, nicht spezifisch für die eine Serie, die es verursacht hat.

## v1.12.74 — August 2026

### Matching-Bug, der die falsche Serie erfassen konnte, und ein Job-Warteschlangenstau, der alle Hintergrundsuchen stumm einfrieren konnte

- **Behoben, bestätigt live**: Der Titel-Matching-Score behandelte zwei Titel als nahezu identisch, basierend nur auf der Rohzeichendistanz, selbst wenn sie sich um ein völlig anderes Wort unterschieden — bestätigt live mit „How I Met Your Father“ (einem nicht verwandten Spin-off), das mit einer Suche nach „How I Met Your Mother“ einen Ähnlichkeitswert von ~91% erzielte und an dessen Stelle erfasst wurde. Der Scorer prüft nun auch Wort für Wort: Ein völlig anderes Wort (keine Rechtschreibvariante) ist disqualifizierend, unabhängig davon, wie nah die Gesamtzeichenanzahl aussieht.
- **Behoben, bestätigt live**: Eine einzelne hängengebliebene Hintergrundaufgabe (in diesem Fall eine langsame Plex-Synchronisierung) konnte einen Job-Warteschlangenplatz unbegrenzt belegen und damit jeden anderen hinteregelegten Job stumm blockieren — einschließlich geplanter und manueller Suchen — so lange, wie sie hängen blieb, ohne Fehler oder Anzeige, dass etwas falsch war. Dies konnte dazu führen, dass ein überwachtes, korrekt hinzugefügtes Titel nie tatsächlich gesucht wurde. Die Warteschlange gibt nun den Job-Platz nach 10 Minuten frei, wenn er nicht abgeschlossen ist, sodass eine einzelne hängengebliebene Aufgabe nicht länger alles dahinter verhungern lassen kann.

## v1.12.73 — August 2026

### Beta-Player — Direktwiedergabe startet jetzt wie der manuelle „Blitz“-Wiederholungsversuch immer funktionierte

- **Behoben**: Der Player entschied früher, ob er einen direkten Playback-Versuch durchführen sollte, indem er die Unterstützung für Codecs mit Browser-APIs vorab überprüfte, die bei gängigen Fällen bekannt dafür sind, falsch zu melden (AC-3/E-AC-3 melden auf Chrome/Edge immer "nicht unterstützt", einige Container melden dekodierbares Video als nicht unterstützt) — wodurch viele Dateien an einen Transcode oder einen WebCodecs-Fallback weitergeleitet wurden, was der direkte Playback eigentlich problemlos hätte bewältigen können. Bestätigt live: Die manuelle Wiederholungs-Schaltfläche, die immer bedingungslos versucht hat, direkt abzuspielen, funktionierte merklich besser.
- Der direkte Playback ist jetzt der bedingungslose erste Versuch bei jedem Video, genau wie es die manuelle Wiederholung bereits tat — die beiden sind nun buchstäblich derselbe Code-Pfad und teilen sich die gleiche automatische Wiederherstellung (fällt bei einem tatsächlichen Wiedergabefehler oder bei wirklich leisem Audio auf den anderen Wiedergabemodus zurück, unverändert gegenüber zuvor).
- Die manuelle Wiederholungs-Schaltfläche profitiert nun auch von dieser automatischen Wiederherstellung und setzt an der aktuellen Position fort, anstatt von Null neu zu starten.
- Entfernt den nun vollständig ungenutzten WebCodecs-Playback-Pfad, in den diese Vorprüfung früher geleitet hat — er war streng genommen eine schlechtere, redundante Version dessen, was der direkte Playback + die bestehende Fallback-Kette bereits abdecken.

## v1.12.72 — August 2026

### Theatermodus — ein echtes immersives Player, kein Video in einem Modal

- **Neu**: Der Beta-Player öffnet sich jetzt in einem vollen „Theatermodus“ — die aktuelle Seite bleibt genau dort, wo sie war (Scrollposition, Zustand, alles), der Player erweitert sich vom geklickten Button mit einem echten geometrischen Übergang (kein Verblassen), und die dahinterliegende Seite dimmt und verschwimmt progressiv, anstatt einfach zu verschwinden.
- Jeder Umgebungs-Trailer oder Vorschau, die irgendwo auf dem Bildschirm abgespielt wird, stoppt sofort, wenn der eigentliche Player geöffnet wird — niemals zwei Videos gleichzeitig abgespielt.
- Der Hintergrund des Players nimmt nun eine subtile Farbambiance an, die aus dem eigenen Artwork des Titels extrahiert wird (dominante Töne, helligkeitsbewusst) anstatt einheitlich schwarz zu sein — einmal pro Titel analysiert und zwischengespeichert, niemals während der Wiedergabe.
- „In Plex lesen“ zeigt nun „Lesen“ dort, wo der Beta-Player die Wiedergabe tatsächlich handhaben wird, und bleibt „In Plex lesen“, wo es ein echtes Übergabe an Plex ist — konsistent auf jeder Titelkachel, der Titelseite, der Episodenseite und dem Dashboard-Hero (was zuvor überhaupt keine Beta-Player-Integration hatte).
- Die drei separaten Kopien dieser Trigger-Logik in der App sind nun eine gemeinsame Implementierung, wodurch die Lücke geschlossen wird, in der ein zukünftiger Fix an einer Stelle landen und an anderen übersehen werden könnte.

### In-App „Was ist neu“ folgt nun Ihrer Spracheinstellung

- Release-Notes werden nun pro UI-Sprache lokalisiert (mit einem Fallback auf Englisch für alles, was noch nicht übersetzt wurde), anstatt einer einzigen festen Sprachdatei.
- **Behoben**: Die Release-Notes fehlten sowohl bei den Docker- als auch bei den Windows-Builds still — die Datei, aus der sie gelesen wurden, war in keinem der gepackten Builds enthalten, sodass das „Was ist neu“-Popup nichts anzeigen konnte.

## v1.12.70 — August 2026

### Download-Engine — Ursache für dauerhaft nicht verknüpfte Downloads

- **Behoben, bestätigt live**: Das Entfernen eines Torrents aus der Download-Engine meldete Erfolg und löschte seine eigene Verfolgung (einschließlich der Bibliothek, zu der er gehörte), selbst wenn der zugrunde liegende Download-Client es nicht tatsächlich entfernen konnte — der Torrent lief weiter und seedete unberührt, aber die Engine hatte keinen Eintrag mehr. Dies führte zu Downloads, die niemals mit einem Titel verknüpft werden konnten, egal wie oft ein Wiederherstellungs-Scan lief. Die Engine löscht nun ihre Buchhaltung nur, wenn die Entfernung unabhängig bestätigt wurde; andernfalls bleibt der Torrent verfolgt und kann wiederholt werden, anstatt zu einem permanenten Waisenstück zu werden.

## v1.12.51 – v1.12.69 — August 2026

Matching accuracy and engine reliability pass: complete-series pack detection (season-range terms, false-positive guards), stuck-download recovery hardened to atomic no-overwrite moves with a reliable import callback, per-series/movie write locking to close a race that could drop a completed episode's status, and duplicate-download reconciliation so a re-grabbed file no longer leaves the library stuck on the wrong status. User guide refreshed to cover recently shipped features (title editing, movie versions, unlinked-download linking, anime settings).

## v1.12.24 – v1.12.50 — August 2026

Vollständige Serien-Pack-Suche (Single-Query, Saisonbereich-Bewusstsein), Download-Wiederherstellungszuverlässigkeit (Ordner-Scan, verwaiste Datei-Abgleich, Duplikatbereinigung), gesicherte Duplikatlöschung und eine kleine automatisierte Testsuite für den Release-Matching-Kern.

## v1.10.90 – v1.12.23 — Juli–August 2026

Quality-Upgrade-Workflow (Optimieren / Ignorieren, sinnvolle Upgrade-Erkennung), ein überarbeitetes Auflösungs-/Codec-Badge-System, GPU-/Animations-Leistungsprofile und Engine-Stabilisierung über die austauschbaren Download-Backends (Crash-Fixes, Anti-Stall-Regel, Serien-spezifisches Suchsperren).

## v1.10.39 – v1.10.89 — Juli 2026

Download-Engine-Neuschreibung mit austauschbaren Backends (native/aria2, WebTorrent, libtorrent), ein Wartungs-Tool „Downloads wiederherstellen“ für verwaiste Dateien, ein Premium-Toast-Benachrichtigungssystem, Audio-Codec-Badges und Beta-Verbesserungen der In-App-Wiedergabe (Direktwiedergabe, Transkodierungs-Logging).

## v1.10.12 – v1.10.17 — Juli 2026

Spracherkennungsgenauigkeits-Pass: Audiotrack-Sprache von Plex gelesen, französische Varianten-Tags (VF/VFQ/VFF/TRUEFRENCH) erfüllen Qualitätsprofile korrekt, Bereinigung von Duplikat-Episoden und ein Fix für vorzeitiges Torrent-Verlassen.

## v1.10.1 – v1.10.6 — Juli 2026

Decision Guard (Pre-Grab-Blacklist-Durchsetzung), Franchise-/Kollektionserkennung, ein überarbeitetes Download-Warteschlangen- und Diagnose-Dashboard sowie Verfeinerungen für Trailer/Kalender.

## v1.8.0 – v1.9.9 — Juli 2026

Vereinheitlichtes Titel-Panel (ein einzelnes Bauteil für die Slide-in- und Vollseitenansichten), ein Papierkorb-/Recycling-Bin-Sicherheitsnetz für entfernte Titel, Mobile-Responsiveness-Pass und ein Fix für ein Speicherleck im Metadaten-Cache.

## v1.4.5 – v1.7.9 — Juli 2026

Sicherheitsverstärkung (Pfad-Traversal, Datenbank-Schutz, CodeQL-Alarme), die endgültigen Schutzmechanismen des Papierkorbsystems, ein Live-In-App-Player, Echtzeit-Updates über die gesamte UI, Plex-Aktivitätsüberwachung und Support für Sammlungen.

## v1.1.67 – v1.4.4 — Juli 2026

In-App-Player mit automatischer Plex-Transcode-Fallback, Drittanbieter-Anfrageimport (Seerr-kompatibel), Multi-Architektur-Docker-Builds und eine Reduzierung der Einstellungsnavigation von 26 Tabs auf 18.

## v1.1.50 – v1.1.66 — Juli 2026

Erste öffentliche Veröffentlichung: TMDb-Entdeckung, Torznab/Newznab-Indexer-Suche, vereinheitlichte Film-/Serienbibliothek, Multi-Benutzer-Anfragen, die integrierte BitTorrent-Engine und Plex-Sync – plus frühe Stabilitäts- und Sicherheits-Fixes (Sitzungsbehandlung, Bibliotheks-Deduplizierung, Abhängigkeits-Upgrades).
