/**
 * Default maintenance page (core). Uses only the semantic token contract every
 * project theme provides (bg-background, text-h1, text-muted-foreground…).
 * Projects override it in src/site/maintenance/index.tsx.
 */
export interface MaintenanceViewProps {
  readonly locale: string;
  readonly siteName: string;
  readonly message: string;
}

const COPY: Record<string, { title: string; body: string }> = {
  en: {
    title: 'We’ll be back soon',
    body: 'The site is undergoing scheduled maintenance. Please check back shortly.',
  },
  uk: {
    title: 'Незабаром повернемося',
    body: 'На сайті тривають планові технічні роботи. Будь ласка, завітайте трохи пізніше.',
  },
};

export function DefaultMaintenance({ locale, siteName, message }: MaintenanceViewProps) {
  const copy = COPY[locale] ?? COPY.en ?? { title: '', body: '' };
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-gutter py-section">
      <div className="flex max-w-prose flex-col gap-4 text-center">
        <p className="text-overline text-primary">{siteName}</p>
        <h1 className="text-h1 text-foreground">{copy.title}</h1>
        <p className="text-lead text-muted-foreground">{message || copy.body}</p>
      </div>
    </main>
  );
}
