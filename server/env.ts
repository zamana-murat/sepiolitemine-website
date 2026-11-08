export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  /** Static assets of the Pages project (fonts + logo for the PDF). */
  ASSETS: Fetcher;
  /** Cloudflare Access team domain, e.g. "zamana.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag of the Access application protecting /admin. */
  ACCESS_AUD?: string;
  /** Local development only (.dev.vars). Honoured only on localhost. */
  ACCESS_DEV_BYPASS?: string;
  /** Turnstile widget (bot check on the soft offer form). Site key is public (wrangler.toml). */
  TURNSTILE_SITE_KEY?: string;
  /** Secret. Without it the offer form is closed (503). */
  TURNSTILE_SECRET_KEY?: string;
  /** Secret, shared with functions/api/contact.ts. Without it offers are issued but not emailed. */
  RESEND_API_KEY?: string;
  /** Sender, e.g. "Sepiolite Mine <noreply@sepiolitemine.com>". */
  CONTACT_FROM?: string;
  /** Sales inbox for new offer notifications (default info@sepiolitemine.com). */
  QUOTE_NOTIFY_TO?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { adminEmail: string };
};
