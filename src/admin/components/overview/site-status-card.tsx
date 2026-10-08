import { Badge } from '@/admin/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/admin/ui/card';
import type { DbInfo } from '@/core/db/types';
import type { SiteSettings } from '@/core/settings/schema';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm flex items-center justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap justify-end gap-1">{children}</dd>
    </div>
  );
}

const on = (value: boolean, labels: [string, string], warnWhenOn = true) => (
  <Badge variant={value === warnWhenOn ? 'destructive' : 'secondary'}>
    {value ? labels[0] : labels[1]}
  </Badge>
);

export function SiteStatusCard({ settings, db }: { settings: SiteSettings; db: DbInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Site status</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <Row label="Database">
            <Badge variant="outline">{db.mode === 'local' ? 'Local (PGlite)' : 'Postgres'}</Badge>
          </Row>
          <Row label="Maintenance mode">
            {on(settings.status.maintenance.enabled, ['On', 'Off'])}
          </Row>
          <Row label="Private mode">{on(settings.status.privateMode, ['On', 'Off'])}</Row>
          <Row label="Search engine indexing">
            {on(settings.status.indexing, ['On', 'Off'], false)}
          </Row>
          <Row label="Languages">
            {settings.general.enabledLocales.map((locale) => (
              <Badge
                key={locale}
                variant={locale === settings.general.defaultLocale ? 'default' : 'secondary'}
              >
                {locale}
              </Badge>
            ))}
          </Row>
        </dl>
      </CardContent>
    </Card>
  );
}
