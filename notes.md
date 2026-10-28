# ChartAkademie — Projektnotizen

Trading-Lern-App (Krypto): geführter Kurs mit Leveln + Chart-Replay-Simulator.
Plan: `C:\Users\maxis\.claude\plans\ich-will-gerne-ein-jiggly-wombat.md`

## Stand 2026-09-04 — Phase 1 (MVP) fertig

- Scaffold: Vite + React 19 + TypeScript, Tailwind 3, react-router 7, zustand, idb, lightweight-charts 5, oxlint.
- Daten-Layer: Binance Spot-Klines (Fallback-Hosts api/api1–4), IndexedDB-Cache ohne TTL (`src/data/`). Binance aus DE erreichbar (getestet).
- `ChartPanel.tsx`: einzige Stelle mit lightweight-charts-v5-API (Candles + Volumen + Marker + Preislinien).
- Lernpfad: `curriculum.ts` als einzige Quelle für Reihenfolge/Freischaltung; Level 2–5 als „in Arbeit"-Platzhalter.
- Level 1 komplett (5 Lektionen mit Quiz, echten BTC-Charts, LeverageRechner-Demo).
- Fortschritt: zustand + persist (`chartakademie-fortschritt`), Quiz bestanden ab 70 %.

## Stand 2026-09-04 (später) — Phase 2 (Replay & Broker) fertig

- `engine/broker.ts`: purer, immutabler Broker (Market-Fill am Open der nächsten Bar, Limit-Fill bei Berührung, SL-zuerst-Regel, 0,05 % Taker-Gebühr, R-Multiple). 12 vitest-Tests grün (`npm test`).
- `hooks/useReplay.ts`: Bar-by-Bar-Replay (Play/Pause/Step, 1–10x), Auto-Glattstellung am Session-Ende.
- `ReplayChart.tsx`: inkrementelles `series.update()` statt Neuaufbau; Zeitachse im Blindmodus komplett ausgeblendet; Entry/SL/TP als Preislinien.
- SimulatorPage: zufälliger Abschnitt (BTC/ETH/SOL × 15m/1h/4h, ab 2021), 500 Bars Kontext + 300 Replay, Symbol & Datum verdeckt bis Session-Ende (Auflösung), OrderTicket mit Risiko-%-Sizing und CRV-Anzeige.
- simulatorStore (persist): Kontostand + Trade-Historie, Dedup per Trade-Id mit Session-Präfix. JournalPage mit Statistik-Kacheln und Reset (inline-Bestätigung).

## Stand 2026-09-04 (abends) — Phasen 3–5 fertig: Kurs komplett

- **Phase 3:** szenarioGrader (Entry-Zone + SL-Seite + CRV ≥ 1,5 → perfekt/ok/verpasst/falsch), UebungPage mit Ideal-Trade-Auflösung, Level 2 komplett (4 Lektionen + PositionsRechner).
- **Phase 4:** Indikatoren (ema, rsi, volumeProfile, liqMap — Schätzverfahren aus Swings × Hebel), 5 Demos (VolumeProfile aus statischem Datensatz, LiqMap live, Funding/OI live von fapi.binance.com, Heatmap simuliert/canvas, EmaRsi), Level 3 (6 Lektionen) + Level 4 (5 Strategien, je mit Übung). ChartPanel kann jetzt EMA-Linien (`emaPerioden`).
- **Phase 5:** Level 5 (Meisterprüfung mit allen 5 Übungen, Freier-Replay-Guide, Journal-Lektion), Bybit-Fallback im candleService, Max-Drawdown-Kachel im Journal, Lernfortschritt-Reset im Dashboard, README, Vault-Notiz `vault/01-Projekte/ChartAkademie.md`.
- **5 kuratierte Szenarien** (echte Binance-Daten, statisch in public/szenarien/): Breakout Okt 23, Bounce Juni 23, Trendfolge Feb 24, Range Sep 23, Sweep Mai 24. Zonen anhand der Skript-Ausgabe (`scripts/hole-szenario.mjs`) definiert.
- 16 vitest-Tests grün, Build grün.

## Stand 2026-09-10 — Live auf GitHub Pages, Handy-tauglich

- UI manuell im Browser durchgeklickt: sieht gut aus, keine Befunde.
- GitHub-Repo angelegt: https://github.com/maximilianschettle-maker/chart-akademie (public).
- Deploy: `.github/workflows/deploy.yml` (Lint + Tests + Build → actions/deploy-pages), Pages auf build_type=workflow. Live: **https://maximilianschettle-maker.github.io/chart-akademie/**
- Dafür: `base: '/chart-akademie/'` in vite.config.ts, HashRouter statt BrowserRouter (Pages kann keine Rewrites → Reload/Deep-Link wäre 404), PWA-Manifest + PNG-Icons (per PowerShell/System.Drawing aus dem Favicon-Motiv), Mobile-Meta-Tags → „Zum Startbildschirm hinzufügen" auf Android/iOS.
- Kein Service-Worker: Live-Daten brauchen ohnehin Netz; Übungsdaten liegen im Repo.

## Stand 2026-09-10 (abends) — Ausbau in fünf Blöcken (5 Commits, 63 Tests grün)

