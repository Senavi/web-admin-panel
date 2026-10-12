'use client';

import { useToggleDeveloperMode } from '@/admin/components/layout/developer-mode';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/admin/ui/field';
import { Switch } from '@/admin/ui/switch';

/** Account: turn technical settings on or off (display preference only). */
export function DeveloperModeCard() {
  const developer = useToggleDeveloperMode();
  return (
    <Field orientation="horizontal">
      <Switch
        id="developer-mode-switch"
        checked={developer.enabled}
        disabled={developer.pending}
        onCheckedChange={(checked) => developer.toggle(checked)}
      />
      <FieldContent>
        <FieldLabel htmlFor="developer-mode-switch">Developer mode</FieldLabel>
        <FieldDescription>
          Shows technical settings (search codes, analytics, security policy, database). Turn it off
          when you hand the site to a client. It changes what you see, not what you are allowed to
          do.
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}
