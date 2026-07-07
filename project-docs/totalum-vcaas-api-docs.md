# Totalum VCaaS API — Complete Reference

## What is this API
The Totalum VCaaS (Vibe Coding as a Service) API lets you programmatically create and manage full-stack web applications using AI. You send a natural language prompt describing what you want to build, and an AI agent generates a complete project with frontend, backend, database, and deployment — all managed for you. Use it to build SaaS products, dashboards, landing pages, internal tools, or any web app. Each project includes a managed database, file storage, authentication, hosting with CDN, and custom domain support out of the box. The typical flow is: create a project, run the AI agent with a prompt, poll for status, then deploy to production.

Totalum manages everything for you — there is no need to set up external hosting, provision databases, configure deployment pipelines, manage secrets, or handle infrastructure. Everything is included: hosting, database, file storage, SSL, CDN, deployments, and secret management are all handled automatically by the Totalum platform through this single API. The Totalum agent also has access to the backend logs of your project, so it can read errors and debug issues autonomously without you needing to check logs manually.

## CRITICAL SECURITY RULE
NEVER expose the API key in frontend code, client-side JavaScript, mobile apps, or any browser code.
The API key must ONLY exist in your backend server:
  CORRECT: User → Your Frontend → Your Backend → Totalum API
  WRONG:   User → Your Frontend → Totalum API
The API key must only exist in your backend server. Your frontend talks to your backend, and your backend talks to the Totalum API. Never the frontend directly to the Totalum API.

## Base URL
https://api-accounts.totalum.app

## Authentication
All requests require the header:
  api-key: <your-api-key>

## Response Format
All responses follow: { "errors": null | { "errorCode": "...", "errorMessage": "..." }, "data": ... }

## Credit Costs

**Development credits** (project creation, AI agent, deployments):
| Operation              | Cost              |
|------------------------|-------------------|
| Create project         | 1 credits         |
| Run AI agent           | 2 to 30 credits  |
| Deploy to production   | 1 credits       |
| Start/restart server   | 3 credits       |
| Get source code        | 1 credits       |
| Upload file            | 0.5 credits       |
| Recover version        | 2 credits       |
| Export project         | 2 credits       |
| Import project         | 6 credits       |
| Add custom domain      | 2 credits          |
| All other endpoints    | Free              |

**Infrastructure credits** (when built-in service plan limits are exceeded):
| Operation              | Cost              |
|------------------------|-------------------|
| ChatGPT request        | Dynamic (based on model + tokens) |
| Image generation/edit  | 2 credits         |
| Video analysis         | 1 credit          |
| Audio transcription    | 1 credit          |
| Document scan          | 0.5 credits       |
| Web scraper request    | 0.5 credits       |
| Email sent             | 0.3 credits       |
| PDF generated          | 0.1 credits       |
| File upload            | 0.01 credits      |

Infrastructure credits are only consumed when your project exceeds its plan's built-in usage limits.

You can set monthly spending limits per project for both development and infrastructure credits using the Credit Limits endpoint.

---

## Built-in Integrations

Your projects include pre-built integrations that work out of the box. Just mention them in your agent prompt — no API keys or extra setup needed.

**No API key required:**
- Email delivery — send transactional and notification emails
- PDF generation — generate PDFs from any HTML content
- AI image generation & editing — generate and edit images with AI
- ChatGPT usage — use ChatGPT capabilities in your app
- Complete authentication — full auth system with login, register & sessions
- Document scanning — scan and extract data from PDFs and images
- Speech to text — transcribe audio files to text with OpenAI Whisper (formats: mp3, mp4, m4a, wav, webm, ogg, opus, flac; max 5 MB)
- Video analysis — describe, summarize or extract structured data from videos using Google Gemini (native video input via URL, max 100 MB; supports highQuality mode for harder reasoning)
- Web scraping — scrape pages (raw HTML / markdown / text), extract structured data with AI, and take screenshots — no third-party API key needed
- Database — full managed database with tables, relations & queries, no setup needed
- Deployment & hosting — one-click deploy to production with global CDN hosting
- Custom domain — connect your own domain with automatic SSL certificate
- File storage — upload and serve files with signed URLs (images, documents & more)
- Backend logs access — the agent can read your project's backend logs to debug errors autonomously

**Requires user API key (add as a project secret):**
- Stripe — payments, subscriptions & billing
- Email with custom domain — send emails from your own domain (we recommend Resend as provider). Add your Resend API key as a project secret

**Any API or npm package:**
You can also use any API or npm package simply by mentioning it in your prompt. If the integration requires an API key you haven't provided, the agent will notify you via the `secretKeysNeeded` field in the conversation response. Add the key as a project secret and run the agent again.

---

## Endpoints

### ── ACCOUNT ──

### 1. GET https://api-accounts.totalum.app/api/v1/vcaas/account
**Get Account Info** — Retrieve your current credit balance and account details.
Cost: Free

Response schema:
  | Field          | Type   | Description               |
  |----------------|--------|---------------------------|
  | data.credits   | number | Current credit balance     |

Error responses:
  | Error Code         | HTTP | Description                          |
  |--------------------|------|--------------------------------------|
  | GET_ACCOUNT_ERROR  | 400  | Internal error fetching account info |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/account

Response:
  {
    "errors": null,
    "data": {
      "credits": 425
    }
  }

---

### ── PROJECTS ──

### 2. POST https://api-accounts.totalum.app/api/v1/vcaas/projects
**Create Project** — Create a new vibe coding project.
Cost: 1 credits

Request body schema:
  | Field       | Type   | Required | Description                                                                      |
  |-------------|--------|----------|----------------------------------------------------------------------------------|
  | projectId   | string | Yes      | 4-35 chars, lowercase letters + numbers + hyphens, must start with letter        |
  | description | string | No       | Project description, max 500 characters                                          |

Response schema:
  | Field            | Type   | Description                        |
  |------------------|--------|------------------------------------|
  | data.projectId   | string | The project ID                     |
  | data.description | string | Project description                |
  | data.plan        | string | Always "api" for VCaaS projects    |
  | data.createdAt   | string | ISO 8601 creation date             |

Error responses:
  | Error Code                   | HTTP | Description                                                                |
  |------------------------------|------|----------------------------------------------------------------------------|
  | MISSING_PROJECT_ID           | 400  | projectId is required                                                      |
  | INVALID_PROJECT_NAME         | 400  | Invalid format. Use lowercase letters, numbers, and hyphens. Must start with a letter |
  | INVALID_PROJECT_NAME_LENGTH  | 400  | Project name must be between 4 and 35 characters                           |
  | PROJECT_ALREADY_EXISTS       | 409  | A project with this name already exists                                    |
  | INSUFFICIENT_CREDITS         | 402  | Not enough credits for this operation                                      |
  | RATE_LIMIT_EXCEEDED          | 429  | Maximum 10 project creations per 60 seconds                                |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"projectId":"my-app","description":"A SaaS landing page"}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects

Response:
  {
    "errors": null,
    "data": {
      "projectId": "my-app",
      "description": "A SaaS landing page",
      "plan": "api",
      "createdAt": "2026-03-11T10:30:00.000Z"
    }
  }

---

### 3. GET https://api-accounts.totalum.app/api/v1/vcaas/projects
**List Projects** — Get all your projects.
Cost: Free

Response schema:
  | Field              | Type   | Description                     |
  |--------------------|--------|---------------------------------|
  | data               | array  | Array of project objects        |
  | data[].projectId   | string | The project ID                  |
  | data[].description | string | Project description             |
  | data[].plan        | string | Always "api" for VCaaS projects |
  | data[].createdAt   | string | ISO 8601 creation date          |

Error responses:
  | Error Code          | HTTP | Description                     |
  |---------------------|------|---------------------------------|
  | LIST_PROJECTS_ERROR | 400  | Internal error listing projects |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects

Response:
  {
    "errors": null,
    "data": [
      {
        "projectId": "my-app",
        "description": "A SaaS landing page",
        "plan": "api",
        "createdAt": "2026-03-11T10:30:00.000Z"
      }
    ]
  }

---

### 4. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId
**Get Project Details** — Retrieve full project info including status, deployment, secrets, and URLs. This is the main polling endpoint for project state.
Cost: Free

Response schema:
  | Field                                 | Type               | Description                                                              |
  |---------------------------------------|--------------------|--------------------------------------------------------------------------|
  | data.projectId                        | string             | The project ID                                                           |
  | data.description                      | string             | Project description                                                      |
  | data.plan                             | string             | Always "api" for VCaaS projects                                          |
  | data.agentProcessStatus               | string \| undefined | "init" (running) \| "done" (finished) \| "idle" (not started)            |
  | data.agentServerStatus                | string \| undefined | "Active" \| "Creating" \| "Starting" \| "Archived" \| "Unarchiving" \| "Archiving" |
  | data.createdAt                        | string             | ISO 8601 creation date                                                   |
  | data.deployment                       | object \| null     | Latest deployment info, null if never deployed                           |
  | data.deployment.status                | string             | "deploying" \| "success" \| "error"                                     |
  | data.deployment.createdAt             | string             | ISO 8601 deployment date                                                 |
  | data.deployment.versionId             | string \| undefined | Version ID that was deployed                                            |
  | data.versionRecovery                  | object \| null     | Set while a recoverVersion call is running, otherwise null. **This is the canonical signal for "is a version recovery in progress"** — do NOT poll agentProcessStatus for recovery (the agent is not involved). |
  | data.versionRecovery.status           | string             | "recovering" (in progress) \| "error" (last recovery failed)            |
  | data.versionRecovery.versionId        | string             | The version ID currently being / last attempted being recovered          |
  | data.versionRecovery.startedAt        | string             | ISO 8601 start time                                                      |
  | data.versionRecovery.errorMessage     | string \| undefined | Present when status="error" — surface this text to the user             |
  | data.secrets                          | array              | List of secret names (values never returned)                             |
  | data.secrets[]._id                    | string             | Secret ID (use for deletion)                                             |
  | data.secrets[].secretName             | string             | Environment variable name                                                |
  | data.secrets[].environment            | string             | "development" \| "production" \| "both"                                 |
  | data.customDomain                     | object \| null     | Custom domain info, null if none configured                              |
  | data.customDomain.hostname            | string             | The custom domain hostname                                               |
  | data.customDomain.status              | string             | "pending_validation" \| "pending_deployment" \| "active" \| "blocked"   |
  | data.customDomain.sslStatus           | string             | SSL certificate status                                                   |
  | data.customDomain.dnsRecordsToAdd     | array \| undefined | DNS records to configure: [{ type: "CNAME"\|"TXT", name, value }]       |
  | data.temporalDevelopmentProjectUrl    | string \| null \| undefined | Live development preview URL (from the running dev server). May be null/undefined if no server has started yet. |
  | data.cachedDevelopmentUrl             | string \| null \| undefined | Cached development preview URL (static snapshot, available when server is not active). May be null/undefined if the project has never been archived. |
  | data.developmentUrlFieldToUse         | string \| null \| undefined | Which field to use for the development preview right now: `"temporalDevelopmentProjectUrl"` or `"cachedDevelopmentUrl"`. **If this field is null or undefined, default to `temporalDevelopmentProjectUrl`.** |
  | data.productionProjectUrl             | string \| undefined | Production URL — custom domain if connected, otherwise {projectId}.totalum-project.com |
  | data.totalCreditsSpent                | number             | Total credits spent on this project                                      |
  | data.creditLimits                     | object             | Currently configured monthly credit limits for this project              |
  | data.creditLimits.maxDevelopmentCreditsPerMonth | number \| null | Max development credits/month (null = no limit)                  |
  | data.creditLimits.maxInfrastructureCreditsPerMonth | number \| null | Max infrastructure credits/month (null = no limit)            |
  | data.multiPrompt                      | object \| null     | Present only when a multi-prompt batch was started via POST /agent/start with `multiPrompt`. Same shape as on GET /agent/status — see endpoint 8. |