1. **Handy-Feinschliff:** Route-Splitting per React.lazy (lightweight-charts nur im Simulator-Chunk, 500-kB-Warnung weg), Charts lassen vertikales Wischen durch (`vertTouchDrag` aus), `useSchmal`/`chartHoehe` (320 px unter 640 px Breite), Service Worker `public/sw.js` (App-Shell + Assets + Szenarien offline, index network-first, Fremd-Origins unangetastet).
2. **Simulator realistischer:** Broker mit Trailing-Stop, Teilverkauf, Break-even, SL/TP ändern, Slippage 0,02 % (nur Market/Stop), Funding 0,01 %/8 h (Long zahlt). R-Multiple bezieht sich auf das ursprüngliche Risiko (`Position.risikoBetrag`). Multi-Timeframe: `engine/aggregation.ts` (zeitbasierte Buckets), Kontext-Chart wächst live mit. Zeichenwerkzeuge: Linien (Preislinien) + Zonen (Series-Primitive `zonenPrimitive.ts`), Klicks per DOM-Listener (chart.subscribeClick verschluckt schnelle Doppel-Tipps).
3. **Mehr Übungsmaterial:** 4 neue Szenarien in `content/szenarien/weitere.ts` (ETH Breakout Nov 23, SOL Sweep Aug 24, BTC Fakeout Apr 24 = kein Trade, BTC Range-Mitte = kein Trade). Scenario-Typ: `richtung: 'keiner'`, `ansageVerdeckt`, `alternativRichtung`, `generiert`. Übungsseite mit „Kein Trade“-Knopf (`useReplay.zumEnde`). Lektion l5-04 „Meisterprüfung II: Ohne Ansage“. `engine/setupErkennung.ts`: Range-Bounce, Trend-Pullback (long/short), Breakout+Retest regelbasiert erkannt → Route `/uebung/zufall` (unendliche Übungen aus Zufallsabschnitten).
4. **Auswertung & Lernkurve:** `engine/auswertung.ts` (logische Trades = Teil-Exits addiert, Equity-Kurve, Gruppen nach Setup/Tageszeit/Haltedauer/Richtung, R-Verteilung, Fehler-Muster: Stop zu eng, zu früh raus, Übertraden nach Verlust, CRV < 1,5, Richtungs-Bias, fehlende Tags). Journal neu mit SVG-Equity-Kurve (Hover), Histogramm, Tabellen, Hinweisen. Spaced Repetition: `engine/wiederholung.ts` (1/3/7/14/30 Tage), falsch beantwortete Quizfragen landen in `progressStore.wiederholungen`, Route `/wiederholung`, Dashboard-Hinweis.
5. **Daten & Sync:** `engine/sicherung.ts` + `DatenSicherung` auf dem Dashboard: Export als JSON, Import mergt (Trades per Id, bestes Ergebnis je Lektion/Übung, höchster Lernstand je Wiederholung). `public/replay/`: drei eingebaute Abschnitte als Offline-Vorrat für den Simulator (nach 3 Online-Fehlversuchen; Badge „offline-Vorrat“).

Werkzeug: Chrome-Extension war wieder nicht verbunden → **Playwright in `%TEMP%capw`** (npm i playwright + Chromium) mit Smoke-Skripten gegen den Dev-Server; alle Blöcke im Browser (Desktop + 390 px) durchgeklickt, keine Konsolenfehler. Stolperstein: Vollseiten-Screenshots zeigen den Chart nach einem Rebuild leer (Layout-Artefakt), Pixelprüfung der Canvas war eindeutig.

## Stand 2026-09-10 (spät) — Nacharbeit aus den offenen Punkten (2 Commits, 71 Tests grün)

- **Setup-Erkennung neu geschrieben** (`engine/setupErkennung.ts`): zusätzlich S/R-Bounce (long/short, Swing-Cluster als Zone) und Liquidity Sweep (Docht unter Unterstützung + erster Close zurück). Breakout+Retest sucht den Ausbruch bis 250 Bars zurück und filtert Fakeouts (Close klar unter der Decke seit Ausbruch). Zonen-Toleranz adaptiv aus der Median-Kerzenspanne (0,4–6 %). Jeder Detektor feuert nur beim ersten Eintritt in seine Zone. **`setupErkennung.real.test.ts` prüft gegen die echten Datensätze**: ETH-Retest-Zone, SOL-Sweep am 5.8., BTC-Range/-Bounce werden gefunden, der BTC-Fakeout Apr 24 löst nichts aus, Trefferdichte < 10 %. Erste Fassung war an echten Daten komplett daneben (Ausbruchs-Hoch als Level, 12-Bar-Fenster, Treffer an jeder Bar) — Lehre: Detektoren immer gegen echte Daten testen, nicht nur synthetisch.
- **Lektionen lazy:** `content/lektionen/meta.ts` (generiert per `npm run gen:meta`, Staleness-Test) im Start-Bundle, Texte per dynamic import beim Öffnen. Index-Chunk 367 → 259 kB.

## Stand 2026-10-06 — Simulator-Umbau zum Backtesting-Werkzeug (96 Tests grün)

Anlass: Kurs durchgearbeitet, aber „das Testen anhand der historischen Daten klappt nicht richtig“. Technisch lief der alte Simulator fehlerfrei — er taugte nur nicht zum Testen (Zufallsabschnitt, 300 Kerzen, Preise blind eintippen, SL/TP-Linien oft außerhalb des Bildes, keine Zeitachse).

- **Sitzungen** (`data/sitzung.ts`, `hooks/useSitzung.ts`): Symbol (9 Coins), Timeframe (5m–1D), Startdatum wählbar oder blind/zufällig. Kerzen in festen 1000er-Blöcken relativ zum Start (Cache trifft beim Fortsetzen), Nachladen 250 Kerzen vor dem Datenende, Replay bis „heute“. Tempo bis 50 Kerzen/s (ab 25/s mehrere Kerzen je Tick). Auto-Pause bei Fill/Exit. Stand liegt in `simulatorStore.aktiveSitzung` → Reload/Tab-Kill-fest, „Fortsetzen“ im Startdialog.
- **Broker** (`engine/broker.ts`): `marketSofort` (füllt zum aktuellen Schlusskurs — auch in den Übungen, vorher „nächste Kerze“), Stop-Entry neben Limit, Gaps (Open zählt), TP optional (`takeProfit: 0`), Maker-Gebühr für Limit-Einstieg/TP, Kosten im Zustand (`BrokerZustand.kosten`, einstellbar), MFE/MAE je Trade, `orderAendern`, Trade-Ids mit laufender Nummer (zwei Trades in derselben Kerze kollidierten sonst).
- **Chart** (`components/chart/HandelsChart.tsx`, ersetzt ReplayChart): einmal pro Mount gebaut; Timeframe-Wechsel, Indikatoren (EMA 20/50/200, RSI-Pane, Volumen) und nachgeladene Kerzen lassen Zoom in Ruhe. Preislinien per Id abgeglichen, **ziehbar** (Pointer-Capture in der Capture-Phase, Chart-Scroll währenddessen aus), in die Auto-Skalierung einbezogen. Trade-Marker, OHLC-Legende, Preis-Präzision je Kursgröße (`engine/format.ts`).
- **Order-Ticket** (`engine/orderEntwurf.ts`, `hooks/useHandel.ts`): Entwurf liegt bei der Seite, Ticket und Chart zeigen dasselbe. SL per ATR-Vielfachem, TP per R-Vielfachem, Preis im Chart antippen, Limit/Stop automatisch aus der Lage zum Kurs, Hebel-Limit (Größe wird gekappt), Notiz je Trade.
- **Auswertung**: `kennzahlen()` in `engine/auswertung.ts` (Profit-Faktor, Erwartungswert, Drawdown %, Verlustserie, MFE-Ausbeute), `SitzungsStatistik` live neben dem Chart; Journal-Tabelle mit MFE/MAE und Einstiegszeit.
- **Gefundener Altfehler:** Am Handy kam kein Tipp im Chart an (Zeichnen!) — lightweight-charts ruft bei Touch `preventDefault`, dann feuert kein `click`. Tipp-Erkennung läuft jetzt über Pointer-Events.
- Test: Playwright-Skripte in `%TEMP%\ca\pw` (smoke2–4): Desktop + 390 px, Maus- und CDP-Touch-Drag, Reload/Fortsetzen, Blockgrenze (1500 Kerzen 5m-DOGE), Datenende, Übung. Keine Konsolenfehler.

