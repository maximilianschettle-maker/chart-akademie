import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ZugangKarte } from './ZugangKarte'

/** Seite /zugang: Code eintragen oder verwalten; Ziel der Teilen-Links (#/zugang?code=…). */
export function ZugangPage() {
  // key: ein neuer ?code=… in der URL (Teilen-Link) setzt die Eingabe frisch auf
  const [params] = useSearchParams()
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gedimmt hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Start
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-white">Zugang</h1>
      <p className="mt-1 text-gedimmt">Ein Einladungscode je Person. Er bleibt in diesem Browser und schaltet die Online-Funktionen frei.</p>
      <div className="mt-6">
        <ZugangKarte key={params.get('code') ?? ''} />
      </div>
      <p className="mt-6 text-xs text-gedimmt">
        Die Daten laufen über den Worker der ChartAkademie (Cloudflare). Kurse von Yahoo Finance und SEC EDGAR, KI-Urteile von Anthropic. Keine Anlageberatung.
      </p>
    </div>
  )
}
