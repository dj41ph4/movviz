# Changelog

Alle relevanten Änderungen an Movviz, gruppiert nach Entwicklungsmeilenstein.

---

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
