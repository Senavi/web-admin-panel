'use client';

import { cn } from '@/admin/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/admin/ui/tooltip';
import type { LocaleStatus } from '@/core/content/editor-types';

const STATUS_CLASS: Record<LocaleStatus, string> = {
  complete: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  incomplete: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  missing: 'bg-muted text-muted-foreground',
};
const STATUS_LABEL: Record<LocaleStatus, string> = {
  complete: 'All required fields are filled',
  incomplete: 'Some required fields are empty',
  missing: 'Not translated yet (uses the default language)',
};

/** One chip per locale showing translation completeness (pages tree, collection table). */
export function LocaleStatusChips({
  locales,
  statuses,
}: {
  locales: readonly string[];
  statuses: Readonly<Record<string, LocaleStatus>> | undefined;
}) {
  return (
    <span className="flex gap-0.5">
      {locales.map((locale) => {
        const status = statuses?.[locale] ?? 'missing';
        return (
          <Tooltip key={locale}>
            <TooltipTrigger
              render={<span />}
              className={cn(
                'rounded font-semibold px-1 text-[10px] uppercase',
                STATUS_CLASS[status],
              )}
              aria-label={`${locale}: ${STATUS_LABEL[status]}`}
              data-status={status}
            >
              {locale}
            </TooltipTrigger>
            <TooltipContent>{STATUS_LABEL[status]}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
