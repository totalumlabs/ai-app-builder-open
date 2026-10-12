# AGENTS.md — ai-app-builder-open

Open-source (MIT) AI app builder: a user types a prompt, an AI agent builds a full-stack
Next.js app, the user previews it live, edits it, and publishes it. **This repo is only the
UI.** Everything heavy — the coding agent, sandboxes, hosting, database, deploys, custom
domains, GitHub sync — is done by the **Totalum API** behind one API key.

> **⚠️ NO AUTH BY DESIGN.** This project ships with no authentication — deliberately, so
> whoever adopts it can add the auth that fits their system, or whatever they prefer.
> Every route is public and the app acts on one API key, so anyone who can reach the URL
> can use it and spend that key's credits. **If this is going online, an auth layer must
> be in place first** — make the guards in `src/app/api/vcaas/_shared.ts` real and protect
> the pages in `src/proxy.ts` (see "Boilerplate mode" below). Local or private-network use
> without a login is fine.

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
https://builder-api.totalum.app/api/v1/vcaas    ← documented at totalum.app/totalum-api.md
                                                  (TOTALUM_API_URL overrides the host)
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
| Chat + composer tool tray | `components/workspace/ChatPanel.tsx` | Tray order: attach · Figma · GitHub · run options · edit visually (`components/prompt/*PromptButton.tsx`, `RunOptionsMenu.tsx`). Run options (model / effort / fast mode) are per-project, per-tab and sent only when chosen. |
| Attachments (both composers + history) | `components/workspace/AttachmentPreview.tsx`, `lib/attachments.ts`, `lib/composer-attachments.ts` | Image thumbnail or per-kind colour plate, with size. ⌘/Ctrl+V attaches clipboard files. Previews are confirmed with `decode()`, never `onError` (React 19). The workspace composer's attachments are page state, persisted per project, so they survive a reload; the dashboard hero's are raw `File`s and deliberately are not. History attachments come from the API's own `files` field (NOT `inputFiles`), and its URLs must be entity-decoded or they answer 403 — see `decodeAttachments` in the workspace page. |
| Attachment upload limits | `lib/upload.ts` (`MAX_UPLOAD_BYTES`), `api/vcaas/upload/[projectId]/route.ts` | **8 MB per file**, checked in the browser before anything is sent and enforced again by the API. Keep the client constant equal to, or below, the server's. Oversized files are refused instantly with `prompt.attachments.tooLarge{,Many}` plus the advice to paste a public link instead. The proxy forwards the real upstream status and message
| Stopping a run | `ChatPanel.tsx` → `ConfirmDialog` | The stop button confirms first (`workspace.chat.stopConfirm*`). The run is paid for and cannot be resumed, and the button sits where Send sits. |
| Preview address bar (route explorer) | `components/workspace/PathPicker.tsx`, `lib/project-routes.ts`, `lib/source-archive-cache.ts` (local shim) | Lists the project's own pages with type-ahead; picking one navigates the preview. Routes come from `GET …/files/tree` (**free**, never the charged source download); `routesFromPaths` turns route files into paths and drops API handlers. `peekArchive` is a shim that always misses here, which is correct: it is only an optimisation in the platform, and the picker falls through to the tree. |
| Waking a sleeping server | `app/project/[projectId]/page.tsx` (`markWorkspaceTouched`, `autoStartedFor`) | An `Archived` sandbox is started when the user **touches** the project, not when the page loads — opening a project is too cheap to spend credits and minutes on. Clicks inside `[data-workspace-header]` do not count: the header is scaffolding, and clicking it is usually how someone leaves. Guarded on operation-in-flight, agent-running, `serverWake.waking`, `agentServerStatus === "Archived"` exactly, and at least one user message. Once per project per mount. A refused action claims the wake instead of erroring: publish, pull, restore **and the composer** (`SERVER_NOT_READY` → strip + the prompt and its attachments go back in the box, so "send again" is possible). The strip renders in the panel column on desktop and above the tab switch on mobile, where the panel is a separate view. |
| Live preview / wake / blocked dialogs | `PreviewPanel`, `use-server-wake.ts`, `ServerWakeNotice`, `ServerBlockedDialog` | `SERVER_NOT_READY` → wait strip, never a silent failure. |
| Code editor + rebuild | `CodePanel.tsx` | Monaco; save = `files.write`, then rebuild. |
| More tab | `components/workspace/v2/WorkspaceMore.tsx` → `MoreView.tsx` | The platform's "More" view: an aside of sections, the chosen one in place. Each section is the platform's own dialog rendered inline (`<InlineModals>` in `primitives/Modal`). Sections: Database, Analytics, Usage & limits, API keys (+ `.env`), Scheduled jobs, Secrets, Mobile, Payments, Custom domain, Logs, Settings. **New-engine projects only** (`isV2Project`); a legacy project gets a notice. |
| Database explorer | `components/workspace/database-v2/*`, `lib/{db-v2-form,sql-statement,db-backups,db-move}.ts` | The platform's v2 explorer: Dev/Live switch, tables, paged rows with search/sort, create/edit/delete rows, raw SQL and plain-language questions, schema, migrations, backups/restore, database settings. Calls `database/schema`, `database/rows`, `database/records`, `database/sql`, `database/ask`, `database/backups`… The legacy `tables-structure`/`query` explorer was removed. |
| Custom domain | `v2/ProjectDomainPanel.tsx` (More) and `DomainModal.tsx` (+ `DomainBuyPanel`, `DomainConnectGuide`, `settings/DomainManager`, `settings/DomainContactForm`) | Buy (`/domains/search`, `/domains/purchase` with `projectId`) or connect (`PUT …/domain`); bought domains: auto-renew, DNS records, forwarding, renew, transfer code, detach, attach a free one. **Prefix** (`canonicalHost`, `lib/domain-prefix.ts`, `DomainPrefixField`): `www` (default), `app`, any DNS label, or `apex`, picked on buy and attach; changing it = attaching the same domain to the same project again with another prefix (no second fee). The project's `customDomain` (same view as `GET …/projects/:id/domain`) carries `canonicalHost`, `hostnames[]` (each with its status, shown by `DomainHostnames`) and `accountDomainId`. The bare domain (role `alias`) 301s to `https://<prefix>.<domain>` through Totalum's redirect service; its row reads "Redirects to https://<site>" with its own status (active once it answers the 301). Its records (`A`/`AAAA` on the bare domain + `TXT _totalum-redirect.<domain>` = `<prefix>.<domain>`) come in `dnsRecordsToAdd` and render like any other record; `ApexRedirectNote` explains them (no ALIAS/ANAME wording). |
| New-engine banner | `v2/V2Banner.tsx` (+ `RunawayNotice`, `DeployErrorCard`) | Paused project (Resume), emergency stop, database move, last publish failed ("Ask the AI to fix", "Publish anyway" = `confirmDestructive`). |
| Run options | `RunOptionsMenu.tsx`, `lib/run-options.ts` | Legacy: model/effort/fast mode. New engine: the agent tier (Auto/Cheap/Normal/Expensive) only, via `optionsForEngine`. Also "Clear agent context". |
| Visual editor | `components/workspace/visual-editor/*` | Desktop only; refused until the live dev server is ready. |
| Versions, Secrets, Domain, GitHub, Figma, Logs | `*Modal.tsx`, `LogsPanel.tsx` (in a `Modal`) | Errands, not tabs. One `openModal` string in the page → never two at once. |
| Publish | `DeployControl.tsx` → `PublishedModal.tsx` | Dialog explains public URL, ~3 min, 1 credit; links to the domain modal. |
| Long operations banner | `use-project-operation.ts`, `OperationBanner.tsx`, `lib/project-operation.ts` | publish / rebuild / githubPull / restoreVersion / restartServer. One slot, persisted. |
| Export / import / duplicate | `ProjectTransferDialogs.tsx`, `lib/project-transfer.ts` | Import is destructive and rate-limited upstream. |
| Diff viewer | `DiffViewer.tsx`, `lib/diff-parse.ts` | Tries the stored patch first, then rebuilds from the commit. |

