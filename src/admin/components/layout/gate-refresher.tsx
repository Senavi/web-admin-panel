'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'site-gate-refreshed-at';
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Keeps the signed site-gate cookie fresh while an admin session is active, so
 * staff can browse the site in maintenance / private mode. At most once an hour.
 */
export function GateRefresher() {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    } catch {
      // Storage unavailable: refresh anyway.
    }
    if (Date.now() - last < REFRESH_INTERVAL_MS) return;
    void fetch('/api/gate', { method: 'POST', credentials: 'same-origin' }).then((response) => {
      if (!response.ok) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // Ignore.
      }
    });
  }, []);
  return null;
}
