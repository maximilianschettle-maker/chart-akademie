import type { Lesson } from '../../types'

export const l2_01: Lesson = {
  id: 'l2-01',
  level: 2,
  titel: 'Warum Risiko vor Entry kommt',
  untertitel: 'Erwartungswert und Drawdown-Mathematik — das eigentliche Spiel',
  dauerMin: 9,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Anfänger fragen: „Wo steige ich ein?" Profis fragen: „Was verliere ich, wenn ich falsch liege?" Dieser Unterschied entscheidet über Erfolg — nicht die Strategie.</p>
<p>Der Grund ist der <strong>Erwartungswert</strong> (EV). Für jedes Regelwerk gilt:</p>
<p><code>EV = Trefferquote × Ø-Gewinn − (1 − Trefferquote) × Ø-Verlust</code></p>
<p>Beispiel: 40 % Trefferquote klingt schlecht. Aber wenn Gewinner im Schnitt +2R bringen und Verlierer −1R kosten: <code>0,4 × 2R − 0,6 × 1R = +0,2R pro Trade</code>. Dieses System ist <em>profitabel</em> — obwohl es öfter verliert als gewinnt. Umgekehrt kann eine 70-%-Trefferquote ruinös sein, wenn seltene Verlierer −5R kosten.</p>`,
    },
    {
      typ: 'text',
      html: `<p>Der zweite Grund ist die <strong>Drawdown-Mathematik</strong> — sie ist gnadenlos asymmetrisch:</p>
<ul>
<li>−10 % Verlust → +11 % nötig, um zurückzukommen</li>
<li>−30 % Verlust → +43 % nötig</li>
<li>−50 % Verlust → <strong>+100 %</strong> nötig</li>
<li>−80 % Verlust → +400 % nötig</li>
</ul>
<p>Wer pro Trade 10 % seines Kontos riskiert, ist nach einer ganz normalen Serie von 5 Verlusten fast 41 % im Minus — und braucht ab da eine Glanzleistung, nur um auf null zu kommen. Wer 1 % riskiert, verliert in derselben Serie rund 5 % und handelt einfach weiter.</p>
<p><strong>Verlustserien sind keine Ausnahme, sondern Statistik:</strong> Bei 50 % Trefferquote ist in 100 Trades eine Serie von 6–7 Verlusten in Folge zu <em>erwarten</em>. Dein Risikomanagement muss so gebaut sein, dass dich diese Serie langweilt statt ruiniert.</p>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Die Reihenfolge im Kopf eines professionellen Traders: <strong>1. Wie viel riskiere ich? 2. Wo ist mein Exit, wenn ich falsch liege (SL)? 3. Wo ist mein Ziel (TP)? 4. Erst dann: Wo ist der Entry?</strong> Der Entry ist die am meisten überschätzte Entscheidung im Trading.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Ein System gewinnt nur 40 % der Trades, Gewinner bringen +2R, Verlierer kosten −1R. Ist es profitabel?',
          antworten: [
            'Nein — unter 50 % Trefferquote ist nichts profitabel',
            'Ja — der Erwartungswert ist +0,2R pro Trade',
            'Nur mit hohem Hebel',
            'Das lässt sich ohne die Gebühren nicht sagen',
          ],
          richtigIndex: 1,
          erklaerung:
            '0,4 × 2R − 0,6 × 1R = +0,2R. Trefferquote allein sagt nichts — entscheidend ist das Verhältnis von Gewinnern zu Verlierern. (Gebühren sind in sauber gemessenen R-Werten bereits enthalten.)',
        },
        {
          frage: 'Nach einem Verlust von 50 % — wie viel Gewinn brauchst du, um auf null zu kommen?',
          antworten: ['50 %', '75 %', '100 %', '150 %'],
          richtigIndex: 2,
          erklaerung:
            'Von 10.000 auf 5.000 sind −50 %. Von 5.000 zurück auf 10.000 sind +100 %. Genau wegen dieser Asymmetrie ist Kapitalschutz wichtiger als Gewinnmaximierung.',
        },
        {
          frage: 'Du hast 50 % Trefferquote. Wie solltest du eine Serie von 6 Verlusten in Folge einordnen?',
          antworten: [
            'Die Strategie ist kaputt — sofort wechseln',
            'Statistisch normal — bei 100 Trades ist so eine Serie zu erwarten',
            'Ein Zeichen, dass der Markt manipuliert ist',
            'Ein Signal, die Positionsgröße zu verdoppeln, um Verluste aufzuholen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Verlustserien gehören mathematisch dazu. Wer das weiß, dimensioniert sein Risiko so, dass die Serie ihn nicht ruiniert — und wirft nicht nach jeder Serie sein System um. Verluste „aufholen" durch größere Positionen ist der klassische Weg zum Totalverlust.',
        },
        {
          frage: 'Welche Frage stellt sich ein Profi ZUERST bei einem möglichen Trade?',
          antworten: [
            'Wie hoch kann der Gewinn werden?',
            'Wo genau ist der perfekte Entry?',
            'Was verliere ich, wenn ich falsch liege — und wo ist mein Exit?',
            'Was sagen andere Trader zu diesem Setup?',
          ],
          richtigIndex: 2,
          erklaerung:
            'Risiko zuerst: Betrag und Stop-Loss stehen fest, bevor der Entry überhaupt interessant wird. Der Entry ist nur eine von vier Entscheidungen — und die am meisten überschätzte.',
        },
      ],
    },
  ],
}
