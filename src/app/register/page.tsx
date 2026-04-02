"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Mail } from "lucide-react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: "", name: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); setLoading(false); return; }
    if (formData.password.length < 6) { setError("Password must be at least 6 characters long"); setLoading(false); return; }
    try {
      const result = await signUp.email({ email: formData.email, password: formData.password, name: formData.name, callbackURL: "/verify-email" });
      if (result.error) { setError(result.error.message || "Error registering. The email might already be in use."); setLoading(false); return; }
      setEmailSent(true);
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Error registering. The email might already be in use.");
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#fcfbf8" }}>
        <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <Mail className="w-7 h-7 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Check your email</CardTitle>
            <CardDescription className="text-base">
              We sent a verification link to <strong className="text-gray-700">{formData.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-gray-500">Click the link in the email to activate your account.</p>
            <p className="text-xs text-gray-400">Didn&apos;t receive it? Check your spam folder.</p>
          </CardContent>
          <CardFooter className="pt-2">
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full h-11">Go to Sign In</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#fcfbf8" }}>
      <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          <CardTitle className="text-3xl font-bold tracking-tight">Create Account</CardTitle>
          <CardDescription className="text-base">Enter your information to get started</CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-5">
            {error && (<Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2"><AlertDescription>{error}</AlertDescription></Alert>)}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="h-11 transition-all focus:ring-2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
              <Input id="name" type="text" placeholder="Your name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="h-11 transition-all focus:ring-2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input id="password" type="password" placeholder="At least 6 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} className="h-11 transition-all focus:ring-2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
              <Input id="confirmPassword" type="password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required minLength={6} className="h-11 transition-all focus:ring-2" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="w-full h-11 text-base font-semibold bg-gray-900 hover:bg-gray-800" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline transition-colors">Sign in here</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
