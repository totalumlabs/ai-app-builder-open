# Totalum App Builder API — Core Reference

Build, deploy and manage complete web applications from natural-language prompts. You describe the app; a Totalum AI agent writes it, and Totalum hosts it — database, file storage, auth, SSL, CDN and deploys included. There is no infrastructure to set up.

**This file is the CORE of the API, in full** — everything on the path from a prompt to a live app. Seven optional areas (GitHub, Figma, database, webhooks, source code & files, project transfer, project groups) are documented completely at their own URLs, listed below. Nothing is omitted; it is split so this file stays the size of the job in front of you.

- Quickstart (runnable end-to-end script): https://www.totalum.app/docs/quickstart
- OpenAPI 3.1 specification: https://www.totalum.app/openapi.json
- Base URL: `https://api-accounts.totalum.app`
- Authentication: every request includes the header `api-key: <your-api-key>` (keys are prefixed `tlm_sk_`).
- Response envelope: `{ "errors": null | { "errorCode": "...", "errorMessage": "..." }, "data": ... }`.
- Keep your API key on your backend only — never call the API from browser code.
- Source: https://www.totalum.app/docs/api/overview · MCP setup: https://www.totalum.app/docs/mcp


---

# Start here

**`POST /api/v1/vcaas/projects/launch` is the endpoint to use.** It creates the project *and* starts building it in one call, and it is the default for every new project.

```bash
curl -X POST \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"barber-bookings","prompt":"Build a booking system for a barbershop, with Stripe payments"}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/launch
```

Then the whole flow is:

1. **`POST /projects/launch`** — create and start building. Optionally send the prompt's attachments, the project's secrets, its credit limits and a Figma token in the same call.
2. **`GET /projects/:projectId/agent/status`** — poll every 10–15 s until `status` is `"done"`.
3. **`GET /projects/:projectId`** — read the preview URL (use `developmentUrlFieldToUse` to pick the right field).
4. **`POST /projects/:projectId/agent/start`** — send follow-up prompts to iterate.
5. **`POST /projects/:projectId/deployments/deploy`** — publish when the user is happy, then poll `deployments/status`.

Two things about `launch` that are easy to get wrong:

- **A taken `projectId` is not an error.** It appends random characters until it finds a free name, and returns `requestedProjectId` when it did. Always use the returned `projectId` afterwards.
- **A `200` means the project exists, not that every step happened.** Read `agent.started` and `warnings`; each warning names the endpoint that retries just that step.

Secrets, Figma and attachments must be in place *before* the first build runs, which is exactly why `launch` takes them — set them afterwards and the first build cannot see them.


---

# A complete, working app built on this API (open source)

**https://github.com/totalumlabs/ai-app-builder-open**

An open-source AI app builder — MIT, Next.js — built entirely on the endpoints in this reference. It is the closest thing to an executable version of this document, and it covers essentially the whole surface:

prompt → full-stack app with live preview · a Monaco code editor · a **visual editor** (click an element on the preview and edit it) · the project's database browser · secrets and environment variables · one-click deploys · **custom domains** · bidirectional **GitHub** sync · **Figma** · version history with a git-diff viewer · live server and production logs · project groups · project export/import.

**Use it in two ways:**

1. **As the answer to "how is this endpoint actually called?"** Every request it makes goes through one module — `src/lib/vcaas.ts` — with the types beside it in `src/lib/vcaas-types.ts`. When this reference tells you *what* an endpoint accepts and you want to see *how* a real client calls it, polls it, and handles its errors, read that file rather than guessing.
2. **As a starter template.** If the user has no existing project and no starting point, do not build an app builder from scratch: clone this repository, set one `TOTALUM_VCAAS_API_KEY`, and it runs. It is designed to be self-hosted as-is, white-labelled, or embedded into an existing SaaS — so the work becomes *changing* a working product instead of assembling one.


---

# Optional capabilities — fetch these only when you need them

Everything below this section is the core API and is included in full. The seven areas listed here are **not** part of building and shipping an app, so their reference lives at its own URL. Each URL is the **complete** documentation for that area — every endpoint, field, error code and example. Fetch one when the task calls for it.

### GitHub

If you need to connect a GitHub repository to a project, push or pull code between Totalum and GitHub, check sync status, or download the project's .env — read **https://www.totalum.app/totalum-api/github.md**

### Figma

If you need the agent to build from a Figma design — connecting a Figma account to a project, checking or validating a Figma token, or disconnecting one — read **https://www.totalum.app/totalum-api/figma.md**

### Database

If you need to read or write the records inside a project's own database from your code — querying rows, creating, editing or deleting records, linking many-to-many relations, or reading the table structure — read **https://www.totalum.app/totalum-api/database.md**

### Webhooks

If you want to be notified when something happens instead of polling — a prompt finishing, or a project reaching its credit limit — read **https://www.totalum.app/totalum-api/webhooks.md**

### Source code & files

If you need to read or edit the project's source code yourself — downloading the whole source, browsing the file tree, reading or writing one file, rebuilding after an edit, or uploading a file to attach to a prompt — read **https://www.totalum.app/totalum-api/files.md**

### Project transfer

If you need to copy a project — exporting one, importing it into another, or duplicating one as a template — read **https://www.totalum.app/totalum-api/transfer.md**

### Project groups

If you have many projects and want to file them into folders — creating, listing, renaming or deleting a group — read **https://www.totalum.app/totalum-api/project-groups.md**

If none of the above describes your task, you do not need any of those files.



---

# Account

> Check your current credit balance and what each operation costs.

The Totalum API is a REST API for programmatically building, deploying, and managing projects.

- **Base URL:** `https://api-accounts.totalum.app`
- **Authentication:** every request must include the header `api-key: <your-api-key>` (keys are prefixed `tlm_sk_`).
- **Response envelope:** every response is shaped as `{ "errors": null | { "errorCode": "...", "errorMessage": "..." }, "data": ... }`.

:::tip
Keep your API key secret — it must never leave your backend server. Never call the Totalum API directly from frontend code.
:::

## Get Account Info

```endpoint
method: GET
path: /api/v1/vcaas/account
cost: Free
```

Retrieve your current credit balance and account details.

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.credits` | number | **Total spendable balance** — `recurrentCredits + oneTimeCredits`. This is the number to check before an operation |
| `data.recurrentCredits` | number \| undefined | Monthly plan credits remaining. Reset at the start of each billing period. `0` on accounts with no plan credits |
| `data.oneTimeCredits` | number \| undefined | Purchased credits remaining. These never expire |

:::note Spend order
`data.credits` is the only figure you need to gate a call — it is already the sum of both pools. The breakdown is informational: plan credits are consumed first, so purchased credits are what remains once the monthly allowance runs out. Accounts created before plan credits existed report the whole balance under `oneTimeCredits`.
:::

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/account
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "credits": 425,
    "recurrentCredits": 100,
    "oneTimeCredits": 325
  }
}
```
:::

