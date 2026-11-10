import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { HttpFehler, type Env } from './http'
import type { BildTyp, ScreenshotErgebnis } from '../../src/journal/positionTypes'
import type { PruefungAntwort } from '../../src/journal/pruefungTypes'

// Claude im Worker: der API-Schlüssel bleibt hier (wrangler secret ANTHROPIC_API_KEY), die App
// schickt nur Bilder bzw. Fakten. Nutzer: Broker-Screenshots (eToro) → Positionen fürs Journal,
// und die Trade-Prüfung (Fakten aus der Setup-Erkennung → kritisches Urteil).

export const KI_MODELL = 'claude-opus-5-5'

const PositionSchema = z.object({
  brokerId: z.string().nullable(),
  instrument: z.string(),
  richtung: z.enum(['kaufen', 'verkaufen']).nullable(),
  hebel: z.number().nullable(),
  kontrakte: z.number().nullable(),
  positionsgroesse: z.number().nullable(),
  einsatz: z.number().nullable(),
  eroeffnungskurs: z.number().nullable(),
  eroeffnungsdatum: z.string().nullable(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  gewinnVerlust: z.number().nullable(),
  uebernachtgebuehren: z.number().nullable(),
  status: z.enum(['offen', 'geschlossen']),
  schlusskurs: z.number().nullable(),
  schlussdatum: z.string().nullable(),
  // keine .nullable() hier: das Schema darf höchstens 16 Union-Felder haben (Anthropic-Limit)
  broker: z.string(),
  demo: z.boolean(),
})

const AntwortSchema = z.object({
  positionen: z.array(PositionSchema),
  /** leer = nichts anzumerken */
  hinweis: z.string(),
})

const SYSTEM = `Du liest Screenshots einer Broker-App (eToro, BingX oder andere) und gibst die darauf sichtbaren Positionen als Daten zurück.

Regeln:
- Nur ablesen, nie schätzen oder ergänzen. Ein Wert, der nicht im Bild steht, ist null.
- Eine Positionsinfo-Ansicht enthält genau eine Position. Eine Portfolio- oder Historienliste enthält mehrere; dann alle zurückgeben, in der Reihenfolge des Bildes.
- "Kaufen" = richtung "kaufen" (Long), "Verkaufen" = richtung "verkaufen" (Short).
- Zahlen als reine Zahlen ohne Währungszeichen und ohne Tausendertrenner, Punkt als Dezimaltrenner ("$28,497.70" → 28497.7). Verluste negativ ("▼ $3.34" oder rot = negativ).
- "X20" oder "x20" = hebel 20. "CFD" ist nur ein Hinweis auf den Produkttyp.
- "SL/TP"-Zeile wie "SL 27900 / TP 29934.87": stopLoss 27900, takeProfit 29934.87. "Kein SL" oder "–" = null.
- "Marge" oder "Betrag" oder "Investiert" = einsatz. "Positionsgröße" = positionsgroesse. "Kontrakte" oder "Einheiten" = kontrakte.
- Datumsangaben wie "04 Nov 2026, 17:02" oder "04.11.2026 17:02" → "2026-11-04T17:02" (Ortszeit wie angezeigt, keine Zeitzonenumrechnung). Monatsnamen können englisch oder deutsch abgekürzt sein.
- Status: eine offene Position (Positionsinfo mit "Position schließen", Portfolio) = "offen". Eine geschlossene Position (Historie, "Geschlossen", mit Schlusskurs oder Schlussdatum) = "geschlossen"; dann schlusskurs und schlussdatum füllen, gewinnVerlust ist der realisierte Betrag.
- "Wert" ist der aktuelle Wert der Position, nicht der Einsatz; die Zahl daneben mit Pfeil ist gewinnVerlust.
- broker: "eToro", "BingX" oder der erkennbare Name, sonst leerer String. demo: true bei "(Demo)", "Virtual USDT", "Paper", "Testnet", sonst false.
- Handelshistorie mit einzelnen Füllungen (BingX "Trade History": Zeilen wie "Open Long 13X", "Close Short 30X", Spalten Filled Time, Futures/Side, Filled, Filled Price, Closed PnL, Fee, Order No.): Füllungen zu Positionen paaren – ein "Open" und das zeitlich nächste "Close" desselben Symbols und derselben Richtung mit gleicher Menge sind eine Position. Dann: eroeffnungskurs und eroeffnungsdatum vom Open, schlusskurs und schlussdatum vom Close, kontrakte = Filled, hebel aus "13X", gewinnVerlust = Closed PnL des Close, uebernachtgebuehren = Summe der Gebühren beider Zeilen (positiv), brokerId = Order No. des Close, status "geschlossen". Ein Open ohne Close ist "offen". Reihenfolge: älteste Position zuerst.
- hinweis: kurz auf Deutsch, was nicht lesbar oder mehrdeutig war; sonst leerer String.`

function client(env: Env): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new HttpFehler('ANTHROPIC_API_KEY ist im Worker nicht gesetzt (wrangler secret put ANTHROPIC_API_KEY)', 503)
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 50_000 })
}

