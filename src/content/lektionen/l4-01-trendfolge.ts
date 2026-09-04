import type { Lesson } from '../../types'

export const l4_01: Lesson = {
  id: 'l4-01',
  level: 4,
  titel: 'Trendfolge mit EMAs',
  untertitel: 'Das Brot-und-Butter-Setup: Pullbacks im intakten Trend kaufen',
  dauerMin: 10,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Trendfolge ist die verzeihendste aller Strategien: Du handelst <em>mit</em> dem Strom, und selbst ein mittelmäßiger Entry wird oft vom Trend gerettet. Das Setup:</p>
<ol>
<li><strong>Regime prüfen (HTF):</strong> Klarer Aufwärtstrend — Higher Highs/Lows, Preis über steigender EMA 50.</li>
<li><strong>Auf den Pullback warten:</strong> Kein Hinterherlaufen! Der Markt kommt zu dir — Rücksetzer in die EMA-20/50-Zone oder auf die letzte Ausbruchszone.</li>
<li><strong>Trigger:</strong> In der Zone zeigt sich Ablehnung nach unten (lange untere Dochte, bullische Engulfing) — jetzt Entry.</li>
<li><strong>Stop-Loss:</strong> unter das letzte Higher Low bzw. unter die Pullback-Zone.</li>
<li><strong>Take-Profit:</strong> mindestens am alten Hoch; bei starkem Trend darüber hinaus (Struktur-Extension).</li>
</ol>`,
    },
    {
      typ: 'chart',
      titel: 'Beispiel: BTC 4h, Okt–Dez 2023 — ein Trend, viele Pullback-Chancen',
      symbol: 'BTCUSDT',
      interval: '4h',
      von: 1697328000, // 2023-10-15
      bis: 1702166400, // 2023-12-10
      emaPerioden: [20, 50],
      beschreibung:
        'Nach dem Oktober-Ausbruch lief BTC wochenlang über den EMAs. Zähle die Rücksetzer an die gelbe EMA 20 und die blaue EMA 50: fast jeder war eine Einstiegsgelegenheit in Trendrichtung. Beachte auch, was NICHT funktioniert hätte: irgendwo oben im Anstieg zu kaufen (FOMO) statt am Pullback.',
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Der Kern in einem Satz: <strong>Im Trend ist der Rücksetzer dein Freund und das Hinterherlaufen dein Feind.</strong> Kein Pullback = kein Trade. Die Geduld, auf die Zone zu warten, IST die Strategie.`,
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Der Markt ist in einem starken Aufwärtstrend und läuft gerade steil nach oben davon. Was macht der Trendfolger?',
          antworten: [
            'Sofort market kaufen, bevor es weiter steigt',
            'Warten, bis der Preis in die EMA-Zone oder auf eine Struktur zurücksetzt',
            'Short gehen, weil es „zu schnell" gestiegen ist',
            'Den Timeframe wechseln, bis ein Signal erscheint',
          ],
          richtigIndex: 1,
          erklaerung:
            'Trendfolge kauft Schwäche im Aufwärtstrend, nicht Stärke im Überschwang. Wer dem Preis hinterherläuft, kauft dort, wo die Pullback-Käufer ihre Gewinne mitnehmen.',
        },
        {
          frage: 'Wohin gehört der Stop-Loss beim Pullback-Entry?',
          antworten: [
            'Direkt unter den Entry-Preis',
            'Unter das letzte Higher Low bzw. unter die Pullback-Zone',
            'Es braucht keinen — der Trend schützt dich',
            '10 % unter den Entry, immer',
          ],
          richtigIndex: 1,
          erklaerung:
            'Fällt der Preis unter das letzte Higher Low, ist die Trendstruktur gebrochen — die Trade-Idee ist widerlegt. Genau dort gehört der Stop hin (mit etwas Puffer für Sweeps, siehe Level 3).',
        },
        {
          frage: 'Was ist der Trigger für den Entry in der Pullback-Zone?',
          antworten: [
            'Das bloße Erreichen der EMA 20',
            'Sichtbare Ablehnung nach unten in der Zone (Dochte, bullische Engulfing)',
            'Ein RSI über 70',
            'Positives Funding',
          ],
          richtigIndex: 1,
          erklaerung:
            'Die Zone allein ist nur ein Ort. Erst die Reaktion DORT (Käufer verteidigen sichtbar) macht daraus einen Entry — sonst kaufst du in ein durchfallendes Messer innerhalb des Pullbacks.',
        },
      ],
    },
    { typ: 'uebung', szenarioId: 's-trend-btc-feb24' },
  ],
}
