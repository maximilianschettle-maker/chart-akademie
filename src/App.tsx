import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Link, NavLink } from 'react-router-dom'
import { CandlestickChart, LoaderCircle } from 'lucide-react'
import { Dashboard } from './pages/Dashboard'

// Route-Splitting: Simulator/Übung ziehen lightweight-charts nach, Lektionen die
// Demos — beides soll den Erststart (Dashboard) am Handy nicht belasten.
const LektionPage = lazy(() => import('./pages/LektionPage').then((m) => ({ default: m.LektionPage })))
const SimulatorPage = lazy(() => import('./pages/SimulatorPage').then((m) => ({ default: m.SimulatorPage })))
const JournalPage = lazy(() => import('./pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const UebungPage = lazy(() => import('./pages/UebungPage').then((m) => ({ default: m.UebungPage })))
const WiederholungPage = lazy(() =>
  import('./pages/WiederholungPage').then((m) => ({ default: m.WiederholungPage })),
)

function Platzhalter({ titel }: { titel: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-white">{titel}</h1>
      <p className="mt-2 text-gedimmt">
        Dieser Bereich wird in einer der nächsten Ausbaustufen freigeschaltet.
      </p>
      <Link to="/" className="mt-4 inline-block text-akzent underline">
        Zurück zum Lernpfad
      </Link>
    </div>
  )
}

function Laedt() {
  return (
    <div className="flex h-64 items-center justify-center text-gedimmt">
      <LoaderCircle className="h-7 w-7 animate-spin" />
    </div>
  )
}

function NavEintrag({ zu, text }: { zu: string; text: string }) {
  return (
    <NavLink
      to={zu}
      className={({ isActive }) =>
        `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-flaeche text-white' : 'text-gedimmt hover:text-schrift'
        }`
      }
    >
      {text}
    </NavLink>
  )
}

export default function App() {
  return (
    <HashRouter>
      <header className="sticky top-0 z-10 border-b border-rand bg-nacht/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-white">
            <CandlestickChart className="h-5 w-5 text-akzent" />
            <span className="hidden sm:inline">ChartAkademie</span>
          </Link>
          <nav className="flex gap-1">
            <NavEintrag zu="/" text="Lernpfad" />
            <NavEintrag zu="/simulator" text="Simulator" />
            <NavEintrag zu="/journal" text="Journal" />
          </nav>
        </div>
      </header>
      <main>
        <Suspense fallback={<Laedt />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lektion/:lektionId" element={<LektionPage />} />
            <Route path="/uebung/:szenarioId" element={<UebungPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/wiederholung" element={<WiederholungPage />} />
            <Route path="*" element={<Platzhalter titel="Seite nicht gefunden" />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-gedimmt">
        ChartAkademie — Lern-Projekt. Keine Anlageberatung; alle Simulationen mit fiktivem Kapital.
      </footer>
    </HashRouter>
  )
}
