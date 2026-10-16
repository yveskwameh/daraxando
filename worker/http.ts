/** Small helpers every route uses. */
import type { Env } from './env';

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

export const fail = (status: number, error: string) => json({ error }, status);

/** The request's JSON body, or {} if it's missing, broken or over 2 KB. */
export async function body<T>(req: Request): Promise<Partial<T>> {
  if (Number(req.headers.get('content-length') ?? 0) > 2_000) return {};
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function secretOf(env: Env) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set. Locally it lives in .dev.vars. Live, add it as a secret on the Worker: Settings, Variables and Secrets.');
  return env.SESSION_SECRET;
}

/** The phone asking: the app's random device id, or failing that the network address. Used only as a rate-limit key. */
export const phoneKey = (req: Request) =>
  (req.headers.get('x-device') ?? '').slice(0, 64) || `ip:${req.headers.get('cf-connecting-ip') ?? 'local'}`;
