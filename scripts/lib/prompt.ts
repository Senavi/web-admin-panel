import { stdin, stdout } from 'node:process';
import readline from 'node:readline';

/** Minimal interactive prompts (no dependency). */
export function ask(
  question: string,
  options: { hidden?: boolean; defaultValue?: string } = {},
): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
  const suffix = options.defaultValue ? ` (${options.defaultValue})` : '';
  if (options.hidden) {
    // Suppress echo of typed characters.
    (rl as unknown as { _writeToOutput: (value: string) => void })._writeToOutput = (value) => {
      if (value.includes(question)) stdout.write(value);
    };
  }
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      if (options.hidden) stdout.write('\n');
      resolve(answer.trim() || options.defaultValue || '');
    });
  });
}

export function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg?.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=', 2);
    if (!key) continue;
    const next = argv[i + 1];
    if (inline !== undefined) flags[key] = inline;
    else if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else flags[key] = 'true';
  }
  return flags;
}
