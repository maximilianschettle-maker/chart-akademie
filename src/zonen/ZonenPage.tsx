import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bell, BellOff, ChevronDown, ChevronUp, Cloud, CloudOff, Eye, EyeOff, LoaderCircle, Pencil, RefreshCw, Target, Trash2, TriangleAlert } from 'lucide-react'
import { HandelsChart, type ChartBand, type ChartLinie } from '../components/chart/HandelsChart'
import { chartHoehe, useSchmal } from '../hooks/useSchmal'
import { fmtPreis } from '../engine/format'
import { codeVorhanden } from '../aktien/data/client'
import { fmtStand } from '../tracker/format'
import { ALARM_TEXT, alarmNachricht } from './alarm'
import { ladeZonenKerzen, type ZonenKerzen } from './daten'
import { neueZone, TYP_TEXT, zonenBreiteProzent, zonenSpanne, zonenTitel } from './engine'
import { useZonenStore } from './store'
import { ANNAEHERUNG_MAX, ANNAEHERUNG_MIN, NOTIZ_MAX, ZONEN_MAERKTE, ZONEN_MARKT_NACH_ID, ZONEN_MAX, ZONEN_ZEITEINHEITEN, type PreisZone, type ZonenTyp, type ZonenZeiteinheit } from './types'

// Preiszonen: je Markt Bänder in den Chart ziehen (Unter- und Oberkante), anpassen, ein-/ausblenden,
// Alarm je Zone an/aus. Die ausgewählte Zone hat zwei ziehbare Kanten im Chart und ihr Formular
// direkt unter dem Chart (am Handy ohne Scrollen zwischen Liste und Chart).

const FARBEN: Record<ZonenTyp, { fuellung: string; rand: string; text: string }> = {
  support: { fuellung: 'rgba(34, 197, 94, 0.13)', rand: 'rgba(34, 197, 94, 0.75)', text: 'text-long' },
  resistance: { fuellung: 'rgba(239, 68, 68, 0.13)', rand: 'rgba(239, 68, 68, 0.75)', text: 'text-short' },
}
const NACHLADEN_MS = 5 * 60_000
const ALARME_SICHTBAR = 8

/** Ist auf diesem Gerät Push eingeschaltet? null = noch unbekannt bzw. vom Browser nicht unterstützt */
function usePushAn(): boolean | null {
  const [an, setAn] = useState<boolean | null>(null)
  useEffect(() => {
    let aktuell = true
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => aktuell && setAn(Boolean(sub)))
      .catch(() => {})
    return () => {
      aktuell = false
    }
  }, [])
  return an
}
const INDIKATOREN = { ema: [], rsi: false, volumen: false }

const chip = (aktiv: boolean) =>
  `tipp rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${aktiv ? 'bg-akzent text-nacht' : 'bg-flaeche text-gedimmt hover:text-schrift'}`
const symbolKnopf = 'tipp inline-flex min-w-11 items-center justify-center rounded-lg px-2.5 text-gedimmt hover:bg-nacht hover:text-white sm:min-w-0 sm:py-1.5'
const eingabe = 'w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-white outline-none focus:border-akzent'

function einheitText(id: ZonenZeiteinheit): string {
  return ZONEN_ZEITEINHEITEN.find((e) => e.id === id)?.text ?? id
}

/** Zahlenfeld, das erst beim Verlassen (oder Enter) übernimmt – sonst springt die Zone bei jedem Tastendruck */
function PreisFeld({ wert, onWert, label, klasse = 'block' }: { wert: number; onWert: (n: number) => void; label: string; klasse?: string }) {
  const [text, setText] = useState(String(wert))
  const [vorher, setVorher] = useState(wert)
  if (vorher !== wert) {
    setVorher(wert)
    setText(String(wert))
  }
  const uebernehmen = () => {
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && n > 0 && n !== wert) onWert(n)
    else setText(String(wert))
  }
  return (
    <label className={`${klasse} text-xs text-gedimmt`}>
      {label}
      <input
        className={`${eingabe} mt-1 tabular-nums`}
        inputMode="decimal"
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onBlur={uebernehmen}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') ev.currentTarget.blur()
        }}
      />
    </label>
  )
}

