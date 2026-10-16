'use client';

import { useRouter } from 'next/navigation';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { confirmLeave } from '@/admin/hooks/use-unsaved-guard';
import type { UiTextGroup } from '@/core/ui-texts/editor-types';

import { InterfaceTextGroups } from './interface-texts-panel';
import type { LocaleOption } from './document-editor';

/** Every interface text of the site for one language (Pages → Every page → Interface texts). */
export function InterfaceTextsOverview({
  groups,
  locale,
  locales,
  basePath,
}: {
  groups: readonly UiTextGroup[];
  locale: string;
  locales: readonly LocaleOption[];
  basePath: string;
}) {
  const router = useRouter();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <h1 className="text-xl font-semibold">Interface texts</h1>
          <p className="text-sm text-muted-foreground">
            Buttons, messages and labels used across the site. Each group is also editable on the
            pages that show it.
          </p>
        </div>
        <SimpleSelect
          value={locale}
          onChange={(code) => {
            if (code !== locale && confirmLeave(false)) router.push(`${basePath}?locale=${code}`);
          }}
          options={locales.map((option) => ({
            value: option.code,
            label: `${option.label} (${option.code})${option.draft ? ' · Draft' : ''}`,
          }))}
          ariaLabel="Language"
          className="w-44"
        />
      </div>
      <InterfaceTextGroups groups={groups} locale={locale} />
    </div>
  );
}
