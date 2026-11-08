# Plan: Trading-Journal für echte Trades, KI-Prüfung, Spracheingabe, Top-Down-Übung

Umgeschriebener Auftrag vom 2026-11-04 (Original: Prompt von der Ferienfahrt). Der Originalprompt
kannte die App nicht. Was er als „neu bauen“ beschreibt, existiert zur Hälfte schon, deshalb hier
die Fassung für diese Codebasis: vier getrennte Aufträge, je ein Commit, jeder einzeln testbar.

## Was schon da ist (nicht neu bauen)

| Baustein | Wo | Stand |
| --- | --- | --- |
| Journal mit Auswertung | `src/pages/JournalPage.tsx`, `src/engine/auswertung.ts`, `src/components/journal/*` | Simulator-Trades: Equity, R-Verteilung, Setup-Bilanz, Fehlermuster, Gruppen nach Setup/Zeit/Dauer |
| Backend mit Token | `worker/` (Cloudflare, KV, Cache-API, Cron) | läuft; `/api/chart/:symbol?bereich=` liefert Yahoo-Kerzen 5m/15m/1d/1wk/1mo |
| Export/Import, Git-Sync | `src/engine/sicherung.ts`, `src/engine/gitSync.ts`, `src/components/DatenSicherung.tsx`, `GitSync.tsx` | JSON-Sicherung mit Merge, zwei Dateien im privaten Repo |
| Setup-Erkennung | `src/engine/setupErkennung.ts` | Breakout-Retest, Sweep, Range-Bounce, S/R-Bounce, Trend-Pullback, deterministisch, getestet an echten Daten |
| Trader-Chart | `src/components/chart/HandelsChart.tsx`, `src/analyse/TraderChart.tsx`, `CrvRechner.tsx` | Zeichnen (Linie, Zone, Trend, Messen), ziehbare Einstieg/Stop/Ziel-Linien, CRV-Rechner mit Konto und Risiko % |
| Kerzen-Cache | `src/aktien/data/cache.ts` (IndexedDB) | Charts je `SYMBOL:BEREICH` |
| Instrumente | `src/tracker/engine/katalog.ts` | Nasdaq 100, Gold, Öl, Bitcoin, DAX, EUR/USD … mit Yahoo-Symbolen |
| Übungen mit Kein-Trade | `src/pages/UebungPage.tsx`, `szenarioGrader.ts` | Bewertung perfekt/gut/verpasst/falsch, Kein-Trade als gültige Antwort |

Nicht vorhanden: Claude-API im Worker, Zonen-Erkennung (Setups ja, Zonenkarte nein), Spracheingabe,
Journal für echte Trades.

## Grundsätze für alle Schritte

- Handy zuerst (390 px, Touch), Prüfung per Playwright gegen `vite preview`, 0 Konsolenfehler.
- Alles in R rechnen. Dollar und Prozent sind abgeleitet (eToro-Ergebnis in $ ist ein Eingabefeld, keine Rechnung).
- Pure Logik in `src/journal/engine.ts` mit vitest-Tests; Komponenten dünn.
- Keine neuen Server. Claude-Schlüssel wird ein Worker-Secret (`wrangler secret put`), nie im Frontend, nie im Chat.
- Keine Felder mit Pflicht, die man beim Traden nicht in 20 Sekunden ausfüllt (zweistufige Erfassung).

## Schritt 1: Echte Trades im Journal (dieser Commit)

Ziel: Trades von eToro erfassen, abschließen, auswerten, sichern. Kerzen rund um den Einstieg als Snapshot.

- **Datenmodell** `src/journal/types.ts`: `JournalEintrag` (Markt + Yahoo-Symbol, Richtung, Einstieg/Stop/Ziel,
  Zeit, Setup-Id aus `STRATEGIEN` + Freitext, Zeitrahmen, Risiko %, im Plan, Gefühl vorher/nachher, Begründung,
  Lehre, Status offen/geschlossen, Ausstieg mit Preis/Zeit/Grund, Ergebnis $ und Gebühren aus eToro, Hebel).
  R-Multiple aus Preisen (Ausstieg zu Einstieg relativ zum Stop-Abstand), nicht aus Dollar.