## Stand 2026-10-06 (später) — Setup-Rückblick am Sitzungsende (108 Tests grün)

Wunsch: in der Auswertung sehen, welche Setups man verpasst hat — mit Chart und woran man sie hätte erkennen können.

- `engine/rueckblick.ts`: `sucheSetups` (in Häppchen, friert die Seite nicht ein) scannt die gespielten Kerzen mit den Level-4-Detektoren, fasst dichte Treffer zusammen (gleiche Richtung < 15 Kerzen, gleiches Setup im offenen Entry-Fenster) und verwirft Signale auf einer Impulskerze gegen die Handelsrichtung (fallendes Messer). `bewerteIdeal`: fester, nachvollziehbarer Trade (Einstieg zum Schlusskurs der Signalkerze, SL/TP aus der Erkennung, SL-zuerst, nur bis zur letzten gespielten Kerze, CRV ≥ 1). `rueckblick`: Status je Setup — gehandelt (eigener Einstieg gleicher Richtung im Entry-Fenster), belegt (anderer Trade lief), sonst verpasst.
- `engine/setupErkennung.ts`: jedes Setup trägt jetzt `merkmale` (Checkliste), `ebenen`, `punkte` (Tests, Ausbruch, Sweep …) und ggf. `emaPerioden`. `erkenneImFenster` rechnet auf 420 Kerzen Rückschau (Kosten unabhängig von der Sitzungslänge; ~0,2 s für 760 Kerzen). Qualität nachgeschärft, nachdem die ersten echten Treffer im Chart schwach aussahen: Range braucht ≥ 2 Kantenwechsel (sonst Stufe), S/R-Level darf seit dem letzten Test nicht klar gebrochen sein, Sweep höchstens 8 Kerzen unter dem Level. Kuratierte Szenarien werden weiter gefunden (real-Test).
- `components/simulator/SetupRueckblick.tsx`: Zusammenfassung (x gehandelt, y verpasst, davon Gewinner/Verlierer, Summe R), Filter, je Setup aufklappbar: Chart im Moment des Signals mit Ebenen/Markierungen und Ideal-Trade, „Auflösung zeigen“, Merkmale-Checkliste, Link zur Lektion.
- „Stelle nochmal spielen“: startet 40 Kerzen vor dem Signal als **Wiederholung** (`useSitzung(..., wiederholung)`: kein Journal, kein Sichern). Die beendete Sitzung bleibt versteckt eingehängt → „Zurück zur Auswertung“ erhält den Rückblick.
- **Nachtrag (Rückmeldung „ein Setup hat sich selbst ausgestoppt“):** Analyse über 8 echte Märkte (342 Setups) zeigte Ideal-Trades mit unsinnig engem Stop (bis 0,19 ATR, CRV 15) und einen Fall, in dem der Docht der Signalkerze den Stop schon durchstoßen hatte. `bewerteIdeal` setzt den Stop jetzt mindestens 1 ATR vom Einstieg und immer 0,25 ATR jenseits des Signalkerzen-Extrems; Setups, deren CRV dadurch unter 1 fällt, entfallen. Befund aus derselben Analyse (noch nicht umgesetzt): Setups mit dem EMA-200-Trend brachten +22R (41 % Treffer), gegen den Trend −16R (31 %); Liquidity-Sweep-Long gegen den Trend nur 14 % Treffer.
- Lehre erneut: Detektor-Treffer immer im echten Chart ansehen — die Tests waren grün, die Bilder zeigten die Schwächen.

## Stand 2026-10-06 (abends) — Sechs Ausbauten rund um den Setup-Rückblick (120 Tests grün)

1. **Short-Seite der Erkennung:** Breakout+Retest, Liquidity Sweep und Range-Bounce erkennen jetzt beide Richtungen (`erkenneXxx(c, i, richtung)`). Wirkt auch in der Zufalls-Übung.
2. **Trend-Kennzeichnung:** `SetupFund.mitTrend` (Kurs über/unter EMA 200 zum Signal), Marke je Setup und Filter „nur mit Trend“ (Standard aus).
3. **Deutlichkeit statt Qualität:** `deutlichkeit()` 1–5 (Bestätigungen des Levels, Trendrichtung, CRV ≥ 1,5). Liste sortiert „Deutlichste zuerst“, zeigt 5, Rest per „Weitere anzeigen“.
4. **Eigene Trades gegenprüfen:** `pruefeEigeneTrades` — je Trade das passende erkannte Setup oder „kein erkanntes Setup“, plus Tag-Abgleich. Die Suche beginnt 30 Kerzen vor Sitzungsstart, damit frühe Trades ihr Setup finden.
5. **Rückblick im Journal:** kompakter Stand je Sitzung in `simulatorStore.rueckblicke` (max. 200, in Export/Import), `SetupBilanz` im Journal: je Setup angeboten/gehandelt/verpasst/Quote und was die verpassten gebracht hätten; Hinweis auf das am häufigsten verpasste Setup.
6. **Zeichenwerkzeuge:** Trendlinie (zwei Punkte, nach rechts verlängert, als `Zeichnung` gespeichert) und Messen (%, Preis, Kerzen; mit der Maus live). `zeichenPrimitive.ts` (vorher zonenPrimitive) zeichnet Zonen, Trendlinien und Messung; Punkte sind (Zeit, Preis) und überstehen den Timeframe-Wechsel.

**Befunde aus der Analyse über 8 Märkte (414 Setups) — wichtig für spätere Arbeit an der Erkennung:**
- Zahl der Level-Tests und CRV-Band sagen den Ausgang NICHT vorher (Stärke 3: 39 % Treffer, Stärke 5: 33 %). Deshalb heißt das Maß „Deutlichkeit“ und nicht „Qualität“.
- Trendfilter insgesamt leicht positiv (mit Trend 40 % / +19R, gegen 31 % / −9R), je Setup aber uneinheitlich: Sweep-Long gegen den Trend 14 %, Sweep-Short gegen den Trend 46 %. Stichprobe je Zelle klein (n = 10–40) und von der Marktphase geprägt → gegen-Trend-Setups werden nur gekennzeichnet, nicht ausgeblendet.

