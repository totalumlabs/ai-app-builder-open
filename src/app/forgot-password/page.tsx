"use client";

import { useState } from "react";
import { forgetPassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await forgetPassword({ email, redirectTo: "/reset-password" });
      if (result.error) {
        setError(result.error.message || "Failed to send reset email. Please check your email address.");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f0eb 25%, #ede4db 50%, #e8dfd6 75%, #f2ece6 100%)" }}>
        <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Check your email</CardTitle>
            <CardDescription className="text-base">
              We sent a password reset link to <strong className="text-gray-700">{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-gray-500">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
            <p className="text-xs text-gray-400">
              Didn&apos;t receive the email? Check your spam folder or try again.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 pt-4">
            <Button variant="outline" className="w-full h-11" onClick={() => setSent(false)}>
              Try a different email
            </Button>
            <Link href="/login" className="text-sm text-center text-gray-500 hover:text-gray-700 transition-colors">
              Back to sign in
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
            <Mail className="w-7 h-7 text-gray-500" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Forgot your password?</CardTitle>
          <CardDescription className="text-base">
            Enter your email and we&apos;ll send you a link to reset it
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
              <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 transition-all focus:ring-2"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gray-900 hover:bg-gray-800"
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
            <Link href="/login" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mx-auto">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
