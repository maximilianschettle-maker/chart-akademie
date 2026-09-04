import type { Lesson } from '../../types'

export const l1_03: Lesson = {
  id: 'l1-03',
  level: 1,
  titel: 'Timeframes & Marktstruktur',
  untertitel: 'Higher Highs, Higher Lows — und warum der große Chart zuerst kommt',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Ein <strong>Timeframe</strong> (Zeitfenster) bestimmt, wie viel Zeit eine Kerze zusammenfasst: 1 Minute, 15 Minuten, 1 Stunde, 4 Stunden, 1 Tag. Derselbe Markt erzählt auf jedem Timeframe eine andere Geschichte — ein Abwärtstrend auf dem 15-Minuten-Chart kann ein winziger Rücksetzer in einem Tages-Aufwärtstrend sein.</p>
<p>Daraus folgt die wichtigste Arbeitsregel überhaupt: <strong>Top-Down-Analyse.</strong> Erst der hohe Timeframe (HTF, z.B. 1d/4h) für die Richtung und die wichtigen Preiszonen — dann der niedrige Timeframe (LTF, z.B. 1h/15m) für den präzisen Einstieg.</p>`,
    },
    {
      typ: 'text',
      html: `<p><strong>Marktstruktur</strong> ist das Skelett jedes Charts. Es gibt nur drei Zustände:</p>
<ul>
<li><strong>Aufwärtstrend:</strong> steigende Hochs (Higher Highs, HH) und steigende Tiefs (Higher Lows, HL).</li>
<li><strong>Abwärtstrend:</strong> fallende Hochs (Lower Highs, LH) und fallende Tiefs (Lower Lows, LL).</li>
<li><strong>Range (Seitwärtsphase):</strong> der Preis pendelt zwischen einer Ober- und Unterkante, ohne neue Extreme.</li>
</ul>
<p>Ein Trend ist intakt, solange seine Struktur hält. Ein Aufwärtstrend „bricht" erst, wenn ein vorheriges Higher Low deutlich unterschritten wird (<em>Break of Structure</em>). Bis dahin sind Rücksetzer normal — sie sind sogar die besten Einstiegsgelegenheiten.</p>`,
    },
    {
      typ: 'chart',
      titel: 'Das große Bild: BTC/USDT auf 4h (Feb–März 2024)',
      symbol: 'BTCUSDT',
      interval: '4h',
      von: 1707696000, // 2024-02-12
      bis: 1710115200, // 2024-03-11
      beschreibung:
        'Klarer Aufwärtstrend: Verfolge die Struktur und markiere gedanklich jedes Higher High und Higher Low. Beachte, wie Rücksetzer immer wieder über dem letzten Tief drehen.',
    },
    {
      typ: 'chart',
      titel: 'Dasselbe hineingezoomt: 1h-Kerzen (4.–8. März 2024)',
      symbol: 'BTCUSDT',
      interval: '1h',
      von: 1709510400, // 2024-03-04
      bis: 1709856000, // 2024-03-08
      beschreibung:
        'Ein Ausschnitt aus dem 4h-Chart oben, jetzt in Stundenkerzen: Was oben wie eine glatte Bewegung aussieht, ist hier ein nervöses Auf und Ab mit scharfen Einbrüchen. Wer nur auf den kleinen Timeframe schaut, verliert das große Bild — und handelt gegen den Trend.',
    },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Praktische Faustregel für den Anfang: <strong>Richtung auf 4h/1d bestimmen, Einstieg auf 1h/15m suchen — und nur in Richtung des HTF-Trends handeln.</strong> Gegen den übergeordneten Trend zu traden ist möglich, aber die schwerste Disziplin überhaupt. Verzichte als Anfänger darauf.`,
    },
    {
      typ: 'begriffe',
      eintraege: [
        { begriff: 'HTF / LTF', erklaerung: 'Higher/Lower Timeframe — großes Bild vs. Einstiegs-Zoom.' },
        { begriff: 'Higher High / Higher Low', erklaerung: 'Steigende Hochs/Tiefs — Kennzeichen des Aufwärtstrends.' },
        { begriff: 'Lower High / Lower Low', erklaerung: 'Fallende Hochs/Tiefs — Kennzeichen des Abwärtstrends.' },
        { begriff: 'Range', erklaerung: 'Seitwärtsphase zwischen klarer Ober- und Unterkante.' },
        { begriff: 'Break of Structure', erklaerung: 'Bruch der Trendstruktur, z.B. Unterschreiten des letzten Higher Low.' },
      ],
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Woran erkennst du einen intakten Aufwärtstrend?',
          antworten: [
            'Der Preis ist heute höher als gestern',
            'An steigenden Hochs UND steigenden Tiefs',
            'An mindestens fünf grünen Kerzen hintereinander',
            'Am positiven Funding',
          ],
          richtigIndex: 1,
          erklaerung:
            'Marktstruktur zählt: Higher Highs und Higher Lows. Einzelne Kerzenfarben oder Tagesvergleiche sagen nichts über den Trend aus.',
        },
        {
          frage: 'Was besagt die Top-Down-Analyse?',
          antworten: [
            'Man handelt nur auf dem Tages-Chart',
            'Erst auf dem hohen Timeframe Richtung und Zonen bestimmen, dann auf dem niedrigen den Einstieg suchen',
            'Man beginnt beim 1-Minuten-Chart und arbeitet sich hoch',
            'Höhere Timeframes sind für Anfänger zu kompliziert',
          ],
          richtigIndex: 1,
          erklaerung:
            'HTF gibt Richtung und wichtige Preiszonen vor, LTF liefert das präzise Timing. Diese Reihenfolge verhindert, dass du auf kleinen Timeframes gegen den großen Trend handelst.',
        },
        {
          frage: 'Der 4h-Chart zeigt einen sauberen Aufwärtstrend, der 15m-Chart gerade einen scharfen Abverkauf. Was ist die sinnvollste Interpretation?',
          antworten: [
            'Der Aufwärtstrend ist vorbei — sofort short gehen',
            'Vermutlich ein normaler Rücksetzer im HTF-Trend — womöglich eine Long-Gelegenheit, falls die Struktur hält',
            'Die Charts widersprechen sich, einer von beiden ist fehlerhaft',
            '15m-Charts sind grundsätzlich zu ignorieren',
          ],
          richtigIndex: 1,
          erklaerung:
            'LTF-Abverkäufe innerhalb eines intakten HTF-Aufwärtstrends sind normale Rücksetzer — oft genau die Einstiegszonen, auf die Trendfolger warten. Erst ein Bruch der HTF-Struktur ändert das Bild.',
        },
        {
          frage: 'Wann gilt ein Aufwärtstrend als gebrochen?',
          antworten: [
            'Nach der ersten roten Tageskerze',
            'Wenn der Preis ein vorheriges Higher Low deutlich unterschreitet',
            'Wenn das Volumen einen Tag lang sinkt',
            'Wenn er länger als drei Monate läuft',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ein Trend lebt von seiner Struktur. Erst wenn ein maßgebliches Higher Low fällt (Break of Structure), ist der Aufwärtstrend objektiv verletzt.',
        },
      ],
    },
  ],
}
