# RoofLead

A lead-to-quote workspace for roofing businesses. This is a source export from the existing RoofLead Site, prepared on 9 November 2026.

## Start here

Requires Git and Node.js >=22.13.0 (including npm). From this folder:

```sh
npm run install:ci
npm run build
```

On a fresh local database, apply the two existing migrations in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_superb_the_call.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_massive_forgotten_one.sql
npm run dev
```

Open the loopback URL printed by the dev server (normally http://localhost:5173). Do not replay these SQL files on an already migrated database. Local state stays in ignored `.wrangler/`.

The interface and sample leads can be explored without configuring AI credentials. AI research and roof outlines require a server-side `OPENAI_API_KEY` and D1 tables. This export contains no production secrets or database contents. Configure credentials separately through your development/deployment environment; never put them in frontend JavaScript or commit them. No API calls or credential changes were made while preparing this export.

For local mock identity, visit `/signin-with-chatgpt?return_to=/`. This development simulation is not production authentication. See [hosting and migration](docs/HOSTING.md) before exposing a server to other people.

## Tech stack and where to edit

| Area | Implementation / files |
| --- | --- |
| Main UI | HTML string in `lib/page.ts`, served by `app/route.ts` |
| Browser behavior | Plain JavaScript in `public/app.js`, `roof-tools.js`, `commercial.js`, `documents.js`, `imagery-recovery.js`, `workspace-tools.js` (backup/restore, safe saving, sign-out) |
| Geometry and styling | `public/geometry.js`, `public/style.css` |
| PDF output | Bundled jsPDF in `public/vendor/` |
| Server | TypeScript 5.9.3, Vinext 1.0.0-beta.5, Vite 8.0.13, Cloudflare Worker in `worker/index.ts` |
| Framework dependencies | React 19.2.6, Next.js 16.3.4, Tailwind CSS 4.2.1; starter components in `components/ui/` |
| Research / outlines | `lib/research.ts`, `lib/outline.ts`; OpenAI Responses API, currently configured in source as `gpt-5.4-mini` |
| Address / aerial imagery | `lib/imagery.ts`; NSW Spatial Services |
| Database | Cloudflare D1, Drizzle schema in `db/schema.ts`, SQL migrations in `drizzle/` |
| Hosting configuration | `.openai/hosting.json`, `vite.config.ts`, `scripts/vite/` |

Versions above describe this export, not recommendations to upgrade. `package-lock.json` records exact installed dependency resolutions. The shipped UI is primarily vanilla JS even though the framework starter includes React components.

## Data model: collaboration versus shared customer data

Leads, quotes and settings are saved in the current browser under localStorage key `rooflead-v1`. A different browser or host gets a separate set of data. Research jobs and roof outlines are stored server-side in D1 tables `research_jobs` and `roof_outlines`. GitHub shares source code; it does not synchronize either kind of runtime data.

For a shared business workspace, a future change should move leads/quotes/settings into authenticated server storage with team membership, permissions, migrations and backups. This export does not make that architectural change.

## Share and improve

Read [GitHub setup](docs/GITHUB.md), [contribution instructions](CONTRIBUTING.md) and [AI assistant instructions](AGENTS.md). Existing detailed framework/runtime notes are retained in [STARTER.md](docs/STARTER.md).

## Verification and provenance

Exported from source commit `1eaf3c64fee1654cf5827b5a699c66f4f09d5f9e` for Site `appgprj_6aeae2b9c77c8191ac83b7813ee99245`. All tracked source files are included; the original starter README was moved to `docs/STARTER.md`. New handover documentation was added. Git history, dependencies, generated build output, secrets and production data are not included.

Archive completeness and browser JavaScript syntax were checked. A fresh dependency install, full build, browser QA and live API tests were not run for this documentation/export task. The commands above are based on the checked-in scripts and migrations.

No project-wide open-source license has been selected. Preserve bundled dependency license notices; the owner should choose a license before inviting unrestricted public reuse.
