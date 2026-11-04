import { anfrage } from '../aktien/data/client'
import type { ScreenshotErgebnis } from './positionTypes'

// Screenshot für den Worker vorbereiten (verkleinern, JPEG, Base64) und erkennen lassen.

const MAX_KANTE = 1600

export interface BildDaten {
  bild: string
  typ: 'image/jpeg'
  breite: number
  hoehe: number
}

/** Längste Kante auf 1600 px, JPEG 88 % – Text bleibt lesbar, Bild wird klein (Token und Upload) */
export async function bildVorbereiten(datei: File): Promise<BildDaten> {
  const bitmap = await createImageBitmap(datei)
  const faktor = Math.min(1, MAX_KANTE / Math.max(bitmap.width, bitmap.height))
  const breite = Math.max(1, Math.round(bitmap.width * faktor))
  const hoehe = Math.max(1, Math.round(bitmap.height * faktor))
  const canvas = document.createElement('canvas')
  canvas.width = breite
  canvas.height = hoehe
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Bild konnte nicht verarbeitet werden.')
  ctx.drawImage(bitmap, 0, 0, breite, hoehe)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  return { bild: dataUrl.slice(dataUrl.indexOf(',') + 1), typ: 'image/jpeg', breite, hoehe }
}

/** Erkennung über den Worker (Claude); dauert einige Sekunden */
export async function positionenErkennen(b: BildDaten): Promise<ScreenshotErgebnis> {
  const r = await anfrage<ScreenshotErgebnis>('/api/ki/screenshot', {
    method: 'POST',
    body: JSON.stringify({ bild: b.bild, typ: b.typ }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!r) throw new Error('Leere Antwort vom Worker.')
  return r
}