## Rules that are not obvious from the code

0. **Shims for copied platform code.** `components/credits/CreditsProvider.tsx` (`usePrice` from `GET /credit-costs`), `lib/usage.ts` (chart colours), and `i18n/en-more.ts` (the platform keys the More view needs, merged into `en` by `en.ts`; a local value always wins). Platform-internal routes are never called: the `.env` download has its own proxy route (`api/vcaas/env/[projectId]`, the upstream answers plain text).
1. **Copied-from-platform files stay verbatim.** Most of `components/workspace/*`, `components/prompt/*`, `components/primitives/*`, `lib/{format,logs,domain-status,env-parse,diff-parse,github-repo}.ts` and `i18n/en.ts` are straight copies of totalum-platform. Fix bugs there first, then re-copy. The only local adapters are `components/plan/*` (no-op plan gates) and `useLocale()` in `i18n/index.ts`.
2. **Long operations belong to the page, not the modal or popover** that started them — those unmount. Start with `operation.begin(kind)`; the page's bounded watcher ends it.
3. **Preview URL rule (from the API docs):** after every finished prompt, refetch the project and pick the URL named by `developmentUrlFieldToUse`; default to `temporalDevelopmentProjectUrl`. Never cache it.
4. **Agent runs and deploys are async.** Poll `agent/status` / `deployments/status` every 10–15 s; never assume completion from the start response.
5. **New endpoint?** Add the typed function in `vcaas.ts`, the type in `vcaas-types.ts`, and let the catch-all proxy carry it. Only add a dedicated route under `src/app/api/vcaas/` when the request is not plain JSON (uploads, downloads).
6. **New user-facing string?** Add the key to totalum-platform's `en.ts` first, then copy the file here. Do not fork the dictionary.
   **⚠️ BUT NEVER RE-COPY `en.ts` WHOLESALE TO PICK UP A FEW KEYS.** This dictionary carries deliberate local values — `workspace.serverWake.startingTitle` is "Your project **server** is still starting" here, and the credit copy names this app's own minimum — and a blind overwrite silently reverts every one of them while also importing unrelated platform copy changes. Copy the individual keys you need, or diff `git diff HEAD -- src/i18n/en.ts` afterwards and put the local values back.
