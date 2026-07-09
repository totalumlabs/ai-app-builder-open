# Testing

## Test Scope

**Test ONLY what the context requires.**

| Context | Scope |
|---------|-------|
| "test X feature" | 1-3 routes, specific interactions |
| After code changes | Changed page + dependents |
| "test everything" | All routes, all interactive flows |
| "quick smoke test" | 5-8 key routes, snap only |
| Bug investigation | 1 route, deep interaction + screenshots |
| Post-deploy | Critical user paths (5-10 routes) |
| **Testing mode / No-stop mode** | **ONLY pages/features created or modified — but test them EXTREMELY deeply: happy path, edge cases (empty states, invalid inputs, boundary values, special chars), persistence after refresh, data correctness, UI resilience (rapid clicks, double submit, back/forward).** |

Discover routes from `src/app` when scope is broad. Skip redirects/aliases and deep nesting (pick 1-2 per module).

---

## Code Mode — browser_run_code

Pack all operations into `browser_run_code` calls. This is ~4x more token-efficient than individual MCP tool calls and avoids context flooding.

### Critical Rules

0. **Viewport: 1920x1080** — Always call `browser_resize(1920, 1080)` before the first `browser_run_code`. Never use the default 768x1024. Only use mobile (375x812) or tablet (768x1024) if the user explicitly requests it.
1. **MAX 2 calls** — Call 1: auth + page loads. Call 2: interactions. For 1-3 routes, use **1 call**.
2. **`waitUntil: 'domcontentloaded'`** with 8s timeout. Try/catch + short wait after.
3. **NEVER** use `waitForURL()`, `'networkidle'`, `browser_navigate`, or `window.scrollTo()`.
4. **500ms wait per page, 1500-2000ms for API-heavy pages.** Identify API-heavy routes from console logs.
5. **Logout via API:** `page.evaluate(() => fetch('/api/auth/sign-out', { method: 'POST' }))`.
6. **Never hardcode text** — use discovered text from `inventory()`.
7. **Emit Call 2 immediately** after reading Call 1 results. Don't pause to write analysis.
8. **Handle fallbacks in the same call.** Never return errors just to retry in a new call (each round-trip costs 2-4s).
9. **Pre-flight before screenshots** — fix overlays/scroll/overflow in the same call, then screenshot once.
10. **Never re-navigate** to pages already visited in Call 1.
11. **Keep reports concise** — compact tables, bullet-point issues only.
12. **Discover before interacting.** On any page with unknown UI (wizards, forms, selections), run an inline discovery snippet BEFORE clicking anything. One wasted round-trip = 15-30s. See "Inline Discovery Pattern" below.
13. **Diagnose disabled buttons immediately.** When Next/Submit is disabled, don't retry the same action — run the disabled button diagnostic inline in the same call. See "Disabled Next/Submit Button Diagnostic".
14. **Batch wizard steps in one call.** Multi-step wizards should be traversed in a single `browser_run_code` call with per-step inline discovery + fallback, NOT one call per step.

### Timeouts

| Action | Timeout | Why |
|--------|---------|-----|
| Click visible button | 1s | Already rendered |
| Click after navigation | 3s | Needs to appear |
| waitForSelector after goto | 5s | Page building |
| waitForResponse / goto | 8s | Network |

**Rule:** On page = 1s. After action = 3s. Network = 5-8s. Never >8s except `page.goto`.

### Failure Prevention

1. **Null-check everything** — `page.$()`, `boundingBox()`, `evaluate querySelector` can all return null.
2. **Try-catch per interaction group** — one failure shouldn't abort 15 tests.
3. **Fail fast** — 1-3s timeouts. If not there in 1s, fall back immediately.
4. **Never assume state** — verify `page.url()` or run `snap()` after any action.
5. **`.catch(() => {})` for optional checks** — spinners, toasts, optional elements.

---

## Inline Discovery Pattern

**THE #1 TIME WASTER: Guessing at selectors and failing silently, then retrying in a new call.**

Before interacting with any unknown page/step, run this discovery snippet **inline in the same `browser_run_code` call**:

```javascript
const discover = async () => page.evaluate(() => ({
  // What interactive elements exist?
  buttons: [...document.querySelectorAll('button:not([disabled])')].slice(0, 15)
    .map(b => ({ text: b.textContent?.trim()?.substring(0, 60), role: b.getAttribute('role'), id: b.id }))
    .filter(b => b.text),
  radios: [...document.querySelectorAll('button[role="radio"], input[type="radio"]')]
    .map(r => ({ id: r.id, value: r.value, checked: r.checked || r.getAttribute('data-state') === 'checked' })),
  inputs: [...document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select')]
    .map(el => ({ id: el.id, type: el.type, placeholder: el.placeholder?.substring(0, 40), value: el.value?.substring(0, 20) })),
  comboboxes: [...document.querySelectorAll('[role="combobox"]')]
    .map(c => ({ tag: c.tagName, text: c.textContent?.trim()?.substring(0, 60) })),
  // Are there collapsed sections hiding content?
  accordions: [...document.querySelectorAll('button')]
    .filter(b => /\(\d+\s*(options|opciones)\)/i.test(b.textContent) || b.querySelector('[class*="chevron"], [class*="arrow"]'))
    .map(b => b.textContent?.trim()?.substring(0, 60)),
  // Is the next/submit button disabled?
  nextBtn: (() => {
    const btn = [...document.querySelectorAll('button')].find(b => /next|siguiente|continue|continuar|submit|create|crear/i.test(b.textContent));
    return btn ? { text: btn.textContent?.trim()?.substring(0, 40), disabled: btn.disabled } : null;
  })(),
}));

// Use discovery result to choose the RIGHT action — no guessing
const d = await discover();
if (d.accordions.length > 0) { /* expand accordion first */ }
if (d.radios.length > 0) { /* click radio by id */ }
if (d.buttons.some(b => b.role === 'radio')) { /* radix radio buttons */ }
// etc.
```

**When to use:** Every time you land on an unfamiliar page, wizard step, dialog, or form. The cost is ~50ms. The cost of NOT doing it is 15-30s per failed round-trip.

**When to use `browser_snapshot` instead:** Only when `discover()` returns unexpected results (0 buttons, 0 radios on a page that should have them). Snapshot is heavier (~2-5KB) but gives the full accessibility tree including shadow DOM.

---

## Method Hierarchy

| Priority | Method | When |
|----------|--------|------|
| 1 (default) | `page.click()` / `page.fill()` | Always first. Auto-waits + retries. |
| 2 (overlay) | `locator.dispatchEvent('click')` | When `"intercepts pointer events"`. |
| 3 (last resort) | `page.evaluate(() => el.click())` | React portals, find+click atomic ops. |

**Never start with evaluate.** It skips actionability checks and silently fails.

**Speed shortcut:** If you're already inside a known dialog or a previous click on the same page failed with pointer interception, skip straight to evaluate — don't waste 3s on a timeout you know will fail.

**Forms:** `page.fill()` works for 95% of inputs including React. Only fall back to the React native setter if value reverts:
```javascript
await page.evaluate(({ sel, val }) => {
  const el = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, { sel: 'input#email', val: 'test@example.com' });
```

---

## Selector Strategy

**Priority order:** `[data-testid]` > `[role]` + `.nth(N)` > `[type="submit"]` / `[aria-label]` > `:has-text()` with discovered text > CSS classes.

Always use text from `inventory()` output. Never guess.

**Universal clickable selector:**
```javascript
const CLICKABLE = 'button, [role="button"], [onclick], [tabindex]:not([tabindex="-1"]), a[href], [data-action]';
```

**Fallback:** Use `browser_snapshot` for full accessibility tree when `inventory()` misses elements (shadow DOM, custom components). Only as fallback — it's ~2-5KB per page.

### The Silent Failure Trap

`page.evaluate(() => element.click())` **does NOT throw on failure**. If the element isn't found or the click doesn't trigger React state, it silently returns `undefined` and you waste an entire round-trip discovering the action had no effect.

**Always verify after evaluate-based clicks:**
```javascript
// BAD — silent failure, wastes a round-trip to discover nothing happened
await page.evaluate(() => {
  const card = document.querySelector('div.cursor-pointer');
  if (card) card.click();
});
// 15-30 seconds later: "why didn't it work?"

// GOOD — verify inline, fall back immediately
const clicked = await page.evaluate(() => {
  const card = document.querySelector('div.cursor-pointer');
  if (card) { card.click(); return true; }
  return false;
});
if (!clicked) {
  // Try page.click or different selector immediately — same call
  await page.click('button:has-text("Option")', { timeout: 2000 });
}
// Verify state changed
const nextEnabled = await page.evaluate(() =>
  ![...document.querySelectorAll('button')].find(b => /next|siguiente/i.test(b.textContent))?.disabled
);
if (!nextEnabled) { /* diagnose — see Disabled Button Diagnostic */ }
```

---

## Complex UI Patterns

### Card-Based Selection (Wizards & Dialogs)

Cards that look like `<div class="cursor-pointer">` are **often actual `<button>` elements** in the accessibility tree. `page.evaluate(() => div.click())` silently fails to trigger React state on buttons rendered as styled divs.

**CRITICAL: Discover before clicking.** Run this inline discovery FIRST:
```javascript
// STEP 1 — Discover what the cards actually are (inline, same call)
const cards = await page.evaluate(() =>
  [...document.querySelectorAll('button, [role="radio"], [role="option"], div[class*="cursor"]')]
    .filter(el => el.offsetHeight > 0 && el.textContent?.trim().length > 3 && el.textContent?.trim().length < 200)
    .map(el => ({ tag: el.tagName, role: el.getAttribute('role'), text: el.textContent?.trim()?.substring(0, 80) }))
);

// STEP 2 — Click using the RIGHT selector based on discovery
// If tag === 'BUTTON': use page.click('button:has-text("...")')
// If role === 'radio': use page.click('#radioId')
// Only use evaluate as LAST resort
```

