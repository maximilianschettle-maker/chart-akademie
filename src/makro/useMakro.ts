import { useEffect, useState } from 'react'
import { ladeMakro, type MakroErgebnis } from './laden'

// Ein Ladevorgang pro Seitenaufruf, von allen Komponenten geteilt (Dashboard-Widget,
// Makro-Seite, Simulator-Marker). `jetzt` tickt für Countdowns alle 30 s.

let laufend: Promise<MakroErgebnis> | null = null
let letztes: MakroErgebnis | null = null
let geladenAm = 0
const FRISCH_MS = 10 * 60_000

function hole(erzwingen = false): Promise<MakroErgebnis> {
  if (!erzwingen && letztes && Date.now() - geladenAm < FRISCH_MS) return Promise.resolve(letztes)
  if (!laufend) {
    laufend = ladeMakro()
      .then((r) => {
        letztes = r
        geladenAm = Date.now()
        return r
      })
      .finally(() => {
        laufend = null
      })
  }
  return laufend
}

const LADEND: MakroErgebnis = { daten: null, status: 'laedt', fehler: null, ausCache: false }

export function useMakro(tickMs = 30_000) {
  const [ergebnis, setErgebnis] = useState<MakroErgebnis>(letztes ?? LADEND)
  const [jetzt, setJetzt] = useState(() => Date.now())

  useEffect(() => {
    let aktiv = true
    hole().then((r) => {
      if (aktiv) setErgebnis(r)
    })
    const t = setInterval(() => setJetzt(Date.now()), tickMs)
    // Nach Rückkehr in die App (Handy) frisch laden – die Entscheidung könnte inzwischen da sein
    const sichtbar = () => {
      if (document.visibilityState === 'visible') {
        setJetzt(Date.now())
        hole(true).then((r) => {
          if (aktiv) setErgebnis(r)
        })
      }
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      aktiv = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [tickMs])

  const neuLaden = () => {
    setErgebnis((e) => ({ ...e, status: e.daten ? e.status : 'laedt' }))
    hole(true).then(setErgebnis)
  }

  return { ...ergebnis, jetzt, neuLaden }
}
