# Instructions for coding assistants

Read README.md and docs/HOSTING.md before editing. This repository is RoofLead, a Sites-exported Vinext/Cloudflare Worker application. Main UI logic is in public/*.js; lib/page.ts contains the HTML string returned by app/route.ts. Do not assume this is a conventional React page app.

- Make focused changes and preserve the current appearance and workflows unless asked otherwise.
- Leads/quotes/settings use browser localStorage `rooflead-v1`. Research and outlines use D1. Preserve stored-data compatibility and user ownership.
- Never commit credentials or real customer records. Do not make paid API calls or change production access as an incidental test.
- Preserve Sites identity and hosting bindings for existing-Site changes. Independent hosting requires a deliberate authentication and database migration; never trust client-supplied identity headers.
- Keep SQL migrations append-only; do not replay them blindly on existing databases.
- Use package-lock.json and the checked-in install/build scripts. Do not switch package managers or upgrade dependencies without a task-specific reason.
- Preserve third-party license notices and imagery attribution.
- Run relevant checks and describe verification limits honestly. There is no existing automated test script; use build plus affected workflow checks. For browser scripts, node --check provides a quick syntax check.
- Summarize the change, validation, data migration needs and deployment implications. Do not claim GitHub pushes automatically publish the Site.