🎯 UX RECOMMENDATION — PREVIEW URL LOGIC: Use `data.developmentUrlFieldToUse` to decide which development URL to display. It returns the name of the response field containing the best URL for the current state. For example, if it returns `"cachedDevelopmentUrl"`, use `data.cachedDevelopmentUrl`; if it returns `"temporalDevelopmentProjectUrl"`, use `data.temporalDevelopmentProjectUrl`. **If `developmentUrlFieldToUse` is null or undefined, always fall back to `data.temporalDevelopmentProjectUrl`.** The cached URL is a static snapshot available when the dev server is down (e.g. archived). Once the server is active and a prompt completes, it switches back to the live URL.

🎯 UX RECOMMENDATION — WHEN TO REFRESH THE PREVIEW: You MUST call GET /projects/:projectId and re-read the preview URL fields on these events: (1) when the user navigates to the project page, (2) when the user manually refreshes the page, and (3) every time a prompt finishes (agent status becomes "done"). The preview URL can change between these events (e.g. the server may get archived and the URL switches to a cached snapshot, or a new prompt completes and the live URL becomes available again). Always re-read `developmentUrlFieldToUse` after fetching and use it to pick the correct URL. Never cache the preview URL permanently — always fetch fresh on these events.

🎯 UX RECOMMENDATION: If you embed the development preview URL or the production URL (productionProjectUrl) in an iframe, always provide an "Open in new tab" button next to it. Iframes can have limitations (e.g. restricted interactions, blocked features, or small viewport), so giving users a way to open the full page in a new browser tab greatly improves the experience.

Error responses:
  | Error Code         | HTTP | Description                                   |
  |--------------------|------|-----------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                         |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it    |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app

Response:
  {
    "errors": null,
    "data": {
      "projectId": "my-app",
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
      "versionRecovery": null,  // or { status: "recovering"|"error", versionId, startedAt, errorMessage? }
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
      "productionProjectUrl": "app.mysite.com",  // custom domain if active, otherwise "my-app.totalum-project.com"
      "totalCreditsSpent": 12.4,
      "creditLimits": {
        "maxDevelopmentCreditsPerMonth": 100,
        "maxInfrastructureCreditsPerMonth": null
      },
      "multiPrompt": null  // populated with the batch summary if a multi-prompt run was started
    }
  }

---

### 5. DELETE https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId
**Delete Project** — Permanently delete a project and all its data.
Cost: Free

URL parameters:
  | Field     | Type   | Required | Description              |
  |-----------|--------|----------|--------------------------|
  | projectId | string | Yes      | The project ID to delete |

Response schema:
  | Field        | Type    | Description                  |
  |--------------|---------|------------------------------|
  | data.success | boolean | true on successful deletion  |

Error responses:
  | Error Code         | HTTP | Description                                          |
  |--------------------|------|------------------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                                |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it           |
  | PLAN_NOT_API       | 400  | Only API plan projects can be deleted from this API  |

cURL:
  curl -X DELETE -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app

Response:
  { "errors": null, "data": { "success": true } }

---

### 6. PATCH https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/credit-limits
**Update Project Credit Limits** — Set monthly spending caps per project for development and/or infrastructure credits. By default, projects have no credit limits. Set a field to null to remove that limit.
Cost: Free

URL parameters:
  | Field     | Type   | Required | Description         |
  |-----------|--------|----------|---------------------|
  | projectId | string | Yes      | The project ID      |

Request body schema:
  | Field                             | Type   | Required | Description                                      |
  |-----------------------------------|--------|----------|--------------------------------------------------|
  | maxDevelopmentCreditsPerMonth      | number or null | No       | Max development credits per month (null to remove) |
  | maxInfrastructureCreditsPerMonth   | number or null | No       | Max infrastructure credits per month (null to remove) |

Response schema:
  | Field                                        | Type   | Description                          |
  |----------------------------------------------|--------|--------------------------------------|
  | data.creditLimits.maxDevelopmentCreditsPerMonth     | number or null | Current development limit    |
  | data.creditLimits.maxInfrastructureCreditsPerMonth  | number or null | Current infrastructure limit |

Error responses:
  | Error Code            | HTTP | Description                                        |
  |-----------------------|------|----------------------------------------------------|
  | MISSING_LIMIT_FIELDS  | 400  | At least one of the two limit fields is required   |
  | INVALID_LIMIT         | 400  | Amount must be a positive number                   |
  | PROJECT_NOT_FOUND     | 404  | Project doesn't exist or you don't own it          |

cURL:
  curl -X PATCH \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"maxDevelopmentCreditsPerMonth":500,"maxInfrastructureCreditsPerMonth":100}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/credit-limits

Response:
  {
    "errors": null,
    "data": {
      "creditLimits": {
        "maxDevelopmentCreditsPerMonth": 500,
        "maxInfrastructureCreditsPerMonth": 100
      }
    }
  }

To remove a limit, set it to null:
  curl -X PATCH \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"maxDevelopmentCreditsPerMonth":null}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/credit-limits

By default, projects have no credit limits — all operations are allowed as long as you have credits in your account. When a project reaches its monthly limit, operations in that category return a 403 PROJECT_CREDIT_LIMIT_REACHED error. Limits reset automatically on the 1st of each month.

---

### ── PROJECT TRANSFER (EXPORT / IMPORT) ──

Use these to CLONE a project (database + source code) into another project — the same account or a different one. The export returns a secret `importCode`; whoever holds it can import the project. Only use these when you actually need to duplicate/migrate a project; they are NOT part of the normal build workflow.

**Calling sequence (clone a project):**
1. `POST /projects/{sourceProjectId}/export` → save `data.importCode`.
2. `POST /projects` → create a NEW empty target project.
3. `POST /projects/{targetProjectId}/import` with `{ "importCode": "<the code>" }`.
4. Poll `GET /projects/{targetProjectId}` every 10-15s until `agentServerStatus: "Active"` — the target is now a clone of the source.

### POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/export
**Export Project** — Export this project's database (excluding secrets/sandbox/auth/users/tokens/org) plus a reference to its source code, and get a secret import code.
Cost: 2 credits. Rate limit: 1 per minute, 5 per hour.

Request body schema:
  | Field          | Type    | Required | Description                                                                 |
  |----------------|---------|----------|-----------------------------------------------------------------------------|
  | includeRecords | boolean | No       | Default false. true also exports table data records; false exports only schema/pages/config |

Response schema:
  | Field              | Type    | Description                                                                 |
  |--------------------|---------|-----------------------------------------------------------------------------|
  | data.importCode    | string  | Secret code to import this project. SECRET — anyone with it can import the data + source |
  | data.includeRecords| boolean | Whether data records were included                                          |
  | data.message       | string  | Human-readable confirmation                                                 |

Error responses:
  | Error Code                   | HTTP | Description                                  |
  |------------------------------|------|----------------------------------------------|
  | PROJECT_EXPORT_LIMIT_REACHED | 400  | Rate limit reached (1/min, 5/hour)           |
  | INSUFFICIENT_CREDITS         | 402  | Not enough credits                           |
  | PROJECT_NOT_FOUND            | 404  | Project not found or not owned by you        |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"includeRecords":false}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/export

Response:
  {
    "errors": null,
    "data": {
      "importCode": "my-app-export-project-8f3b1c9a47e2d650b9114af0c7e3a2d1.zip",
      "includeRecords": false,
      "message": "Export ready. Save the importCode and keep it secret..."
    }
  }

### POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/import
**Import Project** [ASYNC] — Import a project from an importCode into THIS (almost empty) project: restores the database, sets up the source code, then builds and runs it. Returns immediately; the restore + rebuild run in the background (a few minutes). Existing data is always dropped before restoring.
Cost: 6 credits. Rate limit: 1 per minute, 5 per hour.

Preconditions: the target project must be (almost) empty — at most 5 database tables and at most 1 version. While importing, prompting the agent returns IMPORT_IN_PROGRESS.

Request body schema:
  | Field      | Type   | Required | Description                                                       |
  |------------|--------|----------|-------------------------------------------------------------------|
  | importCode | string | Yes      | The importCode returned by the export endpoint (any project)      |

Response schema:
  | Field          | Type   | Description                          |
  |----------------|--------|--------------------------------------|
  | data.projectId | string | The target project ID                |
  | data.status    | string | Always "importing"                   |
  | data.message   | string | Instructions to poll for completion  |

Error responses:
  | Error Code                   | HTTP | Description                                                          |
  |------------------------------|------|----------------------------------------------------------------------|
  | MISSING_IMPORT_CODE          | 400  | importCode is required                                               |
  | PROJECT_NOT_IMPORTABLE       | 400  | Target already has content (>5 tables or >1 version). Use a fresh project |
  | IMPORT_IN_PROGRESS           | 400  | An import is already running for this project                        |
  | AGENT_RUNNING                | 409  | Wait for the agent to finish before importing                        |
  | PROJECT_IMPORT_LIMIT_REACHED | 400  | Rate limit reached (1/min, 5/hour)                                   |
  | INSUFFICIENT_CREDITS         | 402  | Not enough credits                                                   |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"importCode":"my-app-export-project-8f3b1c9a....zip"}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-new-app/import

Response:
  {
    "errors": null,
    "data": {
      "projectId": "my-new-app",
      "status": "importing",
      "message": "Project import started. Poll GET /projects/:projectId until agentServerStatus='Active'."
    }
  }

After calling import, poll GET /projects/{projectId} every 10-15s until agentServerStatus is "Active" and a preview URL is present.

---

### ── AI AGENT ──

