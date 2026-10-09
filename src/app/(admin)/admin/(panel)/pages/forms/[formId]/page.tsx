import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DocumentEditor } from '@/admin/components/content/document-editor';
import { InboxView, type OpenSubmission } from '@/admin/components/forms-inbox/inbox-view';
import { PageHeader } from '@/admin/components/layout/page-header';
import { cn } from '@/admin/lib/utils';
import { resolveEditorLocale } from '@/admin/server/editor-locale';
import { can, Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { DocumentKind } from '@/core/content/document-target';
import { loadEditorData } from '@/core/content/editor';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { FormFieldType } from '@/core/forms/define';
import { fieldLabels, findSubmission, InboxFilter, loadInbox } from '@/core/forms/inbox';
import { PagesArea, pagesAreaHref } from '@/core/project/paths';

export const instant = false;

const Tab = { Inbox: 'inbox', Texts: 'texts' } as const;
type Tab = (typeof Tab)[keyof typeof Tab];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<'/admin/pages/forms/[formId]'>): Promise<Metadata> {
  const { formId } = await params;
  return { title: contentRegistry.formById(formId)?.label ?? 'Form' };
}

export default async function FormPage({
  params,
  searchParams,
}: PageProps<'/admin/pages/forms/[formId]'>) {
  const [{ formId }, query] = await Promise.all([params, searchParams]);
  const form = contentRegistry.formById(formId);
  if (!form) notFound();
  const tab: Tab = query.tab === Tab.Texts ? Tab.Texts : Tab.Inbox;
  const basePath = pagesAreaHref(PagesArea.Forms, form.id);

  const tabs = (
    <nav aria-label="Form sections" className="flex gap-1 border-b">
      {[
        { id: Tab.Inbox, label: 'Inbox', href: basePath },
        { id: Tab.Texts, label: 'Texts', href: `${basePath}?tab=${Tab.Texts}` },
      ].map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={tab === item.id ? 'page' : undefined}
          className={cn(
            'text-sm -mb-px border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground',
            tab === item.id && 'font-medium border-primary text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  if (tab === Tab.Texts) {
    await requirePermission(Permission.PagesView);
    const editorPath = `${basePath}?tab=${Tab.Texts}`;
    const { locale, locales } = await resolveEditorLocale(query, editorPath);
    const data = await loadEditorData({ kind: DocumentKind.Form, id: form.id }, locale);
    if (!data) notFound();
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <DocumentEditor
          key={`${form.id}:${locale}`}
          data={data}
          locales={locales}
          basePath={editorPath}
          subtitle="Labels, help texts and messages of the form"
        />
      </div>
    );
  }

  const user = await requirePermission(Permission.FormsView);
  const filter =
    Object.values(InboxFilter).find((value) => value === query.status) ?? InboxFilter.Open;
  const search = typeof query.q === 'string' ? query.q.slice(0, 100) : '';
  const page = Math.max(
    1,
    Number.parseInt(typeof query.page === 'string' ? query.page : '1', 10) || 1,
  );
  const db = await getDb();
  const inbox = await loadInbox(db, form, { filter, search, page });

  let open: OpenSubmission | null = null;
  if (typeof query.submission === 'string' && UUID.test(query.submission)) {
    const row = await findSubmission(db, form.id, query.submission);
    if (row) {
      open = {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        status: row.status,
        locale: row.locale,
        pagePath: row.pagePath,
        delivery: row.delivery,
        fields: fieldLabels(form).map(({ key, label }) => {
          const value = row.data[key];
          const type = form.fields[key]?.type;
          const isBoolean = type === FormFieldType.Checkbox || type === FormFieldType.Consent;
          return { label, value: isBoolean ? (value ? 'Yes' : 'No') : String(value ?? '') };
        }),
      };
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={form.label} description={`${inbox.total} submission(s) in this view`} />
      {tabs}
      <InboxView
        formId={form.id}
        inbox={inbox}
        filter={filter}
        search={search}
        basePath={basePath}
        open={open}
        canDelete={can(user.role, Permission.FormsDelete)}
      />
    </div>
  );
}
