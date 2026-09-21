import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/glassmorphism.css'
import './styles/theme.css'
import './styles/global.css'
import './styles/bento-grid.css'
import './styles/scroll-reveal.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fade out the intro splash (see index.html) once the first auth check has finished
// (the splash doubles as the loading screen), after a short minimum display.
const splash = document.getElementById('splash')
if (splash) {
  const MIN_VISIBLE_MS = 900
  const MAX_VISIBLE_MS = 8000
  let dismissed = false

  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    window.removeEventListener('app-ready', onReady)
    splash.classList.add('splash--exit')
    const remove = () => splash.remove()
    splash.addEventListener('transitionend', remove, { once: true })
    window.setTimeout(remove, 1200)
  }
  const onReady = () => window.setTimeout(dismiss, Math.max(0, MIN_VISIBLE_MS - performance.now()))

  window.addEventListener('app-ready', onReady)
  window.setTimeout(dismiss, MAX_VISIBLE_MS) // never leave the splash stuck
}
