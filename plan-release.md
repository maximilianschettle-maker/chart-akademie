# Plan: Von der Ein-Personen-App zur releasebaren App mit Konten

Einschätzung vom 2026-11-10 (Nutzerfrage „was müsste passieren“). Stand der App: Kurs, Simulator, Übungen,
Aktien-Analyse, Tracker, Makro, Journal mit Screenshot-/CSV-/ZIP-Import, KI-Prüfung, Top-Down-Übung,
Setup-Bilanz, Checkliste – alles Ein-Nutzer, Daten im Browser, Sync über ein privates GitHub-Repo.

## Reihenfolge (Empfehlung)

1. **Zustimmung des Arbeitgebers** für die Nebentätigkeit klären (Arbeitsvertrag, siehe ZeitfresserRadar). Davor ist alles Hobby.
2. **Zehn Testnutzer mit der heutigen App** – PWA teilen, je Person ein eigenes Worker-Geheimnis
   (Zehn-Minuten-Umbau: mehrere Secrets statt `AKTIEN_SECRET`, Zugriffslog je Token). Kostet nichts.
   Messgröße: Wer importiert und prüft nach einem Monat noch? Drei von zehn → weiter mit 3, sonst sparen.
3. **Konten und Datenbank, Yahoo ersetzen, Rechtstexte** (mehrere Wochen Abendarbeit).
4. **Store-Hülle und Bezahlung.**

## 1. Konten und Daten (größter Brocken)

- Heute: localStorage/IndexedDB (`chartakademie-*`-Stores, Snapshots, Kerzen-Cache), Git-Sync (`journal.json`, `fortschritt.json`).
- Nötig: Login über einen Dienst (Clerk, Supabase Auth oder Cloudflare Access), Datenbank (Cloudflare D1 oder Supabase),
  je persistiertem Store eine Server-Entsprechung; Merge-Regeln aus `sicherung.ts`/`gitSync.ts` übernehmen.
- Worker: Session-Tokens statt gemeinsamem Secret, Ratenlimits, Abrechnung der KI-Aufrufe je Nutzer
  (Screenshot ~1 Cent, Prüfung ~2–5 Cent bei Opus 5.5), Kostenalarm.

## 2. Datenquellen

- **Yahoo Finance** ist inoffiziell – privat geduldet, als Produkt Bruchrisiko und laut Bedingungen nicht erlaubt.
  Ersatz: Twelve Data, Polygon, EODHD (ca. 30–100 €/Monat). Betroffen: Aktien-Charts, Tracker-Kerzen, Journal-Snapshots,
  Kerzen-Archiv, Übungs-Szenarien (müssten neu geholt werden).
- Binance/Coinbase: öffentliche APIs mit Limits → über den Worker bündeln und cachen.
- SEC EDGAR, FRED, Eurostat, EZB, Fed: offen, sauber.
- Broker-Screenshots/CSV/ZIP: Nutzerinhalt, unkritisch.

## 3. Recht (Deutschland)

- Impressum, Datenschutzerklärung (DSGVO), Auftragsverarbeitung mit Cloudflare und Anthropic, Löschkonzept.
- AGB mit klarer Einordnung: Lernwerkzeug, keine Anlageberatung; KI-Urteile sind Lesehilfen.
- Bei Einnahmen: Gewerbe, Steuern; bei Apple In-App-Purchase-Pflicht.
- Kursinhalte sind eigene; Chartdaten in Lektionen beim Quellwechsel neu holen.

## 4. Produkt und Betrieb

- Verteilung: PWA heute installierbar; für Play/App Store Capacitor oder TWA, Icons, Screenshots, Review
  (Apple: Begründung für Finanzinhalte).
- Onboarding: Worker-URL/Geheimnis eintragen entfällt mit Konten.
- Betrieb: Fehlersammlung (Sentry; `FehlerGrenze` existiert), Monitoring für Actions und Worker, DB-Backups.
- Qualität: 433 Logik-Tests; die Playwright-Skripte aus `%LOCALAPPDATA%\Temp\ca-smoke` in die CI heben.
