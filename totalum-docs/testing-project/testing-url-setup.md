# Testing URL Setup

In testing mode, the platform sets `LOCAL_NEXTJS_PROJECT_TESTING_URL=http://localhost:3000` in `.env`. The test server is started with `npm run test:serve`, which sets `TESTING_MODE=true`. Only when both are present does the project use the testing URL instead of `NEXT_PUBLIC_APP_URL`.

Older projects may not support this. Without it, auth CORS checks reject `localhost`, cookies require HTTPS (`__Secure-` prefix, `secure: true`), and browser-based login/registration fails during testing.

---

## Quick check

Run in parallel:
```bash
grep -c 'TESTING_MODE' src/lib/auth.ts 2>/dev/null || echo "0"
```
```bash
grep -c 'window.location.origin' src/lib/auth-client.ts 2>/dev/null || echo "0"
```
```bash
grep -c 'TESTING_MODE' package.json 2>/dev/null || echo "0"
```

- **All return ≥ 1** → skip this doc, project is ready.
- **Any returns 0** → apply the patches below, then **delete `.next/` to force a rebuild** (cookie config is evaluated at server start, and auth-client baseURL is baked at build time).

---

## Patch 0: `package.json` — add TESTING_MODE flag to test:serve

Find:
```json
"test:serve": "NEXT_TELEMETRY_DISABLED=1 DISABLE_OPENNEXT=true PORT=3000 next start"
```

Replace with:
```json
"test:serve": "TESTING_MODE=true NEXT_TELEMETRY_DISABLED=1 DISABLE_OPENNEXT=true PORT=3000 next start"
```

If `test:serve` script doesn't exist at all, add it with the full line above.

This ensures `TESTING_MODE=true` is only set when running the test server, never in production.

---

## Patch 1: `src/lib/auth.ts` — testing URL support

**Add after the imports** (after the last `import` line, before `export const auth = betterAuth`):

```typescript
// TESTING_MODE is set only by the test:serve script (npm run test:serve).
// When active, use LOCAL_NEXTJS_PROJECT_TESTING_URL so that CORS, baseURL,
// and cookie security all work correctly on localhost.
const effectiveUrl =
  process.env.TESTING_MODE === "true"
    ? (process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || "http://localhost:3000")
    : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
```

**Then apply these replacements in the same file:**

### 1a. `baseURL`

Find:
```typescript
baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
```
Replace with:
```typescript
baseURL: effectiveUrl,
```

### 1b. `trustedOrigins`

The format varies across projects. Apply the fix that matches:

**If `trustedOrigins` is a function** — add this block right after the `NEXT_PUBLIC_APP_URL` origin check:
```typescript
    // Trust testing URL (only when server is started via npm run test:serve)
    if (process.env.TESTING_MODE === "true" && process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL && origin === new URL(process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL).origin) {
      return [origin];
    }
```

**If `trustedOrigins` is an array** — add to the array:
```typescript
...(process.env.TESTING_MODE === "true" ? [process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || ""] : []),
```

### 1c. Cookie security (`advanced` section)

Find the line that determines HTTPS (it varies):
```typescript
// Could be any of these patterns:
secure: process.env.NODE_ENV === "production",
// or:
const isHttps = (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");
// or:
useSecureCookies: process.env.NODE_ENV === "production",
```

Replace the HTTPS determination with:
```typescript
const isHttps = effectiveUrl.startsWith("https://");
```

Then ensure all cookie attributes use this value:
- `secure: isHttps`
- `sameSite: isHttps ? "none" as const : "lax" as const`
- `useSecureCookies: isHttps`

---

## Patch 2: `src/lib/auth-client.ts` — dynamic browser origin

Find:
```typescript
baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
```

Replace with:
```typescript
baseURL:
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
```

Also ensure `fetchOptions` includes credentials:
```typescript
fetchOptions: {
  credentials: "include",
},
```

---

## After patching

Delete the build cache so the changes take effect:
```bash
rm -rf .next
```
The smart build in step 2 will rebuild automatically.
