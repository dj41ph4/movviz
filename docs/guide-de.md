# Movviz Benutzerhandbuch

## 1. Überblick

Movviz ist eine vereinheitlichte Multimedia-Kommandozentrale. Es vereint Entdeckung (TMDb), Suche über Torznab/Newznab-Indexer, eine Film- und Serienbibliothek, Multi-Benutzer-Anfrageverwaltung, eine integrierte BitTorrent-Engine, Plex-Integration und vieles mehr — alles in einer einzigen Premium-Oberfläche mit kinematografischem Look.

**Wichtige Konzepte:**

- **Bibliothek** — Filme und Serien, die du zum Überwachen hinzufügst. Jeder Titel hat einen Status (Verfügbar, Wird heruntergeladen, Fehlt, Suche läuft) und kann getaggt, überwacht und automatisch über die Indexer durchsucht werden.
- **Indexer** — Torznab/Newznab-Dienste, die Releases indizieren. Movviz fragt sie ab, um verfügbare Downloads für deine überwachten Inhalte zu finden.
- **Engine** — Der integrierte BitTorrent-Client. Jede Kategorie (Film/Serie) betreibt ihre eigene Engine-Instanz mit unabhängigen Download-Pfaden, Geschwindigkeitsbegrenzungen und Seed-Quoten.
- **Anfragen** — Benutzer können Titel anfordern, die noch nicht in der Bibliothek sind. Administratoren genehmigen oder lehnen Anfragen ab, woraufhin die automatische Suche gestartet wird.
- **Plex** — Optionale Integration zur Bibliothekssynchronisation (Import dessen, was Plex besitzt), Watchlist-Synchronisation (automatisches Anfordern von Plex-Watchlist-Hinzufügungen) und Verfolgung des Ansehstatus pro Benutzerprofil.

**Technischer Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion, SWR und eine dedizierte ESM-BitTorrent-Engine auf einem separaten Port.

**Ports (Standard):** Weboberfläche auf 9810, BitTorrent-Engine auf 9820, Cloudflare-Löser auf 9830, Peer-to-Peer auf 51413/51414.

---

## 2. Erste Schritte

### Erster Start — Einrichtungsassistent

Beim ersten Öffnen von Movviz (oder wenn kein Administratorkonto existiert) wirst du durch einen 6-schrittigen Einrichtungsassistenten auf `/setup` geführt:

