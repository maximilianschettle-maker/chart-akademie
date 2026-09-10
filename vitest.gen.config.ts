import { defineConfig } from 'vitest/config'

// `npm run gen:meta` — führt nur den Generator unter scripts/ aus.
export default defineConfig({
  test: {
    include: ['scripts/**/*.gen.ts'],
  },
})