### 7. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/agent/start
**Run AI Agent** [ASYNC] — Start the AI agent with a prompt to build or modify your project. Supports two modes:
  • **Single-prompt** (default, recommended): omit `multiPrompt`. One prompt, 10 to 30 minutes, 10 to 40 credits.
  • **Multi-prompt** (rare, opt-in): include `multiPrompt`. Sequential batch of prompts that runs unsupervised. Each prompt still takes 10 to 30 minutes and 10 to 40 credits, so a 10-prompt batch can run for several hours and burn hundreds of credits.

⚠️ WHEN TO USE MULTI-PROMPT: Only when a single job genuinely requires several sequential AI runs and the user has explicitly accepted the cost and time. For everything else, send one prompt at a time — it is faster, cheaper, and lets the user steer between steps. Multi-prompt is unsupervised: no human approval step, no pause between prompts. If unsure, do NOT pass `multiPrompt`.

⚡ ASYNCHRONOUS: This endpoint returns immediately with status "init". For single-prompt the agent continues working in the background for 10 to 30 minutes. For multi-prompt the whole batch can take several hours.
HOW TO WAIT: Poll GET /projects/:projectId/agent/status every 10-15 seconds. Show realtimeConversation messages to the user in real time. Single-prompt: complete when status is "done". Multi-prompt: poll `multiPrompt.status` until it is "done" (or "cancelled") — the per-prompt `status` field will flip between "init" and "done" repeatedly as each step of the batch runs.
🎯 UX RECOMMENDATION: It is strongly recommended to show a progress loader, spinner, or skeleton UI to the user while the agent is working. Display the realtimeConversation messages as they arrive (e.g. in a chat-like interface or a live log) so the user can see the agent's progress in real time. For multi-prompt, also display `multiPrompt.currentPromptIndex` / `multiPrompt.totalPrompts` and the list of prompts with their per-step status — and warn the user up-front that the batch may take hours.
⚠️ IMPORTANT — REFRESH PREVIEW URL AFTER EACH PROMPT: After every agent run completes (status becomes "done"), you MUST refresh the project preview URL by calling GET /projects/:projectId and reading the `developmentUrlFieldToUse` field. This field tells you which response field contains the best development URL to display right now (`"temporalDevelopmentProjectUrl"` for the live server or `"cachedDevelopmentUrl"` for a cached snapshot). **If `developmentUrlFieldToUse` is null or undefined, default to `temporalDevelopmentProjectUrl`.** The preview URL can change between agent runs, so if you cache or display it in an iframe, always update it when the agent finishes. Failing to do this will result in the user seeing a stale or broken preview. For multi-prompt runs the preview URL can change after every step, so refresh on each "done" tick.

Request body schema:
  | Field                            | Type    | Required | Description                                                                 |
  |----------------------------------|---------|----------|-----------------------------------------------------------------------------|
  | prompt                           | string  | Yes¹     | Single-prompt: the user instruction. Multi-prompt + letTotalumDecide: the high-level goal Totalum breaks down. Multi-prompt + prompts[]: ignored. |
  | inputFiles                       | array   | No       | Reference images/files for the agent                                        |
  | inputFiles[].name                | string  | Yes      | File name                                                                   |
  | inputFiles[].imageDescription    | string  | Yes      | Description of the image content                                            |
  | inputFiles[].url                 | string  | Yes      | Public URL or uploaded file URL                                             |
  | multiPrompt                      | object  | No       | Opt into the unsupervised multi-prompt batch mode. Omit for normal use.     |
  | multiPrompt.prompts              | string[]| No²      | Up to 50 prompts to run sequentially. Each item must be a non-empty string. |
  | multiPrompt.letTotalumDecide     | boolean | No²      | When true, Totalum plans the prompt list from the top-level `prompt`.       |

  ¹ `prompt` is required unless `multiPrompt.prompts` is provided (then it is ignored).
  ² When `multiPrompt` is present, exactly one of `prompts` (non-empty array, ≤ 50 items) or `letTotalumDecide=true` must be set.

Response schema:
  | Field                       | Type             | Description                                                                                                    |
  |-----------------------------|------------------|----------------------------------------------------------------------------------------------------------------|
  | data.projectId              | string           | The project ID                                                                                                 |
  | data.status                 | string           | Always "init" on success — for both single and multi-prompt mode                                              |
  | data.message                | string           | Instructions on how to poll for status (multi-prompt includes the cost/time warning)                          |
  | data.multiPrompt            | object \| undefined | Present only when the request had `multiPrompt`. Detailed batch status is on GET /agent/status under `multiPrompt`. |
  | data.multiPrompt.totalPrompts | number \| undefined | Known when the caller provided `prompts`; absent while Totalum is still planning a `letTotalumDecide` batch. |

Error responses:
  | Error Code                       | HTTP | Description                                                                                |
  |----------------------------------|------|--------------------------------------------------------------------------------------------|
  | MISSING_PROJECT_ID               | 400  | projectId is required                                                                      |
  | PROJECT_NOT_FOUND                | 404  | Project does not exist or you don't own it                                                 |
  | MISSING_PROMPT                   | 400  | `prompt` is required (single-prompt mode, or `letTotalumDecide=true` — it is the planner goal) |
  | INVALID_MULTI_PROMPT             | 400  | `multiPrompt` was set but neither (or both) of `prompts[]` and `letTotalumDecide=true` were provided |
  | TOO_MANY_PROMPTS                 | 400  | `multiPrompt.prompts` exceeds the 50-item limit                                            |
  | INVALID_PROMPT_ITEM              | 400  | A `multiPrompt.prompts` entry is not a non-empty string                                    |
  | AGENT_RUNNING                    | 409  | An agent is already running on this project                                                |
  | AUTO_EXECUTION_ALREADY_ACTIVE    | 409  | A previous multi-prompt batch is still active (executing/paused/awaiting approval). Cancel it first. |
  | DEPLOYMENT_RUNNING               | 409  | Cannot start agent while a deployment is in progress                                       |
  | RECOVERY_RUNNING                 | 409  | Cannot start agent while a version recovery is in progress — poll `versionRecovery` until null, then retry |
  | INSUFFICIENT_CREDITS             | 402  | Minimum 50 credits required to start agent (multi-prompt typically needs many more)        |
  | PROMPT_SECURITY_VIOLATION        | 400  | Prompt failed security validation                                                          |

cURL — single-prompt (recommended):
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Create a landing page with a contact form","inputFiles":[]}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start

cURL — multi-prompt with explicit list:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"multiPrompt":{"prompts":["Set up auth","Add a Stripe checkout","Wire up the dashboard"]}}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start

cURL — multi-prompt with Totalum planning:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Build a full SaaS billing system with auth, Stripe, and a customer portal","multiPrompt":{"letTotalumDecide":true}}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start

Response (single-prompt):
  {
    "errors": null,
    "data": {
      "projectId": "my-app",
      "status": "init",
      "message": "Process started, can take from 10 to 30 minutes (10 to 40 credits). Fetch GET .../agent/status every 10-15 seconds to track progress."
    }
  }

Response (multi-prompt):
  {
    "errors": null,
    "data": {
      "projectId": "my-app",
      "status": "init",
      "message": "Multi-prompt run started with 3 prompts. ⚠️ Multi-prompt mode is expensive and slow — only use it when a job genuinely requires multiple sequential AI runs. Each prompt typically takes 10 to 30 minutes and costs 10 to 40 credits...",
      "multiPrompt": { "totalPrompts": 3 }
    }
  }

---

### 8. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/agent/status
**Get Agent Status** — Poll this endpoint to track agent progress and get real-time messages. Poll every 10-15 seconds.
Cost: Free

⚠️ IMPORTANT — REFRESH PREVIEW URL WHEN DONE: When the agent status becomes "done", you MUST refresh the preview URL by calling GET /projects/:projectId and reading `developmentUrlFieldToUse` to know which URL field to display (`"temporalDevelopmentProjectUrl"` or `"cachedDevelopmentUrl"`). **If `developmentUrlFieldToUse` is null or undefined, default to `temporalDevelopmentProjectUrl`.** The URL can change after each agent run. If you display the preview in an iframe or link, always update it when the agent finishes to avoid showing a stale or broken preview. Recommended flow: poll until status is "done" → fetch GET /projects/:projectId → read `developmentUrlFieldToUse` → use that field's value as the preview URL (or `temporalDevelopmentProjectUrl` if null/undefined) → reload iframe.

Response schema:
  | Field                                             | Type               | Description                                                     |
  |-----------------------------------------------------|--------------------|-------------------------------------------------------------------|
  | data.projectId                                    | string             | The project ID                                                  |
  | data.status                                       | string             | "init" (a prompt is currently running) \| "done" (last prompt finished) \| "idle" (never run). For multi-prompt runs this flips between "init" and "done" repeatedly as the batch advances — poll `multiPrompt.status` to track the whole batch. |
  | data.startedAt                                    | string \| null     | ISO 8601 start time of the **current** prompt (not the whole batch) |
  | data.realtimeConversation                         | array              | Single-prompt: messages from the current run. Multi-prompt: messages from the whole batch (scoped to `multiPrompt.startedAt`). |
  | data.realtimeConversation[].author                | string             | "user" \| "agent"                                               |
  | data.realtimeConversation[].message               | string             | The message text                                                |
  | data.realtimeConversation[].messageType           | string             | "regular" \| "starting" \| "building" \| "finished" \| "error" \| "limit-reached" |
  | data.realtimeConversation[].createdAt             | string             | ISO 8601 message date                                           |
  | data.realtimeConversation[].versionId             | string \| undefined | Version created at this step                                   |
  | data.realtimeConversation[].secretKeysNeeded      | object \| undefined | Secrets the agent needs (key: { isProvided, description })     |
  | data.realtimeConversation[].gitDiffUrl            | string \| undefined | Diff URL for this step                                         |
  | data.creditsSpent                                 | number \| undefined | Credits spent on the current prompt (present when `status` is "done") |
  | data.multiPrompt                                  | object \| null     | Present only when a multi-prompt batch exists. **This is the canonical signal for "is a multi-prompt run in flight"** — poll its `status` until "done" / "cancelled". |
  | data.multiPrompt.status                           | string             | "planning" \| "executing" \| "paused" \| "done" \| "cancelled"  |
  | data.multiPrompt.totalPrompts                     | number             | Number of prompts in the batch (0 during planning)              |
  | data.multiPrompt.currentPromptIndex               | number             | Index of the in-flight prompt; -1 before the first one starts   |
  | data.multiPrompt.prompts                          | array              | Ordered list of prompts in the batch                            |
  | data.multiPrompt.prompts[].order                  | number             | Position in the batch                                           |
  | data.multiPrompt.prompts[].prompt                 | string             | The prompt text                                                 |
  | data.multiPrompt.prompts[].status                 | string             | "pending" \| "executing" \| "done" \| "failed"                  |
  | data.multiPrompt.startedAt                        | string             | ISO 8601 start time of the whole batch                          |
  | data.multiPrompt.updatedAt                        | string             | ISO 8601 last change to the batch state                         |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/status

