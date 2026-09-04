import type { Lesson } from '../../types'

export const l4_04: Lesson = {
  id: 'l4-04',
  level: 4,
  titel: 'Range Trading',
  untertitel: 'Geld verdienen, wenn „nichts passiert"',
  dauerMin: 9,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Märkte trenden nur einen Bruchteil der Zeit — den Großteil verbringen sie in <strong>Ranges</strong>. Wer nur Trends handeln kann, sitzt monatelang auf den Händen oder (schlimmer) erzwingt Trend-Trades im Seitwärtsmarkt. Das Range-Setup:</p>
<ol>
<li><strong>Range definieren:</strong> mindestens je zwei Berührungen von Ober- und Unterkante. Erst dann IST es eine Range.</li>
<li><strong>Nur an den Rändern handeln:</strong> Long an der Unterkante, Short an der Oberkante (oder nur die Long-Seite, wenn der HTF-Kontext bullisch ist). <strong>Die Mitte ist tabu</strong> — dort ist weder Stop noch Ziel sinnvoll definierbar.</li>
<li><strong>Trigger:</strong> Ablehnung am Rand (Dochte, RSI-Extrem als Bestätigung — Level 3).</li>
<li><strong>Stop:</strong> außerhalb der Range (unter der Unterkante bzw. über der Oberkante), mit Sweep-Puffer.</li>
<li><strong>Ziel:</strong> die Gegenkante — konservativ die Range-Mitte, wenn das CRV es hergibt.</li>
</ol>`,
    },
    {
      typ: 'chart',
      titel: 'Beispiel: BTC 1h, 20.–30. Aug 2023 — eine enge Sommer-Range',
      symbol: 'BTCUSDT',
      interval: '1h',
      von: 1692489600, // 2023-08-20
      bis: 1693353600, // 2023-08-30
      annotationen: [
        { typ: 'preislinie', preis: 25900, text: 'Unterkante' },
        { typ: 'preislinie', preis: 26280, text: 'Oberkante' },
      ],
      beschreibung:
        'Tagelang pendelt BTC zwischen ~25.900 und ~26.280 $ — mehrere saubere Abpraller an beiden Kanten. Und dann das Lehrstück am Ende: Am 29.8. bricht die Range explosiv nach oben (Grayscale-Urteil). Merke beides — Ranges liefern wiederholbare Trades an den Rändern, UND sie enden irgendwann mit einem Ausbruch. Deshalb ist der Stop außerhalb der Range Pflicht.',
    },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Range-CRVs sind oft knapper als bei Trend-Setups. Rechne VOR dem Entry: Bringt Unterkante→Oberkante bei deinem Stop mindestens 1,5R? Wenn die Range zu eng für ein sauberes CRV ist, ist sie zu eng zum Handeln — beobachten und auf den Ausbruch warten (Breakout-Setup!).`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Ab wann darf man einen Seitwärtsmarkt als handelbare Range betrachten?',
          antworten: [
            'Nach der ersten Berührung einer Kante',
            'Wenn Ober- UND Unterkante jeweils mindestens zweimal bestätigt wurden',
            'Sobald der RSI bei 50 steht',
            'Nach genau 24 Stunden Seitwärtsbewegung',
          ],
          richtigIndex: 1,
          erklaerung:
            'Zwei Punkte definieren eine Linie: Erst mit je zwei Berührungen beider Kanten ist die Range ein bestätigtes Muster statt einer Vermutung.',
        },
        {
          frage: 'Warum ist die Mitte der Range „tabu"?',
          antworten: [
            'Weil dort die Gebühren höher sind',
            'Weil dort weder ein sinnvoller Stop (welche Struktur?) noch ein gutes CRV existiert',
            'Weil die Mitte immer ein Widerstand ist',
            'Ist sie nicht — die Mitte ist der beste Einstieg',
          ],
          richtigIndex: 1,
          erklaerung:
            'In der Mitte ist der Abstand zu beiden Kanten gleich — das Ziel ist nah, der logische Stop weit weg. Das Setup lebt von den Rändern, wo Stop (knapp außerhalb) und Ziel (Gegenkante) natürlich definiert sind.',
        },
        {
          frage: 'Deine Range hält seit Wochen. Was solltest du trotzdem nie vergessen?',
          antworten: [
            'Ranges halten für immer, wenn sie alt genug sind',
            'Jede Range endet mit einem Ausbruch — deshalb gehört der Stop immer außerhalb der Range',
            'Nach drei Wochen darf man den Stop weglassen',
            'Alte Ranges kann man nur short handeln',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Beispiel-Range oben endete mit einem +7-%-Ausbruch in wenigen Stunden. Wer an der Unterkante long war: wunderbar. Wer an der Oberkante short war, ohne Stop darüber: ruiniert. Der Stop außerhalb ist die Versicherung gegen das sichere Ende jeder Range.',
        },
      ],
    },
    { typ: 'uebung', szenarioId: 's-range-btc-sep23' },
  ],
}
