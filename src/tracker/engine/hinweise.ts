import type { MusterId, Richtung, Signal } from '../types'
import { STRATEGIEN } from '../../content/strategien'

// Kurzinfos zu den Tracker-Signalen: Was heißt das Muster, worauf schaust du jetzt, wo lauert der
// Fehler, und welche Lektion erklärt es. Reiner Text, kein Urteil über den konkreten Markt.

export interface SignalHinweis {
  /** Was das Signal sagt, ein Satz */
  bedeutung: string
  /** Woran du prüfst, ob daraus ein Trade wird */
  pruefen: string[]
  /** Typischer Fehler */
  vorsicht: string
  /** Lektion im Kurs */
  lektionId: string | null
  lektionText: string | null
}

const RICHTUNG_WORT: Record<Richtung, string> = { long: 'nach oben', short: 'nach unten', neutral: 'offen' }

const LEKTION: Record<MusterId, { id: string; text: string } | null> = {
  ausbruch: { id: 'l4-03', text: 'Breakout + Retest' },
  tunnel: { id: 'l4-04', text: 'Range Trading' },
  'ema-kreuz': { id: 'l3-06', text: 'EMA & RSI' },
  rsi: { id: 'l3-06', text: 'EMA & RSI' },
  setup: null,
}

export function signalHinweis(s: Signal): SignalHinweis {
  const stunde = s.ebene === 'stunde'
  const ebene = stunde ? 'Stundenkerzen' : 'Tageskerzen'
  const lektion = LEKTION[s.muster]
  switch (s.muster) {
    case 'ausbruch':
      return {
        bedeutung: `Der Schluss liegt erstmals ${s.richtung === 'long' ? 'über dem 20er-Hoch' : 'unter dem 20er-Tief'} (${ebene}). Der Markt verlässt seine Spanne ${RICHTUNG_WORT[s.richtung]}.`,
        pruefen: [
          'Kommt ein Retest der gebrochenen Marke, und hält sie? Erst der Retest ist der Einstieg aus dem Kurs, nicht der Ausbruch selbst.',
          'Passt die Richtung zum Trend der höheren Ebene (Tageschart bei Stundensignalen)?',
          'Wie weit ist der Kurs schon gelaufen? Ein Ausbruch nach drei grünen Tagen ist oft erschöpft.',
        ],
        vorsicht: 'Dem Ausbruch hinterherlaufen. Ohne Retest ist der Stop weit und das CRV schlecht.',
        lektionId: lektion?.id ?? null,
        lektionText: lektion?.text ?? null,
      }
    case 'tunnel':
      return {
        bedeutung:
          s.richtung === 'neutral'
            ? `Der Kurs pendelt seit Längerem in einer engen Spanne (${ebene}). Ränder sind Handelszonen, die Mitte ist Niemandsland.`
            : `Der Kurs steht am ${s.richtung === 'long' ? 'unteren' : 'oberen'} Rand des Tunnels (${ebene}). Entweder Abpraller zurück in die Spanne oder Ausbruch.`,
        pruefen: [
          'Hat der Rand schon mehrfach gehalten? Je öfter, desto wahrscheinlicher der Abpraller, aber desto näher der Ausbruch.',
          'Gibt es eine Bestätigungskerze am Rand (Docht hinein, Schluss zurück in der Spanne)?',
          'Stop knapp außerhalb des Tunnels, Ziel die andere Seite: Reicht das für ein CRV von 1,5?',
        ],
        vorsicht: 'In der Mitte der Spanne handeln oder beim ersten Docht über den Rand den Ausbruch kaufen.',
        lektionId: lektion?.id ?? null,
        lektionText: lektion?.text ?? null,
      }
    case 'ema-kreuz':
      return {
        bedeutung: `${s.titel}: Der kurze EMA kreuzt den langen ${RICHTUNG_WORT[s.richtung]} (${ebene}). Ein nachlaufender Trendfilter, kein Einstiegssignal.`,
        pruefen: [
          'Richtung für die nächsten Trades merken: nach dem Golden Cross Pullbacks long, nach dem Death Cross short.',
          'Der Einstieg kommt am Pullback zur EMA 20, nicht an der Kreuzung selbst.',
          'In Seitwärtsphasen kreuzen die EMAs ständig hin und her – dann ist das Signal wertlos.',
        ],
        vorsicht: 'Die Kreuzung als Einstieg nehmen. Sie kommt spät, oft am Ende der Bewegung.',
        lektionId: lektion?.id ?? null,
        lektionText: lektion?.text ?? null,
      }
    case 'rsi':
      return {
        bedeutung: `RSI 14 ist ${s.richtung === 'short' ? 'über 70 (überkauft)' : 'unter 30 (überverkauft)'} (${ebene}). Die Bewegung ist gestreckt, nicht automatisch am Ende.`,
        pruefen: [
          'Im starken Trend bleibt der RSI lange extrem. Gegen den Trend nur an einer Zone mit Bestätigungskerze.',
          'Divergenz? Neues Hoch im Kurs, aber niedrigeres Hoch im RSI (oder umgekehrt) wiegt schwerer.',
          'Mit dem Trend heißt das Signal eher: Pullback abwarten, nicht shorten.',
        ],
        vorsicht: 'Einen Trend shorten, nur weil der RSI über 70 steht.',
        lektionId: lektion?.id ?? null,
        lektionText: lektion?.text ?? null,
      }
    case 'setup': {
      const strategie = STRATEGIEN.find((st) => st.lektionId && s.titel.toLowerCase().includes(st.name.toLowerCase().split(' ')[0].replace('/', '')))
      return {
        bedeutung: `Die Setup-Erkennung aus den Übungen hat auf ${ebene} ein Lehrbuch-Setup gesehen: ${s.titel}. Das ist eine Lage, kein Auftrag.`,
        pruefen: [
          'Entry-Zone, Stop und Ziel wie in der Übung: Liegt der Kurs noch in der Zone oder ist er schon weg?',
          'Passt die Richtung zum Tageschart? Ein Long-Setup im Abwärtstrend braucht einen guten Grund.',
          'Kommt die Bestätigungskerze? Ohne sie ist es ein Plan, kein Trade.',
        ],
        vorsicht: 'Das Setup kaufen, weil die App es gemeldet hat. Die Erkennung sieht Muster, keine Nachrichtenlage.',
        lektionId: strategie?.lektionId ?? null,
        lektionText: strategie ? strategie.name : null,
      }
    }
  }
}
