import type { Lesson } from '../../types'

export const l4_03: Lesson = {
  id: 'l4-03',
  level: 4,
  titel: 'Breakout + Retest',
  untertitel: 'Nicht den Ausbruch jagen — den Rücktest handeln',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Ausbrüche sind verführerisch: Der Markt explodiert aus einer Zone, und alles in dir will hinterherspringen. Genau da liegt das Problem — Ausbruchskerzen haben weite Stops, miese CRVs und eine hohe Fakeout-Quote. Die Lösung ist der <strong>Retest</strong>:</p>
<ol>
<li><strong>Level identifizieren:</strong> ein Widerstand, der mehrfach gehalten hat — je länger und öfter, desto besser („je länger die Basis, desto stärker der Ausbruch").</li>
<li><strong>Ausbruch abwarten:</strong> idealerweise mit deutlich erhöhtem Volumen (Level 3!) und einem Kerzen-<em>Schluss</em> über dem Level — nicht nur einem Docht.</li>
<li><strong>Den Retest handeln:</strong> Sehr oft kehrt der Preis zum gebrochenen Level zurück. Altes Prinzip: <em>gebrochener Widerstand wird Unterstützung</em> („Support-Resistance-Flip"). DORT ist der Entry — mit engem Stop unter dem Level.</li>
<li><strong>Take-Profit:</strong> gemessene Bewegung (Range-Höhe auf den Ausbruch projiziert) oder das nächste markante HTF-Level.</li>
</ol>`,
    },
    {
      typ: 'chart',
      titel: 'Beispiel: BTC 4h, Jan–Feb 2024 — Ausbruch über die 48.500er-Zone',
      symbol: 'BTCUSDT',
      interval: '4h',
      von: 1706486400, // 2024-01-29
      bis: 1708387200, // 2024-02-20
      annotationen: [{ typ: 'preislinie', preis: 48500, text: 'Widerstand → nach Ausbruch Unterstützung' }],
      beschreibung:
        'Die 48.500er-Zone (ETF-Hoch vom Januar) deckelte den Markt. Am 12. Februar bricht BTC mit Momentum darüber — und setzt am 13. Februar exakt auf die Zone zurück (Retest, Low ~48.300), bevor die Rally Richtung 52.800 weiterläuft. Der Retest bot den Entry mit engem Stop, den die Ausbruchskerze selbst nie hergegeben hätte.',
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Zwei Ausbruchs-Wahrheiten: <strong>1. Ohne Volumen kein Vertrauen</strong> — leise Ausbrüche sind Fakeout-Kandidaten. <strong>2. Der Retest kommt oft, aber nicht immer.</strong> Läuft der Markt ohne Rücktest davon, hast du nichts verloren — es war dann einfach nicht dein Trade. FOMO ist hier der Endgegner.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Warum ist der Retest-Entry dem direkten Kauf der Ausbruchskerze meist überlegen?',
          antworten: [
            'Weil er garantiert funktioniert',
            'Engerer Stop am Level, besseres CRV, und der Fakeout ist bis dahin oft schon entlarvt',
            'Weil man beim Retest keine Gebühren zahlt',
            'Ist er nicht — schneller kaufen ist immer besser',
          ],
          richtigIndex: 1,
          erklaerung:
            'Am Retest liegt der Entry direkt über dem Level → enger Stop, großes CRV. Und wer den Rücktest abwartet, kauft nicht in die erste Euphorie eines möglichen Fakeouts.',
        },
        {
          frage: 'Was macht einen Ausbruch glaubwürdig?',
          antworten: [
            'Eine große grüne Kerze, egal wie',
            'Deutlich erhöhtes Volumen und ein Kerzen-SCHLUSS über dem Level',
            'Ein Tweet eines Influencers',
            'Dass er am Wochenende passiert',
          ],
          richtigIndex: 1,
          erklaerung:
            'Volumen zeigt echte Beteiligung, der Schlusskurs über dem Level zeigt, dass die Käufer das Niveau halten konnten — ein Docht darüber ist dagegen oft nur ein abgelehnter Versuch.',
        },
        {
          frage: 'Was bedeutet „Support-Resistance-Flip"?',
          antworten: [
            'Unterstützung und Widerstand tauschen täglich die Plätze',
            'Ein gebrochener Widerstand wird beim Rücktest häufig zur Unterstützung (und umgekehrt)',
            'Ein Chartmuster aus drei Kerzen',
            'Das Umdrehen des Charts zur Analyse',
          ],
          richtigIndex: 1,
          erklaerung:
            'Wer am alten Widerstand verkauft hat, kauft dort zurück; wer den Ausbruch verpasst hat, kauft den Rücktest. Beides erzeugt Nachfrage genau am gebrochenen Level — die Logik hinter dem Retest-Entry.',
        },
        {
          frage: 'Der Markt bricht aus, läuft aber ohne Retest sofort davon. Was tust du?',
          antworten: [
            'Mit Market Order hinterherspringen — die Chance kommt nie wieder',
            'Nichts — kein Retest, kein Trade. Der Markt schuldet dir kein Setup',
            'Short gehen, um auf den Fakeout zu wetten',
            'Den Stop-Loss weglassen und klein einsteigen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Verpasste Trades kosten nichts, erzwungene Trades kosten Geld. Das Setup heißt Breakout + RETEST — fehlt der zweite Teil, fehlt der Trade. (Es gibt immer einen nächsten.)',
        },
      ],
    },
    { typ: 'uebung', szenarioId: 's-breakout-btc-okt23' },
  ],
}
