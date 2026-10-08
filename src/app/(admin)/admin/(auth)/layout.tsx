export default function AdminAuthLayout({ children }: LayoutProps<'/admin'>) {
  return <div className="flex min-h-svh flex-col">{children}</div>;
}
