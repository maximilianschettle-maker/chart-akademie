import type { Lesson } from '../../types'

export const l3_06: Lesson = {
  id: 'l3-06',
  level: 3,
  titel: 'EMA & RSI',
  untertitel: 'Zwei Indikatoren reichen — wenn man sie richtig benutzt',
  dauerMin: 9,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Es gibt hunderte Indikatoren. Fast alle verrechnen dieselben Preisdaten nur anders — wer zehn Indikatoren stapelt, sieht zehnmal dieselbe Information und fühlt sich nur sicherer. Dieser Kurs beschränkt sich bewusst auf zwei:</p>
<p><strong>EMA (Exponential Moving Average):</strong> ein gleitender Durchschnitt, der jüngste Kerzen stärker gewichtet. Zwei Verwendungen:</p>
<ul>
<li><strong>Trendfilter:</strong> Preis über steigender EMA 50 = Aufwärtstrend-Regime, darunter = Abwärts. Simpel, aber wirksam gegen den größten Fehler überhaupt: gegen den Trend zu handeln.</li>
<li><strong>Dynamische Unterstützung:</strong> In starken Trends drehen Rücksetzer immer wieder an EMA 20/50 — die Basis des Trendfolge-Setups in Level 4.</li>
</ul>
<p><strong>RSI (Relative Strength Index):</strong> misst die Stärke der letzten ~14 Kerzen auf einer Skala von 0–100. Über 70 gilt als „überkauft", unter 30 als „überverkauft".</p>`,
    },
    { typ: 'demo', demoId: 'ema-rsi' },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Der klassische RSI-Anfängerfehler: „RSI über 70 → short!" Die Demo oben zeigt, warum das ruinös ist — in starken Trends bleibt der RSI <strong>wochenlang</strong> überkauft, während der Preis weiter steigt. RSI-Extreme funktionieren in <strong>Ranges</strong> (Abpraller an den Rändern), nicht gegen Trends. Indikator-Signale gelten nur im passenden Marktregime.`,
    },
    {
      typ: 'text',
      html: `<p>So setzt du beide zusammen ein — immer <em>nach</em> der Marktstruktur, nie statt ihr:</p>
<ol>
<li><strong>Struktur zuerst:</strong> Trend oder Range? (Level 1)</li>
<li><strong>Im Trend:</strong> EMA 20/50 als Pullback-Zonen in Trendrichtung; RSI ignorieren oder nur als Divergenz-Warnung nutzen.</li>
<li><strong>In der Range:</strong> RSI-Extreme an Range-Rändern als Bestätigung für Abpraller; EMAs ignorieren (sie laufen in Ranges nutzlos in der Mitte).</li>
</ol>`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Warum bringt es nichts, zehn Indikatoren gleichzeitig zu benutzen?',
          antworten: [
            'Weil Charts dann zu bunt werden',
            'Weil fast alle Indikatoren dieselben Preisdaten verrechnen — man sieht zehnmal dieselbe Information',
            'Weil Börsen maximal drei Indikatoren erlauben',
            'Stimmt nicht — mehr Indikatoren bedeuten mehr Sicherheit',
          ],
          richtigIndex: 1,
          erklaerung:
            'Indikatoren sind Transformationen des Preises. Zehn Ableitungen derselben Quelle liefern Scheinbestätigung, keine neue Information — echte Zusatzinfos liefern Volumen, OI, Funding und Struktur.',
        },
        {
          frage: 'Der RSI steht seit zwei Wochen über 70, der Markt ist in einem starken Aufwärtstrend. Was ist die richtige Schlussfolgerung?',
          antworten: [
            'Sofort short — überkauft ist überkauft',
            'Der Trend ist stark; „überkauft" ist hier kein Verkaufssignal',
            'Der RSI ist kaputt',
            'Der Trend endet in genau 14 Kerzen',
          ],
          richtigIndex: 1,
          erklaerung:
            'In starken Trends klebt der RSI an den Extremen — das ist Ausdruck der Trendstärke. Gegen einen intakten Trend zu handeln, weil ein Oszillator „zu hoch" steht, ist einer der teuersten Standardfehler.',
        },
        {
          frage: 'Wofür eignen sich EMA 20/50 im intakten Aufwärtstrend am besten?',
          antworten: [
            'Als exakte Umkehrpunkte für Shorts',
            'Als dynamische Unterstützungszonen für Pullback-Einstiege in Trendrichtung',
            'Als Take-Profit-Ziele',
            'EMAs funktionieren nur in Ranges',
          ],
          richtigIndex: 1,
          erklaerung:
            'Rücksetzer in starken Trends drehen auffällig oft an EMA 20/50 — dort suchen Trendfolger ihre Entries. In Ranges dagegen pendeln die EMAs nutzlos in der Mitte.',
        },
        {
          frage: 'Was kommt in der Analyse-Reihenfolge ZUERST?',
          antworten: [
            'RSI prüfen',
            'EMA-Kreuzungen suchen',
            'Marktstruktur bestimmen: Trend oder Range?',
            'Das Funding checken',
          ],
          richtigIndex: 2,
          erklaerung:
            'Das Marktregime entscheidet, welche Werkzeuge überhaupt gelten: Im Trend EMAs, in der Range RSI-Extreme. Indikatoren ohne Struktur-Kontext sind Rauschen.',
        },
      ],
    },
  ],
}
