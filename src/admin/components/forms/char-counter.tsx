import { cn } from '@/admin/lib/utils';

/** "42 / 60" counter; turns amber past `recommended`, red past `max`. */
export function CharCounter({
  length,
  recommended,
  max,
}: {
  length: number;
  recommended?: number;
  max?: number;
}) {
  const over = max !== undefined && length > max;
  const warn = !over && recommended !== undefined && length > recommended;
  const limit = recommended ?? max;
  return (
    <span
      className={cn(
        'text-xs text-muted-foreground tabular-nums',
        warn && 'dark:text-amber-400 text-amber-600',
        over && 'text-destructive',
      )}
      aria-live="polite"
    >
      {length}
      {limit !== undefined ? ` / ${limit}` : ''}
    </span>
  );
}
