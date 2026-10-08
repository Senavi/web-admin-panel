import { z } from 'zod';

/**
 * Limited rich text, stored as a Tiptap/ProseMirror-compatible JSON document.
 * Only the node and mark types below are accepted (validated on save and again
 * when rendering), so stored content can never inject arbitrary HTML.
 */

export const RICH_TEXT_HEADING_LEVELS = [2, 3, 4] as const;
export type RichTextHeadingLevel = (typeof RICH_TEXT_HEADING_LEVELS)[number];

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

export const richTextLinkSchema = z.object({
  type: z.literal('link'),
  attrs: z.object({
    href: z
      .string()
      .trim()
      .max(2000)
      .regex(SAFE_HREF, 'Links must be http(s), mailto:, tel:, a relative path or an anchor.'),
    target: z.enum(['_blank']).nullable().optional(),
  }),
});

export const richTextMarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  richTextLinkSchema,
]);
export type RichTextMark = z.infer<typeof richTextMarkSchema>;

export interface RichTextTextNode {
  readonly type: 'text';
  readonly text: string;
  readonly marks?: RichTextMark[];
}
export interface RichTextHardBreak {
  readonly type: 'hardBreak';
}
export type RichTextInline = RichTextTextNode | RichTextHardBreak;

export interface RichTextParagraph {
  readonly type: 'paragraph';
  readonly content?: RichTextInline[];
}
export interface RichTextHeading {
  readonly type: 'heading';
  readonly attrs: { readonly level: RichTextHeadingLevel };
  readonly content?: RichTextInline[];
}
export interface RichTextListItem {
  readonly type: 'listItem';
  readonly content: RichTextParagraph[];
}
export interface RichTextList {
  readonly type: 'bulletList' | 'orderedList';
  readonly content: RichTextListItem[];
}
export type RichTextBlock = RichTextParagraph | RichTextHeading | RichTextList;

export interface RichTextDoc {
  readonly type: 'doc';
  readonly content: RichTextBlock[];
}

const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string().max(10_000),
  marks: z.array(richTextMarkSchema).max(5).optional(),
});
const inlineSchema = z.discriminatedUnion('type', [
  textNodeSchema,
  z.object({ type: z.literal('hardBreak') }),
]);
const paragraphSchema = z.object({
  type: z.literal('paragraph'),
  content: z.array(inlineSchema).max(500).optional(),
});
const headingSchema = z.object({
  type: z.literal('heading'),
  attrs: z.object({ level: z.union(RICH_TEXT_HEADING_LEVELS.map((level) => z.literal(level))) }),
  content: z.array(inlineSchema).max(500).optional(),
});
const listItemSchema = z.object({
  type: z.literal('listItem'),
  content: z.array(paragraphSchema).min(1).max(20),
});
const listSchema = z.object({
  type: z.enum(['bulletList', 'orderedList']),
  content: z.array(listItemSchema).min(1).max(100),
});

export const richTextDocSchema: z.ZodType<RichTextDoc> = z.object({
  type: z.literal('doc'),
  content: z
    .array(z.discriminatedUnion('type', [paragraphSchema, headingSchema, listSchema]))
    .max(200),
});

export const EMPTY_RICH_TEXT: RichTextDoc = { type: 'doc', content: [] };

/** Plain text of a document (character limits, previews, completeness checks). */
export function richTextToPlainText(doc: RichTextDoc): string {
  const blockText = (block: RichTextBlock): string => {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      return block.content.map((item) => item.content.map(blockText).join('\n')).join('\n');
    }
    return (block.content ?? []).map((node) => (node.type === 'text' ? node.text : '\n')).join('');
  };
  return doc.content.map(blockText).join('\n').trim();
}

/** Builds a document from plain paragraphs (seed content, tests). */
export function richTextFromParagraphs(...paragraphs: string[]): RichTextDoc {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })),
  };
}
