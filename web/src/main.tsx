import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'

// Offline + installable. Production only: a caching worker would fight Vite's hot reload in dev.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  // The first visit loads JS/CSS/fonts before the worker exists — hand it that list so offline works right away.
  navigator.serviceWorker.ready.then((reg) =>
    reg.active?.postMessage(performance.getEntriesByType('resource').map((e) => e.name)),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* every Motion animation follows the phone's "reduce motion" setting */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
