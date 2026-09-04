import type { Lesson } from '../../types'

export const l3_01: Lesson = {
  id: 'l3-01',
  level: 3,
  titel: 'Volumen richtig lesen',
  untertitel: 'Der Lügendetektor unter den Indikatoren',
  dauerMin: 8,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Das <strong>Volumen</strong> zeigt, wie viel in einem Zeitfenster tatsächlich gehandelt wurde. Es ist kein „Indikator" im üblichen Sinn — es ist Rohinformation über die <em>Beteiligung</em> am Markt. Preis sagt, WAS passiert; Volumen sagt, WER dahintersteht.</p>
<p>Die vier wichtigsten Lesarten:</p>
<ul>
<li><strong>Ausbruch mit hohem Volumen</strong> → glaubwürdig. Viele Marktteilnehmer tragen die Bewegung.</li>
<li><strong>Ausbruch mit niedrigem Volumen</strong> → verdächtig. Niemand ist wirklich dabei; hohe Fakeout-Gefahr.</li>
<li><strong>Volumen-Spike an Unterstützung/Widerstand</strong> → dort findet die eigentliche Schlacht statt. Ein Abpraller mit Riesenvolumen ist eine starke Bestätigung der Zone.</li>
<li><strong>Trend mit abnehmendem Volumen</strong> → das Interesse stirbt; der Trend wird anfällig.</li>
</ul>`,
    },
    {
      typ: 'chart',
      titel: 'Der Oktober-2023-Ausbruch mit Volumen (BTC 1h)',
      symbol: 'BTCUSDT',
      interval: '1h',
      von: 1697155200, // 2023-10-13
      bis: 1698364800, // 2023-10-27
      beschreibung:
        'Schau auf das Histogramm unten: In der Seitwärtsphase dümpelt das Volumen. Beim Ausbruch am 16.10. und erst recht am 23./24.10. explodiert es — DAS ist der Unterschied zwischen einem echten Ausbruch und einem Fakeout. Preisbewegung ohne Volumen ist ein Gerücht; mit Volumen ist sie eine Nachricht.',
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Volumen bestätigt, es prognostiziert nicht. Nutze es als <strong>Filter</strong>: Ein Setup (Ausbruch, Bounce, Breakout-Retest), das vom Volumen bestätigt wird, ist handelbar — dasselbe Setup bei toter Beteiligung lässt du aus.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Ein Widerstand wird mit auffällig NIEDRIGEM Volumen nach oben durchbrochen. Was ist die beste Interpretation?',
          antworten: [
            'Perfekter Einstieg — der Weg nach oben ist frei',
            'Verdächtig — ohne Beteiligung ist die Fakeout-Gefahr hoch',
            'Niedriges Volumen ist bei Ausbrüchen normal',
            'Das Volumen spielt bei Ausbrüchen keine Rolle',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ein echter Ausbruch braucht Beteiligung. Ohne Volumen fehlt die Kraft, das neue Niveau zu verteidigen — viele solcher Ausbrüche fallen zurück (Fakeout).',
        },
        {
          frage: 'Was bedeutet ein starker Abpraller an einer Unterstützung MIT Volumen-Spike?',
          antworten: [
            'Zufall — Volumen an Zonen ist bedeutungslos',
            'Die Zone wurde aktiv verteidigt — eine starke Bestätigung der Unterstützung',
            'Die Unterstützung wird beim nächsten Test sicher brechen',
            'Es war nur ein Bot-Fehler',
          ],
          richtigIndex: 1,
          erklaerung:
            'Hohes Volumen am Level heißt: Dort haben Käufer in großem Stil dagegengehalten. Solche verteidigten Zonen sind die Grundlage für Bounce-Setups.',
        },
        {
          frage: 'Ein Aufwärtstrend läuft weiter, aber das Volumen nimmt Woche für Woche ab. Was sagt dir das?',
          antworten: [
            'Der Trend wird stärker',
            'Nichts — Volumen und Trend sind unabhängig',
            'Das Interesse lässt nach — der Trend wird anfällig',
            'Es ist Zeit, mit Hebel nachzukaufen',
          ],
          richtigIndex: 2,
          erklaerung:
            'Trends leben von frischer Beteiligung. Trocknet das Volumen aus, trägt immer weniger echtes Geld die Bewegung — ein klassisches Ermüdungssignal (kein Umkehrsignal, aber ein Warnlicht).',
        },
      ],
    },
  ],
}
