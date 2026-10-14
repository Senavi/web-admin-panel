import net from 'node:net';

/** Resolves once something accepts TCP connections on 127.0.0.1:`port`. */
export async function waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (open) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Port ${port} did not open in time.`);
}