Response (single-prompt):
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

Response (multi-prompt — running prompt 2 of 3):
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
          { "order": 0, "prompt": "Set up auth",       "status": "done" },
          { "order": 1, "prompt": "Add Stripe checkout","status": "executing" },
          { "order": 2, "prompt": "Wire up dashboard", "status": "pending" }
        ],
        "startedAt": "2026-03-11T10:35:00.000Z",
        "updatedAt": "2026-03-11T11:05:00.000Z"
      }
    }
  }

---

### 9. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/agent/full-conversation
**Get Full Conversation** — Retrieve the complete conversation history across all agent runs (not just the current one).
Cost: Free

Response schema:
  | Field                        | Type   | Description                        |
  |------------------------------|--------|------------------------------------|
  | data.projectId               | string | The project ID                     |
  | data.conversation            | array  | All messages from all agent runs   |
  | data.conversation[].author          | string             | "user" \| "agent"                                                      |
  | data.conversation[].message         | string             | The message text                                                        |
  | data.conversation[].messageType     | string             | "regular" \| "starting" \| "building" \| "finished" \| "error" \| "limit-reached" |
  | data.conversation[].createdAt       | string             | ISO 8601 message date                                                   |
  | data.conversation[].versionId       | string \| undefined | Version created at this step                                           |
  | data.conversation[].secretKeysNeeded| object \| undefined | API keys the agent needs (key: { isProvided, description }). Add missing keys as project secrets |
  | data.conversation[].gitDiffUrl      | string \| undefined | Diff URL for this step                                                 |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/full-conversation

Response:
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

---

### 10. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/agent/stop
**Stop Agent** — Send a stop signal to a running agent.
Cost: Free

Response schema:
  | Field        | Type   | Description          |
  |--------------|--------|----------------------|
  | data.message | string | Confirmation message |

Error responses:
  | Error Code           | HTTP | Description                                |
  |----------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID   | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND    | 404  | Project does not exist or you don't own it |
  | NO_PROCESS_RUNNING   | 400  | No agent process is currently running      |

cURL:
  curl -X POST -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/stop

Response:
  { "errors": null, "data": { "message": "Agent stop signal sent" } }

---

### ── DEPLOYMENTS ──

### 11. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/deployments/deploy
**Deploy to Production** [ASYNC] — Build and deploy your project to a production URL.
Cost: 1 credits

⚡ ASYNCHRONOUS: This endpoint returns immediately with status "deploying". The deployment continues in the background for 2 to 5 minutes.
HOW TO WAIT: Poll GET /projects/:projectId/deployments/status every 10-15 seconds. The operation is complete when status is "success". Then get the public URL from GET /projects/:projectId → productionProjectUrl.
🎯 UX RECOMMENDATION: It is strongly recommended to show a progress loader or "Deploying..." indicator while the deployment is running. Since this takes 2-5 minutes, displaying a spinner, progress bar, or status animation prevents users from thinking the app is unresponsive. Update the UI once the status changes to "success" and show the production URL.

Note: If server is not active, it auto-starts (charges 3 credits extra) and returns SERVER_NOT_READY.

Response schema:
  | Field          | Type   | Description                                    |
  |----------------|--------|------------------------------------------------|
  | data.projectId | string | The project ID                                 |
  | data.status    | string | Always "deploying" on success                  |
  | data.message   | string | Instructions on how to poll for status         |

Error responses:
  | Error Code          | HTTP | Description                                         |
  |---------------------|------|-----------------------------------------------------|
  | MISSING_PROJECT_ID  | 400  | projectId is required                               |
  | PROJECT_NOT_FOUND   | 404  | Project does not exist or you don't own it          |
  | AGENT_RUNNING       | 409  | Cannot deploy while agent is running                |
  | DEPLOYMENT_RUNNING  | 409  | A deployment is already in progress                 |
  | RECOVERY_RUNNING    | 409  | A version recovery is in progress                   |
  | SERVER_NOT_READY    | 409  | Server auto-starting, poll until Active then retry  |
  | INSUFFICIENT_CREDITS| 402  | Not enough credits for deployment                   |

cURL:
  curl -X POST -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/deployments/deploy

Response:
  {
    "errors": null,
    "data": {
      "projectId": "my-app",
      "status": "deploying",
      "message": "Deployment started. It will take from 2 to 5 minutes. Fetch GET .../deployments/status every 10-15 seconds to track progress."
    }
  }

---

### 12. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/deployments/status
**Get Deployment Status** — Check the current deployment status. Poll until status is "success".
Cost: Free

Response schema:
  | Field          | Type               | Description                                                  |
  |----------------|--------------------|--------------------------------------------------------------|
  | data.status    | string \| null     | "deploying" \| "success" \| "error" \| null (if never deployed) |
  | data.createdAt | string \| null     | ISO 8601 deployment date                                     |
  | data.versionId | string \| undefined | Version that was deployed                                   |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/deployments/status

Response:
  {
    "errors": null,
    "data": {
      "status": "success",
      "createdAt": "2026-03-11T11:00:00.000Z",
      "versionId": "v_abc123"
    }
  }

---

### ── SERVER ──

### 13. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/agent/server/start-or-restart
**Start or Restart Server** [ASYNC] — Start or restart the development server for your project.
Cost: 3 credits

⚡ ASYNCHRONOUS: This endpoint returns immediately with status "starting". The server startup continues in the background for 2 to 4 minutes.
HOW TO WAIT: Poll GET /projects/:projectId every 10-15 seconds. The operation is complete when agentServerStatus is "Active".
🎯 UX RECOMMENDATION: It is strongly recommended to show a progress loader or "Starting server..." indicator while the server is booting up. Since this takes 2-4 minutes, displaying a spinner or status animation prevents users from thinking the app is frozen. Update the UI once agentServerStatus becomes "Active".

Response schema:
  | Field        | Type   | Description        |
  |--------------|--------|--------------------|
  | data.message | string | Status message     |
  | data.status  | string | Always "starting"  |

Error responses:
  | Error Code           | HTTP | Description                                              |
  |----------------------|------|----------------------------------------------------------|
  | MISSING_PROJECT_ID   | 400  | projectId is required                                    |
  | PROJECT_NOT_FOUND    | 404  | Project does not exist or you don't own it               |
  | AGENT_RUNNING        | 409  | Cannot restart server while agent is running             |
  | DEPLOYMENT_RUNNING   | 409  | Cannot restart server while deployment is in progress    |
  | RECOVERY_RUNNING     | 409  | Cannot restart server while version recovery is in progress |
  | INSUFFICIENT_CREDITS | 402  | Not enough credits for server start                      |

cURL:
  curl -X POST -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/server/start-or-restart

Response:
  {
    "errors": null,
    "data": {
      "message": "Server start/restart initiated",
      "status": "starting"
    }
  }

---

### 14. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/backend/dev/logs
**Get Dev Server Logs** — Retrieve backend development server stdout/stderr output.
Cost: Free

Response schema:
  | Field     | Type   | Description                              |
  |-----------|--------|------------------------------------------|
  | data.logs | string | Development server stdout/stderr output  |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/backend/dev/logs

Response:
  {
    "errors": null,
    "data": { "logs": "Server running on port 3000\n..." }
  }

---

### ── SOURCE CODE & FILES ──

### 15. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/source-code
**Download Source Code** — Get a signed URL to download the project source code.
Cost: 1 credits

Response schema:
  | Field             | Type               | Description                             |
  |-------------------|--------------------|-----------------------------------------|
  | data.filesCount   | number             | Total files in project                  |
  | data.lastCommitSha| string \| undefined | Latest git commit SHA                  |
  | data.downloadUrl  | string \| null     | Signed download URL (expires in minutes)|

Error responses:
  | Error Code           | HTTP | Description                                        |
  |----------------------|------|----------------------------------------------------|
  | MISSING_PROJECT_ID   | 400  | projectId is required                              |
  | PROJECT_NOT_FOUND    | 404  | Project does not exist or you don't own it         |
  | INSUFFICIENT_CREDITS | 402  | Not enough credits for source code download        |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/source-code

Response:
  {
    "errors": null,
    "data": {
      "filesCount": 47,
      "lastCommitSha": "a1b2c3d",
      "downloadUrl": "https://storage.googleapis.com/..."
    }
  }

---

### 16. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/files/upload
**Upload File** — Upload a file to use as agent input (images, designs, etc.). Max 12MB.
Cost: 0.5 credits
Content-Type: multipart/form-data with field "file".

Request schema (multipart/form-data):
  | Field | Type | Required | Description                 |
  |-------|------|----------|-----------------------------|
  | file  | File | Yes      | The file to upload (max 12MB)|

Response schema:
  | Field           | Type   | Description                                    |
  |-----------------|--------|------------------------------------------------|
  | data.fileNameId | string | Stored file name identifier                    |
  | data.url        | string | Signed download URL, use in agent inputFiles   |

Error responses:
  | Error Code           | HTTP | Description                                          |
  |----------------------|------|------------------------------------------------------|
  | MISSING_PROJECT_ID   | 400  | projectId is required                                |
  | PROJECT_NOT_FOUND    | 404  | Project does not exist or you don't own it           |
  | MISSING_FILE         | 400  | file is required (multipart form field "file")       |
  | INSUFFICIENT_CREDITS | 402  | Not enough credits for file upload                   |
  | UPLOAD_FAILED        | 500  | File upload failed                                   |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -F "file=@./logo.png" \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/files/upload

Response:
  {
    "errors": null,
    "data": {
      "fileNameId": "logo_abc123.png",
      "url": "https://storage.googleapis.com/..."
    }
  }

---

### ── VERSIONS ──

### 17. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/versions
**List Versions** — Get all project versions with pagination.
Cost: Free

Query parameters:
  | Field | Type   | Required | Description                          |
  |-------|--------|----------|--------------------------------------|
  | limit | number | No       | Number of versions to return (default: 20) |
  | skip  | number | No       | Number of versions to skip (default: 0)    |

Response schema:
  | Field                          | Type               | Description                              |
  |--------------------------------|--------------------|------------------------------------------|
  | data.versions                  | array              | Array of version objects                 |
  | data.versions[]._id            | string             | Version ID (use for recover)             |
  | data.versions[].name           | string             | Version display name                     |
  | data.versions[].commitMessage  | string \| undefined | Git commit message                      |
  | data.versions[].prompt         | string \| undefined | The prompt that created this version    |
  | data.versions[].createdAt      | string             | ISO 8601 creation date                   |
  | data.totalCount                | number             | Total versions available                 |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |

cURL:
  curl -H "api-key: tlm_sk_your_key" "https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/versions?limit=20&skip=0"

