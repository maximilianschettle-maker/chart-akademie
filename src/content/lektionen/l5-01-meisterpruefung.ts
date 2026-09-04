import type { Lesson } from '../../types'

export const l5_01: Lesson = {
  id: 'l5-01',
  level: 5,
  titel: 'Meisterprüfung: Die Szenario-Serie',
  untertitel: 'Alle fünf Setups — jetzt zählt die Ausführung',
  dauerMin: 25,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Du kennst jetzt fünf Setups und die Werkzeuge dahinter. Diese Abschluss-Serie prüft, ob du sie <em>ausführen</em> kannst: Entry in der Zone, Stop auf der richtigen Seite, CRV ≥ 1,5 — bei jedem einzelnen.</p>
<p><strong>Dein Ziel: alle fünf Übungen mit „perfekt" abschließen.</strong> Wiederhole so oft du willst — Wiederholung ist hier keine Schummelei, sondern der Sinn der Sache: Du trainierst den Ablauf, bis er sitzt. Achte dabei bewusst auf den Prozess aus Level 2: erst Risiko, dann Stop, dann Ziel, dann Entry.</p>`,
    },
    { typ: 'uebung', szenarioId: 's-trend-btc-feb24' },
    { typ: 'uebung', szenarioId: 's-bounce-btc-juni23' },
    { typ: 'uebung', szenarioId: 's-breakout-btc-okt23' },
    { typ: 'uebung', szenarioId: 's-range-btc-sep23' },
    { typ: 'uebung', szenarioId: 's-sweep-btc-mai24' },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Danach: der <strong>freie Replay-Modus</strong> (nächste Lektion). Dort sagt dir niemand mehr, welches Setup — oder ob überhaupt eines — im Chart steckt. Genau wie im echten Markt.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Du öffnest einen unbekannten Chart. Was bestimmst du als Erstes?',
          antworten: [
            'Den RSI-Wert',
            'Das Marktregime: Trend oder Range — daraus folgt, welche Setups überhaupt in Frage kommen',
            'Das Funding',
            'Die Farbe der letzten Kerze',
          ],
          richtigIndex: 1,
          erklaerung:
            'Regime zuerst: Im Trend suchst du Pullbacks und Breakout-Retests, in der Range die Ränder und Sweeps an den Extremen. Jedes Werkzeug gilt nur in seinem Regime.',
        },
        {
          frage: 'Was haben alle fünf Setups dieses Kurses gemeinsam?',
          antworten: [
            'Sie funktionieren nur bei Bitcoin',
            'Man wartet, bis der Preis zu einer VORHER definierten Zone kommt — und der Stop liegt dort, wo die Idee widerlegt ist',
            'Sie brauchen mindestens 20x Hebel',
            'Sie haben eine Trefferquote über 80 %',
          ],
          richtigIndex: 1,
          erklaerung:
            'Zone vorher definieren, Markt kommen lassen, Stop an der Widerlegung, CRV prüfen: Das ist die gemeinsame DNA — der Rest ist Variation. Keines der Setups verspricht hohe Trefferquoten; sie versprechen gute CRVs.',
        },
        {
          frage: 'In einer Übung hast du „perfekt" erreicht, aber der Trade endete am Stop-Loss (−1R). Wie ist das zu bewerten?',
          antworten: [
            'Als Fehler — Ergebnis schlägt Prozess',
            'Als guter Trade: richtige Zone, richtiger Stop, gutes CRV — der Verlust ist Teil der Statistik',
            'Die Übung ist kaputt',
            'Man hätte den Stop weiter weg setzen müssen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Genau dafür war Level 2 da: Ein regelkonformer Trade mit −1R ist ein GUTER Trade. Das System gewinnt über viele Trades — nicht in jedem einzelnen.',
        },
      ],
    },
  ],
}
