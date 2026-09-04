import type { Lesson } from '../../types'

export const l2_03: Lesson = {
  id: 'l2-03',
  level: 2,
  titel: 'Stop-Loss, Take-Profit & R-Multiple',
  untertitel: 'Wohin mit dem Stop — und warum du in R denkst, nicht in Dollar',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Der <strong>Stop-Loss</strong> gehört nicht an eine „Schmerzgrenze", sondern an den Punkt, an dem <em>deine Trade-Idee objektiv widerlegt ist</em>. Kaufst du einen Bounce an einer Unterstützung, gehört der SL unter diese Unterstützung — fällt der Preis darunter, war die Idee falsch, und es gibt keinen Grund mehr, im Trade zu sein.</p>
<ul>
<li><strong>Zu enger SL:</strong> Du wirst vom normalen Marktrauschen ausgestoppt, obwohl die Idee richtig war.</li>
<li><strong>Zu weiter SL:</strong> Deine Position wird winzig (1-%-Formel!) und der Verlust unnötig groß, wenn die Idee ohnehin widerlegt ist.</li>
<li><strong>SL nachträglich weiter wegschieben:</strong> der Kardinalfehler. Damit hebelst du dein gesamtes Risikomanagement aus.</li>
</ul>`,
    },
    {
      typ: 'text',
      html: `<p>Das <strong>R-Multiple</strong> macht Trades vergleichbar: 1R = dein riskierter Betrag. Verlierst du am SL, ist das −1R. Gewinnst du das Doppelte deines Risikos, sind das +2R — egal ob dein Konto 1.000 $ oder 1.000.000 $ groß ist.</p>
<p>Daraus folgt das <strong>Chance-Risiko-Verhältnis (CRV)</strong> vor dem Entry: Abstand Entry→TP geteilt durch Abstand Entry→SL. Ein Setup mit CRV 2 darf öfter danebengehen als eines mit CRV 1 und ist trotzdem profitabel (siehe Lektion „Erwartungswert"). Faustregel dieses Kurses: <strong>kein Trade unter CRV 1,5</strong> — das OrderTicket im Simulator zeigt dir das CRV live an.</p>
<p>Der <strong>Take-Profit</strong> gehört an ein logisches Kursziel — das nächste markante Hoch/Tief, eine Widerstandszone —, nicht an eine Wunschzahl. Entry, SL und TP bilden zusammen den vollständigen Trade-Plan, der <em>vor</em> dem Entry feststeht.</p>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Wichtig fürs Üben im Simulator: Berühren SL und TP dieselbe Kerze, wertet der Simulator <strong>konservativ den SL als zuerst ausgelöst</strong>. Echte Ergebnisse wären teils besser — aber wer konservativ testet, erlebt live keine bösen Überraschungen.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Wohin gehört der Stop-Loss?',
          antworten: [
            'Immer 2 % unter den Entry',
            'An den Punkt, an dem die Trade-Idee objektiv widerlegt ist',
            'So eng wie möglich, um Verluste zu minimieren',
            'Dahin, wo der Verlust emotional noch aushaltbar ist',
          ],
          richtigIndex: 1,
          erklaerung:
            'Der SL markiert die Widerlegung der Idee (z.B. unter der Unterstützung, deren Bounce du handelst). Fixe Prozentwerte oder Gefühle haben mit der Marktlogik nichts zu tun.',
        },
        {
          frage: 'Du riskierst 150 $ und der Trade endet mit +450 $ Gewinn. Wie viel R ist das?',
          antworten: ['+450R', '+3R', '+1,5R', 'Das hängt von der Kontogröße ab'],
          richtigIndex: 1,
          erklaerung:
            '450 ÷ 150 = +3R. Genau darum sind R-Multiples so nützlich: Sie machen Trades über jede Kontogröße hinweg vergleichbar.',
        },
        {
          frage: 'Entry 60.000, SL 59.000, TP 62.500. Welches CRV hat das Setup — und genügt es der Kurs-Faustregel?',
          antworten: [
            'CRV 0,4 — nein',
            'CRV 1,0 — knapp nein',
            'CRV 2,5 — ja',
            'CRV 4,17 — ja',
          ],
          richtigIndex: 2,
          erklaerung:
            'Chance 2.500 ÷ Risiko 1.000 = CRV 2,5 — deutlich über der 1,5er-Schwelle. Solche Setups dürfen auch mal danebengehen und rechnen sich trotzdem.',
        },
        {
          frage: 'Der Kurs nähert sich deinem Stop-Loss. Was ist die richtige Reaktion?',
          antworten: [
            'SL etwas weiter wegschieben — vielleicht dreht es ja noch',
            'Position verdoppeln, um den Einstandspreis zu verbessern',
            'Nichts — der SL macht seinen Job und begrenzt den Verlust auf das geplante 1R',
            'SL löschen und manuell beobachten',
          ],
          richtigIndex: 2,
          erklaerung:
            'Der SL wurde gesetzt, als du klar denken konntest. Ihn zu verschieben oder zu löschen hebelt das gesamte Risikomanagement aus — der geplante −1R-Verlust ist Teil des Systems, kein Unfall.',
        },
      ],
    },
  ],
}
