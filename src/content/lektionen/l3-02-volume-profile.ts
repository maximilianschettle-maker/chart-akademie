import type { Lesson } from '../../types'

export const l3_02: Lesson = {
  id: 'l3-02',
  level: 3,
  titel: 'Volume Profile',
  untertitel: 'POC, Value Area — wo der Markt wirklich Geschäfte macht',
  dauerMin: 9,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Das normale Volumen-Histogramm zeigt Volumen <em>pro Zeit</em>. Das <strong>Volume Profile</strong> dreht die Achse: Es zeigt Volumen <em>pro Preisniveau</em> — also auf welchen Kursen tatsächlich die Geschäfte stattfanden.</p>
<ul>
<li><strong>POC (Point of Control):</strong> das Preisniveau mit dem höchsten Volumen. Der „faire Preis", auf den sich der Markt am längsten geeinigt hat.</li>
<li><strong>Value Area (VA):</strong> der Bereich um den POC mit ~70 % des Gesamtvolumens. Innerhalb der VA herrscht Konsens, außerhalb „Übertreibung".</li>
<li><strong>HVN / LVN</strong> (High/Low Volume Nodes): volumenreiche Zonen bremsen den Preis (viel Interesse = viel Gegenwehr), volumenarme Zonen werden schnell durchflogen (niemand hat dort Positionen zu verteidigen).</li>
</ul>`,
    },
    { typ: 'demo', demoId: 'volume-profile' },
    {
      typ: 'text',
      html: `<p>Praktische Anwendung:</p>
<ul>
<li><strong>POC als Magnet:</strong> Entfernt sich der Preis ohne neues Volumen vom POC, kehrt er oft dorthin zurück („Rotation" in der Range).</li>
<li><strong>VA-Kanten als Levels:</strong> VA High/Low verhalten sich wie Unterstützung/Widerstand — Abpraller dort sind klassische Range-Trades.</li>
<li><strong>LVN als Beschleuniger:</strong> Bricht der Preis in eine volumenarme Zone aus, rechne mit schneller Bewegung bis zum nächsten HVN.</li>
</ul>`,
    },
    {
      typ: 'callout',
      variante: 'tipp',
      html: `Profile sind kontextabhängig: Ein Profil über eine saubere <strong>Range</strong> (wie in der Demo) ist aussagekräftig; ein Profil quer über völlig verschiedene Marktphasen ist Datenmatsch. Wähle den Bereich bewusst — z.B. die aktuelle Konsolidierung.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Was ist der POC?',
          antworten: [
            'Der höchste Preis der Periode',
            'Das Preisniveau, auf dem das meiste Volumen gehandelt wurde',
            'Der Durchschnittspreis der letzten 20 Kerzen',
            'Das Tagestief',
          ],
          richtigIndex: 1,
          erklaerung:
            'Point of Control = volumenstärkstes Preisniveau — dort hat sich der Markt am längsten auf einen „fairen Preis" geeinigt. Er wirkt später als Magnet und als Unterstützung/Widerstand.',
        },
        {
          frage: 'Der Preis bricht aus einer Range in eine Zone mit sehr WENIG historischem Volumen (LVN) aus. Was ist zu erwarten?',
          antworten: [
            'Sofortige Umkehr zurück in die Range',
            'Eine eher schnelle Bewegung durch die dünne Zone bis zum nächsten volumenstarken Bereich',
            'Der Preis bleibt in der dünnen Zone stehen',
            'LVNs kann man nicht handeln',
          ],
          richtigIndex: 1,
          erklaerung:
            'In volumenarmen Zonen gibt es wenig Positionen zu verteidigen und wenig Gegenwehr — der Preis „fliegt" hindurch, bis wieder Interesse (HVN) wartet.',
        },
        {
          frage: 'Wozu taugen die Kanten der Value Area (VA High / VA Low)?',
          antworten: [
            'Zu nichts — sie sind reine Statistik',
            'Als Levels für Abpraller-Setups, ähnlich wie Unterstützung/Widerstand',
            'Als garantierte Umkehrpunkte',
            'Nur als Take-Profit für Shorts',
          ],
          richtigIndex: 1,
          erklaerung:
            'An den VA-Kanten endet der Konsensbereich. Kehrt der Preis von außen in die VA zurück, läuft er oft zum POC — das VA-Kanten-Spiel ist ein klassisches Range-Setup. Garantien gibt es wie immer keine.',
        },
      ],
    },
  ],
}
