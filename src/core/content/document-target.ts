import { z } from 'zod';

/**
 * Identifies an editable document from the admin (client-safe: no server
 * imports). Resolved on the server by `resolveDocument()` in `document.ts`.
 */
export const DocumentKind = {
  Page: 'page',
  Item: 'item',
  Global: 'global',
  Form: 'form',
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

const ID = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

export const documentTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(DocumentKind.Page), id: ID }),
  z.object({ kind: z.literal(DocumentKind.Item), collectionId: ID, itemId: z.uuid() }),
  z.object({ kind: z.literal(DocumentKind.Global), id: ID }),
  z.object({ kind: z.literal(DocumentKind.Form), id: ID }),
]);
export type DocumentTarget = z.infer<typeof documentTargetSchema>;
