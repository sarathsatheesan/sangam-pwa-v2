/**
 * Native (Capacitor) bootstrap for the eNoVo Android app.
 *
 * IMPORTANT — WEB IS UNAFFECTED:
 * `initNative()` returns immediately when running on the web (Capacitor reports
 * `isNativePlatform() === false`). None of the native plugins are touched in a
 * browser, so the deployed web app behaves exactly as before. This module is the
 * ONLY new code path reachable from `main.tsx`, and it is a no-op off-device.
 */
import { Capacitor } from '@capacitor/core';

/**
 * SPA navigation that works with react-router (BrowserRouter) WITHOUT importing
 * the router or touching any existing web component. We push to history and emit
 * a popstate event, which react-router listens for. Only ever called on native.
 */
export function nativeNavigate(pathOrUrl: string): void {
  try {
    const url = new URL(pathOrUrl, window.location.origin);
    const target = url.pathname + url.search + url.hash;
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    window.location.assign(pathOrUrl);
  }
}

export async function initNative(): Promise<void> {
  // Hard gate: do nothing on the web. This keeps the web build behaviorally identical.
  if (!Capacitor.isNativePlatform()) return;

  // Status bar — match the Aurora light theme.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
  } catch (err) {
    console.warn('[native] StatusBar unavailable:', err);
  }

  // Native FCM push registration + tap routing.
  try {
    const { registerNativePush } = await import('./push');
    await registerNativePush(nativeNavigate);
  } catch (err) {
    console.warn('[native] Push setup failed:', err);
  }

  // Android App Links / deep link routing + hardware back button.
  try {
    const { registerDeepLinks } = await import('./deepLinks');
    await registerDeepLinks(nativeNavigate);
  } catch (err) {
    console.warn('[native] Deep link setup failed:', err);
  }

  // Hide the splash once the web app has mounted and wired up.
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (err) {
    console.warn('[native] SplashScreen.hide failed:', err);
  }
}
