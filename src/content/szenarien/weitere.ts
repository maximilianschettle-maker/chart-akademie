import type { Scenario } from '../../types'

// Zweite Szenario-Welle: ETH und SOL statt nur BTC, dazu zwei „Kein-Trade“-Fälle
// (Fakeout und Range-Mitte). Alle Preise/Bar-Indizes stammen aus den eingecheckten
// Datensätzen (scripts/hole-szenario.mjs). Diese Szenarien laufen in der
// Meisterprüfung II OHNE Ansage des Setups (ansageVerdeckt). Platzhalter {zone} /
// {fenster} werden aus entryZone bzw. den Kerzen gefüllt (siehe szenarioGrader).

export const WEITERE_SZENARIEN: Record<string, Scenario> = {
  's-breakout-eth-nov23': {
    id: 's-breakout-eth-nov23',
    titel: 'Ausbruch über eine Wochen-Decke',
    strategieId: 'breakout-retest',
    datensatz: 'eth-breakout-nov23',
    symbol: 'ETHUSDT',
    interval: '1h',
    startIndex: 400,
    endIndex: 792,
    aufgabe:
      'Der Markt hat gerade einen Widerstand gebrochen, der über zwei Wochen fünfmal gehalten hat (~1.900–1.915 $). Der Ausbruch lief impulsiv bis ~2.130 $. Was jetzt? Erkenne, ob und wo ein Setup entsteht. Tipp: Wenn du eine Zone siehst, lege die Limit-Order vorab hinein — eine einzelne Kerze kann sie komplett durchlaufen.',
    richtung: 'long',
    // Erste Rückkehr in die gebrochene Zone am 14.11. 18:00 (Bar 498, Tief 1.936,6 $)
    entryZone: { preisVon: 1900, preisBis: 2000, barVon: 498, barBis: 672 },
    kriterien: {
      trigger: { beschreibung: 'Retest: Rückkehr in die gebrochene Zone', bar: 498 },
      stopRegel: { beschreibung: 'unter der gebrochenen Decke', level: 1900 },
    },
    idealEntry: 1950,
    idealStopLoss: 1880,
    idealTakeProfit: 2090,
    feedback: {
      perfekt:
        'Breakout + Retest, sauber erkannt: Nach dem impulsiven Ausbruch über 1.915 $ kam der Markt eine Woche lang ({fenster}) zurück auf die gebrochene Zone — Tiefs bei 1.937, 1.939, 1.904, 1.916, 1.931 $. Entry im Retest, Stop unter 1.900, Ziel am Ausbruchs-Hoch. ETH lief anschließend über 2.300 $.',
      gut: 'Richtige Zone — der Retest der gebrochenen 1.900er-Decke war der Einstieg. Der Stop gehört unter die Zone (~1.880 $), das Ziel mindestens ans Ausbruchs-Hoch (~2.090–2.130 $), sonst stimmt das CRV nicht.',
      verpasst:
        'Kein Entry — dabei hat der Markt den Retest der gebrochenen 1.900er-Zone vom {fenster} immer wieder angeboten. Das Muster war exakt das aus Lektion 4.3: alte Decke wird zum Boden. Ohne Ansage ist das schwerer zu sehen — genau deshalb übst du es hier.',
      falsch:
        'Wer direkt nach dem Impuls bei 2.100 $ kauft, kauft die Spitze. Der Plan hieß: warten, bis der Preis die gebrochene Zone ({zone}) testet.',
      falscheRichtung:
        'Wer den Rücksetzer shortet, handelt gegen einen frischen Ausbruch — die gebrochene Decke ist jetzt Unterstützung, nicht Widerstand.',
    },
    datumVerdeckt: true,
    ansageVerdeckt: true,
  },

  's-sweep-sol-aug24': {
    id: 's-sweep-sol-aug24',
    titel: 'Crash unter eine alte Unterstützung',
    strategieId: 'liquidity-sweep',
    datensatz: 'sol-sweep-aug24',
    symbol: 'SOLUSDT',
    interval: '4h',
    startIndex: 200,
    endIndex: 300,
    aufgabe:
      'Unter dem Markt liegt eine Unterstützungszone um 121–128 $, die Anfang des Abschnitts zweimal gehalten hat. Der Markt fällt seit Tagen. Beobachte, was an der Zone passiert — und entscheide, ob und wo ein Setup entsteht. Tipp: Wenn du ein Setup erkennst, lege die Limit-Order vorab in deine Zone — 4h-Kerzen laufen oft in einem Rutsch durch.',
    richtung: 'long',
    // Sweep-Kerze 05.08. 04:00 (Bar 247): Tief 110 $, Schluss 122,9 $ — Rückeroberung in derselben Kerze
    entryZone: { preisVon: 120, preisBis: 142, barVon: 247, barBis: 262 },
    kriterien: {
      trigger: { beschreibung: 'Rückeroberung: 4h-Schluss wieder über 121 $', bar: 247 },
      stopRegel: { beschreibung: 'unter dem Sweep-Tief', level: 110 },
    },
    idealEntry: 128,
    idealStopLoss: 108,
    idealTakeProfit: 158,
    feedback: {
      perfekt:
        'Liquidity Sweep, sauber erkannt: Der Markt ist mit einer einzigen Kerze bis 110 $ unter die alte Unterstützung gefallen — Stops und Liquidationen wurden abgeräumt — und hat das Level noch in derselben Stunde zurückerobert. Long in die Rückeroberung, Stop unter dem Sweep-Tief, Ziel in der alten Range. SOL stand drei Tage später bei 164 $.',
      gut: 'Richtige Idee — du hast den Einbruch als Sweep gelesen und long gekauft. Der Stop gehört UNTER das Sweep-Tief (110 $), das Ziel mindestens zurück in die alte Range (~155–160 $).',
      verpasst:
        'Kein Entry. Verständlich — der Tag sah nach Crash aus (das war der 5. August 2024, der Yen-Carry-Schock). Aber genau das ist der Sweep aus Lektion 4.5: Ein Docht weit unter die Unterstützung, sofortige Rückeroberung, danach Rally. Das Signal war die Rückeroberung ({fenster}), nicht der Einbruch.',
      falsch:
        'Der Einstieg gehört in die Rückeroberungs-Zone ({zone}) — nicht in den Einbruch hinein und nicht 20 $ höher hinterher, wenn Stop und CRV nicht mehr passen.',
      falscheRichtung:
        'Der klassische Fehler: unter der gebrochenen Unterstützung SHORT zu gehen — genau in den Docht hinein, an dem die Abwärtsbewegung ihre letzten erzwungenen Verkäufer verliert.',
    },
    datumVerdeckt: true,
    ansageVerdeckt: true,
  },

  's-fakeout-btc-apr24': {
    id: 's-fakeout-btc-apr24',
    titel: 'Ausbruch über das Allzeithoch?',
    strategieId: 'kein-trade',
    datensatz: 'btc-fakeout-apr24',
    symbol: 'BTCUSDT',
    interval: '4h',
    startIndex: 120,
    endIndex: 186,
    aufgabe:
      'Der Markt drückt gegen einen Widerstand um 71.200–71.800 $, der in den letzten zwei Wochen sechsmal gehalten hat. Ein Ausbruch scheint sich anzubahnen. Entscheide, ob es hier ein regelkonformes Setup gibt — oder ob Abwarten die richtige Antwort ist.',
    richtung: 'keiner',
    alternativRichtung: 'short',
    feedback: {
      perfekt:
        'Richtig: kein Trade. Der Ausbruch über 71.800 $ (bis 72.800 $) hielt keine 24 Stunden — die nächste Tageskerze schloss wieder unter dem Level. Ein Fakeout. Breakout + Retest verlangt einen Retest, der HÄLT; den gab es nie. Wer auf den Retest wartete, sah stattdessen den Bruch unter 68.000 $ und den Absturz auf 60.600 $. Nicht handeln ist ein Trade.',
      gut: 'Du hast den gescheiterten Ausbruch als Fakeout erkannt und short gehandelt — das ist die fortgeschrittene Variante („failed breakout“) und lief hier tatsächlich bis 60.600 $. Für diesen Kurs war die erwartete Antwort aber: kein Trade, weil kein Setup aus dem Lehrplan sauber vorlag. Merke dir: Fakeout-Shorts sind ein eigenes Setup mit eigenem Stop (über dem Fakeout-Hoch).',
      verpasst: 'Kein Trade — richtig.',
      falsch:
        'Das war der Fehler, den dieses Szenario provoziert: Der Ausbruch über 71.800 $ war ein Fakeout — die nächste Tageskerze schloss wieder darunter, ein haltender Retest kam nie. Wer den „Retest“ bei 69.000–70.000 $ kaufte, saß im Absturz auf 60.600 $. Regel: Ohne Retest, der hält, gibt es keinen Breakout-Trade. Abwarten war die richtige Antwort.',
    },
    datumVerdeckt: true,
    ansageVerdeckt: true,
  },

  's-rangemitte-btc-sep23': {
    id: 's-rangemitte-btc-sep23',
    titel: 'Seitwärts, seitwärts, seitwärts',
    strategieId: 'kein-trade',
    datensatz: 'btc-range-sep23',
    symbol: 'BTCUSDT',
    interval: '1h',
    startIndex: 792,
    endIndex: 838,
    aufgabe:
      'Der Markt bewegt sich seit gut einer Woche zwischen ~26.100 und ~26.900 $. Prüfe, wo der Preis innerhalb dieser Struktur gerade steht — und ob daraus ein Setup mit sauberem Stop und CRV entsteht.',
    richtung: 'keiner',
    feedback: {
      perfekt:
        'Richtig: kein Trade. Der Preis stand die ganze Zeit in der MITTE der Range (26.450–26.750 $) — weit weg von beiden Rändern. Dort gibt es weder eine Stelle für einen logischen Stop noch ein CRV, das sich lohnt. Range-Regel aus Lektion 4.4: gehandelt wird am Rand, in der Mitte wird gewartet. Der nächste echte Rand kam erst zwei Tage später.',
      gut: 'Kein Trade — richtig.',
      verpasst: 'Kein Trade — richtig.',
      falsch:
        'Das war der Range-Klassiker: ein Trade aus der MITTE der Range (26.450–26.750 $). Egal in welche Richtung — der Stop hat dort keinen Bezugspunkt, das Ziel ist nur 150–300 $ entfernt, das CRV kann nicht stimmen. In der Range-Mitte ist Warten die einzige regelkonforme Aktion; gehandelt wird an der Unter- oder Oberkante.',
    },
    datumVerdeckt: true,
    ansageVerdeckt: true,
  },
}