function ZonenFormular({ zone, onSchliessen }: { zone: PreisZone; onSchliessen: () => void }) {
  const aendern = useZonenStore((s) => s.aendern)
  const loeschen = useZonenStore((s) => s.loeschen)
  const [loeschFrage, setLoeschFrage] = useState(false)
  return (
    <div className="space-y-3 rounded-xl border border-akzent/40 bg-flaeche p-3" data-test="zonen-formular">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">
          Zone bearbeiten <span className={`ml-1 font-semibold ${FARBEN[zone.typ].text}`}>{zonenSpanne(zone)}</span>
        </h2>
        <button type="button" onClick={onSchliessen} className="tipp rounded-lg px-3 text-xs font-semibold text-gedimmt hover:text-white">
          Fertig
        </button>
      </div>
      <p className="text-[11px] text-gedimmt">Kanten im Chart ziehen oder hier eintragen. Breite {zonenBreiteProzent(zone).toFixed(2).replace('.', ',')} %.</p>
      <div className="grid grid-cols-2 gap-2">
        <PreisFeld label="Unterkante" wert={zone.von} onWert={(von) => aendern(zone.id, { von })} />
        <PreisFeld label="Oberkante" wert={zone.bis} onWert={(bis) => aendern(zone.id, { bis })} />
      </div>
      <div>
        <div className="mb-1 text-xs text-gedimmt">Typ</div>
        <div className="flex gap-1.5">
          {(['support', 'resistance'] as const).map((t) => (
            <button key={t} type="button" className={chip(zone.typ === t).replace('bg-flaeche', 'bg-nacht')} aria-pressed={zone.typ === t} onClick={() => aendern(zone.id, { typ: t })}>
              {TYP_TEXT[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs text-gedimmt">Zeiteinheit (auf dieser Kerze gilt die Zone als gebrochen)</div>
        <div className="flex flex-wrap gap-1.5">
          {ZONEN_ZEITEINHEITEN.map((e) => (
            <button key={e.id} type="button" className={chip(zone.zeiteinheit === e.id).replace('bg-flaeche', 'bg-nacht')} aria-pressed={zone.zeiteinheit === e.id} onClick={() => aendern(zone.id, { zeiteinheit: e.id })}>
              {e.text}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-xs text-gedimmt">
        Notiz
        <textarea
          className={`${eingabe} mt-1 min-h-16`}
          value={zone.notiz}
          maxLength={NOTIZ_MAX}
          placeholder="z.B. Tagestief vom Montag, dreimal gehalten"
          onChange={(ev) => aendern(zone.id, { notiz: ev.target.value })}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(zone.alarm).replace('bg-flaeche', 'bg-nacht')} aria-pressed={zone.alarm} onClick={() => aendern(zone.id, { alarm: !zone.alarm })}>
          <span className="inline-flex items-center gap-1.5">{zone.alarm ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />} Alarm {zone.alarm ? 'an' : 'aus'}</span>
        </button>
        <button type="button" className={chip(zone.sichtbar).replace('bg-flaeche', 'bg-nacht')} aria-pressed={zone.sichtbar} onClick={() => aendern(zone.id, { sichtbar: !zone.sichtbar })}>
          <span className="inline-flex items-center gap-1.5">{zone.sichtbar ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {zone.sichtbar ? 'Im Chart' : 'Ausgeblendet'}</span>
        </button>
        <span className="flex-1" />
        {loeschFrage ? (
          <>
            <button type="button" className="tipp rounded-lg bg-short px-3 py-1.5 text-xs font-semibold text-white" onClick={() => loeschen(zone.id)}>
              Wirklich löschen
            </button>
            <button type="button" className="tipp rounded-lg px-3 py-1.5 text-xs font-semibold text-gedimmt hover:text-white" onClick={() => setLoeschFrage(false)}>
              Abbrechen
            </button>
          </>
        ) : (
          <button type="button" className="tipp inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-short hover:bg-nacht" onClick={() => setLoeschFrage(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Löschen
          </button>
        )}
      </div>
    </div>
  )
}

export function ZonenPage() {
  const schmal = useSchmal()
  const markt = useZonenStore((s) => s.markt)
  const zeiteinheit = useZonenStore((s) => s.zeiteinheit)
  const ansichtSetzen = useZonenStore((s) => s.ansichtSetzen)
  const alleZonen = useZonenStore((s) => s.zonen)
  const hinzu = useZonenStore((s) => s.hinzu)
  const aendern = useZonenStore((s) => s.aendern)
  const annaeherung = useZonenStore((s) => s.annaeherungProzent)
  const annaeherungSetzen = useZonenStore((s) => s.annaeherungSetzen)
  const sync = useZonenStore((s) => s.sync)
  const syncFehler = useZonenStore((s) => s.syncFehler)
  const alarme = useZonenStore((s) => s.status.alarme)
  const abgleichen = useZonenStore((s) => s.abgleichen)
  const statusLaden = useZonenStore((s) => s.statusLaden)
  const pushAn = usePushAn()
  const [params, setParams] = useSearchParams()

  const marktDef = ZONEN_MARKT_NACH_ID[markt]
  const einheit = ZONEN_ZEITEINHEITEN.find((e) => e.id === zeiteinheit) ?? ZONEN_ZEITEINHEITEN[1]
  const schluessel = `${markt}|${einheit.id}`
  const [geladen, setGeladen] = useState<{ schluessel: string; daten: ZonenKerzen } | null>(null)
  const [fehler, setFehler] = useState<{ schluessel: string; text: string } | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [zeichnen, setZeichnen] = useState(false)
  const [aktivId, setAktivId] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  // Kanten der ausgewählten Zone, während sie gezogen werden
  const [zug, setZug] = useState<{ id: string; von: number; bis: number } | null>(null)
  const mitCode = codeVorhanden()

  const laden = useCallback(
    async (frisch: boolean) => {
      if (!codeVorhanden()) return
      setLaedt(true)
      try {
        const daten = await ladeZonenKerzen(marktDef.symbol, einheit, frisch)
        setGeladen({ schluessel, daten })
        setFehler(null)
      } catch (e) {
        setFehler({ schluessel, text: e instanceof Error ? e.message : String(e) })
      } finally {
        setLaedt(false)
      }
    },
    [marktDef.symbol, einheit, schluessel],
  )

  useEffect(() => {
    laden(false)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') laden(false)
    }, NACHLADEN_MS)
    return () => clearInterval(timer)
  }, [laden])

  // Zonen mit dem Worker abgleichen (von dort liest die Action), Alarm-Status mitlesen
  useEffect(() => {
    abgleichen()
    statusLaden()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') statusLaden()
    }, NACHLADEN_MS)
    return () => clearInterval(timer)
  }, [abgleichen, statusLaden])

  // Push-Link „…/zonen?zone=<id>“: Markt und Zone auswählen, sobald die Zone (ggf. nach dem Abgleich) da ist
  const zielId = params.get('zone')
  const ziel = zielId ? alleZonen.find((z) => z.id === zielId) : undefined
  useEffect(() => {
    if (!ziel) return
    ansichtSetzen({ markt: ziel.markt })
    setAktivId(ziel.id)
    setParams({}, { replace: true })
  }, [ziel, ansichtSetzen, setParams])

  const daten = geladen?.schluessel === schluessel ? geladen.daten : null
  const kerzen = daten?.kerzen
  const kurs = kerzen?.length ? kerzen[kerzen.length - 1].close : 0
  const zonen = useMemo(() => alleZonen.filter((z) => z.markt === markt).sort((a, b) => b.bis - a.bis), [alleZonen, markt])
  const aktiv = zonen.find((z) => z.id === aktivId) ?? null

  const baender = useMemo(
    (): ChartBand[] =>
      zonen
        .filter((z) => z.sichtbar || z.id === aktivId)
        .map((z) => {
          const kanten = zug?.id === z.id ? zug : z
          return {
            id: z.id,
            von: Math.min(kanten.von, kanten.bis),
            bis: Math.max(kanten.von, kanten.bis),
            fuellung: FARBEN[z.typ].fuellung,
            rand: FARBEN[z.typ].rand,
            titel: zonenTitel(z),
            aktiv: z.id === aktivId,
          }
        }),
    [zonen, aktivId, zug],
  )

  const linien = useMemo((): ChartLinie[] => {
    if (!aktiv) return []
    const kanten = zug?.id === aktiv.id ? zug : aktiv
    const farbe = FARBEN[aktiv.typ].rand
    return [
      { id: 'zone-bis', preis: kanten.bis, farbe, titel: 'Oberkante', ziehbar: true, fest: true, imBlick: true },
      { id: 'zone-von', preis: kanten.von, farbe, titel: 'Unterkante', ziehbar: true, fest: true, imBlick: true },
    ]
  }, [aktiv, zug])

  const kanteZiehen = (id: string, preis: number) => {
    if (!aktiv) return
    const basis = zug?.id === aktiv.id ? zug : { id: aktiv.id, von: aktiv.von, bis: aktiv.bis }
    setZug(id === 'zone-bis' ? { ...basis, bis: preis } : { ...basis, von: preis })
  }
  const kanteLos = (id: string, preis: number) => {
    if (!aktiv) return
    const basis = zug?.id === aktiv.id ? zug : { von: aktiv.von, bis: aktiv.bis }
    const neu = id === 'zone-bis' ? { von: basis.von, bis: preis } : { von: preis, bis: basis.bis }
    aendern(aktiv.id, neu)
    setZug(null)
  }

  const bandNeu = (von: number, bis: number) => {
    const z = neueZone(markt, einheit.id, von, bis, kurs, Date.now())
    if (!hinzu(z)) {
      setMeldung(`Mehr als ${ZONEN_MAX} Zonen gehen nicht – lösche zuerst alte.`)
      return
    }
    setMeldung(null)
    setZeichnen(false)
    setAktivId(z.id)
  }

  const wechsel = (teil: { markt?: typeof markt; zeiteinheit?: ZonenZeiteinheit }) => {
    ansichtSetzen(teil)
    if (teil.markt) setAktivId(null)
    setZug(null)
  }

  const hoehe = chartHoehe(schmal, 460, 380)
  const fehlerText = fehler?.schluessel === schluessel ? fehler.text : null

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      {/* Kopf bewusst knapp: am Handy soll der Chart ohne Scrollen im Bild sein */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Target className="h-6 w-6 text-akzent" /> Preiszonen
        </h1>
        <button onClick={() => laden(true)} className="tipp inline-flex min-w-11 items-center justify-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white" disabled={laedt} aria-label="Kurse aktualisieren">
          {laedt ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} <span className="hidden sm:inline">Aktualisieren</span>
        </button>
      </div>
      <p className="mt-1 hidden text-gedimmt sm:block">Eigene Zonen in den Chart ziehen. Erreicht der Kurs eine Zone, kommt ein Alarm aufs Handy.</p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Markt">
        {ZONEN_MAERKTE.map((m) => {
          const anzahl = alleZonen.filter((z) => z.markt === m.id).length
          return (
            <button key={m.id} type="button" className={chip(markt === m.id)} aria-pressed={markt === m.id} onClick={() => wechsel({ markt: m.id })}>
              {m.name}
              {anzahl > 0 && <span className="ml-1 opacity-70">{anzahl}</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Zeiteinheit">
        {ZONEN_ZEITEINHEITEN.map((e) => (
          <button key={e.id} type="button" className={chip(zeiteinheit === e.id)} aria-pressed={zeiteinheit === e.id} onClick={() => wechsel({ zeiteinheit: e.id })}>
            {e.text}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          className={`tipp inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border ${zeichnen ? 'border-akzent bg-akzent text-nacht' : 'border-akzent/60 text-akzent hover:bg-akzent/10'}`}
          aria-pressed={zeichnen}
          disabled={!kerzen}
          onClick={() => setZeichnen((z) => !z)}
        >
          <Pencil className="h-3.5 w-3.5" /> Zone einzeichnen
        </button>
      </div>

      {/* feste Höhe für zwei Zeilen: der Chart darf unter dem Finger nicht springen, wenn der Hinweis wechselt */}
      <p className={`mt-2 h-8 overflow-hidden text-[11px] leading-4 ${zeichnen ? 'text-akzent' : 'text-gedimmt'}`}>
        {zeichnen
          ? 'Im Chart von einer Kante zur anderen ziehen und loslassen. Abbrechen: Knopf erneut antippen.'
          : aktiv
            ? 'Kanten im Chart ziehen. Tipp auf eine andere Zone wählt sie aus.'
            : `${marktDef.hinweis ?? ''}${kurs ? ` Kurs ${fmtPreis(kurs)}${daten ? ` · Stand ${fmtStand(new Date(daten.standAm).toISOString())}` : ''}` : ''}`}
      </p>

      <div className="mt-1" data-test="zonen-chart">
        {!mitCode ? (
          <div className="rounded-xl border border-rand bg-flaeche p-6 text-center text-sm text-gedimmt">
            Für die Kursdaten braucht es einen Einladungscode.{' '}
            <Link to="/zugang" className="text-akzent underline">
              Zugang einrichten
            </Link>
          </div>
        ) : kerzen && kerzen.length > 0 ? (
          <HandelsChart
            key={schluessel}
            candles={kerzen}
            cursor={kerzen.length - 1}
            hoehe={hoehe}
            bucketSek={daten?.bucketSek}
            indikatoren={INDIKATOREN}
            baender={baender}
            bandZeichnen={zeichnen}
            onBandNeu={bandNeu}
            onBandTipp={setAktivId}
            linien={linien}
            onLinieZiehen={kanteZiehen}
            onLinieLos={kanteLos}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-rand bg-flaeche text-sm text-gedimmt" style={{ height: hoehe }}>
            {fehlerText ? (
              <span className="inline-flex items-center gap-2 px-4 text-center text-short">
                <TriangleAlert className="h-4 w-4 shrink-0" /> {fehlerText}
              </span>
            ) : (
              <LoaderCircle className="h-6 w-6 animate-spin" />
            )}
          </div>
        )}
      </div>
      {daten?.ersatz && <p className="mt-1 text-[11px] text-gedimmt">Kurze Historie: Der Daten-Worker kennt die Zonen-Zeiträume noch nicht (Worker-Deploy offen).</p>}
      {daten?.veraltet && <p className="mt-1 text-[11px] text-akzent">Kursquelle nicht erreichbar – letzter bekannter Stand.</p>}
      {kerzen && fehlerText && <p className="mt-1 text-[11px] text-short">{fehlerText}</p>}
      {meldung && <p className="mt-2 text-xs text-short">{meldung}</p>}

      {aktiv && (
        <div className="mt-3">
          <ZonenFormular key={aktiv.id} zone={aktiv} onSchliessen={() => setAktivId(null)} />
        </div>
      )}

      <h2 className="mt-6 text-sm font-bold text-white">
        Zonen {marktDef.name} <span className="font-normal text-gedimmt">({zonen.length})</span>
      </h2>
      {zonen.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-rand p-4 text-sm text-gedimmt">
          Noch keine Zone für {marktDef.name}. „Zone einzeichnen“ antippen und im Chart ein Band aufziehen.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5" data-test="zonen-liste">
          {zonen.map((z) => {
            const offen = z.id === aktivId
            const lage = kurs > 0 ? (kurs > z.bis ? ((kurs - z.bis) / kurs) * 100 : kurs < z.von ? ((z.von - kurs) / kurs) * -100 : 0) : null
            return (
              <li key={z.id} className={`flex items-stretch rounded-xl border bg-flaeche ${offen ? 'border-akzent/60' : 'border-rand'}`}>
                <button type="button" className="tipp min-w-0 flex-1 px-3 py-2 text-left" aria-expanded={offen} onClick={() => setAktivId(offen ? null : z.id)}>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-xs font-bold ${FARBEN[z.typ].text}`}>{TYP_TEXT[z.typ]}</span>
                    <span className="text-sm font-semibold tabular-nums text-white">{zonenSpanne(z)}</span>
                    <span className="text-[11px] text-gedimmt">
                      {einheitText(z.zeiteinheit)}
                      {lage !== null && ` · ${lage === 0 ? 'Kurs in der Zone' : `${Math.abs(lage).toFixed(2).replace('.', ',')} % ${lage > 0 ? 'unter' : 'über'} dem Kurs`}`}
                    </span>
                  </span>
                  {z.notiz && <span className="mt-0.5 block truncate text-xs text-gedimmt">{z.notiz}</span>}
                </button>
                <button type="button" className={symbolKnopf} aria-pressed={z.alarm} aria-label={z.alarm ? 'Alarm ausschalten' : 'Alarm einschalten'} title={z.alarm ? 'Alarm an' : 'Alarm aus'} onClick={() => aendern(z.id, { alarm: !z.alarm })}>
                  {z.alarm ? <Bell className="h-4 w-4 text-akzent" /> : <BellOff className="h-4 w-4" />}
                </button>
                <button type="button" className={symbolKnopf} aria-pressed={z.sichtbar} aria-label={z.sichtbar ? 'Im Chart ausblenden' : 'Im Chart einblenden'} title={z.sichtbar ? 'Im Chart sichtbar' : 'Ausgeblendet'} onClick={() => aendern(z.id, { sichtbar: !z.sichtbar })}>
                  {z.sichtbar ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <span className="flex items-center pr-2 text-gedimmt">{offen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
              </li>
            )
          })}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-bold text-white">Letzte Alarme</h2>
      {alarme.length === 0 ? (
        <p className="mt-2 text-xs text-gedimmt">Noch kein Alarm ausgelöst.</p>
      ) : (
        <ul className="mt-2 divide-y divide-rand rounded-xl border border-rand bg-flaeche" data-test="zonen-alarme">
          {alarme.slice(0, ALARME_SICHTBAR).map((a) => {
            const n = alarmNachricht(a)
            const gibtEs = alleZonen.some((z) => z.id === a.zoneId)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className="tipp w-full px-3 py-2 text-left disabled:cursor-default"
                  disabled={!gibtEs}
                  onClick={() => {
                    wechsel({ markt: a.markt })
                    setAktivId(a.zoneId)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-xs font-bold ${a.art === 'gebrochen' ? 'text-short' : 'text-akzent'}`}>{ALARM_TEXT[a.art]}</span>
                    <span className="text-sm font-semibold text-white">{n.titel}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gedimmt">
                    {fmtStand(new Date(a.zeit).toISOString())} · {n.text}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-bold text-white">Alarm-Einstellungen</h2>
      <div className="mt-2 space-y-3 rounded-xl border border-rand bg-flaeche p-3 text-xs text-gedimmt">
        <div className="flex items-end gap-3">
          <PreisFeld klasse="block w-28 shrink-0" label="„Nähert sich“ ab (%)" wert={annaeherung} onWert={annaeherungSetzen} />
          <p className="pb-1">
            Abstand zur Zone, ab dem „Nähert sich“ meldet ({String(ANNAEHERUNG_MIN).replace('.', ',')}–{ANNAEHERUNG_MAX} %). Gilt für alle Zonen.
          </p>
        </div>
        <p>
          Je Zone drei Alarme: <strong className="text-schrift">Nähert sich</strong>, <strong className="text-schrift">In der Zone</strong> und <strong className="text-schrift">Gebrochen</strong> (eine Kerze der
          Zeiteinheit schließt jenseits der Zone). Je Eintritt ein Alarm; neu scharf erst, wenn der Kurs die Zone wieder verlassen hat. Eine neue oder verschobene Zone meldet erst die nächste Änderung.
        </p>
        <p>Geprüft wird alle 15 Minuten: Bitcoin rund um die Uhr, die anderen Märkte Mo–Fr von morgens bis kurz vor Mitternacht.</p>
        {pushAn === false && (
          <p className="inline-flex items-start gap-1.5 text-akzent">
            <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Auf diesem Gerät sind Benachrichtigungen aus.{' '}
              <Link to="/analyse/makro" className="underline">
                Unter Makro einschalten
              </Link>
              , sonst erscheinen Alarme nur hier in der Liste.
            </span>
          </p>
        )}
        <p className="inline-flex items-center gap-1.5" data-test="zonen-sync">
          {sync === 'synchron' && (
            <>
              <Cloud className="h-3.5 w-3.5 text-long" /> Zonen gespeichert – Alarme sind aktiv
            </>
          )}
          {sync === 'laedt' && (
            <>
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Gleiche ab …
            </>
          )}
          {sync === 'kein-worker' && (
            <>
              <CloudOff className="h-3.5 w-3.5" /> Ohne Einladungscode bleiben die Zonen auf diesem Gerät, Alarme gibt es dann nicht
            </>
          )}
          {sync === 'fehler' && (
            <>
              <CloudOff className="h-3.5 w-3.5 text-short" /> Abgleich fehlgeschlagen: {syncFehler}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
