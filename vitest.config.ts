import { defineConfig } from 'vitest/config'

// Normale Tests: unter src/ und die Parser des Makro-Datenskripts (scripts/macro/).
// Der Meta-Generator (scripts/) läuft über `npm run gen:meta`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/macro/**/*.test.ts', 'scripts/board/**/*.test.ts'],
  },
})
