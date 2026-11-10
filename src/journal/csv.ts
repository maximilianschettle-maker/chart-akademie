import type { ErkanntePosition } from './positionTypes'

// CSV-Import von Broker-Historien (zuerst BingX „Trade History“): statt eines Screenshots die
// exportierte Datei. Die Spalten werden an Schlüsselwörtern erkannt, Füllungen (Open/Close) werden
// je Symbol und Richtung FIFO zu Positionen gepaart. Reine Logik, getestet.

export interface CsvZeile {
  zeit: string
  symbol: string
  /** 'open' | 'close' */
  aktion: 'open' | 'close' | null
  richtung: 'long' | 'short' | null
  menge: number | null
  preis: number | null
  pnl: number | null
  gebuehr: number | null
  order: string | null
  hebel: number | null
  demo: boolean
}

/** Einfacher CSV-Parser: Trenner , oder ; (automatisch), Anführungszeichen, Zeilenumbrüche in Feldern */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const erste = t.split(/\r?\n/)[0] ?? ''
  const anzahl = (z: string) => (erste.match(new RegExp(z, 'g')) ?? []).length
  // Tab (Export aus Tabellen), Semikolon (deutsches Excel) oder Komma – das häufigste Zeichen der Kopfzeile gewinnt
  const trenner = anzahl('\\t') > Math.max(anzahl(';'), anzahl(',')) ? '\t' : anzahl(';') > anzahl(',') ? ';' : ','
  const zeilen: string[][] = []
  let feld = ''
  let zeile: string[] = []
  let inQuote = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuote) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          feld += '"'
          i++
        } else inQuote = false
      } else feld += c
      continue
    }
    if (c === '"') inQuote = true
    else if (c === trenner) {
      zeile.push(feld)
      feld = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      zeile.push(feld)
      feld = ''
      if (zeile.some((x) => x.trim() !== '')) zeilen.push(zeile)
      zeile = []
    } else feld += c
  }
  zeile.push(feld)
  if (zeile.some((x) => x.trim() !== '')) zeilen.push(zeile)
  return zeilen
}

const SPALTEN: Record<keyof Omit<CsvZeile, 'aktion' | 'richtung' | 'demo'> | 'seite', RegExp> = {
  zeit: /filled time|^time$|date|zeit|datum/i,
  symbol: /futures|symbol|pair|instrument|contract|markt/i,
  seite: /side|direction|richtung|type/i,
  menge: /^filled$|filled qty|quantity|qty|amount|size|menge/i,
  preis: /price|preis/i,
  pnl: /pnl|profit|realized/i,
  gebuehr: /fee|commission|gebühr|gebuehr/i,
  order: /order/i,
  hebel: /leverage|hebel/i,
}

function spalteFinden(kopf: string[], muster: RegExp, ausschluss?: RegExp): number {
  return kopf.findIndex((h) => muster.test(h.trim()) && !(ausschluss && ausschluss.test(h.trim())))
}

