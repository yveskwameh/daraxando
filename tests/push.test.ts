import { describe, expect, it } from 'vitest';
import { ASK_AGAIN_DAYS, BABA_PUSH, FRIEND_PUSH } from '../shared/notify';
import { encryptPush, pushEndpointOk } from '../worker/push';
import type { Env } from '../worker/env';

const te = new TextEncoder();
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** A phone's push keys: a P-256 key pair and the 16-byte auth secret. */
async function phoneKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const pub = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  return { pair, pub, auth: crypto.getRandomValues(new Uint8Array(16)) };
}

/**
 * Decrypts an aes128gcm push body the way a phone does (RFC 8291), written separately from the
 * app's code. Also checked against the http_ece reference library when it was built.
 */
async function decrypt(body: Uint8Array, phone: { pair: CryptoKeyPair; pub: Uint8Array; auth: Uint8Array }) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  const server = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = { name: 'ECDH', public: server } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, phone.pair.privateKey, 256));
  const ikm = await hkdf(phone.auth, shared, join(te.encode('WebPush: info\0'), phone.pub, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed));
  // The last byte is the 0x02 delimiter of the last record.
  return { rs, idlen, delimiter: padded[padded.length - 1], text: new TextDecoder().decode(padded.slice(0, -1)) };
}

describe('notification encryption', () => {
  it('a phone can read what the server encrypts for it, and nobody else can', async () => {
    const phone = await phoneKeys();
    const note = JSON.stringify({ title: 'Baba Ayo', body: 'Your 6-day streak go end for midnight o.', url: '/', tag: 'streak' });
    const body = await encryptPush(te.encode(note), phone.pub, phone.auth);
    const out = await decrypt(body, phone);
    expect(out.text).toBe(note);
    expect(out.rs).toBe(4096);
    expect(out.idlen).toBe(65);
    expect(out.delimiter).toBe(2);

    const stranger = await phoneKeys();
    await expect(decrypt(body, { ...stranger, pub: phone.pub, auth: phone.auth })).rejects.toThrow();
  });

  it('every message is encrypted differently', async () => {
    const phone = await phoneKeys();
    const plain = te.encode('same text');
    const a = await encryptPush(plain, phone.pub, phone.auth);
    const b = await encryptPush(plain, phone.pub, phone.auth);
    expect(same(a, b)).toBe(false);
  });
});

describe('which push addresses the server will call', () => {
  const live = { ENVIRONMENT: 'production' } as Env;
  const local = { ENVIRONMENT: 'local' } as Env;
  it('takes the real push services', () => {
    for (const e of [
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QABC',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) expect(pushEndpointOk(e, live), e).toBe(true);
  });
  it('refuses anything else', () => {
    for (const e of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://evil.example/fcm.googleapis.com',
      'https://fcm.googleapis.com.evil.example/x',
      'https://169.254.169.254/latest',
      'http://127.0.0.1:5198/push/1',
      'not a url',
      42,
    ]) expect(pushEndpointOk(e, live), String(e)).toBe(false);
  });
  it('lets tests use a stand-in on this computer, only locally', () => {
    expect(pushEndpointOk('http://127.0.0.1:5198/push/1', local)).toBe(true);
  });
});

describe('notification copy', () => {
  it('keeps every line short, with the numbers and names filled in', () => {
    for (const l of BABA_PUSH) {
      expect(l).toContain('{n}');
      expect(l.length).toBeLessThanOrEqual(90);
    }
    for (const l of FRIEND_PUSH) expect(l).toContain('{name}');
    expect(ASK_AGAIN_DAYS[0]).toBeGreaterThanOrEqual(3);
  });
  it('follows the writing rules: no em dashes, no emoji, capital letters', () => {
    for (const l of [...BABA_PUSH, ...FRIEND_PUSH]) {
      expect(l).not.toMatch(/—/);
      expect(l).not.toMatch(/\p{Extended_Pictographic}/u);
      for (const s of l.split(/(?<=[.!?])\s+/)) expect(s[0], s).toMatch(/[A-Z{0-9]/);
    }
  });
});
