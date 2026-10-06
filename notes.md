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
- Lehre erneut: Detektor-Treffer immer im echten Chart ansehen — die Tests waren grün, die Bilder zeigten die Schwächen.

Bewusst nicht gebaut: mehrere Positionen gleichzeitig / Nachkaufen, Liquidations-Simulation, Schritt zurück, Trendlinien.

Offen / Ideen für später:
- Am echten Handy prüfen (Touch-Zeichnen, Homescreen-Install, SW-Update-Verhalten).
- Detektor-Trefferqualität in der Zufalls-Übung im Alltag beobachten (Zonen ggf. enger/weiter).
- Backend-Sync statt JSON-Datei, wenn Handy-Nutzung wirklich Alltag wird.
- Mehr Szenarien für die Meisterprüfung (ohne Strategie-Ansage), Trailing-Stop im Broker, ETH/SOL-Szenarien.

Stolpersteine:
- lightweight-charts v5-API ≠ v4-Tutorials (`chart.addSeries(CandlestickSeries, …)`, Marker via `createSeriesMarkers`).
- Chrome-Extension (claude-in-chrome) war nicht verbunden → UI-Test im Browser manuell machen.
