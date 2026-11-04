import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useJournalStore } from '../store'
import { useAnsichtStore } from '../../analyse/ansichtStore'
import { workerKonfiguriert } from '../../aktien/data/client'
import { EINGABE, KNOPF, KNOPF_AKZENT } from '../../aktien/components/ui'
import { fmtKurs } from '../../aktien/engine/format'
import { bildVorbereiten, positionenErkennen, type BildDaten } from '../screenshot'
import { AKTION_TEXT, vorschlaege, type ImportVorschlag } from '../import'
import { neuerEintrag, setupListe, zeitKurz, type EintragEntwurf } from '../engine'
import { snapshotLaden } from '../snapshots'
import { ZEITRAHMEN, type JournalEintrag, type Zeitrahmen } from '../types'
import type { ScreenshotErgebnis } from '../positionTypes'

// Screenshot der Broker-App (eToro: Positionsinfo, Portfolio, Historie) → der Worker lässt Claude die
// Positionen lesen → hier die Prüfliste: was wird neu angelegt, was abgeschlossen, was aktualisiert.
// Setup und Zeitrahmen stehen auf keinem Screenshot, die wählt der Nutzer je Zeile.

interface Zeile {
  v: ImportVorschlag
  an: boolean
  strategieId: string
  zeitrahmen: Zeitrahmen
}