1. **Sprache** — Wähle die Oberflächensprache aus 5 verfügbaren Optionen: français (fr), English (en), Italiano (it), Nederlands (nl), Deutsch (de).
2. **TMDb-API-Schlüssel** — The Movie Database (TMDb) versorgt die gesamte Entdeckung, Metadaten, Poster und Suche. Du kannst den integrierten Standard-Schlüssel verwenden oder deinen eigenen über [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) eingeben.
3. **TVDB-API-Schlüssel** — TheTVDB liefert zusätzliche Metadaten, insbesondere für Anime. Hole dir einen Schlüssel unter [thetvdb.com/api-information](https://www.thetvdb.com/api-information).
4. **Indexer** — Füge einen oder mehrere Torznab- oder Newznab-Indexer hinzu. Dies sind die Quellen, die Movviz bei der Releasesuche durchsucht. Du kannst sie aus einem Katalog hinzufügen oder einen generischen Endpunkt manuell konfigurieren.
5. **Download-Client** — Konfiguriere die integrierten BitTorrent-Engine-Instanzen (eine für Filme, eine für Serien). Lege Bibliotheksordner, Download-Pfade, Geschwindigkeitsbegrenzungen, Seed-Quoten und das automatische Startverhalten fest.
6. **Plex** — Optional einen Plex Media Server für Bibliothekssynchronisation, Watchlist-Synchronisation und Plex-Authentifizierung verbinden.

Jeder Schritt kann übersprungen und später in den Einstellungen konfiguriert werden.

### Konto erstellen / Anmelden

Nach der Einrichtung gelangst du zur Anmeldeseite unter `/login`. Movviz unterstützt zwei Authentifizierungsmethoden:

- **Lokales Konto** — Registriere dich mit Benutzername und Passwort. Das erste Konto (während der Einrichtung erstellt) ist ein Administrator. Spätere Registrierungen erstellen wartende Benutzer, die von einem Administrator genehmigt werden müssen.
- **Plex-Authentifizierung** — Klicke auf "Mit Plex anmelden", um dich über dein Plex-Konto zu authentifizieren. Es öffnet sich ein Popup für die Plex-Autorisierung; nach Abschluss erfolgt die Anmeldung automatisch.

Wenn du bereits ein Konto hast, verwende direkt das Anmeldeformular. Nutze den Link "Noch kein Konto?" um in den Registrierungsmodus zu wechseln.

---

## 3. Dashboard (/)

Das Dashboard ist deine Startseite — Statistiken auf einen Blick und aktuelle Aktivitäten.

### Anpassbare Widgets

Der obere Bereich zeigt Kacheln mit Zählungen von:
- **Filme** — Gesamtanzahl Filme in der Bibliothek
- **Serien** — Gesamtanzahl Serien in der Bibliothek
- **Episoden** — Gesamtanzahl überwachter Episoden
- **Fehlende Episoden** — Überwachte Episoden, die noch nicht verfügbar sind
- **Verfügbar** — Verfügbare Filme + Episoden
- **Wird heruntergeladen** — Filme + Episoden, die derzeit heruntergeladen oder gesucht werden
- **Fehlt** — Filme mit Status "fehlt"
- **Verfügbare Episoden** — Verfügbare überwachte Episoden

**Bearbeitungsmodus:** Klicke auf das Bleistiftsymbol, um den Bearbeitungsmodus zu öffnen. Im Bearbeitungsmodus kannst du:
- **Kacheln neu anordnen** per Drag & Drop (Framer Motion-Neuanordnung)
- **Kacheln entfernen** über die X-Taste auf jeder Kachel
- **Ausgeblendete Kacheln hinzufügen** über das Dropdown-Menü "Widget hinzufügen"

Klicke auf das Häkchen, um den Bearbeitungsmodus zu verlassen und das Layout zu speichern.

### Download-Warteschlange

Unter den Statistik-Kacheln zeigt die **Download-Warteschlange** aktive und wartende Torrents der Engine mit Echtzeit-Fortschrittsaktualisierungen.

### Kürzlich hinzugefügt

Der untere Bereich zeigt die 12 zuletzt hinzugefügten Filme in einem progressiven Raster. Jede Karte zeigt das Poster, den Titel und den Download-Fortschritt, falls der Film gerade heruntergeladen wird.

---

## 4. Entdecken (/discover)

Die Entdecken-Seite ist dein Ausgangspunkt, um neue Inhalte für die Bibliothek zu finden.

### Inhaltsart-Auswahl

Oben wählst du zwischen **Film** und **Serie**, um durch die jeweiligen Inhalte zu blättern. Die Genres, Reihen und Suchergebnisse werden entsprechend aktualisiert.

### Dynamische Reihen (Startansicht)

Wenn kein Filter aktiv ist, zeigt die Entdecken-Seite horizontale kuratierte Inhaltsreihen:
- **Aktuell im Trend** — Was gerade beliebt ist
- **Beliebt** — Die beliebtesten Titel
- **Top-bewertet** — Titel mit den höchsten Bewertungen
- **Demnächst** — Kommende Veröffentlichungen
- **Jetzt im Kino / Jetzt im TV** — Derzeit im Kino oder im Fernsehen
- **Kassenschlager** — Filme mit den höchsten Einspielergebnissen
- **Kinder** — Familienfreundliche Inhalte
- **Neu veröffentlicht** — Kürzlich zu Streaming-Diensten hinzugefügt
- **Neue Serien / Erneuert** — Neue oder kürzlich erneuerte Fernsehserien

Jede Reihe ist eine horizontal scrollbare Karusselleiste. Durch Klicken auf eine Karte gelangst du zur Detailseite des Titels. Durch Klicken auf "Alle anzeigen" wechselst du zu einer Rasteransicht mit Seitennavigation, gefiltert nach dieser Kategorie.

**Ranglisten:** Einige Reihen (z. B. Top-bewertet, Kassenschlager) werden als nummerierte Ranglisten statt als Karussells angezeigt.

### Studio- und Netzwerk-Buttons

Unter den Inhaltsreihen findest du Buttons für **Studios** (Produktionsfirmen) und **Netzwerke** (Fernsehsender). Durch Klicken auf ein Studio werden Filme dieser Firma gefiltert; durch Klicken auf ein Netzwerk werden Serien dieses Senders gefiltert.

### Genre-Kacheln

Für jedes Genre werden farbige Verlaufs-Kacheln angezeigt. Durch Klicken darauf werden die Ergebnisse nach diesem Genre gefiltert.

### Filter

Wenn du einen Filter aktivierst oder eine Suche durchführst, wechselt die Seite vom Startseiten-Layout zu einem Navigationsraster mit Seitennavigation und folgenden Bedienelementen:

- **Suchfeld** — Gib einen Titel ein, um zu suchen (mit 350ms Verzögerung)
- **Genre-Dropdown** — Nach Genre filtern
- **Jahr-Eingabefeld** — Nach Veröffentlichungsjahr filtern
- **Sortieren-Dropdown** — Sortieren nach Trend (Beliebtheit), Top-bewertet (durchschnittliche Bewertung) oder Neueste (Veröffentlichungsdatum)
- **Aktive Filter-Chips** — Zeigen aktive Filter (Genre, Jahr, Studio, Netzwerk, Reihenkategorie) mit einem X zum Löschen
- **Zurücksetzen-Button** — Alle Filter auf einmal löschen

### Unendliche Ergebnisse

Das Navigationsraster lädt Ergebnisse seitenweise. Während du nach unten scrollst, werden automatisch weitere Ergebnisse über einen IntersectionObserver geladen. Ein "Mehr laden"-Button erscheint ebenfalls am unteren Rand als Alternative.

### Zur Bibliothek hinzufügen

Jede Karte in der Navigationsansicht hat einen Overlay-Button zum **Hinzufügen zur Bibliothek**. Beim Klicken fügt Movviz den Titel zu deiner Bibliothek hinzu und beginnt automatisch mit der Suche nach einer Release. Die Karte zeigt den aktuellen Status (Verfügbar, Wird heruntergeladen, Fehlt) an, falls der Titel bereits in deiner Bibliothek ist.

---

## 5. Bibliothek (/library)

Die Bibliotheksseite hat drei Tabs: Bibliothek, Kalender und Gewünscht.

### 5.1. Tab Bibliothek

Die Hauptansicht der Bibliothek zeigt alle deine Filme und Serien in einem progressiven, responsiven Raster.

**Filter:**
- **Typ** — Alle, Nur Filme oder Nur Serien
- **Status** — Alle, Verfügbar, Wird heruntergeladen oder Fehlt
- **Tag** — Wenn Titel mit Tags versehen sind, erscheinen Tag-Buttons zum Filtern
- **Sortieren** — Nach Titel (alphabetisch) oder Neueste (zuletzt hinzugefügt)

**Progressives Rendern:** Die ersten 100 Karten werden sofort dargestellt; der Rest wird in Batches mit `requestIdleCallback` geladen, sodass die Seite auch bei tausenden Titeln reaktionsfähig bleibt.

**Karten:** Filmkarten zeigen das Poster (mit Fortschrittsbalken während des Downloads), Titel, Jahr und Status-Badge. Serienkarten zeigen ähnliche Informationen für den Gesamtstatus der Serie.

**Abgleich:** Der Administrator kann einen Bibliotheksabgleich durchführen, um fehlende Dateien oder nicht erfasste Dateien auf der Festplatte zu erkennen. Probleme werden inline gemeldet.

### 5.2. Kalender

Zeigt bevorstehende Filmveröffentlichungen und Episoden-Ausstrahlungstermine, gruppiert nach Datum. Die Einträge von heute werden hervorgehoben. Jeder Eintrag zeigt das Poster-Miniaturbild, den Titel, das Sprach-Badge (VF/VO) und Links zur Titeldetailseite.

### 5.3. Gewünscht

Listet alle fehlenden überwachten Elemente auf — Filme mit Status "fehlt" und überwachte Episoden, die noch nicht verfügbar sind.

Funktionen:
- **"Alle herunterladen"-Button** — Durchsucht alle fehlenden Elemente im Batch (maximal 5 gleichzeitige Suchvorgänge) mit einem Fortschrittszähler
- **Suche pro Element** — Jeder fehlende Film oder jede fehlende Episode hat einen Such-Button, um sofort eine Indexersuche für dieses spezifische Element zu starten

Elemente werden mit ihrem Titel, Veröffentlichungs-/Ausstrahlungsdatum und der Zeit seit dem Hinzufügen angezeigt.

---

## 6. Sammlungen (/collections)

### 6.1. Sagas (TMDb-Franchises)

Automatisch erkannte TMDb-Franchise-Sammlungen (z. B. "Star Wars", "Harry Potter") werden in diesem Bereich angezeigt.

- **Fortschritt** — Jede Saga zeigt einen Besitz-/Gesamtzähler (z. B. 4/11) und einen Fortschrittsbalken
- **Bibliothek analysieren** — Der Administrator kann einen Saga-Scan starten, um neue Sammlungen aus der Bibliothek zu erkennen
- **Ansichtsmodus** — Großes Raster, kleines Raster oder Liste (gespeichert in localStorage)

Durch Klicken auf eine Saga gelangst du zu deren Detailseite mit allen Einträgen der Sammlung.

### 6.2. Benutzerdefinierte Sammlungen

Vom Benutzer erstellte Sammlungen zur individuellen Organisation deiner Bibliothek.

- **Erstellung** — Klicke auf den Button "Neue Sammlung", um eine benutzerdefinierte Sammlung zu erstellen
- **Ansichtsmodus** — Wie bei Sagas: Großes Raster, kleines Raster oder Liste

---

## 7. Aktivität (/activity)

Die Aktivität-Seite verfolgt Download-Vorgänge, Ereignisse und Fehler.

### 7.1. Downloads (Warteschlange)

Zeigt die Echtzeit-Download-Warteschlange der BitTorrent-Engine.

**Sichtbare Status:**
- **Metadaten** — Metadaten/Torrent-Info werden heruntergeladen
- **Wird heruntergeladen** — Download läuft
- **Seede** — Abgeschlossen, jetzt am Seeden
- **Pausiert** — Vom Benutzer oder System pausiert
- **Gestoppt** — Keine Peers/Aktivität
- **Abgeschlossen** — Download beendet

**Aktionen pro Element:**
- Pausieren / Fortsetzen
- Neu starten
- Aus Warteschlange entfernen
- Entfernen + heruntergeladene Dateien löschen

**Manuelles Hinzufügen:** Du kannst Torrents manuell per Magnet-Link oder durch Hochladen einer `.torrent`-Datei hinzufügen.

**Statusfilter** — Filtere die Warteschlange nach Status, um dich auf bestimmte Status zu konzentrieren.

### 7.2. Verlauf

Ein chronologisches Protokoll von Ereignissen zu deinen Inhalten:
- **Abgerufen** — Eine Release wurde von einem Indexer abgerufen
- **Importiert** — Ein Download wurde in die Bibliothek importiert
- **Aktualisiert** — Eine vorhandene Datei wurde durch eine bessere Qualität ersetzt
- **Fehlgeschlagen** — Ein Download oder Import ist fehlgeschlagen
- **Blockiert** — Eine Release wurde von der Blocklist blockiert

### 7.3. Gewünscht

Gleich wie der Gewünscht-Tab in der Bibliothek — fehlende überwachte Elemente, die einzeln durchsucht werden können.

### 7.4. Fehler

Eine gefilterte Ansicht des Verlaufs, die nur fehlgeschlagene Ereignisse zur schnellen Fehlersuche anzeigt.

---

## 8. Indexer-Suche (/search)

Die Suchseite ermöglicht es dir, deine konfigurierten Indexer direkt abzufragen.

**Suchleiste** — Gib eine Suchanfrage ein und drücke die Eingabetaste oder klicke auf den Start-Button.

**Film/Serie-Umschalter** — Beschränke die Suche auf Film- oder Serienkategorien auf deinen Indexern.

**Sortierbare Ergebnistabelle** — Ergebnisse werden in einer responsiven Tabelle mit sortierbaren Spalten angezeigt:
- **Titel** — Release-Name (monospace)
- **Punktzahl** — Qualitätspunktzahl (farbig: grün ≥ 90, bernstein ≥ 75)
- **Indexer** — Welcher Indexer die Release zurückgegeben hat
- **Alter** — Wie lange her die Veröffentlichung ist
- **Größe** — Dateigröße
- **Peers** — Anzahl der Seeder (farbig)
- **Aktion** — Abruf-Button zum manuellen Herunterladen

**Qualitätspunktzahl:** Jede Release wird basierend auf deinen Release-Profilen und benutzerdefinierten Formaten bewertet. Höhere Punktzahlen bedeuten bessere Übereinstimmungen mit deinen Präferenzen.

**Abruf-Button** — Lade eine bestimmte Release manuell herunter. Der Button verwandelt sich nach dem Abruf in ein Häkchen.

**Aktuelle Releases** — Wenn keine Suchanfrage eingegeben wurde, zeigt die Seite aktuelle Releases von deinen Indexern für die ausgewählte Kategorie an.

**Fehler pro Indexer** — Wenn ein Indexer einen Fehler zurückgibt (falscher Schlüssel, Ratenbegrenzung usw.), wird dies in einem Warnbanner angezeigt, damit du weißt, warum einige Indexer keine Ergebnisse geliefert haben.

---

## 9. Anfragen (/requests)

Benutzer können Filme oder Serien anfordern, die noch nicht in der Bibliothek sind.

**Eine Anfrage stellen:** Klicke auf der Detailseite eines Titels auf "Zur Bibliothek hinzufügen." Wenn der Artikel noch nicht in der Bibliothek ist, wird eine Anfrage erstellt (abhängig von den Benutzerberechtigungen).

**Anfragenliste:** Zeigt alle Anfragen mit Poster, Titel, Bewertung, Jahr, Beschreibung, wer sie gestellt hat und wann.

**Wartende Anfragen:** Neue Anfragen erscheinen mit einem "Wartet"-Badge.

**Administrator-Aktionen:**
- **Genehmigen** — Genehmigt die Anfrage und startet die automatische Suche
- **Ablehnen** — Lehnt die Anfrage ab

**Status genehmigter Anfragen:** Nach der Genehmigung wird das Status-Badge aktualisiert, um den tatsächlichen Bibliotheksstatus widerzuspiegeln (Suche läuft, Wird heruntergeladen, Fehlt, Verfügbar).

**Tabs:** Wartet (Standard) zeigt nur unbearbeitete Anfragen; Alle zeigt jede Anfrage. Das Badge in der Seitenleiste zeigt die Anzahl der wartenden Anfragen.

---

## 10. Verlauf (/history)

Ein umfassendes Ereignisprotokoll, getrennt von der Aktivität-Seite.

**Filter:**
- **Typ** — Alle, Film oder Serie
- **Ereignistyp** — Alle, Abgerufen, Importiert, Aktualisiert oder Fehlgeschlagen

**Ereignistabelle:** Jeder Eintrag zeigt den Inhalts-Titel, Ereignistyp (mit Icon), Größe, Zeitstempel, Indexer/Akteur und Qualitätspunktzahl. Durch Klicken auf einen Titel gelangst du zu dessen Detailseite.

---

## 11. Probleme (/issues)

Benutzer können Probleme mit Medienelementen melden.

**Ein Problem melden:** Klicke auf der Detailseite eines in der Bibliothek befindlichen Titels auf "Problem melden." Wähle den Problemtyp:
- **Video** — Probleme mit Videoqualität oder Wiedergabe
- **Audio** — Probleme mit Audiospuren
- **Untertitel** — Fehlende oder falsche Untertitel
- **Sonstiges** — Jedes andere Problem

**Problemliste:** Zeigt alle gemeldeten Probleme mit Poster, Titel, Problemtyp-Badge, Status, Beschreibung, Melder und Zeitpunkt.

**Kommentare:** Jedes Problem hat ein Thread-Kommentarsystem. Klicke auf den Button mit der Kommentaranzahl, um die Unterhaltung aufzuklappen. Füge Kommentare über das Eingabefeld unten hinzu.

**Administrator-Aktionen:**
- **Lösen** — Markiere ein Problem als gelöst
- **Wiedereröffnen** — Öffnet ein zuvor gelöstes Problem erneut

**Tabs:** Offen (Standard) zeigt ungelöste Probleme; Alle zeigt jedes Problem.

---

## 12. Benutzer (/users)

Benutzerverwaltung für Administratoren. Zeigt eine Liste aller Benutzer.

**Wartende Benutzer:**
- Benutzer, die sich registriert haben, aber noch nicht genehmigt wurden, erscheinen in einem hervorgehobenen Bereich
- **Genehmigen** — Aktiviert das Benutzerkonto
- **Ablehnen** — Löscht den wartenden Benutzer

**Aktive Benutzer:**
Jede Benutzerzeile zeigt:
- Benutzername mit Authentifizierungs-Badge (Lokal oder Plex)
- Rolle (Benutzer oder Administrator) mit Inline-Umschaltung
- **Automatische Genehmigung**-Umschalter — Wenn aktiviert, werden Anfragen dieses Benutzers automatisch genehmigt
- Link zur Benutzerdetailseite

**Lokalen Benutzer erstellen:** Öffnet ein Modal, um direkt einen neuen lokalen Benutzer zu erstellen (Benutzername + Passwort).

**Plex-Benutzer importieren:** Wenn Plex verbunden ist, importiere Plex-Server-Benutzer als Movviz-Benutzer.

### Benutzerdetails (/users/:id)

Durch Klicken auf einen Benutzer öffnet sich dessen Detailseite mit drei Tabs:

**Allgemein:**
- **Entdecken nach Kontinent** — Legt fest, welche Kontinente auf der Entdecken-Seite des Benutzers angezeigt werden
- **Anfragelimit** - Benutzerspezifische Limits für Film- und Serienanfragen (mit Unbegrenzt-Kontrollkästchen)
- **Automatische Genehmigung** — Umschalter für automatische Genehmigung von Anfragen
- **Plex-Watchlist-Synchronisation** — Wenn der Benutzer ein Plex-Token hat, können Plex-Watchlist-Hinzufügungen automatisch angefordert werden

**Berechtigungen:**
- **Rolle** — Benutzer oder Administrator (ein Administrator kann sich nicht selbst herabstufen)
- **Kann Anfragen verwalten** — Delegiert die Anfrageverwaltung an Nicht-Administratoren

**Passwort:** Für Nicht-Plex-Benutzer können Administratoren das Passwort zurücksetzen.

---

## 13. Profil (/profile)

Die Profilseite jedes Benutzers für persönliche Einstellungen.

### Passwort

Ändere dein Passwort durch Eingabe des aktuellen Passworts und eines neuen Passworts (mindestens 8 Zeichen).

### API-Token

Erstelle und verwalte persönliche API-Zugriffstokens für den programmatischen Zugriff.

- **Token erstellen** — Gib ihm einen Namen und kopiere dann das generierte Token (einmalig angezeigt)
- **Tokenliste** — Zeigt alle Tokens mit Erstellungsdatum und letzter Verwendung
- **Widerrufen** — Lösche ein Token, um es ungültig zu machen

### Entdecken nach Kontinent

Wähle aus, welche Kontinente du bei der Entdeckung priorisieren möchtest. Dies filtert Filme und Serien auf deiner Entdecken-Seite nach Produktionsländern.

### Watchlist

Deine persönliche Watchlist — Titel, die du für später vorgemerkt hast.

Jedes Watchlist-Element zeigt das Poster, die Bewertung und Aktionen beim Überfahren mit der Maus:
- **Zur Bibliothek hinzufügen** — Fügt den Titel zur Bibliothek hinzu und entfernt ihn aus der Watchlist
- **Entfernen** — Entfernt aus der Watchlist, ohne hinzuzufügen

Du kannst Titel von jeder Titeldetailseite über den Lesezeichen-Button zu deiner Watchlist hinzufügen.

---

## 14. Einstellungen (/settings)

Die Einstellungen sind in 5 Gruppen organisiert mit einer einklappbaren Seitenleiste auf dem Desktop und einer unteren Navigation auf Mobilgeräten. Alle Einstellungs-Tabs (außer Info) sind nur für Administratoren zugänglich.

### 14.1. Download

**Client:** Zwei integrierte BitTorrent-Engine-Instanzen — eine für Filme, eine für Serien. Jede Instanz zeigt:
- Statusanzeige (online/offline)
- Protokoll (Torrent)
- Kategoriezuordnung (Film/Serie)
- Zusammenfassung der aktuellen Konfiguration

Während der Bearbeitung kannst du konfigurieren:
- **Bibliotheksordner** — Wo Multimedia-Dateien für Plex gespeichert werden
- **Download-Ordner** — Wohin unvollständige Downloads gehen
- **Ordner für Abgeschlossene** — Wohin abgeschlossene Downloads verschoben werden
- **Maximale aktive Downloads** — Limit für gleichzeitige Downloads
- **Seed-Quote** — Ziel-Verhältnis vor dem Beenden des Seedens
- **Maximale Peers** — Maximale Anzahl Peer-Verbindungen pro Torrent
- **Upload-Slots** — Upload-Slots pro Torrent
- **Download-Geschwindigkeitsbegrenzung** — Globale Download-Begrenzung (KB/s; "Unbegrenzt" wenn leer)
- **Upload-Geschwindigkeitsbegrenzung** — Globale Upload-Begrenzung
- **Automatischer Start** — Ob die Instanz mit der Engine startet

**Ordnerdurchsuchung:** Wenn die Engine auf demselben Rechner läuft, ermöglicht ein integrierter Ordnerbrowser die visuelle Navigation und Auswahl von Pfaden. Für Remote-/Docker-Konfigurationen gibst du den Pfad manuell ein.

**Engine neu starten-Button** — Wenn die Engine offline ist, erscheint ein Button zum Neustarten.

**Indexer:** Konfiguriere Torznab/Newznab-Indexer für die Releasesuche.

Jeder Indexer zeigt:
- Protokoll (Torrent/Usenet) mit Symbol
- Name und Basis-URL
- Verbindungsstatus (OK/Fehlgeschlagen/Nicht getestet) mit Detail des letzten Tests
- Authentifizierungsindikatoren (API-Schlüssel oder Anmeldedaten)
- Ein-/Ausschalter
- Prioritätseinstellung

**Einstellungen pro Indexer:**
- **Kategorien** — Welche Inhaltskategorien durchsucht werden sollen (ausklappbares Panel)
- **Filter** — Minimale/maximale Größe (MB) und maximales Alter (Tage)
- **Cloudflare-Löser** — Aktiviere den Cloudflare-Löser für durch Cloudflare geschützte Indexer
- **Test-Button** — Teste die Verbindung in Echtzeit
- **Löschen** — Indexer entfernen

**Indexer hinzufügen:** Zweistufiger Prozess:
1. Wähle aus einem Katalog vordefinierter Indexer (Torznab/Newznab)
2. Gib URL, Authentifizierung (API-Schlüssel oder Benutzername/Passwort) und Kategorien ein

**Löser-URL:** Konfiguriere die FlareSolverr-URL (Standard: `http://localhost:9830`), die vom Cloudflare-Löser verwendet wird.

**Qualität:** Bewertungs- und Filterregeln für Releases, die Release-Profile und benutzerdefinierte Formate in einem Tab vereint.

- **Blockierte Wörter** — Eine Liste von Wörtern, die bei Vorhandensein im Release-Titel zur Ablehnung führen. Füge Wörter einzeln hinzu; entferne sie mit der X-Taste.
- **Maximale Größen** — Maximal zulässige Größen für Filme (GB), Episoden (GB) und Staffeln (GB). Releases, die diese überschreiten, werden abgelehnt.
- **Codec-Bewertungen** — Bewertungen für Video-Codecs: x264, x265 und AV1. Höhere Bewertungen erhöhen die Wahrscheinlichkeit, dass Releases mit diesem Codec ausgewählt werden.
- **Benutzerdefinierte Formate** — Regex-basierte Bewertungsregeln, die auf Release-Titel angewendet werden. Jedes Format hat einen Namen, eine Bewertung (positiv oder negativ) und Regex-Begriffe. Erstelle sie, um Muster wie "HDR", "Dolby Vision", "Remux" usw. zu priorisieren oder zu degradieren.

### 14.2. Bibliothek

**Metadaten:** Konfiguration externer Datenquellen.

- **TMDb** — Der API-Schlüssel von The Movie Database. Du kannst den integrierten Standard-Schlüssel verwenden oder deinen eigenen angeben. Teste den Schlüssel, um zu überprüfen, ob er funktioniert. Option zum Wiederherstellen des Standard-Schlüssels verfügbar.
- **TVDB** — Der API-Schlüssel von TheTVDB für zusätzliche Metadaten. Enthält einen Schalter, um TVDB speziell für **Anime**-Titel zu verwenden.
- **OMDb** — Der API-Schlüssel von The Open Movie Database für Rotten Tomatoes-Bewertungen und Metacritic-Werte. Testen zur Überprüfung.
- **Entdecken-Layout** — Wähle zwischen dem Standard-**Movviz**-Layout (Poster-Karussells + Ranglisten) oder dem **Allociné**-Layout, das den Stil der Entdecken-Seite anpasst.

**Plex:** Integration mit Plex Media Server.

- **Verbindung:**
  - **Hostname** — Hostname oder IP des Plex-Servers
  - **Port** — Standard 32400
  - **SSL** — Aktivieren für HTTPS
  - **Verbinden/Neu verbinden** — Authentifiziere dich mit deinem Plex-Konto über Browser-Popup
  - **Test** — Konnektivität überprüfen
- **Bibliothekssynchronisation:**
  - Aktiviere die automatische Synchronisation von Plex-Bibliotheken in Movviz
  - **Jetzt synchronisieren** — Sofortige Synchronisation starten
  - **Neuer vollständiger Scan** — Erzwinge einen vollständigen Neuscan anstatt inkrementell
  - Ergebnisse zeigen, wie viele Filme/Serien hinzugefügt und verglichen wurden
- **Watchlist-Synchronisation:**
  - Aktiviere die globale Plex-Watchlist-Synchronisation
  - Wenn aktiviert, können Benutzer, die sich mit Plex anmelden, ihre Plex-Watchlist automatisch in Anfragen umgewandelt sehen
- **Plex-Profile (Benutzerzuordnung):**
  - Ordne jeden Movviz-Benutzer einem bestimmten Plex Managed User (Profil) zu, sodass der Ansehstatus den Verlauf dieses Profils widerspiegelt

**Namensgebung:** Vorlagen für Datei- und Ordnernamen mit interaktivem Token-Einsatz.

Vorlagen für:
- **Filmordner** — z.B. `{title} ({year})`
- **Filmdatei** — z.B. `{title} ({year}) [{quality}]`
- **Serienordner** — z.B. `{title} ({year})`
- **Staffelordner** — z.B. `Staffel {season:00}`
- **Episodendatei** — z.B. `{series} - S{season:00}E{episode:00} - {title}`

**Interaktive Tokens:** Klicke auf ein Feld und dann auf einen Token-Button, um es an der Cursorposition einzufügen. Verfügbare Tokens: `{title}`, `{year}`, `{quality}`, `{season}`, `{episode}`, `{series}` und mehr.

**Punkte oder Leerzeichen:** Wähle, ob Trennzeichen Punkte oder Leerzeichen verwenden.

**Live-Vorschau:** Während du Vorlagen bearbeitest, zeigt eine Vorschau, wie die resultierenden Dateipfade für einen Beispiel-Film und eine Beispiel-Episode aussehen.

**Importe:** Externe Watchlists, die synchronisiert und automatisch zur Bibliothek hinzugefügt werden können (im Tab "Importe").

Unterstützte Quellen:
- **Trakt** — Trakt-Benutzerlisten
- **IMDb** — IMDb-Listen
- **Letterboxd** — Letterboxd-Watchlist

Für jede Liste konfigurierbar:
- **Name** — Eine beschreibende Bezeichnung
- **Typ** — Trakt, IMDb oder Letterboxd
- **URL** — Die Listen-URL
- **Automatisch genehmigen** — Wenn aktiviert, werden Elemente aus dieser Liste automatisch genehmigt
- **Sync-Button** — Manuelles Auslösen einer Synchronisierung

**Seerr-Import:** Importiere Anfragen von einer bestehenden Overseerr-Instanz.

- **URL** — Deine Seerr-Server-URL
- **API-Schlüssel** — API-Schlüssel für die Authentifizierung
- **Test** — Verbindung überprüfen
- **Jetzt importieren** — Importvorgang starten

**Blocklist:** Titel, die niemals zur Bibliothek hinzugefügt werden sollten.

- **Gesperrten Titel hinzufügen** — Suche einen Titel auf TMDb, wähle ihn aus, füge optional einen Grund hinzu und bestätige
- **Blocklist** — Zeigt alle gesperrten Titel mit Typ, Titel, Jahr, Grund und wer sie wann gesperrt hat
- **Entsperren** — Entferne einen Titel aus der Blocklist

### 14.3. Datenträger

**Indizierung:** Durchsuche die Stammordner der Bibliothek nach verwaisten Dateien — Mediendateien auf der Festplatte, die nicht in der Movviz-Bibliothek verfolgt werden. Ein einzelner Tab mit einem Film/Serien-Umschalter.

- Wähle den zu durchsuchenden Stammordner aus
- Übereinstimmungen werden mit einer integrierten TMDb-Suche für manuelles Matching angezeigt
- Import mit einem Klick, um zugeordnete Dateien zur Bibliothek hinzuzufügen

**Umbenennen:** Benenne Ordner und Dateien gemäß deinen Namensvorlagen um.

Ablauf:
1. **Analysieren** — Scanne deine Bibliothek und generiere eine Liste von Umbenennungskandidaten mit aktuellen vs. erwarteten Pfaden
2. **Auswählen** — Wähle aus, welche Elemente umbenannt werden sollen (Alle, Nur Filme, Nur Serien oder Einzelauswahl)
3. **Vorschau** — Überprüfe die Änderungen
4. **Ausführen** — Wende Umbenennungen mit Echtzeit-Fortschritt und Protokoll an

Einstellungen:
- **Sprache** — Wähle die TMDb-Sprache für übersetzte Titel (beeinflusst Ordner-/Dateinamen)
- **"Leere Ordner löschen"** — Nach dem Umbenennen automatisch jetzt leere Verzeichnisse entfernen
- **Fortschritt + Echtzeit-Protokoll** — Verfolge den Vorgang in Echtzeit

**Wartung:** Fasst Festplattenwartungsoperationen in einem Tab zusammen.

**Pfade reparieren:** Erkennt Bibliothekseinträge, deren Dateien verschoben wurden oder fehlen.

1. **Analysieren** — Vergleiche Bibliotheksaufzeichnungen mit dem tatsächlichen Dateisystem
2. Ergebnisse werden kategorisiert:
   - **Sicher** — Eine eindeutige Übereinstimmung (automatisch ausgewählt)
   - **Mehrdeutig** — Mehrere mögliche Übereinstimmungen (erfordert menschliche Entscheidung)
   - **Konflikt** — Eine Datei, die mehreren Bibliothekseinträgen entspricht
3. **Dateibrowser** — Für manuelle Korrektur öffne einen Dateibrowser, um den richtigen Pfad zu finden
4. **Anwenden** — Verknüpfe die ausgewählten Einträge neu

Optionen:
- **Stilles automatisches Neulinken** — Für Docker-Bind-Mounts erkennt und korrigiert Movviz Pfadänderungen automatisch
- **"Leere Ordner nach dem Neulinken entfernen"** — Bereinige verwaiste Verzeichnisse nach der Reparatur

**Leere Ordner:** Durchsuche konfigurierte Stammordner nach leeren Verzeichnissen.

- Durchsuche rekursiv alle konfigurierten Bibliotheksstammordner
- Ignoriert gängige Systemdateien (`.DS_Store`, `Thumbs.db`, `Desktop.ini`, usw.)
- **Löschen** — Entferne ausgewählte leere Verzeichnisse
- **Rekursive Elternbereinigung** — Nach dem Löschen werden jetzt leere Elternordner ebenfalls rekursiv entfernt

**Papierkorb:** Sicherheitsnetz für gelöschte Inhalte.

Wenn ein Film oder eine Serie mit seinen Dateien aus Movviz entfernt wird, können die Dateien in einen Papierkorbordner verschoben werden, anstatt endgültig gelöscht zu werden.

- **Filmordner** — Pfad, wohin gelöschte Filmdateien gehen
- **Serienordner** — Pfad, wohin gelöschte Seriendateien gehen
- **Aufbewahrung** — Tage, bis Papierkorbdateien endgültig gelöscht werden (konfigurierbar)
- **Elementanzahl** — Zeigt, wie viele Elemente sich derzeit im Papierkorb befinden

### 14.4. Benachrichtigungen

Konfiguriere Push-Benachrichtigungen für Medienereignisse (abgerufen, importiert, fehlgeschlagen usw.). Dieser einzelne Tab gruppiert Transporte, Webhook und Aktivitätsoptionen.

**Transporte:**
- **Discord** — Webhook-URL
- **Telegram** — Bot-Token + Chat-ID
- **Gotify** — Server-URL + App-Token
- **Slack** — Webhook-URL
- **Pushbullet** — API-Token

Jeder Transport:
- Ein-/Ausschalten
- Konfigurationsfelder (Passwörter werden maskiert)
- **Test-Button** — Sendet eine Testbenachrichtigung zur Überprüfung der Einrichtung

**Webhook:** Sende HTTP-POST-Benachrichtigungen an eine benutzerdefinierte URL.

- **Aktivieren** Umschalter
- **URL** — Der Webhook-Endpunkt
- **Test-Button** — Sendet eine Test-Payload

**Qualitätsupgrades:** Automatische Suche und Herunterladen von höherwertigen Versionen bereits verfügbarer Inhalte ein-/ausschalten.

### 14.5. System

**Diagnose:** Echtzeit-Systemstatus-Übersicht.

- **Engine** — BitTorrent-Engine online/offline
- **TMDb** — TMDb-API-Konnektivität
- **Indexer** — Verbindungsstatus pro Indexer
- **Prozesse:**
  - **Web** — Webinterface-Prozess: % CPU, RAM, Betriebszeit
  - **Engine** — Engine-Prozess: % CPU, RAM, Betriebszeit
- **Speicherplatz** — Gesamter, freier und belegter Speicher auf konfigurierten Pfaden
- **Bibliotheksstatistik** — Gesamtanzahl Filme, Serien, Episoden
- **Leistung** — API-Aufrufe und Latenzen
- **Engine-Protokoll** — Live-Ausgabe der Engine
- **Löser-Protokoll** — Live-Ausgabe des Cloudflare-Lösers

**Geplante Aufgaben:** Liste aller wiederkehrenden Hintergrundaufgaben.

Jede Aufgabe zeigt:
- **Name** — Was die Aufgabe tut
- **Intervall** — Wie oft sie ausgeführt wird
- **Letzte Ausführung** — Wann sie zuletzt ausgeführt wurde
- **Nächste Ausführung** — Wann sie als nächstes ausgeführt wird
- **"Jetzt ausführen"-Button** — Starte die Aufgabe manuell

**Aufgabenwarteschlange:** Aktive und kürzlich ausgeführte Hintergrundaufgaben.

- Zeigt derzeit laufende Aufgaben mit Status und Fortschritt
- Verlauf kürzlich abgeschlossener Aufgaben
- **Priorität** — Schieberegler (0–100) pro Aufgabentyp zur Steuerung der Ausführungspriorität
- Aufgaben mit höherer Priorität werden zuerst ausgeführt, wenn mehrere Aufgaben in der Warteschlange stehen

**Cache:** Statistiken und Verwaltung für Caches.

Jeder Cache-Eintrag zeigt:
- **Name** — Cache-Kennung
- **Treffer** — Erfolgreiche Cache-Suchen
- **Fehler** — Fehlgeschlagene Cache-Suchen
- **Schlüssel** — Anzahl der Cache-Einträge
- **Größe** — Geschätzte Speichernutzung

Aktionen:
- **Füllen** — Cache vorladen
- **Leeren** — Alle Einträge in einem Cache ungültig machen

**Backup:** JSON-Konfiguration exportieren und importieren.

- **Exportieren** — Lade alle Einstellungen, Bibliotheksmetadaten und Konfiguration als JSON-Datei herunter
- **Importieren** — Lade eine zuvor exportierte JSON-Datei hoch, um die Konfiguration wiederherzustellen

**Info:** Anwendungsinformationen.

- **Version** — Aktuelle Movviz-Versionsnummer
- **Lizenz** — GNU General Public License v3.0
- **Projekt unterstützen** — Link zur Unterstützung der Entwicklung
- **Updates:**
  - **Auf Updates prüfen** Button
  - Auf **Windows**: Ein-Klick-Installationsbutton, der das Update automatisch herunterlädt und installiert
  - Auf **Docker/anderen Plattformen**: Zeigt einen Link zur GitHub-Releases-Seite mit Anweisungen

**Gefahrenzone:** Irreversible Aktionen am unteren Ende der Gruppe, visuell getrennt.

Jede Aktion erfordert die Eingabe eines Bestätigungsworts, bevor sie ausgeführt werden kann:
- **Alle Filme löschen** — Entfernt alle Filme aus der Bibliothek
- **Alle Serien löschen** — Entfernt alle Serien aus der Bibliothek
- **Aktivitätsverlauf löschen** — Löscht den gesamten Aktivitätsverlauf
- **Benachrichtigungen löschen** — Löscht alle Benachrichtigungskonfigurationen
- **Anfragen löschen** — Löscht alle Benutzeranfragen
- **Gemeldete Probleme löschen** — Entfernt alle gemeldeten Probleme
- **Plex-Synchronisationsstatus zurücksetzen** — Setzt die Plex-Synchronisationsverfolgung zurück

---

## 15. Titeldetail (/title/:type/:id)

Eine umfassende Detailseite für Filme und Serien, die alles über einen Titel zeigt.

### Inhaltsbereiche

- **Hintergrund** — Hero-Bild in voller Breite oben
- **Poster** — Vertikales Poster mit Verlaufsüberlagerung
- **Titel** — Name des Films oder der Serie
- **Bewertungen** — TMDb-, IMDb-, Rotten Tomatoes- (über OMDb) und Metacritic-Werte
- **Jahr, Dauer, Staffeln** (für Serien), **Genres**
- **Tagline** — Der Werbeslogan des Films oder der Serie (falls vorhanden)
- **Handlung** — Vollständige Zusammenfassung / Handlungsbeschreibung
- **Budget / Einspielergebnis** — Für Filme, finanzielle Daten von TMDb

### Aktions-Buttons

- **Zur Bibliothek hinzufügen** — Wenn noch nicht in der Bibliothek, wird der Titel hinzugefügt und die Suche gestartet
- **Auf Plex ansehen** — Wenn in der Bibliothek verfügbar und Plex verbunden ist, öffnet direkt den Plex-Web-Player
- **Suchen** — Wenn das Element in der Bibliothek existiert, starte eine neue Indexersuche (auch für Qualitätsaktualisierungen verwendet)
- **Manuelle Auswahl** — Öffnet die vorausgefüllte Indexersuche-Seite zur manuellen Release-Auswahl
- **Lesezeichen / Lesezeichen entfernen** — Zur persönlichen Watchlist hinzufügen oder daraus entfernen
- **Trailer** — Öffnet ein Modal mit dem YouTube-Trailer
- **Saga** — Für Filme, verlinkt zur TMDb-Sammlungs-/Saga-Seite

### Bibliotheksstatus-Badge

Zeigt den aktuellen Status des Titels in deiner Bibliothek: Verfügbar, Wird heruntergeladen, Suche läuft oder Fehlt.

### Besetzung und Crew

- **Besetzung** — Horizontal scrollbare Reihe von Schauspielerporträts mit Rollennamen; klicke für Personendetails
- **Crew** — Raster von Crew-Mitgliedern nach Funktion (Regisseur, Drehbuchautor usw.) mit "Mehr anzeigen"-Erweiterung

### Staffeln (Serien)

Für Serien zeigt ein Staffel-Panel jede Staffel mit ihren Episoden. Jede Episode zeigt:
- Episodennummer und Titel
- Ausstrahlungsdatum
- Überwachungs-Umschalter
- Status-Badge
- Such-Button pro Staffel

### Schlüsselwörter

Tags/Schlüsselwörter von TMDb, dargestellt als Pillen.

### Empfohlen

Ähnliche Titel von TMDb, dargestellt als Poster-Raster.

### Seitenleisten-Informationen

- Originaltitel
- Status (Veröffentlicht, Beendet, Laufende Serie usw.)
- Veröffentlichungsdatum / Erstausstrahlung
- Budget und Einspielergebnis (Filme)
- Originalsprache
- Ursprungsländer
- Studios / Produktionsfirmen
- **Streaming-Plattformen** — Logos verfügbarer Streaming-Anbieter (z. B. Netflix, Disney+, usw.)
- **Externe Links** — Symbole für Plex, TMDb, IMDb, Rotten Tomatoes, Letterboxd

### Anfrage-Modals

Wenn der Titel noch nicht in der Bibliothek ist, öffnet das Klicken auf "Zur Bibliothek hinzufügen" ein anfragespezifisches Modal (Film oder Serie) mit Optionen für den Benutzer.

### Manuelle Auswahl-Modal

Öffnet die Indexersuche-Seite (`/search`) in einem Modal-/Dialog-Kontext, vorausgefüllt mit den Metadaten des Titels und der korrekten Bibliotheksreferenz für den automatischen Import nach dem Abruf.

---

## 16. Tastaturkürzel

- **Cmd+K / Strg+K** — Öffnet die universelle Befehlspalette für schnelle Navigation und Suche
- **Seitenleistennavigation** — Alle Hauptbereiche sind über die Seitenleiste zugänglich: Dashboard, Entdecken, Bibliothek, Sammlungen, Suche, Anfragen, Aktivität, Verlauf, Probleme, Benutzer (Admin), Einstellungen (Admin)

---

## 17. Fehlerbehebung

### Engine offline

**Symptome:** Downloads starten nicht, Aktivität zeigt keine Warteschlangen, rote "offline"-Anzeige in Einstellungen > Download > Client.

**Lösungen:**
- Überprüfe, ob der Engine-Prozess läuft (`npm run engine` oder der Windows-Dienst)
- Überprüfe, ob Port 9820 nicht von einer Firewall blockiert wird
- Klicke in Einstellungen > Download > Client auf "Engine neu starten"
- Überprüfe die Engine-Protokolle in Einstellungen > System > Diagnose > Engine-Protokoll
- Überprüfe, ob die Engine-Statusdatei nicht beschädigt ist

### Indexer-Fehler

**Symptome:** Suchergebnisse sind leer, oder bestimmte Indexer zeigen Status "fehlgeschlagen".

**Lösungen:**
- Überprüfe das Testergebnis jedes Indexers in Einstellungen > Download > Indexer
- Überprüfe, ob deine API-Schlüssel noch gültig sind
- Für durch Cloudflare geschützte Indexer aktiviere den "Cloudflare-Löser" und stelle sicher, dass FlareSolverr läuft
- Überprüfe die minimalen/maximalen Größenfilter und das maximale Alter — sie könnten zu restriktiv sein
- Suche nach Indexer-Fehlermeldungen im Warnbanner auf der Suchseite

### Unterbrochene Pfade (Docker-Bindmounts)

**Symptome:** Dateien existieren auf der Festplatte, aber die Bibliothek zeigt Status "fehlt". Der Scan "Pfade reparieren" zeigt Kandidaten mit falschen Pfaden.

**Lösungen:**
- Führe einen Scan "Pfade reparieren" in Einstellungen > Datenträger > Wartung durch
- Für Docker-Bindmounts versucht Movviz eine stille automatische Neuverknüpfung — überprüfe, ob dies funktioniert hat
- Wenn die automatische Neuverknüpfung nicht funktioniert hat, verwende den manuellen Dateibrowser, um Pfade zu korrigieren
- Stelle sicher, dass deine Docker-Volume-Mounts zwischen Neustarts konsistent sind

### Abgelaufene Sitzungen

**Symptome:** 401-Fehler bei API-Aufrufen, unerwartete Weiterleitung zur Anmeldeseite.

**Lösungen:**
- Melde dich ab und wieder an
- Wenn du Plex-Authentifizierung verwendest, verbinde dein Plex-Konto erneut
- Sitzungs-Cookies werden vom Server verwaltet — wenn der Server neu startet, können Sitzungen ungültig werden
- Überprüfe, ob die Systemuhr genau ist (Sitzungstoken-Validierung ist zeitkritisch)
