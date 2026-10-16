/**
 * Notifications (docs/BACKEND.md, milestone 5): Web Push, sent straight from the Worker with
 * WebCrypto and no outside service, so it costs nothing.
 *
 *  - Each message is encrypted for one phone with the keys that phone gave us (RFC 8291,
 *    aes128gcm), so the push service in between can't read it.
 *  - Each request carries a VAPID token (RFC 8292) signed with VAPID_PRIVATE_KEY, which proves
 *    the message comes from Dara X&O. Phones only accept messages signed with the key they
 *    subscribed with.
 *  - Only addresses at the known push services are accepted, so nobody can make the server call
 *    an address of their choosing.
 *
 * Encrypting one message takes about a millisecond of processing, and the free plan allows 10
 * per request, so the 7 pm reminders go out a few at a time (worker/notifier.ts).
 */
import { BABA_PUSH, FRIEND_PUSH } from '../shared/notify';
import { fromB64url, toB64url } from './auth';
import type { Env } from './env';

const enc = new TextEncoder();

/** Who to contact about the messages, as push services ask. */
const SUBJECT = 'https://yveskwameh.com';

/** Push services phones use: Chrome, Edge, Samsung Internet and Opera on Android (Google), Firefox, Safari (Apple), Windows. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export const pushReady = (env: Env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

export function pushEndpointOk(endpoint: unknown, env: Env): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  // Tests only, on a Mac or in the container: a stand-in push service.
  if (env.ENVIRONMENT === 'local' && u.protocol === 'http:' && u.hostname === '127.0.0.1') return true;
  return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname));
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/**
 * Encrypts one message for one phone (RFC 8291). `uaPublic` is the phone's 65-byte P-256 key,
 * `auth` its 16-byte secret. `fixed` is only for tests that check against known values.
 */
export async function encryptPush(
  plain: Uint8Array,
  uaPublic: Uint8Array,
  auth: Uint8Array,
  fixed?: { serverKeys: CryptoKeyPair; salt: Uint8Array },
) {
  const server = fixed?.serverKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', server.publicKey)) as ArrayBuffer);
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  // Workers' types call this field `$public`; the runtime, like the standard, wants `public`.
  const ecdh = { name: 'ECDH', public: ua } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, server.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the message, then the 0x02 that marks the last record.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plain, new Uint8Array([2]))));
  // Header: salt, record size (4096), key id length, then the server's public key as the key id.
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

let signer: { pub: string; key: CryptoKey } | null = null;
const tokens = new Map<string, { header: string; until: number }>();

/** The Authorization header for one push service, signed once and reused for up to 6 hours. */
async function vapidHeader(endpoint: string, env: Env, now: number) {
  const aud = new URL(endpoint).origin;
  const hit = tokens.get(aud);
  if (hit && hit.until > now) return hit.header;
  if (!signer || signer.pub !== env.VAPID_PUBLIC_KEY) {
    const pub = fromB64url(env.VAPID_PUBLIC_KEY!);
    if (!pub || pub.length !== 65) throw new Error('VAPID_PUBLIC_KEY is not a P-256 public key');
    const jwk = { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY!, x: toB64url(pub.slice(1, 33)), y: toB64url(pub.slice(33)), ext: true };
    signer = { pub: env.VAPID_PUBLIC_KEY!, key: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  }
  const part = (o: unknown) => toB64url(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer.key, enc.encode(unsigned));
  const header = `vapid t=${unsigned}.${toB64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
  tokens.set(aud, { header, until: now + 6 * 3_600_000 });
  return header;
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }
/** What the phone shows. `url` opens when it's tapped; `tag` makes a newer one replace an older one. */
export interface Note { title: string; body: string; url: string; tag: string }

/** Sends one message. 'gone' means the phone turned notifications off or the app was removed. */
export async function sendPush(env: Env, sub: PushSub, note: Note, ttlSeconds: number, now = Date.now()): Promise<'ok' | 'gone' | 'failed'> {
  if (!pushReady(env) || !pushEndpointOk(sub.endpoint, env)) return 'failed';
  const ua = fromB64url(sub.p256dh);
  const auth = fromB64url(sub.auth);
  if (!ua || ua.length !== 65 || !auth || auth.length !== 16) return 'gone';
  try {
    const body = await encryptPush(enc.encode(JSON.stringify(note)), ua, auth);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: String(ttlSeconds),
        Urgency: 'normal',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: await vapidHeader(sub.endpoint, env, now),
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) console.error('[push]', res.status, new URL(sub.endpoint).host, await res.text().catch(() => ''));
    return res.ok ? 'ok' : 'failed';
  } catch (err) {
    console.error('[push]', err);
    return 'failed';
  }
}

/** Forgets phones whose push service says they're gone. */
export const dropSubs = (db: D1Database, endpoints: string[]) =>
  endpoints.length ? db.batch(endpoints.map((e) => db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(e))) : Promise.resolve([]);

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/** Baba Ayo's 7 pm reminder for a streak of `n` days. */
export const streakNote = (n: number): Note => ({ title: 'Baba Ayo', body: fill(pick(BABA_PUSH), { n }), url: '/', tag: 'streak' });

/**
 * Tells the host of a friend room that their friend just joined, on every phone where they
 * turned it on. Only called when the host isn't in the app. A message older than 10 minutes
 * isn't worth showing, so push services drop it after that.
 */
export async function tellHostFriendJoined(env: Env, hostId: string, guest: string, code: string) {
  if (!pushReady(env)) return;
  const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE player_id = ? AND friends = 1 LIMIT 5').bind(hostId).all<PushSub>();
  const note: Note = { title: 'Dara X&O', body: fill(pick(FRIEND_PUSH), { name: guest }), url: `/play/${code}`, tag: `room-${code}` };
  const sent = await Promise.all(results.map(async (s) => [s.endpoint, await sendPush(env, s, note, 600)] as const));
  await dropSubs(env.DB, sent.filter(([, r]) => r === 'gone').map(([e]) => e));
}
