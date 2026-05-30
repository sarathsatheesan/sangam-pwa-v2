/**
 * Android App Links + hardware back button handling via @capacitor/app.
 *
 * When the OS opens https://enovoapp.com/<path> into the app (verified via
 * assetlinks.json), we strip the origin and route the in-app SPA to <path>.
 */
import { App } from '@capacitor/app';

type NavigateFn = (pathOrUrl: string) => void;

export async function registerDeepLinks(navigate: NavigateFn): Promise<void> {
  // Cold or warm deep link: an https://enovoapp.com/... URL was opened.
  await App.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url);
      navigate(parsed.pathname + parsed.search + parsed.hash);
    } catch {
      // Custom-scheme fallback (e.g. enovoapp://path)
      const path = url.replace(/^[a-z]+:\/\/[^/]*/i, '') || '/';
      navigate(path);
    }
  });

  // Hardware back button: navigate within the SPA if possible, else minimize.
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
    } else {
      void App.minimizeApp();
    }
  });
}
