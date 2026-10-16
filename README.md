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
- **Replay-Simulator (Backtesting von Hand)** — Symbol (9 Coins), Timeframe (5m–1D) und Startdatum frei wählbar oder blind/zufällig; Replay ohne festes Ende (Kerzen werden nachgeladen, bis zu 50 Kerzen/s), Sitzung übersteht Reload. Orders direkt im Chart: SL/TP antippen oder als Linien ziehen, ATR- und R-Vorschläge, Market (sofort), Limit und Stop-Entry, Trailing-Stop, Teilverkauf, Break-even. Realistische Kosten (Taker/Maker, Slippage, Funding, Gaps, Hebel-Limit — einstellbar). Timeframe-Wechsel im Chart, EMA 20/50/200, RSI, Zeichenwerkzeuge, Trade-Marker. Live-Statistik je Sitzung: Trefferquote, Profit-Faktor, Erwartungswert in R, Drawdown, MFE/MAE, Equity-Kurve. Zeichenwerkzeuge: Linien, Zonen, Trendlinien, Messen. Am Sitzungsende ein **Setup-Rückblick**: welche Setups (long und short) der Abschnitt angeboten hat, welche verpasst wurden — sortiert nach Deutlichkeit, mit Trend-Kennzeichnung, Chart zum Moment des Signals, Erkennungsmerkmalen, Auflösung und „Stelle nochmal spielen“ — sowie die Gegenprobe, welche eigenen Trades kein erkanntes Setup hatten. Das Journal führt darüber Bilanz über alle Sitzungen.
- **Journal mit Auswertung** — Equity-Kurve, R-Verteilung, Auswertung nach Setup/Tageszeit/Haltedauer, regelbasierte Hinweise auf Fehler-Muster (Stop zu eng, zu früh raus, Übertraden nach Verlust …).
- **Spaced Repetition** — falsch beantwortete Quizfragen kommen nach 1/3/7/14/30 Tagen wieder.
- **Export/Import** — Fortschritt und Journal als JSON-Datei zwischen Geräten übertragen (Import führt zusammen).
- **Git-Sync** — Journal und Lernfortschritt (einzeln wählbar) in einem eigenen GitHub-Repository sichern: „Holen“ und „Push“ auf dem Dashboard, als `journal.json` / `fortschritt.json` über die GitHub-API. Braucht ein Fine-grained Token mit „Contents: Read and write“ für das Daten-Repository (am besten privat, nicht das App-Repo); das Token bleibt im Browser.
- **Echte Daten** — Binance Spot-API (mit Bybit-Fallback und IndexedDB-Cache); die Übungs-Datensätze liegen statisch im Repo und funktionieren offline.

## Aktien (Fundamentalanalyse)

Eigener Bereich unter **Aktien**: Firma suchen (US + EU), Watchlist, Firmenseite mit Kennzahlen (Bewertung, Profitabilität, Wachstum, Bilanz), Mehrjahres-Tabelle aus GuV/Bilanz/Cashflow (Geschäftsjahre und Quartale) und ein Zwei-Phasen-DCF mit Sensitivitätsmatrix. Watchlist und DCF-Annahmen gleichen sich zwischen PC und Handy ab.

- **Quellen (kostenlos):** SEC EDGAR XBRL für alle US-Filer, auch EU-Firmen mit US-Listing (SAP, ASML, Novartis …, 10+ Jahre, geprüfte Berichte) und Yahoo Finance (inoffiziell) für Suche, Kurs, Profil und als Lückenfüller (ca. 4 Jahre).
- **Technik:** Beide Quellen sind aus dem Browser nicht erreichbar (CORS). Ein kleiner **Cloudflare Worker** (`worker/`) holt, normalisiert und cacht die Daten (KV, 7 Tage) und hält den Geräte-Sync. Er ist mit einem eigenen Geheimnis geschützt; es gibt keine Anbieter-Schlüssel. Der gemeinsame Code (Normalisierung, Kennzahlen, DCF) liegt in `src/aktien/engine/` und ist getestet.

### Einrichtung in fünf Schritten

1. Kostenloses Cloudflare-Konto, dann einmalig `npx wrangler login`.
2. KV-Namespace anlegen: `npx wrangler kv namespace create AKTIEN_KV --config worker/wrangler.toml` und die ausgegebene `id` in `worker/wrangler.toml` eintragen.
3. Geheimnisse setzen (werden nie ins Repo geschrieben): `npx wrangler secret put AKTIEN_SECRET --config worker/wrangler.toml` (frei gewähltes Passwort) und `npx wrangler secret put SEC_USER_AGENT --config worker/wrangler.toml` (Pflichtangabe der SEC: `Name E-Mail`).
4. `npm run worker:deploy` → gibt die Worker-URL aus (`https://chart-akademie-aktien.<konto>.workers.dev`).
5. In der App unter Aktien → Daten-Worker → Einstellungen die URL und das Geheimnis eintragen, „Verbindung prüfen“. Auf dem Handy dasselbe.

Lokal: `npm run worker:dev` startet den Worker auf Port 8787 mit den Werten aus `worker/.dev.vars` (gitignored, z.B. `AKTIEN_SECRET=test`); der Dev-Server nimmt diese Adresse als Standard. `npm run worker:check` prüft die Typen des Workers.

Limits: Workers Free hat 100.000 Aufrufe/Tag und 10 ms CPU je Aufruf — deshalb holt der Worker je Kennzahl kleine SEC-Antworten statt des großen Gesamtdokuments. Yahoo ist kein offizieller Dienst; fällt es aus, liefert der Worker den letzten Stand („veraltet“).

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest (Broker-Engine, Indikatoren)
npm run build   # tsc + vite build
npm run lint    # oxlint
npm run worker:dev     # Aktien-Worker lokal (Port 8787)
npm run worker:check   # Typen des Workers
npm run worker:deploy  # Worker auf Cloudflare veröffentlichen
```

Neue Übungs-Datensätze: `node scripts/hole-szenario.mjs SYMBOL INTERVAL VON BIS NAME` (legt JSON unter `public/szenarien/` ab und druckt eine Tages-Übersicht mit Bar-Indizes zum Definieren der Entry-Zonen).

## Hinweis

Reines Lernprojekt. Keine Anlageberatung — alle Simulationen laufen mit fiktivem Kapital.

## Deployment & Handy

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages:
**https://maximilianschettle-maker.github.io/chart-akademie/**

Auf dem Handy: Link im Browser öffnen, dann „Zum Startbildschirm hinzufügen" (Android: Chrome-Menü; iOS: Teilen-Symbol). Die App startet danach wie eine native App im Vollbild. Fortschritt und Journal liegen im Browser-Speicher des jeweiligen Geräts.

Technik: `base: '/chart-akademie/'` in `vite.config.ts`, `HashRouter` (GitHub Pages kennt keine Server-Rewrites), PWA-Manifest unter `public/manifest.webmanifest`.
