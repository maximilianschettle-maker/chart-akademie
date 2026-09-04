import type { Lesson } from '../../types'

export const l2_04: Lesson = {
  id: 'l2-04',
  level: 2,
  titel: 'Trading-Psychologie',
  untertitel: 'FOMO, Revenge-Trading und das Journal als Gegenmittel',
  dauerMin: 9,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Die Mathematik aus den letzten Lektionen ist einfach. Schwer ist, sie unter Druck zu befolgen. Die vier teuersten Muster — du wirst jedes davon an dir selbst beobachten:</p>
<ul>
<li><strong>FOMO</strong> (Fear of Missing Out): Der Markt läuft ohne dich los, du springst zu spät und ohne Setup hinein — meist genau dort, wo die Bewegung endet.</li>
<li><strong>Revenge-Trading:</strong> Nach einem Verlust „muss" der nächste Trade das Geld sofort zurückholen: größer, schneller, ohne Plan. Aus −1R werden so −5R.</li>
<li><strong>Gewinner zu früh schließen, Verlierer laufen lassen:</strong> Die Angst, einen Buchgewinn zu verlieren, ist stärker als die Hoffnung auf mehr — bei Verlusten ist es genau umgekehrt. Das dreht jedes CRV ins Negative.</li>
<li><strong>Overtrading:</strong> Handeln aus Langeweile. Kein Setup = kein Trade ist eine vollwertige — oft die beste — Entscheidung.</li>
</ul>`,
    },
    {
      typ: 'text',
      html: `<p>Das wirksamste Gegenmittel ist unspektakulär: <strong>ein Regelwerk und ein Journal.</strong></p>
<p>Das Regelwerk legt vor der Session fest: Welche Setups handle ich? Wie viel Risiko pro Trade? Wann höre ich auf (z.B. nach 2 Verlusten am Tag)? Jede Entscheidung, die vorher getroffen wurde, kann in der Hitze des Moments nicht mehr sabotiert werden.</p>
<p>Das Journal beantwortet nach jedem Trade drei Fragen: <em>War der Trade regelkonform? Was war das R-Ergebnis? Was fühlte ich beim Entry?</em> Nach 50 Trades zeigt dir kein Guru, sondern deine eigene Statistik, welches Muster dich Geld kostet. Die Journal-Seite dieser App sammelt deine Simulator-Trades automatisch — nutze sie nach jeder Session.</p>`,
    },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Ein regelwidriger Trade, der Gewinn macht, ist <strong>kein guter Trade</strong> — er trainiert dir an, dass Regelbruch belohnt wird, und diese Lektion wird später teuer. Bewerte Trades nach Prozessqualität, nicht nach Ergebnis.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Nach zwei Verlusten in Folge willst du sofort mit doppelter Größe zurückschlagen. Wie heißt dieses Muster — und was ist die richtige Reaktion?',
          antworten: [
            'FOMO — einfach weitermachen',
            'Revenge-Trading — Pause machen, das Tageslimit greift',
            'Overtrading — Positionsgröße halbieren und weitertraden',
            'Das ist rationales Aufholen von Verlusten',
          ],
          richtigIndex: 1,
          erklaerung:
            'Revenge-Trading ist der klassische Konto-Killer: emotional, übergroß, ohne Setup. Genau dafür gibt es das vorab definierte Stopp-Limit (z.B. 2 Verluste = Schluss für heute).',
        },
        {
          frage: 'Dein Trade ist bei +0,5R, geplant war TP bei +2R. Du bekommst Angst und willst schließen. Was sagt die Prozess-Perspektive?',
          antworten: [
            'Schließen — Gewinn ist Gewinn',
            'Der Plan galt beim Entry und gilt weiter: TP/SL stehen lassen, sonst zerstörst du systematisch dein CRV',
            'Die Hälfte schließen und den SL löschen',
            'Den TP näher heranziehen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Wer geplante +2R-Gewinner routinemäßig bei +0,5R schließt, macht aus einem profitablen System ein Verlustsystem — die Verlierer bleiben ja bei −1R. Planänderungen im offenen Trade sind fast immer Emotion, nicht Analyse.',
        },
        {
          frage: 'Ein Trade hat alle deine Regeln gebrochen und trotzdem +3R Gewinn gebracht. Wie bewertest du ihn im Journal?',
          antworten: [
            'Als hervorragenden Trade — das Ergebnis zählt',
            'Als schlechten Trade: regelwidrig, das gute Ergebnis war Glück',
            'Gar nicht — Gewinne muss man nicht analysieren',
            'Als Beweis, dass die Regeln zu streng sind',
          ],
          richtigIndex: 1,
          erklaerung:
            'Prozess schlägt Ergebnis: Regelbruch + Gewinn = Glück, das dir beibringt, Regeln zu brechen. Auf lange Sicht gewinnt, wer den Prozess bewertet — deshalb steht „regelkonform?" als erste Frage im Journal.',
        },
        {
          frage: 'Was ist die beste Reaktion auf einen Tag ohne einziges valides Setup?',
          antworten: [
            'Trotzdem einen kleinen Trade machen, um im Rhythmus zu bleiben',
            'Auf einen kleineren Timeframe wechseln, bis sich ein Setup findet',
            'Nicht handeln — kein Setup ist eine vollwertige Entscheidung',
            'Das Risiko pro Trade erhöhen, um den Tag zu retten',
          ],
          richtigIndex: 2,
          erklaerung:
            'Overtrading entsteht aus dem Gefühl, „aktiv sein zu müssen". Timeframe-Hopping auf der Suche nach irgendeinem Setup ist dieselbe Falle in anderem Gewand. Flat zu sein ist eine Position.',
        },
      ],
    },
  ],
}