```javascript
// PRIMARY — page.click with has-text (works for buttons, divs, any clickable)
await page.click('button:has-text("Option Text")', { timeout: 2000 });

// FALLBACK 1 — if not a button, try generic text click
await page.click('text=Option Text', { timeout: 2000 });

// FALLBACK 2 — evaluate ONLY after page.click fails
await page.evaluate((text) => {
  for (const div of document.querySelectorAll('div')) {
    if (div.textContent?.includes(text) && div.className?.includes('cursor')) {
      div.click(); break;
    }
  }
}, 'Option Text');

// STEP 3 — ALWAYS verify: check if the next/submit button became enabled
const nextEnabled = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b =>
    /next|siguiente|continue|continuar/i.test(b.textContent));
  return btn ? !btn.disabled : null;
});
```

### Cards Inside Dialogs (Radix Portals)

Dialog content IS inside `[role="dialog"]` in the DOM, but `[class*="cursor-pointer"]` may fail due to Tailwind's dynamic className construction. Some cards auto-select a default.

```javascript
// Open dialog
await page.click('button:has-text("New Event")', { timeout: 3000 });
await page.waitForTimeout(1500);

// Check if pre-selected
const preSelected = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return dialog?.querySelectorAll('[class*="border-2"]')?.length > 0;
});

// If not, click via evaluate scoped to dialog
if (!preSelected) {
  await page.evaluate((text) => {
    const dialog = document.querySelector('[role="dialog"]');
    for (const div of dialog?.querySelectorAll('div') || []) {
      if (div.textContent?.includes(text) && div.className?.includes('cursor')) {
        div.click(); break;
      }
    }
  }, 'Personal Event');
  await page.waitForTimeout(500);
}

// Dialog footer buttons work fine with standard selectors
await page.click('[role="dialog"] button:has-text("Next")', { timeout: 3000 });
```

### Overlay / Dialog Pointer Interception

```javascript
// Fast cascade — 1s worst case
try {
  await page.click('button:has-text("Accept")', { timeout: 1000 });
} catch {
  try { await page.locator('button:has-text("Accept")').dispatchEvent('click'); }
  catch { await page.evaluate((t) => {
    [...document.querySelectorAll('button, [role="button"]')].find(b => b.textContent?.includes(t))?.click();
  }, 'Accept'); }
}
```

### Persistent Overlays (Survive React Re-renders)

CSS injection is permanent — DOM removal and clicking "Cancel" don't work if React re-mounts the component.

```javascript
// Add ONCE at start of any browser_run_code call
await page.addStyleTag({ content: `
  [class*="reminder" i],
  [class*="overlay" i]:not([role="dialog"]) { display: none !important; }
`});
// WARNING: Don't hide [role="dialog"] globally — that kills ALL dialogs
```

### Custom Dropdowns (shadcn, radix, MUI)

```javascript
await page.click('[data-slot="select-trigger"]', { timeout: 1000 });
await page.waitForSelector('[role="option"]', { timeout: 2000 });
try { await page.click('[role="option"]:has-text("Text")', { timeout: 1000 }); }
catch { await page.evaluate((t) => {
  [...document.querySelectorAll('[role="option"]')].find(o => o.textContent?.includes(t))?.click();
}, 'Text'); }
```

### Combobox / Command Palette (cmdk)

Combobox triggers are often `<button role="combobox">` that open a popover with an `<input>`. **Clicking the button opens the popover; typing goes into the revealed input inside it, NOT into the button itself.** `page.keyboard.type()` on the page often sends keys to the wrong element.

```javascript
// Step 1: Click the combobox trigger to open dropdown
await page.click('[role="combobox"]', { timeout: 2000 });
await page.waitForTimeout(500);

// Step 2: Find the ACTUAL input inside the opened popover
const input = await page.$('input[role="combobox"], input[placeholder*="search" i], input[placeholder*="buscar" i]');
if (input) {
  await input.fill('search term');
} else {
  // Fallback: type into whatever has focus
  await page.keyboard.type('search term');
}

// Step 3: Wait for ASYNC results (API call + render)
await page.waitForTimeout(1500); // 1500ms minimum for API-backed search

// Step 4: Verify options exist, THEN click
const options = await page.$$('[role="option"]');
if (options.length > 0) {
  await options[0].click();
} else {
  // Fallback: options might not use role="option"
  await page.evaluate((term) => {
    const items = [...document.querySelectorAll('[cmdk-item], [data-value], li[class*="cursor"]')];
    const match = items.find(i => i.textContent?.toLowerCase().includes(term.toLowerCase()));
    if (match) match.click();
  }, 'search term');
}
```