Response:
  {
    "errors": null,
    "data": {
      "versions": [
        {
          "_id": "v_abc123",
          "name": "Version 3",
          "commitMessage": "Added contact form",
          "prompt": "Add a contact form to the landing page",
          "createdAt": "2026-03-11T10:45:00.000Z"
        }
      ],
      "totalCount": 3
    }
  }

---

### 18. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/versions/:id/recover
**Recover Version** [ASYNC] — Restore a previous version of the project.
Cost: 2 credits

⚡ ASYNCHRONOUS: This endpoint returns immediately. The version recovery continues in the background for 1 to 4 minutes.
HOW TO WAIT: Poll GET /projects/:projectId every 10-15 seconds and watch the **`versionRecovery`** field. While the recovery is running, `versionRecovery.status` is `"recovering"`. Recovery is complete the moment `versionRecovery` becomes `null`. If `versionRecovery.status` is `"error"`, surface `versionRecovery.errorMessage` to the user. Do **not** poll `agentProcessStatus` for recovery — the agent is not involved in a version recovery.
🎯 UX RECOMMENDATION: Show a progress loader or "Recovering version..." indicator while `versionRecovery.status === "recovering"`. The full recovery takes 1-4 minutes, so without visible progress users assume the app is unresponsive. Keep the loader visible until `versionRecovery` flips to `null` (success) or `"error"` (failure); after success, also refresh the preview URL (see endpoint #4 — the development URL may switch from the cached snapshot back to the live server when the new build comes up).

Note: If server is not active, it auto-starts (charges 3 credits extra) and returns SERVER_NOT_READY.

URL parameters:
  | Field     | Type   | Required | Description                                    |
  |-----------|--------|----------|------------------------------------------------|
  | projectId | string | Yes      | The project ID                                 |
  | id        | string | Yes      | The version ID to recover (from GET /versions) |

Response schema:
  | Field        | Type   | Description          |
  |--------------|--------|----------------------|
  | data.message | string | Confirmation message |

Error responses:
  | Error Code           | HTTP | Description                                            |
  |----------------------|------|--------------------------------------------------------|
  | MISSING_PROJECT_ID   | 400  | projectId is required                                  |
  | PROJECT_NOT_FOUND    | 404  | Project does not exist or you don't own it             |
  | MISSING_VERSION_ID   | 400  | versionId is required                                  |
  | AGENT_RUNNING        | 409  | Cannot recover while agent is running                  |
  | DEPLOYMENT_RUNNING   | 409  | Cannot recover while deployment is in progress         |
  | RECOVERY_RUNNING     | 409  | A version recovery is already in progress              |
  | SERVER_NOT_READY     | 409  | Server auto-starting, poll until Active then retry     |
  | INSUFFICIENT_CREDITS | 402  | Not enough credits for version recovery                |

cURL:
  curl -X POST -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/versions/v_abc123/recover

Response:
  { "errors": null, "data": { "message": "Version recovery initiated" } }

---

### ── SECRETS (Environment Variables) ──

### 19. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/secrets
**Create Secret** — Add an environment variable. Encrypted at rest, auto-synced to sandbox .env.
Cost: Free

Request body schema:
  | Field       | Type   | Required | Description                                                    |
  |-------------|--------|----------|----------------------------------------------------------------|
  | secretName  | string | Yes      | Environment variable name                                      |
  | secretValue | string | Yes      | The secret value, stored encrypted                             |
  | environment | string | No       | "development" \| "production" \| "both" (default: "both")     |

Response schema:
  | Field            | Type   | Description                              |
  |------------------|--------|------------------------------------------|
  | data._id         | string | ID of the created secret                 |
  | data.secretName  | string | The secret name                          |
  | data.environment | string | "development" \| "production" \| "both"  |
  | data.createdAt   | string | ISO 8601 creation date                   |

Error responses:
  | Error Code               | HTTP | Description                           |
  |--------------------------|------|---------------------------------------|
  | MISSING_PROJECT_ID       | 400  | projectId is required                 |
  | PROJECT_NOT_FOUND        | 404  | Project does not exist or you don't own it |
  | MISSING_SECRET_FIELDS    | 400  | secretName and secretValue are required |
  | INVALID_SECRET_KEY_NAME  | 400  | Invalid secret key name format        |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"secretName":"STRIPE_KEY","secretValue":"sk_live_abc123","environment":"both"}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/secrets

Response:
  {
    "errors": null,
    "data": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "secretName": "STRIPE_KEY",
      "environment": "both",
      "createdAt": "2026-03-11T10:30:00.000Z"
    }
  }

---

### 20. DELETE https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/secrets/:secretId
**Delete Secret** — Remove an environment variable by ID. Sandbox .env synced automatically.
Cost: Free

URL parameters:
  | Field    | Type   | Required | Description              |
  |----------|--------|----------|--------------------------|
  | projectId| string | Yes      | The project ID           |
  | secretId | string | Yes      | The secret ID to delete  |

Response schema:
  | Field        | Type    | Description       |
  |--------------|---------|-------------------|
  | data.success | boolean | true on success   |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |
  | MISSING_SECRET_ID  | 400  | secretId is required                       |

cURL:
  curl -X DELETE -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/secrets/65f1a2b3c4d5e6f7a8b9c0d1

Response:
  { "errors": null, "data": { "success": true } }

---

### ── CUSTOM DOMAINS ──

### 21. PUT https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/domain
**Add Custom Domain** — Attach a custom subdomain to your deployed project. Must be a subdomain (e.g. app.yourdomain.com).
IMPORTANT: You must deploy your project first AND wait until the deployment status is "success" before calling this endpoint. If the deployment is still in progress or no deployment exists, this will return a NO_DEPLOYMENT error.
Cost: 2 credits

Request body schema:
  | Field    | Type   | Required | Description                                     |
  |----------|--------|----------|-------------------------------------------------|
  | hostname | string | Yes      | The subdomain to add (e.g. app.yourdomain.com)  |

Response schema:
  | Field                       | Type               | Description                       |
  |-----------------------------|--------------------|-----------------------------------|
  | data.success                | boolean            | true on success                   |
  | data.hostname               | string             | The configured hostname           |
  | data.status                 | string             | "pending_validation" initially    |
  | data.dnsRecordsToAdd        | array \| undefined | DNS records to add at your provider |
  | data.dnsRecordsToAdd[].type | string             | "CNAME" or "TXT"                  |
  | data.dnsRecordsToAdd[].name | string             | DNS record name (zone-relative, e.g. "app" or "_cf-custom-hostname.app") |
  | data.dnsRecordsToAdd[].value| string             | DNS record value (e.g. "my-app.totalum-project.com" or verification token) |

Error responses:
  | Error Code           | HTTP | Description                                               |
  |----------------------|------|-----------------------------------------------------------|
  | MISSING_PROJECT_ID   | 400  | projectId is required                                     |
  | PROJECT_NOT_FOUND    | 404  | Project does not exist or you don't own it                |
  | MISSING_HOSTNAME     | 400  | hostname is required (e.g. app.yourdomain.com)            |
  | INSUFFICIENT_CREDITS | 402  | Not enough credits to add custom domain                   |
  | NO_DEPLOYMENT        | 404  | No deployment found. Deploy first and wait until status is "success" |

cURL:
  curl -X PUT \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"hostname":"app.yourdomain.com"}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/domain

Response:
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

After configuring DNS, poll GET /projects/:projectId and check customDomain.status until "active".

Root domain tip: Custom domains require a subdomain (e.g. www.yourdomain.com). If you want yourdomain.com (without www) to reach your project, add www.yourdomain.com as the custom domain, then create a redirect in your DNS provider from yourdomain.com to www.yourdomain.com. Most providers offer this as "URL redirect" or "domain forwarding" in their DNS settings.

---

### 22. DELETE https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/domain
**Remove Custom Domain** — Detach the custom domain from your project.
Cost: Free

Response schema:
  | Field        | Type   | Description          |
  |--------------|--------|----------------------|
  | data.message | string | Confirmation message |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |
  | NO_DEPLOYMENT      | 404  | No deployment found. Deploy first and wait until status is "success" |

cURL:
  curl -X DELETE -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/domain

Response:
  { "errors": null, "data": { "message": "Custom domain removed" } }

---

### ── DATABASE ──

### 23. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/database/tables-structure
**Get Database Tables Structure** — Retrieve all database table definitions including field names, types, and configuration.
Cost: Free

Response schema:
  | Field                                          | Type   | Description                                                        |
  |------------------------------------------------|--------|--------------------------------------------------------------------|
  | data.tables                                    | array  | Array of table definitions                                         |
  | data.tables[]._id                              | string | Table ID                                                           |
  | data.tables[].type                             | string | Table name (snake_case)                                            |
  | data.tables[].label                            | string | Human-friendly display name                                        |
  | data.tables[].description                      | string | Table description                                                  |
  | data.tables[].icon                             | string | FontAwesome icon class                                             |
  | data.tables[].properties                       | object | Map of property name to property definition                        |
  | data.tables[].properties.{name}.id             | string | Property ID                                                        |
  | data.tables[].properties.{name}.name           | string | Property field name                                                |
  | data.tables[].properties.{name}.propertyType   | string | "string" \| "number" \| "date" \| "options" \| "file" \| "long-string" \| "objectReference" |
  | data.tables[].properties.{name}.label          | string | Human-friendly field label                                         |
  | data.tables[].properties.{name}.description    | string | Field description                                                  |
  | data.tables[].properties.{name}.objectReference| object | Relationship config (if objectReference type)                      |
  | data.tables[].properties.{name}.typeExtras     | object | Type-specific config (options values, date settings, etc.)         |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/database/tables-structure

Response:
  {
    "errors": null,
    "data": {
      "tables": [
        {
          "_id": "65f1a2b3c4d5e6f7",
          "type": "customers",
          "label": "Customers",
          "description": "Customer records",
          "icon": "fa-solid fa-users",
          "properties": {
            "name": {
              "id": "prop_abc123",
              "name": "name",
              "propertyType": "string",
              "label": "Full Name"
            },
            "email": {
              "id": "prop_def456",
              "name": "email",
              "propertyType": "string",
              "label": "Email",
              "typeExtras": { "string": { "type": "link" } }
            }
          }
        }
      ]
    }
  }

---

### 24. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/database/query
**Query Database** — Query records from any table with advanced filtering, sorting, pagination, aggregations, and nested related data up to 6 levels deep.
Cost: Free

