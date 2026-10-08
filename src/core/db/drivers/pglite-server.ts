import net from 'node:net';

import type { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketHandler } from '@electric-sql/pglite-socket';

/**
 * Development-only Postgres wire-protocol server in front of one PGlite
 * instance. Next.js 16 renders, caches and generates params in several worker
 * processes, but PGlite is single-process, so `pnpm dev` owns the database
 * and every worker connects over TCP with postgres-js (docs/DECISIONS.md D-024).
 *
 * pglite-socket's built-in queue only isolates explicit transactions. With
 * the extended query protocol (Parse/Bind/Execute/Sync), messages from two
 * connections could interleave and corrupt each other's unnamed statements.
 * `SessionQueue` keeps the database locked to one connection until its
 * Sync / simple Query completes (or its transaction ends).
 */

const MESSAGE_SYNC = 0x53; // 'S'
const MESSAGE_QUERY = 0x51; // 'Q'
const MESSAGE_TERMINATE = 0x58; // 'X'
const PROTOCOL_VERSION_3 = 196608;

interface QueueItem {
  readonly handlerId: number;
  readonly message: Uint8Array;
  readonly onData: (data: Uint8Array) => void;
  readonly resolve: (bytes: number) => void;
  readonly reject: (error: unknown) => void;
}

function isStartupMessage(message: Uint8Array): boolean {
  if (message.length < 8) return false;
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  return view.getInt32(4) === PROTOCOL_VERSION_3;
}

function endsUnitOfWork(message: Uint8Array): boolean {
  const type = message[0];
  return (
    isStartupMessage(message) ||
    type === MESSAGE_SYNC ||
    type === MESSAGE_QUERY ||
    type === MESSAGE_TERMINATE
  );
}

export class SessionQueue {
  private readonly queue: QueueItem[] = [];
  private processing = false;
  /** Connection currently holding the session (mid-pipeline or in a transaction). */
  private owner: number | null = null;

  constructor(private readonly db: PGlite) {}

  enqueue(
    handlerId: number,
    message: Uint8Array,
    onData: (data: Uint8Array) => void,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.queue.push({ handlerId, message, onData, resolve, reject });
      void this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const index =
          this.owner === null ? 0 : this.queue.findIndex((item) => item.handlerId === this.owner);
        if (index < 0) break; // Wait for the owner's next message.
        const [item] = this.queue.splice(index, 1);
        if (!item) break;
        let bytes = 0;
        try {
          await this.db.runExclusive(() =>
            this.db.execProtocolRawStream(item.message, {
              onRawData: (data) => {
                bytes += data.length;
                item.onData(data);
              },
            }),
          );
        } catch (error) {
          this.owner = null;
          item.reject(error);
          continue;
        }
        this.owner =
          this.db.isInTransaction() || !endsUnitOfWork(item.message) ? item.handlerId : null;
        item.resolve(bytes);
      }
    } finally {
      this.processing = false;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueueForHandler(handlerId: number): void {
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      const item = this.queue[i];
      if (item?.handlerId === handlerId) {
        this.queue.splice(i, 1);
        item.reject(new Error('Connection closed'));
      }
    }
  }

  async clearTransactionIfNeeded(handlerId: number): Promise<void> {
    if (this.owner !== handlerId) return;
    if (this.db.isInTransaction()) await this.db.exec('ROLLBACK');
    this.owner = null;
    void this.process();
  }
}

export interface PgliteServer {
  readonly url: string;
  readonly stop: () => Promise<void>;
}

/** Serves `db` on 127.0.0.1 (random free port unless given). */
export async function startPgliteServer(
  db: PGlite,
  options: { port?: number } = {},
): Promise<PgliteServer> {
  const queue = new SessionQueue(db);
  const handlers = new Set<PGLiteSocketHandler>();
  const server = net.createServer((socket) => {
    const handler = new PGLiteSocketHandler({
      // pglite-socket types its queue nominally; SessionQueue implements the same contract.
      queryQueue: queue as unknown as ConstructorParameters<
        typeof PGLiteSocketHandler
      >[0]['queryQueue'],
      closeOnDetach: true,
    });
    handlers.add(handler);
    handler.addEventListener('close', () => handlers.delete(handler));
    void handler.attach(socket);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PGlite server has no TCP address.');
  return {
    url: `postgres://postgres:postgres@127.0.0.1:${address.port}/postgres`,
    stop: async () => {
      for (const handler of handlers) await handler.detach(true);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
