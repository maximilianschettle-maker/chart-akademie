import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useSimulatorStore } from '../stores/simulatorStore'
import { useProgressStore } from '../stores/progressStore'
import { istSicherung, sicherungErstellen, sicherungZusammenfuehren } from '../engine/sicherung'

// Export/Import des Nutzerstands als JSON — der Weg zwischen PC und Handy,
// solange es kein Backend gibt. Import mergt, überschreibt also nichts.

export function DatenSicherung() {
  const tradeHistorie = useSimulatorStore((s) => s.tradeHistorie)
  const tradesImportieren = useSimulatorStore((s) => s.tradesImportieren)
  const abgeschlosseneLektionen = useProgressStore((s) => s.abgeschlosseneLektionen)
  const szenarioErgebnisse = useProgressStore((s) => s.szenarioErgebnisse)
  const wiederholungen = useProgressStore((s) => s.wiederholungen)
  const fortschrittImportieren = useProgressStore((s) => s.importieren)
  const dateiRef = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)

  function exportieren() {
    const s = sicherungErstellen(tradeHistorie, { abgeschlosseneLektionen, szenarioErgebnisse, wiederholungen })
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chartakademie-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMeldung({ text: `Exportiert: ${tradeHistorie.length} Trades, ${Object.keys(abgeschlosseneLektionen).length} Lektionen.` })
  }

  async function importieren(datei: File) {
    try {
      const daten: unknown = JSON.parse(await datei.text())
      if (!istSicherung(daten)) {
        setMeldung({ text: 'Das ist keine ChartAkademie-Sicherung.', fehler: true })
        return
      }
      const r = sicherungZusammenfuehren(
        { tradeHistorie, fortschritt: { abgeschlosseneLektionen, szenarioErgebnisse, wiederholungen } },
        daten,
      )
      tradesImportieren(r.tradeHistorie)
      fortschrittImportieren(r.fortschritt)
      setMeldung({
        text: `Importiert und zusammengeführt: ${r.neueTrades} neue Trades, jetzt ${Object.keys(r.fortschritt.abgeschlosseneLektionen).length} abgeschlossene Lektionen.`,
      })
    } catch {
      setMeldung({ text: 'Datei konnte nicht gelesen werden.', fehler: true })
    }
  }

  const knopf =
    'inline-flex items-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white'

  return (
    <div className="rounded-xl border border-rand bg-flaeche/50 p-4">
      <h2 className="text-sm font-semibold text-white">Daten sichern & übertragen</h2>
      <p className="mt-1 text-xs text-gedimmt">
        Fortschritt, Wiederholungs-Box und Journal liegen nur in diesem Browser. Als Datei exportieren und
        auf dem anderen Gerät importieren — der Import führt zusammen, nichts geht verloren.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={exportieren} className={knopf}>
          <Download className="h-3.5 w-3.5" /> Exportieren (JSON)
        </button>
        <button onClick={() => dateiRef.current?.click()} className={knopf}>
          <Upload className="h-3.5 w-3.5" /> Importieren
        </button>
        <input
          ref={dateiRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importieren(f)
            e.target.value = ''
          }}
        />
      </div>
      {meldung && (
        <p className={`mt-2 text-xs ${meldung.fehler ? 'text-short' : 'text-long'}`}>{meldung.text}</p>
      )}
    </div>
  )
}
