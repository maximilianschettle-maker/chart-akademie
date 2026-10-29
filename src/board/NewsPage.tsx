import { Globe } from 'lucide-react'
import { NewsBoard } from './NewsBoard'

// Eigene Seite für das Geopolitik-Board (Analyse → News), damit die Makro-Seite kurz bleibt.

export function NewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
        <Globe className="h-6 w-6 text-akzent" /> Geopolitik-Board
      </h1>
      <p className="mt-1 text-gedimmt">Meldungen zu Handel und Zöllen, Konflikten, Energie und Politik aus kuratierten Quellen, stündlich aktualisiert, mit den potenziell betroffenen Märkten.</p>
      <div className="mt-5">
        <NewsBoard />
      </div>
    </div>
  )
}
