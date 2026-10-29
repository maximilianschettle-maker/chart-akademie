# ChartAkademie

Eine Trading-Lern-App für Krypto: Schritt für Schritt vom Candlestick bis zum eigenen, regelbasierten Trading — mit echten historischen Charts, interaktiven Demos und einem Bar-für-Bar-Replay-Simulator.

## Aufbau der App (seit 2026-10-29)

Drei Hauptbereiche, am Handy als untere Tab-Leiste, am Desktop als Reiter im Kopf (`src/navigation.ts`):

- **Start** (`#/`) — kompaktes Dashboard: Weiterlernen, nächste Fed/EZB-Termine, Markt-Tracker mit Signalen, Aktien-Watchlist, letzte Journal-Einträge, Statuspunkt der Worker-Daten.
- **Training** (`#/training`) — Segment-Leiste Lernpfad · Simulator · Journal; Lektionen, Übungen und Wiederholung sind Detailseiten darunter.
- **Analyse** (`#/analyse/…`) — Segment-Leiste Aktien · Tracker · Makro & News (Notenbanken, später Wirtschaftskalender und Geopolitik-Board).

**Chart-Bedienung** (alle Charts, `src/components/chart/gesten.ts`): Preisachse mit einem Finger oder der Maus hoch/runter ziehen = strecken/stauchen; zwei Finger auf dem Chart = Pinch-Zoom in beide Richtungen und Verschieben (auch senkrecht); ein Finger waagerecht = scrollen, senkrecht = Seite scrollen; Mausrad = Zeit zoomen, nach einem Achsen-Zug zieht die Maus den Chart auch senkrecht. Doppeltipp/Doppelklick auf den Chart oder der Knopf „Auto“ setzt auf automatische Skalierung und eingepasste Zeitachse zurück.

**Trader / Investor** (Schalter rechts neben der Analyse-Segment-Leiste, gespeichert in `chartakademie-ansicht`): gleiche Daten, andere Voreinstellungen. *Trader*: Kerzenchart (HandelsChart) mit 5-Minuten-, 15-Minuten- und Tageszeiträumen (Worker `/api/chart?bereich=1T|5T|…`, Intraday ab Yahoo nur ~60 Tage zurück), EMA 20/50/200, RSI, Volumen, Zeichenwerkzeuge (Linie, Zone, Trendlinie, Messen; je Symbol gespeichert) und ein Chance-Risiko-Rechner, dessen Einstieg/Stop/Ziel als ziehbare Linien im Chart liegen (Stückzahl aus Konto × Risiko, CRV, Beträge; Schnellwahl Stop in %, Ziel in R; Tipp in den Chart übernimmt einen Preis). *Investor*: Schlusskurs-Linie über 1 J / 5 J / Max mit Log-Skala, Leitzins-Overlay (Fed-Funds-Mitte für USD, EZB-Einlagesatz für EUR, aus `macro.json`) auf der linken Achse und sechs Kennzahlen (KGV, Umsatz 5 J., Dividendenrendite, Nettomarge, FCF-Rendite, Eigenkapitalquote) direkt unter dem Chart; der Tracker zeigt Tageskerzen dann als Linie über 2 Jahre. Zinsentscheide lassen sich in beiden Ansichten markieren.

**Makro & News – Wirtschaftskalender und Geopolitik-Board** (seit 2026-10-29, Phase 4): Die Action `board.yml` (`scripts/board/hole-board.ts`, stündlich, getaktet vom Worker-Cron) schreibt `public/data/kalender.json` und `public/data/news.json`; die Seite liest nur diese Dateien (`src/board/`). *Kalender:* Veröffentlichungstermine für Inflation, Arbeitsmarkt und BIP – USA über FRED `release/dates` (braucht das Secret `FRED_API_KEY`; ohne Key nur BIP-Termine vom BEA-Terminplan, bea.gov blockt keine Skripte, bls.gov schon) und Euroraum über den Eurostat-Terminkalender (`/o/calendars/eventsJson`, ohne Key); zuletzt gemeldete Werte mit Vorwert aus dem FRED-CSV-Export (CPIAUCSL als Jahresrate, UNRATE, PAYEMS als Monatsveränderung, A191RL1Q225SBEA) und der Eurostat-API (prc_hicp_manr, une_rt_m, namq_10_gdp; Geo-Code EA21 → EA20 → EA, weil der Euroraum-Code mit jeder Erweiterung wandert). Grenze: keine Konsens-Prognosen (nur bei Bezahlanbietern), Eurostat-Flash-Werte erscheinen erst mit dem regulären Datensatz. *Newsboard:* kuratierte RSS-Feeds (tagesschau, DW, Spiegel Wirtschaft, FAZ Wirtschaft, Handelsblatt, BBC World, NYT World, EIA Today in Energy), eingeordnet in vier feste Kategorien (Handel/Zölle/Sanktionen, Konflikte, Energie/Rohstoffe, Wahlen/Politik) und mit Tags potenziell betroffener Märkte (Öl, Gas, EUR/USD, Rüstung, Halbleiter, Gold, Anleihen, Aktien) – alles Schlüsselwortregeln in `scripts/board/regeln.ts`, getestet, bewusst grob. GDELT (DOC-API) ist eingebaut, aber standardmäßig aus (`GDELT: '0'`): die API erlaubt eine Anfrage je 5 s je IP und antwortet von GitHub-Runnern praktisch immer mit 429. Meldungen bleiben 72 Stunden, höchstens 90 Einträge.

