# AGENTS.md — ai-app-builder-open

Open-source (MIT) AI app builder: a user types a prompt, an AI agent builds a full-stack
Next.js app, the user previews it live, edits it, and publishes it. **This repo is only the
UI.** Everything heavy — the coding agent, sandboxes, hosting, database, deploys, custom
domains, GitHub sync — is done by the **Totalum API** behind one API key.

**Totalum API reference (read this before touching anything under `src/lib/vcaas*` or
`src/app/api/`):** https://www.totalum.app/totalum-api.md — the whole core API in one
Markdown file, with links to the optional areas (GitHub, Figma, database, webhooks, files,
project transfer, project groups). Do not vendor a copy into this repo; link to it.

## Commands

```bash
npm install                      # Node 20+
cp .env.example .env.local       # then set TOTALUM_VCAAS_API_KEY=tlm_sk_...
npm run dev                      # http://localhost:3000
npx tsc --noEmit                 # typecheck — the fast correctness gate
npx tsc --noEmit --noUnusedLocals --noUnusedParameters   # import hygiene (ESLint's config is currently broken)
npm run build && npm start       # production build — run this before any PR
```

There is no test suite. Verification = typecheck + build + open the changed screen in a
browser with a real key. The key hits real projects and spends real credits: click through
UI, but do not fire publish / restore / pull / delete unless the task requires it.

## Architecture in one screen

```
browser ── vcaasApi (src/lib/vcaas.ts, one function per endpoint, no secrets)
   │  same-origin fetch
   ▼
/api/vcaas/[...path]  (src/app/api/vcaas/*) ── adds `api-key` header ── vcaas-server.ts
   │                                                                     (server-only)
   ▼
https://api-accounts.totalum.app/api/v1/vcaas   ← documented at totalum.app/totalum-api.md
```

- `src/lib/vcaas.ts` — the client catalog. Every UI call goes through here; never hardcode an `/api/vcaas/...` path in a component.
- `src/lib/vcaas-server.ts` — the only module that reads `TOTALUM_VCAAS_API_KEY`. `server-only`. Never import it from a client component.
- `src/lib/vcaas-types.ts` — response types. `src/lib/vcaas-errors.ts` — the error-code → copy mapping.
- `src/app/api/vcaas/_shared.ts` — auth/ownership guards. **Deliberate no-ops**: one operator key, so "who is asking?" is always "you". This is the file to change before real users log in.
- `src/app/api/preview/[projectId]/` — same-origin proxy of a project's dev server; required by the visual editor.
- `src/app/api/visual-edit/[projectId]/apply` — turns visual-editor changes into real source edits (`src/lib/visual-edit*.ts`).
- `src/proxy.ts` — CORS/CSP boundary (Next "proxy", formerly middleware).
- `src/i18n/` — English-only `useT()` over `en.ts`, which is a **verbatim copy of totalum-platform's dictionary**. Same key space, so platform components compile unchanged.

## Feature → where it lives

| Feature | Entry point | Notes |
|---|---|---|
| Dashboard, hero prompt, project list | `src/app/page.tsx` | Submit → name dialog → `projects.launch` (create + first prompt in one call). "New" focuses the textarea; there is no empty-project form. |
| Figma in the hero (pending mode) | `page.tsx` + `FigmaModal` without `projectId` | Token validated by Figma, held in memory, sent as `figma.token` on `launch`, then dropped. |
| Workspace shell | `src/app/project/[projectId]/page.tsx` | Owns polling, the operation slot, all modals, the visual editor toggle. |
| Chat + composer tool tray | `components/workspace/ChatPanel.tsx` | Tray order: attach · Figma · GitHub · edit visually (`components/prompt/*PromptButton.tsx`). |
| Live preview / wake / blocked dialogs | `PreviewPanel`, `use-server-wake.ts`, `ServerWakeNotice`, `ServerBlockedDialog` | `SERVER_NOT_READY` → wait strip, never a silent failure. |
| Code editor + rebuild | `CodePanel.tsx` | Monaco; save = `files.write`, then rebuild. |
| Database browser | `DatabasePanel.tsx` + `lib/totalum-schema.ts` | Reads the project's own DB through `vcaasApi.database`. |
| Visual editor | `components/workspace/visual-editor/*` | Desktop only; refused until the live dev server is ready. |
| Versions, Secrets, Domain, GitHub, Figma, Logs | `*Modal.tsx`, `LogsPanel.tsx` (in a `Modal`) | Errands, not tabs. One `openModal` string in the page → never two at once. |
| Publish | `DeployControl.tsx` → `PublishedModal.tsx` | Dialog explains public URL, ~3 min, 1 credit; links to the domain modal. |
| Long operations banner | `use-project-operation.ts`, `OperationBanner.tsx`, `lib/project-operation.ts` | publish / rebuild / githubPull / restoreVersion / restartServer. One slot, persisted. |
| Export / import / duplicate | `ProjectTransferDialogs.tsx`, `lib/project-transfer.ts` | Import is destructive and rate-limited upstream. |
| Diff viewer | `DiffViewer.tsx`, `lib/diff-parse.ts` | Tries the stored patch first, then rebuilds from the commit. |

