import { describe, expect, it } from 'vitest';

import {
  DATABASE_MISMATCH_MESSAGES,
  DatabaseMismatch,
  detectDatabaseMismatch,
} from '@/core/deployment/database-check';

const marker = (environment: string, identity: string | null = 'prod/db') => ({
  environment,
  identity,
});

describe('detectDatabaseMismatch (D-099)', () => {
  it('warns when staging uses the live database', () => {
    expect(detectDatabaseMismatch('staging', marker('production'), 'prod/db')).toBe(
      DatabaseMismatch.StagingOnLive,
    );
    // A marker without identity counts as this database.
    expect(detectDatabaseMismatch('staging', marker('production', null), 'prod/db')).toBe(
      DatabaseMismatch.StagingOnLive,
    );
    expect(DATABASE_MISMATCH_MESSAGES[DatabaseMismatch.StagingOnLive]).toMatch(
      /connected to the LIVE database/,
    );
  });

  it('warns when the live site uses the staging database', () => {
    expect(
      detectDatabaseMismatch('production', marker('staging', 'staging/db'), 'staging/db'),
    ).toBe(DatabaseMismatch.LiveOnStaging);
  });

  it('stays quiet for matching, unmarked or copied markers and other environments', () => {
    expect(detectDatabaseMismatch('production', marker('production'), 'prod/db')).toBeNull();
    expect(
      detectDatabaseMismatch('staging', marker('staging', 'staging/db'), 'staging/db'),
    ).toBeNull();
    expect(detectDatabaseMismatch('staging', null, 'staging/db')).toBeNull();
    // Neon "Reset from parent": production's marker on the staging branch until it is re-marked.
    expect(detectDatabaseMismatch('staging', marker('production'), 'staging/db')).toBeNull();
    expect(detectDatabaseMismatch('preview', marker('production'), 'prod/db')).toBeNull();
    expect(detectDatabaseMismatch('development', marker('staging'), 'prod/db')).toBeNull();
  });
});
