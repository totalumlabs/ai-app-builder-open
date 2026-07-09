---
name: project-structure
description: "Complete project folder structure template for Next.js + Totalum + Cloudflare projects. Reference for verifying or recreating the correct project organization."
---

# Project Structure Recovery

This document provides the complete folder structure for a Next.js + Totalum + Cloudflare project.

## Complete Folder Structure

```
project-root/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── api/                          # API routes
│   │   │   ├── auth/
│   │   │   │   └── [...all]/
│   │   │   │       └── route.ts          # Better Auth handler
│   │   │   └── stripe/                   # Stripe endpoints (optional)
│   │   │       ├── create-checkout-session/
│   │   │       │   └── route.ts
│   │   │       ├── webhook/
│   │   │       │   └── route.ts
│   │   │       ├── products/
│   │   │       │   └── route.ts
│   │   │       └── customer-portal/
│   │   │           └── route.ts
│   │   ├── (public)/                     # Public routes (no auth required)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── privacy-policy/
│   │   │   │   └── page.tsx
│   │   │   └── terms-of-service/
│   │   │       └── page.tsx
│   │   ├── (protected)/                  # Protected routes (auth required)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── page.tsx                      # Home page
│   │   ├── layout.tsx                    # Root layout
│   │   ├── not-found.tsx                 # 404 page
│   │   ├── error.tsx                     # Error boundary
│   │   └── globals.css                   # Global styles
│   │
│   ├── components/
│   │   ├── common/                       # Shared components
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── ui/                           # UI primitives (Radix/shadcn)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ... (more UI components)
│   │   ├── ScriptExecutor.tsx            # Totalum script execution
│   │   └── DevToolsHandler.tsx           # Dev tools integration
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx                   # Auth context and hooks
│   │   ├── useTotalum.tsx                # Totalum data hooks (optional)
│   │   └── useLocalStorage.tsx           # Local storage hook (optional)
│   │
│   ├── lib/                              # Core libraries
│   │   ├── totalum.ts                    # Totalum SDK instance
│   │   ├── auth.ts                       # Server-side auth config
│   │   ├── auth-client.ts                # Client-side auth
│   │   ├── better-auth-totalum-adapter.ts # Auth adapter
│   │   ├── backend-logger.ts             # Server logging
│   │   ├── console-logger.ts             # Client logging
│   │   ├── stripe.ts                     # Stripe config (optional)
│   │   └── utils.ts                      # Utility functions
│   │
│   ├── types/
│   │   ├── index.ts                      # Common types
│   │   └── stripe.ts                     # Stripe types (optional)
│   │
│   ├── assets/                           # Static assets
│   │   └── files.ts                      # Asset exports
│   │
│   └── middleware.ts                     # Next.js middleware
│
├── public/                               # Static files
│   ├── _headers                          # Cloudflare headers
│   ├── robots.txt                        # SEO robots file
│   ├── favicon.ico
│   └── images/                           # Static images
│
├── docs/                                 # Project documentation
│   └── README.md
│
├── scripts/                              # Utility scripts
│   └── setup-stripe-webhook.ts           # Stripe setup (optional)
│
├── Configuration files (root):
│   ├── package.json                      # Dependencies and scripts
│   ├── package-lock.json                 # Dependency lock
│   ├── tsconfig.json                     # TypeScript config
│   ├── next.config.ts                    # Next.js config
│   ├── open-next.config.ts               # OpenNext/Cloudflare config
│   ├── instrumentation.ts                # Next.js instrumentation
│   ├── middleware.ts                     # Next.js middleware
│   ├── postcss.config.mjs                # PostCSS for Tailwind
│   ├── eslint.config.mjs                 # ESLint config
│   ├── components.json                   # shadcn/ui config
│   ├── wrangler.jsonc                    # Cloudflare Wrangler config
│   ├── env.d.ts                          # Environment type definitions
│   ├── next-env.d.ts                     # Next.js type definitions
│   ├── .env                              # Environment variables (local)
│   ├── .env.example                      # Example env file
│   ├── .gitignore                        # Git ignore rules
│   └── README.md                         # Project readme
│
└── Generated directories (not committed):
    ├── node_modules/                     # Dependencies
    ├── .next/                            # Next.js build output
    └── .open-next/                       # Cloudflare build output
```

---

## Key Files by Purpose