## Rules that are not obvious from the code

1. **Copied-from-platform files stay verbatim.** Most of `components/workspace/*`, `components/prompt/*`, `components/primitives/*`, `lib/{format,logs,domain-status,env-parse,diff-parse,github-repo}.ts` and `i18n/en.ts` are straight copies of totalum-platform. Fix bugs there first, then re-copy. The only local adapters are `components/plan/*` (no-op plan gates) and `useLocale()` in `i18n/index.ts`.
2. **Long operations belong to the page, not the modal or popover** that started them — those unmount. Start with `operation.begin(kind)`; the page's bounded watcher ends it.
3. **Preview URL rule (from the API docs):** after every finished prompt, refetch the project and pick the URL named by `developmentUrlFieldToUse`; default to `temporalDevelopmentProjectUrl`. Never cache it.
4. **Agent runs and deploys are async.** Poll `agent/status` / `deployments/status` every 10–15 s; never assume completion from the start response.
5. **New endpoint?** Add the typed function in `vcaas.ts`, the type in `vcaas-types.ts`, and let the catch-all proxy carry it. Only add a dedicated route under `src/app/api/vcaas/` when the request is not plain JSON (uploads, downloads).
6. **New user-facing string?** Add the key to totalum-platform's `en.ts` first, then copy the file here. Do not fork the dictionary.
7. **Mobile and desktop layouts are both mounted** in the workspace page (hidden by CSS). Only the desktop `PreviewPanel` gets `frameRef`; only the desktop `ChatPanel` gets the visual-editor pencil.

## Common next steps

- **Put real users behind it:** see "Boilerplate mode" below — the guards live in `src/app/api/vcaas/_shared.ts`.
- **Rebrand / white-label:** `src/app/layout.tsx` (metadata), `src/app/page.tsx` header, `src/app/icon.svg`, `globals.css` tokens. Remove `InsufficientCreditsModal`'s billing link before selling to customers — it points at the operator's account.
- **Add a workspace capability:** check the endpoint in the API reference above → `vcaas.ts` + types → a `*Modal.tsx` (use `components/primitives/Modal`) → mount it in the workspace page under `openModal`.
- **Add a language:** replace the frozen `useLocale()` in `i18n/index.ts` with the platform's `LocaleProvider` and add `es.ts`.

## Adding an AI app builder to an existing product (any stack)

This repo is the reference implementation. Two ways to use it:

**A. Run it as-is beside your product.** Deploy it on a subdomain (`builder.yourapp.com`), put your login in front of it (see below), and link to `/project/<id>`. Rebrand `layout.tsx`, the dashboard header and `icon.svg`. Nothing else needs to change.

**B. Port the flow into your own stack.** The UI is optional; the contract is not. Mirror three things in your backend language:
1. **A key-holding proxy** = `src/lib/vcaas-server.ts` + `src/app/api/vcaas/[...path]/route.ts`: forward `method`, path, query and body to `https://api-accounts.totalum.app/api/v1/vcaas/<path>`, add `api-key: <your key>`, return the `{ errors, data }` envelope unchanged. Your browser code must never hold the key.
2. **The minimum flow** (section "Complete integration flow" in the API reference): `POST /projects/launch` → poll `GET /projects/:id/agent/status` every 10–15 s until `done` → `GET /projects/:id` and show the URL named by `developmentUrlFieldToUse` in an iframe → follow-ups with `POST /projects/:id/agent/start` → `POST /projects/:id/deployments/deploy` → poll `deployments/status`. Everything else (versions, secrets, domain, GitHub, logs) is additive; copy the matching `*Modal.tsx` for the exact calls and error handling.
3. **Tenancy** = one Totalum project per customer (or per user). Store `projectId ↔ tenant` in your DB, check it on every proxied path that starts with `/projects/<id>/`, and filter `GET /projects` by your own table — the API lists every project the key owns.