### Accordion + Hidden Radio Pattern

Accordions/collapsibles hide their content until expanded. Radios, checkboxes, or sub-options may return **0 results** if queried before expanding the parent section.

```javascript
// WRONG — queries 0 radios because accordion is collapsed
const radios = await page.$$('button[role="radio"]'); // → []

// RIGHT — expand first, then query
// Step 1: Click the accordion header
await page.click('button:has-text("Category Name")', { timeout: 2000 });
await page.waitForTimeout(800);

// Step 2: NOW query the revealed radios
const radios = await page.$$('button[role="radio"]');
if (radios.length > 0) await radios[0].click();
```

**Detection:** If you expect radios/options but get 0, look for collapsible buttons with text like `"(N options)"`, `"▶"`, or accordion-style `<h3>` inside `<button>`. Expand them first.

### Multi-Step Wizards

**CRITICAL: Reconnaissance before navigation.** Blind step-by-step traversal wastes 1 round-trip per step (~15-30s each). Instead:

1. **Read the step indicator** (e.g., "Step 2 of 6") to know total steps
2. **Discover the current step's requirements** inline before trying to proceed
3. **Batch multiple steps** in a single `browser_run_code` call with inline fallbacks

```javascript
// PATTERN: Navigate wizard with inline discovery + fallback per step
const wizardStep = async () => {
  // 1. What step are we on?
  const stepInfo = await page.evaluate(() => ({
    step: document.body.innerText.match(/(?:step|paso)\s*(\d+)\s*(?:of|de)\s*(\d+)/i),
    h2: document.querySelector('h2')?.textContent?.trim(),
    nextDisabled: [...document.querySelectorAll('button')].find(b =>
      /next|siguiente/i.test(b.textContent))?.disabled,
    // Discover ALL interactive elements on this step
    radios: document.querySelectorAll('button[role="radio"]').length,
    inputs: document.querySelectorAll('input:not([type="hidden"]), textarea').length,
    cards: [...document.querySelectorAll('button, div[class*="cursor"]')]
      .filter(el => el.querySelector('h3') && el.offsetHeight > 0).length,
    accordions: [...document.querySelectorAll('button')]
      .filter(b => /\(\d+\s*(options|opciones)\)/i.test(b.textContent)).length,
  }));
  return stepInfo;
};

// 2. Act based on discovery, NOT guessing
const info = await wizardStep();
if (info.accordions > 0) { /* expand accordion first, then select radio */ }
if (info.cards > 0) { /* click card with page.click('button:has-text(...)') */ }
if (info.radios > 0) { /* click radio directly */ }
if (info.inputs > 0) { /* fill form fields */ }
// Then click Next
```

```javascript
// Simple batch navigation when steps are already known
const steps = [
  () => page.click('text=Manual Option'),
  () => page.click('button:has-text("Continue")'),
  () => page.click('button:has-text("Skip")'),
  async () => { const c = await page.$('div:has(> h3:text("Category"))'); if(c) await c.click(); },
  () => page.click('button:has-text("Next"):not([disabled])'),
];
for (const step of steps) {
  try { await step(); } catch(e) { /* log */ }
  await page.waitForTimeout(300);
}
```

### Disabled Next/Submit Button Diagnostic

When a navigation button (Next, Continue, Submit) is disabled, **do NOT retry blindly**. Diagnose inline:

```javascript
// IMMEDIATELY when next/submit is disabled — find out WHY
const diagnosis = await page.evaluate(() => {
  const required = [...document.querySelectorAll('label')]
    .filter(l => l.textContent?.includes('*'))
    .map(l => {
      const input = document.getElementById(l.getAttribute('for'))
        || l.closest('div')?.querySelector('input, textarea, select, [role="combobox"]');
      return {
        label: l.textContent?.trim()?.substring(0, 40),
        filled: input ? (input.value?.length > 0 || input.getAttribute('data-state') === 'checked') : 'no-input-found',
      };
    });
  const validationErrors = [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="destructive"]')]
    .map(e => e.textContent?.trim()?.substring(0, 80));
  const uncheckedRadioGroups = [...new Set(
    [...document.querySelectorAll('button[role="radio"][data-state="unchecked"]')]
      .map(r => r.closest('[role="radiogroup"]')?.getAttribute('aria-label') || 'unnamed')
  )];
  return { required, validationErrors, uncheckedRadioGroups };
});
// Now you know exactly what to fill/select — no guessing
```

### File Uploads

```javascript
// Standard file input
const fileInput = await page.$('input[type="file"]');
if (fileInput) await fileInput.setInputFiles('/path/to/file.pdf');

// Hidden input triggered by button
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.click('button:has-text("Upload")'),
]);
await fileChooser.setFiles('/path/to/file.pdf');

// Drag-and-drop only (no file input) — use filechooser approach
```