### Required for Project to Run

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.ts` | Next.js configuration |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Home page |

### Required for Totalum Integration

| File | Purpose |
|------|---------|
| `src/lib/totalum.ts` | SDK singleton |
| Environment: `TOTALUM_API_KEY` | API authentication |
| Environment: `TOTALUM_API_URL` | API endpoint |

### Required for Authentication

| File | Purpose |
|------|---------|
| `src/lib/better-auth-totalum-adapter.ts` | Database adapter |
| `src/lib/auth.ts` | Server-side config |
| `src/lib/auth-client.ts` | Client-side config |
| `src/app/api/auth/[...all]/route.ts` | Auth API routes |
| `src/middleware.ts` | Route protection |
| Environment: `BETTER_AUTH_SECRET` | Auth secret |

### Required for Cloudflare Deployment

| File | Purpose |
|------|---------|
| `open-next.config.ts` | OpenNext configuration |
| `instrumentation.ts` | Logging initialization |
| `wrangler.jsonc` | Wrangler configuration |
| `@opennextjs/cloudflare` dependency | Cloudflare adapter |

### Required for Logging

| File | Purpose |
|------|---------|
| `src/lib/backend-logger.ts` | Server logging |
| `src/lib/console-logger.ts` | Client logging |
| `instrumentation.ts` | Logger initialization |
| `src/components/DevToolsHandler.tsx` | Client logger init |

---

## File Templates Reference

### src/app/layout.tsx

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { ScriptExecutor } from "@/components/ScriptExecutor";
import { DevToolsHandler } from "@/components/DevToolsHandler";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic"; // CRITICAL for multi-tenant
export const revalidate = 0; // Disable caching

export const metadata: Metadata = {
  title: "Your App Name",
  description: "Your app description",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ScriptExecutor />
        <DevToolsHandler />
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
```

### src/app/page.tsx

```typescript
export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Welcome</h1>
      <p className="text-muted-foreground">
        Your Next.js + Totalum application is ready.
      </p>
    </div>
  );
}
```

### src/components/common/Header.tsx

```typescript
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Your App
        </Link>
        <nav className="flex gap-4">
          <Link href="/login">Login</Link>
          <Link href="/register">Register</Link>
        </nav>
      </div>
    </header>
  );
}
```

### src/components/common/Footer.tsx

```typescript
export function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-4 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Your App. All rights reserved.</p>
      </div>
    </footer>
  );
}
```

### src/components/ScriptExecutor.tsx

```typescript
"use client";

import { useEffect } from "react";

/**
 * Executes scripts injected by Totalum platform
 * Used for analytics, tracking, and custom integrations
 */
export function ScriptExecutor() {
  useEffect(() => {
    // Listen for script execution requests from parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "execute-script" && event.data?.script) {
        try {
          // Create and execute script
          const scriptEl = document.createElement("script");
          scriptEl.textContent = event.data.script;
          document.body.appendChild(scriptEl);
        } catch (error) {
          console.error("Script execution failed:", error);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
```

### src/components/DevToolsHandler.tsx

```typescript
"use client";

import { useEffect } from "react";
import { consoleLogger } from "@/lib/console-logger";

/**
 * Initializes development tools for Totalum integration
 */
export function DevToolsHandler() {
  useEffect(() => {
    // Initialize console logger
    consoleLogger.init();

    // Listen for dev tools commands
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "enable-mobile-preview") {
        consoleLogger.toggleMobileStyles(true);
      }
      if (event.data?.type === "disable-mobile-preview") {
        consoleLogger.toggleMobileStyles(false);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      consoleLogger.cleanup();
    };
  }, []);

  return null;
}
```

### src/lib/utils.ts

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## .gitignore Template

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
.next/
.open-next/
out/
build/
dist/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Testing
coverage/

# Misc
*.log
```

---

## Recovery Checklist

### Folder Structure
- [ ] `src/app/` directory exists with layout.tsx and page.tsx
- [ ] `src/components/` directory exists with common/ and ui/ subdirs
- [ ] `src/lib/` directory exists with all required files
- [ ] `src/hooks/` directory exists
- [ ] `public/` directory exists

### Configuration Files
- [ ] package.json exists with all dependencies
- [ ] tsconfig.json exists with path aliases
- [ ] next.config.ts exists with headers
- [ ] open-next.config.ts exists
- [ ] instrumentation.ts exists
- [ ] middleware.ts exists
- [ ] postcss.config.mjs exists

### Core Components
- [ ] layout.tsx includes ScriptExecutor and DevToolsHandler
- [ ] layout.tsx has `dynamic = "force-dynamic"`
- [ ] Header.tsx exists
- [ ] Footer.tsx exists

### Environment
- [ ] .env file exists with required variables
- [ ] .gitignore excludes .env files