Alte Pfade (`#/simulator`, `#/journal`, `#/aktien/…`, `#/makro`, `#/tracker`) leiten weiter, Push-Links und Lesezeichen funktionieren also weiter. Touch-Ziele sind am Handy mindestens 44 px hoch (Klasse `tipp`), Seiten haben 16 px Seitenrand und keinen horizontalen Überlauf (per Playwright bei 390 px geprüft).

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

Eigener Bereich unter **Analyse → Aktien**: Firma suchen (US + EU), Watchlist, Firmenseite mit Kursverlauf (1 Monat bis Max), Kennzahlen (Bewertung, Profitabilität, Wachstum, Bilanz), Mehrjahres-Tabelle aus GuV/Bilanz/Cashflow (Geschäftsjahre und Quartale), ein Zwei-Phasen-DCF mit Sensitivitätsmatrix und ein Firmenvergleich (bis zu 6 Firmen nebeneinander, beste Spalte je Kennzahl markiert). Watchlist und DCF-Annahmen gleichen sich zwischen PC und Handy ab.

- **Quellen (kostenlos):** SEC EDGAR XBRL für alle US-Filer, auch EU-Firmen mit US-Listing (SAP, ASML, Novartis …, 10+ Jahre, geprüfte Berichte) und Yahoo Finance (inoffiziell) für Suche, Kurs, Profil und als Lückenfüller (ca. 4 Jahre).
- **Technik:** Beide Quellen sind aus dem Browser nicht erreichbar (CORS). Ein kleiner **Cloudflare Worker** (`worker/`) holt, normalisiert und cacht die Daten (KV, 7 Tage) und hält den Geräte-Sync. Er ist mit einem eigenen Geheimnis geschützt; es gibt keine Anbieter-Schlüssel. Der gemeinsame Code (Normalisierung, Kennzahlen, DCF) liegt in `src/aktien/engine/` und ist getestet.

### Einrichtung in fünf Schritten

1. Kostenloses Cloudflare-Konto, dann einmalig `npx wrangler login`.
2. KV-Namespace anlegen: `npx wrangler kv namespace create AKTIEN_KV --config worker/wrangler.toml` und die ausgegebene `id` in `worker/wrangler.toml` eintragen.
3. Geheimnisse setzen (werden nie ins Repo geschrieben): `npx wrangler secret put AKTIEN_SECRET --config worker/wrangler.toml` (frei gewähltes Passwort) und `npx wrangler secret put SEC_USER_AGENT --config worker/wrangler.toml` (Pflichtangabe der SEC: `Name E-Mail`).
4. `npm run worker:deploy` → gibt die Worker-URL aus (`https://chart-akademie-aktien.<konto>.workers.dev`).
5. In der App unter Aktien → Daten-Worker → Einstellungen die URL und das Geheimnis eintragen, „Verbindung prüfen“. Auf dem Handy dasselbe.

Lokal: `npm run worker:dev` startet den Worker auf Port 8787 mit den Werten aus `worker/.dev.vars` (gitignored, z.B. `AKTIEN_SECRET=test`); der Dev-Server nimmt diese Adresse als Standard. `npm run worker:check` prüft die Typen des Workers.

Limits: Workers Free hat 100.000 Aufrufe/Tag, 10 ms CPU je Aufruf und 1.000 KV-Schreibvorgänge/Tag — deshalb holt der Worker je Kennzahl kleine SEC-Antworten statt des großen Gesamtdokuments, und Kurse werden höchstens alle 30 Minuten je Symbol in KV gesichert (davor ein Speicher-Cache im Isolate). Yahoo ist kein offizieller Dienst; fällt es aus, liefert der Worker den letzten Stand (`veraltet: true`, `standAm`).

