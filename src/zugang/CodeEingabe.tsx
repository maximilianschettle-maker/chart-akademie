import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KeyRound, LoaderCircle } from 'lucide-react'
import { EINGABE, KNOPF_AKZENT, Meldung } from '../aktien/components/ui'
import { useAktienStore } from '../aktien/store'
import { codeNormalisieren } from './code'
import { ichLaden, useZugangStore } from './ich'

/** Eingabe des Einladungscodes; gespeichert wird erst, wenn der Worker ihn bestätigt hat. */
export function CodeEingabe() {
  const [params] = useSearchParams()
  const [eingabe, setEingabe] = useState(() => params.get('code') ?? '')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const setzen = useAktienStore((s) => s.einstellungenSetzen)
  const code = codeNormalisieren(eingabe)

  async function pruefen() {
    if (!code) {
      setMeldung({ text: 'Der Code sieht so aus: CA-XXXX-XXXX-XXXX (12 Zeichen, ohne 0, O, 1 und I).', fehler: true })
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const ich = await ichLaden(code)
      // Reihenfolge: erst die Antwort merken, dann den Code speichern – die Karte wechselt damit in die Ansicht „mit Code“
      useZugangStore.setState({ ich, status: 'ok', fehler: null, willkommen: true })
      setzen({ code })
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : String(e), fehler: true })
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault()
        void pruefen()
      }}
    >
      <label className="text-xs text-gedimmt">
        Einladungscode
        <input
          className={`mt-1 font-mono tracking-wider ${EINGABE}`}
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder="CA-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" className={KNOPF_AKZENT} disabled={laeuft || !eingabe.trim()}>
          {laeuft ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Code prüfen
        </button>
        {eingabe.trim() && !code && <span className="text-[11px] text-gedimmt">noch unvollständig</span>}
      </div>
      {meldung && <Meldung text={meldung.text} fehler={meldung.fehler} />}
    </form>
  )
}
