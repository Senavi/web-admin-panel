/** Names of the hidden fields every site form posts (client-safe constants). */
export const FormHiddenField = {
  Form: '_form',
  Locale: '_locale',
  Page: '_page',
  /** Signed render time (minimum fill time). */
  Token: '_t',
  /** Honeypot: humans never see or fill it. */
  Honeypot: 'website',
  /** Cloudflare Turnstile response (when enabled). */
  Turnstile: 'cf-turnstile-response',
} as const;
