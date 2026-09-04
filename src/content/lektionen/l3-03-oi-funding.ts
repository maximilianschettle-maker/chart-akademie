import type { Lesson } from '../../types'

export const l3_03: Lesson = {
  id: 'l3-03',
  level: 3,
  titel: 'Open Interest & Funding Rate',
  untertitel: 'Die Positionierung des Marktes lesen',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Zwei Kennzahlen existieren nur im Futures-Markt — und genau deshalb verraten sie, was der Kurs allein nicht zeigt: <em>wie der Markt positioniert ist</em>.</p>
<p><strong>Open Interest (OI)</strong> = die Summe aller offenen Kontrakte. Steigt das OI, kommt neues Geld in den Markt; fällt es, werden Positionen geschlossen. Die Kombination mit dem Preis ergibt die klassische Matrix:</p>
<ul>
<li><strong>Preis ↑ + OI ↑</strong> — neue Longs tragen den Trend: gesund.</li>
<li><strong>Preis ↑ + OI ↓</strong> — nur Shorts decken sich ein (Squeeze): Bewegung ohne frisches Geld, fragil.</li>
<li><strong>Preis ↓ + OI ↑</strong> — neue Shorts drücken: Abwärtstrend mit Überzeugung.</li>
<li><strong>Preis ↓ + OI ↓</strong> — Longs kapitulieren: oft das Ende eines Abverkaufs.</li>
<li><strong>OI-Einbruch in Sekunden</strong> — Massen-Liquidation (siehe nächste Lektion).</li>
</ul>`,
    },
    {
      typ: 'text',
      html: `<p><strong>Funding Rate:</strong> Perpetual Futures haben kein Ablaufdatum. Damit ihr Preis am Spot-Preis bleibt, zahlt alle 8 Stunden eine Seite die andere:</p>
<ul>
<li><strong>Positives Funding</strong> — Longs zahlen Shorts. Der Markt ist mehrheitlich long positioniert.</li>
<li><strong>Negatives Funding</strong> — Shorts zahlen Longs. Der Markt ist mehrheitlich short.</li>
</ul>
<p>Interessant sind die <em>Extreme</em>: Sehr hohes Funding heißt, die Long-Seite ist überfüllt und zahlt teuer fürs Dabeisein — solche Märkte korrigieren oft scharf („Long Squeeze"). Stark negatives Funding nach einem Crash heißt: Alle sind schon short — Treibstoff für den Short Squeeze nach oben. Funding ist damit ein <strong>Kontra-Indikator an den Rändern</strong>, kein Timing-Signal.</p>`,
    },
    { typ: 'demo', demoId: 'funding-oi' },
    {
      typ: 'callout',
      variante: 'merke',
      html: `OI und Funding beantworten die Frage: <strong>„Wer sitzt schon im Boot?"</strong> Wenn alle bereits long sind, ist kaum noch jemand übrig, der kaufen könnte — die Gegenrichtung wird zum Pfad des geringsten Widerstands. Handle nie ALLEIN auf OI/Funding, aber nutze sie als Warnsystem für überfüllte Trades.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Der Preis steigt kräftig, aber das Open Interest FÄLLT dabei. Was passiert wahrscheinlich?',
          antworten: [
            'Neues Geld strömt in den Markt — sehr bullisch',
            'Shorts decken sich ein (Short Squeeze) — Bewegung ohne frisches Geld, eher fragil',
            'Das ist technisch unmöglich',
            'Die Börse hat einen Datenfehler',
          ],
          richtigIndex: 1,
          erklaerung:
            'Steigender Preis bei fallendem OI = bestehende Short-Positionen werden geschlossen (Rückkäufe treiben den Preis). Sobald die Eindeckung endet, fehlt die Anschlusskraft.',
        },
        {
          frage: 'Das Funding ist seit Tagen extrem positiv. Was bedeutet das?',
          antworten: [
            'Shorts zahlen Longs — der Markt ist mehrheitlich short',
            'Longs zahlen Shorts — die Long-Seite ist überfüllt, Korrekturgefahr steigt',
            'Die Börse erhöht die Gebühren',
            'Der Spot-Preis ist unter dem Futures-Preis — ein Kaufsignal',
          ],
          richtigIndex: 1,
          erklaerung:
            'Positives Funding = Longs zahlen. Extrem hohe Werte zeigen einseitige Positionierung — historisch folgen darauf überdurchschnittlich oft scharfe Long-Squeezes.',
        },
        {
          frage: 'Nach einem Crash ist das Funding stark negativ. Wie liest du das?',
          antworten: [
            'Der Markt fällt garantiert weiter',
            'Die Short-Seite ist überfüllt — Treibstoff für einen Short Squeeze nach oben',
            'Funding ist nach Crashs bedeutungslos',
            'Man sollte sofort mit maximalem Hebel long gehen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Wenn „alle" schon short sind, kann wenig zusätzlicher Verkaufsdruck entstehen — aber jede Aufwärtsbewegung zwingt Shorts zum Rückkauf. Ein Warnsignal für Shorts, KEIN blindes Long-Signal (Antwort D scheitert am Risikomanagement).',
        },
        {
          frage: 'Das OI bricht innerhalb von Minuten massiv ein, der Preis macht einen langen Docht. Was ist passiert?',
          antworten: [
            'Viele Trader haben in Ruhe Gewinne mitgenommen',
            'Eine Massen-Liquidation: Zwangsschließungen haben Positionen ausradiert',
            'Die Börse war offline',
            'Das Funding wurde abgerechnet',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ein schlagartiger OI-Einbruch plus Preis-Docht ist die Signatur einer Liquidations-Kaskade — genau das Thema der nächsten Lektion.',
        },
      ],
    },
  ],
}
