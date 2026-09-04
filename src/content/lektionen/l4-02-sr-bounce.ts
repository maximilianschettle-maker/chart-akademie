import type { Lesson } from '../../types'

export const l4_02: Lesson = {
  id: 'l4-02',
  level: 4,
  titel: 'Support/Resistance-Bounce',
  untertitel: 'An bestätigten Zonen handeln — nicht an Linien',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Unterstützung und Widerstand sind keine exakten Linien, sondern <strong>Zonen</strong>, in denen der Markt wiederholt gedreht hat — dort liegen Erinnerung, offene Orders und Interesse. Das Bounce-Setup:</p>
<ol>
<li><strong>Zone identifizieren:</strong> mindestens zwei deutliche Abpraller in der Vergangenheit. Je öfter getestet und je heftiger die Reaktionen, desto relevanter.</li>
<li><strong>Annäherung abwarten:</strong> Der Preis fällt in die Zone. Jetzt NICHT blind kaufen („catching the knife"), sondern beobachten.</li>
<li><strong>Trigger:</strong> Ablehnung sichtbar — lange untere Dochte, Volumen-Spike, Rückeroberung der Zonen-Oberkante.</li>
<li><strong>Stop-Loss:</strong> unter der Zone (mit Puffer gegen Sweeps — Level 3!).</li>
<li><strong>Take-Profit:</strong> am nächsten Widerstand / der Range-Mitte, CRV ≥ 1,5 muss gegeben sein.</li>
</ol>`,
    },
    {
      typ: 'chart',
      titel: 'Beispiel: BTC Tages-Chart 2023 — die 25.000er-Zone',
      symbol: 'BTCUSDT',
      interval: '1d',
      von: 1675209600, // 2023-02-01
      bis: 1696118400, // 2023-10-01
      annotationen: [{ typ: 'preislinie', preis: 25200, text: 'Unterstützungszone ~25.000–25.400' }],
      beschreibung:
        'Auf dem Tages-Chart wurde die Zone um 25.000–25.400 $ im Juni UND im September 2023 getestet — beide Male mit langen unteren Dochten und anschließenden Rallys. HTF-Zonen wie diese sind die stärksten: Auf ihnen baust du das Setup, den präzisen Entry suchst du dann auf 1h (Top-Down!).',
    },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Jede Zone bricht irgendwann. Deshalb: <strong>Nie ohne Stop unter der Zone</strong>, und Vorsicht beim dritten, vierten, fünften Test in kurzer Folge — jeder Test verbraucht die Kauforders in der Zone. Ein Bounce-Setup wird SCHWÄCHER, je schneller hintereinander die Tests kommen.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Was macht eine Unterstützungszone handelbar?',
          antworten: [
            'Eine exakt gezeichnete Linie',
            'Mindestens zwei deutliche historische Abpraller mit sichtbaren Reaktionen',
            'Eine runde Zahl',
            'Ein YouTube-Video darüber',
          ],
          richtigIndex: 1,
          erklaerung:
            'Zonen bekommen ihre Kraft aus bestätigter Historie: Wo der Markt mehrfach nachweislich gedreht hat, liegen Orders und Aufmerksamkeit. Runde Zahlen können das verstärken, ersetzen es aber nicht.',
        },
        {
          frage: 'Der Preis fällt gerade schnell in deine Unterstützungszone. Was ist der professionelle Ablauf?',
          antworten: [
            'Sofort mit Market Order kaufen — billiger wird es nicht',
            'Auf Ablehnungs-Signale in der Zone warten (Dochte, Volumen, Rückeroberung) und erst dann einsteigen',
            'Die Zone nach unten verschieben',
            'Short gehen, weil der Preis fällt',
          ],
          richtigIndex: 1,
          erklaerung:
            '„Catching the knife" ist der klassische Bounce-Fehler. Die Zone ist die Bühne — gehandelt wird erst, wenn die Käufer dort sichtbar auftreten.',
        },
        {
          frage: 'Warum wird ein Level durch viele schnelle Tests hintereinander eher schwächer?',
          antworten: [
            'Wird es nicht — je mehr Tests, desto stärker, immer',
            'Jeder Test verbraucht die Kauforders in der Zone; irgendwann ist niemand mehr da, der verteidigt',
            'Weil die Börse das Level löscht',
            'Wegen der Gebühren',
          ],
          richtigIndex: 1,
          erklaerung:
            'Eine Zone ist so stark wie die Orders darin. Schnelle, wiederholte Tests fressen diese Liquidität auf — der dritte oder vierte Test in kurzer Folge bricht überdurchschnittlich oft durch.',
        },
      ],
    },
    { typ: 'uebung', szenarioId: 's-bounce-btc-juni23' },
  ],
}
