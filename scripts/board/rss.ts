// Kleiner RSS-2.0-Parser ohne Abhängigkeiten: title, link, Zeit (pubDate oder dc:date), description.
// Reicht für die kuratierten Feeds (Tagesschau, DW, Spiegel, FAZ, Handelsblatt, BBC, NYT, EIA).

export interface RohEintrag {
  titel: string
  link: string
  /** ISO (UTC) oder null, wenn kein Datum lesbar war */
  zeit: string | null
  text: string
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', szlig: 'ß', euro: '€',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚',
}
const ENTITIES_GROSS: Record<string, string> = { Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü' }

export function entitiesDekodieren(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
    return ENTITIES_GROSS[code] ?? ENTITIES[code.toLowerCase()] ?? ganz
  })
}

/** Inhalt eines Elements (erstes Vorkommen), CDATA ausgepackt, Tags entfernt, Entities dekodiert */
function feld(xml: string, name: string): string {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
  if (!m) return ''
  let inhalt = m[1].trim()
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inhalt)
  if (cdata) inhalt = cdata[1]
  return entitiesDekodieren(inhalt.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function zeitAus(item: string): string | null {
  for (const name of ['dc:date', 'pubDate', 'published', 'updated']) {
    const roh = feld(item, name)
    if (!roh) continue
    // EIA schreibt „EST“ mit doppeltem Leerzeichen; Date.parse kommt damit klar, „GMT“ und Offsets auch
    const ms = Date.parse(roh.replace(/\s+/g, ' '))
    if (Number.isFinite(ms)) return new Date(ms).toISOString()
  }
  return null
}

export function parseRss(xml: string): RohEintrag[] {
  const aus: RohEintrag[] = []
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? []
  for (const item of items) {
    const titel = feld(item, 'title')
    const link = feld(item, 'link') || (/<link[^>]*href="([^"]+)"/i.exec(item)?.[1] ?? '')
    if (!titel || !link) continue
    aus.push({ titel, link: link.trim(), zeit: zeitAus(item), text: feld(item, 'description') })
  }
  return aus
}
