import type { Lesson } from '../../types'

export const l1_01: Lesson = {
  id: 'l1-01',
  level: 1,
  titel: 'Was ist Trading?',
  untertitel: 'Spot vs. Futures, Long & Short — und was „erfolgreich" wirklich heißt',
  dauerMin: 8,
  bloecke: [
    {
      typ: 'text',
      html: `<p>Trading heißt: Du kaufst und verkaufst einen Vermögenswert (hier: Kryptowährungen wie Bitcoin), um von <strong>Preisbewegungen</strong> zu profitieren — nicht, um ihn jahrelang zu halten. Der Unterschied zum Investieren liegt im Zeithorizont und in der Methode: Ein Trader trifft viele Entscheidungen auf Basis von Charts, Daten und festen Regeln.</p>
<p>Bevor wir irgendeine Strategie anschauen, musst du drei Grundbegriffe sicher beherrschen: <strong>Spot vs. Futures</strong>, <strong>Long vs. Short</strong> und den Gedanken des <strong>Erwartungswerts</strong>.</p>`,
    },
    {
      typ: 'text',
      html: `<p><strong>Spot-Handel:</strong> Du kaufst den echten Coin. Kaufst du 0,1 BTC, gehören dir 0,1 BTC. Steigt der Preis, bist du im Plus; fällt er, im Minus. Mehr als dein Einsatz kann nicht verloren gehen.</p>
<p><strong>Futures-Handel (Perpetuals):</strong> Du handelst einen <em>Vertrag</em> auf den Preis, nicht den Coin selbst. Das ermöglicht zwei Dinge, die es im Spot nicht gibt:</p>
<ul>
<li>Du kannst auf <strong>fallende Kurse</strong> setzen (Short).</li>
<li>Du kannst mit <strong>Hebel</strong> (Leverage) mehr Kapital bewegen, als du besitzt — dazu ausführlich in Lektion 5. Vorsicht: Der Hebel ist der Hauptgrund, warum Anfänger ihr Konto verlieren.</li>
</ul>`,
    },
    {
      typ: 'text',
      html: `<p><strong>Long</strong> bedeutet: Du setzt auf steigende Kurse. Kaufen → später teurer verkaufen.</p>
<p><strong>Short</strong> bedeutet: Du setzt auf fallende Kurse. Du verkaufst zuerst (geliehen bzw. per Kontrakt) und kaufst später billiger zurück. Beispiel: Short bei 60.000 $, Rückkauf bei 57.000 $ → 3.000 $ Gewinn pro BTC. Steigt der Kurs stattdessen, machst du Verlust.</p>
<p>Merke: Ein Markt bietet in <em>beide</em> Richtungen Chancen — ein guter Trader ist nicht „Bulle" oder „Bär", sondern folgt dem, was der Chart zeigt.</p>`,
    },
    {
      typ: 'chart',
      titel: 'Bitcoin 2023 (Tageskerzen)',
      symbol: 'BTCUSDT',
      interval: '1d',
      von: 1672531200, // 2023-01-01
      bis: 1703980800, // 2023-12-31
      beschreibung:
        'Ein echtes Jahr Bitcoin: lange Aufwärtsphasen, scharfe Korrekturen, monatelange Seitwärtsphasen. In jeder dieser Phasen gab es Long- UND Short-Gelegenheiten. Zoome und scrolle ruhig im Chart herum — das geht in jeder Chart-Ansicht dieser App.',
    },
    {
      typ: 'callout',
      variante: 'merke',
      html: `Erfolgreiches Trading heißt <strong>nicht</strong>, jeden Trade zu gewinnen. Es heißt, ein Regelwerk zu haben, das über viele Trades hinweg mehr gewinnt als verliert — einen positiven <em>Erwartungswert</em>. Selbst Profis liegen oft nur bei 40–50 % Trefferquote; sie gewinnen, weil ihre Gewinner größer sind als ihre Verlierer. Genau darum dreht sich Level 2.`,
    },
    {
      typ: 'callout',
      variante: 'warnung',
      html: `Realitätscheck: Die Mehrheit der privaten Trader verliert auf Dauer Geld — vor allem durch zu hohen Hebel, fehlendes Risikomanagement und emotionale Entscheidungen. Diese App bringt dir das Handwerk bei, aber sie ist keine Gewinngarantie und keine Finanzberatung. Übe zuerst ausgiebig im Simulator, bevor du echtes Geld auch nur in Erwägung ziehst.`,
    },
    {
      typ: 'begriffe',
      eintraege: [
        { begriff: 'Spot', erklaerung: 'Direkter Kauf/Verkauf des echten Assets.' },
        { begriff: 'Futures / Perpetual', erklaerung: 'Vertrag auf den Preis, ohne Ablaufdatum. Ermöglicht Short und Hebel.' },
        { begriff: 'Long', erklaerung: 'Position, die von steigenden Kursen profitiert.' },
        { begriff: 'Short', erklaerung: 'Position, die von fallenden Kursen profitiert.' },
        { begriff: 'Erwartungswert', erklaerung: 'Durchschnittliches Ergebnis pro Trade über viele Trades. Muss positiv sein, sonst verlierst du langfristig.' },
      ],
    },
    {
      typ: 'quiz',
      fragen: [
        {
          frage: 'Was ist der wichtigste Unterschied zwischen Spot- und Futures-Handel?',
          antworten: [
            'Spot ist nur für Bitcoin, Futures für alle Coins',
            'Bei Futures handelst du einen Vertrag auf den Preis — mit Short- und Hebel-Möglichkeit',
            'Futures sind immer sicherer als Spot',
            'Spot-Handel ist nur für Profis erlaubt',
          ],
          richtigIndex: 1,
          erklaerung:
            'Im Spot kaufst du den echten Coin. Futures sind Verträge auf den Preis — dadurch kannst du auch short gehen und mit Hebel handeln. Sicherer sind sie dadurch keineswegs.',
        },
        {
          frage: 'Du eröffnest einen Short bei 60.000 $ und schließt ihn bei 57.000 $. Was ist passiert?',
          antworten: [
            'Du hast Verlust gemacht, weil der Kurs gefallen ist',
            'Du hast Gewinn gemacht, weil der Kurs gefallen ist',
            'Nichts — Shorts funktionieren nur bei steigenden Kursen',
            'Das Ergebnis hängt vom Funding ab, nicht vom Kurs',
          ],
          richtigIndex: 1,
          erklaerung:
            'Ein Short profitiert von fallenden Kursen: verkauft bei 60.000 $, zurückgekauft bei 57.000 $ → 3.000 $ Gewinn pro BTC.',
        },
        {
          frage: 'Was bedeutet „erfolgreiches Trading" am ehesten?',
          antworten: [
            'Möglichst jeden Trade gewinnen',
            'Immer mit maximalem Hebel handeln, um Gewinne zu maximieren',
            'Ein Regelwerk mit positivem Erwartungswert diszipliniert umsetzen',
            'Nur dann handeln, wenn man sich zu 100 % sicher ist',
          ],
          richtigIndex: 2,
          erklaerung:
            'Einzelne Trades sind fast Zufall. Erfolg entsteht durch ein System, das über viele Trades mehr gewinnt als verliert — auch mit 45 % Trefferquote, wenn die Gewinner groß genug sind.',
        },
        {
          frage: 'Welche Aussage über Long und Short ist richtig?',
          antworten: [
            'Short ist unseriös und sollte vermieden werden',
            'Long profitiert von steigenden, Short von fallenden Kursen — beides sind normale Werkzeuge',
            'Long ist für Anfänger, Short für Profis',
            'Man kann Long und Short nur im Spot-Handel nutzen',
          ],
          richtigIndex: 1,
          erklaerung:
            'Beide Richtungen sind gleichwertige Werkzeuge. Ein Trader folgt dem Markt — nicht der eigenen Meinung, ob steigen „besser" wäre. Short geht allerdings nur über Futures/Derivate.',
        },
      ],
    },
  ],
}