Credits are the key owner's. If you resell, meter your users yourself (next section) and keep `GET /api/v1/vcaas/account` in view.

## Boilerplate mode: login with Supabase, payments with Stripe

Today the app is single-tenant: one key, no login, and the route guards in `src/app/api/vcaas/_shared.ts` always answer "yes". To ship it as a product:

**Login and database (Supabase recommended, but you can choose another provider)**
1. `npm i @supabase/supabase-js @supabase/ssr`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only).
2. Tables (RLS on): `profiles(user_id uuid pk, credits integer default 0)`, `projects(project_id text pk, user_id uuid, created_at)`.
3. `src/lib/supabase/server.ts`: `createServerClient` reading the request cookies. A `/login` page with magic link or OAuth.
4. `_shared.ts` — make the two guards real: `resolveVcaasContext()` reads the Supabase user from cookies and returns `401` when absent, else `{ ok: true, ctx: { accountUserId: user.id }, team: { userId } }`. `enforceProjectScope(team, method, path)` returns `403` when `path[0] === "projects" && path[1]` and `projects.user_id !== team.userId`. After a successful `POST /projects` or `/projects/launch`, insert the returned `projectId` for that user.
5. **Wire the guards into every route.** Only `/api/preview/*` and `/api/visual-edit/*` call them today; `src/app/api/vcaas/[...path]`, `upload`, `source-code` and `git-diff` do not. Add the two calls at the top of each handler.
6. Filter the dashboard: intersect `vcaasApi.projects.list()` with the user's `projects` rows (do it in the catch-all route for `GET /projects`, so the client stays a copy).
7. Protect pages in `src/proxy.ts`: redirect `/` and `/project/*` to `/login` without a session.

**Payments (Stripe recommended, but you can choose another provider)**
1. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*` for credit packs or a plan.
2. `POST /api/billing/checkout`: create a Checkout Session (`mode: "payment"` for packs, `"subscription"` for a plan) with `client_reference_id = user.id`, success URL back to the dashboard.
3. `POST /api/billing/webhook`: verify the signature; on `checkout.session.completed` / `invoice.paid` do `profiles.credits += pack_size` for that user. Idempotent on the event id.
4. Gate spending in the catch-all route before forwarding: if the path is one that costs credits (`agent/start`, `projects/launch`, `deployments/deploy`, `versions/*/recover`, `agent/server/start-or-restart`, `domain`, `files/*`, `rebuild`) and `profiles.credits <= 0`, return `{ ok: false, code: "INSUFFICIENT_CREDITS" }` with status 402. The UI already listens for that code and opens `InsufficientCreditsModal` — change its `BUY_CREDITS_URL` to your checkout.
5. Meter: decrement per prompt when `agent/status` reports `done` (`creditsSpent` is on the response), or subscribe to Totalum's webhooks (linked from the API reference) to do it server-side. Reconcile against `GET /api/v1/credits/spending-analytics?projectId=`.

Keep your own price separate from Totalum's credit cost; `GET /api/v1/vcaas/credit-costs` gives the live upstream prices.

## Boundaries

- ✅ Edit anything under `src/`, `README.md`, `AGENTS.md`, `.env.example`.
- ⚠️ Ask before: changing `src/app/api/vcaas/_shared.ts` semantics, renaming `TOTALUM_VCAAS_API_KEY`, editing copied platform files in place, adding dependencies.
- 🚫 Never: commit `.env*` files or any `tlm_sk_` key; expose the key via `NEXT_PUBLIC_*`; call `api-accounts.totalum.app` from client code; vendor the API docs into the repo; run publish/restore/delete against real projects to "test".

## Git

Small, single-purpose commits. Run `npm run build` before opening a PR. PR description: what changed, why, and how it was verified in the browser.
