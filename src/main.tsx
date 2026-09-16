import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/glassmorphism.css'
import './styles/theme.css'
import './styles/global.css'
import './styles/bento-grid.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
