import { useState } from 'react'
import { Cloud, RefreshCw } from 'lucide-react'
import { statusPruefen } from '../data/service'
import { useAktienStore } from '../store'
import { EINGABE, KARTE, KNOPF, Meldung } from './ui'

/** Einstellungskarte: Worker-URL und Geheimnis (bleiben im Browser), Verbindungstest. */
export function WorkerEinstellungen({ offen }: { offen?: boolean }) {
  const workerUrl = useAktienStore((s) => s.workerUrl)
  const secret = useAktienStore((s) => s.secret)
  const setzen = useAktienStore((s) => s.einstellungenSetzen)
  const letzterSync = useAktienStore((s) => s.letzterSync)
  const [zeige, setZeige] = useState(Boolean(offen))
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  async function pruefen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const s = await statusPruefen()
      const probleme = [s.yahoo !== 'ok' && `Yahoo: ${s.yahoo}`, s.sec !== 'ok' && `SEC: ${s.sec}`].filter(Boolean)
      setMeldung(probleme.length ? { text: `Worker ${s.version} erreichbar, aber ${probleme.join(' · ')}`, fehler: true } : { text: `Verbunden — Worker ${s.version}, Yahoo und SEC erreichbar.` })
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : String(e), fehler: true })
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className={`${KARTE} bg-flaeche/50`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          <Cloud className="h-4 w-4 text-akzent" /> Daten-Worker
        </h3>
        <button type="button" className="text-xs text-akzent hover:underline" onClick={() => setZeige((z) => !z)}>
          {zeige ? 'Einklappen' : 'Einstellungen'}
        </button>
      </div>
      <p className="mt-1 text-xs text-gedimmt">
        Kurse, Profile und Bilanzen kommen über deinen eigenen Cloudflare Worker (SEC EDGAR + Yahoo). URL und Geheimnis bleiben in diesem Browser.
        {letzterSync && ` Letzter Abgleich: ${new Date(letzterSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`}
      </p>
      {zeige && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gedimmt">
              Worker-URL
              <input className={`mt-1 ${EINGABE}`} value={workerUrl} onChange={(e) => setzen({ workerUrl: e.target.value })} placeholder="https://chart-akademie-aktien.<konto>.workers.dev" spellCheck={false} />
            </label>
            <label className="text-xs text-gedimmt">
              Geheimnis (AKTIEN_SECRET)
              <input className={`mt-1 ${EINGABE}`} type="password" value={secret} onChange={(e) => setzen({ secret: e.target.value })} autoComplete="off" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={KNOPF} onClick={pruefen} disabled={laeuft}>
              <RefreshCw className={`h-3.5 w-3.5 ${laeuft ? 'animate-spin' : ''}`} /> Verbindung prüfen
            </button>
          </div>
          {meldung && <Meldung text={meldung.text} fehler={meldung.fehler} />}
        </>
      )}
    </div>
  )
}
