import { useEffect, useState } from 'react'
import { Bell, BellOff, CalendarPlus, Copy, Check, Smartphone, TriangleAlert } from 'lucide-react'
import { icsUrl } from '../laden'

// Web Push ohne Backend: Die App abonniert beim Push-Dienst des Browsers (VAPID Public Key
// aus macro.json) und zeigt die Subscription als JSON. Der Nutzer legt sie als GitHub-Secret
// PUSH_SUBSCRIPTION ab; die GitHub Action schickt die Nachrichten von dort.

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
  const [subscription, setSubscription] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
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
        setSubscription(JSON.stringify(sub.toJSON()))
        setZustand('an')
      } else {
        setZustand(Notification.permission === 'denied' ? 'verweigert' : 'aus')
      }
    })().catch(() => aktiv && setZustand('nicht-unterstuetzt'))
    return () => {
      aktiv = false
    }
  }, [])

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
      setSubscription(JSON.stringify(sub.toJSON()))
      setZustand('an')
      setMeldung({ text: 'Abonniert. Jetzt die Subscription unten kopieren und als GitHub-Secret PUSH_SUBSCRIPTION hinterlegen.' })
    } catch (e) {
      setMeldung({ text: `Abonnieren fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, fehler: true })
    } finally {
      setLaeuft(false)
    }
  }

  async function deaktivieren() {
    setLaeuft(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      await sub?.unsubscribe()
      setSubscription(null)
      setZustand('aus')
      setMeldung({ text: 'Abonnement beendet. Das Secret PUSH_SUBSCRIPTION in GitHub ist damit ungültig.' })
    } finally {
      setLaeuft(false)
    }
  }

  async function kopieren() {
    if (!subscription) return
    try {
      await navigator.clipboard.writeText(subscription)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      setMeldung({ text: 'Kopieren nicht möglich – Text bitte markieren und von Hand kopieren.', fehler: true })
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
        Push am Vortag, eine Stunde vorher und sobald die Entscheidung veröffentlicht ist (mit Ergebnis). Verschickt von der GitHub
        Action, ohne eigenen Server.
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
        {zustand === 'aus' && publicKey && (
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
              <Check className="h-4 w-4" /> Auf diesem Gerät abonniert.
            </p>
            <p className="text-gedimmt">
              Diese Subscription einmalig als GitHub-Secret <code className="rounded bg-nacht px-1 text-akzent">PUSH_SUBSCRIPTION</code>{' '}
              hinterlegen (Repo → Settings → Secrets and variables → Actions). Bei Gerätewechsel oder nach „Deaktivieren“ neu setzen.
            </p>
            <textarea
              readOnly
              value={subscription ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              rows={4}
              className="w-full rounded-lg border border-rand bg-nacht p-2 font-mono text-[11px] text-schrift"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={kopieren}
                className="inline-flex items-center gap-1.5 rounded-lg bg-akzent px-3 py-1.5 text-xs font-semibold text-nacht"
              >
                {kopiert ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {kopiert ? 'Kopiert' : 'Kopieren'}
              </button>
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
