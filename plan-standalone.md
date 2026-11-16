# Plan: Standalone-App mit Einladungscodes (Schritt 1 des Release-Fahrplans)

Stand 2026-11-16. Ziel: Jemand installiert die PWA, gibt einmal einen Einladungscode ein, und alles
läuft: Aktien, Live-Kurse, KI (Screenshot, Prüfung, Coach), Geräte-Sync, Journal- und Fortschritt-Sync,
Tracker, Push. Keine Worker-URL, kein Geheimnis, kein GitHub-Repo mehr in der App.

## Entscheidungen (Nutzer, 2026-11-16)

- Push je Nutzer **sofort** (Abos im Worker, Actions holen sie dort ab).
- Tracker-Konfiguration **je Nutzer**, die Action holt die **Vereinigung** aller Instrumente.
- Git-Sync **bleibt als Option** neben dem neuen Worker-Sync.
- KI-Limit **10 Aufrufe je Code und Tag**, je Code überschreibbar, Admin unbegrenzt.

## Leitentscheidungen (Technik)

| Thema | Entscheidung | Warum |
|---|---|---|
| Dienst-Token | `AKTIEN_SECRET` bleibt, Rolle `dienst`, `nutzerId: 'admin'` | Kein neues Secret in GitHub/wrangler; alte App-Stände laufen beim Rollout weiter |
| Code-Format | `CA-XXXX-XXXX-XXXX`, Alphabet ohne 0/O/1/I (32 Zeichen, 60 Bit) | Tippbar, Link teilbar (`#/zugang?code=…`), gegen Raten sicher genug |
| Code-Speicherung | KV `code:<sha256hex>`, Klartext nur einmal bei Erzeugung | KV-Dump verrät keine Codes |
| Admin-Werkzeug | Admin-Endpunkte im Worker + CLI `npm run codes` | Ein getesteter Pfad, kein `wrangler kv`-Gefummel |
| Journal/Fortschritt-Sync | PUT mergt **serverseitig** und liefert den gemergten Stand, kein 409 | Merge-Regeln sind kommutativ/idempotent |
| Merge-Funktionen im Worker | Neues importfreies `src/engine/mergen.ts`, bestehende Module re-exportieren | `sicherung.ts`/`gitSync.ts` ziehen über `journal/engine.ts` Katalog + Strategien mit; das darf nicht ins Worker-tsc |
| Store-Migration | `useAktienStore` persist `version: 2`, `secret` → `code` | Alter Wert ist das Dienst-Token, Owner-Geräte laufen nach dem App-Deploy sofort weiter |
| Legacy-Keys `zustand`/`tracker` | Lazy-Fallback im Worker für `admin` | Kein manueller Migrationsschritt |
| Sync-Umfang | Journal (tradeHistorie, rueckblicke, eintraege) + Fortschritt (lektionen, szenarien, wiederholungen, **uebungsLog**) | Top-Down-Runden, Zeichnungen, Ansicht: Folgeschritt |

## Phase 0 – Vorbereitung (pure Module, kein Verhaltenswechsel)

1. **`src/engine/mergen.ts`** (neu, keine Imports): `mergeTrades`, `mergeRueckblicke`, `mergeLektionen`,
   `mergeSzenarien`, `mergeWiederholungen` (aus `sicherung.ts`), `mergeEintraege` (aus `journal/engine.ts`),
   `BEWERTUNG_RANG` (aus `szenarioGrader.ts`), neu `mergeUebungsLog` (Union je `am|szenarioId|strategieId`,
   max 500), `stabilJson(wert)` (sortierte Schlüssel, wie `stabil()` in `gitSync.ts`). Generische Signaturen
   (`<T extends { id: string; … }>`). Die drei Quellmodule re-exportieren → bestehende Tests bleiben grün.
   Test: `mergen.test.ts` nur für `mergeUebungsLog` und `stabilJson`.
