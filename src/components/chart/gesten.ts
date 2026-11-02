import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts'

// Chart-Bedienung über das hinaus, was lightweight-charts von sich aus kann (Phase 2):
//
//   Doppeltipp / Doppelklick auf den Chart      → zurück zur Automatik (Preisachse auto, Zeit eingepasst)
//   Ein Tipp mit dem Finger (ohne Ziehen)        → onTipp (z.B. Beschriftungen ein-/ausblenden)
//   Ein Finger auf der Preisachse hoch/runter   → Preisachse strecken/stauchen (Maus: macht die Bibliothek)
//   Zwei Finger auf dem Chart                   → Pinch-Zoom in beide Richtungen und Verschieben (auch vertikal)
//   Ein Finger auf dem Chart                    → wie bisher: waagerecht scrollen; senkrecht scrollt die Seite
//   Maus: Rad = Zeit zoomen, Ziehen = scrollen; nach Achsen-Zug auch senkrecht (Bibliothek)
//
// Die Bibliothek selbst pincht nur die Zeitachse und kennt keinen Doppeltipp-Reset auf dem Chart.
// Die reinen Rechenhelfer sind exportiert und getestet; die Ereignisbehandlung hängt am Container.

export interface Bereich {
  from: number
  to: number
}

/** Bereich um einen Anker (Anteil 0..1 von from nach to) mit dem Faktor strecken: Faktor 2 = doppelt so groß */
export function zoomBereich(b: Bereich, faktor: number, ankerAnteil: number): Bereich {
  const anker = b.from + (b.to - b.from) * ankerAnteil
  return { from: anker - (anker - b.from) * faktor, to: anker + (b.to - anker) * faktor }
}

export function verschiebeBereich(b: Bereich, delta: number): Bereich {
  return { from: b.from + delta, to: b.to + delta }
}

/** Zoomfaktor aus einer Achsen-Zugstrecke in Pixeln: nach unten ziehen = Bereich vergrößern (wie TradingView) */
export function achsenZugFaktor(dyPx: number, empfindlichkeit = 160): number {
  return Math.exp(dyPx / empfindlichkeit)
}

export type AchsenSeite = 'left' | 'right'

/** Liegt x (im Container) auf der Preisachse? Die Achse sitzt links oder rechts und ist `achsenBreite` breit. */
export function aufAchse(x: number, seite: AchsenSeite, gesamtBreite: number, achsenBreite: number): boolean {
  return seite === 'left' ? x < achsenBreite : x >= gesamtBreite - achsenBreite
}

/** Linker Rand der Zeichenfläche (Pane) im Container */
export function paneStart(seite: AchsenSeite, achsenBreite: number): number {
  return seite === 'left' ? achsenBreite : 0
}

/** Doppeltipp-Fenster in ms; ein einzelner Tipp gilt erst danach als solcher */
export const DOPPELTIPP_MS = 350
/** Ein Tipp darf sich so weit bewegen (px) und so lange dauern (ms), sonst war es Ziehen */
export const TIPP_MAX_PX = 10
export const TIPP_MAX_MS = 500

interface Finger {
  x: number
  y: number
}

