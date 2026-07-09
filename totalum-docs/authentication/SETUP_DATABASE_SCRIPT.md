---
name: auth-database-setup-script
description: "Deterministic script for setting up the Better Auth database tables in Totalum. Execute step-by-step, sequentially (never in parallel). Do not edit field names, types, or extras. Every deviation from this script breaks authentication."
---

# Auth Database Setup Script

> **The agent MUST execute this script end-to-end when adding authentication to a project that does not yet have the four Better Auth tables (`user`, `session`, `account`, `verification`).**
>
> This script is the single source of truth for the auth schema. Do not change field names, types, or `typeExtras`. The Better Auth → Totalum adapter maps camelCase ↔ snake_case, so a single wrong underscore will make auth silently fail.

---

## Hard Rules (read before running)

1. **Execute the numbered steps sequentially.** Never call these MCP tools in parallel — later steps depend on IDs produced by earlier ones.
2. **Do not add** `_id`, `createdAt`, `updatedAt` — Totalum auto-creates them.
3. **Every field name is snake_case with underscores** (`user_id`, `expires_at`, `ip_address`). The adapter writes to snake_case. `userid` or `expiresat` → auth silently fails.
4. **Tokens use `long-string`**, not `string`. Access/refresh/ID tokens can exceed the short-string limit.
5. **Date fields use `includeHour: true`.** Sessions expire by exact timestamp; date-only precision breaks session validity.
6. **`user_id` on `session` and `account` MUST be `objectReference` → user table.** Never use `string`.
7. **Only the `user` table is visible in the back-office.** `session`, `account`, `verification` stay hidden (`mustTheTableBeVisibleOnBackOffice: false`).
8. **After each table creation, save the returned structure/table `_id`.** Step 2 and Step 3 need the user table's id.
9. **If the project is multi-role / multi-tenant**, add the role/company fields to the `properties` array inside Step 1 *before* running it. Do not create them after.
10. **Verify with `getAllDatabaseTables()` at the end.** If any field is wrong, delete that table and re-run its step. Do **not** attempt to patch a broken schema with `editTableProperty`.

---

## Step 0 — Pre-flight check

```typescript
const existing = await mcp__totalum__getAllDatabaseTables();
```

- If `user`, `session`, `account`, `verification` all already exist with the exact fields in Step 6's checklist → **stop, schema is ready.**
- If **some** tables exist with wrong fields → delete those specific tables with `mcp__totalum__deleteDatabaseTableById({ structureId })` and run the missing steps.
- If **none** exist → continue to Step 1.

---

## Step 1 — Create the `user` table

```typescript
await mcp__totalum__createDatabaseTable({
  type: "user",
  label: "User",
  description: "Table used for Auth. Stores users",
  icon: "fa-solid fa-user",
  mustTheTableBeVisibleOnBackOffice: true,
  properties: [
    { name: "email",          label: "Email",          propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "name",           label: "Name",           propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "email_verified", label: "Email Verified", propertyType: "number" },
    { name: "image",          label: "Image",          propertyType: "string", typeExtras: { string: { type: "link" } } }
    // ➜ If multi-role / multi-tenant: append custom fields here BEFORE running this step.
    //    Example: { name: "role", label: "Role", propertyType: "string", typeExtras: { string: { type: "text" } } }
    //    Example: { name: "company_id", label: "Company", propertyType: "objectReference",
    //              objectReference: { objectReferenceTypeId: "company", objectReferenceRelation: "manyToOne" } }
  ]
});
```

---

## Step 2 — Capture the user table `_id`

```typescript
const tables = await mcp__totalum__getAllDatabaseTables();
const userTableId = tables.find(t => t.type === "user")._id;
// Reuse `userTableId` as `objectReferenceTypeId` in Steps 3 and 4.
```

Do not hard-code a placeholder. Do not use the string `"user"` as the reference — the generated `_id` is required.

---

## Step 3 — Create the `session` table

```typescript
await mcp__totalum__createDatabaseTable({
  type: "session",
  label: "Session",
  description: "Table used for Auth. Stores user auth sessions",
  icon: "fa-solid fa-clock",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "user_id",    label: "User",       propertyType: "objectReference",
      objectReference: { objectReferenceTypeId: userTableId, objectReferenceRelation: "manyToOne" } },
    { name: "token",      label: "Token",      propertyType: "string" },
    { name: "expires_at", label: "Expires At", propertyType: "date",   typeExtras: { date: { includeHour: true } } },
    { name: "ip_address", label: "IP Address", propertyType: "string" },
    { name: "user_agent", label: "User Agent", propertyType: "string" }
  ]
});
```

