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
    // requireEmailVerification: true, // Disabled: blocks existing users who haven't verified
    // PASSWORD RECOVERY
    sendResetPassword: async ({ user, url }) => {
      console.log("[Auth] Sending password reset email to:", user.email);
      await totalumSdk.email.sendEmail({
        to: [user.email],
        subject: "Reset your password - VibeBuild",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #111; border-radius: 12px; line-height: 48px; text-align: center;">
                <span style="color: white; font-size: 20px;">V</span>
              </div>
            </div>
            <h2 style="color: #111; font-size: 22px; margin-bottom: 12px; text-align: center;">Reset your password</h2>
            <p style="color: #666; font-size: 15px; line-height: 1.6; text-align: center; margin-bottom: 28px;">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${url}" style="display: inline-block; background: #111; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
                Reset Password
              </a>
            </div>
            <p style="color: #999; font-size: 13px; text-align: center; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email.<br>
              This link expires in 1 hour.
            </p>
          </div>
        `,
      });
    },
    resetPasswordTokenExpiresIn: 3600,
  },

  // EMAIL VERIFICATION
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log("[Auth] Sending verification email to:", user.email);
      await totalumSdk.email.sendEmail({
        to: [user.email],
        subject: "Verify your email - VibeBuild",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #111; border-radius: 12px; line-height: 48px; text-align: center;">
                <span style="color: white; font-size: 20px;">V</span>
              </div>
            </div>
            <h2 style="color: #111; font-size: 22px; margin-bottom: 12px; text-align: center;">Verify your email</h2>
            <p style="color: #666; font-size: 15px; line-height: 1.6; text-align: center; margin-bottom: 28px;">
              Click the button below to verify your email address and activate your account.
            </p>
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${url}" style="display: inline-block; background: #111; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
                Verify Email
              </a>
            </div>
            <p style="color: #999; font-size: 13px; text-align: center; line-height: 1.5;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    },
  },

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
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
});

// Base types from Better Auth
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];

// Extended user type with custom fields
export interface ExtendedUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role?: string;
}
