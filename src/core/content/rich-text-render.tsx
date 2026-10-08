import type { ComponentType, ReactNode } from 'react';

import {
  type RichTextBlock,
  type RichTextDoc,
  richTextDocSchema,
  type RichTextHeadingLevel,
  type RichTextInline,
} from './rich-text';

/**
 * Renders validated rich text JSON to React elements. No HTML strings are ever
 * injected; unknown nodes are dropped. Projects style it by passing components.
 */
export interface RichTextComponents {
  readonly paragraph?: ComponentType<{ children: ReactNode }>;
  readonly heading?: ComponentType<{ level: RichTextHeadingLevel; children: ReactNode }>;
  readonly list?: ComponentType<{ ordered: boolean; children: ReactNode }>;
  readonly listItem?: ComponentType<{ children: ReactNode }>;
  readonly link?: ComponentType<{ href: string; external: boolean; children: ReactNode }>;
}

const Paragraph = ({ children }: { children: ReactNode }) => <p>{children}</p>;
const Heading = ({ level, children }: { level: RichTextHeadingLevel; children: ReactNode }) => {
  const Tag = `h${level}` as const;
  return <Tag>{children}</Tag>;
};
const List = ({ ordered, children }: { ordered: boolean; children: ReactNode }) =>
  ordered ? <ol>{children}</ol> : <ul>{children}</ul>;
const ListItem = ({ children }: { children: ReactNode }) => <li>{children}</li>;
const Link = ({
  href,
  external,
  children,
}: {
  href: string;
  external: boolean;
  children: ReactNode;
}) => (
  <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
    {children}
  </a>
);

export function RichText({
  doc,
  components = {},
}: {
  doc: RichTextDoc;
  components?: RichTextComponents;
}) {
  // Re-validate at render time: stored JSON is untrusted input.
  const parsed = richTextDocSchema.safeParse(doc);
  if (!parsed.success) return null;
  const c = {
    paragraph: components.paragraph ?? Paragraph,
    heading: components.heading ?? Heading,
    list: components.list ?? List,
    listItem: components.listItem ?? ListItem,
    link: components.link ?? Link,
  };

  const inline = (nodes: readonly RichTextInline[] | undefined) =>
    (nodes ?? []).map((node, index) => {
      if (node.type === 'hardBreak') return <br key={index} />;
      let element: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') element = <strong>{element}</strong>;
        else if (mark.type === 'italic') element = <em>{element}</em>;
        else {
          const external = /^https?:\/\//i.test(mark.attrs.href);
          element = (
            <c.link href={mark.attrs.href} external={external || mark.attrs.target === '_blank'}>
              {element}
            </c.link>
          );
        }
      }
      return <span key={index}>{element}</span>;
    });

  const block = (node: RichTextBlock, index: number): ReactNode => {
    switch (node.type) {
      case 'paragraph':
        return <c.paragraph key={index}>{inline(node.content)}</c.paragraph>;
      case 'heading':
        return (
          <c.heading key={index} level={node.attrs.level}>
            {inline(node.content)}
          </c.heading>
        );
      case 'bulletList':
      case 'orderedList':
        return (
          <c.list key={index} ordered={node.type === 'orderedList'}>
            {node.content.map((item, itemIndex) => (
              <c.listItem key={itemIndex}>{item.content.map(block)}</c.listItem>
            ))}
          </c.list>
        );
    }
  };

  return <>{parsed.data.content.map(block)}</>;
}
