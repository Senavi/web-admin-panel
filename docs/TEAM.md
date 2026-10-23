# Working as a team

Several people build one site: each works on their own computer with their own local
database, and the code (including the content structure and its default texts) travels
through git. This page is the agreed way of working.

## Branches

| Branch                          | What it is                                                     |
| ------------------------------- | -------------------------------------------------------------- |
| `main`                          | The live site. Only merged from `dev` when a release is ready. |
| `dev`                           | The test version everyone merges into.                         |
| `feature/<task>` (one per task) | Your work. Open a pull request into `dev`.                     |

1. `git switch dev && git pull`, then `git switch -c feature/contact-page`.
2. Work, commit, push, open a pull request **into `dev`** (the template in
   `.github/pull_request_template.md` asks what changed and what was checked).
3. Someone reviews it; merge; delete the branch.
4. When `dev` is ready, a pull request from `dev` into `main` publishes it.

Keep pull requests small. Files everyone touches (`src/content/index.ts`,
`src/site/navigation.ts`, `src/site/messages/*.json`, shared components, `tokens.css`) are
where merge conflicts happen: pull `dev` often and mention them in the pull request.

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

| Where                           | Database                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` (the live site)          | The production Supabase project. Fills itself from the code on the first deploy; after that the client edits it in the admin.                       |
| `dev` and pull-request previews | None: **preview mode** (demo content from the code, hidden from search engines). Nothing to set up.                                                 |
| `dev` with real data (optional) | A second Supabase project for staging, set for the `dev` branch only, with `PREVIEW_DATABASE_ISOLATED=true` (docs/DEPLOYMENT.md § Preview deploys). |

- Never point a preview or a branch at the production database: a migration from an unmerged
  branch would change the live site.
- **Connect Supabase** (the local wizard) has "Copy my local content, images and users". In a
  team, leave it off: the online database fills itself from the code. Copy only when your
  local content is the real content (for example a solo project).
- Once the client edits the live site, the live database is the source of their texts. Seed
  changes still reach every text the client hasn't edited; for an edited one, change it in the
  live admin (or ask the client to use **Reset to code defaults**).

## Checklist for a pull request

- `pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check`
- New or changed page texts are in the seed, not only in your local admin.
- UI changes checked in a browser (screenshots in the pull request).
