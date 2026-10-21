import type { Match } from './match';
import type { Matchmaker } from './matchmaker';
import type { Notifier } from './notifier';

/** Everything wrangler.jsonc hands the Worker. Keep the two in step. */
export interface Env {
  /** Player profiles, ratings, cowries and match history. */
  DB: D1Database;
  /** One Durable Object per match or friend room. */
  MATCH: DurableObjectNamespace<Match>;
  /** One Durable Object that pairs players for quick matches. */
  MATCHMAKER: DurableObjectNamespace<Matchmaker>;
  /** One Durable Object that sends the 7 pm streak reminders a few at a time (worker/notifier.ts). */
  NOTIFIER: DurableObjectNamespace<Notifier>;
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
  /** Sign-in codes emailed: 3 a minute per phone and per address. */
  EMAIL_LIMITER?: RateLimit;
  /** Code checks, sign-in links and Google sign-ins: 20 a minute per phone. */
  AUTH_LIMITER?: RateLimit;
  /** Which copy this is: local, staging or production (wrangler.jsonc). */
  ENVIRONMENT?: 'local' | 'staging' | 'production';
  /** Signs player tokens. Local: .dev.vars. Live: a secret on each Worker (Settings, Variables and Secrets). */
  SESSION_SECRET?: string;
  /** Google sign-in: the "Dara X&O web" client in Google Cloud. Not secret, so it's in wrangler.jsonc. */
  GOOGLE_CLIENT_ID?: string;
  /** Google sign-in's secret. Local: .dev.vars. Live: a secret on each Worker. */
  GOOGLE_CLIENT_SECRET?: string;
  /** Sends the sign-in code emails through Resend. Local: .dev.vars (optional). Live: a secret on each Worker. */
  RESEND_API_KEY?: string;
  /** Who the code emails come from. The domain is verified in Resend. Not secret, so it's in wrangler.jsonc. */
  EMAIL_FROM?: string;
  /**
   * Turns on the admin API (worker/admin.ts, docs/ADMIN-API.md) and is its key: at least 32
   * random characters. Local: .dev.vars. Live: a secret on each Worker. Not set means no admin API.
   */
  ADMIN_TOKEN?: string;
  /**
   * Notifications (worker/push.ts): the VAPID key pair that signs every message. Made once with
   * the command in the README. Both live as secrets on each Worker; locally in .dev.vars.
   * Without them, notifications are off on that copy.
   */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /**
   * The 8 am report (worker/report.ts): who gets it, up to 3 addresses separated by commas. A secret
   * on each Worker, so the address stays off GitHub. Not set means no report from that copy.
   */
  REPORT_EMAIL?: string;
  /**
   * The free plan numbers in the report: the Cloudflare account id and a read-only API token with
   * "Account Analytics: Read". Both secrets. Without them the report leaves that part out.
   */
  CF_ACCOUNT_ID?: string;
  CF_ANALYTICS_TOKEN?: string;
  /** Web addresses allowed to call the admin API from a browser, comma separated. Optional. */
  ADMIN_ORIGIN?: string;
  /** Tests only, and only when ENVIRONMENT is local: a stand-in for Cloudflare's analytics API. */
  CF_GRAPHQL_URL?: string;
  /** Tests only, and only when ENVIRONMENT is local: a stand-in for Cloudflare's status page (worker/health.ts). */
  CF_STATUS_URL?: string;
  /** When this version went live (wrangler.jsonc `version_metadata`), for the dashboard's health page. */
  CF_VERSION_METADATA?: WorkerVersionMetadata;
  /** Tests only, and only when ENVIRONMENT is local: a stand-in for Google's sign-in page and token address. */
  GOOGLE_AUTH_URL?: string;
  GOOGLE_TOKEN_URL?: string;
  ASSETS: Fetcher;
}
