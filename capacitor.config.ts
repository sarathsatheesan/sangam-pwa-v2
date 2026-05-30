import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the eNoVo Android app.
 *
 * The native shell wraps the SAME web build that ships to Firebase Hosting.
 * `webDir` points at Vite's production output (`dist/`), so the flow is always:
 *   npm run build   →   npx cap sync   →   open/run in Android Studio
 *
 * androidScheme: 'https' makes the WebView origin `https://localhost`, which is a
 * secure context. WebRTC getUserMedia (camera/mic) and FCM both require a secure
 * context, so this MUST stay 'https' — do not change to 'http'.
 */
const config: CapacitorConfig = {
  appId: 'enovoapp.app',
  appName: 'eNoVo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // we hide it manually from initNative() once React mounts
      backgroundColor: '#091827', // navy to match the eNoVo logo splash artwork
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    PushNotifications: {
      // Show heads-up notifications + play sound + set badge when a push
      // arrives while the app is in the foreground.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