/** Positionen aus einem Screenshot (Base64 ohne data:-Präfix) */
export async function positionenAusBild(env: Env, bild: string, typ: BildTyp): Promise<ScreenshotErgebnis> {
  try {
    const antwort = await client(env).messages.parse({
      model: KI_MODELL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'low', format: zodOutputFormat(AntwortSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: typ, data: bild } },
            { type: 'text', text: 'Lies alle Positionen aus diesem Screenshot.' },
          ],
        },
      ],
    })
    if (antwort.stop_reason === 'refusal') throw new HttpFehler('Das Modell hat die Auswertung abgelehnt.', 422)
    if (antwort.stop_reason === 'max_tokens') throw new HttpFehler('Antwort des Modells abgeschnitten – Bild zu umfangreich?', 502)
    const daten = antwort.parsed_output
    if (!daten) throw new HttpFehler('Antwort des Modells nicht lesbar.', 502)
    return {
      positionen: daten.positionen.map((p) => ({ ...p, broker: p.broker.trim() || null })),
      hinweis: daten.hinweis.trim() || null,
      modell: antwort.model,
    }
  } catch (e) {
    if (e instanceof HttpFehler) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new HttpFehler('ANTHROPIC_API_KEY wird von Anthropic nicht akzeptiert.', 502)
    if (e instanceof Anthropic.RateLimitError) throw new HttpFehler('Anthropic: Ratenlimit erreicht, gleich nochmal.', 429)
    if (e instanceof Anthropic.APIError) throw new HttpFehler(`Anthropic-Fehler ${e.status ?? ''}: ${e.message}`, 502)
    throw e
  }
}

// ── Trade-Prüfung ────────────────────────────────────────────────────────────

const PruefungSchema = z.object({
  urteil: z.enum(['sauber', 'mit Abstrichen', 'herbeigesehnt']),
  setupVorhanden: z.enum(['ja', 'teilweise', 'nein', 'unklar']),
  einstieg: z.enum(['passend', 'zu früh', 'zu spät', 'unklar']),
  stop: z.enum(['sinnvoll', 'zu eng', 'zu weit', 'ohne Struktur', 'unklar']),
  text: z.string(),
  naechstesMal: z.array(z.string()),
})

