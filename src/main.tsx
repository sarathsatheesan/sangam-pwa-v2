import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { initNative } from './native'

// Self-heal stale-chunk errors. After a new build/app update, a cached service
// worker can serve an old index that references hashed chunk files which no
// longer exist → a lazy screen fails to load → the error boundary's
// "Something went wrong" screen. Vite fires `vite:preloadError` exactly then;
// reload once (loop-guarded) to pull the fresh build, so the user never sees it.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'enovo_chunk_reload_at';
  const last = Number(sessionStorage.getItem(KEY) || '0');
  if (Date.now() - last < 10000) return; // already reloaded recently — avoid a loop
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// No-op on web (Capacitor.isNativePlatform() === false). Only wires native
// push + deep links when running inside the Android shell. Web behavior is
// unchanged. See src/native/index.ts.
void initNative()