### Date Pickers

```javascript
await page.fill('input[type="date"]', '2026-03-15');
await page.fill('input[type="datetime-local"]', '2026-03-15T10:00');
// For custom pickers: click trigger → wait for grid → click day
```

### Toast / Snackbar

```javascript
await page.click('button[type="submit"]');
const toast = await page.waitForSelector(
  '[role="status"], [data-sonner-toast], [class*="toast"]', { timeout: 5000 }
).catch(() => null);
const text = toast ? await toast.textContent() : null;
```

### Tables

```javascript
await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => {});
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('table tbody tr')].map(row =>
    [...row.querySelectorAll('td')].map(td => td.textContent?.trim())
  )
);
```

### Browser Dialogs (alert/confirm/prompt)

```javascript
// Register handler BEFORE triggering action
page.once('dialog', async d => await d.accept());
await page.click('button:has-text("Delete")');
```

### Rich Text Editors

```javascript
const editor = page.locator('[contenteditable="true"]');
await editor.click();
await editor.pressSequentially('Hello world');
```

### Multiple Tabs

```javascript
const [newPage] = await Promise.all([
  page.context().waitForEvent('page'),
  page.click('a[target="_blank"]'),
]);
await newPage.waitForLoadState('domcontentloaded');
```

### Drag and Drop

```javascript
await page.locator('#source').dragTo(page.locator('#target'));
```

### File Downloads

```javascript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('button:has-text("Download")'),
]);
await download.saveAs('/tmp/' + download.suggestedFilename());
```

---

## Waiting Strategies

| Strategy | When | Reliability |
|----------|------|-------------|
| Locator auto-wait | Default for all actions | Best |
| waitForSelector | Wait for element after action | Great |
| waitForResponse | Wait for API before asserting | Great |
| waitForFunction | Arbitrary JS condition | Good |
| waitForTimeout | Last resort only | Fragile |

```javascript
// Wait for API — set up BEFORE triggering action
const resp = page.waitForResponse(r => r.url().includes('/api/data') && r.status() === 200);
await page.click('button:has-text("Save")');
await resp;

// Wait for loading to finish
await page.waitForFunction(() =>
  document.querySelectorAll('[class*="spinner"], [class*="skeleton"]').length === 0
, { timeout: 8000 }).catch(() => {});

// Wait for CSS transition
await page.waitForFunction(() => {
  const el = document.querySelector('.modal');
  return el && getComputedStyle(el).opacity === '1';
}, { timeout: 2000 }).catch(() => {});
```

---

## Long-Running Operations (MCP ~60s timeout)

Budget 50s per call. If not done, return `{ done: false }` and poll in the next call. The browser session persists.

```javascript
let done = false;
for (let i = 0; i < 25; i++) {
  done = await page.evaluate(() => !!document.querySelector('[data-status="done"]'));
  if (done) break;
  await page.waitForTimeout(2000);
}
return { done, url: page.url() };
```

---

## Scroll — Internal Containers

Many apps use `<main overflow-y-auto>` instead of window scroll. `window.scrollTo()` does nothing.

**Always use these helpers (included in shared block):**
```javascript
const findScroller = async () => page.evaluate(() => {
  let best = null, bestH = 0;
  for (const el of document.querySelectorAll('main, [role="main"], [class*="content"]')) {
    const s = getComputedStyle(el);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollHeight > bestH) {
      best = el; bestH = el.scrollHeight;
    }
  }
  if (best) { best.dataset.testScroller = '1'; return { height: best.scrollHeight, client: best.clientHeight }; }
  return null;
});
const scrollTo = async (top) => page.evaluate((t) => {
  (document.querySelector('[data-test-scroller]') || document.documentElement).scrollTop = t;
}, top);
```

---

## Form Input Discovery

When inputs have no `id`, `name`, or `placeholder`:

```javascript
const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')].map((el, i) => ({
    i, id: el.id, type: el.type, placeholder: el.placeholder?.substring(0,40),
    label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()?.substring(0,30)
      || el.closest('label')?.textContent?.trim()?.substring(0,30)
      || el.closest('div')?.querySelector('label')?.textContent?.trim()?.substring(0,30),
    visible: el.offsetHeight > 0,
  }))
);
// Fill by placeholder or nth position
await page.fill('input[placeholder="Name"]', 'Test');
const els = await page.$$('input:not([type="hidden"]):visible');
if (els[2]) await els[2].fill('value');
```

### Hidden Submit Buttons

