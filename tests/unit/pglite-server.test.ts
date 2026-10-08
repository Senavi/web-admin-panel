import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startPgliteServer, type PgliteServer } from '@/core/db/drivers/pglite-server';

describe('PGlite dev server (SessionQueue)', () => {
  let db: PGlite;
  let server: PgliteServer;

  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec('create table counters (id int primary key, value int not null)');
    await db.exec('insert into counters values (1, 0)');
    server = await startPgliteServer(db);
  });
  afterAll(async () => {
    await server.stop();
    await db.close();
  });

  it('keeps parameterized queries from concurrent connections isolated', async () => {
    const clients = Array.from({ length: 4 }, () =>
      postgres(server.url, { prepare: false, max: 3, onnotice: () => undefined }),
    );
    try {
      const results = await Promise.all(
        clients.flatMap((sql, clientIndex) =>
          Array.from({ length: 40 }, async (_, i) => {
            const expected = clientIndex * 1000 + i;
            const [row] = await sql<{ value: number }[]>`select ${expected}::int as value`;
            return row?.value === expected;
          }),
        ),
      );
      expect(results.every(Boolean)).toBe(true);
    } finally {
      await Promise.all(clients.map((sql) => sql.end()));
    }
  });

  it('serializes concurrent transactions correctly', async () => {
    const clients = Array.from({ length: 3 }, () =>
      postgres(server.url, { prepare: false, max: 2, onnotice: () => undefined }),
    );
    try {
      await Promise.all(
        clients.flatMap((sql) =>
          Array.from({ length: 10 }, () =>
            sql.begin(async (tx) => {
              const [row] = await tx<{ value: number }[]>`select value from counters where id = 1`;
              await tx`update counters set value = ${(row?.value ?? 0) + 1} where id = 1`;
            }),
          ),
        ),
      );
      const result = await db.query<{ value: number }>('select value from counters where id = 1');
      expect(result.rows[0]?.value).toBe(30);
    } finally {
      await Promise.all(clients.map((sql) => sql.end()));
    }
  });
});
