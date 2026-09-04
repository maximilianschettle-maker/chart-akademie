# ChartAkademie

Eine Trading-Lern-App für Krypto: Schritt für Schritt vom Candlestick bis zum eigenen, regelbasierten Trading — mit echten historischen Charts, interaktiven Demos und einem Bar-für-Bar-Replay-Simulator.

## Features

- **Geführter Lernpfad** — 5 Level, 23 Lektionen mit Quiz-Freischaltung:
  1. Grundlagen (Candlesticks, Timeframes, Orderbuch, Leverage)
  2. Risikomanagement (1-%-Regel, Stop-Loss, R-Multiple, Psychologie)
  3. Parameter & Marktdaten (Volume, Volume Profile, OI & Funding, Liquidation & Liquidity Map, Heatmaps, EMA & RSI)
  4. Strategien (Trendfolge, S/R-Bounce, Breakout+Retest, Range, Liquidity Sweep)
  5. Praxis (Szenario-Serie, freier Replay, Journal)
- **Geführte Chart-Übungen** — echte historische Setups, Kerze für Kerze: Finde den Entry, setze Stop und Ziel, bekomme Feedback samt Ideal-Trade.
- **Freier Replay-Simulator** — zufälliger historischer Marktabschnitt mit verdecktem Symbol und Datum, Order-Ticket mit Risiko-basiertem Position Sizing, automatisches Trade-Journal.
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
