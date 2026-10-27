import { ConstructionIcon, EyeOffIcon, LockIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/admin/ui/badge';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { INDEXING_LABELS } from '@/core/deployment/rules';
import type { SiteSettings } from '@/core/settings/schema';

/** Header reminders when the site is not publicly available or not indexable (staging never is). */
export function StatusChips({
  status,
  staging,
}: {
  status: SiteSettings['status'];
  staging: boolean;
}) {
  const href = `${adminHref(AdminRoute.Settings)}?tab=access`;
  const chips = [
    status.maintenance.enabled && {
      key: 'maintenance',
      label: 'Site paused',
      icon: ConstructionIcon,
    },
    status.privateMode && { key: 'private', label: 'Private site', icon: LockIcon },
    (staging || (!status.indexing && !status.privateMode)) && {
      key: 'noindex',
      label: staging ? INDEXING_LABELS.staging : INDEXING_LABELS.hidden,
      icon: EyeOffIcon,
    },
  ].filter((chip) => chip !== false);

  if (chips.length === 0) return null;
  return (
    <div className="hidden items-center gap-1.5 md:flex" data-testid="status-chips">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className="border-amber-500/50 text-amber-700 dark:text-amber-300"
          render={<Link href={href} />}
        >
          <chip.icon aria-hidden />
          {chip.label}
        </Badge>
      ))}
    </div>
  );
}
