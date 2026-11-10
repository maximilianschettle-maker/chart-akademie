// Minimaler ZIP-Leser für Broker-Exporte (BingX „Order History“ liefert eine ZIP mit mehreren CSVs):
// Zentralverzeichnis lesen, je Eintrag den lokalen Header überspringen, „store“ direkt nehmen,
// „deflate“ über DecompressionStream('deflate-raw') des Browsers. Keine Abhängigkeit nötig.

export interface ZipEintrag {
  name: string
  text: string
}

const SIG_ZENTRAL = 0x02014b50
const SIG_ENDE = 0x06054b50
const SIG_LOKAL = 0x04034b50

function dekodiereName(bytes: Uint8Array, utf8: boolean): string {
  try {
    return new TextDecoder(utf8 ? 'utf-8' : 'latin1').decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

async function inflateRaw(daten: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([daten as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Alle Einträge einer ZIP als Text (UTF-8, BOM entfernt); Ordner werden übersprungen */
export async function zipLesen(puffer: ArrayBuffer): Promise<ZipEintrag[]> {
  const b = new Uint8Array(puffer)
  const dv = new DataView(puffer)
  // End of Central Directory von hinten suchen (Kommentar bis 64 KB)
  let ende = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65_536); i--) {
    if (dv.getUint32(i, true) === SIG_ENDE) {
      ende = i
      break
    }
  }
  if (ende < 0) throw new Error('Keine ZIP-Datei (Verzeichnis fehlt).')
  const anzahl = dv.getUint16(ende + 10, true)
  let pos = dv.getUint32(ende + 16, true)
  const out: ZipEintrag[] = []
  for (let n = 0; n < anzahl; n++) {
    if (dv.getUint32(pos, true) !== SIG_ZENTRAL) throw new Error('ZIP-Verzeichnis beschädigt.')
    const flags = dv.getUint16(pos + 8, true)
    const methode = dv.getUint16(pos + 10, true)
    const groesseKomprimiert = dv.getUint32(pos + 20, true)
    const nameLaenge = dv.getUint16(pos + 28, true)
    const extraLaenge = dv.getUint16(pos + 30, true)
    const kommentarLaenge = dv.getUint16(pos + 32, true)
    const lokalOffset = dv.getUint32(pos + 42, true)
    const name = dekodiereName(b.subarray(pos + 46, pos + 46 + nameLaenge), (flags & 0x800) !== 0)
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge
    if (name.endsWith('/')) continue
    if (dv.getUint32(lokalOffset, true) !== SIG_LOKAL) throw new Error(`ZIP-Eintrag „${name}“ beschädigt.`)
    const lokalName = dv.getUint16(lokalOffset + 26, true)
    const lokalExtra = dv.getUint16(lokalOffset + 28, true)
    const datenStart = lokalOffset + 30 + lokalName + lokalExtra
    const roh = b.subarray(datenStart, datenStart + groesseKomprimiert)
    let bytes: Uint8Array
    if (methode === 0) bytes = roh
    else if (methode === 8) bytes = await inflateRaw(roh)
    else throw new Error(`ZIP-Eintrag „${name}“: Kompression ${methode} wird nicht unterstützt.`)
    const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '')
    out.push({ name, text })
  }
  return out
}
