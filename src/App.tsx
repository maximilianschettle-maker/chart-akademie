import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { ChartCandlestick, LoaderCircle } from 'lucide-react'
import { StartPage } from './pages/StartPage'
import { BereichLayout } from './pages/BereichLayout'
import { TabLeisteOben, TabLeisteUnten } from './components/ui/TabLeiste'
import { ANALYSE_TABS, TRAINING_TABS, neuerPfad } from './navigation'

// Struktur siehe src/navigation.ts: Start · Training (Lernpfad, Simulator, Journal) · Analyse
// (Aktien, Tracker, Makro, News). Route-Splitting: Simulator/Übung ziehen lightweight-charts
// nach, Lektionen die Demos — der Erststart (Startseite) bleibt am Handy leicht.
const LernpfadPage = lazy(() => import('./pages/LernpfadPage').then((m) => ({ default: m.LernpfadPage })))
const LektionPage = lazy(() => import('./pages/LektionPage').then((m) => ({ default: m.LektionPage })))
const SimulatorPage = lazy(() => import('./pages/SimulatorPage').then((m) => ({ default: m.SimulatorPage })))
const JournalPage = lazy(() => import('./pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const UebungPage = lazy(() => import('./pages/UebungPage').then((m) => ({ default: m.UebungPage })))
const WiederholungPage = lazy(() => import('./pages/WiederholungPage').then((m) => ({ default: m.WiederholungPage })))
// Aktien-Bereich (Fundamentalanalyse): eigenes Modul unter src/aktien
const AktienPage = lazy(() => import('./aktien/pages/AktienPage').then((m) => ({ default: m.AktienPage })))
const FirmaPage = lazy(() => import('./aktien/pages/FirmaPage').then((m) => ({ default: m.FirmaPage })))
const VergleichPage = lazy(() => import('./aktien/pages/VergleichPage').then((m) => ({ default: m.VergleichPage })))
// Makro (Zinsentscheidungen Fed/EZB aus public/data/macro.json + Wirtschaftskalender): src/makro, src/board
const MakroPage = lazy(() => import('./makro/pages/MakroPage').then((m) => ({ default: m.MakroPage })))
// Markt-Tracker (Tages- und Stundenkerzen + Muster aus public/data/tracker.json): src/tracker
const NewsPage = lazy(() => import('./board/NewsPage').then((m) => ({ default: m.NewsPage })))
const TrackerPage = lazy(() => import('./tracker/pages/TrackerPage').then((m) => ({ default: m.TrackerPage })))

function Platzhalter({ titel }: { titel: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-white">{titel}</h1>
      <p className="mt-2 text-gedimmt">Diese Seite gibt es nicht (mehr).</p>
      <Link to="/" className="mt-4 inline-block text-akzent underline">
        Zur Startseite
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

/** Alte Pfade (Lesezeichen, Push-Links) auf die neue Struktur umleiten */
function Weiterleitung() {
  const { pathname, search } = useLocation()
  const neu = neuerPfad(pathname)
  return neu ? <Navigate to={neu + search} replace /> : <Platzhalter titel="Seite nicht gefunden" />
}

/** Beim Seitenwechsel nach oben – sonst landet man am Handy mitten in der nächsten Seite */
function NachObenBeiWechsel() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <NachObenBeiWechsel />
      {/* Kopfzeile nur ab Tablet-Breite; am Handy übernimmt die untere Tab-Leiste */}
      <header className="sticky top-0 z-10 hidden border-b border-rand bg-nacht/90 backdrop-blur sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-bold text-white">
            <ChartCandlestick className="h-5 w-5 text-akzent" />
            <span>ChartAkademie</span>
          </Link>
          <TabLeisteOben />
        </div>
      </header>
      <div className="pb-16 sm:pb-0">
        <main>
          <Suspense fallback={<Laedt />}>
            <Routes>
              <Route path="/" element={<StartPage />} />

              <Route path="/training" element={<BereichLayout tabs={TRAINING_TABS} label="Training" />}>
                <Route index element={<LernpfadPage />} />
                <Route path="simulator" element={<SimulatorPage />} />
                <Route path="journal" element={<JournalPage />} />
              </Route>
              <Route path="/lektion/:lektionId" element={<LektionPage />} />
              <Route path="/uebung/:szenarioId" element={<UebungPage />} />
              <Route path="/wiederholung" element={<WiederholungPage />} />

              <Route path="/analyse" element={<BereichLayout tabs={ANALYSE_TABS} label="Analyse" />}>
                <Route index element={<Navigate to="/analyse/aktien" replace />} />
                <Route path="aktien" element={<AktienPage />} />
                <Route path="aktien/vergleich" element={<VergleichPage />} />
                <Route path="aktien/:symbol" element={<FirmaPage />} />
                <Route path="tracker" element={<TrackerPage />} />
                <Route path="makro" element={<MakroPage />} />
                <Route path="news" element={<NewsPage />} />
              </Route>

              {/* alte Pfade */}
              <Route path="/simulator" element={<Weiterleitung />} />
              <Route path="/journal" element={<Weiterleitung />} />
              <Route path="/aktien/*" element={<Weiterleitung />} />
              <Route path="/makro" element={<Weiterleitung />} />
              <Route path="/tracker" element={<Weiterleitung />} />
              <Route path="*" element={<Platzhalter titel="Seite nicht gefunden" />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-gedimmt">
          ChartAkademie — Lern-Projekt. Keine Anlageberatung; alle Simulationen mit fiktivem Kapital.
        </footer>
      </div>
      <TabLeisteUnten />
    </HashRouter>
  )
}
