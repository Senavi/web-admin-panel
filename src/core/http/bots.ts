/** Rough crawler / bot detection by user agent (analytics filtering, no forced locale redirects). */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|showyoupage|outbrain|pinterest|vkshare|w3c_validator|whatsapp|lighthouse|headlesschrome|phantomjs|preview|monitor|curl|wget|python-requests|httpclient|go-http-client|axios|node-fetch/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}
