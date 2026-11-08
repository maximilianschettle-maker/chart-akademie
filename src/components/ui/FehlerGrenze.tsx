import { Component, type ErrorInfo, type ReactNode } from 'react'

// Fängt Render-Fehler der Seiten ab, statt dass React den ganzen Baum abräumt (schwarzer Bildschirm).
// Ein fehlgeschlagener Nachlade-Chunk (nach einem Deploy zeigt die alte App auf Dateien, die es nicht
// mehr gibt) wird einmal automatisch mit einem Neuladen behoben; alles andere zeigt den Fehlertext
// und einen Knopf – den Text kann der Nutzer weitergeben.

const RELOAD_MARKE = 'chartakademie-fehler-reload'

export function istChunkFehler(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|Failed to fetch dynamically/i.test(text)
}

interface Props {
  children: ReactNode
}
interface State {
  fehler: Error | null
}

export class FehlerGrenze extends Component<Props, State> {
  state: State = { fehler: null }

  static getDerivedStateFromError(fehler: Error): State {
    return { fehler }
  }

  componentDidCatch(fehler: Error, info: ErrorInfo): void {
    console.error('Seite abgestürzt:', fehler, info.componentStack)
    if (istChunkFehler(fehler)) {
      let schonVersucht = false
      try {
        schonVersucht = sessionStorage.getItem(RELOAD_MARKE) === '1'
        if (!schonVersucht) sessionStorage.setItem(RELOAD_MARKE, '1')
      } catch {
        // ohne Speicher einfach neu laden
      }
      if (!schonVersucht) window.location.reload()
    }
  }

  componentDidMount(): void {
    // Marke erst nach 30 s lösen: scheitert derselbe Chunk sofort wieder, bleibt es bei einem Neuladen
    setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_MARKE)
      } catch {
        // egal
      }
    }, 30_000)
  }

  render(): ReactNode {
    const { fehler } = this.state
    if (!fehler) return this.props.children
    const chunk = istChunkFehler(fehler)
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-sm">
        <h1 className="text-lg font-bold text-white">{chunk ? 'Neue Version der App' : 'Diese Seite ist abgestürzt'}</h1>
        <p className="mt-2 text-gedimmt">
          {chunk
            ? 'Die App wurde aktualisiert, ein Teil der alten Version ließ sich nicht mehr laden. Einmal neu laden behebt das.'
            : 'Ein Fehler beim Anzeigen. Bitte neu laden; bleibt es dabei, schick den Text unten weiter.'}
        </p>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-rand bg-flaeche p-3 text-[11px] text-schrift">{`${fehler.name}: ${fehler.message}`}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => window.location.reload()} className="tipp rounded-lg bg-akzent px-3 py-1.5 text-xs font-semibold text-nacht">
            Neu laden
          </button>
          <a href="#/" onClick={() => this.setState({ fehler: null })} className="tipp rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white">
            Zur Startseite
          </a>
        </div>
      </div>
    )
  }
}