## Stand 2026-10-06 (nachts) — Git-Sync über GitHub (133 Tests grün)

Wunsch: Journal und Lernfortschritt in einem Git-Repository speichern, wählbar, mit Holen und Push.

- `engine/gitSync.ts` (pur): zwei Dateien `journal.json` / `fortschritt.json`, stabil serialisiert (sortierte Schlüssel, kein Zeitstempel → gleicher Stand = gleicher Text = kein Commit), Zusammenführen über die Merge-Funktionen aus `sicherung.ts`.
- `data/githubClient.ts`: Contents-API direkt aus dem Browser (CORS geprüft), `cache: 'no-store'` (GitHub erlaubt sonst 60 s Cache → veralteter sha). Push liest erst den Repo-Stand, führt zusammen, schreibt nur bei Änderung, wiederholt einmal bei 409. Über 1 MB Fallback auf den Raw-Medientyp.
- `stores/syncStore.ts` (`chartakademie-sync`): Repo, Ordner, Token, Auswahl — getrennt vom Nutzerstand, Token landet nie in Export/Repo.
- `components/GitSync.tsx` auf dem Dashboard: Repo-Vorschläge per Token, „ersetzen statt zusammenführen“ mit Rückfrage (für den Fall Journal-Reset), `simulatorStore.journalErsetzen`.
- Test: `githubClient.test.ts` mit nachgebauter Contents-API, Playwright `smoke7.mjs` (GitHub per Route-Mock). Erster echter Push aus der Live-App hat geklappt (Rückmeldung „geht“).
- Daten-Repo: `maximilianschettle-maker/chart-akademie-daten` (privat), Ordner `chartakademie/`.
- **Stolperstein beim ersten Push (409):** Im Daten-Repo lag eine von Hand angelegte *Datei* `chartakademie` — unter einer Datei kann GitHub keinen Ordner anlegen. Datei gelöscht; die App prüft bei 409/422 jetzt, ob ein Abschnitt des Ordner-Pfads eine Datei ist, und sagt das im Klartext (`ordnerIstDatei`). Wiederholung nach 409 wartet 700 ms.
- Hinweis: Daten-Repo getrennt vom App-Repo halten — das App-Repo ist öffentlich und jeder Push dorthin löst ein Deploy aus.

## Stand 2026-10-07 — Übungs-Bewertung repariert, vier Phasen ausgebaut (236 Tests grün)

Anlass: Korrekte Trades wurden „Daneben“ bewertet, Übersicht zeigte für alles grüne Haken. Vierphasiger Auftrag, je Phase Stopp und OK.

1. **Bugfixes:** Entry-Zeitfenster in der Szenario-Config begannen zu spät (Trend Bar 280 statt 288, Breakout 518 statt 528, Range 381, Bounce ab Rückeroberung 451), Sammelmeldung ersetzt. Zone/Fenster/Trigger nur noch aus `entryZone`/`kriterien`; Texte mit Platzhaltern `{zone}`, `{fenster}`, `{trigger}` (`textFuellen`). Limit-Fill im Broker war korrekt; neu: „Order nie gefüllt“ als eigener Grund mit erreichtem Tief. `bewertungAnzeige.ts` = einzige Stelle für Icon/Farbe je Status, `progressStore` speichert den besten Versuch (`besseresErgebnis`).
2. **Differenzierte Analyse** (`szenarioGrader.ts`): Kriterien Richtung, Trigger (Kerzenindex aus den Daten), Entry-Zeit, Entry-Preis (Toleranz 1 %, CRV-Folge gegen Ideal-Entry), Stop (Seite + `stopRegel`-Level), CRV — je ok/warnung/fehler mit Soll/Ist/Satz. Fehler → falsch, Warnung → gut (neuer Status), sonst perfekt; `bilanz` trennt Prozess und Ergebnis. `idealTrade()` spielt den Ideal-Trade ab dem Trigger durch. Review (`uebungsReview.ts`): eigener Trade + Ideal-Trade (blau gepunktet), Entry-Fenster als Box (`ChartBox`, `zeichenPrimitive`), Marker `hinweis`. **Entscheidung:** Bei Bounce/Sweep ist die Rückeroberung der Trigger, vorab gefüllte Limits gelten als „Trigger nicht abgewartet“ — bei Bedarf eine Zeile im Grader (Warnung statt Fehler).
3. **Mehrere Trades** (`uebungsVerlauf.ts`): Sperre nur bei offener Position/Order; logische Trades (Teil-Exits zusammen) einzeln bewertet, bester zählt; Zusammenfassung; Durchlauf-Historie im Seiten-Zustand (nicht im Store).
4. **Zone in einer Kerze:** Ticket startet mit Limit/Stop (`useHandel.standardTyp`), Tipp im Aufgabentext; `autoPause.ts` (0,5 % vor der Zone, ab Trigger−1, Hinweis-Box); `erreichbareKerzen` → unter `minErreichbareKerzen` (2) Grund `nurLimit` statt verpasst. **Intrabar** (`engine/intrabar.ts`): `scripts/hole-unterkerzen.mjs` holt 15m zu 1h bzw. 1h zu 4h (`public/szenarien/<name>-15m.json`), Simulator lädt Unterkerzen je Block mit (`ladeUnterkerzen`). Teilstand `{cursor, teil}` in `useReplay`/`useSitzung`, Broker je Unterkerze, OHLC-Pfad (grün O→L→H→C, rot O→H→L→C) als Rückfall. Fill-Zeiten sind Unterkerzen-Zeiten → Grader `kerzenIndex`, Chart rastet Marker ein. Setting `einstellungen.unterkerzenAnzeigen` (Chart-Basis = Unterkerzen, Haupt-Intervall als Timeframe-Knopf).
- **Im Browser gefunden** (Playwright `%TEMP%\ca\pw\smoke9–11`): `HandelsChart` baut bei Wechsel des Basis-Intervalls neu auf (sonst Absturz beim inkrementellen Update), `SimulatorPage` greift vor der ersten Replay-Kerze nicht mehr auf die Startkerze zu (candles = sichtbare Kerzen).
- Stolperstein: lange Heredocs im Bash-Tool scheitern („unexpected EOF“) → Patch-Skripte per Write-Tool anlegen.

## Stand 2026-10-21 nachts — Währungsumrechnung (294 Tests grün)

