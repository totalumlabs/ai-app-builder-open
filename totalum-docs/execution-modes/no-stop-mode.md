# No-Stop Mode

No-stop mode automates the entire development process in two phases: **planning** followed by **sequential auto-execution**. Each auto-executed step implements a large chunk of work, then tests and iterates until everything works perfectly.

## Phase 1: Planning (Read-Only)

The agent analyzes the full codebase and produces a structured execution plan. During this phase:

- The agent can only read files (Read, Glob, Grep tools)
- It reads CLAUDE.md, all docs/, and relevant source code
- `PERMISSION_MODE=plan` is set (read-only enforcement)
- npm install, git operations, and server start are skipped

### Output Files

The agent creates exactly two files:

#### 1. `/app/user-project/auto-plan-prompts.json`

A JSON array of structured prompt objects for sequential execution:

```json
[
  "Create the complete database schema for users, clients, and invoices tables with ALL fields AND ALL objectReference relationships using Totalum SDK. After creating all tables, call getAllDatabaseTables via Totalum MCP to VERIFY every table and every objectReference field exists. If any are missing, create them immediately. Then build the shared layout components (sidebar, header, navigation) and create seed/default data.\n\nPLAYWRIGHT BROWSER TESTING:\nRead docs/testing-project/README.md first and follow setup.md.\n1. Verify all tables via getAllDatabaseTables MCP — check every objectReference field exists\n2. Navigate to home page — verify layout renders with sidebar navigation\n3. Click each sidebar link — verify pages load without errors\n4. Verify seed data exists (status options, roles, etc.)\nIf anything fails, fix and re-test until all pass.",
  "Build the full users management module: list page at /users, create form at /users/new, edit page at /users/[id], delete functionality. The project already has the database schema and layout from the previous step.\n\nPLAYWRIGHT BROWSER TESTING:\nRead docs/testing-project/README.md first and follow setup.md.\n1. Navigate to /users — verify table shows users with names and roles (not raw IDs)\n2. Click 'New User' — fill form — submit — verify new user appears in list\n3. Click a user — verify edit page loads correct data — change a field — save — refresh — verify change persisted\n4. Delete a user — verify removed from list\n5. REGRESSION: verify home page and sidebar still work\nIf anything fails, fix and re-test until all pass."
    ]
  }
]
```

#### Prompt Design Philosophy

**Each prompt must do a LOT of substantial work.** Create FEW prompts that each accomplish a major chunk of functionality. Think of each prompt as a full development session, not a single small task.

**Prompt Count Guidelines (STRICT):**

| Task Size | Examples | Prompt Count |
|-----------|----------|-------------|
| Small | Single feature, bug fix, simple page | 1 prompts |
| Medium | Multiple related features, full module | 1-2 prompts |
| Large | Full application with many modules | 2-3 prompts |
| Very large | Enterprise-level, many independent modules | 3-10 prompts MAX, only more if user specifically requests it, but never more than 60 prompts |

**Default to FEWER prompts.** If in doubt, merge two small prompts into one bigger one.

**NEVER exceed 10 prompts** unless the user explicitly requests more. Absolute maximum is **60 prompts**.

#### CRITICAL: First Prompt Must Handle Complete Database Schema

The #1 source of cascading failures is incomplete database setup. The first implementation prompt MUST:

1. **Create ALL tables with ALL fields** — never defer fields to later prompts
2. **Create ALL objectReference fields** for every relationship — foreign keys, owner refs, status refs, parent-child refs, auth refs (user_id on session/account tables)
3. **VERIFY the schema** by calling `getAllDatabaseTables` via Totalum MCP and checking every objectReference field actually exists
4. **Create seed/default data** (status options, roles, categories, etc.)
5. **Never skip verification** — "created successfully" messages from the API are not enough; always read back and verify

#### Research/Investigation Prompts

When the user's request involves accessing external websites or platforms to gather information before coding, the first prompt(s) must be dedicated to **research only** — no coding.

**When to create research prompts:**
- User asks to clone, replicate, or analyze an external website/application
- User provides login credentials for an external or internal platform
- User asks to scrape or investigate an external service before building

**Research prompt rules:**
- Use Playwright to navigate, screenshot, and document — NO code implementation
- Produce a detailed written summary of findings (features, UI, flows, data structures)
- 1 prompt for single page/section, 2+ for full application analysis. Or if user specifically requests a certain number of prompts for research, follow that.
- Next prompt references research findings as context
- **Only create research prompts when the user explicitly asks to access/test/scrape external/internal resources**

#### Prompt Content Requirements:
- Each prompt must be **self-contained** (no cross-references like "as mentioned above")
- Each prompt must start with context about what previous prompts already built
- Each prompt must include **specific, testable acceptance criteria** (at least 3 per prompt)
- Earlier prompts handle foundational work (database, utilities, shared components, layouts)
- Later prompts handle dependent features that build on previous work
- Include enough detail so each prompt can execute independently without guessing
- For prompts 2+, the testing section must include a quick regression check of key features from previous prompts

#### CRITICAL: Every Prompt MUST Include Detailed Playwright Browser Testing

Each prompt has access to **Playwright MCP** for browser testing. Every prompt MUST end with a detailed **PLAYWRIGHT BROWSER TESTING** section that tells the agent EXACTLY what to test step-by-step.

**DO NOT use vague instructions like "test everything in the browser."** This results in the agent only running `npm run build` and skipping actual browser testing.

