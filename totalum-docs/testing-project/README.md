# Testing Project

## Pre-load Tools (MANDATORY FIRST STEP)

Before anything else, load ALL required tools in a single ToolSearch call:
```
select:Read,Bash,Glob,mcp__totalum__query,mcp__totalum__editRecordProperties,mcp__playwright__browser_run_code,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_console_messages,mcp__playwright__browser_close,mcp__playwright__browser_resize
```

---

## Test User Selection Policy

**If the user does NOT specify a particular user to test with**, and a real user is not required for the test scenario, **always prefer using an existing test user or registering a new one**:

1. **Check for cached test cookies first** — look in `.playwright-mcp/cookie/` for any `test.project-name.*` directories with valid cookies.
2. **If a valid cached test cookie exists** — reuse that test user (fastest path).
3. **If no cached test cookie** — **register a new test user** via the `/register` page (see `login-register.md`). This avoids touching real user accounts.
4. **Only use a real/specific user** when the user explicitly asks for it or the test scenario requires a specific account with existing data.

**Test user naming convention:** `test.project-name.<random6>@testmail.com` with a random password `Test<random6>1` (e.g., `test.project-name.f7p3nn@testmail.com` / `Testf7p3nn1`).

---

## Flow Overview

### Step 1: Setup (always required)
Read **`setup.md`** — kill zombies, check env, discover routes, smart build, start server.

### Step 2: Login/Register (only if the feature requires authentication)
Read **`login-register.md`** — choose between cached cookie, new registration, or existing user login. **Skip this entirely if testing public pages or features that don't need auth.**

### Step 2.5: Review source code (IMPORTANT — do this before testing)
Before running any tests, **read the source code of the pages/features you are about to test** (e.g., `src/app/(routes)/dashboard/page.tsx`, relevant components, API routes). This gives you better context about selectors, expected behavior, and UI structure, leading to more accurate and reliable tests.

### Step 3: Testing (always required)
Read **`testing.md`** — route selection, browser_run_code calls, interactive tests, console errors, cleanup.

---

## Quick Reference

| Doc | When to read | Content |
|-----|-------------|---------|
| `setup.md` | Always | Kill ports, env check, route discovery, build, start server |
| `testing-url-setup.md` | Only needed if source code doesn't have the `LOCAL_NEXTJS_PROJECT_TESTING_URL` support |
| `login-register.md` | Only if auth needed | Cookie cache, registration flow, login flow, cookie saving |
| `testing.md` | Always | Route tiers, Call 1/2 templates, console errors, cleanup |
