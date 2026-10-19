// The sign-in for the admin dashboard. You sign in once per device with the live game's admin key
// (the ADMIN_TOKEN you saved in Passwords). The dashboard then keeps you signed in for 14 days
// with a signed cookie, so the key itself never stays in the browser.
//
// The cookie is signed with a key made from ADMIN_KEY_LIVE, so changing the live admin key signs
// every device out at once.

export const COOKIE = 'dara_admin';
export const SESSION_DAYS = 14;
const enc = new TextEncoder();

/** Compares two strings in the same time whatever they contain, so the time leaks nothing. */
export function sameText(a: string, b: string) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * A pasted key, without the hidden characters copying can add (spaces, line breaks, zero-width
 * marks). Admin keys are plain letters and numbers, so anything else is dropped.
 */
export const cleanKey = (raw: unknown) => (typeof raw === 'string' ? raw.replace(/[^\x21-\x7e]/g, '') : '');

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The cookie value for a session that ends at `exp` (ms). */
export async function signSession(liveKey: string, exp: number) {
  return `${exp}.${await hmac(`dara-admin-session-v1:${liveKey}`, `v1.${exp}`)}`;
}

/** True when the cookie holds a session that we signed and that hasn't ended. */
export async function validSession(liveKey: string, value: string | null, now = Date.now()) {
  if (!value) return false;
  const m = value.match(/^(\d{13})\.([0-9a-f]{64})$/);
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp <= now) return false;
  return sameText(await hmac(`dara-admin-session-v1:${liveKey}`, `v1.${exp}`), m[2]);
}

export function cookieFrom(req: Request) {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

export const sessionCookie = (value: string, maxAgeS: number) =>
  `${COOKIE}=${value}; Path=/; Max-Age=${maxAgeS}; HttpOnly; Secure; SameSite=Strict`;
