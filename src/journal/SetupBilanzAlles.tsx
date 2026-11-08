import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSimulatorStore } from '../stores/simulatorStore'
import { useProgressStore } from '../stores/progressStore'
import { useTopDownStore } from '../topdown/store'
import { useJournalStore } from './store'
import { logischeTrades } from '../engine/auswertung'
import { fmtR } from '../engine/format'
import { strategieName, STRATEGIEN } from '../content/strategien'
import { geschlosseneAlsTrades } from './engine'
import { einordnung, MIN_TRADES_AUSSAGE, QUELLE_TEXT, QUELLEN, setupBilanz, type BilanzPunkt, type BilanzZelle } from './setupBilanz'

// Reiter „Setups“: Erwartungswert je Setup über alle Quellen – echte Trades, Simulator, Übungen
// (jeder Durchlauf, auch Zufalls-Übungen), Top-Down-Replays. Antwort auf die Frage, womit du
// tatsächlich Geld verdienst – nicht, welches Setup im Kurs am schönsten aussieht.

function Wert({ z }: { z: BilanzZelle | undefined }) {
  if (!z) return <td className="px-2 py-1.5 text-right text-gedimmt">–</td>
  const farbe = z.erwartungR > 0 ? 'text-long' : z.erwartungR < 0 ? 'text-short' : 'text-gedimmt'
  return (
    <td className="px-2 py-1.5 text-right">
      <div className={`tabular-nums font-semibold ${farbe}`}>{fmtR(z.erwartungR)}</div>
      <div className="tabular-nums text-[10px] text-gedimmt">
        {z.anzahl} · {(z.trefferquote * 100).toFixed(0)} %
      </div>
    </td>
  )
}

export function SetupBilanzAlles() {
  const tradeHistorie = useSimulatorStore((s) => s.tradeHistorie)
  const uebungsLog = useProgressStore((s) => s.uebungsLog)
  const runden = useTopDownStore((s) => s.runden)
  const eintraege = useJournalStore((s) => s.eintraege)

  const punkte = useMemo((): BilanzPunkt[] => {
    const p: BilanzPunkt[] = []
    for (const t of logischeTrades(geschlosseneAlsTrades(eintraege.filter((e) => !e.demo)))) p.push({ strategieId: t.strategieId ?? 'kein-setup', quelle: 'echt', r: t.rMultiple })
    for (const t of logischeTrades(tradeHistorie)) p.push({ strategieId: t.strategieId ?? 'kein-setup', quelle: 'simulator', r: t.rMultiple })
    for (const u of uebungsLog) if (u.gehandelt) p.push({ strategieId: u.strategieId, quelle: 'uebung', r: u.r })
    for (const r of runden) if (r.replay && r.replay.entscheidung === 'trade' && r.replay.r !== null) p.push({ strategieId: r.replay.setupId ?? 'kein-setup', quelle: 'topdown', r: r.replay.r })
    return p
  }, [eintraege, tradeHistorie, uebungsLog, runden])

  const zeilen = useMemo(() => setupBilanz(punkte), [punkte])
  const gesamt = punkte.length
  const demoAusgeklammert = eintraege.filter((e) => e.demo && e.status === 'geschlossen').length

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h2 className="text-sm font-semibold text-white">Erwartungswert je Setup</h2>
        <p className="mt-1 text-xs text-gedimmt">
          Ø R je Trade, darunter Anzahl und Trefferquote. Quellen: echte Trades (ohne Demo), Simulator, jeder Übungsdurchlauf, Top-Down-Replays. Ab {MIN_TRADES_AUSSAGE} Trades ist eine Zahl mehr als Zufall.
          {demoAusgeklammert > 0 && ` ${demoAusgeklammert} Demo-Trades sind ausgeklammert.`}
        </p>
        {zeilen.length === 0 ? (
          <p className="mt-3 text-sm text-gedimmt">
            Noch keine Trades mit Setup-Tag.{' '}
            <Link to="/training/simulator" className="text-akzent underline">
              Simulator
            </Link>{' '}
            und{' '}
            <Link to="/training" className="text-akzent underline">
              Übungen
            </Link>{' '}
            füllen die Tabelle; Übungsdurchläufe zählen ab jetzt.
          </p>
        ) : (
          <div className="-mx-4 mt-3 overflow-x-auto px-4">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gedimmt">
                  <th className="py-1.5 pr-2">Setup</th>
                  <th className="px-2 py-1.5 text-right">Gesamt</th>
                  {QUELLEN.map((q) => (
                    <th key={q} className="px-2 py-1.5 text-right">
                      {QUELLE_TEXT[q]}
                    </th>
                  ))}
                  <th className="px-2 py-1.5">Einordnung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rand/60">
                {zeilen.map((z) => (
                  <tr key={z.strategieId}>
                    <td className="py-1.5 pr-2 font-semibold text-white">{strategieName(z.strategieId)}</td>
                    <Wert z={z.gesamt} />
                    {QUELLEN.map((q) => (
                      <Wert key={q} z={z.jeQuelle[q]} />
                    ))}
                    <td className="px-2 py-1.5 text-schrift">
                      {einordnung(z.gesamt)}
                      {z.gesamt.anzahl >= 5 && (
                        <div className="text-[10px] text-gedimmt">
                          Ø Gewinn {fmtR(z.gesamt.gewinnR)} · Ø Verlust {fmtR(z.gesamt.verlustR)} · PF {Number.isFinite(z.gesamt.profitFaktor) ? z.gesamt.profitFaktor.toFixed(2) : '∞'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gesamt > 0 && (
          <p className="mt-3 text-[11px] text-gedimmt">
            {gesamt} Trades insgesamt. Der Kurs zeigt Ideal-Trades, die immer gewinnen – diese Tabelle zeigt, was deine Ausführung daraus macht. Ein Setup mit negativem Erwartungswert über {MIN_TRADES_AUSSAGE} Trades gehört aus dem Plan, egal wie gut es in der Lektion aussieht.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-rand bg-flaeche p-4 text-xs text-gedimmt">
        <h3 className="text-sm font-semibold text-white">Setups des Kurses</h3>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {STRATEGIEN.filter((s) => s.lektionId).map((s) => (
            <li key={s.id}>
              <Link to={`/lektion/${s.lektionId}`} className="text-akzent hover:underline">
                {s.name}
              </Link>
              {!zeilen.some((z) => z.strategieId === s.id) && <span className="ml-1 text-gedimmt">(noch ohne Trades)</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
