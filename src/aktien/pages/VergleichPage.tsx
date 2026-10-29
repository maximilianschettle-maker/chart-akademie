import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { EINGABE, KNOPF, Meldung } from '../components/ui'
import { workerKonfiguriert } from '../data/client'
import { ladeFirma, ladeWechselkurse } from '../data/service'
import { syncStarten } from '../data/sync'
import { fmtZeitpunkt } from '../engine/format'
import { kennzahlen, type Kennzahlen } from '../engine/kennzahlen'
import { MAX_FIRMEN, VERGLEICH_GRUPPEN, besteSpalte, symboleAusText } from '../engine/vergleich'
import { betragUmrechnen, kursFuerKennzahlen, paarCode } from '../engine/waehrung'
import { useAktienStore } from '../store'
import type { Fundamentaldaten } from '../types'

interface Spalte {
  symbol: string
  daten: Fundamentaldaten | null
  k: Kennzahlen | null
  fehler: string | null
  laeuft: boolean
}

/** Mehrere Firmen nebeneinander; die Auswahl steht in der URL (?s=SAP.DE,AAPL), damit sie teilbar bleibt. */
export function VergleichPage() {
  const [params, setParams] = useSearchParams()
  const symbole = useMemo(() => symboleAusText(params.get('s') ?? ''), [params])
  const watchlist = useAktienStore((s) => s.watchlist)
  const [spalten, setSpalten] = useState<Record<string, Spalte>>({})
  const [eingabe, setEingabe] = useState('')
  const konfiguriert = workerKonfiguriert()
  const anzeigeWaehrung = useAktienStore((s) => s.vergleichsWaehrung)
  const einstellungenSetzen = useAktienStore((s) => s.einstellungenSetzen)
  const [wechselkurse, setWechselkurse] = useState<Record<string, number>>({})
  const [wechselkursFehler, setWechselkursFehler] = useState<string | null>(null)

  useEffect(() => syncStarten(), [])

  function symboleSetzen(neu: string[]) {
    setParams(neu.length > 0 ? { s: neu.join(',') } : {}, { replace: true })
  }
  function hinzufuegen(text: string) {
    const neu = symboleAusText([...symbole, ...symboleAusText(text)].join(','))
    symboleSetzen(neu)
    setEingabe('')
  }
  function entfernen(symbol: string) {
    symboleSetzen(symbole.filter((s) => s !== symbol))
  }

  // Jede Spalte einmal laden (Cache zuerst, sonst Worker); fehlgeschlagene bleiben mit Fehler stehen.
  useEffect(() => {
    let aktiv = true
    for (const symbol of symbole) {
      if (spalten[symbol]) continue
      setSpalten((s) => ({ ...s, [symbol]: { symbol, daten: null, k: null, fehler: null, laeuft: true } }))
      ladeFirma(symbol)
        .then((d) => {
          if (!aktiv) return
          const k = d ? kennzahlen(d.jahre, kursFuerKennzahlen(d), d.firma.waehrung) : null
          setSpalten((s) => ({ ...s, [symbol]: { symbol, daten: d, k, fehler: d ? null : 'Keine Daten', laeuft: false } }))
        })
        .catch((e: unknown) => {
          if (!aktiv) return
          setSpalten((s) => ({ ...s, [symbol]: { symbol, daten: null, k: null, fehler: e instanceof Error ? e.message : String(e), laeuft: false } }))
        })
    }
    return () => {
      aktiv = false
    }
    // spalten absichtlich nicht als Abhängigkeit: es geht nur um neue Symbole
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbole])

  const aktive = symbole.map((s) => spalten[s]).filter((s): s is Spalte => Boolean(s))

  // Wechselkurse für die Anzeige-Währung: je Spalte Kurs- und Berichtswährung
  const benoetigt = useMemo(() => {
    if (!anzeigeWaehrung) return [] as string[]
    const paare = new Set<string>()
    for (const s of aktive) {
      if (!s.daten) continue
      for (const w of [s.daten.kurs?.waehrung, s.daten.firma.waehrung]) if (w && w !== anzeigeWaehrung) paare.add(paarCode(w, anzeigeWaehrung))
    }
    return [...paare].filter((p) => !(p in wechselkurse))
    // wechselkurse absichtlich nicht als Abhängigkeit: es geht nur um fehlende Paare
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anzeigeWaehrung, aktive])
  useEffect(() => {
    if (benoetigt.length === 0) return
    let aktiv = true
    ladeWechselkurse(benoetigt)
      .then((r) => {
        if (!aktiv) return
        setWechselkurse((w) => ({ ...w, ...Object.fromEntries(Object.entries(r).map(([p, wk]) => [p, wk.kurs])) }))
        const fehlt = benoetigt.filter((p) => !r[p])
        setWechselkursFehler(fehlt.length > 0 ? `Kein Wechselkurs für ${fehlt.map((p) => `${p.slice(0, 3)}→${p.slice(3)}`).join(', ')}` : null)
      })
      .catch((e: unknown) => {
        if (aktiv) setWechselkursFehler(e instanceof Error ? e.message : String(e))
      })
    return () => {
      aktiv = false
    }
  }, [benoetigt])
  const mitDaten = aktive.filter((s) => s.daten && s.k)
  const nichtGewaehlt = watchlist.filter((w) => !symbole.includes(w.symbol))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/analyse/aktien" className="inline-flex items-center gap-1 text-xs text-gedimmt hover:text-schrift">
        <ArrowLeft className="h-3.5 w-3.5" /> Zur Watchlist
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-white">Firmenvergleich</h1>
      <p className="mt-1 text-sm text-gedimmt">Bis zu {MAX_FIRMEN} Firmen nebeneinander. Die beste Spalte je Zeile ist grün markiert. Beträge wahlweise in der Originalwährung oder mit Yahoo-Wechselkursen in EUR oder USD umgerechnet.</p>

      {!konfiguriert && <Meldung text="Worker-URL und Geheimnis fehlen — auf der Aktien-Seite eintragen." fehler />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {symbole.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-akzent/15 px-2 py-1 text-xs font-semibold text-akzent">
            {s}
            <button type="button" aria-label={`${s} entfernen`} onClick={() => entfernen(s)} className="rounded hover:bg-akzent/30">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {nichtGewaehlt.map((w) => (
          <button key={w.symbol} type="button" className={KNOPF} disabled={symbole.length >= MAX_FIRMEN} onClick={() => hinzufuegen(w.symbol)} title={w.name}>
            <Plus className="h-3 w-3" /> {w.symbol}
          </button>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (eingabe.trim()) hinzufuegen(eingabe)
          }}
        >
          <input className={`${EINGABE} w-40`} value={eingabe} onChange={(e) => setEingabe(e.target.value)} placeholder="Ticker, z.B. MSFT" spellCheck={false} disabled={symbole.length >= MAX_FIRMEN} />
          <button type="submit" className={KNOPF} disabled={!eingabe.trim() || symbole.length >= MAX_FIRMEN}>
            Hinzufügen
          </button>
        </form>
      </div>

      {symbole.length === 0 && <p className="mt-6 text-sm text-gedimmt">Wähle oben Firmen aus der Watchlist oder gib Ticker ein.</p>}

      {aktive.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gedimmt">
          <span>Beträge anzeigen in</span>
          {[
            ['', 'jeweiliger Währung'],
            ['EUR', 'EUR'],
            ['USD', 'USD'],
          ].map(([wert, titel]) => (
            <button
              key={wert}
              type="button"
              className={`rounded-md px-2 py-1 font-semibold ${anzeigeWaehrung === wert ? 'bg-akzent text-nacht' : 'bg-flaeche text-gedimmt hover:text-schrift'}`}
              onClick={() => einstellungenSetzen({ vergleichsWaehrung: wert })}
            >
              {titel}
            </button>
          ))}
          {wechselkursFehler && <span className="text-short">{wechselkursFehler}</span>}
        </div>
      )}

      {aktive.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-rand bg-flaeche">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-gedimmt">
                <th className="sticky left-0 bg-flaeche px-3 py-2 font-medium">Kennzahl</th>
                {aktive.map((s) => (
                  <th key={s.symbol} className="min-w-[7.5rem] px-3 py-2 align-top font-medium">
                    <Link to={`/analyse/aktien/${encodeURIComponent(s.symbol)}`} className="font-semibold text-white hover:text-akzent">
                      {s.symbol}
                    </Link>
                    <div className="truncate text-[11px] font-normal text-gedimmt" title={s.daten?.firma.name}>
                      {s.laeuft ? 'lädt …' : s.fehler ? <span className="text-short">{s.fehler}</span> : s.daten?.firma.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VERGLEICH_GRUPPEN.map((g) => (
                <Gruppe key={g.titel} titel={g.titel} spalten={aktive} zeilen={g.zeilen} anzeigeWaehrung={anzeigeWaehrung} wechselkurse={wechselkurse} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mitDaten.length > 0 && (
        <p className="mt-3 text-[11px] text-gedimmt">
          Kursbezogene Werte (KGV, KBV, KUV, EV/EBITDA, FCF-Rendite) werden bei abweichender Kurswährung mit dem Yahoo-Wechselkurs in die Berichtswährung umgerechnet. Datenstand {mitDaten.map((s) => `${s.symbol} ${fmtZeitpunkt(s.daten!.standAm)}`).join(' · ')}.
        </p>
      )}
    </div>
  )
}

function Gruppe({
  titel,
  spalten,
  zeilen,
  anzeigeWaehrung,
  wechselkurse,
}: {
  titel: string
  spalten: Spalte[]
  zeilen: (typeof VERGLEICH_GRUPPEN)[number]['zeilen']
  anzeigeWaehrung: string
  wechselkurse: Record<string, number>
}) {
  return (
    <>
      <tr>
        <td colSpan={spalten.length + 1} className="sticky left-0 px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-akzent">
          {titel}
        </td>
      </tr>
      {zeilen.map((z) => {
        // Beträge auf die Anzeige-Währung bringen; ohne Wechselkurs bleibt der Wert in Originalwährung
        const umgerechnet = anzeigeWaehrung && z.waehrung
        const werte = spalten.map((s) => {
          if (!s.daten || !s.k) return null
          const v = z.wert(s.daten, s.k)
          return umgerechnet ? betragUmrechnen(v, z.waehrung!(s.daten), anzeigeWaehrung, wechselkurse) ?? v : v
        })
        const vergleichbar = !z.waehrung || (umgerechnet && spalten.every((s) => !s.daten || z.waehrung!(s.daten) === anzeigeWaehrung || paarCode(z.waehrung!(s.daten), anzeigeWaehrung) in wechselkurse))
        const beste = vergleichbar ? besteSpalte(werte, z.richtung) : null
        return (
          <tr key={z.id} className="border-t border-rand/60">
            <td className="sticky left-0 whitespace-nowrap bg-flaeche px-3 py-1.5 text-schrift">
              {z.titel}
              {z.hinweis && <span className="ml-1 text-[10px] text-gedimmt">{z.hinweis}</span>}
            </td>
            {spalten.map((s, i) => (
              <td key={s.symbol} className={`px-3 py-1.5 ${beste === i ? 'bg-long/10 font-semibold text-long' : 'text-white'}`}>
                {s.daten ? z.format(werte[i], s.daten, umgerechnet && werte[i] !== null && (z.waehrung!(s.daten) === anzeigeWaehrung || paarCode(z.waehrung!(s.daten), anzeigeWaehrung) in wechselkurse) ? anzeigeWaehrung : undefined) : '–'}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}
