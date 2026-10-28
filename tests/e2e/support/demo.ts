import fs from 'node:fs';
import path from 'node:path';

/**
 * `src/content/DEMO.md` marks the demo content; `pnpm demo:remove` deletes it with the
 * demo. Without it the demo specs (tests/e2e/demo, tests/unit/demo) are not run
 * (playwright.config.ts, vitest.config.ts).
 */
export const DEMO_MARKER = path.resolve('src/content/DEMO.md');
export const DEMO_PRESENT = fs.existsSync(DEMO_MARKER);
export const DEMO_SPECS = '**/demo/**';
