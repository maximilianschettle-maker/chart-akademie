import type { LessonMeta } from '../../types'

// GENERIERT aus den Lektionsdateien (npm run gen:meta) — nicht von Hand pflegen.
// Diese kleine Tabelle landet im Start-Bundle; die Lektionstexte werden lazy geladen.

export const LEKTION_META: LessonMeta[] = [
  { id: 'l1-01', level: 1, titel: "Was ist Trading?", untertitel: "Spot vs. Futures, Long & Short — und was „erfolgreich\" wirklich heißt", dauerMin: 8 },
  { id: 'l1-02', level: 1, titel: "Candlesticks lesen", untertitel: "OHLC, Körper, Dochte — und was eine Kerze wirklich erzählt", dauerMin: 10 },
  { id: 'l1-03', level: 1, titel: "Timeframes & Marktstruktur", untertitel: "Higher Highs, Higher Lows — und warum der große Chart zuerst kommt", dauerMin: 10 },
  { id: 'l1-04', level: 1, titel: "Orderbuch & Ordertypen", untertitel: "Market, Limit, Stop — und warum der Spread dein erster Gegner ist", dauerMin: 9 },
  { id: 'l1-05', level: 1, titel: "Leverage & Liquidation", untertitel: "Wie Hebel funktioniert — und warum er die meisten Konten zerstört", dauerMin: 10 },
  { id: 'l2-01', level: 2, titel: "Warum Risiko vor Entry kommt", untertitel: "Erwartungswert und Drawdown-Mathematik — das eigentliche Spiel", dauerMin: 9 },
  { id: 'l2-02', level: 2, titel: "Position Sizing & die 1-%-Regel", untertitel: "Die Formel, die dein Konto überleben lässt", dauerMin: 8 },
  { id: 'l2-03', level: 2, titel: "Stop-Loss, Take-Profit & R-Multiple", untertitel: "Wohin mit dem Stop — und warum du in R denkst, nicht in Dollar", dauerMin: 10 },
  { id: 'l2-04', level: 2, titel: "Trading-Psychologie", untertitel: "FOMO, Revenge-Trading und das Journal als Gegenmittel", dauerMin: 9 },
  { id: 'l3-01', level: 3, titel: "Volumen richtig lesen", untertitel: "Der Lügendetektor unter den Indikatoren", dauerMin: 8 },
  { id: 'l3-02', level: 3, titel: "Volume Profile", untertitel: "POC, Value Area — wo der Markt wirklich Geschäfte macht", dauerMin: 9 },
  { id: 'l3-03', level: 3, titel: "Open Interest & Funding Rate", untertitel: "Die Positionierung des Marktes lesen", dauerMin: 10 },
  { id: 'l3-04', level: 3, titel: "Liquidation & Liquidity Map", untertitel: "Warum der Preis dorthin läuft, wo es am meisten wehtut", dauerMin: 11 },
  { id: 'l3-05', level: 3, titel: "Heatmaps & Orderbuch-Level", untertitel: "Die Absichten der großen Spieler sichtbar machen", dauerMin: 8 },
  { id: 'l3-06', level: 3, titel: "EMA & RSI", untertitel: "Zwei Indikatoren reichen — wenn man sie richtig benutzt", dauerMin: 9 },
  { id: 'l4-01', level: 4, titel: "Trendfolge mit EMAs", untertitel: "Das Brot-und-Butter-Setup: Pullbacks im intakten Trend kaufen", dauerMin: 10 },
  { id: 'l4-02', level: 4, titel: "Support/Resistance-Bounce", untertitel: "An bestätigten Zonen handeln — nicht an Linien", dauerMin: 10 },
  { id: 'l4-03', level: 4, titel: "Breakout + Retest", untertitel: "Nicht den Ausbruch jagen — den Rücktest handeln", dauerMin: 10 },
  { id: 'l4-04', level: 4, titel: "Range Trading", untertitel: "Geld verdienen, wenn „nichts passiert\"", dauerMin: 9 },
  { id: 'l4-05', level: 4, titel: "Liquidity Sweep", untertitel: "Wenn der „Ausbruch nach unten\" in Wahrheit das Kaufsignal ist", dauerMin: 11 },
  { id: 'l5-01', level: 5, titel: "Meisterprüfung: Die Szenario-Serie", untertitel: "Alle fünf Setups — jetzt zählt die Ausführung", dauerMin: 25 },
  { id: 'l5-02', level: 5, titel: "Der freie Replay-Modus", untertitel: "Training unter Echtbedingungen — ohne Netz und doppelten Boden", dauerMin: 8 },
  { id: 'l5-03', level: 5, titel: "Dein Journal & deine Statistik", untertitel: "Die Zahlen, die dir sagen, ob du bereit bist", dauerMin: 8 },
  { id: 'l5-04', level: 5, titel: "Meisterprüfung II: Ohne Ansage", untertitel: "Erkenne selbst, ob ein Setup vorliegt — und welches", dauerMin: 30 },
]