Robustheit (seit 2026-10-29): Jede Anfrage bekommt einen eigenen Yahoo-Client mit Zeitlimit (ein geteilter Client hing unter parallelen Anfragen → Cloudflare-Fehlerseite ohne CORS-Header → „Worker nicht erreichbar“), der Worker antwortet spätestens nach 25 s mit 504, Fehler tragen immer CORS-Header. Die App wiederholt lesende Anfragen dreimal mit Backoff, zeigt bei Ausfall den gespeicherten Stand mit „Stand: …“ und oben rechts einen Statuspunkt (Daten live / veraltet / Fehler). Nachsehen bei Problemen: Cloudflare-Dashboard → Workers & Pages → chart-akademie-aktien → Logs und Metrics; https://www.cloudflarestatus.com; lokal `npx wrangler tail chart-akademie-aktien --config worker/wrangler.toml`.

**Cron-Wecker für die GitHub Actions:** GitHubs Scheduler lässt Läufe massenhaft aus (29.10.2026: 2 von ~45 Tracker-Läufen). Deshalb stößt der Worker die Workflows `tracker.yml` und `macro.yml` per `workflow_dispatch` an (`worker/src/cron.ts`, Zeiten in `wrangler.toml`, Wochentage als Namen, weil Cloudflare 1 = Sonntag zählt). Einrichtung: feingranulares GitHub-Token nur für dieses Repo mit „Actions: Read and write“ erzeugen (Settings → Developer settings → Fine-grained tokens), dann `npx wrangler secret put GITHUB_DISPATCH_TOKEN --config worker/wrangler.toml`. `/api/status` zeigt unter `cron`, ob das Token gesetzt ist, wann zuletzt angestoßen wurde und den letzten Fehler. Die Schedules in den Workflows bleiben als Fallback; doppelte Läufe fängt die Concurrency-Gruppe ab.

## Zinsentscheidungen (Fed & EZB) mit Push

Widget auf dem Dashboard und Seite **Zinsentscheidungen** (`#/makro`): aktueller Leitzins (Fed-Zielkorridor, EZB-Einlagesatz), letzte Änderung in Basispunkten, nächste Sitzung mit Countdown (deutsche Zeit, Zeitumstellung berücksichtigt), Ergebnis am Entscheidungstag („unverändert 3,75–4,00 %“), Link zum Statement, Zinshistorie als Chart, kommende Termine (SEP markiert), Pressemitteilungen. Im Simulator (nicht im Blind-Modus) und im Aktien-Kurschart lassen sich die Entscheidungstage als Marker zuschalten („Zinsen“).

- **Kein Backend, keine Schlüssel im Browser:** Die GitHub Action `macro.yml` (`scripts/macro/`) holt die Daten und schreibt `public/data/macro.json` (Feld `lastUpdated`) plus `public/data/zinsentscheidungen.ics`; committet wird nur bei Änderung, danach stößt sie den Pages-Deploy an. Das Frontend liest ausschließlich diese Datei; der Service Worker holt `data/` netz-zuerst.
- **Quellen:** FRED `DFEDTARU`/`DFEDTARL` (mit Secret `FRED_API_KEY`, sonst der CSV-Export ohne Key), FOMC-Kalender `federalreserve.gov/monetarypolicy/fomccalendars.htm` (Fallback `data/fomc-dates.json`), Fed-RSS „Monetary Policy“, EZB-Einlagesatz über das ECB Data Portal (`FM.B.U2.EUR.4F.KR.DFR.LEV`), EZB-Sitzungskalender (nur künftige Termine; Vergangenes in `data/ezb-dates.json`), EZB-Presse-Feed gefiltert auf „Monetary policy decisions“.
- **Zeitplan:** täglich 06:06 UTC; Di–Do alle 10 Minuten 11:03–22:53 UTC (bewusst nicht zur vollen Stunde/Zehn-Minuten-Marke: dort lässt GitHubs Scheduler Läufe aus) (deckt EZB 14:15 Frankfurt und Fed 14:00 New York in Sommer- und Winterzeit ab). Raster-Läufe brechen sofort ab, wenn kein Termin nah ist (`lauf-noetig.ts`). Cron-Verspätung ist eingeplant: breite Push-Fenster, Sendestatus in `data/push-status.json`.
- **Web Push (VAPID):** Die Action verschickt selbst (`sende-push.ts`): am Vortag, 15–75 Minuten vorher und sobald das Ergebnis vorliegt. Einrichtung: `npm run push:keys` → Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:); dann in der App unter Zinsentscheidungen → Benachrichtigungen aktivieren, die angezeigte Subscription als Secret `PUSH_SUBSCRIPTION` hinterlegen. iPhone: nur aus der auf dem Home-Bildschirm installierten App (ab iOS 16.4). Testmodus: Actions → „Makro-Daten“ → Run workflow → Aktion `test-push`.
- **Kalender-Backup:** `https://maximilianschettle-maker.github.io/chart-akademie/data/zinsentscheidungen.ics` (webcal-Link auf der Makro-Seite), mit Erinnerungen am Vortag und eine Stunde vorher.
- Lokal: `npm run macro:holen` (schreibt die JSON), `npm run macro:check` (Typen), Tests in `scripts/macro/macro.test.ts` laufen mit `npm test`.

