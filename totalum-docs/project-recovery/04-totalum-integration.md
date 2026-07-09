---
name: totalum-integration
description: "Totalum platform integration files: lib/totalum.ts for SDK setup, better-auth-totalum-adapter.ts for authentication, auth.ts for server-side auth, auth-client.ts for client-side auth."
---

# Totalum Integration Recovery

These files connect your Next.js application to the Totalum platform.

## src/lib/totalum.ts

The Totalum SDK singleton instance.

### Complete totalum.ts Template

```typescript
import 'server-only'; // CRITICAL: Prevents client-side exposure
import { TotalumApiSdk, type AuthOptions } from 'totalum-api-sdk';

const apiKey = process.env.TOTALUM_API_KEY || 'test-api-key';
const baseUrl = process.env.TOTALUM_API_URL || 'https://api.totalum.app/';

const options: AuthOptions = {
  apiKey: { 'api-key': apiKey }
};

export const totalumSdk = new TotalumApiSdk(options);

totalumSdk.changeBaseUrl(baseUrl);
```

### Why 'server-only'?

```typescript
import 'server-only';
```

**This import is CRITICAL.** It:
1. Prevents the SDK from being bundled in client-side code
2. Protects your API key from exposure
3. Causes build errors if accidentally imported in client components

### Usage in Server Components

```typescript
import { totalumSdk } from '@/lib/totalum';

// In a Server Component or API route
const users = await totalumSdk.crud.getItems('user');
```

---

## src/lib/better-auth-totalum-adapter.ts

Custom adapter that bridges Better Auth with Totalum's database.

### Complete better-auth-totalum-adapter.ts Template

