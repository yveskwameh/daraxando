/**
 * Cloudflare Web Analytics (docs/LAUNCH.md, step 10): visits, countries, devices and page speed,
 * with no cookies. It's in the privacy notice, and public/_headers allows its two hosts.
 *
 * Only on the real game, so the test copy and local runs never count. Never while the address
 * carries a one-time sign-in secret, because the beacon sends the page's address: a visit that opens
 * on an email link (/c/{id}/{secret}) is skipped, and #signin= back from Google is already gone by
 * now (src/lib/session.tsx removes it as it loads), with the check here in case that ever changes.
 * The token is public: it sits in every page.
 */
const HOST = 'daraxando.yveskwameh.com';
const TOKEN = '66642cd64eaa42af9c01507b69c51f1e';

export function initAnalytics() {
  if (location.hostname !== HOST) return;
  if (location.pathname.startsWith('/c/') || location.hash.includes('signin=')) return;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: TOKEN });
  document.head.append(s);
}
