---
name: nextjs-project
description: "Next.js project patterns, TypeScript rules, build commands, and project structure. Use when setting up pages, API routes, fixing build errors, or following project conventions. Activates for TypeScript type safety, runtime compatibility, and project-wide rules."
---

# Next.js Project Skill

Use this skill for project-wide patterns, TypeScript rules, and build processes.

## When to Use This Skill

- Understanding project structure
- Fixing TypeScript/build errors
- Creating API routes
- Setting up new pages
- Understanding project conventions
- Debugging issues

---

## Critical Runtime Rules

### File Display — ALWAYS use the `url` field

When Totalum returns a record with a file field, it includes `{ name, url }`. Always use `url`:

```typescript
// CORRECT
<img src={record.photo.url} alt="Photo" />

// WRONG — never construct URLs from file name
<img src={`https://storage.example.com/${record.photo.name}`} />
```

### Auth Session — User ID is `id`, NOT `_id`

The Better Auth adapter converts Totalum's `_id` to `id`. Always use `session.user.id`:

```typescript
// CORRECT
const userId = session.user.id;

// WRONG — _id does not exist on session user
const userId = session.user._id; // undefined!
```

But for all other tables and API calls, use `_id` as the identifier field.

---

## Critical TypeScript Rule

### ALWAYS Type Cast `response.json()`

**BUILD WILL FAIL without proper typing!**

```typescript
// WRONG (causes build error)
const data = await response.json();
if (data.ok) { // Property 'ok' does not exist on type 'unknown'

// CORRECT
const data = (await response.json()) as { ok: boolean; data?: any; error?: any };
if (data.ok) { // Works!
```

**Applies to:**
- ALL `fetch()` calls followed by `.json()`
- ALL API responses parsed in client components
- ANY JSON from external sources

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main landing page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles + CSS variables
│   └── api/                  # API routes
│       └── example/
│           └── route.ts
├── components/
│   ├── ui/                   # shadcn/ui components
├── lib/
│   ├── api.ts                # Client fetch service (api.get/post/put/delete)
│   ├── totalum.ts            # TotalumSDK singleton
│   ├── auth.ts               # Better Auth config
│   ├── auth-client.ts        # Auth client hooks
│   └── utils.ts              # Utilities (cn, etc.)
├── middleware.ts             # Route protection
└── types/                    # TypeScript interfaces
assets/
└── files.ts                  # All static assets (images, logos)
docs/
└── design-system/
    └── DESIGN_SYSTEM.md      # Design system config
```

---

## Commands

### Testing Changes (MANDATORY)
```bash
# Step 1: Check type errors
npm run check-types-errors

# Step 2: Full build test
npm run build
```

**NEVER use:**
- `npm run dev`
- `next build`
- Adding `2>&1` or `head -300` to commands

### View Logs When Debugging
```
Backend: npm-start.log
Frontend: frontend.log
```

---

## API Route Pattern

```typescript
// src/app/api/example/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { totalumSdk } from "@/lib/totalum";

function serializeError(err: unknown) {
  const e = err as any;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    status: e?.response?.status ?? null,
    responseData: e?.response?.data ?? null,
    stack: e?.stack ?? null,
  };
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await totalumSdk.crud.createRecord("table_name", {
      name: parsed.data.name,
      email: parsed.data.email,
    });

    console.log("[API] Created:", result.data?._id);
    return NextResponse.json({ ok: true, data: result.data });

  } catch (err) {
    console.error("[API ERROR] /api/example", err);
    return NextResponse.json(
      { ok: false, error: serializeError(err) },
      { status: 500 }
    );
  }
}
```

---

## API Response Convention

**ALL API routes MUST return this standardized envelope:**

```typescript
// Success
{ ok: true, data: <payload> }

// Error
{ ok: false, error: { message: string, ... } }
```

| Scenario | `data` shape | Example |
|----------|-------------|---------|
| Single record | `object` | `{ ok: true, data: { id: "1", name: "Foo" } }` |
| List | `array` | `{ ok: true, data: [{ id: "1" }, { id: "2" }] }` |
| Paginated list | `array` + `total` | `{ ok: true, data: [...], total: 42 }` |
| Action result | `object` | `{ ok: true, data: { url: "https://..." } }` |

**NEVER** use named top-level keys like `products`, `sessionId`, `url` alongside `ok`. Always nest inside `data`.

---

## Client Fetch Service

All client components **MUST** use the typed fetch helpers from `src/lib/api.ts` instead of raw `fetch()`:

```typescript
import { api } from "@/lib/api";

// GET
const res = await api.get<Product[]>("/api/products");
if (res.ok) console.log(res.data); // Product[]

// POST
const res = await api.post<{ url: string }>("/api/checkout", { priceId });
if (res.ok) window.location.href = res.data.url;
```

| Method | Usage |
|--------|-------|
| `api.get<T>(url)` | `GET` request |
| `api.post<T>(url, body)` | `POST` with JSON body |
| `api.put<T>(url, body)` | `PUT` with JSON body |
| `api.delete<T>(url)` | `DELETE` request |

All methods return `ApiResponse<T>` with `{ ok, data?, total?, error? }`.

### REST URL Conventions

| Operation | Method | URL pattern |
|-----------|--------|-------------|
| List | GET | `/api/<resource>` |
| Get one | GET | `/api/<resource>/[id]` |
| Create | POST | `/api/<resource>` |
| Update | PUT | `/api/<resource>/[id]` |
| Delete | DELETE | `/api/<resource>/[id]` |
| Action | POST | `/api/<resource>/<action>` |

---

## Page Creation Rules

### Main Page: `src/app/page.tsx`
- Default content goes here
- Use sections with IDs for smooth scrolling

### Creating New Pages
**CRITICAL:** Update middleware for public access!

1. Create page: `src/app/new-page/page.tsx`
2. **Immediately** update `src/middleware.ts`:
```typescript
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/new-page",  // ADD HERE
];
```

**Failure to update = Users redirected to login!**

---

## Component Rules

### Server Components (Default)
- No `"use client"` directive
- Can use async/await directly
- Good for SEO-important content
- Cannot use React hooks or event handlers

### Client Components
```typescript
"use client";
// Required for:
// - onClick, onChange, onSubmit handlers
// - useState, useEffect, any React hooks
// - Browser APIs (window, document, localStorage)
```

**Must be client components:**
- Header.tsx
- Footer.tsx (if interactive)
- Forms, Modals, Carousels, Tabs

---

## Runtime Compatibility

### Cloudflare Workers Rules
- **NEVER** add `export const runtime = "edge"`
- Maintain Node-compat runtime for OpenNext
- **NEVER** modify cloudflare/wrangler files
- Storage APIs not supported (no fs, ps libraries)

### Environment Variables
- Store in `.env` file
- Access with `process.env.VAR_NAME`

---

## Asset Management

### Static Files: `assets/files.ts`
```typescript
export const ASSETS = {
  logo: { url: "https://..." },
  heroImage: { url: "https://..." },
};
```

### Using Assets
```typescript
import { ASSETS } from "@/assets/files";

<img src={ASSETS.logo.url} alt="Logo" />
```

---

## Debugging

### Add Console Logs
```typescript
console.log("[ComponentName] Action:", data);
console.error("[API ERROR] /api/route:", err);
```

### Check Logs
- Backend issues: Read `npm-start.log`
- Frontend issues: Read `frontend.log`

### Common Errors

**"Property 'x' does not exist on type 'unknown'"**
→ Add type cast: `as { x: type }`

**"table name 'X' doesn't exist"**
→ Convert to snake_case, verify with `getAllDatabaseTables()`

**Page redirects to login unexpectedly**
→ Add route to `publicRoutes` in middleware.ts

---

## Best Practices

### Code Quality
- [ ] Use TypeScript interfaces for all data
- [ ] Add console.logs for debugging
- [ ] Wrap SDK calls in try-catch
- [ ] Use snake_case for database fields
- [ ] Use Zod for input validation

### Avoid
- [ ] Don't over-engineer solutions
- [ ] Don't add features not requested
- [ ] Don't create unnecessary files
- [ ] Don't use Next.js Image component
- [ ] Don't run npm run dev

### NPM Packages
- Use context7 MCP to search documentation
- External libraries OK for complex features (charts, calendars, etc.)
- Request API keys if library needs one

---

## Admin Panel Policy

When user asks for admin panel:
> "You can manage all data in the 'data' section of the Totalum platform. Would you still like a custom admin panel?"

Only create if user explicitly insists.

---

## Deployment

Deployment is automatic via Totalum platform.

If asked:
> "Click the deploy button on Totalum platform. For local development or other platforms, download the source code from the Code section."
