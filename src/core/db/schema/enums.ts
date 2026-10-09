import { pgEnum } from 'drizzle-orm/pg-core';

/** Admin roles. Keep in sync with `Role` in `@/core/auth/roles`. */
export const roleEnum = pgEnum('user_role', ['admin', 'manager']);
export const userStatusEnum = pgEnum('user_status', ['active', 'disabled']);
export const mediaKindEnum = pgEnum('media_kind', ['image', 'logo', 'favicon']);
export const deviceTypeEnum = pgEnum('device_type', ['desktop', 'mobile', 'tablet', 'other']);
export const collectionItemStatusEnum = pgEnum('collection_item_status', ['draft', 'published']);
