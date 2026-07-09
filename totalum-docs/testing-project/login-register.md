# Login & Register

**Only read this doc if the test scenario requires authentication.** If testing public pages, skip to `testing.md`.

---

## Decision Tree

1. **Check for cached cookie** (run in parallel with setup step 2):

   ```bash
   TEST_EMAIL="THE_TEST_EMAIL"
   COOKIE_DIR=".playwright-mcp/cookie/$(echo $TEST_EMAIL | sed 's/@/_at_/g')"
   if [ -f "$COOKIE_DIR/cookies.json" ]; then
     node -e "
       const c = require('./' + process.argv[1]);
       const now = Date.now() / 1000;
       const sessionCookie = c.find(ck => ck.name === 'better-auth.session_token');
       if (sessionCookie && sessionCookie.expires > now) {
         const hoursLeft = ((sessionCookie.expires - now) / 3600).toFixed(1);
         console.log('COOKIE_VALID hours_left=' + hoursLeft);
       } else {
         console.log('COOKIE_EXPIRED');
       }
     " "$COOKIE_DIR/cookies.json" 2>/dev/null || echo "COOKIE_INVALID"
   else
     echo "NO_CACHED_COOKIE"
   fi
   ```
2. **Choose path based on result:**

| Result                                         | Action                                                   |
| ---------------------------------------------- | -------------------------------------------------------- |
| `COOKIE_VALID`                               | Use**Cached Cookie Injection** in Call 1 (fastest) |
| `NO_CACHED_COOKIE` + no specific user needed | Use**Register New Test User** in Call 1            |
| `NO_CACHED_COOKIE` + specific user required  | Use**Login Existing User** (full flow below)       |
| `COOKIE_EXPIRED` / `COOKIE_INVALID`        | Delete stale cookie, then Register or Login              |

---

## Cookie Session Details

| Cookie                        | Max-Age                    | Purpose                                                   |
| ----------------------------- | -------------------------- | --------------------------------------------------------- |
| `better-auth.session_token` | **7 days** (604800s) | Main session token — validated against `session` table |
| `better-auth.session_data`  | **5 min** (300s)     | Cached session data — auto-refreshed by Better Auth      |

**Only `session_token` matters for reuse.** The `session_data` cache cookie is auto-refreshed by Better Auth when the server validates the session token.

**Session refresh behavior:** If `updateAge` (1 day) has passed since last refresh, Better Auth auto-extends the session by setting a new `expires_at = now + 7 days`. This means actively used cookies can last indefinitely.

---

## Save Cookies (applies to ALL paths — register, login, and cached cookie refresh)

**After any Call 1 that returns `loginResult.cookies`, IMMEDIATELY save them:**

```bash
TEST_EMAIL="THE_TEST_EMAIL"
COOKIE_DIR=".playwright-mcp/cookie/$(echo $TEST_EMAIL | sed 's/@/_at_/g')"
mkdir -p "$COOKIE_DIR"
cat > "$COOKIE_DIR/cookies.json" << 'COOKIES_EOF'
PASTE_THE_COOKIES_ARRAY_JSON_HERE
COOKIES_EOF
echo "Cookies saved for $TEST_EMAIL"
```

---

## Path A: Cached Cookie Injection (in Call 1)

Inject the saved session cookie directly into the browser context, bypassing login form and cookie consent entirely.

Use this template in your Call 1 `browser_run_code` **before** page loads:

```javascript
// === COOKIE INJECTION (replaces full login flow) ===
// PASTE_COOKIES_HERE — replace with the contents of .playwright-mcp/cookie/{email}/cookies.json
const savedCookies = PASTE_COOKIES_ARRAY_HERE;
await page.context().addCookies(savedCookies);

// Verify cookie works by navigating to dashboard
const dashUrl = await go('/dashboard');
const loggedIn = !dashUrl.includes('/login');
const loginResult = { url: dashUrl, loggedIn, method: 'cached_cookie' };

// If cookie was rejected (redirected to login), fall back info
if (!loggedIn) {
  return { login: { ...loginResult, error: 'CACHED_COOKIE_REJECTED — delete cookie file and use register or login' }, pages: {} };
}
```

**If the cached cookie is rejected** (`CACHED_COOKIE_REJECTED`):

1. Delete the stale cookie file: `rm -f .playwright-mcp/cookie/{email}/cookies.json`
2. Fall back to Register or Login
3. The new flow will save fresh cookies automatically

---

## Path B: Register New Test User (in Call 1)

**Preferred when no specific user is required.** Registers a new user, accepts the contract, extracts cookies. Uses `page.evaluate` for all dialog interactions to bypass overlay pointer event interception.

**Important**: not change current email of a existing user to login, just register with a new user to avoid edit real users data.

**Before pasting:** Quick-check the register page (`src/app/register/page.tsx`) for any form field changes. Adapt selectors if needed.

Use this template as your full Call 1 `browser_run_code`:

