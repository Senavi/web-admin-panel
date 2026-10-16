'use client';

import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { CollapsibleSection } from '@/admin/components/layout/accordion';
import { useUnsavedGuard } from '@/admin/hooks/use-unsaved-guard';
import { Alert, AlertDescription } from '@/admin/ui/alert';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Input } from '@/admin/ui/input';
import { Label } from '@/admin/ui/label';
import { ActionErrorCode } from '@/core/actions/result';
import { UiTextSource } from '@/core/ui-texts/model';
import type { UiTextGroup } from '@/core/ui-texts/editor-types';
import { saveUiTextsAction } from '@/core/ui-texts/actions';

const LONG_TEXT = 70;

function notTranslated(source: UiTextSource): boolean {
  return source === UiTextSource.Main || source === UiTextSource.English;
}

function countNotTranslated(groups: readonly UiTextGroup[]): number {
  return groups.reduce(
    (sum, group) => sum + group.texts.filter((text) => notTranslated(text.source)).length,
    0,
  );
}

/**
 * "Interface texts": the small texts of the site (buttons, form messages…) that
 * the document shows, editable per language. Saved on their own, independently
 * of the document, because a namespace can be shown on several pages.
 */
export function InterfaceTextsPanel({
  groups,
  locale,
  localeLabel,
}: {
  groups: readonly UiTextGroup[];
  locale: string;
  localeLabel: string;
}) {
  if (groups.length === 0) return null;
  const missing = countNotTranslated(groups);
  const total = groups.reduce((sum, group) => sum + group.texts.length, 0);
  return (
    <div className="max-w-3xl" data-testid="interface-texts">
      <CollapsibleSection
        id="interface-texts"
        title="Interface texts"
        summary={`${total} small texts of the site (buttons, messages)${
          missing > 0 ? ` · ${missing} not translated to ${localeLabel}` : ''
        }`}
      >
        <InterfaceTextGroups groups={groups} locale={locale} />
      </CollapsibleSection>
    </div>
  );
}

/** The editable groups of texts (also used open on the "Interface texts" overview page). */
export function InterfaceTextGroups({
  groups,
  locale,
}: {
  groups: readonly UiTextGroup[];
  locale: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <TextGroup key={`${group.namespace}:${locale}`} group={group} locale={locale} />
      ))}
    </div>
  );
}

function TextGroup({ group, locale }: { group: UiTextGroup; locale: string }) {
  const router = useRouter();
  const headingId = useId();
  const initialValues = () => Object.fromEntries(group.texts.map((text) => [text.key, text.value]));
  const [saved, setSaved] = useState<Record<string, string>>(initialValues);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [version, setVersion] = useState(group.version);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirtyKeys = group.texts.map((text) => text.key).filter((key) => values[key] !== saved[key]);
  const dirty = dirtyKeys.length > 0;
  useUnsavedGuard(dirty);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const edits = Object.fromEntries(dirtyKeys.map((key) => [key, values[key] ?? '']));
    const result = await saveUiTextsAction({
      namespace: group.namespace,
      locale,
      edits,
      version,
    });
    setSaving(false);
    if (result.ok) {
      setVersion(result.data.version);
      setSaved(values);
      setConflict(null);
      toast.success(result.message ?? 'Saved.');
      router.refresh();
      return;
    }
    if (result.code === ActionErrorCode.Conflict) {
      setConflict(result.error);
      return;
    }
    setErrors(
      Object.fromEntries(
        Object.entries(result.fieldErrors ?? {}).map(([path, messages]) => [
          path.replace(/^edits\./, ''),
          messages[0] ?? '',
        ]),
      ),
    );
    toast.error(result.error);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-base font-medium">
          {group.label}
        </h3>
        {group.alsoOn.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Also on:{' '}
            {group.alsoOn.map((place, index) => (
              <span key={place.id}>
                {index > 0 ? ', ' : ''}
                <Link href={place.href} className="underline underline-offset-2">
                  {place.label}
                </Link>
              </span>
            ))}
            . Changes here update all {group.alsoOn.length + 1} places.
          </p>
        ) : null}
      </div>
      {conflict ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{conflict}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
              Reload latest texts
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <ul className="flex flex-col gap-4">
        {group.texts.map((text) => {
          const value = values[text.key] ?? '';
          const edited = value !== text.inherited;
          const inputId = `ui-${group.namespace}-${text.key}`;
          const error = errors[text.key];
          return (
            <li key={text.key} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={inputId}>{text.label}</Label>
                {notTranslated(text.source) && value === saved[text.key] ? (
                  <Badge variant="outline">Not translated</Badge>
                ) : null}
                {text.source === UiTextSource.Edited || (edited && value !== saved[text.key]) ? (
                  <Badge variant="secondary">Edited</Badge>
                ) : null}
                {edited ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setValues((current) => ({ ...current, [text.key]: text.inherited }))
                    }
                  >
                    <RotateCcwIcon />
                    Reset
                  </Button>
                ) : null}
              </div>
              <Input
                id={inputId}
                value={value}
                lang={locale}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                maxLength={LONG_TEXT * 8}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [text.key]: event.target.value }))
                }
              />
              {error ? (
                <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          Save {group.label.toLowerCase()} texts
        </Button>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => setValues(saved)}
          >
            Discard
          </Button>
        ) : null}
      </div>
    </section>
  );
}
