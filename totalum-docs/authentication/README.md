---
name: authentication
description: "User authentication with Better Auth and Totalum. Use when implementing login, registration, user sessions, or protected routes. Activates for auth setup, database tables for auth, session management, and auth UI components. ONLY use when user explicitly requests authentication."
---

# Authentication Skill

## When to Use This Skill

- when user requests to add/edit authentication features

**DO NOT use for:**
- Projects without any auth requirements

---

## Authentication Setup Workflow

Super important: reuse existing login and register pages, and if needed modify it.


### Step 1: Run the Database Setup Script

**➜ Execute [`SETUP_DATABASE_SCRIPT.md`](./SETUP_DATABASE_SCRIPT.md) end-to-end.**

That file is the single source of truth for the auth schema: it walks through `getAllDatabaseTables()`, creates the four tables in the correct order, captures the user table `_id`, and ends with a mandatory verification checkpoint. Follow it line-by-line without improvising — every field name, `propertyType`, and `typeExtras` value matters.

The table definitions below are duplicated from the script for reference only; if anything disagrees, the script wins.

---

### Reference: Auth Table Definitions

**CRITICAL: Copy these MCP calls exactly as written. The Better Auth adapter converts camelCase ↔ snake_case internally. All field names MUST use snake_case with underscores (`user_id`, `expires_at`, `ip_address`). If you use `userid` or `expiresat` (no underscores), auth will silently fail — the adapter writes to `user_id` but the database field would be `userid`, so nothing is found.**

**Execute these MCP calls in order (not parallel):**

#### Table 1: user
```typescript
mcp__totalum__createDatabaseTable({
  type: "user",
  label: "User",
  description: "Table used for Auth. Stores users",
  icon: "fa-solid fa-user",
  mustTheTableBeVisibleOnBackOffice: true,
  properties: [
    { name: "email", label: "Email", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "name", label: "Name", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "email_verified", label: "Email Verified", propertyType: "number" },
    { name: "image", label: "Image", propertyType: "string", typeExtras: { string: { type: "link" } } }
    // For multi-role/multi-tenant systems, add custom fields here. See "Multi-Role / Multi-Tenant Systems" section below.
    // Example: { name: "role", label: "Role", propertyType: "string", typeExtras: { string: { type: "text" } } }
  ]
})
```

#### Table 2: session
```typescript
mcp__totalum__createDatabaseTable({
  type: "session",
  label: "Session",
  description: "Table used for Auth. Stores user auth sessions",
  icon: "fa-solid fa-clock",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "user_id", label: "User", propertyType: "objectReference", objectReference: { objectReferenceTypeId: "{the id of the generated user table}", objectReferenceRelation: "manyToOne" } },
    { name: "token", label: "Token", propertyType: "string" },
    { name: "expires_at", label: "Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } },
    { name: "ip_address", label: "IP Address", propertyType: "string" },
    { name: "user_agent", label: "User Agent", propertyType: "string" }
  ]
})
```

#### Table 3: account
```typescript
mcp__totalum__createDatabaseTable({
  type: "account",
  label: "Account",
  description: "Table used for Auth. Stores accounts tokens",
  icon: "fa-solid fa-id-card",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "user_id", label: "User", propertyType: "objectReference", objectReference: { objectReferenceTypeId: "{the id of the generated user table}", objectReferenceRelation: "manyToOne" } },
    { name: "account_id", label: "Account ID", propertyType: "string" },
    { name: "provider_id", label: "Provider ID", propertyType: "string" },
    { name: "password", label: "Password", propertyType: "string" },
    { name: "access_token", label: "Access Token", propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "refresh_token", label: "Refresh Token", propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "id_token", label: "ID Token", propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "access_token_expires_at", label: "Access Token Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } },
    { name: "refresh_token_expires_at", label: "Refresh Token Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } },
    { name: "scope", label: "Scope", propertyType: "string" }
  ]
})
```

