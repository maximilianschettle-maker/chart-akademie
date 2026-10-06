import { useState } from 'react'
import { CloudDownload, CloudUpload, GitBranch, RefreshCw } from 'lucide-react'
import { useSimulatorStore } from '../stores/simulatorStore'
import { useProgressStore } from '../stores/progressStore'
import { useSyncStore } from '../stores/syncStore'
import { GitFehler, reposAuflisten, standHolen, standPushen, type GitZiel } from '../data/githubClient'
import {
  type FortschrittStand,
  type SyncTeil,
  SYNC_NAME,
  SYNC_TEILE,
  ordnerNormalisieren,
  repoNormalisieren,
  teilUmfang,
  teilZusammenfuehren,
} from '../engine/gitSync'

// Sync über ein GitHub-Repository: „Holen“ führt den Stand aus dem Repo in diesen
// Browser, „Push“ schreibt ihn hinein. Beides führt standardmäßig zusammen;
// „ersetzen“ ist die bewusste Ausnahme (z. B. nach einem Journal-Reset).

type Aktion = 'holen' | 'push'

const TOKEN_LINK = 'https://github.com/settings/personal-access-tokens/new'

function lokalerFortschritt(): FortschrittStand {
  const p = useProgressStore.getState()
  return {
    abgeschlosseneLektionen: p.abgeschlosseneLektionen,
    szenarioErgebnisse: p.szenarioErgebnisse,
    wiederholungen: p.wiederholungen,
  }
}

