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

Offen / Ideen für später:
- Am Handy prüfen: Homescreen-Install, Chart-Bedienung per Touch (lightweight-charts), OrderTicket-Layout auf schmalen Screens.
- Code-Splitting (Bundle > 500 kB Warnung).
- Mehr Szenarien für die Meisterprüfung (ohne Strategie-Ansage), Trailing-Stop im Broker, ETH/SOL-Szenarien.

Stolpersteine:
- lightweight-charts v5-API ≠ v4-Tutorials (`chart.addSeries(CandlestickSeries, …)`, Marker via `createSeriesMarkers`).
- Chrome-Extension (claude-in-chrome) war nicht verbunden → UI-Test im Browser manuell machen.