```typescript
import type { Adapter, Where } from 'better-auth';
import type { TotalumApiSdk } from 'totalum-api-sdk';

interface TotalumAdapterConfig {
  debugLogs?: boolean;
  collectionPrefix?: string;
}

// Field name mappings between Better Auth (camelCase) and Totalum (snake_case)
const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  user: {
    id: '_id',
    emailVerified: 'email_verified',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  session: {
    id: '_id',
    userId: 'user_id',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
  },
  account: {
    id: '_id',
    userId: 'user_id',
    accountId: 'account_id',
    providerId: 'provider_id',
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    accessTokenExpiresAt: 'access_token_expires_at',
    refreshTokenExpiresAt: 'refresh_token_expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    idToken: 'id_token',
  },
  verification: {
    id: '_id',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

// Totalum auto-generated fields that shouldn't be converted
const TOTALUM_AUTO_FIELDS = ['_id', 'createdAt', 'updatedAt', 'createdBy'];

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if field is a Totalum auto-generated field
 */
function isTotalumAutoField(key: string): boolean {
  return TOTALUM_AUTO_FIELDS.includes(key);
}

/**
 * Convert object keys from camelCase to snake_case for Totalum
 * Preserves Totalum auto-fields unchanged
 */
function objectToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined values
    if (value === undefined) continue;

    // Keep Totalum auto-fields unchanged
    if (isTotalumAutoField(key)) {
      result[key] = value;
      continue;
    }

    const snakeKey = toSnakeCase(key);

    // Handle special conversions
    if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map(item =>
        typeof item === 'object' && item !== null
          ? objectToSnakeCase(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[snakeKey] = objectToSnakeCase(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Convert object keys from snake_case to camelCase for Better Auth
 */
function objectToCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Map _id to id
    const camelKey = key === '_id' ? 'id' : toCamelCase(key);

    // Handle nested objects and arrays
    if (Array.isArray(value)) {
      result[camelKey] = value.map(item =>
        typeof item === 'object' && item !== null
          ? objectToCamelCase(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[camelKey] = objectToCamelCase(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Convert Better Auth WHERE clause to Totalum filter format
 */
function convertWhereToTotalumFilter(where: Where[]): Array<Record<string, unknown>> {
  return where.map(condition => {
    const field = condition.field === 'id' ? '_id' : toSnakeCase(condition.field);
    const operator = condition.operator || 'eq';
    const value = condition.value;

    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'ne':
        return { [field]: { ne: value } };
      case 'contains':
        return { [field]: { regex: value, options: 'i' } };
      case 'starts_with':
        return { [field]: { regex: `^${value}`, options: 'i' } };
      case 'ends_with':
        return { [field]: { regex: `${value}$`, options: 'i' } };
      case 'gt':
      case 'gte':
        return { [field]: { gte: value } };
      case 'lt':
      case 'lte':
        return { [field]: { lte: value } };
      case 'in':
        // Totalum doesn't support $in, use OR conditions
        if (Array.isArray(value) && value.length > 0) {
          return { or: value.map(v => ({ [field]: v })) };
        }
        return { [field]: value };
      default:
        return { [field]: value };
    }
  });
}

/**
 * Create the Totalum adapter for Better Auth
 */
export function totalumAdapter(
  sdk: TotalumApiSdk,
  config: TotalumAdapterConfig = {}
): Adapter {
  const { collectionPrefix = 'ba_' } = config;

  const getCollection = (model: string): string => {
    return `${collectionPrefix}${model}`;
  };

  return {
    id: 'totalum',

    async create({ model, data }) {
      const collection = getCollection(model);
      const snakeCaseData = objectToSnakeCase(data);

      const response = await sdk.crud.createItem(collection, snakeCaseData);
      const created = response.data?.item || response.data;

      return objectToCamelCase(created) as Record<string, unknown>;
    },

    async findOne({ model, where, select }) {
      const collection = getCollection(model);
      const filter = convertWhereToTotalumFilter(where);

      const response = await sdk.crud.getItems(collection, {
        filter,
        limit: 1,
      });

      const items = response.data?.items || [];
      if (items.length === 0) return null;

      const item = objectToCamelCase(items[0]) as Record<string, unknown>;

      // Apply select filter if provided
      if (select && select.length > 0) {
        const filtered: Record<string, unknown> = {};
        for (const key of select) {
          if (key in item) filtered[key] = item[key];
        }
        return filtered;
      }

      return item;
    },

    async findMany({ model, where, limit, offset, sortBy }) {
      const collection = getCollection(model);
      const filter = where ? convertWhereToTotalumFilter(where) : undefined;

      const sort = sortBy
        ? { [toSnakeCase(sortBy.field)]: sortBy.direction === 'asc' ? 1 : -1 }
        : undefined;

      const response = await sdk.crud.getItems(collection, {
        filter,
        limit,
        skip: offset,
        sort,
      });

      const items = response.data?.items || [];
      return items.map(item => objectToCamelCase(item) as Record<string, unknown>);
    },

    async count({ model, where }) {
      const collection = getCollection(model);
      const filter = where ? convertWhereToTotalumFilter(where) : undefined;

      const response = await sdk.crud.getItems(collection, {
        filter,
        returnCount: true,
        limit: 0,
      });

      return response.data?.count || 0;
    },

    async update({ model, where, data }) {
      const collection = getCollection(model);
      const filter = convertWhereToTotalumFilter(where);

      // Find the item first
      const findResponse = await sdk.crud.getItems(collection, {
        filter,
        limit: 1,
      });

      const items = findResponse.data?.items || [];
      if (items.length === 0) return null;

      const itemId = items[0]._id;
      const snakeCaseData = objectToSnakeCase(data);

      // Remove _id from update data
      delete snakeCaseData._id;

      await sdk.crud.editItem(collection, itemId, snakeCaseData);

      // Fetch updated item
      const updatedResponse = await sdk.crud.getItemById(collection, itemId);
      const updated = updatedResponse.data?.item || updatedResponse.data;

      return objectToCamelCase(updated) as Record<string, unknown>;
    },

    async updateMany({ model, where, data }) {
      const collection = getCollection(model);
      const filter = where ? convertWhereToTotalumFilter(where) : undefined;

      const findResponse = await sdk.crud.getItems(collection, { filter });
      const items = findResponse.data?.items || [];

      const snakeCaseData = objectToSnakeCase(data);
      delete snakeCaseData._id;

      const updated: Array<Record<string, unknown>> = [];

      for (const item of items) {
        await sdk.crud.editItem(collection, item._id, snakeCaseData);
        const updatedResponse = await sdk.crud.getItemById(collection, item._id);
        const updatedItem = updatedResponse.data?.item || updatedResponse.data;
        updated.push(objectToCamelCase(updatedItem) as Record<string, unknown>);
      }

      return updated;
    },

    async delete({ model, where }) {
      const collection = getCollection(model);
      const filter = convertWhereToTotalumFilter(where);

      const findResponse = await sdk.crud.getItems(collection, {
        filter,
        limit: 1,
      });

      const items = findResponse.data?.items || [];
      if (items.length === 0) return;

      await sdk.crud.deleteItem(collection, items[0]._id);
    },

    async deleteMany({ model, where }) {
      const collection = getCollection(model);
      const filter = where ? convertWhereToTotalumFilter(where) : undefined;

      const findResponse = await sdk.crud.getItems(collection, { filter });
      const items = findResponse.data?.items || [];

      for (const item of items) {
        await sdk.crud.deleteItem(collection, item._id);
      }

      return items.length;
    },

    // Totalum doesn't support true transactions, run sequentially
    async transaction(callback) {
      return await callback(this);
    },
  };
}
```

### Key Concepts

#### Case Conversion
- **Better Auth** uses camelCase: `userId`, `emailVerified`
- **Totalum** uses snake_case: `user_id`, `email_verified`
- The adapter converts automatically in both directions

#### Collection Prefix
- Default prefix: `ba_` (Better Auth)
- Collections become: `ba_user`, `ba_session`, `ba_account`, `ba_verification`

#### Auto-Fields
- Totalum generates: `_id`, `createdAt`, `updatedAt`, `createdBy`
- These are preserved without case conversion

---

## src/lib/auth.ts

Server-side Better Auth configuration.

### Complete auth.ts Template