#### Table 4: verification
```typescript
mcp__totalum__createDatabaseTable({
  type: "verification",
  label: "Verification",
  description: "Table used for Auth. Stores verification tokens",
  icon: "fa-solid fa-check-circle",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "identifier", label: "Identifier", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "value", label: "Value", propertyType: "string" },
    { name: "expires_at", label: "Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } }
  ]
})
```

### Step 2b: Verify Field Names and Types

Verification is Step 6 of [`SETUP_DATABASE_SCRIPT.md`](./SETUP_DATABASE_SCRIPT.md). Run it and treat the completion checklist at the bottom of that script as a required gate before touching any auth code.

### Step 3: Link User to Other Tables
If other tables need user association, add objectReference:
```typescript
mcp__totalum__createTableProperty({
  structureId: "other_table_id",
  property: {
    name: "user",
    label: "User",
    propertyType: "objectReference",
    objectReference: {
      objectReferenceTypeId: "{the id of the generated user table}",
      objectReferenceRelation: "manyToOne"
    }
  }
})
```

---

## Existing Auth Files (Pre-configured)

Super important: reuse existing login and register pages, and if needed modify it, and auth logic.

**DO NOT modify unless explicitly requested:**
- `src/lib/auth.ts` - Server-side auth config
- `src/lib/auth-client.ts` - Client-side hooks
- `src/lib/better-auth-totalum-adapter.ts` - Totalum adapter
- `src/app/api/auth/[...all]/route.ts` - API handler
- `src/middleware.ts` - Route protection

---

## Session User Object Structure

**CRITICAL:** The auth session user uses `id` (NOT `_id`):

```typescript
// session.user fields:
{
  id: string;           // User ID — use this, NOT _id
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  // ... any custom fields added via additionalFields
}
```

**ALWAYS use `session.user.id` to get the user ID.** Never use `session.user._id` — it does not exist. The Better Auth adapter converts Totalum's `_id` to `id` automatically.

For all other tables and API calls, continue using `_id` as the identifier field. Only the auth session user object uses `id`.

---

## Using Authentication

### Server Components
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function ProtectedPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

### Client Components
```typescript
"use client";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";

export function AuthComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;

  if (!session) {
    return (
      <div>
        <Button onClick={() => signIn.email({ email, password })}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {session.user.name}</p>
      <Button onClick={() => signOut()}>Sign Out</Button>
    </div>
  );
}
```

### Sign Up Flow
```typescript
const handleSignUp = async (formData: { email: string; password: string; name: string }) => {
  const result = await signUp.email({
    email: formData.email,
    password: formData.password,
    name: formData.name
  });

  if (result.error) {
    console.error(result.error.message);
    return;
  }
  // Success - user is auto-logged in
};
```

### Sign In Flow
```typescript
const handleSignIn = async (formData: { email: string; password: string }) => {
  const result = await signIn.email({
    email: formData.email,
    password: formData.password
  });

  if (result.error) {
    console.error(result.error.message);
    return;
  }
  // Success
};
```

---

## Multi-Role / Multi-Tenant Systems

When user requests multiple user roles (admin, editor, viewer) or multi-tenant setup (users belong to companies/organizations), follow these steps:

### Step 1: Add Field to User Table

```typescript
// For roles:
mcp__totalum__createTableProperty({
  structureId: "user_table_id", // Get from mcp__totalum__getAllDatabaseTables()
  property: {
    name: "role",
    label: "Role",
    propertyType: "string",
    typeExtras: { string: { type: "text" } }
  }
})

// For multi-tenant (company_id) (only if needed):
mcp__totalum__createTableProperty({
  structureId: "user_table_id",
  property: {
    name: "company_id",
    label: "Company",
    propertyType: "objectReference",
    objectReference: {
      objectReferenceTypeId: "company", // Reference to company table
      objectReferenceRelation: "manyToOne"
    }
  }
})
```

### Step 2: Configure Better Auth (`src/lib/auth.ts`)

Add fields to `additionalFields` in the user config:

