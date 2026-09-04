import type { Lesson } from '../../types'

export const l2_02: Lesson = {
  id: 'l2-02',
  level: 2,
  titel: 'Position Sizing & die 1-%-Regel',
  untertitel: 'Die Formel, die dein Konto überleben lässt',
  dauerMin: 8,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Die <strong>1-%-Regel</strong>: Riskiere pro Trade höchstens 1 % deines Kontos (Anfänger gern 0,5 %). „Riskieren" heißt: Das ist der Betrag, der weg ist, wenn dein Stop-Loss ausgelöst wird — <em>nicht</em> die Positionsgröße.</p>
<p>Daraus ergibt sich die wichtigste Formel dieses Kurses:</p>
<p><code>Positionsgröße = Risikobetrag ÷ Abstand zwischen Entry und Stop-Loss</code></p>
<p>Beispiel: Konto 10.000 $, Risiko 1 % = 100 $. Entry bei 60.000 $, Stop-Loss bei 58.800 $ → Abstand 1.200 $. Positionsgröße = 100 ÷ 1.200 = <strong>0,0833 BTC</strong> (= 5.000 $ Positionswert). Wird der SL getroffen, verlierst du exakt 100 $.</p>`,
    },
    {
      typ: 'text',
      html: `<p>Drei Konsequenzen, die viele überraschen:</p>
<ul>
<li><strong>Enger SL → größere Position, weiter SL → kleinere Position.</strong> Das Risiko bleibt konstant, die Größe passt sich an. Du „verpasst" mit weitem SL keinen Gewinn — du handelst nur kleiner.</li>
<li><strong>Der Hebel ist das Ergebnis, nicht die Eingabe.</strong> Erst Größe aus dem Risiko berechnen — welcher Hebel dafür nötig ist, ist eine reine Formalie (im Beispiel: 5.000 $ Position bei z.B. 1.000 $ Margin = 5x).</li>
<li><strong>Ohne festen SL ist keine Positionsgröße berechenbar.</strong> Wer „ohne Stop" handelt, hat per Definition unbegrenztes Risiko.</li>
</ul>`,
    },
    { typ: 'demo', demoId: 'positions-rechner' },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Das OrderTicket im Simulator dieser App rechnet genau so: Du gibst <strong>Risiko in %</strong> und den <strong>Stop-Loss</strong> ein, die Größe wird berechnet. Gewöhn dir diesen Ablauf hier im Simulator so lange an, bis er automatisch ist.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Konto 20.000 $, Risiko 1 %, Entry 50.000 $, SL 49.000 $. Wie groß ist die Position?',
          antworten: ['0,4 BTC', '0,2 BTC', '0,02 BTC', '2 BTC'],
          richtigIndex: 1,
          erklaerung:
            'Risikobetrag 200 $ ÷ SL-Abstand 1.000 $ = 0,2 BTC. Am SL verlierst du exakt 200 $ = 1 % des Kontos.',
        },
        {
          frage: 'Du willst denselben Trade mit einem doppelt so weiten Stop-Loss handeln. Was passiert mit der Positionsgröße bei gleichem Risiko?',
          antworten: [
            'Sie bleibt gleich',
            'Sie verdoppelt sich',
            'Sie halbiert sich',
            'Das Risiko verdoppelt sich automatisch',
          ],
          richtigIndex: 2,
          erklaerung:
            'Doppelter SL-Abstand bei gleichem Risikobetrag → halbe Größe. Genau so bleibt das Verlustrisiko konstant, egal wie der Trade aufgebaut ist.',
        },
        {
          frage: 'Welche Rolle spielt der Hebel beim professionellen Position Sizing?',
          antworten: [
            'Er bestimmt die Positionsgröße',
            'Er ist nur eine Formalie — die Größe folgt aus Risikobetrag und SL-Abstand',
            'Höherer Hebel bedeutet automatisch höheres Risiko pro Trade',
            'Ohne Hebel funktioniert die 1-%-Regel nicht',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Größe wird aus dem Risiko berechnet; der Hebel ergibt sich daraus, wie viel Margin du dafür hinterlegst. Wer die Größe über die 1-%-Formel steuert, hat sein Risiko fixiert — egal welcher Hebel dahintersteht.',
        },
        {
          frage: 'Warum ist Trading „ohne Stop-Loss" mit der 1-%-Regel unvereinbar?',
          antworten: [
            'Weil Börsen ohne SL höhere Gebühren verlangen',
            'Weil ohne definierten Exit-Punkt kein Risikobetrag und damit keine Positionsgröße berechenbar ist',
            'Es ist vereinbar, solange die Position klein ist',
            'Weil der SL den Entry verbessert',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Formel braucht den SL-Abstand als Nenner. Ohne SL ist das Risiko unbegrenzt und jede Größenberechnung Illusion — „klein" hilft nicht, wenn es keinen Punkt gibt, an dem du planmäßig aussteigst.',
        },
      ],
    },
  ],
}
