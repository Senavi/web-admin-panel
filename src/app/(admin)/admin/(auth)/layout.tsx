import { LocalDbBanner } from '@/admin/components/layout/local-db-banner';

export default function AdminAuthLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex min-h-svh flex-col">
      <LocalDbBanner />
      {children}
    </div>
  );
}
