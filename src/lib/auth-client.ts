"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Use the current browser origin so auth works on both default and custom domains
  // without needing a re-deploy. Falls back to env var for SSR/server context.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
});

// Export commonly used hooks and methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  $Infer,
  // ===========================================================================
  // PASSWORD RECOVERY - Uncomment when sendResetPassword is enabled in auth.ts
  // ===========================================================================
  // forgetPassword,  // Call: forgetPassword({ email, redirectTo: "/reset-password" })
  // resetPassword,   // Call: resetPassword({ token, newPassword })

  // ===========================================================================
  // EMAIL VERIFICATION - Uncomment when emailVerification is enabled in auth.ts
  // ===========================================================================
  // sendVerificationEmail,  // Call: sendVerificationEmail({ email, callbackURL: "/verify-email" })
} = authClient;

// ===========================================================================
// SOCIAL SIGN-IN - Already available through signIn export
// ===========================================================================
// Usage: signIn.social({ provider: "google" })
// Usage: signIn.social({ provider: "github" })