2. **`src/zugang/code.ts`** (neu, importfrei): `CODE_ALPHABET`, `CODE_REGEX`, `codeAusZufall(bytes)`,
   `codeNormalisieren(eingabe)` (trim, Großschreibung, Trennzeichen raus, neu gruppieren, null bei ungültig),
   `codeMaskieren(code)` → `CA-••••-••••-K7PQ`. Test `code.test.ts`.
3. **`src/tracker/engine/union.ts`** (neu): `trackerUnion(configs)` – Instrumente vereinigt in
   Erstnennungs-Reihenfolge, Muster/Stunden je Id ODER, `aktualisiertAm` = max, leer → `normalisiereConfig(null)`.
   Test `union.test.ts`.
4. **`worker/tsconfig.json`**: include `../src/engine/mergen.ts`, `../src/zugang/code.ts`,
   `../src/tracker/engine/katalog.ts`, `../src/tracker/engine/union.ts`; exclude `src/**/*.test.ts`.
   **`vitest.config.ts`**: include `worker/src/**/*.test.ts`.

## Phase 1 – Worker: Zugang, Rollen, Codes

1. **`worker/src/zugang.ts`** (neu): Typen `Rolle = 'admin'|'nutzer'|'dienst'`, `CodeEintrag {nutzerId, name,
   rolle, kiLimitTag?, angelegtAm, gesperrt?}`, `Zugang {nutzerId, name, rolle, kiLimitTag: number|null}`,
   `KI_LIMIT_STANDARD = 10`. KV-Keys: `code:<hash>` (CodeEintrag, plus KV-Metadata für `list`),
   `nutzer:<id>` → `{codeHash}` (Index), `zuletzt:<id>` → `{am}` (höchstens einmal je Berlin-Tag, In-Isolate-Memo).
   `zugangPruefen(req, env)`: Bearer = `AKTIEN_SECRET` → Dienst; sonst `codeNormalisieren` → SHA-256 → KV
   (Isolate-Cache 5 min) → 401 „Einladungscode ungültig“ / 403 „Einladungscode gesperrt“.
   `pruefeZugang` + `zeitkonstantGleich` aus `http.ts` hierher. Test mit Fake-KV (Map).
2. **`worker/src/nutzerDaten.ts`** (neu): `nutzerLesen/nutzerSchreiben(env, art, id)` auf `${art}:${id}`;
   Lazy-Fallback auf die alten globalen Keys `zustand`/`tracker` nur für `admin` (Kommentar mit Ablaufdatum).
3. **`worker/src/kiLimit.ts`** (neu): `berlinTag(ms)` (wie `tagVon` in `journal/engine.ts`), Key
   `ki:<id>:<YYYY-MM-DD>` (TTL 2 Tage), `kiPruefen` → 429 „KI-Tageslimit erreicht (10 von 10). Morgen geht es
   weiter.“, `kiZaehlen` nach **erfolgreichem** Aufruf. Test: Tagesgrenze, Limit, Admin unbegrenzt, Override.
4. **`worker/src/admin.ts`** (neu, nur admin/dienst): `GET /api/admin/codes` (Liste aus `list({prefix:'code:'})`
   + Metadata + `zuletzt`), `POST /api/admin/codes {name, nutzerId?, rolle?, kiLimitTag?}` → `{code, eintrag}`
   (Code nur hier im Klartext, 409 bei doppelter Id), `PATCH /api/admin/codes/:id {gesperrt?, kiLimitTag?, name?}`,
   `DELETE /api/admin/codes/:id` (Nutzerdaten bleiben). `nutzerId: 'admin'` ist für den Owner reserviert.
5. **`worker/src/sync.ts`** (neu): `GET/PUT /api/sync/journal` und `/api/sync/fortschritt`. PUT: alt lesen →
   mergen (`mergen.ts`) → Rückblicke auf 200, uebungsLog auf 500 kürzen → nur schreiben wenn
   `stabilJson(neu) !== stabilJson(alt)` → gemergten Stand `{…, standAm}` zurückgeben. Body ≤ 2 MB.