- Worker `GET /api/wechselkurse?paare=HKDCNY,USDEUR` → Yahoo quote `XXXYYY=X`, Cache-API 1 h je Paar, Antwort {kurse, fehlend}. Deployt (Version f9cf8147).
- Engine `waehrung.ts`: paarSymbol/paarCode, kursUmrechnen (Beträge ja, Verhältnisse nein), kursFuerKennzahlen (Kurs in Berichtswährung, wenn Wechselkurs da), betragUmrechnen (direkt oder rückwärts), wechselkursText.
- Service: `ladeFirma` holt bei abweichender Kurswährung automatisch den Wechselkurs (IndexedDB-Store `wechselkurse`, DB v3, 1 h) → `daten.wechselkurs`; Hinweis „… werden nicht berechnet“ wird durch „… mit 1 HKD = 0,85 CNY umgerechnet“ ersetzt. Firmenseite, Watchlist und Vergleich rechnen Kennzahlen mit `kursFuerKennzahlen` → XPeng (HKD/CNY) hat jetzt KBV 2,2×, KUV, FCF-Rendite usw.
- Vergleich: Schalter „Beträge anzeigen in jeweiliger Währung / EUR / USD“ (Store `vergleichsWaehrung`, nur lokal), Größe-Zeilen werden umgerechnet (XPeng 70,9 Mrd. HKD → 8,0 Mrd. €, Apple 5,0 Bio. $ → 4,5 Bio. €); fehlende Paare → Hinweis, Wert bleibt original.
- Geprüft: Playwright gegen `vite preview` + Prod-Worker (XPeng-Firmenseite, Vergleich XPeng/SAP/Apple in EUR), 0 Konsolenfehler.
- Offen: Commit + Push. Ideen: Kurschart mit indexierter Vergleichslinie im Vergleich, Vergleich als gespeicherte Ansicht, DCF in Anzeige-Währung.

## Stand 2026-10-21 spät — Firmenvergleich (288 Tests grün)

- Seite `/aktien/vergleich?s=SAP.DE,AAPL` (`VergleichPage.tsx`): Auswahl steht in der URL (teilbar), Chips zum Entfernen, Watchlist-Einträge als „+“-Knöpfe, Ticker-Eingabe, max. 6 Firmen. Einstiege: „Vergleichen →“ neben der Watchlist (ab 2 Einträgen, erste 4 vorausgewählt) und Knopf „Vergleich“ auf der Firmenseite.
- Engine `src/aktien/engine/vergleich.ts`: VERGLEICH_GRUPPEN (Größe, Bewertung, Profitabilität, Wachstum, Bilanz) mit Richtung je Zeile (hoch / niedrig / niedrigPositiv für Multiples / keine), `besteSpalte` (mind. 2 Werte, Gleichstand = keine Hervorhebung), `symboleAusText`. Beträge in Firmenwährung, nicht umgerechnet → Größe-Zeilen ohne „beste“.
- Tabelle: sticky Kennzahl-Spalte, horizontal scrollbar am Handy, beste Zelle grün (`bg-long/10`). Daten über `ladeFirma` (Cache zuerst) je Spalte, Fehler bleiben in der Spaltenüberschrift stehen.
- Geprüft: Playwright gegen `vite preview` + Prod-Worker, Desktop und 390 px; dabei zog der Geräte-Sync die echte Watchlist des Nutzers (SPCX, 9868.HK) — Tests dürfen die Watchlist nie verändern. Zwei 404-Konsolenmeldungen stammen vom SEC-Endpunkt für Nicht-SEC-Firmen (erwartet, wird als Hinweis angezeigt).
- Offen: Commit + Push (löst Pages-Deploy aus), danach Test am Handy. Ideen: Währungsumrechnung für Größe-Zeilen, Vergleich als Watchlist-Ansicht speichern, Kurschart mit Vergleichslinie (indexiert) im Vergleich.

## Stand 2026-10-28 (später) — Markt-Tracker: Charttechnik auf Tageskerzen mit Push (328 Tests grün)

Wunsch: „Portfolio“ der gängigen Märkte (S&P 500, Nasdaq, Gold, Bitcoin + ein paar) laufend charttechnisch auswerten, Muster wählbar (Breakout, Tunnel …), Push bei Treffern. Gleiche Architektur wie der Makro-Teil: Action → JSON → Frontend, Push über `sende-push.ts`.