Request body schema:
  | Field                    | Type               | Required | Description                                                          |
  |--------------------------|--------------------|----------|----------------------------------------------------------------------|
  | tableName                | string             | Yes      | The table name to query (use "type" from tables-structure response)  |
  | queryOptions             | object             | No       | Advanced query options                                               |
  | queryOptions._filter     | object             | No       | Field filters (see filter operators below)                           |
  | queryOptions._sort       | object             | No       | Sort by fields: { fieldName: "asc" \| "desc" }                      |
  | queryOptions._limit      | number             | No       | Max records to return (default 50, max 1000)                         |
  | queryOptions._offset     | number             | No       | Records to skip (for pagination)                                     |
  | queryOptions._select     | object             | No       | Include only specified fields: { fieldName: true }. Cannot use with _omit |
  | queryOptions._omit       | object             | No       | Exclude specified fields: { fieldName: true }. Cannot use with _select   |
  | queryOptions._count      | boolean            | No       | Adds _count._total with total matching records (before pagination)   |
  | queryOptions._aggregate  | object             | No       | Aggregations: { _sum: { field: true }, _avg, _min, _max, _count }   |
  | queryOptions._groupBy    | string \| string[] | No       | Group results by field(s). Requires _aggregate                       |
  | queryOptions.[property]  | true \| object     | No       | Expand related data. true = all fields, object = nested queryOptions |

Filter operators (use inside _filter):
  Exact match:  { "status": "active" }
  With operator: { "fieldName": { "operator": value } }

  | Operator    | Description                     | Example                                            |
  |-------------|---------------------------------|----------------------------------------------------|
  | gte         | Greater than or equal           | { "age": { "gte": 18 } }                           |
  | lte         | Less than or equal              | { "age": { "lte": 65 } }                           |
  | gt          | Greater than                    | { "price": { "gt": 0 } }                           |
  | lt          | Less than                       | { "price": { "lt": 100 } }                         |
  | ne          | Not equal                       | { "status": { "ne": "deleted" } }                  |
  | in          | Matches any value in array      | { "status": { "in": ["active", "pending"] } }      |
  | nin         | Matches none in array           | { "role": { "nin": ["admin", "super"] } }          |
  | regex       | Regex pattern (+options for flags)| { "email": { "regex": "@gmail", "options": "i" } }|
  | contains    | Case-insensitive contains       | { "name": { "contains": "john" } }                 |
  | startsWith  | Case-insensitive starts with    | { "name": { "startsWith": "J" } }                  |
  | endsWith    | Case-insensitive ends with      | { "email": { "endsWith": ".com" } }                |
  | _or         | OR logic (array of conditions)  | { "_or": [{ "status": "active" }, { "role": "admin" }] } |

Nested queries (related data):
  Expand related tables by using the property name as a key in queryOptions.
  - Shorthand: { "orders": true } — expands all related orders
  - Full: { "orders": { "_filter": {...}, "_sort": {...}, "_limit": 5 } } — with options (max 300 children)
  - { "orders": { "_has": true } } — only parents with at least one matching child
  - { "orders": { "_has": "none" } } — only parents with zero matching children
  - { "orders": { "_count": true } } — include child count per parent
  - Nesting up to 6 levels deep supported

Response schema:
  | Field        | Type  | Description               |
  |--------------|-------|---------------------------|
  | data.results | array | Array of matching records  |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |
  | MISSING_TABLE_NAME | 400  | tableName is required                      |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"tableName":"customers","queryOptions":{"_filter":{"status":"active","age":{"gte":18}},"_sort":{"createdAt":"desc"},"_limit":10,"orders":{"_filter":{"total":{"gt":50}},"_limit":5}}}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/database/query

Response:
  {
    "errors": null,
    "data": {
      "results": [
        {
          "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
          "name": "John Doe",
          "email": "john@example.com",
          "status": "active",
          "age": 30,
          "orders": [
            { "_id": "...", "total": 120.50, "createdAt": "2026-03-09T..." }
          ],
          "createdAt": "2026-03-10T08:00:00.000Z"
        }
      ]
    }
  }

More filter examples:
  // OR logic
  "_filter": { "_or": [{ "status": "active" }, { "role": "admin" }] }
  // IN operator
  "_filter": { "status": { "in": ["active", "pending"] } }
  // Regex case-insensitive
  "_filter": { "email": { "regex": "@gmail", "options": "i" } }
  // Aggregation with groupBy
  "_aggregate": { "_sum": { "total": true }, "_count": true }, "_groupBy": "status"
  // Nested: only parents with children matching filter
  "orders": { "_has": true, "_filter": { "total": { "gt": 100 } } }

---

### 25. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/database/records
**Create Database Record** — Create a new record in any table. The `_id` field is auto-generated by the database — do not include it in the request body. The response returns the full created record including the generated `_id` and any default fields.
Cost: Free

Request body schema:
  | Field     | Type   | Required | Description                                                                    |
  |-----------|--------|----------|--------------------------------------------------------------------------------|
  | tableName | string | Yes      | The table name to insert into (use "type" from tables-structure response)      |
  | data      | object | Yes      | The record properties as key-value pairs. Do NOT include _id (auto-generated)  |

Response schema:
  | Field     | Type   | Description                                                                   |
  |-----------|--------|-------------------------------------------------------------------------------|
  | data      | object | The full created record including the auto-generated _id and all fields       |
  | data._id  | string | The auto-generated unique identifier for the new record                       |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |
  | MISSING_TABLE_NAME | 400  | tableName is required                      |
  | MISSING_DATA       | 400  | data is required and must be an object     |
  | TABLE_NOT_FOUND    | 400  | Table doesn't exist in the project         |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"tableName":"customers","data":{"name":"John Doe","email":"john@example.com","status":"active","age":30}}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/database/records

Response:
  {
    "errors": null,
    "data": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "age": 30,
      "createdAt": "2026-03-25T10:00:00.000Z",
      "updatedAt": "2026-03-25T10:00:00.000Z"
    }
  }

---

### 26. PATCH https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/database/records/:recordId
**Edit Database Record** — Update specific fields of an existing record by its ID. Only the fields included in `data` will be modified — all other fields remain unchanged. The response returns the full updated record.
Cost: Free

URL parameters:
  | Field     | Type   | Required | Description                             |
  |-----------|--------|----------|-----------------------------------------|
  | projectId | string | Yes      | The project ID                          |
  | recordId  | string | Yes      | The _id of the record to update         |

Request body schema:
  | Field     | Type   | Required | Description                                                                    |
  |-----------|--------|----------|--------------------------------------------------------------------------------|
  | tableName | string | Yes      | The table name (use "type" from tables-structure response)                     |
  | data      | object | Yes      | The properties to update as key-value pairs. Only included fields are modified |

Response schema:
  | Field     | Type   | Description                                                              |
  |-----------|--------|--------------------------------------------------------------------------|
  | data      | object | The full updated record with all fields (including unchanged ones)       |
  | data._id  | string | The record ID                                                            |

Error responses:
  | Error Code         | HTTP | Description                                |
  |--------------------|------|--------------------------------------------|
  | MISSING_PROJECT_ID | 400  | projectId is required                      |
  | PROJECT_NOT_FOUND  | 404  | Project does not exist or you don't own it |
  | MISSING_RECORD_ID  | 400  | recordId is required                       |
  | MISSING_TABLE_NAME | 400  | tableName is required                      |
  | MISSING_DATA       | 400  | data is required and must be an object     |
  | TABLE_NOT_FOUND    | 400  | Table doesn't exist in the project         |

cURL:
  curl -X PATCH \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"tableName":"customers","data":{"email":"newemail@example.com","age":31}}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/database/records/65f1a2b3c4d5e6f7a8b9c0d1

Response:
  {
    "errors": null,
    "data": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "John Doe",
      "email": "newemail@example.com",
      "status": "active",
      "age": 31,
      "createdAt": "2026-03-25T10:00:00.000Z",
      "updatedAt": "2026-03-25T10:05:00.000Z"
    }
  }

---

### ── ANALYTICS ──

### 27. GET https://api-accounts.totalum.app/api/v1/credits/spending-analytics
**Spending Analytics** — Get daily credit spending data for charts and reports. Returns data aggregated by day, category (development/infrastructure), and usage type.
Cost: Free

Query parameters:
  | Field          | Type   | Required | Description                                         |
  |----------------|--------|----------|-----------------------------------------------------|
  | from           | string | Yes      | Start date (YYYY-MM-DD), max 90 days before "to"    |
  | to             | string | Yes      | End date (YYYY-MM-DD)                               |
  | projectId      | string | No       | Filter by project ID                                |

Response schema:
  | Field                        | Type   | Description                                       |
  |------------------------------|--------|---------------------------------------------------|
  | data.daily                   | array  | Array of daily spending objects                   |
  | data.daily[].date            | string | Date (YYYY-MM-DD)                                |
  | data.daily[].development     | number | Development credits spent that day                |
  | data.daily[].infrastructure  | number | Infrastructure credits spent that day             |
  | data.daily[].byType          | object | Credits by usage type (e.g. prompt, deploy, chatgpt) |
  | data.totals.development      | number | Total development credits in range                |
  | data.totals.infrastructure   | number | Total infrastructure credits in range             |
  | data.totals.total            | number | Total credits in range                            |
  | data.totals.byType           | object | Total credits by usage type                       |
  | data.projects                | array  | List of project IDs with spending data            |

Usage types in byType: prompt, deploy, start_server, get_source_code, recover_version, upload_file, add_custom_domain, chatgpt, image_generation, video_analysis, audio_transcription, email, pdf, document_scan, web_scraper, file_upload

cURL:
  curl -H "api-key: tlm_sk_your_key" \
    "https://api-accounts.totalum.app/api/v1/credits/spending-analytics?from=2026-04-01&to=2026-04-04"

Filter by project:
  curl -H "api-key: tlm_sk_your_key" \
    "https://api-accounts.totalum.app/api/v1/credits/spending-analytics?from=2026-04-01&to=2026-04-04&projectId=my-app"

Response:
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

Note: Analytics data is available for the last 90 days. Older data is automatically cleaned up.

---

### ── WEBHOOKS ──

### 28. PUT https://api-accounts.totalum.app/api/v1/vcaas/webhooks
**Register Webhook** — Subscribe to an event. You'll receive a POST to your URL when the event occurs.
Cost: Free

Request body schema:
  | Field   | Type   | Required | Description                                        |
  |---------|--------|----------|----------------------------------------------------|
  | url     | string | Yes      | HTTPS URL to receive webhook POST                  |
  | event   | string | Yes      | Event type to subscribe to. See available events below |
  | headers | object | No       | Custom headers to include in webhook POST           |

Available events:
  | Event                          | Description                                      |
  |--------------------------------|--------------------------------------------------|
  | agent.prompt.finished          | Fired when the AI agent finishes processing      |
  | project.credit_limit.reached   | Fired when a project reaches its credit limit    |

Response schema:
  | Field          | Type   | Description          |
  |----------------|--------|----------------------|
  | data.id        | string | Webhook ID           |
  | data.url       | string | The registered URL   |
  | data.headers   | object | Custom headers       |
  | data.event     | string | The subscribed event |
  | data.createdAt | string | ISO 8601 date        |

