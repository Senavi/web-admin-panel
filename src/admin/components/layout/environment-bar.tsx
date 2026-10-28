import { FlaskConicalIcon, TriangleAlertIcon } from 'lucide-react';

import { currentEnvironment } from '@/core/deployment/current';
import { databaseMismatchWarning } from '@/core/deployment/database-check-server';
import { DeploymentEnvironment } from '@/core/deployment/environment';
import { isPreviewMode } from '@/core/preview/mode';

/** Text of the bar per environment (production and development show nothing). */
export const ENVIRONMENT_BAR_TEXT = {
  staging: 'Staging — test database. Changes here never reach the live site.',
  previewReadOnly: 'Preview — read only.',
  preview: 'Preview — test version. Changes here never reach the live site.',
} as const;

/**
 * Top bar on staging and preview deploys, for everyone signed in (D-097). When the
 * site uses the wrong database (staging on the live one, or the reverse; D-099) a
 * red warning replaces it on every page.
 */
export async function EnvironmentBar() {
  const warning = await databaseMismatchWarning();
  if (warning) {
    return (
      <div
        role="alert"
        data-testid="database-mismatch-bar"
        className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white"
      >
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        {warning}
      </div>
    );
  }
  const environment = currentEnvironment();
  const text =
    environment === DeploymentEnvironment.Staging
      ? ENVIRONMENT_BAR_TEXT.staging
      : environment === DeploymentEnvironment.Preview
        ? isPreviewMode()
          ? ENVIRONMENT_BAR_TEXT.previewReadOnly
          : ENVIRONMENT_BAR_TEXT.preview
        : null;
  if (!text) return null;
  return (
    <div
      role="status"
      data-testid="environment-bar"
      className="flex items-center justify-center gap-2 bg-violet-600 px-4 py-2 text-sm font-medium text-white"
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden />
      {text}
    </div>
  );
}