```javascript
const btn = await page.evaluate(() => {
  for (const text of ['Save', 'Submit', 'Create', 'Send', 'Confirm', 'Generate']) {
    const b = [...document.querySelectorAll('button, [role="button"]')]
      .find(b => b.textContent?.includes(text) && !b.disabled);
    if (b) return { text: b.textContent?.trim(), visible: b.offsetHeight > 0 };
  }
  const sub = document.querySelector('button[type="submit"]:not([disabled])');
  return sub ? { text: sub.textContent?.trim(), visible: sub.offsetHeight > 0 } : null;
});
if (btn && !btn.visible) {
  await page.evaluate(() =>
    document.querySelector('button[type="submit"]')?.scrollIntoView({ block: 'center' })
  );
  await page.waitForTimeout(300);
}
```

---

## Prerequisite Chains

Many features require prior setup. **Always create data in dependency order:**

1. Register/login → complete onboarding (role selection, profile setup)
2. Create base records (clients, contacts)
3. Create dependent records (cases, invoices linked to clients)
4. Configure required profiles (billing, email accounts)
5. Then test features that depend on those records

**Test user accounts ≠ client/contact records.** Creating a user via registration does NOT create a client record. Create clients separately via the client creation flow.

### Data Creation via Wizards

When creating records through multi-step wizards, **pack the entire wizard traversal into a single `browser_run_code` call**:

```javascript
async (page) => {
  const go = async (url) => { /* ... */ };

  await go('/path/to/create');

  // Helper: advance to next step with inline discovery
  const nextStep = async () => {
    const d = await page.evaluate(() => ({
      step: document.body.innerText.match(/(?:step|paso)\s*(\d+)/i)?.[1],
      nextDisabled: [...document.querySelectorAll('button')]
        .find(b => /next|siguiente/i.test(b.textContent))?.disabled,
      radios: document.querySelectorAll('button[role="radio"]').length,
      inputs: document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea').length,
      accordions: [...document.querySelectorAll('button')]
        .filter(b => /\(\d+/i.test(b.textContent)).length,
      cards: [...document.querySelectorAll('button')]
        .filter(b => b.querySelector('h3') && b.offsetHeight > 0).length,
    }));
    return d;
  };

  // Step 1: discover → act → click Next
  let d = await nextStep();
  // ... fill/select based on d ...
  await page.click('button:has-text("Next")', { timeout: 2000 });
  await page.waitForTimeout(1000);

  // Step 2: discover → act → click Next
  d = await nextStep();
  // ... fill/select based on d ...
  // ... repeat for all steps ...

  // Final step: click Create/Submit
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => /create|crear|submit|confirm/i.test(b.textContent) && !b.disabled);
    if (btn) btn.click();
  });
  await page.waitForTimeout(5000);

  return { url: page.url(), created: !page.url().includes('/new') && !page.url().includes('/nuevo') };
};
```

**Key principle:** Each wizard step gets `discover → act → verify next enabled → advance` all inside the same call. Never return between steps.

---

## Fetch Errors During Rapid Navigation

`TypeError: Failed to fetch` during page-to-page navigation is **SAFE TO IGNORE**. Caused by React unmounting while fetch is in-flight. Use minimum 800ms waits between navigations (2000ms for API-heavy pages).

---

## Call 1 Template: Auth + Page Loads

```javascript
async (page) => {
  const BASE = process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || 'http://localhost:3000';
  const apiHeavy = new Set([/* '/dashboard/invoices', '/dashboard/calendar' */]);

  const go = async (url) => {
    try { await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 8000 }); }
    catch(e) {}
    await page.waitForTimeout(apiHeavy.has(url) ? 2000 : 800);
    return page.url();
  };

  const findScroller = async () => page.evaluate(() => {
    let best = null, bestH = 0;
    for (const el of document.querySelectorAll('main, [role="main"], [class*="content"]')) {
      const s = getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollHeight > bestH)
        { best = el; bestH = el.scrollHeight; }
    }
    if (best) { best.dataset.testScroller = '1'; return { height: best.scrollHeight, client: best.clientHeight }; }
    return null;
  });
  const scrollTo = async (top) => page.evaluate((t) => {
    (document.querySelector('[data-test-scroller]') || document.documentElement).scrollTop = t;
  }, top);

  const snap = async () => page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim()?.substring(0,80) || '(none)',
    b: document.querySelectorAll('button:not([disabled]), [role="button"]:not([disabled])').length,
    i: document.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="combobox"]').length,
    t: document.querySelectorAll('[role="tab"]').length,
    l: document.querySelectorAll('a[href]').length,
    err: document.querySelectorAll('[role="alert"]').length,
    loading: document.querySelectorAll('[class*="spinner"], [class*="skeleton"]').length > 0,
  }));

  // Hide persistent overlays upfront
  await page.addStyleTag({ content: '[class*="reminder" i], [class*="overlay" i]:not([role="dialog"]) { display: none !important; }' });

  // === AUTH (if needed — see login-register.md) ===

  // === PAGE LOADS ===
  const results = {};
  const pages = [/* routes relevant to test scope */];
  for (const url of pages) {
    try {
      const finalUrl = await go(url);
      const s = await snap();
      results[url] = { ...s, redirected: !finalUrl.includes(url) };
    } catch (e) {
      results[url] = { error: e.message?.substring(0, 100) };
    }
  }
  return { pages: results };
}
```