6. **`worker/src/push.ts`** (neu): `push:<id>` = Liste `PushAbo {endpoint, keys, expirationTime?, geraet?,
   angelegtAm}` (max 10, ältestes fällt). `GET /api/push/abo` (ohne keys), `PUT` (Upsert je endpoint),
   `DELETE {endpoint}`. **CORS in `http.ts` um `DELETE, PATCH` erweitern.**
7. **`worker/src/dienst.ts`** (neu, nur dienst/admin): `GET /api/dienst/tracker` → `{config: trackerUnion(alle),
   nutzer, quellen}`; `GET /api/dienst/push` → `{nutzer: [{nutzerId, abos, tracker}]}` (Tracker-Config je
   Nutzer mitliefern, damit die Action Signale je Nutzer filtert); `POST /api/dienst/push/abgelaufen`.
8. **`worker/src/index.ts`**: `bearbeiten(req, env, url, ctx)`, `zugang = await zugangPruefen(...)`,
   `zuletztMerken` via `ctx.waitUntil`. Neu `GET /api/ich` → `{nutzerId, name, rolle, ki: {heute, limit}, version}`.
   `/api/zustand`, `/api/tracker` → je Nutzer (409-Regel bleibt). `/api/ki/*` mit `kiPruefen`/`kiZaehlen`.
   Router-Abschnitte sync/push/dienst/admin mit Rollenprüfung (403 „Nur für Admin“). `VERSION = '0.4.0'`,
   Kopfkommentar aktualisieren. Keine neuen Secrets; lokal bleibt `AKTIEN_SECRET=test` das Dienst-Token.

## Phase 2 – App: feste URL, Code-Eingabe

1. **`src/aktien/config.ts`** (neu): `WORKER_URL` = `VITE_WORKER_URL` oder DEV `http://localhost:8787` oder
   prod `https://chart-akademie-aktien.chart-akademie.workers.dev`.
2. **`src/aktien/store.ts`**: `workerUrl`/`secret` → `code` (DEV `'test'`, prod `''`); persist `version: 2`,
   `migrate` exportiert und getestet (`store.test.ts`): `code = alt.secret`.
3. **`src/aktien/data/client.ts`**: `workerKonfiguriert()` → `codeVorhanden()` (Aufrufstellen: `tracker/store.ts`,
   `tracker/liveKurse.ts`, `TrackerPage.tsx`, `journal/snapshots.ts`, `JournalEintragPage.tsx`,
   `JournalScreenshotPage.tsx`, `TopDownPage.tsx`, `TradeCoach.tsx`, `WatchlistKompakt.tsx`, `VergleichPage.tsx`,
   `AktienPage.tsx`, `aktien/data/sync.ts`). `anfrage`: Basis `WORKER_URL`, Bearer = Code; eigener
   `Authorization`-Header in `init` übergeht die Store-Prüfung (für „Code prüfen“ vor dem Speichern).
   Fehlertexte 401 „Einladungscode ungültig“, 403 „Einladungscode gesperrt“. `client.test.ts` anpassen.