## Markt-Tracker (Charttechnik mit Push)

Seite **Markt-Tracker** (`#/tracker`) und Karte auf dem Dashboard: die gängigen Märkte (S&P 500, Nasdaq 100, DAX, Euro Stoxx 50, Nikkei, Gold, Silber, Öl, Bitcoin, Ethereum, EUR/USD – wählbar) auf Tageskerzen, je Instrument Kurs, Tagesveränderung, Trend (EMA 50/200), 20-Tage-Hoch/-Tief, RSI, Chart mit Marken und die Signale der letzten 30 Tage.

- **Muster (einzeln zuschaltbar):** Breakout (erster Schluss über dem 20-Tage-Hoch / unter dem 20-Tage-Tief, 52-Wochen-Marken werden genannt), Tunnel/Range (seit ≥ 15 Tagen zwischen zwei Marken, Höhe ≤ 4 × ATR, beide Ränder mehrfach berührt; Meldung bei Entstehen und am Rand), EMA-Kreuzung (20/50, 50/200), RSI extrem (70/30), Lehrbuch-Setups aus der Übungs-Engine (`engine/setupErkennung.ts`) auf Tageskerzen. Engine in `src/tracker/engine/analyse.ts`, getestet.
- **Zwei Ebenen:** Tageskerzen (Swing, 2 Jahre) und Stundenkerzen (Intraday, ~400 Kerzen) – gleiche Regeln, Fenster in Tagen bzw. Stunden, je Ebene eigene Muster- und Push-Schalter. Umschalter je Instrument-Karte. Die Stundenebene ist durch den Action-Takt bis zu ~30 Minuten verzögert; eine 15-Minuten-/Daytrading-Ebene braucht eine andere Engine (Worker-Cron), siehe notes.md.
- **Ablauf:** Action `tracker.yml` (`scripts/tracker/hole-tracker.ts`, werktags alle 15 Minuten zu :04/:19/:34/:49, am Wochenende alle zwei Stunden) holt Yahoo-Kerzen (Krypto-Fallback Coinbase), analysiert beide Ebenen, trägt Signale der letzten 25 Tages- bzw. 200 Stundenkerzen rückwirkend nach (markiert als `nachgetragen`, ohne Push), schreibt `public/data/tracker.json`, pusht neue Signale (höchstens sechs je Lauf, nur Signale der letzten zwei Tage) und committet nur bei neuen Kerzen/Signalen oder Kursbewegung über 1 %. Live-Kurse holt die App selbst über den Worker (`/api/kurs`, alle 5 Minuten), sofern er unter Aktien eingetragen ist. Signale der laufenden Kerze heißen „vorläufig“.
- **Konfiguration ohne Backend:** Instrumente, Muster und Push-Schalter werden in der App gesetzt und im Worker-KV abgelegt (`/api/tracker`, Worker neu deployen: `npm run worker:deploy`). Die Action liest sie mit den Secrets `AKTIEN_WORKER_URL` und `AKTIEN_SECRET`; ohne Worker gilt `data/tracker-config.json`. Änderungen wirken ab dem nächsten Lauf.
- Lokal: `npm run tracker:holen` (schreibt die JSON), `npm run tracker:check` (Typen).

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
npm run macro:holen    # Fed/EZB-Daten nach public/data/macro.json (wie die Action)
npm run macro:check    # Typen des Makro-Skripts
npm run push:keys      # VAPID-Schlüsselpaar für Web Push erzeugen
npm run tracker:holen  # Markt-Tracker: Kurse holen, analysieren, public/data/tracker.json
npm run tracker:check  # Typen des Tracker-Skripts und der Engine
```

Neue Übungs-Datensätze: `node scripts/hole-szenario.mjs SYMBOL INTERVAL VON BIS NAME` (legt JSON unter `public/szenarien/` ab und druckt eine Tages-Übersicht mit Bar-Indizes zum Definieren der Entry-Zonen).

## Hinweis

Reines Lernprojekt. Keine Anlageberatung — alle Simulationen laufen mit fiktivem Kapital.

## Deployment & Handy

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages:
**https://maximilianschettle-maker.github.io/chart-akademie/**

Auf dem Handy: Link im Browser öffnen, dann „Zum Startbildschirm hinzufügen" (Android: Chrome-Menü; iOS: Teilen-Symbol). Die App startet danach wie eine native App im Vollbild. Fortschritt und Journal liegen im Browser-Speicher des jeweiligen Geräts.

Technik: `base: '/chart-akademie/'` in `vite.config.ts`, `HashRouter` (GitHub Pages kennt keine Server-Rewrites), PWA-Manifest unter `public/manifest.webmanifest`.