export function GitSync() {
  const { repo, ordner, token, journal, fortschritt, letzterSync, setzen } = useSyncStore()
  const [offen, setOffen] = useState(!repo || !token)
  const [repos, setRepos] = useState<string[]>([])
  const [laeuft, setLaeuft] = useState<Aktion | 'repos' | null>(null)
  const [ersetzen, setErsetzen] = useState(false)
  const [bestaetigen, setBestaetigen] = useState<Aktion | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)

  const teile = SYNC_TEILE.filter((t) => (t === 'journal' ? journal : fortschritt))
  const teileText = teile.map((t) => SYNC_NAME[t]).join(' und ')

  function fehler(e: unknown) {
    setMeldung({ text: e instanceof GitFehler ? e.message : 'Unerwarteter Fehler beim Sync.', fehler: true })
  }

  function ziel(): GitZiel | null {
    const r = repoNormalisieren(repo)
    if (!r) {
      setMeldung({ text: 'Repository als „konto/name“ angeben (oder die GitHub-Adresse einfügen).', fehler: true })
      setOffen(true)
      return null
    }
    if (!token.trim()) {
      setMeldung({ text: 'Es fehlt noch das Zugriffstoken.', fehler: true })
      setOffen(true)
      return null
    }
    const z = { repo: r, ordner: ordnerNormalisieren(ordner), token: token.trim() }
    setzen(z)
    return z
  }

  async function reposLaden() {
    if (!token.trim()) {
      setMeldung({ text: 'Erst das Token eintragen — dann kann ich deine Repositories auflisten.', fehler: true })
      return
    }
    setLaeuft('repos')
    try {
      const liste = await reposAuflisten(token.trim())
      setRepos(liste)
      setMeldung({
        text: liste.length
          ? `${liste.length} Repositories gefunden — im Feld „Repository“ auswählen.`
          : 'Das Token sieht keine Repositories.',
        fehler: liste.length === 0,
      })
    } catch (e) {
      fehler(e)
    } finally {
      setLaeuft(null)
    }
  }

  async function holen(z: GitZiel) {
    const stand = await standHolen(z, teile)
    const geholt: string[] = []
    const fehlt: SyncTeil[] = teile.filter((t) => !stand[t])
    if (stand.journal) {
      const sim = useSimulatorStore.getState()
      const vorher = sim.tradeHistorie.length
      if (ersetzen) sim.journalErsetzen(stand.journal.tradeHistorie, stand.journal.rueckblicke)
      else {
        sim.tradesImportieren(stand.journal.tradeHistorie)
        sim.rueckblickeImportieren(stand.journal.rueckblicke)
      }
      const jetzt = useSimulatorStore.getState().tradeHistorie.length
      geholt.push(
        ersetzen ? `Journal (${teilUmfang('journal', stand.journal)})` : `Journal (${jetzt - vorher} neue Trades, jetzt ${jetzt})`,
      )
    }
    if (stand.fortschritt) {
      const neu = ersetzen
        ? stand.fortschritt
        : teilZusammenfuehren('fortschritt', lokalerFortschritt(), stand.fortschritt)
      useProgressStore.getState().importieren(neu)
      geholt.push(`Lernfortschritt (${teilUmfang('fortschritt', neu)})`)
    }
    const hinweis = fehlt.length
      ? `Im Repository liegt noch kein Stand für ${fehlt.map((t) => SYNC_NAME[t]).join(' und ')} — erst pushen.`
      : ''
    if (geholt.length) setzen({ letzterSync: { art: 'geholt', am: Date.now() } })
    setMeldung({
      text: [geholt.length ? `${ersetzen ? 'Ersetzt' : 'Geholt und zusammengeführt'}: ${geholt.join(', ')}.` : '', hinweis]
        .filter(Boolean)
        .join(' '),
      fehler: geholt.length === 0,
    })
  }

  async function pushen(z: GitZiel) {
    const sim = useSimulatorStore.getState()
    const geschrieben = await standPushen(
      z,
      teile,
      {
        journal: { tradeHistorie: sim.tradeHistorie, rueckblicke: sim.rueckblicke },
        fortschritt: lokalerFortschritt(),
      },
      ersetzen,
    )
    setzen({ letzterSync: { art: 'gepusht', am: Date.now() } })
    setMeldung({
      text: geschrieben.length
        ? `Gepusht nach ${z.repo}: ${geschrieben.map((t) => SYNC_NAME[t]).join(' und ')}.`
        : 'Das Repository ist schon auf diesem Stand — nichts zu pushen.',
    })
  }

  async function ausfuehren(aktion: Aktion) {
    setBestaetigen(null)
    const z = ziel()
    if (!z) return
    setLaeuft(aktion)
    setMeldung(null)
    try {
      await (aktion === 'holen' ? holen(z) : pushen(z))
      setErsetzen(false)
      setOffen(false)
    } catch (e) {
      fehler(e)
    } finally {
      setLaeuft(null)
    }
  }

  function klick(aktion: Aktion) {
    if (ersetzen) setBestaetigen(aktion)
    else void ausfuehren(aktion)
  }

  const knopf =
    'inline-flex items-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white disabled:opacity-40'
  const eingabe =
    'w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent'
  const gesperrt = laeuft !== null || teile.length === 0

  return (
    <div className="rounded-xl border border-rand bg-flaeche/50 p-4">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
        <GitBranch className="h-4 w-4 text-akzent" /> Git-Sync
      </h2>
      <p className="mt-1 text-xs text-gedimmt">
        Journal und Lernfortschritt in einem GitHub-Repository sichern und auf anderen Geräten wieder holen.
        Beides führt zusammen — es geht nichts verloren.
      </p>

      {offen ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gedimmt sm:col-span-2">
            Zugriffstoken
            <input
              type="password"
              value={token}
              onChange={(e) => setzen({ token: e.target.value })}
              placeholder="github_pat_…"
              autoComplete="off"
              spellCheck={false}
              className={`mt-1 ${eingabe}`}
            />
            <span className="mt-1 block">
              <a href={TOKEN_LINK} target="_blank" rel="noreferrer" className="text-akzent hover:underline">
                Fine-grained Token erstellen
              </a>{' '}
              — nur für das eine (am besten private) Repository, Berechtigung „Contents: Read and write“. Das
              Token bleibt in diesem Browser und wandert weder in den Export noch ins Repository.
            </span>
          </label>
          <label className="text-xs text-gedimmt">
            Repository
            <input
              value={repo}
              onChange={(e) => setzen({ repo: e.target.value })}
              placeholder="konto/chart-akademie-daten"
              list="git-sync-repos"
              autoCapitalize="off"
              spellCheck={false}
              className={`mt-1 ${eingabe}`}
            />
            <datalist id="git-sync-repos">
              {repos.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label className="text-xs text-gedimmt">
            Ordner im Repository
            <input
              value={ordner}
              onChange={(e) => setzen({ ordner: e.target.value })}
              placeholder="leer = oberste Ebene"
              autoCapitalize="off"
              spellCheck={false}
              className={`mt-1 ${eingabe}`}
            />
          </label>
          <div className="sm:col-span-2">
            <button onClick={() => void reposLaden()} disabled={laeuft !== null} className={knopf}>
              <RefreshCw className={`h-3.5 w-3.5 ${laeuft === 'repos' ? 'animate-spin' : ''}`} /> Meine Repositories
              laden
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-schrift">
          <span className="font-semibold">{repo}</span>
          <span className="text-gedimmt">{ordner ? ` · Ordner ${ordner}` : ''} · </span>
          <button onClick={() => setOffen(true)} className="text-akzent hover:underline">
            ändern
          </button>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gedimmt">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={journal}
            onChange={(e) => setzen({ journal: e.target.checked })}
            className="accent-akzent"
          />
          Journal (Simulator-Trades, Setup-Rückblicke)
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={fortschritt}
            onChange={(e) => setzen({ fortschritt: e.target.checked })}
            className="accent-akzent"
          />
          Lernfortschritt (Lektionen, Übungen, Wiederholungs-Box)
        </label>
      </div>

      {bestaetigen ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gedimmt">
            {bestaetigen === 'holen'
              ? `${teileText} in diesem Browser wirklich durch den Stand im Repository ersetzen?`
              : `${teileText} im Repository wirklich durch den Stand dieses Browsers ersetzen?`}
          </span>
          <button
            onClick={() => void ausfuehren(bestaetigen)}
            className="rounded-lg bg-short px-3 py-1.5 font-semibold text-white"
          >
            Ja, ersetzen
          </button>
          <button
            onClick={() => setBestaetigen(null)}
            className="rounded-lg bg-flaeche px-3 py-1.5 text-gedimmt hover:text-white"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => klick('holen')} disabled={gesperrt} className={knopf}>
            <CloudDownload className="h-3.5 w-3.5" /> {laeuft === 'holen' ? 'Hole …' : 'Holen'}
          </button>
          <button onClick={() => klick('push')} disabled={gesperrt} className={knopf}>
            <CloudUpload className="h-3.5 w-3.5" /> {laeuft === 'push' ? 'Pushe …' : 'Push'}
          </button>
          <label
            className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-gedimmt"
            title="Holen überschreibt dann den Stand in diesem Browser, Push den Stand im Repository — z. B. nach einem Journal-Reset"
          >
            <input
              type="checkbox"
              checked={ersetzen}
              onChange={(e) => setErsetzen(e.target.checked)}
              className="accent-short"
            />
            ersetzen statt zusammenführen
          </label>
        </div>
      )}

      {teile.length === 0 && <p className="mt-2 text-xs text-gedimmt">Wähle aus, was synchronisiert werden soll.</p>}
      {meldung && <p className={`mt-2 text-xs ${meldung.fehler ? 'text-short' : 'text-long'}`}>{meldung.text}</p>}
      {letzterSync && !meldung && (
        <p className="mt-2 text-xs text-gedimmt">
          Zuletzt {letzterSync.art}: {new Date(letzterSync.am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
    </div>
  )
}
