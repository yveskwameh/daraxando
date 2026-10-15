/**
 * Guest identity. A new player gets a random id and a token that is the id plus an HMAC
 * signature of it. Only the server knows the secret, so nobody can forge a token for
 * somebody else's id and play as them, even though there are no passwords.
 *
 * Accounts with email or Google sign-in can be added later on top of this: the id stays the
 * same, it just gets linked to a login.
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

const toB64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromB64url(s: string): Uint8Array | null {
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

/** Bearer header for normal requests, ?token= for websockets, because browsers cannot set headers on those. */
export function tokenFrom(req: Request, url: URL) {
  const header = req.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return url.searchParams.get('token');
}
