import { registry } from '@/content';

import type { PageRegistry } from './registry';

/**
 * The project registry widened to its general type. Core code that handles any
 * collection/global/form uses this (the precise project type has `never` for
 * kinds a project doesn't define); site-facing APIs keep the precise types.
 */
export const contentRegistry: PageRegistry = registry;