- **Engine** `src/tracker/engine/analyse.ts` (rein, Tests in `analyse.test.ts`): Breakout = erster Schluss über dem Hoch der 20 Vortage (Vorschluss lag noch darunter → kein Dauerfeuer im Trend), 52-Wochen-Marke im Titel; Tunnel = längstes Fenster 15–60 Tage mit Höhe ≤ 4 × ATR14 und je ≥ 2 Berührungen beider Ränder (Randzone 20 %), Signale „Tunnel erkannt“ (vorher keiner) und „am Rand“ (Lage wechselt); EMA-Kreuz 20/50 und 50/200; RSI-Kreuzung 70/30; Lehrbuch-Setup über `erkenneImFenster` nur wenn `signalIndex` = letzte Kerze. Letzte Kerze = heute → `vorlaeufig`. Signal-Id `instrument:muster:richtung:datum` = Dedupe je Tageskerze. Katalog `katalog.ts` (11 Instrumente mit Yahoo-Symbolen, 5 Muster, `normalisiereConfig`).
- **Skript** `scripts/tracker/hole-tracker.ts` läuft mit **tsx** (neue devDependency), weil die Engine Code aus `src/` ohne Dateiendungen importiert (Node-Type-Stripping scheitert daran; die Makro-Skripte importieren aus src nur Typen). Yahoo v8 chart direkt (`query1.finance.yahoo.com/v8/finance/chart/…?range=2y&interval=1d`, geht ohne Crumb; Kerzenzeit auf UTC-Tagesanfang normiert, `regularMarketPrice` als Live-Kurs), Coinbase-Candles als Krypto-Fallback, sonst alter Stand. Stooq fällt aus (JS-Challenge). Signale 30 Tage gemergt (Erstsichtung bleibt). Schreiben nur bei Kernänderung, Kursbewegung ≥ 0,3 % oder Stand > 20 h. Typprüfung `npm run tracker:check` (eigene tsconfig mit bundler-Resolution; include eng halten, sonst zieht `uebungsReview.ts` eine tsx-Datei rein).
- **Konfiguration ohne Backend:** Worker-Route `GET/PUT /api/tracker` (KV-Key `tracker`, 409 bei älterem Stand) – **Worker muss neu deployt werden**. App-Store `src/tracker/store.ts` (persist + Abgleich über `anfrage` aus dem Aktien-Client, Schreiben entprellt 1,2 s). Action liest mit Secrets `AKTIEN_WORKER_URL`/`AKTIEN_SECRET`, sonst `data/tracker-config.json`. `configQuelle` steht in tracker.json.
- **Workflow** `tracker.yml`: `5 7-22 * * 1-5` + `5 8,14,20 * * 0,6`; Concurrency-Gruppe `daten-action` gemeinsam mit macro.yml (beide committen `data/push-status.json`). Push: `faelligeTrackerPushes` in `push-logik.ts` (nur aktive Muster, nur Signale ≤ 2 Tage alt, max. 6 je Lauf, Key `tracker:<id>`), `sende-push.ts` hängt sie an die Zins-Pushes an (URL `#/tracker`).
- **Frontend** `src/tracker/`: `useTracker` (wie useMakro), `TrackerPage` (`/tracker`: Einstellungen einklappbar mit Instrument-/Muster-Chips, Push-Schalter, Sync-Status; je Instrument Karte mit Kurs, Trend, Tunnel, 20T-Marken, RSI, ChartPanel mit EMA 20/50, Preislinien 20T-Hoch/-Tief + Tunnel, Signal-Marker; Signalliste), `TrackerWidget` auf dem Dashboard (Kurse + 4 neueste Signale). ChartPanel bekam keine Änderung.
- Live-Lauf 28.10. abends: 6 Instrumente, Tunnel bei S&P/Gold/BTC/DAX/EURUSD erkannt, Signale „DAX am oberen Tunnelrand“, „EUR/USD am unteren Rand + RSI überverkauft“ (vorläufig). Playwright-Smoke (`ca-smoke/smoke-tracker.mjs`): Handy + Desktop, 6 Karten, Chips schalten, 0 Konsolenfehler, 0 px Überlauf.
- **Einrichtung 2026-10-28 abends erledigt:** Commit 0838464 gepusht, Worker deployt (Version a917746a, /api/tracker antwortet), Secrets gesetzt (VAPID ×3, AKTIEN_WORKER_URL/AKTIEN_SECRET, FRED_API_KEY, PUSH_SUBSCRIPTION), beide Actions grün, FRED-API aktiv, Test-Push am Xiaomi (Android 14, Chrome) angekommen. Stolperstein: Heim-WLAN blockiert FCM („Registration failed – push service error“) → Abo über Mobilfunk angelegt; im Router/DNS-Filter mtalk.google.com, fcm.googleapis.com, android.googleapis.com freigeben. Offen: Tracker-Einstellungen in der App (Worker-KV noch leer → Standardauswahl), Kalender-Abo.
- **Offen (Nutzer):** siehe Checkliste in der Session-Antwort (Commit/Push, Worker-Deploy, Secrets inkl. AKTIEN_WORKER_URL/AKTIEN_SECRET, Actions manuell starten, Push einrichten). Ideen: Muster-Parameter (20 Tage, ATR-Faktor) in der App einstellbar, Wochenkerzen-Modus, Intraday-Check der Levels mit Live-Kurs statt nur Tageskerze, Signal-Bilanz (wie oft lief der Breakout weiter?).

## Stand 2026-10-28 — Zinsentscheidungen Fed/EZB: Daten-Action, Widget, PWA-Push (319 Tests grün)

Wunsch: Live-Daten zu Fed- und EZB-Zinsentscheidungen mit Push aufs Handy, ohne eigenen Server. Annahme „einzelne HTML-Datei“ stimmte nicht: Vite/React-App, Pages-Deploy und PWA (Manifest, sw.js) gab es schon — deshalb kein Umbau, nur Erweiterung.

