import { defineConfig } from 'vitest/config'

// Normale Tests: nur unter src/. Der Meta-Generator (scripts/) läuft über `npm run gen:meta`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
