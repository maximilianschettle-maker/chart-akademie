import type { Lesson } from '../../types'

export const l3_05: Lesson = {
  id: 'l3-05',
  level: 3,
  titel: 'Heatmaps & Orderbuch-Level',
  untertitel: 'Die Absichten der großen Spieler sichtbar machen',
  dauerMin: 8,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Aus Level 1 kennst du das Orderbuch als Momentaufnahme. Eine <strong>Orderbuch-Heatmap</strong> macht daraus einen Film: Sie trägt für jeden Zeitpunkt ab, auf welchen Preisniveaus wie viele Limit-Orders ruhen — je heller, desto mehr Liquidität.</p>
<p>Was du darin siehst:</p>
<ul>
<li><strong>Walls:</strong> dicke, helle Linien = große Orderansammlungen. Kauf-Walls unter dem Preis bremsen Abverkäufe, Verkaufs-Walls über dem Preis deckeln Anstiege.</li>
<li><strong>Wandernde Level:</strong> Orders, die dem Preis „hinterherlaufen" — oft Market Maker, die ihre Quotes nachziehen.</li>
<li><strong>Verschwindende Walls:</strong> Der spannendste Moment. Wird eine Wall gezogen, fällt die Barriere weg — der Preis schießt oft unmittelbar hindurch.</li>
</ul>`,
    },
    { typ: 'demo', demoId: 'heatmap' },
    {
      typ: 'text',
      html: `<p>Der wichtigste Denkfehler, den du vermeiden musst: <strong>Eine Limit-Order ist eine Absicht, kein Vertrag.</strong> Große Walls können ernst gemeint sein — oder reine Show („Spoofing": Orders, die nur Eindruck machen sollen und vor der Ausführung verschwinden). Deshalb gilt:</p>
<ul>
<li>Heatmap-Level, die mit <em>Marktstruktur</em> zusammenfallen (Unterstützung + Kauf-Wall am selben Preis), sind deutlich verlässlicher als Walls im Nirgendwo.</li>
<li>Reagiere auf das, was mit der Wall <em>passiert</em> (hält sie? wird sie gefressen? verschwindet sie?), nicht auf ihre bloße Existenz.</li>
</ul>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Einordnung ins große Bild: <strong>Liquidity Map</strong> = wo <em>erzwungene</em> Orders schlummern (Liquidationen — Pflicht). <strong>Heatmap</strong> = wo <em>freiwillige</em> Orders liegen (Limit-Orders — Absicht). Beide beschreiben Liquidität, aber nur die erzwungene MUSS ausgeführt werden, wenn der Preis sie erreicht.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Was zeigt eine Orderbuch-Heatmap?',
          antworten: [
            'Die Temperatur der Server der Börse',
            'Ruhende Limit-Orders über Zeit und Preis — je heller, desto mehr Liquidität',
            'Nur ausgeführte Trades',
            'Die Funding-Historie',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Heatmap ist das Orderbuch als Film: Zeit auf der X-Achse, Preis auf der Y-Achse, Helligkeit = Menge der ruhenden Orders.',
        },
        {
          frage: 'Eine große Verkaufs-Wall über dem Preis verschwindet plötzlich. Was passiert häufig als Nächstes?',
          antworten: [
            'Der Preis fällt sofort',
            'Nichts — Walls haben keinen Einfluss',
            'Der Preis schießt oft durch das nun freie Niveau nach oben',
            'Die Börse pausiert den Handel',
          ],
          richtigIndex: 2,
          erklaerung:
            'Mit der Wall fällt die Barriere weg. Ob sie ernst gemeint war oder Spoofing — ihr Verschwinden öffnet den Weg, und der Markt nimmt ihn oft unmittelbar.',
        },
        {
          frage: 'Warum ist eine große Kauf-Wall allein noch kein Kaufsignal?',
          antworten: [
            'Weil Limit-Orders Absichten sind — sie können jederzeit gezogen werden (Spoofing)',
            'Weil Kauf-Walls den Preis drücken',
            'Weil Heatmaps nur für Aktien funktionieren',
            'Doch, eine große Wall ist immer ein Kaufsignal',
          ],
          richtigIndex: 0,
          erklaerung:
            'Eine Order kostet nichts, solange sie nicht ausgeführt wird. Verlässlicher wird das Signal erst, wenn die Wall mit echter Marktstruktur zusammenfällt und sich unter Druck BEWÄHRT (sie hält und wird gekauft).',
        },
      ],
    },
  ],
}