- **Datenskript** `scripts/macro/` (TypeScript, läuft direkt mit Node 24 ohne Build; `npm run macro:check` für Typen): `hole-macro.ts` schreibt `public/data/macro.json` (Vertrag in `src/makro/types.ts`) und `zinsentscheidungen.ics`. Nur schreiben bei Inhaltsänderung oder wenn `lastUpdated` > 20 h alt (so höchstens ein Commit pro Tag ohne Änderung, der Stand bleibt aussagekräftig). Ausgabe `changed=` nach GITHUB_OUTPUT.
- **Quellen geprüft (alle erreichbar):** FRED-API braucht Key; `fredgraph.csv?id=DFEDTARU,DFEDTARL` geht ohne Key → Fallback. FOMC-Seite: Panels je Jahr (nicht chronologisch: 2026, 2025 … 2027), Zeilen `fomc-meeting__month`/`__date`, Sternchen = SEP, Sonderfälle „Apr/May 30-1“, „August 22 (notation vote)“; Statement-Link je Zeile. EZB-Einlagesatz `FM.B.U2.EUR.4F.KR.DFR.LEV` liefert nur Änderungstage = Gültigkeitsdatum (Mittwoch nach der Entscheidung). EZB-Kalender zeigt nur künftige Sitzungen (Day 1/Day 2; manche Day-1-Einträge ohne Kennung, z.B. 11.10.2028) → Vergangenes aus `data/ezb-dates.json`. EZB hat keinen Geldpolitik-RSS, nur `rss/press.html` (gefiltert auf „Monetary policy decisions“; ältere Entscheidungen fallen raus → Ergebnis dann aus der Zinshistorie abgeleitet, sobald die Sitzung > 10 Tage her ist).
- **Ergebnis-Erkennung:** Fed-Statement-Text „target range for the federal funds rate … at/to X to Y percent“ (Brüche wie 4-1/4; `<strong>`-Tags im Text → erst Tags strippen). Live bestätigt: FOMC 28.10.2026 um 19:03 Uhr als „unverändert 3,75–4,00 %“ erkannt (RSS + Statement). EZB: „deposit facility … N.NN%“ aus der Pressemitteilung.
- **Workflow** `macro.yml`: Cron `0 6 * * *` + `*/10 11-22 * * 2-4` (UTC-Raster deckt beide DST-Lagen ab), `lauf-noetig.ts` bricht Raster-Läufe ohne nahen Termin vor `npm ci` ab (`github.event.schedule` enthält den Cron-Ausdruck). Commit mit GITHUB_TOKEN löst `deploy.yml` nicht aus → `gh workflow run deploy.yml` (braucht `actions: write`). deploy.yml ignoriert Pushes, die nur `data/` oder notes.md ändern.
- **Push:** `push-logik.ts` (rein, getestet): Fenster Vortag [T−30h, T−3h], kurz vorher [T−75min, T−15min], Ergebnis [T, T+36h] nur wenn `letzteEntscheidung.datum` = Termin; Sendestatus `data/push-status.json` (committet, 60 Tage). `sende-push.ts` mit `web-push` (devDependency), `--test` für workflow_dispatch `aktion=test-push`. 404/410 = Subscription abgelaufen → Hinweis im Log. Secrets: FRED_API_KEY (optional), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION. Public Key wandert über die Action in macro.json (`push.publicKey`).
- **Frontend** `src/makro/`: `laden.ts` (fetch no-cache, letzter guter Stand im localStorage, veraltet ab 36 h), `useMakro` (ein Fetch je Seite, Tick 30 s, Reload bei visibilitychange), `format.ts` (alles Europe/Berlin per Intl), `ZinsKarte`/`ZinsWidget` (Dashboard), `ZinsChart` (SVG-Treppen, Fed-Band + EZB-Linie, 3J/5J/10J/Alles), `PushEinstellungen` (Subscription als JSON zum Kopieren, iOS-Hinweis bei nicht installierter App, lokaler Anzeige-Test, webcal/ICS), `MakroPage` unter `/makro` (kein 5. Nav-Eintrag – wäre am Handy zu eng; Widget verlinkt). `termine.ts`: Marker auf Kerzen rasten; Simulator-Chip „Zinsen“ (`SimEinstellungen.zinsen`, im Blind-Modus ausgeblendet, weil Fed/EZB-Marker das Datum verraten), Aktien-KursChart-Knopf „Zinsen“ (localStorage).
- **sw.js** → `ca-v2`: `/data/` netz-zuerst (sonst bliebe macro.json ewig im Cache), `push`- und `notificationclick`-Handler (Payload {titel,text,url,tag}; interne URL → Fenster fokussieren, externe → öffnen).
- Geprüft: Playwright gegen `vite preview` (Handy 390 px + Desktop), 0 Konsolenfehler, 0 px Überlauf; Push-Trockenlauf mit Live-Daten lieferte „Fed: unverändert 3,75–4,00 %“ + „EZB-Zinsentscheidung morgen 14:15 Uhr“.
- Stolpersteine: Bash-Heredocs mit vielen Dateien in einem Aufruf scheiterten am Quoting → Write-Tool je Datei. Playwright in `%LOCALAPPDATA%\Temp\ca-smoke` musste neu installiert werden (1.58.2, Skript `smoke-makro.mjs`). ESM-Imports mit Windows-Pfaden brauchen `file:///`.
- **Offen (Nutzer):** Commit + Push, Secrets setzen, Action einmal manuell laufen lassen, App am Handy aktualisieren (SW-Version), Push aktivieren, Subscription als Secret, Test-Push. Danach echten Lauf am 29.10. (EZB) beobachten. Ideen: Fed-Pressekonferenz (14:30 NY) als zweiter Marker, Dot-Plot-Link bei SEP-Sitzungen, Zinsmarker auch in Übungen.

## Stand 2026-10-21 abends — Kurschart auf der Firmenseite (281 Tests grün)

- Worker: `GET /api/chart/:symbol?bereich=1M|6M|1J|5J|MAX` → yahoo-finance2 `chart()` (1d/1d/1d/1wk/1mo), Cache-API 1 h (1M–1J), 6 h (5J), 1 Tag (MAX). Antwort `KursChart` {symbol, waehrung, bereich, kerzen[], standAm}; ~0,3 s kalt, 3–70 KB. „No data found/delisted“ → 404. Deployt (Version b6a5d600).
- Gemeinsam `src/aktien/engine/chart.ts`: BEREICHE, periodeAb, kerzenAusChart (OHLC-Lücken raus, Zeit = Tagesanfang UTC, Duplikate → letzte), chartVeraenderung (Start/Ende/%/Hoch/Tief). Tests mit Fixture `yahoo-sap-chart.json`.
- Browser: IndexedDB-Store `charts` (DB-Version 2, Upgrade mit contains-Prüfung), `ladeChart` in service.ts (Frische = Worker-TTL, bei Netzfehler alter Stand), Komponente `KursChart.tsx` (Zeitraum-Tabs, Veränderung farbig, Hoch/Tief, Kerzenart, Stand) im Überblick-Tab über den Kennzahlen. `ChartPanel` bekam nur das optionale Prop `zeitSichtbar` (bleibt die einzige lightweight-charts-Stelle).
- Geprüft: Playwright gegen `vite preview` + Prod-Worker, Desktop und 390 px, 1J und 5J, 0 Konsolenfehler.

## Stand 2026-10-21 — Worker deployt, Quellen von Cloudflare aus erreichbar

- `npx wrangler login` (Konto maximilian.schettle@gmail.com, Account-ID 92510c77…), KV-Namespace AKTIEN_KV = `8b16d3abad0445c5af80e88f8d13b91d` (in `worker/wrangler.toml` eingetragen), Secrets `AKTIEN_SECRET` (neu erzeugt, 48 Hex, liegt nur in `worker/.prod.secret`, gitignored) und `SEC_USER_AGENT` (Wert aus `.dev.vars`) gesetzt, `npm run worker:deploy` → **https://chart-akademie-aktien.chart-akademie.workers.dev** (Version f40e5b2f).
- Stolperstein: direkt nach dem ersten Deploy ~5 min TLS-Handshake-Fehler (Alert 40) auf der neuen workers.dev-Subdomain, Zertifikat war noch nicht ausgestellt; von selbst erledigt.
- Remote-Tests (curl): `/api/status?pruefen=1` → yahoo ok, sec ok; ohne Token 401; Suche „sap“ ok; Kurs AAPL ok; SEC SAP kalt 3,0 s / warm 0,16 s (KV), SEC AAPL kalt 2,0 s (46 KB), SIE.DE → 204; Yahoo SAP.DE/AAPL kalt 1,7 s; Zustand leer → null; Fantasie-Ticker → 404 mit Meldung. 10-ms-CPU-Limit hat nicht gegriffen.
- GitHub Pages (Workflow deploy.yml, letzter Lauf 2026-10-16 grün) enthält den Aktien-Bereich bereits: https://maximilianschettle-maker.github.io/chart-akademie/#/aktien (HashRouter).
- Smoke-Test der Live-App gegen den Worker (Playwright in %LOCALAPPDATA%\Temp\ca-smoke\smoke.mjs, Store per localStorage vorbelegt): Desktop und 390 px, Suche „SAP“ → SAP.DE → Überblick mit SEC+Yahoo-Badges, Kurs, Kennzahlen, Wachstum; 0 Konsolenfehler. Chrome-Extension war wieder nicht verbunden.
- QR-Codes zum Abtippen am Handy: `worker/.prod.secret.qr.png` (Geheimnis) und `worker/.worker-url.qr.png` (URL), beide gitignored.
- 2026-10-21 abends: Nutzer hat URL + Geheimnis eingetragen, Test am Handy erfolgreich. Offen: `worker/wrangler.toml` + `.gitignore` sind noch nicht committet (beim goodnight). Danach: Kurschart, Firmenvergleich.

