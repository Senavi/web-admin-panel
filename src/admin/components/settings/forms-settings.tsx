'use client';

import { Controller } from 'react-hook-form';

import { RhfNumber, RhfSwitch, RhfText } from '@/admin/components/forms/rhf-fields';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/admin/ui/field';
import { Textarea } from '@/admin/ui/textarea';
import { saveFormsSettingsAction } from '@/core/settings/actions';
import {
  formDestinationsSchema,
  formsSettingsSchema,
  type SiteSettings,
} from '@/core/settings/schema';

import { SettingsForm } from './settings-form';

/** Settings → Forms (admins): where each form's submissions go, and how long they're kept. */
export function FormsSettingsCard({
  forms,
  settings,
}: {
  forms: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  settings: SiteSettings['forms'];
}) {
  return (
    <SettingsForm
      id="forms"
      title="Forms"
      description="Delivery of form submissions and how long they are kept. Secrets (API keys, bot token, webhook secret) are set in environment variables."
      schema={formsSettingsSchema}
      defaultValues={{
        retentionMonths: settings.retentionMonths,
        destinations: Object.fromEntries(
          forms.map((form) => [
            form.id,
            formDestinationsSchema.parse(settings.destinations[form.id] ?? {}),
          ]),
        ),
      }}
      onSave={saveFormsSettingsAction}
    >
      <RhfNumber
        name="retentionMonths"
        label="Keep submissions for (months)"
        description="Older submissions are deleted automatically by the maintenance job."
        min={1}
        max={60}
      />
      {forms.map((form) => {
        const base = `destinations.${form.id}`;
        return (
          <FieldSet key={form.id}>
            <FieldLegend>{form.label}</FieldLegend>
            <FieldDescription>
              Every submission is kept in the inbox; these send a copy.
            </FieldDescription>
            <RhfSwitch name={`${base}.email.enabled`} label="Email" />
            <Controller
              name={`${base}.email.recipients`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${form.id}-recipients`}>Recipients</FieldLabel>
                  <Textarea
                    id={`${form.id}-recipients`}
                    rows={2}
                    value={((field.value as string[] | undefined) ?? []).join('\n')}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value
                          .split(/[\s,;]+/)
                          .map((value) => value.trim())
                          .filter(Boolean),
                      )
                    }
                    onBlur={field.onBlur}
                  />
                  <FieldDescription>One email address per line.</FieldDescription>
                  {fieldState.error?.message ? (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldState.error.message}
                    </p>
                  ) : null}
                </Field>
              )}
            />
            <RhfSwitch
              name={`${base}.webhook.enabled`}
              label="Webhook"
              description="POSTs JSON signed with FORMS_WEBHOOK_SECRET (header X-Signature: sha256=…)."
            />
            <RhfText
              name={`${base}.webhook.url`}
              label="Webhook URL"
              placeholder="https://hooks.example.com/…"
            />
            <RhfSwitch
              name={`${base}.telegram.enabled`}
              label="Telegram"
              description="Uses the bot from TELEGRAM_BOT_TOKEN."
            />
            <RhfText
              name={`${base}.telegram.chatId`}
              label="Telegram chat id"
              placeholder="-1001234567890"
            />
          </FieldSet>
        );
      })}
    </SettingsForm>
  );
}
