import { useState } from 'react'
import { ExternalLink, Globe, TriangleAlert } from 'lucide-react'
import { NEWS, useBoard } from './laden'
import { KATEGORIE_TEXT, MARKT_TEXT, type MarktTag, type NewsKategorie } from './types'
import { fmtStand } from '../makro/format'

// Geopolitik-Board (Makro & News): kuratierte Meldungen in vier festen Kategorien, jede mit Tags der
// potenziell betroffenen Märkte. Daten aus public/data/news.json (Action board.yml, stündlich).

const KATEGORIEN: (NewsKategorie | 'alle')[] = ['alle', 'handel', 'konflikte', 'energie', 'politik']
const MARKT_FARBE: Record<MarktTag, string> = {
  oel: 'border-amber-500/50 text-amber-400',
  gas: 'border-orange-500/50 text-orange-400',
  eurusd: 'border-blue-500/50 text-blue-400',
  ruestung: 'border-red-500/50 text-red-400',
  halbleiter: 'border-cyan-500/50 text-cyan-400',
  gold: 'border-yellow-500/50 text-yellow-300',
  aktien: 'border-emerald-500/50 text-emerald-400',
  anleihen: 'border-violet-500/50 text-violet-400',
}

function zeitText(iso: string, jetzt: number): string {
  const diff = jetzt - Date.parse(iso)
  if (diff < 3_600_000) return `vor ${Math.max(1, Math.round(diff / 60_000))} Min`
  if (diff < 24 * 3_600_000) return `vor ${Math.round(diff / 3_600_000)} Std`
  return fmtStand(iso)
}

export function NewsBoard({ anzahl = 30 }: { anzahl?: number }) {
  const { daten, status, fehler, ausCache } = useBoard(NEWS)
  const [kategorie, setKategorie] = useState<NewsKategorie | 'alle'>('alle')
  const [markt, setMarkt] = useState<MarktTag | null>(null)
  const jetzt = Date.now()
  const eintraege = daten
    ? daten.eintraege.filter((e) => (kategorie === 'alle' || e.kategorie === kategorie) && (!markt || e.maerkte.includes(markt))).slice(0, anzahl)
    : []
  const zaehler = (k: NewsKategorie | 'alle') => (daten ? (k === 'alle' ? daten.eintraege.length : daten.eintraege.filter((e) => e.kategorie === k).length) : 0)
  const maerkteVorhanden = daten ? (Object.keys(MARKT_TEXT) as MarktTag[]).filter((m) => daten.eintraege.some((e) => e.maerkte.includes(m))) : []

  return (
    <section className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <Globe className="h-4 w-4 text-akzent" /> Geopolitik-Board
        </h2>
        {daten && <span className="text-[11px] text-gedimmt">Stand {fmtStand(daten.lastUpdated)} Uhr{ausCache ? ' (Gerätespeicher)' : ''}</span>}
      </div>
      {status === 'laedt' && <p className="mt-3 text-sm text-gedimmt">Lade Meldungen …</p>}
      {status === 'fehler' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-gedimmt">
          <TriangleAlert className="h-4 w-4 text-akzent" /> Meldungen nicht verfügbar{fehler ? ` (${fehler})` : ''}. Die Datei entsteht beim ersten Lauf der Action „Makro-Board“.
        </p>
      )}
      {daten && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Kategorie">
            {KATEGORIEN.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kategorie === k}
                onClick={() => setKategorie(k)}
                className={`tipp rounded-lg px-2.5 py-1.5 text-xs font-semibold ${kategorie === k ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'}`}
              >
                {k === 'alle' ? 'Alle' : KATEGORIE_TEXT[k]} <span className="opacity-70">{zaehler(k)}</span>
              </button>
            ))}
          </div>
          {maerkteVorhanden.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-gedimmt">Markt:</span>
              {maerkteVorhanden.map((m) => (
                <button key={m} type="button" aria-pressed={markt === m} onClick={() => setMarkt(markt === m ? null : m)} className={`tipp rounded border px-1.5 py-0.5 font-semibold ${markt === m ? 'bg-flaeche ring-1 ring-akzent' : ''} ${MARKT_FARBE[m]}`}>
                  {MARKT_TEXT[m]}
                </button>
              ))}
            </div>
          )}
          <ul className="mt-3 divide-y divide-rand">
            {eintraege.map((e) => (
              <li key={e.id} className="py-2.5">
                <a href={e.link} target="_blank" rel="noreferrer" className="group block">
                  <div className="flex items-baseline gap-2 text-[11px] text-gedimmt">
                    <span className="tabular-nums">{zeitText(e.zeit, jetzt)}</span>
                    <span>· {e.quelle}</span>
                    <span>· {KATEGORIE_TEXT[e.kategorie]}</span>
                  </div>
                  <div className="mt-0.5 inline-flex items-start gap-1 text-sm text-schrift group-hover:text-white">
                    <span>{e.titel}</span>
                    <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-gedimmt group-hover:text-akzent" />
                  </div>
                  {e.text && <p className="mt-0.5 line-clamp-2 text-xs text-gedimmt">{e.text}</p>}
                </a>
                {e.maerkte.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.maerkte.map((m) => (
                      <span key={m} className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${MARKT_FARBE[m]}`}>
                        {MARKT_TEXT[m]}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {eintraege.length === 0 && <li className="py-3 text-sm text-gedimmt">Keine Meldungen in dieser Auswahl.</li>}
          </ul>
          <p className="mt-3 text-[11px] text-gedimmt">
            Quellen: tagesschau, DW, Spiegel Wirtschaft, FAZ Wirtschaft, Handelsblatt, BBC World, NYT World, EIA Today in Energy (RSS) und GDELT (englisch). Einordnung und Markt-Tags per Schlüsselwortregeln – ein grober Filter, kein Urteil. Keine Anlageberatung.
          </p>
        </>
      )}
    </section>
  )
}
