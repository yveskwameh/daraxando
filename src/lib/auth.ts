/**
 * Save your progress and sign in (server: worker/accounts.ts). Only the sheets and screens for
 * it import this file, so none of it is in the first download.
 */
import type { Account, AuthResult } from '../../shared/protocol';
import { call, post } from './api';
import { deviceId } from './device';

export type Intent = 'save' | 'signin';

export interface LinkPeek {
  kind: Intent;
  email: string;
  state: 'ready' | 'used' | 'expired';
  player: { id: string; name: string; avatar: string; print: string } | null;
}

/**
 * Where a save started: the ask on Home, or You and Settings. Only counted (the 8 am email,
 * worker/stats.ts), never kept with the player. Held in the tab for the trip to Google and back.
 */
const FROM_KEY = 'dara:save-from';
export function noteSaveFrom(from: 'ask' | undefined) {
  try {
    if (from) sessionStorage.setItem(FROM_KEY, from);
    else sessionStorage.removeItem(FROM_KEY);
  } catch { /* storage unavailable: just not counted */ }
}
const saveFrom = () => {
  try {
    return sessionStorage.getItem(FROM_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

/** The phone's random id goes along, so limits count per phone even before there's a player. */
const withDevice = (init: RequestInit): RequestInit => ({ ...init, headers: { 'x-device': deviceId() } });

export const auth = {
  account: (token: string) => call<Account>('/api/account', token),
  deleteMe: (token: string) => call<{ deleted: true }>('/api/me', token, { method: 'DELETE' }),

  /** Where to send the player to pick a Google account. `back` is the screen to come back to: /, /you or a friend's room. */
  googleStart: (token: string | null, intent: Intent, back: string) =>
    call<{ url: string }>('/api/auth/google/start', token, withDevice(post({ intent, back }))),
  /** What happened on Google, collected once with the id Google's trip back left in the address. */
  finish: (token: string | null, id: string) => call<AuthResult>('/api/auth/finish', token, withDevice(post({ id, from: saveFrom() }))),

  emailStart: (token: string | null, email: string, intent: Intent) =>
    call<{ id: string; kind: Intent }>('/api/auth/email/start', token, withDevice(post({ email, intent }))),
  emailCode: (token: string | null, id: string, code: string) =>
    call<AuthResult>('/api/auth/email/verify', token, withDevice(post({ id, code, from: saveFrom() }))),
  emailLink: (token: string | null, link: string) =>
    call<AuthResult>('/api/auth/email/verify', token, withDevice(post({ link }))),
  /** Whether the code was used through the link instead, maybe on another phone. */
  emailStatus: (token: string | null, id: string) =>
    call<{ state: 'waiting' | 'expired' | 'used'; saved?: boolean }>(`/api/auth/email/status?id=${encodeURIComponent(id)}`, token),
  peekLink: (token: string | null, link: string) => call<LinkPeek>(`/api/auth/link/${encodeURIComponent(link)}`, token, withDevice({})),
};

/** "amaka.obi@gmail.com" stays as it is; very long addresses are shortened in the middle to fit a phone. */
export function shortEmail(email: string, max = 30) {
  if (email.length <= max) return email;
  const [user, host] = email.split('@');
  const keep = Math.max(3, max - host.length - 2);
  return `${user.slice(0, keep)}…@${host}`;
}
