import { useEffect, useRef } from 'react'

// Didaktisch SIMULIERTE Orderbuch-Heatmap (deterministisch, kein Zufall pro Render):
// Zeit × Preis, Helligkeit = ruhende Limit-Orders. Zeigt die zwei Kernmuster:
// eine haltende "Wall" (Preis prallt ab) und eine gezogene Wall (Preis bricht durch).

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const SPALTEN = 110
const ZEILEN = 64
const WALL_HALTEND = 44 // Zeile der unteren Wall (hält, Preis prallt ab)
const WALL_GEZOGEN = 16 // Zeile der oberen Wall (wird entfernt → Ausbruch)
const WALL_ENDE = 72 // Spalte, ab der die obere Wall verschwindet

export function HeatmapDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const zufall = lcg(42)
    const w = canvas.width
    const h = canvas.height
    const zellB = w / SPALTEN
    const zellH = h / ZEILEN

    ctx.fillStyle = '#0B0E14'
    ctx.fillRect(0, 0, w, h)

    // Hintergrund-Liquidität + Walls
    for (let x = 0; x < SPALTEN; x++) {
      for (let y = 0; y < ZEILEN; y++) {
        let staerke = zufall() * 0.22
        if (Math.abs(y - WALL_HALTEND) <= 1) staerke = 0.75 + zufall() * 0.25
        if (Math.abs(y - WALL_GEZOGEN) <= 1 && x < WALL_ENDE) staerke = 0.7 + zufall() * 0.3
        ctx.fillStyle = `rgba(245, 158, 11, ${staerke.toFixed(3)})`
        ctx.fillRect(x * zellB, y * zellH, Math.ceil(zellB), Math.ceil(zellH))
      }
    }

    // Preispfad: pendelt zwischen den Walls, bricht nach deren Entfernung aus
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.beginPath()
    let preisZeile = 32
    let richtung = 1
    for (let x = 0; x < SPALTEN; x++) {
      preisZeile += richtung * (0.55 + zufall() * 0.5)
      if (preisZeile >= WALL_HALTEND - 1.5) richtung = -1 // Wall hält → Abpraller
      if (x < WALL_ENDE) {
        if (preisZeile <= WALL_GEZOGEN + 1.5) richtung = 1 // obere Wall hält noch
      } else if (preisZeile <= WALL_GEZOGEN + 2 && richtung < 0) {
        richtung = -1.6 // Wall weg → Durchbruch beschleunigt
      }
      preisZeile = Math.max(3, Math.min(ZEILEN - 3, preisZeile))
      const px = x * zellB + zellB / 2
      const py = preisZeile * zellH
      if (x === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }, [])

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="mb-1 font-semibold text-white">Orderbuch-Heatmap (simuliert)</h3>
      <p className="mb-3 text-xs text-gedimmt">
        X-Achse: Zeit · Y-Achse: Preis · Helligkeit: ruhende Limit-Orders. Weiße Linie: Kurs.{' '}
        <strong className="text-schrift">Bewusst simuliert</strong> — historische
        Orderbuch-Heatmaps sind nicht frei verfügbar, die Muster darin sind aber genau die, die du
        in echten Tools (z.B. auf Börsen-Depth-Charts) siehst.
      </p>
      <canvas ref={canvasRef} width={880} height={512} className="w-full rounded-lg" />
      <div className="mt-3 space-y-1 text-xs text-gedimmt">
        <p>
          <strong className="text-schrift">Untere helle Linie (hält):</strong> eine große
          Kauf-Wall — der Kurs prallt mehrfach daran ab. Solche Zonen wirken als Unterstützung,{' '}
          <em>solange die Orders liegen bleiben</em>.
        </p>
        <p>
          <strong className="text-schrift">Obere helle Linie (verschwindet):</strong> eine
          Verkaufs-Wall, die gezogen wird („Spoofing" oder schlicht Meinungsänderung) — sofort
          bricht der Kurs durch. Merke: Heatmap-Level sind Absichten, keine Garantien. Sie ergänzen
          Marktstruktur und Volumen, ersetzen sie nicht.
        </p>
      </div>
    </div>
  )
}
