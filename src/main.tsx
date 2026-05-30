import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { initNative } from './native'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// No-op on web (Capacitor.isNativePlatform() === false). Only wires native
// push + deep links when running inside the Android shell. Web behavior is
// unchanged. See src/native/index.ts.
void initNative()
