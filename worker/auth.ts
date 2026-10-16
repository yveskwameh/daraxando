/**
 * Guest identity. A new player gets a random id and a token that is the id plus an HMAC
 * signature of it. Only the server knows the secret, so nobody can forge a token for
 * somebody else's id and play as them, even though there are no passwords.
 *
 * Saving progress (worker/accounts.ts) links Google or an email to that same id, so signing in
 * on a new phone just hands that phone a token for the id. Nothing about the token changes.
 */

const enc = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function keyFor(secret: string) {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    keys.set(secret, key);
  }
  return key;
}

export const toB64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function signToken(id: string, secret: string) {
  const sig = await crypto.subtle.sign('HMAC', await keyFor(secret), enc.encode(id));
  return `${id}.${toB64url(sig)}`;
}

/** The player id inside a valid token, or null. Uses verify() so the comparison is constant time. */
export async function verifyToken(token: string | null | undefined, secret: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = fromB64url(token.slice(dot + 1));
  if (!sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await keyFor(secret), sig, enc.encode(id));
  return ok ? id : null;
}

/** A keyed hash, for storing sign-in codes and link secrets without keeping them. */
export async function hmac(secret: string, data: string) {
  return toB64url(await crypto.subtle.sign('HMAC', await keyFor(secret), enc.encode(data)));
}

/** Compares two strings in constant time, so a wrong guess takes as long as a nearly right one. */
export function sameText(a: string, b: string) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Random letters and digits safe for a web address: 16 bytes give 22 characters. */
export const randomToken = (bytes = 16) => toB64url(crypto.getRandomValues(new Uint8Array(bytes)));

/** A 6-digit code, every value equally likely. */
export function sixDigits() {
  const n = new Uint32Array(1);
  // 4,294,000,000 is the largest multiple of a million below 2^32, so no value is favoured.
  do crypto.getRandomValues(n);
  while (n[0] >= 4_294_000_000);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

/** SHA-256 in web-address-safe base64, for Google's PKCE check. */
export async function sha256(text: string) {
  return toB64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** Bearer header for normal requests, ?token= for websockets, because browsers cannot set headers on those. */
export function tokenFrom(req: Request, url: URL) {
  const header = req.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return url.searchParams.get('token');
}
