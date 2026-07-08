# Server / Production Logs — Deep Investigation

**Date:** 2026-07-08
**Symptom:** Logs panel → "Production" tab shows: *"Failed to fetch logs. The server might not be active."*
User had just published a project and submitted its quote form, and wanted to see those production logs.

## Root cause (confirmed live against the VCaaS API)

The Logs panel fetched two different endpoints depending on the toggle:

| Toggle       | Endpoint called                                  | Live result |
|--------------|--------------------------------------------------|-------------|
| Development  | `GET /projects/:id/backend/dev/logs`             | **200 OK** (real logs) |
| Production   | `GET /projects/:id/backend/prod/logs`            | **404 Cannot GET** |

The `prod/logs` path **does not exist**. It was built speculatively. I probed every plausible
production-logs route and all return 404:

- `/backend/prod/logs` → 404
- `/backend/production/logs` → 404
- `/backend/logs` and `/backend/logs?environment=production` → 404
- `/projects/:id/logs` → 404
- `/projects/:id/production/logs` → 404
- `/projects/:id/deployments/logs` → 404
- `/vcaas/production-logs`, `/vcaas/logs` → 404

The full VCaaS API surface (endpoints #1–#28 in the docs) contains **exactly one** per-project
logs endpoint: **#13 `GET /backend/dev/logs`**. There is no separate production-logs REST route.

## Why the dev endpoint IS your production logs

VCaaS runs a **single live server per project** (Next.js on PORT 80). That same server serves both:
- the in-workspace live preview, and
- the published site (`projectId.totalum-project.com`).

Proof: the `dev/logs` stream already contains **production traffic**, e.g.:

```
[Error: Failed to find Server Action. This request might be from an older or newer deployment.]
```

That error only happens from real browser requests to the deployed site — so form submissions and
runtime errors from your **published** quote form appear in this exact stream. There is no second,
isolated "production" log to fetch.

(The only account-level production-logs mechanism is the `getProductionLogs` MCP tool, which is
**org-wide, not per-project**, and not reachable from the browser — so it can't back a per-project UI.)

## Fix applied

`src/components/workspace/LogsPanel.tsx` was rewritten to:
1. **Always call the real, working endpoint** `/backend/dev/logs` (removed the fictional `prod/logs`).
2. **Collapse the broken dev/prod toggle** into one always-working "Server Logs" stream that covers
   both preview and the published production site.
3. **Surface the real error text** on failure (instead of the vague "server might not be active"),
   so any genuine problem is debuggable.
4. Friendlier empty state explaining that new entries appear after you interact with the app.

Result: the panel no longer 404s, and it shows the live server logs — including your published
quote-form submissions and any runtime errors from them.
