# Working as a team

Several people build one site: each works on their own computer with their own local
database, and the code (including the content structure and its default texts) travels
through git. This page is the agreed way of working.

## Three environments

| Git branch                  | Deploy                         | Database                                                            |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `main`                      | **Production** (the live site) | production database (Neon branch `production` / Supabase project 1) |
| `staging`                   | **Staging** (branch deploy)    | staging database (Neon branch `staging` / Supabase project 2)       |
| `feature/*` (pull requests) | Deploy preview                 | none: **preview mode** (content from the code)                      |

Everyone develops on their **local** database (`pnpm dev`). Content structure and seed texts
travel in git; every deploy migrates and syncs **its own** database. **Data never moves from
staging to production; code does.** What you type in the staging admin stays on staging.

Staging is safe to break: it is never indexed, tracking scripts (GA, GTM, Hotjar, HubSpot,
Meta Pixel) never load there, form emails go only to the team (`STAGING_MAIL_TO`), and the
admin shows a purple "Staging" bar (D-097). The branch name is `projectConfig.stagingBranch`
(default `staging`).

## Branches and pull requests

1. `git switch staging && git pull`, then `git switch -c feature/contact-page`.
2. Work, commit, push, open a pull request **into `staging`** (the template in
   `.github/pull_request_template.md` asks what changed and what was checked). The pull
   request gets a deploy preview in preview mode.
3. Someone reviews it; merge; delete the branch. Staging deploys it on its own database.
4. When staging is right, a pull request from `staging` into `main` publishes it.

Keep pull requests small. Files everyone touches (`src/content/index.ts`,
`src/site/navigation.ts`, `src/site/messages/*.json`, shared components, `tokens.css`) are
where merge conflicts happen: pull `staging` often and mention them in the pull request. In a
conflict, keep both sides' entries (registry, navigation, message keys) and run
`pnpm content:check` before pushing.

## Your local database

`pnpm dev` creates a local database in `.data/` (not in git) and fills it from the code.
Nobody else sees it: what you type in your local admin stays on your computer.

- **The final texts belong in the code** (the `seed` of pages, shared sections, globals,
  forms and collection items, and `src/site/messages/*.json` for interface texts). Content
  typed only in a local admin is lost for everyone else.
- **Seed changes reach everyone automatically.** On every start, `pnpm dev` (and every
  deploy) runs `content:sync`: missing content is added, and a text that nobody edited in that
  database follows the new seed ("updated from code" in the log). A text someone edited is
  never overwritten (D-095).
- **Your local edits win locally.** If you edited a text in your local admin and a teammate
  then changes its seed, you keep your version. To take the code's version:
  - one page or section: open it in the admin → **⋯ → Reset to code defaults** (per
    language, per section; undo it from **History**);
  - everything: stop `pnpm dev` and run `pnpm db:reset` (deletes your local content, users,
    images and emails, then fills it again from the code and prints a new admin password).

## Online databases

- **Neon (recommended):** one project, branches `production` and `staging`, Object Storage
  per branch. **Connect Neon** in Security (developer mode) walks you through it and copies
  each environment's variables (each with its own `AUTH_SECRET`).
- **Supabase:** two projects (production, staging). The free plan has 2 active projects per
  account and pauses a project after a week without activity.
- Never point a preview or a branch at the production database: a migration from an unmerged
  branch would change the live site. Staging migrates only with
  `PREVIEW_DATABASE_ISOLATED=true` set for the staging branch only.
- The Connect wizards have "Copy my local content, images and users". In a team, leave it
  off: the online database fills itself from the code. Copy only when your local content is
  the real content (for example a solo project).

### Refreshing staging from production

Sometimes staging should look like the live site (real content, to test a change on it).

- **Neon:** Console → the `staging` branch → **Reset from parent**. The database is
  production's again in seconds (copy-on-write); staging's own changes are gone. Object
  Storage is reset too in the regions that support it (Neon changelog 2026-09-25: AWS US East
  (Ohio) and Europe (Frankfurt) first); elsewhere set `STORAGE_READ_FALLBACK_URL` as below.
- **Supabase / R2:** `pnpm db:clone --from <production url> --to <staging url>` on your
  computer. It refuses before changing anything when the direction is wrong: the target must
  be marked staging by its deploys (or be empty), and a database marked production is never
  overwritten. It lists what will be replaced, asks for confirmation and copies in one
  transaction. Then set
  `STORAGE_READ_FALLBACK_URL` on staging to the production bucket's public URL (staging reads
  missing files from there, never writes) or add `--media-from <that url>` to copy the files.
- After a refresh, re-enter the integration keys on staging (email, etc.): they were
  encrypted with production's `AUTH_SECRET` and show "Re-enter the key".
- Once the client edits the live site, the live database is the source of their texts. Seed
  changes still reach every text the client hasn't edited; for an edited one, change it in the
  live admin (or ask the client to use **Reset to code defaults**).

## Checklist for a pull request

- `pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check`
- New or changed page texts are in the seed, not only in your local admin.
- UI changes checked in a browser (screenshots in the pull request).
