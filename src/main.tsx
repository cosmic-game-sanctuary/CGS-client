import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { clearBuilds } from '@/lib/buildPreview'
import '@/styles/tokens.css'

// Builds mounted in a previous session belong to games that only existed in
// memory, so they are orphaned as soon as the page reloads.
void clearBuilds()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
