/**
 * Centralized ICE / TURN configuration for ALL WebRTC paths (1:1 + group).
 *
 * Previously, both src/utils/webrtc.ts and src/utils/groupWebrtc.ts hardcoded the
 * same list pointing at the FREE public `openrelay.metered.ca` TURN — fine for dev,
 * but it drops calls on cellular / symmetric NATs and has no bandwidth guarantees.
 *
 * Production: set VITE_TURN_URLS / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL in .env
 * to your provider's TURN (metered.ca paid, Twilio NTS, Cloudflare, or self-hosted
 * coturn). If those are unset, we fall back to the public dev TURN so local testing
 * still works.
 *
 * SECURITY NOTE: static TURN credentials shipped to the client can be extracted and
 * abused (someone relays their own traffic on your bill). For launch this is usually
 * acceptable with usage caps; the hardened pattern is EPHEMERAL credentials minted by
 * a Cloud Function (TURN REST API / provider token endpoint) — see getIceServers().
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Free public TURN — DEV ONLY fallback. Do not rely on this in production.
const FALLBACK_TURN: RTCIceServer[] = [
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function envTurn(): RTCIceServer[] | null {
  const urls = (import.meta.env.VITE_TURN_URLS as string | undefined)
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const username = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  if (urls && urls.length && username && credential) {
    return [{ urls, username, credential }];
  }
  return null;
}

/**
 * Synchronous ICE server list. Uses env-configured TURN when present, else the
 * public dev fallback. Drop-in replacement for the old inline ICE_SERVERS arrays.
 */
export const ICE_SERVERS: RTCIceServer[] = [...STUN_SERVERS, ...(envTurn() ?? FALLBACK_TURN)];

/**
 * Hardened path for later: fetch short-lived TURN credentials from a Cloud Function
 * right before creating an RTCPeerConnection. Today it just returns ICE_SERVERS, so
 * callers can adopt `await getIceServers()` now and we upgrade the body later without
 * touching call sites.
 *
 * Example future body:
 *   const fn = httpsCallable(functions, 'getTurnCredentials');
 *   const { data } = await fn();   // { username, credential, ttl }
 *   return [...STUN_SERVERS, { urls: data.urls, username: data.username, credential: data.credential }];
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  return ICE_SERVERS;
}
