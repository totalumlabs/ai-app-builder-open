---
name: project-recovery
description: "When a project is not on Next.js, missing essential files or lacks Cloudflare Workers configuration, or is missing basic Totalum integration. This skill provides complete file contents and patterns to recover it. Only use this when user request it or for detect what is missing if project is not on nextjs or the cloudflare docs are missing"
---

# Project Recovery Skill

Use this skill when you need to **recover a broken project**, **migrate to Next.js**, or **add missing essential configuration** for a Totalum + Cloudflare deployment.

## When to Use This Skill

- Project is **not on Next.js** and needs to be migrated
- Project is **missing essential config files** (package.json, tsconfig.json, next.config.ts)
- Project **lacks Cloudflare Workers configuration** (open-next.config.ts, wrangler.jsonc, also check the package.json as having the right scripts)
- Project is **missing Totalum SDK integration** (lib/totalum.ts)
- Project is **missing authentication setup** (better-auth-totalum-adapter.ts)
- Project is **missing logging utilities** (backend-logger.ts, console-logger.ts)
- Project has **broken imports or configuration** that needs to be reset

## Quick Reference by Recovery Task

| Task | Files to Check/Create | Documentation |
|------|----------------------|---------------|
| Missing core config | package.json, tsconfig.json | [01-essential-files.md](./01-essential-files.md) |
| Missing Next.js setup | next.config.ts, middleware.ts | [02-nextjs-config.md](./02-nextjs-config.md) |
| Cloudflare deployment broken | open-next.config.ts, instrumentation.ts, wrangler.jsonc | [03-cloudflare-deployment.md](./03-cloudflare-deployment.md) |
| Totalum SDK not working | lib/totalum.ts, better-auth-totalum-adapter.ts, auth.ts | [04-totalum-integration.md](./04-totalum-integration.md) |
| Missing logging | lib/backend-logger.ts, lib/console-logger.ts | [05-logging-utilities.md](./05-logging-utilities.md) |
| Project structure wrong | Folder layout and patterns | [06-project-structure.md](./06-project-structure.md) |

## Recovery Workflow

### Step 1: Diagnose the Problem

Check which essential files exist and has the right content:

```bash
# Check for core config files
ls -la package.json tsconfig.json next.config.ts

# Check for Cloudflare config
ls -la open-next.config.ts instrumentation.ts wrangler.jsonc

# Check for Totalum integration
ls -la src/lib/totalum.ts src/lib/better-auth-totalum-adapter.ts

# Check for logging
ls -la src/lib/backend-logger.ts src/lib/console-logger.ts
```

### Step 2: Identify Missing Components

| If Missing | Priority | Action |
|------------|----------|--------|
| package.json | CRITICAL | Create immediately - project won't run |
| tsconfig.json | CRITICAL | Create immediately - TypeScript won't compile |
| next.config.ts | HIGH | Create for proper headers and CSP |
| open-next.config.ts | HIGH | Required for Cloudflare deployment |
| instrumentation.ts | MEDIUM | Required for logging in production |
| lib/totalum.ts | HIGH | Required for database access |
| better-auth-totalum-adapter.ts | HIGH | Required if using authentication |
| logging files | MEDIUM | Recommended for debugging |

### Step 3: Apply Recovery Files

Follow the modular documentation files in order:

1. **[01-essential-files.md](./01-essential-files.md)** - Start here for package.json and tsconfig.json
2. **[02-nextjs-config.md](./02-nextjs-config.md)** - Configure Next.js properly
3. **[03-cloudflare-deployment.md](./03-cloudflare-deployment.md)** - Set up Cloudflare Workers
4. **[04-totalum-integration.md](./04-totalum-integration.md)** - Connect to Totalum
5. **[05-logging-utilities.md](./05-logging-utilities.md)** - Add logging utilities
6. **[06-project-structure.md](./06-project-structure.md)** - Verify folder structure

### Step 4: Verify Recovery

```bash
# Install dependencies
npm install

# Check for TypeScript errors
npm run check-types-errors

# Build the project
npm run build

```

## Critical Rules

1. **ALWAYS check if file exists** before creating - don't overwrite customizations
2. **PRESERVE existing environment variables** - copy them to new config
3. **MATCH the existing code style** if partial recovery


## Common Recovery Scenarios

### Scenario A: Project is not on Next.js

Check all project recovery files and migrate all project to Next.js, following the documentation files in order from 01 to 06.

### Scenario B: Project Missing Cloudflare Config

Add missing Cloudflare configuration files from documentation file 03, ensuring open-next.config.ts and wrangler.jsonc are properly set up.



## Files Overview

| File | Size | Purpose |
|------|------|---------|
| 01-essential-files.md | Core | package.json, tsconfig.json |
| 02-nextjs-config.md | Core | next.config.ts, middleware.ts |
| 03-cloudflare-deployment.md | Deployment | open-next.config.ts, instrumentation.ts, wrangler |
| 04-totalum-integration.md | Integration | totalum.ts, auth adapter, auth.ts, auth-client.ts |
| 05-logging-utilities.md | Utilities | backend-logger.ts, console-logger.ts |
| 06-project-structure.md | Reference | Complete folder structure template |
