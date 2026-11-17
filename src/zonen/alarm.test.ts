import { describe, expect, it } from 'vitest'
import type { Candle } from '../types'
import { abgeschlosseneKerzen, alarmNachricht, lageZurZone, normalisiereStatus, pruefeZonen, type MarktDaten, type ZonenStatus } from './alarm'
import { neueZone } from './engine'
import type { PreisZone, ZonenStand } from './types'

const T0 = 1_800_000_000 // Unix-Sekunden, auf 15 Minuten gerundet
const kerze = (time: number, close: number, low = close, high = close): Candle => ({ time, open: close, high, low, close, volume: 0 })

/** Marktdaten zum Zeitpunkt T0 + minuten: 15-Minuten-Kerzen mit den gegebenen Schlusskursen, letzte läuft noch */
function markt(schluesse: number[], opt: { k1h?: Candle[]; k1d?: Candle[]; kursAlterMin?: number } = {}): { d: MarktDaten; jetzt: number } {
  const k15 = schluesse.map((c, i) => kerze(T0 + i * 900, c))
  const jetzt = (T0 + (schluesse.length - 1) * 900 + 300) * 1000
  return { d: { kurs: schluesse[schluesse.length - 1], kursZeit: jetzt - (opt.kursAlterMin ?? 1) * 60_000, k15, k1h: opt.k1h ?? [], k1d: opt.k1d ?? [] }, jetzt }
}

const support: PreisZone = { ...neueZone('gold', '15m', 100, 101, 110, 1, 'z1'), notiz: 'Tagestief' }
const stand = (zonen: PreisZone[] = [support]): ZonenStand => ({ zonen, annaeherungProzent: 0.3, aktualisiertAm: 1 })

/** Läufe nacheinander: je Lauf ein weiterer Schlusskurs; liefert die Alarm-Arten je Lauf */
function laeufe(kurse: number[], zonen = stand(), start = 4): string[][] {
  let status: ZonenStatus | null = null
  const aus: string[][] = []
  for (let n = start; n <= kurse.length; n++) {
    const { d, jetzt } = markt(kurse.slice(0, n))
    const r = pruefeZonen(zonen, status, { gold: d }, jetzt)
    status = r.status
    aus.push(r.alarme.map((a) => a.art))
  }
  return aus
}

