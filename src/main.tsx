import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Nach einem Deploy zeigt eine noch offene App auf Chunks, die es nicht mehr gibt → Vite meldet
// vite:preloadError; einmal neu laden holt die neue Version (Marke verhindert Endlosschleifen).
window.addEventListener('vite:preloadError', (ev) => {
  ev.preventDefault()
  try {
    if (sessionStorage.getItem('chartakademie-preload-reload') === '1') return
    sessionStorage.setItem('chartakademie-preload-reload', '1')
  } catch {
    // ohne Speicher trotzdem einmal versuchen
  }
  window.location.reload()
})
// Marke erst nach 30 s lösen: scheitert der Chunk sofort wieder, bleibt es bei einem Neuladen
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem('chartakademie-preload-reload')
    } catch {
      // egal
    }
  }, 30_000)
})

// Service Worker nur im Produktions-Build (im Dev-Server würde er Hot-Reload stören).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // Offline-Cache ist Komfort, kein Muss
      })
  })
}