Each prompt's testing section must include:
1. **Explicit pages/URLs to navigate to** — list every route
2. **Specific data to verify on each page** — what records should appear, what text should show
3. **Data integrity checks** — verify names show instead of ObjectIDs, verify correct filtering
4. **Interactive tests** — click buttons, submit forms, change dropdowns, verify results
5. **State persistence tests** — change something, refresh the page, verify it persisted
6. **Regression checks** (prompts 2+) — quick verification that previous features still work

**Example of a GOOD testing section inside a prompt:**

```
PLAYWRIGHT BROWSER TESTING (MANDATORY — do ALL of these after implementing):

Read docs/testing-project/README.md first and follow setup.md to start the server.

1. AUTHENTICATION TEST:
   - Navigate to /register, create a test user
   - Navigate to /login, login with those credentials
   - Verify: redirect to /dashboard (NOT stuck on login page)
   - Verify: user name appears in the header/sidebar

2. LEADS LIST TEST:
   - Navigate to /leads
   - Verify: table shows leads with columns: name, status badge (colored, not raw ID), owner name
   - Verify: no raw 24-character hex strings visible anywhere
   - Click a lead row → verify detail page opens with correct data

3. LEAD DETAIL + STATE PERSISTENCE TEST:
   - Change lead status via dropdown → verify success
   - REFRESH the page → verify the new status persisted

4. LEAD CREATION TEST:
   - Click "New Lead" → fill form → submit
   - Verify: new lead appears in the leads list

5. REGRESSION CHECK:
   - Navigate to /dashboard → verify it still loads with data
   - Check sidebar → all previous sections still accessible

If ANY test fails, fix the code, rebuild, restart server, re-test. Repeat until ALL pass.
```

Without detailed testing instructions, the agent will skip browser testing and bugs will cascade.

#### Prompt Format:
Each prompt in the JSON array is a **string** containing the full self-contained prompt text **INCLUDING** the detailed Playwright testing section at the end.

#### 2. `/app/user-project/auto-plan-description.md`

A detailed markdown document describing:
- Overview of the approach
- What each prompt will accomplish (substantial scope per prompt)
- Dependencies between prompts
- Architecture decisions
- Reasoning for the chosen number of prompts

Mode-specific instructions are delivered via the docs synced to the sandbox.

---

## Phase 2: Auto-Execution

After planning completes, each prompt is executed sequentially in **testing mode** (implement + test + iterate with Playwright).

### Execution Flow

1. The system reads `auto-plan-prompts.json`
2. For each prompt (in order):
   - Marks the prompt status as `executing`
   - Adds a user message: `[Auto 1/5] <prompt text>`
   - Creates a `StartumConfig` with `mode: 'testing'`
   - Injects critical system rules (objectReference mandate, read claude.md, env protection, etc.)
   - For prompts 2+: injects a regression check (build + verify previous features still work)
   - Wraps the prompt with mandatory post-implementation workflow (build → deep test → fix → iterate until perfect)
   - Runs the full agent cycle (implement + test + iterate)
   - Marks the prompt as `done` on completion
3. Guards prevent parallel execution — if an agent is already running, the next prompt waits
4. Credit balance is checked before each prompt — execution stops if insufficient credits

### Each Prompt's Execution Cycle

Each prompt automatically follows this cycle:
1. **Regression check** (prompts 2+) — verify build passes and previous features still work
2. **Implement** all changes described in the prompt
3. **Build** — run `npm run build` to check for type/compilation errors
4. **Deep test** — use Playwright browser to verify all features with DATA-LEVEL testing:
   - Verify pages render with correct data (not just that they load)
   - Verify no raw ObjectIDs visible anywhere (names/labels must show instead)
   - Verify filters show correct subsets of data (not all records)
   - Verify form submissions create/update records that persist after page refresh
   - Verify status changes persist after refresh
   - Verify auth flows work end-to-end (if applicable)
   - Check ALL acceptance criteria for this prompt
5. **Fix** — if anything fails, has errors, shows wrong data, or doesn't work correctly, fix it
6. **Fix regressions** — if bugs from previous prompts are discovered during testing, fix them too
7. **Repeat** steps 3-6 until everything works perfectly with zero errors and all acceptance criteria pass

This ensures each prompt delivers solid, verified, working code before the next prompt starts building on top of it.

### Anti-Patterns to Avoid

These are the most common causes of silent failures in auto-execution:

1. **Silent error swallowing** — NEVER use `try { ... } catch(e) { /* ignore */ }`. Every error must be logged and propagated.
2. **Shallow testing** — "Page loads = it works" is FALSE. A page that renders but shows raw IDs, wrong data, or no data is BROKEN.
3. **Assuming API calls succeeded** — After creating database fields, VERIFY they exist. After submitting forms, VERIFY the record was created.
4. **Deferring relationship fields** — Creating a table without its objectReference fields causes 90% of cascading bugs. Always create ALL fields together.
5. **Not testing as different user types** — If the app has roles (admin, user, client), test that each role sees only what they should.

### Status Tracking

```typescript
interface AutoStartumStatusI {
    status: 'defining' | 'executing' | 'done' | 'cancelled';
    prompts: {
        prompt: string;
        status: 'pending' | 'executing' | 'done' | 'failed';
        order: number;
        error?: string;
    }[];
    planDescription: string;
    currentPromptIndex: number;
    createdAt: Date;
    updatedAt: Date;
}
```

### Credit Usage

Each auto-executed prompt consumes **1 credit**, same as a regular prompt execution. Credit balance is checked before each prompt — auto-execution stops if insufficient credits remain.
