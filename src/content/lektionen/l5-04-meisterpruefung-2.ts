import type { Lesson } from '../../types'

export const l5_04: Lesson = {
  id: 'l5-04',
  level: 5,
  titel: 'Meisterprüfung II: Ohne Ansage',
  untertitel: 'Erkenne selbst, ob ein Setup vorliegt — und welches',
  dauerMin: 30,
  bloecke: [
    {
      typ: 'text',
      html: `<p>In der ersten Meisterprüfung stand die Strategie über jeder Übung. Im echten Markt sagt dir das niemand. Diese vier Übungen nennen nur die Marktlage — <strong>ob</strong> ein Setup entsteht, <strong>welches</strong> und <strong>wo</strong>, musst du selbst erkennen.</p>
<p>Neu ist auch: <strong>„Kein Trade“ ist eine gültige Antwort.</strong> In mindestens einer der Übungen ist es sogar die einzig richtige. Der Knopf dafür sitzt im Order-Ticket. Wer immer handelt, handelt auch, wenn es nichts zu handeln gibt — das ist der teuerste Reflex überhaupt.</p>
<p>Andere Assets als Bitcoin, andere Zeitebenen. Nutze den Kontext-Chart (höherer Timeframe) und die Zeichenwerkzeuge, um Zonen zu markieren, bevor du entscheidest.</p>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Reihenfolge wie immer: <strong>Regime</strong> (Trend oder Range?) → <strong>Zone</strong> (wo würde ich handeln?) → <strong>Auslöser</strong> (kommt der Preis dorthin und reagiert?) → <strong>Risiko</strong> (Stop an der Widerlegung, CRV ≥ 1,5) → erst dann Entry. Fehlt ein Glied, ist die Antwort: kein Trade.`,
    },
    { typ: 'uebung', szenarioId: 's-breakout-eth-nov23' },
    { typ: 'uebung', szenarioId: 's-rangemitte-btc-sep23' },
    { typ: 'uebung', szenarioId: 's-sweep-sol-aug24' },
    { typ: 'uebung', szenarioId: 's-fakeout-btc-apr24' },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Danach: die <strong>Zufalls-Übung</strong> auf dem Dashboard. Sie sucht in einem zufälligen historischen Abschnitt automatisch ein Setup — unendlich viele Übungen, jedes Mal ein anderer Markt.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Ein Ausbruch über einen mehrfach getesteten Widerstand — die nächste Tageskerze schließt wieder darunter. Was gilt?',
          antworten: [
            'Der Retest ist da, jetzt kaufen',
            'Das ist ein Fakeout — für Breakout + Retest fehlt der Retest, der hält. Kein Long.',
            'Egal, im Trend kauft man jeden Rücksetzer',
            'Man verdoppelt die Position, weil der Preis jetzt billiger ist',
          ],
          richtigIndex: 1,
          erklaerung:
            'Breakout + Retest verlangt zwei Dinge: den Ausbruch UND einen Retest, an dem das alte Level als Unterstützung hält. Schließt der Markt wieder unter dem Level, ist die Ausbruchs-These widerlegt. Fortgeschrittene shorten das als „failed breakout“ — Anfänger warten.',
        },
        {
          frage: 'Der Preis steht in der Mitte einer klaren Range. Welche Aktion ist regelkonform?',
          antworten: [
            'Long, weil die Oberkante das Ziel ist',
            'Short, weil die Unterkante das Ziel ist',
            'Keine — in der Range-Mitte gibt es weder einen logischen Stop noch ein CRV',
            'Beides gleichzeitig (Hedge)',
          ],
          richtigIndex: 2,
          erklaerung:
            'Am Rand liegt der Stop knapp außerhalb der Range und das Ziel am gegenüberliegenden Rand — CRV 2 bis 3. In der Mitte ist das Ziel halb so weit und der Stop hat keinen Bezugspunkt. Warten ist die Aktion.',
        },
        {
          frage: 'Warum ist „Kein Trade“ als Antwort in dieser Prüfung genauso wichtig wie ein perfekter Entry?',
          antworten: [
            'Weil man dann keine Gebühren zahlt',
            'Weil der Reflex, immer zu handeln, die häufigste Quelle unnötiger Verluste ist — Setups sind selten, Charts laufen immer',
            'Weil der Simulator sonst abstürzt',
            'Ist er nicht — Trader müssen handeln',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ein System gewinnt durch die Trades, die es NICHT macht, genauso wie durch die, die es macht. Die Fähigkeit, einen Chart zu schließen, ohne zu handeln, unterscheidet Trader von Zockern.',
        },
      ],
    },
  ],
}
