import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, CheckCircle2, Circle, ArrowRight, Clock, Target, RotateCcw, Dices } from 'lucide-react'
import { CURRICULUM, LEKTIONEN, istLevelFrei, naechsteOffeneLektion } from '../content/curriculum'
import { SZENARIEN } from '../content/szenarien'
import { useProgressStore } from '../stores/progressStore'
import { ProgressRing } from '../components/ui/ProgressRing'

export function Dashboard() {
  const abgeschlossene = useProgressStore((s) => s.abgeschlosseneLektionen)
  const szenarioErgebnisse = useProgressStore((s) => s.szenarioErgebnisse)
  const zuruecksetzen = useProgressStore((s) => s.zuruecksetzen)
  const [resetBestaetigen, setResetBestaetigen] = useState(false)
  const naechste = naechsteOffeneLektion(abgeschlossene)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Dein Lernpfad</h1>
      <p className="mt-1 text-gedimmt">
        Schritt für Schritt zum systematischen Trading — Level für Level, mit Quiz und
        Chart-Übungen.
      </p>

      {naechste && (
        <Link
          to={`/lektion/${naechste.id}`}
          className="mt-5 flex items-center justify-between rounded-xl bg-akzent px-5 py-4 font-semibold text-nacht transition-transform hover:scale-[1.01]"
        >
          <span>
            Weiter lernen: {naechste.titel}
            <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal opacity-80">
              <Clock className="h-3.5 w-3.5" /> ~{naechste.dauerMin} Min
            </span>
          </span>
          <ArrowRight className="h-5 w-5" />
        </Link>
      )}

      <div className="mt-8 space-y-5">
        {CURRICULUM.map((level) => {
          const frei = istLevelFrei(level.level, abgeschlossene)
          const gesamt = level.lektionIds.length + (level.geplant?.length ?? 0)
          const fertig = level.lektionIds.filter((id) => id in abgeschlossene).length
          const prozent = gesamt > 0 ? (fertig / gesamt) * 100 : 0

          return (
            <div
              key={level.level}
              className={`rounded-xl border border-rand bg-flaeche p-5 ${frei ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {!frei && <Lock className="h-4 w-4 text-gedimmt" />}
                    <h2 className="text-lg font-bold text-white">
                      Level {level.level} — {level.titel}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-gedimmt">{level.beschreibung}</p>
                </div>
                <div className="relative shrink-0">
                  <ProgressRing prozent={prozent} />
                  <span className="tabular-nums absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-schrift">
                    {fertig}/{gesamt}
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-1.5">
                {level.lektionIds.map((id) => {
                  const lektion = LEKTIONEN[id]
                  if (!lektion) return null
                  const abgeschlossen = id in abgeschlossene
                  return (
                    <li key={id}>
                      {frei ? (
                        <Link
                          to={`/lektion/${id}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-nacht"
                        >
                          {abgeschlossen ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-long" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-gedimmt" />
                          )}
                          <span className={abgeschlossen ? 'text-gedimmt' : 'text-schrift'}>
                            {lektion.titel}
                          </span>
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-gedimmt">
                          <Circle className="h-4 w-4 shrink-0" /> {lektion.titel}
                        </span>
                      )}
                    </li>
                  )
                })}
                {level.geplant?.map((titel) => (
                  <li
                    key={titel}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-gedimmt"
                  >
                    <Circle className="h-4 w-4 shrink-0" />
                    {titel}
                    <span className="rounded bg-nacht px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      in Arbeit
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-white">Chart-Übungen</h2>
        <p className="mt-1 text-sm text-gedimmt">
          Echte historische Setups, Kerze für Kerze — hättest du den Entry gefunden?
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Link
            to="/uebung/zufall"
            className="rounded-xl border border-akzent/40 bg-flaeche p-4 transition-colors hover:border-akzent"
          >
            <Dices className="h-4 w-4 text-akzent" />
            <div className="mt-2 text-sm font-semibold text-white">Zufalls-Übung</div>
            <div className="mt-1 text-xs text-gedimmt">
              Automatisch erkanntes Setup in einem zufälligen Markt — jedes Mal neu, ohne Ansage.
            </div>
          </Link>
          {Object.values(SZENARIEN).map((s) => {
            const ergebnis = szenarioErgebnisse[s.id]
            return (
              <Link
                key={s.id}
                to={`/uebung/${s.id}`}
                className="rounded-xl border border-rand bg-flaeche p-4 transition-colors hover:border-akzent"
              >
                <Target className="h-4 w-4 text-akzent" />
                <div className="mt-2 text-sm font-semibold text-white">{s.titel}</div>
                <div className="mt-1 text-xs text-gedimmt">
                  {s.ansageVerdeckt && <span className="mr-1 rounded bg-nacht px-1.5 py-0.5 text-[10px] uppercase tracking-wide">ohne Ansage</span>}
                  {ergebnis ? (
                    <span className={ergebnis.bewertung === 'perfekt' ? 'text-long' : 'text-akzent'}>
                      Ergebnis: {ergebnis.bewertung}
                    </span>
                  ) : (
                    'Noch nicht versucht'
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-10 border-t border-rand pt-4">
        {resetBestaetigen ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gedimmt">
              Gesamten Lernfortschritt (Lektionen + Übungen) wirklich zurücksetzen?
            </span>
            <button
              onClick={() => {
                zuruecksetzen()
                setResetBestaetigen(false)
              }}
              className="rounded-lg bg-short px-3 py-1.5 font-semibold text-white"
            >
              Ja, zurücksetzen
            </button>
            <button
              onClick={() => setResetBestaetigen(false)}
              className="rounded-lg bg-flaeche px-3 py-1.5 text-gedimmt hover:text-white"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setResetBestaetigen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-gedimmt hover:text-short"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Lernfortschritt zurücksetzen
          </button>
        )}
      </div>
    </div>
  )
}
