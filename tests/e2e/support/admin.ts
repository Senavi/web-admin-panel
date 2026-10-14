import { projectConfig } from '../../../project.config';

/** The admin's public URL path (`projectConfig.adminPath`, e.g. `/stst-admin`). */
export const ADMIN = projectConfig.adminPath;

/** Admin URL for a sub path: `admin('/settings')` → `/stst-admin/settings`. */
export function admin(path = ''): string {
  return `${ADMIN}${path}`;
}

/** URL pattern under the admin path; `rest` is regex source (`String.raw` for escapes). */
export function adminRe(rest = ''): RegExp {
  return new RegExp(`${ADMIN.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}${rest}`);
}
