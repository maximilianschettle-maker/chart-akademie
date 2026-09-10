import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base: Repo-Name, weil die App auf GitHub Pages unter /chart-akademie/ liegt.
export default defineConfig({
  base: '/chart-akademie/',
  plugins: [react()],
})
