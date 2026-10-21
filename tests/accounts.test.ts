import { describe, expect, it } from 'vitest';
import { cleanEmail, LINK_RE, readIdToken, setupError } from '../worker/accounts';
import { hmac, randomToken, sameText, signToken, sixDigits, verifyToken } from '../worker/auth';
import { codeEmail } from '../worker/email';

const CLIENT = '1069630475668-test.apps.googleusercontent.com';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (claims: Record<string, unknown>) => `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`;
const now = Date.UTC(2026, 9, 16, 12);
const good = { iss: 'https://accounts.google.com', aud: CLIENT, sub: '1100', email: 'Tunde@Gmail.com', email_verified: true, exp: now / 1000 + 600 };

describe('email addresses', () => {
  it('cleans and accepts real addresses', () => {
    expect(cleanEmail('  Tunde.Bakare@Gmail.com ')).toBe('tunde.bakare@gmail.com');
    expect(cleanEmail('ada+dara@mail.co.ng')).toBe('ada+dara@mail.co.ng');
  });
  it('turns away things that are not addresses', () => {
    for (const bad of ['', 'tunde', 'tunde@', '@gmail.com', 'tunde@gmail', 'tunde @gmail.com', 'a@b.c', 'a@.com', 'a@b..com', 42, null]) {
      expect(cleanEmail(bad)).toBeNull();
    }
    expect(cleanEmail(`${'a'.repeat(250)}@x.com`)).toBeNull();
  });
});

describe("Google's id_token", () => {
  it('reads the account id and a verified address', () => {
    expect(readIdToken(idToken(good), CLIENT, now)).toEqual({ sub: '1100', email: 'tunde@gmail.com', verified: true });
    expect(readIdToken(idToken({ ...good, iss: 'accounts.google.com', email_verified: 'true' }), CLIENT, now)?.verified).toBe(true);
  });
  it('turns away tokens for another app, from someone else, or out of date', () => {
    expect(readIdToken(idToken({ ...good, aud: 'someone-else' }), CLIENT, now)).toBeNull();
    expect(readIdToken(idToken({ ...good, iss: 'https://evil.example' }), CLIENT, now)).toBeNull();
    expect(readIdToken(idToken({ ...good, exp: now / 1000 - 1 }), CLIENT, now)).toBeNull();
    expect(readIdToken(idToken({ ...good, sub: '' }), CLIENT, now)).toBeNull();
    expect(readIdToken('not-a-token', CLIENT, now)).toBeNull();
    expect(readIdToken(undefined, CLIENT, now)).toBeNull();
  });
  it('keeps an unverified address marked as such', () => {
    expect(readIdToken(idToken({ ...good, email_verified: false }), CLIENT, now)?.verified).toBe(false);
  });
});

describe("Google's token errors", () => {
  it('tells a setup problem on our side from a sign-in that just did not finish', () => {
    for (const e of ['invalid_client', 'unauthorized_client', 'redirect_uri_mismatch']) expect(setupError(e), e).toBe(true);
    for (const e of ['invalid_grant', 'invalid_request', undefined]) expect(setupError(e), String(e)).toBe(false);
  });
});

describe('codes and tokens', () => {
  it('makes 6-digit codes, zeros included', () => {
    const codes = Array.from({ length: 2000 }, sixDigits);
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(1990);
  });
  it('makes link secrets the email link pattern accepts', () => {
    const link = `${randomToken(9)}.${randomToken()}`;
    expect(randomToken(9)).toHaveLength(12);
    expect(randomToken()).toHaveLength(22);
    expect(LINK_RE.test(link)).toBe(true);
    expect(LINK_RE.test('short.x')).toBe(false);
  });
  it('compares hashes in constant time, and gets them right', async () => {
    const a = await hmac('secret', 'code:abc:123456');
    expect(sameText(a, await hmac('secret', 'code:abc:123456'))).toBe(true);
    expect(sameText(a, await hmac('secret', 'code:abc:123457'))).toBe(false);
    expect(sameText(a, await hmac('other', 'code:abc:123456'))).toBe(false);
    expect(sameText('abc', 'abcd')).toBe(false);
  });
  it('signs in on a new phone with the same kind of token a guest gets', async () => {
    const t = await signToken('player-1', 'secret');
    expect(await verifyToken(t, 'secret')).toEqual({ id: 'player-1', v: 0 });
    const t2 = await signToken('player-1', 'secret', 3);
    expect(t2.startsWith('player-1~3.')).toBe(true);
    expect(await verifyToken(t2, 'secret')).toEqual({ id: 'player-1', v: 3 });
    // The version is signed too: changing it breaks the login.
    expect(await verifyToken(t2.replace('~3.', '~4.'), 'secret')).toBeNull();
    expect(await verifyToken(t, 'other')).toBeNull();
  });
});

describe('the code email', () => {
  it('keeps the code as plain text and links it', () => {
    const e = codeEmail({ code: '048213', kind: 'signin', name: 'Tunde', origin: 'https://daraxando.yveskwameh.com', minutes: 10, codeUrl: 'https://daraxando.yveskwameh.com/c/abcdefghijkl/abcdefghijklmnopqrstuv' });
    expect(e.subject).toBe('Your Dara X&O code is 048213');
    expect(e.text).toContain('048213');
    expect(e.html).toContain('/c/abcdefghijkl/abcdefghijklmnopqrstuv');
    expect(Buffer.byteLength(e.html)).toBeLessThan(102 * 1024);
  });
});
