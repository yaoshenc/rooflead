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

## Independent Cloudflare deployment (implemented)

An independent deployment runs at https://rooflead.cindyshi688.workers.dev (Worker `rooflead`, D1 database `rooflead-db`; see `deploy/cloudflare.json`). It is separate from the Sites deployment above and has its own, empty data.

**Authentication.** The deploy script sets `ROOFLEAD_HOSTING=independent`, which enables `worker/independent-auth.ts`: every page and API request requires a signed, HttpOnly session cookie obtained by entering the `APP_PASSWORD` Worker secret at `/login` (sign out at `/logout`). Client-supplied `oai-*` headers are stripped and replaced with a server-assigned owner (`ROOFLEAD_OWNER_ID`, default `rooflead-owner`). Without `APP_PASSWORD` the Worker answers 503 (fail closed). Browser files in `public/` are not secret and are served without login. This is a single shared workspace password, not per-user accounts. Sites deployments do not set the variable and are unaffected.

**Deploy / redeploy** (needs a Cloudflare API token with Workers Scripts: Edit, D1: Edit and Account Settings: Read):

```sh
npm run install:ci
npm run build
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npm run deploy:cloudflare
```

The script writes `dist/server/wrangler.deploy.json`, creates the D1 database on first run (recording its id in `deploy/cloudflare.json`), applies migrations with `wrangler d1 migrations apply` (tracked in `d1_migrations`, so already-applied files are skipped) and deploys. By default the `public/` files are embedded into the Worker bundle; `--static-assets` uses Cloudflare static asset hosting instead. `--dry` validates without deploying. A GitHub push does not deploy.

**Secrets** (set once; Cloudflare dashboard → Workers & Pages → rooflead → Settings → Variables and Secrets, or `npx wrangler secret put NAME --config dist/server/wrangler.deploy.json`):

- `APP_PASSWORD` — workspace login password (8+ characters). Changing it signs everyone out.
- `OPENAI_API_KEY` — enables AI research and roof outlines (paid per use).
- `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, `FB_PAGE_ACCESS_TOKEN` — Facebook Lead Ads and Messenger leads with auto-replies. See [FACEBOOK.md](FACEBOOK.md).

Migration `0004_info_requests.sql` adds `questions`, `answers`, `answered_at` and `opened_at` to `upload_links`: the customer link doubles as an information-request form whose answers sync back into the lead.

Migration `0003_job_photos.sql` adds `job_photos` (JPEG bytes + thumbnails, owner-scoped) and `upload_links` (customer upload tokens, stored as SHA-256 hashes). Customer upload pages (`/upload/<token>`) are public by design; they can only add up to 20 photos to one job and expire after 14 days. On the owner-private Sites deployment, customers cannot reach these links.

Migration `0002_facebook_inbound.sql` adds `inbound_leads` and `workspace_settings` (append-only; applied by the deploy script).

## Quote portal payments (demo)

The customer quote link (`/?quote=<token>`) runs card deposits in Stripe-style **test mode**: no payment provider is connected, no money moves, and card numbers are never stored or sent (only brand and last four digits are kept). The portal reads the quote from the same browser's workspace data, so it demonstrates the flow on the roofer's own device; a real customer link needs server-side quote storage and a Stripe PaymentIntent integration (`STRIPE_SECRET_KEY`, webhook for `payment_intent.succeeded`). Reminders and follow-ups are recorded in RoofLead but not delivered until an email/SMS provider is connected.

## Offline inspection mode

`public/sw.js` caches the app shell, scripts and viewed aerial images/photo thumbnails so the inspection mode opens without signal. Photos taken offline are queued in IndexedDB (`rooflead-offline`) and uploaded when the connection returns. API calls are never cached; `/logout` clears the cache.

## Crews, job sheets and weather

Crews and subcontractors live in the workspace data (Settings → Team). A crew job sheet opens at `/?job=<token>`; like the quote portal it reads the workspace data in the same browser, so sharing it with crew phones for real needs server-side job storage and per-crew sign-in. The weather check calls `/api/weather`, which uses Open-Meteo forecasts (free for non-commercial use; commercial use needs an Open-Meteo API plan). The Bureau of Meteorology's website API (`api.weather.bom.gov.au`) is not licensed for reuse; official BOM data is available through BOM's registered data services.

## Sending quotations and the Messages page

Quotations go out by email and SMS when they are prepared (Settings → Automation → Sending quotations; turn automatic sending off to review each one first). Each send is recorded on the quotation (`quote.sends`) in the browser workspace data, with the email, SMS text and recipients, and the Messages page lists everything RoofLead has recorded as sent. No email or SMS provider is connected: delivering these messages for real needs a server-side email service (for example Resend, Postmark or SES) and an SMS gateway (for example Twilio), with their API keys stored as Worker secrets. Quotations shared before this feature get a delivery record from their shared date the first time the workspace loads; no migration is needed.

## Page organisation

`organise.js` loads last and rearranges the lead and quotation pages after they render: secondary cards (photos, inspection, research activity, property brief, document activity) fold behind collapsible headers, and the customer link, delivery history and follow-ups share one "Sending & follow-ups" card. Which cards are open is remembered per browser in localStorage key `rooflead-ui-collapsed`; it is a display preference only and is not part of the workspace data. The Schedule page is no longer in the main navigation, and the Job & crew card appears on a lead only once its quotation is accepted (or work has started). Scheduling, crew job sheets and the weather check still work for accepted jobs.
