import "server-only";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { totalumAdapter } from "@/lib/better-auth-totalum-adapter";
import { totalumSdk } from "@/lib/totalum";

// TESTING_MODE is set only by the test:serve script (npm run test:serve).
// When active, use LOCAL_NEXTJS_PROJECT_TESTING_URL so that CORS, baseURL,
// and cookie security all work correctly on localhost.
const effectiveUrl =
  process.env.TESTING_MODE === "true"
    ? (process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL || "http://localhost:3000")
    : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

export const auth = betterAuth({
  // Database adapter
  database: totalumAdapter(totalumSdk, {
    debugLogs: true,
  }),

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
    // =========================================================================
    // PASSWORD RECOVERY - Uncomment to enable password reset via email
    // =========================================================================
    // Required: Create /forgot-password and /reset-password pages
    // -------------------------------------------------------------------------
    // sendResetPassword: async ({ user, url }) => {
    //   await totalumSdk.email.sendEmail({
    //     to: [user.email],
    //     subject: "Reset your password",
    //     html: `
    //       <h2>Password Reset Request</h2>
    //       <p>Click the link below to reset your password:</p>
    //       <p><a href="${url}">Reset Password</a></p>
    //       <p>If you didn't request this, ignore this email.</p>
    //       <p>This link expires in 1 hour.</p>
    //     `,
    //   });
    // },
    // resetPasswordTokenExpiresIn: 3600,
  },

  // ===========================================================================
  // EMAIL VERIFICATION - Uncomment to enable email verification
  // ===========================================================================
  // sendOnSignUp: sends verification email automatically after registration
  // autoSignInAfterVerification: logs user in after clicking verification link
  // Required: Create /verify-email page to handle the callback
  // To require verification before login, set requireEmailVerification: true
  // in emailAndPassword config above
  // ---------------------------------------------------------------------------
  // emailVerification: {
  //   sendOnSignUp: true,
  //   autoSignInAfterVerification: true,
  //   sendVerificationEmail: async ({ user, url }) => {
  //     await totalumSdk.email.sendEmail({
  //       to: [user.email],
  //       subject: "Verify your email",
  //       html: `
  //         <h2>Email Verification</h2>
  //         <p>Click the link below to verify your email:</p>
  //         <p><a href="${url}">Verify Email</a></p>
  //         <p>If you didn't create an account, ignore this email.</p>
  //       `,
  //     });
  //   },
  // },

  // ===========================================================================
  // SOCIAL PROVIDERS - Uncomment to enable Google/GitHub/etc sign-in
  // ===========================================================================
  // Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  // Google Cloud Console callback URL: {NEXT_PUBLIC_APP_URL}/api/auth/callback/google
  // ---------------------------------------------------------------------------
  // socialProviders: {
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID!,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  //   },
  //   // github: {
  //   //   clientId: process.env.GITHUB_CLIENT_ID!,
  //   //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  //   // },
  // },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session once per day
    cookieCache: {
      enabled: true,
      maxAge: 30, // 30 seconds - reduced for faster role/permission updates
    },
  },

  // Security
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: effectiveUrl,
  basePath: "/api/auth",

  // Trusted origins for CORS
  // Uses a dynamic function so both the default subdomain and custom domains
  // are trusted without needing a re-deploy after adding a custom domain.
  trustedOrigins: (request: Request) => {
    const origin = request.headers.get("origin");
    if (!origin) return [];

    // Development: trust any origin
    if (process.env.NODE_ENV !== "production") return [origin];

    // Trust the configured app URL
    if (process.env.NEXT_PUBLIC_APP_URL && origin === new URL(process.env.NEXT_PUBLIC_APP_URL).origin) {
      return [origin];
    }

    // Trust testing URL (only when server is started via npm run test:serve)
    if (process.env.TESTING_MODE === "true" && process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL && origin === new URL(process.env.LOCAL_NEXTJS_PROJECT_TESTING_URL).origin) {
      return [origin];
    }

    // Trust any *.totalum-project.com subdomain
    if (/^https:\/\/[^/]+\.totalum-project\.com$/.test(origin)) return [origin];

    // Trust same-host requests (custom domain served by this same worker)
    const host = request.headers.get("host");
    if (host && origin === `https://${host}`) return [origin];

    return [];
  },

  // Advanced security options — cookie security is based on whether effectiveUrl is HTTPS.
  // In testing mode (TESTING_MODE=true via test:serve), effectiveUrl is localhost HTTP,
  // so cookies use http-compatible settings (no __Secure- prefix, secure=false, sameSite=lax).
  advanced: (() => {
    const isHttps = effectiveUrl.startsWith("https://");
    const sameSiteValue = isHttps ? "none" as const : "lax" as const;
    return {
      cookiePrefix: "better-auth",
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isHttps,
        sameSite: sameSiteValue,
        path: "/",
      },
      crossSubDomainCookies: {
        enabled: false,
      },
      cookies: {
        session_token: {
          attributes: {
            sameSite: sameSiteValue,
            secure: isHttps,
            httpOnly: true,
            path: "/",
          },
        },
        session_data: {
          attributes: {
            sameSite: sameSiteValue,
            secure: isHttps,
            httpOnly: true,
            path: "/",
          },
        },
      },
      useSecureCookies: isHttps,
    };
  })(),

  // Plugins
  plugins: [
    bearer(), // Bearer token support for API clients
    nextCookies(), // Auto-set cookies in server actions (must be last)
  ],

  // ============================================================================
  // USER ADDITIONAL FIELDS - Multi-role / Multi-type User Systems (only if is needed)
  // ============================================================================
  //
  // To add custom user fields (e.g., role, user_type, company_id):
  //
  // 1. Add the field to additionalFields below
  // 2. Add the same field (snake_case) to the Totalum "user" table
  // 3. Create an ExtendedUser interface below for type safety
  //
  // EXAMPLE - Adding a "role" field:
  // ---------------------------------
  // additionalFields: {
  //   role: {
  //     type: "string",        // "string" | "number" | "boolean"
  //     required: false,       // true = required at registration
  //     defaultValue: "user",  // default value if not provided
  //     input: true,           // true = can be set during signUp
  //   },
  // },
  //
  // EXAMPLE - Multiple fields (role + user_type):
  // ----------------------------------------------
  // additionalFields: {
  //   role: {
  //     type: "string",
  //     required: false,
  //     defaultValue: "user",
  //     input: true,
  //   },
  //   user_type: {
  //     type: "string",
  //     required: false,
  //     input: true,
  //   },
  //   company_id: {
  //     type: "string",
  //     required: false,
  //     input: true,
  //   },
  // },
  //
  // IMPORTANT: After adding fields here, create an ExtendedUser interface:
  // ----------------------------------------------------------------------
  // export interface ExtendedUser {
  //   id: string;
  //   email: string;
  //   name: string;
  //   image?: string | null;
  //   emailVerified: boolean;
  //   createdAt: Date;
  //   updatedAt: Date;
  //   role?: string;        // <-- your custom field
  //   user_type?: string;   // <-- your custom field
  // }
  //
  // USAGE in components:
  // --------------------
  // import { useSession } from '@/lib/auth-client';
  // import type { ExtendedUser } from '@/lib/auth';
  //
  // const { data: session } = useSession();
  // const user = session?.user as ExtendedUser;
  // if (user?.role === 'admin') { /* admin logic */ }
  //
  // ============================================================================
  user: {
    additionalFields: {
      // Add your custom user fields here (see examples above)
    },
  },
});

// Base types from Better Auth
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