export function zahl(text: string | undefined): number | null {
  if (!text) return null
  const t = text.replace(/[^\d,.\-+]/g, '')
  if (!t) return null
  // „1,305.7882“ (US) vs „1.305,79“ (DE): das letzte Trennzeichen ist das Dezimalzeichen
  const letzterPunkt = t.lastIndexOf('.')
  const letztesKomma = t.lastIndexOf(',')
  let norm = t
  if (letzterPunkt >= 0 && letztesKomma >= 0) norm = letzterPunkt > letztesKomma ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.')
  else if (letztesKomma >= 0) norm = (t.match(/,/g) ?? []).length > 1 ? t.replace(/,/g, '') : t.replace(',', '.')
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/** „Close Long“, „Open Short“, „Buy/Long“ … → Aktion und Richtung */
export function seiteLesen(text: string): { aktion: CsvZeile['aktion']; richtung: CsvZeile['richtung'] } {
  const s = text.toLowerCase()
  const aktion = /close|schlie|sell to close|buy to close/.test(s) ? 'close' : /open|öffn|buy to open|sell to open/.test(s) ? 'open' : null
  const richtung = /long/.test(s) ? 'long' : /short/.test(s) ? 'short' : null
  return { aktion, richtung }
}

/** „BTCUSDT(Demo)“ → Symbol und Demo-Kennung; Hebel „13X“ aus einem beliebigen Feld */
export function csvZeilen(text: string): CsvZeile[] {
  const roh = parseCsv(text)
  if (roh.length < 2) return []
  const kopf = roh[0]
  const i = {
    zeit: spalteFinden(kopf, SPALTEN.zeit),
    symbol: spalteFinden(kopf, SPALTEN.symbol),
    seite: spalteFinden(kopf, SPALTEN.seite),
    menge: spalteFinden(kopf, SPALTEN.menge, /price|time/i),
    preis: spalteFinden(kopf, SPALTEN.preis),
    pnl: spalteFinden(kopf, SPALTEN.pnl),
    gebuehr: spalteFinden(kopf, SPALTEN.gebuehr),
    order: spalteFinden(kopf, SPALTEN.order),
    hebel: spalteFinden(kopf, SPALTEN.hebel),
  }
  if (i.zeit < 0 || i.symbol < 0 || i.preis < 0) return []
  return roh.slice(1).map((z) => {
    const symbolRoh = z[i.symbol] ?? ''
    const seiteRoh = i.seite >= 0 ? (z[i.seite] ?? '') : ''
    const { aktion, richtung } = seiteLesen(`${seiteRoh} ${symbolRoh}`)
    const hebelText = [z[i.hebel] ?? '', seiteRoh, symbolRoh].join(' ').match(/(\d{1,3})\s*[xX]\b/)
    return {
      zeit: (z[i.zeit] ?? '').trim(),
      symbol: symbolRoh.replace(/\(.*?\)/g, '').replace(/perp(etual)?/i, '').trim().toUpperCase(),
      aktion,
      richtung,
      menge: zahl(z[i.menge]),
      preis: zahl(z[i.preis]),
      pnl: i.pnl >= 0 ? zahl(z[i.pnl]) : null,
      gebuehr: i.gebuehr >= 0 ? zahl(z[i.gebuehr]) : null,
      order: i.order >= 0 ? (z[i.order] ?? '').replace(/\D/g, '') || null : null,
      hebel: hebelText ? Number(hebelText[1]) : null,
      demo: /demo|virtual|paper/i.test(`${symbolRoh} ${z.join(' ')}`),
    }
  })
}

/** „2026-10-22 18:50:09“ oder „22.10.2026 18:50“ → 'YYYY-MM-DDTHH:mm' (wie der Screenshot-Import, Ortszeit) */
export function zeitNormieren(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}`
  const de = text.match(/(\d{2})\.(\d{2})\.(\d{4})[ ,]+(\d{2}):(\d{2})/)
  if (de) return `${de[3]}-${de[2]}-${de[1]}T${de[4]}:${de[5]}`
  return null
}

/** Sortierschlüssel mit Sekunden, wenn vorhanden ('YYYY-MM-DDTHH:mm:ss'), sonst wie zeitNormieren */
export function zeitSchluessel(text: string): string {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:${iso[6] ?? '00'}`
  const de = text.match(/(\d{2})\.(\d{2})\.(\d{4})[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (de) return `${de[3]}-${de[2]}-${de[1]}T${de[4]}:${de[5]}:${de[6] ?? '00'}`
  return text
}

/**
 * Füllungen zu Positionen paaren: je Symbol und Richtung FIFO – ein „Open“ legt einen Posten an,
 * ein „Close“ schließt ihn (bei Teilgrößen den ältesten, Rest bleibt offen). Reihenfolge chronologisch.
 */
export function positionenAusFuellungen(zeilen: CsvZeile[], broker = 'BingX'): ErkanntePosition[] {
  // Sortierschlüssel mit Sekunden: Open und Close derselben Minute (BingX: 16:01:34 / 16:01:57) müssen in Reihenfolge bleiben
  const schluessel = (z: CsvZeile) => zeitSchluessel(z.zeit)
  const sortiert = [...zeilen].filter((z) => z.aktion && z.richtung && z.preis).sort((a, b) => schluessel(a).localeCompare(schluessel(b)))
  const offen = new Map<string, CsvZeile[]>()
  const out: ErkanntePosition[] = []
  for (const z of sortiert) {
    const key = `${z.symbol}|${z.richtung}`
    if (z.aktion === 'open') {
      offen.set(key, [...(offen.get(key) ?? []), z])
      continue
    }
    const liste = offen.get(key) ?? []
    const o = liste.shift() ?? null
    offen.set(key, liste)
    out.push({
      brokerId: z.order ?? o?.order ?? null,
      instrument: z.symbol,
      richtung: z.richtung === 'long' ? 'kaufen' : 'verkaufen',
      hebel: z.hebel ?? o?.hebel ?? null,
      kontrakte: o?.menge ?? z.menge,
      positionsgroesse: o?.menge && o.preis ? Math.round(o.menge * o.preis * 100) / 100 : null,
      einsatz: o?.menge && o.preis && (z.hebel ?? o.hebel) ? Math.round(((o.menge * o.preis) / (z.hebel ?? o.hebel!)) * 100) / 100 : null,
      eroeffnungskurs: o?.preis ?? null,
      eroeffnungsdatum: o ? zeitNormieren(o.zeit) : null,
      stopLoss: null,
      takeProfit: null,
      gewinnVerlust: z.pnl,
      uebernachtgebuehren: Math.round((Math.abs(z.gebuehr ?? 0) + Math.abs(o?.gebuehr ?? 0)) * 10000) / 10000 || null,
      status: 'geschlossen',
      schlusskurs: z.preis,
      schlussdatum: zeitNormieren(z.zeit),
      broker,
      demo: z.demo || (o?.demo ?? false),
    })
  }
  // übrig gebliebene Opens = noch offene Positionen
  for (const liste of offen.values()) {
    for (const o of liste) {
      out.push({
        brokerId: o.order,
        instrument: o.symbol,
        richtung: o.richtung === 'long' ? 'kaufen' : 'verkaufen',
        hebel: o.hebel,
        kontrakte: o.menge,
        positionsgroesse: o.menge && o.preis ? Math.round(o.menge * o.preis * 100) / 100 : null,
        einsatz: o.menge && o.preis && o.hebel ? Math.round(((o.menge * o.preis) / o.hebel) * 100) / 100 : null,
        eroeffnungskurs: o.preis,
        eroeffnungsdatum: zeitNormieren(o.zeit),
        stopLoss: null,
        takeProfit: null,
        gewinnVerlust: null,
        uebernachtgebuehren: o.gebuehr !== null ? Math.abs(o.gebuehr) : null,
        status: 'offen',
        schlusskurs: null,
        schlussdatum: null,
        broker,
        demo: o.demo,
      })
    }
  }
  return out.sort((a, b) => (a.eroeffnungsdatum ?? '').localeCompare(b.eroeffnungsdatum ?? ''))
}
