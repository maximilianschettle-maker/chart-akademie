import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Check } from 'lucide-react'
import { suche } from '../data/service'
import { useAktienStore } from '../store'
import type { Suchtreffer } from '../types'
import { EINGABE } from './ui'

/** Suchfeld mit Verzögerung; Treffer öffnen die Firmenseite oder landen auf der Watchlist. */
export function Suche() {
  const [begriff, setBegriff] = useState('')
  const [treffer, setTreffer] = useState<Suchtreffer[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const watchlist = useAktienStore((s) => s.watchlist)
  const hinzu = useAktienStore((s) => s.watchlistHinzu)
  const navigate = useNavigate()
  const letzte = useRef(0)

  useEffect(() => {
    const t = begriff.trim()
    if (t.length < 2) {
      setTreffer([])
      setFehler(null)
      return
    }
    const lauf = ++letzte.current
    const timer = setTimeout(async () => {
      setLaeuft(true)
      try {
        const r = await suche(t)
        if (lauf === letzte.current) {
          setTreffer(r)
          setFehler(null)
        }
      } catch (e) {
        if (lauf === letzte.current) setFehler(e instanceof Error ? e.message : String(e))
      } finally {
        if (lauf === letzte.current) setLaeuft(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [begriff])

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gedimmt" />
        <input
          className={`${EINGABE} pl-9`}
          value={begriff}
          onChange={(e) => setBegriff(e.target.value)}
          placeholder="Firma oder Ticker suchen, z.B. Siemens, SAP.DE, AAPL"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {fehler && <p className="mt-2 text-xs text-short">{fehler}</p>}
      {laeuft && treffer.length === 0 && !fehler && <p className="mt-2 text-xs text-gedimmt">Suche …</p>}
      {treffer.length > 0 && (
        <ul className="mt-2 divide-y divide-rand/60 overflow-hidden rounded-xl border border-rand bg-flaeche">
          {treffer.map((t) => {
            const drin = watchlist.some((w) => w.symbol === t.symbol)
            return (
              <li key={t.symbol} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <button type="button" className="min-w-0 flex-1 text-left hover:text-white" onClick={() => navigate(`/analyse/aktien/${encodeURIComponent(t.symbol)}`)}>
                  <span className="font-semibold text-schrift">{t.name}</span>
                  <span className="ml-2 text-xs text-gedimmt">
                    {t.symbol} · {t.boerse}
                  </span>
                </button>
                <button
                  type="button"
                  title={drin ? 'Auf der Watchlist' : 'Zur Watchlist'}
                  className={`rounded-lg px-2 py-1 text-xs ${drin ? 'text-long' : 'bg-nacht text-gedimmt hover:text-white'}`}
                  disabled={drin}
                  onClick={() => hinzu(t.symbol, t.name)}
                >
                  {drin ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
