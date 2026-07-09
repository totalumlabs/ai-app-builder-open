---
name: essential-files
description: "Core configuration files required for any Next.js + Totalum project: package.json and tsconfig.json. These must exist for the project to run."
---

# Essential Files Recovery

These files are **CRITICAL** - the project will not run without them.

## package.json

This file defines all dependencies, scripts, and project metadata.

### Complete package.json Template

```json
{
  "name": "nextjs-totalum-project",
  "version": "0.1.0",
  "private": true,
  "description": "Build a full-stack web application with Next.js and Totalum.",
  "scripts": {
    "dev": "NEXT_TELEMETRY_DISABLED=1 DISABLE_OPENNEXT=true next dev",
    "check-types-errors": "tsc --noEmit --skipLibCheck",
    "start": "NEXT_TELEMETRY_DISABLED=1 DISABLE_OPENNEXT=true PORT=80 next start",
    "build": "NEXT_TELEMETRY_DISABLED=1 DISABLE_OPENNEXT=true npx next build",
    "cloudflare-build": "opennextjs-cloudflare build",
    "cloudflare-deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv env.d.ts",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.1",
    "@opennextjs/cloudflare": "1.3.0",
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.2",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.13",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-tooltip": "^1.2.7",
    "ai": "^5.0.72",
    "better-auth": "^1.3.26",
    "bcrypt": "^6.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "framer-motion": "^12.15.0",
    "input-otp": "^1.4.2",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.536.0",
    "next": "^15.3.9",
    "next-themes": "^0.4.6",
    "react": "19.0.1",
    "react-day-picker": "^9.7.0",
    "react-dom": "19.0.1",
    "react-hook-form": "^7.62.0",
    "recharts": "^2.15.3",
    "server-only": "^0.0.1",
    "sonner": "^2.0.7",
    "stripe": "^19.1.0",
    "tailwind-merge": "^3.3.0",
    "tailwindcss": "^4.1.1",
    "tailwindcss-animate": "^1.0.7",
    "totalum-api-sdk": "^3.0.8",
    "vaul": "^1.1.2",
    "zod": "^4.0.15"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.1",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^22.15.30",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.5",
    "eslint": "9.27.0",
    "eslint-config-next": "15.3.2",
    "typescript": "5.8.3",
    "wrangler": "4.21.0"
  }
}
```

### Key Dependencies Explained

| Package | Purpose |
|---------|---------|
| `next` | React framework with SSR/SSG |
| `react`, `react-dom` | React 19 core |
| `totalum-api-sdk` | Totalum database integration |
| `better-auth` | Authentication library |
| `@opennextjs/cloudflare` | Cloudflare Workers deployment |
| `stripe` | Payment processing |
| `@radix-ui/*` | Accessible UI components |
| `tailwindcss` | Utility-first CSS |
| `zod` | Schema validation |
| `react-hook-form` | Form handling |
| `sonner` | Toast notifications |

### Key Scripts Explained

| Script | Purpose |
|--------|---------|
| `dev` | Start development server with OpenNext disabled |
| `build` | Production build with OpenNext disabled |
| `start` | Start production server on port 80 |
| `cloudflare-build` | Build for Cloudflare Workers |
| `cloudflare-deploy` | Build and deploy to Cloudflare |
| `check-types-errors` | TypeScript type checking |

### CRITICAL: Environment Variables in Scripts

The scripts use these environment variables:
- `NEXT_TELEMETRY_DISABLED=1` - Disable Next.js telemetry
- `DISABLE_OPENNEXT=true` - Disable OpenNext for local dev (prevents Cloudflare-specific code)
- `PORT=80` - Production port

---

## tsconfig.json

TypeScript configuration for the project.

### Complete tsconfig.json Template

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Configuration Explained

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | ES2017 | Modern JavaScript output |
| `strict` | false | Flexible type checking for rapid development |
| `moduleResolution` | bundler | Next.js bundler resolution |
| `jsx` | preserve | Next.js handles JSX compilation |
| `incremental` | true | Faster subsequent builds |
| `paths.@/*` | ./src/* | Import alias for clean imports |

### Path Alias Usage

With the `@/*` path alias, imports look like:

```typescript
// Instead of:
import { totalumSdk } from '../../../lib/totalum';

// Use:
import { totalumSdk } from '@/lib/totalum';
```

---

## env.d.ts (Optional but Recommended)

Type definitions for environment variables and Cloudflare:

```typescript
interface CloudflareEnv {
  // Add Cloudflare bindings here if needed
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOTALUM_API_KEY: string;
      TOTALUM_API_URL: string;
      BETTER_AUTH_SECRET: string;
      NEXT_PUBLIC_APP_URL: string;
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {};
```

---

## Recovery Checklist

- [ ] package.json exists with all required dependencies
- [ ] tsconfig.json exists with correct paths configuration
- [ ] Run `npm install` after creating/updating package.json
- [ ] Run `npm run check-types-errors` to verify TypeScript setup
- [ ] Verify `@/*` import paths work correctly
