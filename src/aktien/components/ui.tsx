import type { ReactNode } from 'react'
import type { Quelle } from '../types'

// Kleine, wiederverwendete Bausteine im Stil des restlichen Projekts.

export const KNOPF = 'inline-flex items-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white disabled:opacity-40'
export const KNOPF_AKZENT = 'inline-flex items-center gap-1.5 rounded-lg bg-akzent px-3 py-1.5 text-xs font-semibold text-nacht hover:brightness-110 disabled:opacity-40'
export const EINGABE = 'w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent'
export const KARTE = 'rounded-xl border border-rand bg-flaeche p-4'

export function Kachel({ titel, wert, hinweis, farbe }: { titel: string; wert: string; hinweis?: string; farbe?: string }) {
  return (
    <div className="rounded-xl border border-rand bg-flaeche p-3">
      <div className="text-[11px] uppercase tracking-wide text-gedimmt">{titel}</div>
      <div className={`tabular-nums mt-1 text-base font-bold ${farbe ?? 'text-white'}`}>{wert}</div>
      {hinweis && <div className="mt-0.5 text-[11px] text-gedimmt">{hinweis}</div>}
    </div>
  )
}

export function Meldung({ text, fehler }: { text: string; fehler?: boolean }) {
  return <p className={`mt-2 text-xs ${fehler ? 'text-short' : 'text-long'}`}>{text}</p>
}

export function Abschnitt({ titel, kinder, rechts }: { titel: string; kinder: ReactNode; rechts?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">{titel}</h2>
        {rechts}
      </div>
      {kinder}
    </section>
  )
}

const QUELLEN_TEXT: Record<Quelle, { kurz: string; lang: string; klasse: string }> = {
  sec: { kurz: 'SEC', lang: 'SEC EDGAR (Primärquelle, geprüfte Berichte)', klasse: 'border-long/40 text-long' },
  yahoo: { kurz: 'Yahoo', lang: 'Yahoo Finance (inoffiziell, ca. 4 Jahre)', klasse: 'border-akzent/40 text-akzent' },
}

export function QuellenBadge({ quelle }: { quelle: Quelle }) {
  const q = QUELLEN_TEXT[quelle]
  return (
    <span title={q.lang} className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${q.klasse}`}>
      {q.kurz}
    </span>
  )
}

/** Farbe für Vorzeichen-Werte: Wachstum, Rendite */
export function vzFarbe(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'text-white'
  return v >= 0 ? 'text-long' : 'text-short'
}
