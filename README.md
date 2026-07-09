# Totalum AI App Builder

A Next.js app builder that talks to the Totalum VCaaS API. It runs on any standard
Node.js host (Vercel, a container, a VM, etc.) — there is no platform-specific
deployment layer.

## Getting Started

```bash
npm install
npm run dev      # start the dev server on http://localhost:3000
```

For a production build:

```bash
npm run build
npm start
```

The main page is `src/app/page.tsx`.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

- **`VCAAS_API_KEY`** — *required*. Your Totalum VCaaS API key. This is the only
  variable the app needs to function.
- **`NEXT_PUBLIC_APP_URL`** — *optional*. The public base URL of this app, used by
  `src/proxy.ts` to allow-list its origin in production. Defaults to same-host, so
  you generally only set it for a custom production domain.

Every other variable is optional.

## Deployment

This is a plain Next.js application. Deploy it wherever Next.js runs:

- **Vercel** — import the repo, set `VCAAS_API_KEY` in the project's Environment
  Variables, and deploy. No extra configuration needed.
- **Node.js / container** — `npm run build && npm start`. The server listens on
  `PORT` (default `3000`).
