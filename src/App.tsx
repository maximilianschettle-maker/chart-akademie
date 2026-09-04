import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom'
import { CandlestickChart } from 'lucide-react'
import { Dashboard } from './pages/Dashboard'
import { LektionPage } from './pages/LektionPage'

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
    <BrowserRouter>
      <header className="sticky top-0 z-10 border-b border-rand bg-nacht/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-white">
            <CandlestickChart className="h-5 w-5 text-akzent" />
            ChartAkademie
          </Link>
          <nav className="flex gap-1">
            <NavEintrag zu="/" text="Lernpfad" />
            <NavEintrag zu="/simulator" text="Simulator" />
            <NavEintrag zu="/journal" text="Journal" />
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lektion/:lektionId" element={<LektionPage />} />
          <Route path="/simulator" element={<Platzhalter titel="Simulator" />} />
          <Route path="/journal" element={<Platzhalter titel="Trade-Journal" />} />
          <Route path="*" element={<Platzhalter titel="Seite nicht gefunden" />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-gedimmt">
        ChartAkademie — Lern-Projekt. Keine Anlageberatung; alle Simulationen mit fiktivem Kapital.
      </footer>
    </BrowserRouter>
  )
}