## Call 2 Template: Interactive Tests

```javascript
async (page) => {
  const BASE = process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || 'http://localhost:3000';
  const apiHeavy = new Set([]);
  const go = async (url) => {
    try { await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 8000 }); }
    catch(e) {}
    await page.waitForTimeout(apiHeavy.has(url) ? 2000 : 800);
  };

  const inventory = async () => page.evaluate(() => ({
    buttons: [...document.querySelectorAll('button:not([disabled]), [role="button"]:not([disabled])')].map(b => ({
      text: b.textContent?.trim().substring(0,60), type: b.type, testId: b.dataset?.testid,
    })).filter(b => b.text),
    inputs: [...document.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="combobox"]')].map(i => ({
      type: i.type || i.role || i.tagName.toLowerCase(), placeholder: i.placeholder?.substring(0,40),
      label: (i.closest('label')?.textContent?.trim() || document.querySelector(`label[for="${i.id}"]`)?.textContent?.trim() || '').substring(0,40),
    })),
    tabs: [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent?.trim().substring(0,30)),
  }));

  const retry = async (fn, n = 3, delay = 500) => {
    for (let i = 0; i < n; i++) {
      try { return await fn(); } catch(e) { if (i === n-1) throw e; await page.waitForTimeout(delay); }
    }
  };

  // === INTERACTIVE TESTS ===
  // Use inventory() to discover elements, go() to navigate, retry() for flaky actions
  // Use patterns from "Complex UI Patterns" section
}
```

---

## Pre-flight Check (Before Screenshots)

Overlays with `backdrop-filter: blur()` will blur the ENTIRE page in screenshots. CSS `display:none` on the overlay alone won't fix the blur — you must also remove the blur filter from affected containers.

```javascript
const pf = await page.evaluate(() => ({
  overlay: !!document.querySelector('[class*="reminder" i], [class*="overlay" i], [role="dialog"]'),
  scroller: !!document.querySelector('main, [role="main"]'),
  bodyHidden: getComputedStyle(document.body).overflow === 'hidden',
  hasBlur: [...document.querySelectorAll('*')].some(el => {
    const s = getComputedStyle(el);
    return s.backdropFilter?.includes('blur') || s.filter?.includes('blur');
  }),
}));
if (pf.overlay || pf.hasBlur) {
  // Remove overlay AND clear all blur filters in one pass
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.backdropFilter?.includes('blur') || s.filter?.includes('blur')) {
        el.style.backdropFilter = 'none';
        el.style.filter = 'none';
      }
    }
    document.querySelectorAll('[class*="reminder" i], [class*="Reminder"]').forEach(e => e.remove());
  });
  await page.addStyleTag({ content: '[class*="reminder" i] { display: none !important; }' });
}
if (pf.bodyHidden) await page.evaluate(() => { document.body.style.overflow = 'auto'; });
if (pf.scroller) await findScroller();
// NOW screenshot
```

---

## Screenshots

**Take when:** `h1: (none)`, `err > 0`, `loading: true`, after form submissions, debugging failures.
**Skip when:** Snap shows expected data with 0 errors.

```javascript
await page.screenshot({ path: '/tmp/test-page.png' });        // viewport
await page.screenshot({ path: '/tmp/test-full.png', fullPage: true }); // full page
const el = await page.$('.card'); if (el) await el.screenshot({ path: '/tmp/card.png' });
```

Max 2-4 screenshots per session. Read with `Read` tool to inspect.

---

## Console Errors

`snap()` already captures `[role="alert"]` count per page. Only call `browser_console_messages(level="error")` when `err > 0` needs diagnosis.

**Safe to ignore:**
- Hydration mismatch on time-dependent content
- `site.webmanifest` 404
- `Failed to fetch` during rapid navigation
- Resource loading warnings ("intentionally")

---

## If Tests Fail

1. Fix source code
2. `npm run build`
3. `fuser -k 3000/tcp; nohup npm run test:serve > playwright-dev-server.log 2>&1 &`
4. Re-test only the failing flow
5. Repeat

---

## Deep Functional Testing (CRITICAL — Not Just Page Loads)

**"Page loads without errors" is NOT sufficient testing.** You MUST verify functional correctness at the data level. A page that renders but shows wrong data, missing data, or raw IDs is a BROKEN page.

### What You MUST Test Beyond Page Rendering:

#### 1. Database Schema Verification
After creating tables/fields, verify they actually exist:
```javascript
// Use Totalum MCP: getAllDatabaseTables
// Then check: does every table have all expected objectReference fields?
// Missing objectReference = broken filtering, broken lookups, broken everything
```