- **Store** `src/journal/store.ts` (zustand persist `chartakademie-journal`), Merge per Id, neuerer `geaendertAm` gewinnt.
- **Erfassung** `src/journal/EintragForm.tsx`: Stufe 1 Markt-Chips (Nasdaq, Gold, Öl, Bitcoin, weitere aus dem Katalog),
  Richtung, Einstieg, Stop, Ziel, Setup-Chips, Zeitrahmen, Zeit (Standard jetzt), Risiko %. Stufe 2 einklappbar:
  im Plan, Gefühl, Begründung. Abschließen: Ausstieg, Grund (Ziel/Stop/manuell), Ergebnis $, Gebühren, Gefühl nachher, Lehre.
- **Übernahme aus dem Chart**: Knopf „Ins Journal“ im Trader-Chart, sobald der CRV-Rechner offen ist. Übergibt Symbol,
  Richtung, Einstieg, Stop, Ziel, Zeitrahmen an das Formular (`/training/journal/neu`, Router-State).
- **Snapshot**: beim Speichern Kerzen über den Worker laden (5m → Bereich 1T, 15m/1h → 5T, sonst Tageskerzen 6M),
  Ausschnitt 200 Kerzen vor und 60 nach dem Einstieg in IndexedDB (`chartakademie-journal`, Store `snapshots`).
  Grenze: Yahoo liefert 5-/15-Minuten-Kerzen nur 60 Tage; Snapshot deshalb sofort, „Kerzen neu laden“ auf der Detailseite.
  Snapshots sind gerätelokal (nicht im Export, nicht im Git-Sync) und innerhalb der 60 Tage nachladbar.
- **Detailseite** `/training/journal/:id`: HandelsChart mit Einstieg/Stop/Ziel als Linien, Marker am Einstieg und
  Ausstieg, alle Felder, Abschließen, Bearbeiten, Löschen (zwei Klicks).
- **Journal-Seite**: Reiter „Echte Trades“ (Standard, sobald Einträge da sind) und „Simulator“. Echte Trades nutzen
  dieselbe Auswertung (`logischeTrades` über eine Abbildung auf `Trade`): Trefferquote, Ø R, Profit-Faktor,
  Ø Gewinn-R gegen Ø Verlust-R, Ergebnis je Setup, R-Verteilung, Fehlermuster. Dazu: Plan-Abweichung (Anzahl, Summe R)
  und Tageslimit-Hinweis ab zwei Verlusttrades an einem Tag. Filter Markt, Setup, Zeitraum.
- **Sicherung und Sync**: `Sicherung.journal.eintraege` und `JournalStand.eintraege` (optional, alte Dateien bleiben lesbar),
  CSV-Export (Semikolon, deutsches Excel) auf der Journal-Seite.
- **Test**: vitest für Engine (R-Multiple, Abbildung, Merge, Tageslimit, CSV, Ausschnitt), Playwright 390 px:
  Eintrag anlegen, abschließen, Kennzahlen, CSV.

## Schritt 2a: Claude im Worker, Screenshot → Journal (erledigt 2026-11-04)

- `POST /api/ki/screenshot` in `worker/src/ki.ts` (`@anthropic-ai/sdk`, `claude-opus-5-5`, strukturierte Ausgabe per zod).
  Secret `ANTHROPIC_API_KEY` per `wrangler secret put`. eToro-Screenshots (Positionsinfo, Portfolio, Historie) → Positionen.
- `src/journal/import.ts`: Abbildung auf das Journal, Risiko = Kontrakte × Stop-Abstand, Wiederfinden per Broker-ID,
  Aktionen neu / schließen / aktualisieren. Seite `/training/journal/screenshot` mit Prüfliste.
- Damit ist Schritt 3 (Sprache) weitgehend überflüssig: der Screenshot ist der schnellere Weg.

