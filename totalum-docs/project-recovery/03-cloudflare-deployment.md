---
name: cloudflare-deployment
description: "Cloudflare Workers deployment configuration: open-next.config.ts, instrumentation.ts, and wrangler.jsonc. Required for deploying Next.js to Cloudflare Workers."
---

# Cloudflare Deployment Recovery

These files enable Next.js deployment to Cloudflare Workers using OpenNext.

## open-next.config.ts

Minimal Cloudflare configuration for OpenNext.

### Complete open-next.config.ts Template

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Uncomment to enable R2 cache for improved performance
  // It should be imported as:
  // `import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";`
  // See https://opennext.js.org/cloudflare/caching for more details
  // incrementalCache: r2IncrementalCache,
});
```

### Optional: R2 Caching

For better performance, enable R2 caching:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
```

**Note:** R2 caching requires Cloudflare R2 bucket configuration in wrangler.jsonc.

---

## instrumentation.ts

Next.js instrumentation file that runs before everything else.

### Complete instrumentation.ts Template

```typescript
/**
 * Next.js Instrumentation
 * Runs before everything else - ensures logger loads first
 *
 * IMPORTANT: Disabled for Cloudflare Workers deployment
 * The 'nodejs' runtime check prevents this from running in Workers,
 * but we also need to handle the case where the hook itself fails to load
 */

export function register() {
  // Skip instrumentation in Cloudflare Workers environment
  // Workers don't have process.env.NEXT_RUNTIME === 'nodejs'
  // They also don't support require() in this context
  if (typeof process === 'undefined') {
    return; // Cloudflare Workers environment
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only load logger in actual Node.js environment (dev/build)
    // This won't run in Cloudflare Workers
    try {
      require('./src/lib/backend-logger');
    } catch (error) {
      console.warn('Failed to load backend logger:', error);
    }
  }
}
```

### How Instrumentation Works

1. **Called by Next.js** before any other code runs
2. **Environment detection:**
   - `typeof process === 'undefined'` → Cloudflare Workers
   - `process.env.NEXT_RUNTIME === 'nodejs'` → Node.js server
3. **Loads logger** only in Node.js environments
4. **Fails gracefully** if logger cannot be loaded

### Why This Matters

- **Cloudflare Workers** don't have Node.js `require()` or `process`
- **Backend logger** patches console globally for timestamps
- **Must load first** to capture all console output

---

## wrangler.jsonc

Cloudflare Wrangler configuration for deployment.

### Complete wrangler.jsonc Template

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "your-project-name",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  },
  // Environment variables for production
  "vars": {
    "NODE_ENV": "production"
  }
  // Optional: KV namespace binding
  // "kv_namespaces": [
  //   {
  //     "binding": "KV_CACHE",
  //     "id": "your-kv-namespace-id"
  //   }
  // ]
  // Optional: R2 bucket binding
  // "r2_buckets": [
  //   {
  //     "binding": "R2_CACHE",
  //     "bucket_name": "your-bucket-name"
  //   }
  // ]
}
```

### Configuration Explained

| Field | Purpose |
|-------|---------|
| `name` | Project name in Cloudflare dashboard |
| `main` | Entry point (OpenNext generates this) |
| `compatibility_date` | Cloudflare Workers API version |
| `compatibility_flags` | Enable Node.js compatibility |
| `assets` | Static file serving configuration |
| `observability` | Enable logging in Cloudflare dashboard |
| `vars` | Environment variables |

### Setting Environment Variables

For sensitive values (API keys), use Wrangler secrets:

```bash
# Set secrets via CLI (not stored in wrangler.jsonc)
npx wrangler secret put TOTALUM_API_KEY
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
```

---

## public/_headers (Cloudflare Pages)

Custom headers for Cloudflare Pages (if using Pages instead of Workers):

```
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/api/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Deployment Commands

### Build for Cloudflare

```bash
# Build the project for Cloudflare Workers
npm run cloudflare-build
```

This runs `opennextjs-cloudflare build` which:
1. Builds Next.js application
2. Transforms output for Cloudflare Workers
3. Creates `.open-next/` directory with worker files

### Preview Locally

```bash
# Build and preview with Wrangler
npm run preview
```

Tests the Cloudflare Workers build locally using Wrangler.

### Deploy to Cloudflare

```bash
# Build and deploy to Cloudflare Workers
npm run cloudflare-deploy
```

This runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`.

### Manual Wrangler Deploy

```bash
# Alternative: Deploy using Wrangler directly
npx wrangler deploy
```

---

## Environment Differences

| Feature | Local Dev | Cloudflare Workers |
|---------|-----------|-------------------|
| `process` object | Available | Not available |
| `require()` | Works | Not supported |
| Node.js APIs | Full support | Limited (nodejs_compat) |
| File system | Available | Not available |
| Environment vars | `.env` file | Wrangler secrets |
| Console logging | Standard | Cloudflare dashboard |

### Code Patterns for Compatibility

```typescript
// Check if running in Cloudflare Workers
if (typeof process === 'undefined') {
  // Cloudflare Workers code
} else {
  // Node.js code
}

// Or use NEXT_RUNTIME
if (process.env.NEXT_RUNTIME === 'nodejs') {
  // Node.js server-side code
}
```

---

## Troubleshooting

### "Cannot find module" Errors

Ensure the module is compatible with Cloudflare Workers. Some Node.js modules don't work in Workers.

### Build Fails with OpenNext

```bash
# Clear build cache and rebuild
rm -rf .open-next .next
npm run cloudflare-build
```

### Environment Variables Not Working

1. Check wrangler.jsonc `vars` section
2. Set secrets with `npx wrangler secret put VARIABLE_NAME`
3. Verify in Cloudflare dashboard under Workers > Settings > Variables

---

## Recovery Checklist

- [ ] open-next.config.ts exists at project root
- [ ] instrumentation.ts exists at project root
- [ ] wrangler.jsonc exists with correct project name
- [ ] package.json has cloudflare scripts (cloudflare-build, cloudflare-deploy)
- [ ] @opennextjs/cloudflare is in dependencies
- [ ] wrangler is in devDependencies
- [ ] Environment secrets are set in Cloudflare
- [ ] Build succeeds with `npm run cloudflare-build`