:::danger Error · 400
```json
{
  "errors": {
    "errorCode": "GET_ACCOUNT_ERROR",
    "errorMessage": "Internal error fetching account info"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `GET_ACCOUNT_ERROR` | 400 | Internal error fetching account info |

## Get Credit Costs

```endpoint
method: GET
path: /api/v1/vcaas/credit-costs
cost: Free
```

Retrieve the current price, in development credits, of every fixed-cost operation. Read it at runtime instead of hard-coding prices: it is the same table the API charges against, so a price change reaches your app without a release.

:::note Fixed costs only
Only operations with a flat price appear here. **Running the AI agent is not one of them** — a prompt costs **typically 10 to 40 credits** depending on how much work it turns out to be (see [Run AI Agent](/docs/api/agent#run-ai-agent) for what sits outside that range), so it has no entry to publish. Infrastructure credits (ChatGPT, image generation, emails, PDFs and the rest) are likewise usage-based and are not listed. Every endpoint not named here is free.
:::

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.creditCosts` | object | Map of operation name to its cost in development credits |
| `data.creditCosts.CREATE_PROJECT` | number | Creating a project |
| `data.creditCosts.CREATE_DEPLOYMENT` | number | Deploying to production |
| `data.creditCosts.START_SERVER` | number | Starting or restarting the dev server |
| `data.creditCosts.GET_SOURCE_CODE` | number | Downloading the full source archive |
| `data.creditCosts.RECOVER_VERSION` | number | Recovering a previous version |
| `data.creditCosts.UPLOAD_FILE` | number | Uploading a file to the project |
| `data.creditCosts.ADD_CUSTOM_DOMAIN` | number | Attaching a custom domain |
| `data.creditCosts.EXPORT_PROJECT` | number | Exporting a project |
| `data.creditCosts.IMPORT_PROJECT` | number | Importing a project |
| `data.creditCosts.UPDATE_FILE` | number | Writing one file through the project-files API |
| `data.creditCosts.REBUILD_PROJECT` | number | Rebuilding the project after file writes |

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/credit-costs
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "creditCosts": {
      "CREATE_PROJECT": 1,
      "CREATE_DEPLOYMENT": 1,
      "START_SERVER": 3,
      "GET_SOURCE_CODE": 1,
      "RECOVER_VERSION": 2,
      "UPLOAD_FILE": 0.5,
      "ADD_CUSTOM_DOMAIN": 2,
      "EXPORT_PROJECT": 2,
      "IMPORT_PROJECT": 6,
      "UPDATE_FILE": 0.1,
      "REBUILD_PROJECT": 1
    }
  }
}
```
:::

:::info Reading a file is free, writing costs 0.1
Browsing the project tree and reading file contents are deliberately free — an editor opens a tree and then a dozen files, and metering that would make the API unusable for the thing it exists for. A write is a real mutation (it writes to the sandbox, commits, snapshots a version and may push to GitHub) but is priced at 0.1 so that saving a component and its two imports does not cost as much as creating a project. A rebuild keeps its full price because it burns a sandbox CPU for minutes.
:::

:::danger Error · 400
```json
{
  "errors": {
    "errorCode": "GET_CREDIT_COSTS_ERROR",
    "errorMessage": "Error getting credit costs"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `GET_CREDIT_COSTS_ERROR` | 400 | Internal error fetching credit costs |


---

# Projects

> Manage the lifecycle of your vibe coding projects.

Projects are the top-level unit of the Totalum App Builder API. Each project has its own database, source code, dev server, and (optionally) a deployment and custom domain. All endpoints require the `api-key` header and return the standard `{ "errors": ..., "data": ... }` envelope.

**Start with [Launch Project](#launch-project)** — it creates a project and starts building it in one call, and it is the default for anything new. Everything else on this page manages a project that already exists.

## Launch Project

```endpoint
method: POST
path: /api/v1/vcaas/projects/launch
cost: Uses credits
```

Create a project **and start building it** in one call.

Getting from `POST /projects` to "the agent is building my app" takes four to six more calls, in an order that is not obvious and that is wrong in three different ways if you guess it. This endpoint is that sequence, done in the order that works.

The only required fields are `projectId` and `prompt`. Everything else is optional — send nothing else and it behaves exactly like a create followed by [Run AI Agent](/docs/api/agent#run-ai-agent).

:::info Just want an empty project, with no development started?
Use [Create Project](#create-project-without-building) instead — but **it is not recommended** for anything you intend to build. It gives you a project and nothing else: no prompt, no build, nothing running, and four to six further calls (in a specific order) before the agent can start.

It is the right call in exactly three cases: you are about to [import](/docs/api/transfer#import-project) an existing project into it, you want to [connect GitHub](/docs/api/github#connect-github) before any code exists, or you intend to [write the files yourself](/docs/api/project-files#write-file-content). Otherwise, launch.
:::

:::info Why one call instead of five
The order is load-bearing, and each of these is a real failure people hit doing it by hand:

- **Secrets** are written into the sandbox `.env` when the build starts. A secret created *after* `agent/start` is not in the file the first build reads — so your app reports the key as missing even though you sent it.
- **Figma** must be connected before the run, or a design link in the prompt is read by an agent that cannot reach Figma.
- **Attachments** uploaded after `agent/start` are not attached to anything — that run already has its file list.
- **Credit limits** set afterwards do not cover the first run, which is the most expensive thing the project will ever do.
:::

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | Yes | Your preferred ID. Same format rules as [Create Project](#create-project-without-building). **If it is taken, it is not an error** — see the callout below |
| `prompt` | string | Yes | What to build. Run as the project's first prompt, exactly as if sent to `POST /agent/start` |
| `description` | string | No | Project description, max 500 characters |
| `label` | string | No | Human display name, max 80 characters |
| `groupId` | string | No | File the project under an existing [project group](/docs/api/project-groups) |
| `files` | array | No | Attachments for the first prompt. Max 10. Each entry needs **exactly one** of `url` or `content` |
| `files[].name` | string | Yes | File name, e.g. `mockup.png` |
| `files[].description` | string | No | What the file shows — the agent reads this. `imageDescription` is accepted as an alias |
| `files[].url` | string | No | Public `http(s)` URL of an already-hosted file. Passed to the agent untouched; nothing is downloaded by Totalum |
| `files[].content` | string | No | Base64 file contents. A `data:image/png;base64,…` prefix is accepted and stripped. Uploaded for you, and costs `UPLOAD_FILE` per file |
| `creditLimits` | object | No | Monthly per-project caps, applied at creation so they cover the first run |
| `creditLimits.maxDevelopmentCreditsPerMonth` | number \| null | No | Positive number, or `null` for no cap. Default: no cap |
| `creditLimits.maxInfrastructureCreditsPerMonth` | number \| null | No | Positive number, or `null` for no cap. Default: `250` |
| `secrets` | array | No | Project secrets (`.env` values), stored **before** the agent starts. Max 50, names must be unique |
| `secrets[].secretName` | string | Yes | Environment variable name |
| `secrets[].secretValue` | string | Yes | The value. Never returned by any endpoint afterwards |
| `secrets[].environment` | string | No | `"development"` \| `"production"` \| `"both"` (default `"both"`) |
| `figma` | object | No | Connect a Figma account so the agent can read designs linked in the prompt |
| `figma.token` | string | Yes | A Figma personal access token. Validated **before** anything is created, so a bad token costs you nothing |

:::warning A taken name is not an error here
Unlike [Create Project](#create-project-without-building), this endpoint never answers `PROJECT_ALREADY_EXISTS`. Project ids are globally unique, so the short obvious names a prompt produces collide often — and a 409 on a call that also starts an agent run costs you the whole round trip and forces you to reimplement the retry.

Instead it tries the name you asked for, then adds 2 random characters, then 3, 4, 5, 6, and creates the first free one. When that happens the response carries `requestedProjectId` with the name you sent.

**Always use the returned `projectId` for every later call.** That is already true in every environment — outside production the API appends its own suffix — but here it can differ for this reason too.
:::

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID that was actually created. Use this for every subsequent call |
| `data.requestedProjectId` | string \| undefined | The `projectId` you asked for. Present **only** when it was taken and a suffixed name was created instead |
| `data.description` | string | Project description |
| `data.plan` | string | Always `"api"` for projects created through the API |
| `data.createdAt` | string | ISO 8601 creation date |
| `data.label` | string \| undefined | The display name, when one was given |
| `data.groupId` | string \| undefined | The group the project was filed under, when any |
| `data.creditLimits` | object | The limits actually stored on the project, defaults included |
| `data.creditLimits.maxDevelopmentCreditsPerMonth` | number \| null | `null` = no cap |
| `data.creditLimits.maxInfrastructureCreditsPerMonth` | number \| null | `null` = no cap |
| `data.files` | array | The attachments as the agent received them. Empty when none were sent |
| `data.files[].name` | string | File name |
| `data.files[].imageDescription` | string | The description you gave, or `""` |
| `data.files[].url` | string | The URL the agent was given — yours for a `url` entry, a signed Totalum URL for an uploaded one |
| `data.secrets` | array | The secrets that were stored. Values are never echoed |
| `data.secrets[]._id` | string | Secret ID (use for deletion) |
| `data.secrets[].secretName` | string | Environment variable name |
| `data.secrets[].environment` | string | `"development"` \| `"production"` \| `"both"` |
| `data.figma` | object \| undefined | Present only when the request carried `figma` and the connection succeeded |
| `data.figma.connected` | boolean | `true` |
| `data.figma.account` | object | The linked Figma account: `{ id, handle, email, imgUrl }`. The token is never returned |
| `data.agent` | object | Whether the first prompt actually started |
| `data.agent.started` | boolean | `false` means the project exists but the run did not start — see `warnings` |
| `data.agent.status` | string \| undefined | `"init"` when the run started; absent otherwise |
| `data.agent.message` | string | What to do next, in words |
| `data.warnings` | array | Empty on the happy path. Each entry is a step that did not happen |
| `data.warnings[].step` | string | `"creditLimits"` \| `"secrets"` \| `"figma"` \| `"files"` \| `"agent"` |
| `data.warnings[].errorCode` | string | Why it failed |
| `data.warnings[].errorMessage` | string | The reason, plus the endpoint that retries **just that step** |

:::warning Always read `agent.started` and `warnings`
A `200` means **the project exists** — not that everything you asked for happened.

Everything judged *before* the project is created (the body, your balance, the Figma token, your plan's project limit, the name) returns a `4xx` and leaves nothing behind. But from the moment the project exists you have been charged and have taken a name in a global namespace, so a later failure cannot answer `4xx`: that would tell you nothing happened, and your retry would collide with the project this very call just created.

So a secret that would not store, a Figma connect that failed, an upload that broke — or the prompt itself not starting — are reported in `warnings`, and each message names the endpoint that retries only that step. If `agent.started` is `false`, call `POST /projects/{projectId}/agent/start` with the same prompt.
:::

:::info What it costs
1 credit for the project (`CREATE_PROJECT`) + 0.5 per **inline** attachment (`UPLOAD_FILE`; a `url` attachment costs nothing), then the agent run itself — typically 10 to 40 credits over 10 to 30 minutes.

The whole up-front bill is checked before anything is created, so you are never left with a project whose attachments were dropped for want of credits.
:::

**Example request**

```bash
curl -X POST \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "barber-bookings",
    "prompt": "Build a booking system for a barbershop, with Stripe payments and email confirmations",
    "label": "Barber bookings",
    "files": [
      { "name": "brand.png", "description": "our brand colours", "url": "https://cdn.example.com/brand.png" }
    ],
    "creditLimits": { "maxDevelopmentCreditsPerMonth": 500 },
    "secrets": [
      { "secretName": "STRIPE_SECRET_KEY", "secretValue": "sk_live_xxx", "environment": "production" }
    ]
  }' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/launch
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "barber-bookings",
    "description": "",
    "plan": "api",
    "createdAt": "2026-08-24T10:30:00.000Z",
    "label": "Barber bookings",
    "creditLimits": {
      "maxDevelopmentCreditsPerMonth": 500,
      "maxInfrastructureCreditsPerMonth": 250
    },
    "files": [
      {
        "name": "brand.png",
        "imageDescription": "our brand colours",
        "url": "https://cdn.example.com/brand.png"
      }
    ],
    "secrets": [
      {
        "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
        "secretName": "STRIPE_SECRET_KEY",
        "environment": "production"
      }
    ],
    "agent": {
      "started": true,
      "status": "init",
      "message": "Process started, can take from 4 to 40 minutes."
    },
    "warnings": []
  }
}
```
:::

:::danger Partial · 200 OK — the project exists, one step did not happen
```json
{
  "errors": null,
  "data": {
    "projectId": "barber-bookings-k7q",
    "requestedProjectId": "barber-bookings",
    "description": "",
    "plan": "api",
    "createdAt": "2026-08-24T10:30:00.000Z",
    "creditLimits": {
      "maxDevelopmentCreditsPerMonth": null,
      "maxInfrastructureCreditsPerMonth": 250
    },
    "files": [],
    "secrets": [],
    "agent": {
      "started": false,
      "message": "The project was created but the first prompt did not start. Retry with POST /api/v1/vcaas/projects/barber-bookings-k7q/agent/start."
    },
    "warnings": [
      {
        "step": "agent",
        "errorCode": "AGENT_START_FAILED",
        "errorMessage": "An agent process is already running."
      }
    ]
  }
}
```
:::

**Error codes**

Nothing is created and nothing is charged for any of these.

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROMPT` | 400 | `prompt` is required and must be a non-empty string |
| `INVALID_FILES` | 400 | `files` is not an array, or an entry is not an object |
| `TOO_MANY_FILES` | 400 | More than 10 attachments |
| `INVALID_FILE_NAME` | 400 | An attachment has no `name` |
| `INVALID_FILE_SOURCE` | 400 | An attachment has neither `url` nor `content`, or has both |
| `INVALID_FILE_URL` | 400 | `files[].url` is not a public `http(s)` URL |
| `INVALID_FILE_CONTENT` | 400 | `files[].content` is not valid base64 |
| `INVALID_SECRETS` | 400 | `secrets` is not an array, or an entry is not an object |
| `TOO_MANY_SECRETS` | 400 | More than 50 secrets |
| `MISSING_SECRET_FIELDS` | 400 | A secret is missing `secretName` or `secretValue` |
| `DUPLICATE_SECRET_NAME` | 400 | The same `secretName` appears twice |
| `INVALID_SECRET_ENVIRONMENT` | 400 | Not one of `development`, `production`, `both` |
| `INVALID_CREDIT_LIMITS` | 400 | `creditLimits` is not an object |
| `INVALID_LIMIT` | 400 | A credit limit is not a positive number (or `null`) |
| `INVALID_FIGMA` | 400 | `figma` is not an object |
| `MISSING_FIGMA_TOKEN` | 400 | `figma.token` is missing or empty |
| `FIGMA_TOKEN_MALFORMED` | 400 | That does not look like a Figma token — see [Check a Figma Token](/docs/api/figma#check-a-figma-token) |
| `FIGMA_TOKEN_INVALID` | 400 | Figma rejected the token |
| `FIGMA_TOKEN_FORBIDDEN` | 400 | Valid token, missing the scopes Totalum needs |
| `FIGMA_RATE_LIMITED` | 400 | Figma is rate-limiting the check — retry shortly |
| `FIGMA_UNREACHABLE` | 400 | Figma could not be reached to check the token |
| `RATE_LIMITED` | 429 | Too many Figma token checks (10/minute per account) |
| `MISSING_PROJECT_ID` | 400 | `projectId` is required |
| `INVALID_PROJECT_NAME` | 400 | Invalid format. Lowercase letters, numbers and hyphens; must start with a letter |
| `INVALID_PROJECT_NAME_LENGTH` | 400 | Project name must be between 4 and 35 characters |
| `INVALID_PROJECT_GROUP` | 400 | The `groupId` does not exist, is not yours, or the group is full |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for the project, its attachments, or to start an agent run |
| `MAX_PROJECTS_REACHED` | 403 | Your plan's project limit is already in use — see [Create Project](#create-project-without-building) |
| `RATE_LIMIT_EXCEEDED` | 429 | You are creating projects faster than your plan allows |
| `PROJECT_ALREADY_EXISTS` | 409 | Only when the name **and** six suffixed candidates were all taken |
| `LAUNCH_PROJECT_ERROR` | 400 | The project could not be created — the message carries the reason |

## List Projects

```endpoint
method: GET
path: /api/v1/vcaas/projects
cost: Free
```

Get your projects, most recently created first.

:::warning Returns at most 100 projects
A single call returns **up to 100 projects**. If your account has more, the response is only the first page — use `skip` to page through the rest, or narrow the result with `search`. Check the `X-Has-More` response header to know whether more pages exist.
:::

**Query parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | Projects per page, 1-100 (default: 100) |
| `skip` | number | No | Projects to skip, for paging (default: 0) |
| `search` | string | No | Case-insensitive match on project ID and description |
| `sortField` | string | No | `date` (default) orders by creation date; `lastModified` orders by when the project last changed. Any other value falls back to `date` |
| `sortDirection` | string | No | `desc` (default) newest first, or `asc` for oldest first |
| `groupId` | string | No | Return only the projects in one [group](/docs/api/project-groups). The literal value `none` returns only **ungrouped** projects |
| `createdFrom` | string | No | Only projects created at or after this date. **Inclusive.** A full instant (`2026-03-01T00:00:00.000Z`) is used verbatim; a bare day (`2026-03-01`) is read as UTC |
| `createdTo` | string | No | Only projects created at or before this date. **Inclusive** — a bare day is widened to that day's last millisecond, so `createdFrom=X&createdTo=X` returns that whole day |

:::info Filtering by plan is not available
This endpoint does not accept a `plan` filter. Each project's plan is still returned in `data[].plan`, but the list cannot be sliced by it — filter client-side if you need that.
:::

:::warning An unknown `groupId` returns an empty list, not everything
A group id that is malformed, deleted, or belongs to another account is passed through and simply matches nothing. That is deliberate: the failure mode of a mistyped filter is "no projects", never "all of your projects".
:::

**Response headers**

| Header | Type | Description |
|---|---|---|
| `X-Total-Count` | number | Total projects matching the filters, across all pages |
| `X-Limit` | number | Page size actually applied |
| `X-Skip` | number | Offset actually applied |
| `X-Has-More` | boolean | `true` when more projects exist beyond this page |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data` | array | Array of project objects |
| `data[].projectId` | string | The project ID |
| `data[].description` | string | Project description |
| `data[].plan` | string | Always `"api"` for projects created through the API |
| `data[].createdAt` | string | ISO 8601 creation date |
| `data[].label` | string \| undefined | The display name. Absent when none is set — fall back to `projectId` |
| `data[].groupId` | string \| undefined | The group the project is filed under. Absent when ungrouped |
| `data[].previewImageUrl` | string \| undefined | Screenshot of the project's home page, refreshed whenever a prompt finishes. Absent until the first prompt of a project completes |
| `data[].lastModifiedAt` | string | ISO 8601 date of the last change to the project — a prompt, a deploy, a rename, a file edit. **Never null on any project, however old**: it falls back through last finished run → screenshot time → `updatedAt` → `createdAt`, so you can render and compare it without a null branch. "Same as `createdAt`" is the truthful answer for a project nobody has touched since making it |
| `data[].productionProjectUrl` | string | The project's production address, `{projectId}.totalum-project.com` |

:::warning `productionProjectUrl` on the list does not reflect a custom domain
On the list it is always the canonical `{projectId}.totalum-project.com` host. [Get Project Details](#get-project-details) is the one that prefers an active custom domain — resolving that costs two extra calls **per project**, which on a page of 100 would turn the cheapest endpoint on this API into its most expensive.

That is safe to link to: a custom hostname is *additive*, so the canonical host keeps serving alongside it. But if you are showing the owner their own domain, read it from the detail endpoint for the one project you are displaying.

It is also **not proof of a deployment**. Nothing records whether a project has ever been published, so this is the address the project *would* serve from, and it 404s until the first successful deploy — exactly as the same field behaves on the detail endpoint. Use [Get Deployment Status](/docs/api/deployments#get-deployment-status) for the real answer.
:::

:::tip Thumbnails come with the list
`previewImageUrl` is returned on every list item on purpose, so a dashboard can draw its cards from this one call instead of a `GET /projects/:projectId` per tile.
:::

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects
```

Second page, 50 at a time:

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects?limit=50&skip=50"
```

Find a project by name instead of paging:

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects?search=landing"
```

Only the projects in one group, or only the ungrouped ones:

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects?groupId=65f1a2b3c4d5e6f7a8b9c0d1"

curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects?groupId=none"
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": [
    {
      "projectId": "my-app",
      "description": "A SaaS landing page",
      "plan": "api",
      "createdAt": "2026-03-11T10:30:00.000Z",
      "label": "Acme storefront",
      "groupId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "previewImageUrl": "https://storage.totalum.app/previews/my-app.png"
    }
  ]
}
```
:::

:::info Paging through every project
Keep increasing `skip` by your `limit` while `X-Has-More` is `true`:

```bash
skip=0
while :; do
  page=$(curl -s -D /tmp/h -H "api-key: tlm_sk_your_key" \
    "https://api-accounts.totalum.app/api/v1/vcaas/projects?limit=100&skip=$skip")
  echo "$page"
  grep -qi '^x-has-more: true' /tmp/h || break
  skip=$((skip + 100))
done
```
:::

:::danger Error · 400
```json
{
  "errors": {
    "errorCode": "LIST_PROJECTS_ERROR",
    "errorMessage": "Internal error listing projects"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `LIST_PROJECTS_ERROR` | 400 | Internal error listing projects |

## Get Project Details

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId
cost: Free
```

Retrieve full project info including status, deployment, secrets, and URLs. This is the main polling endpoint for project state.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `:projectId` | string | The project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID |
| `data.label` | string \| undefined | The display name. Absent when none is set — fall back to `projectId`. Returned here as well as on the list so a single-project screen can show and edit the name without paging every project to find its own row |
| `data.groupId` | string \| undefined | The group the project is filed under. Absent when ungrouped |
| `data.previewImageUrl` | string \| undefined | Screenshot of the project's home page, refreshed whenever a prompt finishes. Absent until the first prompt completes |
| `data.description` | string | Project description |
| `data.plan` | string | Always `"api"` for projects created through the API |
| `data.agentProcessStatus` | string \| undefined | `"init"` (running) \| `"done"` (finished) \| `"idle"` (not started) |
| `data.agentServerStatus` | string \| undefined | `"Active"` \| `"Creating"` \| `"Starting"` \| `"Archived"` \| `"Unarchiving"` \| `"Archiving"` |
| `data.createdAt` | string | ISO 8601 creation date |
| `data.deployment` | object \| null | Latest deployment info, null if never deployed |
| `data.deployment.status` | string | `"deploying"` \| `"success"` \| `"error"` |
| `data.deployment.createdAt` | string | ISO 8601 deployment date |
| `data.deployment.versionId` | string \| undefined | Version ID that was deployed |
| `data.versionRecovery` | object \| null | Set while a recoverVersion call is running, otherwise null. **This is the canonical signal for "is a version recovery in progress"** — do NOT poll agentProcessStatus for recovery (the agent is not involved). |
| `data.versionRecovery.status` | string | `"recovering"` (in progress) \| `"error"` (last recovery failed) |
| `data.versionRecovery.versionId` | string | The version ID currently being / last attempted being recovered |
| `data.versionRecovery.startedAt` | string | ISO 8601 start time |
| `data.versionRecovery.errorMessage` | string \| undefined | Present when status=`"error"` — surface this text to the user |
| `data.importInProgress` | object \| null | Set while an `importProject` call is restoring and rebuilding, otherwise null. **This is the canonical signal for "is a project import in progress"** — poll this until it is null rather than guessing from `agentServerStatus`, which looks identical on a cold sandbox. Reported as null once the import ends (success or failure) and also once the lock is older than 30 minutes, so it can never stay set for a job that died. |
| `data.importInProgress.startedAt` | string | ISO 8601 start time, from the server that started the import — not the caller's clock |
| `data.importInProgress.errorMessage` | string \| undefined | Present when the import ended in failure |
| `data.secrets` | array | List of secret names (values never returned) |
| `data.secrets[]._id` | string | Secret ID (use for deletion) |
| `data.secrets[].secretName` | string | Environment variable name |
| `data.secrets[].environment` | string | `"development"` \| `"production"` \| `"both"` |
| `data.customDomain` | object \| null | Custom domain info, null if none configured |
| `data.customDomain.hostname` | string | The custom domain hostname |
| `data.customDomain.status` | string | `"pending_validation"` \| `"pending_deployment"` \| `"active"` \| `"blocked"` |
| `data.customDomain.sslStatus` | string | SSL certificate status |
| `data.customDomain.dnsRecordsToAdd` | array \| undefined | DNS records to configure: `[{ type: "CNAME"\|"TXT", name, value }]` |
| `data.customDomain._id` | string | The custom domain record ID |
| `data.customDomain.projectId` | string | The project the domain belongs to |
| `data.customDomain.deploymentId` | string | The deployment the domain is attached to |
| `data.customDomain.createdAt` | string | ISO 8601 date the domain was added |
| `data.customDomain.updatedAt` | string | ISO 8601 date the domain record last changed |
| `data.temporalDevelopmentProjectUrl` | string \| null \| undefined | Live development preview URL (from the running dev server). May be null/undefined if no server has started yet. |
| `data.cachedDevelopmentUrl` | string \| null \| undefined | Cached development preview URL (static snapshot, available when server is not active). May be null/undefined if the project has never been archived. |
| `data.developmentUrlFieldToUse` | string \| null \| undefined | Which field to use for the development preview right now: `"temporalDevelopmentProjectUrl"` or `"cachedDevelopmentUrl"`. **If this field is null or undefined, default to `temporalDevelopmentProjectUrl`.** |
| `data.productionProjectUrl` | string \| undefined | Production URL — custom domain if connected, otherwise {projectId}.totalum-project.com |
| `data.totalCreditsSpent` | number | Total credits spent on this project |
| `data.creditLimits` | object | Currently configured monthly credit limits for this project |
| `data.creditLimits.maxDevelopmentCreditsPerMonth` | number \| null | Max development credits/month (null = no limit) |
| `data.creditLimits.maxInfrastructureCreditsPerMonth` | number \| null | Max infrastructure credits/month (null = no limit) |
| `data.multiPrompt` | object \| null | Present only when a multi-prompt batch was started via POST /agent/start with `multiPrompt`. Same shape as on GET /agent/status. |

:::info Preview URL logic
Use `data.developmentUrlFieldToUse` to decide which development URL to display. It returns the name of the response field containing the best URL for the current state. If it returns `"cachedDevelopmentUrl"`, use `data.cachedDevelopmentUrl`; if it returns `"temporalDevelopmentProjectUrl"`, use `data.temporalDevelopmentProjectUrl`. **If `developmentUrlFieldToUse` is null or undefined, always fall back to `data.temporalDevelopmentProjectUrl`.** The cached URL is a static snapshot available when the dev server is down (e.g. archived). Once the server is active and a prompt completes, it switches back to the live URL.
:::

:::warning When to refresh the preview
You MUST call `GET /projects/:projectId` and re-read the preview URL fields on these events: (1) when the user navigates to the project page, (2) when the user manually refreshes the page, and (3) every time a prompt finishes (agent status becomes `"done"`). The preview URL can change between these events. Always re-read `developmentUrlFieldToUse` after fetching and use it to pick the correct URL. Never cache the preview URL permanently. If you embed a dev preview URL or the production URL in an iframe, always provide an "Open in new tab" button next to it.
:::

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "label": "Acme storefront",
    "groupId": "65f1a2b3c4d5e6f7a8b9c0d1",
    "previewImageUrl": "https://storage.totalum.app/previews/my-app.png",
    "description": "A SaaS landing page",
    "plan": "api",
    "agentProcessStatus": "done",
    "agentServerStatus": "Active",
    "createdAt": "2026-03-11T10:30:00.000Z",
    "deployment": {
      "status": "success",
      "createdAt": "2026-03-11T11:00:00.000Z",
      "versionId": "v_abc123"
    },
    "versionRecovery": null,
    "importInProgress": null,
    "secrets": [
      {
        "_id": "s1",
        "secretName": "STRIPE_KEY",
        "environment": "both"
      }
    ],
    "customDomain": {
      "hostname": "app.mysite.com",
      "status": "active",
      "sslStatus": "active",
      "dnsRecordsToAdd": [
        { "type": "CNAME", "name": "app", "value": "my-app.totalum-project.com" },
        { "type": "TXT", "name": "_cf-custom-hostname.app", "value": "verification-token" }
      ]
    },
    "temporalDevelopmentProjectUrl": "https://dev-my-app.totalum.app",
    "cachedDevelopmentUrl": "https://my-app-dev-a1b2c3d4.totalum-project.com",
    "developmentUrlFieldToUse": "temporalDevelopmentProjectUrl",
    "productionProjectUrl": "app.mysite.com",
    "totalCreditsSpent": 12.4,
    "creditLimits": {
      "maxDevelopmentCreditsPerMonth": 100,
      "maxInfrastructureCreditsPerMonth": null
    },
    "multiPrompt": null
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |

## Update Project

```endpoint
method: PATCH
path: /api/v1/vcaas/projects/:projectId
cost: Free
```

Change a project's display **label**, its **description**, or the **group** it is filed under.

:::danger `projectId` cannot be changed
The project ID is the organization id *and* the production hostname, and there is no rename anywhere in the stack — which is exactly why `label` exists. Sending `projectId` in the body does nothing.
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string \| null | No | Display name, trimmed and capped at 80 characters. `null` or an empty string clears it, and clients fall back to `projectId` |
| `description` | string \| null | No | Trimmed and capped at 500 characters. `null` or an empty string clears it |
| `groupId` | string \| null | No | An existing [project group](/docs/api/project-groups) to file it under. `null` removes the project from its group |

:::warning Absent keys are left alone; `null` clears
These are different requests and behave differently. `{}` is rejected as a no-op, `{ "label": "New name" }` touches nothing but the label, and `{ "label": null }` removes it. A PATCH is never a full replacement here — updating one field can't blank another by omission.
:::

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | Unchanged — the id is immutable |
| `data.label` | string \| undefined | The label after the update. Absent when cleared or never set |
| `data.description` | string | The description after the update. Empty string when none is set |
| `data.groupId` | string \| undefined | The group after the update. Absent when the project is ungrouped |

**Example request**

```bash
curl -X PATCH \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"label":"Acme storefront","groupId":"65f1a2b3c4d5e6f7a8b9c0d1"}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app
```

Remove the label and take the project out of its group:

```bash
curl -X PATCH \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"label":null,"groupId":null}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "label": "Acme storefront",
    "description": "A SaaS landing page",
    "groupId": "65f1a2b3c4d5e6f7a8b9c0d1"
  }
}
```
:::

:::danger Error · 400
```json
{
  "errors": {
    "errorCode": "NOTHING_TO_UPDATE",
    "errorMessage": "Provide at least one of label, description or groupId"
  },
  "data": null
}
```
:::

:::info Reading back immediately is safe
`GET /projects/:projectId` serves a snapshot cached for a few seconds to absorb dashboard polling, and that snapshot carries `label` and `groupId`. A successful PATCH drops it, so an editing UI that saves a name and refetches straight away reads the new value, not the old one.
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `NOTHING_TO_UPDATE` | 400 | The body contained none of `label`, `description` or `groupId` |
| `INVALID_PROJECT_GROUP` | 400 | The group does not exist, is not yours, or already holds the maximum of 100,000 projects |
| `UPDATE_PROJECT_ERROR` | 400 | Internal error updating the project |

## Delete Project

```endpoint
method: DELETE
path: /api/v1/vcaas/projects/:projectId
cost: Free
```

Permanently delete a project and all its data.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `:projectId` | string | The project ID to delete |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.success` | boolean | true on successful deletion |

**Example request**

```bash
curl -X DELETE -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app
```

:::success Success · 200 OK
```json
{ "errors": null, "data": { "success": true } }
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `PLAN_NOT_API` | 400 | Only API plan projects can be deleted from this API |

## Update Credit Limits

```endpoint
method: PATCH
path: /api/v1/vcaas/projects/:projectId/credit-limits
cost: Free
```

Set monthly spending caps per project for development and/or infrastructure credits. Set a field to `null` to remove that limit.

**Defaults, on every project created through this API** — whether by [Launch Project](#launch-project) or [Create Project](#create-project-without-building), they are the same:

| Category | Default | Meaning |
|---|---|---|
| `maxDevelopmentCreditsPerMonth` | `null` | No cap. Agent runs, deploys and file writes are limited only by your account balance |
| `maxInfrastructureCreditsPerMonth` | `250` | Capped. The app's own usage — emails, PDFs, AI calls, image generation — stops at 250 credits a month until you raise or remove it |

`launch` lets you override both in the same call that creates the project, so the caps cover the first run. This endpoint changes them afterwards.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `:projectId` | string | The project ID |

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `maxDevelopmentCreditsPerMonth` | number or null | No | Max development credits per month (null to remove) |
| `maxInfrastructureCreditsPerMonth` | number or null | No | Max infrastructure credits per month (null to remove) |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.creditLimits.maxDevelopmentCreditsPerMonth` | number or null | Current development limit |
| `data.creditLimits.maxInfrastructureCreditsPerMonth` | number or null | Current infrastructure limit |

**Example request**

```bash
curl -X PATCH \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"maxDevelopmentCreditsPerMonth":500,"maxInfrastructureCreditsPerMonth":100}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/credit-limits
```

To remove a limit, set it to null:

```bash
curl -X PATCH \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"maxDevelopmentCreditsPerMonth":null}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/credit-limits
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "creditLimits": {
      "maxDevelopmentCreditsPerMonth": 500,
      "maxInfrastructureCreditsPerMonth": 100
    }
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project doesn't exist or you don't own it"
  },
  "data": null
}
```
:::

:::note
Development spending is uncapped by default and limited only by your account balance; **infrastructure is capped at 250 credits a month** on every project created through this API (see the defaults table above). When a project reaches a limit, operations in that category return a `403 PROJECT_CREDIT_LIMIT_REACHED` error. Limits reset automatically on the 1st of each month.
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_LIMIT_FIELDS` | 400 | At least one of the two limit fields is required |
| `INVALID_LIMIT` | 400 | Amount must be a positive number |
| `PROJECT_NOT_FOUND` | 404 | Project doesn't exist or you don't own it |


## Create Project (without building)

```endpoint
method: POST
path: /api/v1/vcaas/projects
cost: Uses credits
```

Create an **empty** project: no prompt, no build, nothing running.

:::warning Prefer [Launch Project](#launch-project)
This endpoint is not deprecated and is fully supported, but it is **not the one to reach for**. An empty project does nothing until you start a build, and getting from here to a running app takes four to six more calls in an order that is wrong three different ways when assembled by hand — [Launch Project](#launch-project) is that sequence in one call, and it is the default.

Use this one only when you genuinely want a project with **no** development started: to [import](/docs/api/transfer#import-project) an existing project into it, to [connect GitHub](/docs/api/github#connect-github) before any code exists, or to [write the files yourself](/docs/api/project-files#write-file-content).
:::

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | Yes | 4-35 chars, lowercase letters + numbers + hyphens, must start with letter. **Permanent** — it is the organization id and the production hostname, and cannot be renamed later |
| `description` | string | No | Project description, max 500 characters |
| `label` | string | No | Human display name, max 80 characters. This is the part you *can* change later — see [Update Project](#update-project). Omitted → clients show the `projectId` |
| `groupId` | string | No | File the project under an existing [project group](/docs/api/project-groups). Omitted → ungrouped |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID |
| `data.description` | string | Project description |
| `data.plan` | string | Always `"api"` for projects created through the API |
| `data.createdAt` | string | ISO 8601 creation date |
| `data.label` | string \| undefined | The display name, when one was given. Absent when not set |
| `data.groupId` | string \| undefined | The group the project was filed under. Absent when ungrouped |

:::warning A bad `groupId` fails the whole request
The group is resolved **before** the project is created and before any credits are spent, so an unknown, malformed, someone else's or a full group returns `400 INVALID_PROJECT_GROUP` and nothing is created. You are never left with a charged project that silently landed outside the folder you asked for.
:::

**Example request**

```bash
curl -X POST \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"my-app","description":"A SaaS landing page","label":"Acme storefront"}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "description": "A SaaS landing page",
    "plan": "api",
    "createdAt": "2026-03-11T10:30:00.000Z",
    "label": "Acme storefront"
  }
}
```
:::

:::danger Error · 409
```json
{
  "errors": {
    "errorCode": "PROJECT_ALREADY_EXISTS",
    "errorMessage": "A project with this name already exists"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `INVALID_PROJECT_NAME` | 400 | Invalid format. Use lowercase letters, numbers, and hyphens. Must start with a letter |
| `INVALID_PROJECT_NAME_LENGTH` | 400 | Project name must be between 4 and 35 characters |
| `PROJECT_ALREADY_EXISTS` | 409 | A project with this name already exists |
| `INVALID_PROJECT_GROUP` | 400 | The `groupId` does not exist, is not yours, or the group is full |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for this operation |
| `MAX_PROJECTS_REACHED` | 403 | Your plan's project limit is already in use — see below |
| `RATE_LIMIT_EXCEEDED` | 429 | You are creating projects faster than your plan allows |

:::warning A project limit and a creation rate, both set by your plan
Your account may hold a **maximum number of projects at once**, and may create them at a **maximum rate**. Both come from the plan on the account:

| Plan | Projects | New projects |
|---|---|---|
| Free | 2 | 1 every 5 min · 12/hour |
| Starter | 10 | 5/min · 60/hour |
| Basic | 50 | 10/min · 120/hour |
| Professional | 300 | 30/min · 360/hour |
| Enterprise | unlimited | 100/min · 1 200/hour |

The two refusals need **different handling**, which is why they are different codes:

- **`403 MAX_PROJECTS_REACHED`** — retrying never succeeds. Delete a project (the slot frees immediately) or move up a plan. The response carries `errorDetails` with `maxProjects`, `projectsUsed`, `plan` and `upgradePlan` so a client can act without parsing the message.
- **`429 RATE_LIMIT_EXCEEDED`** — clears on its own. Back off and retry.

A create that fails validation or hits a name collision does **not** consume your rate allowance.
:::


---

# AI Agent

> Drive the AI agent that builds and edits your project, in single- or multi-prompt mode.

The AI agent builds and modifies your project from natural-language prompts. Agent runs are **asynchronous** — you start a run, then poll for status. All endpoints require the `api-key` header.

## Run AI Agent

```endpoint
method: POST
path: /api/v1/vcaas/projects/:projectId/agent/start
cost: Uses credits
```

Start the AI agent with a prompt to build or modify your project. Supports two modes:

- **Single-prompt** (default, recommended): omit `multiPrompt`. One prompt, typically 10 to 30 minutes and 10 to 40 credits.

  The API's own `message` field quotes a wider **4 to 40 minutes** — that is the full envelope a run can take, from a one-line tweak to a large build. `10 to 30` is where a normal prompt lands; use the wider figure only if you are writing a timeout.
- **Multi-prompt** (rare, opt-in): include `multiPrompt`. A sequential batch that runs unsupervised. Each prompt still takes 10 to 30 minutes and 10 to 40 credits, so a 10-prompt batch can run for several hours and burn hundreds of credits.

:::info What a prompt costs, and what it can cost
**Budget 10 to 40 credits per prompt.** That is the range to show in your own UI, and it is what a normal run lands in.

The exact price is metered, not fixed: 10 credits are taken when the run starts, and the rest is charged when it finishes, from how much work the run actually turned out to be. Two things sit outside the typical range and are worth knowing about before they surprise you:

- A run that uses its **entire time budget** (the agent works until it is stopped at its ceiling) is billed a flat **50 credits**, or 60 on a healthy balance, for the whole prompt.
- A **failed** run is refunded, so a prompt that produced nothing does not cost you the full price.

The same numbers apply whether the run was started by `POST /projects/launch` or `POST /agent/start` — it is the same run.
:::

:::warning Keep a balance, not a floor
The API only refuses a run when your balance is below its hard minimum, which is far below the price of a prompt. **That is not the number to budget against.** A run started with less than it ends up costing will drain the balance to zero and the shortfall is absorbed, but the next one is refused — so keep a working balance comfortably above the 10-to-40 a prompt costs rather than topping up to the floor.
:::

:::warning When to use multi-prompt
Only use multi-prompt when a single job genuinely requires several sequential AI runs AND the user has explicitly accepted the cost and time. For everything else, send one prompt at a time — it is faster, cheaper, and lets the user steer between steps. Multi-prompt is unsupervised: no human approval step, no pause between prompts. If unsure, do NOT pass `multiPrompt`.
:::

:::warning Asynchronous
Returns immediately with status `"init"`. Poll `GET /agent/status` every 10–15s and show `realtimeConversation` messages live. Single-prompt: complete when status is `"done"`. Multi-prompt: poll `multiPrompt.status` until `"done"`/`"cancelled"` — the per-prompt status flips between `"init"` and `"done"` repeatedly. After every prompt completes you MUST refresh the preview URL via `GET /projects/:projectId` → `developmentUrlFieldToUse` (default `temporalDevelopmentProjectUrl` if `null`/`undefined`).
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project to run the agent on |

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes¹ | Single-prompt: the user instruction. Multi-prompt + `letTotalumDecide`: the high-level goal Totalum breaks down. Multi-prompt + `prompts[]`: ignored. |
| `inputFiles` | array | No | Reference images/files for the agent |
| `inputFiles[].name` | string | Yes | File name |
| `inputFiles[].imageDescription` | string | Yes | Description of the image content |
| `inputFiles[].url` | string | Yes | Public URL or uploaded file URL |
| `multiPrompt` | object | No | Opt into the unsupervised multi-prompt batch mode. Omit for normal use. |
| `multiPrompt.prompts` | string[] | No² | Up to 50 prompts to run sequentially. Each item must be a non-empty string. |
| `multiPrompt.letTotalumDecide` | boolean | No² | When true, Totalum plans the prompt list from the top-level `prompt`. |

¹ `prompt` is required unless `multiPrompt.prompts` is provided (then it is ignored).
² When `multiPrompt` is present, exactly one of `prompts` (non-empty array, ≤ 50 items) or `letTotalumDecide=true` must be set.

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID |
| `data.status` | string | Always `"init"` on success — for both single and multi-prompt mode |
| `data.message` | string | Instructions on how to poll for status (multi-prompt includes the cost/time warning) |
| `data.multiPrompt` | object \| undefined | Present only when the request had `multiPrompt`. Detailed batch status is on `GET /agent/status` under `multiPrompt`. |
| `data.multiPrompt.totalPrompts` | number \| undefined | Known when the caller provided `prompts`; absent while Totalum is still planning a `letTotalumDecide` batch. |

**Example request**

```bash
# Single-prompt (recommended)
curl -X POST -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a landing page with a contact form","inputFiles":[]}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start

# Multi-prompt with explicit list
curl -X POST -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"multiPrompt":{"prompts":["Set up auth","Add a Stripe checkout","Wire up the dashboard"]}}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start

# Multi-prompt with Totalum planning
curl -X POST -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Build a full SaaS billing system with auth, Stripe, and a customer portal","multiPrompt":{"letTotalumDecide":true}}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "status": "init",
    "message": "Process started, can take from 4 to 40 minutes. Fetch GET .../agent/status every 10-15 seconds to track progress."
  }
}
```

Multi-prompt response also includes `multiPrompt`:
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "status": "init",
    "message": "Multi-prompt run started with 3 prompts. ⚠️ Multi-prompt mode is expensive and slow — only use it when a job genuinely requires multiple sequential AI runs. Each prompt typically takes 10 to 30 minutes and costs 10 to 40 credits...",
    "multiPrompt": { "totalPrompts": 3 }
  }
}
```
:::

:::danger Error · 409
```json
{
  "errors": { "errorCode": "AGENT_RUNNING", "errorMessage": "An agent is already running on this project" },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `MISSING_PROMPT` | 400 | `prompt` is required (single-prompt mode, or `letTotalumDecide=true` — it is the planner goal) |
| `INVALID_MULTI_PROMPT` | 400 | `multiPrompt` was set but neither (or both) of `prompts[]` and `letTotalumDecide=true` were provided |
| `TOO_MANY_PROMPTS` | 400 | `multiPrompt.prompts` exceeds the 50-item limit |
| `INVALID_PROMPT_ITEM` | 400 | A `multiPrompt.prompts` entry is not a non-empty string |
| `AGENT_RUNNING` | 409 | An agent is already running on this project |
| `AUTO_EXECUTION_ALREADY_ACTIVE` | 409 | A previous multi-prompt batch is still active (executing/paused/awaiting approval). Cancel it first. |
| `DEPLOYMENT_RUNNING` | 409 | Cannot start agent while a deployment is in progress |
| `RECOVERY_RUNNING` | 409 | Cannot start agent while a version recovery is in progress — poll `versionRecovery` until null, then retry |
| `INSUFFICIENT_CREDITS` | 402 | Balance is below the minimum needed to start a run. A typical prompt costs 10 to 40 credits, so keep a working balance well above the floor — multi-prompt needs many times more |
| `PROMPT_SECURITY_VIOLATION` | 400 | Prompt failed security validation |

## Get Agent Status

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/agent/status
cost: Free
```

Poll to track agent progress and get real-time messages. Poll every 10–15 seconds.

:::warning Refresh preview URL when done
When status becomes `"done"`, you MUST refresh the preview URL by calling `GET /projects/:projectId` and reading `developmentUrlFieldToUse` (`"temporalDevelopmentProjectUrl"` for the live server or `"cachedDevelopmentUrl"` for a cached snapshot). If `developmentUrlFieldToUse` is `null` or `undefined`, default to `temporalDevelopmentProjectUrl`. The URL can change after each agent run.
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project to poll |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID |
| `data.status` | string | `"init"` (a prompt is currently running) \| `"done"` (last prompt finished) \| `"idle"` (never run). For multi-prompt runs this flips between `"init"` and `"done"` repeatedly as the batch advances — poll `multiPrompt.status` to track the whole batch. |
| `data.startedAt` | string \| null | ISO 8601 start time of the **current** prompt (not the whole batch) |
| `data.realtimeConversation` | array | Single-prompt: messages from the current run. Multi-prompt: messages from the whole batch (scoped to `multiPrompt.startedAt`). |
| `data.realtimeConversation[].author` | string | `"user"` \| `"agent"` |
| `data.realtimeConversation[].message` | string | The message text |
| `data.realtimeConversation[].messageType` | string | `"regular"` \| `"starting"` \| `"building"` \| `"finished"` \| `"error"` \| `"limit-reached"` |
| `data.realtimeConversation[].createdAt` | string | ISO 8601 message date |
| `data.realtimeConversation[].versionId` | string \| undefined | Version created at this step |
| `data.realtimeConversation[].secretKeysNeeded` | object \| undefined | Secrets the agent needs (`key: { isProvided, description }`) |
| `data.realtimeConversation[].gitDiffUrl` | string \| undefined | Diff URL for this step |
| `data.creditsSpent` | number \| undefined | Credits spent on the current prompt (present when `status` is `"done"`) |
| `data.multiPrompt` | object \| null | Present only when a multi-prompt batch exists. The **canonical** signal for "is a multi-prompt run in flight" — poll its `status` until `"done"`/`"cancelled"`. |
| `data.multiPrompt.status` | string | `"planning"` \| `"executing"` \| `"paused"` \| `"done"` \| `"cancelled"` |
| `data.multiPrompt.totalPrompts` | number | Number of prompts in the batch (0 during planning) |
| `data.multiPrompt.currentPromptIndex` | number | Index of the in-flight prompt; -1 before the first one starts |
| `data.multiPrompt.prompts` | array | Ordered list of prompts in the batch |
| `data.multiPrompt.prompts[].order` | number | Position in the batch |
| `data.multiPrompt.prompts[].prompt` | string | The prompt text |
| `data.multiPrompt.prompts[].status` | string | `"pending"` \| `"executing"` \| `"done"` \| `"failed"` |
| `data.multiPrompt.startedAt` | string | ISO 8601 start time of the whole batch |
| `data.multiPrompt.updatedAt` | string | ISO 8601 last change to the batch state |

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/status
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "status": "init",
    "startedAt": "2026-03-11T10:35:00.000Z",
    "realtimeConversation": [
      {
        "author": "agent",
        "message": "Creating the project structure...",
        "messageType": "building",
        "createdAt": "2026-03-11T10:36:00.000Z"
      },
      {
        "author": "agent",
        "message": "Project built successfully!",
        "messageType": "finished",
        "versionId": "v_abc123",
        "gitDiffUrl": "https://...",
        "secretKeysNeeded": {
          "STRIPE_SECRET_KEY": { "isProvided": false, "description": "Required for processing payments" }
        },
        "createdAt": "2026-03-11T10:50:00.000Z"
      }
    ],
    "creditsSpent": 3.2,
    "multiPrompt": null
  }
}
```

Multi-prompt example (running prompt 2 of 3):
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "status": "init",
    "startedAt": "2026-03-11T11:05:00.000Z",
    "realtimeConversation": [ /* messages from the whole batch */ ],
    "multiPrompt": {
      "status": "executing",
      "totalPrompts": 3,
      "currentPromptIndex": 1,
      "prompts": [
        { "order": 0, "prompt": "Set up auth",        "status": "done" },
        { "order": 1, "prompt": "Add Stripe checkout", "status": "executing" },
        { "order": 2, "prompt": "Wire up dashboard",   "status": "pending" }
      ],
      "startedAt": "2026-03-11T10:35:00.000Z",
      "updatedAt": "2026-03-11T11:05:00.000Z"
    }
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": { "errorCode": "PROJECT_NOT_FOUND", "errorMessage": "Project does not exist or you don't own it" },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |

## Get Full Conversation

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/agent/full-conversation
cost: Free
```

Retrieve the complete conversation history across all agent runs (not just the current one).

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project whose conversation to fetch |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID |
| `data.conversation` | array | All messages from all agent runs |
| `data.conversation[].author` | string | `"user"` \| `"agent"` |
| `data.conversation[].message` | string | The message text |
| `data.conversation[].messageType` | string | `"regular"` \| `"starting"` \| `"building"` \| `"finished"` \| `"error"` \| `"limit-reached"` |
| `data.conversation[].createdAt` | string | ISO 8601 message date |
| `data.conversation[].versionId` | string \| undefined | Version created at this step |
| `data.conversation[].secretKeysNeeded` | object \| undefined | API keys the agent needs (`key: { isProvided, description }`). Add missing keys as project secrets. |
| `data.conversation[].gitDiffUrl` | string \| undefined | Diff URL for this step |

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/full-conversation
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "conversation": [
      { "author": "user", "message": "Create a landing page", "messageType": "regular", "createdAt": "..." },
      { "author": "agent", "message": "Building project structure...", "messageType": "building", "createdAt": "..." },
      {
        "author": "agent",
        "message": "Project built successfully!",
        "messageType": "finished",
        "versionId": "v_abc123",
        "gitDiffUrl": "https://...",
        "secretKeysNeeded": {
          "STRIPE_SECRET_KEY": { "isProvided": false, "description": "Required for processing payments" }
        },
        "createdAt": "..."
      }
    ]
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": { "errorCode": "PROJECT_NOT_FOUND", "errorMessage": "Project does not exist or you don't own it" },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |

## Stop Agent

```endpoint
method: POST
path: /api/v1/vcaas/projects/:projectId/agent/stop
cost: Free
```

Send a stop signal to a running agent.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project whose agent to stop |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.message` | string | Confirmation message |

**Example request**

```bash
curl -X POST -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/stop
```

:::success Success · 200 OK
```json
{ "errors": null, "data": { "message": "Agent stop signal sent" } }
```
:::

:::danger Error · 400
```json
{
  "errors": { "errorCode": "NO_PROCESS_RUNNING", "errorMessage": "No agent process is currently running" },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `NO_PROCESS_RUNNING` | 400 | No agent process is currently running |

## Concurrency rules

- Only one heavy operation at a time per project: agent, deployment, version recovery, or server start.
- If deploy or recover is called and the server is not active, it auto-starts (charges `START_SERVER` credits) and returns `SERVER_NOT_READY`. Poll `GET /projects/:projectId` until `agentServerStatus` is `"Active"`, then retry.
- Agent start IS allowed during server operations (the backend waits internally).

## Complete integration flow

1. **Create the project and start building it** — `POST /projects/launch`, body `{ "projectId": "my-app", "prompt": "Build a SaaS landing page" }`. One call. Async, takes 10 to 30 minutes. Use the `projectId` it returns (a taken name is auto-suffixed), and check `agent.started` and `warnings`.
   - **Already have an empty project?** Then start at step 2 instead: `POST /projects/my-app/agent/start`, body `{ "prompt": "..." }`. That is the only case where the two calls are separate — see [Launch Project](/docs/api/projects#launch-project).
2. **Send follow-up prompts** — `POST /projects/my-app/agent/start`, body `{ "prompt": "Add a pricing page" }`. Same endpoint, same polling, for every change after the first.
3. **Poll agent status (every 10–15s)** — `GET /projects/my-app/agent/status`. `"init"` = working (show `realtimeConversation`), `"done"` = finished (`creditsSpent` = total). On `"done"`, immediately call `GET /projects/:projectId` and refresh the preview URL.
   - **3.1 Refresh preview URL** (on page load, page refresh, and after every prompt finishes) — `GET /projects/my-app`, read `developmentUrlFieldToUse`: use `cachedDevelopmentUrl` (static snapshot while the server is archived) or `temporalDevelopmentProjectUrl` (live dev server); default `temporalDevelopmentProjectUrl` if `null`/`undefined`. Reload the iframe when the URL changes.
4. **Publish** — `POST /projects/my-app/deployments/deploy`. Builds, deploys, and assigns a public URL. Takes 2 to 5 minutes.
5. **Poll deployment status (every 10–15s)** — `GET /projects/my-app/deployments/status`; on `"success"`, get `productionProjectUrl` from `GET /projects/my-app`.
6. **(Optional) Custom domain** — `PUT /projects/my-app/domain`, body `{ "hostname": "app.yourdomain.com" }`; configure the returned DNS records; poll `customDomain.status` until `"active"`.

:::tip Key integration principles
- Agent and deployment are ASYNCHRONOUS — always poll for status.
- Show real-time agent conversation messages during generation.
- NEVER call the Totalum API from frontend code — always go through your backend server.
- ALWAYS refresh the dev preview URL (`GET /projects/:projectId`) on page load, page refresh, and after each prompt; use `developmentUrlFieldToUse`; default `temporalDevelopmentProjectUrl` if `null`/`undefined`.
- On the dev preview, don't show the production URL; display an open-in-blank link so the user always sees the realtime dev preview (production may be outdated until published).
- Keep the API key secret — it must never leave your backend server.
:::

## Global error codes

All errors are shaped as `{ "errors": { "errorCode": "CODE", "errorMessage": "..." }, "data": null }`.

| Code | HTTP | Meaning |
|---|---|---|
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for this operation |
| `PROJECT_CREDIT_LIMIT_REACHED` | 403 | Project monthly credit limit reached for that category |
| `PROJECT_NOT_ALLOWED` | 403 | API key doesn't have access to this project |
| `PROJECT_NOT_FOUND` | 404 | Project doesn't exist or you don't own it |
| `AGENT_RUNNING` | 409 | Agent already running on this project |
| `DEPLOYMENT_RUNNING` | 409 | A deployment is in progress |
| `RECOVERY_RUNNING` | 409 | A version recovery is in progress |
| `SERVER_NOT_READY` | 409 | Server auto-starting, poll until Active |
| `NO_DEPLOYMENT` | 404 | No deployment found. Deploy first and wait until status is "success" |
| `MISSING_PROMPT` | 400 | prompt field is required |
| `MISSING_PROJECT_ID` | 400 | projectId field is required |
| `INVALID_PROJECT_NAME` | 400 | Invalid projectId format |
| `INVALID_PROJECT_NAME_LENGTH` | 400 | Project name must be 4-35 characters |
| `PROJECT_ALREADY_EXISTS` | 409 | A project with this ID already exists |
| `PLAN_NOT_API` | 400 | Only API plan projects can be deleted |
| `PROMPT_SECURITY_VIOLATION` | 400 | Prompt failed security validation |
| `NO_PROCESS_RUNNING` | 400 | No agent process is currently running |
| `MISSING_FILE` | 400 | file field is required (multipart) |
| `UPLOAD_FAILED` | 500 | File upload failed |
| `MISSING_VERSION_ID` | 400 | versionId is required |
| `MISSING_SECRET_FIELDS` | 400 | secretName and secretValue are required |
| `INVALID_SECRET_KEY_NAME` | 400 | Invalid secret key name format |
| `MISSING_SECRET_ID` | 400 | secretId is required |
| `MISSING_HOSTNAME` | 400 | hostname is required |
| `MISSING_TABLE_NAME` | 400 | tableName is required |
| `GET_ACCOUNT_ERROR` | 400 | Internal error fetching account info |
| `LIST_PROJECTS_ERROR` | 400 | Internal error listing projects |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — project creation is rate-limited per plan (see [Projects](/docs/api/projects)) |
| `MISSING_WEBHOOK_FIELDS` | 400 | url and event are required |
| `INVALID_WEBHOOK_URL` | 400 | Webhook URL must use HTTPS |
| `INVALID_WEBHOOK_EVENT` | 400 | Event not in allowed list |
| `WEBHOOK_EVENT_ALREADY_EXISTS` | 409 | A webhook for this event already exists |
| `WEBHOOK_NOT_FOUND` | 404 | Webhook not found |
| `MISSING_GITHUB_FIELDS` | 400 | token and repositoryFullName are required |
| `GITHUB_VALIDATION_FAILED` | 400 | Token invalid, missing permissions, or repo not found |
| `GITHUB_SECRET_STORE_ERROR` | 400 | Failed to store GitHub credentials |
| `GITHUB_SYNC_FAILED` | 400 | Initial sync with GitHub failed |
| `GITHUB_NOT_CONNECTED` | 400 | GitHub is not connected to this project |
| `GITHUB_PULL_ERROR` | 400 | Failed to pull changes from GitHub |
| `MISSING_LIMIT_FIELDS` | 400 | At least one credit limit field is required |
| `INVALID_LIMIT` | 400 | Credit limit must be a positive number |
| `INVALID_SYNC_DIRECTION` | 400 | syncDirection must be "totalum_to_github" or "github_to_totalum" |


---

# Deployments

> Publish your project to production and track the rollout.

Deployments build your project and publish it to its production URL. Deploying is **asynchronous** — start the deploy, then poll for status. All endpoints require the `api-key` header.

## Deploy to Production

```endpoint
method: POST
path: /api/v1/vcaas/projects/:projectId/deployments/deploy
cost: Uses credits
```

Build and deploy your project to a production URL. This endpoint is asynchronous — it returns immediately with status `"deploying"` and the deployment continues in the background for 2 to 5 minutes.

Poll `GET /projects/:projectId/deployments/status` every 10–15 seconds until status is `"success"`, then read the public URL from `GET /projects/:projectId` → `productionProjectUrl`. If the server is not active, it auto-starts (charging extra `START_SERVER` credits) and returns `SERVER_NOT_READY`; poll `GET /projects/:projectId` until `agentServerStatus` is `"Active"`, then retry.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.projectId` | string | The project ID |
| `data.status` | string | Always `"deploying"` on success |
| `data.message` | string | Instructions on how to poll for status |

**Example request**

```bash
curl -X POST -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/deployments/deploy
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "projectId": "my-app",
    "status": "deploying",
    "message": "Deployment started. It will take from 2 to 5 minutes. Fetch GET .../deployments/status every 10-15 seconds to track progress."
  }
}
```
:::

:::danger Error · 409
```json
{
  "errors": {
    "errorCode": "DEPLOYMENT_RUNNING",
    "errorMessage": "A deployment is already in progress"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `AGENT_RUNNING` | 409 | Cannot deploy while agent is running |
| `DEPLOYMENT_RUNNING` | 409 | A deployment is already in progress |
| `RECOVERY_RUNNING` | 409 | A version recovery is in progress |
| `SERVER_NOT_READY` | 409 | Server auto-starting, poll until Active then retry |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for deployment |

## Get Deployment Status

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/deployments/status
cost: Free
```

Check the current deployment status. Poll until status is `"success"`.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.status` | string \| null | `"deploying"` \| `"success"` \| `"error"` \| null (if never deployed) |
| `data.createdAt` | string \| null | ISO 8601 deployment date |
| `data.versionId` | string \| undefined | Version that was deployed |

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/deployments/status
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "status": "success",
    "createdAt": "2026-03-11T11:00:00.000Z",
    "versionId": "v_abc123"
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |


---

# Server

> Control the development server and inspect both log streams.

These endpoints manage your project's development server. Starting the server is **asynchronous**. All endpoints require the `api-key` header.

## Start or Restart Server

```endpoint
method: POST
path: /api/v1/vcaas/projects/:projectId/agent/server/start-or-restart
cost: Uses credits
```

Start or restart the development server for your project. This endpoint is asynchronous — it returns immediately with status `"starting"` and the server startup continues in the background for 2 to 4 minutes.

Poll `GET /projects/:projectId` every 10–15 seconds until `agentServerStatus` is `"Active"`.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.message` | string | Status message |
| `data.status` | string | Always `"starting"` |

**Example request**

```bash
curl -X POST -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/server/start-or-restart
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "message": "Server start/restart initiated",
    "status": "starting"
  }
}
```
:::

:::danger Error · 409
```json
{
  "errors": {
    "errorCode": "AGENT_RUNNING",
    "errorMessage": "Cannot restart server while agent is running"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `AGENT_RUNNING` | 409 | Cannot restart server while agent is running |
| `DEPLOYMENT_RUNNING` | 409 | Cannot restart server while deployment is in progress |
| `RECOVERY_RUNNING` | 409 | Cannot restart server while version recovery is in progress |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for server start |

## Get Dev Server Logs

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/backend/dev/logs
cost: Free
```

Retrieve backend development server stdout/stderr output — literally the dev server's log file on the project's sandbox VM.

:::warning Dev and production are two different machines
This endpoint returns the **development** server's output only. A published project runs on Cloudflare, not on the sandbox, so its request logs exist nowhere in this response — use [Get Production Logs](#get-production-logs) when you are debugging the live site.
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.logs` | string | Development server stdout/stderr output |

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/backend/dev/logs
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": { "logs": "Server running on port 3000\n..." }
}
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |

## Get Production Logs

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/backend/prod/logs
cost: Free
```

Query the request logs of the **published** project — the one running on Cloudflare at your production URL. Each record is one request, with the console output and exceptions that happened while serving it.

:::warning Only for a deployed project
These logs come from the production runtime, so they exist only after a successful [deployment](/docs/api/deployments#deploy-to-production). A project that has never been deployed simply has no records. For the preview you are iterating on, use [Get Dev Server Logs](#get-dev-server-logs) instead.
:::

:::note Retention is 3 days
Records older than 3 days are gone. `from` and `to` must fall inside that window (`to` may reach into tomorrow so that all of today is covered).
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Query parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `getOnlyLastLogs` | boolean | No | `true` returns only the most recent records. Default `false` |
| `from` | string | No | Start of the range, ISO 8601 (e.g. `2026-08-01T00:00:00Z`). Must be within the last 3 days |
| `to` | string | No | End of the range, ISO 8601. Must be within the last 3 days |
| `regexSearch` | string | No | Regex or plain string to filter by. Returns the matching entries plus nearby lines — **the fastest way to find a specific log** |

:::tip Search first, then narrow
Filtering with `regexSearch` is far more effective than paging a broad window: a wide query can quietly hit the plan's log-request limit or bury the entry you are after. If the first search misses, retry with a more specific pattern and a tighter `from`/`to` rather than a wider one.
:::

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data` | object \| array | Passthrough from the log pipeline. Read the records from `data.records` when present, otherwise `data` is itself the array of records |
| `data.records` | array | The matching request records |
| `data.records[].EventTimestampMs` | number | When the request was served, epoch milliseconds |
| `data.records[].Outcome` | string | How the request ended, e.g. `ok`, `exception`, `canceled` |
| `data.records[].WallTimeMs` | number | Wall-clock duration of the request |
| `data.records[].CPUTimeMs` | number | CPU time consumed by the request |
| `data.records[].Event.Request.URL` | string | The requested URL |
| `data.records[].Event.Request.Method` | string | HTTP method |
| `data.records[].Event.Response.Status` | number | HTTP status returned |
| `data.records[].Logs` | array | Console output produced while serving this request |
| `data.records[].Logs[].Level` | string | `log`, `info`, `warn`, `error` or `debug` |
| `data.records[].Logs[].Message` | array | The logged values |
| `data.records[].Logs[].TimestampMs` | number | When the line was written, epoch milliseconds |
| `data.records[].Exceptions` | array | Uncaught exceptions thrown while serving this request |
| `data.records[].Exceptions[].Name` | string | Exception class, e.g. `TypeError` |
| `data.records[].Exceptions[].Message` | string | Exception message |
| `data.records[].Exceptions[].TimestampMs` | number | When it was thrown, epoch milliseconds |

:::info Treat every field as optional
The payload is forwarded verbatim from the production log pipeline, so its exact shape is not one this API guarantees. Read defensively: accept the records under `data.records` or as a bare array, and render a record that is missing fields rather than throwing.
:::

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/backend/prod/logs?regexSearch=checkout&from=2026-08-03T00:00:00Z&to=2026-08-04T23:59:59Z"
```

Just the most recent activity:

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/backend/prod/logs?getOnlyLastLogs=true"
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "records": [
      {
        "EventTimestampMs": 1785840843120,
        "Outcome": "ok",
        "WallTimeMs": 128,
        "CPUTimeMs": 14,
        "Event": {
          "Request": { "URL": "https://my-app.totalum-project.com/api/orders", "Method": "GET" },
          "Response": { "Status": 500 }
        },
        "Logs": [
          { "Level": "error", "Message": ["Cannot read properties of undefined"], "TimestampMs": 1785840843118 }
        ],
        "Exceptions": [
          { "Name": "TypeError", "Message": "Cannot read properties of undefined", "TimestampMs": 1785840843119 }
        ]
      }
    ]
  }
}
```
:::

:::danger Error · 429
```json
{
  "errors": {
    "errorCode": "PLAN_LIMIT_REACHED",
    "errorMessage": "Production logs request limit reached for your plan. Please upgrade or wait for the limit to reset."
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `PLAN_LIMIT_REACHED` | 429 | Your plan's production-log request limit was reached. Wait for the reset or upgrade |
| `PROD_LOGS_WORKER_ERROR` | 400 | The production log pipeline could not serve the query |


---

# Versions

> Browse your project's version history, see what changed, and roll back to an earlier state.

Every completed prompt produces a version — and so does every file write, GitHub pull and import. You can list the version history, read the exact changes a version introduced, and recover a previous version. All three require the `api-key` header.

## List Versions

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/versions
cost: Free
```

Get all project versions with pagination.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Query parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | Number of versions to return (default: 20) |
| `skip` | number | No | Number of versions to skip (default: 0) |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.versions` | array | Array of version objects |
| `data.versions[]._id` | string | Version ID — use this for [Recover Version](#recover-version) |
| `data.versions[].name` | string | Version display name |
| `data.versions[].commitSha` | string \| undefined | Git commit this version points at — use this for [Get Version Diff](#get-version-diff) |
| `data.versions[].commitMessage` | string \| undefined | Git commit message |
| `data.versions[].prompt` | string \| undefined | The prompt that created this version |
| `data.versions[].gcsUploaded` | boolean \| undefined | Whether the version's snapshot finished uploading to long-term storage |
| `data.versions[].recoveredVersionId` | string \| undefined | Present when this version was produced by recovering another one — the id of the version that was restored |
| `data.versions[].createdAt` | string | ISO 8601 creation date |
| `data.versions[].updatedAt` | string | ISO 8601 last-modified date |
| `data.totalCount` | number | Total versions available |

:::info Two different identifiers
`_id` and `commitSha` are not interchangeable. Recovery takes the `_id`; the diff takes the `commitSha`. Both come from this response, and there is no lookup from one to the other.
:::

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/versions?limit=20&skip=0"
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "versions": [
      {
        "_id": "v_abc123",
        "name": "Version 3",
        "commitSha": "9f2c1ab",
        "commitMessage": "Added contact form",
        "prompt": "Add a contact form to the landing page",
        "gcsUploaded": true,
        "createdAt": "2026-03-11T10:45:00.000Z",
        "updatedAt": "2026-03-11T10:45:00.000Z"
      }
    ],
    "totalCount": 3
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |

## Get Version Diff

```endpoint
method: GET
path: /api/v1/vcaas/projects/:projectId/version-diff
cost: Free
```

The unified diff a single version introduced, as raw text — the same format `git diff` produces.

:::note The sha is a query parameter, not a path segment
Every other version route is addressed by the version's `_id`, but a diff can only be produced from its `commitSha` and there is no lookup between the two. Rather than put two different identifiers in the same position on sibling routes, the path says what it takes: `?commitSha=…`.
:::

:::warning The project must be awake
The diff is computed on the project's sandbox, so a sleeping project answers `NO_ACTIVE_SANDBOX`. That is a real state rather than a transient failure — prompt the user to start the project (or call [Start or Restart Server](/docs/api/server#start-or-restart-server)) instead of retrying.
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Query parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `commitSha` | string | Yes | The `commitSha` of the version, from [List Versions](#list-versions). 7 to 40 hexadecimal characters |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.commitSha` | string | The commit the diff was produced from |
| `data.diff` | string | Raw unified diff text. Empty string when the commit changed nothing tracked |

:::tip Works for versions the agent did not create
Until this endpoint existed, the only viewable changes were the `gitDiffUrl` on an agent conversation message, so versions produced by a manual file write, a GitHub pull or an import had no visible history at all. This covers all of them.
:::

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/version-diff?commitSha=9f2c1ab"
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "commitSha": "9f2c1ab",
    "diff": "diff --git a/src/app/page.tsx b/src/app/page.tsx\n--- a/src/app/page.tsx\n+++ b/src/app/page.tsx\n@@ -12,6 +12,9 @@\n   return (\n     <main>\n+      <ContactForm />\n     </main>\n   );\n"
  }
}
```
:::

:::danger Error · 400
```json
{
  "errors": {
    "errorCode": "INVALID_COMMIT_SHA",
    "errorMessage": "commitSha must be 7 to 40 hexadecimal characters"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `MISSING_COMMIT_SHA` | 400 | The `commitSha` query parameter is required |
| `INVALID_COMMIT_SHA` | 400 | `commitSha` must be 7 to 40 hexadecimal characters |
| `NO_ACTIVE_SANDBOX` | 400 | The project's sandbox is not running — start the project and try again |

## Recover Version

```endpoint
method: POST
path: /api/v1/vcaas/projects/:projectId/versions/:id/recover
cost: Uses credits
```

Restore a previous version of the project. This endpoint is asynchronous: it returns immediately and the recovery continues in the background for 1 to 4 minutes.

:::warning Asynchronous
Poll `GET /projects/:projectId` every 10–15 seconds and watch the `versionRecovery` field. While the recovery is running, `versionRecovery.status` is `"recovering"`. Recovery is complete the moment `versionRecovery` becomes `null`. If `versionRecovery.status` is `"error"`, surface `versionRecovery.errorMessage` to the user. Do NOT poll `agentProcessStatus` for recovery — the agent is not involved in a version recovery.
:::

:::note
If the server is not active, it auto-starts (charges START_SERVER credits extra) and returns `SERVER_NOT_READY`.
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |
| `id` | string | The version ID to recover (from GET /versions) |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.message` | string | Confirmation message |

**Example request**

```bash
curl -X POST -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/versions/v_abc123/recover
```

:::success Success · 200 OK
```json
{ "errors": null, "data": { "message": "Version recovery initiated" } }
```
:::

:::danger Error · 402
```json
{
  "errors": {
    "errorCode": "INSUFFICIENT_CREDITS",
    "errorMessage": "Not enough credits for version recovery"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `MISSING_VERSION_ID` | 400 | versionId is required |
| `AGENT_RUNNING` | 409 | Cannot recover while agent is running |
| `DEPLOYMENT_RUNNING` | 409 | Cannot recover while deployment is in progress |
| `RECOVERY_RUNNING` | 409 | A version recovery is already in progress |
| `SERVER_NOT_READY` | 409 | Server auto-starting, poll until Active then retry |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for version recovery |


---

# Secrets

> Manage environment variables, encrypted at rest and synced to the sandbox .env.

Secrets are environment variables for your project. They are encrypted at rest and automatically synced to the sandbox `.env`. Secret values are never returned by the API. Both endpoints require the `api-key` header.

## Create Secret

```endpoint
method: POST
path: /api/v1/vcaas/projects/:projectId/secrets
cost: Free
```

Add an environment variable. Encrypted at rest, auto-synced to the sandbox `.env`.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `secretName` | string | Yes | Environment variable name |
| `secretValue` | string | Yes | The secret value, stored encrypted |
| `environment` | string | No | `"development"` \| `"production"` \| `"both"` (default: `"both"`) |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data._id` | string | ID of the created secret |
| `data.secretName` | string | The secret name |
| `data.environment` | string | `"development"` \| `"production"` \| `"both"` |
| `data.createdAt` | string | ISO 8601 creation date |

**Example request**

```bash
curl -X POST \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"secretName":"STRIPE_KEY","secretValue":"sk_live_abc123","environment":"both"}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/secrets
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "secretName": "STRIPE_KEY",
    "environment": "both",
    "createdAt": "2026-03-11T10:30:00.000Z"
  }
}
```
:::

:::danger Error · 400
```json
{
  "errors": {
    "errorCode": "MISSING_SECRET_FIELDS",
    "errorMessage": "secretName and secretValue are required"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `MISSING_SECRET_FIELDS` | 400 | secretName and secretValue are required |
| `INVALID_SECRET_KEY_NAME` | 400 | Invalid secret key name format |

## Delete Secret

```endpoint
method: DELETE
path: /api/v1/vcaas/projects/:projectId/secrets/:secretId
cost: Free
```

Remove an environment variable by ID. The sandbox `.env` is synced automatically.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |
| `secretId` | string | The secret ID to delete |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.success` | boolean | true on success |

**Example request**

```bash
curl -X DELETE -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/secrets/65f1a2b3c4d5e6f7a8b9c0d1
```

:::success Success · 200 OK
```json
{ "errors": null, "data": { "success": true } }
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `MISSING_SECRET_ID` | 400 | secretId is required |


---

# Custom Domains

> Point your own subdomain at a deployed project.

Custom domains let you serve a deployed project from your own subdomain (e.g. `app.yourdomain.com`). Both endpoints require the `api-key` header.

## Add Custom Domain

```endpoint
method: PUT
path: /api/v1/vcaas/projects/:projectId/domain
cost: Uses credits
```

Attach a custom subdomain (e.g. `app.yourdomain.com`) to your deployed project.

:::warning Deploy first
You MUST deploy your project first AND wait until the deployment status is `"success"` before calling this endpoint. If the deployment is still in progress or no deployment exists, this returns a `NO_DEPLOYMENT` error.
:::

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Body parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `hostname` | string | Yes | The subdomain to add (e.g. `app.yourdomain.com`) |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.success` | boolean | true on success |
| `data.hostname` | string | The configured hostname |
| `data.status` | string | `"pending_validation"` initially |
| `data.dnsRecordsToAdd` | array \| undefined | DNS records to add at your provider |
| `data.dnsRecordsToAdd[].type` | string | `"CNAME"` or `"TXT"` |
| `data.dnsRecordsToAdd[].name` | string | DNS record name (zone-relative, e.g. `"app"` or `"_cf-custom-hostname.app"`) |
| `data.dnsRecordsToAdd[].value` | string | DNS record value (e.g. `"my-app.totalum-project.com"` or verification token) |

**Example request**

```bash
curl -X PUT \
  -H "api-key: tlm_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"app.yourdomain.com"}' \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/domain
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "success": true,
    "hostname": "app.yourdomain.com",
    "status": "pending_validation",
    "dnsRecordsToAdd": [
      { "type": "CNAME", "name": "app", "value": "my-app.totalum-project.com" },
      { "type": "TXT", "name": "_cf-custom-hostname.app", "value": "abc123-verification-token" }
    ]
  }
}
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "NO_DEPLOYMENT",
    "errorMessage": "No deployment found. Deploy first and wait until status is \"success\""
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `MISSING_HOSTNAME` | 400 | hostname is required (e.g. app.yourdomain.com) |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits to add custom domain |
| `NO_DEPLOYMENT` | 404 | No deployment found. Deploy first and wait until status is "success" |

:::note
After configuring DNS, poll `GET /projects/:projectId` and check `customDomain.status` until it is `"active"`.
:::

:::tip Root domain
Custom domains require a subdomain (e.g. `www.yourdomain.com`). If you want `yourdomain.com` (without www) to reach your project, add `www.yourdomain.com` as the custom domain, then create a redirect in your DNS provider from `yourdomain.com` to `www.yourdomain.com`. Most providers offer this as "URL redirect" or "domain forwarding" in their DNS settings.
:::

## Remove Custom Domain

```endpoint
method: DELETE
path: /api/v1/vcaas/projects/:projectId/domain
cost: Free
```

Detach the custom domain from your project.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | string | The project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.message` | string | Confirmation message |

**Example request**

```bash
curl -X DELETE -H "api-key: tlm_sk_your_key" \
  https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/domain
```

:::success Success · 200 OK
```json
{ "errors": null, "data": { "message": "Custom domain removed" } }
```
:::

:::danger Error · 404
```json
{
  "errors": {
    "errorCode": "PROJECT_NOT_FOUND",
    "errorMessage": "Project does not exist or you don't own it"
  },
  "data": null
}
```
:::

**Error codes**

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_PROJECT_ID` | 400 | projectId is required |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist or you don't own it |
| `NO_DEPLOYMENT` | 404 | No deployment found. Deploy first and wait until status is "success" |


---

# Analytics

> Monitor daily credit usage across development and infrastructure categories.

The analytics endpoint returns daily credit spending you can render in charts or reports. It requires the `api-key` header.

## Spending Analytics

```endpoint
method: GET
path: /api/v1/credits/spending-analytics
cost: Free
```

Get daily credit spending data for charts and reports. Returns data aggregated by day, category (development/infrastructure), and usage type.

:::note
The path is `/api/v1/credits/spending-analytics` — it is **NOT** under `/vcaas`.
:::

**Query parameters**

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | Yes | Start date (`YYYY-MM-DD`), max 90 days before `to` |
| `to` | string | Yes | End date (`YYYY-MM-DD`) |
| `projectId` | string | No | Filter by project ID |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `data.daily` | array | Array of daily spending objects |
| `data.daily[].date` | string | Date (`YYYY-MM-DD`) |
| `data.daily[].development` | number | Development credits spent that day |
| `data.daily[].infrastructure` | number | Infrastructure credits spent that day |
| `data.daily[].byType` | object | Credits by usage type (e.g. prompt, deploy, chatgpt) |
| `data.totals.development` | number | Total development credits in range |
| `data.totals.infrastructure` | number | Total infrastructure credits in range |
| `data.totals.total` | number | Total credits in range |
| `data.totals.byType` | object | Total credits by usage type |
| `data.projects` | array | List of project IDs with spending data |

**Usage types in `byType`:** `prompt`, `deploy`, `start_server`, `get_source_code`, `recover_version`, `upload_file`, `add_custom_domain`, `chatgpt`, `image_generation`, `video_analysis`, `audio_transcription`, `email`, `pdf`, `document_scan`, `web_scraper`, `file_upload`.

**Example request**

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/credits/spending-analytics?from=2026-04-01&to=2026-04-04"
```

Add `&projectId=my-app` to filter by a single project:

```bash
curl -H "api-key: tlm_sk_your_key" \
  "https://api-accounts.totalum.app/api/v1/credits/spending-analytics?from=2026-04-01&to=2026-04-04&projectId=my-app"
```

:::success Success · 200 OK
```json
{
  "errors": null,
  "data": {
    "daily": [
      { "date": "2026-04-01", "development": 15, "infrastructure": 3, "byType": { "prompt": 10, "deploy": 5, "chatgpt": 2, "pdf": 1 } },
      { "date": "2026-04-02", "development": 20, "infrastructure": 5, "byType": { "prompt": 15, "deploy": 3, "start_server": 2, "email": 3 } }
    ],
    "totals": { "development": 35, "infrastructure": 8, "total": 43, "byType": { "prompt": 25, "deploy": 8, "chatgpt": 2, "pdf": 1, "email": 3 } },
    "projects": ["my-app", "other-project"]
  }
}
```
:::

:::info
Analytics data is available for the last 90 days; older data is automatically cleaned up.
:::
