import type { Lesson } from '../../types'

export const l5_02: Lesson = {
  id: 'l5-02',
  level: 5,
  titel: 'Der freie Replay-Modus',
  untertitel: 'Training unter Echtbedingungen — ohne Netz und doppelten Boden',
  dauerMin: 8,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Im <strong>Simulator</strong> dieser App bekommst du einen zufälligen historischen Marktabschnitt — Symbol und Datum verdeckt, damit dein Gedächtnis nicht mitspielt. Kein Hinweis, welches Setup (oder ob überhaupt eines) auftaucht. Genau wie live.</p>
<p>So trainierst du dort mit System statt zu daddeln:</p>
<ol>
<li><strong>Erst analysieren, dann abspielen:</strong> Nutze die 500 Kontext-Kerzen. Regime? Wichtige Zonen? Markiere sie gedanklich, BEVOR du auf Play drückst.</li>
<li><strong>Regeln vorab festlegen:</strong> Welche Setups handelst du in dieser Session? Wie viel Risiko (empfohlen: 1 %)? Maximal 2–3 Trades pro Session.</li>
<li><strong>Kein Setup = kein Trade.</strong> Manche Abschnitte bieten schlicht nichts. Eine Session ohne Trade ist ein Erfolg, wenn es nichts zu holen gab.</li>
<li><strong>Nach der Session ins Journal:</strong> Waren die Trades regelkonform? Das R-Ergebnis ist zweitrangig.</li>
</ol>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Richtwert, bevor du auch nur über echtes Geld nachdenkst: <strong>mindestens 50 Simulator-Trades</strong> mit dokumentiert positiver R-Erwartung und stabiler Regeltreue. Die meisten stellen dabei fest, dass ihr Problem nicht die Strategie ist — sondern die Disziplin. Besser hier als mit echtem Geld.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Warum verdeckt der freie Replay-Modus Symbol und Datum?',
          antworten: [
            'Aus rechtlichen Gründen',
            'Damit du auf das reagierst, was der Chart zeigt — nicht auf deine Erinnerung an die Kursgeschichte',
            'Um die Ladezeit zu verkürzen',
            'Reine Design-Entscheidung',
          ],
          richtigIndex: 1,
          erklaerung:
            'Wer weiß, dass „gleich der Oktober 2023 kommt", handelt sein Gedächtnis statt den Chart. Verdeckte Daten erzwingen echte Analyse — das ist der Trainingswert.',
        },
        {
          frage: 'Du hast eine komplette Replay-Session ohne einen einzigen Trade beendet, weil kein Setup deiner Liste auftauchte. Bewertung?',
          antworten: [
            'Verschwendete Zeit',
            'Ein Erfolg: Du hast Overtrading widerstanden — kein Setup = kein Trade ist eine korrekte Entscheidung',
            'Ein Fehler — irgendein Trade geht immer',
            'Der Simulator war defekt',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Fähigkeit, NICHT zu handeln, trennt Trader von Zockern (Level 2, Overtrading). Der Simulator zählt zufällige Abschnitte — manche geben schlicht nichts her.',
        },
        {
          frage: 'Was solltest du tun, BEVOR du in einer neuen Session auf Play drückst?',
          antworten: [
            'Sofort einen Trade eröffnen, um dabei zu sein',
            'Die 500 Kontext-Kerzen analysieren: Regime bestimmen, Zonen markieren, Session-Regeln festlegen',
            'Die Geschwindigkeit auf 10x stellen',
            'Das Konto zurücksetzen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Der Kontext ist dein Briefing: Ohne Regime und Zonen hast du keinen Plan, und ohne Plan handelst du Impulse. Analyse vor Play — jede Session.',
        },
      ],
    },
  ],
}
