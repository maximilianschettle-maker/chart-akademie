import { defineConfig } from 'vitest/config'

// Normale Tests: unter src/, die Skripte (scripts/*) und die puren Worker-Module (worker/src/).
// Der Meta-Generator (scripts/) läuft über `npm run gen:meta`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/macro/**/*.test.ts', 'scripts/board/**/*.test.ts', 'scripts/tracker/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
})
