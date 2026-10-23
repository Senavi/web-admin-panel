## What changed

<!-- One or two sentences: what and why. Link the task if there is one. -->

## Pages touched

<!-- e.g. Home (hero, CTA), Contact. Write "none" if no page changed. -->

## Shared files touched

<!-- Files other people often change too; tick what this pull request edits. -->

- [ ] Content registry (`src/content/index.ts`)
- [ ] Navigation (`src/site/navigation.ts`)
- [ ] Interface texts (`src/site/messages/*.json`, `src/content/ui-texts.ts`)
- [ ] Shared components (`src/site/components/**`, `src/site/sections/**`)
- [ ] Design tokens (`src/site/theme/tokens.css`, `fonts.ts`)
- [ ] Seeds of existing content (texts update on every database where nobody edited them)
- [ ] Database schema or migrations

## Checks run

- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] `pnpm content:check && pnpm tokens:check`
- [ ] Checked in a browser (desktop and phone width)
- [ ] `pnpm e2e:prod` (routing, caching or security changes)

## Screenshots

<!-- Before / after for visual changes. -->
