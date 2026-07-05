#!/usr/bin/env node
/**
 * check-android-sync (Session 58) — fails loudly if the Android project's
 * bundled web assets are older than dist/, i.e. a `cap sync` was skipped after
 * a build. This has bitten us three times (search fix, wallpaper, etc.): web
 * deploys build dist/ but never touch Android, so the tablet silently runs a
 * stale bundle.
 *
 * Run before device-testing:  npm run android:check
 * Exit 0 = in sync, exit 1 = STALE (with the fix command).
 */
import { readFileSync } from 'node:fs';

const DIST = 'dist/index.html';
const ANDROID = 'android/app/src/main/assets/public/index.html';

function entryChunk(path) {
  try {
    const html = readFileSync(path, 'utf8');
    const m = html.match(/assets\/index-[^"']+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

const dist = entryChunk(DIST);
const android = entryChunk(ANDROID);

if (!dist) {
  console.error('❌ No dist/ build found. Run `npm run build` first.');
  process.exit(1);
}
if (!android) {
  console.error('❌ Android assets not found. Run `npx cap sync android`.');
  process.exit(1);
}

if (dist === android) {
  console.log(`✅ Android IN SYNC with dist (${dist}).`);
  process.exit(0);
}

console.error(
  `❌ Android is STALE.\n` +
  `   dist:    ${dist}\n` +
  `   android: ${android}\n` +
  `   Fix:     npx cap sync android   (or just: npm run cap:sync)\n`,
);
process.exit(1);
