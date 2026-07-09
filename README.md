# Totalum Next.js Project

This project is a nextjs project that uses TotalumSdk for database operations.

If you are working outside Totalum: Only commit and push to develop branch, totalum handles the auto merge to main branch and the deployment to production environment.

## Getting Started

First, run:

```bash
npm install

npm run build

npm start

```

the main page is `app/page.tsx`.

<!-- TOTALUM-GITHUB-NOTICE -->
## Totalum workflow

- Project documentation lives in the `totalum-docs/` folder. Check it before making changes.
- Only push to the `develop` branch. Totalum auto-merges `develop` into `main` when you publish from the Totalum platform — do not push directly to `main`.

### Environment variables

To get the `.env` file for this project:

- **Recommended:** Open your project on the Totalum website, go to the code page, and click the download button to download the source code. Inside the downloaded archive you will find a `.env` file — copy it to the project root. For production variables, use `.envProd` instead.
- **Alternative:** Use the Totalum-VCaaS MCP or API to fetch the env file programmatically. Note that this is the **Totalum-VCaaS** MCP/API, not the standard Totalum API/MCP — it exposes a dedicated endpoint/tool for retrieving env files. Prefer the download option above by default.
