import { FlaskConicalIcon } from 'lucide-react';

import { currentEnvironment } from '@/core/deployment/current';
import { DeploymentEnvironment } from '@/core/deployment/environment';
import { isPreviewMode } from '@/core/preview/mode';

/** Text of the bar per environment (production and development show nothing). */
export const ENVIRONMENT_BAR_TEXT = {
  staging: 'Staging — test database. Changes here never reach the live site.',
  previewReadOnly: 'Preview — read only.',
  preview: 'Preview — test version. Changes here never reach the live site.',
} as const;

/** Top bar on staging and preview deploys, for everyone signed in (D-097). */
export function EnvironmentBar() {
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
      className="bg-violet-600 text-white text-sm font-medium flex items-center justify-center gap-2 px-4 py-2"
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden />
      {text}
    </div>
  );
}
