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

Offen / nächste Phasen:
1. Phase 2: replayEngine + broker + bewertung (+ vitest), SimulatorPage, freier Replay-Modus (Datum verdeckt), JournalPage.
2. Phase 3: szenarioGrader, UebungPage, 3 kuratierte Szenarien, Content Level 2.
3. Phase 4: Indikatoren (ema, rsi, volumeProfile, liqMap) + Demos, Content Level 3+4.
4. Phase 5: Level 5, Bybit-Fallback, Vault-Notiz, Polish.

Stolpersteine:
- lightweight-charts v5-API ≠ v4-Tutorials (`chart.addSeries(CandlestickSeries, …)`, Marker via `createSeriesMarkers`).
- Chrome-Extension (claude-in-chrome) war nicht verbunden → UI-Test im Browser manuell machen.