Error responses:
  | Error Code                   | HTTP | Description                                    |
  |------------------------------|------|------------------------------------------------|
  | MISSING_WEBHOOK_FIELDS       | 400  | url and event are required                     |
  | INVALID_WEBHOOK_URL          | 400  | Webhook URL must use HTTPS                     |
  | INVALID_WEBHOOK_EVENT        | 400  | Event not in allowed list                      |
  | WEBHOOK_EVENT_ALREADY_EXISTS | 409  | A webhook for this event already exists        |

cURL:
  curl -X PUT \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://yourserver.com/webhook","event":"agent.prompt.finished"}' \
    https://api-accounts.totalum.app/api/v1/vcaas/webhooks

Response:
  {
    "errors": null,
    "data": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "url": "https://yourserver.com/webhook",
      "event": "agent.prompt.finished",
      "createdAt": "2026-03-17T10:00:00.000Z"
    }
  }

Webhook payload (POST to your URL when event fires):
  {
    "event": "agent.prompt.finished",
    "timestamp": "2026-03-17T10:30:00.000Z",
    "data": {
      "projectId": "my-app",
      "status": "done",
      "prompt": "Build a SaaS landing page..."
    }
  }

---

### 29. GET https://api-accounts.totalum.app/api/v1/vcaas/webhooks
**List Webhooks** — Get all your registered webhooks.
Cost: Free

Response schema:
  | Field                     | Type   | Description          |
  |---------------------------|--------|----------------------|
  | data.webhooks             | array  | Array of webhooks    |
  | data.webhooks[].id        | string | Webhook ID           |
  | data.webhooks[].url       | string | Destination URL      |
  | data.webhooks[].headers   | object | Custom headers       |
  | data.webhooks[].event     | string | Subscribed event     |
  | data.webhooks[].createdAt | string | ISO 8601 date        |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/webhooks

Response:
  {
    "errors": null,
    "data": {
      "webhooks": [
        {
          "id": "65f1a2b3c4d5e6f7a8b9c0d1",
          "url": "https://yourserver.com/webhook",
          "event": "agent.prompt.finished",
          "createdAt": "2026-03-17T10:00:00.000Z"
        }
      ]
    }
  }

---

### 30. DELETE https://api-accounts.totalum.app/api/v1/vcaas/webhooks/:webhookId
**Delete Webhook** — Remove a webhook subscription.
Cost: Free

URL parameters:
  | Field     | Type   | Required | Description         |
  |-----------|--------|----------|---------------------|
  | webhookId | string | Yes      | The webhook ID      |

Response schema:
  | Field        | Type    | Description       |
  |--------------|---------|-------------------|
  | data.success | boolean | true on success   |

Error responses:
  | Error Code        | HTTP | Description       |
  |-------------------|------|-------------------|
  | WEBHOOK_NOT_FOUND | 404  | Webhook not found |

cURL:
  curl -X DELETE -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/webhooks/65f1a2b3c4d5e6f7a8b9c0d1

Response:
  { "errors": null, "data": { "success": true } }

---

### ── GITHUB ──

### 31. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/github/connect
**Connect GitHub Repository** — Connect a GitHub repository to your project using a Fine-grained Personal Access Token (PAT). This validates permissions, stores credentials, sets up branches (develop and main), and performs the initial sync. After connecting, Totalum automatically pushes to the `develop` branch after every completed prompt, and pushes to `main` when you publish (deploy) the project.
Cost: Free

**How to create the GitHub token:**
1. Go to https://github.com/settings/personal-access-tokens
2. Click "Generate new token"
3. Select "Only select repositories" and choose your repo
4. Under "Repository permissions", set:
   - Contents: Read and Write
   - Pull requests: Read and Write
   - Administration: Read and Write
5. Click "Generate token" and copy the token (starts with `github_pat_`)

For empty repositories, Totalum creates the develop and main branches automatically. For non-empty repositories, both branches must already exist.

If the repository has existing content with no common git history, the `syncDirection` field controls what happens:
- `"totalum_to_github"` (default): Pushes the Totalum project code to GitHub, replacing the repository content on both develop and main branches.
- `"github_to_totalum"`: Pulls the GitHub repository code into Totalum, replacing the current project code. If the develop branch doesn't exist on GitHub, it is created from main.

Request body schema:
  | Field              | Type   | Required | Description                                      |
  |--------------------|--------|----------|--------------------------------------------------|
  | token              | string | Yes      | GitHub Fine-grained Personal Access Token        |
  | repositoryFullName | string | Yes      | Full repository name (e.g. "owner/repo")         |
  | syncDirection      | string | No       | "totalum_to_github" (default) or "github_to_totalum". Controls behavior when repo has existing content with no common history |

Response schema:
  | Field                 | Type    | Description                                              |
  |-----------------------|---------|----------------------------------------------------------|
  | data.connected        | boolean | true if connection was successful                        |
  | data.repositoryFullName | string | The connected repository                                |
  | data.syncAction       | string  | "push_new", "push", "pull", "merge_and_push", or "already_synced" |
  | data.repoHasContent   | boolean | Whether the repo had existing content                    |
  | data.requiresRebuild  | boolean | Whether a rebuild was triggered. If true, poll GET /github/pull-status until status is "success" or "error" |

Error responses:
  | Error Code                | HTTP | Description                                              |
  |---------------------------|------|----------------------------------------------------------|
  | MISSING_GITHUB_FIELDS     | 400  | token and repositoryFullName are required                |
  | INVALID_SYNC_DIRECTION    | 400  | syncDirection must be "totalum_to_github" or "github_to_totalum" |
  | GITHUB_VALIDATION_FAILED  | 400  | Token invalid, missing permissions, or repo not found    |
  | GITHUB_SECRET_STORE_ERROR | 400  | Failed to store GitHub credentials                       |
  | GITHUB_SYNC_FAILED        | 400  | Initial sync with GitHub failed                          |
  | AGENT_RUNNING             | 409  | Cannot connect while agent is running                    |
  | SERVER_NOT_READY          | 409  | Server auto-starting, poll until Active then retry       |

cURL:
  curl -X POST \
    -H "api-key: tlm_sk_your_key" \
    -H "Content-Type: application/json" \
    -d '{"token":"github_pat_xxx","repositoryFullName":"myuser/my-repo","syncDirection":"totalum_to_github"}' \
    https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/github/connect

Response:
  {
    "errors": null,
    "data": {
      "connected": true,
      "repositoryFullName": "myuser/my-repo",
      "syncAction": "push_new",
      "repoHasContent": false,
      "requiresRebuild": false
    }
  }

---

### 32. DELETE https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/github/connect
**Disconnect GitHub** — Remove the GitHub integration from your project. Deletes the stored token and repository credentials. Code already in your project is not affected.
Cost: Free

Response schema:
  | Field        | Type    | Description             |
  |--------------|---------|-------------------------|
  | data.success | boolean | true on success         |
  | data.message | string  | Confirmation message    |

Error responses:
  | Error Code           | HTTP | Description                          |
  |----------------------|------|--------------------------------------|
  | GITHUB_NOT_CONNECTED | 400  | GitHub is not connected to this project |

cURL:
  curl -X DELETE -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/github/connect

Response:
  { "errors": null, "data": { "success": true, "message": "GitHub disconnected successfully" } }

---

### 33. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/github/status
**Get GitHub Status** — Check whether GitHub is connected and the token is still valid.
Cost: Free

Response schema:
  | Field                    | Type    | Description                                                                                                |
  |--------------------------|---------|------------------------------------------------------------------------------------------------------------|
  | data.connected           | boolean | Whether GitHub is connected                                                                                |
  | data.tokenValid          | boolean | Whether the PAT token is still valid                                                                       |
  | data.tokenExpired        | boolean | True when the last linked PAT was detected as expired/revoked. Sticky until the user reconnects. Use this to prompt the user to reconnect |
  | data.repositoryFullName  | string  | Connected repository, or last-known repo when tokenExpired is true                                         |
  | data.developBranch       | string  | "develop" (only if connected)                                                                              |
  | data.productionBranch    | string  | "main" (only if connected)                                                                                 |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/github/status

Response (connected):
  {
    "errors": null,
    "data": {
      "connected": true,
      "tokenValid": true,
      "tokenExpired": false,
      "repositoryFullName": "myuser/my-repo",
      "developBranch": "develop",
      "productionBranch": "main"
    }
  }

Response (token expired — secrets were auto-deleted, ask user to reconnect):
  {
    "errors": null,
    "data": {
      "connected": false,
      "tokenValid": false,
      "tokenExpired": true,
      "repositoryFullName": "myuser/my-repo"
    }
  }

---

### 34. POST https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/github/pull
**Pull from GitHub** — Pull the latest changes from the GitHub develop branch into your project. If files changed, the server rebuilds automatically in the background. Poll the pull status endpoint until complete. This is an async operation.
Cost: Free

Response schema:
  | Field             | Type   | Description                                       |
  |-------------------|--------|---------------------------------------------------|
  | data.status       | string | "pulling" (async rebuild started) or "no_changes" |
  | data.message      | string | Status message                                    |
  | data.filesUpdated | number | Number of files updated                           |

Error responses:
  | Error Code           | HTTP | Description                                  |
  |----------------------|------|----------------------------------------------|
  | GITHUB_NOT_CONNECTED | 400  | GitHub is not connected (connect first)      |
  | GITHUB_PULL_ERROR    | 400  | Failed to pull changes                       |
  | AGENT_RUNNING        | 409  | Cannot pull while agent is running           |
  | SERVER_NOT_READY     | 409  | Server auto-starting, poll until Active      |

cURL:
  curl -X POST -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/github/pull

Response:
  {
    "errors": null,
    "data": {
      "status": "pulling",
      "message": "Pull started successfully",
      "filesUpdated": 5
    }
  }

---

### 35. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/github/pull-status
**Get Pull Status** — Poll this endpoint after calling Pull from GitHub, OR after a Connect GitHub call that returned `requiresRebuild: true` (e.g. `github_to_totalum` direction). Returns the current rebuild status. Auto-completes after 5 minutes.
Cost: Free

Response schema:
  | Field          | Type   | Description                                         |
  |----------------|--------|-----------------------------------------------------|
  | data.status    | string | "pulling", "success", "error", or null (no pull)    |
  | data.createdAt | string | ISO 8601 date when the pull started                 |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/github/pull-status

Response:
  { "errors": null, "data": { "status": "success", "createdAt": "2026-03-17T10:00:00.000Z" } }

---

### 36. GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId/github/env
**Download Environment Variables** — Get the project's environment variables as .env file content for both development and production environments. Use this to set up a local development environment or configure production deployments.
Cost: Free

