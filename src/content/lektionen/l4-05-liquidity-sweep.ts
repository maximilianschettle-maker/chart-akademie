import type { Lesson } from '../../types'

export const l4_05: Lesson = {
  id: 'l4-05',
  level: 4,
  titel: 'Liquidity Sweep',
  untertitel: 'Wenn der „Ausbruch nach unten" in Wahrheit das Kaufsignal ist',
  dauerMin: 11,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Das anspruchsvollste Setup dieses Kurses — es setzt alles zusammen, was du in Level 3 über Liquidität gelernt hast. Die Ausgangslage: Unter jedem markanten Tief liegen <strong>Stops und Liquidationspreise</strong> — garantierte Verkaufsorders. Diese „Liquidität" zieht den Preis an.</p>
<p>Der <strong>Sweep</strong> (auch „Stop Hunt" oder „Liquidity Grab"): Der Preis sticht unter das markante Tief, löst die Zwangsverkäufe aus — und genau diese Verkäufe nutzen große Käufer, um sich zu füllen. Ist das Cluster leer, fehlt der Verkaufsdruck schlagartig: Der Preis erobert das Level zurück und dreht.</p>
<p>Das Setup Schritt für Schritt:</p>
<ol>
<li><strong>Markantes Tief identifizieren</strong> (Doppelboden, Range-Low, altes Swing-Tief) — je offensichtlicher, desto mehr Liquidität darunter.</li>
<li><strong>Den Bruch NICHT shorten.</strong> Der „Ausbruch nach unten" unter ein offensichtliches Tief ist statistisch oft ein Fakeout.</li>
<li><strong>Auf die Rückeroberung warten:</strong> Der Preis schließt wieder ÜBER dem gebrochenen Level — das ist der Trigger. (Kein Schluss darüber = echter Zusammenbruch, kein Trade.)</li>
<li><strong>Stop-Loss:</strong> unter das Sweep-Tief — der tiefste Punkt des Dochts ist die Widerlegung.</li>
<li><strong>Take-Profit:</strong> zurück in die alte Range / zum nächsten HTF-Level. Sweep-Reversals laufen oft weit.</li>
</ol>`,
    },
    {
      typ: 'chart',
      titel: 'Beispiel: BTC 1h, Juni 2023 — Sweep unter den Doppelboden',
      symbol: 'BTCUSDT',
      interval: '1h',
      von: 1686182400, // 2023-06-08
      bis: 1687219200, // 2023-06-20
      annotationen: [
        { typ: 'preislinie', preis: 25350, text: 'Doppel-Tief (offensichtliche Liquidität darunter)' },
      ],
      beschreibung:
        'Die Tiefs vom 5. und 10. Juni (~25.350 $) bildeten einen sichtbaren Doppelboden — darunter: die Stops aller Käufer. Am 14./15. Juni sticht der Preis bis 24.800 $ darunter (Sweep!), erobert das Level binnen weniger Stunden zurück und startet die Rally, die bis über 30.000 $ lief. Wer den „Bruch" geshortet hat, lieferte den Treibstoff.',
    },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Der Unterschied zwischen Sweep und echtem Zusammenbruch entscheidet alles: <strong>Der Sweep erobert das Level schnell zurück</strong> (Docht + Schluss darüber). Bleibt der Preis unter dem Level und akzeptiert es als neuen Widerstand, war es KEIN Sweep — dann ist die Struktur wirklich gebrochen. Deshalb: Der Trigger ist die Rückeroberung, niemals der Bruch selbst.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Warum liegt unter jedem offensichtlichen Tief „Liquidität"?',
          antworten: [
            'Weil die Börse dort Geld lagert',
            'Dort sammeln sich Stop-Loss-Orders und Liquidationspreise der Käufer — garantierte Verkaufsorders',
            'Weil runde Zahlen magisch sind',
            'Das ist ein Mythos',
          ],
          richtigIndex: 1,
          erklaerung:
            'Jeder, der über dem Tief long ist, hat seinen Stop (oder Liquidationspreis) darunter. Diese erzwungenen Orders sind planbare Liquidität — und ziehen den Preis erfahrungsgemäß an (Level 3).',
        },
        {
          frage: 'Was ist der Entry-Trigger beim Liquidity-Sweep-Setup?',
          antworten: [
            'Der Bruch des Tiefs — sofort short',
            'Der Bruch des Tiefs — sofort long',
            'Die RÜCKEROBERUNG: Der Preis schließt nach dem Sweep wieder über dem gebrochenen Level',
            'Ein RSI unter 30',
          ],
          richtigIndex: 2,
          erklaerung:
            'Der Bruch allein kann beides sein — Sweep oder echter Zusammenbruch. Erst die schnelle Rückeroberung (Schluss über dem Level) zeigt, dass die Verkäufe erzwungen waren und absorbiert wurden.',
        },
        {
          frage: 'Der Preis bricht unter den Doppelboden und bleibt zwei Tage darunter, das alte Tief wirkt jetzt als Widerstand. Was war das?',
          antworten: [
            'Ein Sweep — jetzt erst recht long gehen',
            'Ein echter Strukturbruch — das Level hat die Seite gewechselt, kein Long-Setup',
            'Ein Datenfehler',
            'Ein Doji',
          ],
          richtigIndex: 1,
          erklaerung:
            'Akzeptanz unter dem Level = die Käufer wurden wirklich geschlagen. Der Sweep lebt von der SCHNELLEN Rückeroberung — bleibt sie aus, gilt die normale Strukturlogik aus Level 1: gebrochene Unterstützung wird Widerstand.',
        },
        {
          frage: 'Wohin gehört der Stop-Loss nach einem Sweep-Entry?',
          antworten: [
            'Unter das alte Doppelboden-Level',
            'Unter das Sweep-Tief (den tiefsten Punkt des Dochts)',
            'Auf den Einstandspreis',
            'Ein Sweep-Trade braucht keinen Stop',
          ],
          richtigIndex: 1,
          erklaerung:
            'Das Sweep-Tief ist der Punkt, an dem die Absorptions-These stirbt: Fällt der Preis erneut darunter, war die Rückeroberung ein Fehlsignal. Das alte Level dagegen wird beim Sweep ja planmäßig durchstochen — dort wärst du genau im Docht ausgestoppt.',
        },
      ],
    },
    { typ: 'uebung', szenarioId: 's-sweep-btc-mai24' },
  ],
}
