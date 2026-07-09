---
name: nextjs-config
description: "Next.js configuration files: next.config.ts for headers, CSP, CORS, and image optimization; middleware.ts for authentication and route protection."
---

# Next.js Configuration Recovery

These files configure how Next.js behaves, including security headers, CORS, and route protection.

## next.config.ts

This is the main Next.js configuration file.

### Complete next.config.ts Template

```typescript
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placeholders.io",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      // Add more domains as needed for your project
    ]
  },
  eslint: {
    // Disable ESLint during builds for faster builds
    ignoreDuringBuilds: true,
  },
  // Allow all dev origins for testing
  allowedDevOrigins: ["*"],
  async headers() {
    const commonHeaders = [
      // Disable caching - CRITICAL for multi-tenant apps
      {
        key: 'Cache-Control',
        value: 'no-cache, no-store, must-revalidate',
      },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
      // Content Security Policy for iframe embedding
      {
        key: 'Content-Security-Policy',
        value: isProduction
          ? "frame-ancestors 'self' https://web.totalum.app https://totalum-frontend-test.web.app http://localhost:8100"
          : "frame-ancestors *",
      },
    ];

    // Add CORS headers for non-production environments
    if (!isProduction) {
      commonHeaders.push(
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
        { key: "Access-Control-Max-Age", value: "86400" }
      );
    }

    return [
      {
        source: '/:path*',
        headers: commonHeaders,
      },
    ];
  },
};

export default nextConfig;

// Initialize OpenNext for Cloudflare Workers (conditional)
if (process.env.DISABLE_OPENNEXT !== 'true') {
  try {
    const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  } catch (error) {
    console.warn("OpenNext Cloudflare dev initialization failed:", error instanceof Error ? error.message : String(error));
    console.warn("Falling back to standard Next.js development mode");
  }
}
```

### Configuration Sections Explained

#### Images Configuration

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "storage.googleapis.com", // For Totalum file storage
    },
    // Add your domains here
  ]
}
```

**Purpose:** Allow Next.js Image component to optimize images from external domains.

#### Headers Configuration

| Header | Purpose |
|--------|---------|
| `Cache-Control: no-cache, no-store` | **CRITICAL** - Prevents caching in multi-tenant apps |
| `Pragma: no-cache` | HTTP/1.0 cache prevention |
| `Expires: 0` | Immediate expiration |
| `Content-Security-Policy` | Controls iframe embedding |
| `Access-Control-Allow-*` | CORS headers (dev only) |

#### Content Security Policy

**Production CSP:**
```
frame-ancestors 'self' https://web.totalum.app https://totalum-frontend-test.web.app http://localhost:8100
```
- Only allows embedding from Totalum domains

**Development CSP:**
```
frame-ancestors *
```
- Allows embedding from anywhere for testing

#### OpenNext Initialization

The code at the bottom initializes OpenNext for Cloudflare Workers:
- Only runs when `DISABLE_OPENNEXT` is not set to 'true'
- Fails gracefully if OpenNext is not available
- Essential for Cloudflare Workers compatibility

---

## middleware.ts

Route protection and request handling.

### Complete middleware.ts Template

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/privacy-policy",
  "/terms-of-service",
  "/stripe/demo",
  "/stripe/success",
  "/stripe/cancel",
];

// Routes that should be completely skipped by middleware
const skipRoutes = [
  "/api/",
  "/_next/",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";

  // Skip middleware for API routes and static files
  if (skipRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Create response with headers
  const response = NextResponse.next();

  // Add CORS headers for development
  if (!isProduction) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }

  // Add CSP header for iframe embedding
  response.headers.set(
    'Content-Security-Policy',
    isProduction
      ? "frame-ancestors 'self' https://web.totalum.app https://totalum-frontend-test.web.app http://localhost:8100"
      : "frame-ancestors *"
  );

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublicRoute) {
    return response;
  }

  // Check for session cookie (Better Auth uses this)
  const sessionCookie = request.cookies.get('better-auth.session_token');

  if (!sessionCookie?.value) {
    // Redirect to login if no session
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### Middleware Configuration Explained

#### Public Routes Array

```typescript
const publicRoutes = [
  "/",           // Home page
  "/login",      // Auth pages
  "/register",
  "/privacy-policy",
  "/terms-of-service",
  "/stripe/demo",     // Payment pages
  "/stripe/success",
  "/stripe/cancel",
];
```

**Add routes here that should be accessible without authentication.**

#### Session Verification

```typescript
const sessionCookie = request.cookies.get('better-auth.session_token');

if (!sessionCookie?.value) {
  // Redirect to login
}
```

**How it works:**
1. Checks for Better Auth session cookie
2. If missing, redirects to `/login` with original path in query param
3. After login, user can be redirected back to original destination

#### Matcher Configuration

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Excludes from middleware:**
- Static files (`_next/static`)
- Optimized images (`_next/image`)
- Favicon
- All image files (svg, png, jpg, etc.)

---

## postcss.config.mjs

Required for Tailwind CSS v4:

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

---

## Recovery Checklist

- [ ] next.config.ts exists with proper headers
- [ ] CSP allows Totalum domains for iframe embedding
- [ ] Cache-Control headers disable caching
- [ ] middleware.ts exists with route protection
- [ ] Public routes array includes all unauthenticated pages
- [ ] postcss.config.mjs exists for Tailwind CSS
- [ ] OpenNext initialization is conditional