## Schritt 2b: KI-Prüfung über den Worker (hybrid) (erledigt 2026-11-07, Live-Qualität offen)

- Worker-Endpunkt `POST /api/pruefung` (Token wie bisher), Secret `ANTHROPIC_API_KEY`, Modell `claude-haiku-5-5`
  (Kostenrahmen: Cent je Prüfung), Antwort auf Deutsch, max. 250 Wörter, im Eintrag gespeichert (`pruefung`).
- Fakten statt Kerzen: der Browser lässt `erkenneAn`/`erkenneImFenster` aus `setupErkennung.ts` auf dem Snapshot bis zur
  Einstiegskerze laufen und schickt nur Fakten: Setup erkannt (welches, Zone), Einstieg vor oder nach der Bestätigungskerze,
  Stop relativ zur Struktur (Swing-Tief/Hoch, in ATR), CRV, Trend der höheren Ebene, Abstand zur Zone. Dazu Begründung
  und Gefühl des Nutzers.
- Zwei Durchgänge: „Vorher“ ohne Ergebnis (gegen Hindsight), „Nachher“ mit Ergebnis und der Frage „was lerne ich daraus“.
- Prompt verlangt Gegenthese und benennt Hinweise auf „herbeigesehnt“ (Einstieg ohne Bestätigung, Setup nicht erkannt,
  gegen den Trend, zweiter Trade am Tag nach Verlust).
- Test: Worker-Test mit Fake-Antwort, Engine-Test für die Faktenliste an echten Snapshots.

## Schritt 3: Spracheingabe

- Stufe A ohne eigene Pipeline: Freitextfeld „Diktat“ im Formular, Mikrofon über die Android-Tastatur, dann
  `POST /api/eintrag-aus-text` (Claude, strukturierte Ausgabe mit JSON-Schema) füllt die Felder vor; Nutzer prüft.
- Stufe B: Web Speech API (Chrome Android) direkt im Feld, Fallback auf Stufe A. Whisper über den Worker nur, wenn B nicht reicht.
- Regeln für die Extraktion: Markt auf Katalog abbilden, Zahlen mit Tausenderpunkt und Komma, Zeitrahmen erkennen,
  Setup auf `STRATEGIEN` abbilden, Unklares leer lassen (nie raten).

## Schritt 4: Übung Top-Down-Analyse (zwei Teilschritte)

- 4a **Richtung und Zonen** (erledigt 2026-11-07, `src/engine/zonen.ts`, `richtung.ts`, `src/topdown/`): Tageschart-Richtung (Auflösung aus Trend-Analyse des Trackers: höhere Hochs/Tiefs),
  Stundenchart-Zonen als Bänder im bestehenden Zonen-Werkzeug. Neu: `src/engine/zonen.ts` (Swing-Hochs/-Tiefs
  clustern, Range-Kanten, Ausgangspunkte starker Bewegungen) mit Tests; Vergleich Nutzer-Bänder gegen App-Bänder über
  Überlappung, Feedback „fehlt“ / „unwichtig“.
- 4b **15-Minuten-Replay** (erledigt 2026-11-08, `src/topdown/replay.ts`; Nicht-Krypto auf Stundenkerzen): Kerze für Kerze an einer Zone, Entscheidung Setup/abwarten, Einstieg/Stop/Ziel, Auflösung
  mit Bewertung (Richtung passend, an Zone, Bestätigung, Stop, CRV). Kein-Trade ist richtig, wenn kein Setup an einer
  Zone liegt oder der Trade gegen den Tagestrend liefe. Fortschritt und Trefferquote im `progressStore`.
- Daten: Bitcoin unbegrenzt (Binance). Nasdaq, Gold, Öl nur 60 Tage Intraday bei Yahoo. Deshalb legt die stündliche
  Tracker-Action ab sofort 15-Minuten-Kerzen im Repo ab (Archiv wächst), bis dahin bei Nicht-Krypto Stunde als unterste Ebene.
