import { DatenStatus } from '../aktien/components/DatenStatus'
import { JournalKompakt } from '../components/start/JournalKompakt'
import { TermineKompakt } from '../components/start/TermineKompakt'
import { WatchlistKompakt } from '../components/start/WatchlistKompakt'
import { WeiterLernen } from '../components/start/WeiterLernen'
import { TrackerWidget } from '../tracker/components/TrackerWidget'

// Startseite (seit Phase 1 Einstieg statt des Lernpfads): kompaktes Dashboard mit den nächsten
// Notenbank-Terminen, Märkten/Signalen, Watchlist und den letzten Journal-Einträgen.

function gruss(stunde: number): string {
  if (stunde < 5) return 'Gute Nacht'
  if (stunde < 11) return 'Guten Morgen'
  if (stunde < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function StartPage() {
  const jetzt = new Date()
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold text-white">{gruss(jetzt.getHours())}</h1>
        <DatenStatus />
      </div>
      <p className="mt-1 text-gedimmt">{jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <WeiterLernen />
      <TermineKompakt />
      <TrackerWidget />
      <WatchlistKompakt />
      <JournalKompakt />
    </div>
  )
}
