// Einladungscodes: Format, Erzeugung aus Zufallsbytes, Normalisierung der Eingabe.
// Bewusst ohne Imports — der Worker (worker/tsconfig.json) nutzt dieselbe Datei.
//
// Format CA-XXXX-XXXX-XXXX: 12 Zeichen aus einem Alphabet ohne 0/O/1/I (32 Zeichen,
// 60 Bit). Tippbar und per Link teilbar (#/zugang?code=…).

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_PRAEFIX = 'CA'
export const CODE_ZEICHEN = 12
export const CODE_REGEX = /^CA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

function gruppieren(zeichen: string): string {
  return `${CODE_PRAEFIX}-${zeichen.slice(0, 4)}-${zeichen.slice(4, 8)}-${zeichen.slice(8, 12)}`
}

/** Code aus mindestens 12 Zufallsbytes (z.B. crypto.getRandomValues(new Uint8Array(12))). */
export function codeAusZufall(bytes: Uint8Array): string {
  if (bytes.length < CODE_ZEICHEN) throw new Error(`codeAusZufall: ${CODE_ZEICHEN} Bytes nötig`)
  let zeichen = ''
  for (let i = 0; i < CODE_ZEICHEN; i++) zeichen += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return gruppieren(zeichen)
}

/**
 * Nutzereingabe → kanonischer Code oder null. Toleriert Klein-/Großschreibung,
 * fehlende oder falsche Trennzeichen, Leerzeichen und ein fehlendes „CA-“.
 * 0, O, 1 und I kommen im Alphabet nicht vor; Eingaben damit sind ungültig.
 */
export function codeNormalisieren(eingabe: string): string | null {
  let s = eingabe.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.startsWith(CODE_PRAEFIX) && s.length === CODE_PRAEFIX.length + CODE_ZEICHEN) s = s.slice(CODE_PRAEFIX.length)
  if (s.length !== CODE_ZEICHEN) return null
  const code = gruppieren(s)
  return CODE_REGEX.test(code) ? code : null
}

/** Für die Anzeige: nur die letzte Gruppe bleibt lesbar. */
export function codeMaskieren(code: string): string {
  const n = codeNormalisieren(code)
  if (!n) return '••••'
  return `${CODE_PRAEFIX}-••••-••••-${n.slice(-4)}`
}