```typescript
user: {
  additionalFields: {
    role: {
      type: "string",
      required: false,
      defaultValue: "user",
      input: true, // Allow setting during registration
    },
    // For multi-tenant (only if needed):
    company_id: {
      type: "string",
      required: false,
      input: true,
    },
  },
},
```

### Step 3: Create Extended Type (same file, after auth config)

```typescript
export interface ExtendedUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role?: string;
  company_id?: string;
}
```

### Step 4: Usage in Components

```typescript
"use client";
import { useSession } from "@/lib/auth-client";
import type { ExtendedUser } from "@/lib/auth";

export function RoleBasedComponent() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser;

  if (user?.role === "admin") {
    return <AdminDashboard />;
  }

  if (user?.role === "editor") {
    return <EditorDashboard />;
  }

  return <UserDashboard />;
}
```

### Step 5: Registration with Role

```typescript
await signUp.email({
  email: formData.email,
  password: formData.password,
  name: formData.name,
  role: "editor", // Set role during registration
} as any); // Cast needed for custom fields
```

### Important Notes

- **Session Cache**: Role changes reflect within ~1 minute (configured in `auth.ts` cookieCache.maxAge)
- **Field Names**: Use snake_case in Totalum table, camelCase in code (adapter converts automatically)
- **Middleware**: Cannot check roles (only cookie existence). Do role checks in components/API routes
- **Default Role**: Set `defaultValue` in additionalFields if users should have a default role

---

## Admin-Only Panel (No Public Registration)

When user requests an admin panel where only administrators can access and there's no public registration (e.g., internal tools, backoffice, CMS):

### Step 1: Setup Admin User

1. **Keep `/register` page temporarily**
2. **Register yourself** at `/register` (password is auto-hashed securely by Better Auth)
3. **Go to Totalum backoffice** → User table → Edit your user → Set `role` = "admin"

### Step 2: Add Role Field to User Table

```typescript
mcp__totalum__createTableProperty({
  structureId: "user_table_id", // Get from mcp__totalum__getAllDatabaseTables()
  property: {
    name: "role",
    label: "Role",
    propertyType: "string",
    typeExtras: { string: { type: "text" } }
  }
})
```

### Step 3: Remove Public Registration

1. **Delete** `src/app/register/page.tsx`
2. **Remove** `/register` from `src/middleware.ts` publicRoutes

### Step 4: Enable Admin Plugin (for creating users later)

**In `src/lib/auth.ts`:**
```typescript
import { admin } from "better-auth/plugins";

// Add to plugins array:
plugins: [
  bearer(),
  admin(), // <-- Add this
],
```

**In `src/lib/auth-client.ts`:**
```typescript
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",
  fetchOptions: { credentials: "include" },
  plugins: [adminClient()], // <-- Add this
});

// Add admin to exports:
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  $Infer,
  admin, // <-- Add this
} = authClient;
```

### Step 5: Admin Creates New Users

Admin can now create users programmatically (no registration page needed):

```typescript
"use client";
import { admin } from "@/lib/auth-client";

// Create a new user
const handleCreateUser = async (userData: { email: string; password: string; name: string; role: string }) => {
  await admin.createUser({
    email: userData.email,
    password: userData.password,
    name: userData.name,
    role: userData.role, // "admin", "editor", "viewer", etc.
  });
};
```

### Admin Plugin Capabilities

Once enabled, admin users can:
- `admin.createUser({ email, password, name, role })` - Create new users
- `admin.setUserPassword({ userId, newPassword })` - Reset any user's password
- `admin.listUsers({ limit, offset })` - List all users
- `admin.removeUser({ userId })` - Delete a user
- `admin.banUser({ userId, reason })` - Ban a user

### Security Notes

- Only users with `role: "admin"` can use admin functions
- Passwords are securely hashed by Better Auth (scrypt algorithm)
- Never store plain-text passwords
- The admin plugin validates the caller's session automatically

---

## Protected Routes

### Middleware Configuration
`src/middleware.ts` protects routes:
```typescript
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/privacy-policy",
  "/terms-of-service",
  // SUPER IMPORTANT: add new public routes here when needed
];
```

