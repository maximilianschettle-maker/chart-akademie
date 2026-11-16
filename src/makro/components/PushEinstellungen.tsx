import { useEffect, useState } from 'react'
import { Bell, BellOff, CalendarPlus, Check, Smartphone, TriangleAlert } from 'lucide-react'
import { icsUrl } from '../laden'
import { abosLaden, aboLoeschen, aboSchreiben, geraeteName } from '../push'
import { codeVorhanden } from '../../aktien/data/client'
import { useAktienStore } from '../../aktien/store'
import { ZugangHinweis } from '../../zugang/ZugangHinweis'

// Web Push: Die App abonniert beim Push-Dienst des Browsers (VAPID Public Key aus macro.json)
// und meldet das Abo an den Worker (je Einladungscode, mehrere Geräte). Die GitHub Actions holen
// alle Abos vom Worker und schicken die Nachrichten.

interface PushEinstellungenProps {
  publicKey: string | null
}

type Zustand = 'prueft' | 'nicht-unterstuetzt' | 'kein-sw' | 'aus' | 'an' | 'verweigert'

function base64ZuUint8(s: string): Uint8Array {
  const padding = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + padding).replace(/-/g, '+').replace(/_/g, '/')
  const roh = atob(b64)
  const out = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i++) out[i] = roh.charCodeAt(i)
  return out
}

function istIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function istInstalliert(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function PushEinstellungen({ publicKey }: PushEinstellungenProps) {
  const [zustand, setZustand] = useState<Zustand>('prueft')
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [geraete, setGeraete] = useState<number | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const code = useAktienStore((s) => s.code)
  const mitCode = codeVorhanden()
  const ios = istIos()
  const installiert = istInstalliert()

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setZustand('nicht-unterstuetzt')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!aktiv) return
      if (!reg) {
        setZustand('kein-sw')
        return
      }
      const sub = await reg.pushManager.getSubscription()
      if (!aktiv) return
      if (sub) {
        setEndpoint(sub.endpoint)
        setZustand('an')
        // Abo im Worker nachtragen, falls es dort fehlt (z.B. abonniert vor dem Umbau)
        if (codeVorhanden()) {
          try {
            const abos = await abosLaden()
            if (!aktiv) return
            if (!abos.some((a) => a.endpoint === sub.endpoint)) setGeraete(await aboSchreiben(sub.toJSON(), geraeteName()))
            else setGeraete(abos.length)
          } catch {
            // Worker gerade nicht erreichbar – beim nächsten Besuch
          }
        }
      } else {
        setZustand(Notification.permission === 'denied' ? 'verweigert' : 'aus')
      }
    })().catch(() => aktiv && setZustand('nicht-unterstuetzt'))
    return () => {
      aktiv = false
    }
  }, [code])

  async function aktivieren() {
    if (!publicKey) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const erlaubnis = await Notification.requestPermission()
      if (erlaubnis !== 'granted') {
        setZustand(erlaubnis === 'denied' ? 'verweigert' : 'aus')
        setMeldung({ text: 'Benachrichtigungen wurden nicht erlaubt.', fehler: true })
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ZuUint8(publicKey) as BufferSource,
      })
      setEndpoint(sub.endpoint)
      setZustand('an')
      const anzahl = await aboSchreiben(sub.toJSON(), geraeteName())
      setGeraete(anzahl)
      setMeldung({ text: `Abonniert – dieses Gerät bekommt ab jetzt Push-Nachrichten (${anzahl} Gerät${anzahl === 1 ? '' : 'e'} insgesamt).` })
    } catch (e) {
      setMeldung({ text: `Abonnieren fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, fehler: true })
    } finally {
      setLaeuft(false)
    }
  }

  async function deaktivieren() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub && codeVorhanden()) {
        try {
          await aboLoeschen(sub.endpoint)
        } catch (e) {
          setMeldung({ text: `Abo im Worker nicht entfernt: ${e instanceof Error ? e.message : String(e)}`, fehler: true })
        }
      }
      await sub?.unsubscribe()
      setEndpoint(null)
      setGeraete(null)
      setZustand('aus')
      setMeldung((m) => m ?? { text: 'Abonnement beendet.' })
    } finally {
      setLaeuft(false)
    }
  }

  async function lokalTesten() {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('ChartAkademie', {
        body: 'So sieht eine Benachrichtigung auf diesem Gerät aus. Der echte Push kommt über die GitHub Action.',
        icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
        tag: 'lokaler-test',
      })
    } catch (e) {
      setMeldung({ text: `Anzeige fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, fehler: true })
    }
  }

  const ics = icsUrl()
  const webcal = typeof location !== 'undefined' ? `webcal://${location.host}${ics}` : ics

  return (
    <section className="rounded-xl border border-rand bg-flaeche p-4">
      <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
        <Bell className="h-4 w-4 text-akzent" /> Benachrichtigungen
      </h2>
      <p className="mt-1 text-sm text-gedimmt">
        Push am Vortag, eine Stunde vorher und sobald die Entscheidung veröffentlicht ist (mit Ergebnis), dazu neue Tracker-Signale. Das
        Abo gehört zu deinem Einladungscode; mehrere Geräte sind möglich.
      </p>

      {ios && !installiert && (
        <div className="mt-3 flex gap-2 rounded-lg border border-akzent/40 bg-nacht p-3 text-sm text-schrift">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-akzent" />
          <div>
            <strong className="text-white">iPhone/iPad:</strong> Push funktioniert nur aus der installierten App. Im Safari unten
            „Teilen“ → „Zum Home-Bildschirm“ wählen, die App vom Home-Bildschirm öffnen und dann hier aktivieren (ab iOS 16.4).
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2 text-sm">
        {zustand === 'prueft' && <p className="text-gedimmt">Prüfe Browser-Unterstützung …</p>}
        {zustand === 'nicht-unterstuetzt' && (
          <p className="inline-flex items-center gap-1.5 text-gedimmt">
            <TriangleAlert className="h-4 w-4 text-akzent" /> Dieser Browser unterstützt Web Push nicht (oder die App ist nicht installiert).
          </p>
        )}
        {zustand === 'kein-sw' && (
          <p className="inline-flex items-center gap-1.5 text-gedimmt">
            <TriangleAlert className="h-4 w-4 text-akzent" /> Kein Service Worker aktiv – im Entwicklungsmodus ist er aus; in der
            veröffentlichten App funktioniert es.
          </p>
        )}
        {zustand === 'verweigert' && (
          <p className="inline-flex items-center gap-1.5 text-gedimmt">
            <BellOff className="h-4 w-4 text-short" /> Benachrichtigungen sind für diese Seite blockiert. In den Browser-Einstellungen
            der Seite wieder erlauben.
          </p>
        )}
        {zustand === 'aus' && !publicKey && (
          <p className="inline-flex items-center gap-1.5 text-gedimmt">
            <TriangleAlert className="h-4 w-4 text-akzent" /> Der VAPID-Schlüssel fehlt noch in den Daten (Secret VAPID_PUBLIC_KEY setzen
            und die Action einmal laufen lassen).
          </p>
        )}
        {zustand === 'aus' && publicKey && !mitCode && (
          <p className="text-gedimmt">
            <ZugangHinweis nachsatz=" – Push braucht ihn, damit die Nachrichten dein Gerät finden." />
          </p>
        )}
        {zustand === 'aus' && publicKey && mitCode && (
          <button
            onClick={aktivieren}
            disabled={laeuft}
            className="inline-flex items-center gap-1.5 rounded-lg bg-akzent px-3 py-2 text-sm font-semibold text-nacht disabled:opacity-50"
          >
            <Bell className="h-4 w-4" /> Benachrichtigungen aktivieren
          </button>
        )}
        {zustand === 'an' && (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-long">
              <Check className="h-4 w-4" /> Auf diesem Gerät abonniert{geraete !== null && ` · ${geraete} Gerät${geraete === 1 ? '' : 'e'} insgesamt`}.
            </p>
            {!mitCode && (
              <p className="text-gedimmt">
                <ZugangHinweis nachsatz=" – sonst erreichen die Nachrichten dieses Gerät nicht." />
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={lokalTesten}
                className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white"
              >
                <Bell className="h-3.5 w-3.5" /> Anzeige testen
              </button>
              <button
                onClick={deaktivieren}
                disabled={laeuft}
                className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-gedimmt hover:text-short"
                title={endpoint ?? undefined}
              >
                <BellOff className="h-3.5 w-3.5" /> Deaktivieren
              </button>
            </div>
          </div>
        )}
        {meldung && <p className={`text-xs ${meldung.fehler ? 'text-short' : 'text-long'}`}>{meldung.text}</p>}
      </div>

      <div className="mt-4 border-t border-rand pt-3 text-sm">
        <h3 className="inline-flex items-center gap-2 font-semibold text-white">
          <CalendarPlus className="h-4 w-4 text-akzent" /> Kalender-Abo als Backup
        </h3>
        <p className="mt-1 text-gedimmt">
          Alle Fed- und EZB-Termine mit Erinnerung am Vortag und eine Stunde vorher. Die Datei aktualisiert sich mit den Daten.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={webcal} className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white">
            Abonnieren (webcal)
          </a>
          <a
            href={ics}
            download="zinsentscheidungen.ics"
            className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white"
          >
            ICS-Datei
          </a>
        </div>
        <p className="mt-1.5 text-[11px] text-gedimmt">
          Google Kalender: „Weitere Kalender“ → „Per URL“ und die ICS-Adresse mit https einfügen.
        </p>
      </div>
    </section>
  )
}
