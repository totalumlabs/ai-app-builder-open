# Setup


## 0. Check if current project supports testing with `LOCAL_NEXTJS_PROJECT_TESTING_URL`

If not, check `testing-url-setup.md` to patch the project for testing support. 

## 1. Kill zombies + check env + discover routes — run ALL THREE in parallel:

```
fuser -k 3000/tcp 2>/dev/null || true; sleep 1; fuser -k 3000/tcp 2>/dev/null || true; for i in 1 2 3; do fuser 3000/tcp >/dev/null 2>&1 || break; sleep 1; fuser -k 3000/tcp 2>/dev/null || true; done; fuser -k 3010/tcp 2>/dev/null || true
```
```
grep 'LOCAL_NEXTJS_PROJECT_TESTING_URL' .env | head -1
```
```
find src/app -name "page.tsx" -o -name "page.jsx" | sort
```
The `.env` file already contains `LOCAL_NEXTJS_PROJECT_TESTING_URL=http://localhost:3000` (set automatically by the platform for testing mode). Use this variable as the base URL for all test requests instead of `NEXT_PUBLIC_APP_URL`. **Do NOT modify `NEXT_PUBLIC_APP_URL`** — it must keep pointing to the user preview URL.


## 2. Build (always rebuild — source may have changed before testing):

```bash
rm -rf .next && NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 | tail -5
```

If build fails: check for type errors and fix them. If `test:serve` script missing, add: `"test:serve": "TESTING_MODE=true NEXT_TELEMETRY_DISABLED=1 DISABLE_OPENNEXT=true PORT=3000 next start"`

## 3. Start server

**First verify port 3000 is free**, then start:
```bash
fuser 3000/tcp >/dev/null 2>&1 && echo "ERROR: port 3000 still in use" || echo "Port 3000 free"
```

If port is still in use, run `kill -9 $(fuser -t 3000/tcp 2>/dev/null)` and wait 2 seconds.

Then start the server:
```bash
nohup npm run test:serve > playwright-dev-server.log 2>&1 &
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$code" = "200" ] || [ "$code" = "302" ] || [ "$code" = "307" ]; then
    echo "Server ready at ${i}s"
    break
  fi
  sleep 1
done
```

## 4. Clear browser cache (MANDATORY after rebuild)

The Playwright MCP reuses its browser context, so old JS/CSS chunks from previous builds stay cached and cause 404s or stale pages. **Always clear the cache before navigating:**

```javascript
// In your first browser_run_code call, before any page.goto:
const client = await page.context().newCDPSession(page);
await client.send('Network.clearBrowserCache');
await client.send('Network.clearBrowserCookies');
```

## 5. Set viewport size (MANDATORY)

**Default viewport: 1920x1080 (desktop).** Always resize the browser immediately after the first `browser_run_code` or `browser_navigate` call:

```
mcp__playwright__browser_resize(width: 1920, height: 1080)
```

| Scenario | Size | When |
|----------|------|------|
| **Default (always)** | `1920x1080` | Every test session unless user says otherwise |
| Mobile testing | `375x812` | Only when user explicitly requests mobile/responsive testing |
| Tablet testing | `768x1024` | Only when user explicitly requests tablet testing |

**NEVER use 768x1024 (Playwright's default) unless the user specifically asks for tablet viewport.** The default 768x1024 triggers tablet responsive layouts and hides sidebar navigation, giving unreliable test results for desktop features.

---

## Next step

- **If auth is needed:** Read `login-register.md` to authenticate before testing.
- **If no auth needed:** Go directly to `testing.md`.
