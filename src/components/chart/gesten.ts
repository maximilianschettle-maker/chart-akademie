import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts'

// Chart-Bedienung über das hinaus, was lightweight-charts von sich aus kann (Phase 2):
//
//   Doppeltipp / Doppelklick auf den Chart      → zurück zur Automatik (Preisachse auto, Zeit eingepasst)
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
}

/** Hängt die Gesten an den Chart-Container. Liefert eine Aufräumfunktion. */
export function installiereGesten(chart: IChartApi, container: HTMLElement, opt: GestenOptionen): () => void {
  const preisSkala = () => chart.priceScale('right')
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
  const aufPreisachse = (f: Finger) => f.x >= paneBreite() && f.y < paneHoehe()

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

  // ── Doppeltipp / Doppelklick ────────────────────────────────────────────────
  let letzterTipp: { zeit: number; f: Finger; typ: string } | null = null
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const f = lage(e)
    const jetzt = performance.now()
    if (letzterTipp && letzterTipp.typ === e.pointerType && jetzt - letzterTipp.zeit < 350 && Math.hypot(f.x - letzterTipp.f.x, f.y - letzterTipp.f.y) < 30) {
      letzterTipp = null
      if (opt.resetErlaubt?.() ?? true) resetMelden()
      return
    }
    letzterTipp = { zeit: jetzt, f, typ: e.pointerType }
  }

  // ── Touch: Achsen-Zug und Zwei-Finger-Gesten ────────────────────────────────
  type Geste =
    | { art: 'achse'; startY: number; bereich: Bereich }
    | { art: 'pinch'; a: Finger; b: Finger; zeit: Bereich; preis: Bereich; breite: number; innenOben: number; innenHoehe: number }
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
      geste = { art: 'pinch', a: finger[0], b: finger[1], zeit, preis, breite: paneBreite(), innenOben: oben, innenHoehe: hoehe }
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

      // Zeit: logische Einheiten je Pixel aus dem Startbereich
      const zeitJeP = (geste.zeit.to - geste.zeit.from) / geste.breite
      const zeitNeu = verschiebeBereich(zoomBereich(geste.zeit, faktorX, m0.x / geste.breite), -(m1.x - m0.x) * zeitJeP * faktorX)
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

  container.addEventListener('pointerup', onPointerUp, true)
  container.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
  container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
  container.addEventListener('touchend', onTouchEnd, true)
  container.addEventListener('touchcancel', onTouchEnd, true)

  return () => {
    container.style.touchAction = touchActionVorher
    container.removeEventListener('pointerup', onPointerUp, true)
    container.removeEventListener('touchstart', onTouchStart, true)
    container.removeEventListener('touchmove', onTouchMove, true)
    container.removeEventListener('touchend', onTouchEnd, true)
    container.removeEventListener('touchcancel', onTouchEnd, true)
  }

}