**Any route NOT in publicRoutes requires authentication!**

---

## Header with Auth Links

Remember to always add on header and/or aside menu the auth links sync with the current user auth status.

---

**Only implement password recovery, email verification, google signin, etc. if user request it**

## Password Recovery (Forgot Password)

When user requests password reset functionality:

### Step 1: Enable in `src/lib/auth.ts`

Uncomment the `sendResetPassword` block in `emailAndPassword` config.

### Step 2: Uncomment in `src/lib/auth-client.ts`

```typescript
export const {
  // ... existing exports
  forgetPassword,
  resetPassword,
} = authClient;
```

### Step 3: Add Public Routes in `src/middleware.ts`

```typescript
const publicRoutes = [
  // ... existing routes
  "/forgot-password",
  "/reset-password",
];
```

### Step 4: Create Pages

**`src/app/forgot-password/page.tsx`**
```typescript
"use client";
import { useState } from "react";
import { forgetPassword } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgetPassword({ email, redirectTo: "/reset-password" });
    setSent(true);
  };

  if (sent) return <p>Check your email for reset link.</p>;

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <button type="submit">Send Reset Link</button>
    </form>
  );
}
```

**`src/app/reset-password/page.tsx`**
```typescript
"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await resetPassword({ token, newPassword: password });
    setDone(true);
  };

  if (done) return <p>Password reset! <a href="/login">Login</a></p>;

  return (
    <form onSubmit={handleSubmit}>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New Password" required />
      <button type="submit">Reset Password</button>
    </form>
  );
}
```

---

## Email Verification

When user requests email verification:

### Step 1: Enable in `src/lib/auth.ts`

Uncomment the `emailVerification` block.

Optional: Add `requireEmailVerification: true` to `emailAndPassword` to block login until verified.

### Step 2: Uncomment in `src/lib/auth-client.ts`

```typescript
export const {
  // ... existing exports
  sendVerificationEmail,
} = authClient;
```

### Step 3: Add Public Route in `src/middleware.ts`

```typescript
const publicRoutes = [
  // ... existing routes
  "/verify-email",
];
```

### Step 4: Create Verification Callback Page

**`src/app/verify-email/page.tsx`**
```typescript
"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [status, setStatus] = useState<"success" | "error" | "loading">("loading");

  useEffect(() => {
    if (error) {
      setStatus("error");
    } else {
      setStatus("success");
    }
  }, [error]);

  if (status === "loading") return <p>Verifying...</p>;
  if (status === "error") return <p>Invalid or expired link. <a href="/login">Try again</a></p>;
  return <p>Email verified! <a href="/login">Login</a></p>;
}
```

---

## Google Sign-In (OAuth)

When user requests Google authentication:

### Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `{NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
4. Copy Client ID and Client Secret

### Step 2: Add Environment Variables

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

### Step 3: Enable in `src/lib/auth.ts`

Uncomment the `socialProviders` block.

### Step 4: Add Google Button to Login/Register Pages

```typescript
import { signIn } from "@/lib/auth-client";

<button onClick={() => signIn.social({ provider: "google" })}>
  Sign in with Google
</button>
```

### Environment Variables Checklist

| Variable | Where to get |
|----------|--------------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials |

---

## Critical Rules

Implement the auth system in a way that when the user registers on frontend is automatically logged in, for avoid asking to login again right after registration.

### Database Rules
- [ ] Never add `_id`, `createdAt`, `updatedAt` (auto-created)
- [ ] Always add `includeHour: true` for date fields
- [ ] Use `long-string` for tokens
- [ ] Only `user` table visible in back-office

### Auth Rules
- [ ] User actually requested auth before implementing
- [ ] All 4 tables created in correct order
- [ ] objectReference used to link user to other tables
- [ ] New public routes added to middleware

### Adapter Notes
- Totalum adapter handles camelCase ↔ snake_case automatically
- Boolean fields use options (yes/no) in Totalum
- Password hashing is automatic via Better Auth
- Session duration configurable in `src/lib/auth.ts`