export function JournalScreenshotPage() {
  const navigate = useNavigate()
  const eintraege = useJournalStore((s) => s.eintraege)
  const hinzufuegen = useJournalStore((s) => s.hinzufuegen)
  const aendern = useJournalStore((s) => s.aendern)
  const konto = useAnsichtStore((s) => s.konto)
  const setups = useMemo(() => setupListe(), [])
  const dateiRef = useRef<HTMLInputElement>(null)
  const [vorschau, setVorschau] = useState<string | null>(null)
  const [bild, setBild] = useState<BildDaten | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<ScreenshotErgebnis | null>(null)
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const mitWorker = workerKonfiguriert()

  async function dateiGewaehlt(datei: File) {
    setFehler(null)
    setErgebnis(null)
    setZeilen([])
    if (vorschau) URL.revokeObjectURL(vorschau)
    setVorschau(URL.createObjectURL(datei))
    try {
      const b = await bildVorbereiten(datei)
      setBild(b)
      await erkennen(b)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    }
  }

  async function erkennen(b: BildDaten) {
    setLaeuft(true)
    setFehler(null)
    try {
      const r = await positionenErkennen(b)
      setErgebnis(r)
      setZeilen(
        vorschlaege(r.positionen, eintraege, konto).map((v) => ({
          v,
          an: v.aktion !== 'unveraendert',
          strategieId: v.vorhanden?.strategieId ?? '',
          zeitrahmen: v.vorhanden?.zeitrahmen ?? '15m',
        })),
      )
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setLaeuft(false)
    }
  }

  const zeileSetzen = (i: number, teil: Partial<Zeile>) => setZeilen((alt) => alt.map((z, k) => (k === i ? { ...z, ...teil } : z)))
  const aktive = zeilen.filter((z) => z.an)
  const unvollstaendig = aktive.filter((z) => z.v.aktion === 'neu' && (!z.strategieId || !z.v.entwurf.symbol))
  const bereit = aktive.length > 0 && unvollstaendig.length === 0

  function uebernehmen() {
    let neu = 0
    let geaendert = 0
    for (const z of aktive) {
      const { v } = z
      if (v.aktion === 'neu') {
        const entwurf = { ...v.entwurf, strategieId: z.strategieId, zeitrahmen: z.zeitrahmen } as EintragEntwurf
        const e: JournalEintrag = { ...neuerEintrag(entwurf), ...(v.position.status === 'geschlossen' ? { status: 'geschlossen' as const } : {}) }
        hinzufuegen(e)
        void snapshotLaden(e)
        neu += 1
      } else if (v.aktion === 'schliessen' || v.aktion === 'aktualisieren') {
        if (!v.vorhanden) continue
        aendern(v.vorhanden.id, v.aenderung)
        if (v.aktion === 'schliessen') void snapshotLaden({ ...v.vorhanden, ...v.aenderung })
        geaendert += 1
      }
    }
    navigate('/training/journal', { replace: true, state: { meldung: `Screenshot übernommen: ${neu} neu, ${geaendert} aktualisiert.` } })
  }

  const feld = 'text-[11px] text-gedimmt'

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <Link to="/training/journal" className="inline-flex items-center gap-1 text-xs font-semibold text-gedimmt hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Journal
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-white">Trades aus Screenshot</h1>
      <p className="mt-1 text-sm text-gedimmt">
        Screenshot aus eToro (Positionsinfo, Portfolio oder Historie). Der Worker liest Markt, Richtung, Einstieg, Stop, Ziel, Hebel, Datum und Ergebnis aus; du prüfst, wählst Setup und Zeitrahmen und übernimmst.
      </p>

      {!mitWorker && (
        <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-akzent/40 bg-akzent/10 px-3 py-2 text-sm text-akzent">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Kein Worker eingetragen (Aktien → Einstellungen). Ohne ihn gibt es keine Erkennung.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => dateiRef.current?.click()} className={KNOPF_AKZENT} disabled={!mitWorker || laeuft}>
          <Camera className="h-3.5 w-3.5" /> Screenshot wählen
        </button>
        {bild && !laeuft && (
          <button type="button" onClick={() => void erkennen(bild)} className={KNOPF}>
            Nochmal erkennen
          </button>
        )}
        <input
          ref={dateiRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(ev) => {
            const f = ev.target.files?.[0]
            if (f) void dateiGewaehlt(f)
            ev.target.value = ''
          }}
        />
        {laeuft && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gedimmt">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Claude liest den Screenshot … (10–30 s)
          </span>
        )}
      </div>

      {fehler && <p className="mt-3 text-sm text-short">{fehler}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
        {vorschau && (
          <img src={vorschau} alt="Screenshot" className="max-h-80 w-full rounded-xl border border-rand object-contain md:max-h-none" />
        )}
        <div className="space-y-3">
          {ergebnis && ergebnis.positionen.length === 0 && <p className="text-sm text-gedimmt">Keine Position erkannt.{ergebnis.hinweis ? ` ${ergebnis.hinweis}` : ''}</p>}
          {ergebnis?.hinweis && ergebnis.positionen.length > 0 && <p className="text-xs text-akzent">Hinweis des Modells: {ergebnis.hinweis}</p>}

          {zeilen.map((z, i) => {
            const { v } = z
            const p = v.position
            const waehrung = v.entwurf.waehrung ?? 'USD'
            return (
              <section key={i} className={`rounded-xl border bg-flaeche p-3 ${z.an ? 'border-rand' : 'border-rand/40 opacity-60'}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={z.an} onChange={(ev) => zeileSetzen(i, { an: ev.target.checked })} className="mt-1 h-4 w-4 accent-akzent" disabled={v.aktion === 'unveraendert'} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-white">{v.entwurf.markt}</span>
                      <span className={`font-semibold ${v.entwurf.richtung === 'long' ? 'text-long' : 'text-short'}`}>{v.entwurf.richtung === 'long' ? 'Long' : 'Short'}</span>
                      {p.hebel && <span className="text-xs text-gedimmt">×{p.hebel}</span>}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${v.aktion === 'unveraendert' ? 'bg-nacht text-gedimmt' : 'bg-akzent/15 text-akzent'}`}>{AKTION_TEXT[v.aktion]}</span>
                    </span>
                    <span className="mt-1 block text-xs text-schrift">
                      Einstieg {p.eroeffnungskurs ? fmtKurs(p.eroeffnungskurs, waehrung) : '–'} · Stop <span className="text-short">{p.stopLoss ? fmtKurs(p.stopLoss, waehrung) : '–'}</span> · Ziel{' '}
                      <span className="text-long">{p.takeProfit ? fmtKurs(p.takeProfit, waehrung) : '–'}</span>
                      {v.entwurf.entryTime && ` · ${zeitKurz(v.entwurf.entryTime)}`}
                      {v.entwurf.risikoBetrag !== undefined && ` · Risiko ${fmtKurs(v.entwurf.risikoBetrag, waehrung)}`}
                      {p.status === 'geschlossen' && ` · geschlossen ${p.schlusskurs ? `bei ${fmtKurs(p.schlusskurs, waehrung)}` : ''}${p.gewinnVerlust !== null ? ` (${p.gewinnVerlust >= 0 ? '+' : ''}${fmtKurs(p.gewinnVerlust, waehrung)})` : ''}`}
                      {p.brokerId && <span className="text-gedimmt"> · #{p.brokerId}</span>}
                    </span>
                    {v.vorhanden && (
                      <span className="mt-0.5 block text-[11px] text-gedimmt">
                        Im Journal: {v.vorhanden.markt} {zeitKurz(v.vorhanden.entryTime)} ({v.vorhanden.status})
                        {v.aktion === 'aktualisieren' && ` → ${Object.entries(v.aenderung).map(([k, w]) => `${k} ${String(w)}`).join(', ')}`}
                      </span>
                    )}
                    {v.probleme.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-[11px] text-akzent">
                        {v.probleme.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                </label>
                {z.an && v.aktion === 'neu' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className={feld}>
                      Setup
                      <select className={`mt-1 ${EINGABE}`} value={z.strategieId} onChange={(ev) => zeileSetzen(i, { strategieId: ev.target.value })} aria-label="Setup">
                        <option value="">Setup wählen …</option>
                        {setups.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={feld}>
                      Zeitrahmen
                      <select className={`mt-1 ${EINGABE}`} value={z.zeitrahmen} onChange={(ev) => zeileSetzen(i, { zeitrahmen: ev.target.value as Zeitrahmen })} aria-label="Zeitrahmen">
                        {ZEITRAHMEN.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.text}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </section>
            )
          })}

          {zeilen.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={uebernehmen} className={KNOPF_AKZENT} disabled={!bereit}>
                {aktive.length} {aktive.length === 1 ? 'Position' : 'Positionen'} übernehmen
              </button>
              {unvollstaendig.length > 0 && <span className="text-xs text-gedimmt">Erst Setup wählen (und bei unbekanntem Markt den Eintrag von Hand anlegen).</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
