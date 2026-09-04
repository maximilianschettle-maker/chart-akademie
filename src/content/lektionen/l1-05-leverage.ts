import type { Lesson } from '../../types'

export const l1_05: Lesson = {
  id: 'l1-05',
  level: 1,
  titel: 'Leverage & Liquidation',
  untertitel: 'Wie Hebel funktioniert — und warum er die meisten Konten zerstört',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Beim Futures-Handel hinterlegst du eine Sicherheit (<strong>Margin</strong>) und bewegst damit ein Vielfaches — den <strong>Hebel</strong> (Leverage). Mit 100 $ Margin und 10x Hebel steuerst du eine Position von 1.000 $.</p>
<p>Der Hebel vergrößert <em>beides</em>: Bewegt sich der Kurs 1 % in deine Richtung, machst du 10 % Gewinn auf deine Margin. Bewegt er sich 1 % dagegen, verlierst du 10 %.</p>
<p>Und daraus folgt die <strong>Liquidation</strong>: Läuft der Kurs so weit gegen dich, dass deine Margin (fast) aufgebraucht ist, schließt die Börse deine Position zwangsweise. Deine Margin ist weg. Als grobe Faustregel liegt der Liquidationspreis bei etwa <code>Entry × (1 − 1/Hebel)</code> für Longs — bei 10x also rund 10 % unter dem Entry, bei 100x nur noch etwa 1 % darunter.</p>`,
    },
    {
      typ: 'demo',
      demoId: 'leverage-rechner',
    },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Bitcoin schwankt an ganz normalen Tagen 2–5 %. Mit 50x oder 100x Hebel wird also schon das alltägliche Marktrauschen zur Liquidation — <strong>unabhängig davon, ob deine Marktmeinung am Ende richtig gewesen wäre</strong>. Genau deshalb werden hohe Hebel von Börsen so offensiv beworben: Liquidierte Konten sind ihr Geschäftsmodell, nicht deins.`,
    },
    {
      typ: 'text',
      html: `<p>Wozu gibt es Hebel dann überhaupt? Profis nutzen ihn für <strong>Kapitaleffizienz</strong>, nicht für höheres Risiko: Statt 10.000 $ auf der Börse zu lagern, hinterlegen sie 1.000 $ mit 10x — <em>und riskieren trotzdem nur ihren geplanten Bruchteil des Gesamtkapitals pro Trade</em>. Das Risiko steuert man über die Positionsgröße und den Stop-Loss, nie über den Hebel-Regler.</p>
<p>Wenn Positionen liquidiert werden, passiert übrigens etwas Interessantes im Markt: Zwangsschließungen sind Market Orders, die den Preis zusätzlich in die gleiche Richtung drücken — so entstehen Liquidations-Kaskaden und die berüchtigten „Wicks", die genau bis zu den Zonen laufen, wo viele Liquidationspreise liegen. Das ist die Grundlage der <em>Liquidity Map</em>, die wir in Level 3 berechnen und visualisieren.</p>`,
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Die Regel, die dieser Kurs konsequent verfolgt: <strong>Hebel maximal 3–5x, Risiko pro Trade fest über Positionsgröße und Stop-Loss definiert (Level 2), niemals über den Hebel.</strong> Wer mit 100x handelt, tradet nicht — er würfelt mit Gebühren.`,
    },
    {
      typ: 'begriffe',
      eintraege: [
        { begriff: 'Margin', erklaerung: 'Hinterlegte Sicherheit für eine gehebelte Position.' },
        { begriff: 'Leverage (Hebel)', erklaerung: 'Vielfaches der Margin, das du als Positionsgröße bewegst.' },
        { begriff: 'Liquidation', erklaerung: 'Zwangsschließung deiner Position durch die Börse, wenn die Margin aufgebraucht ist.' },
        { begriff: 'Liquidations-Kaskade', erklaerung: 'Kettenreaktion: Liquidationen drücken den Preis, was weitere Liquidationen auslöst.' },
        { begriff: 'Kapitaleffizienz', erklaerung: 'Der legitime Nutzen von Hebel: weniger Kapital auf der Börse binden — bei gleichem, fest definiertem Risiko.' },
      ],
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Du eröffnest einen Long mit 20x Hebel. Ungefähr bei welcher Gegenbewegung wird liquidiert?',
          antworten: [
            'Bei etwa −20 %',
            'Bei etwa −5 %',
            'Bei etwa −1 %',
            'Gar nicht — Liquidation gibt es nur bei Shorts',
          ],
          richtigIndex: 1,
          erklaerung:
            'Faustregel: 1/Hebel = 1/20 = 5 %. Schon eine ganz normale Tagesschwankung von Bitcoin kann eine 20x-Position auslöschen.',
        },
        {
          frage: 'Was passiert bei einer Liquidation mit deiner Margin?',
          antworten: [
            'Sie wird eingefroren und nach 24 Stunden zurückgebucht',
            'Sie ist verloren — die Börse schließt die Position zwangsweise',
            'Sie halbiert sich',
            'Nichts, nur die Position wird pausiert',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Liquidation ist die Zwangsschließung, wenn die Margin aufgebraucht ist. Das hinterlegte Kapital der Position ist damit weg.',
        },
        {
          frage: 'Wie nutzen professionelle Trader Hebel richtig?',
          antworten: [
            'Maximaler Hebel bei maximaler Überzeugung',
            'Für Kapitaleffizienz — das Risiko steuern sie über Positionsgröße und Stop-Loss',
            'Nur bei Shorts, nie bei Longs',
            'Profis nutzen niemals Hebel',
          ],
          richtigIndex: 1,
          erklaerung:
            'Hebel bindet weniger Kapital auf der Börse — das ist sein legitimer Zweck. Das Risiko pro Trade wird davon unabhängig über Größe und Stop definiert. Der Hebel-Regler ist kein „Gewinn-Regler".',
        },
        {
          frage: 'Warum laufen Preisbewegungen auffällig oft genau in Zonen mit vielen Liquidationspreisen?',
          antworten: [
            'Zufall — Liquidationen haben keinen Markteinfluss',
            'Liquidationen sind Zwangs-Market-Orders, die den Preis weiter in dieselbe Richtung drücken und Kaskaden auslösen können',
            'Die Börsen verschieben den Chart nachträglich',
            'Weil dort der Spread am größten ist',
          ],
          richtigIndex: 1,
          erklaerung:
            'Jede Liquidation verkauft (bzw. kauft) zwangsweise in den Markt und verstärkt die Bewegung — bis die Zone „abgeräumt" ist. Liquidity Maps versuchen, diese Zonen im Voraus zu schätzen (Level 3).',
        },
      ],
    },
  ],
}