#### 2. Data Correctness in Lists
```javascript
// BAD: "The /leads page loads, shows a table" ← INSUFFICIENT
// GOOD: Check the actual data
const rows = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('table tbody td, [role="row"] [role="cell"]')];
  return cells.slice(0, 20).map(c => c.textContent?.trim()?.substring(0, 50));
});
// Verify: no raw ObjectIDs (24-char hex strings like "507f1f77bcf86cd799439011")
// Verify: status badges show labels (e.g., "Active") not IDs
// Verify: owner/assignee columns show names not IDs
const hasRawIds = rows.some(r => /^[a-f0-9]{24}$/i.test(r));
if (hasRawIds) { /* FIX: objectReference fields are missing or not being expanded */ }
```

#### 3. Data Isolation (Entity Filtering)
```javascript
// When viewing entity X's sub-items, ONLY entity X's items should appear
// Navigate to /expedientes/123/acreedores
// Verify: the acreedores listed belong to expediente 123, NOT all acreedores in the system
// How to check: if you created 2 expedientes with 2 acreedores each, a single expediente
// should show 2 acreedores, not 4
```

#### 4. State Persistence
```javascript
// Change something (e.g., status dropdown)
await page.click('button:has-text("Change Status")');
await page.click('[role="option"]:has-text("Approved")');
await page.waitForTimeout(1000);
// REFRESH the page
await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
await page.waitForTimeout(1500);
// Verify the change PERSISTED
const currentStatus = await page.evaluate(() =>
  document.querySelector('[data-status], .status-badge, .badge')?.textContent?.trim()
);
// If status reverted → the update API failed silently or the field doesn't exist
```

#### 5. Form Submissions Actually Work
```javascript
// Fill and submit a form
await page.fill('input[name="name"]', 'Test Record');
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);
// Verify: success toast appeared OR redirect to list happened
// Navigate to the list page and verify the new record actually appears
await page.goto('/items', { waitUntil: 'domcontentloaded', timeout: 8000 });
await page.waitForTimeout(1500);
const found = await page.evaluate(() =>
  [...document.querySelectorAll('table td, .list-item')].some(el => el.textContent?.includes('Test Record'))
);
if (!found) { /* FIX: form submission didn't actually create the record */ }
```

#### 6. Authentication End-to-End
```javascript
// Don't just check login page renders — test the FULL flow
// 1. Register a new user (or use test user)
// 2. Login with those credentials
// 3. Verify redirect to dashboard/home (not stuck on login)
// 4. Verify the logged-in user sees correct data (their name in header, etc.)
// 5. Navigate to protected pages — verify they work
// 6. Logout — verify redirect to login
// 7. Try accessing protected page — verify redirect to login
```

#### 7. Reference Expansion (Names vs IDs)
```javascript
// On any page showing records with references, verify human-readable names
// Check: owner fields show "John Doe" not "507f1f77bcf86cd799439011"
// Check: status fields show "Active" with color badge, not an ID string
// Check: related entity fields show names/titles, not raw IDs
const pageText = await page.evaluate(() => document.body.textContent);
const rawIdPattern = /[a-f0-9]{24}/gi;
const matches = pageText.match(rawIdPattern) || [];
// Filter out known non-ID hex strings (colors, hashes, etc.)
// If IDs appear in data cells → objectReference expansion is not working
```

#### 8. Cross-Entity Navigation
```javascript
// Click a reference link (e.g., client name in an expediente)
// Verify: it navigates to the correct detail page for that entity
// Verify: the detail page shows the RIGHT data (not a different entity)
```

### Testing in Auto-Execution Mode (No-Stop)

When running as part of no-stop auto-execution, testing must be EXTRA thorough because:
1. **No human will review between prompts** — bugs compound if not caught immediately
2. **Next prompt builds on your work** — a broken foundation means everything breaks
3. **Fix bugs from previous prompts if you find them** — do NOT ignore issues just because they're from a prior step

**Auto-execution testing checklist (do ALL of these):**
- [ ] `npm run build` passes with zero errors
- [ ] Home page loads and has navigation to all built features
- [ ] All new pages render with real data (not empty, not errors)
- [ ] No raw ObjectIDs visible anywhere in the UI
- [ ] Forms create/update records that persist after refresh
- [ ] Status/state changes persist after refresh
- [ ] List pages show correct filtered data (not all records)
- [ ] Auth flow works end-to-end (if applicable)
- [ ] If previous prompts built features, spot-check they still work
- [ ] All acceptance criteria (if provided) pass

---

## Cleanup

1. `browser_close`
2. `kill -9 $(lsof -t -i:3000) 2>/dev/null; kill -9 $(lsof -t -i:3010) 2>/dev/null; rm -f playwright-dev-server.log`
3. No env restore needed — `NEXT_PUBLIC_APP_URL` was never modified
