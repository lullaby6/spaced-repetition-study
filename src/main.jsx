import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { I18nProvider } from './i18n.jsx'
import App from './App.jsx'
import './index.css'

// On phones, keep the focused field visible above the on-screen keyboard.
document.addEventListener('focusin', (e) => {
  const el = e.target
  if (!(el instanceof HTMLElement) || !el.matches('textarea, input[type="text"], input[type="number"]')) return
  if (!window.matchMedia('(pointer: coarse)').matches) return
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
})

// Routes live under the site's base path (e.g. /spaced-repetition-study/ on GitHub Pages).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