```typescript
import "server-only";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { totalumAdapter } from "@/lib/better-auth-totalum-adapter";
import { totalumSdk } from "@/lib/totalum";

export const auth = betterAuth({
  // Connect to Totalum database
  database: totalumAdapter(totalumSdk, { debugLogs: false }),

  // Email & Password authentication
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session once per day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute cache
    },
  },

  // Required secrets
  // TESTING_MODE is set only by test:serve script — gates LOCAL_NEXTJS_PROJECT_TESTING_URL usage
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.TESTING_MODE === "true"
    ? (process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || "http://localhost:3000")
    : (process.env.NEXT_PUBLIC_APP_URL),
  basePath: "/api/auth",

  // Trusted origins for CORS
  trustedOrigins: (request: Request) => {
    const origin = request.headers.get("origin");
    if (!origin) return [];
    if (process.env.NODE_ENV !== "production") return [origin];
    if (process.env.NEXT_PUBLIC_APP_URL && origin === new URL(process.env.NEXT_PUBLIC_APP_URL).origin) return [origin];
    if (process.env.TESTING_MODE === "true" && process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL && origin === new URL(process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL).origin) return [origin];
    if (/^https:\/\/[^/]+\.totalum-project\.com$/.test(origin)) return [origin];
    const host = request.headers.get("host");
    if (host && origin === `https://${host}`) return [origin];
    return [];
  },

  // Cookie configuration — security based on effective URL (HTTP in testing = non-secure cookies)
  advanced: (() => {
    const effectiveUrl = process.env.TESTING_MODE === "true"
      ? (process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || "http://localhost:3000")
      : (process.env.NEXT_PUBLIC_APP_URL);
    const isHttps = effectiveUrl.startsWith("https://");
    return {
      cookiePrefix: "better-auth",
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" as const : "lax" as const,
        path: "/",
      },
      useSecureCookies: isHttps,
    };
  })(),

  // Plugins
  plugins: [bearer()], // Enable Bearer token authentication
});

// Export types for use in components
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
```

### Configuration Explained

| Setting | Value | Purpose |
|---------|-------|---------|
| `expiresIn` | 7 days | Session duration |
| `updateAge` | 1 day | How often to refresh session |
| `cookieCache` | 5 min | Client-side session cache |
| `sameSite` | none (prod) / lax (dev) | Cookie security |
| `bearer()` plugin | - | API token authentication |

---

## src/lib/auth-client.ts

Client-side auth hooks and functions.

### Complete auth-client.ts Template

```typescript
"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Use browser origin so auth works on both default and custom domains without re-deploy
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",
  fetchOptions: { credentials: "include" },
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  $Infer,
} = authClient;
```

### Usage in Client Components

```typescript
"use client";
import { useSession, signIn, signOut } from "@/lib/auth-client";

export function LoginButton() {
  const { data: session, isPending } = useSession();

  if (isPending) return <span>Loading...</span>;

  if (session?.user) {
    return (
      <button onClick={() => signOut()}>
        Sign Out ({session.user.email})
      </button>
    );
  }

  return (
    <button onClick={() => signIn.email({ email, password })}>
      Sign In
    </button>
  );
}
```

---

## src/app/api/auth/[...all]/route.ts

API route handler for Better Auth.

### Complete route.ts Template

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

This single file handles all auth endpoints:
- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-in` - User login
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session
- And more...

---

## Required Totalum Tables

Better Auth requires these tables in Totalum (with `ba_` prefix):

### ba_user
| Field | Type | Description |
|-------|------|-------------|
| email | string | User email (unique) |
| email_verified | boolean | Email verification status |
| name | string | Display name |
| image | string | Profile image URL |

### ba_session
| Field | Type | Description |
|-------|------|-------------|
| user_id | objectReference | Reference to ba_user |
| token | string | Session token |
| expires_at | date | Expiration timestamp |
| ip_address | string | Client IP |
| user_agent | string | Browser user agent |

### ba_account
| Field | Type | Description |
|-------|------|-------------|
| user_id | objectReference | Reference to ba_user |
| account_id | string | External account ID |
| provider_id | string | Auth provider (e.g., "credential") |
| access_token | string | OAuth access token |
| refresh_token | string | OAuth refresh token |

### ba_verification
| Field | Type | Description |
|-------|------|-------------|
| identifier | string | What's being verified |
| value | string | Verification code/token |
| expires_at | date | Expiration timestamp |

---

## Recovery Checklist

- [ ] src/lib/totalum.ts exists with 'server-only' import
- [ ] TOTALUM_API_KEY environment variable is set
- [ ] src/lib/better-auth-totalum-adapter.ts exists
- [ ] src/lib/auth.ts exists with proper configuration
- [ ] BETTER_AUTH_SECRET environment variable is set (min 32 chars)
- [ ] src/lib/auth-client.ts exists for client-side auth
- [ ] src/app/api/auth/[...all]/route.ts exists
- [ ] Required Totalum tables exist (ba_user, ba_session, ba_account, ba_verification)