4. **`src/aktien/data/sync.ts`**: Schlüssel und Subscribe auf `code`.
5. **`src/zugang/`** (neu):
   - `ich.ts`: `Ich`-Typ, `ichLaden(code?)`, nicht-persistierter `useZugangStore {ich, status, fehler, pruefen()}`,
     `pruefen()` beim App-Start wenn Code vorhanden.
   - `CodeEingabe.tsx`: Eingabe mit Live-Normalisierung, Vorbelegung aus `?code=`, „Code prüfen“ →
     `ichLaden(code)` → erst bei Erfolg `einstellungenSetzen({code})`, „Willkommen, {name}“.
   - `ZugangKarte.tsx` ersetzt `aktien/components/WorkerEinstellungen.tsx`: ohne Code `CodeEingabe`; mit Code
     maskierter Code, Name, Rolle (bei `dienst`: „Dienst-Token im Browser, bitte Admin-Code eintragen“),
     „KI heute 3 von 10“, letzter Abgleich, „Verbindung prüfen“ (`statusPruefen`), „Code entfernen“.
   - `ZugangHinweis.tsx`: Einzeiler mit Link `/zugang`, ersetzt alle Texte „Kein Worker eingetragen …“
     (`TradeCoach.tsx`, `JournalEintragPage.tsx` ×2, `JournalScreenshotPage.tsx`, `TopDownPage.tsx`,
     `TrackerPage.tsx`, `VergleichPage.tsx`).
   - `ZugangPage.tsx`: Route `/zugang` (ohne Segment-Leiste, wie `/wiederholung`), in `App.tsx` lazy.
   - Platzierung: `StartPage.tsx` zeigt `ZugangKarte` oben nur ohne Code („Mit Einladungscode: Kurse, KI-Coach,
     Geräte-Sync, Push. Ohne Code: Lernpfad, Simulator, Übungen, Journal lokal.“); `AktienPage.tsx` ersetzt
     `WorkerEinstellungen` und den „Noch nicht verbunden“-Kasten.

## Phase 3 – App: Worker-Sync für Journal + Fortschritt

1. **`src/engine/workerSync.ts`** (pur): Typen `JournalStandW`, `FortschrittStandW` (mit `uebungsLog`),
   `standText(teil, stand)` (deterministisch wie `dateiText`), `standMergen(teil, a, b)`
   (`teilZusammenfuehren` + `mergeUebungsLog`), `standLesen(teil, roh)`. Test: Textgleichheit bei
   Reihenfolge-Änderung, Merge-Idempotenz.
2. **`src/data/workerSync.ts`** (Laufzeit, Vorbild `aktien/data/sync.ts`): `workerSyncStarten()` einmal aus
   `App.tsx` (auch `syncStarten()` des Aktien-Syncs dorthin). Subscriptions auf `useSimulatorStore`
   (`tradeHistorie`, `rueckblicke`), `useJournalStore` (`eintraege`), `useProgressStore` (4 Felder) →
   Debounce **5 s**, Skip wenn `standText(lokal) === zuletztText[teil]`. `holen(teil)`: GET → übernehmen
   (`tradesImportieren`, `rueckblickeImportieren`, `jr.importieren`, `progress.importieren` +
   neu `progress.uebungsLogImportieren`) → bei Unterschied PUT. `schreiben(teil)`: PUT → Antwort übernehmen →
   `zuletztText` setzen (kein Ping-Pong). Nachholen bei `visibilitychange` (Drossel 5 min) und Code-Wechsel.
   KV-Limit-Fehler → „Speicher-Tageslimit erreicht, morgen wieder“, kein Retry-Sturm.
   `useWorkerSyncStatus()` via `useSyncExternalStore`.
3. **Stores**: `progressStore.uebungsLogImportieren(neue)` → `mergeUebungsLog`. `useSyncStore`: Feld
   `cloud: boolean` (Standard true) als Abschalter.
4. **`src/components/WorkerSync.tsx`**: Karte „Geräte-Sync“ auf `LernpfadPage.tsx` vor `<GitSync />`:
   Status, „Jetzt abgleichen“, `ZugangHinweis` ohne Code, Schalter `cloud`. GitSync-Text: „alternativ zum Geräte-Sync“.

## Phase 4 – App: Push je Nutzer

