import type { SiteState } from './state';
import { verifyGateToken } from './token';

/**
 * A request belongs to staff when its signed site-gate cookie is valid, not
 * expired, and its session version matches the user's current version in the
 * published staff list (disabled users and old sessions are rejected).
 */
export async function isStaffToken(
  secret: string,
  token: string | undefined,
  state: Pick<SiteState, 'staff'>,
): Promise<boolean> {
  const payload = await verifyGateToken(secret, token);
  if (!payload) return false;
  return state.staff[payload.uid] === payload.v;
}

export type GateDecision =
  { readonly type: 'allow' } | { readonly type: 'maintenance' } | { readonly type: 'private' };

/** Maintenance beats private mode for visitors; staff bypass both. */
export function decideGate(
  state: Pick<SiteState, 'maintenance' | 'privateMode'>,
  staff: boolean,
): GateDecision {
  if (staff) return { type: 'allow' };
  if (state.maintenance) return { type: 'maintenance' };
  if (state.privateMode) return { type: 'private' };
  return { type: 'allow' };
}

export const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;
