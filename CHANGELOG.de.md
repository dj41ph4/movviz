# Changelog

Alle relevanten Änderungen an Movviz, gruppiert nach Entwicklungsmeilenstein.

---

## v1.13.43 — August 2026

### Zurücknahme der Plex-Sitzungs-IDs pro Versuch aus v1.13.41/v1.13.42 — das brachte die Wiedergabe im Produktivbetrieb komplett zum Absturz

- **Zurückgenommen**: jedem Versuch eine eigene, saubere Plex-Sitzungs-ID zu geben, sollte verhindern, dass erneute Versuche still auf eine blockierte Sitzung zurückfallen — stattdessen zeigten Live-Tests auf dem echten Server, dass Plex jede Sitzungs-ID ablehnt, die nicht exakt dem einen deterministischen Wert entspricht, den Movviz schon immer verwendet hat, mit einem sofortigen `400 Bad Request`, unabhängig davon, ob die alte Sitzung vorher explizit beendet wurde oder nicht. Der Fix aus v1.13.42 (vor dem Start explizit beenden) änderte daran nichts — die Erklärung der Vorversion („dieses NAS erlaubt nur einen aktiven Transcodierungs-Job") war bestätigt falsch: Dieser Server mit Plex Pass verarbeitet mehrere gleichzeitige Transcodierungen problemlos. Die tatsächliche Ursache ist noch nicht verstanden. Saubere Rückkehr zur einen deterministischen Sitzungs-ID, die immer funktioniert hat, unter Beibehaltung des Timing-Fixes für die Eskalation ta=0→ta=1 aus v1.13.40/41 (ein vorübergehender Fehler beim ersten HLS-Segment eskaliert nicht mehr sofort — er bekommt zuerst einen echten erneuten Versuch).

## v1.13.42 — August 2026

### Beta-Player: die pro Versuch eindeutigen Plex-Sitzungs-IDs aus v1.13.41 wurden grundsätzlich abgelehnt — dieses NAS erlaubt nur einen aktiven Transcodierungs-Job pro Datei

- **Behoben**: live bestätigt — jedem Versuch eine eigene Plex-Sitzungs-ID zu geben (v1.13.41) behob den alten Fehler (Versuche, die still auf eine blockierte Sitzung zurückfielen), deckte aber einen neuen auf: Der Plex dieses Servers weigert sich kategorisch, eine wirklich neue zweite Transcodierungs-Sitzung für eine Datei zu starten, die bereits eine registrierte hat — selbst eine, die der Player abgebrochen hat, ohne sie sauber zu beenden. Jede dieser Anfragen kam sofort mit `400 Bad Request` zurück, ohne Start, ohne Segment, nichts. Die alte Sitzung wird jetzt explizit beendet, bevor eine neue angefordert wird, wodurch der Platz frei wird, den Plex braucht, um den nächsten Versuch zu akzeptieren.

## v1.13.41 — August 2026

### Beta-Player: Versuche, den Ton zu kopieren, und der Rückfall auf eine echte Transcodierung fielen bei derselben blockierten Plex-Sitzung immer wieder still zurück

- **Behoben**: live bestätigt — nach einem vorübergehenden Fehlschlag beim allerersten HLS-Segment startete der Player tatsächlich eine neue `Hls`-Instanz für einen erneuten Versuch (und um auf eine echte Audio-Transcodierung umzuschalten), aber die bei jeder Anfrage an Plex gesendete Sitzungs-ID war eine feste Zeichenkette `movviz-{Nutzer}-{Film}`, identisch unabhängig von der Anzahl der Versuche. Plex startete dadurch bei einem erneuten Versuch oder einem Rückfall nie einen neuen, sauberen Transcodierungs-Job — es nutzte weiterhin denjenigen weiter, der bereits unter dieser ID registriert war, sodass ein einziges blockiertes Segment auch den Rückfall auf unbestimmte Zeit zum Scheitern bringen konnte, obwohl die Neucodierung selbst nichts Kaputtes hatte. Jeder wirklich neue Versuch (erste Wiedergabe, erneuter Versuch, Rückfall und Wechsel von Qualität/Spur während der Wiedergabe) erhält jetzt seine eigene Plex-Sitzungs-ID, genau wie es ein echter Plex-Client tut.

## v1.13.40 — August 2026

### Beta-Player: die Direktwiedergabe konnte eine rohe MKV-Datei ausliefern, deren Audiospur der Browser nie decodierte

- **Behoben**: live bestätigt — eine rohe MKV-Datei, die unverändert von Plex an den Browser weitergegeben wurde, konnte das Bild einwandfrei abspielen, während `webkitAudioDecodedByteCount` während der gesamten Wiedergabe bei null blieb, ganz ohne Fehler, einfach Stille. Wenn die Direktwiedergabe für eine Spur, die hls.js tatsächlich aus MPEG-TS (AAC/MP3/AC-3) demultiplexen kann, auf den HLS-Rückfall umschaltet, fordert der Player jetzt eine verlustfreie Audiokopie an — dasselbe Neuverpacken, das auch der Plex-Client selbst erhält, ohne zusätzliche Kosten für den Server — und prüft anhand der tatsächlich decodierten Audioenergie, wobei erst dann auf eine echte Neucodierung umgeschaltet wird, wenn diese Kopie wirklich stumm bleibt. Der Browser-Codec-Unterstützungstest, von dem diese Entscheidung abhing, wurde entfernt; er lieferte falsch-negative Ergebnisse, die unnötige Neucodierungen erzwangen. E-AC-3/DTS/TrueHD gehen weiterhin direkt in eine echte Transcodierung — der MPEG-TS-Demultiplexer von hls.js hat für diese Formate schlicht keinen Parser, eine echte Grenze der Bibliothek, keine Vermutung.
- **Behoben**: Movviz sendete den Header `X-Plex-Session-Identifier` nie bei irgendeiner Plex-Anfrage, im Gegensatz zu einem echten Plex-Client — auf dem gesamten Streaming-/Transcodierungs-Anfragepfad hinzugefügt.

## v1.13.39 — August 2026

### Eine Einstellung hinzugefügt, um die YouTube-Suche für Trailer zu aktivieren — standardmäßig deaktiviert, was erklärt, warum sie auf Englisch blieben

- **Hinzugefügt**: der Rückfall per YouTube-Suche für Trailer (verwendet, wenn TMDb keinen in deiner Sprache hat) ist Seiten-Scraping, keine offizielle API — das hängt davon ab, dass YouTube die IP des Servers nicht blockiert, und schon ein einziger stiller Fehlschlag bleibt 24 Stunden im Cache. Deshalb war das standardmäßig deaktiviert. Diese Standardeinstellung ist der Grund, warum Trailer auf Englisch blieben, obwohl der Mechanismus existiert und einwandfrei funktioniert, wenn man ihn direkt testet. Ein neuer Schalter unter Einstellungen → Übersicht ("Trailer") erlaubt es, ihn zu aktivieren — weiterhin standardmäßig deaktiviert, aber jetzt eine explizite und sichtbare Wahl statt einer stillen.

## v1.13.38 — August 2026

### Die Dolby Digital+-Änderung aus v1.13.35 zurückgesetzt — sie verschlimmerte die Stille, nicht umgekehrt

- **Zurückgesetzt**: die AC-3/E-AC-3 vom Anti-Stille-Sicherheitsnetz auszunehmen, ging davon aus, dass die Direktwiedergabe bei diesen Codecs immer echten Ton hatte — live bestätigt, dass das nicht auf jeder Maschine zutrifft. Chromium bringt keinen eigenen AC-3/E-AC-3-Decoder mit; das hängt von einem auf Betriebssystemebene registrierten Decoder ab, der auf manchen Windows-Installationen fehlt (das variiert je nach Maschine, nicht je nach Movviz). Das Sicherheitsnetz zu entfernen bedeutete, dass eine Maschine ohne diesen Decoder in völliger Stille landete, ganz ohne Rückfalloption, statt der automatischen Umschaltung auf einen transkodierten (also hörbaren) Stream, die vorher vorhanden war. Das Sicherheitsnetz ist genau wie zuvor zurück — ein echter Fix, der einen tatsächlichen Dekodierfehler vom blinden Fleck des Sicherheitsnetzes bei diesen Codecs unterscheidet, erfordert mehr Sorgfalt, als dieser jetzt zurückgenommene Versuch hatte.

## v1.13.37 — August 2026

### Titel, die in „Suche" feststeckten, ließen die Kachel „Läuft herunter" ansteigen, ohne dass irgendetwas das erklärte

- **Hinzugefügt**: statt Elemente in „Suche" einfach nicht mehr als Download mitzuzählen (vorherige Version), haben sie jetzt ihre eigene dedizierte Kachel „Suche läuft" im Dashboard — diese Zahl verschwindet nicht, sie landet einfach dort, wo sie wirklich hingehört.

## v1.13.36 — August 2026

### Die Kachel „Läuft herunter" im Dashboard konnte eine Zahl anzeigen, obwohl in Wirklichkeit nichts heruntergeladen wurde

- **Behoben**: die Kachel zählte auch Episoden/Filme im Status „Suche" (aktive Suche nach einer Release, ohne dass bereits ein Torrent geholt wurde) so, als würden sie heruntergeladen. Live bestätigt: eine ganze Staffel, die in „Suche" feststeckte, ohne dass ein Torrent aktiv war, ließ den Zähler auf 9 steigen, obwohl tatsächlich kein Download lief. Die Kachel zählt jetzt nur noch Elemente mit einem tatsächlich aktiven Download.

### Der Wiedergabe-Button eines Titels konnte ohne Erklärung vollständig verschwinden

- **Behoben**: der Wiedergabe-Button einer Titelseite hing vollständig davon ab, ob Plex die Datei bereits verknüpft hatte — eine Datei, die auf Movviz-Seite bereits bereit war, die Plex aber noch nicht in seiner eigenen Bibliothek gescannt hatte (eine normale asynchrone Verzögerung), zeigte überhaupt keinen Button an, statt etwas, das die Wartezeit erklärte. Es wird jetzt ein klar deaktivierter Platzhalter mit Tooltip angezeigt, statt zu verschwinden.

### Zwei nicht zusammenhängende Buttons der Titelseite teilten sich exakt dasselbe Symbol

- **Behoben**: „Versionen verwalten" und „Saga/Sammlung ansehen" verwendeten beide dasselbe Stapel-Symbol, was bei einem Titel, der beides hat, verwirrend war. Der Link zur Sammlung verwendet jetzt ein visuell klar unterscheidbares Symbol.

## v1.13.35 — August 2026

### Beta-Player: Die Direktwiedergabe in Dolby Digital+ hatte nach einem kürzlichen Update den Ton verloren

- **Behoben**: das Anti-Stille-Sicherheitsnetz (das die tatsächlich dekodierte Audioenergie einige Sekunden lang zu Beginn der Direktwiedergabe überwacht und bei anhaltender Stille auf ein Transkodieren umschaltet) erfasst den Ton über einen an das Video-Element angeschlossenen Web-Audio-Graphen — nur dass AC-3/E-AC-3 (Dolby Digital/Digital+) außerhalb der Rendering-Engine dekodiert wird, sodass dieser Graph diesen Ton schlicht niemals beobachten kann. Das Sicherheitsnetz löste daher bei diesen beiden Codecs systematisch fälschlich aus und erzwang eine Audio-Transkodierung, obwohl die Direktwiedergabe von Anfang an tatsächlich Ton hatte. Eine kürzliche Version hat den manuellen Button „erneut direkt starten" auf denselben Codepfad wie den ersten automatischen Versuch vereinheitlicht, wodurch dieser zuvor seltene Grenzfall systematisch wurde. AC-3/E-AC-3-Spuren sind jetzt vollständig von diesem Sicherheitsnetz ausgenommen — die Direktwiedergabe bleibt direkt, mit echtem Ton, genau wie zuvor.

## v1.13.34 — August 2026

### Dieselbe Benachrichtigung konnte tagelang für bereits verfügbare Inhalte weiter erscheinen

- **Behoben**: Benachrichtigungen wurden nie dedupliziert — eine geplante Aufgabe, die einen Inhalt erneut scannt, den sie nach dem Import nicht vollständig bereinigen kann, konnte bei jedem Durchlauf genau dieselbe „jetzt verfügbar"-Benachrichtigung erneut auslösen, live bestätigt mit einer Benachrichtigung über eine verfügbare Staffel, die sich alle ~30 Minuten für einen Titel wiederholte, der bereits seit einer Woche verfügbar war. Dieselbe Benachrichtigung mit denselben Details löst jetzt nur noch einmal pro Ein-Stunden-Fenster aus; eine echte Wiederholung später (zum Beispiel Tage danach) läuft weiterhin ganz normal durch.

### Der Dashboard-Modus „Klassisch" wurde überarbeitet, um „Kino" ohne den Hero zu übernehmen

- **Geändert**: der Modus Klassisch übernimmt jetzt alles, was der Modus Kino bietet — die kompakten Statistik-Pillen und das vollständige Zeilen-Layout (Tendances, Passende Vorschläge, Kürzlich hinzugefügt usw.) — nur ohne den großen Hero-Banner oben, laut Rückmeldung. Zuvor fiel er auf ein einfaches Raster von Statistikkacheln und eine flache Liste „kürzlich hinzugefügt" ohne jede der Kino-Reihen zurück.

## v1.13.33 — August 2026

### Button zum manuellen Seeden abgeschlossener Downloads hinzugefügt

- **Hinzugefügt**: ein abgeschlossener Download in der Warteschlange hat jetzt einen eigenen Button, um sein Seeding zu starten oder zu stoppen, unabhängig von den Pause/Fortsetzen-Steuerelementen, die aktiven Downloads vorbehalten sind. Das Deaktivieren stoppt tatsächlich die Upload-Aktivität, nicht nur einen angezeigten Status — bei der Standard-Engine wird der Torrent dabei vollständig von den Peers getrennt; das erneute Aktivieren stellt dies wieder her und baut bei Bedarf die ursprüngliche Dateistruktur neu auf, falls die Dateien bereits in die Bibliothek verschoben wurden, ohne dabei jemals die Kopie in der Bibliothek anzurühren oder erneut herunterzuladen.

### Titel der Poster-Reihen waren nicht unter den Karten zentriert

- **Geändert**: der Titel unter jedem Poster in den Dashboard-Reihen (Tendances, Vorschläge, Kürzlich hinzugefügt) ist jetzt unter dem Poster zentriert, laut Rückmeldung — zuvor konnte er verschoben sein, besonders in der als Top 10 eingestuften Reihe.

## v1.13.32 — August 2026

### Downloads zeigten nie eine verbleibende Zeit an

- **Behoben**: das Feld „verbleibende Zeit" der Warteschlange wurde nur von zwei der drei Download-Engines berechnet — die Standard-Engine (diejenige, die im Alltag tatsächlich verwendet wird) übermittelte nie einen `timeRemaining`-Wert, sodass das Feld in der Warteschlange immer leer blieb. Es wird jetzt auf dieselbe Weise berechnet, wie es die anderen Engines bereits tun (verbleibende Bytes geteilt durch die aktuelle Geschwindigkeit), sodass ein laufender Download nun eine echte Schätzung anzeigt.

## v1.13.31 — August 2026

### Ein gültiger Dateipfad konnte stillschweigend durch Plex' Sicht des Dateisystems überschrieben werden

- **Behoben**: bei jeder Plex-Synchronisierung konnte ein bereits korrekter und funktionierender Dateipfad für einen Film oder eine Episode durch den von Plex selbst gemeldeten Pfad überschrieben werden. Wenn Plex und Movviz in getrennten Containern mit unterschiedlichen Mount-Punkten für dieselben physischen Dateien laufen, existiert der von Plex gemeldete Pfad aus Sicht des Dateisystems von Movviz nicht — ein einwandfrei funktionierender Pfad wurde dadurch stillschweigend kaputt, was „Pfade reparieren" mit Fehlalarmen für Titel überschwemmte, die eigentlich nie ein Problem hatten. Movviz lernt jetzt automatisch die Zuordnung zwischen der Art, wie Plex Pfade sieht, und seiner eigenen — indem es für einen bereits korrekt erfassten Titel dessen eigenen, verifiziert funktionierenden Pfad mit dem vergleicht, was Plex für genau diesen Titel meldet — und übersetzt künftige Plex-Meldungen anhand dieser gelernten Zuordnung, statt ihnen blind zu vertrauen. Kein Einstellungsbildschirm, keine manuelle Konfiguration: Movviz leitet die Zuordnung selbst aus Daten ab, die es bereits mit Sicherheit kennt. Ein Pfad wird nur geschrieben, wenn zuvor überprüft wurde, dass er tatsächlich auf der Festplatte vorhanden ist — eine fehlerhafte oder veraltete Zuordnung kann im schlimmsten Fall eine falsche „fehlend"-Meldung erzeugen (manuell korrigierbar), aber niemals einen stillen Verlust des Verweises auf eine echte Datei.

## v1.13.30 — August 2026

### "Pfade reparieren" konnte Hunderte völlig unabhängiger Dateien als Kandidaten vorschlagen

- **Behoben**: wenn eine defekte Episodendatei nicht anhand ihres exakt gespeicherten Dateinamens gefunden wurde, verglich der letzte Rückfallmechanismus sie mit ALLEN Videodateien der gesamten Bibliothek mit derselben Staffel-/Episodennummer — unabhängig davon, zu welcher Serie sie tatsächlich gehörten. Live bestätigt: eine einzige defekte Episode konnte mit über 500 "Kandidaten" zurückkommen, die in Wirklichkeit einfach Episode 1, Episode 2 usw. jeder anderen Serie waren. Dieser Rückfallmechanismus bietet jetzt nur noch Dateien an, die plausibel zur tatsächlichen Serie gehören (anhand von Datei- oder Ordnername), sodass die Vorschlagsliste wieder kurz und relevant ist. Vorhanden seit v1.12.86 — keine Änderung aus diesem jüngsten Fix-Paket, und kein anderer Abgleichspfad (exakter Dateiname, erwarteter Pfad, oder die Duplikat-Konfliktwarnung) wurde angerührt.

### Top-10-Zahlen in der Tendances-Reihe überlappten das Poster zu stark

- **Geändert**: die Rangzahl hinter jeder Top-10-Karte in der „Tendances"-Reihe saß zu weit unter dem Poster verborgen, sodass links nur ein schmaler Streifen sichtbar blieb. Sie überlappt die Karte jetzt deutlich weniger — der größte Teil der Zahl ist links sichtbar, nur die Hinterkante bleibt dahinter verborgen, laut Rückmeldung.
- **Geändert**: die „Tendances"-Reihe wird jetzt zuerst im Dashboard angezeigt, über „Kürzlich hinzugefügt", laut Rückmeldung.

### "Fehlende herunterladen" bei einer Sammlung konnte den falschen Titel statt des wirklich fehlenden erfassen

- **Behoben**: zwei Bugs, die sich summierten, beide live an mehreren Sammlungen bestätigt. Erstens berechnete die Schaltfläche die fehlenden Titel anhand eines geteilten, app-weiten zwischengespeicherten Schnappschusses von Bibliothek/Sammlung, der veraltet sein konnte, ohne dass auf dem Bildschirm etwas sichtbar falsch aussah — Bibliothek und Teileliste der Sammlung werden jetzt beide unmittelbar vor dem Herunterladen frisch überprüft. Zweitens, und das wog schwerer: eine Duplikatsprüfung, die den Fall erkennen sollte, dass TMDb denselben bereits veröffentlichten Film unter zwei verschiedenen IDs listet, verwendete einen unscharfen Titelabgleich ohne echte Jahresanforderung — sie konnte stillschweigend einen bereits vorhandenen, unabhängigen Eintrag für eine unbestätigte, vorläufige Franchise-Karteikarte wiederverwenden, oder einen echten Film mit einer Featurette derselben Reihe verwechseln, die um ein Jahr versetzt war und ein zusätzliches Titel-Suffix hatte. Diese Prüfung verlangt jetzt auf beiden Seiten einen exakt übereinstimmenden, normalisierten Titel UND ein exakt übereinstimmendes, bestätigtes Erscheinungsjahr, bevor sie einer Übereinstimmung vertraut.

### Freundeskonten bekamen alle die Wiedergabehistorie des Server-Besitzers

- **Behoben**: jedes verknüpfte Freundeskonto hatte tatsächlich eine echte, eigenständige Plex-Identität und ein eigenes Token — trotzdem synchronisierten sie alle exakt dieselben Zahlen wie das Konto, dem der Server gehört. Grundursache bestätigt durch das dokumentierte Verhalten von Plex selbst: die Endpunkte, die zur Synchronisierung des Wiedergabestatus verwendet werden, liefern den `viewCount` nur aus der Perspektive des Server-Besitzers zurück, unabhängig davon, welches gültige Konto-Token die Anfrage stellt — kein Request-Header kann daran etwas ändern. Die Wiedergabestatus-Synchronisierung verwendet jetzt den Sitzungshistorie-Endpunkt von Plex, abgefragt mit dem Admin-Token und gefiltert nach der eigenen Plex-ID jedes Kontos — so, wie Plex das Sehverhalten tatsächlich pro Konto verfolgt — und funktioniert jetzt gleich für Freundeskonten und Home-verwaltete Profile, statt zweier getrennter Pfade.

## v1.13.22 — August 2026

### „Für dich" ist wieder streng pro Konto, und ein fehlgeschlagener Plex-Watch-Sync sieht nicht mehr aus wie „nichts geschaut"

- **Geändert**: die "Haushalts"-Vermischung aus v1.13.21 wurde zurückgenommen — nach weiterem Feedback wird „Für dich" wieder AUSSCHLIESSLICH aus der eigenen Plex-Wiedergabehistorie des Kontos aufgebaut, ohne jedes Signal von anderen Konten, auch nicht ein kleines. Ein Konto mit nur ein paar angesehenen Titeln erhält jetzt eine personalisierte Reihe allein daraus, statt vorher ein Minimum erreichen zu müssen, bevor überhaupt etwas angezeigt wird.
- **Behoben**: die Plex-Wiedergabestatus-Synchronisierung verschluckte jeden Fehler stillschweigend (Netzwerkaussetzer, abgelaufenes Token, nicht erreichbare Sektion) und speicherte trotzdem ein leeres Ergebnis — nicht zu unterscheiden von „dieses Konto hat wirklich nichts geschaut", und in der Lage, bei einem vorübergehenden Fehler unbemerkt eine echte Wiedergabehistorie zu löschen. Sie lässt bestehende Daten jetzt unangetastet, wenn eine Synchronisierung keine einzige Bibliothekssektion erreichen kann, und jeder Sync-Versuch — erfolgreich oder fehlgeschlagen, und für welches Konto — wird in Einstellungen → Logs protokolliert, sodass ein still fehlschlagendes Konto endlich sichtbar ist, statt nur leer zu wirken.

## v1.13.21 — August 2026

### "Für dich" kann sich jetzt auf die Plex-Historie des ganzen Haushalts stützen, nicht nur auf deine eigene

- **Neu**: wenn die eigene Plex-Sehhistorie eines Accounts dünn oder leer ist, mischt seine Zeile "Für dich" jetzt auch das ein, was andere Accounts auf derselben Instanz gesehen haben (mit geringerer Gewichtung als die eigene Historie des Accounts) — damit ein Account ohne eigene Plex-Verknüpfung trotzdem eine echte, personalisierte Zeile bekommt statt des generischen "Am besten bewertet"-Rückfalls. Das greift erst, sobald mindestens zwei andere Accounts über echte eigene Sehdaten verfügen — der Geschmack eines einzelnen anderen Accounts dient nie als Ersatzsignal für den "Haushalt", um zu vermeiden, dass die Auswahl einer Person heimlich auf jemand anderen übertragen wird. Die eigene Zeile jedes Accounts bleibt genauso persönlich wie zuvor; das fügt nur ein breiteres Signal hinzu und ersetzt nie die eigene Historie des Accounts, wenn sie bereits vorhanden ist.

## v1.13.20 — August 2026

### Episodentitel und -beschreibungen kamen unabhängig von der Sprache der Benutzeroberfläche immer auf Französisch zurück

- **Behoben**: der Staffel-/Episoden-Datenaufruf (Vorschaubilder, Titel, Beschreibungen — hinzugefügt in v1.13.12, in v1.13.19 auf Serien in der Bibliothek erweitert) teilte TMDb nie mit, in welcher Sprache geantwortet werden soll, sodass für alle Nutzer stillschweigend auf Französisch zurückgefallen wurde, selbst wenn Deutsch (oder eine andere Sprache) als Sprache der Benutzeroberfläche ausgewählt war. Das war exakt derselbe Fehler, der bereits einmal für die Detailseiten behoben wurde — nur eben nie auf diesen speziellen Aufruf angewendet. Er folgt jetzt der in der App gewählten Sprache, wie überall sonst auch.

## v1.13.19 — August 2026

### Episoden-Vorschaubilder und -Beschreibungen jetzt überall sichtbar, nicht nur bei Serien, die noch nicht in der Bibliothek sind

- **Behoben**: v1.13.12 fügte jeder Episodenzeile ein Vorschaubild und eine kurze Beschreibung hinzu, aber nur bei Serien, die noch nicht in der Bibliothek waren — Episoden bereits vorhandener Serien wurden als reine Textzeilen ohne jede Vorschau angezeigt. Beide Ansichten greifen jetzt auf dieselben Live-TMDb-Daten zurück, sodass eine heruntergeladene/verfügbare Episode genau dieselbe Vorschau zeigt wie eine noch nicht geholte — ohne dass vorhandene Qualitäts-Badges, die „gesehen"-Markierung, das Status-Pill oder Suchen-Buttons verschwinden.
- **Behoben**: die Ausstrahlungsdaten in derselben Liste wurden im Locale-Format des Browsers angezeigt, unabhängig von der in Movviz gewählten Sprache (z. B. die US-Reihenfolge Monat/Tag selbst bei ausgewähltem Deutsch) — sie folgen jetzt konsequent der Sprache der App, wie alle anderen Daten in Movviz.

## v1.13.18 — August 2026

### Das erneute Ausführen eines teilweise importierten Staffelpakets konnte versuchen, dessen übrig gebliebene .nfo-Datei in eine Episodendatei umzubenennen

- **Behoben**: Sobald alle echten Videodateien eines Staffelpakets bei einem früheren Teildurchlauf bereits zugeordnet und verschoben worden waren, fand ein erneuter Versuch keine Videodateien mehr vor und griff stattdessen auf die erste verbliebene Datei zurück — einschließlich der `.nfo`-Datei der Release —, behandelte diese als „die zu importierende Episode", versuchte sie in etwas wie `S03E02.nfo` umzubenennen und scheiterte, sobald das nicht mit dem tatsächlichen Inhalt der Festplatte übereinstimmte. Übrig gebliebene `.nfo`-/`.txt`-/Bild-/Checksummendateien sind niemals Episodeninhalt und werden nach Abschluss des Imports ohnehin automatisch bereinigt — sie werden jetzt vollständig von diesem Abgleich ausgeschlossen, statt einen für den Nutzer sichtbaren Importfehler zu verursachen.

## v1.13.17 — August 2026

### Die angekündigten Verlangsamungs-Logs sind jetzt tatsächlich unter Einstellungen → Logs sichtbar

- **Behoben**: Das Suchdiagnose-Log konnte seinen 2000-Zeilen-Puffer bei schweren Hintergrundläufen in wenigen Minuten füllen (jede Episodensuche schreibt ~10 Zeilen, mehrere davon als Debug) und stieß dabei stillschweigend die wichtigen Info-Zeilen heraus — einschließlich der neuen Zeilen zu Hintergrundverlangsamungen. Der Puffer fasst jetzt 4000 Zeilen, sodass `priority.yield`-Einträge den Lärm überleben.
- **Neu**: Das Log-Panel unter Einstellungen → Logs aktualisiert sich jetzt live — alle 5 Sekunden, solange der Tab sichtbar ist; Zeilen aus Hintergrundarbeit erscheinen also sofort statt erst nach manueller Aktualisierung. Kein erneutes Rendern, wenn sich nichts geändert hat.
- **Behoben**: Alle Log-Quellen sind jetzt an einem Ort — das Transcode-Log-Panel wurde vom Tab Diagnose zu Einstellungen → Logs verschoben, das nun Such-/Diagnose-, Engine-, Resolver- und Transcode-Logs zusammen zeigt.
- **Geändert**: Zeilen zu Hintergrundverlangsamungen haben jetzt eine eigene Farbe im Panel, damit „Arrière-plan bridé [bulk manquants]…“-Einträge sofort ins Auge springen.

## v1.13.16 — August 2026

### Verlangsamungen des Hintergrunds sind jetzt in den Logs sichtbar — inklusive des verantwortlichen Benutzers

- **Neu**: Hintergrundarbeiten (der manuelle Bulk "Alle fehlenden suchen", geplantes RSS-Matching, Qualitäts-Upgrades, Wiederholungen für fehlende Veröffentlichungen) pausieren jetzt, solange du die App aktiv benutzt, und setzen einige Sekunden nach deinem Aufhören fort — du spürst es nie. Jedes Mal, wenn eine solche Verlangsamung tatsächlich auftritt, protokolliert das Diagnose-Suchlog sie in einer sauberen, lesbaren Zeile: welche Hintergrundaufgabe gebremst wurde, welcher Benutzer aktiv war (Name + ID) und wie lange die Wartezeit dauerte (z. B. „Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Behoben**: Stilles Frontend-Polling zählt nicht mehr als Benutzeraktivität. Die Statusabfragen (Engine-Torrents alle 500 ms, Jobs alle 2 s, Perf-Messungen alle 5 s, Plex-Aktivität alle 5 s, Wiedergabefortschritt alle 10 s …) hielten die App für immer als „aktiv“ markiert, sobald eine einzige Seite offen blieb — der Hintergrund konnte also nie richtig fortfahren. Jetzt zählen nur echte Interaktionen (Navigation, Suchen, Klicks): lass die App offen und der Hintergrund setzt einige Sekunden nach deinem letzten Klick fort.
- **Geändert**: Der manuelle Bulk-Suchlauf läuft jetzt wie die geplanten Aufgaben in der Hintergrund-Spur — er erbt das reduzierte Indexer-Kontingent (deine eigenen Suchen behalten Priorität) und gibt zwischen den Einträgen nach.

## v1.13.15 — August 2026

### Navigationsleiste blieb nach dem Zurückscrollen an den Seitenanfang undurchsichtig

- **Behoben**: Die in v1.13.12 hinzugefügte transparent-zu-undurchsichtig-Navigationsleiste wurde beim Herunterscrollen korrekt undurchsichtig, kehrte aber beim Zurückscrollen ganz nach oben nie wieder zur Transparenz zurück. Umstellung auf eine zuverlässigere Erkennungsmethode, damit die Scrollposition nun in beiden Richtungen korrekt wiedergegeben wird.

## v1.13.14 — August 2026

### Dashboard-Zeilen können jetzt ein vollständiges Raster öffnen — "Alle anzeigen" war nie wirklich angebunden

- **Behoben**: Die Karussells des Dashboards ("Für dich", "Kürzlich hinzugefügt", "Demnächst", "Trends") hatten eine "Alle anzeigen"-Funktion, die direkt in die Zeilenkomponente eingebaut war, aber keine Dashboard-Zeile übergab ihr jemals ein Ziel — sie erschien deshalb stillschweigend nie, bei keiner Zeile, seit dieser Teil des Dashboards ursprünglich gebaut wurde. Zeilen bleiben genau wie kompakte horizontale Streifen; "Alle anzeigen" öffnet jetzt die vollständige Menge als echtes, filterbares Raster (Entdecken für Empfehlungs-/Trend-Zeilen, deine Bibliothek — passend vorgefiltert — für Zeilen, die aus bereits Vorhandenem stammen).

## v1.13.13 — August 2026

### Der Beta-Player ist jetzt eine persönliche Wahl pro Konto, standardmäßig deaktiviert

- **Geändert**: Bisher hatte der Beta-Player einen einzigen Ein/Aus-Schalter für die gesamte Instanz — schaltete ein Admin ihn ein, änderte sich stillschweigend das Wiedergabeverhalten für jedes Konto. Jetzt gibt es zwei Ebenen: einen Admin-Schalter in den Einstellungen, der die Funktion nur überhaupt verfügbar macht, und einen persönlichen Schalter auf der eigenen Profilseite jedes Nutzers, der sie tatsächlich für das eigene Konto aktiviert — standardmäßig deaktiviert, unabhängig davon, was der Admin eingestellt hat.

## v1.13.12 — August 2026

### Sechs Browsing-Verbesserungen aus einem Design-Review

- **Neu**: Zeilen zeigen jetzt eine dünne Scrollpositions-Anzeige und Randpfeile, die bei Hover erscheinen, und scrollen um eine ganze Seite statt frei zu ziehen.
- **Neu**: Die Reihe "Trends" hebt jetzt ihre Top 10 mit einer nummerierten Ranking-Darstellung hervor, basierend auf derselben echten Popularitätsreihenfolge, nach der die Reihe bereits sortiert war.
- **Neu**: Beim Hovern über eine Poster-Karte (Desktop) werden nun kurz Jahr, Laufzeit und Genre-Tags angezeigt, sofern verfügbar, statt nichts.
- **Geändert**: Die obere Navigationsleiste ist jetzt ganz oben auf der Seite transparent und wird beim Scrollen sofort deckend.
- **Geändert**: Die Episodenliste für einen Titel, der noch nicht in deiner Bibliothek ist, zeigt jetzt ein Vorschaubild und eine kurze Beschreibung pro Episode, statt nur einer nackten Zeile. (Episoden von Titeln, die bereits in deiner Bibliothek sind, haben das noch nicht — das erfordert neue, beim Import erfasste Daten, separat verfolgt.)
- **Neu**: Auf Mobilgeräten verwendet der Dashboard-Hero jetzt eigens erstellte Hochformat-Grafiken statt einer zugeschnittenen Version des Desktop-Banners.

## v1.13.11 — August 2026

### Die Anzeigepersonalisierung folgt jetzt deinem Konto, nicht nur deinem Browser

- **Geändert**: Das GPU-Leistungsprofil, Animationen, das Theme (hell/dunkel/automatisch), die Oberflächensprache und die Ansichtsdichte der Bibliothek wurden nur im Browser gespeichert — beim Wechsel von Gerät oder Browser wurde alles auf die Standardwerte zurückgesetzt. Sie werden jetzt in deinem Konto gespeichert und folgen dir überall, wo du dich anmeldest, während sie weiterhin sofort auf dem gerade genutzten Gerät angewendet werden.
- **Verschoben**: Der Schalter "Animationen" befindet sich jetzt unter Einstellungen → Leistung GPU, direkt neben dem Profil, das er tatsächlich betrifft, statt unter Dashboard.

## v1.13.10 — August 2026

### Schaltflächen der mobilen unteren Navigationsleiste funktionierten nur bei Tippen oberhalb des Symbols

- **Behoben, live bestätigt**: Auf Mobilgeräten passierte beim direkten Tippen auf die Tab-Schaltflächen Kalender/Anfragen/Mehr oft nichts — aber Tippen knapp darüber funktionierte. Ursache: Der Toast-Benachrichtigungscontainer ist überall eingebunden und bleibt jederzeit auf der Seite bestehen, selbst wenn keine Benachrichtigungen angezeigt werden. Seine mobile Ebene erstreckt sich über die gesamte Bildschirmbreite, liegt genau über der unteren Tab-Leiste und ist unsichtbar — aber ein unsichtbares Element blockiert Klicks darunter trotzdem, sofern ihm nicht ausdrücklich das Gegenteil mitgeteilt wird. Taps, die in diesem Überlappungsbereich landeten, trafen still ins Leere, statt die Tab-Schaltfläche zu erreichen.
- Der unsichtbare Container blockiert jetzt nichts mehr darunter; nur eine tatsächlich sichtbare Benachrichtigung (selten und kurz) bleibt weiterhin antippbar/schließbar, genau wie zuvor.

## v1.13.09 — August 2026

### Die Blood+-Matching-Korrektur aus v1.13.06 hatte nie tatsächlich gegriffen — die wahre Ursache gefunden

- **Behoben, live bestätigt**: v1.13.06 hatte die Titel-Matching-Funktion so korrigiert, dass "+" als das Wort "plus" behandelt wird (damit "Blood+" nicht mit nicht verwandten Serien verwechselt wird). Doch die manuelle Suche zeigte weiterhin "Blood Of Zeus", "Dexter New Blood", "Blood-C" und andere als gültige Kandidaten für "Blood+" an — weil ein völlig anderer, früherer Schritt (derjenige, der aus einer Suchfeld-Eingabe den tatsächlich an die Indexer gesendeten Text macht) das "+" entfernte, bevor die korrigierte Matching-Funktion es überhaupt zu sehen bekam, wodurch diese Korrektur bei jeder echten Suche still und leise wieder aufgehoben wurde. Eine Suche nach "Blood+" kam beim Matcher als das nackte Wort "Blood" an, das natürlich fast alles mit "Blood" im Titel trifft.
- Dieser frühere Schritt bewahrt jetzt ebenfalls "+" und "&" als Wörter, genau so, wie es die Matching-Funktion bereits tat — womit die eigentliche Lücke geschlossen wird, nicht nur die der Funktion, die wie die Quelle des Problems aussah.

## v1.12.79 — August 2026

### Die vorherige Korrektur nach einer unabhängigen Überprüfung gehärtet

- Eine unabhängige Überprüfung der Recovery-Korrektur aus v1.12.78 deckte zwei reale Lücken auf, bevor sie zuschlagen konnten: Die neue Auflösung "vertraue dem eigenen Datensatz des ursprünglichen Downloads" hätte eine explizite, abweichende Staffelnummer aus dem eigenen Dateinamen überschreiben können — was bedeutet, dass eine falsch beschriftete Release still und leise im falschen Staffelordner hätte landen können. Sie ergänzt jetzt nur noch eine Staffel/Episode, die der Dateiname selbst noch nicht lieferte, und überschreibt nie eine bereits vorhandene. Außerdem lief eine verbleibende Stelle (ein Film, der in einem Paket der Kategorie Serien gebündelt war) noch auf dem alten, rein vermutungsbasierten Pfad, während jeder andere Fall bereits aktualisiert worden war — jetzt über alle Fälle hinweg konsistent.

## v1.12.78 — August 2026

### Ursache dafür, dass auch die Download-Wiederherstellung nicht neu verknüpfen konnte — Recovery verwarf Informationen, die es bereits besaß

- **Behoben, live bestätigt**: ein konkreter Fall untersucht (Wakfu), bei dem das Download-Recovery-Tool keine Übereinstimmung für abgeschlossene Dateien finden konnte, obwohl die Show bereits korrekt in der Bibliothek vorhanden war. Ursache: Recovery erriet die Show jeder Datei erneut, rein anhand von Dateiname und Ordnerpfad — selbst bei Dateien, deren ursprünglicher Download bereits ab dem Moment des Grabbens mit Sicherheit wusste, zu welcher Serie und Staffel sie gehörten. Diese maßgebliche Information wurde verworfen, bevor der Abgleich pro Datei ausgeführt wurde, sodass jede Datei stattdessen durch eine unscharfe Vermutung anhand des Dateinamens laufen musste. Bei einer Show, die als `ShowName/Saison 01/Episode.avi` organisiert ist, mit einer Episodendatei, deren Name selbst keinen erkennbaren Staffel-Hinweis trägt, griff diese Vermutung auf das Lesen des Staffelordners selbst ("Saison 01") als Show-Titel zurück — der kein einziges Wort mit dem echten Namen teilt, sodass nie eine Übereinstimmung zustande kam.
- Recovery ermittelt die Show/Staffel einer Datei jetzt direkt aus dem eigenen Datensatz des ursprünglichen Downloads, sofern vorhanden, statt zu raten — und wenn doch auf das Lesen von Ordnernamen zurückgegriffen werden muss, prüft es jetzt eine Ebene höher, sobald sich der nähere Ordner als bloßer Staffel-Marker ohne echten Titel darin herausstellt, statt beim ersten Ordner stehenzubleiben, unabhängig von dessen tatsächlichem Inhalt. Beide Korrekturen sind generisch — sie gelten für jede so organisierte Show, nicht nur für diejenige, bei der der Fehler aufgefallen ist.

## v1.12.77 — August 2026

### Kinomodus ließ die dahinterliegende Seite sichtbar durchscheinen

- **Behoben, live bestätigt**: Die vorherige Korrektur machte den Hintergrund des Players selbst transparent, damit die Farbstimmung durchscheinen konnte — aber nichts dahinter war tatsächlich vollständig deckend (die Abdunklungsebene der Seite ist über einen Weichzeichner nur zu etwa 80 % schwarz, und die Farbebenen selbst stapeln mehrere teiltransparente Effekte ohne solide Basis). Die echte Bibliotheksseite war am Ende sichtbar lesbar durch die Letterbox-Balken hindurch — schlimmer als das flache Schwarz, das sie ersetzte. Es wurde eine dauerhafte, vollständig deckende Basisebene unter allem anderen hinzugefügt, sodass die Seite nie wieder durchscheinen kann, mit oder ohne verfügbares Artwork eines Titels für die Farbextraktion.

## v1.12.76 — August 2026

### Der inhaltsadaptive Hintergrund des Kinomodus war unsichtbar — behoben und für echte visuelle Wirkung neu ausbalanciert

- **Behoben, live bestätigt**: Die aus dem jeweiligen Artwork eines Titels extrahierte Farbstimmung war strukturell verborgen — der Hintergrund des Video-Players selbst war vollständig deckend und wurde über der Stimmungsebene gezeichnet, sodass die Farbe nur für einen kurzen Moment während der Eröffnungsanimation aufblitzte, bevor sie für die gesamte restliche Wiedergabedauer vollständig verschwand. Zusätzlich trug die Stimmungsebene selbst eine zweite, nahezu deckende schwarze Abdunklung, die direkt über dem Farbverlauf lag und das wenige, das während dieses Moments durchschien, auf fast nichts reduzierte. Nettoeffekt: durchgehend Schwarz, unabhängig vom Artwork des Titels.
- Der Hintergrund des Players ist jetzt dort transparent, wo der Hintergrund durchscheinen soll, und das Verhältnis zwischen Abdunklung und Farbverlauf wurde neu austariert, sodass die extrahierte Farbe in den Letterbox-Bereichen rund um das Video tatsächlich sichtbar ist — ein helles, farbenfrohes Poster taucht den Kinoraum jetzt sichtbar in Farbe, ein dunkles bleibt stimmungsvoll gedeckt, statt dass alles gleich aussieht.

## v1.12.75 — August 2026

### Ursache eines abgeschlossenen Staffelpaket-Downloads, der nie in der Bibliothek auftauchte

- **Behoben, live bestätigt**: ein konkreter Fall untersucht (ein Anime, dessen Staffelpakete vollständig heruntergeladen waren – die Warteschlange zeigte sie als „abgeschlossen" – aber keine der Folgen jemals verfügbar wurde). Die Ursache: manche Staffelpaket-Releases benennen ihre Episodendateien nach der Show in einer stark abgekürzten oder unüblichen Form, die der Titel-Parser nicht erkennen kann (im bestätigten Fall ein Akronym, das kein einziges Wort mit dem echten Titel teilt) – als die Dateien des abgeschlossenen Downloads also keiner erfassten Folge zugeordnet werden konnten, wurden sie korrekterweise *nicht* gelöscht, aber der Recovery-Durchlauf, der genau diesen Fall abfangen soll, hielt den Fehltreffer nur in einem Wert fest, den niemand jemals ausliest – sodass die Dateien unbegrenzt lange ohne jegliche Sichtbarkeit liegen blieben.
- Der Recovery-Durchlauf erfasst diese jetzt auf dieselbe Weise, wie es ein wirklich nicht verknüpfter manueller Download bereits tut: Sie erscheinen unter Activité → Non liés, wo sie manuell dem richtigen Titel zugeordnet werden können – generisch, für jede Release, deren Namen der Parser nicht sicher zuordnen kann, nicht nur für die eine Show, bei der es aufgefallen ist.

## v1.12.74 — August 2026

### Matching-Fehler, der die falsche Serie erfassen konnte, und ein Job-Queue-Stau, der still alle Hintergrundsuchen einfrieren konnte

- **Behoben, live bestätigt**: Der Titel-Matching-Score behandelte zwei Titel allein aufgrund der reinen Zeichendistanz als nahezu identisch, selbst wenn sie sich durch ein völlig anderes Wort unterschieden — live bestätigt mit „How I Met Your Father" (ein unverwandtes Spin-off), das bei einer Suche nach „How I Met Your Mother" eine Ähnlichkeit von ca. 91 % erzielte und stattdessen erfasst wurde. Der Scorer prüft jetzt zusätzlich Wort für Wort: Ein völlig anderes Wort (keine Rechtschreibvariante) disqualifiziert die Übereinstimmung, unabhängig davon, wie nah die Gesamtzeichenzahl beieinanderliegt.
- **Behoben, live bestätigt**: Eine einzelne hängengebliebene Hintergrundaufgabe (in diesem Fall eine langsame Plex-Synchronisierung) konnte einen Job-Queue-Slot unbegrenzt lange belegen und dabei still jeden anderen wartenden Job dahinter blockieren – einschließlich geplanter und manueller Suchen – solange die Aufgabe hängen blieb, ohne jeglichen Fehler oder Hinweis, dass etwas nicht stimmte. Genau das konnte dazu führen, dass ein überwachter, korrekt hinzugefügter Titel nie tatsächlich gesucht wurde. Die Queue gibt den Slot eines Jobs jetzt nach 10 Minuten frei, falls er noch nicht abgeschlossen ist, sodass eine einzelne hängende Aufgabe nicht mehr alles dahinter aushungern kann.

## v1.12.73 — August 2026

### Beta-Player — direkte Wiedergabe startet jetzt so, wie der manuelle „Blitz"-Wiederholungsversuch schon immer funktionierte

- **Behoben**: Der Player entschied bisher, ob eine direkte Wiedergabe versucht wird, indem er die Codec-Unterstützung vorab mit Browser-APIs prüfte, die dafür bekannt sind, bei gängigen Fällen zu „lügen" (AC-3/E-AC-3 wird auf Chrome/Edge stets als „nicht unterstützt" gemeldet, manche Container meldeten problemlos dekodierbares Video als nicht unterstützt) — was viele Dateien in ein Transcoding oder einen WebCodecs-Fallback umleitete, obwohl die direkte Wiedergabe sie tatsächlich problemlos verarbeitet hätte. Live bestätigt: Der manuelle Wiederholungs-Button, der stets bedingungslos direkte Wiedergabe ohne diese Vorabprüfung versuchte, funktionierte merklich besser.
- Direkte Wiedergabe ist jetzt der bedingungslose erste Versuch bei jedem Video, genau wie es der manuelle Wiederholungsversuch bereits tat — beide sind jetzt buchstäblich derselbe Codepfad, mit derselben automatischen Wiederherstellung (Rückfall auf den anderen Wiedergabemodus bei einem echten Wiedergabefehler oder bei tatsächlich stummer Tonspur, unverändert gegenüber vorher).
- Auch der manuelle Wiederholungs-Button profitiert jetzt von derselben automatischen Wiederherstellung und setzt an der aktuellen Position fort, statt wieder von vorn zu beginnen.
- Der inzwischen vollständig ungenutzte WebCodecs-Wiedergabepfad, in den diese Vorabprüfung früher umleitete, wurde entfernt — er war lediglich eine schlechtere, redundante Version dessen, was direkte Wiedergabe zusammen mit der bestehenden Fallback-Kette bereits abdeckt.

## v1.12.72 — August 2026

### Theatermodus — ein echter immersiver Player, kein Video in einem Modal

- **Neu**: Der Beta-Player öffnet sich jetzt in einem vollwertigen „Theatermodus" — die aktuelle Seite bleibt genau dort dahinter stehen, wo sie war (Scrollposition, Zustand, alles), der Player vergrößert sich vom angeklickten Button aus mit einem echten geometrischen Übergang (keine Überblendung), und die Seite dahinter verdunkelt und verwischt sich schrittweise, statt einfach zu verschwinden.
- Jeder ambiente Trailer oder jede Vorschau, die irgendwo auf dem Bildschirm läuft, stoppt in dem Moment, in dem sich der echte Player öffnet — niemals zwei Videos gleichzeitig.
- Der Hintergrund des Players nimmt jetzt eine subtile Farbstimmung an, die aus dem Artwork des Titels selbst extrahiert wird (dominante Töne, helligkeitsbewusst), statt flach schwarz zu sein — einmal pro Titel analysiert und zwischengespeichert, nie während der Wiedergabe.
- „Auf Plex ansehen" heißt jetzt überall „Abspielen", wo der Beta-Player die Wiedergabe tatsächlich selbst übernimmt, und bleibt „Auf Plex ansehen", wo es sich um eine echte Übergabe an Plex handelt — konsistent auf jeder Titelkarte, der Titelseite, der Episodenseite und im Dashboard-Hero (der zuvor überhaupt keine Beta-Player-Integration hatte).
- Die drei separaten Kopien dieser Auslöselogik in der App sind jetzt eine einzige gemeinsame Implementierung, wodurch die Lücke geschlossen wird, dass eine künftige Korrektur nur an einer Stelle landet und an den anderen übersehen wird.

## v1.12.71 — August 2026

### Das „Neuigkeiten"-Fenster folgt jetzt der Oberflächensprache

- Release-Hinweise sind jetzt pro Oberflächensprache lokalisiert (mit Rückgriff auf Englisch für noch nicht Übersetztes), statt einer einzigen Datei in fester Sprache.
- **Behoben**: Die Release-Hinweise fehlten sowohl im Docker- als auch im Windows-Build stillschweigend – die Datei, aus der sie gelesen werden, war in keinem der beiden gepackten Builds tatsächlich enthalten, sodass das „Neuigkeiten"-Fenster nichts anzuzeigen hatte.

## v1.12.70 — August 2026

### Download-Engine — Grundursache dauerhaft nicht verknüpfbarer Downloads

- **Behoben, live bestätigt**: Das Entfernen eines Torrents aus der Download-Engine meldete Erfolg und löschte sein eigenes Tracking (einschließlich des Bibliothekstitels, zu dem er gehörte) – selbst dann, wenn der zugrunde liegende Download-Client ihn stillschweigend nicht tatsächlich entfernte. Der Torrent lief unbemerkt weiter und seedete, aber die Engine hatte keinen Datensatz mehr davon. Genau das führte zu Downloads, die sich unabhängig davon, wie oft ein Wiederherstellungs-Scan lief, nie wieder einem Titel zuordnen ließen. Die Engine löscht ihre eigene Buchführung jetzt erst, nachdem die Entfernung unabhängig bestätigt wurde; andernfalls bleibt der Torrent getrackt und kann erneut versucht werden, statt zu einer dauerhaften Verwaisung zu werden.

## v1.12.51 – v1.12.69 — August 2026

Genauigkeits- und Zuverlässigkeitsdurchgang für Matching und Engine: Erkennung kompletter Serienpakete (saisonbereichsbewusste Begriffe, Schutz vor Fehlalarmen), Wiederherstellung hängengebliebener Downloads gehärtet durch atomare Verschiebungen ohne Überschreiben und einen zuverlässigen Import-Callback, Schreibsperre pro Serie/Film zur Behebung einer Race Condition, die den Status einer abgeschlossenen Episode verwerfen konnte, sowie Abgleich doppelter Downloads, sodass eine erneut abgerufene Datei die Bibliothek nicht mehr im falschen Status hängen lässt. Benutzerhandbuch aktualisiert, um kürzlich veröffentlichte Funktionen abzudecken (Titelbearbeitung, Filmversionen, Verknüpfung nicht verknüpfter Downloads, Anime-Einstellungen).

## v1.12.24 – v1.12.50 — August 2026

Suche nach kompletten Serienpaketen (Einzelabfrage, saisonbereichsbewusst), Zuverlässigkeit der Download-Wiederherstellung (Ordner-Scan, Zuordnung verwaister Dateien, Bereinigung von Duplikaten), abgesicherte Löschung von Duplikaten, und eine kleine automatisierte Testsuite für den Kern des Release-Matchings.

## v1.10.90 – v1.12.23 — Juli–August 2026

Workflow für Qualitätsupgrades (Optimieren / Ignorieren, Erkennung sinnvoller Upgrades), ein neu gestaltetes Auflösungs-/Codec-Badge-System, GPU-/Animations-Leistungsprofile, und Engine-Stabilisierung über alle austauschbaren Download-Backends hinweg (Absturzkorrekturen, Anti-Stall-Regel, Sperre der Suche pro Serie).

## v1.10.39 – v1.10.89 — Juli 2026

Neuschreibung der Download-Engine mit austauschbaren Backends (nativ/aria2, WebTorrent, libtorrent), ein Wartungstool „Downloads wiederherstellen" für verwaiste Dateien, ein Premium-Toast-Benachrichtigungssystem, Audio-Codec-Badges, und Beta-Verbesserungen der In-App-Wiedergabe (direkte Wiedergabe, Transcode-Protokollierung).

## v1.10.12 – v1.10.17 — Juli 2026

Genauigkeitsdurchgang bei der Spracherkennung: Audiospur-Sprache über Plex ausgelesen, französische Varianten-Tags (VF/VFQ/VFF/TRUEFRENCH), die Qualitätsprofile korrekt erfüllen, Bereinigung doppelter Episoden, und eine Korrektur für vorzeitig aufgegebene Torrents.

## v1.10.1 – v1.10.6 — Juli 2026

Decision Guard (Durchsetzung der Sperrliste vor dem Abrufen), Erkennung von Franchises/Sammlungen, eine neu gestaltete Download-Warteschlange und ein Diagnose-Dashboard, sowie Verfeinerungen bei Trailer/Kalender.

## v1.8.0 – v1.9.9 — Juli 2026

Vereinheitlichtes Titel-Panel (eine einzige Komponente für die Seiteneinblendungs- und Vollseitenansicht), ein Papierkorb-/Wiederherstellungs-Sicherheitsnetz für entfernte Titel, ein Durchgang zur mobilen Reaktionsfähigkeit, und eine Korrektur für ein Speicherleck im Metadaten-Cache.

## v1.4.5 – v1.7.9 — Juli 2026

Sicherheitshärtung (Path Traversal, Datenbankschutz, CodeQL-Warnungen), die endgültigen Schutzmaßnahmen des Papierkorbsystems, ein Live-In-App-Player, Echtzeit-Updates in der gesamten Oberfläche, Überwachung der Plex-Aktivität, und Unterstützung für Sammlungen.

## v1.1.67 – v1.4.4 — Juli 2026

In-App-Player mit automatischem Fallback auf Plex-Transcodierung, Import von Anfragen aus Overseerr (Seerr), Multi-Architektur-Docker-Builds, und eine Reduzierung der Einstellungsnavigation von 26 auf 18 Tabs.

## v1.1.50 – v1.1.66 — Juli 2026

Erste öffentliche Veröffentlichung: TMDb-Entdeckung, Suche über Torznab/Newznab-Indexer, vereinheitlichte Film-/Serienbibliothek, Multi-Benutzer-Anfragen, die integrierte BitTorrent-Engine, und Plex-Synchronisation — sowie frühe Stabilitäts- und Sicherheitskorrekturen (Sitzungsverwaltung, Deduplizierung der Bibliothek, Upgrades von Abhängigkeiten).
