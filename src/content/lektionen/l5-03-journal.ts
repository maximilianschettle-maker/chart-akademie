import type { Lesson } from '../../types'

export const l5_03: Lesson = {
  id: 'l5-03',
  level: 5,
  titel: 'Dein Journal & deine Statistik',
  untertitel: 'Die Zahlen, die dir sagen, ob du bereit bist',
  dauerMin: 8,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Die <strong>Journal-Seite</strong> dieser App sammelt jeden Simulator-Trade automatisch. Diese Kennzahlen musst du lesen können:</p>
<ul>
<li><strong>Trefferquote:</strong> Anteil der Gewinner. Allein wertlos — 40 % kann exzellent, 70 % ruinös sein (Level 2!).</li>
<li><strong>Ø R-Multiple:</strong> dein durchschnittliches Ergebnis pro riskierter Einheit. <em>Die</em> zentrale Zahl: dauerhaft positiv = dein System hat Substanz.</li>
<li><strong>Profit-Faktor:</strong> Summe der Gewinne ÷ Summe der Verluste. Über 1,5 ist solide, unter 1,0 heißt: Du zahlst drauf.</li>
<li><strong>Max. Drawdown:</strong> der tiefste Einbruch deiner Kapitalkurve. Er zeigt, was du emotional aushalten musst — und ob deine Positionsgrößen vernünftig sind.</li>
</ul>
<p>Wichtig: Aussagekraft entsteht erst mit <strong>Stichprobengröße</strong>. Unter 30–50 Trades ist jede dieser Zahlen Rauschen. Bewerte niemals dein System — oder dich — nach fünf Trades.</p>`,
    },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Ergänze die automatische Statistik handschriftlich (Notiz-App genügt) um die eine Frage, die die App nicht messen kann: <strong>„War der Trade regelkonform?"</strong> Zähle regelkonforme und regelwidrige Trades getrennt. Wenn deine regelwidrigen Trades profitabler sind als deine regelkonformen: Glückwunsch, du hast Rauschen gefunden — nicht ein besseres System.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Dein Journal zeigt: Trefferquote 42 %, Ø R +0,35. Wie ist dein System einzuschätzen?',
          antworten: [
            'Schlecht — unter 50 % Trefferquote ist es Zeit für eine neue Strategie',
            'Profitabel: Der positive Erwartungswert pro Trade ist das, was zählt',
            'Nicht bewertbar ohne den Hebel zu kennen',
            'Nur profitabel, wenn auch die Trefferquote steigt',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ø R +0,35 heißt: Pro Trade gewinnst du im Schnitt 0,35 riskierte Einheiten — bei genügend Trades ist das ein solide profitables System, trotz (bzw. wegen) der 42 %.',
        },
        {
          frage: 'Warum ist der Max. Drawdown mehr als eine historische Fußnote?',
          antworten: [
            'Er bestimmt die Steuerlast',
            'Er zeigt, welche Verlustphasen dein System (und deine Psyche) real durchstehen muss — und ob deine Positionsgrößen passen',
            'Er ist die wichtigste Zahl für die Börse',
            'Er sagt voraus, wann der nächste Verlust kommt',
          ],
          richtigIndex: 1,
          erklaerung:
            'Verlustserien kommen sicher (Level 2). Der Drawdown übersetzt das in eine konkrete Zahl: Wer bei −15 % Kapitalkurve panisch sein System umwirft, muss kleiner handeln — das verrät dir kein anderer Wert so direkt.',
        },
        {
          frage: 'Nach 8 Trades zeigt dein Journal Ø R −0,4. Deine Reaktion?',
          antworten: [
            'System sofort wechseln — es ist offensichtlich kaputt',
            'Weiter regelkonform handeln und erst ab ~30–50 Trades ernsthaft auswerten; parallel prüfen, ob die Verluste regelkonform waren',
            'Risiko pro Trade verdoppeln, um die Verluste aufzuholen',
            'Das Journal löschen und neu anfangen',
          ],
          richtigIndex: 1,
          erklaerung:
            '8 Trades sind statistisches Rauschen — jede Strategie hat solche Strecken. Entscheidend ist jetzt Prozess-Kontrolle (regelkonform?) und Geduld bis zur aussagekräftigen Stichprobe. Antwort C ist Revenge-Trading in Zahlen gegossen.',
        },
      ],
    },
  ],
}
