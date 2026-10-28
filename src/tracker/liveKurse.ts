import { useEffect, useState } from 'react'
import type { Candle } from '../types'
import { workerKonfiguriert } from '../aktien/data/client'
import { ladeKurs } from '../aktien/data/service'

// Live-Kurse über den Aktien-Worker (/api/kurs, Yahoo-Quote, Cache 15 min), damit die
// Anzeige nicht auf den nächsten Action-Lauf wartet. Ohne eingetragenen Worker bleibt
// der Kurs aus tracker.json. Signale rechnet weiterhin nur die Action.

export interface LiveKurs {
  preis: number
  /** Unix-ms der Kursfeststellung */
  zeit: number
}

const INTERVALL_MS = 5 * 60_000

export function useLiveKurse(symbole: string[], frischSignal = 0): Record<string, LiveKurs> {
  const [kurse, setKurse] = useState<Record<string, LiveKurs>>({})
  const schluessel = symbole.join(',')

  useEffect(() => {
    if (!schluessel || !workerKonfiguriert()) return
    let aktiv = true
    const laden = async (frisch: boolean) => {
      const liste = schluessel.split(',')
      const ergebnisse = await Promise.all(liste.map((s) => ladeKurs(s, frisch).catch(() => null)))
      if (!aktiv) return
      setKurse((alt) => {
        const neu = { ...alt }
        liste.forEach((s, i) => {
          const k = ergebnisse[i]
          if (k && Number.isFinite(k.preis)) neu[s] = { preis: k.preis, zeit: k.zeit * 1000 }
        })
        return neu
      })
    }
    laden(frischSignal > 0)
    const timer = setInterval(() => laden(false), INTERVALL_MS)
    const sichtbar = () => {
      if (document.visibilityState === 'visible') laden(false)
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      aktiv = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [schluessel, frischSignal])

  return kurse
}

/** Schlusskurs des Vortags zum Zeitpunkt `kursZeitMs`: die letzte Kerze zählt nicht, wenn sie vom selben UTC-Tag ist */
export function vortagesSchluss(kerzen: Candle[], kursZeitMs: number): number | null {
  const n = kerzen.length
  if (n === 0) return null
  const letzte = kerzen[n - 1]
  const gleicherTag = Math.floor(letzte.time / 86_400) === Math.floor(kursZeitMs / 1000 / 86_400)
  const ref = gleicherTag ? kerzen[n - 2] : letzte
  return ref ? ref.close : null
}

/** Neuerer von Live-Kurs und JSON-Kurs */
export function aktuellerKurs(
  json: { kurs: number; kursZeit: string } | null,
  live: LiveKurs | undefined,
): { preis: number; zeitMs: number; live: boolean } | null {
  const jsonZeit = json ? Date.parse(json.kursZeit) : Number.NEGATIVE_INFINITY
  if (live && live.zeit >= jsonZeit) return { preis: live.preis, zeitMs: live.zeit, live: true }
  if (json) return { preis: json.kurs, zeitMs: jsonZeit, live: false }
  return null
}
