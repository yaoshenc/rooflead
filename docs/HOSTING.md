# Hosting and migration

## Existing Sites deployment

Live URL: https://rooflead-workspace.honestsycamore.chatgpt.site/

The existing Site is owner-private. This export does not change its access, hosting or production code. `.openai/hosting.json` retains the existing project identity and declares D1 binding `DB`; R2 is unused. Authorized maintainers can publish reviewed source through the Sites plugin's normal workflow. Preserve the current identity and audience when updating the existing Site. A separate deployment should use its own configuration and infrastructure.

## Independent hosting

The build targets a Cloudflare Worker (`dist/server/index.js`), not a static-only website. An independent deployment needs its own Worker configuration, D1 database and migration process, server secrets, domain configuration, and real authentication/authorization. The local placeholder database ID in `vite.config.ts` is not a production database.

Sites currently authenticates requests upstream and supplies `oai-authenticated-user-id`. Research, imagery persistence and outline handlers fall back to `site-owner-service` when that header is absent. Do not expose that behavior directly on a public independent host: replace it with verified server-side identity and ownership checks, reject unauthenticated protected requests, and strip/reject spoofed identity headers at the trusted boundary. The local mock login is only a development convenience.

Sites connector and sign-in integration code is platform-specific. Audit it when migrating; it does not become an independent authentication system by uploading this repository. Implement and verify the replacement before enabling production access or paid API requests.

## Data transfer

Source export does not export production D1 rows or browser localStorage. Plan separate data exports/backups if moving existing customers and quotes. Browser storage is origin-specific, so changing the domain does not move the user's leads automatically. Decide team ownership and access rules before turning single-browser data into shared server records.

Keep API keys in server runtime secret storage. Preserve NSW imagery attribution and confirm usage requirements when changing how imagery is distributed. The current research and outlines are preliminary inputs requiring human verification.

## Local checks

- `npm run build` builds the Worker and generated Wrangler configuration.
- `npm start` previews the built Worker locally; it does not publish or emulate production Sites login.
- `npm run lint` runs the configured lint command; no claim is made that the inherited project is lint-clean.
- `npm run db:generate` generates migrations after intentional schema changes; inspect them before applying.

The repository does not currently define an automated test script or deployment CI. Before a release, manually check lead creation/editing, persistence after reload, quote calculations, roof geometry editing, PDF export and mobile layout. Test research/outline success and error states only with an intentionally configured development API account and database.
