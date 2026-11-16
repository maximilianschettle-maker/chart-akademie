import { useState } from 'react'
import { KeyRound, RefreshCw } from 'lucide-react'
import { KARTE, KNOPF, Meldung } from '../aktien/components/ui'
import { statusPruefen } from '../aktien/data/service'
import { useAktienStore } from '../aktien/store'
import { codeMaskieren } from './code'
import { CodeEingabe } from './CodeEingabe'
import { useZugangStore } from './ich'

const ROLLEN: Record<string, string> = { admin: 'Admin', nutzer: 'Nutzer', dienst: 'Dienst-Token' }

/** Karte „Zugang“: ohne Code die Eingabe, mit Code Name, Rolle, KI-Verbrauch und Verbindungstest. */
export function ZugangKarte({ kompakt }: { kompakt?: boolean }) {
  const code = useAktienStore((s) => s.code)
  const letzterSync = useAktienStore((s) => s.letzterSync)
  const setzen = useAktienStore((s) => s.einstellungenSetzen)
  const ich = useZugangStore((s) => s.ich)
  const status = useZugangStore((s) => s.status)
  const zugangFehler = useZugangStore((s) => s.fehler)
  const willkommen = useZugangStore((s) => s.willkommen)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  async function pruefen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const s = await statusPruefen()
      const probleme = [s.yahoo !== 'ok' && `Yahoo: ${s.yahoo}`, s.sec !== 'ok' && `SEC: ${s.sec}`].filter(Boolean)
      setMeldung(probleme.length ? { text: `Worker ${s.version} erreichbar, aber ${probleme.join(' · ')}`, fehler: true } : { text: `Verbunden — Worker ${s.version}, Yahoo und SEC erreichbar.` })
      void useZugangStore.getState().pruefen()
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : String(e), fehler: true })
    } finally {
      setLaeuft(false)
    }
  }

  if (!code.trim()) {
    return (
      <div className={`${KARTE} border-akzent/40`}>
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-akzent" /> Zugang einrichten
        </h3>
        <p className="mt-1 text-xs text-gedimmt">
          Mit Einladungscode: Kurse und Bilanzen, KI-Coach, Geräte-Sync für Journal und Lernfortschritt, Push bei Zinsentscheiden. Ohne Code laufen Lernpfad,
          Simulator, Übungen und das Journal lokal in diesem Browser.
        </p>
        <CodeEingabe />
      </div>
    )
  }

  const ki = ich?.ki
  return (
    <div className={`${KARTE} bg-flaeche/50`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-akzent" /> Zugang
        </h3>
        <span className="font-mono text-xs text-gedimmt">{codeMaskieren(code)}</span>
      </div>
      <p className="mt-1 text-xs text-gedimmt">
        {status === 'prueft' && 'Code wird geprüft …'}
        {status === 'ok' && ich && (
          <>
            {ich.name} · {ROLLEN[ich.rolle] ?? ich.rolle}
            {ki && ` · KI heute ${ki.heute}${ki.limit === null ? '' : ` von ${ki.limit}`}`}
            {letzterSync && ` · letzter Abgleich ${new Date(letzterSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
          </>
        )}
        {status === 'fehler' && <span className="text-short">{zugangFehler}</span>}
        {status === 'unbekannt' && 'Code gespeichert.'}
      </p>
      {willkommen && ich && <Meldung text={`Willkommen, ${ich.name}! Kurse, KI-Coach, Geräte-Sync und Push sind jetzt an.`} />}
      {ich?.rolle === 'dienst' && (
        <Meldung text="Hier steckt noch das alte Worker-Geheimnis (Dienst-Token). Bitte „Code entfernen“ und den Admin-Code eintragen." fehler />
      )}
      {!kompakt && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={KNOPF} onClick={pruefen} disabled={laeuft}>
              <RefreshCw className={`h-3.5 w-3.5 ${laeuft ? 'animate-spin' : ''}`} /> Verbindung prüfen
            </button>
            <button
              type="button"
              className={KNOPF}
              onClick={() => {
                if (window.confirm('Code aus diesem Browser entfernen? Deine Daten im Worker bleiben erhalten.')) {
                  setzen({ code: '' })
                  useZugangStore.getState().zuruecksetzen()
                }
              }}
            >
              Code entfernen
            </button>
          </div>
          {meldung && <Meldung text={meldung.text} fehler={meldung.fehler} />}
        </>
      )}
    </div>
  )
}