describe('zonen/alarm', () => {
  it('bestimmt die Lage über das Fenster', () => {
    expect(lageZurZone(support, 105, 106, 105, 0.3).lage).toBe('fern')
    expect(lageZurZone(support, 101.2, 102, 101.5, 0.3)).toMatchObject({ lage: 'nah' })
    expect(lageZurZone(support, 100.5, 102, 102, 0.3).lage).toBe('drin')
    expect(lageZurZone(support, 98, 99.9, 99.9, 0.3).lage).toBe('nah')
    // durchgerauscht: Fenster überspannt die Zone
    expect(lageZurZone(support, 98, 103, 98, 0.3).lage).toBe('drin')
  })

  it('startet still und meldet dann nah → drin je einmal', () => {
    //                    Start (fern)      nah     nah    drin   drin
    const a = laeufe([105, 105, 105, 105, 101.2, 101.25, 100.5, 100.6])
    expect(a).toEqual([[], ['nah'], [], ['drin'], []])
  })

  it('meldet direkt „drin“, wenn der Kurs ohne Zwischenstopp in die Zone fällt, und nicht zusätzlich „nah“', () => {
    expect(laeufe([105, 105, 105, 105, 100.5, 101.2])).toEqual([[], ['drin'], []])
  })

  it('wird erst wieder scharf, wenn der Kurs die Zone (drin) bzw. den Bereich davor (nah) im ganzen Fenster verlassen hat', () => {
    const kurse = [105, 105, 105, 105, 100.5, /* raus, aber Fenster berührt noch */ 101.2, 101.2, 101.2, /* Fenster frei, noch nah */ 101.2, /* wieder rein */ 100.9, /* weit weg */ 105, 105, 105, 105, /* neu nah */ 101.2]
    expect(laeufe(kurse)).toEqual([[], ['drin'], [], [], [], [], ['drin'], [], [], [], [], ['nah']])
  })

  it('eine Zone, die beim Anlegen schon erreicht ist, meldet nichts, bis der Kurs neu kommt', () => {
    expect(laeufe([100.5, 100.5, 100.5, 100.5, 100.6, 100.4])).toEqual([[], [], []])
  })

  it('erkennt den Docht zwischen zwei Läufen', () => {
    const { d, jetzt } = markt([105, 105, 105, 105])
    const s0 = pruefeZonen(stand(), null, { gold: d }, jetzt).status
    const spaeter = markt([105, 105, 105, 105, 104])
    spaeter.d.k15[4] = kerze(T0 + 4 * 900, 104, 100.8, 105)
    expect(pruefeZonen(stand(), s0, { gold: spaeter.d }, spaeter.jetzt).alarme.map((a) => a.art)).toEqual(['drin'])
  })

  it('meldet „gebrochen“ einmal, wenn eine abgeschlossene Kerze jenseits schließt', () => {
    // 15m-Zone: Schluss 99 (unter 100) in Kerze 5; gemeldet, sobald Kerze 5 abgeschlossen ist (Lauf mit 7 Kursen)
    const a = laeufe([105, 105, 105, 105, 100.5, 99, 98.5, 98, 98])
    expect(a).toEqual([[], ['drin'], [], ['gebrochen'], [], []])
  })

  it('Resistance bricht nach oben, Support nicht', () => {
    const res: PreisZone = { ...support, id: 'r', typ: 'resistance' }
    expect(laeufe([95, 95, 95, 95, 102, 103, 103], stand([res])).flat()).toEqual(['drin', 'gebrochen'])
    expect(laeufe([95, 95, 95, 95, 102, 103, 103]).flat()).toEqual(['drin'])
  })

  it('prüft den Bruch auf der Zeiteinheit der Zone (4 h aus Stundenkerzen)', () => {
    const z4: PreisZone = { ...support, id: 'z4', zeiteinheit: '4h' }
    const block = Math.ceil(T0 / 14400) * 14400
    const stunden = (schluss2: number[]) => [...[105, 105, 105, 104].map((c, i) => kerze(block + i * 3600, c)), ...schluss2.map((c, i) => kerze(block + 14400 + i * 3600, c))]
    const jetzt = (n: number) => (block + 14400 + n * 3600 + 60) * 1000
    const d = (k1h: Candle[], t: number): MarktDaten => ({ kurs: 99, kursZeit: t, k15: [], k1h, k1d: [] })
    const s0 = pruefeZonen(stand([z4]), null, { gold: { ...d(stunden([104]), jetzt(0)), kurs: 104 } }, jetzt(0)).status
    // zweite 4h-Kerze läuft noch: Stundenschluss 99 allein bricht die 4h-Zone nicht
    const r1 = pruefeZonen(stand([z4]), s0, { gold: d(stunden([104, 99]), jetzt(1)) }, jetzt(1))
    expect(r1.alarme).toEqual([])
    // 4h-Kerze abgeschlossen mit Schluss 99
    const k = stunden([104, 99, 99, 99])
    const r2 = pruefeZonen(stand([z4]), r1.status, { gold: d(k, jetzt(4)) }, jetzt(4))
    expect(r2.alarme.map((a) => a.art)).toEqual(['gebrochen'])
    expect(r2.alarme[0].schluss).toBe(99)
    expect(abgeschlosseneKerzen(d(k, jetzt(4)), '4h', jetzt(4))).toHaveLength(2)
  })

  it('alter Kurs (Börse zu) löst kein nah/drin aus, stumme Zonen nichts', () => {
    const { d, jetzt } = markt([105, 105, 105, 105])
    const s0 = pruefeZonen(stand(), null, { gold: d }, jetzt).status
    const zu = markt([105, 105, 105, 105, 100.5], { kursAlterMin: 120 })
    expect(pruefeZonen(stand(), s0, { gold: zu.d }, zu.jetzt).alarme).toEqual([])
    const offen = markt([105, 105, 105, 105, 100.5])
    const stumm = pruefeZonen(stand([{ ...support, alarm: false }]), s0, { gold: offen.d }, offen.jetzt)
    expect(stumm.alarme).toEqual([])
    expect(stumm.status.zustand).toEqual({})
  })

  it('verschobene Kanten starten die Zone neu; fehlende Marktdaten lassen den Zustand stehen', () => {
    const { d, jetzt } = markt([105, 105, 105, 105])
    const s0 = pruefeZonen(stand(), null, { gold: d }, jetzt).status
    const ohne = pruefeZonen(stand(), s0, {}, jetzt + 900_000)
    expect(ohne.geaendert).toBe(false)
    expect(ohne.status).toBe(s0)
    const verschoben = pruefeZonen(stand([{ ...support, von: 104.5, bis: 105.5 }]), s0, { gold: d }, jetzt + 900_000)
    expect(verschoben.alarme).toEqual([])
    expect(verschoben.status.zustand.z1).toMatchObject({ kanten: '104.5|105.5', drin: true })
  })

  it('führt die Alarmliste (jüngste zuerst) und speichert nur bei Änderung', () => {
    const { d, jetzt } = markt([105, 105, 105, 105])
    const s0 = pruefeZonen(stand(), null, { gold: d }, jetzt)
    expect(s0.geaendert).toBe(true)
    const gleich = markt([105, 105, 105, 105, 105])
    expect(pruefeZonen(stand(), s0.status, { gold: gleich.d }, gleich.jetzt).geaendert).toBe(false)
    const rein = markt([105, 105, 105, 105, 100.5])
    const r = pruefeZonen(stand(), s0.status, { gold: rein.d }, rein.jetzt)
    expect(r.status.alarme).toHaveLength(1)
    expect(normalisiereStatus(JSON.parse(JSON.stringify(r.status)))).toEqual(r.status)
  })

  it('schreibt Push-Texte mit Markt, Zone und Kurs', () => {
    const basis = { id: 'a', zoneId: 'z1', markt: 'gold' as const, zeit: 1, kurs: 4201.4, von: 4180, bis: 4195, typ: 'support' as const, zeiteinheit: '1h' as const, notiz: 'Tagestief' }
    expect(alarmNachricht({ ...basis, art: 'nah', abstandProzent: 0.152 })).toEqual({
      titel: 'Gold: nähert sich Support 4.180,0–4.195,0',
      text: 'Kurs 4.201,4, noch 0,15 % bis zur Zone · Tagestief',
      tag: 'zone-z1',
      pfad: '/analyse/zonen?zone=z1',
    })
    expect(alarmNachricht({ ...basis, art: 'drin', kurs: 4190 }).titel).toBe('Gold: in der Zone 4.180,0–4.195,0')
    expect(alarmNachricht({ ...basis, art: 'gebrochen', kurs: 4170, schluss: 4172.5, notiz: '' }).text).toBe('1 h-Kerze schließt bei 4.172,5 unter der Zone. Kurs 4.170,0')
  })
})
