# Contributing to RoofLead

1. Read `README.md` and `docs/HOSTING.md`, install dependencies, and run locally.
2. Create a branch: `git switch -c feature/short-description`.
3. Make a focused change. Keep existing data compatible; do not silently reset `rooflead-v1` or rewrite database history.
4. Build and manually exercise the affected workflow. For browser scripts, also run `node --check public/changed-file.js`. Record exactly what passed and what could not be tested.
5. Open a pull request explaining the user-facing change, validation and any data/deployment implications. Include screenshots for visible UI changes.
6. A maintainer reviews, merges and deploys. A merge alone does not publish the existing Site.

Keep secrets, real customer data, `.wrangler/`, dependencies and generated builds out of commits. Preserve dependency lockfiles and vendor license notices. Do not upgrade the framework or add a deployment pipeline incidentally to an unrelated change.

Useful bounded improvements include breaking the large HTML string into maintainable source, adding tests for geometry and quote calculations, and designing authenticated shared storage. Propose data-model and authentication changes before implementation because they affect existing records and deployment assumptions.
