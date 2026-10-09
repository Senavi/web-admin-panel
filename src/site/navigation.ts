/**
 * PROJECT: header and footer navigation. Labels come from src/site/messages.
 */
import { registry } from '@/content';

export interface NavItem {
  readonly pageId: string;
  readonly messageKey: 'about' | 'team' | 'blog' | 'contact';
}

export const HEADER_NAV: readonly NavItem[] = [
  { pageId: 'about', messageKey: 'about' },
  { pageId: 'team', messageKey: 'team' },
  { pageId: 'blog', messageKey: 'blog' },
  { pageId: 'contact', messageKey: 'contact' },
];

export function pagePath(pageId: string): string {
  const page = registry.byId(pageId);
  if (!page) throw new Error(`Navigation refers to unknown page "${pageId}".`);
  return page.path;
}
