/** Tiny, dependency-free user-agent classification for analytics (not for security decisions). */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'other';

export function deviceType(userAgent: string): DeviceType {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent)) return 'mobile';
  if (/Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(userAgent)) return 'desktop';
  return 'other';
}

export function browserName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/OPR\/|Opera/.test(userAgent)) return 'Opera';
  if (/SamsungBrowser\//.test(userAgent)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return 'Other';
}