## Stand 2026-10-16 — Aktien-Bereich: Fundamentalanalyse (SEC EDGAR + Yahoo, Cloudflare Worker; 274 Tests grün)

Wunsch: Fundamentalanalyse für US- und EU-Aktien, privat, auch am Handy, kostenlos. EODHD geprüft (Fundamentals ab 59,99 €/Monat, Demo-Token nur sechs Ticker) → verworfen zugunsten SEC EDGAR (XBRL, kostenlos, 10+ Jahre, auch 20-F-Filer wie SAP/ASML) + Yahoo Finance (yahoo-finance2 v4, inoffiziell, Suche/Kurs/Profil/4 Jahre Bilanzen).

- **Architektur:** Browser kann beide Quellen nicht direkt (CORS, SEC braucht User-Agent) und Handy braucht einen erreichbaren Proxy → **Cloudflare Worker** in `worker/` (Free: 100k Requests/Tag, **10 ms CPU je Aufruf**). Deshalb SEC über `companyconcept` je Kennzahl (4–50 KB) statt `companyfacts` (1–4 MB), Yahoo ohne Schema-Validierung, Endpunkte getrennt (`/api/yahoo/:symbol`, `/api/sec/:symbol`, `/api/kurs/:symbol`), Zusammenführen im Browser. KV-Cache 7 Tage (Liegezeit 90 Tage → bei Ausfall alter Stand mit `veraltet`), Kurs/Suche über Cache-API (15 min / 1 Tag, kein KV-Schreiblimit). `/api/zustand` (KV) = Geräte-Sync für Watchlist, DCF-Annahmen, manuelle CIKs; neuerer Stand gewinnt, lokal seitdem Hinzugefügtes bleibt.
- **Gemeinsamer Code** `src/aktien/engine/`: `sec.ts` (Tag-Kandidaten us-gaap/ifrs-full/dei je Feld, FY-Auswahl: Jahresformen + fp FY + Dauer 340–380 Tage — im 10-K stecken auch Q4-Werte mit fp FY!, je Stichtag jüngste Einreichung = Restatements; Quartale aus 10-Q, Cashflow dort nur kumuliert → Q_n = YTD_n − YTD_n−1, Q4 = FY − ΣQ; Schulden = gesamt sonst lang + kurz; CIK über Ticker, sonst normalisierter Name), `yahoo.ts` (fundamentalsTimeSeries annual/quarterly, Vorzeichen: Capex/Dividenden/Rückkäufe negativ), `normalisierung.ts` (SEC gewinnt, Yahoo füllt Lücken, nie bei Währungskonflikt), `kennzahlen.ts`, `dcf.ts` (zwei Phasen + Gordon, Sensitivität), `format.ts` (Mrd./Mio., de-DE). Fixtures aus echten SEC-Antworten (AAPL, SAP) in `engine/fixtures/`.
- **Browser** `src/aktien/`: Store `chartakademie-aktien` (Worker-URL + Geheimnis nur im Browser; Dev-Standard localhost:8787/test), IndexedDB `chartakademie-aktien` (Firmen 7 Tage, Kurse 15 min), `data/sync.ts` modulweit (Debounce-Write überlebt Seitenwechsel — als Hook im Effect-Cleanup ging der PUT verloren), Seiten `/aktien` (Suche, Watchlist, Worker-Einstellungen) und `/aktien/:symbol` (Überblick-Kacheln, Zahlen-Tabelle FY/Q mit sticky Posten-Spalte, DCF). Bestand nur in `App.tsx` berührt (zwei Routen, ein Nav-Eintrag).
- **Worker-Stolpersteine:** benannte Exporte neben `default` (z.B. `export const VERSION`) lassen workerd nicht starten („Incorrect type for map entry“). `InstanceType<typeof YahooFinance>` als Typ der Instanz. Lokal: `wrangler dev` + `worker/.dev.vars`.
- **Geprüft lokal:** SAP.DE (SEC 2015–2025 EUR + Yahoo-Quartale), AAPL (17 Jahre, 69 Quartale, Q4 abgeleitet), ASML.AS (Name → CIK), SIE.DE (204 → Yahoo only), Fantasie-Ticker (404 sauber). Playwright-Smoke (`smoke-aktien.mjs` im Scratchpad): Desktop + 390 px, Reload aus Cache, DCF-Annahme gespeichert, Worker aus → Hinweis.
- **Offen:** `wrangler login` + Deploy durch den Nutzer (Phase 0 remote: blockt Yahoo/SEC Cloudflare-IPs? Fallback Deno Deploy/Vercel), KV-Namespace-ID in `wrangler.toml`, Secrets, Test am Handy. Später: Vergleich mehrerer Firmen, Kurschart (Yahoo chart + ChartPanel), SEC-Schulden bei US-Firmen enthalten kein Commercial Paper (nur ein Posten je Stichtag, kein Doppelzählen).

Bewusst nicht gebaut: mehrere Positionen gleichzeitig / Nachkaufen, Liquidations-Simulation, Schritt zurück.

Offen / Ideen für später:
- Am echten Handy prüfen (Touch-Zeichnen, Homescreen-Install, SW-Update-Verhalten).
- Detektor-Trefferqualität in der Zufalls-Übung im Alltag beobachten (Zonen ggf. enger/weiter).
- Git-Sync: „Holen“ am Handy ausprobieren; ggf. Auto-Sync (Holen beim Start, Push nach Sitzungsende).
- Mehr Szenarien für die Meisterprüfung (ohne Strategie-Ansage), Trailing-Stop im Broker, ETH/SOL-Szenarien.
- Übungen: Trigger bei Bounce/Sweep ggf. als Warnung statt Fehler; Übungs-Historie dauerhaft speichern; Unterkerzen für die Offline-Vorräte.

Stolpersteine:
- lightweight-charts v5-API ≠ v4-Tutorials (`chart.addSeries(CandlestickSeries, …)`, Marker via `createSeriesMarkers`).
- Chrome-Extension (claude-in-chrome) war nicht verbunden → UI-Test im Browser manuell machen.
