import type { GespeicherterRueckblick } from '../../engine/rueckblick'
import { setupBilanz } from '../../engine/rueckblick'
import { strategieName } from '../../content/strategien'
import { fmtR } from '../../engine/format'

// Über alle Simulator-Sitzungen: Welche Setups siehst du, welche verpasst du
// regelmäßig? Speist sich aus den Setup-Rückblicken am Sitzungsende.

export function SetupBilanz({ rueckblicke }: { rueckblicke: GespeicherterRueckblick[] }) {
  const { zeilen, sitzungen, trades, tradesOhneSetup } = setupBilanz(rueckblicke)

  if (sitzungen === 0) {
    return (
      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h2 className="text-sm font-semibold text-white">Setups: gesehen oder verpasst?</h2>
        <p className="mt-1 text-xs leading-relaxed text-gedimmt">
          Erscheint, sobald du eine Simulator-Sitzung mit „Beenden &amp; auswerten“ abgeschlossen hast. Dann siehst
          du hier über alle Sitzungen, welche Setups du regelmäßig übersiehst.
        </p>
      </div>
    )
  }

  const meistVerpasst = zeilen.find((z) => z.verpasst >= 3 && z.quote < 50)

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h2 className="text-sm font-semibold text-white">Setups: gesehen oder verpasst?</h2>
      <p className="mt-1 text-xs leading-relaxed text-gedimmt">
        Aus {sitzungen} {sitzungen === 1 ? 'Sitzung' : 'Sitzungen'} mit Setup-Rückblick. „Angeboten“ zählt nur
        Setups, bei denen du frei warst (kein laufender Trade).
        {trades > 0 && (
          <>
            {' '}
            Gegenprobe: <span className="text-schrift">{tradesOhneSetup}</span> von {trades} eigenen Trades{' '}
            {tradesOhneSetup === 1 ? 'hatte' : 'hatten'} kein erkanntes Setup.
          </>
        )}
      </p>

      {zeilen.length === 0 ? (
        <p className="mt-3 text-xs text-gedimmt">In diesen Sitzungen hat die Erkennung kein Setup gefunden.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-rand uppercase tracking-wide text-gedimmt">
                <th className="py-2 pr-3">Setup</th>
                <th className="py-2 pr-3 text-right">Angeboten</th>
                <th className="py-2 pr-3 text-right">Gehandelt</th>
                <th className="py-2 pr-3 text-right">Verpasst</th>
                <th className="py-2 pr-3 text-right" title="Anteil der angebotenen Setups, die du gehandelt hast">
                  Quote
                </th>
                <th
                  className="py-2 text-right"
                  title="Was die verpassten Setups mit dem regelkonformen Trade gebracht hätten (ohne Gebühren)"
                >
                  Verpasste: Ziel / Stop
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {zeilen.map((z) => (
                <tr key={z.strategieId} className="border-b border-rand/50">
                  <td className="py-2 pr-3 text-schrift">{strategieName(z.strategieId)}</td>
                  <td className="py-2 pr-3 text-right">{z.angeboten}</td>
                  <td className="py-2 pr-3 text-right text-long">{z.gehandelt}</td>
                  <td className="py-2 pr-3 text-right text-akzent">{z.verpasst}</td>
                  <td className="py-2 pr-3 text-right text-white">{z.quote.toFixed(0)} %</td>
                  <td className="py-2 text-right text-gedimmt">
                    {z.verpassteGewinner} / {z.verpassteVerlierer}
                    {z.verpassteGewinner + z.verpassteVerlierer > 0 && (
                      <span className={`ml-2 ${z.verpassteR >= 0 ? 'text-long' : 'text-short'}`}>
                        {fmtR(z.verpassteR)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meistVerpasst && (
        <p className="mt-3 rounded-lg bg-akzent/10 px-3 py-2 text-xs leading-relaxed text-akzent">
          Am häufigsten verpasst: <span className="font-semibold">{strategieName(meistVerpasst.strategieId)}</span>{' '}
          ({meistVerpasst.verpasst} von {meistVerpasst.angeboten}). Geh im nächsten Rückblick gezielt diese Setups
          durch und spiel die Stellen nochmal — oder wiederhole die Lektion dazu.
        </p>
      )}
    </div>
  )
}