```javascript
async (page) => {
  const apiHeavy = new Set([/* e.g. '/dashboard/invoices', '/dashboard/calendar' */]);

  const go = async (url) => {
    try { await page.goto((process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || 'http://localhost:3000') + url, { waitUntil: 'domcontentloaded', timeout: 8000 }); }
    catch(e) {}
    await page.waitForTimeout(apiHeavy.has(url) ? 1500 : 500);
    return page.url();
  };

  const snap = async () => page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim()?.substring(0,80) || '(none)',
    buttons: document.querySelectorAll('button:not([disabled])').length,
    inputs: document.querySelectorAll('input:not([type="hidden"]), textarea, select').length,
    tabs: document.querySelectorAll('[role="tab"]').length,
    links: document.querySelectorAll('a[href]').length,
    errors: document.querySelectorAll('[role="alert"]').length,
  }));

  // === REGISTER PAGE ===
  await go('/register');

  // Cookie consent (via evaluate to avoid overlay issues)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    for (const text of ['Solo cookies esenciales', 'Aceptar', 'Accept', 'Got it']) {
      const btn = btns.find(b => b.textContent?.includes(text));
      if (btn) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(300);

  // Generate random test user credentials
  const testId = Math.random().toString(36).slice(2, 8);
  const testEmail = `test.project-name.${testId}@testmail.com`;
  const testName = `Test User ${testId}`;
  const testPwd = 'Test' + testId + '1';

  // Fill form via evaluate (React-compatible value setter)
  await page.evaluate(({ email, name, pwd }) => {
    const setVal = (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setVal(document.querySelector('input#name'), name);
    setVal(document.querySelector('input#email'), email);
    setVal(document.querySelector('input#password'), pwd);
    setVal(document.querySelector('input#confirmPassword'), pwd);
  }, { email: testEmail, name: testName, pwd: testPwd });
  await page.waitForTimeout(500);

  // Open contract dialog
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Leer y aceptar'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);

  // Scroll contract to bottom (triggers scroll handler to enable accept button)
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const sc = dialog?.querySelector('.overflow-y-auto');
      if (sc) {
        sc.scrollTop = sc.scrollHeight;
        sc.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
  }

  // Accept contract via evaluate
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const btn = [...dialog.querySelectorAll('button')].find(b => b.textContent?.includes('Acepto') && !b.disabled);
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  // Submit registration form
  await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn && !btn.disabled) btn.click();
  });

  // Wait for redirect away from /register (max 10s)
  let registered = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if (!page.url().includes('/register')) { registered = true; break; }
  }

  const loginResult = { url: page.url(), loggedIn: registered, method: 'registration', testEmail, testName, testPwd };

  // Extract cookies for caching
  if (registered) {
    const cookies = await page.context().cookies(process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || 'http://localhost:3000');
    loginResult.cookies = cookies.filter(c => c.name.includes('better-auth'));
  }

  // === PAGE LOADS ===
  const results = {};
  if (registered) {
    const pages = [
      // INSERT TIER 1 + TIER 2 ROUTES HERE (max 15-20)
    ];
    for (const url of pages) {
      const finalUrl = await go(url);
      const s = await snap();
      results[url] = { h1: s.h1, b: s.buttons, i: s.inputs, t: s.tabs, l: s.links, err: s.errors, redirected: !finalUrl.includes(url) };
    }
  }

  return { login: loginResult, pages: results };
}
```

**After Call 1 with REGISTRATION:**

1. **Save cookies to disk** using the save snippet above.
2. **Note:** New users are redirected to `/onboarding/choose-role`. All `/dashboard/*` routes will redirect there until a role is selected. Handle role selection in Call 2.

---

## Path C: Login with Existing User

**Only use when a specific existing user is required.** This needs password hash generation and DB update before login.

### Step 1: Generate password hash

**MUST use a temp file** to avoid bash shell escaping issues with `!` and `!==`. **NEVER use `npx tsx -e "..."` inline.**

```bash
cat > /tmp/gen-hash.ts << 'HASHSCRIPT'
import { webcrypto } from 'node:crypto';
if (typeof globalThis.crypto === 'undefined') { (globalThis as any).crypto = webcrypto; }
import { hashPassword, verifyPassword } from '/ABSOLUTE/PATH/TO/PROJECT/src/lib/auth/password';
async function main() {
  const pwd = 'Test' + Math.random().toString(36).slice(2, 10) + 'X';
  const hash = await hashPassword(pwd);
  const ok = await verifyPassword(pwd, hash);
  if (!ok || hash.length !== 161) { console.error('HASH VERIFY FAILED'); process.exit(1); }
  console.log(pwd);
  console.log(hash);
}
main();
HASHSCRIPT
npx tsx /tmp/gen-hash.ts 2>&1
```

**CRITICAL password rules:**

- **NEVER use `!` in generated passwords** — bash history expansion corrupts them
- **NEVER use `npx tsx -e "..."` inline** — `!==` and `!` cause `Syntax error "!"` from esbuild
- **Always use a temp file** with heredoc (`<< 'EOF'`) for hash generation
- **Always use `webcrypto` polyfill** — Node 18 doesn't have global `crypto`
- **Always use the project's own hashPassword** — Node.js `crypto.scrypt` produces DIFFERENT output than `@noble/hashes/scrypt` (Better Auth)

