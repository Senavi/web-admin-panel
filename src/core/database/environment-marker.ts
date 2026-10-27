import { eq } from 'drizzle-orm';

import { databaseEnvironment } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { DeploymentEnvironment } from '@/core/deployment/environment';

/**
 * The environment marker of a database (D-098): `db:prepare` records `production`
 * or `staging` on deploys, the Connect wizards record `production`, `db:clone`
 * records `staging` on its target. Each marker also records the identity of the
 * database it was written for (`databaseIdentity()`).
 *
 * `production` is sticky: a staging deploy that prepares the SAME database (pointed
 * at the live site by mistake) leaves the marker alone and says so, so `db:clone`
 * can always recognise the live site. A copy of production (Neon "Reset from
 * parent", a restored backup) carries production's marker with another identity:
 * that one is re-marked.
 */
export type MarkedEnvironment =
  typeof DeploymentEnvironment.Production | typeof DeploymentEnvironment.Staging;

const MARKED: ReadonlySet<string> = new Set<MarkedEnvironment>([
  DeploymentEnvironment.Production,
  DeploymentEnvironment.Staging,
]);

export function isMarkedEnvironment(value: string): value is MarkedEnvironment {
  return MARKED.has(value);
}

export interface DatabaseMarker {
  readonly environment: string;
  readonly identity: string | null;
}

export async function readDatabaseMarker(db: Database): Promise<DatabaseMarker | null> {
  const [row] = await db
    .select({
      environment: databaseEnvironment.environment,
      identity: databaseEnvironment.databaseIdentity,
    })
    .from(databaseEnvironment)
    .where(eq(databaseEnvironment.id, 1));
  return row ?? null;
}

/** True when the marker was written for another database (it came along in a copy). */
function isCopiedMarker(current: DatabaseMarker, identity: string | null): boolean {
  return Boolean(current.identity && identity && current.identity !== identity);
}

/**
 * Records the environment (production/staging only; others leave the database
 * unmarked). `identity`: `databaseIdentity()` of the URL used. Returns what
 * happened, for the build log.
 */
export async function markDatabaseEnvironment(
  db: Database,
  environment: string,
  identity: string | null,
): Promise<string | null> {
  if (!isMarkedEnvironment(environment)) return null;
  const current = await readDatabaseMarker(db);
  if (
    current?.environment === DeploymentEnvironment.Production &&
    environment !== DeploymentEnvironment.Production &&
    !isCopiedMarker(current, identity)
  )
    return `WARNING: this database is marked production but a ${environment} deploy prepared it; the marker stays production (check this deploy's DATABASE_URL)`;
  const values = { environment, databaseIdentity: identity, markedAt: new Date() };
  await db
    .insert(databaseEnvironment)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: databaseEnvironment.id, set: values });
  return current && current.environment !== environment
    ? `marked ${environment} (was ${current.environment})`
    : `marked ${environment}`;
}
