Totalum SDK Integration Guide

Totalum Sdk interact with totalum database for do all posible operations (CRUD, Filter, upload file, mongodb query aggregation filters, etc...)

# SUPER IMPORTANT NOTES TO FOLLOW

- Before start writing totalum sdk code, use totalum mcp for get all database tables structure
- Follow strict naming conventions for all table and fields names (lowercase_with_underscores (snake_case), MUST FOLLOW)
- Always use totalumSdk initialized on src/lib/totalum.ts — server-only SDK client singleton
- If the change requires to add/modify the database, first use the Totalum MCP for do the changes, see ../totalum-mcp/TOTALUM_MCP_DOCS.md
- If you need to fetch data, see the `01-getting-data.md` file.
- If you need to do advanced queries (sum, average, aggregations, joins, etc.), see `07-advanced-queries.md` file.
- If you need to create data see `02-creating-data.md` file.
- If you need to edit data see `03-updating-data.md` file.
- If you need to delete data see `04-deleting-data.md` file.
- If you need to upload files see the `06-file-uploads.md` file.
- If you need to generate PDFs see the `08-generate-custom-pdfs.md` file.
- If you need to use an AI for text generation see the `09-use-openai-chatgpt-api.md` file.
- If you need to send emails see the `10-send-emails.md` file.
- If you need to scan/extract data powered by AI from images or PDFs see the `11-scan-images-and-pdfs.md` file.
- After finish writing totalum sdk code, if you used totalum mcp for modify the database, use totalum mcp to get all database structure, and then create/edit the database interfaces accordingly.




If an API/SDK call fails with "table name 'X' doesn't exist" → regenerate X to snake_case, recheck structures, and retry with the canonical ID.

Helper (you can generate this in src/lib/ids.ts and reuse):

export function toSnakeId(input: string) {
  return input.trim().toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

1. Hard rules

SDK only at runtime. Do not call raw HTTP API from app code. Use the Totalum SDK exclusively.

Never expose secrets. TOTALUM_API_KEY is server-only (Route Handlers / Server Actions / src/lib utilities). No client imports of the SDK.


2. Minimal files this template provides (Claude must use them)

src/lib/totalum.ts — server-only SDK client singleton


Import totalum only inside server code (e.g. src/app/api/**/route.ts).
If you need to transform user-provided names:

import { toSnakeId } from "@/lib/ids"; // generate if missing

3. Super mandatory: ALL TOTALUM SDK METHODS RETURN AN JSON WITH EXACTLY THIS FORMAT, NO MORE, NO LESS:

```javascript
{
    data: dependsOnEndpoint; // the content depends on the endpoint called, check the docs for each endpoint
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful to log it for debugging
        errorCode: string,
        errorMessage: string
    },
    metadata?: any; // usually this is no used at all, but in some special methods it can contain extra info
}
```

## When to use the Totalum MCP (modeling)

If a feature implies new/change types, properties, relations (e.g., "add a contact form and show submissions"), Claude must:

Deep review and follow the Docs of ../totalum-mcp/TOTALUM_MCP_DOCS.md file.

## API route pattern (Next.js App Router, server-only; snake_case in payload)

src/app/api/contact/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { totalum } from "@/lib/totalum";

// (Optional) move to src/lib/errors.ts and import
function serializeError(err: unknown) {
  const e = err as any;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
    status: e?.response?.status ?? null,
    responseData: e?.response?.data ?? null,
    stack: e?.stack ?? null,
  };
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await totalum.crud.createRecord("contact_submission", {
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
      submitted_at: new Date().toISOString(),
      status: "new",
    });

    // createRecord returns the full created record
    return NextResponse.json({ ok: true, data: created?.data });
  } catch (err) {
    console.error("[API ERROR] /api/contact", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}


Client components must call these API routes (no SDK in the browser).
**Important:** The `{ ok: true, data: ... }` response convention applies to ALL API routes (not just SDK routes). Client components must use `api.get/post/put/delete` from `src/lib/api.ts` instead of raw `fetch()`.
Prefer keeping form field names snake_case end-to-end; if you use camelCase in the client, map to snake_case in the route handler before calling the SDK.

## End-to-end workflow (Claude must follow)

Modeling (MCP): canonicalize names to snake_case, ensure type(s)/fields/page exist (section 3).

Server (SDK): use src/lib/totalum.ts and generate src/app/api/**/route.ts endpoints with snake_case typeId/property keys (section 4/5).

Client: generate forms/pages that call those API routes (no SDK client-side).

If a mismatch error occurs (unknown table/field), convert to snake_case and retry.


4. How to use the Totalum SDK in server code (snake_case everywhere)

CRUD helpers (server): always use snake_case typeId and property keys.
