import type { Lesson } from '../../types'

export const l3_04: Lesson = {
  id: 'l3-04',
  level: 3,
  titel: 'Liquidation & Liquidity Map',
  untertitel: 'Warum der Preis dorthin läuft, wo es am meisten wehtut',
  dauerMin: 11,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Aus Level 1 weißt du: Wird die Margin einer gehebelten Position aufgebraucht, schließt die Börse sie zwangsweise — die <strong>Liquidation</strong>. Jetzt kommt der entscheidende Gedanke: Liquidationen sind <em>vorhersagbar verortbar</em>.</p>
<p>Warum? Trader eröffnen Positionen bevorzugt an markanten Punkten — an Swing-Tiefs kaufen, an Swing-Hochs shorten. Und die gängigen Hebel (10x, 25x, 50x, 100x) sind bekannt. Damit lässt sich ausrechnen, WO die Liquidationspreise dieser Positionen liegen müssen:</p>
<ul>
<li>Longs vom Swing-Tief L → Liquidation bei etwa <code>L × (1 − 1/Hebel)</code> — <em>unter</em> dem Markt.</li>
<li>Shorts vom Swing-Hoch H → Liquidation bei etwa <code>H × (1 + 1/Hebel)</code> — <em>über</em> dem Markt.</li>
</ul>
<p>Eine <strong>Liquidity Map</strong> trägt diese geschätzten Liquidationspreise als Histogramm um den aktuellen Kurs ab. Dichte Cluster = viel erzwungenes Ordervolumen, das dort „schlummert".</p>`,
    },
    { typ: 'demo', demoId: 'liq-map' },
    {
      typ: 'text',
      html: `<p>Warum wirken diese Cluster wie Magnete? Zwei Mechanismen:</p>
<ul>
<li><strong>Kaskaden:</strong> Erreicht der Preis ein Cluster, feuern Zwangsorders in dieselbe Richtung — die Bewegung beschleunigt bis ans Ende des Clusters und dreht dann oft, weil der Zwangsdruck weg ist. So entstehen die langen Dochte („Stop Hunts", „Liquidity Grabs").</li>
<li><strong>Anreiz:</strong> Große Marktteilnehmer wissen, dass hinter den Clustern garantierte Orders warten — Liquidität, gegen die sie ihre eigenen großen Positionen füllen können. Der Markt „holt sich" diese Liquidität auffällig oft, bevor die eigentliche Bewegung startet.</li>
</ul>
<p>Praktische Konsequenzen für dich: <strong>1.</strong> Lege deinen Stop-Loss nicht dorthin, wo offensichtlich alle ihn haben (direkt unter dem letzten markanten Tief) — sondern eine Etage tiefer, hinter dem Cluster. <strong>2.</strong> Ein Docht IN ein Cluster hinein mit sofortiger Rückeroberung ist kein Beinbruch, sondern häufig der Beginn der Gegenbewegung — das ist die Basis des Liquidity-Sweep-Setups in Level 4.</p>`,
    },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Transparenz: Echte historische Liquidations- und Positionsdaten sind <strong>nicht frei verfügbar</strong> (kommerzielle Anbieter wie Coinglass verkaufen sie). Die Karte oben ist eine <strong>Schätzung aus öffentlichen Kursdaten</strong> — nach demselben Verfahren, das auch die kommerziellen Tools verwenden. Für das Verständnis der Mechanik ist das völlig ausreichend; für centgenaue Cluster-Preise ist es keine Garantie.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Warum lassen sich Liquidations-Cluster überhaupt schätzen?',
          antworten: [
            'Weil Börsen alle Positionen veröffentlichen',
            'Weil Trader bevorzugt an Swing-Punkten einsteigen und die gängigen Hebel bekannt sind — daraus folgen die Liquidationspreise rechnerisch',
            'Weil Liquidationen immer bei runden Zahlen passieren',
            'Sie lassen sich nicht schätzen, nur live beobachten',
          ],
          richtigIndex: 1,
          erklaerung:
            'Einstiegszonen (Swing-Hochs/-Tiefs) + typische Hebel (10x–100x) → rechnerische Liquidationspreise. Genau diese Schätzung steckt in jeder Liquidity Map — auch in den kommerziellen.',
        },
        {
          frage: 'Der Preis sticht mit einem langen Docht unter ein markantes Tief (in ein Liquidations-Cluster), dreht sofort und schließt wieder darüber. Was ist das?',
          antworten: [
            'Ein klares Verkaufssignal — das Tief ist gebrochen',
            'Ein Liquidity Sweep: Das Cluster wurde abgeräumt, der Zwangsdruck ist raus — oft der Start der Gegenbewegung',
            'Ein Datenfehler der Börse',
            'Bedeutungslos',
          ],
          richtigIndex: 1,
          erklaerung:
            'Genau diese Signatur — Docht ins Cluster, sofortige Rückeroberung — ist der klassische Sweep. Die erzwungenen Verkäufe sind abgearbeitet, große Käufer haben sich dagegen füllen lassen.',
        },
        {
          frage: 'Was folgt daraus für die Platzierung deines Stop-Loss?',
          antworten: [
            'Immer exakt unter das letzte markante Tief — da gehört er hin',
            'Gar keinen Stop-Loss nutzen, um Stop Hunts zu vermeiden',
            'Hinter das Cluster (eine Etage tiefer als die offensichtliche Stelle), damit ein Sweep dich nicht mit rausspült',
            'Stop-Loss direkt auf den Entry',
          ],
          richtigIndex: 2,
          erklaerung:
            'Die offensichtliche Stelle IST das Cluster — genau dorthin läuft der Sweep. Hinter dem Cluster bist du vor dem Docht geschützt und trotzdem raus, wenn die Idee wirklich widerlegt ist. (Ohne SL zu handeln bleibt tabu.)',
        },
        {
          frage: 'Warum beschleunigt der Preis oft, sobald er ein dichtes Liquidations-Cluster erreicht?',
          antworten: [
            'Weil die Börse die Gebühren senkt',
            'Weil Liquidationen Zwangs-Market-Orders in Bewegungsrichtung auslösen — eine Kaskade',
            'Weil alle Trader gleichzeitig Pause machen',
            'Wegen des Fundings',
          ],
          richtigIndex: 1,
          erklaerung:
            'Jede ausgelöste Liquidation feuert eine Market Order in dieselbe Richtung und kann die nächste Liquidation triggern — bis das Cluster leer ist. Danach fehlt der Druck, und die Bewegung erschöpft sich oft abrupt.',
        },
      ],
    },
  ],
}
