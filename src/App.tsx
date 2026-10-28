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
// Aktien-Bereich (Fundamentalanalyse): eigenes Modul unter src/aktien, nur hier angebunden.
const AktienPage = lazy(() => import('./aktien/pages/AktienPage').then((m) => ({ default: m.AktienPage })))
const FirmaPage = lazy(() => import('./aktien/pages/FirmaPage').then((m) => ({ default: m.FirmaPage })))
const VergleichPage = lazy(() => import('./aktien/pages/VergleichPage').then((m) => ({ default: m.VergleichPage })))
// Makro-Bereich (Zinsentscheidungen Fed/EZB aus public/data/macro.json): src/makro, Widget auf dem Dashboard.
const MakroPage = lazy(() => import('./makro/pages/MakroPage').then((m) => ({ default: m.MakroPage })))
// Markt-Tracker (Tageskerzen + Muster aus public/data/tracker.json): src/tracker
const TrackerPage = lazy(() => import('./tracker/pages/TrackerPage').then((m) => ({ default: m.TrackerPage })))

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
        `shrink-0 rounded-lg px-1.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          {/* Logo erst ab Tablet-Breite – am Handy brauchen die sechs Reiter die ganze Zeile */}
          <Link to="/" className="hidden shrink-0 items-center gap-2 font-bold text-white sm:flex">
            <CandlestickChart className="h-5 w-5 text-akzent" />
            <span className="hidden md:inline">ChartAkademie</span>
          </Link>
          {/* Sechs Reiter: am Handy seitlich scrollbar statt umgebrochen */}
          <nav className="flex gap-0.5 overflow-x-auto whitespace-nowrap sm:gap-1 [scrollbar-width:none]">
            <NavEintrag zu="/" text="Lernpfad" />
            <NavEintrag zu="/simulator" text="Simulator" />
            <NavEintrag zu="/journal" text="Journal" />
            <NavEintrag zu="/aktien" text="Aktien" />
            <NavEintrag zu="/makro" text="Zinsen" />
            <NavEintrag zu="/tracker" text="Tracker" />
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
            <Route path="/aktien" element={<AktienPage />} />
            <Route path="/aktien/vergleich" element={<VergleichPage />} />
            <Route path="/aktien/:symbol" element={<FirmaPage />} />
            <Route path="/makro" element={<MakroPage />} />
            <Route path="/tracker" element={<TrackerPage />} />
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
