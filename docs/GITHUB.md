# Put RoofLead on GitHub

1. Unzip the export. Create an empty repository in the intended GitHub account or organization. Start private if it is for an invited team. Do not initialize the remote with a README, license or gitignore; these files already exist locally.
2. In the extracted `rooflead` directory, run the following. Replace `OWNER` with your account/organization and use the actual repository name:

```sh
git init -b main
git add .
git commit -m "Import RoofLead source and contributor documentation"
git remote add origin https://github.com/OWNER/rooflead.git
git push -u origin main
```

Authenticate using your normal GitHub Git credentials. No Sites repository credential is needed for this new GitHub repository.

3. Invite collaborators to the repository. Developers can clone it and use their preferred editor or AI coding assistant. Ask assistants to read `AGENTS.md` and `README.md` first.
4. Use feature branches and pull requests, and require review before merging into `main`. Agree on who may deploy production.

## Source hosting versus website hosting

GitHub will host the source and collaboration workflow. This app also needs a server and database: uploading it to GitHub or enabling GitHub Pages will not run its Worker APIs or D1 database. See `HOSTING.md` for deployment choices and prerequisites.

No GitHub repository was created as part of this export. The destination account, repository name and visibility remain your choice.

## Keep a single source of truth

Choose GitHub as the team's source of truth after importing. Changes pushed to GitHub are not automatically deployed to the existing Site. Avoid independent edits in two repositories. For Sites publication, an authorized maintainer must bring the reviewed changes into the existing Site's checkout and use its Sites publication workflow. Do not replace the Sites remote casually or assume a GitHub Actions deployment is configured.
