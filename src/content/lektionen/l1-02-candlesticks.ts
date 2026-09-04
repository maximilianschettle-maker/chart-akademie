import type { Lesson } from '../../types'

export const l1_02: Lesson = {
  id: 'l1-02',
  level: 1,
  titel: 'Candlesticks lesen',
  untertitel: 'OHLC, Körper, Dochte — und was eine Kerze wirklich erzählt',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Jede Kerze (Candlestick) fasst den Kampf zwischen Käufern und Verkäufern in einem Zeitfenster zusammen. Sie besteht aus vier Preisen — <strong>OHLC</strong>:</p>
<ul>
<li><strong>Open</strong> — Eröffnungskurs des Zeitfensters</li>
<li><strong>High</strong> — höchster Kurs</li>
<li><strong>Low</strong> — tiefster Kurs</li>
<li><strong>Close</strong> — Schlusskurs</li>
</ul>
<p>Der <strong>Körper</strong> ist der Bereich zwischen Open und Close. Schließt die Kerze über dem Open, ist sie <em>grün</em> (bullisch); darunter, <em>rot</em> (bärisch). Die dünnen Linien oben und unten sind die <strong>Dochte</strong> (Wicks): Dorthin lief der Preis, konnte sich aber nicht halten.</p>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Dochte sind oft wichtiger als der Körper: Ein langer Docht zeigt, dass der Preis dort <strong>abgelehnt</strong> wurde. Ein langer unterer Docht = Käufer haben den Absturz aufgekauft. Ein langer oberer Docht = Verkäufer haben den Anstieg abverkauft.`,
    },
    {
      typ: 'text',
      html: `<p>Ein paar Kerzenformen, die du sofort erkennen solltest:</p>
<ul>
<li><strong>Marubozu</strong> — großer Körper, kaum Dochte: eine Seite hat klar dominiert. Starkes Momentum.</li>
<li><strong>Doji</strong> — winziger Körper, Open ≈ Close: Unentschieden. Nach einem starken Trend oft ein erstes Warnsignal.</li>
<li><strong>Hammer / Shooting Star</strong> — kleiner Körper mit sehr langem Docht nach unten (Hammer, bullisch) bzw. oben (Shooting Star, bärisch): deutliche Ablehnung eines Preisbereichs.</li>
<li><strong>Engulfing</strong> — eine Kerze, deren Körper den Körper der Vorkerze komplett umschließt: möglicher Stimmungsumschwung.</li>
</ul>
<p>Wichtig: <strong>Keine Kerzenform ist für sich allein ein Handelssignal.</strong> Ein Hammer mitten im Nirgendwo bedeutet nichts. Ein Hammer an einer wichtigen Unterstützung mit hohem Volumen — das ist interessant. Der Kontext (Marktstruktur, Level, Volumen) macht das Signal; genau das lernst du in den nächsten Levels.</p>`,
    },
    {
      typ: 'chart',
      titel: 'BTC/USDT, Stundenkerzen — eine echte Handelswoche (März 2024)',
      symbol: 'BTCUSDT',
      interval: '1h',
      von: 1709251200, // 2024-03-01
      bis: 1709856000, // 2024-03-08
      beschreibung:
        'Übe direkt hier: Suche im Chart nach Kerzen mit langen Dochten und frage dich bei jeder — wer wurde hier abgelehnt, Käufer oder Verkäufer? Finde mindestens einen Doji und eine Marubozu-artige Momentum-Kerze. Beachte auch das Volumen unten: Große Kerzen mit hohem Volumen bedeuten mehr als große Kerzen ohne.',
    },
    {
      typ: 'text',
      html: `<p>Noch ein entscheidender Punkt: Dieselbe Kursbewegung sieht auf jedem Zeitfenster anders aus. Vier rote 15-Minuten-Kerzen können zusammen eine einzige grüne Stundenkerze mit langem unteren Docht ergeben. Deshalb gilt: Kerzen liest man immer <strong>im Kontext ihres Timeframes</strong> — das Thema der nächsten Lektion.</p>`,
    },
    {
      typ: 'begriffe',
      eintraege: [
        { begriff: 'OHLC', erklaerung: 'Open, High, Low, Close — die vier Preise einer Kerze.' },
        { begriff: 'Körper (Body)', erklaerung: 'Bereich zwischen Open und Close.' },
        { begriff: 'Docht (Wick)', erklaerung: 'Preisbereich, der getestet, aber abgelehnt wurde.' },
        { begriff: 'Doji', erklaerung: 'Kerze mit Open ≈ Close — Unentschieden zwischen Käufern und Verkäufern.' },
        { begriff: 'Engulfing', erklaerung: 'Kerzenkörper umschließt den der Vorkerze — möglicher Umschwung.' },
      ],
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Eine Kerze hat Open 62.000, High 63.500, Low 61.800, Close 63.200. Wie sieht sie aus?',
          antworten: [
            'Rot, mit langem oberen Docht',
            'Grün, Körper von 62.000 bis 63.200, kleiner Docht oben und unten',
            'Ein Doji',
            'Grün, ohne jegliche Dochte',
          ],
          richtigIndex: 1,
          erklaerung:
            'Close (63.200) liegt über Open (62.000) → grün. Oberer Docht bis 63.500, unterer bis 61.800 — beide relativ klein im Vergleich zum Körper.',
        },
        {
          frage: 'Was bedeutet ein sehr langer unterer Docht am ehesten?',
          antworten: [
            'Der Preis wird sicher weiter fallen',
            'Verkäufer haben die Kontrolle übernommen',
            'Der Preisbereich unten wurde getestet und von Käufern zurückerobert',
            'Die Kerze ist fehlerhaft dargestellt',
          ],
          richtigIndex: 2,
          erklaerung:
            'Der Preis fiel in den Bereich, wurde dort aber aufgekauft und schloss deutlich höher — eine Ablehnung des unteren Bereichs durch Käufer.',
        },
        {
          frage: 'Warum ist ein Hammer allein noch kein Kaufsignal?',
          antworten: [
            'Weil Hammer-Kerzen extrem selten sind',
            'Weil Kerzenmuster ohne Kontext (Level, Struktur, Volumen) kaum Aussagekraft haben',
            'Weil Hammer nur auf dem Tages-Chart gelten',
            'Doch — ein Hammer ist immer ein Kaufsignal',
          ],
          richtigIndex: 1,
          erklaerung:
            'Muster bekommen ihre Bedeutung erst durch den Ort, an dem sie auftreten: an einer wichtigen Unterstützung mit Volumen ist ein Hammer interessant, mitten im Nirgendwo bedeutungslos.',
        },
        {
          frage: 'Was ist ein Doji und wann ist er besonders beachtenswert?',
          antworten: [
            'Eine Kerze mit riesigem Körper — beachtenswert in Seitwärtsphasen',
            'Eine Kerze mit Open ≈ Close — beachtenswert nach einem starken Trend',
            'Eine grüne Kerze ohne Dochte — beachtenswert am Wochenende',
            'Ein Muster aus drei Kerzen — beachtenswert bei hohem Funding',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ein Doji zeigt Unentschieden. Mitten in einer Range ist das normal — aber nach einem langen, starken Trend kann er das erste Zeichen sein, dass das Momentum ausläuft.',
        },
      ],
    },
  ],
}
