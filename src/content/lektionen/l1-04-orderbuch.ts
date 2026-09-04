import type { Lesson } from '../../types'

export const l1_04: Lesson = {
  id: 'l1-04',
  level: 1,
  titel: 'Orderbuch & Ordertypen',
  untertitel: 'Market, Limit, Stop — und warum der Spread dein erster Gegner ist',
  dauerMin: 9,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Jede Börse führt für jeden Markt ein <strong>Orderbuch</strong>: eine Liste aller offenen Kauf- und Verkaufsaufträge.</p>
<ul>
<li><strong>Bids</strong> — Kaufaufträge. Der höchste Bid ist der beste Preis, den ein Käufer gerade zahlt.</li>
<li><strong>Asks</strong> — Verkaufsaufträge. Der niedrigste Ask ist der beste Preis, zu dem jemand verkauft.</li>
<li><strong>Spread</strong> — die Lücke zwischen bestem Bid und bestem Ask. Bei BTC winzig, bei kleinen Coins oft erheblich: Du startest jeden Trade um den Spread (plus Gebühren) im Minus.</li>
</ul>
<p>Ein „Kurs" ist also nichts weiter als der Preis des <em>letzten Trades</em> zwischen einem Käufer und einem Verkäufer aus diesem Buch.</p>`,
    },
    {
      typ: 'text',
      html: `<p>Die zwei Grund-Ordertypen unterscheiden sich darin, ob du <em>Preis</em> oder <em>Ausführung</em> garantiert bekommst:</p>
<ul>
<li><strong>Market Order:</strong> „Kaufe/verkaufe JETZT, egal zu welchem Preis." Sofortige Ausführung, aber du frisst dich durchs Orderbuch — bei größeren Orders oder dünnen Märkten zu immer schlechteren Preisen (<em>Slippage</em>). Du bist <em>Taker</em> und zahlst die höhere Gebühr.</li>
<li><strong>Limit Order:</strong> „Kaufe/verkaufe nur zu meinem Preis oder besser." Preis garantiert, Ausführung nicht — der Markt muss zu dir kommen. Du bist <em>Maker</em> und zahlst weniger Gebühren.</li>
</ul>
<p>Dazu kommen <strong>Stop-Orders</strong> — Aufträge, die erst scharf werden, wenn ein Auslösepreis erreicht ist. Die wichtigste: die <strong>Stop-Loss-Order</strong>, die deine Position automatisch schließt, wenn der Markt gegen dich läuft. Sie ist keine Option, sondern Pflicht — warum, klärt Level 2 im Detail.</p>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Merksatz: <strong>Market Order = Ausführung garantiert, Preis nicht. Limit Order = Preis garantiert, Ausführung nicht.</strong> Geplante Einstiege setzt man per Limit an vorher definierten Zonen; Market Orders sind für Momente, in denen sofortiges Handeln wichtiger ist als der letzte Dollar — etwa beim Schließen einer Position.`,
    },
    {
      typ: 'text',
      html: `<p>Warum das für alles Weitere zählt: Große Ansammlungen von Limit-Orders wirken wie Magnete und Barrieren zugleich — der Preis reagiert an Stellen, wo viel <strong>Liquidität</strong> liegt. Heatmaps und Liquidity Maps (Level 3) machen genau diese Ansammlungen sichtbar. Und der Simulator dieser App (ab Level 2 freigeschaltet) verwendet exakt diese Ordertypen: Market, Limit, Stop-Loss, Take-Profit.</p>`,
    },
    {
      typ: 'begriffe',
      eintraege: [
        { begriff: 'Bid / Ask', erklaerung: 'Kauf- bzw. Verkaufsaufträge im Orderbuch.' },
        { begriff: 'Spread', erklaerung: 'Differenz zwischen bestem Bid und bestem Ask.' },
        { begriff: 'Slippage', erklaerung: 'Verschlechterung des Ausführungspreises, weil eine Market Order das Orderbuch „leerfrisst".' },
        { begriff: 'Maker / Taker', erklaerung: 'Maker stellen Liquidität bereit (Limit), Taker nehmen sie (Market). Taker zahlen mehr Gebühren.' },
        { begriff: 'Stop-Loss', erklaerung: 'Order, die deine Position automatisch schließt, wenn der Markt gegen dich läuft.' },
        { begriff: 'Liquidität', erklaerung: 'Wie viel an einem Preisbereich gehandelt werden kann, ohne den Kurs stark zu bewegen.' },
      ],
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Was garantiert dir eine Limit Order?',
          antworten: [
            'Dass sie sofort ausgeführt wird',
            'Deinen Preis (oder besser) — aber nicht, dass sie überhaupt ausgeführt wird',
            'Ausführung UND Preis',
            'Dass keine Gebühren anfallen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Limit = Preisgarantie ohne Ausführungsgarantie. Läuft der Markt weg, ohne dein Level zu berühren, bleibst du außen vor — das ist der Preis für den besseren Kurs.',
        },
        {
          frage: 'Was ist Slippage?',
          antworten: [
            'Die Gebühr der Börse',
            'Ein Chartmuster aus zwei Dojis',
            'Die Verschlechterung des Ausführungspreises, wenn eine Market Order mehrere Orderbuch-Level durchläuft',
            'Der Abstand zwischen Entry und Stop-Loss',
          ],
          richtigIndex: 2,
          erklaerung:
            'Eine Market Order nimmt, was da ist: Reicht das beste Level nicht, wird der Rest zu schlechteren Preisen gefüllt. Je dünner der Markt und je größer die Order, desto teurer wird es.',
        },
        {
          frage: 'Du willst BTC gezielt an einer Unterstützung bei 58.000 $ kaufen, der Kurs steht bei 60.000 $. Welche Order passt?',
          antworten: [
            'Market Order — sofort kaufen, bevor es zu spät ist',
            'Limit-Kauforder bei 58.000 $',
            'Stop-Loss bei 58.000 $',
            'Gar keine — man kann keine Orders unter dem aktuellen Kurs platzieren',
          ],
          richtigIndex: 1,
          erklaerung:
            'Genau dafür sind Limit Orders da: Du legst deinen Kaufauftrag an die geplante Zone und lässt den Markt zu dir kommen. Fällt der Kurs nie dorthin, gibt es eben keinen Trade — auch das ist ein Ergebnis.',
        },
        {
          frage: 'Warum interessieren sich Trader für Stellen mit viel Liquidität im Orderbuch?',
          antworten: [
            'Weil dort die Gebühren niedriger sind',
            'Weil der Preis an solchen Stellen oft reagiert — sie wirken wie Barrieren oder Magnete',
            'Weil man nur dort Market Orders nutzen darf',
            'Liquidität ist nur für die Börse selbst relevant',
          ],
          richtigIndex: 1,
          erklaerung:
            'Große Orderansammlungen bremsen den Preis oder ziehen ihn an. Heatmaps und Liquidity Maps (Level 3) versuchen, genau diese Bereiche sichtbar zu machen.',
        },
      ],
    },
  ],
}