const SYSTEM_PRUEFUNG = `Du bist ein strenger, fairer Trading-Coach für einen Privattrader (CFDs auf Nasdaq, Gold, Öl, Bitcoin, Zeitrahmen 5 min bis Tag). Er lernt Setups aus seinem Kurs: Trendfolge-Pullback an die EMA 20, Support/Resistance-Bounce, Breakout + Retest, Range Trading, Liquidity Sweep.

Du bekommst Fakten als JSON. Sie stammen aus einer regelbasierten Erkennung auf den Kerzen bis zur Einstiegskerze (kein Blick in die Zukunft) und aus dem Journal des Traders. Du siehst keine Kerzen.

Regeln:
- Beurteile nur anhand der Fakten. Erfinde keine Kurse, Muster oder Nachrichten. Fehlt etwas (null), sag, dass du es nicht beurteilen kannst, und setze die Einstufung auf "unklar".
- "erkanntesSetup" ist das, was die Erkennung gefunden hat; "setupBehauptet" ist, was der Trader angibt. Weichen sie ab oder fehlt ein erkanntes Setup, ist das ein starkes Indiz für einen herbeigesehnten Trade – sag das deutlich, aber benenne auch, was die Erkennung übersehen könnte.
- "signalVorKerzen" > 3 heißt: der Trader ist spät eingestiegen; "einstiegInZone" false heißt: außerhalb der Zone. Ein Einstieg gegen "trend" braucht eine Begründung.
- Stop: "stopInAtr" unter 0,8 ist meist Rauschen, über 3 zu weit; "struktur.stopDahinter" false heißt, der Stop liegt vor dem Swing-Tief/-Hoch und wird leicht abgeholt.
- "heute": ein weiterer Trade nach Verlusten am selben Tag ist ein Warnsignal (Revanche).
- "checkliste": die Antworten des Traders auf seine eigenen Regeln vor dem Trade. Ein "ok: false" ist ein bewusster Regelbruch – sprich ihn direkt an; "null" heißt nicht beantwortet. Vergleiche die Selbsteinschätzung mit den Fakten (z.B. "Bestätigung: Ja", aber signalVorKerzen 0 und Einstieg in der Zone).
- Fehlt "ergebnis", kennst du den Ausgang nicht: bewerte ausschließlich den Prozess. Ist es da, trenne Prozess und Ergebnis: ein Gewinn macht einen schlechten Einstieg nicht gut, ein Verlust einen sauberen nicht schlecht. "mfeR"/"maeR" zeigen, wie weit es für und gegen ihn lief.
- Ist "uebung" gesetzt, war es ein Übungs-Trade (Replay oder Simulator, kein echtes Geld): Die Übung hat Kriterien, Zonen oder einen Abgleich mit der Setup-Erkennung vorberechnet – nimm sie als Fakten, wiederhole sie nicht, sondern erkläre, was der Trader daraus über seine Lesart lernt. Bei "keinTrade" bewertest du die Entscheidung, nicht zu handeln.
- Pflicht im Text: eine Gegenthese (was spricht gegen deine Einschätzung bzw. gegen den Trade).
- Stil: Deutsch, per Du, direkt, ohne Floskeln und ohne Lob zum Einstieg. Höchstens 180 Wörter im Text. naechstesMal: zwei bis drei konkrete, prüfbare Punkte.`

/** Kritische Prüfung eines Trades aus den Fakten (JSON, vom Browser berechnet) */
export async function tradePruefen(env: Env, fakten: unknown): Promise<PruefungAntwort> {
  try {
    const antwort = await client(env).messages.parse({
      model: KI_MODELL,
      max_tokens: 2000,
      system: SYSTEM_PRUEFUNG,
      output_config: { effort: 'medium', format: zodOutputFormat(PruefungSchema) },
      messages: [{ role: 'user', content: `Fakten zum Trade:\n${JSON.stringify(fakten, null, 1)}` }],
    })
    if (antwort.stop_reason === 'refusal') throw new HttpFehler('Das Modell hat die Prüfung abgelehnt.', 422)
    if (antwort.stop_reason === 'max_tokens') throw new HttpFehler('Antwort des Modells abgeschnitten.', 502)
    const daten = antwort.parsed_output
    if (!daten) throw new HttpFehler('Antwort des Modells nicht lesbar.', 502)
    return { ...daten, modell: antwort.model }
  } catch (e) {
    if (e instanceof HttpFehler) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new HttpFehler('ANTHROPIC_API_KEY wird von Anthropic nicht akzeptiert.', 502)
    if (e instanceof Anthropic.RateLimitError) throw new HttpFehler('Anthropic: Ratenlimit erreicht, gleich nochmal.', 429)
    if (e instanceof Anthropic.APIError) throw new HttpFehler(`Anthropic-Fehler ${e.status ?? ''}: ${e.message}`, 502)
    throw e
  }
}
