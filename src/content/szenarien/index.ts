import type { Scenario } from '../../types'
import { WEITERE_SZENARIEN } from './weitere'

// Kuratierte Übungs-Szenarien auf echten historischen Daten.
// Alle Preise/Bar-Indizes wurden anhand der eingecheckten Datensätze bestimmt
// (siehe scripts/hole-szenario.mjs). `entryZone` ist die EINZIGE Quelle für
// Preiszone und Zeitfenster: Aufgabentext und Feedback nutzen die Platzhalter
// {zone} (Preiszone) und {fenster} (Datum des Fensters aus den Kerzen).
// Der Test szenarioGrader.real.test.ts prüft, dass jeder Ideal-Trade ab seinem
// Entry im Fenster tatsächlich aufgeht.

const ERSTE_SZENARIEN: Record<string, Scenario> = {
  's-breakout-btc-okt23': {
    id: 's-breakout-btc-okt23',
    titel: 'Breakout + Retest',
    strategieId: 'breakout-retest',
    datensatz: 'btc-breakout-okt23',
    symbol: 'BTCUSDT',
    interval: '1h',
    startIndex: 480,
    endIndex: 744,
    aufgabe:
      'Der Markt hat einen über Wochen mehrfach getesteten Widerstand (~28.100 $) gebrochen. Lehrbuch-Ablauf: Nach dem Ausbruch setzt der Preis oft noch einmal auf das gebrochene Level zurück („Retest") — genau dort liegt der Entry mit engem Stop. Warte auf den Retest und platziere deinen Long in der Entry-Zone {zone}. Tipp: Lege die Limit-Order vorab in die Entry-Zone — eine einzelne Kerze kann die Zone komplett durchlaufen, per Market kommst du dann zu spät.',
    richtung: 'long',
    // Fenster ab der ersten Kerze NACH der Ausbruchskerze (Bar 517, 16.10. 13:00):
    // die Konsolidierung 28.000–28.600 $ ist bereits der Retest.
    entryZone: { preisVon: 27950, preisBis: 28950, barVon: 518, barBis: 600 },
    kriterien: {
      trigger: { beschreibung: 'Ausbruch: Stundenschluss über 28.100 $', bar: 518 },
      stopRegel: { beschreibung: 'unter der Retest-Zone', level: 27950 },
    },
    idealEntry: 28300,
    idealStopLoss: 27750,
    idealTakeProfit: 30000,
    feedback: {
      perfekt:
        'Lehrbuch-Trade: Entry im Retest der gebrochenen 28.100er-Zone, Stop darunter, Ziel am Ausbruchs-Hoch. Genau dieser Retest lief danach bis über 35.000 $ — Breakout + Retest gehört zu den zuverlässigsten Setups, wenn das Level so oft getestet wurde wie hier.',
      gut: 'Dein Entry lag in der richtigen Zone — der Retest der gebrochenen 28.100er-Marke. Das Setup war exzellent; mit sauberem Stop (unter der Zone, ~27.750 $) und Ziel am Ausbruchs-Hoch (~30.000 $) holst du das volle Potenzial.',
      verpasst:
        'Kein Entry — dabei hat der Markt vom {fenster} den Retest der gebrochenen 28.100er-Zone angeboten. Merke: Nach einem Ausbruch aus einer lange respektierten Zone ist der Retest DIE Gelegenheit. Danach lief BTC ohne dich auf 35.000 $.',
      falsch:
        'Bei Breakout + Retest kauft man nicht in die laufende Bewegung hinein und jagt auch nicht hinterher, sondern wartet, bis der Preis das gebrochene Level ({zone}) noch einmal testet.',
      falscheRichtung:
        'Nach einem Ausbruch aus einer lange respektierten Zone shortet man nicht den Rücksetzer — der Retest ist die Kaufgelegenheit, nicht der Beginn einer Umkehr.',
    },
    datumVerdeckt: true,
  },

  's-bounce-btc-juni23': {
    id: 's-bounce-btc-juni23',
    titel: 'Support-Bounce',
    strategieId: 'sr-bounce',
    datensatz: 'btc-bounce-juni23',
    symbol: 'BTCUSDT',
    interval: '1h',
    startIndex: 380,
    endIndex: 620,
    aufgabe:
      'Unter dem Markt liegt eine Unterstützungszone um 25.350–25.450 $ — dort liegen die Tiefs der ersten beiden Tests. Der Preis fällt gerade zum dritten Mal hinein. Warte auf Zeichen der Ablehnung: Der Preis fängt sich in der Zone und schließt wieder über 25.400 $ (Rückeroberung). Ein Rücksetzer auf die Zonenoberkante mit unterem Docht bestätigt das zusätzlich. Platziere deinen Long in der Entry-Zone {zone} — mit Stop UNTER der Zone. Tipp: Sobald die Rückeroberung steht, lege die Limit-Order in die Entry-Zone — der Rücksetzer kann in einer einzigen Kerze kommen.',
    richtung: 'long',
    // Dritter Test = Sturz bis 24.800 $ (Bar 428, 14.06. 20:00). Trigger ist die
    // Rückeroberung: erster Stundenschluss über 25.400 $ am 15.06. 19:00 (Bar 451).
    // Danach Rücksetzer mit Docht am 16.06. 14:00 (Tief 25.176) = Ideal-Entry 25.400.
    entryZone: { preisVon: 25100, preisBis: 25700, barVon: 451, barBis: 480 },
    kriterien: {
      trigger: { beschreibung: 'Rückeroberung: Stundenschluss wieder über 25.400 $', bar: 451 },
      stopRegel: { beschreibung: 'unter dem Tief des dritten Tests', level: 24800 },
    },
    idealEntry: 25400,
    idealStopLoss: 24500,
    idealTakeProfit: 27200,
    feedback: {
      perfekt:
        'Sauber gehandelt: Entry an der dreifach getesteten Zone nach sichtbarer Ablehnung, Stop unter der Zone, Ziel am nächsten Widerstand (~27.300 $). Der Markt drehte hier tatsächlich — und lief wenige Tage später sogar über 30.000 $.',
      gut: 'Entry-Zone getroffen — der dritte Test der 25.000er-Unterstützung war die richtige Stelle. Beim Zonen-Bounce gehört der Stop immer UNTER die Zone (hier unter 24.800 $), sonst wirft dich ein normaler Docht raus — und das Ziel an den nächsten Widerstand (~27.200 $).',
      verpasst:
        'Kein Entry — der dritte Test einer zweifach bestätigten Unterstützung ({fenster}) mit Sturz bis 24.800 $ und Rückeroberung über 25.400 $ war die Gelegenheit. Nicht jeder Bounce hält, deshalb gibt es den Stop — aber gar nicht zu handeln, weil es „gefährlich aussieht", ist genau die Zone, in der die besten CRVs entstehen.',
      falsch:
        'Ein Bounce-Trade wird IN der Unterstützungszone eröffnet ({zone}), nicht hinterhergejagt, nachdem der Preis schon wieder 1.000 $ gestiegen ist.',
      falscheRichtung:
        'Eine zweifach bestätigte Unterstützung shortet man nicht in den dritten Test hinein — dort warten die Käufer. Short wäre erst nach einem klaren Bruch UND gescheiterter Rückeroberung ein Thema.',
    },
    datumVerdeckt: true,
  },

  's-trend-btc-feb24': {
    id: 's-trend-btc-feb24',
    titel: 'Trendfolge-Pullback',
    strategieId: 'trendfolge-ema',
    datensatz: 'btc-trend-feb24',
    symbol: 'BTCUSDT',
    interval: '4h',
    startIndex: 250,
    endIndex: 336,
    aufgabe:
      'Der Markt läuft in einem starken, intakten Aufwärtstrend (Higher Highs, Higher Lows). Jetzt setzt er von ~53.000 $ zurück in Richtung der vorherigen Ausbruchszone um {zone}. Trendfolge-Regel: Rücksetzer im intakten Trend sind Einstiegszonen. Finde den Long. Tipp: Lege die Limit-Order vorab in die Entry-Zone — eine einzelne Kerze kann die Zone komplett durchlaufen, per Market kommst du dann zu spät.',
    richtung: 'long',
    // Fenster ab der ersten Kerze in der Zone nach dem Hoch bei 52.985 $ (Bar 279):
    // Rücksetzer 20.02. 16:00 (Tief 50.760) und 21.02. (Tiefs ~50.625).
    entryZone: { preisVon: 50400, preisBis: 51600, barVon: 280, barBis: 315 },
    kriterien: {
      trigger: { beschreibung: 'Rücksetzer vom Hoch (52.985 $) erreicht die Pullback-Zone', bar: 280 },
      stopRegel: { beschreibung: 'unter der Pullback-Zone', level: 50400 },
    },
    idealEntry: 50900,
    idealStopLoss: 49900,
    idealTakeProfit: 52900,
    feedback: {
      perfekt:
        'Genau richtig: Long im Pullback auf die vorherige Ausbruchszone, Stop unter der 50.000er-Marke, Ziel am alten Hoch. Der Trade lief ans Ziel — und der Trend danach sogar bis über 64.000 $. (Fortgeschrittene sichern hier mit Trailing-Stop einen Teil des Weiterlaufs — Ziel an der Struktur ist trotzdem die richtige Basis.)',
      gut: 'Entry-Zone getroffen — der Pullback auf die alte Ausbruchszone war korrekt erkannt. Im Trend gilt: Stop unter das letzte Higher Low bzw. die Zone (hier unter 50.000 $), Ziel mindestens am alten Hoch (~52.900 $).',
      verpasst:
        'Kein Entry — dabei ist das der Kern der Trendfolge: Der Rücksetzer von 53.000 auf ~50.500 $ ({fenster}) IN einem intakten Aufwärtstrend war keine Gefahr, sondern das Angebot. Wer im Trend auf „noch tiefer" wartet, schaut der Bewegung meist hinterher — hier bis 64.000 $.',
      falsch:
        'Trendfolge heißt: im Rücksetzer kaufen, nicht am Hoch. Die Pullback-Zone war {zone} — darüber kaufst du die Spitze, darunter wäre der Trend in Frage gestellt.',
      falscheRichtung:
        'Gegen einen intakten Trend zu shorten, nur weil der Preis „schon so hoch" ist, ist einer der teuersten Anfängerfehler.',
    },
    datumVerdeckt: true,
  },

  's-range-btc-sep23': {
    id: 's-range-btc-sep23',
    titel: 'Range Trading',
    strategieId: 'range-trading',
    datensatz: 'btc-range-sep23',
    symbol: 'BTCUSDT',
    interval: '1h',
    startIndex: 336,
    endIndex: 576,
    aufgabe:
      'Der Markt pendelt seit Tagen in einer Range: Unterkante {zone} (mehrfach getestet), Oberkante ~26.000–26.400 $. Range-Regel: am Rand kaufen/verkaufen, nie in der Mitte. Der Preis nähert sich gerade wieder der Unterkante. Platziere deinen Long am Range-Tief — Stop UNTER der Range, Ziel an der Oberkante. Tipp: Lege die Limit-Order vorab in die Entry-Zone — eine einzelne Kerze kann die Zone komplett durchlaufen, per Market kommst du dann zu spät.',
    richtung: 'long',
    // Fenster ab dem ersten Test der Unterkante im Replay (Bar 381, 04.09. 21:00) bis
    // zum Ende des letzten erfolgreichen Tests (09.09.). Die Tests vom 10./11.09.
    // enden im Bruch der Range (Flush bis 24.900 $) und liegen bewusst außerhalb.
    entryZone: { preisVon: 25350, preisBis: 25750, barVon: 381, barBis: 480 },
    kriterien: {
      trigger: { beschreibung: 'Preis erreicht die Range-Unterkante', bar: 381 },
      stopRegel: { beschreibung: 'unter der Range-Unterkante', level: 25350 },
    },
    idealEntry: 25600,
    idealStopLoss: 25150,
    idealTakeProfit: 26350,
    feedback: {
      perfekt:
        'Sauberes Range-Handwerk: Long an der mehrfach bestätigten Unterkante, Stop unter der Range, Ziel an der Oberkante. Der Markt lief ans Ziel. Und beachte, was wenige Tage später passierte: Die Range brach nach unten — Ranges enden irgendwann, deshalb ist der Stop unter der Range nicht verhandelbar.',
      gut: 'Entry an der Unterkante war richtig. Beim Range-Trade gehört der Stop UNTER die Range (hier unter 25.350 $, nicht mitten hinein) und das Ziel an die Oberkante (~26.350 $), sonst stimmt das CRV nicht.',
      verpasst:
        'Kein Entry — dabei hat die Unterkante der Range vom {fenster} mehrfach Einstiege angeboten. Range-Trading ist das geduldigste Setup überhaupt: Man wartet, bis der Preis zum Rand kommt, und handelt den Abpraller. In der Mitte der Range gibt es dagegen nichts zu holen.',
      falsch:
        'Der häufigste Range-Fehler: in der Mitte einsteigen, wo weder Stop noch Ziel sinnvoll definierbar sind. Gehandelt wird an der Unterkante ({zone}) — und nur, solange die Range intakt ist; die Tests ab dem 10.09. endeten im Bruch.',
      falscheRichtung:
        'An der Unterkante einer intakten Range wird gekauft, nicht verkauft — Short gehört an die Oberkante. Wer die Unterkante shortet, handelt auf den Bruch, und der kam erst Tage später.',
    },
    datumVerdeckt: true,
  },

  's-sweep-btc-mai24': {
    id: 's-sweep-btc-mai24',
    titel: 'Liquidity Sweep',
    strategieId: 'liquidity-sweep',
    datensatz: 'btc-sweep-mai24',
    symbol: 'BTCUSDT',
    interval: '4h',
    startIndex: 180,
    endIndex: 342,
    aufgabe:
      'Unter dem Markt liegt ein markanter Doppelboden (~59.600 $) — und darunter schlummern die Stops und Liquidationen aller, die dort long gegangen sind. Szenario: Der Preis bricht unter den Doppelboden ein (Sweep!). Deine Aufgabe: NICHT in Panik shorten, sondern auf die Rückeroberung des Levels warten und den Long platzieren — in der Entry-Zone {zone}, Stop unter dem Sweep-Tief. Tipp: Sobald die Rückeroberung steht, lege die Limit-Order in die Entry-Zone — der Rücksetzer kann in einer einzigen Kerze kommen.',
    richtung: 'long',
    // Sweep-Tief 56.553 $ am 01.05. 08:00 (Bar 224). Trigger ist die Rückeroberung:
    // erster 4h-Schluss wieder über 59.600 $ am 03.05. 00:00 (Bar 234, Close 59.720).
    entryZone: { preisVon: 58500, preisBis: 60500, barVon: 234, barBis: 240 },
    kriterien: {
      trigger: { beschreibung: 'Rückeroberung: 4h-Schluss wieder über 59.600 $', bar: 234 },
      stopRegel: { beschreibung: 'unter dem Sweep-Tief', level: 56553 },
    },
    idealEntry: 59000,
    idealStopLoss: 56400,
    idealTakeProfit: 64500,
    feedback: {
      perfekt:
        'Exzellent — das schwerste Setup des Kurses, sauber ausgeführt: Der Bruch des Doppelbodens war der Sweep, deine Rückeroberungs-Entry mit Stop unter dem Sweep-Tief war der Lehrbuch-Einstieg. Der Markt lief anschließend über 71.000 $. Genau so nutzt man die Liquiditäts-Mechanik aus Level 3.',
      gut: 'Richtige Zone — du hast den Sweep als Kaufgelegenheit erkannt statt panisch zu verkaufen. Der Stop gehört UNTER das Sweep-Tief (56.553 $), das Ziel mindestens zurück in die alte Range (~64.500 $).',
      verpasst:
        'Kein Entry. Verständlich — ein brechender Doppelboden sieht nach Crash aus. Aber genau das ist der Sweep: Die erzwungenen Verkäufe (Stops + Liquidationen) werden abgeräumt, große Käufer füllen sich, und die Rückeroberung des Levels ({fenster}) ist das Signal. Der Markt lief danach von 58.000 auf über 71.000 $.',
      falsch:
        'Nach dem Sweep gehört das Level beobachtet, nicht gejagt: Der Einstieg liegt in der Rückeroberungs-Zone ({zone}). Wer erst deutlich höher kauft, hat ein schlechteres CRV und einen Stop ohne Bezug zur Struktur.',
      falscheRichtung:
        'Der klassische Fehler hier: unter dem gebrochenen Doppelboden SHORT zu gehen — genau in die Zone hinein, in der die Abwärtsbewegung ihre erzwungenen Verkäufer verliert.',
    },
    datumVerdeckt: true,
  },
}

/** Alle kuratierten Szenarien (erste Welle: nur BTC mit Ansage; zweite: ETH/SOL + Kein-Trade, ohne Ansage). */
export const SZENARIEN: Record<string, Scenario> = { ...ERSTE_SZENARIEN, ...WEITERE_SZENARIEN }
