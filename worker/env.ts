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
  /** Changes per player (anything that isn't a read): 60 a minute. */
  ACTION_LIMITER?: RateLimit;
  /** Room-code checks and error reports per IP: 120 a minute. */
  PEEK_LIMITER?: RateLimit;
  /** Which copy this is: local, staging or production (wrangler.jsonc). */
  ENVIRONMENT?: 'local' | 'staging' | 'production';
  /** Signs player tokens. Local: .dev.vars. Live: a secret on each Worker (Settings, Variables and Secrets). */
  SESSION_SECRET?: string;
  ASSETS: Fetcher;
}
