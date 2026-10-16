/** Lifetime of a session that still has to choose a new password (temporary password). */
export const PENDING_PASSWORD_SESSION_SECONDS = 30 * 60;

/** True when such a session is older than its allowed lifetime. */
export function pendingSessionExpired(
  createdAt: Date | string | number,
  now = Date.now(),
): boolean {
  return now - new Date(createdAt).getTime() > PENDING_PASSWORD_SESSION_SECONDS * 1000;
}