- **`src/makro/push.ts`** (neu): `abosLaden()`, `aboSchreiben(sub, geraet)`, `aboLoeschen(endpoint)` via `anfrage`.
- **`PushEinstellungen.tsx`**: nach `subscribe` → `aboSchreiben` (Gerätename grob aus UA); Textarea/Kopieren/
  `PUSH_SUBSCRIPTION`-Texte raus; „Auf diesem Gerät abonniert · n Geräte insgesamt“; beim Mount einmalig
  nachtragen, wenn Endpoint im Worker fehlt; „Deaktivieren“ → `aboLoeschen` + `unsubscribe`; ohne Code
  Knopf gesperrt + `ZugangHinweis`. VAPID-Public-Key weiter aus `macro.json`.

## Phase 5 – GitHub Actions + CLI

1. **`scripts/tracker/hole-tracker.ts`** `ladeConfig()`: `GET /api/dienst/tracker` → `{config, nutzer}`, Log
   „Konfiguration: Union aus n Nutzern“; URL-Default-Konstante; Datei-Fallback bleibt.
2. **`scripts/macro/push-status.ts`** (neu, pur, getestet): `endpointHash` (sha256, 10 Hex), Status-Keys
   `${key}|${hash}`, `gesendetFuer(status, hash)` liest auch Legacy-Keys ohne `|` (sonst bekäme das
   Owner-Gerät alte Nachrichten nochmal), `markiere(...)`. 60-Tage-Aufräumen unverändert.
3. **`scripts/macro/sende-push.ts`**: Quelle `GET /api/dienst/push` (Dienst-Token), Fallback
   `PUSH_SUBSCRIPTION` eine Übergangsversion lang. Je Nutzer: Makro-Nachrichten wie heute; Tracker-Nachrichten
   mit `nutzer.tracker`-Config gefiltert (`push-logik.ts` unverändert). Je Abo senden, 404/410 sammeln →
   `POST /api/dienst/push/abgelaufen`. `--test` an alle. Log „n Nutzer, m Geräte, k gesendet, j abgelaufen“.
4. **`macro.yml`, `tracker.yml`** Schritt „Push verschicken“: `AKTIEN_WORKER_URL`, `AKTIEN_SECRET` ergänzen.
   `PUSH_SUBSCRIPTION` nach dem Rollout entfernen. Keine neuen Repo-Secrets.
5. **`scripts/codes/codes.ts`** (+ tsconfig wie `scripts/tracker`, npm `codes`, `codes:check`):
   `npm run codes -- anlegen "Max" [--id admin] [--admin] [--ki 20] [--lokal]`, `liste`, `sperren <id>`,
   `entsperren <id>`, `loeschen <id>`. Env `AKTIEN_SECRET` (Pflicht), `AKTIEN_WORKER_URL` (Default prod).
   Gibt Code einmal und Teilen-Link `…/chart-akademie/#/zugang?code=CA-…` aus, schreibt nichts auf Platte.

## Phase 6 – Doku

- `README.md`: Abschnitte „Aktien → Einrichtung“, „Zinsentscheidungen mit Push“ (`PUSH_SUBSCRIPTION`),
  Konfiguration → Einladungscode, `npm run codes`, Rollen, KI-Limit.
- `worker/wrangler.toml` Kopfkommentar (alle Secrets nennen), `notes.md` Eintrag mit Rollout-Datum und den
  beiden Übergangs-Fallbacks (Legacy-Keys, `PUSH_SUBSCRIPTION`).

## Rollout (ohne Datenverlust)

1. Branch mit Phasen 0–5; lokal `npm test`, `npm run worker:check`, `npm run tracker:check`,
   `npm run macro:check`, `npm run lint`, `npm run build`.
2. **Worker zuerst deployen.** Alte App läuft weiter (Secret = Dienst-Token, Lazy-Fallback der Keys).
3. Admin-Code anlegen: `AKTIEN_SECRET=… npm run codes -- anlegen "Max" --id admin --admin` → im Passwortmanager.
4. **App deployen** (Push auf `main`). Owner-Geräte laufen migriert weiter; dann je Gerät „Zugang → Code
   entfernen → Admin-Code eingeben“.