function mitte(a: Finger, b: Finger): Finger {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export interface GestenOptionen {
  /** Serie, über die Preise ↔ Koordinaten umgerechnet werden */
  serie: ISeriesApi<SeriesType>
  /** Zurück zur Automatik; Standard: Preisachse auto + Zeitachse einpassen */
  reset?: () => void
  /** Doppeltipp-Reset nur, wenn das hier true liefert (z.B. nicht im Zeichenmodus) */
  resetErlaubt?: () => boolean
  /** Erkannte Gesten melden (für die Anzeige des Reset-Knopfs) */
  onManuell?: (manuell: boolean) => void
  /** Seite der Preisachse (Standard rechts) */
  achse?: AchsenSeite
  /** Ein einzelner Finger-Tipp auf die Zeichenfläche (kein Doppeltipp, kein Ziehen) */
  onTipp?: () => void
}

/** Hängt die Gesten an den Chart-Container. Liefert eine Aufräumfunktion. */
export function installiereGesten(chart: IChartApi, container: HTMLElement, opt: GestenOptionen): () => void {
  const seite: AchsenSeite = opt.achse ?? 'right'
  const preisSkala = () => chart.priceScale(seite)
  const zeitSkala = () => chart.timeScale()

  const reset =
    opt.reset ??
    (() => {
      preisSkala().setAutoScale(true)
      zeitSkala().fitContent()
    })
  const resetMelden = () => {
    reset()
    opt.onManuell?.(false)
  }

  const lage = (e: { clientX: number; clientY: number }): Finger => {
    const r = container.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const paneBreite = () => container.clientWidth - preisSkala().width()
  const paneHoehe = () => container.clientHeight - zeitSkala().height()
  const paneLinks = () => paneStart(seite, preisSkala().width())
  const aufPreisachse = (f: Finger) => aufAchse(f.x, seite, container.clientWidth, preisSkala().width()) && f.y < paneHoehe()

  // Preisbereich der Skala = innerer Bereich ohne die Ränder (scaleMargins); get/set der Bibliothek
  // sind dazu symmetrisch. Pixel werden deshalb auf die innere Höhe bezogen.
  const preisBereichJetzt = (): Bereich | null => preisSkala().getVisibleRange()
  const innen = () => {
    const h = paneHoehe()
    const m = preisSkala().options().scaleMargins
    return { oben: h * m.top, hoehe: Math.max(1, h * (1 - m.top - m.bottom)) }
  }
  const preisBereichSetzen = (b: Bereich) => {
    if (!(b.to > b.from) || !Number.isFinite(b.from) || !Number.isFinite(b.to)) return
    preisSkala().setVisibleRange(b)
    opt.onManuell?.(true)
  }
  const zeitBereichSetzen = (b: Bereich) => {
    if (!(b.to > b.from)) return
    zeitSkala().setVisibleLogicalRange(b)
  }

  // ── Tipp, Doppeltipp / Doppelklick ─────────────────────────────────────────
  let letzterTipp: { zeit: number; f: Finger; typ: string } | null = null
  let tippStart: { zeit: number; f: Finger; id: number } | null = null
  let tippTimer: ReturnType<typeof setTimeout> | null = null
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    tippStart = { zeit: performance.now(), f: lage(e), id: e.pointerId }
  }
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const f = lage(e)
    const jetzt = performance.now()
    const start = tippStart
    tippStart = null
    if (letzterTipp && letzterTipp.typ === e.pointerType && jetzt - letzterTipp.zeit < DOPPELTIPP_MS && Math.hypot(f.x - letzterTipp.f.x, f.y - letzterTipp.f.y) < 30) {
      letzterTipp = null
      if (tippTimer) clearTimeout(tippTimer)
      tippTimer = null
      if (opt.resetErlaubt?.() ?? true) resetMelden()
      return
    }
    letzterTipp = { zeit: jetzt, f, typ: e.pointerType }
    // Einzelner Finger-Tipp auf die Zeichenfläche: erst melden, wenn kein zweiter Tipp folgt
    const kurz = start && start.id === e.pointerId && jetzt - start.zeit <= TIPP_MAX_MS && Math.hypot(f.x - start.f.x, f.y - start.f.y) <= TIPP_MAX_PX
    if (opt.onTipp && e.pointerType === 'touch' && kurz && !aufPreisachse(f) && f.y < paneHoehe()) {
      if (tippTimer) clearTimeout(tippTimer)
      tippTimer = setTimeout(() => {
        tippTimer = null
        opt.onTipp?.()
      }, DOPPELTIPP_MS)
    }
  }

  // ── Touch: Achsen-Zug und Zwei-Finger-Gesten ────────────────────────────────
  type Geste =
    | { art: 'achse'; startY: number; bereich: Bereich }
    | { art: 'pinch'; a: Finger; b: Finger; zeit: Bereich; preis: Bereich; breite: number; links: number; innenOben: number; innenHoehe: number }
    | { art: 'ausklingen' }
  let geste: Geste | null = null

  const fingerAus = (e: TouchEvent): Finger[] => Array.from(e.touches, (t) => lage(t))

  const onTouchStart = (e: TouchEvent) => {
    const finger = fingerAus(e)
    if (finger.length === 1 && aufPreisachse(finger[0])) {
      const bereich = preisBereichJetzt()
      if (!bereich) return
      geste = { art: 'achse', startY: finger[0].y, bereich }
      e.stopPropagation()
      e.preventDefault()
      return
    }
    if (finger.length === 2) {
      const zeit = zeitSkala().getVisibleLogicalRange()
      const preis = preisBereichJetzt()
      if (!zeit || !preis) return
      const { oben, hoehe } = innen()
      geste = { art: 'pinch', a: finger[0], b: finger[1], zeit, preis, breite: paneBreite(), links: paneLinks(), innenOben: oben, innenHoehe: hoehe }
      e.stopPropagation()
      e.preventDefault()
      return
    }
    if (geste?.art === 'ausklingen') e.stopPropagation()
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!geste) return
    e.stopPropagation()
    if (geste.art === 'ausklingen') return
    e.preventDefault()
    const finger = fingerAus(e)
    if (geste.art === 'achse' && finger.length === 1) {
      const faktor = achsenZugFaktor(finger[0].y - geste.startY)
      preisBereichSetzen(zoomBereich(geste.bereich, faktor, 0.5))
      return
    }
    if (geste.art === 'pinch' && finger.length === 2) {
      const [a0, b0] = [geste.a, geste.b]
      const [a1, b1] = finger
      const m0 = mitte(a0, b0)
      const m1 = mitte(a1, b1)
      const dx0 = Math.max(20, Math.abs(b0.x - a0.x))
      const dy0 = Math.max(20, Math.abs(b0.y - a0.y))
      const dx1 = Math.max(20, Math.abs(b1.x - a1.x))
      const dy1 = Math.max(20, Math.abs(b1.y - a1.y))
      // Spreizen = Bereich verkleinern (hineinzoomen)
      const faktorX = dx0 / dx1
      const faktorY = dy0 / dy1

      // Zeit: logische Einheiten je Pixel aus dem Startbereich (x relativ zum linken Rand der Zeichenfläche)
      const zeitJeP = (geste.zeit.to - geste.zeit.from) / geste.breite
      const zeitNeu = verschiebeBereich(zoomBereich(geste.zeit, faktorX, (m0.x - geste.links) / geste.breite), -(m1.x - m0.x) * zeitJeP * faktorX)
      zeitBereichSetzen(zeitNeu)

      // Preis: oben = to, unten = from (innerer Bereich). Finger nach oben schiebt den Inhalt nach oben,
      // also rücken tiefere Preise ins Bild → Bereich wandert nach unten.
      const preisJeP = (geste.preis.to - geste.preis.from) / geste.innenHoehe
      const ankerAnteil = Math.min(1, Math.max(0, 1 - (m0.y - geste.innenOben) / geste.innenHoehe))
      const preisNeu = verschiebeBereich(zoomBereich(geste.preis, faktorY, ankerAnteil), (m1.y - m0.y) * preisJeP * faktorY)
      preisBereichSetzen(preisNeu)
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (!geste) return
    e.stopPropagation()
    // Bis alle Finger weg sind, bekommt die Bibliothek nichts mehr – sonst springt sie beim Übergang 2 → 1 Finger
    geste = e.touches.length === 0 ? null : { art: 'ausklingen' }
  }

  // Browser-Zoom und -Scroll auf dem Chart unterbinden, Seite scrollt weiter über einen Finger (pan-y)
  const touchActionVorher = container.style.touchAction
  container.style.touchAction = 'pan-y'

  container.addEventListener('pointerdown', onPointerDown, true)
  container.addEventListener('pointerup', onPointerUp, true)
  container.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
  container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
  container.addEventListener('touchend', onTouchEnd, true)
  container.addEventListener('touchcancel', onTouchEnd, true)

  return () => {
    container.style.touchAction = touchActionVorher
    if (tippTimer) clearTimeout(tippTimer)
    container.removeEventListener('pointerdown', onPointerDown, true)
    container.removeEventListener('pointerup', onPointerUp, true)
    container.removeEventListener('touchstart', onTouchStart, true)
    container.removeEventListener('touchmove', onTouchMove, true)
    container.removeEventListener('touchend', onTouchEnd, true)
    container.removeEventListener('touchcancel', onTouchEnd, true)
  }

}
