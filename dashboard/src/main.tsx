import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles/local-fonts.css'
import './index.css'
import './styles/desktop-shell.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeProvider'
import { isDesktopApp, isDesktopDarwin } from './lib/desktop-shell'
import { clearStaleChunkReloadFlag, installStaleChunkRecovery } from './lib/lazy-with-retry'

clearStaleChunkReloadFlag()
installStaleChunkRecovery()

if (isDesktopApp()) {
  document.documentElement.classList.add('desktop-electron')
  document.title = 'Inauzwa CRM'
  if (isDesktopDarwin()) {
    document.documentElement.classList.add('desktop-electron--darwin')
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