Response schema:
  | Field        | Type   | Description                                                    |
  |--------------|--------|----------------------------------------------------------------|
  | data.envDev  | string | .env file content for development (KEY=VALUE format, one per line) |
  | data.envProd | string | .env file content for production (KEY=VALUE format, one per line)  |

Error responses:
  | Error Code         | HTTP | Description                          |
  |--------------------|------|--------------------------------------|
  | ENV_DOWNLOAD_ERROR | 400  | Failed to get environment variables  |

cURL:
  curl -H "api-key: tlm_sk_your_key" https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/github/env

Response:
  {
    "errors": null,
    "data": {
      "envDev": "NODE_ENV=development\nTOTALUM_API_KEY=xxx\nNEXT_PUBLIC_APP_URL=http://localhost:3000\n...",
      "envProd": "NODE_ENV=production\nTOTALUM_API_KEY=xxx\nNEXT_PUBLIC_APP_URL=https://my-app.totalum.app\n..."
    }
  }

---

## Global Error Codes Reference
All errors follow: { "errors": { "errorCode": "CODE", "errorMessage": "..." }, "data": null }

| Code                        | HTTP | Meaning                                              |
|-----------------------------|------|------------------------------------------------------|
| INSUFFICIENT_CREDITS        | 402  | Not enough credits for this operation                |
| PROJECT_CREDIT_LIMIT_REACHED| 403  | Project monthly credit limit reached for that category |
| PROJECT_NOT_ALLOWED         | 403  | API key doesn't have access to this project          |
| PROJECT_NOT_FOUND           | 404  | Project doesn't exist or you don't own it            |
| AGENT_RUNNING               | 409  | Agent already running on this project                |
| DEPLOYMENT_RUNNING          | 409  | A deployment is in progress                          |
| RECOVERY_RUNNING            | 409  | A version recovery is in progress                    |
| SERVER_NOT_READY            | 409  | Server auto-starting, poll until Active              |
| NO_DEPLOYMENT               | 404  | No deployment found. Deploy first and wait until status is "success" |
| MISSING_PROMPT              | 400  | prompt field is required                             |
| MISSING_PROJECT_ID          | 400  | projectId field is required                          |
| INVALID_PROJECT_NAME        | 400  | Invalid projectId format                             |
| INVALID_PROJECT_NAME_LENGTH | 400  | Project name must be 4-35 characters                 |
| PROJECT_ALREADY_EXISTS      | 409  | A project with this ID already exists                |
| PLAN_NOT_API                | 400  | Only API plan projects can be deleted                |
| PROMPT_SECURITY_VIOLATION   | 400  | Prompt failed security validation                    |
| NO_PROCESS_RUNNING          | 400  | No agent process is currently running                |
| MISSING_FILE                | 400  | file field is required (multipart)                   |
| UPLOAD_FAILED               | 500  | File upload failed                                   |
| MISSING_VERSION_ID          | 400  | versionId is required                                |
| MISSING_SECRET_FIELDS       | 400  | secretName and secretValue are required              |
| INVALID_SECRET_KEY_NAME     | 400  | Invalid secret key name format                       |
| MISSING_SECRET_ID           | 400  | secretId is required                                 |
| MISSING_HOSTNAME            | 400  | hostname is required                                 |
| MISSING_TABLE_NAME          | 400  | tableName is required                                |
| GET_ACCOUNT_ERROR           | 400  | Internal error fetching account info                 |
| LIST_PROJECTS_ERROR         | 400  | Internal error listing projects                      |
| RATE_LIMIT_EXCEEDED         | 429  | Too many requests (max 10 project creations per 60s) |
| MISSING_WEBHOOK_FIELDS       | 400  | url and event are required                     |
| INVALID_WEBHOOK_URL          | 400  | Webhook URL must use HTTPS                     |
| INVALID_WEBHOOK_EVENT        | 400  | Event not in allowed list                      |
| WEBHOOK_EVENT_ALREADY_EXISTS | 409  | A webhook for this event already exists        |
| WEBHOOK_NOT_FOUND            | 404  | Webhook not found                              |
| MISSING_GITHUB_FIELDS        | 400  | token and repositoryFullName are required      |
| GITHUB_VALIDATION_FAILED     | 400  | Token invalid, missing permissions, or repo not found |
| GITHUB_SECRET_STORE_ERROR    | 400  | Failed to store GitHub credentials             |
| GITHUB_SYNC_FAILED           | 400  | Initial sync with GitHub failed                |
| GITHUB_NOT_CONNECTED         | 400  | GitHub is not connected to this project        |
| GITHUB_PULL_ERROR            | 400  | Failed to pull changes from GitHub             |
| MISSING_LIMIT_FIELDS         | 400  | At least one credit limit field is required    |
| INVALID_LIMIT                | 400  | Credit limit must be a positive number         |
| INVALID_SYNC_DIRECTION       | 400  | syncDirection must be "totalum_to_github" or "github_to_totalum" |

## Built-in Integrations

Your projects include pre-built integrations ready to use. Just mention them in the agent prompt — no API keys or extra setup needed. You can also use any API or npm package simply by mentioning it in your prompt.

**No API key required:**
- Email delivery — send transactional and notification emails (with generic domain)
- PDF generation — generate PDFs from any HTML content
- AI image generation & editing — generate and edit images with AI
- ChatGPT usage — use ChatGPT capabilities in your app
- Complete authentication — full auth system with login, register & sessions
- Document scanning — scan and extract data from PDFs and images
- Speech to text — transcribe audio files to text with OpenAI Whisper (formats: mp3, mp4, m4a, wav, webm, ogg, opus, flac; max 5 MB)
- Video analysis — describe, summarize or extract structured data from videos using Google Gemini (native video input via URL, max 100 MB; supports highQuality mode for harder reasoning)
- Web scraping — scrape pages (raw HTML / markdown / text), extract structured data with AI, and take screenshots — no third-party API key needed
- Database — full managed database with tables, relations & queries, no setup needed
- Deployment & hosting — one-click deploy to production with global CDN hosting
- Custom domain — connect your own domain with automatic SSL certificate
- File storage — upload and serve files with signed URLs (images, documents & more)
- Backend logs access — the agent can read your project's backend logs to debug errors autonomously

**Requires user API key (add as a project secret):**
- Stripe — payments, subscriptions & billing
- Email with custom domain — send emails from your own domain (we recommend Resend as provider). Add your Resend API key as a project secret

**Any API or npm package:**
You can also use any API or npm package simply by mentioning it in your prompt. If the integration requires an API key you haven't provided, the agent will notify you via the `secretKeysNeeded` field in the conversation response. Add the key as a project secret and run the agent again.

## Concurrency Rules
- Only one heavy operation at a time per project: agent, deployment, version recovery, or server start.
- If deploy or recover is called and the server is not active, it auto-starts (charges 3 credits) and returns SERVER_NOT_READY error. Poll GET https://api-accounts.totalum.app/api/v1/vcaas/projects/:projectId until agentServerStatus is "Active", then retry.
- Agent start IS allowed during server operations (the backend waits internally).

## Complete Integration Flow

1. ENSURE PROJECT EXISTS
   Your backend checks if the user already has a project. If not, create one via the API.
   POST https://api-accounts.totalum.app/api/v1/vcaas/projects
   Body: { "projectId": "my-app" }

2. SEND PROMPT TO AI AGENT
   Your backend sends the user's prompt. The agent starts generating the project asynchronously. This takes 6-15 minutes.
   POST https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/start
   Body: { "prompt": "Build a SaaS landing page" }

3. POLL AGENT STATUS (every 10-15 seconds)
   Your frontend periodically asks your backend, which checks the API. Display realtimeConversation messages to the user in real time.
   GET https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/agent/status
   → When status is "init": agent is working. Show realtimeConversation messages to user.
   → When status is "done": agent finished. creditsSpent shows total cost.
   Poll every few seconds until status is "done".
   → When status becomes "done": immediately call GET /projects/:projectId and refresh the preview URL (see step 3.1).

3.1. REFRESH PREVIEW URL (on page load, on page refresh, and after every prompt finishes)
   Every time the user enters the project page, refreshes the page, or a prompt finishes, call:
   GET https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app
   Read `developmentUrlFieldToUse` to decide which URL to show:
   → If developmentUrlFieldToUse is "cachedDevelopmentUrl": use `cachedDevelopmentUrl` (static snapshot while server is archived).
   → If developmentUrlFieldToUse is "temporalDevelopmentProjectUrl": use `temporalDevelopmentProjectUrl` (live dev server).
   → If developmentUrlFieldToUse is null or undefined: default to `temporalDevelopmentProjectUrl`.
   Use this URL as the iframe src or preview link. Always reload the iframe when the URL changes.

4. PUBLISH THE PROJECT
   Once generation completes, your backend starts the deploy process. This builds, deploys, and assigns a public URL. Takes 1-3 minutes.
   POST https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/deployments/deploy

5. POLL DEPLOYMENT STATUS (every 10-15 seconds)
   Your frontend polls your backend for deploy status. Once complete, the productionProjectUrl from GET /projects/:projectId is the public URL.
   GET https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/deployments/status
   → When status is "success": done.
   → Get the public URL from: GET https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app → productionProjectUrl

6. (OPTIONAL) CUSTOM DOMAIN
   After publishing, users can attach a custom domain. The API returns DNS records the user must configure. Check domain status until active.
   PUT https://api-accounts.totalum.app/api/v1/vcaas/projects/my-app/domain
   Body: { "hostname": "app.yourdomain.com" }
   → Configure DNS records from response.
   → Check domain status in GET /projects/:projectId customDomain field until status is "active".

## Key Integration Principles
- Agent and deployment are ASYNCHRONOUS — always poll for status.
- Show real-time agent conversation messages during generation.
- NEVER call the Totalum API from frontend code — always through your backend server.
- ALWAYS refresh the development preview URL (via GET /projects/:projectId) on page load, page refresh, and after each prompt finishes. Use `developmentUrlFieldToUse` to pick the right URL; default to `temporalDevelopmentProjectUrl` if null/undefined.
- On de development preview, not show the production URL, display a open blank link that user can access to. In that way, user always see the development realtime preview, not the production version, that may be not updated until the user not publish it.
- Keep the API key secret — it must never leave your backend server.

## Requirements
- Sufficient credit balance required for each operation.
- Credits are consumed per operation (see credit costs table above).
- Two credit categories: development (AI agent, deploys, server ops) and infrastructure (ChatGPT, images, emails, PDFs, scans, scraping, file uploads when plan limits exceeded).
- You can set monthly spending limits per project using the Credit Limits endpoint.
- Use the Spending Analytics endpoint to monitor credit usage across projects and categories.
- Low-credit email alerts are sent automatically when your balance drops below 100 or reaches 1. Alerts are sent once and reset when you purchase more credits.