8. **The proxy holds an account-wide key and the app has no login.** Two rules follow, and both are load-bearing security, not style:
   - **Every proxied path must stay inside `/api/v1/vcaas/`.** `vcaas-server.ts`'s `resolveVcaasUrl` resolves the final URL and refuses anything that escapes. Route params arrive decoded, so a traversal segment can otherwise survive into the joined path and `fetch` normalise it onto another part of the account API the key authorises. Never build an upstream URL any other way.
   - **Any server route that fetches a client-supplied URL is an SSRF hole until it calls `publicUrlRejectionReason` (async, resolves DNS) from `lib/safe-url.ts`, with `redirect: "error"` and a timeout.** The sync `urlRejectionReason` is for IP literals only. Both cover IPv4-mapped IPv6 (`::ffff:169.254.169.254`) and every private range; a plain host allowlist does not, because a redirect or a rebinding DNS name walks straight past it.


## Dependencies & security

- **This UI ships no auth / payment / AI SDK.** `better-auth`, `stripe`, `bcrypt`, `jsonwebtoken`, `date-fns`, `recharts`, the AI SDK and their `@types` were listed but never imported and were removed. The builder is a thin client in front of one key; those belong in **boilerplate mode**, added by the operator. Before adding a dependency, confirm it is actually imported.
- **Runtime deps** are UI/utility only: Next 16, React 19, Tailwind 4, Radix UI, `lucide-react`, `sonner`, `cmdk`, `next-themes`, cva/clsx/tailwind-merge, `@monaco-editor/react`, `react-hook-form`, `react-day-picker`, `fflate`.
- **Keep `npm audit` at zero.** A `dompurify` override (`>=3.4.15`) pins the copy Monaco pulls in. Run `npm audit` after any dependency change; do not commit a new advisory.

7. **Mobile and desktop layouts are both mounted** in the workspace page (hidden by CSS). Only the desktop `PreviewPanel` gets `frameRef`; only the desktop `ChatPanel` gets the visual-editor pencil. Anything the composer *holds* (the prompt, the attachments) must therefore be page state passed down, never `useState` inside `ChatPanel` — two mounted copies would drift, and sending on one would leave the other's chips behind.

## Common next steps

- **Put real users behind it:** see "Boilerplate mode" below — the guards live in `src/app/api/vcaas/_shared.ts`.
- **Rebrand / white-label:** `src/app/layout.tsx` (metadata), `src/app/page.tsx` header, `src/app/icon.svg`, `globals.css` tokens. Remove `InsufficientCreditsModal`'s billing link before selling to customers — it points at the operator's account.
- **Add a workspace capability:** check the endpoint in the API reference above → `vcaas.ts` + types → a `*Modal.tsx` (use `components/primitives/Modal`) → mount it in the workspace page under `openModal`.
- **Add a language:** replace the frozen `useLocale()` in `i18n/index.ts` with the platform's `LocaleProvider` and add `es.ts`.

## Adding an AI app builder to an existing product (any stack)

This repo is the reference implementation. Two ways to use it:

**A. Run it as-is beside your product.** Deploy it on a subdomain (`builder.yourapp.com`), put your login in front of it (see below), and link to `/project/<id>`. Rebrand `layout.tsx`, the dashboard header and `icon.svg`. Nothing else needs to change.

**B. Port the flow into your own stack.** The UI is optional; the contract is not. Mirror three things in your backend language:
1. **A key-holding proxy** = `src/lib/vcaas-server.ts` + `src/app/api/vcaas/[...path]/route.ts`: forward `method`, path, query and body to `https://builder-api.totalum.app/api/v1/vcaas/<path>`, add `api-key: <your key>`, return the `{ errors, data }` envelope unchanged. Your browser code must never hold the key.
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
- 🚫 Never: commit `.env*` files or any `tlm_sk_` key; expose the key via `NEXT_PUBLIC_*`; call the Totalum API (`builder-api.totalum.app`) from client code; vendor the API docs into the repo; run publish/restore/delete against real projects to "test".

## Git

Small, single-purpose commits. Run `npm run build` before opening a PR. PR description: what changed, why, and how it was verified in the browser.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
