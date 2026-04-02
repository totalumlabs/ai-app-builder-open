"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Lock, CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword({ token, newPassword: password });
      if (result.error) {
        setError(result.error.message || "Failed to reset password. The link may have expired.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f0eb 25%, #ede4db 50%, #e8dfd6 75%, #f2ece6 100%)" }}>
        <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Password reset!</CardTitle>
            <CardDescription className="text-base">
              Your password has been successfully updated
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Link href="/login" className="w-full">
              <Button className="w-full h-11 text-base font-semibold bg-gray-900 hover:bg-gray-800">
                Sign in with new password
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f0eb 25%, #ede4db 50%, #e8dfd6 75%, #f2ece6 100%)" }}>
      <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-7 h-7 text-gray-500" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Set new password</CardTitle>
          <CardDescription className="text-base">
            Choose a strong password for your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 transition-all focus:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 transition-all focus:ring-2"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gray-900 hover:bg-gray-800"
              disabled={loading || !password.trim() || !confirmPassword.trim()}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f0eb 25%, #ede4db 50%, #e8dfd6 75%, #f2ece6 100%)" }}>
        <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight">Set new password</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
