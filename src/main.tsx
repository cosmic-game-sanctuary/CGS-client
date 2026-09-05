import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { dropAppServiceWorkers } from '@/lib/previewHost'
import '@/styles/tokens.css'

// Builds mounted in a previous session are cleared by the build host when it
// starts, since the cache lives on its origin rather than ours. What does live
// here is a worker left behind by the version of this app that served builds
// from its own origin. See src/lib/previewHost.ts.
void dropAppServiceWorkers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
