import type { Match } from './match';
import type { Matchmaker } from './matchmaker';

/** Everything wrangler.jsonc hands the Worker. Keep the two in step. */
export interface Env {
  /** Player profiles, ratings, cowries and match history. */
  DB: D1Database;
  /** One Durable Object per match or friend room. */
  MATCH: DurableObjectNamespace<Match>;
  /** One Durable Object that pairs players for quick matches. */
  MATCHMAKER: DurableObjectNamespace<Matchmaker>;
  /**
   * New players per device. Most Nigerian phones share an IP address with thousands of
   * others (carrier-grade NAT), so a per-IP limit alone would lock out whole networks.
   */
  DEVICE_LIMITER?: RateLimit;
  /** A loose backstop per IP address, high enough for a shared mobile network. */
  IP_LIMITER?: RateLimit;
  /** Signs player tokens. Local: .dev.vars. Live: `npx wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;
  ASSETS: Fetcher;
}