---

## Step 4 — Create the `account` table

```typescript
await mcp__totalum__createDatabaseTable({
  type: "account",
  label: "Account",
  description: "Table used for Auth. Stores accounts tokens",
  icon: "fa-solid fa-id-card",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "user_id",                  label: "User",                     propertyType: "objectReference",
      objectReference: { objectReferenceTypeId: userTableId, objectReferenceRelation: "manyToOne" } },
    { name: "account_id",               label: "Account ID",               propertyType: "string" },
    { name: "provider_id",              label: "Provider ID",              propertyType: "string" },
    { name: "password",                 label: "Password",                 propertyType: "string" },
    { name: "access_token",             label: "Access Token",             propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "refresh_token",            label: "Refresh Token",            propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "id_token",                 label: "ID Token",                 propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "access_token_expires_at",  label: "Access Token Expires At",  propertyType: "date",        typeExtras: { date: { includeHour: true } } },
    { name: "refresh_token_expires_at", label: "Refresh Token Expires At", propertyType: "date",        typeExtras: { date: { includeHour: true } } },
    { name: "scope",                    label: "Scope",                    propertyType: "string" }
  ]
});
```

---

## Step 5 — Create the `verification` table

```typescript
await mcp__totalum__createDatabaseTable({
  type: "verification",
  label: "Verification",
  description: "Table used for Auth. Stores verification tokens",
  icon: "fa-solid fa-check-circle",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "identifier", label: "Identifier", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "value",      label: "Value",      propertyType: "string" },
    { name: "expires_at", label: "Expires At", propertyType: "date",   typeExtras: { date: { includeHour: true } } }
  ]
});
```

---

## Step 6 — Verification checkpoint (MANDATORY)

```typescript
const tables = await mcp__totalum__getAllDatabaseTables();
```

Confirm all four tables exist with **exactly** these field names:

| Table          | Required fields                                                                                                                                                                                              | Visible in back-office |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------|
| `user`         | `email`, `name`, `email_verified`, `image` *(+ any additional fields added in Step 1)*                                                                                                                       | ✅ yes                 |
| `session`      | `user_id` (objectReference → user), `token`, `expires_at`, `ip_address`, `user_agent`                                                                                                                        | ❌ no                  |
| `account`      | `user_id` (objectReference → user), `account_id`, `provider_id`, `password`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`                     | ❌ no                  |
| `verification` | `identifier`, `value`, `expires_at`                                                                                                                                                                          | ❌ no                  |

### If a field is wrong

- **Wrong name** (e.g. `userid` instead of `user_id`, `expiresat` instead of `expires_at`) → delete the whole table with `mcp__totalum__deleteDatabaseTableById({ structureId })` and re-run the relevant step. Do NOT rename with `editTableProperty` — the adapter needs the exact snake_case produced by `createDatabaseTable`.
- **`user_id` is `string` instead of `objectReference`** and the table already has data → **leave it as-is.** Mutating the type would break records already written with string values. Flag this to the user and ask whether to wipe and recreate.
- **Missing field** → add it with `mcp__totalum__createTableProperty` using the exact `typeExtras` from Steps 3–5.
- **Extra fields** (e.g. a manual `created_at`) → delete the field with `mcp__totalum__deleteTableProperty`. Totalum already auto-creates `createdAt`.

---

## Step 7 — Link user to domain tables (only if the project already has other tables that represent user-owned data)

For every domain table that belongs to a user (orders, posts, tasks, …):

```typescript
await mcp__totalum__createTableProperty({
  structureId: "<domain_table_id>",
  property: {
    name: "user",
    label: "User",
    propertyType: "objectReference",
    objectReference: {
      objectReferenceTypeId: userTableId,
      objectReferenceRelation: "manyToOne"
    }
  }
});
```

Do this **after** Step 6 passes, not before.

---

## Completion criteria

The script is complete when **all** of the following are true:

- [ ] All four tables exist (`user`, `session`, `account`, `verification`).
- [ ] Every field name matches the tables in Step 6 exactly (snake_case, no typos).
- [ ] `session.user_id` and `account.user_id` are both `objectReference` pointing at the user table's `_id`.
- [ ] All `*_at` fields have `typeExtras.date.includeHour: true`.
- [ ] All three token fields on `account` are `long-string` with `typeExtras["long-string"].type: "text"`.
- [ ] Only the `user` table is visible in the back-office.

Once these are green, authentication is ready. Proceed with `src/lib/auth.ts` configuration (see `README.md` in this folder) and wire up `/login` and `/register` pages — do **not** recreate them, the template already ships them.
