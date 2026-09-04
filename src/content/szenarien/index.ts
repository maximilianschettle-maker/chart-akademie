import type { Scenario } from '../../types'

// Kuratierte Übungs-Szenarien auf echten historischen Daten.
// Alle Preise/Bar-Indizes wurden anhand der eingecheckten Datensätze bestimmt
// (siehe scripts/hole-szenario.mjs).

export const SZENARIEN: Record<string, Scenario> = {
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
      'Der Markt hat einen über Wochen mehrfach getesteten Widerstand (~28.100 $) gebrochen. Lehrbuch-Ablauf: Nach dem Ausbruch setzt der Preis oft noch einmal auf das gebrochene Level zurück („Retest") — genau dort liegt der Entry mit engem Stop. Warte auf den Retest und platziere deinen Long.',
    richtung: 'long',
    entryZone: { preisVon: 27950, preisBis: 28950, barVon: 528, barBis: 600 },
    idealEntry: 28300,
    idealStopLoss: 27750,
    idealTakeProfit: 30000,
    feedback: {
      perfekt:
        'Lehrbuch-Trade: Entry im Retest der gebrochenen 28.100er-Zone, Stop darunter, Ziel am Ausbruchs-Hoch. Genau dieser Retest lief danach bis über 35.000 $ — Breakout + Retest gehört zu den zuverlässigsten Setups, wenn das Level so oft getestet wurde wie hier.',
      ok: 'Dein Entry lag in der richtigen Zone — der Retest der gebrochenen 28.100er-Marke. Aber Stop oder Ziel waren unsauber (CRV unter 1,5 oder SL nicht unter der Zone). Das Setup war exzellent; hol dir mit sauberem SL/TP das volle Potenzial.',
      verpasst:
        'Kein Entry — dabei hat der Markt drei Tage lang (17.–19. Okt.) den Retest der gebrochenen 28.100er-Zone angeboten. Merke: Nach einem Ausbruch aus einer lange respektierten Zone ist der Retest DIE Gelegenheit. Danach lief BTC ohne dich auf 35.000 $.',
      falsch:
        'Dein Entry passte nicht zum Setup — falsche Richtung oder außerhalb der Retest-Zone (27.950–28.950 $, direkt nach dem Ausbruch). Bei Breakout + Retest kauft man nicht in die laufende Bewegung hinein, sondern wartet, bis der Preis das gebrochene Level noch einmal testet.',
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
      'Unter dem Markt liegt eine Unterstützungszone um 24.800–25.400 $, die bereits zweimal gehalten hat. Der Preis fällt gerade zum dritten Mal hinein. Warte auf Zeichen der Ablehnung (lange untere Dochte, Rückeroberung der Zone) und platziere deinen Long — mit Stop UNTER der Zone.',
    richtung: 'long',
    entryZone: { preisVon: 24800, preisBis: 25900, barVon: 420, barBis: 480 },
    idealEntry: 25400,
    idealStopLoss: 24500,
    idealTakeProfit: 27200,
    feedback: {
      perfekt:
        'Sauber gehandelt: Entry an der dreifach getesteten Zone nach sichtbarer Ablehnung, Stop unter der Zone, Ziel am nächsten Widerstand (~27.300 $). Der Markt drehte hier tatsächlich — und lief wenige Tage später sogar über 30.000 $.',
      ok: 'Entry-Zone getroffen — der dritte Test der 25.000er-Unterstützung war die richtige Stelle. Aber dein Stop oder Ziel war unsauber (SL nicht unter der Zone oder CRV unter 1,5). Beim Zonen-Bounce gehört der SL immer UNTER die Zone, sonst wirft dich ein normaler Docht raus.',
      verpasst:
        'Kein Entry — der dritte Test einer zweifach bestätigten Unterstützung mit klaren Ablehnungs-Dochten (14./15. Juni) war die Gelegenheit. Nicht jeder Bounce hält, deshalb gibt es den Stop — aber gar nicht zu handeln, weil es „gefährlich aussieht", ist genau die Zone, in der die besten CRVs entstehen.',
      falsch:
        'Das passte nicht zum Setup — falsche Richtung oder Entry weit weg von der Zone (24.800–25.900 $). Ein Bounce-Trade wird IN der Unterstützungszone eröffnet, nicht hinterhergejagt, nachdem der Preis schon wieder 1.000 $ gestiegen ist.',
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
      'Der Markt läuft in einem starken, intakten Aufwärtstrend (Higher Highs, Higher Lows). Jetzt setzt er von ~53.000 $ zurück in Richtung der vorherigen Ausbruchszone um 50.300–51.000 $. Trendfolge-Regel: Rücksetzer im intakten Trend sind Einstiegszonen. Finde den Long.',
    richtung: 'long',
    entryZone: { preisVon: 50400, preisBis: 51600, barVon: 288, barBis: 315 },
    idealEntry: 50900,
    idealStopLoss: 49900,
    idealTakeProfit: 52900,
    feedback: {
      perfekt:
        'Genau richtig: Long im Pullback auf die vorherige Ausbruchszone, Stop unter der 50.000er-Marke, Ziel am alten Hoch. Der Trade lief ans Ziel — und der Trend danach sogar bis über 64.000 $. (Fortgeschrittene sichern hier mit Trailing-Stop einen Teil des Weiterlaufs — Ziel an der Struktur ist trotzdem die richtige Basis.)',
      ok: 'Entry-Zone getroffen — der Pullback auf die alte Ausbruchszone war korrekt erkannt. Aber SL oder TP waren unsauber. Im Trend gilt: Stop unter das letzte Higher Low bzw. die Zone, Ziel mindestens am alten Hoch.',
      verpasst:
        'Kein Entry — dabei ist das der Kern der Trendfolge: Der Rücksetzer von 53.000 auf ~50.500 $ IN einem intakten Aufwärtstrend war keine Gefahr, sondern das Angebot. Wer im Trend auf „noch tiefer" wartet, schaut der Bewegung meist hinterher — hier bis 64.000 $.',
      falsch:
        'Das passte nicht zum Setup — falsche Richtung oder Entry außerhalb der Pullback-Zone (50.400–51.600 $). Gegen einen intakten Trend zu shorten, nur weil der Preis „schon so hoch" ist, ist einer der teuersten Anfängerfehler.',
    },
    datumVerdeckt: true,
  },
}
