import { ArrowDown, ArrowUp, Minus, Square, X } from 'lucide-react'
import { fmtKurs } from '../aktien/engine/format'
import { KONTAKT_LUECKE, zonenFazit, type Herkunft, type Kontakt, type Zone } from '../engine/zonen'

// Erklärung einer erkannten Zone in der Top-Down-Übung: woraus sie gebildet wurde, was der Kurs an ihr
// gemacht hat (gedreht oder durchgelaufen, mit Datum) und wie sie einzuordnen ist. Dieselben Kontakte
// stehen als Marker im Chart (zonenMarker.ts).

function zeit(unixSek: number): string {
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const KONTAKT_TEXT: Record<Kontakt['art'], string> = {
  gehalten: 'gehalten (kam von oben)',
  abgewiesen: 'abgewiesen (kam von unten)',
  durchlauf: 'durchgelaufen',
  offen: 'Kurs steht noch in der Zone',
}

function KontaktSymbol({ art }: { art: Kontakt['art'] }) {
  if (art === 'gehalten') return <ArrowUp className="h-3.5 w-3.5 shrink-0 text-long" />
  if (art === 'abgewiesen') return <ArrowDown className="h-3.5 w-3.5 shrink-0 text-short" />
  if (art === 'durchlauf') return <Square className="h-3 w-3 shrink-0 text-gedimmt" />
  return <Minus className="h-3.5 w-3.5 shrink-0 text-gedimmt" />
}

function liste(h: Herkunft[]): string {
  const max = 5
  const t = h.slice(-max).map((x) => zeit(x.time))
  return (h.length > max ? 'zuletzt ' : '') + t.join(', ')
}

/** Sätze zur Herkunft: Hochs, Tiefs, Impulse, Range-Kante */
function herkunftSaetze(z: Zone): string[] {
  const hochs = z.herkunft.filter((h) => h.art === 'hoch')
  const tiefs = z.herkunft.filter((h) => h.art === 'tief')
  const impulse = z.herkunft.filter((h) => h.art === 'impuls')
  const out: string[] = []
  if (hochs.length) out.push(`${hochs.length} ${hochs.length === 1 ? 'markantes Hoch liegt' : 'markante Hochs liegen'} in diesem Band (${liste(hochs)}).`)
  if (tiefs.length) out.push(`${tiefs.length} ${tiefs.length === 1 ? 'markantes Tief liegt' : 'markante Tiefs liegen'} in diesem Band (${liste(tiefs)}).`)
  for (const i of impulse)
    out.push(`Am ${zeit(i.time)} begann hier eine starke ${i.auf ? 'Aufwärts' : 'Abwärts'}bewegung${i.bewegungAtr ? ` (${i.bewegungAtr.toFixed(1).replace('.', ',')}-fache der üblichen Kerzenspanne in drei Kerzen)` : ''}.`)
  if (z.herkunft.some((h) => h.art === 'range')) out.push('Kante der Seitwärtsphase am Ende des Charts.')
  if (out.length === 0) out.push('Zusammengelegt aus benachbarten Hochs und Tiefs knapp außerhalb des Bands.')
  return out
}

export function ZonenErklaerung({ zone, waehrung, onZu }: { zone: Zone; waehrung: string; onZu: () => void }) {
  const lage = zone.art === 'widerstand' ? 'über' : zone.art === 'unterstuetzung' ? 'unter' : null
  return (
    <div className="rounded-lg border border-akzent/40 bg-nacht p-3 text-xs text-schrift" data-test="zonen-erklaerung">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">
          {fmtKurs(zone.von, waehrung)} – {fmtKurs(zone.bis, waehrung)}
        </p>
        <button type="button" onClick={onZu} className="tipp -mr-1 -mt-1 inline-flex items-center justify-center rounded-md text-gedimmt hover:text-white" aria-label="Erklärung schließen">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 font-semibold text-white">Warum hier?</p>
      <ul className="mt-1 space-y-1">
        {herkunftSaetze(zone).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
        {lage && (
          <li className="text-gedimmt">
            Das Band liegt {lage} dem aktuellen Kurs, deshalb heißt es {zone.art === 'widerstand' ? 'Widerstand' : 'Unterstützung'} – auch wenn es früher von der anderen Seite gewirkt hat.
          </li>
        )}
      </ul>

      <p className="mt-3 font-semibold text-white">
        Was der Kurs hier gemacht hat: {zone.reaktionen}× gedreht, {zone.durchlaeufe}× durchgelaufen
      </p>
      {zone.kontakte.length === 0 ? (
        <p className="mt-1 text-gedimmt">Kein Kontakt im sichtbaren Zeitraum.</p>
      ) : (
        <ol className="mt-1 space-y-0.5">
          {zone.kontakte.map((k, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-right tabular-nums text-gedimmt">{i + 1}</span>
              <KontaktSymbol art={k.art} />
              <span className="whitespace-nowrap tabular-nums">{zeit(k.time)}</span>
              <span className="text-gedimmt">{KONTAKT_TEXT[k.art]}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 rounded-md bg-flaeche px-2 py-1.5 text-schrift">{zonenFazit(zone)}</p>
      <p className="mt-2 text-gedimmt">
        Im Chart: grüner Pfeil = gehalten, roter Pfeil = abgewiesen, graues Quadrat = durchgelaufen. Für ältere Kontakte den Chart nach rechts schieben. Ein neuer Kontakt zählt erst, wenn der Kurs mindestens {KONTAKT_LUECKE} Kerzen Abstand zur Zone hatte.
      </p>
    </div>
  )
}
