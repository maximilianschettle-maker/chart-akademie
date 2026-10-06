# ChartAkademie

Eine Trading-Lern-App für Krypto: Schritt für Schritt vom Candlestick bis zum eigenen, regelbasierten Trading — mit echten historischen Charts, interaktiven Demos und einem Bar-für-Bar-Replay-Simulator.

## Features

- **Geführter Lernpfad** — 5 Level, 23 Lektionen mit Quiz-Freischaltung:
  1. Grundlagen (Candlesticks, Timeframes, Orderbuch, Leverage)
  2. Risikomanagement (1-%-Regel, Stop-Loss, R-Multiple, Psychologie)
  3. Parameter & Marktdaten (Volume, Volume Profile, OI & Funding, Liquidation & Liquidity Map, Heatmaps, EMA & RSI)
  4. Strategien (Trendfolge, S/R-Bounce, Breakout+Retest, Range, Liquidity Sweep)
  5. Praxis (Szenario-Serie, freier Replay, Journal, Meisterprüfung ohne Ansage)
- **Geführte Chart-Übungen** — neun echte historische Setups (BTC, ETH, SOL), Kerze für Kerze: Finde den Entry, setze Stop und Ziel, bekomme Feedback samt Ideal-Trade. Inklusive Fällen, in denen „kein Trade“ die richtige Antwort ist, und einer Prüfung ohne Ansage des Setups.
- **Zufalls-Übung** — regelbasierte Setup-Erkennung (Range-Bounce, Trend-Pullback, Breakout+Retest) in zufälligen Marktabschnitten: unendlich viele Übungen.
- **Replay-Simulator (Backtesting von Hand)** — Symbol (9 Coins), Timeframe (5m–1D) und Startdatum frei wählbar oder blind/zufällig; Replay ohne festes Ende (Kerzen werden nachgeladen, bis zu 50 Kerzen/s), Sitzung übersteht Reload. Orders direkt im Chart: SL/TP antippen oder als Linien ziehen, ATR- und R-Vorschläge, Market (sofort), Limit und Stop-Entry, Trailing-Stop, Teilverkauf, Break-even. Realistische Kosten (Taker/Maker, Slippage, Funding, Gaps, Hebel-Limit — einstellbar). Timeframe-Wechsel im Chart, EMA 20/50/200, RSI, Zeichenwerkzeuge, Trade-Marker. Live-Statistik je Sitzung: Trefferquote, Profit-Faktor, Erwartungswert in R, Drawdown, MFE/MAE, Equity-Kurve.
- **Journal mit Auswertung** — Equity-Kurve, R-Verteilung, Auswertung nach Setup/Tageszeit/Haltedauer, regelbasierte Hinweise auf Fehler-Muster (Stop zu eng, zu früh raus, Übertraden nach Verlust …).
- **Spaced Repetition** — falsch beantwortete Quizfragen kommen nach 1/3/7/14/30 Tagen wieder.
- **Export/Import** — Fortschritt und Journal als JSON-Datei zwischen Geräten übertragen (Import führt zusammen).
- **Echte Daten** — Binance Spot-API (mit Bybit-Fallback und IndexedDB-Cache); die Übungs-Datensätze liegen statisch im Repo und funktionieren offline.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest (Broker-Engine, Indikatoren)
npm run build   # tsc + vite build
npm run lint    # oxlint
```

Neue Übungs-Datensätze: `node scripts/hole-szenario.mjs SYMBOL INTERVAL VON BIS NAME` (legt JSON unter `public/szenarien/` ab und druckt eine Tages-Übersicht mit Bar-Indizes zum Definieren der Entry-Zonen).

## Hinweis

Reines Lernprojekt. Keine Anlageberatung — alle Simulationen laufen mit fiktivem Kapital.

## Deployment & Handy

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages:
**https://maximilianschettle-maker.github.io/chart-akademie/**

Auf dem Handy: Link im Browser öffnen, dann „Zum Startbildschirm hinzufügen" (Android: Chrome-Menü; iOS: Teilen-Symbol). Die App startet danach wie eine native App im Vollbild. Fortschritt und Journal liegen im Browser-Speicher des jeweiligen Geräts.

Technik: `base: '/chart-akademie/'` in `vite.config.ts`, `HashRouter` (GitHub Pages kennt keine Server-Rewrites), PWA-Manifest unter `public/manifest.webmanifest`.
