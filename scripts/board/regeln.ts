// Einordnung von Nachrichten in feste Kategorien und Markt-Tags über Schlüsselwortregeln (Deutsch + Englisch).
// Bewusst einfach und nachvollziehbar: Treffer = Wortstamm kommt in Titel oder Teaser vor. Ohne Kategorie
// fliegt eine Meldung raus – das Board soll nur Geopolitik/Makro zeigen, nicht den ganzen Feed.

import type { MarktTag, NewsKategorie } from '../../src/board/types.ts'

// Wortanfang ohne \b: JavaScripts \b kennt nur ASCII, „Öl“ und „Zölle“ würden sonst nie am Wortanfang treffen.
// Stämme dürfen weiterlaufen („Zollstreit“), außer wo ein Wortende erzwungen ist („gold“, nicht „goldene“).
const w = (stamm: string) => new RegExp(`(?<!\\p{L})(?:${stamm})`, 'iu')

const KATEGORIEN: { id: NewsKategorie; muster: RegExp; gewicht: number }[] = [
  {
    id: 'handel',
    gewicht: 3,
    muster: w('zoll|zölle|strafzöll|tariff|handelsstreit|handelskrieg|handelsabkommen|handelskonflikt|trade (?:war|deal|talks|agreement|dispute)|sanktion|sanction|embargo|exportkontroll|export (?:control|ban)|wto|lieferkett|supply chain|importverbot|boykott|strafmaßnahme|dumping'),
  },
  {
    id: 'konflikte',
    gewicht: 3,
    muster: w(
      'krieg|war(?!\\p{L})|warfare|angriff|attack|luftangriff|airstrike|air strike|rakete|missile|drohne|drone|waffenstillstand|ceasefire|cease-fire|truppen|troops|militär|military|offensive|invasion|eskalation|escalation|bombard|kriegsschiff|warship|huthi|houthi|hamas|hisbollah|hezbollah|frontlinie|frontline|gefecht|kämpfe|fighting|geisel|hostage|besatzung|occupation|mobilmachung|mobilisation|friedensgespräch|peace talks',
    ),
  },
  {
    id: 'energie',
    gewicht: 2,
    muster: w('ölpreis|oil price|rohöl|crude|brent|wti|opec|erdgas|gaspreis|lng|pipeline|raffinerie|refiner|energiepreis|energy price|strompreis|power price|kupfer|copper|lithium|uran|seltene erden|rare earth|weizen|wheat|rohstoff|commodit|barrel|tanker|ölembargo|gasspeicher|gas storage|ölförderung|oil output|oil production'),
  },
  {
    id: 'politik',
    gewicht: 1,
    muster: w(
      'wahl(?:en|kampf|sieg|ergebnis|niederlage)?(?!\\p{L})|election|neuwahl|koalition|coalition|regierungskrise|regierungsbildung|government (?:collapse|crisis|formation)|haushaltsstreit|haushaltspolitik|haushaltssperre|bundeshaushalt|budget (?:deal|fight|deadline|crisis)|shutdown|misstrauensvotum|misstrauensantrag|no-confidence|impeach|referendum|amtsenthebung|staatsstreich|coup|gipfel(?:treffen)?(?!\\p{L})|summit|schuldenbremse|debt ceiling|schuldenobergrenze',
    ),
  },
]

const MAERKTE: { id: MarktTag; muster: RegExp }[] = [
  { id: 'oel', muster: w('öl(?!\\p{L})|ölpreis|ölmarkt|ölförder|ölembargo|oil(?!\\p{L})|oil price|rohöl|crude|brent|wti|opec|tanker|raffinerie|refiner|barrel|hormus|hormuz') },
  { id: 'gas', muster: w('erdgas|gaspreis|gaspreise|lng|pipeline|gasspeicher|nord stream|natural gas|gas price') },
  { id: 'eurusd', muster: w('ezb|ecb|fed(?!\\p{L})|federal reserve|leitzins|zinsentscheid|zinserhöhung|zinssenkung|zinswende|rate hike|rate cut|interest rate|dollar|euro(?!\\p{L})|wechselkurs|exchange rate|inflation|notenbank|central bank') },
  { id: 'ruestung', muster: w('rüstung|rheinmetall|verteidigungsausgaben|verteidigungsetat|defen[cs]e spending|defen[cs]e budget|waffenlieferung|arms (?:deal|sales|export)|nato|aufrüstung|rearm|lockheed|hensoldt|military spending|bundeswehr|wehretat') },
  { id: 'halbleiter', muster: w('chip(?:s|industrie|hersteller|konzern|fabrik)?(?!\\p{L})|halbleiter|semiconductor|nvidia|tsmc|asml|infineon|exportkontroll|export control|ki-chip|ai chip|taiwan') },
  { id: 'gold', muster: w('gold(?!\\p{L})|goldpreis|gold price|safe haven|sicherer hafen|edelmetall|silber(?!\\p{L})|silver(?!\\p{L})') },
  { id: 'anleihen', muster: w('anleihe|staatsanleihe|rendite|bond(?:s|markt|market)?(?!\\p{L})|treasur|schuldenbremse|haushaltsstreit|haushaltspolitik|bundeshaushalt|defizit|deficit|rating|staatsschulden|debt ceiling|sovereign debt') },
  { id: 'aktien', muster: w('dax(?!\\p{L})|börse|stock market|wall street|s&p|nasdaq|aktienmarkt|aktienkurs|kurssturz|kursrutsch|rally|crash|quartalszahlen|earnings') },
]

/** Kategorie mit dem höchsten Gewicht (bei Gleichstand die zuerst definierte); null = keine Geopolitik-/Makromeldung */
export function kategorisiere(titel: string, text = ''): NewsKategorie | null {
  const basis = `${titel} ${text}`
  let beste: { id: NewsKategorie; gewicht: number } | null = null
  for (const k of KATEGORIEN) {
    if (!k.muster.test(basis)) continue
    // Titel-Treffer zählt doppelt
    const gewicht = k.gewicht + (k.muster.test(titel) ? 2 : 0)
    if (!beste || gewicht > beste.gewicht) beste = { id: k.id, gewicht }
  }
  return beste?.id ?? null
}

export function markttags(titel: string, text = ''): MarktTag[] {
  const basis = `${titel} ${text}`
  return MAERKTE.filter((m) => m.muster.test(basis)).map((m) => m.id)
}

/** Grober Sprach-Tipp aus den häufigsten Funktionswörtern */
export function sprache(titel: string, text = ''): 'de' | 'en' {
  const s = ` ${titel} ${text} `.toLowerCase()
  const de = (s.match(/ (der|die|das|und|nicht|mit|für|ist|auf|ein|eine|wird|nach|über) /g) ?? []).length
  const en = (s.match(/ (the|and|of|to|in|is|for|with|on|that|as|by) /g) ?? []).length
  return en > de ? 'en' : 'de'
}

/** Stabile Kennung aus dem Link (ohne Tracking-Parameter) */
export function eintragId(link: string): string {
  try {
    const u = new URL(link)
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return link
  }
}
