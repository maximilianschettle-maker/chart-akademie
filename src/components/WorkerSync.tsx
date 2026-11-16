import { CloudSync, LoaderCircle, RefreshCw } from 'lucide-react'
import { abgleichen, useWorkerSyncStatus } from '../data/workerSync'
import { useAktienStore } from '../aktien/store'
import { useSyncStore } from '../stores/syncStore'
import { ZugangHinweis } from '../zugang/ZugangHinweis'

const knopf = 'tipp inline-flex items-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white disabled:opacity-40'

/** Karte „Geräte-Sync“: Journal + Lernfortschritt laufen automatisch über den Worker (je Einladungscode). */
export function WorkerSync() {
  const code = useAktienStore((s) => s.code)
  const cloud = useSyncStore((s) => s.cloud)
  const setzen = useSyncStore((s) => s.setzen)
  const { aktiv, laeuft, fehler, letzterSync } = useWorkerSyncStatus()

  return (
    <div className="rounded-xl border border-rand bg-flaeche/50 p-4">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
        <CloudSync className="h-4 w-4 text-akzent" /> Geräte-Sync
      </h2>
      <p className="mt-1 text-xs text-gedimmt">
        Journal und Lernfortschritt wandern automatisch zwischen deinen Geräten – über deinen Einladungscode, ohne Repository. Beides führt
        zusammen, es geht nichts verloren.
      </p>
      {!code.trim() ? (
        <p className="mt-3 text-xs">
          <ZugangHinweis nachsatz=" – dann läuft der Sync von selbst." />
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 text-gedimmt">
              <input type="checkbox" checked={cloud} onChange={(e) => setzen({ cloud: e.target.checked })} /> Sync an
            </label>
            <button type="button" className={knopf} onClick={() => void abgleichen(true)} disabled={!cloud || laeuft}>
              {laeuft ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Jetzt abgleichen
            </button>
            <span className="text-gedimmt">
              {!cloud && 'Aus – Daten bleiben in diesem Browser.'}
              {cloud && laeuft && 'Gleicht ab …'}
              {cloud && !laeuft && fehler && <span className="text-short">{fehler}</span>}
              {cloud && !laeuft && !fehler && aktiv && letzterSync && `Zuletzt abgeglichen ${new Date(letzterSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`}
              {cloud && !laeuft && !fehler && !letzterSync && 'Noch nicht abgeglichen.'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