If the project doesn't have `src/lib/auth/password.ts`, fallback to Node.js crypto via temp file.

### Step 2: Find user and update password in DB

**Query by `user_id` (NOT `account_id`)** to find ALL credential accounts for the user, including duplicates:

```
First, find the user: mcp__totalum__query on table "user" with filter {"email": "THE_TEST_EMAIL"}, _limit: 1, _select: {"_id": true, "email": true}
Then, find ALL credential accounts: mcp__totalum__query on table "account" with filter {"provider_id": "credential", "user_id": "THE_USER_ID"}, _select: {"_id": true, "account_id": true, "user_id": true, "password": true}
```

If you don't know the test email yet, query with just `{"provider_id": "credential"}` but add `_select: {"_id": true, "account_id": true, "user_id": true}` to reduce payload (omit password field).

Update password via `editRecordProperties` on ALL credential accounts for the test user.

### Step 3: Login via Python (after server is started)

```bash
python3 << 'PYEOF'
import urllib.request, json, os, time

email = "EMAIL_HERE"
pwd = "PWD_HERE"
cookie_dir = ".playwright-mcp/cookie/" + email.replace("@", "_at_")
os.makedirs(cookie_dir, exist_ok=True)

data = json.dumps({"email": email, "password": pwd}).encode()
base_url = os.environ.get("LOCAL_NEXTJS_PROJECT_TESTING_URL", "http://localhost:3000")
req = urllib.request.Request(base_url + "/api/auth/sign-in/email", data=data, headers={"Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req)
    print("LOGIN OK", resp.status)
    cookies = []
    for header in resp.headers.get_all("Set-Cookie") or []:
        parts = header.split(";")
        nv = parts[0].strip()
        eq = nv.index("=")
        cookie = {"name": nv[:eq], "value": nv[eq+1:], "domain": "localhost", "path": "/", "httpOnly": True, "secure": False, "sameSite": "Lax"}
        for p in parts[1:]:
            p = p.strip()
            if p.lower().startswith("max-age="):
                cookie["expires"] = time.time() + int(p.split("=")[1])
        cookies.append(cookie)
    with open(cookie_dir + "/cookies.json", "w") as f:
        json.dump(cookies, f, indent=2)
    sc = next((c for c in cookies if "session_token" in c["name"]), None)
    print("COOKIES SAVED, expires in", round((sc["expires"] - time.time()) / 3600, 1), "hours")
except urllib.error.HTTPError as e:
    print("LOGIN FAILED", e.code)
PYEOF
```

**The login should succeed on the FIRST attempt.** No warm-up sleep needed. The old "cold-start scrypt" failures were caused by bash `!` escaping corrupting passwords, not by scrypt needing warm-up time.

**Rate limiter note:** Better Auth's rate limiter is **per-email** (max 3 per 10s), NOT global. You can login multiple different users back-to-back without waiting.

If login fails: check that the password in the DB matches what was generated. Verify the hash length is exactly 161 chars. Do NOT rapid-fire retries on the same email.

### Alternative: Login via Browser (Call 1 template)

Use this in Call 1 instead of cookie injection when you already have the password but no cached cookie:

```javascript
// === LOGIN (inside Call 1 browser_run_code) ===
await go('/login');
// Cookie consent
for (const text of ['Solo cookies esenciales', 'Aceptar', 'Accept', 'Got it']) {
  const btn = await page.$(`button:has-text("${text}")`);
  if (btn) { await btn.click(); await page.waitForTimeout(300); break; }
}
// Discover + fill login form
const inputs = await page.$$eval('input:not([type="hidden"])', els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder })));
const emailIn = inputs.find(i => i.type === 'email' || /email/i.test(i.name + i.placeholder));
const passIn = inputs.find(i => i.type === 'password' || /password/i.test(i.name + i.placeholder));
const eSel = emailIn?.placeholder ? `input[placeholder="${emailIn.placeholder}"]` : 'input[type="email"]';
const pSel = passIn?.placeholder ? `input[placeholder="${passIn.placeholder}"]` : 'input[type="password"]';
await page.fill(eSel, 'TEST_EMAIL');
await page.fill(pSel, 'PWD_HERE');
const submitBtn = await page.$('button[type="submit"]');
if (submitBtn) await submitBtn.click();
// Smart login wait: poll URL every 500ms, max 5s
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(500);
  if (!page.url().includes('/login')) break;
}
const loginResult = { url: page.url(), loggedIn: !page.url().includes('/login') };

// === SAVE COOKIES after successful login ===
if (loginResult.loggedIn) {
  const cookies = await page.context().cookies(process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || 'http://localhost:3000');
  loginResult.cookies = cookies.filter(c => c.name.includes('better-auth'));
}
```

**Login wait: 5s max** — Do NOT use 8s. After click submit, wait 5s then check URL. If not redirected, wait 2s more (7s total max).