5. Push: unter Makro einmal deaktivieren/aktivieren. Actions per `workflow_dispatch`: `tracker.yml`
   („Union aus 1 Nutzer“), `macro.yml` mit `test-push`.
6. Codes für Testnutzer anlegen, Link teilen.
7. Nach ≥ 2 Wochen: `PUSH_SUBSCRIPTION` löschen, `AKTIEN_SECRET` rotieren, Legacy-Key-Fallback entfernen.

## Verifikation

- Unit: `code`, `zugang` (Fake-KV), `kiLimit`, `union`, `mergen`, `workerSync`, `push-status`,
  Store-Migration, `client`.
- Lokal: `npm run worker:dev` + `npm run dev`, Code via `npm run codes -- anlegen "Test" --lokal`.
- Playwright 390 px (Muster `smoke-*.mjs`): (1) ohne Code → Start-Karte, Hinweise, Lernpfad/Simulator nutzbar;
  (2) `#/zugang?code=…` → Willkommen, Aktien-Suche liefert; (3) Journal-Eintrag → nach 5 s PUT;
  (4) zweiter Browser-Context, gleicher Code → Eintrag erscheint; (5) KI-Limit → 429-Text;
  (6) Push-Abo → PUT im Netzwerklog; 0 Konsolenfehler, 0 px Überlauf.
- Actions via `workflow_dispatch`, Logs prüfen.

## Risiken und Grenzen

- **KV-Schreiblimit 1000/Tag (Free):** Schätzung bei 10 Nutzern: KI ≤ 100, `zuletzt` ≤ 10, Sync 50–200,
  zustand/tracker ~50, Caches wie heute 200–400. Stellschrauben: Debounce 15 s, KI-Zähler erst ab Aufruf 2.
  Bei Überschreitung scheitert nur das Schreiben, Lesen und Caches laufen weiter.
- **KV `list` ist eventually consistent (~60 s)**; Sperren greifen über den Isolate-Cache bis 5 min verzögert.
- **Keine Tombstones:** Löschen im Journal kommt vom anderen Gerät zurück (wie heute beim Git-Sync).
  Folgeschritt: `geloescht: Record<id, am>` im Stand.
- **Yahoo-ToS** unverändert inoffiziell; mehr Nutzer = mehr Last über einen Worker.
- **Codes nie committen:** CLI schreibt keine Dateien; `push-status.json` enthält nur Endpoint-Hashes.
- **Raten gegen `/api/ich`:** 60-Bit-Raum, Fehlversuche kosten nur KV-Reads. Folgeschritt: Cloudflare
  Rate-Limiting-Regel.
- **CORS:** Origin-Liste unverändert; eine spätere Capacitor-Hülle braucht `capacitor://localhost` in
  `ERLAUBTE_ORIGINS`. PWA/TWA ändert nichts.

## Umsetzung (Stand 2026-11-16)

Phasen 0–6 sind auf dem Branch `standalone` umgesetzt und committet (Tag `vor-standalone` = Stand davor).
Geprüft: 473 Tests, Typprüfung App/Worker/Skripte, Lint, Produktions-Build; lokal mit `wrangler dev`
per Playwright (Code-Eingabe, Teilen-Link, Reload, zwei Geräte mit Journal-/Fortschritt-Sync), CLI und
`sende-push --test`. Offen ist der Rollout (siehe oben): Worker deployen, Admin-Code anlegen, Branch nach
`main` mergen, Push am Handy neu aktivieren, Actions per `workflow_dispatch` prüfen.

## Folgeschritte (nicht in Schritt 1)

Top-Down-Runden, Zeichnungen und Ansicht in den Sync; Tombstones; Ratenlimit; Install-Hinweis
(`beforeinstallprompt`); APK via PWABuilder; danach Schritt 3 aus `plan-release.md` (Konten, Yahoo-Ersatz, Rechtstexte).
