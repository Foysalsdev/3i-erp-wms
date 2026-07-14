import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PWAUpdater } from './components/PWAUpdater'
import './styles/global.css'

// Reveal Material Symbols only once the icon font is actually loaded, so a slow
// or blocked font CDN never flashes raw ligature names (e.g. "inventory_2")
// that overflow and break the layout. Falls back to visible if the API is
// missing, and a timeout guards against the promise never settling.
const ICON_FONT = '24px "Material Symbols Rounded"'
const revealIcons = () => document.documentElement.classList.add('icons-ready')
// Reveal only once the icon font is genuinely available. document.fonts.load()
// can fulfil even when the font failed, so we gate on document.fonts.check()
// (true only when the glyphs can actually render) and poll briefly, since the
// font may become ready shortly after load() settles. A 10s timeout reveals
// regardless so icon-only buttons never stay blank forever on a hard failure.
if (document.fonts?.check) {
  // The font face only exists once the (CDN) stylesheet has loaded; until then
  // check() is vacuously true, so require the face to be registered AND ready.
  const facePresent = () => { for (const f of document.fonts) if (f.family.includes('Material Symbols')) return true; return false }
  const tryReveal = () => { if (facePresent() && document.fonts.check(ICON_FONT)) { revealIcons(); return true } return false }
  if (!tryReveal()) {
    document.fonts.load(ICON_FONT).then(tryReveal, () => {})
    let n = 0
    const iv = setInterval(() => { if (tryReveal() || ++n > 40) clearInterval(iv) }, 250)
    setTimeout(() => { clearInterval(iv); revealIcons() }, 10000)
  }
} else {
  revealIcons()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <PWAUpdater />
  </React.StrictMode>
)
