import { CalendarDays, ExternalLink, TriangleAlert } from 'lucide-react'
import { KALENDER, useBoard } from './laden'
import { INDIKATOR_TEXT, REGION_TEXT, type IndikatorWert, type KalenderTermin } from './types'
import { fmtStand, fmtTagKurz, fmtUhr } from '../makro/format'

// Wirtschaftskalender (Makro & News): nächste Veröffentlichungen (CPI/HVPI, Arbeitsmarkt, BIP) für USA und
// Euroraum und die zuletzt gemeldeten Werte mit Vorwert. Daten aus public/data/kalender.json.

const REGION_FARBE: Record<KalenderTermin['region'], string> = { us: 'text-blue-400', ez: 'text-purple-400' }

function fmtWert(w: IndikatorWert, n: number | null): string {
  if (n === null) return '–'
  const stellen = w.einheit === 'Tsd.' ? 0 : 1
  return `${n > 0 && w.einheit !== '%' ? '+' : ''}${n.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen })} ${w.einheit}`
}

function periodeText(p: string): string {
  const q = /^(\d{4})-Q(\d)$/.exec(p)
  if (q) return `Q${q[2]} ${q[1]}`
  const m = /^(\d{4})-(\d{2})$/.exec(p)
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString('de-DE', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return p
}

export function Wirtschaftskalender({ anzahl = 8 }: { anzahl?: number }) {
  const { daten, status, fehler, ausCache } = useBoard(KALENDER)
  const jetzt = Date.now()
  const termine = daten ? daten.termine.filter((t) => Date.parse(t.zeitUtc) > jetzt - 3_600_000).slice(0, anzahl) : []
  const ohneUsKey = daten ? daten.quellen['fred-termine'] === 'ohne-key' : false

  return (
    <section className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <CalendarDays className="h-4 w-4 text-akzent" /> Wirtschaftskalender
        </h2>
        {daten && <span className="text-[11px] text-gedimmt">Stand {fmtStand(daten.lastUpdated)} Uhr{ausCache ? ' (Gerätespeicher)' : ''}</span>}
      </div>
      {status === 'laedt' && <p className="mt-3 text-sm text-gedimmt">Lade Kalender …</p>}
      {status === 'fehler' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-gedimmt">
          <TriangleAlert className="h-4 w-4 text-akzent" /> Kalender nicht verfügbar{fehler ? ` (${fehler})` : ''}. Die Datei entsteht beim ersten Lauf der Action „Makro-Board“.
        </p>
      )}
      {daten && (
        <>
          <ul className="mt-3 divide-y divide-rand text-sm">
            {termine.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="inline-flex min-w-0 items-baseline gap-2">
                  <span className={`w-14 shrink-0 text-xs font-bold ${REGION_FARBE[t.region]}`}>{REGION_TEXT[t.region]}</span>
                  <span className="text-schrift">
                    {t.titel}
                    {t.periode && <span className="text-gedimmt"> · {t.periode}</span>}
                  </span>
                </span>
                <span className="tabular-nums text-gedimmt">
                  {fmtTagKurz(t.zeitUtc)} {fmtUhr(t.zeitUtc)} Uhr
                </span>
              </li>
            ))}
            {termine.length === 0 && <li className="py-2 text-gedimmt">Keine Termine in den nächsten Wochen bekannt.</li>}
          </ul>
          {ohneUsKey && <p className="mt-1 text-[11px] text-gedimmt">US-Termine für CPI und Arbeitsmarkt brauchen das Secret FRED_API_KEY in der Action; BIP-Termine kommen vom BEA-Plan.</p>}

          {daten.werte.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-white">Zuletzt gemeldet</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {daten.werte.map((w) => (
                  <a key={`${w.region}-${w.titel}`} href={w.link} target="_blank" rel="noreferrer" className="group rounded-xl border border-rand bg-nacht/60 p-3 hover:border-akzent/50" title={w.quelle}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-wide text-gedimmt">
                      <span className={REGION_FARBE[w.region]}>{REGION_TEXT[w.region]}</span>
                      <span>{INDIKATOR_TEXT[w.indikator].split(' ')[0]}</span>
                    </div>
                    <div className="mt-1 text-xs text-schrift">{w.titel}</div>
                    <div className="tabular-nums mt-1 text-base font-bold text-white">{fmtWert(w, w.wert)}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-gedimmt">
                      <span>
                        {periodeText(w.periode)}
                        {w.vorher !== null && ` · zuvor ${fmtWert(w, w.vorher)}`}
                      </span>
                      <ExternalLink className="h-3 w-3 group-hover:text-akzent" />
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[11px] text-gedimmt">
            Quellen: FRED (Veröffentlichungstermine und Reihen CPIAUCSL, UNRATE, PAYEMS, A191RL1Q225SBEA), BEA-Terminplan, Eurostat-Terminkalender und -API (prc_hicp_manr, une_rt_m, namq_10_gdp). Keine Konsens-Prognosen – die gibt es nur bei
            Bezahlanbietern. Zeiten in deutscher Zeit.
          </p>
        </>
      )}
    </section>
  )
}
